/**
 * 针对「当前文件」的通用操作：复制路径、在文件夹中显示。
 *
 * 这些是编辑器里高频的小动作——「这个文件在哪？」「我要把路径发给别人」。
 * 放在一处供菜单与快捷键共用。
 */

import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { activeTab } from '$lib/state/tabs.svelte';
import { notify } from '$lib/state/status.svelte';
import { t } from '$lib/i18n';
import type { Tab } from '$lib/state/types';

/**
 * 复制文本到剪贴板。
 *
 * 用浏览器内建的 `navigator.clipboard` 而不是 `tauri-plugin-clipboard-manager`：
 * 后者要多引一个插件、多一条权限声明，而这里只需要写一段文本。
 * 应用跑在 `tauri://localhost`（Windows 上是 `http://tauri.localhost`），
 * 属于安全上下文，该 API 可用。
 *
 * 仍需兜底：权限被拒或 API 不存在时（老 WebView）退回 `execCommand`。
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到下面的兜底
  }

  // 兜底：临时 textarea + execCommand。已被标记废弃，但兼容性最广。
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
 * 复制文件路径到剪贴板。
 *
 * 未命名标签没有路径，明确提示而不是静默失败——
 * 静默失败会让用户以为复制成功了，粘贴时才发现是空的。
 */
export async function copyPath(tab: Tab | null = activeTab()): Promise<void> {
  if (!tab?.path) {
    notify.info(t('status.noPathToCopy'));
    return;
  }

  const ok = await writeClipboard(tab.path);
  if (ok) {
    notify.success(t('status.pathCopied'));
  } else {
    notify.error(t('error.copyFailed'));
  }
}

/**
 * 在系统文件管理器中定位该文件。
 *
 * 用 `revealItemInDir` 而不是「打开所在目录」：前者会选中文件本身，
 * 后者只打开目录、用户还得自己找——文件多的时候很费事。
 */
export async function revealInFolder(tab: Tab | null = activeTab()): Promise<void> {
  if (!tab?.path) {
    notify.info(t('status.noPathToReveal'));
    return;
  }

  try {
    await revealItemInDir(tab.path);
  } catch (err) {
    notify.error(t('error.revealFailed'));
    console.error('[file-actions] 在文件夹中显示失败', err);
  }
}
