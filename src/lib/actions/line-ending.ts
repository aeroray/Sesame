/**
 * 转换换行风格（LF / CRLF / CR）。
 *
 * ## 为什么只是改一个字段
 *
 * 文件读进来时，后端就已经用 `normalize_newlines` 把全部换行统一成 `\n`
 * （见 `commands/fs.rs`），编辑器内部**只处理 `\n`**。
 * 保存时再按 `tab.lineEnding` 用 `apply_line_ending` 还原成目标风格。
 *
 * 因此「转换换行风格」不需要动正文一个字符，只改这个字段并标记为脏，
 * 下次保存自然就写成新风格。这也意味着**转换是延迟生效的**——
 * 用户在状态栏切换后，文件要到保存时才真正变化。
 *
 * ## 为什么不立即写盘
 *
 * 立刻重写文件会绕开未保存修改的处理：若标签是脏的，
 * 直接写盘就把用户的改动覆盖掉了。改字段则与正常编辑走同一条
 * 保存路径（含原子写入、冲突检测、草稿）。
 *
 * ## 大文件
 *
 * 分块模式下编辑器只持有前缀，尾段仍在磁盘上。保存时后端会把
 * 「前缀」与「未加载的尾部」拼起来再统一换行（`commands/fs.rs`），
 * 所以这里同样只需要改字段。
 */

import { t } from '$lib/i18n';
import { notify } from '$lib/state/status.svelte';
import { markDirty } from '$lib/state/tabs.svelte';
import type { LineEnding, Tab } from '$lib/state/types';

/** 可选风格，顺序即菜单顺序。 */
export const LINE_ENDINGS: LineEnding[] = ['lf', 'crlf', 'cr'];

/** 展示名。与状态栏显示的一致，不翻译（LF / CRLF / CR 是通用写法）。 */
export function lineEndingLabel(ending: LineEnding): string {
  return ending === 'crlf' ? 'CRLF' : ending === 'cr' ? 'CR' : 'LF';
}

/**
 * 切换某个标签的换行风格。
 *
 * 返回是否真的改变了。相同风格时什么都不做——
 * 否则会把一个未修改的标签平白标成脏。
 */
export function setLineEnding(tab: Tab, ending: LineEnding): boolean {
  // 二进制文件不能保存，改换行没有意义
  if (tab.encoding === 'binary') return false;

  if (tab.lineEnding === ending) return false;

  tab.lineEnding = ending;

  /*
   * 标脏：改动只在保存时落盘，不标脏的话关闭标签不会提示，
   * 用户以为换行已经改了，实际文件还是老的。
   */
  markDirty(tab.id, true);

  notify.success(t('lineEnding.changed', { style: lineEndingLabel(ending) }));
  return true;
}
