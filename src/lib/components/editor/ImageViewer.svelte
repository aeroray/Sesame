<script lang="ts">
/** 图片查看器：真实显示尺寸决定滚动范围，默认适应窗口。 */
import {
  Copy,
  ExternalLink,
  FolderOpen,
  ImageOff,
  Loader2,
  Maximize,
  RotateCcw,
  SquareDot,
  ZoomIn,
  ZoomOut,
} from '@lucide/svelte';
import { open } from '@tauri-apps/plugin-dialog';
import { tick, untrack } from 'svelte';
import { copyPath, revealInFolder } from '$lib/actions/file-actions';
import { reportError } from '$lib/actions/open-file';
import Hint from '$lib/components/common/Hint.svelte';
import {
  Content as ContextMenuContent,
  Item as ContextMenuItem,
  Root as ContextMenuRoot,
  Separator as ContextMenuSeparator,
  Trigger as ContextMenuTrigger,
} from '$lib/components/ui/context-menu';
import { t } from '$lib/i18n';
import { openImageExternally } from '$lib/ipc/fs';
import {
  ensureImage,
  getImage,
  getImageDimensions,
  isLoading,
  retainImage,
  setImageDimensions,
} from '$lib/state/images.svelte';
import { notify } from '$lib/state/status.svelte';
import type { Tab } from '$lib/state/types';
import { writeClipboardImage } from '$lib/utils/clipboard';
import { IS_MAC } from '$lib/utils/platform';

interface Props {
  tab: Tab;
  active?: boolean;
}
let { tab, active = true }: Props = $props();

let zoom = $state(1);
let fit = $state(true);
let viewport = $state<HTMLDivElement>();
let image = $state<HTMLImageElement>();
let viewportSize = $state({ width: 0, height: 0 });
let displayFailed = $state(false);
let openingExternally = $state(false);
let spaceHeld = $state(false);
let dragging = $state(false);
let pan: {
  pointerId: number;
  x: number;
  y: number;
  left: number;
  top: number;
} | null = null;

function finishPan() {
  const previous = pan;
  pan = null;
  dragging = false;
  if (previous && viewport?.hasPointerCapture(previous.pointerId)) {
    viewport.releasePointerCapture(previous.pointerId);
  }
}

function releaseHand() {
  spaceHeld = false;
  finishPan();
}

function onSpaceDown(event: KeyboardEvent) {
  if (
    !active ||
    !natural ||
    !image ||
    event.defaultPrevented ||
    (event.code !== 'Space' && event.key !== ' ') ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  )
    return;
  const target = event.target instanceof HTMLElement ? event.target : null;
  // Do not intercept typing, dialog controls, or buttons outside this viewer.
  if (
    target?.closest(
      'input, textarea, select, a, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
    )
  )
    return;
  if (target?.closest('button, [role="button"]') && !viewport?.parentElement?.contains(target))
    return;
  event.preventDefault();
  // Move keyboard focus off the last toolbar button without drawing a canvas ring.
  viewport?.focus({ preventScroll: true });
  spaceHeld = true;
}

function onSpaceUp(event: KeyboardEvent) {
  if (event.code !== 'Space' && event.key !== ' ') return;
  if (spaceHeld) event.preventDefault();
  releaseHand();
}

function onPanStart(event: PointerEvent) {
  if (!active || !spaceHeld || !natural || !viewport || event.button !== 0) return;
  const area = viewport;
  const frame = area.getBoundingClientRect();
  // Leave the native scrollbar thumbs available even while Space is held.
  if (
    event.clientX >= frame.left + area.clientWidth ||
    event.clientY >= frame.top + area.clientHeight
  )
    return;
  event.preventDefault();
  area.focus({ preventScroll: true });
  area.setPointerCapture(event.pointerId);
  pan = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    left: area.scrollLeft,
    top: area.scrollTop,
  };
  dragging = true;
}

function onPanMove(event: PointerEvent) {
  if (!pan || !spaceHeld || !viewport || event.pointerId !== pan.pointerId) return;
  event.preventDefault();
  viewport.scrollLeft = pan.left - (event.clientX - pan.x);
  viewport.scrollTop = pan.top - (event.clientY - pan.y);
}

function onPanEnd(event: PointerEvent) {
  if (pan?.pointerId === event.pointerId) finishPan();
}

$effect(() => {
  const area = viewport;
  if (!active || !area) {
    untrack(releaseHand);
    return;
  }
  window.addEventListener('keydown', onSpaceDown);
  window.addEventListener('keyup', onSpaceUp);
  window.addEventListener('blur', releaseHand);
  area.addEventListener('pointerdown', onPanStart);
  area.addEventListener('pointermove', onPanMove);
  area.addEventListener('pointerup', onPanEnd);
  area.addEventListener('pointercancel', onPanEnd);
  area.addEventListener('lostpointercapture', onPanEnd);
  return () => {
    window.removeEventListener('keydown', onSpaceDown);
    window.removeEventListener('keyup', onSpaceUp);
    window.removeEventListener('blur', releaseHand);
    area.removeEventListener('pointerdown', onPanStart);
    area.removeEventListener('pointermove', onPanMove);
    area.removeEventListener('pointerup', onPanEnd);
    area.removeEventListener('pointercancel', onPanEnd);
    area.removeEventListener('lostpointercapture', onPanEnd);
    untrack(releaseHand);
  };
});

const payload = $derived(getImage(tab.id));
const natural = $derived(getImageDimensions(tab.id));
const loading = $derived(isLoading(tab.id));
const PADDING = 16;
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 8;

const fitZoom = $derived(
  natural && viewportSize.width > 0 && viewportSize.height > 0
    ? Math.min(
        1,
        Math.max(1, viewportSize.width - PADDING * 2) / natural.width,
        Math.max(1, viewportSize.height - PADDING * 2) / natural.height,
      )
    : 1,
);
const effectiveZoom = $derived(fit ? fitZoom : zoom);
const displayWidth = $derived(Math.max(1, Math.floor((natural?.width ?? 1) * effectiveZoom)));
const displayHeight = $derived(Math.max(1, Math.floor((natural?.height ?? 1) * effectiveZoom)));

$effect(() => {
  const id = tab.id;
  const path = tab.path;
  if (!path || !active) return;
  untrack(() => {
    retainImage(id);
    ensureImage(id, path).catch((err) => reportError(err, t('error.readImageFailed')));
  });
});

$effect(() => {
  const element = viewport;
  if (!element) return;
  let frame = 0;
  let measuredWidth = 0;
  let measuredHeight = 0;
  const measure = () => {
    // Border-box dimensions stay stable when scrollbars appear/disappear.
    // Hidden tabs report zero: keep the last usable viewport until shown again.
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (width > 0 && height > 0 && (width !== measuredWidth || height !== measuredHeight)) {
      measuredWidth = width;
      measuredHeight = height;
      viewportSize = { width, height };
    }
  };
  // Updating reactive layout inside observer delivery can cause a feedback loop.
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  });
  observer.observe(element, { box: 'border-box' });
  measure();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
});

function onLoad(event: Event) {
  const img = event.currentTarget as HTMLImageElement;
  setImageDimensions(tab.id, { width: img.naturalWidth, height: img.naturalHeight });
  displayFailed = false;
}

interface ZoomPoint {
  x: number;
  y: number;
}

/** Keep the same image point under the mouse, or under the viewport center. */
async function setView(nextFit: boolean, nextZoom = 1, point?: ZoomPoint) {
  if (!natural || !viewport || !image) return;
  const area = viewport;
  const before = image.getBoundingClientRect();
  const frame = area.getBoundingClientRect();
  const focusX = point ? point.x - frame.left : area.clientWidth / 2;
  const focusY = point ? point.y - frame.top : area.clientHeight / 2;
  const anchorX = Math.max(0, Math.min(1, (frame.left + focusX - before.left) / before.width));
  const anchorY = Math.max(0, Math.min(1, (frame.top + focusY - before.top) / before.height));
  fit = nextFit;
  zoom = nextZoom;
  await tick();
  if (viewport !== area || !image) return;
  if (nextFit) {
    area.scrollTo(0, 0);
    return;
  }
  const after = image.getBoundingClientRect();
  const nextFrame = area.getBoundingClientRect();
  const targetX = point ? point.x - nextFrame.left : area.clientWidth / 2;
  const targetY = point ? point.y - nextFrame.top : area.clientHeight / 2;
  area.scrollLeft += after.left + after.width * anchorX - nextFrame.left - targetX;
  area.scrollTop += after.top + after.height * anchorY - nextFrame.top - targetY;
}

function zoomBy(factor: number, point?: ZoomPoint) {
  // Start from the actual fitted scale, rather than jumping to 100%.
  const minimum = Math.min(MIN_ZOOM, fitZoom / 10);
  void setView(false, Math.min(MAX_ZOOM, Math.max(minimum, effectiveZoom * factor)), point);
}

function onWheel(event: WheelEvent) {
  finishPan();
  if (!active || !event.ctrlKey || !natural || !viewport || !image || event.deltaY === 0) return;
  // A non-passive listener is required to cancel WebView/browser page zoom.
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
  const delta = Math.max(-100, Math.min(100, event.deltaY * unit));
  zoomBy(1.25 ** (-delta / 100), { x: event.clientX, y: event.clientY });
}

$effect(() => {
  const element = viewport;
  if (!element) return;
  element.addEventListener('wheel', onWheel, { passive: false });
  return () => element.removeEventListener('wheel', onWheel);
});

function resetZoom() {
  void setView(true);
}

function actualSize() {
  void setView(false, 1);
}

/** Use an application chooser, including when Sesame is the default handler. */
async function openExternally() {
  if (!tab.path || openingExternally) return;
  openingExternally = true;
  try {
    let application: string | undefined;
    if (IS_MAC) {
      const selected = await open({
        title: t('image.chooseExternalApp'),
        defaultPath: '/Applications',
        multiple: false,
        directory: false,
        filters: [{ name: t('image.applications'), extensions: ['app'] }],
      });
      if (!selected) return;
      application = selected;
    }
    await openImageExternally(tab.path, application);
  } catch (err) {
    reportError(err, t('error.openExternallyFailed'));
  } finally {
    openingExternally = false;
  }
}

/**
 * 复制图片到剪贴板。
 *
 * 与「复制文件路径」不同——那个复制的是**路径文本**，
 * 这个复制的是**像素本身**，可以直接粘进聊天窗口或文档里。
 * 这也是图片最常用的动作之一，值得放进右键菜单。
 */
let copyingImage = $state(false);

async function copyImage() {
  if (!payload || copyingImage) return;
  copyingImage = true;
  try {
    const ok = await writeClipboardImage(payload.dataUrl);
    if (ok) notify.success(t('image.imageCopied'));
    else notify.error(t('image.copyImageFailed'));
  } finally {
    copyingImage = false;
  }
}
</script>

<div class="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-surface-sunken">
  <div class="flex h-8 shrink-0 items-center justify-end gap-1 border-b border-border-subtle bg-surface px-2 text-[11px] text-content-muted">
    <span class="flex items-center gap-0.5">
      <Hint label={t('image.zoomOut')} side="top" class="size-6" disabled={!natural} onclick={() => zoomBy(1 / 1.25)}>
        <ZoomOut class="size-3.5" />
      </Hint>
      <!--
        缩放比例是纯文字，两侧是 size-6 的图标按钮。

        `leading-none` 不是装饰，是**对齐所必需的**：`items-center` 居中的是
        行盒，而行盒高度由 `line-height` 决定（这里是继承来的 `1.5 × 11px`）。
        中文字形在 em 方框里的墨迹并不居于行盒正中，行盒居中后墨迹偏高 1px。
        收紧行高让行盒贴合字号，墨迹才与图标对齐（实测 1.00px → 0.00px）。
      -->
      <span class="w-14 px-1 text-center leading-none tabular-nums" title={`${Math.round(effectiveZoom * 100)}%`}>
        {fit ? t('image.fitShort') : `${Math.round(effectiveZoom * 100)}%`}
      </span>
      <Hint label={t('image.zoomIn')} side="top" class="size-6" disabled={!natural} onclick={() => zoomBy(1.25)}>
        <ZoomIn class="size-3.5" />
      </Hint>
      <Hint label={t('image.resetZoom')} side="top" class="size-6" disabled={!natural} onclick={resetZoom}>
        <RotateCcw class="size-3.5" />
      </Hint>
      <Hint label={t('image.fit')} side="top" class="size-6" disabled={!natural} active={fit} toggle onclick={resetZoom}>
        <Maximize class="size-3.5" />
      </Hint>
      <!--
        「原始尺寸」用 `SquareDot`（方框 + 中心点），而不是早先的 `1:1` 文字。
        `1:1` 在图片语境里会被读成「宽高比 1:1」，与「100% 缩放」不是一回事。
        形状上也与紧邻的「适应窗口」四角图标构成一放一收的对照。
      -->
      <Hint label={t('image.actualSize')} side="top" class="size-6" disabled={!natural} onclick={actualSize}>
        <SquareDot class="size-3.5" />
      </Hint>
      <Hint label={t('image.openExternal')} side="top" class="size-6" disabled={openingExternally} onclick={() => void openExternally()}>
        <ExternalLink class="size-3.5" />
      </Hint>
    </span>
  </div>

  <!--
    图片区的右键菜单。

    图片上右键原先什么都不弹（全局拦截器只是挡住了 WebView 的原生菜单），
    而图片恰恰有几个只在图片上有意义的动作：复制像素、用外部程序打开。
    文本区的菜单里放这些没有意义，所以单独做一份。

    `ContextMenuTrigger` 包住整个视口，因此在图片外的留白处右键也有效——
    那是查看区的一部分，用户不会觉得意外。
  -->
  <ContextMenuRoot>
    <ContextMenuTrigger>
      {#snippet child({ props })}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable image region needs keyboard focus for scrolling and panning.) -->
        <div
          {...props}
          bind:this={viewport}
          role="region"
          aria-label={t('image.viewArea')}
          tabindex="0"
          class="image-viewport relative min-h-0 min-w-0 flex-1 overflow-auto"
          class:select-none={spaceHeld}
          style:cursor={dragging ? 'grabbing' : spaceHeld ? 'grab' : undefined}
          style="overflow-anchor: none;"
        >
          {#if !active}
            <!-- Release decoded bitmap surfaces for hidden tabs while retaining view state. -->
          {:else if loading && !payload}
            <div class="flex h-full items-center justify-center gap-2 text-xs text-content-faint">
              <Loader2 class="size-4 animate-spin" />
              {t('image.loading')}
            </div>
          {:else if payload && !displayFailed}
            <!-- Explicit image dimensions prevent unscaled overflow after zooming out. -->
            <div class="grid min-h-full min-w-full place-items-center p-4" style="width: max-content; height: max-content;">
              <img
                bind:this={image}
                src={payload.dataUrl}
                alt={payload.name}
                onload={onLoad}
                onerror={() => (displayFailed = true)}
                class="block max-h-none max-w-none"
                style={`width: ${displayWidth}px; height: ${displayHeight}px; visibility: ${natural ? 'visible' : 'hidden'};`}
                draggable={false}
              />
            </div>
          {:else}
            <div class="flex h-full flex-col items-center justify-center gap-2 text-content-faint">
              <ImageOff class="size-6" />
              <p class="text-xs">{t('image.displayFailed')}</p>
            </div>
          {/if}
        </div>
      {/snippet}
    </ContextMenuTrigger>

    <ContextMenuContent class="w-56">
      <!--
        「复制图片」复制的是**像素**，而下一项复制的是**路径文本**。
        两者名字相近、结果完全不同，因此用分隔线隔开，
        并让图标区分（Copy 对 FolderOpen / ExternalLink）。
      -->
      <ContextMenuItem
        class="gap-2"
        disabled={!payload || copyingImage}
        onSelect={() => void copyImage()}
      >
        <Copy class="size-3.5 shrink-0" />
        <span class="truncate">{t('image.copyImage')}</span>
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        class="gap-2"
        disabled={!tab.path}
        onSelect={() => void copyPath(tab)}
      >
        <Copy class="size-3.5 shrink-0" />
        <span class="truncate">{t('action.copyPath')}</span>
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

      <ContextMenuItem
        class="gap-2"
        disabled={!tab.path || openingExternally}
        onSelect={() => void openExternally()}
      >
        <ExternalLink class="size-3.5 shrink-0" />
        <span class="truncate">{t('image.openExternal')}</span>
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenuRoot>
</div>
