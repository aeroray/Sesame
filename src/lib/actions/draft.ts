/**
 * 草稿备份：把「未保存的正文」暂存到磁盘。
 *
 * ## 为什么需要它
 *
 * 未命名标签（新建文件）的正文**没有任何落盘去处**：
 * 它没有路径，自动保存无从下手；会话快照只记路径，也带不走正文。
 * 结果是「新建 → 输入 → 关窗口」静默丢内容。
 *
 * 这里为所有脏标签（不论有无路径）定期写一份草稿到应用数据目录。
 * 它不是「保存」——用户的文件不会被改动，草稿只是崩溃与误关的兜底。
 *
 * ## 与自动保存的区别
 *
 * - **自动保存**：直接把内容写回用户的原文件，需要标签有路径。
 * - **草稿备份**：写到应用数据目录，不改动用户文件，任何标签都适用。
 *
 * 两者互补：有路径时自动保存更直接，无路径时只有草稿能救。
 * 因此**草稿备份不依赖自动保存开关**——它是数据安全的底线，不该被关掉。
 */

import * as ipc from '$lib/ipc/fs';
import { getView, tabs, hasTabContent, peekTabContent } from '$lib/state/tabs.svelte';
import type { Draft, Tab } from '$lib/state/types';
import { logError } from '$lib/utils/log';

/** 草稿写入的防抖时长（毫秒）。 */
const DRAFT_DEBOUNCE = 2000;

/** tab id → 待触发的定时器。 */
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** 已经写过草稿的 tab id。用于退出时判断有没有遗漏。 */
const written = new Set<string>();

/** 取得标签的当前正文；不可取时返回 null。 */
function contentOf(tab: Tab): string | null {
  if (tab.kind !== 'text') return null;
  const handle = getView(tab.id);
  if (handle) return handle.getContent();
  return hasTabContent(tab.id) ? peekTabContent(tab.id) : null;
}

/** 把标签组装成草稿。 */
function toDraft(tab: Tab, content: string): Draft {
  return {
    id: tab.id,
    path: tab.path,
    name: tab.name,
    content,
    language: tab.language,
    encoding: tab.encoding,
    lineEnding: tab.lineEnding,
    hasBom: tab.hasBom,
    savedAt: Date.now(),
  };
}

/** 立即为单个标签写一份草稿。 */
async function writeDraft(tab: Tab): Promise<void> {
  const content = contentOf(tab);
  // 取不到正文时宁可不写：写一份空的草稿会覆盖掉好的那份
  if (content === null) return;

  try {
    await ipc.draftSave(toDraft(tab, content));
    written.add(tab.id);
  } catch (err) {
    // 草稿是兜底手段，失败不该打断用户操作，静默记录
    logError('draft', '写入草稿失败', err);
  }
}

/**
 * 安排一次草稿备份。
 *
 * 只在标签变脏时调用。按标签防抖，连续输入不会每敲一个字就写一次盘。
 */
export function scheduleDraft(tabId: string): void {
  const existing = timers.get(tabId);
  if (existing !== undefined) clearTimeout(existing);

  timers.set(
    tabId,
    setTimeout(() => {
      timers.delete(tabId);
      const tab = tabs.items.find((t) => t.id === tabId);
      if (!tab || !tab.dirty) return;
      void writeDraft(tab);
    }, DRAFT_DEBOUNCE),
  );
}

/** 取消某个标签的待写草稿。 */
export function cancelDraft(tabId: string): void {
  const timer = timers.get(tabId);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(tabId);
  }
}

/**
 * 删除某个标签的草稿。
 *
 * 三种情况调用：内容已成功保存到原文件、用户明确选择不保存、标签被正常关闭。
 *
 * 这里**不能**用「是否写过草稿」做前置判断：启动时从磁盘恢复的草稿
 * 并没有经过 `writeDraft`，内存集合里没有它们，加了判断就会直接返回、
 * 永远删不掉文件——实测表现为「保存过或明确放弃后，重启又冒出来」。
 * 删除本身是幂等的（文件不存在也算成功），直接调用即可。
 */
export async function dropDraft(tabId: string): Promise<void> {
  cancelDraft(tabId);
  written.delete(tabId);
  try {
    await ipc.draftDelete(tabId);
  } catch (err) {
    logError('draft', '删除草稿失败', err);
  }
}

/**
 * 立即冲刷全部脏标签的草稿。
 *
 * 关闭窗口前调用——此时不能再等防抖计时器，否则窗口销毁后
 * 最后几秒的输入就没了。这是防「新建文件关窗口丢内容」的关键一步。
 */
export async function flushDrafts(): Promise<void> {
  // 先清掉所有待触发的定时器，避免稍后又写一遍
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();

  const dirty = tabs.items.filter((t) => t.dirty && t.kind === 'text');
  await Promise.all(dirty.map((t) => writeDraft(t)));
}

/**
 * 读取上次遗留的草稿。
 *
 * 返回时**不**删除草稿文件：恢复失败或用户又关掉窗口时，
 * 草稿必须还在。真正的清理发生在内容被保存或用户放弃时。
 *
 * 读到的 id 会登记进 `written`，让退出时的判断能反映
 * 「磁盘上确实有草稿的标签数」，而不是「本次会话写过草稿的标签数」。
 */
export async function loadDrafts(): Promise<Draft[]> {
  try {
    const drafts = await ipc.draftList();
    for (const d of drafts) written.add(d.id);
    return drafts;
  } catch (err) {
    logError('draft', '读取草稿失败', err);
    return [];
  }
}

/** 清空全部草稿。恢复流程结束后由调用方决定是否调用。 */
export async function clearAllDrafts(): Promise<void> {
  written.clear();
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  try {
    await ipc.draftClear();
  } catch (err) {
    logError('draft', '清空草稿失败', err);
  }
}
