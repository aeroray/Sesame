<script lang="ts">
  /**
   * CodeMirror 挂载容器。
   *
   * 关键点：
   * - `EditorView` 是命令式对象，必须在 `$effect` 中创建并销毁，不能放进响应式状态。
   * - 每个标签页拥有独立视图，切换时靠显示/隐藏而非重建，以保留滚动、撤销与光标。
   * - 休眠（sleep 变回 'none'）会重建视图，内容从保留的正文恢复。
   */
  import { createEditorView, type EditorHandle } from '$lib/editor/create-view';
  import { getLanguageExtension } from '$lib/editor/languages';
  import { editorTheme, editorFontTheme } from '$lib/editor/themes';
  import { programmaticAppend, getProgress, loadNextChunk } from '$lib/editor/large-file.svelte';
  import {
    attachView,
    detachView,
    getView,
    markDirty,
    peekTabContent,
    setTabContent,
    takeRestoreTarget,
    updateCursor,
    updateScroll,
  } from '$lib/state/tabs.svelte';
  import { settings } from '$lib/state/settings.svelte';
  import { getPreviewText } from '$lib/state/layout.svelte';
  import { reportError } from '$lib/actions/open-file';
  import { scheduleAutoSave } from '$lib/actions/autosave';
  import { scheduleDraft } from '$lib/actions/draft';
  import { clearSuccess } from '$lib/state/status.svelte';
  import { mode } from 'mode-watcher';
  import type { Tab } from '$lib/state/types';
  import type { Component } from 'svelte';
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

  const isDark = $derived(mode.current === 'dark');

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
      const language = await getLanguageExtension(tab.language);
      if (disposed) return;

      const created = createEditorView({
        parent: el,
        doc: peekTabContent(tab.id),
        language,
        theme: editorTheme(isDark),
        font: editorFontTheme(settings.editorFont, settings.fontSize),
        showLineNumbers: settings.showLineNumbers,
        wordWrap: settings.wordWrap,
        tabSize: settings.tabSize,
        /*
         * 二进制文件只读。
         *
         * 后端探测到大量无法解码的字节时会把编码标为 `binary` 并返回空正文；
         * 允许编辑再保存就会把有损解码的乱码写回原文件。后端也已拒绝写入，
         * 这里禁掉编辑是为了让用户**当场**看出「这个文件改不了」，
         * 而不是改完保存时才发现。
         */
        readOnly: tab.encoding === 'binary',
        onChange: (update) => {
          // 分块追加是程序化写入，不能算作用户修改。
          // 用注解精确判断这一次事务，而不是查一个跨 await 的标志位——
          // 后者会把用户在加载期间敲的字也一并忽略掉。
          const isAppend = update.transactions.some((tr) =>
            tr.annotation(programmaticAppend),
          );
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
          loadNextChunk(tab).catch((err) => reportError(err, '加载失败'));
        }
      }
    })();

    return () => {
      disposed = true;
      handle = null;
      ready = false;
      // 销毁前把正文留下来，供下次重建（休眠唤醒、组件重挂）使用
      const existing = getView(tab.id);
      if (existing) {
        const content = existing.getContent();
        detachView(tab.id);
        setTabContent(tab.id, content);
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

  // 主题跟随
  $effect(() => {
    const dark = isDark;
    if (handle && ready) {
      handle.reconfigure({ theme: editorTheme(dark) });
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
    });
  });

  // 激活且处于编辑模式时把焦点交还编辑器
  $effect(() => {
    if (active && ready && handle && !preview) {
      handle.view.focus();
    }
  });
</script>

<div class="relative h-full w-full" class:hidden={!active}>
  {#if tab.kind === 'image'}
    <ImageViewer {tab} />
  {:else if preview}
    {#if PreviewComponent}
      <PreviewComponent content={getPreviewText(tab.id)} />
    {:else}
      <div class="flex h-full items-center justify-center text-xs text-content-faint">
        正在加载预览…
      </div>
    {/if}
  {:else}
    <div
      bind:this={container}
      class="h-full w-full overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
    ></div>
  {/if}
</div>
