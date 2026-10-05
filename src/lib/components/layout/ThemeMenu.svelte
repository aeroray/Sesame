<script lang="ts">
/**
 * 主题切换按钮。
 *
 * 从 `AppMenu` 里独立出来，放到标题栏右侧单独成键——
 * 主题是高频操作，藏在两级菜单里要多点一次；而它只需要三个选项，
 * 独占一个按钮的代价很小。
 *
 * ## 图标反映当前实际主题
 *
 * 用 `mode.current`（已解析的实际主题）而不是 `settings.theme`：
 * 跟随系统时 `settings.theme` 是 `'system'`，那不是一个可画的图标；
 * 而用户真正想知道的是「现在屏幕上是亮还是暗」。
 *
 * ## 勾选状态必须比对 `settings.theme`
 *
 * 这两个判断用了不同的来源，不能合并：
 * 系统为深色时，`mode.current === 'dark'` 与
 * `settings.theme === 'system'` 会**同时成立**，
 * 若用 `mode.current` 判断勾选，「深色」和「跟随系统」会都显示为当前。
 */
import { Monitor, Moon, Sun } from '@lucide/svelte';
import { mode, setMode } from 'mode-watcher';
import { Button } from '$lib/components/ui/button';
import {
  Content as DropdownMenuContent,
  Item as DropdownMenuItem,
  Root as DropdownMenuRoot,
  Separator as DropdownMenuSeparator,
  Trigger as DropdownMenuTrigger,
} from '$lib/components/ui/dropdown-menu';
import { t } from '$lib/i18n';
import { settings, updateSetting } from '$lib/state/settings.svelte';

/** 切换主题并落盘。 */
async function pickTheme(value: 'light' | 'dark' | 'system') {
  await updateSetting('theme', value);
  setMode(value);
}

/** 当前实际主题，用于决定按钮图标。 */
const current = $derived(mode.current ?? 'light');
</script>

<DropdownMenuRoot>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="ghost"
        size="icon"
        class="size-9 rounded-none text-content-muted hover:bg-surface hover:text-content"
        aria-label={t('menu.theme')}
      >
        {#if current === 'dark'}
          <Moon class="size-4" />
        {:else}
          <Sun class="size-4" />
        {/if}
      </Button>
    {/snippet}
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end" class="w-44">
    <DropdownMenuItem class="gap-2" onSelect={() => pickTheme('light')}>
      <Sun class="size-3.5 shrink-0" />
      <span class="truncate">{t('menu.themeLight')}</span>
      {#if settings.theme === 'light'}
        <span class="ml-auto shrink-0 text-[10px] text-brand-600">{t('menu.current')}</span>
      {/if}
    </DropdownMenuItem>

    <DropdownMenuItem class="gap-2" onSelect={() => pickTheme('dark')}>
      <Moon class="size-3.5 shrink-0" />
      <span class="truncate">{t('menu.themeDark')}</span>
      {#if settings.theme === 'dark'}
        <span class="ml-auto shrink-0 text-[10px] text-brand-600">{t('menu.current')}</span>
      {/if}
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    <DropdownMenuItem class="gap-2" onSelect={() => pickTheme('system')}>
      <Monitor class="size-3.5 shrink-0" />
      <span class="truncate">{t('menu.themeSystem')}</span>
      {#if settings.theme === 'system'}
        <span class="ml-auto shrink-0 text-[10px] text-brand-600">{t('menu.current')}</span>
      {/if}
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenuRoot>
