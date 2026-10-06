<script lang="ts">
/**
 * 状态栏：展示当前文件的语言、编码、换行风格与光标位置。
 * 右侧提供换行与行号的快捷开关。
 */
import { Code, Eye, ListOrdered, WrapText } from '@lucide/svelte';
import { requestTogglePreview } from '$lib/actions/preview';
import EncodingPicker from '$lib/components/common/EncodingPicker.svelte';
import Hint from '$lib/components/common/Hint.svelte';
import { Badge } from '$lib/components/ui/badge';
import { LANGUAGE_LABELS } from '$lib/editor/languages';
import { t } from '$lib/i18n';
import { isPreviewing } from '$lib/state/layout.svelte';
import { settings, updateSetting } from '$lib/state/settings.svelte';
import { activeTab } from '$lib/state/tabs.svelte';

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

<!--
  状态栏各项之间的分隔符。
  抽成 snippet 是为了**保证全栏只有一种分隔符**——早先行列那一项
  把 `·` 写进了文案（跟着正文色），其余分隔符是独立的元素
  （`text-border-strong`，更淡），同一行里出现两种颜色，
  看起来就像「不是同一种分隔符」。
-->
{#snippet separator()}
  <span class="shrink-0 text-border-strong">·</span>
{/snippet}

<footer
  class="flex h-6 shrink-0 select-none items-center gap-1 border-t border-border-subtle bg-surface-sunken px-2 text-[11px] text-content-muted"
>
  {#if tab}
    {#if tab.kind === 'image'}
      <!-- 图片没有行列与编码概念；尺寸与体积已在查看器工具栏里，这里不重复 -->
      <span class="px-1">{t('editor.image')}</span>
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
        <span class="px-1">{t('editor.binary')}</span>
      {:else}
        <!--
          行列用「行 N · 列 M」的写法，其中 `·` 与各项之间的分隔符
          **是同一个东西**——因此它不写进文案，而是作为一个独立的
          `{#snippet separator()}` 渲染。

          早先把 `·` 写进了 `lineColumn` 文案里，于是同一行里出现两种
          分隔符：文案内那个跟着正文色（`text-content-muted`），
          项之间那个是 `text-border-strong`（更淡）。
          两者颜色不同，用户一眼就看出「这两个不是同一种分隔符」。
        -->
        <span class="px-1 tabular-nums" title={t('editor.lineColumnTitle')}>
          {t('editor.lineNumber', { line: tab.cursorLine })}
        </span>
        {@render separator()}
        <span class="px-1 tabular-nums">{t('editor.columnNumber', { column: tab.cursorColumn })}</span>
        {@render separator()}
        <span class="px-1">{LANGUAGE_LABELS[tab.language]}</span>
        {@render separator()}
        <!--
          编码可点击：探测不可能全对，用户需要一个纠正误判的入口。
          未命名标签没有磁盘文件可重读，因此只在有路径时可交互。
        -->
        {#if tab.path}
          <EncodingPicker {tab} />
        {:else}
          <span class="px-1" title={t('editor.encoding')}>{encodingLabel}</span>
        {/if}
        {@render separator()}
        <span class="px-1" title={t('editor.lineEnding')}>{lineEndingLabel}</span>

        {#if tab.truncated}
          {@render separator()}
          <Badge variant="secondary" class="h-4 px-1.5 text-[10px]">{t('editor.largeFileBadge')}</Badge>
        {/if}
      {/if}
    {/if}
  {/if}

  <span class="ml-auto flex items-center gap-0.5">
    {#if canPreview && tab}
      <Hint
        label={previewing ? t('editor.backToEditor') : t('editor.preview')}
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
        label={settings.wordWrap ? t('editor.wordWrapOn') : t('editor.wordWrapOff')}
        side="top"
        class="size-5"
        active={settings.wordWrap}
        toggle
        onclick={() => updateSetting('wordWrap', !settings.wordWrap)}
      >
        <WrapText class="size-3" />
      </Hint>

      <Hint
        label={settings.showLineNumbers ? t('editor.lineNumbersOn') : t('editor.lineNumbersOff')}
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
