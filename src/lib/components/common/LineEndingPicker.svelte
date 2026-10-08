<script lang="ts">
/**
 * 换行风格选择器：把当前文件转换成 LF / CRLF / CR。
 *
 * ## 为什么值得做成可点击的
 *
 * 换行风格是最常见的跨平台摩擦之一：Windows 上生成的 CRLF 文件
 * 进 git 会整篇显示为改动，脚本里的 `\r` 还会让 shebang 失效。
 * 用户需要能就地改掉它，而不是去别的工具里转换。
 *
 * ## 与 EncodingPicker 的两点不同
 *
 * 1. **不重新读盘。** 换行风格的转换是纯字段操作——后端读文件时已把
 *    换行统一成 `\n`，保存时按这个字段还原。所以这里没有「未保存修改
 *    会丢失」的问题，也就不需要确认框。
 * 2. **改完立刻标脏，但要保存才落盘。** 提示文案里写明这一点，
 *    否则用户会以为已经写进文件了。
 *
 * 详见 `actions/line-ending.ts` 的说明。
 */
import { Check } from '@lucide/svelte';
import { Popover as PopoverPrimitive } from 'bits-ui';
import { LINE_ENDINGS, lineEndingLabel, setLineEnding } from '$lib/actions/line-ending';
import { t } from '$lib/i18n';
import type { Tab } from '$lib/state/types';

interface Props {
  tab: Tab;
}

let { tab }: Props = $props();

let open = $state(false);

/** 二进制文件不可保存，换行风格无从谈起。 */
const disabled = $derived(tab.encoding === 'binary');
</script>

<PopoverPrimitive.Root bind:open>
  <PopoverPrimitive.Trigger>
    {#snippet child({ props })}
      {#if disabled}
        <span class="px-1" title={t('editor.lineEnding')}>{lineEndingLabel(tab.lineEnding)}</span>
      {:else}
        <!--
          入口与编码那项一致：看起来是一段文字，而不是按钮。
        -->
        <button
          {...props}
          type="button"
          class="cursor-pointer rounded-xs px-1 transition-colors hover:bg-surface hover:text-content"
          title={t('lineEnding.change')}
        >
          {lineEndingLabel(tab.lineEnding)}
        </button>
      {/if}
    {/snippet}
  </PopoverPrimitive.Trigger>

  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      align="start"
      side="top"
      sideOffset={4}
      class="z-50 w-52 rounded-lg border border-border-subtle bg-popover p-1 shadow-md outline-none"
    >
      <!--
        用原生滚动而不是 ScrollArea：三项本来就放得下，
        但保持与 EncodingPicker 一致的写法。
      -->
      <div class="flex flex-col gap-0.5" role="menu">
        {#each LINE_ENDINGS as ending (ending)}
          {@const selected = ending === tab.lineEnding}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-sunken"
            onclick={() => {
              setLineEnding(tab, ending);
              open = false;
            }}
          >
            <!--
              选中：实心对勾。未选中：空心圆点。
              与 EncodingPicker 保持同一套视觉语言——两处都是
              「从一组里选一个」，标记方式不该有两套。
            -->
            {#if selected}
              <Check class="size-3.5 shrink-0" />
            {:else}
              <span class="flex size-3.5 shrink-0 items-center justify-center">
                <span class="size-1.5 rounded-full border border-current opacity-40"></span>
              </span>
            {/if}
            <span class="truncate">{t(`lineEnding.${ending}` as 'lineEnding.lf')}</span>
          </button>
        {/each}
      </div>
    </PopoverPrimitive.Content>
  </PopoverPrimitive.Portal>
</PopoverPrimitive.Root>
