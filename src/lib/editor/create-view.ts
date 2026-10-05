/**
 * EditorView 工厂。
 *
 * 把「创建视图」「按设置重配置」「销毁」三件事收在一处，
 * 组件层只负责挂载与卸载。
 */

import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import {
  buildExtensions,
  createCompartments,
  gutterExtension,
  indentGuidesExtension,
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

  const state = EditorState.create({
    doc: options.doc,
    extensions: [...buildExtensions(compartments, options), listenerExtension(options)],
  });

  const view = new EditorView({ state, parent: options.parent });

  return {
    view,
    compartments,

    reconfigure(next) {
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
      if (next.showIndentGuides !== undefined) {
        effects.push(
          compartments.indentGuides.reconfigure(
            indentGuidesExtension(next.showIndentGuides),
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

    destroy() {
      view.destroy();
    },
  };
}
