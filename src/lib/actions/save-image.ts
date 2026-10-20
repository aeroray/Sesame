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
 * ## 为什么写回前要提示
 *
 * 同一个「旋转 + 保存」动作，对不同格式的后果并不相同，用户有权知道——
 * 尤其「覆盖原文件」是不可逆的：
 *
 * - **JPEG / WebP**：重编码有损，掉画质。
 * - **GIF / BMP / ICO / AVIF**：引擎编不出这些格式，`toDataURL` 会静默
 *   退回 PNG。因此**不写回原文件**，改为引导用户另存一份 PNG 副本
 *   （见 `saveAsReencodedCopy`）——把 `.ico` 写成 PNG 字节流不是「有损」，
 *   是让文件与扩展名不符，别的程序解码必然失败。
 *
 * PNG 两种后果都不占（重编码无损、原格式可编码），因此不提示，
 * 避免把确认框变成无意义的噪音。
 */

import { message, save } from '@tauri-apps/plugin-dialog';
import { t } from '$lib/i18n';
import * as ipc from '$lib/ipc/fs';
import { clearTransform, getImage, getTransform, setImageData } from '$lib/state/images.svelte';
import { notify } from '$lib/state/status.svelte';
import { editVersion, markDirty } from '$lib/state/tabs.svelte';
import type { ImagePayload, Tab } from '$lib/state/types';
import {
  applyTransform,
  canWriteBackAs,
  decodeImage,
  encodeCanvas,
  type ImageTransform,
  isIdentity,
  isTransformableSize,
} from '$lib/utils/image-transform';
import { logError } from '$lib/utils/log';

/** 后端返回的错误码为 `conflict` 时表示文件已被外部修改。 */
function isConflict(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'conflict';
}

/**
 * 需要用户确认才能覆盖原文件的格式。
 *
 * 只有**有损**格式才值得问「要不要继续」：重编码掉画质且不可撤销，
 * 但结果仍然是同一个格式、同一个文件，用户知情后可以接受。
 *
 * 引擎编不出的格式（GIF / BMP / ICO / AVIF）不走这条——那种情况
 * 「继续」并不存在（写回会变成 PNG 或直接被后端拒绝），
 * 因此改走 `saveAsReencodedCopy`，给一个真正可行的出口。
 * PNG 两类都不占：重编码无损、原格式也编得出来，因此不打扰用户。
 */
function isLossy(mime: string): boolean {
  return mime === 'image/jpeg' || mime === 'image/webp';
}

/** 引擎能否按原格式编码；不能则写回必然变成 PNG。 */
function isFormatReplaced(mime: string): boolean {
  return !canWriteBackAs(mime);
}

/** 该图片是否可以直接保存（有路径、有变换、格式可写）。 */
export function canSaveImage(tab: Tab): boolean {
  if (tab.kind !== 'image' || !tab.path) return false;
  if (!getImage(tab.id)) return false;
  return !isIdentity(getTransform(tab.id));
}

/**
 * 重绘成位图并检查像素量。
 *
 * canvas 要按「宽 × 高 × 4 字节」铺开，8000 × 8000 就是 256 MB，
 * 后备缓冲还要再来一份。这种图重绘会把 WebView 拖死，
 * 因此提前拒绝并说明，而不是让界面失去响应。
 *
 * 返回 `null` 表示尺寸过大，调用方据此停止。
 */
async function renderTransform(
  dataUrl: string,
  transform: ImageTransform,
): Promise<HTMLCanvasElement | null> {
  const bitmap = await decodeImage(dataUrl);
  if (!isTransformableSize(bitmap.naturalWidth, bitmap.naturalHeight)) return null;
  return applyTransform(bitmap, bitmap.naturalWidth, bitmap.naturalHeight, transform);
}

/**
 * 把重绘结果写到用户新选的路径。
 *
 * 三种情况共用：原格式写不回去（强制 PNG）、外部修改冲突（保持原格式）、
 * 以及将来任何「不能覆盖原文件」的出口。共同点是**都不动原文件**，
 * 因此写完不清变换、不清脏标记——旋转还没有存进那个文件。
 */
async function saveTransformedCopy(
  payload: ImagePayload,
  transform: ImageTransform,
  options: { mime: string; extension: string; suggestedName: string; directory?: string },
): Promise<boolean> {
  const { mime, extension, suggestedName, directory } = options;

  const target = await save({
    title: t('image.saveAsTitle'),
    defaultPath: directory ? `${directory}/${suggestedName}` : suggestedName,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
  if (!target) return false;

  /*
   * 目标扩展名必须与要写入的编码一致。
   *
   * 过滤器与默认名都已限定，但用户仍可以手打别的扩展名。那样写出去的
   * 是一段 PNG 字节流却叫 `.jpg`——正是本次要杜绝的「内容与扩展名不符」，
   * 后端也会拒绝并返回一句对用户没什么帮助的 `unsupported`。
   */
  if (!new RegExp(`\\.${extension}$`, 'i').test(target)) {
    notify.error(t('error.imageCopyExtensionMismatch', { extension }));
    return false;
  }

  const canvas = await renderTransform(payload.dataUrl, transform);
  if (!canvas) {
    notify.error(t('error.imageTooLargeToTransform'));
    return false;
  }

  try {
    // 不传 expected：这是一个新路径，没有可复核的基线。
    // 后端仍会用自己记录的基线复核（那个文件若正开着的话），
    // 因此用户若把目标又选回了那个冲突的原文件，这里会再次被拦住。
    await ipc.writeImageData(target, encodeCanvas(canvas, mime));
  } catch (err) {
    // 目标也冲突（用户把路径选回了那个被外部改动的文件）：如实说明，
    // 而不是含糊地说「保存失败」——用户需要知道该换一个路径。
    if (isConflict(err)) {
      notify.error(t('error.imageCopyAlsoModified'));
      return false;
    }
    logError('image', '另存图片副本失败', err);
    notify.error(t('error.saveImageFailed'));
    return false;
  }

  notify.success(t('image.savedAs', { name: target.split('/').pop() ?? suggestedName }));
  return true;
}

/** 从文件名取扩展名，取不到时按 MIME 兜底。 */
function extensionOf(payload: ImagePayload): string {
  const dot = payload.name.lastIndexOf('.');
  if (dot > 0) return payload.name.slice(dot + 1).toLowerCase();
  return payload.mime.replace('image/', '').replace('x-icon', 'ico').replace('jpeg', 'jpg');
}

/** 源文件所在目录（内部路径用正斜杠）。 */
function directoryOf(path: string): string | undefined {
  const slash = path.lastIndexOf('/');
  return slash > 0 ? path.slice(0, slash) : undefined;
}

/** 去掉扩展名的文件名，用于拼「副本」的名字。 */
function stemOf(name: string): string {
  return name.replace(/\.[^.]+$/, '') || name;
}

/**
 * 原格式无法写回时，另存一份 PNG 副本。
 *
 * ## 为什么不覆盖原文件
 *
 * 引擎编不出 GIF / BMP / ICO / AVIF，`toDataURL` 的结果必然是 PNG。
 * 若照写，`logo.ico` 里就装进一段 PNG 字节流——文件名没变、内容变了，
 * 别的程序按扩展名解码必然失败；而且 ICO 的多尺寸、GIF 的多帧会在
 * 重绘时一并丢失。因此这里**不动原文件**。
 *
 * 对话框是**告知去向**（「原文件不动，改为另存一份 PNG 副本」），
 * 而不是问「要不要毁掉格式」——后者不是一个用户能真正同意的选项。
 */
async function saveAsReencodedCopy(
  tab: Tab,
  payload: ImagePayload,
  transform: ImageTransform,
): Promise<boolean> {
  const btnOk = t('action.confirm');
  const btnCancel = t('action.cancel');

  const answer = await message(t('image.formatNotWritable'), {
    title: t('image.saveTitle'),
    kind: 'warning',
    buttons: { ok: btnOk, cancel: btnCancel },
  });
  if (answer !== btnOk) return false;

  return saveTransformedCopy(payload, transform, {
    mime: 'image/png',
    extension: 'png',
    suggestedName: `${stemOf(payload.name)}.png`,
    directory: tab.path ? directoryOf(tab.path) : undefined,
  });
}

/**
 * 外部修改冲突时的出路。
 *
 * 原文件被别的程序改过，因此不能覆盖；但用户刚做的旋转不能白做。
 * 保持原格式另存一份，是这里唯一两全的做法——
 * 与文本保存的冲突对话框里那个「另存为」是同一个思路
 * （见 `actions/save-file.ts` 的 `resolveConflict`）。
 */
async function saveConflictCopy(
  tab: Tab,
  payload: ImagePayload,
  transform: ImageTransform,
): Promise<boolean> {
  const extension = extensionOf(payload);
  const suggestedName = `${stemOf(payload.name)} (rotated).${extension}`;

  return saveTransformedCopy(payload, transform, {
    mime: payload.mime,
    extension,
    suggestedName,
    directory: tab.path ? directoryOf(tab.path) : undefined,
  });
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

  // 原格式写不回去：只有「另存为 PNG 副本」这一条路
  if (isFormatReplaced(payload.mime)) {
    return saveAsReencodedCopy(tab, payload, transform);
  }

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
    const canvas = await renderTransform(payload.dataUrl, transform);
    if (!canvas) {
      notify.error(t('error.imageTooLargeToTransform'));
      return false;
    }

    /*
     * 按**原格式**编码：PNG 存成 PNG，JPEG 存成 JPEG，不擅自换格式。
     *
     * 上面已按 `canWriteBackAs` 确认过引擎编得出这个格式，因此这里不会
     * 拿到一个悄悄变成 PNG 的结果。Rust 侧还会再校验一次子类型。
     */
    const dataUrl = encodeCanvas(canvas, payload.mime);

    /*
     * 记下写入前的编辑版本。
     *
     * 与文本保存同一套防护（见 `actions/save-file.ts` 的 `versionBefore`）：
     * 写入是一次 IPC 往返，用户完全可能在等待期间又按了一次旋转。
     * 早先这里无条件清变换、清脏标记，于是「等待期间那次旋转」被抹掉，
     * 标签却显示为已保存——用户以为改动都落盘了。
     */
    const version = editVersion(tab.id);

    const newBaseline = await ipc.writeImageData(tab.path, dataUrl, payload.baseline);

    /*
     * 写回后更新缓存与状态。
     *
     * 用新数据替换缓存里的 dataUrl，并把尺寸改成变换后的值——
     * 否则状态栏仍显示旋转前的宽高，与实际文件不符。
     * 同时清掉变换：像素已经落进文件，再叠加一次会重复旋转。
     *
     * `baseline` 换成后端回传的新指纹。若沿用读取时的旧值，
     * 下一次保存会把「自己刚写的内容」判成外部修改而弹冲突框。
     */
    setImageData(tab.id, {
      ...payload,
      dataUrl,
      baseline: newBaseline,
      size: Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75),
    });

    if (editVersion(tab.id) !== version) {
      /*
       * 写入期间用户又改了变换：缓存与基线照常更新（磁盘上确实是这张图），
       * 但**不能**清掉变换与脏标记——那会让用户刚做的那次旋转消失。
       * 保留脏标记，下一次保存会把新的变换叠上去。
       */
      notify.info(t('status.savedWithNewEdits'));
      return true;
    }

    clearTransform(tab.id);
    markDirty(tab.id, false);

    notify.success(t('image.savedRotated'));
    return true;
  } catch (err) {
    /*
     * 外部修改冲突：不能只报一句「保存失败」。
     *
     * 文本保存遇到这种情况会弹出「覆盖 / 重新加载 / 另存为」三选
     * （见 `actions/save-file.ts` 的 `resolveConflict`）。图片这边没有
     * 「重新加载」的等价物，但**用户的旋转不能白做**：这里直接引导
     * 另存一份副本，与本项目其它保存路径的处理方式一致。
     */
    if (isConflict(err)) {
      notify.warning(t('error.imageConflict'));
      return saveConflictCopy(tab, payload, transform);
    }

    logError('image', '保存旋转结果失败', err);
    notify.error(t('error.saveImageFailed'));
    return false;
  }
}
