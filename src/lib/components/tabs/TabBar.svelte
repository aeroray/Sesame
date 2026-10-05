<script lang="ts">
  /**
   * 标签栏。横向滚动，标签较多时不挤压；支持拖拽排序。
   */
  import { Plus } from '@lucide/svelte';
  import Hint from '$lib/components/common/Hint.svelte';
  import TabItem from './TabItem.svelte';
  import { activateTab, moveTab, tabs } from '$lib/state/tabs.svelte';
  import { requestCloseTab } from '$lib/actions/close-tab';
  import { newTab } from '$lib/actions/new-tab';
  import { t } from '$lib/i18n';

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
  </div>

  <div class="flex shrink-0 items-center px-1">
    <Hint label={t('tab.newWithKey')} onclick={newTab}>
      <Plus class="size-4" />
    </Hint>
  </div>
</div>
