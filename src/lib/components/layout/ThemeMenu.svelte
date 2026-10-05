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
 * ## 按浅色 / 深色分组
 *
 * 13 套主题平铺会让菜单很长且难找。按亮暗分组后：
 *
 * - 想换「亮一点的」的人直接在「浅色」组里挑
 * - 组内按亮度排，视觉上有秩序
 *
 * 分组标题用 `DropdownMenuLabel`，与菜单里的其他分组标题样式一致。
 *
 * ## 缩略图见 ThemeThumbnail
 *
 * 画的是**缩略代码**而不是色块——色块看不出主题的性格，
 * 而用户真正在意的是代码显示出来的效果。
 */
import { Check, Moon, Sun } from '@lucide/svelte';
import ThemeThumbnail from '$lib/components/common/ThemeThumbnail.svelte';
import { Button } from '$lib/components/ui/button';
import {
  Content as DropdownMenuContent,
  Item as DropdownMenuItem,
  Label as DropdownMenuLabel,
  Root as DropdownMenuRoot,
  Separator as DropdownMenuSeparator,
  Trigger as DropdownMenuTrigger,
} from '$lib/components/ui/dropdown-menu';
import { t } from '$lib/i18n';
import { settings, updateSetting } from '$lib/state/settings.svelte';
import { getTheme } from '$lib/state/theme.svelte';
import { THEMES, type ThemeDefinition } from '$lib/theme/palettes';

/** 当前主题。 */
const current = $derived(getTheme());

/** 按亮暗分组。 */
const lightThemes = $derived(THEMES.filter((item) => item.mode === 'light'));
const darkThemes = $derived(THEMES.filter((item) => item.mode === 'dark'));

/** 渲染一组主题。 */
function pick(item: ThemeDefinition) {
  void updateSetting('theme', item.id);
}
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

  <DropdownMenuContent align="end" class="w-64">
    <DropdownMenuLabel class="text-[11px] font-normal text-content-faint">
      {t('settings.themeLight')}
    </DropdownMenuLabel>
    {#each lightThemes as item (item.id)}
      <DropdownMenuItem class="gap-2.5" onSelect={() => pick(item)}>
        <ThemeThumbnail theme={item} size="sm" />
        <span class="truncate">{item.name}</span>
        {#if settings.theme === item.id}
          <Check class="ml-auto size-3.5 shrink-0 text-brand-500" />
        {/if}
      </DropdownMenuItem>
    {/each}

    <DropdownMenuSeparator />

    <DropdownMenuLabel class="text-[11px] font-normal text-content-faint">
      {t('settings.themeDark')}
    </DropdownMenuLabel>
    {#each darkThemes as item (item.id)}
      <DropdownMenuItem class="gap-2.5" onSelect={() => pick(item)}>
        <ThemeThumbnail theme={item} size="sm" />
        <span class="truncate">{item.name}</span>
        {#if settings.theme === item.id}
          <Check class="ml-auto size-3.5 shrink-0 text-brand-500" />
        {/if}
      </DropdownMenuItem>
    {/each}
  </DropdownMenuContent>
</DropdownMenuRoot>
