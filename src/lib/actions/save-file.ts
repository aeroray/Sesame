/**
 * 保存文件的行为编排。
 */

import { save } from '@tauri-apps/plugin-dialog';
import { message } from '@tauri-apps/plugin-dialog';
import { notify } from '$lib/state/status.svelte';
import { fileFilters } from '$src/constants';
import * as ipc from '$lib/ipc/fs';
import { addRecent } from '$lib/state/recents.svelte';
import {
  editVersion,
  getView,
  hasTabContent,
  markDirty,
  peekTabContent,
  renameTab,
  replaceTabContent,
  setTruncated,
} from '$lib/state/tabs.svelte';
import { clearProgress, getProgress, initProgress } from '$lib/editor/large-file.svelte';
import { reportError } from '$lib/actions/open-file';
import { dropDraft } from '$lib/actions/draft';
import { t } from '$lib/i18n';
import type { Tab } from '$lib/state/types';

/**
 * 取得标签页的当前正文。
 *
 * 返回 `null` 表示「这个标签当前不可保存」，调用方必须放弃写入。
 *
 * 图片标签没有编辑器视图，`getView` 返回 undefined；
 * 若用 `?? ''` 兜底就会把一张图片当空文本写回——实测一次 Ctrl+S 把 PNG 截成 0 字节。
 */
function currentText(tab: Tab): string | null {
  // 图片是二进制，永远不由文本编辑器保存
  if (tab.kind !== 'text') return null;

  const handle = getView(tab.id);
  if (handle) return handle.getContent();

  // 视图不存在（休眠中或尚未挂载）时读保留的正文；
  // 从未加载过正文的标签返回 null 而不是空串。
  return hasTabContent(tab.id) ? peekTabContent(tab.id) : null;
}

/**
 * 大文件模式下需要告诉后端的已加载字节数。
 *
 * 返回 `undefined` 表示「内容即全文」，走普通保存路径。
 * 返回数字表示编辑器只持有前 N 字节，后端要把磁盘上的尾部追加回来。
 */
function prefixBytesFor(tab: Tab): number | undefined {
  const progress = getProgress(tab.id);
  if (!progress || progress.complete) return undefined;
  return progress.loadedBytes;
}

/**
 * 保存标签页。
 *
 * 未命名标签会先走「另存为」。
 */
export async function saveTab(tab: Tab): Promise<boolean> {
  return performSave(tab, { silent: false });
}

/**
 * 自动保存。
 *
 * 与手动保存的区别只在「不弹提示」和「跳过未命名标签」：
 * - 每次自动保存都弹一个 toast 会淹没用户，而且它不是用户主动发起的动作。
 * - 未命名标签没有路径，自动保存不能替用户决定存到哪，因此跳过；
 *   这类标签在关闭时仍会走确认流程。
 */
export async function autoSaveTab(tab: Tab): Promise<boolean> {
  if (!tab.path) return false;
  return performSave(tab, { silent: true });
}

/** 保存的共用实现。 */
async function performSave(tab: Tab, opts: { silent: boolean }): Promise<boolean> {
  // 图片标签：明确告知不支持，而不是静默失败
  if (tab.kind !== 'text') {
    if (!opts.silent) notify.error(t('error.notWritable'));
    return false;
  }

  const content = currentText(tab);
  if (content === null) {
    if (!opts.silent) notify.error(t('error.nothingToSave'));
    return false;
  }

  if (!tab.path) {
    // 自动保存不会替用户选路径
    if (opts.silent) return false;
    return saveTabAs(tab, content);
  }

  const saved = await writeToPath(tab, tab.path, content, {
    silent: opts.silent,
    force: false,
  });

  return saved;
}

/**
 * 写入指定路径，并处理外部修改冲突。
 *
 * 冲突时弹三选对话框（覆盖 / 重新加载 / 另存为），
 * 而不是简单报错——用户的修改不能因为一次冲突就无处可去。
 */
async function writeToPath(
  tab: Tab,
  target: string,
  content: string,
  opts: { silent: boolean; force: boolean },
): Promise<boolean> {
  try {
    // 记下写入前的编辑版本：写入期间若用户又敲了字，版本号会变，
    // 此时不能清除脏标记，否则那部分改动会被当成已保存而丢失。
    const versionBefore = editVersion(tab.id);

    const result = await ipc.saveFile(target, content, {
      encoding: tab.encoding,
      lineEnding: tab.lineEnding,
      hasBom: tab.hasBom,
      // 大文件只加载了一部分时，让后端把磁盘上的尾部拼回来
      prefixBytes: prefixBytesFor(tab),
      force: opts.force,
    });

    if (editVersion(tab.id) === versionBefore) {
      markDirty(tab.id, false);
      // 内容已落到用户的文件上，草稿没有存在意义了
      void dropDraft(tab.id);
      if (!opts.silent) notify.success(t('status.saved'));
    } else if (!opts.silent) {
      // 期间有新编辑，保持脏状态并说明情况，避免用户误以为全部落盘
      notify.info(t('status.savedWithNewEdits'));
    }

    /*
     * 保存后文件的字节布局变了，已加载量必须以**后端回传的值**为准。
     *
     * 这里不能用 `progress.loadedBytes` 原样传回去：那个值对应的是**旧文件**的
     * 前缀长度，而用户可能在前缀里增删过字符。若下次保存仍用旧偏移，
     * 尾部就会从错误位置开始复制，内容被重复——实测每保存一次文件就变长一截。
     * 后端按实际写出的 `head` 长度返回新偏移，这里照抄即可。
     */
    const progress = getProgress(tab.id);
    if (progress && !progress.complete) {
      initProgress(tab.id, result.size, result.prefixBytes ?? progress.loadedBytes);
    }

    return true;
  } catch (err) {
    if (isConflict(err)) {
      return resolveConflict(tab, target, content);
    }

    // 写不进去（只读、被占用、无权限）时给一条出路，而不是只报错就结束
    if (isWriteBlocked(err)) {
      return handleWriteBlocked(tab, content, err);
    }

    // 自动保存失败时也要报错：静默失败会让用户以为改动已经落盘
    reportError(err, t('error.saveFailed'));
    return false;
  }
}

/** 判断错误是否为「写不进去」类（权限/占用/只读）。 */
function isWriteBlocked(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
  return code === 'permission_denied' || code === 'io';
}

/**
 * 保存失败但内容还在手上时的出路。
 *
 * 只读文件、被其他进程占用、目录无写权限——这些都写不进去，
 * 但**用户的修改绝不能因此丢掉**。这里不弹「保存失败」就结束，
 * 而是给出可执行的下一步。
 */
async function handleWriteBlocked(tab: Tab, content: string, err: unknown): Promise<boolean> {
  const reason =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : t('error.writeBlocked');

  // 与 askUnsaved 同理：弹框与比对必须用同一时刻的文案
  const btnSaveAs = t('action.saveAs');
  const btnLater = t('dialog.saveLater');

  const answer = await message(t('dialog.saveFailedQuestion', { reason }), {
    title: t('dialog.saveFailedTitle'),
    kind: 'error',
    buttons: {
      ok: btnSaveAs,
      cancel: btnLater,
    },
  });

  if (answer === btnSaveAs) {
    // 内容仍在编辑器里，另存为不会丢
    return saveTabAs(tab, content);
  }

  // 用户选择稍后处理：保持脏状态，改动仍在，不会静默丢失
  notify.warning(t('status.unsavedStillInEditor'));
  return false;
}

/** 判断错误是否为外部修改冲突。 */
function isConflict(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'conflict'
  );
}

/**
 * 处理外部修改冲突。
 *
 * 三个出口，对应三种真实意图：
 * - **覆盖磁盘**：以我的内容为准（会丢掉别人的改动，因此措辞要明确）
 * - **加载磁盘**：放弃我的修改，用磁盘上的最新内容重新打开
 * - **另存为**：两边都保留，最安全，也是默认推荐
 */
async function resolveConflict(tab: Tab, target: string, content: string): Promise<boolean> {
  const name = target.split('/').pop() ?? tab.name;

  // 三个按钮文案先取到局部变量，弹框与比对共用（见 askUnsaved 的说明）
  const btnOverwrite = t('dialog.conflictOverwrite');
  const btnReload = t('dialog.conflictReload');
  const btnSaveAs = t('dialog.conflictSaveAs');

  const answer = await message(t('dialog.conflictMessage', { name }), {
    title: t('dialog.conflictTitle'),
    kind: 'warning',
    buttons: {
      yes: btnOverwrite,
      no: btnReload,
      cancel: btnSaveAs,
    },
  });

  // 与 close-tab 同理：自定义按钮文案时，返回值是按钮文字本身
  if (answer === btnOverwrite) {
    return writeToPath(tab, target, content, { silent: false, force: true });
  }

  if (answer === btnReload) {
    return reloadFromDisk(tab, target);
  }

  // 其余情况（含另存为与直接关掉对话框）都走另存为：
  // 内容不丢，也不会覆盖别人的改动。
  return saveTabAs(tab, content);
}

/** 放弃本地修改，重新从磁盘加载。 */
async function reloadFromDisk(tab: Tab, target: string): Promise<boolean> {
  try {
    const payload = await ipc.openFile(target);
    /*
     * 必须用 `replaceTabContent` 而不是 `setTabContent`：
     * 后者只更新「待用正文」，而那个 Map 只在创建视图时读一次。
     * 视图已经挂载时，只调它屏幕上不会有任何变化——用户以为没反应，
     * 随后一次 Ctrl+S 就会把旧内容写回磁盘，把刚加载的新内容覆盖掉。
     */
    replaceTabContent(tab.id, payload.content);
    renameTab(tab.id, payload.meta.path, payload.meta.name);
    markDirty(tab.id, false);
    void dropDraft(tab.id);
    notify.info(t('status.loadedFromDisk'));
    return true;
  } catch (err) {
    reportError(err, t('error.reloadFailed'));
    return false;
  }
}

/** 另存为。 */
export async function saveTabAs(tab: Tab, content?: string): Promise<boolean> {
  if (tab.kind !== 'text') {
    notify.error(t('error.notWritable'));
    return false;
  }

  // 同上：宁可拒绝，也不写出一个空文件
  const text = content ?? currentText(tab);
  if (text === null) {
    notify.error(t('error.nothingToSave'));
    return false;
  }

  try {
    const target = await save({
      defaultPath: tab.path ?? tab.name,
      filters: fileFilters(),
    });

    if (!target) return false;

    // 另存为到新路径时不能追加旧文件的尾部——那是另一个文件的内容。
    // 因此这里只写编辑器持有的部分，并明确告知用户大文件会被截断。
    const progress = getProgress(tab.id);
    const truncated = progress !== undefined && !progress.complete;

    const result = await ipc.saveFile(target, text, {
      encoding: tab.encoding,
      lineEnding: tab.lineEnding,
      hasBom: tab.hasBom,
    });

    // 后端会规范化路径，用返回值更新标签，保证路径与磁盘一致
    const name = result.path.split('/').pop() ?? tab.name;
    renameTab(tab.id, result.path, name);
    markDirty(tab.id, false);
    await addRecent(result.path);

    /*
     * 清掉大文件进度并复位「大文件模式」标记。
     *
     * 新文件里只有编辑器持有的那部分内容，它与旧文件的「已加载字节数」
     * 没有任何关系。若把旧进度留着，下次保存会拿旧偏移去追加新文件的尾部，
     * 从错误位置开始复制，内容被重复。
     *
     * 复位 `truncated` 是为了让状态栏不再显示「大文件模式」——
     * 新文件就是完整内容，留着徽标会与磁盘实际情况不符。
     */
    clearProgress(tab.id);
    setTruncated(tab.id, false);

    if (truncated) {
      notify.warning(t('status.savedAsPartial'));
    } else {
      notify.success(t('status.saved'));
    }
    return true;
  } catch (err) {
    reportError(err, t('error.saveAsFailed'));
    return false;
  }
}
