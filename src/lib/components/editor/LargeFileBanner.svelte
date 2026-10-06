<script lang="ts">
/**
 * 大文件提示条。
 *
 * 文件超过阈值时只加载了首块，这里告诉用户当前状态并提供「继续加载」入口。
 * 不自动全部加载，是因为把几百兆文本铺进 WebView 会让应用直接卡死。
 *
 * 另外提醒「查找只覆盖已加载部分」——这是个容易踩的坑：
 * 用户按 Ctrl+F 搜一个词、没搜到，会以为文件里确实没有，
 * 而实际上那部分内容还没加载进来。
 */
import { ChevronsDown, FileWarning, Loader2, Plus, SearchX } from '@lucide/svelte';
import { Button } from '$lib/components/ui/button';
import type { ChunkProgress } from '$lib/editor/large-file.svelte';
import { t } from '$lib/i18n';
import { formatBytes } from '$lib/utils/format';

interface Props {
  progress: ChunkProgress;
  onLoadMore: () => void;
  onLoadAll: () => void;
}

let { progress, onLoadMore, onLoadAll }: Props = $props();

/** 已加载百分比。 */
const percent = $derived(
  progress.totalBytes > 0
    ? Math.min(100, Math.round((progress.loadedBytes / progress.totalBytes) * 100))
    : 100,
);

/** 尚未加载的字节数，用于查找提示。 */
const remaining = $derived(Math.max(0, progress.totalBytes - progress.loadedBytes));
</script>

<div
  class="flex shrink-0 flex-col border-b border-border-subtle bg-brand-50 text-xs text-brand-900 dark:bg-brand-900/25 dark:text-brand-100"
>
  <div class="flex items-center gap-2 px-3 py-1.5">
    <FileWarning class="size-3.5 shrink-0" />

    <span class="shrink-0">
      {t('editor.largeFileTitle')} · {t('editor.largeFileProgress', {
        loaded: formatBytes(progress.loadedBytes),
        total: formatBytes(progress.totalBytes),
        percent,
      })}
    </span>

    <!-- 进度条 -->
    <div class="h-1 min-w-16 flex-1 overflow-hidden rounded-full bg-brand-200 dark:bg-brand-900/50">
      <div class="h-full rounded-full bg-brand-600 transition-[width]" style="width: {percent}%"></div>
    </div>

    <div class="flex shrink-0 items-center gap-1">
      {#if progress.loading}
        <span class="flex items-center gap-1 text-[11px] opacity-80">
          <Loader2 class="size-3 animate-spin" />
          {t('editor.loadingMore')}
        </span>
      {:else}
        <!--
          「继续加载」用 `Plus`：它的语义是「再加一块」，
          与「分块加载、每次追加一段」的机制直接对应。

          早先用 `ChevronsDown`（双下箭头），那更像「滚到最底部」，
          容易被理解成跳转而不是加载。
          「全部加载」则保留 `ChevronsDown`——一次到底，语义正合适。
        -->
        <Button
          variant="ghost"
          size="sm"
          class="h-5 px-1.5 text-[11px] text-brand-900 hover:bg-brand-100 dark:text-brand-100 dark:hover:bg-brand-900/40"
          onclick={onLoadMore}
        >
          <Plus class="size-3" />
          {t('editor.loadMore')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-5 px-1.5 text-[11px] text-brand-900 hover:bg-brand-100 dark:text-brand-100 dark:hover:bg-brand-900/40"
          onclick={onLoadAll}
        >
          <ChevronsDown class="size-3" />
          {t('editor.loadAll')}
        </Button>
      {/if}
    </div>
  </div>

  <!--
    查找范围提醒。
    用比主行更弱的透明度，避免与进度信息争注意力——
    它是「注意事项」，不是当前状态。
  -->
  <div class="flex items-center gap-1.5 px-3 pb-1.5 text-[11px] opacity-75">
    <SearchX class="size-3 shrink-0" />
    <span>{t('editor.searchPartial', { remaining: formatBytes(remaining) })}</span>
  </div>
</div>
