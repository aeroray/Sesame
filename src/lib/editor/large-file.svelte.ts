/**
 * 大文件分块加载。
 *
 * 超大文件不一次性读入内存，而是先加载首块，其余按需追加。
 * 这里只做「顺序追加」这一种策略：编辑器天然是从上往下读的，
 * 顺序追加既符合使用习惯，又不必维护稀疏区间映射
 * （那会引入大量难以验证的边界情况）。
 */

import * as ipc from '$lib/ipc/fs';
import { CHUNK_SIZE, MAX_LOAD_ALL_BYTES } from '$src/constants';
import { getView } from '$lib/state/tabs.svelte';
import { Annotation } from '@codemirror/state';
import type { Tab } from '$lib/state/types';

/**
 * 标记「这次文档变更是分块追加造成的」。
 *
 * 用注解而不是一个跨 await 的全局标志位：标志位在整个 IPC 往返期间都为 true，
 * 用户在等待期间敲的字也会被当成程序化写入而漏掉脏标记（实测会丢改动）。
 * 注解只附着在这一次 dispatch 上，精确无副作用。
 */
export const programmaticAppend = Annotation.define<boolean>();

/** 每个大文件标签页的加载进度。 */
export interface ChunkProgress {
  /** 已加载到文档中的字节数。 */
  loadedBytes: number;
  /** 文件总字节数。 */
  totalBytes: number;
  /** 是否已全部加载。 */
  complete: boolean;
  /** 是否正在加载。 */
  loading: boolean;
}

/**
 * 进度表。这是命令式的加载簿记，不进响应式状态；
 * UI 需要的那部分由下面的 `chunkState` 暴露。
 */
const progress = new Map<string, ChunkProgress>();

/** 响应式镜像，供 UI 读取。 */
export const chunkState = $state<{ byTab: Record<string, ChunkProgress> }>({ byTab: {} });

/** 同步一份进度到响应式状态。 */
function publish(tabId: string, next: ChunkProgress): void {
  progress.set(tabId, next);
  chunkState.byTab = { ...chunkState.byTab, [tabId]: next };
}

/** 读取某个标签页的加载进度（响应式）。 */
export function getProgress(tabId: string): ChunkProgress | undefined {
  return chunkState.byTab[tabId];
}

/**
 * 回收已关闭标签的进度记录。
 *
 * 由 `runSweep` 周期调用，避免 `progress` 与 `chunkState.byTab`
 * 随标签开关次数无界增长。
 */
export function pruneProgress(liveIds: Set<string>): void {
  let changed = false;

  for (const id of progress.keys()) {
    if (!liveIds.has(id)) {
      progress.delete(id);
      changed = true;
    }
  }

  if (!changed) return;

  const next: Record<string, ChunkProgress> = {};
  for (const [id, value] of Object.entries(chunkState.byTab)) {
    if (liveIds.has(id)) next[id] = value;
  }
  chunkState.byTab = next;
}

/**
 * 初始化进度记录。
 */
export function initProgress(tabId: string, totalBytes: number, loadedBytes: number): void {
  publish(tabId, {
    loadedBytes,
    totalBytes,
    complete: loadedBytes >= totalBytes,
    loading: false,
  });
}

/** 清除进度记录。 */
export function clearProgress(tabId: string): void {
  progress.delete(tabId);
  const { [tabId]: _removed, ...rest } = chunkState.byTab;
  chunkState.byTab = rest;
}

/**
 * 追加下一块。
 *
 * 返回是否真的追加了内容（已加载完、正在加载或视图不存在时返回 false）。
 */
export async function loadNextChunk(tab: Tab): Promise<boolean> {
  const current = progress.get(tab.id);
  if (!current || !tab.path || current.complete || current.loading) return false;

  const handle = getView(tab.id);
  if (!handle) return false;

  // 先置 loading，再 dispatch：updateListener 是同步触发的，
  // 这样回调里读到的就是 true，从而跳过脏标记。
  publish(tab.id, { ...current, loading: true });

  try {
    const chunk = await ipc.readChunk(
      tab.path,
      current.loadedBytes,
      tab.encoding,
      CHUNK_SIZE,
    );

    const doc = handle.view.state.doc;
    handle.view.dispatch({
      changes: { from: doc.length, insert: chunk.content },
      // 打上注解，让 change 回调知道这是程序化追加而非用户输入
      annotations: programmaticAppend.of(true),
    });

    const nextLoaded = chunk.nextOffset;
    publish(tab.id, {
      loadedBytes: nextLoaded,
      totalBytes: current.totalBytes,
      complete: chunk.eof || nextLoaded >= current.totalBytes,
      loading: false,
    });
    return true;
  } catch (err) {
    publish(tab.id, { ...current, loading: false });
    throw err;
  }
}

/**
 * 持续加载直到文件结束。
 *
 * 出于内存安全考虑设有总字节上限：超过上限时停止并保留「继续加载」入口，
 * 而不是把几百兆内容一次性读进 WebView。
 */
export async function loadAll(tab: Tab): Promise<void> {
  const start = progress.get(tab.id);
  if (!start) return;

  const cap = Math.min(start.totalBytes, MAX_LOAD_ALL_BYTES);

  while (true) {
    const current = progress.get(tab.id);
    if (!current || current.complete || current.loadedBytes >= cap) break;

    const advanced = await loadNextChunk(tab);
    if (!advanced) break;
  }
}
