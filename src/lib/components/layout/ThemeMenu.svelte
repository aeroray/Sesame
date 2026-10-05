<script lang="ts">
/**
 * 主题切换按钮。
 *
 * ## 从「亮/暗/跟随系统」改成完整主题列表
 *
 * 原来这里只有三个选项。改成主题制后，一套主题同时决定界面配色与
 * 编辑器配色（含语法高亮），因此按钮列出的是**具体主题**，
 * 而不是抽象的亮暗模式。
 *
 * ## 图标反映当前主题的亮暗
 *
 * 主题自带 `mode`，用它选图标——用户想一眼看出「现在是亮还是暗」。
 * 这比给每套主题画一个专属图标务实：13 套主题画 13 个图标，
 * 既难辨认也难维护。
 *
 * ## 每一项左侧显示配色预览
 *
 * 用两个小色块（背景 + 强调色）示意，比纯文字列表直观得多——
 * 「Dracula 长什么样」光看名字想不起来。
 */
import { Check, Moon, Sun } from '@lucide/svelte';
import { Button } from '$lib/components/ui/button';
import {
  Content as DropdownMenuContent,
  Item as DropdownMenuItem,
  Root as DropdownMenuRoot,
  Trigger as DropdownMenuTrigger,
} from '$lib/components/ui/dropdown-menu';
import { t } from '$lib/i18n';
import { settings, updateSetting } from '$lib/state/settings.svelte';
import { getTheme } from '$lib/state/theme.svelte';
import { THEMES } from '$lib/theme/palettes';

/** 当前主题。 */
const current = $derived(getTheme());
</script>

<DropdownMenuRoot>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="ghost"
        size="icon"
        class="size-9 rounded-none text-content-muted hover:bg-surface hover:text-content"
        aria-label={t('settings.theme')}
      >
        {#if current.mode === 'dark'}
          <Moon class="size-4" />
        {:else}
          <Sun class="size-4" />
        {/if}
      </Button>
    {/snippet}
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end" class="w-56">
    {#each THEMES as item (item.id)}
      <DropdownMenuItem class="gap-2" onSelect={() => updateSetting('theme', item.id)}>
        <!--
          配色预览：左半是背景、右半是强调色。
          用内联 style 而不是工具类——色值来自主题数据，不是固定的设计令牌。
        -->
        <span
          class="flex size-3.5 shrink-0 overflow-hidden rounded-sm ring-1 ring-border-subtle"
          aria-hidden="true"
        >
          <span class="h-full w-1/2" style="background-color: {item.bg}"></span>
          <span class="h-full w-1/2" style="background-color: {item.accent}"></span>
        </span>
        <span class="truncate">{item.name}</span>
        {#if settings.theme === item.id}
          <Check class="ml-auto size-3.5 shrink-0 text-brand-500" />
        {/if}
      </DropdownMenuItem>
    {/each}
  </DropdownMenuContent>
</DropdownMenuRoot>
