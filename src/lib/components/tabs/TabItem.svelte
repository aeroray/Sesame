<script lang="ts">
/**
 * 单个标签页。
 *
 * 未保存时用圆点替代关闭按钮（悬停时切回关闭按钮），
 * 这是编辑器通行做法，既省空间又能一眼看出哪些没存。
 *
 * ## 拖拽排序用指针事件，不用 HTML5 DnD
 *
 * 早先这里用 `draggable` + `dragstart/dragover/drop`，但在 Windows 上
 * **完全不起作用**：`tauri.conf.json` 开了 `dragDropEnabled`，
 * wry 会用 OLE 的 `RegisterDragDrop` 在窗口上注册一个原生拖放目标
 * 来实现「把文件拖进窗口打开」，那个原生目标会先一步吃掉拖拽操作，
 * 页面里的 HTML5 拖拽事件根本不会触发。
 *
 * 关掉 `dragDropEnabled` 能修好拖拽排序，但会连带砍掉拖文件打开——
 * 而欢迎页明确提示「把文件拖到窗口里」，那个功能更常用。
 *
 * 改用指针事件（`pointerdown/move/up` + `setPointerCapture`）：
 * 它走的是普通 DOM 事件，不经过 OLE 拖放通道，与原生文件拖放互不干扰。
 * 顺带还省掉了 HTML5 DnD 在跨元素时的一堆怪行为。
 */
import { Copy, FileText, FolderOpen, X } from '@lucide/svelte';
import { requestCloseOthers, requestCloseTab, requestCloseToRight } from '$lib/actions/close-tab';
import { copyPath, revealInFolder } from '$lib/actions/file-actions';
import {
  Content as ContextMenuContent,
  Item as ContextMenuItem,
  Root as ContextMenuRoot,
  Separator as ContextMenuSeparator,
  Trigger as ContextMenuTrigger,
} from '$lib/components/ui/context-menu';
import { LANGUAGE_LABELS } from '$lib/editor/languages';
import { t } from '$lib/i18n';
import { tabDisplayName, tabs } from '$lib/state/tabs.svelte';
import type { Tab } from '$lib/state/types';
import { cn } from '$lib/utils/cn';
import { fileIcon } from '$lib/utils/file-icon';
import { formatKeys } from '$lib/utils/hotkeys';

interface Props {
  tab: Tab;
  active: boolean;
  index: number;
  /** 正在被拖拽的标签索引，用于把它显示得淡一些。 */
  draggingIndex: number | null;
  onactivate: (id: string) => void;
  onclose: (tab: Tab) => void;
  /** 指针按下：既可能是一次点击，也可能是一次拖拽的开始。 */
  ongrab: (index: number, event: PointerEvent) => void;
  ongrabbing: (event: PointerEvent) => void;
  onrelease: (event: PointerEvent) => void;
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
  ongrab,
  ongrabbing,
  onrelease,
  onnavigate,
}: Props = $props();

let hovering = $state(false);

/** 该标签的文件类型图标，与侧栏、首屏共用同一套映射。 */
const TabIcon = $derived(fileIcon(tab.kind, tab.language));

/** 是否显示关闭按钮：悬停时始终显示。 */
const showClose = $derived(hovering || !tab.dirty);

/** 正在被拖拽的是不是自己。 */
const isDragging = $derived(draggingIndex === index);

/** 当前标签在列表中的位置，决定「关闭右侧」是否可用。 */
const hasTabsToRight = $derived(index < tabs.items.length - 1);

/** 是否有其它标签，决定「关闭其他」是否可用。 */
const hasOtherTabs = $derived(tabs.items.length > 1);
</script>

<ContextMenuRoot>
  <ContextMenuTrigger>
    {#snippet child({ props })}
      <div
        {...props}
        class={cn(
          'group relative flex h-9 min-w-0 max-w-52 shrink-0 cursor-pointer items-center gap-2 border-r border-border-subtle px-3 text-xs transition-colors',
          active
            ? 'bg-surface text-content'
            : 'bg-surface-sunken text-content-muted hover:bg-surface/60 hover:text-content',
          isDragging && 'opacity-40',
        )}
        role="tab"
        tabindex={active ? 0 : -1}
        aria-selected={active}
        onpointerdown={(e) => {
          /*
           * 只响应主键。右键要留给上下文菜单，中键留给「关闭标签」
           * 这类浏览器习惯（本项目未实现，但也不该在这里吞掉）。
           */
          if (e.button !== 0) return;

          /*
           * 关闭按钮上的按下不算拖拽，否则用户想关标签却把它拖走了。
           * 用 `closest` 判断而不是给关闭按钮加 stopPropagation：
           * 后者会连累 ContextMenu 的触发器，右键关闭按钮时菜单出不来。
           */
          if ((e.target as HTMLElement).closest('button')) return;

          ongrab(index, e);
        }}
        onpointermove={ongrabbing}
        onpointerup={onrelease}
        onpointercancel={onrelease}
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
        onmouseenter={() => (hovering = true)}
        onmouseleave={() => (hovering = false)}
      >
        <!-- 激活指示条 -->
        {#if active}
          <span class="absolute inset-x-0 top-0 h-0.5 bg-brand-500"></span>
        {/if}

        <!--
          文件类型图标。

          早先**只有图片**显示图标，文本标签什么都不显示——于是同一份文件
          在标签栏、侧栏、首屏三处各是一个样子。现在统一走 `fileIcon()`，
          三处用同一套映射（类别与语言由后端判定）。

          尺寸比侧栏小一号（size-3 对 size-3.5）：标签栏更紧凑。
        -->
        <TabIcon class="size-3 shrink-0 opacity-60" />

        <span class="min-w-0 flex-1 truncate" title={tab.path ?? LANGUAGE_LABELS[tab.language]}>
          {tabDisplayName(tab)}
        </span>

        <!-- 关闭按钮：未修改时直接显示；已修改时显示圆点，悬停变关闭 -->
        <button
          type="button"
          class="flex size-4 shrink-0 items-center justify-center rounded-xs text-content-faint transition-colors hover:bg-border-subtle hover:text-content"
          aria-label={tab.dirty
            ? t('tab.closeDirty', { name: tabDisplayName(tab) })
            : t('tab.close', { name: tabDisplayName(tab) })}
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
    {/snippet}
  </ContextMenuTrigger>

  <!--
    针对这个标签的操作。

    「复制路径」与「在文件夹中显示」早先在应用菜单里，且作用于**激活的**
    标签——用户得先切换标签再回左上角找菜单，两步都别扭。
    右键的对象就是操作对象，这类文件级动作属于这里。
  -->
  <ContextMenuContent class="w-56">
    <ContextMenuItem
      class="gap-2"
      disabled={!tab.path}
      onSelect={() => void copyPath(tab)}
    >
      <Copy class="size-3.5 shrink-0" />
      <span class="truncate">{t('action.copyPath')}</span>
      <span class="ml-auto shrink-0 text-[10px] text-content-faint">
        {formatKeys('Ctrl+Shift+C')}
      </span>
    </ContextMenuItem>

    <ContextMenuItem
      class="gap-2"
      disabled={!tab.path}
      onSelect={() => void revealInFolder(tab)}
    >
      <FolderOpen class="size-3.5 shrink-0" />
      <span class="truncate">{t('action.revealInFolder')}</span>
    </ContextMenuItem>

    <ContextMenuSeparator />

    <ContextMenuItem class="gap-2" onSelect={() => void requestCloseTab(tab)}>
      <X class="size-3.5 shrink-0" />
      <span class="truncate">{t('action.close')}</span>
      <span class="ml-auto shrink-0 text-[10px] text-content-faint">{formatKeys('Ctrl+W')}</span>
    </ContextMenuItem>

    <ContextMenuItem
      class="gap-2"
      disabled={!hasOtherTabs}
      onSelect={() => void requestCloseOthers(tab)}
    >
      <FileText class="size-3.5 shrink-0" />
      <span class="truncate">{t('action.closeOthers')}</span>
    </ContextMenuItem>

    <ContextMenuItem
      class="gap-2"
      disabled={!hasTabsToRight}
      onSelect={() => void requestCloseToRight(tab)}
    >
      <FileText class="size-3.5 shrink-0" />
      <span class="truncate">{t('action.closeToRight')}</span>
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenuRoot>
