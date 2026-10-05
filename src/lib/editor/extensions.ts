/**
 * 编辑器扩展装配。
 *
 * 这里手工组装扩展集，而不是用 `codemirror` 的 basicSetup，
 * 因为我们需要按设置动态控制行号、换行等行为，
 * 且要替换默认高亮为自定义主题。
 */

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  codeFolding,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
} from '@codemirror/language';
import { lintKeymap } from '@codemirror/lint';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  highlightTrailingWhitespace,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { indentationMarkers } from '@replit/codemirror-indentation-markers';
import { foldGutterTheme, foldMarkerDOM, lineNumberGutterTheme } from './fold-gutter';

/*
 * 参考线颜色直接引用 app.css 的主题令牌，而不是写死色值。
 *
 * 库会把它们赋给 `--indent-marker-bg-color`，再在渐变里用
 * `var(--indent-marker-bg-color)` 取值。CSS 变量可以层层引用，
 * 因此这里写 `var(--indent-guide)` 也能正确解析——
 * 好处是亮/暗主题切换时线色跟着 `:root` / `.dark` 自动变，
 * 不需要在 JS 里重复维护两套色值。
 */
const lightGuideColor = 'var(--indent-guide)';
const darkGuideColor = 'var(--indent-guide)';
const lightGuideActiveColor = 'var(--indent-guide-active)';
const darkGuideActiveColor = 'var(--indent-guide-active)';

import { rainbowBrackets, rainbowBracketsTheme } from './rainbow-brackets';
import { searchPhrases } from './search-i18n';

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
  /** 括号彩虹。单独一段，默认关闭。 */
  rainbowBrackets: Compartment;
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
    rainbowBrackets: new Compartment(),
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
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];
}

/**
 * 缩进参考线开关。
 *
 * ## 为什么用社区的 `@replit/codemirror-indentation-markers`
 *
 * 这个功能我自己实现过三版，每版都被实测打回（竖线断开、贴着行号边框、
 * 与文字错位、正文被 `opacity` 一起淡化）。核心难点有两个，
 * 都不是「画几条线」那么简单：
 *
 * 1. **渲染层**：我原来给 `.cm-line` 加背景渐变。但 `.cm-line` 自身
 *    还要承载选中高亮、当前行底色，两者叠在一起会互相干扰；
 *    而且背景从 padding 盒还是 content 盒起算，直接决定线会不会
 *    偏到行号边框上。社区实现改用**绝对定位的 `::before` 伪元素**
 *    （`z-index: -1`、`left: 2px`），把「画线」与「行的底色」彻底分开。
 * 2. **层级推断**：空行该继承哪一级缩进，是个真正的启发式问题。
 *    我的做法是「沿用上一行」，但块首/块尾的空行会因此画错——
 *    社区实现会**同时向前后找最近的非空行**，再按它们的层级关系
 *    决定（见其 `IndentationMap`）。这套启发式与 Ace / Monaco 同源。
 *
 * 结论：这种「有公认实现、且细节比看起来多得多」的功能，直接用成熟库
 * 比自己写更可靠。133 KB、MIT、peer 依赖与我们完全一致。
 *
 * 关闭时返回空数组，扩展完全不注册。
 * 颜色通过 `colors` 传入我们的主题令牌，保证与整体配色一致。
 */
export function indentGuidesExtension(enabled: boolean): Extension {
  if (!enabled) return [];
  return indentationMarkers({
    // 用主题令牌而不是库的默认色值，避免与我们的配色脱节
    colors: {
      light: lightGuideColor,
      dark: darkGuideColor,
      activeLight: lightGuideActiveColor,
      activeDark: darkGuideActiveColor,
    },
    // 当前光标所在的块用略深的颜色标示，帮助定位
    highlightActiveBlock: true,
    /*
     * `codeOnly` 而不是默认的 `fullScope`。
     *
     * 两者都实测过：`fullScope` 会把参考线画到**作用域结束**，
     * 于是一个对象字面量之后的空区域里会垂下几条没有内容的竖线——
     * 实测截图里线一直延伸到编辑器底部，像没画完。
     * `codeOnly` 让线止于该作用域**最后一个非空行**，视觉上干净得多。
     */
    markerType: 'codeOnly',
    thickness: 1,
  });
}

/**
 * 括号彩虹开关。
 *
 * 默认关闭（见 `rainbow-brackets.ts` 的说明）：它是主动吸引注意力的
 * 装饰，与「安静」的定位有张力。关闭时连 `depthField` 都不注册，
 * 因此不会为预计算付出任何成本。
 */
export function rainbowBracketsExtension(enabled: boolean): Extension {
  return enabled ? [rainbowBrackets(), rainbowBracketsTheme] : [];
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
    rainbowBrackets: boolean;
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
    compartments.indentGuides.of(indentGuidesExtension(options.showIndentGuides)),
    compartments.rainbowBrackets.of(rainbowBracketsExtension(options.rainbowBrackets)),
  ];
}
