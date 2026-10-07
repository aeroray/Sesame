/**
 * 设置状态。
 *
 * Svelte 5 的 runes 规则：`.svelte.ts` 模块不能直接导出会被重新赋值的 `$state` 绑定，
 * 因此这里导出的是一个 `$state` 对象，通过改属性来触发响应。
 */

import { load, type Store } from '@tauri-apps/plugin-store';
import { applySystemLocale, resolveLocale, setLocale } from '$lib/i18n';
import { applyTheme } from '$lib/state/theme.svelte';
import type { Settings } from '$lib/state/types';
import { DEFAULT_THEME, THEMES } from '$lib/theme/palettes';
import { KeyedTaskQueue } from '$lib/utils/async';
import { CJK_FALLBACK_STACK, quoteFont } from '$lib/utils/fonts';
import { logError } from '$lib/utils/log';
import { validateSettings } from '$lib/utils/settings';
import { FONT_SIZE_MAX, FONT_SIZE_MIN, SETTINGS_KEY, SETTINGS_STORE_FILE } from '$src/constants';

/** 默认设置。 */
const DEFAULTS: Settings = {
  /** 主题（皮肤）。默认 Sesame Light，见 lib/theme/palettes.ts。 */
  theme: DEFAULT_THEME,
  /** 界面语言。默认跟随系统——绝大多数用户该用这个。 */
  language: 'system',
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  showLineNumbers: true,
  /** 缩进参考线。默认开启——它对阅读代码帮助大，且几乎不占视觉重量。 */
  showIndentGuides: true,
  /**
   * 括号彩虹。**默认开启**（按用户要求）。
   *
   * 早先默认关闭，理由是「它是主动吸引注意力的装饰，与安静的定位有张力」。
   * 用户明确要求默认开启，因此改掉；设置项仍在，不喜欢的人可以关掉。
   */
  rainbowBrackets: true,
  /**
   * 自动保存。**默认开启**（按用户要求）。
   *
   * 默认关掉的理由是「不该在用户没要求时写磁盘」。但忘记保存而丢改动
   * 是更糟的结果，用户也明确要求默认开启。
   * 它是防抖写入且只对有路径的标签生效，因此风险有限。
   */
  autoSave: true,
  hibernateEnabled: true,
  restoreSession: true,
  // 空字符串 = 跟随系统默认：界面用 --font-sans，编辑器用 --font-mono
  uiFont: '',
  editorFont: '',
};

/** 响应式设置对象。 */
export const settings = $state<Settings>({ ...DEFAULTS });

let store: Store | null = null;
let loaded = false;
const writes = new KeyedTaskQueue();

/** 首次加载时把持久化值与默认值合并。 */
function merge(stored: Partial<Settings> | undefined): Settings {
  return validateSettings(
    stored,
    DEFAULTS,
    THEMES.map((theme) => theme.id),
    FONT_SIZE_MIN,
    FONT_SIZE_MAX,
  );
}

/**
 * 从磁盘加载设置。
 *
 * 失败时不抛错：设置属于便利功能，读不到就用默认值继续，
 * 否则用户会因为一个损坏的配置文件完全打不开应用。
 */
export async function loadSettings(): Promise<void> {
  if (loaded) return;
  try {
    store = await load(SETTINGS_STORE_FILE, { autoSave: false });
    const stored = await store.get<Partial<Settings>>(SETTINGS_KEY);
    Object.assign(settings, merge(stored));
  } catch (err) {
    logError('settings', '读取设置失败，已使用默认值', err);
    Object.assign(settings, DEFAULTS);
  }
  // 启动时把已保存的字体、主题与语言应用到界面
  applyFontVariables();
  applyTheme(settings.theme);
  applyLanguage();
  loaded = true;
}

/**
 * 把语言设置应用到 i18n 运行时。
 *
 * `system` 时重新探测系统语言，而不是沿用模块加载时那一次探测的结果——
 * 用户可能在设置里从 `zh-CN` 改回「跟随系统」，
 * 此时必须重新读一次 `navigator.languages` 才能回到正确语言。
 *
 * 持久化的值可能来自旧版本（没有该字段）或被手工改坏，
 * 因此先经 `resolveLocale` 校验，认不出就退回跟随系统。
 */
export function applyLanguage(): void {
  if (settings.language === 'system') {
    applySystemLocale();
    return;
  }

  const resolved = resolveLocale(settings.language);
  if (resolved) {
    setLocale(resolved);
  } else {
    applySystemLocale();
  }
}

/** 持久化当前设置。 */
export async function persistSettings(): Promise<void> {
  const currentStore = store;
  if (!currentStore) return;
  const snapshot = { ...settings };
  return writes.run('settings', async () => {
    try {
      // 传入普通对象而非响应式代理，避免序列化代理失败
      await currentStore.set(SETTINGS_KEY, snapshot);
      await currentStore.save();
    } catch (err) {
      logError('settings', '保存设置失败', err);
    }
  });
}

/** 更新单个设置项并落盘。 */
export async function updateSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Promise<void> {
  settings[key] = merge({ ...settings, [key]: value })[key];
  applyFontVariables();
  // 主题变化要重算全部界面令牌，因此这里无条件调用（内部很便宜）
  applyTheme(settings.theme);
  applyLanguage();
  await persistSettings();
}

/**
 * 把字体设置写进 CSS 变量。
 *
 * 界面字体通过覆盖 `--font-sans` 生效，这样所有用 `font-sans`
 * （即 body 默认）的元素都会跟着变，不需要逐个组件改。
 *
 * 关键点：用户选的字体后面必须继续挂上中文字体回退链。
 * 系统里的字体大多只覆盖一种文字系统——用户选一个英文字体后，
 * 中文会交给浏览器兜底，于是出现「中英文不是一个字体」的割裂感。
 * 我们自己把中文字体排进去，才能保证两种文字风格一致。
 */
function applyFontVariables(): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (settings.uiFont) {
    root.style.setProperty('--font-sans', `${quoteFont(settings.uiFont)}, ${CJK_FALLBACK_STACK}`);
  } else {
    // 空字符串 = 用 app.css 里的默认栈
    root.style.removeProperty('--font-sans');
  }
}

/** 恢复默认设置。 */
export async function resetSettings(): Promise<void> {
  Object.assign(settings, DEFAULTS);
  applyFontVariables();
  applyTheme(settings.theme);
  applyLanguage();
  await persistSettings();
}
