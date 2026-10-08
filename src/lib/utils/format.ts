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

/** 取路径中的目录部分。 */
export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  // 没有分隔符时没有目录可言，返回空串而不是整个路径
  if (idx < 0) return '';
  return normalized.slice(0, idx);
}

/**
 * 取路径末尾的若干段，用于列表里显示「文件在哪」。
 *
 * 只取**末尾**几段是刻意的：`D:/a/b/c/d/e/file.txt` 里能帮用户定位的是
 * `d/e`，而开头的盘符和顶层目录每台机器都一样、没有信息量。
 * 被截断时前面加 `…`，让用户知道还有更多层级（完整路径在悬停提示里给）。
 *
 * @param path     原始路径（正反斜杠都接受）
 * @param segments 保留末尾几段，默认 2
 */
export function tailSegments(path: string, segments = 2): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!normalized) return '';

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= segments) return parts.join('/');

  return `…/${parts.slice(-segments).join('/')}`;
}
