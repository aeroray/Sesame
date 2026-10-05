/**
 * 已关闭标签的历史栈，用于「重新打开已关闭的标签」（Ctrl+Shift+T）。
 *
 * ## 为什么单独成模块
 *
 * 这个栈由「关闭标签」写入、由「重新打开」读取，而后者需要调用 `openPath`。
 * 若把栈放在 `tabs.svelte.ts` 里，它就得 import `actions/open-file`，
 * 而后者又 import 它——形成循环依赖。
 * 因此栈本身只做数据，放在 state 层且不依赖任何 action。
 *
 * ## 只记录有路径的标签
 *
 * 未命名标签关闭时草稿会被删除（用户已确认「不保存」），正文随之丢失，
 * 重开只能得到一个空标签——那没有意义，反而让用户以为内容还在。
 * 因此只记录有路径的，重开时从磁盘重新读取。
 *
 * ## 为什么记录光标位置
 *
 * 重开一个文件却跳回第一行是很突兀的——用户按 Ctrl+Shift+T 通常是
 * 「我刚才手滑关掉了，想接着看」。因此把关闭时的光标与滚动位置一并记下。
 */

import type { Tab } from '$lib/state/types';

/** 一条已关闭标签的记录。 */
export interface ClosedTab {
  path: string;
  name: string;
  /** 光标行号，从 1 开始。 */
  line: number;
  /** 光标列号，从 1 开始。 */
  column: number;
  scrollTop: number;
}

/**
 * 最多记住多少个。
 *
 * 取 20 与「最近文件」列表同量级：再多也不会有人逐个重开，
 * 而栈越大越容易让人重开出早已忘记的旧文件。
 */
const MAX_HISTORY = 20;

/** 历史栈，最新关闭的在末尾。 */
export const closedTabs = $state<{ items: ClosedTab[] }>({ items: [] });

/** 记下一个被关闭的标签。 */
export function rememberClosed(tab: Tab): void {
  // 未命名标签重开只能得到空标签，没有意义
  if (!tab.path) return;

  closedTabs.items.push({
    path: tab.path,
    name: tab.name,
    line: tab.cursorLine,
    column: tab.cursorColumn,
    scrollTop: tab.scrollTop,
  });

  // 超出上限时丢掉最旧的
  if (closedTabs.items.length > MAX_HISTORY) {
    closedTabs.items.splice(0, closedTabs.items.length - MAX_HISTORY);
  }
}

/** 取出最近一条并移除。没有可重开的时返回 `undefined`。 */
export function takeClosed(): ClosedTab | undefined {
  return closedTabs.items.pop();
}

/** 是否还有可重开的标签。 */
export function hasClosed(): boolean {
  return closedTabs.items.length > 0;
}

/** 清空历史。 */
export function clearClosed(): void {
  closedTabs.items = [];
}
