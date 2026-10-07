<script lang="ts">
/**
 * 标题栏左侧的应用菜单。
 *
 * 快捷键可能被输入法或系统占用，因此每个功能都必须有可点击的入口，
 * 不能只依赖快捷键。
 *
 * ## 为什么只剩两项
 *
 * 这里原先是八项平铺：设置、快捷键、复制路径、在文件夹中显示、
 * 重开已关闭标签、版本号。问题不是「项太多」，而是**混了三种归属**——
 * 有的属于整个应用，有的针对具体文件，有的只是一个版本号。
 * 混在一起的结果是用户每次都要通读全表才能找到想要的那个。
 *
 * 按归属重新分配后：
 *
 * - **针对文件的**（复制路径、在文件夹中显示）→ 标签的右键菜单。
 *   右键的对象就是操作对象，不必先激活标签再回左上角找菜单。
 * - **重开已关闭标签** → 标签栏空白处与内容区的右键菜单，
 *   并保留 Ctrl+Shift+T。用户想「找回刚关掉的标签」时视线在标签栏，
 *   不该要求他去左上角的菜单里翻。
 * - **版本号** → 设置面板的「关于」分类。原先那一行是**置灰的**，
 *   放一个点不动的条目在菜单里，除了占地方没有别的作用。
 *
 * 留下的两项都是「与具体文件无关、且不在别处」的应用级入口。
 */
import { Keyboard, Menu, Settings } from '@lucide/svelte';
import { Button } from '$lib/components/ui/button';
import {
  Content as DropdownMenuContent,
  Item as DropdownMenuItem,
  Root as DropdownMenuRoot,
  Trigger as DropdownMenuTrigger,
} from '$lib/components/ui/dropdown-menu';
import { t } from '$lib/i18n';
import { formatKeys } from '$lib/utils/hotkeys';

interface Props {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}

let { onOpenSettings, onOpenShortcuts }: Props = $props();
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

  <DropdownMenuContent align="start" class="w-60">
    <!--
      快捷键提示必须走 `formatKeys()`，不能写死 "Ctrl+"。
      macOS 上实际按键是 Cmd，`formatKeys` 会把它转成 `⌘`；
      写死会让 macOS 用户看到「Ctrl+,」而按 ⌘ 才有效——提示与事实不符。
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
  </DropdownMenuContent>
</DropdownMenuRoot>
