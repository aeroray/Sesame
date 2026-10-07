//! 最近文件列表的读写。
//!
//! 存放在应用数据目录下的 `recent.json`，与前端设置（plugin-store）分开，
//! 避免两类数据互相覆盖。

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

use crate::constants::RECENT_LIMIT;
use crate::core::paths;
use crate::model::{AppError, AppResult, RecentEntry};

/// 最近文件列表的存储文件名。
const RECENT_FILE: &str = "recent.json";

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
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
    serde_json::from_str::<Vec<RecentEntry>>(&text).unwrap_or_default()
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
        entries.insert(
            0,
            RecentEntry {
                name: paths::display_name(&resolved),
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
