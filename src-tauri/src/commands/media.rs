//! 图片读取。
//!
//! 以 data URL 返回，而不是走 Tauri 的 asset 协议：
//! asset 协议需要在 capabilities 里为每个路径开 scope，而文件对话框选中的路径
//! 是运行期才知道的；data URL 不需要任何额外权限，且图片体积本来就有上限。

use base64::Engine;
use tauri::{Manager, State};

use crate::constants::MAX_IMAGE_BYTES;
use crate::core::{lang_map, paths};
use crate::model::{AppError, AppResult, ImagePayload};
use crate::state::{AppState, Fingerprint};

/// 把 `data:image/<subtype>;base64,` 里的子类型取出来。
///
/// 只接受这一种形态，因此调用方须先确认前缀与后缀已匹配，
/// 否则这里取到的会是夹在中间的垃圾。
fn data_url_subtype(header: &str) -> Option<&str> {
    header
        .strip_prefix("data:image/")?
        .strip_suffix(";base64")
}

/// 判断 data URL 的子类型与目标文件扩展名是否相符。
///
/// 为什么需要这道校验：WebView 的 `canvas.toDataURL()` 对**无法编码**的
/// 类型不会报错，而是**静默退回 PNG**（实测 Edge/WebView2 同版本：
/// `image/gif`、`image/bmp`、`image/x-icon`、`image/avif` 全部返回
/// `data:image/png;base64,…`）。若照单写入，`logo.ico` 里就会装进一段
/// PNG 字节流——文件名没变、内容变了，其它程序按扩展名解码必然失败。
/// 前端已按同一规则拒绝，这里是第二道，免得将来多一个调用方就绕过去。
fn subtype_matches_extension(subtype: &str, path: &str) -> bool {
    let Some(expected) = lang_map::image_mime(path) else {
        return false;
    };
    let Some(expected) = expected.strip_prefix("image/") else {
        return false;
    };
    if subtype == expected {
        return true;
    }
    // 同一种格式的别名写法，逐个列出而不是做模糊匹配
    matches!(
        (subtype, expected),
        ("jpeg", "jpg") | ("jpg", "jpeg") | ("x-icon", "ico") | ("svg+xml", "svg")
    )
}

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

    // 读完再取一次指纹：读取期间文件若被改动，这里取到的是改动后的值，
    // 与稍后写回前的复核用的是同一时刻的状态，不会误报冲突。
    let baseline = crate::commands::fs::fingerprint(&resolved)?;

    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(ImagePayload {
        data_url: format!("data:{mime};base64,{encoded}"),
        mime: mime.to_string(),
        size: bytes.len() as u64,
        name: paths::display_name(&resolved),
        path: slash,
        baseline,
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
    // 指纹用真实值：图片的写回复核（`write_image_data`）以它为基线。
    state.remember(
        payload.path.clone(),
        crate::state::OpenFile {
            encoding: "binary".to_string(),
            line_ending: "lf".to_string(),
            has_bom: false,
            baseline: payload.baseline.clone(),
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

        /*
         * 目标扩展名必须与来源同格式。
         *
         * 这里按字节复制、不做任何转码，因此「另存为」只能改位置、不能改格式。
         * 系统对话框默认会带上原扩展名，但用户可以手动改掉——
         * 那样 `photo.png` 会变成 `photo.jpg`，内容是 PNG，别的程序按扩展名
         * 解码必然失败。与其写出一个名不副实的文件，不如直接拒绝。
         */
        if !lang_map::same_image_format(&source_slash, &target_slash) {
            return Err(AppError::Unsupported(format!(
                "另存为不转换格式，目标扩展名需与源文件一致：{target_slash}"
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
         * 与项目里其它写盘路径一致。图片最大 32 MB，读进内存没有压力。
         *
         * 读取**必须带上限**：上面那次 `metadata` 只是提前拒绝，
         * 文件可能在两次调用之间被写大（录屏、日志、刻意制造的竞态），
         * 此时无上限的 `fs::read` 会把 `MAX_IMAGE_BYTES` 当作建议而非约束。
         * 与 `read_image_sync` 用同一套 `take(...)` 写法。
         */
        use std::io::Read;
        let mut bytes = Vec::new();
        std::fs::File::open(&source_path)
            .and_then(|f| f.take(MAX_IMAGE_BYTES + 1).read_to_end(&mut bytes))
            .map_err(|err| AppError::from_io(&source_slash, err))?;
        if bytes.len() as u64 > MAX_IMAGE_BYTES {
            return Err(AppError::TooLarge {
                size: bytes.len() as u64,
                limit: MAX_IMAGE_BYTES,
            });
        }
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
/// - **子类型必须与文件扩展名相符**（见 `subtype_matches_extension`）：
///   否则 `logo.ico` 里会装进一段 PNG 字节流
/// - 大小上限沿用 `MAX_IMAGE_BYTES`，且**在解码之前**按 base64 长度预检，
///   避免一个超大串先分配出几百 MB 再被拒绝
/// - 写盘前复核指纹：文件被外部改过就返回 `conflict`，由前端让用户决定
/// - 走 `atomic::write_bytes`（临时文件 + fsync + rename），
///   写到一半失败不会把原图毁成残缺文件
///
/// ## 关于画质
///
/// JPEG 重编码必然有损（实测 `rgb(32,64,128)` → `rgb(30,66,123)`）。
/// **这个事实由调用方负责告知用户**——Rust 侧只管写，
/// 不做「静默降级」之类的额外决策。
#[tauri::command]
pub async fn write_image_data(
    path: String,
    data_url: String,
    expected: Option<Fingerprint>,
    app: tauri::AppHandle,
) -> AppResult<Fingerprint> {
    let resolved = paths::normalize(&path, None)?;

    // 前端没带指纹时退回后端记录的基线：图片读进来时已经存过一份
    // （见 `read_image`），因此这条兜底路径同样有真正的复核，
    // 而不是「没传就跳过检查」。
    let baseline = expected.or_else(|| {
        app.state::<AppState>()
            .recall(&paths::to_slash(&resolved))
            .map(|known| known.baseline)
            .filter(|known| known.modified_ns.is_some())
    });

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

        /*
         * 子类型与扩展名必须相符。
         *
         * `toDataURL()` 对无法编码的格式会**静默退回 PNG**，因此前端
         * 若漏判（或将来多一个调用方），这里就是最后一道：
         * 绝不让一个 `.ico` 装进 PNG 字节流。
         */
        let subtype = data_url_subtype(header)
            .ok_or_else(|| AppError::InvalidPath("图片数据格式不正确".to_string()))?;
        if !subtype_matches_extension(subtype, &slash) {
            return Err(AppError::Unsupported(format!(
                "图片数据是 {subtype}，与该文件的格式不符：{slash}"
            )));
        }

        /*
         * 先按 base64 长度预检，再解码。
         *
         * base64 编码后约为原始字节的 4/3，因此这个上界是紧的。
         * 早先只在解码之后判大小：一个远超上限的串会先被完整解码分配
         * 出来，峰值内存白白翻倍——而这张图随后还会被画进 canvas。
         */
        const MAX_BASE64_BYTES: usize = MAX_IMAGE_BYTES as usize / 3 * 4 + 4;
        if payload.len() > MAX_BASE64_BYTES {
            return Err(AppError::TooLarge {
                size: (payload.len() as u64 / 4) * 3,
                limit: MAX_IMAGE_BYTES,
            });
        }

        let bytes = base64::engine::general_purpose::STANDARD
            .decode(payload)
            .map_err(|err| AppError::InvalidPath(format!("图片数据不是合法的 base64：{err}")))?;

        if bytes.is_empty() {
            return Err(AppError::InvalidPath("图片数据为空".to_string()));
        }
        // 预检之后仍复核一次：base64 允许填充，边界上可能有几字节出入
        if bytes.len() as u64 > MAX_IMAGE_BYTES {
            return Err(AppError::TooLarge {
                size: bytes.len() as u64,
                limit: MAX_IMAGE_BYTES,
            });
        }

        /*
         * 复核与写入必须在同一把文件锁下。
         *
         * 文本保存（`save_file`）早就这样做了：先按路径取 `file_gate`，
         * 拿到锁之后才复核指纹、再写盘。这里原先没有锁——「检查」与
         * 「rename」之间有一个窗口，两次写回并发时双方都能通过复核，
         * 后写的覆盖先写的，而它记下的基线又对不上磁盘，
         * 于是**下一次合法的保存会被误判成外部修改**。
         *
         * 锁在阻塞闭包里获取，覆盖整个复核 + 写入 + 取新指纹的过程。
         */
        let gate = app.state::<AppState>().file_gate(&resolved)?;
        let _guard = gate
            .lock()
            .map_err(|_| AppError::Io("文件写入锁失效".into()))?;

        // 写盘前复核：文件被外部改过就让用户决定，而不是直接覆盖别人的改动
        if let Some(baseline) = baseline.as_ref() {
            if crate::commands::fs::fingerprint(&resolved).ok().as_ref() != Some(baseline) {
                return Err(AppError::Conflict(slash));
            }
        }

        crate::core::atomic::write_bytes(&resolved, &bytes)?;

        /*
         * 写回成功：取一次新指纹，既更新后端记录，也回传给前端。
         *
         * 两边都必须更新，否则下一次写回会把自己刚写的结果
         * 当成「外部修改」而拒绝保存。
         */
        let after = crate::commands::fs::fingerprint(&resolved)?;
        app.state::<AppState>().remember(
            slash,
            crate::state::OpenFile {
                encoding: "binary".to_string(),
                line_ending: "lf".to_string(),
                has_bom: false,
                baseline: after.clone(),
            },
        );
        Ok(after)
    })
    .await
    .map_err(AppError::from_join)?
}

#[cfg(test)]
mod tests {
    use super::*;

    /// data URL 头部的子类型必须能被正确取出。
    #[test]
    fn data_url_subtype_extracts_the_declared_format() {
        assert_eq!(data_url_subtype("data:image/png;base64"), Some("png"));
        assert_eq!(data_url_subtype("data:image/x-icon;base64"), Some("x-icon"));
        // 形态不符时不该硬猜
        assert_eq!(data_url_subtype("data:image/png"), None);
        assert_eq!(data_url_subtype("image/png;base64"), None);
        assert_eq!(data_url_subtype("data:text/plain;base64"), None);
    }

    /// 子类型与扩展名不符时必须拒绝——这是 `.ico` 装进 PNG 字节流的那道防线。
    ///
    /// 依据：`canvas.toDataURL()` 对无法编码的格式会静默退回 PNG，
    /// 实测 `image/gif` / `image/bmp` / `image/x-icon` / `image/avif`
    /// 都返回 `data:image/png;base64,...`。
    #[test]
    fn audit_subtype_must_match_extension() {
        // 相符：放行
        assert!(subtype_matches_extension("png", "a/logo.png"));
        assert!(subtype_matches_extension("jpeg", "a/photo.jpg"));
        assert!(subtype_matches_extension("webp", "a/pic.webp"));

        // 引擎退回 PNG：`.ico` / `.gif` / `.bmp` / `.avif` 必须被拦住
        for path in ["a/logo.ico", "a/anim.gif", "a/old.bmp", "a/new.avif"] {
            assert!(
                !subtype_matches_extension("png", path),
                "{path} 接受了 PNG 数据，文件内容会与扩展名不符"
            );
        }

        // 非同格式的别名也要拦住
        assert!(!subtype_matches_extension("png", "a/photo.jpg"));
        assert!(!subtype_matches_extension("jpeg", "a/logo.png"));

        // 非图片扩展名一律拒绝
        assert!(!subtype_matches_extension("png", "a/notes.txt"));
        assert!(!subtype_matches_extension("png", "a/noext"));
    }

    /// `jpg` 与 `jpeg`、`ico` 与 `x-icon` 是同一格式的别名，应放行。
    #[test]
    fn subtype_accepts_case_aliases() {
        assert!(subtype_matches_extension("jpeg", "a/photo.jpeg"));
        assert!(subtype_matches_extension("jpg", "a/photo.jpeg"));
        assert!(subtype_matches_extension("x-icon", "a/favicon.ico"));
        assert!(subtype_matches_extension("svg+xml", "a/icon.svg"));
    }

    /// base64 预检的上界必须够宽（不能误伤合法数据）、又确实拦得住超大输入。
    #[test]
    fn audit_base64_precheck_bounds_are_correct() {
        const MAX_BASE64: usize = MAX_IMAGE_BYTES as usize / 3 * 4 + 4;

        // 恰好等于上限的原始字节：编码后长度为 4/3，必须仍被接受
        let at_limit = MAX_IMAGE_BYTES as usize;
        let encoded_len = at_limit.div_ceil(3) * 4;
        assert!(
            encoded_len <= MAX_BASE64,
            "合法输入被误判：编码后 {encoded_len} 超过预检上限 {MAX_BASE64}"
        );

        // 明显超限的输入：必须被预检拦下
        let over = (MAX_IMAGE_BYTES as usize + 4 * 1024 * 1024).div_ceil(3) * 4;
        assert!(over > MAX_BASE64, "超限输入会绕过预检，先分配再拒绝");
    }

    /// `same_image_format` 按格式而非扩展名字符串比较。
    #[test]
    fn same_image_format_handles_aliases() {
        assert!(lang_map::same_image_format("a/pic.jpg", "b/other.jpeg"));
        assert!(lang_map::same_image_format("a/pic.png", "b/other.png"));

        // 真正换了格式：另存为不做转码，必须拒绝
        assert!(!lang_map::same_image_format("a/pic.png", "b/other.jpg"));

        // 非图片不参与
        assert!(!lang_map::same_image_format("a/notes.txt", "b/notes.txt"));
    }
}
