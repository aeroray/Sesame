<script lang="ts">
/**
 * 左侧栏：已打开的文件与最近文件。
 *
 * 默认折叠（见 layout.svelte.ts），需要时按 Ctrl+B 展开。
 * 窄窗口下自动折叠，避免挤压编辑区。
 */
import { Clock, Layers, Moon, X } from '@lucide/svelte';
import { requestCloseTab } from '$lib/actions/close-tab';
import { openPath } from '$lib/actions/open-file';
import RecentMenuItems from '$lib/components/common/RecentMenuItems.svelte';
import { Button } from '$lib/components/ui/button';
import {
  Content as ContextMenuContent,
  Root as ContextMenuRoot,
  Trigger as ContextMenuTrigger,
} from '$lib/components/ui/context-menu';
import { ScrollArea } from '$lib/components/ui/scroll-area';
import {
  Content as TooltipContent,
  Provider as TooltipProvider,
  Root as TooltipRoot,
  Trigger as TooltipTrigger,
} from '$lib/components/ui/tooltip';
import { t } from '$lib/i18n';
import { recents, removeRecent } from '$lib/state/recents.svelte';
import { activateTab, tabs } from '$lib/state/tabs.svelte';
import { cn } from '$lib/utils/cn';
import { fileIcon } from '$lib/utils/file-icon';
import { formatRelativeTime } from '$lib/utils/format';
import { RECENT_DISPLAY_LIMIT } from '$src/constants';

let { open }: { open: boolean } = $props();

const visibleRecents = $derived(recents.items.slice(0, RECENT_DISPLAY_LIMIT));

/** 已在标签页中打开的文件路径集合，用于避免在最近列表里重复展示。 */
const openPaths = $derived(new Set(tabs.items.map((t) => t.path).filter(Boolean)));

/** 过滤掉已经打开的，避免同一文件出现两次。 */
const otherRecents = $derived(visibleRecents.filter((r) => !openPaths.has(r.path)));
</script>

<aside
  class={cn(
    'flex shrink-0 flex-col overflow-hidden border-r border-border-subtle bg-surface-sunken transition-[width] duration-200',
    open ? 'w-56' : 'w-0 border-r-0',
  )}
  aria-hidden={!open}
>
  {#if open}
    <ScrollArea class="min-h-0 flex-1">
      <!--
        pr-2 是给滚动条让位：bits-ui 的滚动条是 absolute 覆盖式（宽 10px），
        不会自己撑开空间。容器若只留 p-2（8px），内容右缘会被滚动条压住。
        这里右侧给 8(p-2) + 8(pr-2) = 16px > 10px，文字不再被遮挡。
      -->
      <div class="flex flex-col gap-3 p-2 pr-4">
        <!-- 已打开 -->
        <section class="flex flex-col gap-1">
          <div class="flex items-center gap-1.5 px-1.5 py-1">
            <Layers class="size-3 text-content-faint" />
            <span class="text-[11px] font-medium tracking-wide text-content-faint"
              >{t('sidebar.open')}</span
            >
            <span class="ml-auto text-[10px] tabular-nums text-content-faint">
              {tabs.items.length}
            </span>
          </div>

          {#if tabs.items.length === 0}
            <p class="px-1.5 py-1 text-[11px] text-content-faint">{t('sidebar.noOpenFiles')}</p>
          {:else}
            {#each tabs.items as tab (tab.id)}
              <!--
                `{@const}` 必须是 `{#each}` 的直接子元素，不能放进 `<button>` 里
                （Svelte 语法限制）。
              -->
              {@const TabIcon = fileIcon(tab.kind, tab.language)}
              <div
                class={cn(
                  'group flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors',
                  tab.id === tabs.activeId
                    ? 'bg-brand-100 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100'
                    : 'text-content-muted hover:bg-surface hover:text-content',
                )}
              >
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onclick={() => activateTab(tab.id)}
                  title={tab.path ?? tab.name}
                >
                  <TabIcon class="size-3.5 shrink-0 opacity-70" />
                  <span class="min-w-0 flex-1 truncate">{tab.name}</span>
                  {#if tab.dirty}
                    <span class="size-1.5 shrink-0 rounded-full bg-brand-500"></span>
                  {:else if tab.sleep === 'deep'}
                    <TooltipProvider delayDuration={400}>
                      <TooltipRoot>
                        <TooltipTrigger>
                          {#snippet child({ props })}
                            <span
                              {...props}
                              class="shrink-0 text-[9px] text-content-faint"
                              aria-label={t('sidebar.sleepingShort')}
                            >
                              <Moon class="size-3" />
                            </span>
                          {/snippet}
                        </TooltipTrigger>
                        <TooltipContent side="right">{t('sidebar.sleeping')}</TooltipContent>
                      </TooltipRoot>
                    </TooltipProvider>
                  {/if}
                </button>

                <!-- 操作列始终占位，避免行宽随悬停跳动 -->
                <span class="flex w-5 shrink-0 justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-5 text-content-faint opacity-0 transition-opacity hover:text-content group-hover:opacity-100 focus-visible:opacity-100"
                    onclick={() => requestCloseTab(tab)}
                    aria-label={t('tab.close', { name: tab.name })}
                  >
                    <X class="size-3" />
                  </Button>
                </span>
              </div>
            {/each}
          {/if}
        </section>

        <!-- 最近 -->
        <section class="flex flex-col gap-1">
          <div class="flex items-center gap-1.5 px-1.5 py-1">
            <Clock class="size-3 text-content-faint" />
            <span class="text-[11px] font-medium tracking-wide text-content-faint"
              >{t('sidebar.recent')}</span
            >
          </div>

          {#if otherRecents.length === 0}
            <p class="px-1.5 py-1 text-[11px] text-content-faint">{t('sidebar.noOtherRecents')}</p>
          {:else}
            {#each otherRecents as entry (entry.path)}
              {@const RecentIcon = fileIcon(entry.kind, entry.language)}
              <!-- 整行包在右键菜单里，与首屏的「最近打开」一致。 -->
              <ContextMenuRoot>
                <ContextMenuTrigger>
                  {#snippet child({ props })}
                    <div
                      {...props}
                      class="group flex items-center rounded-md px-1.5 py-1 text-xs text-content-muted transition-colors hover:bg-surface hover:text-content"
                    >
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onclick={() => openPath(entry.path)}
                  title={entry.path}
                >
                  <RecentIcon class="size-3.5 shrink-0 opacity-50" />
                  <span class="min-w-0 flex-1 truncate">{entry.name}</span>
                </button>

                <!--
                  时间与「移除」共用同一位置：悬停时时间淡出、按钮淡入。
                  容器宽度固定、两者重叠，悬停不改变布局。

                  侧栏**不显示路径**：它只有 224px 宽，文件名常常已经占满，
                  再挤一列位置会把文件名截得更短——而文件名才是这里最该看的东西。
                  完整路径在 `title` 里，且右键菜单提供「在文件夹中显示」。
                -->
                <span class="relative flex w-14 shrink-0 justify-end">
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
                    <X class="size-3" />
                  </span>
                </span>
                    </div>
                  {/snippet}
                </ContextMenuTrigger>

                <ContextMenuContent class="w-56">
                  <RecentMenuItems {entry} />
                </ContextMenuContent>
              </ContextMenuRoot>
            {/each}
          {/if}
        </section>
      </div>
    </ScrollArea>
  {/if}
</aside>
