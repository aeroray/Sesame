/**
 * Markdown 预览的开关编排。
 *
 * 关键点：必须在切换标志**之前**把正文取出来。
 * 打开预览会立刻卸载编辑器视图，视图一销毁内容就没了，
 * 若等到渲染时再取，预览显示的会是上一版内容。
 */

import { isPreviewing, togglePreview } from '$lib/state/layout.svelte';
import { getView, peekTabContent } from '$lib/state/tabs.svelte';
import type { Tab } from '$lib/state/types';

/** 切换某个标签页的 Markdown 预览。 */
export function requestTogglePreview(tab: Tab): void {
  if (tab.language !== 'markdown') return;

  // 关闭预览时不需要内容；打开时才抓取
  const turningOn = !isPreviewing(tab.id);
  const content = turningOn ? (getView(tab.id)?.getContent() ?? peekTabContent(tab.id)) : '';

  togglePreview(tab.id, content);
}
