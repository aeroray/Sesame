/**
 * 启动时的恢复流程：先还原草稿，再还原会话。
 *
 * 顺序很关键——草稿是「未保存的正文」，比会话里的路径更重要。
 * 而且草稿还原的是标签本身（含正文），会话还原的是文件路径，
 * 两者不重叠：有草稿的标签不会再从会话里恢复一次。
 */

import { dropDraft, loadDrafts } from '$lib/actions/draft';
import { restoreSession } from '$lib/actions/restore-session';
import { settings } from '$lib/state/settings.svelte';
import { activateTab, createTabFromDraft, findByPath, tabs } from '$lib/state/tabs.svelte';

/** 恢复结果，供界面提示。 */
export interface RestoreReport {
  /** 从草稿还原的标签数（这些是未保存的内容）。 */
  drafts: number;
  /** 从会话还原的文件数。 */
  files: number;
}

/**
 * 执行启动恢复。
 *
 * 草稿优先：它们是用户可能以为已经丢失的内容，必须最先回到界面上。
 */
export async function restoreAll(): Promise<RestoreReport> {
  let drafts = 0;
  let files = 0;

  if (settings.restoreSession) {
    drafts = await restoreDrafts();
    files = await restoreSession();
  }

  return { drafts, files };
}

/**
 * 还原草稿。
 *
 * **所有草稿都还原成标签**，不论它有没有路径。
 *
 * 早先的写法是「有路径且文件仍在的草稿交给会话流程处理」，
 * 以为那样能读到更新的磁盘内容——其实是个 bug：
 * 会话只按路径重新打开文件，**草稿里那些未保存的改动会被直接丢掉**。
 * 而草稿存在的前提就是「有未保存的改动」，所以这样做等于把热退出废掉了。
 *
 * 正确做法是还原草稿的内容并保持脏标记，让用户看到「改动还在，去保存吧」。
 * 会话流程随后会跳过已经打开的路径（`findByPath` 判断），不会产生重复标签。
 *
 * **不弹窗询问。** 内容已经安全躺在草稿里，恢复它不具破坏性；
 * 而用户若确实想丢弃，关掉那个标签即可，代价远低于每次启动都被一个
 * 模态框拦一下。把选择权留在界面上，而不是拦在启动路径上。
 */
async function restoreDrafts(): Promise<number> {
  const drafts = await loadDrafts();
  if (drafts.length === 0) return 0;

  let restored = 0;

  for (const draft of drafts) {
    // 已经有同路径标签（例如命令行传入）时跳过，避免重复
    if (draft.path && findByPath(draft.path)) {
      await dropDraft(draft.id);
      continue;
    }

    createTabFromDraft({
      id: draft.id,
      path: draft.path,
      name: draft.name,
      content: draft.content,
      language: draft.language,
      encoding: draft.encoding,
      lineEnding: draft.lineEnding,
      hasBom: draft.hasBom,
    });
    restored += 1;
  }

  // 恢复出来的草稿标签保持激活，让用户一眼看到内容还在
  const active = tabs.items.find((t) => t.dirty);
  if (active) activateTab(active.id);

  return restored;
}
