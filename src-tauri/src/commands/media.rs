//! 图片读取。
//!
//! 以 data URL 返回，而不是走 Tauri 的 asset 协议：
//! asset 协议需要在 capabilities 里为每个路径开 scope，而文件对话框选中的路径
//! 是运行期才知道的；data URL 不需要任何额外权限，且图片体积本来就有上限。

use base64::Engine;
use tauri::State;

use crate::constants::MAX_IMAGE_BYTES;
use crate::core::{lang_map, paths};
use crate::model::{AppError, AppResult, ImagePayload};
use crate::state::AppState;

/// 图片读取的同步实现。
fn read_image_sync(resolved: std::path::PathBuf, mime: &'static str) -> AppResult<ImagePayload> {
    let slash = paths::to_slash(&resolved);
    let meta = std::fs::metadata(&resolved).map_err(|e| AppError::from_io(&slash, e))?;

    if meta.is_dir() {
        return Err(AppError::NotAFile(slash));
    }

    if meta.len() > MAX_IMAGE_BYTES {
        return Err(AppError::TooLarge {
            size: meta.len(),
            limit: MAX_IMAGE_BYTES,
        });
    }

    let bytes = std::fs::read(&resolved).map_err(|e| AppError::from_io(&slash, e))?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(ImagePayload {
        data_url: format!("data:{mime};base64,{encoded}"),
        mime: mime.to_string(),
        size: meta.len(),
        name: paths::display_name(&resolved),
        path: slash,
    })
}

/// 读取图片并返回 data URL。
#[tauri::command]
pub async fn read_image(path: String, state: State<'_, AppState>) -> AppResult<ImagePayload> {
    let resolved = paths::normalize(&path, None)?;
    let slash = paths::to_slash(&resolved);

    let mime = lang_map::image_mime(&slash)
        .ok_or_else(|| AppError::InvalidPath(format!("不是可识别的图片格式：{slash}")))?;

    let payload = tauri::async_runtime::spawn_blocking(move || read_image_sync(resolved, mime))
        .await
        .map_err(AppError::from_join)??;

    // 记录为二进制，保存路径据此拒绝把文本写回图片。
    // 指纹留空：图片永远走不到保存前复核那一步（会被 encoding == "binary" 拦掉）。
    state.remember(
        payload.path.clone(),
        crate::state::OpenFile {
            encoding: "binary".to_string(),
            line_ending: "lf".to_string(),
            has_bom: false,
            baseline: crate::state::Fingerprint {
                modified_ms: None,
                size: 0,
            },
        },
    );

    Ok(payload)
}
