/**
 * 自动保存调度。
 *
 * 按标签页防抖：连续输入只在停顿后写一次盘，避免每个字符都触发一次 IO。
 * 定时器按 tab id 分开，因此多个标签同时编辑互不干扰。
 */

import { autoSaveTab } from '$lib/actions/save-file';
import { settings } from '$lib/state/settings.svelte';
import { tabs } from '$lib/state/tabs.svelte';
import { AUTOSAVE_DEBOUNCE } from '$src/constants';

/** tab id → 待触发的定时器。 */
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** 该标签是否正在自动保存中（避免重入）。 */
const running = new Set<string>();

/** 安排一次自动保存。 */
export function scheduleAutoSave(tabId: string): void {
  if (!settings.autoSave) return;

  const existing = timers.get(tabId);
  if (existing !== undefined) clearTimeout(existing);

  timers.set(
    tabId,
    setTimeout(() => {
      timers.delete(tabId);
      void runAutoSave(tabId);
    }, AUTOSAVE_DEBOUNCE),
  );
}

/** 执行一次自动保存。 */
async function runAutoSave(tabId: string): Promise<void> {
  if (!settings.autoSave || running.has(tabId)) return;

  const tab = tabs.items.find((t) => t.id === tabId);
  // 标签已被关闭，或已不再需要保存
  if (!tab || !tab.dirty) return;

  running.add(tabId);
  try {
    await autoSaveTab(tab);
  } finally {
    running.delete(tabId);
  }
}

/** 取消某个标签的待保存（关闭标签时调用）。 */
export function cancelAutoSave(tabId: string): void {
  const timer = timers.get(tabId);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(tabId);
  }
}

/**
 * 关闭自动保存时清空所有待办。
 *
 * 用户在设置里关掉自动保存后，不应再有任何延迟触发的写入。
 */
export function cancelAllAutoSave(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}

/**
 * 立即冲刷所有待保存的标签。
 *
 * 关闭窗口前调用：此时不能再等防抖计时器，
 * 否则窗口销毁后改动就丢了。
 */
export async function flushAutoSave(): Promise<void> {
  if (!settings.autoSave) return;

  const pending = [...timers.keys()];
  cancelAllAutoSave();

  await Promise.all(pending.map((id) => runAutoSave(id)));
}
