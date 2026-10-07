/**
 * 图片缓存。
 *
 * data URL 体积可观（base64 后约放大 33%），且重新读取要再走一次 IPC。
 * 这里按标签 id 缓存，标签关闭时释放。
 *
 * 用 `$state.raw`：data URL 是整体替换的字符串，不做深层代理。
 */

import * as ipc from '$lib/ipc/fs';
import type { ImagePayload } from '$lib/state/types';

/** 标签 id → 图片负载。 */
let images = $state.raw<Record<string, ImagePayload>>({});

export interface ImageDimensions {
  width: number;
  height: number;
}
let dimensions = $state.raw<Record<string, ImageDimensions>>({});

/** Decoded dimensions are shared with the bottom status bar. */
export function getImageDimensions(tabId: string): ImageDimensions | undefined {
  return dimensions[tabId];
}

export function setImageDimensions(tabId: string, value: ImageDimensions): void {
  if (!images[tabId] || value.width <= 0 || value.height <= 0) return;
  dimensions = { ...dimensions, [tabId]: value };
}

/**
 * 正在读取的标签 id 集合，避免重复请求。
 *
 * **必须是响应式的**：`isLoading` 被 `$derived` 读取，而普通 `Set` 的增删
 * 不会触发任何更新——派生值只在首次求值时算一次（false），
 * 之后永远是 false。结果是读取期间界面显示「无法显示此图片」，
 * 而不是「正在读取图片…」（实测如此）。
 *
 * 用 `$state.raw` 装一个不可变对象，每次改动整体替换，
 * 这样读取 `loading[id]` 就能正确建立依赖。
 */
let loading = $state.raw<Record<string, boolean>>({});

/**
 * 已取消的标签 id。
 *
 * 读取是异步的，用户可能在读完之前就关掉了标签。
 * 若不做标记，await 结束后仍会把 data URL 写进缓存，
 * 而该标签再也不会被访问——这份数据（可达数十 MB）就永久驻留了。
 */
const cancelled = new Set<string>();
const pending = new Map<string, Promise<void>>();
const touched = new Map<string, number>();
const MAX_CACHE_CHARACTERS = 128 * 1024 * 1024;
let retained: string | undefined;

function trimCache(): void {
  let total = Object.values(images).reduce((sum, image) => sum + image.dataUrl.length, 0);
  for (const id of [...Object.keys(images)].sort(
    (a, b) => (touched.get(a) ?? 0) - (touched.get(b) ?? 0),
  )) {
    if (total <= MAX_CACHE_CHARACTERS) break;
    if (id === retained) continue;
    total -= images[id]?.dataUrl.length ?? 0;
    const { [id]: _removed, ...rest } = images;
    images = rest;
    touched.delete(id);
  }
}

/** 读取某个标签页的图片。 */
export function getImage(tabId: string): ImagePayload | undefined {
  return images[tabId];
}

/** 是否正在加载。 */
export function isLoading(tabId: string): boolean {
  return loading[tabId] === true;
}

/**
 * 确保图片已加载。
 *
 * 同一个标签重复调用只会真正读取一次。
 */
export async function ensureImage(tabId: string, path: string): Promise<void> {
  touched.set(tabId, Date.now());
  if (images[tabId]) return;
  const previous = pending.get(tabId);
  if (previous) {
    // A sleeping tab may be reactivated before its original read finishes.
    cancelled.delete(tabId);
    return previous;
  }

  loading = { ...loading, [tabId]: true };
  const task = loadImage(tabId, path);
  pending.set(tabId, task);
  try {
    await task;
  } finally {
    if (pending.get(tabId) === task) pending.delete(tabId);
  }
}

/** Only the visible viewer pins its cache entry; background reads cannot evict it. */
export function retainImage(tabId: string): void {
  retained = tabId;
  touched.set(tabId, Date.now());
  trimCache();
}

async function loadImage(tabId: string, path: string): Promise<void> {
  try {
    const payload = await ipc.readImage(path);
    // 期间标签已被关闭：丢弃结果，不写入缓存
    if (cancelled.has(tabId)) return;
    images = { ...images, [tabId]: payload };
    trimCache();
  } finally {
    const { [tabId]: _done, ...rest } = loading;
    loading = rest;
    cancelled.delete(tabId);
  }
}

/** 释放某个标签的图片。 */
export function releaseImage(tabId: string): void {
  // 标记取消，防止在途请求回来后重新写入
  if (loading[tabId]) cancelled.add(tabId);
  else cancelled.delete(tabId);
  touched.delete(tabId);
  const { [tabId]: _dimensions, ...remainingDimensions } = dimensions;
  dimensions = remainingDimensions;

  if (images[tabId] === undefined) return;
  const { [tabId]: _removed, ...rest } = images;
  images = rest;
}
