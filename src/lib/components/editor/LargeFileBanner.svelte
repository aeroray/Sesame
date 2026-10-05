<script lang="ts">
  /**
   * 大文件提示条。
   *
   * 文件超过阈值时只加载了首块，这里告诉用户当前状态并提供「继续加载」入口。
   * 不自动全部加载，是因为把几百兆文本铺进 WebView 会让应用直接卡死。
   */
  import { Loader2, FileWarning, ChevronsDown } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { formatBytes } from '$lib/utils/format';
  import type { ChunkProgress } from '$lib/editor/large-file.svelte';

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
</script>

<div
  class="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-brand-50 px-3 py-1.5 text-xs text-brand-900 dark:bg-brand-900/25 dark:text-brand-100"
>
  <FileWarning class="size-3.5 shrink-0" />

  <span class="shrink-0">
    大文件模式：已载入 {formatBytes(progress.loadedBytes)} / {formatBytes(progress.totalBytes)}（{percent}%）
  </span>

  <!-- 进度条 -->
  <div class="h-1 min-w-16 flex-1 overflow-hidden rounded-full bg-brand-200 dark:bg-brand-900/50">
    <div class="h-full rounded-full bg-brand-600 transition-[width]" style="width: {percent}%"></div>
  </div>

  <div class="flex shrink-0 items-center gap-1">
    {#if progress.loading}
      <span class="flex items-center gap-1 text-[11px] opacity-80">
        <Loader2 class="size-3 animate-spin" />
        载入中
      </span>
    {:else}
      <Button
        variant="ghost"
        size="sm"
        class="h-5 px-1.5 text-[11px] text-brand-900 hover:bg-brand-100 dark:text-brand-100 dark:hover:bg-brand-900/40"
        onclick={onLoadMore}
      >
        <ChevronsDown class="size-3" />
        继续加载
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="h-5 px-1.5 text-[11px] text-brand-900 hover:bg-brand-100 dark:text-brand-100 dark:hover:bg-brand-900/40"
        onclick={onLoadAll}
      >
        全部加载
      </Button>
    {/if}
  </div>
</div>
