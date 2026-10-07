//! Sesame 应用装配层。
//!
//! 所有应用逻辑都在这里：插件注册、状态注入、命令汇集。
//! `main.rs` 只做一次转发，这是 Tauri 移动端构建的要求。

mod commands;
mod constants;
mod core;
mod model;
mod state;

use state::AppState;
use tauri::Manager;

/// 判断一次导航是否应当放行。
///
/// **默认必须拒绝。** Tauri 的默认行为是「一律放行」（`|_, _| true`），
/// 这对一个只渲染本地界面的编辑器来说太宽松了：
/// Markdown 预览里的 `<a href="https://…">` 一旦被点击，WebView 就会
/// 直接导航到那个网站——用户界面被替换成网页，且再也回不来
/// （没有地址栏，也无法后退到应用界面），只能重启应用。
///
/// 放行的只有应用自身的来源：
/// - 生产环境：`tauri://localhost`（Windows 上表现为 `http://tauri.localhost`）
/// - 开发环境：Vite 的 `http://localhost:1420`
///
/// 其余一律拒绝。外链改由前端用 `opener` 插件交给系统浏览器打开，
/// 这样既不破坏应用界面，也符合用户对「点链接」的预期。
fn is_allowed_navigation(url: &tauri::Url) -> bool {
    match url.scheme() {
        // 生产环境的资源协议
        "tauri" => true,
        // Windows / Android 上 WebView2 把 tauri:// 呈现为 http(s)://tauri.localhost
        "http" | "https" => match url.host_str() {
            Some("tauri.localhost") => true,
            // Vite 开发服务器。只在 debug 构建里放行，
            // 免得发行版也被引到本机其它 HTTP 服务上。
            Some("localhost") | Some("127.0.0.1") => cfg!(debug_assertions),
            _ => false,
        },
        // about:blank 等内部页面
        "about" | "data" | "blob" => true,
        _ => false,
    }
}

/// 导航守卫插件。
///
/// 窗口是在 `tauri.conf.json` 里声明的，因此拿不到 `WebviewWindowBuilder`
/// 去调它的 `.on_navigation()`。应用级 `tauri::Builder` 也没有这个钩子，
/// 但**插件**有：Tauri 在每次导航前会依次询问所有插件的 `on_navigation`，
/// 任一返回 `false` 就拒绝。这里用一个最小插件挂上去。
///
/// 不加这一层的话，Markdown 预览里的外链会把应用界面整个导航走，
/// 而应用没有地址栏也没有后退按钮，用户只能重启。详见 `is_allowed_navigation`。
fn navigation_guard<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("navigation-guard")
        .on_navigation(|_webview, url| is_allowed_navigation(url))
        .build()
}

/// 从命令行参数里挑出文件路径。
///
/// 第一个参数是可执行文件本身，跳过；其余参数中，
/// 过滤掉以 `-` 开头的开关，只保留看起来是文件路径的项。
fn startup_files_from_args() -> Vec<String> {
    files_from_args(
        std::env::args(),
        &std::env::current_dir().unwrap_or_default(),
    )
}

fn files_from_args(args: impl IntoIterator<Item = String>, cwd: &std::path::Path) -> Vec<String> {
    args.into_iter()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .map(|arg| {
            let path = std::path::Path::new(&arg);
            crate::core::paths::to_slash(&if path.is_absolute() {
                path.to_path_buf()
            } else {
                cwd.join(path)
            })
        })
        .collect()
}

/// 关掉 WebView2 的浏览器快捷键。
///
/// ## 为什么必须关
///
/// Tauri 用的是 WebView2（Chromium），它默认带一整套**浏览器**快捷键：
/// `Ctrl+F` 弹查找栏、`Ctrl+P` 打印、`F3` 下一个匹配、`Ctrl+加号` 缩放……
/// 这些是「网页」的功能，不是「桌面应用」的功能。
/// 用户按 `Ctrl+F` 期待的是编辑器自己的查找面板，结果弹出浏览器的查找栏，
/// 而那个查找栏既不受我们控制、样式也完全不同——只会让人懵。
///
/// `with_browser_accelerator_keys(false)` 对应 WebView2 的
/// `SetAreBrowserAcceleratorKeysEnabled(false)`，会关闭全部浏览器专有快捷键，
/// 同时保留复制、粘贴、全选等通用编辑快捷键。
///
/// ## 为什么不用 `additionalBrowserArgs`
///
/// 传 `--disable-features=...` 那种做法要求我们自己拼完整的参数串，
/// 而且会覆盖 wry 默认加的那几个 feature 开关；用 `with_webview`
/// 直接改设置对象更精确，也不会破坏默认行为。
#[cfg(desktop)]
fn disable_browser_hotkeys(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    window.with_webview(|webview| {
        #[cfg(windows)]
        {
            use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
            use windows::core::Interface;

            /*
             * 取 Settings3 接口——AreBrowserAcceleratorKeysEnabled 定义在它上面，
             * 基础的 ICoreWebView2Settings 没有这个属性。
             *
             * 这几个调用都是 COM 方法（`unsafe`）。整段包在一个 unsafe 块里，
             * 比在每个调用点单独标注更易读；这里只是读设置对象并改一个布尔开关，
             * 不涉及裸指针或生命周期假设。
             */
            let result = unsafe {
                webview
                    .controller()
                    .CoreWebView2()
                    .and_then(|core| core.Settings())
                    .and_then(|settings| settings.cast::<ICoreWebView2Settings3>())
                    .and_then(|s3| s3.SetAreBrowserAcceleratorKeysEnabled(false))
            };

            if let Err(err) = result {
                // 关不掉不该让应用起不来，但要在日志里留痕便于排查
                eprintln!("关闭浏览器快捷键失败：{err}");
            }
        }

        // 其它平台（macOS / Linux）的 WebView 没有等价的浏览器快捷键问题，
        // 保持空实现即可，避免为不存在的 API 写条件编译分支。
        #[cfg(not(windows))]
        let _ = webview;
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        /*
         * 单实例必须**第一个**注册。
         *
         * 它的作用是在检测到自己不是第一个实例时，把命令行参数转交给
         * 已有实例、然后立刻退出本进程。若排在其它插件之后注册，
         * 那些插件会先初始化一遍（包括建窗口），再被丢弃——
         * 既浪费又可能留下半初始化状态。
         */
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            /*
             * 第二个实例带着要打开的文件路径来了。
             *
             * 这里不做「直接打开文件」——那是前端标签页系统的职责。
             * 只把路径发给前端，由它走与「拖拽文件」完全相同的流程，
             * 保证两条入口的行为一致（去重、编码探测、最近文件都一致）。
             */
            let files = files_from_args(argv, std::path::Path::new(&cwd));

            // 把已有窗口带到前台，否则用户会以为程序没反应
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }

            if !files.is_empty() {
                use tauri::Emitter;
                // Keep the payload until the frontend pulls it, including during startup.
                app.state::<AppState>().set_startup_files(files);
                let _ = app.emit("open-files", ());
            }
        }))
        // 记住窗口位置与大小，下次启动恢复
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        // 导航守卫：默认拒绝一切外部导航，详见 is_allowed_navigation
        .plugin(navigation_guard())
        .manage(AppState::new())
        .setup(|app| {
            // 记录启动文件，供前端挂载后拉取
            let files = startup_files_from_args();
            if !files.is_empty() {
                let state = app.state::<AppState>();
                state.set_startup_files(files);
            }

            // 关掉 WebView2 自带的浏览器快捷键（Ctrl+F 查找栏、Ctrl+P 打印等），
            // 并装上导航守卫（默认拒绝外部导航）。
            #[cfg(desktop)]
            if let Some(window) = app.get_webview_window("main") {
                let _ = disable_browser_hotkeys(&window);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs::open_file,
            commands::fs::save_file,
            commands::fs::stat_file,
            commands::fs::read_chunk,
            commands::fs::close_file,
            commands::fs::take_startup_files,
            commands::fs::list_encodings,
            commands::media::read_image,
            commands::media::open_image_externally,
            commands::fonts::list_fonts,
            commands::recent::recent_list,
            commands::recent::recent_add,
            commands::recent::recent_clear,
            commands::recent::recent_remove,
            commands::session::session_load,
            commands::session::session_save,
            commands::session::session_clear,
            commands::draft::draft_save,
            commands::draft::draft_delete,
            commands::draft::draft_list,
            commands::draft::draft_clear,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Sesame 失败");
}

#[cfg(test)]
mod tests {
    #[test]
    fn second_instance_resolves_relative_arguments_against_its_own_directory() {
        let cwd = std::path::Path::new("D:/fixture");
        let files = super::files_from_args(
            vec![
                "sesame.exe".into(),
                "nested/test.txt".into(),
                "--flag".into(),
            ],
            cwd,
        );
        assert_eq!(files, vec!["D:/fixture/nested/test.txt"]);
    }
}
