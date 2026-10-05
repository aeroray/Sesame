/**
 * 编辑器扩展装配。
 *
 * 这里手工组装扩展集，而不是用 `codemirror` 的 basicSetup，
 * 因为我们需要按设置动态控制行号、换行等行为，
 * 且要替换默认高亮为自定义主题。
 */

import {
  Compartment,
  EditorState,
  type Extension,
} from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
  crosshairCursor,
  highlightTrailingWhitespace,
} from '@codemirror/view';
import {
  bracketMatching,
  codeFolding,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
} from '@codemirror/language';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { searchPhrases } from './search-i18n';
import { foldMarkerDOM, foldGutterTheme, lineNumberGutterTheme } from './fold-gutter';
import { indentGuides, indentGuideTheme } from './indent-guides';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';

/**
 * 需要用 Compartment 动态重配置的部分。
 *
 * Compartment 让设置变更时只替换受影响的那一段扩展，
 * 而不是重建整个 EditorView —— 后者会丢失撤销历史与滚动位置。
 */
export interface EditorCompartments {
  language: Compartment;
  theme: Compartment;
  /** 字体与字号。单独一段，改字体时不影响其他扩展。 */
  font: Compartment;
  /**
   * 行号栏**与折叠栏**。
   *
   * 两者放在同一段里，因为它们必须一起开关：
   * 折叠标记脱离了行号就失去了参照——用户看不出标记属于哪一行。
   * 早先折叠栏放在固定扩展里，关掉行号后折叠图标仍然留着（实测被指出）。
   */
  gutter: Compartment;
  wordWrap: Compartment;
  tabSize: Compartment;
  readOnly: Compartment;
  /** 缩进参考线。单独一段，切换时不影响其他扩展。 */
  indentGuides: Compartment;
}

export function createCompartments(): EditorCompartments {
  return {
    language: new Compartment(),
    theme: new Compartment(),
    font: new Compartment(),
    gutter: new Compartment(),
    wordWrap: new Compartment(),
    tabSize: new Compartment(),
    readOnly: new Compartment(),
    indentGuides: new Compartment(),
  };
}

/** 与设置无关的固定扩展。 */
function baseExtensions(): Extension[] {
  return [
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion({
      // 输入时自动弹出补全；失焦即关闭，避免面板留在屏幕上
      activateOnTyping: true,
      closeOnBlur: true,
    }),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    highlightTrailingWhitespace(),
    // 官方搜索面板 + 中文文案：正则、大小写、整词、替换都已由它处理
    search({ top: true }),
    searchPhrases(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab,
    ]),
  ];
}

/**
 * 行号栏与折叠栏。
 *
 * 两者一起开关：折叠标记脱离行号就没有参照，用户看不出它属于哪一行。
 *
 * 注册顺序：行号在前、折叠栏在后。CodeMirror 按扩展注册顺序从左到右排列 gutter，
 * 顺序反了折叠标记会跑到行号左边，与所有主流编辑器相反。
 *
 * 关闭时仍保留 `codeFolding()`——它只提供折叠能力与快捷键，
 * 不产生任何可见元素。这样关掉行号只是「不显示那一列」，
 * Ctrl+Shift+[ 之类的折叠快捷键依然可用。
 */
export function gutterExtension(enabled: boolean): Extension {
  if (!enabled) return [codeFolding()];
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    lineNumberGutterTheme(),
    foldGutter({ markerDOM: foldMarkerDOM }),
    foldGutterTheme(),
  ];
}

/** 自动换行开关。 */
export function wordWrapExtension(enabled: boolean): Extension {
  return enabled ? EditorView.lineWrapping : [];
}

/** 制表符宽度。 */
export function tabSizeExtension(size: number): Extension {
  return [EditorState.tabSize.of(size), indentUnit.of(' '.repeat(size))];
}

/** 只读开关。 */
export function readOnlyExtension(readOnly: boolean): Extension {
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
  ];
}

/**
 * 缩进参考线开关。
 *
 * 关闭时返回空数组，此时 `indentGuides()` 的字段与监听器都不注册——
 * 不是「注册了但不画」，而是彻底不参与，省下每次滚动的重算开销。
 *
 * `tabSize` 必须传进来：竖线间距等于一个缩进宽度，写死会让
 * 用户改成 4 空格时线还停在 2 空格的位置。
 */
export function indentGuidesExtension(enabled: boolean, tabSize: number): Extension {
  return enabled ? [indentGuides(), indentGuideTheme(tabSize)] : [];
}

/** 组装完整扩展集。 */
export function buildExtensions(
  compartments: EditorCompartments,
  options: {
    language: Extension;
    theme: Extension;
    font: Extension;
    showLineNumbers: boolean;
    wordWrap: boolean;
    tabSize: number;
    readOnly: boolean;
    showIndentGuides: boolean;
  },
): Extension[] {
  return [
    /*
     * 行号必须排在 baseExtensions 之前：CodeMirror 按扩展注册顺序排列 gutter，
     * 放在后面会让折叠箭头跑到行号左边，与所有主流编辑器相反。
     */
    compartments.gutter.of(gutterExtension(options.showLineNumbers)),
    ...baseExtensions(),
    compartments.language.of(options.language),
    compartments.theme.of(options.theme),
    compartments.font.of(options.font),
    compartments.wordWrap.of(wordWrapExtension(options.wordWrap)),
    compartments.tabSize.of(tabSizeExtension(options.tabSize)),
    compartments.readOnly.of(readOnlyExtension(options.readOnly)),
    compartments.indentGuides.of(
      indentGuidesExtension(options.showIndentGuides, options.tabSize),
    ),
  ];
}
