<script lang="ts">
  /**
   * 状态栏：展示当前文件的语言、编码、换行风格与光标位置。
   * 右侧提供换行与行号的快捷开关。
   */
  import { WrapText, ListOrdered, Eye, Code } from '@lucide/svelte';
  import { Badge } from '$lib/components/ui/badge';
  import Hint from '$lib/components/common/Hint.svelte';
  import { activeTab } from '$lib/state/tabs.svelte';
  import { settings, updateSetting } from '$lib/state/settings.svelte';
  import { isPreviewing } from '$lib/state/layout.svelte';
  import { requestTogglePreview } from '$lib/actions/preview';
  import { LANGUAGE_LABELS } from '$lib/editor/languages';

  const tab = $derived(activeTab());

  /** 当前标签页能否预览（仅 Markdown）。 */
  const canPreview = $derived(tab?.language === 'markdown');

  /** 是否处于预览模式。 */
  const previewing = $derived(tab ? isPreviewing(tab.id) : false);

  /** 编码名大写展示，符合编辑器惯例。 */
  const encodingLabel = $derived(tab?.encoding.toUpperCase() ?? '');

  /**
   * 是否为「非文本」内容。
   *
   * 后端探测到大量无法解码的字节时会把编码标为 `binary` 并返回空正文。
   * 这类文件（exe、zip、数据库……）**不能用文本编辑器保存**——
   * 保存会把有损解码的乱码写回去，把原文件毁掉。
   */
  const isBinary = $derived(tab?.encoding === 'binary');

  /** 换行风格的展示名。 */
  const lineEndingLabel = $derived(
    tab?.lineEnding === 'crlf' ? 'CRLF' : tab?.lineEnding === 'cr' ? 'CR' : 'LF',
  );
</script>

<footer
  class="flex h-6 shrink-0 select-none items-center gap-1 border-t border-border-subtle bg-surface-sunken px-2 text-[11px] text-content-muted"
>
  {#if tab}
    {#if tab.kind === 'image'}
      <!-- 图片没有行列与编码概念；尺寸与体积已在查看器工具栏里，这里不重复 -->
      <span class="px-1">图片</span>
    {:else}
      <!--
        光标位置带「行 / 列」字样。
        早先只写 `19:17`，用户看不出这是什么（实测被问过）。
        数字加标签只多两个字符，但含义立刻明确。
      -->
      {#if isBinary}
        <!--
          二进制内容：明确告知「只能看，不能存」，而不是显示 0 行 0 列。
          后端已拒绝写入，这里说明原因，免得用户改了半天才发现存不了。
        -->
        <span class="px-1">二进制文件 · 不可编辑保存</span>
      {:else}
        <span class="px-1 tabular-nums" title="光标位置（行:列）">
          行 {tab.cursorLine}，列 {tab.cursorColumn}
        </span>
        <span class="text-border-strong">·</span>
        <span class="px-1">{LANGUAGE_LABELS[tab.language]}</span>
        <span class="text-border-strong">·</span>
        <span class="px-1" title="文本编码">{encodingLabel}</span>
        <span class="text-border-strong">·</span>
        <span class="px-1" title="换行风格">{lineEndingLabel}</span>

        {#if tab.truncated}
          <span class="text-border-strong">·</span>
          <Badge variant="secondary" class="h-4 px-1.5 text-[10px]">大文件模式</Badge>
        {/if}
      {/if}
    {/if}
  {:else}
    <span class="px-1">就绪</span>
  {/if}

  <span class="ml-auto flex items-center gap-0.5">
    {#if canPreview && tab}
      <Hint
        label={previewing ? '返回编辑' : '预览 Markdown'}
        side="top"
        class="size-5"
        active={previewing}
        toggle
        onclick={() => requestTogglePreview(tab)}
      >
        {#if previewing}
          <Code class="size-3" />
        {:else}
          <Eye class="size-3" />
        {/if}
      </Hint>
    {/if}

    <!--
      图片标签没有换行与行号的概念，隐藏这两个开关。

      开关状态只用**文字颜色**表达：激活为亮色，未激活为灰色。
      图标固定不变——换图标会让按钮看起来像两个不同的功能，
      而它其实只是同一个开关的两种状态。
    -->
    {#if tab?.kind !== 'image'}
      <Hint
        label={settings.wordWrap ? '自动换行：已开启' : '自动换行：已关闭'}
        side="top"
        class="size-5"
        active={settings.wordWrap}
        toggle
        onclick={() => updateSetting('wordWrap', !settings.wordWrap)}
      >
        <WrapText class="size-3" />
      </Hint>

      <Hint
        label={settings.showLineNumbers ? '显示行号：已开启' : '显示行号：已关闭'}
        side="top"
        class="size-5"
        active={settings.showLineNumbers}
        toggle
        onclick={() => updateSetting('showLineNumbers', !settings.showLineNumbers)}
      >
        <ListOrdered class="size-3" />
      </Hint>
    {/if}
  </span>
</footer>
