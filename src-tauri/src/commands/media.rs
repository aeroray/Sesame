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

/// Show an application chooser without reopening Sesame through its own default association.
#[tauri::command]
pub async fn open_image_externally(
    path: String,
    application: Option<String>,
    window: tauri::WebviewWindow,
) -> AppResult<()> {
    let resolved = paths::normalize(&path, None)?;
    let resolved = tauri::async_runtime::spawn_blocking(move || {
        let slash = paths::to_slash(&resolved);
        if lang_map::image_mime(&slash).is_none() {
            return Err(AppError::InvalidPath(format!(
                "不是可识别的图片格式：{slash}"
            )));
        }
        let meta = std::fs::metadata(&resolved).map_err(|err| AppError::from_io(&slash, err))?;
        if !meta.is_file() {
            return Err(AppError::NotAFile(slash));
        }
        Ok(resolved)
    })
    .await
    .map_err(AppError::from_join)??;
    crate::core::external::open_image(window, resolved, application).await
}

/// 图片读取的同步实现。
fn read_image_sync(resolved: std::path::PathBuf, mime: &'static str) -> AppResult<ImagePayload> {
    use std::io::Read;
    let slash = paths::to_slash(&resolved);
    let meta = std::fs::metadata(&resolved).map_err(|e| AppError::from_io(&slash, e))?;

    if !meta.is_file() {
        return Err(AppError::NotAFile(slash));
    }

    if meta.len() > MAX_IMAGE_BYTES {
        return Err(AppError::TooLarge {
            size: meta.len(),
            limit: MAX_IMAGE_BYTES,
        });
    }

    let mut bytes = Vec::new();
    std::fs::File::open(&resolved)
        .and_then(|f| f.take(MAX_IMAGE_BYTES + 1).read_to_end(&mut bytes))
        .map_err(|e| AppError::from_io(&slash, e))?;
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err(AppError::TooLarge {
            size: bytes.len() as u64,
            limit: MAX_IMAGE_BYTES,
        });
    }
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(ImagePayload {
        data_url: format!("data:{mime};base64,{encoded}"),
        mime: mime.to_string(),
        size: bytes.len() as u64,
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
                modified_ns: None,
                size: 0,
            },
        },
    );

    Ok(payload)
}

/// 把图片另存到指定路径。
///
/// ## 为什么是**复制**而不是移动
///
/// 「另存为」在图片语境下是「导出一份副本」——用户想把这张图放到别处，
/// 而不是把原文件搬走。移动会让他下次在原位置找不到文件。
///
/// ## 为什么不做格式转换
///
/// 只按原字节复制，**不改扩展名、不重新编码**。转换格式需要图像编解码
/// 依赖（`image` crate 及其 feature），而本项目刻意保持轻量；
/// 且重新编码必然损失画质或元数据（EXIF 会丢），
/// 那不该由一次「另存为」悄悄完成。
///
/// 目标路径由前端从系统对话框取得，因此这里不再弹任何 UI。
#[tauri::command]
pub async fn save_image_as(source: String, target: String) -> AppResult<String> {
    let source_path = paths::normalize(&source, None)?;
    let target_path = paths::normalize(&target, None)?;

    let saved = tauri::async_runtime::spawn_blocking(move || {
        let source_slash = paths::to_slash(&source_path);
        let target_slash = paths::to_slash(&target_path);

        if lang_map::image_mime(&source_slash).is_none() {
            return Err(AppError::InvalidPath(format!(
                "不是可识别的图片格式：{source_slash}"
            )));
        }

        let meta =
            std::fs::metadata(&source_path).map_err(|err| AppError::from_io(&source_slash, err))?;
        if !meta.is_file() {
            return Err(AppError::NotAFile(source_slash));
        }
        if meta.len() > MAX_IMAGE_BYTES {
            return Err(AppError::TooLarge {
                size: meta.len(),
                limit: MAX_IMAGE_BYTES,
            });
        }

        /*
         * 读进来再原子写出，而不是 `fs::copy`。
         *
         * `fs::copy` 会直接覆盖目标，写到一半失败就留下一个残缺文件；
         * 走 `atomic::write_bytes` 则是「临时文件 + fsync + rename」，
         * 与项目里其它写盘路径一致。图片最大 20 MB，读进内存没有压力。
         */
        let bytes = std::fs::read(&source_path).map_err(|err| AppError::from_io(&source_slash, err))?;
        crate::core::atomic::write_bytes(&target_path, &bytes)?;

        Ok(target_slash)
    })
    .await
    .map_err(AppError::from_join)??;

    Ok(saved)
}

/// 把图片设为桌面壁纸。
///
/// 仅 Windows 支持。macOS 没有等价的公开 API（改壁纸要写
/// `~/Library/Application Support/com.apple.wallpaper` 或走 AppleScript，
/// 两者都不可靠），因此那里直接返回不支持，而不是留个按不动的菜单项。
///
/// ## 为什么要转成 BMP
///
/// `SystemParametersInfoW(SPI_SETDESKWALLPAPER)` 只认 **BMP**：
/// 传 PNG / JPEG 路径不会报错，但壁纸**不会变**（实测如此，静默失败）。
/// 因此这里用系统自带的 `System.Drawing`（.NET）先转成临时 BMP，
/// 再把那个路径交给 API。
///
/// 之所以借道 .NET 而不是引 `image` crate：Windows 上 PowerShell 与
/// .NET 一定存在，不需要新增任何依赖，也不需要为 JPEG / GIF / WebP
/// 各写一遍解码。代价是要起一个子进程，但改壁纸是低频操作。
#[tauri::command]
pub async fn set_as_wallpaper(path: String) -> AppResult<()> {
    let resolved = paths::normalize(&path, None)?;

    tauri::async_runtime::spawn_blocking(move || {
        let slash = paths::to_slash(&resolved);
        if lang_map::image_mime(&slash).is_none() {
            return Err(AppError::InvalidPath(format!(
                "不是可识别的图片格式：{slash}"
            )));
        }
        let meta = std::fs::metadata(&resolved).map_err(|err| AppError::from_io(&slash, err))?;
        if !meta.is_file() {
            return Err(AppError::NotAFile(slash));
        }

        #[cfg(windows)]
        {
            crate::core::wallpaper::set_wallpaper(&resolved)
        }
        #[cfg(not(windows))]
        {
            Err(AppError::Unsupported(
                "只有 Windows 支持设为壁纸".to_string(),
            ))
        }
    })
    .await
    .map_err(AppError::from_join)?
}

/// 把前端重绘后的图片数据写回文件。
///
/// ## 为什么数据由前端给
///
/// 旋转 / 翻转是**像素级重绘**（见 `lib/utils/image-transform.ts` 的说明：
/// CSS 变换只改显示、不改像素，会导致尺寸与滚动范围错乱）。
/// 重绘在前端的 canvas 上完成，因此这里接收的是已经编码好的图片字节
/// （base64 data URL），只负责落盘。
///
/// 这样 Rust 侧**不需要任何图像编解码依赖**——这正是本项目保持轻量的
/// 关键取舍：解码交给 WebView（它本来就会），编码交给 canvas。
///
/// ## 安全边界
///
/// - 只接受 `data:image/*;base64,` 前缀，拒绝其它内容
/// - 大小上限沿用 `MAX_IMAGE_BYTES`
/// - 走 `atomic::write_bytes`（临时文件 + fsync + rename），
///   写到一半失败不会把原图毁成残缺文件
///
/// ## 关于画质
///
/// JPEG 重编码必然有损（实测 `rgb(32,64,128)` → `rgb(30,66,123)`）。
/// **这个事实由调用方负责告知用户**——Rust 侧只管写，
/// 不做「静默降级」之类的额外决策。
#[tauri::command]
pub async fn write_image_data(path: String, data_url: String) -> AppResult<()> {
    let resolved = paths::normalize(&path, None)?;

    tauri::async_runtime::spawn_blocking(move || {
        let slash = paths::to_slash(&resolved);

        if lang_map::image_mime(&slash).is_none() {
            return Err(AppError::InvalidPath(format!(
                "不是可识别的图片格式：{slash}"
            )));
        }

        /*
         * 解析 data URL。
         *
         * 只认 `data:image/<subtype>;base64,<payload>` 这一种形式。
         * 前端给的是 canvas 的 `toDataURL()` 结果，格式固定；
         * 这里仍严格校验，因为这个参数来自前端，
         * 不该假定它一定是预期形态。
         */
        let comma = data_url
            .find(',')
            .ok_or_else(|| AppError::InvalidPath("图片数据格式不正确".to_string()))?;
        let (header, payload) = data_url.split_at(comma);
        let payload = &payload[1..];

        if !header.starts_with("data:image/") || !header.ends_with(";base64") {
            return Err(AppError::InvalidPath(
                "图片数据必须是 data:image/*;base64 形式".to_string(),
            ));
        }

        let bytes = base64::engine::general_purpose::STANDARD
            .decode(payload)
            .map_err(|err| AppError::InvalidPath(format!("图片数据不是合法的 base64：{err}")))?;

        if bytes.is_empty() {
            return Err(AppError::InvalidPath("图片数据为空".to_string()));
        }
        if bytes.len() as u64 > MAX_IMAGE_BYTES {
            return Err(AppError::TooLarge {
                size: bytes.len() as u64,
                limit: MAX_IMAGE_BYTES,
            });
        }

        crate::core::atomic::write_bytes(&resolved, &bytes)?;
        Ok(())
    })
    .await
    .map_err(AppError::from_join)?
}
