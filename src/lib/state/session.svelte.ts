/**
 * 会话的存储层。
 *
 * 这里只负责「读写快照」，不负责「打开文件」——
 * 恢复会话需要调用 openPath（属于 actions 层），若在这里 import 它，
 * 就会形成 actions ↔ state 的循环依赖。恢复逻辑见 `actions/restore-session.ts`。
 *
 * 两个刻意的取舍：
 * - **不保存未命名标签**：它们的正文没有落盘，恢复时无法还原内容，
 *   只恢复一个空标签反而是误导。
 * - **不保存未保存的改动**：会话只记路径与位置。真正的改动必须由用户保存，
 *   编辑器不应该偷偷把内容藏进一个应用数据目录里的 json。
 */

import * as ipc from '$lib/ipc/fs';
import { settings } from '$lib/state/settings.svelte';
import { tabs } from '$lib/state/tabs.svelte';
import type { SessionSnapshot, SessionTab } from '$lib/state/types';

/** 会话保存的防抖时长（毫秒）。 */
const SAVE_DEBOUNCE = 800;

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** 采集当前工作现场。 */
export function snapshot(): SessionSnapshot {
  const tabsOut: SessionTab[] = tabs.items
    .filter((t) => t.path !== null)
    .map((t) => ({
      path: t.path as string,
      line: t.cursorLine,
      column: t.cursorColumn,
      scrollTop: t.scrollTop,
    }));

  const active = tabs.items.find((t) => t.id === tabs.activeId);

  return {
    tabs: tabsOut,
    activePath: active?.path ?? null,
  };
}

/** 立即写入会话。 */
export async function saveSessionNow(): Promise<void> {
  try {
    await ipc.sessionSave(snapshot());
  } catch (err) {
    // 会话保存失败不该打扰用户，静默记录即可
    console.error('保存会话失败', err);
  }
}

/** 防抖保存。标签频繁切换时不会每次都写盘。 */
export function scheduleSessionSave(): void {
  if (!settings.restoreSession) return;
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void saveSessionNow();
  }, SAVE_DEBOUNCE);
}

/** 读取上次会话快照。 */
export async function loadSnapshot(): Promise<SessionSnapshot> {
  if (!settings.restoreSession) return { tabs: [], activePath: null };
  try {
    return await ipc.sessionLoad();
  } catch (err) {
    console.error('读取会话失败', err);
    return { tabs: [], activePath: null };
  }
}

/** 清空会话。 */
export async function clearSession(): Promise<void> {
  try {
    await ipc.sessionClear();
  } catch (err) {
    console.error('清空会话失败', err);
  }
}
