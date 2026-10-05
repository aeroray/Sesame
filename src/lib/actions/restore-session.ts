/**
 * 会话恢复的行为编排。
 *
 * 放在 actions 层而不是 state 层：恢复需要调用 openPath，
 * 若写进 session.svelte.ts 就会形成 actions ↔ state 的循环依赖。
 */

import { openPath } from '$lib/actions/open-file';
import { loadSnapshot } from '$lib/state/session.svelte';
import { activateTab, findByPath, setRestoreTarget, tabs } from '$lib/state/tabs.svelte';

/**
 * 启动时恢复上次会话。
 *
 * 逐个打开文件并还原光标与滚动位置。找不到的文件会被跳过——
 * 用户可能在两次启动之间删掉或移动了它。
 *
 * 返回实际恢复的标签数。
 */
export async function restoreSession(): Promise<number> {
  const saved = await loadSnapshot();
  if (saved.tabs.length === 0) return 0;

  let restored = 0;

  /*
   * 逆序恢复。
   *
   * 新标签一律 `unshift` 到数组最前（与主流编辑器一致），
   * 因此按原顺序逐个打开会把标签栏整个颠倒过来。
   * 从后往前打开，最终顺序才与保存时一致。
   */
  for (const entry of [...saved.tabs].reverse()) {
    // 已打开（例如通过命令行传入）的跳过，避免重复标签
    if (findByPath(entry.path)) continue;

    const before = tabs.items.length;
    await openPath(entry.path);

    // openPath 内部吞掉了失败（只弹提示），用标签数变化判断是否真的打开了
    if (tabs.items.length === before) continue;

    const tab = findByPath(entry.path);
    if (tab) {
      // 登记待恢复位置而不是直接改 tab 字段：
      // 视图可能已经挂载并读过了旧值，直接赋值对视图无效。
      setRestoreTarget(tab.id, {
        line: entry.line,
        column: entry.column,
        scrollTop: entry.scrollTop,
      });
      restored += 1;
    }
  }

  // 恢复上次的激活标签
  if (saved.activePath) {
    const target = findByPath(saved.activePath);
    if (target) activateTab(target.id);
  }

  return restored;
}
