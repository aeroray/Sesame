<script lang="ts">
/**
 * 快捷键一览。
 *
 * 列表本身在 `common/ShortcutsList.svelte`——设置面板的「快捷键」分类
 * 用的是同一份，避免两处维护导致不一致。
 */

import ShortcutsList from '$lib/components/common/ShortcutsList.svelte';
import { Button } from '$lib/components/ui/button';
import {
  Content as DialogContent,
  Description as DialogDescription,
  Footer as DialogFooter,
  Header as DialogHeader,
  Root as DialogRoot,
  Title as DialogTitle,
} from '$lib/components/ui/dialog';
import { t } from '$lib/i18n';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

let { open = $bindable(), onOpenChange }: Props = $props();
</script>

<DialogRoot bind:open>
  <DialogContent class="max-w-lg">
    <DialogHeader>
      <DialogTitle>{t('shortcuts.title')}</DialogTitle>
      <DialogDescription>{t('shortcuts.description')}</DialogDescription>
    </DialogHeader>

    <ShortcutsList />

    <DialogFooter>
      <Button onclick={() => onOpenChange(false)}>{t('action.gotIt')}</Button>
    </DialogFooter>
  </DialogContent>
</DialogRoot>
