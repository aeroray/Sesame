<script lang="ts">
/**
 * 标题栏右侧的应用菜单。
 *
 * 快捷键可能被输入法或系统占用，因此每个功能都必须有可点击的入口，
 * 不能只依赖快捷键。
 */
import { Copy, FolderOpen, Keyboard, Menu, Settings, Undo2 } from '@lucide/svelte';
import { copyPath, revealInFolder } from '$lib/actions/file-actions';
import { reopenClosedTab } from '$lib/actions/reopen-tab';
import AppLogo from '$lib/components/common/AppLogo.svelte';
import { Button } from '$lib/components/ui/button';
import {
  Content as DropdownMenuContent,
  Item as DropdownMenuItem,
  Root as DropdownMenuRoot,
  Separator as DropdownMenuSeparator,
  Trigger as DropdownMenuTrigger,
} from '$lib/components/ui/dropdown-menu';
import { t } from '$lib/i18n';
import { activeTab } from '$lib/state/tabs.svelte';
import { formatKeys } from '$lib/utils/hotkeys';

interface Props {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}

let { onOpenSettings, onOpenShortcuts }: Props = $props();

/** 当前是否有带路径的文件——决定「复制路径」等项是否可用。 */
const hasFile = $derived(activeTab()?.path != null);
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
    <!--
      快捷键提示必须走 `formatKeys()`，不能写死 "Ctrl+"。
      macOS 上实际按键是 Cmd，`formatKeys` 会把它转成 `⌘`；
      写死会让 macOS 用户看到「Ctrl+,」而按 ⌘ 才有效——提示与事实不符。
      （这个文件早先就是硬编码的，改掉。）
    -->
    <DropdownMenuItem class="gap-2" onSelect={onOpenSettings}>
      <Settings class="size-3.5 shrink-0" />
      <span class="truncate">{t('menu.settings')}</span>
      <span class="ml-auto shrink-0 text-[10px] text-content-faint">{formatKeys('Ctrl+,')}</span>
    </DropdownMenuItem>

    <DropdownMenuItem class="gap-2" onSelect={onOpenShortcuts}>
      <Keyboard class="size-3.5 shrink-0" />
      <span class="truncate">{t('menu.shortcuts')}</span>
      <span class="ml-auto shrink-0 text-[10px] text-content-faint">{formatKeys('Ctrl+/')}</span>
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
      <span class="ml-auto shrink-0 text-[10px] text-content-faint">{formatKeys('Ctrl+Shift+T')}</span>
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    <!--
      主题三项**不在这里**——它们已独立成标题栏右侧的 `ThemeMenu`。
      两处都放会让用户猜「哪个才是真的」，而单一入口更清楚。
    -->

    <DropdownMenuItem class="gap-2 text-content-faint" disabled>
      <AppLogo class="size-4" />
      <span class="truncate">Sesame 0.1.0</span>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenuRoot>
