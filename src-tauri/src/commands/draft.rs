//! 未保存内容的草稿备份。
//!
//! 解决的问题：**未命名标签的正文没有任何落盘去处**。
//! 它没有路径，自动保存帮不上忙；会话快照只记路径，也带不走正文。
//! 于是「新建 → 输入 → 关窗口」会静默丢内容（实测确认）。
//!
//! 这里把未保存的正文另存一份到应用数据目录的 `drafts/`，
//! 下次启动时读回来。它同时带来两个好处：
//!
//! - **未命名内容不再丢失**：恢复成一个同样未命名的标签，正文完好。
//! - **崩溃保护**：进程被强杀时，最后一次备份仍在磁盘上。
//!
//! 与 `session.json` 分开存放是刻意的：会话是「上次的工作现场」（轻量、常写），
//! 草稿是「未落盘的正文」（可能很大、只在脏的时候写）。混在一起会让
//! 每次切标签都重写全部正文。

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::core::paths;
use crate::model::{AppError, AppResult};

/// 草稿目录名。
const DRAFT_DIR: &str = "drafts";

/// 一份草稿。
///
/// 字段与 `Tab` 对齐，恢复时可以直接还原成一个标签页，
/// 不需要用户再选一次编码或语言。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    /// 标签页 id，用作文件名。
    pub id: String,
    /// 原文件路径。未命名标签为 `None`。
    pub path: Option<String>,
    /// 显示名，未命名标签形如「未命名 1」。
    pub name: String,
    /// 正文。可能很大，因此单独成文件而不是塞进一个总表。
    pub content: String,
    pub language: String,
    pub encoding: String,
    pub line_ending: String,
    pub has_bom: bool,
    /// 备份时间，Unix 毫秒。
    pub saved_at: u64,
}

/// 草稿目录路径，不存在时创建。
fn draft_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("无法定位应用数据目录：{e}")))?
        .join(DRAFT_DIR);
    std::fs::create_dir_all(&dir).map_err(|e| AppError::from_io(&paths::to_slash(&dir), e))?;
    Ok(dir)
}

/// 过滤草稿 id，只保留字母数字与短横线/下划线。
///
/// id 由前端生成，但仍要过滤：`draft_path` 会把它拼进文件名，
/// 若放任 `../` 之类的字符进入，就能写到草稿目录之外。
/// 单独抽成函数是为了能直接对它做测试。
fn sanitize_id(id: &str) -> Option<String> {
    let safe: String = id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();

    if safe.is_empty() {
        None
    } else {
        Some(safe)
    }
}

/// 单个草稿的文件路径。
fn draft_path(app: &AppHandle, id: &str) -> AppResult<PathBuf> {
    let safe =
        sanitize_id(id).ok_or_else(|| AppError::InvalidPath("草稿 id 非法".into()))?;
    Ok(draft_dir(app)?.join(format!("{safe}.json")))
}

/// 写入一份草稿。
#[tauri::command]
pub async fn draft_save(app: AppHandle, draft: Draft) -> AppResult<()> {
    let path = draft_path(&app, &draft.id)?;
    let text = serde_json::to_string(&draft).map_err(|e| AppError::Io(format!("序列化失败：{e}")))?;

    // 先写临时文件再改名，避免写到一半崩溃留下半个 json
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, text).map_err(|e| AppError::from_io(&paths::to_slash(&tmp), e))?;
    std::fs::rename(&tmp, &path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        AppError::from_io(&paths::to_slash(&path), e)
    })
}

/// 删除一份草稿。
///
/// 内容已保存、用户选择不保存、或标签被关闭时调用。
#[tauri::command]
pub async fn draft_delete(app: AppHandle, id: String) -> AppResult<()> {
    let path = draft_path(&app, &id)?;
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        // 不存在即视为已删除
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(AppError::from_io(&paths::to_slash(&path), e)),
    }
}

/// 读出全部草稿。
///
/// 单个草稿损坏时跳过它而不是整体失败——一个坏文件不该让用户丢掉其余草稿。
#[tauri::command]
pub async fn draft_list(app: AppHandle) -> AppResult<Vec<Draft>> {
    let Ok(dir) = draft_dir(&app) else {
        return Ok(Vec::new());
    };
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Ok(Vec::new());
    };

    let mut out = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Ok(text) = std::fs::read_to_string(&path) {
            if let Ok(draft) = serde_json::from_str::<Draft>(&text) {
                out.push(draft);
            }
        }
    }

    // 按备份时间排序，恢复时顺序稳定
    out.sort_by_key(|d| d.saved_at);
    Ok(out)
}

/// 清空全部草稿。
#[tauri::command]
pub async fn draft_clear(app: AppHandle) -> AppResult<()> {
    let Ok(dir) = draft_dir(&app) else {
        return Ok(());
    };
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Ok(());
    };

    for entry in entries.flatten() {
        let _ = std::fs::remove_file(entry.path());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_keeps_normal_ids() {
        // 前端生成的 id 是 uuid，必须原样保留
        let id = "788db423-9d17-46f6-a41a-dad7f2ef536d";
        assert_eq!(sanitize_id(id).as_deref(), Some(id));
    }

    #[test]
    fn sanitize_strips_path_traversal() {
        // 路径分隔符与点号必须被剔除，否则能写到草稿目录之外
        let got = sanitize_id("../../evil").unwrap();
        assert!(!got.contains('/'));
        assert!(!got.contains('\\'));
        assert!(!got.contains('.'));
        assert_eq!(got, "evil");
    }

    #[test]
    fn sanitize_rejects_empty_and_symbols_only() {
        assert!(sanitize_id("").is_none());
        assert!(sanitize_id("...").is_none());
        assert!(sanitize_id("../").is_none());
        assert!(sanitize_id("/\\:").is_none());
    }

    #[test]
    fn sanitize_keeps_underscore_and_dash() {
        assert_eq!(sanitize_id("t-1_2").as_deref(), Some("t-1_2"));
    }
}
