//! 把图片设为 Windows 桌面壁纸。
//!
//! ## 为什么要先转 BMP
//!
//! `SystemParametersInfoW(SPI_SETDESKWALLPAPER)` **只认 BMP**。
//! 传 PNG / JPEG 路径它不返回错误，但壁纸也不会变——静默失败。
//! 这一点很容易踩，所以必须转换。
//!
//! ## 为什么借道 .NET 而不是引图像库
//!
//! 转换需要解码 PNG / JPEG / GIF / WebP。引 `image` crate 及其 feature
//! 会明显增大体积，而本项目刻意保持轻量；而 Windows 上
//! `System.Drawing`（.NET）**一定存在**，且什么格式都能读。
//!
//! 代价是起一个 PowerShell 子进程。改壁纸是低频操作，
//! 几百毫秒的启动开销可以接受。
//!
//! ## 临时文件放哪
//!
//! 放系统临时目录，且**不删除**：Windows 会把壁纸路径记进注册表，
//! 若把 BMP 删掉，重启后壁纸会变成纯色（系统找不到文件）。
//! 因此这里刻意保留，并在文件名里带上进程号以免互相覆盖。

#![cfg(windows)]

use std::path::{Path, PathBuf};

use crate::model::{AppError, AppResult};

/// 把 `source` 转成 BMP 后设为壁纸。
pub fn set_wallpaper(source: &Path) -> AppResult<()> {
    let bmp = convert_to_bmp(source)?;
    apply_wallpaper(&bmp)
}

/// 用 .NET 的 `System.Drawing` 转成 BMP，返回临时文件路径。
fn convert_to_bmp(source: &Path) -> AppResult<PathBuf> {
    let stem = source
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "wallpaper".to_string());

    /*
     * 文件名带进程号：多开时各自写各自的临时文件，
     * 不会互相覆盖。同一进程内连续设两次会复用同一个文件，没有问题
     * （第二次直接覆盖）。
     */
    let target = std::env::temp_dir().join(format!(
        "sesame-wallpaper-{}-{stem}.bmp",
        std::process::id()
    ));

    /*
     * PowerShell 脚本。
     *
     * 用 `-LiteralPath` 而不是 `-Path`：路径里的 `[` `]` 在 PowerShell 中
     * 是通配符，普通 `-Path` 会把它们当模式解析而找不到文件。
     * 单引号包裹并转义内部的单引号，避免路径里的特殊字符被解释。
     */
    let script = format!(
        "Add-Type -AssemblyName System.Drawing; \
         $img = [System.Drawing.Image]::FromFile('{}'); \
         try {{ $img.Save('{}', [System.Drawing.Imaging.ImageFormat]::Bmp) }} \
         finally {{ $img.Dispose() }}",
        escape_ps(source),
        escape_ps(&target),
    );

    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .output()
        .map_err(|err| AppError::Io(format!("无法启动 PowerShell：{err}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Io(format!(
            "转换图片为 BMP 失败：{}",
            stderr.trim()
        )));
    }

    if !target.is_file() {
        return Err(AppError::Io("转换后没有生成 BMP 文件".to_string()));
    }

    Ok(target)
}

/// 把 PowerShell 单引号字符串里的单引号转义（两个单引号）。
fn escape_ps(path: &Path) -> String {
    path.to_string_lossy().replace('\'', "''")
}

/// 调用 `SystemParametersInfoW` 应用壁纸。
fn apply_wallpaper(bmp: &Path) -> AppResult<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::UI::WindowsAndMessaging::{
        SystemParametersInfoW, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SPI_SETDESKWALLPAPER,
    };

    let wide: Vec<u16> = bmp.as_os_str().encode_wide().chain(Some(0)).collect();

    /*
     * `pvparam` 传的是**可写**缓冲区指针。
     * API 签名要求 `*mut c_void`，而它实际只读取该字符串；
     * 用 `as_ptr() as *mut` 是这类 Win32 调用里常见且安全的做法
     * （不违反别名规则，因为 API 不会写入这块内存）。
     */
    let result = unsafe {
        SystemParametersInfoW(
            SPI_SETDESKWALLPAPER,
            0,
            Some(wide.as_ptr() as *mut std::ffi::c_void),
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
        )
    };

    result.map_err(|err| AppError::Io(format!("设置壁纸失败：{err}")))
}
