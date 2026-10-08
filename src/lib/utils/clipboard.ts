/**
 * 剪贴板操作。
 *
 * ## 为什么需要自己实现
 *
 * 自定义右键菜单取代了 WebView 的原生菜单，而**剪切/复制/粘贴原本只有
 * 原生菜单提供**（CodeMirror 不导出这三个命令，它们靠浏览器对
 * `contenteditable` 的内置处理）。挡住原生菜单就必须自己补上，
 * 否则编辑器右键后会少掉最基本的三项。
 *
 * ## 三者的实现方式不同
 *
 * - **复制 / 剪切**：用 `document.execCommand`。它作用于**当前 DOM 选区**，
 *   而 CodeMirror 会把自身的选区同步到 DOM 选区上，因此对编辑器有效。
 *   这个 API 已被标记废弃，但没有替代品能在不申请权限的前提下写剪贴板；
 *   编辑器场景下它仍然可靠。
 * - **粘贴**：`execCommand('paste')` 出于安全**被浏览器一律拒绝**，
 *   只能读剪贴板内容后自己插入。读剪贴板需要权限，
 *   用户拒绝时返回 `false`，由调用方提示改用 Ctrl+V。
 */

/** 读剪贴板文本。不可用或无权限时返回 `null`。 */
export async function readClipboardText(): Promise<string | null> {
  try {
    if (!navigator.clipboard?.readText) return null;
    return await navigator.clipboard.readText();
  } catch {
    // 权限被拒、非安全上下文、或用户取消
    return null;
  }
}

/**
 * 写剪贴板。
 *
 * 先用异步 API，失败再退回 `execCommand`：前者更干净，
 * 但在权限被拒或老 WebView 上会失败，那时后者还能兜住。
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
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
 * 返回是否成功。没有选区时 `execCommand` 会返回 `false`。
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
