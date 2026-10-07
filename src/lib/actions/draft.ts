/**
 * Ordered draft backup. Writes/deletes for a tab are serialized so a late
 * backup cannot resurrect a saved/discarded document.
 */
import { getProgress } from '$lib/editor/large-file.svelte';
import { t } from '$lib/i18n';
import * as ipc from '$lib/ipc/fs';
import { notify } from '$lib/state/status.svelte';
import { editVersion, getView, hasTabContent, peekTabContent, tabs } from '$lib/state/tabs.svelte';
import type { Draft, Tab } from '$lib/state/types';
import { KeyedTaskQueue } from '$lib/utils/async';
import { logError } from '$lib/utils/log';

const DRAFT_DEBOUNCE = 2000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const queue = new KeyedTaskQueue();
const failed = new Set<string>();

function contentOf(tab: Tab): string | null {
  if (tab.kind !== 'text') return null;
  const handle = getView(tab.id);
  return handle ? handle.getContent() : hasTabContent(tab.id) ? peekTabContent(tab.id) : null;
}

function toDraft(tab: Tab, content: string): Draft {
  const progress = getProgress(tab.id);
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
    baseline: tab.baseline ?? null,
    prefixBytes: progress && !progress.complete ? progress.loadedBytes : null,
    totalBytes: progress?.totalBytes ?? null,
    schemaVersion: 2,
  };
}

async function writeDraft(tab: Tab): Promise<boolean> {
  return queue.run(tab.id, async () => {
    if (!tabs.items.some((item) => item.id === tab.id) || !tab.dirty) return true;
    const content = contentOf(tab);
    if (content === null) return false;
    const version = editVersion(tab.id);
    try {
      await ipc.draftSave(toDraft(tab, content));
      failed.delete(tab.id);
      return editVersion(tab.id) === version;
    } catch (err) {
      logError('draft', '写入草稿失败', err);
      if (!failed.has(tab.id)) notify.warning(t('error.draftBackupFailed'));
      failed.add(tab.id);
      return false;
    }
  });
}

export function scheduleDraft(tabId: string): void {
  cancelDraft(tabId);
  timers.set(
    tabId,
    setTimeout(() => {
      timers.delete(tabId);
      const tab = tabs.items.find((item) => item.id === tabId);
      if (tab?.dirty) void writeDraft(tab);
    }, DRAFT_DEBOUNCE),
  );
}

export function cancelDraft(tabId: string): void {
  const timer = timers.get(tabId);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(tabId);
}

export async function dropDraft(tabId: string): Promise<boolean> {
  cancelDraft(tabId);
  return queue.run(tabId, async () => {
    try {
      await ipc.draftDelete(tabId);
      failed.delete(tabId);
      return true;
    } catch (err) {
      logError('draft', '删除草稿失败', err);
      notify.warning(t('error.draftDeleteFailed'));
      return false;
    }
  });
}

export async function flushDrafts(): Promise<boolean> {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  await queue.drain();
  const dirty = tabs.items.filter((tab) => tab.dirty && tab.kind === 'text');
  return (await Promise.all(dirty.map(writeDraft))).every(Boolean);
}

export async function loadDrafts(): Promise<Draft[]> {
  try {
    return await ipc.draftList();
  } catch (err) {
    logError('draft', '读取草稿失败', err);
    return [];
  }
}

export async function clearAllDrafts(): Promise<void> {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  await queue.drain();
  await ipc.draftClear();
  failed.clear();
}
