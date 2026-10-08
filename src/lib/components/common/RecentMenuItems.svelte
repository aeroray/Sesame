<script lang="ts">
/**
 * 最近文件条目的右键菜单内容。
 *
 * ## 为什么抽成组件
 *
 * 侧栏与首屏的「最近打开」是两个不同的列表，但**针对一条记录能做的事
 * 完全一样**：打开、复制路径、在文件夹中显示、从列表移除。
 * 各写一份必然漂移（图标、禁用条件、文案都会慢慢分叉）。
 *
 * 这里只渲染**菜单项**，不渲染触发器：
 * 两处的行结构不同（首屏有位置列、侧栏没有），
 * 强行统一整个行反而要加一堆条件。让调用方各自包一层
 * `ContextMenuRoot` / `Trigger`，这个组件负责里面的内容。
 */
import { Copy, ExternalLink, FolderOpen, Trash2 } from '@lucide/svelte';
import { copyPathValue, revealPath } from '$lib/actions/file-actions';
import { openPath } from '$lib/actions/open-file';
import {
  Item as ContextMenuItem,
  Separator as ContextMenuSeparator,
} from '$lib/components/ui/context-menu';
import { t } from '$lib/i18n';
import { removeRecent } from '$lib/state/recents.svelte';
import type { RecentEntry } from '$lib/state/types';
import { formatKeys } from '$lib/utils/hotkeys';

interface Props {
  entry: RecentEntry;
}

let { entry }: Props = $props();
</script>

<!--
  打开：右键菜单里也提供「打开」是刻意的——
  用户右键之后往往就是想打开，让他再移回左键点一下是多余的一步。
-->
<ContextMenuItem class="gap-2" onSelect={() => void openPath(entry.path)}>
  <ExternalLink class="size-3.5 shrink-0" />
  <span class="truncate">{t('welcome.open')}</span>
</ContextMenuItem>

<ContextMenuSeparator />

<ContextMenuItem class="gap-2" onSelect={() => void copyPathValue(entry.path)}>
  <Copy class="size-3.5 shrink-0" />
  <span class="truncate">{t('action.copyPath')}</span>
  <span class="ml-auto shrink-0 text-[10px] text-content-faint">
    {formatKeys('Ctrl+Shift+C')}
  </span>
</ContextMenuItem>

<ContextMenuItem class="gap-2" onSelect={() => void revealPath(entry.path)}>
  <FolderOpen class="size-3.5 shrink-0" />
  <span class="truncate">{t('action.revealInFolder')}</span>
</ContextMenuItem>

<ContextMenuSeparator />

<!-- 移除：破坏性但可恢复（重新打开文件就会回来），因此不放红色 -->
<ContextMenuItem class="gap-2" onSelect={() => void removeRecent(entry.path)}>
  <Trash2 class="size-3.5 shrink-0" />
  <span class="truncate">{t('welcome.removeFromList')}</span>
</ContextMenuItem>
