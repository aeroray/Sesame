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
      {#if encodingList.loading}
        <div class="px-2 py-3 text-center text-xs text-content-faint">
          {t('fontPicker.loading')}
        </div>
      {:else}
        <!--
          用**原生滚动**，不用 `ScrollArea`。

          实测原因：bits-ui 的 ScrollArea 把 viewport 做成 `size-full`
          （height:100%），而这里外层只有 `max-height`、没有确定高度，
          百分比高度于是解析成 `auto`——viewport 跟着内容一直长高，
          永不溢出，滚动条自然不出现。实测该 viewport 的
          clientHeight 与 scrollHeight 都是 418，即完全滚不动。

          换成 `overflow-y-auto` + `max-h-64` 后 clientHeight=256、
          scrollHeight=418，正常可滚。

          列表只有 9 项，本来也不需要 ScrollArea 那套自定义滚动条；
          全局 `app.css` 已经把原生滚动条的样式统一过了。
        -->
        <div class="flex max-h-64 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
          {#each encodingList.all as enc (enc)}
            {@const selected = enc === tab.encoding}
            <button
              type="button"
              class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-sunken"
              aria-checked={selected}
              role="menuitemradio"
              onclick={() => void pick(enc)}
            >
              <!--
                已选中：实心对勾。
                未选中：一个空心圆点，表示「这是可选项、当前没选它」。
                早先未选中项什么都不画（只给对勾 `opacity-0`），
                整列看起来像纯文字，看不出哪些能被选中。
                两者都占 `size-3.5`，因此文字左缘始终对齐。
              -->
              {#if selected}
                <Check class="size-3.5 shrink-0" />
              {:else}
                <span class="flex size-3.5 shrink-0 items-center justify-center">
                  <span class="size-1.5 rounded-full border border-current opacity-40"></span>
                </span>
              {/if}
              <span class="truncate">{enc.toUpperCase()}</span>
            </button>
          {/each}
        </div>
      {/if}
    </PopoverPrimitive.Content>
  </PopoverPrimitive.Portal>
</PopoverPrimitive.Root>
