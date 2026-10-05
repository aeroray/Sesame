<script lang="ts">
  /**
   * 标题栏右侧的应用菜单。
   *
   * 快捷键可能被输入法或系统占用，因此每个功能都必须有可点击的入口，
   * 不能只依赖快捷键。
   */
  import {
    Menu,
    Settings,
    Keyboard,
    Sun,
    Moon,
    Monitor,
    Info,
    Copy,
    FolderOpen,
    Undo2,
  } from '@lucide/svelte';
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
  import { activeTab } from '$lib/state/tabs.svelte';
  import { copyPath, revealInFolder } from '$lib/actions/file-actions';
  import { reopenClosedTab } from '$lib/actions/reopen-tab';
  import { t } from '$lib/i18n';

  interface Props {
    onOpenSettings: () => void;
    onOpenShortcuts: () => void;
  }

  let { onOpenSettings, onOpenShortcuts }: Props = $props();

  /** 当前是否有带路径的文件——决定「复制路径」等项是否可用。 */
  const hasFile = $derived(activeTab()?.path != null);

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

  <DropdownMenuContent align="end" class="w-60">
    <DropdownMenuItem class="gap-2" onSelect={onOpenSettings}>
      <Settings class="size-3.5 shrink-0" />
      <span class="truncate">{t('menu.settings')}</span>
      <span class="ml-auto shrink-0 text-[10px] text-content-faint">Ctrl+,</span>
    </DropdownMenuItem>

    <DropdownMenuItem class="gap-2" onSelect={onOpenShortcuts}>
      <Keyboard class="size-3.5 shrink-0" />
      <span class="truncate">{t('menu.shortcuts')}</span>
      <span class="ml-auto shrink-0 text-[10px] text-content-faint">Ctrl+/</span>
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    <!--
      针对「当前文件」的操作。
      没有激活标签时置灰，而不是点了才发现没有路径——
      置灰能让用户一眼看出「现在没有文件可操作」。

      所有文字都套 `truncate` 且不换行：英文文案比中文长得多
      （「Reopen closed tab」是「重新打开已关闭的标签」的等长译法），
      不截断就会折成两行，把菜单项撑高、失去对齐。
    -->
    <DropdownMenuItem
      class="gap-2"
      disabled={!hasFile}
      onSelect={() => void copyPath()}
    >
      <Copy class="size-3.5 shrink-0" />
      <span class="truncate">{t('action.copyPath')}</span>
    </DropdownMenuItem>

    <DropdownMenuItem
      class="gap-2"
      disabled={!hasFile}
      onSelect={() => void revealInFolder()}
    >
      <FolderOpen class="size-3.5 shrink-0" />
      <span class="truncate">{t('action.revealInFolder')}</span>
    </DropdownMenuItem>

    <DropdownMenuItem class="gap-2" onSelect={() => void reopenClosedTab()}>
      <Undo2 class="size-3.5 shrink-0" />
      <span class="truncate">{t('action.reopenClosed')}</span>
      <span class="ml-auto shrink-0 text-[10px] text-content-faint">Ctrl+Shift+T</span>
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

    <DropdownMenuItem class="gap-2" onSelect={() => pickTheme('system')}>
      <Monitor class="size-3.5 shrink-0" />
      <span class="truncate">{t('menu.themeSystem')}</span>
      {#if settings.theme === 'system'}
        <span class="ml-auto shrink-0 text-[10px] text-brand-600">{t('menu.current')}</span>
      {/if}
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    <DropdownMenuItem class="gap-2 text-content-faint" disabled>
      <Info class="size-3.5 shrink-0" />
      <span class="truncate">Sesame 0.1.0</span>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenuRoot>
