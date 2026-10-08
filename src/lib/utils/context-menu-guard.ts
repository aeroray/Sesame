/**
 * 全局阻止 WebView 的原生右键菜单。
 *
 * ## 为什么需要它
 *
 * 桌面应用里右键弹出「刷新」「另存为」「打印」「检查」是**网页**的行为，
 * 与文本编辑器在做的事毫无关系；其中「检查」还会直接打开开发者工具，
 * 把整个应用界面变成调试窗口。用户看到会觉得很奇怪。
 *
 * Rust 侧已经用 `SetAreDefaultContextMenusEnabled(false)` 关掉了 WebView2
 * 的原生菜单，这一层是**双保险**：
 *
 * - 那是个平台相关的调用，只在 Windows 上生效；macOS 的 WKWebView 没有
 *   等价开关，得靠这里拦。
 * - 调用失败时只打日志、不让应用起不来，所以不能假定它一定成功。
 *
 * ## 为什么用一个默认拒绝的全局监听
 *
 * 逐个组件去 `oncontextmenu={e => e.preventDefault()}` 一定会漏——
 * 新增一个界面就多一处要记得写。这里在 `window` 上**一次性**拦住，
 * 默认拒绝，需要自定义菜单的地方自己再挂 DOM 监听。
 *
 * 对**全应用**生效，包括编辑器内部与那些没有自定义菜单的地方
 * （标题栏、侧栏、状态栏、欢迎页）。这些位置右键后什么都不会弹出——
 * 这是刻意的：弹一个与当前操作无关的网页菜单更让人困惑。
 *
 * ## 关键：为什么不用 capture 阶段
 *
 * `preventDefault()` 取消的是浏览器弹菜单这个**默认行为**，
 * 它**不会阻止事件继续传播**。因此冒泡阶段的监听器照常收到事件——
 * bits-ui 的 `ContextMenu` 就是靠这一点工作的：它在自己的元素上监听
 * `contextmenu`，收到后就地渲染自定义菜单。
 *
 * 若把这里写成 capture（`{ capture: true }`），我们会在**事件到达
 * 组件之前**执行；虽然不 `stopPropagation` 也仍会传下去，
 * 但一旦将来有人加了 `stopPropagation`，所有右键菜单会一起失效。
 * 用冒泡阶段则顺序天然正确：组件先处理，我们最后兜底。
 */

/**
 * 安装拦截。
 *
 * 返回卸载函数，供组件销毁时调用——本项目是单页应用，实际只在启动时装一次，
 * 但保留返回值让调用方能在 HMR 或测试中干净地移除。
 */
export function blockNativeContextMenu(): () => void {
  const onContextMenu = (event: MouseEvent) => {
    /*
     * 一律取消浏览器默认菜单。
     *
     * 这里**不**调用 `stopPropagation()`：自定义右键菜单（bits-ui）需要
     * 收到这个事件才能弹出。`preventDefault` 只取消「浏览器自己弹菜单」
     * 这个默认行为，不妨碍任何监听器。
     */
    event.preventDefault();
  };

  window.addEventListener('contextmenu', onContextMenu);
  return () => window.removeEventListener('contextmenu', onContextMenu);
}
