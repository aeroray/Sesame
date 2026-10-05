<script lang="ts">
/**
 * 编码选择器：以指定编码重新打开当前文件。
 *
 * ## 为什么需要它
 *
 * 编码探测不可能全对。实测 Big5、Shift_JIS 与无 BOM 的 UTF-16LE
 * 都会被判成 GBK，显示为乱码。GBK 的编解码可逆，所以**保存不会损坏文件**，
 * 但用户看不到正确内容——必须给一个纠正的出口。
 *
 * ## 为什么用 Popover 而不是 Select
 *
 * 编码列表不长（9 项），但每项需要展示「当前」标记，
 * 且入口是状态栏里的一段文字而不是表单控件。Popover 更贴合这个形态。
 *
 * ## 会丢失未保存修改
 *
 * 重新打开是从磁盘重读，本标签未保存的改动会丢。因此：
 * - 标签是脏的时候先弹确认框（走原生对话框，与关闭标签一致）
 * - 提示文案里明确写出这一点，不让用户事后才发现
 */
import { Check } from '@lucide/svelte';
import { message } from '@tauri-apps/plugin-dialog';
import { Popover as PopoverPrimitive } from 'bits-ui';
import { reopenWithEncoding } from '$lib/actions/encoding';
import { ScrollArea } from '$lib/components/ui/scroll-area';
import { t } from '$lib/i18n';
import { encodingList, ensureEncodings } from '$lib/state/encodings.svelte';
import { notify } from '$lib/state/status.svelte';
import type { Tab } from '$lib/state/types';

interface Props {
  tab: Tab;
}

let { tab }: Props = $props();

let open = $state(false);

/** 打开时才加载列表，避免拖慢首屏。 */
$effect(() => {
  if (open) void ensureEncodings();
});

/**
 * 选中某个编码。
 *
 * 脏标签先确认：重新打开会丢掉未保存的改动，
 * 这是不可逆操作，必须让用户明确同意。
 */
async function pick(encoding: string): Promise<void> {
  open = false;

  if (encoding === tab.encoding) return;

  if (tab.dirty) {
    const btnOk = t('action.confirm');
    const btnCancel = t('action.cancel');
    const answer = await message(t('encoding.loseChanges'), {
      title: t('encoding.title'),
      kind: 'warning',
      buttons: { ok: btnOk, cancel: btnCancel },
    });
    if (answer !== btnOk) return;
  }

  const ok = await reopenWithEncoding(tab, encoding);
  if (ok) notify.success(t('encoding.reopened', { encoding: encoding.toUpperCase() }));
}
</script>

<PopoverPrimitive.Root bind:open>
  <PopoverPrimitive.Trigger>
    {#snippet child({ props })}
      <!--
        入口是状态栏里的一段文字，因此用 button 而不是 Button 组件：
        它需要看起来像文字，而不是一个按钮。
      -->
      <button
        {...props}
        type="button"
        class="cursor-pointer rounded-xs px-1 transition-colors hover:bg-surface hover:text-content"
        title={t('encoding.change')}
      >
        {tab.encoding.toUpperCase()}
      </button>
    {/snippet}
  </PopoverPrimitive.Trigger>

  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      align="start"
      side="top"
      sideOffset={4}
      class="z-50 w-56 rounded-lg border border-border-subtle bg-popover p-1 shadow-md outline-none"
    >
      <div class="px-2 py-1 text-[10px] tracking-wide text-content-faint">
        {t('encoding.change')}
      </div>

      {#if encodingList.loading}
        <div class="px-2 py-3 text-center text-xs text-content-faint">
          {t('fontPicker.loading')}
        </div>
      {:else}
        <ScrollArea class="max-h-64">
          <div class="flex flex-col gap-0.5">
            {#each encodingList.all as enc (enc)}
              <button
                type="button"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-sunken"
                onclick={() => void pick(enc)}
              >
                <Check
                  class="size-3.5 shrink-0 {enc === tab.encoding ? '' : 'opacity-0'}"
                />
                <span class="truncate">{enc.toUpperCase()}</span>
              </button>
            {/each}
          </div>
        </ScrollArea>
      {/if}
    </PopoverPrimitive.Content>
  </PopoverPrimitive.Portal>
</PopoverPrimitive.Root>
