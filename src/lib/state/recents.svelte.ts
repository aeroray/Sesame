/**
 * 最近文件状态。
 *
 * 数据源是 Rust 端的 recent.json，这里只做内存镜像与响应式包装。
 */

import * as ipc from '$lib/ipc/fs';
import type { RecentEntry } from '$lib/state/types';
import { logError } from '$lib/utils/log';

/** 响应式最近文件列表。 */
export const recents = $state<{ items: RecentEntry[]; loading: boolean }>({
  items: [],
  loading: false,
});

/**
 * 请求序号，用于丢弃过期结果。
 *
 * 一次拖入多个文件会并发发出多个 `recent_add`，它们的返回顺序不确定。
 * 若不加判别，列表最终会反映「最后返回的那个」而不是「最后操作的那个」，
 * 出现少条目的现象。
 */
let requestSeq = 0;

/** 拉取列表。 */
export async function refreshRecents(): Promise<void> {
  const seq = ++requestSeq;
  recents.loading = true;
  try {
    const items = await ipc.recentList();
    if (seq !== requestSeq) return; // 已有更新的请求，丢弃本次结果
    recents.items = items;
  } catch (err) {
    logError('recents', '读取最近文件失败', err);
    if (seq === requestSeq) recents.items = [];
  } finally {
    if (seq === requestSeq) recents.loading = false;
  }
}

/** 记录一次打开。 */
export async function addRecent(path: string): Promise<void> {
  const seq = ++requestSeq;
  try {
    const items = await ipc.recentAdd(path);
    if (seq !== requestSeq) return;
    recents.items = items;
  } catch (err) {
    logError('recents', '记录最近文件失败', err);
  }
}

/** 移除单条。 */
export async function removeRecent(path: string): Promise<void> {
  const seq = ++requestSeq;
  try {
    const items = await ipc.recentRemove(path);
    if (seq !== requestSeq) return;
    recents.items = items;
  } catch (err) {
    logError('recents', '移除最近文件失败', err);
  }
}

/** 清空列表。 */
export async function clearRecents(): Promise<void> {
  const seq = ++requestSeq;
  try {
    const items = await ipc.recentClear();
    if (seq !== requestSeq) return;
    recents.items = items;
  } catch (err) {
    logError('recents', '清空最近文件失败', err);
  }
}
