//! Open an image with a user-selected application rather than its default handler.

use std::path::PathBuf;

use crate::model::{AppError, AppResult};

#[cfg(windows)]
fn show_windows_chooser(window: &tauri::WebviewWindow, path: &std::path::Path) -> AppResult<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{
        core::{HRESULT, PCWSTR},
        Win32::{
            Foundation::{ERROR_CANCELLED, E_ABORT, HWND},
            UI::Shell::{SHOpenWithDialog, OAIF_EXEC, OPENASINFO},
        },
    };

    let filename: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let parent = window.hwnd().map_err(|err| AppError::Io(err.to_string()))?;
    let options = OPENASINFO {
        pcszFile: PCWSTR(filename.as_ptr()),
        pcszClass: PCWSTR::null(),
        oaifInFlags: OAIF_EXEC,
    };
    // Run on the existing COM-initialized UI thread. The UTF-16 path stays alive
    // for the modal dialog, and the real window handle keeps it correctly owned.
    let result = unsafe { SHOpenWithDialog(Some(HWND(parent.0)), &options) };
    match result {
        Ok(()) => Ok(()),
        Err(err)
            if err.code() == HRESULT::from_win32(ERROR_CANCELLED.0) || err.code() == E_ABORT =>
        {
            Ok(())
        }
        Err(err) => Err(AppError::Io(format!("选择外部程序失败：{err}"))),
    }
}

pub async fn open_image(
    window: tauri::WebviewWindow,
    path: PathBuf,
    application: Option<String>,
) -> AppResult<()> {
    #[cfg(windows)]
    {
        let _ = application;
        let (sender, receiver) = std::sync::mpsc::channel();
        let parent = window.clone();
        window
            .run_on_main_thread(move || {
                let _ = sender.send(show_windows_chooser(&parent, &path));
            })
            .map_err(|err| AppError::Io(err.to_string()))?;
        return tauri::async_runtime::spawn_blocking(move || {
            receiver
                .recv()
                .map_err(|err| AppError::Io(err.to_string()))?
        })
        .await
        .map_err(AppError::from_join)?;
    }

    #[cfg(target_os = "macos")]
    {
        let _ = window;
        let application =
            application.ok_or_else(|| AppError::InvalidPath("没有选择应用程序".into()))?;
        return tauri::async_runtime::spawn_blocking(move || {
            let application = crate::core::paths::normalize(&application, None)?;
            if !application.is_dir()
                || !application
                    .extension()
                    .and_then(|s| s.to_str())
                    .is_some_and(|s| s.eq_ignore_ascii_case("app"))
            {
                return Err(AppError::InvalidPath("请选择已安装的 .app 应用程序".into()));
            }
            let status = std::process::Command::new("/usr/bin/open")
                .arg("-a")
                .arg(&application)
                .arg("--")
                .arg(&path)
                .status()
                .map_err(|err| AppError::Io(err.to_string()))?;
            if status.success() {
                Ok(())
            } else {
                Err(AppError::Io(format!("外部程序打开失败：{status}")))
            }
        })
        .await
        .map_err(AppError::from_join)?;
    }
}
