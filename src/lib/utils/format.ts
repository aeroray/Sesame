/**
 * 展示格式化工具。
 */

import { locale, t } from '$lib/i18n';

/** 把字节数格式化为易读字符串。 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * 把时间戳格式化为相对时间。
 *
 * 文案取自 i18n 字典，因此跟随界面语言。
 * 超过 30 天改用绝对日期，日期格式也按当前语言选择
 * （中文 `2026/1/5`，英文 `1/5/2026`）——只翻译文字而日期格式不变
 * 会显得半吊子。
 */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp;
  if (diff < 0) return t('time.justNow');

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return t('time.justNow');
  if (diff < hour) return t('time.minutesAgo', { count: Math.floor(diff / minute) });
  if (diff < day) return t('time.hoursAgo', { count: Math.floor(diff / hour) });
  if (diff < 30 * day) return t('time.daysAgo', { count: Math.floor(diff / day) });

  return new Date(timestamp).toLocaleDateString(locale.current);
}

/**
 * 取路径中的文件名。
 * 同时兼容 Windows 与 POSIX 分隔符。
 */
export function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? normalized : normalized.slice(idx + 1);
}

/** 取路径中的目录部分。 */
export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  // 没有分隔符时没有目录可言，返回空串而不是整个路径
  if (idx < 0) return '';
  return normalized.slice(0, idx);
}
