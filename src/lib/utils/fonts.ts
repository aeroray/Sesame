/**
 * 字体相关的共享工具。
 *
 * 放在这里而不是各自模块内，是为了让界面字体与编辑器字体
 * 使用**同一份**中文字体回退链——两处若各写一份，很容易改了一处忘了另一处。
 */

/**
 * 中文字体回退链。
 *
 * 为什么必须有它：系统里绝大多数字体只覆盖一种文字系统。
 * 等宽字体（Consolas、JetBrains Mono 等）几乎都不含中文字形，
 * 用户选了一个英文字体后，中文会被浏览器兜底到系统默认中文字体，
 * 于是同一行里英文与中文是两种字体，字宽和风格都对不上——
 * 这正是「编辑器中英文不是一个字体」的根因。
 *
 * 把中文字体显式排进字体栈，浏览器会按字符逐个查找，
 * 两种文字的风格就由我们控制，而不是交给系统兜底。
 */
export const CJK_FALLBACK = [
  'PingFang SC',
  'Hiragino Sans GB',
  'Microsoft YaHei',
  'Source Han Sans SC',
  'Noto Sans CJK SC',
  'WenQuanYi Micro Hei',
] as const;

/** 已加引号、可直接拼进 CSS 的中文回退链。 */
export const CJK_FALLBACK_STACK = CJK_FALLBACK.map(quoteFont).join(', ');

/**
 * 给字体名加引号。
 *
 * 字体名常含空格（`Microsoft YaHei`）或非 ASCII 字符，
 * 不加引号 CSS 会把它拆成多个无效族名。
 */
export function quoteFont(name: string): string {
  return `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * 组装完整的字体栈。
 *
 * @param preferred 用户选择的字体；空字符串表示用 fallback 打头。
 * @param fallback 首选字体不可用时用的栈（通常是内置默认）。
 */
export function buildFontStack(preferred: string, fallback: string): string {
  if (!preferred) return fallback;
  return `${quoteFont(preferred)}, ${fallback}`;
}
