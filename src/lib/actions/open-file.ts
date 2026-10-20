/**
 * 打开文件的行为编排。
 *
 * 把「对话框 → IPC → 标签页状态 → 最近文件 → 提示」串成一处，
 * 组件层只调用这一个函数。
 */

import { open } from '@tauri-apps/plugin-dialog';
import { initProgress, loadNextChunk } from '$lib/editor/large-file.svelte';
import { t } from '$lib/i18n';
import * as ipc from '$lib/ipc/fs';
import { noteFileSize, touch } from '$lib/state/hibernation.svelte';
import { ensureImage } from '$lib/state/images.svelte';
import { addRecent } from '$lib/state/recents.svelte';
import { scheduleSessionSave } from '$lib/state/session.svelte';
import { notify } from '$lib/state/status.svelte';
import {
  activateTab,
  createImageTab,
  createTabFromPayload,
  findByPath,
  pathKey,
} from '$lib/state/tabs.svelte';
import { ImageDecodeError } from '$lib/utils/image-transform';
import { fileFilters, IMAGE_EXTENSIONS } from '$src/constants';

/**
 * 提示错误信息。
 *
 * 已知的错误类型先在这里翻译，**不要**直接显示 `err.message`：
 * 内部抛出的错误消息是中文的（写给开发者看的），直接显示会在英文界面里
 * 冒出一句中文。未知错误才回落到 `message`，那是后端给的、已经本地化过。
 */
export function reportError(err: unknown, fallback = t('error.generic')): void {
  if (err instanceof ImageDecodeError) {
    notify.error(t('error.decodeImageFailed'));
    return;
  }
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
const opening = new Map<string, Promise<void>>();

export function openPath(path: string): Promise<void> {
  const key = pathKey(path);
  const pending = opening.get(key);
  if (pending) return pending;
  const task = performOpen(path).finally(() => opening.delete(key));
  opening.set(key, task);
  return task;
}

async function performOpen(path: string): Promise<void> {
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
    const duplicate = findByPath(payload.meta.path);
    if (duplicate) {
      activateTab(duplicate.id);
      return;
    }
    const tab = createTabFromPayload(payload);
    if (payload.decodeLossy) notify.warning(t('error.lossyDecodeReadonly'));
    await addRecent(payload.meta.path);

    // 记录体积供休眠策略判断，并标记为刚活动
    noteFileSize(tab.id, payload.meta.size);
    touch(tab.id);

    if (payload.truncated) {
      // 大文件：只载入了首块，登记进度并立即拉第一块
      initProgress(tab.id, payload.meta.size, 0);
      await loadNextChunk(tab);
      notify.info(t('status.largeFileMode'));
    } else {
      initProgress(tab.id, payload.meta.size, payload.meta.size);
    }

    scheduleSessionSave();
  } catch (err) {
    reportError(err, t('error.openFailed'));
  }
}

/** 打开图片文件。 */
async function openImagePath(path: string): Promise<void> {
  try {
    const meta = await ipc.statFile(path);
    const duplicate = findByPath(meta.path);
    if (duplicate) {
      activateTab(duplicate.id);
      return;
    }
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
    reportError(err, t('error.openImageFailed'));
  }
}

/** 弹出原生文件对话框并打开所选文件。 */
export async function openViaDialog(): Promise<void> {
  try {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: fileFilters(),
    });

    if (typeof selected === 'string') {
      await openPath(selected);
    }
  } catch (err) {
    reportError(err, t('error.openDialogFailed'));
  }
}
