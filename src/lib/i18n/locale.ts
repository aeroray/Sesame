/**
 * 国际化：语言标识与系统语言探测。
 *
 * 本项目只支持简体中文与英文两种语言，因此**不引入 i18n 框架**——
 * 一个类型化的字典加一个 `t()` 函数就够，还能省下几十 KB 的首屏体积。
 * 这与其他部分的取舍一致：不为用不到的能力付体积代价。
 */

/** 支持的语言。 */
export type Locale = 'zh-CN' | 'en';

/** 全部支持的语言，顺序即设置面板里的展示顺序。 */
export const LOCALES: readonly Locale[] = ['zh-CN', 'en'] as const;

/** 默认语言。系统语言认不出来时用它。 */
export const FALLBACK_LOCALE: Locale = 'en';

/**
 * 语言的中文名与英文名。
 *
 * 语言名**永远用该语言自身书写**（中文写「简体中文」、英文写 "English"），
 * 而不是跟随当前界面语言翻译。否则一个误设成中文的英文用户
 * 会在设置里看到「英语」——他认不出来那是自己的语言，也就换不回去。
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '简体中文',
  en: 'English',
};

/**
 * 把任意系统语言标记归一到受支持的语言。
 *
 * 规则：
 * - `zh` 开头的都归到简体中文（`zh-TW` / `zh-HK` 也归过来——
 *   本应用不做繁体，给简体总比给英文更接近用户能读的内容）。
 * - 其余一律英文。
 */
export function normalizeLocale(tag: string | null | undefined): Locale {
  if (!tag) return FALLBACK_LOCALE;

  const lower = tag.toLowerCase();
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('en')) return 'en';

  return FALLBACK_LOCALE;
}

/**
 * 猜测系统语言。
 *
 * 优先用 `navigator.languages`（用户偏好列表，按优先级排序），
 * 退到 `navigator.language`，再退到默认值。
 *
 * 在 Tauri 里 WebView 的 `navigator.language` 反映的是**系统 UI 语言**，
 * 正是我们要的默认值。
 */
export function detectSystemLocale(): Locale {
  if (typeof navigator === 'undefined') return FALLBACK_LOCALE;

  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const tag of candidates) {
    if (!tag) continue;
    const lower = tag.toLowerCase();
    // 只接受明确支持的语言；其余继续往后找
    if (lower.startsWith('zh')) return 'zh-CN';
    if (lower.startsWith('en')) return 'en';
  }

  return FALLBACK_LOCALE;
}
