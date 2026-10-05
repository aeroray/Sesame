<script lang="ts">
  /**
   * 单个标签页。
   *
   * 未保存时用圆点替代关闭按钮（悬停时切回关闭按钮），
   * 这是编辑器通行做法，既省空间又能一眼看出哪些没存。
   *
   * 拖拽排序用原生 HTML5 DnD：标签栏是纯横向列表，
   * 引入拖拽库只为这点功能不值得。
   */
  import { X, FileText, Image as ImageIcon } from '@lucide/svelte';
  import { cn } from '$lib/utils/cn';
  import { LANGUAGE_LABELS } from '$lib/editor/languages';
  import type { Tab } from '$lib/state/types';
  import { t } from '$lib/i18n';

  interface Props {
    tab: Tab;
    active: boolean;
    index: number;
    /** 当前正在被拖拽的标签索引，用于显示落点指示。 */
    draggingIndex: number | null;
    onactivate: (id: string) => void;
    onclose: (tab: Tab) => void;
    ondragstart: (index: number) => void;
    ondrop: (index: number) => void;
    ondragend: () => void;
    /** 方向键导航：+1 下一个，-1 上一个。 */
    onnavigate: (step: number) => void;
  }

  let {
    tab,
    active,
    index,
    draggingIndex,
    onactivate,
    onclose,
    ondragstart,
    ondrop,
    ondragend,
    onnavigate,
  }: Props = $props();

  let hovering = $state(false);

  /** 是否显示关闭按钮：悬停时始终显示。 */
  const showClose = $derived(hovering || !tab.dirty);

  /** 是否是拖拽落点。 */
  const isDropTarget = $derived(draggingIndex !== null && draggingIndex !== index);

  /** 拖拽源高亮。 */
  const isDragging = $derived(draggingIndex === index);
</script>

<div
  class={cn(
    'group relative flex h-9 min-w-0 max-w-52 shrink-0 cursor-pointer items-center gap-2 border-r border-border-subtle px-3 text-xs transition-colors',
    active
      ? 'bg-surface text-content'
      : 'bg-surface-sunken text-content-muted hover:bg-surface/60 hover:text-content',
    isDragging && 'opacity-40',
    isDropTarget && 'ring-1 ring-inset ring-brand-400',
  )}
  role="tab"
  tabindex={active ? 0 : -1}
  aria-selected={active}
  draggable="true"
  onclick={() => onactivate(tab.id)}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onactivate(tab.id);
      return;
    }

    /*
     * 方向键在标签间导航。
     *
     * ARIA 的 tabs 模式要求如此：键盘用户没法靠 Tab 键逐个走标签
     * （那会把焦点送进每个标签的关闭按钮），必须用左右方向键。
     */
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onnavigate(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onnavigate(-1);
    }
  }}
  ondragstart={(e) => {
    // 不设 dataTransfer 的话 Firefox 不会启动拖拽
    e.dataTransfer?.setData('text/plain', tab.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    ondragstart(index);
  }}
  ondragover={(e) => {
    // 必须 preventDefault，否则浏览器不会把这里当作合法落点
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }}
  ondrop={(e) => {
    e.preventDefault();
    ondrop(index);
  }}
  ondragend={ondragend}
  onmouseenter={() => (hovering = true)}
  onmouseleave={() => (hovering = false)}
>
  <!-- 激活指示条 -->
  {#if active}
    <span class="absolute inset-x-0 top-0 h-0.5 bg-brand-500"></span>
  {/if}

  <!-- 内容类型图标：图片与文本一眼可分 -->
  {#if tab.kind === 'image'}
    <ImageIcon class="size-3 shrink-0 opacity-60" />
  {/if}

  <span class="min-w-0 flex-1 truncate" title={tab.path ?? LANGUAGE_LABELS[tab.language]}>
    {tab.name}
  </span>

  <!-- 关闭按钮：未修改时直接显示；已修改时显示圆点，悬停变关闭 -->
  <button
    type="button"
    class="flex size-4 shrink-0 items-center justify-center rounded-xs text-content-faint transition-colors hover:bg-border-subtle hover:text-content"
    aria-label={tab.dirty
      ? t('tab.closeDirty', { name: tab.name })
      : t('tab.close', { name: tab.name })}
    onclick={(e) => {
      e.stopPropagation();
      onclose(tab);
    }}
  >
    {#if showClose}
      <X class="size-3" />
    {:else}
      <span class="size-2 rounded-full bg-brand-500"></span>
    {/if}
  </button>
</div>
