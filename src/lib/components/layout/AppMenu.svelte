<script lang="ts">
  /**
   * 标题栏右侧的应用菜单。
   *
   * 快捷键可能被输入法或系统占用，因此每个功能都必须有可点击的入口，
   * 不能只依赖快捷键。
   */
  import { Menu, Settings, Keyboard, Sun, Moon, Monitor, Info } from '@lucide/svelte';
  import {
    Root as DropdownMenuRoot,
    Trigger as DropdownMenuTrigger,
    Content as DropdownMenuContent,
    Item as DropdownMenuItem,
    Separator as DropdownMenuSeparator,
    Label as DropdownMenuLabel,
  } from '$lib/components/ui/dropdown-menu';
  import { Button } from '$lib/components/ui/button';
  import { setMode } from 'mode-watcher';
  import { settings, updateSetting } from '$lib/state/settings.svelte';
  import { t } from '$lib/i18n';

  interface Props {
    onOpenSettings: () => void;
    onOpenShortcuts: () => void;
  }

  let { onOpenSettings, onOpenShortcuts }: Props = $props();

  /** 切换主题并落盘。 */
  async function pickTheme(value: 'light' | 'dark' | 'system') {
    await updateSetting('theme', value);
    setMode(value);
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
        aria-label={t('menu.label')}
      >
        <Menu class="size-4" />
      </Button>
    {/snippet}
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end" class="w-48">
    <DropdownMenuItem class="gap-2" onSelect={onOpenSettings}>
      <Settings class="size-3.5" />
      {t('menu.settings')}
      <span class="ml-auto text-[10px] text-content-faint">Ctrl+,</span>
    </DropdownMenuItem>

    <DropdownMenuItem class="gap-2" onSelect={onOpenShortcuts}>
      <Keyboard class="size-3.5" />
      {t('menu.shortcuts')}
      <span class="ml-auto text-[10px] text-content-faint">Ctrl+/</span>
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    <DropdownMenuLabel class="text-[11px] font-normal text-content-faint"
      >{t('menu.theme')}</DropdownMenuLabel
    >

    <!--
      三个选项一律比对 settings.theme（用户的偏好），
      不能拿 mode.current（已解析的实际主题）来判断——
      系统为深色时，mode.current 与 settings.theme === 'system' 会同时成立，
      导致「深色」和「跟随系统」都显示为当前。
    -->
    <DropdownMenuItem class="gap-2" onSelect={() => pickTheme('light')}>
      <Sun class="size-3.5" />
      {t('menu.themeLight')}
      {#if settings.theme === 'light'}
        <span class="ml-auto text-[10px] text-brand-600">{t('menu.current')}</span>
      {/if}
    </DropdownMenuItem>

    <DropdownMenuItem class="gap-2" onSelect={() => pickTheme('dark')}>
      <Moon class="size-3.5" />
      {t('menu.themeDark')}
      {#if settings.theme === 'dark'}
        <span class="ml-auto text-[10px] text-brand-600">{t('menu.current')}</span>
      {/if}
    </DropdownMenuItem>

    <DropdownMenuItem class="gap-2" onSelect={() => pickTheme('system')}>
      <Monitor class="size-3.5" />
      {t('menu.themeSystem')}
      {#if settings.theme === 'system'}
        <span class="ml-auto text-[10px] text-brand-600">{t('menu.current')}</span>
      {/if}
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    <DropdownMenuItem class="gap-2 text-content-faint" disabled>
      <Info class="size-3.5" />
      Sesame 0.1.0
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenuRoot>
