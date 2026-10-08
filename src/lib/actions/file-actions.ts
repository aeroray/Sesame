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
import { writeClipboardText } from '$lib/utils/clipboard';
import { logError } from '$lib/utils/log';
import { IS_WINDOWS } from '$lib/utils/platform';

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

  const ok = await writeClipboardText(toDisplayPath(tab.path));
  if (ok) {
    notify.success(t('status.pathCopied'));
  } else {
    notify.error(t('error.copyFailed'));
  }
}

/**
 * 在系统文件管理器中定位某个路径。
 *
 * 用 `revealItemInDir` 而不是「打开所在目录」：前者会选中文件本身，
 * 后者只打开目录、用户还得自己找——文件多的时候很费事。
 *
 * 同样传原生分隔符：这个路径会交给 Windows Shell，
 * 正斜杠虽然多数情况能被容忍，但没有理由冒险。
 *
 * 直接收路径而不是 `Tab`：最近文件列表里的条目**还不是标签**，
 * 拿不到 `Tab` 对象（见 `WelcomePage` / `Sidebar` 的调用）。
 */
export async function revealPath(path: string): Promise<void> {
  if (!path) {
    notify.info(t('status.noPathToReveal'));
    return;
  }

  try {
    await revealItemInDir(toDisplayPath(path));
  } catch (err) {
    notify.error(t('error.revealFailed'));
    logError('file-actions', '在文件夹中显示失败', err);
  }
}

/** 在系统文件管理器中定位该文件。 */
export async function revealInFolder(tab: Tab | null = activeTab()): Promise<void> {
  if (!tab?.path) {
    notify.info(t('status.noPathToReveal'));
    return;
  }
  await revealPath(tab.path);
}
