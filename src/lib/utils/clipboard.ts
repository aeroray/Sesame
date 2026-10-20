/**
 * 剪贴板操作。
 *
 * ## 为什么走 Rust 插件而不是 `navigator.clipboard`
 *
 * 浏览器的剪贴板权限是**为网页设计的**：网页不可信，读剪贴板要用户授权，
 * 而且 `readText()` 在权限被拒时直接抛错。
 *
 * 桌面应用没有这个前提——用户自己装的软件，读剪贴板就是读自己的剪贴板。
 * 用 Web API 会让「粘贴」变成可能弹权限框的操作，而它是编辑器里
 * 最基本的动作之一。因此读写都交给 `tauri-plugin-clipboard-manager`，
 * 由 Rust 直接访问系统剪贴板，**不经过任何权限询问**。
 *
 * 插件的 `default` 权限集是空的，`capabilities/default.json` 里只开了
 * `allow-read-text`、`allow-write-text` 与 `allow-write-image`
 * ——正好是本文件用到的三项。
 *
 * ## 剪切/复制为什么仍用 `execCommand`
 *
 * 这两个操作不是「写剪贴板」那么简单：它们还要**作用于编辑器选区**
 * （复制取选区内容，剪切取完还要删掉选区）。CodeMirror 不导出剪贴板命令，
 * 而 `document.execCommand('copy' | 'cut')` 正好作用于当前 DOM 选区，
 * CodeMirror 会把自身选区同步上去，因此对它有效。
 *
 * 写剪贴板的兜底路径也保留 `execCommand`：插件调用失败（例如权限没开对）
 * 时还能兜住，不至于让复制功能整个失效。
 */

import { Image } from '@tauri-apps/api/image';
import { readText, writeImage, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { ImageDecodeError } from '$lib/utils/image-transform';

/**
 * 读剪贴板文本。
 *
 * 读不到时返回 `null`（剪贴板为空、内容不是文本、或插件调用失败）。
 */
export async function readClipboardText(): Promise<string | null> {
  try {
    const text = await readText();
    // 插件在剪贴板为空时返回空串；调用方据此区分「空」与「失败」
    return text;
  } catch {
    return null;
  }
}

/**
 * 写剪贴板。
 *
 * 优先用 Rust 插件；失败再退回 `execCommand`——
 * 后者虽已废弃，但没有依赖、且在本应用的场景下可靠。
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await writeText(text);
    return true;
  } catch {
    // 落到下面的兜底
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    // 放在视口外，避免闪烁
    area.style.position = 'fixed';
    area.style.top = '-9999px';
    area.setAttribute('readonly', '');
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 复制当前选区（作用于 DOM 选区，因此需先让编辑器获得焦点）。
 *
 * 返回是否成功。没有选区时 `execCommand` 返回 `false`。
 */
export function copySelection(): boolean {
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

/** 剪切当前选区。剪切后选区内容由浏览器自己删除，不需要我们改文档。 */
export function cutSelection(): boolean {
  try {
    return document.execCommand('cut');
  } catch {
    return false;
  }
}

/**
 * 把图片放进剪贴板。
 *
 * ## 为什么要绕一圈 canvas
 *
 * 插件的 `writeImage` 接受三种入参，但本项目能用的只有一种：
 *
 * - **文件路径** —— 需要 tauri 的 `image-png` / `image-ico` feature 才能解码，
 *   本项目没启用（`tauri = { features = [] }`），传路径会直接失败。
 * - **PNG 字节** —— 同样依赖上面那两个 feature。
 * - **RGBA 像素** —— 不需要任何 feature，走 `plugin:image|new` 把数据
 *   登记进资源表，再由剪贴板按 RGBA 写入。**这是唯一可行的路径。**
 *
 * 而我们手上只有 `dataUrl`（后端读图后给的 base64 data URL）。
 * 因此先画到 canvas 取 `getImageData` 拿到 RGBA——
 * `getImageData` 返回的是**直通 alpha**（非预乘），正是剪贴板要的格式。
 *
 * ## 为什么要显式给宽高
 *
 * `Image.new` 必须知道尺寸，而 canvas 的尺寸取自图片自身的
 * `naturalWidth/Height`，不是显示尺寸——缩放不影响复制结果，
 * 复制出去的始终是原图。
 */
export async function writeClipboardImage(dataUrl: string): Promise<boolean> {
  try {
    const bitmap = await loadImageElement(dataUrl);

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.naturalWidth;
    canvas.height = bitmap.naturalHeight;
    if (canvas.width === 0 || canvas.height === 0) return false;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(bitmap, 0, 0);

    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    /*
     * `getImageData().data` 是 `Uint8ClampedArray`，而 `Image.new` 收
     * `Uint8Array`。两者底层都是字节缓冲，用同一个 buffer 包一层即可，
     * 不必复制（大图复制一次就是几十 MB 的额外开销）。
     */
    const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    // 交给 Rust 的资源表，再写剪贴板；用完必须 free，否则资源表会泄漏
    const image = await Image.new(rgba, width, height);
    try {
      await writeImage(image);
      return true;
    } finally {
      await image.close();
    }
  } catch {
    return false;
  }
}

/** 把 data URL 解码成可绘制的图片元素。 */
function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    /*
     * 用 `createElement('img')` 而不是 `new Image()`：
     * 本文件顶部从 `@tauri-apps/api/image` 引入了同名的 `Image`（Tauri 的
     * 资源句柄类），`new Image()` 会解析成那个，拿不到 DOM 图片元素。
     */
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageDecodeError());
    img.src = dataUrl;
  });
}
