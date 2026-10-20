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
import { IDENTITY, type ImageTransform, isIdentity } from '$lib/utils/image-transform';

/** 标签 id → 图片负载。 */
let images = $state.raw<Record<string, ImagePayload>>({});

export interface ImageDimensions {
  width: number;
  height: number;
}
let dimensions = $state.raw<Record<string, ImageDimensions>>({});

/**
 * 标签 id → 旋转 / 翻转状态。
 *
 * ## 为什么变换状态放在这里而不是 Tab 上
 *
 * 它是**图片专属**的数据：文本标签没有旋转的概念。放进 `Tab`
 * 会让那个类型多出一个对多数标签永远无意义的字段。
 *
 * ## 为什么是「未保存的变换」而不是直接改图
 *
 * 与主流查看器一致：旋转只在**内存**里生效，用户按保存才写回文件。
 * 这样有两点好处：
 *
 * - JPEG 重编码必然有损（实测 `rgb(32,64,128)` → `rgb(30,66,123)`），
 *   立即写回等于在用户每次点旋转时都掉一次画质，且无法撤销。
 * - 用户点错了可以直接关掉标签，原文件毫发无损。
 *
 * 「有未保存的变换」这个状态记在 `Tab.dirty` 上（那里已经有标签指示点
 * 与关闭前提示），因此这里只存变换本身。
 */
let transforms = $state.raw<Record<string, ImageTransform>>({});

/** 取某个标签的变换状态，没有则为恒等。 */
export function getTransform(tabId: string): ImageTransform {
  return transforms[tabId] ?? IDENTITY;
}

/** 该标签是否有未保存的变换。 */
export function hasTransform(tabId: string): boolean {
  return !isIdentity(getTransform(tabId));
}

/** 设置变换状态；传恒等即清除。 */
export function setTransform(tabId: string, value: ImageTransform): void {
  if (isIdentity(value)) {
    const { [tabId]: _cleared, ...rest } = transforms;
    transforms = rest;
    return;
  }
  transforms = { ...transforms, [tabId]: value };
}

/** 清除某个标签的变换（保存后、重新读取后调用）。 */
export function clearTransform(tabId: string): void {
  const { [tabId]: _cleared, ...rest } = transforms;
  transforms = rest;
}

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

/**
 * 就地替换某个标签的图片数据（旋转 / 翻转保存后调用）。
 *
 * 只更新负载，不动加载状态：这份数据是**本地重绘**的结果，
 * 不是从磁盘读来的，走一遍 `ensureImage` 反而会把它覆盖回旧内容。
 */
export function setImageData(tabId: string, payload: ImagePayload): void {
  images = { ...images, [tabId]: payload };
  touched.set(tabId, Date.now());
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

/**
 * 取消「钉住」。
 *
 * `retainImage` 由查看器在标签被激活时调用，用来保证**正在看的那张**不会被
 * 缓存清理踢掉。但早先没有任何地方解除它：`releaseImage` 只删数据、不动
 * `retained`，于是最近看过的那张图（最大约 27 MB base64）会永久占着额度，
 * 其它图片的实际可用缓存被压缩。
 *
 * 查看器卸载 / 标签关闭时调用这里。
 */
export function releaseRetained(tabId: string): void {
  if (retained === tabId) retained = undefined;
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
  // 钉住的记录也要一并解除，否则已关闭的标签仍占着缓存额度
  releaseRetained(tabId);
  // 标记取消，防止在途请求回来后重新写入
  if (loading[tabId]) cancelled.add(tabId);
  else cancelled.delete(tabId);
  touched.delete(tabId);
  const { [tabId]: _dimensions, ...remainingDimensions } = dimensions;
  dimensions = remainingDimensions;
  // 变换状态与图片同生命周期：标签关了就不该留下
  const { [tabId]: _transform, ...remainingTransforms } = transforms;
  transforms = remainingTransforms;

  if (images[tabId] === undefined) return;
  const { [tabId]: _removed, ...rest } = images;
  images = rest;
}
