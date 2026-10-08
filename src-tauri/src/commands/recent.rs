//! 最近文件列表的读写。
//!
//! 存放在应用数据目录下的 `recent.json`，与前端设置（plugin-store）分开，
//! 避免两类数据互相覆盖。

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

use crate::constants::RECENT_LIMIT;
use crate::core::{lang_map, paths};
use crate::model::{AppError, AppResult, RecentEntry};

/// 最近文件列表的存储文件名。
const RECENT_FILE: &str = "recent.json";

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 判定一个路径属于哪一类，返回 `(kind, language)`。
///
/// **复用打开文件时的那两个函数**，而不是在前端另写一份扩展名表：
/// 编码选择器就吃过两边各维护一份、逐渐漂移的亏
/// （见 `state/encodings.svelte.ts` 的说明）。这里同理——
/// 最近列表的图标必须与打开后的标签图标一致。
///
/// 图片优先判断：`image_mime` 认得 `.svg`，而 `detect_language` 会把
/// `.svg` 归为 `xml`（它确实也是 XML），但用户看到的应该是图片图标。
fn classify(path: &str) -> (&'static str, &'static str) {
    if lang_map::image_mime(path).is_some() {
        return ("image", "");
    }
    ("text", lang_map::detect_language(path).0)
}

/// 解析存储路径。应用数据目录由 Tauri 提供，不硬编码任何绝对路径。
fn store_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("无法定位应用数据目录：{e}")))?;
    std::fs::create_dir_all(&dir).map_err(|e| AppError::from_io(&paths::to_slash(&dir), e))?;
    Ok(dir.join(RECENT_FILE))
}

/// 读取列表。文件不存在或损坏时返回空列表，而不是报错——
/// 最近文件属于便利功能，不应阻塞启动。
fn load(app: &AppHandle) -> Vec<RecentEntry> {
    let Ok(path) = store_path(app) else {
        return Vec::new();
    };
    let Ok(text) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    let mut entries = serde_json::from_str::<Vec<RecentEntry>>(&text).unwrap_or_default();

    /*
     * 补齐缺失的分类字段。
     *
     * `kind` / `language` 是后加的，老版本的 `recent.json` 里没有它们
     * （`serde(default)` 会让它们变成空串）。空串在前端无法选图标，
     * 因此在这里就地按路径重新判定一次——比让前端处理「空即未知」更省事，
     * 也保证旧数据与新增记录走的是同一套判定。
     */
    for entry in &mut entries {
        if entry.kind.is_empty() {
            let (kind, language) = classify(&entry.path);
            entry.kind = kind.to_string();
            entry.language = language.to_string();
        }
    }

    entries
}

fn save(app: &AppHandle, entries: &[RecentEntry]) -> AppResult<()> {
    let path = store_path(app)?;
    let text = serde_json::to_string_pretty(entries)
        .map_err(|e| AppError::Io(format!("序列化失败：{e}")))?;
    crate::core::atomic::write_bytes(&path, text.as_bytes())
}

/// 获取最近文件列表。
#[tauri::command]
pub async fn recent_list(app: AppHandle) -> AppResult<Vec<RecentEntry>> {
    crate::core::persistence::run(move || Ok(load(&app))).await
}

/// 记录一次打开。已存在的路径会移动到最前。
#[tauri::command]
pub async fn recent_add(app: AppHandle, path: String) -> AppResult<Vec<RecentEntry>> {
    crate::core::persistence::run(move || {
        let resolved = paths::normalize(&path, None)?;
        let slash = paths::to_slash(&resolved);

        let mut entries = load(&app);
        entries.retain(|e| e.path != slash);
        let (kind, language) = classify(&slash);
        entries.insert(
            0,
            RecentEntry {
                name: paths::display_name(&resolved),
                // 与打开文件时同一套判定，保证列表图标与标签图标一致
                kind: kind.to_string(),
                language: language.to_string(),
                path: slash,
                opened_at: now_millis(),
            },
        );
        entries.truncate(RECENT_LIMIT);
        save(&app, &entries)?;
        Ok(entries)
    })
    .await
}

/// 清空最近文件列表。
#[tauri::command]
pub async fn recent_clear(app: AppHandle) -> AppResult<Vec<RecentEntry>> {
    crate::core::persistence::run(move || {
        save(&app, &[])?;
        Ok(Vec::new())
    })
    .await
}

/// 移除单个条目。
#[tauri::command]
pub async fn recent_remove(app: AppHandle, path: String) -> AppResult<Vec<RecentEntry>> {
    crate::core::persistence::run(move || {
        let resolved = paths::normalize(&path, None)?;
        let slash = paths::to_slash(&resolved);

        let mut entries = load(&app);
        entries.retain(|e| e.path != slash);
        save(&app, &entries)?;
        Ok(entries)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::classify;

    #[test]
    fn images_are_classified_as_images() {
        for path in ["a.png", "b.JPG", "c.jpeg", "d.webp", "e.gif", "f.bmp"] {
            assert_eq!(classify(path).0, "image", "{path}");
        }
    }

    #[test]
    fn svg_is_an_image_not_xml() {
        // `.svg` 也是合法 XML，`detect_language` 会把它归为 xml；
        // 但用户看到的是图片，因此图片判定必须优先。
        assert_eq!(classify("icon.svg").0, "image");
    }

    #[test]
    fn text_files_carry_their_language() {
        assert_eq!(classify("notes.md"), ("text", "markdown"));
        assert_eq!(classify("main.rs"), ("text", "rust"));
        assert_eq!(classify("data.json"), ("text", "json"));
        assert_eq!(classify("page.html"), ("text", "html"));
        assert_eq!(classify("App.svelte"), ("text", "html"));
    }

    #[test]
    fn unknown_text_is_plaintext_not_image() {
        assert_eq!(classify("data.xyz"), ("text", "plaintext"));
        assert_eq!(classify("noext"), ("text", "plaintext"));
        // 以点开头的隐藏文件不算扩展名
        assert_eq!(classify(".gitignore").0, "text");
    }
}
