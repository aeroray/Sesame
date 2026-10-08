<script lang="ts">
/** 图片查看器：真实显示尺寸决定滚动范围，默认适应窗口。 */
import {
  Copy,
  ExternalLink,
  FlipHorizontal,
  FlipVertical,
  FolderOpen,
  HardDriveDownload,
  ImageOff,
  Loader2,
  Maximize,
  Monitor,
  RotateCcw,
  RotateCw,
  SquareDimensions,
  Undo2,
  ZoomIn,
  ZoomOut,
} from '@lucide/svelte';
import { open, save } from '@tauri-apps/plugin-dialog';
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
import { openImageExternally, saveImageAs, setAsWallpaper } from '$lib/ipc/fs';
import {
  ensureImage,
  getImage,
  getImageDimensions,
  getTransform,
  isLoading,
  retainImage,
  setImageDimensions,
  setTransform,
} from '$lib/state/images.svelte';
import { notify } from '$lib/state/status.svelte';
import { markDirty } from '$lib/state/tabs.svelte';
import type { Tab } from '$lib/state/types';
import { writeClipboardImage } from '$lib/utils/clipboard';
import {
  applyTransform,
  decodeImage,
  flipHorizontal,
  flipVertical,
  IDENTITY,
  type ImageTransform,
  isIdentity,
  rotateCCW,
  rotateCW,
  transformedSize,
} from '$lib/utils/image-transform';
import { IS_MAC, IS_WINDOWS } from '$lib/utils/platform';

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

/** 当前的旋转 / 翻转状态。 */
const transform = $derived(getTransform(tab.id));
const transformed = $derived(!isIdentity(transform));

/**
 * 变换后的图片 data URL。
 *
 * ## 为什么预渲染成一张新图，而不是用 CSS `transform`
 *
 * CSS 只改显示、不改像素：旋转 90° 后宽高互换，而元素占的仍是原来的
 * 盒子，于是要么被裁掉、要么留下大片空白，滚动范围也跟着错。
 * 本项目早先就因为这个原因放弃了用 `transform` 做缩放。
 *
 * 这里在 canvas 上**真正重绘**成一张尺寸正确的新位图，
 * 之后的适应窗口、缩放、滚动全都按正常路径工作，不需要任何特例——
 * 因为它们拿到的就是一张普通图片。
 *
 * ## 只在变换变化时重算
 *
 * 这个 effect 的依赖只有 `payload.dataUrl` 与 `transform` 的四个字段。
 * 缩放、滚动、窗口大小变化都**不会**触发它，因此拖拽与缩放依然流畅。
 */
let displayUrl = $state<string | null>(null);

$effect(() => {
  const source = payload?.dataUrl;
  // 不要把这个变量命名为 `t`：那会遮蔽 i18n 的 `t()` 函数，
  // 而下面的 catch 分支正好要用它（实测报 "not callable"）。
  const next = transform;

  // 恒等变换：直接用原图，连解码都省了
  if (!source || isIdentity(next)) {
    displayUrl = null;
    return;
  }

  let cancelled = false;
  void (async () => {
    try {
      const bitmap = await decodeImage(source);
      if (cancelled) return;
      const canvas = applyTransform(bitmap, bitmap.naturalWidth, bitmap.naturalHeight, next);
      if (cancelled) return;
      /*
       * 一律按 PNG 编码显示。
       *
       * 这是**仅供显示**的中间图，不落盘；用 PNG 避免为了预览而
       * 对 JPEG 做一次有损重编码（那会让屏幕上的画质比文件更差，
       * 而保存时才是有损的那一次）。代价是内存里多一份较大的
       * data URL，仅在旋转后才存在。
       */
      displayUrl = canvas.toDataURL('image/png');
    } catch (err) {
      if (!cancelled) reportError(err, t('error.readImageFailed'));
    }
  })();

  return () => {
    cancelled = true;
  };
});

/** 实际渲染用的图源。 */
const shownUrl = $derived(displayUrl ?? payload?.dataUrl);

/**
 * 尺寸：变换会交换宽高。
 *
 * `natural` 是**解码后**的真实尺寸，由 `onLoad` 写入。旋转后 `img` 的
 * 源换成了新图，`onLoad` 会用新尺寸覆盖它，两者因此始终一致。
 */
const shownSize = $derived(
  natural ? transformedSize(natural.width, natural.height, transform) : undefined,
);

const fitZoom = $derived(
  shownSize && viewportSize.width > 0 && viewportSize.height > 0
    ? Math.min(
        1,
        Math.max(1, viewportSize.width - PADDING * 2) / shownSize.width,
        Math.max(1, viewportSize.height - PADDING * 2) / shownSize.height,
      )
    : 1,
);
const effectiveZoom = $derived(fit ? fitZoom : zoom);
const displayWidth = $derived(Math.max(1, Math.floor((shownSize?.width ?? 1) * effectiveZoom)));
const displayHeight = $derived(Math.max(1, Math.floor((shownSize?.height ?? 1) * effectiveZoom)));

/**
 * 施加一次变换，并按**实际结果**同步脏状态。
 *
 * ## 为什么不能无条件 `markDirty(true)`
 *
 * 早先这里直接标脏，于是两种「什么都没变」的操作也会提示保存：
 *
 * - 左转一次再右转一次 → 变换回到恒等，但标签仍是脏的
 * - 左转一次再点「重置」 → 同上
 *
 * 关闭时弹「要保存吗」，而图片其实与磁盘上完全一致——
 * 用户会以为程序搞错了（实测反馈如此）。
 *
 * 现在按变换后的状态判断：**回到恒等就清脏，离开恒等才标脏**。
 * 这与文本编辑器的行为一致（把改动改回去，脏标记也会消失）。
 *
 * 不直接写文件：JPEG 重编码有损（实测 `rgb(32,64,128)` → `rgb(30,66,123)`），
 * 每点一次就写一次等于反复掉画质且无法撤销。用户按 Ctrl+S 才落盘。
 */
function applyAndMark(next: ImageTransform) {
  setTransform(tab.id, next);
  markDirty(tab.id, !isIdentity(next));
}

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
  /*
   * 只在**恒等变换**时记录尺寸。
   *
   * `natural` 必须始终是**原图**的解码尺寸，因为 `shownSize` 会用它
   * 配合 `transform` 算出显示尺寸。旋转后 `<img>` 的源换成了重绘过的新图，
   * 它的 `naturalWidth` 已经是互换过的值——若照收，`shownSize` 会再交换
   * 一次，尺寸就转回去了（表现为「旋转后宽高没变」）。
   */
  if (isIdentity(getTransform(tab.id))) {
    setImageDimensions(tab.id, { width: img.naturalWidth, height: img.naturalHeight });
  }
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
    const ok = await writeClipboardImage(shownUrl ?? payload.dataUrl);
    if (ok) notify.success(t('image.imageCopied'));
    else notify.error(t('image.copyImageFailed'));
  } finally {
    copyingImage = false;
  }
}

/**
 * 另存为。
 *
 * 默认文件名与扩展名取自**原文件**——用户另存一张 PNG 时，
 * 最可能想要的还是一张 PNG（这里不做格式转换，见 Rust 侧说明）。
 */
async function saveAs() {
  if (!tab.path) return;
  const name = payload?.name ?? tab.name;
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? name.slice(dot + 1) : undefined;

  try {
    const target = await save({
      title: t('image.saveAsTitle'),
      defaultPath: name,
      filters: extension ? [{ name: extension.toUpperCase(), extensions: [extension] }] : undefined,
    });
    if (!target) return;

    const saved = await saveImageAs(tab.path, target);
    notify.success(t('image.savedAs', { name: saved.split('/').pop() ?? name }));
  } catch (err) {
    reportError(err, t('error.saveImageFailed'));
  }
}

/** 设为桌面壁纸（仅 Windows 显示此项）。 */
async function setWallpaper() {
  if (!tab.path) return;
  try {
    await setAsWallpaper(tab.path);
    notify.success(t('image.wallpaperSet'));
  } catch (err) {
    reportError(err, t('error.wallpaperFailed'));
  }
}
</script>

/**
 * 工具栏的分组竖线。
 *
 * 用一条 1px 的竖线把按钮按用途隔开，而不是只靠间距：
 * 间距只能表达「有间隔」，竖线能表达「这是两组不同的功能」。
 *
 * `h-4` 而不是撑满高度：留出上下留白，看起来像分隔符而不是边框。
 */
{#snippet groupDivider()}
  <span class="mx-0.5 h-4 w-px shrink-0 bg-border-subtle" aria-hidden="true"></span>
{/snippet}

<div class="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-surface-sunken">
  <div
    class="flex h-8 shrink-0 items-center justify-end gap-1 border-b border-border-subtle bg-surface px-2 text-[11px] text-content-muted"
  >
    <!--
      工具栏按**用途分成四组**，组间用一条竖线隔开。

      早先 11 个按钮平铺在一起，没有分组：缩放、视图模式、旋转翻转、
      外部打开混成一片，用户得逐个辨认图标才知道哪几个是一类。

      分组顺序按使用频率与逻辑依赖：先调缩放，再选视图模式，
      然后才是会改动图片的变换，最后是「拿出去用」。
    -->
    <span class="flex items-center gap-0.5">
      <!-- 组 1：缩放 -->
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

      {@render groupDivider()}

      <!--
        组 2：视图模式。

        这里**只有一个**「适应窗口」按钮，没有单独的「重置缩放」。
        早先两者都在，但它们调用的是同一个 `setView(true)`——
        两个按钮做同一件事，用户会猜它们有什么区别。
        「适应窗口」带激活态，已经能表达「当前处于适应模式」，
        因此删掉那个重复项。
      -->
      <Hint label={t('image.fit')} side="top" class="size-6" disabled={!natural} active={fit} toggle onclick={resetZoom}>
        <Maximize class="size-3.5" />
      </Hint>
      <!--
        「原始尺寸」用 `SquareDimensions`（带尺寸标注的方框），
        而不是早先的 `SquareDot`。

        早先那个只是一个方框加中心点，看不出「这是原始尺寸」——
        用户反馈语义不明（实测反馈）。`SquareDimensions` 画的是
        方框内侧两个相对的尺寸角标，正是「量出真实尺寸」的图形语言，
        也与旁边「适应窗口」的四角图标构成「按尺寸显示 / 按窗口缩放」的对照。
      -->
      <Hint label={t('image.actualSize')} side="top" class="size-6" disabled={!natural} onclick={actualSize}>
        <SquareDimensions class="size-3.5" />
      </Hint>

      {@render groupDivider()}

      <!--
        组 3：旋转与翻转。

        「重置」**常驻显示**，只是在没有变换时置灰。

        早先它只在有变换时才出现，于是第一次旋转时它会挤进来、
        把后面所有按钮推开一格——鼠标停在原位置的用户会点到别的按钮
        （实测反馈：UI 抖动、误点）。常驻 + 置灰既没有位移，
        又让用户一开始就知道有「可以还原」这个能力。
      -->
      <Hint
        label={t('image.rotateCCW')}
        side="top"
        class="size-6"
        disabled={!natural}
        onclick={() => applyAndMark(rotateCCW(transform))}
      >
        <RotateCcw class="size-3.5" />
      </Hint>
      <Hint
        label={t('image.rotateCW')}
        side="top"
        class="size-6"
        disabled={!natural}
        onclick={() => applyAndMark(rotateCW(transform))}
      >
        <RotateCw class="size-3.5" />
      </Hint>
      <Hint
        label={t('image.flipH')}
        side="top"
        class="size-6"
        disabled={!natural}
        active={transform.flipH}
        toggle
        onclick={() => applyAndMark(flipHorizontal(transform))}
      >
        <FlipHorizontal class="size-3.5" />
      </Hint>
      <Hint
        label={t('image.flipV')}
        side="top"
        class="size-6"
        disabled={!natural}
        active={transform.flipV}
        toggle
        onclick={() => applyAndMark(flipVertical(transform))}
      >
        <FlipVertical class="size-3.5" />
      </Hint>
      <Hint
        label={t('image.resetTransform')}
        side="top"
        class="size-6"
        disabled={!transformed}
        onclick={() => applyAndMark(IDENTITY)}
      >
        <Undo2 class="size-3.5" />
      </Hint>

      {@render groupDivider()}

      <!-- 组 4：输出到别处 -->
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
                src={shownUrl}
                alt={payload.name}
                onload={onLoad}
                onerror={() => (displayFailed = true)}
                class="block max-h-none max-w-none"
                style={`width: ${displayWidth}px; height: ${displayHeight}px; visibility: ${shownSize ? 'visible' : 'hidden'};`}
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

      <ContextMenuItem class="gap-2" disabled={!tab.path} onSelect={() => void saveAs()}>
        <HardDriveDownload class="size-3.5 shrink-0" />
        <span class="truncate">{t('image.saveAs')}</span>
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

      <!--
        旋转 / 翻转。

        与工具栏上那几个按钮是**同一组操作**，两处都给是刻意的：
        工具栏便于连续点（看一张歪图时最常用），右键菜单便于发现
        （用户不会去研究工具栏每个图标）。

        它们只改内存里的显示，标脏但不写盘——用户按 Ctrl+S 才落盘。
        理由见 `actions/save-image.ts`：JPEG 重编码有损，
        不能每点一次就写一次。
      -->
      <ContextMenuItem
        class="gap-2"
        disabled={!natural}
        onSelect={() => applyAndMark(rotateCCW(transform))}
      >
        <RotateCcw class="size-3.5 shrink-0" />
        <span class="truncate">{t('image.rotateCCW')}</span>
      </ContextMenuItem>

      <ContextMenuItem
        class="gap-2"
        disabled={!natural}
        onSelect={() => applyAndMark(rotateCW(transform))}
      >
        <RotateCw class="size-3.5 shrink-0" />
        <span class="truncate">{t('image.rotateCW')}</span>
      </ContextMenuItem>

      <ContextMenuItem
        class="gap-2"
        disabled={!natural}
        onSelect={() => applyAndMark(flipHorizontal(transform))}
      >
        <FlipHorizontal class="size-3.5 shrink-0" />
        <span class="truncate">{t('image.flipH')}</span>
      </ContextMenuItem>

      <ContextMenuItem
        class="gap-2"
        disabled={!natural}
        onSelect={() => applyAndMark(flipVertical(transform))}
      >
        <FlipVertical class="size-3.5 shrink-0" />
        <span class="truncate">{t('image.flipV')}</span>
      </ContextMenuItem>

      <!--
        「重置」常驻并置灰，而不是没有变换时隐藏。

        右键菜单不像工具栏那样会被「挤动」（菜单弹出后位置就固定了），
        但两处保持一致更好：用户在工具栏看到过这一项，
        在菜单里找不到会以为菜单少了一项。
      -->
      <ContextMenuItem
        class="gap-2"
        disabled={!transformed}
        onSelect={() => applyAndMark(IDENTITY)}
      >
        <Undo2 class="size-3.5 shrink-0" />
        <span class="truncate">{t('image.resetTransform')}</span>
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

      <!--
        「设为壁纸」只在 Windows 出现。
        macOS 没有等价的公开 API（要写 com.apple.wallpaper 或走
        AppleScript，都不可靠），Rust 侧会返回不支持——
        既然点了必定失败，不如**不显示**，而不是显示一个永远报错的项。
      -->
      {#if IS_WINDOWS}
        <ContextMenuItem class="gap-2" disabled={!tab.path} onSelect={() => void setWallpaper()}>
          <Monitor class="size-3.5 shrink-0" />
          <span class="truncate">{t('image.setWallpaper')}</span>
        </ContextMenuItem>
      {/if}
    </ContextMenuContent>
  </ContextMenuRoot>
</div>
