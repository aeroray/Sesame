/**
 * 以指定编码重新打开当前文件。
 *
 * 用于纠正编码误判：探测不可能全对，实测 Big5 / Shift_JIS /
 * 无 BOM 的 UTF-16LE 都会被判成 GBK 而显示乱码。
 *
 * ## 与 reloadFromDisk 的区别
 *
 * `reloadFromDisk`（冲突处理里用的那个）按**原编码**重读，用于「放弃本地修改」；
 * 这里按**用户指定**的编码重读，用于「换个编码看看」。
 * 两者都从磁盘重读，但目的不同，因此分开。
 *
 * ## 为什么不能用 openPath
 *
 * `openPath` 会先按路径去重——文件已经打开着，它会直接激活已有标签并返回，
 * 编码根本不会变。因此这里必须绕过去重，直接走 IPC 再原地替换标签内容。
 */

import { dropDraft } from '$lib/actions/draft';
import { reportError } from '$lib/actions/open-file';
import { clearProgress, initProgress } from '$lib/editor/large-file.svelte';
import { t } from '$lib/i18n';
import * as ipc from '$lib/ipc/fs';
import { markDirty, renameTab, replaceTabContent, setTruncated } from '$lib/state/tabs.svelte';
import type { Tab } from '$lib/state/types';

/**
 * 用指定编码重新读取该标签对应的文件。
 *
 * 返回是否成功。失败时标签保持原样，不会变成空内容。
 */
export async function reopenWithEncoding(tab: Tab, encoding: string): Promise<boolean> {
  if (!tab.path) return false;

  try {
    const payload = await ipc.openFile(tab.path, encoding);

    /*
     * 按**后端确认的**编码更新标签，而不是用户传进来的那个字符串。
     *
     * 后端会把它规范成自己认识的标签（例如 `utf8` → `utf-8`）。
     * 若直接存用户输入，保存时 `encoding_for` 可能认不出而退回 UTF-8，
     * 把文件按错误编码写回去。
     */
    replaceTabContent(tab.id, payload.content);
    renameTab(tab.id, payload.meta.path, payload.meta.name);

    // 编码、BOM、换行风格都可能随重新解码而变，全部以后端返回为准
    tab.encoding = payload.encoding;
    tab.hasBom = payload.hasBom;
    tab.lineEnding = payload.lineEnding as Tab['lineEnding'];
    tab.language = payload.language as Tab['language'];

    // 内容来自磁盘，不是未保存的修改
    markDirty(tab.id, false);
    void dropDraft(tab.id);

    /*
     * 大文件的进度与截断标记要一起处理。
     *
     * 重新打开后已加载量归零；若仍标着「大文件模式」而进度表被清掉，
     * 提示条会因为拿不到进度而消失，状态栏却仍显示徽标——两处矛盾。
     * 这里统一按后端返回的 `truncated` 重置。
     */
    clearProgress(tab.id);
    setTruncated(tab.id, payload.truncated);
    if (payload.truncated) {
      // 后端返回的编码与换行已探明，重新登记进度供分块加载使用
      initProgress(tab.id, payload.meta.size, 0);
    }

    return true;
  } catch (err) {
    reportError(err, t('error.encodingFailed'));
    return false;
  }
}
