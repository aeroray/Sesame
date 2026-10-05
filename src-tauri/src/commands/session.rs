//! 会话恢复：记录上次打开的标签页，下次启动时还原。
//!
//! 与最近文件分开存储：最近文件是「打开历史」，会话是「上次的工作现场」，
//! 两者用途不同，混在一起会让「清空最近文件」误删会话。

use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::core::paths;
use crate::model::{AppError, AppResult, SessionSnapshot};

/// 会话文件的存储名。
const SESSION_FILE: &str = "session.json";

/// 解析存储路径。应用数据目录由 Tauri 提供，不硬编码绝对路径。
fn store_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("无法定位应用数据目录：{e}")))?;
    std::fs::create_dir_all(&dir).map_err(|e| AppError::from_io(&paths::to_slash(&dir), e))?;
    Ok(dir.join(SESSION_FILE))
}

/// 读取会话快照。
///
/// 文件缺失或损坏时返回空快照而不是报错——会话恢复属于便利功能，
/// 一个坏掉的 json 不该让应用启动失败。
#[tauri::command]
pub async fn session_load(app: AppHandle) -> AppResult<SessionSnapshot> {
    let Ok(path) = store_path(&app) else {
        return Ok(SessionSnapshot::default());
    };
    let Ok(text) = std::fs::read_to_string(&path) else {
        return Ok(SessionSnapshot::default());
    };
    Ok(serde_json::from_str(&text).unwrap_or_default())
}

/// 保存会话快照。
#[tauri::command]
pub async fn session_save(app: AppHandle, snapshot: SessionSnapshot) -> AppResult<()> {
    let path = store_path(&app)?;
    let text = serde_json::to_string_pretty(&snapshot)
        .map_err(|e| AppError::Io(format!("序列化失败：{e}")))?;
    std::fs::write(&path, text).map_err(|e| AppError::from_io(&paths::to_slash(&path), e))
}

/// 清空会话。
#[tauri::command]
pub async fn session_clear(app: AppHandle) -> AppResult<()> {
    let path = store_path(&app)?;
    // 文件不存在时视为已清空，不算错误
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(AppError::from_io(&paths::to_slash(&path), e)),
    }
}
