/**
 * 关闭标签页的行为编排，含未保存确认。
 *
 * 用确认对话框而不是直接丢弃，是编辑器最基本的信任前提。
 *
 * 这里用 `message()` 配 YesNoCancel 三个按钮，而不是 `ask()` 的两个按钮：
 * 「保存 / 不保存」缺了「取消」这一项，用户在关到一半反悔时无法中止，
 * 只能被迫二选一。
 */

import { message } from '@tauri-apps/plugin-dialog';
import { closeTab, closeOtherTabs, closeAllTabs, tabs } from '$lib/state/tabs.svelte';
import { saveTab } from '$lib/actions/save-file';
import { cancelAutoSave } from '$lib/actions/autosave';
import { dropDraft } from '$lib/actions/draft';
import { t } from '$lib/i18n';
import type { Tab } from '$lib/state/types';

/** 用户对「未保存的修改」的选择。 */
type Choice = 'save' | 'discard' | 'cancel';

/**
 * 弹出三选一确认框。
 *
 * ## 为什么不能判断 `'Yes'` / `'No'`
 *
 * 用了**自定义按钮文案**时，各平台返回的是按钮的**文字本身**而不是
 * `Yes` / `No` / `Cancel`：
 *
 * - Windows（rfd `win_cid`）：`MessageDialogResult::Custom(yes_text)` 等，
 *   即返回 `"保存"` / `"不保存"` / `"取消"`。
 * - macOS 同样是 `Custom(文案)`；Linux 的 zenity 分支也是 `Custom(文案)`。
 *
 * 早先这里判断 `answer === 'No'`，在 Windows 上永远不成立，
 * 于是「不保存」被当成「取消」——用户点了没有任何反应（实测确认）。
 * 正确做法是拿返回值与按钮文案本身比对。
 *
 * ## 多语言带来的新坑
 *
 * 按钮文案现在取自字典，因此**弹框与比对必须用同一时刻的同一份文案**。
 * 若弹框前取一次、比对时再取一次，而用户在这期间切了语言，
 * 比对就会失败，「不保存」又会被当成「取消」。
 * 这里把三个文案先取进局部变量，两处共用，从根上避免。
 */
async function askUnsaved(name: string): Promise<Choice> {
  const btnSave = t('action.save');
  const btnDiscard = t('action.discard');
  const btnCancel = t('action.cancel');

  const answer = await message(t('dialog.unsavedMessage', { name }), {
    title: t('dialog.unsavedTitle'),
    kind: 'warning',
    buttons: {
      yes: btnSave,
      no: btnDiscard,
      cancel: btnCancel,
    },
  });

  // 自定义文案平台：返回值就是按钮文字
  if (answer === btnSave) return 'save';
  if (answer === btnDiscard) return 'discard';
  if (answer === btnCancel) return 'cancel';

  // 兜底：万一某平台返回标准结果名（未用自定义文案时才会出现）
  if (answer === 'Yes') return 'save';
  if (answer === 'No') return 'discard';

  // 其余情况（含直接关掉对话框）一律按「取消」处理，绝不擅自丢弃内容
  return 'cancel';
}

/**
 * 关闭单个标签页。
 *
 * 返回是否真的关闭了（取消或保存失败时为 `false`）。
 */
export async function requestCloseTab(tab: Tab): Promise<boolean> {
  if (!tab.dirty) {
    cancelAutoSave(tab.id);
    void dropDraft(tab.id);
    closeTab(tab.id);
    return true;
  }

  const choice = await askUnsaved(tab.name);

  if (choice === 'cancel') return false;

  if (choice === 'save') {
    const ok = await saveTab(tab);
    // 保存失败（含用户取消另存为）时中止关闭，避免丢内容
    if (!ok) return false;
  } else {
    // 用户明确选择不保存：连同草稿一起丢弃，否则下次启动会又冒出来
    await dropDraft(tab.id);
  }

  cancelAutoSave(tab.id);
  closeTab(tab.id);
  return true;
}

/**
 * 关闭其它标签页。
 *
 * 逐个处理未保存项；任一步取消则整体中止，不关闭任何标签。
 */
export async function requestCloseOthers(tab: Tab): Promise<void> {
  const others = tabs.items.filter((t) => t.id !== tab.id && t.dirty);

  for (const other of others) {
    const choice = await askUnsaved(other.name);
    if (choice === 'cancel') return;

    if (choice === 'save') {
      const ok = await saveTab(other);
      if (!ok) return;
    } else {
      // 用户明确选择不保存：连同草稿一起丢弃。
      // 漏掉这一步的话，下次启动会把这些内容又恢复出来——
      // 用户明明选了「不保存」，却看到内容复活（与 requestCloseTab 保持一致）。
      await dropDraft(other.id);
    }
  }

  for (const other of tabs.items) {
    if (other.id !== tab.id) cancelAutoSave(other.id);
  }
  closeOtherTabs(tab.id);
}

/**
 * 关闭全部标签页。
 *
 * 任一步取消则整体中止。返回是否全部关闭成功——
 * 关闭窗口的流程依赖这个结果来决定要不要继续退出。
 */
export async function requestCloseAll(): Promise<boolean> {
  const dirty = tabs.items.filter((t) => t.dirty);

  for (const tab of dirty) {
    const choice = await askUnsaved(tab.name);
    if (choice === 'cancel') return false;

    if (choice === 'save') {
      const ok = await saveTab(tab);
      if (!ok) return false;
    } else {
      // 同 requestCloseOthers：明确放弃的内容必须把草稿一起删掉
      await dropDraft(tab.id);
    }
  }

  for (const tab of tabs.items) cancelAutoSave(tab.id);
  closeAllTabs();
  return true;
}

/** 关闭当前激活标签页。 */
export async function requestCloseActive(): Promise<void> {
  const id = tabs.activeId;
  if (!id) return;
  const tab = tabs.items.find((t) => t.id === id);
  if (tab) await requestCloseTab(tab);
}
