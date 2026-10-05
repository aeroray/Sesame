/**
 * 当前语言的**响应式**状态。
 *
 * 单独成文件的原因：Svelte 的 runes（`$state` 等）只在 `.svelte` 与
 * `.svelte.ts` 文件里可用。`i18n/index.ts` 是普通 `.ts`（它导出的是
 * 纯函数与类型，不希望被当成组件模块处理），因此状态必须放在这里。
 *
 * 这个文件曾经叫 `index.ts`，启动时直接抛 `rune_outside_svelte`，
 * 整个应用白屏——这类错误只有真跑起来才会暴露，`svelte-check` 查不出来。
 */

import { detectSystemLocale, normalizeLocale, type Locale } from './locale';

/**
 * 当前语言。
 *
 * 初始值取系统语言，随后由设置加载流程覆盖（用户显式选过的语言优先）。
 * 用 `$state` 让所有 `t()` 调用点自动响应切换。
 */
export const locale = $state<{ current: Locale }>({
  current: detectSystemLocale(),
});

/** 切换语言。 */
export function setLocale(next: Locale): void {
  locale.current = next;
}

/** 把系统语言应用为当前语言（仅在用户没显式选过时调用）。 */
export function applySystemLocale(): void {
  locale.current = detectSystemLocale();
}

/**
 * 从任意值解析出语言，认不出时返回 `null`。
 *
 * 用于读取持久化的设置：老版本没有 `language` 字段，
 * 或者值被手工改坏时，都不该让应用起不来。
 */
export function resolveLocale(value: unknown): Locale | null {
  if (typeof value !== 'string' || value === '') return null;
  // 只接受受支持的取值；`system` 由调用方另行处理
  if (value === 'zh-CN' || value === 'en') return value;
  return normalizeLocale(value);
}
