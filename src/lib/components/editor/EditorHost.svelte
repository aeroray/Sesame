<script lang="ts">
/**
 * CodeMirror 挂载容器。
 *
 * 关键点：
 * - `EditorView` 是命令式对象，必须在 `$effect` 中创建并销毁，不能放进响应式状态。
 * - 每个标签页拥有独立视图，切换时靠显示/隐藏而非重建，以保留滚动、撤销与光标。
 * - 休眠（sleep 变回 'none'）会重建视图，内容从保留的正文恢复。
 */

import { gotoLine, openSearchPanel } from '@codemirror/search';
import {
  ClipboardPaste,
  Copy,
  CornerDownRight,
  FileText,
  FolderOpen,
  Scissors,
  Search,
  TextSelect,
} from '@lucide/svelte';
import { type Component, untrack } from 'svelte';
import { scheduleAutoSave } from '$lib/actions/autosave';
import { scheduleDraft } from '$lib/actions/draft';
import { copyPath, revealInFolder } from '$lib/actions/file-actions';
import { reportError } from '$lib/actions/open-file';
import {
  Content as ContextMenuContent,
  Item as ContextMenuItem,
  Root as ContextMenuRoot,
  Separator as ContextMenuSeparator,
  Trigger as ContextMenuTrigger,
} from '$lib/components/ui/context-menu';
import { createEditorView, type EditorHandle } from '$lib/editor/create-view';
import { getLanguageExtension } from '$lib/editor/languages';
import { getProgress, loadNextChunk, programmaticAppend } from '$lib/editor/large-file.svelte';
import { searchPhrases } from '$lib/editor/search-i18n';
import { editorFontTheme } from '$lib/editor/themes';
import { t } from '$lib/i18n';
import { getPreviewText } from '$lib/state/layout.svelte';
import { settings } from '$lib/state/settings.svelte';
import { clearSuccess, notify } from '$lib/state/status.svelte';
import {
  attachView,
  detachView,
  getView,
  markDirty,
  peekTabContent,
  setTabContent,
  setTabHistory,
  takeRestoreTarget,
  takeTabHistory,
  updateCursor,
  updateScroll,
} from '$lib/state/tabs.svelte';
import type { Tab } from '$lib/state/types';
import { themeById } from '$lib/theme/palettes';
import { copySelection, cutSelection, readClipboardText } from '$lib/utils/clipboard';
import { formatKeys } from '$lib/utils/hotkeys';
import ImageViewer from './ImageViewer.svelte';

interface Props {
  tab: Tab;
  active: boolean;
  /** 是否显示 Markdown 预览而非编辑器。 */
  preview: boolean;
}

let { tab, active, preview }: Props = $props();

/**
 * 编辑器挂载节点。
 *
 * 必须声明为 `$state`：预览模式下这个节点不存在，
 * 切回编辑模式时 effect 需要因为它的出现而重新执行。
 * DOM 元素是类实例而非普通对象，`$state` 不会对它做深层代理。
 */
let container = $state<HTMLDivElement | null>(null);
let handle = $state<EditorHandle | null>(null);
let ready = $state(false);

/**
 * 当前主题的编辑器扩展。
 *
 * 主题同时决定背景、前景、行号与**语法高亮**，因此它是一整包扩展，
 * 不能像早先那样只传一个 `dark: boolean` 再在内部选亮暗两套。
 */
const themeExtension = $derived(themeById(settings.theme).editor);

/**
 * 懒加载的 Markdown 预览组件。
 *
 * 预览依赖 marked + DOMPurify（约 35 KB gzip），而绝大多数会话用不到它，
 * 因此动态导入把它移出首屏包；只在用户真的切到预览时才下载该分块。
 */
let PreviewComponent = $state<Component<{ content: string }> | null>(null);

$effect(() => {
  if (!preview || PreviewComponent) return;

  let cancelled = false;
  import('./MarkdownPreview.svelte').then((m) => {
    if (!cancelled) PreviewComponent = m.default;
  });

  return () => {
    cancelled = true;
  };
});

// 挂载 / 重建：依赖 sleep 与 container，休眠唤醒或切回编辑模式后自动重建
$effect(() => {
  const el = container;
  // 读取 sleep 建立依赖：休眠被唤醒时重新执行本 effect
  const sleepState = tab.sleep;
  // 图片标签没有编辑器；预览模式下也没有容器。
  // 切回编辑模式时 container 变化会重跑本 effect。
  if (tab.kind === 'image' || sleepState === 'deep' || !el) return;

  let disposed = false;

  (async () => {
    const language = await getLanguageExtension(untrack(() => tab.language));
    if (disposed) return;

    const created = createEditorView({
      parent: el,
      doc: peekTabContent(tab.id),
      language,
      theme: themeExtension,
      font: editorFontTheme(settings.editorFont, settings.fontSize),
      showLineNumbers: settings.showLineNumbers,
      wordWrap: settings.wordWrap,
      tabSize: settings.tabSize,
      showIndentGuides: settings.showIndentGuides,
      rainbowBrackets: settings.rainbowBrackets,
      /*
       * 恢复撤销历史。
       *
       * 休眠唤醒、切回编辑模式都会重建视图，历史若不带上就丢了。
       * 取出即清除：历史里存的是相对文档的变更集，只能用一次——
       * 留着下次重建时用会与当时的文档对不上，撤销出乱码。
       */
      history: takeTabHistory(tab.id),
      /*
       * 二进制文件只读。
       *
       * 后端探测到大量无法解码的字节时会把编码标为 `binary` 并返回空正文；
       * 允许编辑再保存就会把有损解码的乱码写回原文件。后端也已拒绝写入，
       * 这里禁掉编辑是为了让用户**当场**看出「这个文件改不了」，
       * 而不是改完保存时才发现。
       */
      readOnly: tab.encoding === 'binary' || tab.decodeLossy === true,
      onChange: (update) => {
        // 分块追加是程序化写入，不能算作用户修改。
        // 用注解精确判断这一次事务，而不是查一个跨 await 的标志位——
        // 后者会把用户在加载期间敲的字也一并忽略掉。
        const isAppend = update.transactions.some((tr) => tr.annotation(programmaticAppend));
        if (isAppend) return;
        markDirty(tab.id, true);
        /*
         * 用户又改了内容，上一次的「已保存」就不再成立。
         *
         * 不清掉的话，标题栏会继续挂着「已保存」而文档其实已经脏了——
         * 这条提示会从「操作确认」变成「误导」。只清 success，
         * 因为错误/警告类的提示往往还没到阅读时间，不该被输入打断。
         */
        clearSuccess();
        // 自动保存（有路径时直接写回原文件）
        scheduleAutoSave(tab.id);
        // 草稿备份（兜底，未命名标签也能救回来）
        scheduleDraft(tab.id);
      },
      onCursor: (line, column) => updateCursor(tab.id, line, column),
      onScroll: (scrollTop) => updateScroll(tab.id, scrollTop),
    });

    attachView(tab.id, created);
    handle = created;
    ready = true;

    // 恢复光标与滚动：位置存在 restoreTargets 里（休眠唤醒、会话恢复），
    // 消费一次即失效，避免后续重建时又跳回旧位置。
    const target = takeRestoreTarget(tab.id);
    const scrollTop = target?.scrollTop ?? tab.scrollTop;

    if (scrollTop > 0) {
      created.restoreScroll(scrollTop);
    }

    if (target && target.line > 0) {
      const doc = created.view.state.doc;
      const lineNo = Math.min(Math.max(target.line, 1), doc.lines);
      const line = doc.line(lineNo);
      const col = Math.min(Math.max(target.column - 1, 0), line.length);
      created.view.dispatch({ selection: { anchor: line.from + col } });
    }

    /*
     * 补拉首块。
     *
     * 打开大文件时 openPath 会立刻调一次 loadNextChunk，但那一刻视图
     * 往往还没建好（语言包是异步加载的），调用会因 `!handle` 直接返回，
     * 结果编辑器空白、进度停在 0%（实测复现）。
     * 视图就绪后在这里补一次。
     */
    if (tab.truncated && !tab.dirty) {
      const p = getProgress(tab.id);
      if (p && !p.complete && p.loadedBytes === 0) {
        loadNextChunk(tab).catch((err) => reportError(err, t('error.loadFailed')));
      }
    }
  })();

  return () => {
    disposed = true;
    handle = null;
    ready = false;
    // 销毁前把正文与撤销历史留下来，供下次重建（休眠唤醒、组件重挂）使用
    const existing = getView(tab.id);
    if (existing) {
      const content = existing.getContent();
      const history = existing.exportHistory();
      detachView(tab.id);
      setTabContent(tab.id, content);
      setTabHistory(tab.id, history);
    }
  };
});

// 语言变化时重配置，不重建视图
$effect(() => {
  const lang = tab.language;
  const current = handle;
  if (!current || !ready) return;

  let cancelled = false;
  getLanguageExtension(lang).then((ext) => {
    if (!cancelled) current.reconfigure({ language: ext });
  });

  return () => {
    cancelled = true;
  };
});

/*
 * 主题跟随设置。
 *
 * 用 Compartment 重配置而不是重建视图，因此换主题不会丢撤销历史与光标。
 * 整包替换（含语法高亮）——主题是一体的，不能只换背景。
 */
$effect(() => {
  const ext = themeExtension;
  if (handle && ready) {
    handle.reconfigure({ theme: ext });
  }
});

/*
 * 字体跟随设置。
 *
 * 用 Compartment 重配置而不是重建视图，因此改字体不会丢撤销历史与光标。
 * 只依赖编辑器字体与字号：界面字体不影响编辑器（行号也算编辑器的一部分）。
 */
$effect(() => {
  if (!handle || !ready) return;
  const font = editorFontTheme(settings.editorFont, settings.fontSize);
  handle.reconfigure({ font });
});

// 设置变化时逐项重配置
$effect(() => {
  if (!handle || !ready) return;
  handle.reconfigure({
    showLineNumbers: settings.showLineNumbers,
    wordWrap: settings.wordWrap,
    tabSize: settings.tabSize,
    showIndentGuides: settings.showIndentGuides,
    rainbowBrackets: settings.rainbowBrackets,
    readOnly: tab.encoding === 'binary' || tab.decodeLossy === true,
  });
});

// 激活且处于编辑模式时把焦点交还编辑器
$effect(() => {
  const phrases = searchPhrases();
  if (handle && ready) handle.reconfigure({ phrases });
});

$effect(() => {
  if (active && ready && handle && !preview) {
    handle.view.focus();
  }
});

/**
 * 内容区右键菜单的命令。
 *
 * 调 CodeMirror 自己的命令而不是另写一套：查找面板、转到行、全选
 * 都由它实现，自己再做一遍必然与快捷键的行为不一致
 * （比如查找面板的选项状态、转到行对话框的焦点行为）。
 *
 * `openSearchPanel` 与 `gotoLine` 都是 `@codemirror/search` 的公开导出；
 * `gotoLine` 会自行弹出「转到行」对话框并把焦点送进输入框。
 */
function runFind() {
  const view = handle?.view;
  if (!view) return;
  view.focus();
  openSearchPanel(view);
}

function runGotoLine() {
  const view = handle?.view;
  if (!view) return;
  view.focus();
  gotoLine(view);
}

function runSelectAll() {
  const view = handle?.view;
  if (!view) return;
  view.focus();
  view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
}

/**
 * 当前是否有选区，决定「剪切」「复制」是否可用。
 *
 * 读 `view.state.selection` 而非 DOM 选区：那是 CodeMirror 的真实状态，
 * 而我们要判断的正是它。
 */
const hasSelection = $derived(handle ? !handle.view.state.selection.main.empty : false);

/** 只读（二进制或有损解码）时禁掉会改动文档的两项。 */
const readOnly = $derived(tab.encoding === 'binary' || tab.decodeLossy === true);

function runCut() {
  const view = handle?.view;
  if (!view) return;
  view.focus();
  if (!cutSelection()) {
    // 选区为空或浏览器拒绝：不静默失败，让用户知道该用快捷键
    notify.info(t('status.nothingSelected'));
  }
}

function runCopy() {
  const view = handle?.view;
  if (!view) return;
  view.focus();
  if (!copySelection()) {
    notify.info(t('status.nothingSelected'));
  }
}

/**
 * 粘贴。
 *
 * `execCommand('paste')` 被浏览器一律拒绝，只能自己读剪贴板再插入。
 * 读不到（权限被拒或非安全上下文）时提示改用 Ctrl+V——
 * 那条路径由 WebView 原生处理，不受权限影响。
 */
async function runPaste() {
  const view = handle?.view;
  if (!view) return;
  view.focus();

  const text = await readClipboardText();
  if (text === null) {
    notify.info(t('contextMenu.pasteFailed'));
    return;
  }

  /*
   * 用 `dispatch` 插入而不是改 DOM：走 CodeMirror 的事务系统，
   * 撤销历史、脏标记、自动保存都会正常触发。
   */
  view.dispatch(view.state.replaceSelection(text));
}
</script>

<div class="relative h-full w-full" class:hidden={!active}>
  {#if tab.kind === 'image'}
    <ImageViewer {tab} {active} />
  {:else if preview}
    {#if PreviewComponent}
      <PreviewComponent content={getPreviewText(tab.id)} />
    {:else}
      <div class="flex h-full items-center justify-center text-xs text-content-faint">
        {t('editor.loadingPreview')}
      </div>
    {/if}
  {:else}
    <!--
      内容区右键菜单。

      **用 `preventDefault` 拦掉浏览器/WebView 的原生菜单再自绘**：
      原生菜单里的剪切/复制/粘贴 WebView 已经提供，但「复制文件路径」
      「在文件夹中显示」这类针对文件的操作它没有，而这两项正是用户
      在正文上右键时最想找的。

      拦掉的代价是失去原生菜单的书写建议、拼写检查等项；
      本项目是代码/文本编辑器，那些本就不适用。
    -->
    <ContextMenuRoot>
      <ContextMenuTrigger>
        {#snippet child({ props })}
          <div
            {...props}
            bind:this={container}
            class="h-full w-full overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
          ></div>
        {/snippet}
      </ContextMenuTrigger>

      <ContextMenuContent class="w-56">
        <!--
          剪切 / 复制 / 粘贴。

          原生菜单被全局拦掉后，这三项没人提供了——CodeMirror 不导出
          剪贴板命令，它们原本靠浏览器对 contenteditable 的内置菜单。
          因此必须自己补，顺序按通行惯例（VS Code 的 `9_cutcopypaste` 组）。

          「剪切」「复制」在没有选区时置灰；只读文件额外禁掉「剪切」
          与「粘贴」——否则点了没反应，用户以为坏了。
        -->
        <ContextMenuItem
          class="gap-2"
          disabled={!hasSelection || readOnly}
          onSelect={runCut}
        >
          <Scissors class="size-3.5 shrink-0" />
          <span class="truncate">{t('action.cut')}</span>
          <span class="ml-auto shrink-0 text-[10px] text-content-faint">{formatKeys('Ctrl+X')}</span>
        </ContextMenuItem>

        <ContextMenuItem class="gap-2" disabled={!hasSelection} onSelect={runCopy}>
          <Copy class="size-3.5 shrink-0" />
          <span class="truncate">{t('action.copy')}</span>
          <span class="ml-auto shrink-0 text-[10px] text-content-faint">{formatKeys('Ctrl+C')}</span>
        </ContextMenuItem>

        <ContextMenuItem class="gap-2" disabled={readOnly} onSelect={() => void runPaste()}>
          <ClipboardPaste class="size-3.5 shrink-0" />
          <span class="truncate">{t('action.paste')}</span>
          <span class="ml-auto shrink-0 text-[10px] text-content-faint">{formatKeys('Ctrl+V')}</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          class="gap-2"
          disabled={!tab.path}
          onSelect={() => void copyPath(tab)}
        >
          <FileText class="size-3.5 shrink-0" />
          <span class="truncate">{t('action.copyPath')}</span>
          <span class="ml-auto shrink-0 text-[10px] text-content-faint">
            {formatKeys('Ctrl+Shift+C')}
          </span>
        </ContextMenuItem>

        <ContextMenuItem
          class="gap-2"
          disabled={!tab.path}
          onSelect={() => void revealInFolder(tab)}
        >
          <FolderOpen class="size-3.5 shrink-0" />
          <span class="truncate">{t('action.revealInFolder')}</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem class="gap-2" onSelect={runFind}>
          <Search class="size-3.5 shrink-0" />
          <span class="truncate">{t('command.find')}</span>
          <span class="ml-auto shrink-0 text-[10px] text-content-faint">{formatKeys('Ctrl+F')}</span>
        </ContextMenuItem>

        <ContextMenuItem class="gap-2" onSelect={runGotoLine}>
          <CornerDownRight class="size-3.5 shrink-0" />
          <span class="truncate">{t('search.goToLine')}</span>
          <span class="ml-auto shrink-0 text-[10px] text-content-faint">
            {formatKeys('Ctrl+Alt+G')}
          </span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem class="gap-2" onSelect={runSelectAll}>
          <TextSelect class="size-3.5 shrink-0" />
          <span class="truncate">{t('command.selectAll')}</span>
          <span class="ml-auto shrink-0 text-[10px] text-content-faint">{formatKeys('Ctrl+A')}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuRoot>
  {/if}
</div>
