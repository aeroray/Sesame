<script lang="ts">
/**
 * 快捷键一览。
 */

import { Button } from '$lib/components/ui/button';
import {
  Content as DialogContent,
  Description as DialogDescription,
  Footer as DialogFooter,
  Header as DialogHeader,
  Root as DialogRoot,
  Title as DialogTitle,
} from '$lib/components/ui/dialog';
import { Kbd } from '$lib/components/ui/kbd';
import { type MessageKey, t } from '$lib/i18n';
import { EDITOR_HOTKEYS, formatKeys } from '$lib/utils/hotkeys';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

let { open = $bindable(), onOpenChange }: Props = $props();

/**
 * 应用级快捷键分组。
 *
 * 必须与 `Shell.svelte` 里 `registerHotkeys([...])` 注册的保持一致。
 * 之所以没做成「自动从注册表生成」：面板要在注册之前渲染，
 * 而且这两份内容一处是「注册」一处是「展示」，耦合起来反而更难读。
 * 但**编辑器内建的那些已经抽到 `EDITOR_HOTKEYS`**——那份最容易写错，
 * 因为它的真实定义在 CodeMirror 里，不抽出来就无法集中核对。
 *
 * `title` 与 `label` 存的都是**文案 key**，渲染时才经 `t()` 解析：
 * 在这里求值会固定在模块加载时的语言，切换语言后不会更新。
 * `EDITOR_HOTKEYS` 的 `label` 同样已经是 key（见 `utils/hotkeys.ts`）。
 */
const groups: { title: MessageKey; items: { keys: string; label: MessageKey }[] }[] = [
  {
    title: 'shortcuts.groupFile',
    items: [
      { keys: 'Ctrl+N', label: 'tab.new' },
      { keys: 'Ctrl+O', label: 'command.openFile' },
      { keys: 'Ctrl+S', label: 'action.save' },
      { keys: 'Ctrl+Shift+S', label: 'action.saveAs' },
      { keys: 'Ctrl+W', label: 'command.closeTab' },
      /*
       * 这两条**已注册但早先没列出来**（Shell.svelte 里有绑定，
       * 这里漏了）。快捷键面板是用户查「有没有这个功能」的地方，
       * 漏列等于让人以为没有。
       */
      { keys: 'Ctrl+Shift+T', label: 'action.reopenClosed' },
      { keys: 'Ctrl+Shift+C', label: 'action.copyPath' },
    ],
  },
  {
    title: 'shortcuts.groupEdit',
    items: EDITOR_HOTKEYS,
  },
  {
    title: 'shortcuts.groupView',
    items: [
      { keys: 'Ctrl+B', label: 'command.toggleSidebar' },
      { keys: 'Ctrl+Shift+M', label: 'editor.preview' },
      { keys: 'Ctrl+,', label: 'menu.settings' },
      { keys: 'Ctrl+Tab', label: 'tab.next' },
      { keys: 'Ctrl+Shift+Tab', label: 'tab.previous' },
      { keys: 'Ctrl+/', label: 'menu.shortcuts' },
    ],
  },
];
</script>

<DialogRoot bind:open>
  <DialogContent class="max-w-lg">
    <DialogHeader>
      <DialogTitle>{t('shortcuts.title')}</DialogTitle>
      <DialogDescription>{t('shortcuts.description')}</DialogDescription>
    </DialogHeader>

    <div class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-2 pr-1">
      {#each groups as group (group.title)}
        <section class="flex flex-col gap-1.5">
          <h3 class="text-[11px] font-medium tracking-wide text-content-faint">{t(group.title)}</h3>
          {#each group.items as item (item.keys)}
            <div class="flex items-center justify-between gap-4 py-0.5">
              <span class="text-sm text-content-muted">{t(item.label)}</span>
              <Kbd>{formatKeys(item.keys)}</Kbd>
            </div>
          {/each}
        </section>
      {/each}
    </div>

    <DialogFooter>
      <Button onclick={() => onOpenChange(false)}>{t('action.gotIt')}</Button>
    </DialogFooter>
  </DialogContent>
</DialogRoot>
