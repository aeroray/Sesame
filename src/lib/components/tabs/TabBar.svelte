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
import { ChevronRight, House, Plus, Undo2 } from '@lucide/svelte';
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
import { openWelcome, welcome } from '$lib/state/layout.svelte';
import { activateTab, moveTab, tabs } from '$lib/state/tabs.svelte';
import { formatKeys } from '$lib/utils/hotkeys';
import TabItem from './TabItem.svelte';

let scroller: HTMLDivElement;

/** 正在拖拽的标签索引（用于把它显示得淡一些）。 */
let draggingIndex = $state<number | null>(null);

/** 当前按下的标签索引。按下时还不知道用户是要点击还是拖拽。 */
let grabbedIndex: number | null = null;

/**
 * 拖拽是否**真的**开始了。
 *
 * 指针按下不等于拖拽：单击也要经过 `pointerdown`，而单击是「激活标签」。
 * 因此先记下起点，等指针移动超过一个阈值才升级为拖拽。
 * 没有这个阈值的话，手抖一两个像素就会把「点标签」变成「拖标签」。
 */
let dragStarted = false;
let startX = 0;
let startY = 0;

/** 超过这个距离才算拖拽（像素）。 */
const DRAG_THRESHOLD = 5;

/** 激活标签时把它滚动到可见区域。 */
$effect(() => {
  const id = tabs.activeId;
  if (!id || !scroller) return;
  const el = scroller.querySelector<HTMLElement>(`[data-tab-id="${id}"]`);
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
});

/**
 * 指针按下：记录起点并**捕获指针**。
 *
 * 捕获是必需的：不捕获的话，指针一旦移出这个标签元素，
 * `pointermove` 就不再送到它身上，拖动会中途「断线」。
 * 捕获之后所有移动事件都回到这个元素，落点改用几何位置算
 * （见 `indexAt`），因此不影响判断指针到了哪个标签上方。
 */
function handleGrab(index: number, event: PointerEvent) {
  grabbedIndex = index;
  draggingIndex = null;
  dragStarted = false;
  startX = event.clientX;
  startY = event.clientY;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

/**
 * 指针移动：超过阈值才真正开始拖拽，并按几何位置实时重排。
 *
 * **边拖边重排，而不是等松手时算一次**：标签在拖动过程中就跟着让位，
 * 用户能直接看到结果，不必靠一根抽象的插入线去猜。
 * VS Code 与浏览器标签栏都是这个行为。
 */
function handleGrabbing(event: PointerEvent) {
  if (grabbedIndex === null) return;

  if (!dragStarted) {
    const dx = Math.abs(event.clientX - startX);
    const dy = Math.abs(event.clientY - startY);
    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;
    dragStarted = true;
  }

  const from = grabbedIndex;
  draggingIndex = from;

  const target = indexAt(event.clientX);
  if (target === null || target === from) return;

  moveTab(from, target);
  // 标签移动后索引变了，跟随过去，否则连续拖动会来回抖
  grabbedIndex = target;
  draggingIndex = target;
}

/** 上一次拖拽结束的时刻。 */
let lastDragEndAt = 0;

/** 松手或取消：结束拖拽状态。重排已经实时做过，这里只收尾。 */
function handleRelease(event: PointerEvent) {
  const el = event.currentTarget as HTMLElement;
  if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
  if (dragStarted) lastDragEndAt = performance.now();
  grabbedIndex = null;
  draggingIndex = null;
  dragStarted = false;
}

/**
 * 标签是否该响应这次点击。
 *
 * `click` 在 `pointerup` 之后触发，因此拖完标签松手会**额外**触发一次
 * 激活。激活被拖的那个标签本身没错，但用户刚把它拖到新位置、
 * 期望「看到它停在那儿」，此时若因为一次点击而改变激活项会很突兀。
 * 因此拖拽之后吞掉紧随其后的那一次点击。
 *
 * 用「上一次拖拽结束的时间」判断，而不是一个布尔标志：
 * 标志需要在别处复位，一旦漏掉就会永久吞掉点击；
 * 时间戳是自失效的。
 */
function handleActivate(id: string) {
  if (performance.now() - lastDragEndAt < 200) return;
  activateTab(id);
}

/**
 * 指针横坐标落在第几个标签上。
 *
 * 用**每个标签自身的中线**判断，而不是「遍历找包含 x 的那个矩形」：
 * 拖到标签之间的缝隙或末尾空白处时，后者会返回 null，
 * 于是拖到最右端就放不过去。这里改成找「中心离指针最近」的那个，
 * 任何位置都有结果，边界情形自然被吸收。
 */
function indexAt(clientX: number): number | null {
  if (!scroller) return null;
  const nodes = [...scroller.querySelectorAll<HTMLElement>('[data-tab-id]')];
  if (nodes.length === 0) return null;

  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;
    const rect = node.getBoundingClientRect();
    const distance = Math.abs(clientX - (rect.left + rect.width / 2));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
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
  <!--
    欢迎页入口，放在标签栏**最左端**。

    为什么需要它：欢迎页原本只在「一个标签都没有」时出现，
    于是打开文件后就再也回不去——想看最近文件列表得先把标签全部关掉。

    为什么放在最左而不是最右（和「新建文件」放一起）：
    它切换的是**主区域显示什么**，属于视图导航；而「新建文件」是创建动作。
    两者语义不同，混在一侧会让用户以为它们是一类操作。
    最左端也正好是标签列表的起点，符合「回到开头」的直觉。

    禁用而不是隐藏：处于欢迎页时按钮置灰保留位置。
    隐藏会让右侧的标签整体左移一格，鼠标正悬停的位置就换了对象
    （工具栏的「重置变换」踩过同样的坑）。
  -->
  <div class="flex shrink-0 items-center pl-1">
    <Hint
      label={t('tab.welcome')}
      disabled={welcome.requested || tabs.items.length === 0}
      onclick={openWelcome}
    >
      <House class="size-4" />
    </Hint>
  </div>

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
          onactivate={handleActivate}
          onclose={requestCloseTab}
          ongrab={handleGrab}
          ongrabbing={handleGrabbing}
          onrelease={handleRelease}
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
