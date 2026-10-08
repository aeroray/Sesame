/**
 * 保存图片的旋转 / 翻转结果。
 *
 * ## 为什么单独成一个模块
 *
 * 文本保存（`actions/save-file.ts`）走的是「取编辑器正文 → 按编码与换行
 * 写回」这条路，而图片保存走的是「把 canvas 重绘结果编码后写回」。
 * 两者除了「写文件」这一步之外没有任何共同点，硬塞进同一个函数
 * 只会让那条本来就很长的保存路径再多几个分支。
 *
 * ## 与主流查看器一致的语义
 *
 * 旋转 / 翻转只在**内存**里生效，用户显式保存才写回文件：
 *
 * - JPEG 重编码必然有损（实测 `rgb(32,64,128)` → `rgb(30,66,123)`），
 *   立即写回等于每点一次旋转就掉一次画质，且无法撤销。
 * - 点错了可以直接关标签，原文件毫发无损。
 *
 * 因此这里**不**自动保存，也不做任何「稍后自动写回」的定时器。
 *
 * ## 为什么写回前要提示 JPEG
 *
 * PNG 重编码是无损的，JPEG 不是。同一个动作对两种格式的后果不同，
 * 用户有权知道——尤其「覆盖原文件」是不可逆的。
 * PNG 不提示，避免把确认框变成无意义的噪音。
 */

import { message } from '@tauri-apps/plugin-dialog';
import { t } from '$lib/i18n';
import * as ipc from '$lib/ipc/fs';
import { clearTransform, getImage, getTransform, setImageData } from '$lib/state/images.svelte';
import { notify } from '$lib/state/status.svelte';
import { markDirty } from '$lib/state/tabs.svelte';
import type { Tab } from '$lib/state/types';
import { applyTransform, decodeImage, encodeCanvas, isIdentity } from '$lib/utils/image-transform';
import { logError } from '$lib/utils/log';

/**
 * 会被重编码损坏的格式。
 *
 * 判断依据是 MIME：这些格式的重编码是有损的。
 * PNG / BMP / GIF（单帧）重编码无损，不需要提示。
 *
 * GIF 特例：canvas 只能拿到**第一帧**，动画 GIF 保存后会变成静态图。
 * 这一点同样会损失内容，所以也纳入提示范围。
 */
function isLossy(mime: string): boolean {
  return mime === 'image/jpeg' || mime === 'image/webp' || mime === 'image/gif';
}

/** 该图片是否可以直接保存（有路径、有变换、格式可写）。 */
export function canSaveImage(tab: Tab): boolean {
  if (tab.kind !== 'image' || !tab.path) return false;
  if (!getImage(tab.id)) return false;
  return !isIdentity(getTransform(tab.id));
}

/**
 * 保存当前标签的图片变换。
 *
 * 返回是否真的写入了。未变换、非图片、无路径时返回 `false` 且不提示——
 * 那属于「没什么可保存」，不是错误。
 */
export async function saveImage(tab: Tab): Promise<boolean> {
  if (!canSaveImage(tab) || !tab.path) return false;

  const payload = getImage(tab.id);
  if (!payload) return false;

  const transform = getTransform(tab.id);

  /*
   * 有损格式先确认。
   *
   * 走原生对话框而不是自绘：与关闭未保存标签、编码切换等处的
   * 确认方式保持一致（那些也是 `message()`）。
   */
  if (isLossy(payload.mime)) {
    const btnOk = t('action.confirm');
    const btnCancel = t('action.cancel');
    const answer = await message(t('image.lossySaveWarning'), {
      title: t('image.saveTitle'),
      kind: 'warning',
      buttons: { ok: btnOk, cancel: btnCancel },
    });
    if (answer !== btnOk) return false;
  }

  try {
    const bitmap = await decodeImage(payload.dataUrl);
    const canvas = applyTransform(bitmap, bitmap.naturalWidth, bitmap.naturalHeight, transform);

    // 按**原格式**编码：PNG 存成 PNG，JPEG 存成 JPEG，不擅自换格式
    const dataUrl = encodeCanvas(canvas, payload.mime);

    await ipc.writeImageData(tab.path, dataUrl);

    /*
     * 写回后更新缓存与状态。
     *
     * 用新数据替换缓存里的 dataUrl，并把尺寸改成变换后的值——
     * 否则状态栏仍显示旋转前的宽高，与实际文件不符。
     * 同时清掉变换：像素已经落进文件，再叠加一次会重复旋转。
     */
    setImageData(tab.id, {
      ...payload,
      dataUrl,
      size: Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75),
    });
    clearTransform(tab.id);
    markDirty(tab.id, false);

    notify.success(t('image.savedRotated'));
    return true;
  } catch (err) {
    logError('image', '保存旋转结果失败', err);
    notify.error(t('error.saveImageFailed'));
    return false;
  }
}
