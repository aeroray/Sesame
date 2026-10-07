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
  /**
   * 父目录，供「最近关闭」列表显示。
   *
   * 存整条路径的话，`D:\a\b\c\d\e\file.txt` 在菜单里只能显示开头一段，
   * 而用户认位置靠的恰是**末尾几级目录**。只留父目录反而信息密度更高。
   */
  dir: string;
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
    dir: parentDir(tab.path),
    line: tab.cursorLine,
    column: tab.cursorColumn,
    scrollTop: tab.scrollTop,
  });

  // 超出上限时丢掉最旧的
  if (closedTabs.items.length > MAX_HISTORY) {
    closedTabs.items.splice(0, closedTabs.items.length - MAX_HISTORY);
  }
}

/**
 * 取父目录。
 *
 * 内部路径统一是正斜杠（Rust 侧 `to_slash()`），最后一段之前就是目录。
 * 没有分隔符时返回空串（相对路径文件名），调用方据此不显示。
 */
function parentDir(path: string): string {
  const i = path.lastIndexOf('/');
  return i > 0 ? path.slice(0, i) : '';
}

/** 取出最近一条并移除。没有可重开的时返回 `undefined`。 */
export function takeClosed(): ClosedTab | undefined {
  return closedTabs.items.pop();
}

/**
 * 最近关闭的若干条，**最新的在前**。
 *
 * 只读快照，供「最近关闭」子菜单渲染。不返回内部数组本身：
 * 调用方拿到的是响应式代理，写操作会直接改到栈里。
 *
 * 顺序反转是刻意的——栈本身最新在末尾（`pop` 取最近），
 * 而菜单要从上到下读「最近 → 较早」。
 */
export function recentClosed(limit = 5): ClosedTab[] {
  return closedTabs.items.slice(-limit).reverse();
}

/**
 * 按 `recentClosed()` 的索引取出并移除。
 *
 * 索引以「最新在前」计（0 = 最近关闭的那个），与 `recentClosed` 一致——
 * 菜单里点第几项就传几，调用方不必关心栈是反的。
 */
export function takeClosedAt(index: number): ClosedTab | undefined {
  const size = closedTabs.items.length;
  if (index < 0 || index >= size) return undefined;
  return closedTabs.items.splice(size - 1 - index, 1)[0];
}

/** 是否还有可重开的标签。 */
export function hasClosed(): boolean {
  return closedTabs.items.length > 0;
}

/** 清空历史。 */
export function clearClosed(): void {
  closedTabs.items = [];
}
