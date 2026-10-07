/**
 * 重新打开已关闭的标签（Ctrl+Shift+T）。
 *
 * 所有主流编辑器的肌肉记忆：手滑关掉一个标签，按这个组合键找回来。
 *
 * 实现上刻意**复用 `openPath`**，而不是自己走一遍 IPC：
 * 打开文件牵涉去重、编码探测、大文件分块、最近文件、会话保存等一串逻辑，
 * 重开若另写一份，两者迟早会不一致。
 */

import { openPath } from '$lib/actions/open-file';
import { t } from '$lib/i18n';
import { type ClosedTab, hasClosed, takeClosed, takeClosedAt } from '$lib/state/closed-tabs.svelte';
import { notify } from '$lib/state/status.svelte';
import { activateTab, findByPath, setRestoreTarget } from '$lib/state/tabs.svelte';

/**
 * 打开一条已关闭标签的记录。
 *
 * 记录已被取出（调用方负责），这里只管打开并还原光标。
 */
async function openClosedEntry(entry: ClosedTab): Promise<boolean> {
  // 已经打开着（例如用户手动开回来了）就直接激活，不重复开标签
  const existing = findByPath(entry.path);
  if (existing) {
    activateTab(existing.id);
    return true;
  }

  await openPath(entry.path);

  const tab = findByPath(entry.path);
  if (!tab) {
    // openPath 内部已吞掉失败并提示过，这里不再重复报错
    return false;
  }

  /*
   * 还原关闭时的光标与滚动位置。
   *
   * 走 `setRestoreTarget` 而不是直接改 `tab.cursorLine`：
   * 视图可能已经挂载并读过了旧值，直接赋值对视图无效（实测光标总回到第 1 行）。
   */
  setRestoreTarget(tab.id, {
    line: entry.line,
    column: entry.column,
    scrollTop: entry.scrollTop,
  });

  return true;
}

/**
 * 重开最近关闭的一个标签。
 *
 * 返回是否真的打开了。
 */
export async function reopenClosedTab(): Promise<boolean> {
  if (!hasClosed()) {
    notify.info(t('status.noClosedTabs'));
    return false;
  }

  /*
   * 先取出再尝试打开。
   *
   * 若打开失败（文件已被删除或移动），这一条就从栈里丢掉了——
   * 这是刻意的：留着它只会让用户反复按 Ctrl+Shift+T 都打不开同一个
   * 已经不存在的文件。失败时给出提示，用户知道该重新找文件了。
   */
  const entry = takeClosed();
  if (!entry) return false;

  return openClosedEntry(entry);
}

/**
 * 重开「最近关闭」列表里的第 `index` 条（0 = 最近关闭的那个）。
 *
 * 索引与 `recentClosed()` 一致，供右键菜单的子菜单使用。
 * 取不到时静默返回——菜单可能在打开期间就失效了（用户在别处先重开了一个），
 * 那时再报错反而莫名其妙。
 */
export async function reopenClosedAt(index: number): Promise<boolean> {
  const entry = takeClosedAt(index);
  if (!entry) return false;

  return openClosedEntry(entry);
}
