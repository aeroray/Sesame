<script lang="ts">
/**
 * 图片查看器。
 *
 * 支持缩放、适应窗口与 1:1 原始尺寸，以及用系统默认程序打开。
 * 缩放用 transform 而不是改宽高：后者会触发重排，拖动滑块时明显卡顿。
 */
import { ExternalLink, ImageOff, Loader2, Maximize, Scan, ZoomIn, ZoomOut } from '@lucide/svelte';
import { openPath } from '@tauri-apps/plugin-opener';
import { untrack } from 'svelte';
import { reportError } from '$lib/actions/open-file';
import Hint from '$lib/components/common/Hint.svelte';
import { Button } from '$lib/components/ui/button';
import { t } from '$lib/i18n';
import { ensureImage, getImage, isLoading } from '$lib/state/images.svelte';
import type { Tab } from '$lib/state/types';
import { formatBytes } from '$lib/utils/format';

interface Props {
  tab: Tab;
}

let { tab }: Props = $props();

/** 缩放倍率。 */
let zoom = $state(1);
/** 是否处于「适应窗口」模式。 */
let fit = $state(true);
/** 图片的原始像素尺寸，由 img 元素加载后回填。 */
let natural = $state<{ w: number; h: number } | null>(null);

const payload = $derived(getImage(tab.id));
const loading = $derived(isLoading(tab.id));

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

/*
 * 标签出现时按需读取图片。
 *
 * `untrack` 是必须的：`ensureImage` 内部会读 `images` / `loading`
 * 这两个响应式源，而它自己又会写 `loading`。若让 effect 追踪这些读取，
 * 写入就会反过来触发 effect 重跑。当前靠「第二次进来就早退」收敛，
 * 但那是不必要的隐式依赖——显式 untrack 后 effect 只依赖 `tab.id` 与 `tab.path`。
 */
$effect(() => {
  const id = tab.id;
  const path = tab.path;
  if (!path) return;
  untrack(() => {
    ensureImage(id, path).catch((err) => reportError(err, t('error.readImageFailed')));
  });
});

/** 图片加载完成后记录原始尺寸，用于显示与 1:1 切换。 */
function onLoad(event: Event) {
  const img = event.currentTarget as HTMLImageElement;
  natural = { w: img.naturalWidth, h: img.naturalHeight };
}

function zoomBy(factor: number) {
  fit = false;
  zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
}

function resetZoom() {
  fit = true;
  zoom = 1;
}

function actualSize() {
  fit = false;
  zoom = 1;
}

/** 用系统默认程序打开原文件。 */
async function openExternally() {
  if (!tab.path) return;
  try {
    await openPath(tab.path);
  } catch (err) {
    reportError(err, t('error.openExternallyFailed'));
  }
}
</script>

<div class="flex h-full w-full flex-col bg-surface-sunken">
  <!-- 工具栏 -->
  <div
    class="flex h-8 shrink-0 items-center gap-1 border-b border-border-subtle bg-surface px-2 text-[11px] text-content-muted"
  >
    {#if natural}
      <span class="px-1 tabular-nums">{natural.w} × {natural.h}</span>
      <span class="text-border-strong">·</span>
    {/if}
    {#if payload}
      <span class="px-1 tabular-nums">{formatBytes(payload.size)}</span>
      <span class="text-border-strong">·</span>
      <span class="px-1 uppercase">{payload.mime.replace('image/', '')}</span>
    {/if}

    <span class="ml-auto flex items-center gap-0.5">
      <Hint label={t('image.zoomOut')} side="top" class="size-6" onclick={() => zoomBy(1 / 1.25)}>
        <ZoomOut class="size-3.5" />
      </Hint>

      <span class="w-12 px-1 text-center tabular-nums">
        {fit ? t('image.fitShort') : `${Math.round(zoom * 100)}%`}
      </span>

      <Hint label={t('image.zoomIn')} side="top" class="size-6" onclick={() => zoomBy(1.25)}>
        <ZoomIn class="size-3.5" />
      </Hint>

      <Hint
        label={t('image.fit')}
        side="top"
        class="size-6"
        active={fit}
        toggle
        onclick={resetZoom}
      >
        <Maximize class="size-3.5" />
      </Hint>

      <Hint label={t('image.actualSize')} side="top" class="size-6" onclick={actualSize}>
        <Scan class="size-3.5" />
      </Hint>

      <Hint label={t('image.openExternal')} side="top" class="size-6" onclick={openExternally}>
        <ExternalLink class="size-3.5" />
      </Hint>
    </span>
  </div>

  <!-- 图片区域 -->
  <div class="relative min-h-0 flex-1 overflow-auto">
    {#if loading && !payload}
      <div class="flex h-full items-center justify-center gap-2 text-xs text-content-faint">
        <Loader2 class="size-4 animate-spin" />
        {t('image.loading')}
      </div>
    {:else if payload}
      <!--
        缩放用「撑开一个按缩放后尺寸计算的占位盒」+ `transform: scale`。
        两者缺一不可：

        - 只用 transform：CSS transform **不改变布局盒尺寸**，
          父级 `overflow-auto` 的 scrollWidth/scrollHeight 仍按未缩放的图片算，
          于是放大后溢出的部分**没有滚动条可滚**，右侧与底部永远看不到（实测如此）。
        - 只用 width/height 缩放：每拖动一次都要重排，明显卡顿。

        因此外层盒子负责「占位与滚动范围」，内层 img 负责「绘制」。

        居中用内层盒子的 `m-auto` 而不是外层的 `justify-center`：
        内容比容器大时，flex 的居中对齐会让溢出部分**同时**向两端溢出，
        起始端（左上）因此无法滚动到——这是 flex 布局的已知行为。
        `m-auto` 在「小于容器时居中、大于容器时正常溢出」两点上都正确。
      -->
      <div class="flex min-h-full min-w-full p-4">
        <div
          class="m-auto"
          style={fit || !natural
            ? ''
            : `width: ${natural.w * zoom}px; height: ${natural.h * zoom}px; flex: none;`}
        >
          <img
            src={payload.dataUrl}
            alt={payload.name}
            onload={onLoad}
            class={fit ? 'max-h-full max-w-full object-contain' : 'origin-top-left'}
            style={fit ? '' : `transform: scale(${zoom});`}
            draggable="false"
          />
        </div>
      </div>
    {:else}
      <div class="flex h-full flex-col items-center justify-center gap-2 text-content-faint">
        <ImageOff class="size-6" />
        <p class="text-xs">{t('image.displayFailed')}</p>
      </div>
    {/if}
  </div>
</div>
