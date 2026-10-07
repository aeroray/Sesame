/**
 * 主题状态：把选中的主题应用到 `<html>`。
 *
 * ## 为什么全部写成 CSS 变量，而不是内联样式
 *
 * 界面令牌有 30 多个。如果逐个写成元素的 `style`，切换主题时要遍历 DOM
 * 改几十处，既慢又容易漏。写成 `<html>` 上的自定义属性后，**所有用
 * `var(--...)` 的元素自动跟着变**，切换主题只是一次 `setProperty` 循环。
 *
 * 这也让主题的「预览」变得免费：设置面板里的色块直接引用同一批变量。
 *
 * ## 亮暗类名
 *
 * 同时维护 `<html class="dark">`：Tailwind 的 `dark:` 变体、以及
 * `mode-watcher` 都依赖它。主题自带亮暗归属，因此这个类由主题决定，
 * 不再由用户单独选择。
 */

import { setMode } from 'mode-watcher';
import { DEFAULT_THEME, THEMES, type ThemeDefinition, themeById } from '$lib/theme/palettes';
import { deriveTokens } from '$lib/theme/theme-tokens';

/** 当前生效的主题。 */
let currentTheme = $state.raw<ThemeDefinition>(themeById(DEFAULT_THEME));

/** 取当前主题。 */
export function getTheme(): ThemeDefinition {
  return currentTheme;
}

/** 取当前主题 id。 */
export function getThemeId(): string {
  return currentTheme.id;
}

/** 当前主题是否为暗色。 */
export function isDarkTheme(): boolean {
  return currentTheme.mode === 'dark';
}

/** 全部可选主题。 */
export function allThemes(): readonly ThemeDefinition[] {
  return THEMES;
}

/**
 * 应用一个主题。
 *
 * 顺序有讲究：
 * 1. 先写 CSS 变量——后续的类名切换会触发一次重绘，变量就位后只重绘一次
 * 2. 再切 `dark` 类
 * 3. 最后同步给 `mode-watcher`（它自己也会改 `dark` 类，放最后避免来回切）
 */
export function applyTheme(id: string): void {
  const theme = themeById(id);
  currentTheme = theme;

  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  for (const [name, value] of Object.entries(deriveTokens(theme))) {
    root.style.setProperty(name, value);
  }

  // 亮暗类名。`dark` 是 Tailwind 与 mode-watcher 共同约定的类名。
  root.classList.toggle('dark', theme.mode === 'dark');
  root.dataset.theme = theme.id;

  /*
   * 同步给 mode-watcher。
   *
   * 它管理的是「系统亮暗偏好」的监听与 `dark` 类，我们需要它保持同步，
   * 否则系统主题变化时它会把 `dark` 类改回去，覆盖我们的主题选择。
   */
  setMode(theme.mode);
}
