/**
 * 新建标签页。
 */

import { createBlankTab } from '$lib/state/tabs.svelte';

/**
 * 新建一个空白标签页。
 *
 * 编码固定 UTF-8：这是新文件的唯一合理默认值。
 * 打开已有文件时才按文件自身的编码走（见 openPath）。
 */
export function newTab(): void {
  createBlankTab();
}
