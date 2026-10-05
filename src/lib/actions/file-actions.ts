/**
 * 针对「当前文件」的通用操作：复制路径、在文件夹中显示。
 *
 * 这些是编辑器里高频的小动作——「这个文件在哪？」「我要把路径发给别人」。
 * 放在一处供菜单与快捷键共用。
 */

import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { t } from '$lib/i18n';
import { notify } from '$lib/state/status.svelte';
import { activeTab } from '$lib/state/tabs.svelte';
import type { Tab } from '$lib/state/types';
import { logError } from '$lib/utils/log';
import { IS_WINDOWS } from '$lib/utils/platform';

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
 * 把内部路径转成适合展示给用户的平台原生路径。
 *
 * ## 为什么需要转换
 *
 * Rust 侧统一用 `to_slash()` 把路径转成正斜杠（`C:/Users/...`），
 * 这是**内部约定**：跨平台比较与去重都靠它，一致且简单。
 *
 * 但它不适合直接交给用户。实测按 Ctrl+Shift+C 复制出来的是
 * `C:/Users/PC/AppData/Local/Temp/x.txt`——虽然 PowerShell 能识别，
 * 但 cmd.exe 的 `cd`、不少构建脚本、以及「运行」对话框都不认。
 * 用户看到正斜杠也会觉得「这不是 Windows 路径」。
 *
 * 因此**在 UI 边界换回原生分隔符**：Windows 用 `\`，macOS 本来就是 `/`。
 * 内部继续用正斜杠，两者各司其职。
 */
function toDisplayPath(path: string): string {
  return IS_WINDOWS ? path.replace(/\//g, '\\') : path;
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

  const ok = await writeClipboard(toDisplayPath(tab.path));
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
 *
 * 同样传原生分隔符：这个路径会交给 Windows Shell，
 * 正斜杠虽然多数情况能被容忍，但没有理由冒险。
 */
export async function revealInFolder(tab: Tab | null = activeTab()): Promise<void> {
  if (!tab?.path) {
    notify.info(t('status.noPathToReveal'));
    return;
  }

  try {
    await revealItemInDir(toDisplayPath(tab.path));
  } catch (err) {
    notify.error(t('error.revealFailed'));
    logError('file-actions', '在文件夹中显示失败', err);
  }
}
