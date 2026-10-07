import type { Settings } from '../state/types';

/** Treat persisted JSON as untrusted values, not as TypeScript Settings. */
export function validateSettings(
  stored: unknown,
  defaults: Settings,
  themeIds: readonly string[],
  minimumFontSize: number,
  maximumFontSize: number,
): Settings {
  const result = { ...defaults };
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return result;
  const raw = stored as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof Settings)[]) {
    if (!Object.hasOwn(raw, key)) continue;
    const value = raw[key];
    if (typeof defaults[key] === 'boolean') {
      if (typeof value === 'boolean') Object.assign(result, { [key]: value });
    }
  }
  if (typeof raw.theme === 'string' && themeIds.includes(raw.theme)) result.theme = raw.theme;
  if (raw.language === 'system' || raw.language === 'en' || raw.language === 'zh-CN')
    result.language = raw.language;
  if (
    typeof raw.fontSize === 'number' &&
    Number.isInteger(raw.fontSize) &&
    raw.fontSize >= minimumFontSize &&
    raw.fontSize <= maximumFontSize
  )
    result.fontSize = raw.fontSize;
  if (typeof raw.tabSize === 'number' && [2, 4, 8].includes(raw.tabSize))
    result.tabSize = raw.tabSize;
  for (const key of ['uiFont', 'editorFont'] as const) {
    if (
      typeof raw[key] === 'string' &&
      raw[key].length <= 256 &&
      ![...raw[key]].some((character) => character.charCodeAt(0) < 32)
    )
      result[key] = raw[key];
  }
  return result;
}
