<script lang="ts">
  /**
   * 欢迎页：空白标签页的内容。
   *
   * 采用「最近文件优先」布局——打开旧文件是高频动作，
   * 新建/打开两个动作在上方按钮与标题栏都能触达。
   */
  import { FileText, FolderOpen, Clock, X } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { recents, clearRecents, removeRecent } from '$lib/state/recents.svelte';
  import { openPath, openViaDialog } from '$lib/actions/open-file';
  import { newTab } from '$lib/actions/new-tab';
  import { formatRelativeTime, basename, dirname } from '$lib/utils/format';
  import { RECENT_DISPLAY_LIMIT } from '$src/constants';
  import { t } from '$lib/i18n';

  /** 只展示前若干条，避免首屏过长。 */
  const visible = $derived(recents.items.slice(0, RECENT_DISPLAY_LIMIT));
</script>

<div class="flex h-full w-full items-center justify-center overflow-hidden bg-surface p-6">
  <div class="flex w-full max-w-lg flex-col gap-5">
    <!-- 品牌区 -->
    <div class="flex flex-col items-center gap-2">
      <div
        class="flex size-11 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/40"
      >
        <span class="text-lg font-semibold text-brand-700 dark:text-brand-300">S</span>
      </div>
      <h1 class="text-base font-medium text-content">Sesame</h1>
      <p class="text-xs text-content-faint">{t('app.tagline')}</p>
    </div>

    <!-- 主操作 -->
    <div class="flex justify-center gap-2">
      <Button variant="outline" size="sm" class="gap-1.5" onclick={newTab}>
        <FileText class="size-3.5" />
        {t('welcome.newFile')}
      </Button>
      <Button variant="outline" size="sm" class="gap-1.5" onclick={openViaDialog}>
        <FolderOpen class="size-3.5" />
        {t('welcome.openFile')}
      </Button>
    </div>

    <!-- 最近文件 -->
    <div class="flex min-h-0 flex-col gap-2">
      <!--
        表头右侧内边距必须与「列表行的内容右缘」对齐，否则「清空」会比时间戳更靠右。

        列表行的右缘位置（从面板右边缘算起）：
          pr-3（滚动条让位 12px）+ 行内 px-2（8px）= 20px
        表头因此用 pl-2 + pr-5（20px），与行内容右缘一致。

        另外按钮自身有 px-1.5（6px）内边距，会让文字比按钮盒子再缩进 6px，
        所以补一个 -mr-1.5 把盒子右移回来，这样「清空」两个字才真正与时间戳右缘对齐。
      -->
      <div class="flex items-center gap-1.5 pl-2 pr-5">
        <Clock class="size-3 shrink-0 text-content-faint" />
        <span class="text-[11px] font-medium tracking-wide text-content-faint"
          >{t('welcome.recentHeader')}</span
        >
        {#if visible.length > 0}
          <Button
            variant="ghost"
            size="sm"
            class="-mr-1.5 ml-auto h-5 px-1.5 text-[11px] text-content-faint hover:text-content"
            onclick={clearRecents}
          >
            {t('welcome.clear')}
          </Button>
        {/if}
      </div>

      {#if visible.length === 0}
        <div
          class="flex flex-col items-center gap-1.5 rounded-md border border-dashed border-border-strong px-4 py-8 text-center"
        >
          <p class="text-xs text-content-faint">{t('welcome.emptyTitle')}</p>
          <p class="text-[11px] text-content-faint">{t('welcome.emptyHint')}</p>
        </div>
      {:else}
        <ScrollArea class="max-h-64">
          <div class="flex flex-col gap-0.5 pr-3">
            {#each visible as entry (entry.path)}
              <div
                class="group flex items-center rounded-md px-2 py-1.5 transition-colors hover:bg-surface-sunken"
              >
                <!--
                  整行是一个按钮，时间列与「移除」按钮共用同一个位置：
                  悬停时时间淡出、按钮淡入。这样行尾不再多出一列，
                  也就不存在「没悬停时看着缺一块」的问题。
                  容器宽度固定、两者重叠，悬停不改变任何布局。

                  「移除」是 span + role=button 而不是嵌套 button——
                  button 里嵌 button 是非法 HTML，浏览器会打乱 DOM 结构。
                -->
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  onclick={() => openPath(entry.path)}
                  title={entry.path}
                >
                  <FileText class="size-3.5 shrink-0 text-content-faint" />
                  <span class="min-w-0 flex-1 truncate text-xs text-content">{entry.name}</span>
                  <span class="shrink-0 truncate text-[10px] text-content-faint">
                    {basename(dirname(entry.path))}
                  </span>
                </button>

                <span class="relative flex w-16 shrink-0 justify-end">
                  <span
                    class="text-[10px] tabular-nums text-content-faint transition-opacity group-hover:opacity-0"
                  >
                    {formatRelativeTime(entry.openedAt)}
                  </span>

                  <span
                    role="button"
                    tabindex="0"
                    class="absolute inset-y-0 right-0 flex w-5 cursor-pointer items-center justify-center rounded-xs text-content-faint opacity-0 transition-opacity hover:text-content focus-visible:opacity-100 group-hover:opacity-100"
                    onclick={() => removeRecent(entry.path)}
                    onkeydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        removeRecent(entry.path);
                      }
                    }}
                    aria-label={t('sidebar.removeFromList', { name: entry.name })}
                  >
                    <!-- 尺寸与侧栏保持一致（size-3），两处图标不该有大小差 -->
                    <X class="size-3" />
                  </span>
                </span>
              </div>
            {/each}
          </div>
        </ScrollArea>
      {/if}
    </div>
  </div>
</div>
