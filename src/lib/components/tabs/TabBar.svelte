<script lang="ts">
/**
 * 标签栏。横向滚动，标签较多时不挤压；支持拖拽排序。
 *
 * ## 空白处的右键菜单
 *
 * 标签**之间**的空白区域右键给出「最近关闭」列表。这与标签自身的右键
 * 菜单分工不同：标签上是「这个文件能做什么」，空白处是「标签栏整体
 * 能做什么」（新建、找回关掉的）。
 *
 * 主流编辑器都有这一层（VS Code 的 `EditorTabsBarContext`、
 * JetBrains 的 `Window | Editor Tabs`），而在此之前本项目
 * 「重开已关闭标签」只有 Ctrl+Shift+T 与应用菜单两个入口——
 * 用户想找回刚关掉的标签时视线在标签栏，却要跑去左上角翻菜单。
 */
import { ChevronRight, Plus, Undo2 } from '@lucide/svelte';
import { requestCloseTab } from '$lib/actions/close-tab';
import { newTab } from '$lib/actions/new-tab';
import { reopenClosedAt, reopenClosedTab } from '$lib/actions/reopen-tab';
import Hint from '$lib/components/common/Hint.svelte';
import {
  Content as ContextMenuContent,
  Item as ContextMenuItem,
  Root as ContextMenuRoot,
  Separator as ContextMenuSeparator,
  Sub as ContextMenuSub,
  SubContent as ContextMenuSubContent,
  SubTrigger as ContextMenuSubTrigger,
  Trigger as ContextMenuTrigger,
} from '$lib/components/ui/context-menu';
import { t } from '$lib/i18n';
import { recentClosed } from '$lib/state/closed-tabs.svelte';
import { activateTab, moveTab, tabs } from '$lib/state/tabs.svelte';
import { formatKeys } from '$lib/utils/hotkeys';
import TabItem from './TabItem.svelte';

let scroller: HTMLDivElement;

/** 正在拖拽的标签索引。 */
let draggingIndex = $state<number | null>(null);

/** 激活标签时把它滚动到可见区域。 */
$effect(() => {
  const id = tabs.activeId;
  if (!id || !scroller) return;
  const el = scroller.querySelector<HTMLElement>(`[data-tab-id="${id}"]`);
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
});

function handleDragStart(index: number) {
  draggingIndex = index;
}

function handleDrop(targetIndex: number) {
  if (draggingIndex === null) return;
  moveTab(draggingIndex, targetIndex);
  draggingIndex = null;
}

function handleDragEnd() {
  draggingIndex = null;
}

/**
 * 在标签之间移动焦点并按方向键语义激活。
 *
 * ARIA 的 tabs 模式要求支持左右方向键在标签间移动，
 * 只做 Enter/Space 是不完整的——键盘用户无法在标签间切换。
 * Home / End 跳到首尾是同一模式的一部分。
 */
function cycleTab(step: number) {
  if (tabs.items.length < 2 || !tabs.activeId) return;
  const index = tabs.items.findIndex((t) => t.id === tabs.activeId);
  const next = (index + step + tabs.items.length) % tabs.items.length;
  const target = tabs.items[next];
  if (target) {
    activateTab(target.id);
    // 焦点跟着激活项走，否则连续按方向键时焦点停在原处
    focusTab(target.id);
  }
}

/** 把键盘焦点移到指定标签。 */
function focusTab(id: string): void {
  // 等激活引起的 DOM 更新落地后再取元素
  queueMicrotask(() => {
    scroller?.querySelector<HTMLElement>(`[data-tab-id="${id}"] [role="tab"]`)?.focus();
  });
}
</script>

<div class="flex h-9 shrink-0 items-stretch border-b border-border-subtle bg-surface-sunken">
  <div
    bind:this={scroller}
    class="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    role="tablist"
  >
    {#each tabs.items as tab, index (tab.id)}
      <!--
        role="presentation" 是必要的：ARIA 要求 role="tablist" 直接拥有
        role="tab" 子元素，而这个包裹层会让 tab 变成「孙元素」，
        辅助技术因此无法建立 tablist ↔ tab 的从属关系。
      -->
      <div data-tab-id={tab.id} class="flex items-stretch" role="presentation">
        <TabItem
          {tab}
          {index}
          {draggingIndex}
          active={tab.id === tabs.activeId}
          onactivate={activateTab}
          onclose={requestCloseTab}
          ondragstart={handleDragStart}
          ondrop={handleDrop}
          ondragend={handleDragEnd}
          onnavigate={cycleTab}
        />
      </div>
    {/each}

    <!--
      标签之后的空白区域，作为「标签栏整体」的右键目标。

      与标签自身的右键菜单分开是刻意的：标签上是「这个文件能做什么」，
      这里（标签**之间**）是「标签栏能做什么」。两者若共用一个触发器，
      在标签上右键会同时弹出两层菜单。

      `min-w-6` 保证标签占满时这块仍有一小片可点——否则标签一多，
      「最近关闭」就再也叫不出来了。
    -->
    <ContextMenuRoot>
      <ContextMenuTrigger>
        {#snippet child({ props })}
          <div {...props} class="min-w-6 flex-1" role="presentation"></div>
        {/snippet}
      </ContextMenuTrigger>

      <ContextMenuContent class="w-64">
        <ContextMenuItem class="gap-2" onSelect={() => void reopenClosedTab()}>
          <Undo2 class="size-3.5 shrink-0" />
          <span class="truncate">{t('action.reopenClosed')}</span>
          <span class="ml-auto shrink-0 text-[10px] text-content-faint">
            {formatKeys('Ctrl+Shift+T')}
          </span>
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger class="gap-2">
            <ChevronRight class="size-3.5 shrink-0" />
            <span class="truncate">{t('contextMenu.recentlyClosed')}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent class="w-72">
            {#each recentClosed() as entry, i (entry.path + String(i))}
              <ContextMenuItem class="gap-2" onSelect={() => void reopenClosedAt(i)} title={entry.path}>
                <!--
                  文件名与父目录各占一部分宽度，**两者都可收缩**。

                  给路径写 `shrink-0` 会让它拒绝收缩，长路径直接把菜单项
                  撑宽、溢出菜单边框（实测过）。这里改成双方都 `min-w-0`
                  且可收缩，由 `truncate` 各自省略。
                -->
                <span class="min-w-0 flex-1 truncate">{entry.name}</span>
                <span class="min-w-0 max-w-[55%] shrink truncate text-[10px] text-content-faint">
                  {entry.dir}
                </span>
              </ContextMenuItem>
            {:else}
              <!--
                空时显示一项置灰的提示，而不是让子菜单空着。
                主流编辑器对「没有可重开的」一律用置灰而非隐藏
                （VS Code 的 precondition、Chromium 的 SetEnabledAt）。
              -->
              <ContextMenuItem class="gap-2 text-content-faint" disabled>
                <span class="truncate">{t('contextMenu.noClosedTabs')}</span>
              </ContextMenuItem>
            {/each}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem class="gap-2" onSelect={newTab}>
          <Plus class="size-3.5 shrink-0" />
          <span class="truncate">{t('tab.new')}</span>
          <span class="ml-auto shrink-0 text-[10px] text-content-faint">{formatKeys('Ctrl+N')}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuRoot>
  </div>

  <div class="flex shrink-0 items-center px-1">
    <Hint label={t('tab.newWithKey')} onclick={newTab}>
      <Plus class="size-4" />
    </Hint>
  </div>
</div>
