/**
 * 打开文件的行为编排。
 *
 * 把「对话框 → IPC → 标签页状态 → 最近文件 → 提示」串成一处，
 * 组件层只调用这一个函数。
 */

import { open } from '@tauri-apps/plugin-dialog';
import { notify } from '$lib/state/status.svelte';
import { FILE_FILTERS, IMAGE_EXTENSIONS } from '$src/constants';
import * as ipc from '$lib/ipc/fs';
import { addRecent } from '$lib/state/recents.svelte';
import {
  activateTab,
  createImageTab,
  createTabFromPayload,
  findByPath,
} from '$lib/state/tabs.svelte';
import { ensureImage } from '$lib/state/images.svelte';
import { initProgress, loadNextChunk } from '$lib/editor/large-file.svelte';
import { noteFileSize, touch } from '$lib/state/hibernation.svelte';
import { scheduleSessionSave } from '$lib/state/session.svelte';
/** 提示错误信息。 */
export function reportError(err: unknown, fallback = '操作失败'): void {
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : fallback;
  notify.error(message);
}

/** 判断路径是否为图片（按扩展名）。 */
function isImagePath(path: string): boolean {
  const name = path.replace(/\\/g, '/').split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return false;
  const ext = name.slice(dot + 1).toLowerCase();
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * 打开指定路径的文件。
 *
 * 已打开的文件会直接激活，不重复开标签。
 */
export async function openPath(path: string): Promise<void> {
  const existing = findByPath(path);
  if (existing) {
    activateTab(existing.id);
    return;
  }

  // 图片走独立的查看器，不读成文本
  if (isImagePath(path)) {
    await openImagePath(path);
    return;
  }

  try {
    const payload = await ipc.openFile(path);
    const tab = createTabFromPayload(payload);
    await addRecent(payload.meta.path);

    // 记录体积供休眠策略判断，并标记为刚活动
    noteFileSize(tab.id, payload.meta.size);
    touch(tab.id);

    if (payload.truncated) {
      // 大文件：只载入了首块，登记进度并立即拉第一块
      initProgress(tab.id, payload.meta.size, 0);
      await loadNextChunk(tab);
      notify.info('文件较大，已切换为大文件模式');
    } else {
      initProgress(tab.id, payload.meta.size, payload.meta.size);
    }

    scheduleSessionSave();
  } catch (err) {
    reportError(err, '无法打开文件');
  }
}

/** 打开图片文件。 */
async function openImagePath(path: string): Promise<void> {
  try {
    const meta = await ipc.statFile(path);
    const tab = createImageTab({
      path: meta.path,
      name: meta.name,
      size: meta.size,
    });
    await addRecent(meta.path);
    noteFileSize(tab.id, meta.size);
    touch(tab.id);

    // 立即开始读取，让用户看到进度而不是空白
    await ensureImage(tab.id, meta.path);
    scheduleSessionSave();
  } catch (err) {
    reportError(err, '无法打开图片');
  }
}

/** 弹出原生文件对话框并打开所选文件。 */
export async function openViaDialog(): Promise<void> {
  try {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: FILE_FILTERS.map((f) => ({
        name: f.name,
        extensions: [...f.extensions],
      })),
    });

    if (typeof selected === 'string') {
      await openPath(selected);
    }
  } catch (err) {
    reportError(err, '打开文件失败');
  }
}
