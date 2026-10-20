//! 设置的读写。
//!
//! ## 为什么不用 `tauri-plugin-store`
//!
//! 早先设置走 `tauri-plugin-store`，权限是 `store:default`。那个权限集把
//! **全部** store 命令都开给了前端，其中 `load` / `get_store` 接受任意路径，
//! 由 `app.path().resolve(path, BaseDirectory::AppData)` 解析——
//! 而 Tauri 的路径解析只是把调用方的路径**拼**到应用数据目录后面，
//! 不折叠 `..`。也就是说，一旦页面里出现脚本执行（Markdown 预览是首要
//! 嫌疑），它就能读写用户可写的任意文件，包括启动目录——从「渲染一段
//! 恶意 HTML」升级成「持久化执行」。
//!
//! 而这个插件在 2.x 里**不支持给 store 路径加 scope**（权限清单里每条都是
//! "without any pre-configured scope"），所以没法收窄，只能换掉。
//!
//! 现在与 session / recent / draft 走同一套：文件名由 Rust 侧写死，
//! 前端只说「读设置」「写设置」，路径不经过前端。顺带还有两个好处：
//! 写入走 `atomic::write_bytes`（临时文件 + fsync + rename），
//! 与项目里其它写盘路径一致；序列化在 Rust 侧完成，前端只拿一份 JSON。

use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::core::{atomic, paths};
use crate::model::{AppError, AppResult};

/// 设置文件的存储名。
///
/// 与前端 `constants.ts` 的 `SETTINGS_STORE_FILE` 一致；两边都只用于展示与
/// 日志，真正的路径在这里拼。
const SETTINGS_FILE: &str = "settings.json";

/// 解析存储路径。应用数据目录由 Tauri 提供，不硬编码绝对路径。
fn store_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("无法定位应用数据目录：{e}")))?;
    std::fs::create_dir_all(&dir).map_err(|e| AppError::from_io(&paths::to_slash(&dir), e))?;
    Ok(dir.join(SETTINGS_FILE))
}

/// 读取设置。
///
/// 返回**原始 JSON 文本**而不是结构体：设置的字段集合与默认值由前端
/// `utils/settings.ts` 的 `validateSettings` 统一校验（那里已经把所有
/// 持久化值当作不可信输入逐字段检查），Rust 侧再定义一份结构体只会
/// 让两处逐渐漂移——加一个设置项就得改两个仓库位置。
///
/// 文件不存在或读不出来时返回 `None`，由前端回落到默认值：
/// 设置属于便利功能，一个坏文件不该让应用打不开。
#[tauri::command]
pub async fn settings_load(app: AppHandle) -> AppResult<Option<String>> {
    crate::core::persistence::run(move || {
        let path = match store_path(&app) {
            Ok(path) => path,
            Err(_) => return Ok(None),
        };
        match std::fs::read_to_string(&path) {
            Ok(text) => Ok(Some(text)),
            // 不存在、无权限、编码坏了：都当作「没有设置」处理
            Err(_) => Ok(None),
        }
    })
    .await
}

/// 写入设置。
///
/// `text` 是前端序列化好的 JSON 文本。大小上限沿用 `MAX_WRITE_BYTES`：
/// 设置文件不该有几十兆，超了说明调用方有问题，拒绝比写坏好。
#[tauri::command]
pub async fn settings_save(app: AppHandle, text: String) -> AppResult<()> {
    crate::core::persistence::run(move || {
        if text.len() > crate::constants::MAX_WRITE_BYTES {
            return Err(AppError::TooLarge {
                size: text.len() as u64,
                limit: crate::constants::MAX_WRITE_BYTES as u64,
            });
        }
        let path = store_path(&app)?;
        atomic::write_bytes(&path, text.as_bytes())
    })
    .await
}
