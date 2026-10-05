/**
 * 平台判定。
 *
 * ## 支持范围
 *
 * 本应用**只支持 Windows 与 macOS**。Linux 不再作为目标平台——
 * 无边框窗口的红绿灯、文件关联、打包格式在每个 Linux 桌面环境上
 * 表现都不同，维护成本远超收益。相关代码里的 Linux 分支已一并移除。
 *
 * ## 为什么不用 tauri-plugin-os
 *
 * 只为拿一个平台名就多引一个插件（含 Rust 依赖与权限声明）不划算。
 * `navigator.userAgent` 在 WebView2 与 WKWebView 里都可靠，
 * 且这段判断只在启动时跑一次。
 */

/** 运行平台。 */
export type Platform = 'windows' | 'macos';

/**
 * 当前平台。
 *
 * 判定顺序：先认 macOS（`Macintosh` / `Mac OS X`），
 * 其余一律当 Windows——这是本应用仅有的两种目标平台，
 * 与其返回 `'unknown'` 让每个调用点都要处理第三种情况，
 * 不如收敛成两值，行为始终明确。
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'windows';

  const ua = navigator.userAgent;
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';

  return 'windows';
}

/** 当前平台，模块加载时判定一次。 */
export const PLATFORM: Platform = detectPlatform();

/** 是否为 macOS。 */
export const IS_MAC = PLATFORM === 'macos';

/** 是否为 Windows。 */
export const IS_WINDOWS = PLATFORM === 'windows';
