/**
 * 统一日志出口。
 *
 * ## 为什么需要它
 *
 * 项目里原本散落着二十来处 `console.error('某个中文说明', err)`。
 * 这样做有三个问题：
 *
 * 1. **没有统一开关**：发行版里这些日志照样往 DevTools 打，用户看不到，
 *    排查问题时也不一定想得起来去看。
 * 2. **接入错误上报时要逐个改**：将来若接 Sentry 之类的服务，
 *    得把每一处调用都换掉，很容易漏。
 * 3. **没有上下文**：只有一句中文加一个 error 对象，
 *    事后回溯时不知道是哪个文件、哪个操作触发的。
 *
 * 这里收敛成一个 `logError(scope, message, err)`：scope 标明来源模块，
 * 消息保持中文（**开发者看的，不随界面语言变化**），
 * 将来接上报只需改本文件一处。
 *
 * ## 为什么不翻译这些消息
 *
 * 它们不是界面文案，是给开发者读的诊断信息。翻译它们既增加翻译量，
 * 又会让错误报告在社区里难以检索（同一个问题在不同语言下描述不同）。
 *
 * ## 本文件内部只能用 `console.*`
 *
 * 它是日志的终点。调用 `logError` 会造成无限递归。
 */

/** 是否输出日志。发行版里静默，开发时全开。 */
const ENABLED = import.meta.env.DEV;

/**
 * 记录一条错误。
 *
 * @param scope 来源模块，例如 `draft` / `session`。便于过滤。
 * @param message 中文说明，写清「什么操作失败了」
 * @param err 原始错误对象
 */
export function logError(scope: string, message: string, err: unknown): void {
  if (!ENABLED) return;
  console.error(`[${scope}] ${message}`, err);
}

/**
 * 记录一条警告。
 *
 * 用于「不构成失败但值得注意」的情况，例如降级处理。
 */
export function logWarn(scope: string, message: string, detail?: unknown): void {
  if (!ENABLED) return;
  if (detail === undefined) {
    console.warn(`[${scope}] ${message}`);
  } else {
    console.warn(`[${scope}] ${message}`, detail);
  }
}
