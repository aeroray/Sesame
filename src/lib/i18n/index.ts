/**
 * 国际化运行时。
 *
 * ## 为什么不引框架
 *
 * 只有两种语言、约 160 条文案，且没有懒加载语言包、没有复数规则文件、
 * 没有日期/数字本地化的需求。为此引入 i18n 框架要付出首屏体积与一层
 * 间接 API 的代价，换不来什么。一个类型化字典 + 一个 `t()` 就够。
 *
 * ## 类型安全
 *
 * `Messages` 由英文那份推导，中文那份标注为同一类型，
 * 因此**漏译会在 `svelte-check` 阶段报错**，而不是等到用户看到空白。
 * `t()` 的 key 参数也受类型约束，写错 key 编译不过。
 *
 * ## 响应式
 *
 * 本文件是**普通 `.ts`**，不能直接声明 runes——那样会在启动时抛
 * `rune_outside_svelte` 并让整个应用白屏（`svelte-check` 查不出来）。
 * 语言状态因此放在 `locale.svelte.ts`，这里只读它。
 * `t()` 读 `locale.current`，所以在模板或 `$derived` 里调用它会自动跟随切换。
 */

import { logError } from '$lib/utils/log';
import type { Locale } from './locale';
import { locale } from './locale.svelte';
import { en, type Messages } from './messages/en';
import { zhCN } from './messages/zh-CN';

export type { Locale } from './locale';
export { detectSystemLocale, LOCALE_LABELS, LOCALES, normalizeLocale } from './locale';
/*
 * 把语言状态与解析工具**再导出**一次。
 *
 * 调用方只需要 `from '$lib/i18n'` 一个入口，不必关心内部把状态
 * 放在了 `.svelte.ts` 里——那是实现细节。
 */
export { applySystemLocale, locale, resolveLocale, setLocale } from './locale.svelte';

const DICTIONARIES: Record<Locale, Messages> = {
  en,
  'zh-CN': zhCN,
};

/** 取值路径，例如 `['settings', 'autoSave']`。 */
type Path = readonly string[];

/** 按路径取嵌套值。 */
function lookup(dict: Messages, path: Path): unknown {
  let node: unknown = dict;
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/** 所有合法的文案路径。 */
export type MessageKey = LeafPaths<Messages>;

/**
 * 递归取出所有「叶子」路径。
 *
 * 遇到 `{ one, other }` 这种复数对象时，把它当成**一个**叶子
 * （`one`/`other` 不是两条独立文案，而是同一条的两种形态）。
 */
type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends { one: string; other: string }
    ? K
    : T[K] extends object
      ? `${K}.${LeafPaths<T[K]>}`
      : K;
}[keyof T & string];

/** 插值参数。 */
export type MessageParams = Record<string, string | number>;

/** 复数形态。 */
interface PluralForms {
  one: string;
  other: string;
}

/** 判断取到的值是不是复数形态。 */
function isPluralForms(value: unknown): value is PluralForms {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PluralForms).one === 'string' &&
    typeof (value as PluralForms).other === 'string'
  );
}

/**
 * 替换 `{name}` 占位符。
 *
 * 找不到对应参数时**保留原样**（`{name}` 会出现在界面上）——
 * 这比静默替换成空串好：空串会让人以为文案本来就少一截，
 * 而显眼的 `{name}` 一眼就能看出是漏传参数。
 */
function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = params[key];
    return value === undefined ? whole : String(value);
  });
}

/**
 * 取一条文案。
 *
 * @param key 点分路径，例如 `status.saved`
 * @param params 插值参数；复数文案需额外传 `count`
 *
 * 复数选择用 `count === 1 ? one : other`。中文两种形态相同，
 * 因此中文版里这条分支实际不影响输出——这是刻意的简化：
 * 不做 CLDR 规则，两种语言都用得上（英语只需区分 1 与其余）。
 */
export function t(key: MessageKey, params?: MessageParams): string {
  const path = key.split('.');
  const value = lookup(DICTIONARIES[locale.current], path);

  if (typeof value === 'string') {
    return interpolate(value, params);
  }

  if (isPluralForms(value)) {
    const count = Number(params?.count ?? 0);
    const form = count === 1 ? value.one : value.other;
    return interpolate(form, params);
  }

  /*
   * 走到这里说明 key 合法（类型已保证）但取值形态不对，
   * 属于开发期错误。返回 key 本身而不是空串，便于一眼定位。
   */
  if (import.meta.env.DEV) {
    logError('i18n', `文案形态异常: ${key}`, undefined);
  }
  return key;
}
