/**
 * EditorView 工厂。
 *
 * 把「创建视图」「按设置重配置」「销毁」三件事收在一处，
 * 组件层只负责挂载与卸载。
 */

import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import { historyField } from '@codemirror/commands';
import { logError } from '$lib/utils/log';
import {
  buildExtensions,
  createCompartments,
  gutterExtension,
  indentGuidesExtension,
  rainbowBracketsExtension,
  readOnlyExtension,
  tabSizeExtension,
  wordWrapExtension,
  type EditorCompartments,
} from './extensions';

/** 创建视图所需的全部选项。 */
export interface CreateViewOptions {
  parent: HTMLElement;
  doc: string;
  language: Extension;
  theme: Extension;
  /** 字体与字号扩展。由 `editorFontTheme()` 生成。 */
  font: Extension;
  showLineNumbers: boolean;
  wordWrap: boolean;
  tabSize: number;
  readOnly: boolean;
  /** 是否显示缩进参考线。 */
  showIndentGuides: boolean;
  /** 是否启用括号彩虹。默认关闭。 */
  rainbowBrackets: boolean;
  /**
   * 要恢复的撤销历史（`exportHistory()` 的返回值）。
   *
   * 视图重建时传入，撤销栈得以延续。**文档内容必须与导出时一致**——
   * 历史里存的是相对文档的变更集，文档对不上会导致撤销出乱码。
   */
  history?: unknown;
  /**
   * 内容变化回调。
   *
   * 传入整个 `ViewUpdate` 而不是内容字符串：把整篇文档 `toString()` 出来
   * 是 O(n) 分配，每敲一个字都做一次，在几 MB 的文件上会造成明显的输入卡顿。
   * 调用方需要内容时自己调 `getContent()`。
   */
  onChange?: (update: ViewUpdate) => void;
  /** 光标位置变化回调。 */
  onCursor?: (line: number, column: number) => void;
  /** 滚动位置变化回调。 */
  onScroll?: (scrollTop: number) => void;
}

/** 可动态调整的选项子集。 */
export type ReconfigurableOptions = Partial<
  Pick<
    CreateViewOptions,
    | 'language'
    | 'theme'
    | 'font'
    | 'showLineNumbers'
    | 'wordWrap'
    | 'tabSize'
    | 'readOnly'
    | 'showIndentGuides'
    | 'rainbowBrackets'
  >
>;

export interface EditorHandle {
  view: EditorView;
  compartments: EditorCompartments;
  /** 按新设置重配置，不重建视图，因此保留撤销历史与光标。 */
  reconfigure(next: ReconfigurableOptions): void;
  /** 取得当前文档内容。 */
  getContent(): string;
  /** 整体替换文档内容。 */
  setContent(content: string): void;
  /** 恢复滚动位置。 */
  restoreScroll(scrollTop: number): void;
  /**
   * 导出撤销历史，供视图重建时恢复。
   *
   * 休眠、切换 Markdown 预览都会销毁 `EditorView`，而撤销栈存在
   * EditorState 里，随之丢失——用户切一下预览就再也按不回 Ctrl+Z。
   *
   * 用 `EditorState.toJSON({ history: historyField })` 导出：
   * `historyField` 的类型是 `StateField<unknown>`，直接调它的
   * `toJSON` 没有类型信息；而 `EditorState` 的序列化接口接受
   * 「字段 → 序列化函数」的映射，正好用来取历史。
   *
   * 返回 `null` 表示没有可导出的历史。
   */
  exportHistory(): unknown;
  destroy(): void;
}

/** 把各类变更事件转成对外的回调。 */
function listenerExtension(options: CreateViewOptions): Extension {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      options.onChange?.(update);
    }

    if (update.selectionSet || update.docChanged) {
      const head = update.state.selection.main.head;
      const line = update.state.doc.lineAt(head);
      options.onCursor?.(line.number, head - line.from + 1);
    }

    if (update.geometryChanged || update.docChanged) {
      options.onScroll?.(update.view.scrollDOM.scrollTop);
    }
  });
}

/** 创建编辑器视图。 */
export function createEditorView(options: CreateViewOptions): EditorHandle {
  const compartments = createCompartments();

  const extensions = [...buildExtensions(compartments, options), listenerExtension(options)];

  /*
   * 有历史可恢复时，用 `EditorState.fromJSON` 建状态；否则正常建。
   *
   * 为什么整份状态序列化、而不是只存 history 字段：
   * `historyField` 的类型是 `StateField<unknown>`，直接调它的
   * `toJSON` / `fromJSON` 拿不到类型；而 `EditorState` 的序列化接口
   * 接受「字段 → 序列化函数」的映射，正好用来把历史一并带上。
   * 整份状态里还包含光标与选区，一起恢复反而更完整。
   *
   * 前提：`options.doc` 与导出历史时的文档一致。调用方（EditorHost）
   * 传的正是同一份正文，因此成立。
   */
  let state: EditorState;
  if (options.history) {
    try {
      state = EditorState.fromJSON(
        options.history as object,
        { extensions },
        { history: historyField },
      );
    } catch (err) {
      /*
       * 历史格式不对（旧版本存的、或文档已被外部改动）时退回正常创建。
       * 让编辑器打不开才是真的糟糕——用户会丢掉整个文件，
       * 而这里丢的只是「不能撤销」。
       */
      logError('editor', '恢复撤销历史失败，已退回新建状态', err);
      state = EditorState.create({ doc: options.doc, extensions });
    }
  } else {
    state = EditorState.create({ doc: options.doc, extensions });
  }

  const view = new EditorView({ state, parent: options.parent });

  return {
    view,
    compartments,

    reconfigure(next) {
      /*
       * 先算出「合并后的完整选项」，再据此生成 effects。
       *
       * 必须这样做而不是直接读 `options`：`options` 只在函数末尾才被更新，
       * 中途读到的还是**旧值**。参考线同时依赖 `showIndentGuides` 与 `tabSize`，
       * 若其中一个没在这次调用里传，就得沿用旧值——用合并结果最直观。
       */
      const merged = { ...options, ...next };

      // 逐段重配置：只替换变化的扩展段
      const effects = [];
      if (next.language !== undefined) {
        effects.push(compartments.language.reconfigure(next.language));
      }
      if (next.theme !== undefined) {
        effects.push(compartments.theme.reconfigure(next.theme));
      }
      if (next.font !== undefined) {
        effects.push(compartments.font.reconfigure(next.font));
      }
      if (next.showLineNumbers !== undefined) {
        effects.push(compartments.gutter.reconfigure(gutterExtension(next.showLineNumbers)));
      }
      if (next.wordWrap !== undefined) {
        effects.push(compartments.wordWrap.reconfigure(wordWrapExtension(next.wordWrap)));
      }
      if (next.tabSize !== undefined) {
        effects.push(compartments.tabSize.reconfigure(tabSizeExtension(next.tabSize)));
      }
      if (next.readOnly !== undefined) {
        effects.push(compartments.readOnly.reconfigure(readOnlyExtension(next.readOnly)));
      }
      // 参考线的竖线间距等于一个缩进宽度，因此 tabSize 变化也要重配
      if (next.showIndentGuides !== undefined || next.tabSize !== undefined) {
        effects.push(
          compartments.indentGuides.reconfigure(
            indentGuidesExtension(merged.showIndentGuides, merged.tabSize),
          ),
        );
      }
      if (next.rainbowBrackets !== undefined) {
        effects.push(
          compartments.rainbowBrackets.reconfigure(
            rainbowBracketsExtension(next.rainbowBrackets),
          ),
        );
      }

      if (effects.length > 0) {
        view.dispatch({ effects });
      }

      // 同步内部记录，供后续调用读取当前值
      Object.assign(options, next);
    },

    getContent() {
      return view.state.doc.toString();
    },

    setContent(content) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    },

    restoreScroll(scrollTop) {
      view.scrollDOM.scrollTop = scrollTop;
    },

    exportHistory() {
      /*
       * 序列化整份状态，但只保留 history 字段——文档与选区每次都会
       * 从 `peekTabContent` 与 `setRestoreTarget` 单独恢复，
       * 重复带上反而可能与它们不一致。
       */
      try {
        return view.state.toJSON({ history: historyField });
      } catch (err) {
        logError('editor', '导出撤销历史失败', err);
        return null;
      }
    },

    destroy() {
      view.destroy();
    },
  };
}
