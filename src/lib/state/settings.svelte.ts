/**
 * 设置状态。
 *
 * Svelte 5 的 runes 规则：`.svelte.ts` 模块不能直接导出会被重新赋值的 `$state` 绑定，
 * 因此这里导出的是一个 `$state` 对象，通过改属性来触发响应。
 */

import { load, type Store } from '@tauri-apps/plugin-store';
import { SETTINGS_KEY, SETTINGS_STORE_FILE } from '$src/constants';
import type { Settings } from '$lib/state/types';
import { CJK_FALLBACK_STACK, quoteFont } from '$lib/utils/fonts';
import { applySystemLocale, setLocale, resolveLocale } from '$lib/i18n';
import { logError } from '$lib/utils/log';

/** 默认设置。 */
const DEFAULTS: Settings = {
  theme: 'system',
  /** 强调色。默认靛蓝（见 app.css 的 data-accent 色阶）。 */
  accent: 'indigo',
  /** 界面语言。默认跟随系统——绝大多数用户该用这个。 */
  language: 'system',
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  showLineNumbers: true,
  /** 缩进参考线。默认开启——它对阅读代码帮助大，且几乎不占视觉重量。 */
  showIndentGuides: true,
  autoSave: false,
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

/** 首次加载时把持久化值与默认值合并。 */
function merge(stored: Partial<Settings> | undefined): Settings {
  if (!stored) return { ...DEFAULTS };
  // 逐键合并，避免旧版本缺少新字段时出现 undefined
  return { ...DEFAULTS, ...stored };
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
  // 启动时把已保存的字体、强调色与语言应用到界面
  applyFontVariables();
  applyAccent();
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
  if (!store) return;
  try {
    // 传入普通对象而非响应式代理，避免序列化代理失败
    await store.set(SETTINGS_KEY, { ...settings });
    await store.save();
  } catch (err) {
    logError('settings', '保存设置失败', err);
  }
}

/** 更新单个设置项并落盘。 */
export async function updateSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Promise<void> {
  settings[key] = value;
  applyFontVariables();
  applyAccent();
  applyLanguage();
  await persistSettings();
}

/**
 * 把强调色写到 `<html data-accent>`。
 *
 * 色阶本身定义在 app.css 里（`[data-accent='...']` 覆盖 `--brand-*`），
 * 这里只负责切换属性。之所以不用内联 style 写色值：
 * 那样色阶就得在 JS 里再维护一份，两处容易不同步。
 *
 * 默认值（indigo）不写属性——`:root` 本身就是它。
 */
export function applyAccent(): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (settings.accent === 'indigo') {
    root.removeAttribute('data-accent');
  } else {
    root.setAttribute('data-accent', settings.accent);
  }
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
  applyAccent();
  applyLanguage();
  await persistSettings();
}
