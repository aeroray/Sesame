/**
 * 主题（皮肤）定义。
 *
 * ## 为什么从「亮暗 + 强调色」改成完整主题
 *
 * 原来只有「亮色/深色」加一个强调色。问题是：**强调色与编辑器配色是两套
 * 互不相干的东西**——用户选「松绿」，界面按钮变绿了，但编辑器里的关键字、
 * 字符串、注释还是原来那套暖褐色。两个区域各说各话，看起来就不像一个
 * 统一的产品。
 *
 * 成熟编辑器（VS Code、Sublime、JetBrains）都是**主题制**：一套主题同时
 * 定义界面配色、编辑器配色与语法高亮。这里采用同样的模型。
 *
 * ## 语法高亮一律来自社区包，不自己挑色
 *
 * 语法色直接用 `@uiw/codemirror-theme-*`（MIT，2026-09 仍在更新）导出的
 * 现成扩展。理由：
 *
 * - 自己给 13 套主题 × 20 个语法标签配色，既容易出错，也无法与用户在其他
 *   编辑器里看到的同名主题保持一致——「Dracula」就该是大家熟悉的那个样子。
 * - 现成的扩展已经被大量项目验证过。
 *
 * ## 只有「界面令牌」是我们自己定义的
 *
 * 社区包只管编辑器内部，不管应用外壳（标题栏、侧栏、对话框）。
 * 因此每套主题在这里额外声明 4 个基准色（bg / fg / accent / accentFg），
 * 其余界面令牌由 `theme-tokens.ts` 用 `color-mix()` 推导。
 *
 * 这些基准色的取值**对齐各主题的官方 settings**（实测读过其源码导出），
 * 保证界面外壳与编辑器内部是同一个色调，不会出现「外壳偏蓝、编辑器偏紫」。
 *
 * ## 记录两处上游偏差
 *
 * 实测读过源码，以下两处与官方规范不符，但**保持原样**——与用户在其他
 * 工具里看到的同名主题一致，比贴合规范文档更重要：
 *
 * - Dracula 的 `propertyName` 用 `#66d9ef`，该色不在 Dracula 官方调色板里；
 *   `t.number` 未定义，数字会落到前景色。
 * - Nord 的前景用纯白 `#FFFFFF`，官方规范是 nord4 `#d8dee9`。
 */

import type { Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import { atomone } from '@uiw/codemirror-theme-atomone';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { nord } from '@uiw/codemirror-theme-nord';
import { solarizedDark, solarizedLight } from '@uiw/codemirror-theme-solarized';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { createTheme } from '@uiw/codemirror-themes';

/** 主题标识。 */
export type ThemeId =
  | 'sesame-light'
  | 'sesame-dark'
  | 'dracula'
  | 'monokai'
  | 'one-dark'
  | 'nord'
  | 'tokyo-night'
  | 'github-light'
  | 'github-dark'
  | 'solarized-light'
  | 'solarized-dark'
  | 'vscode-light'
  | 'vscode-dark';

/** 主题的亮暗归属，决定界面令牌的推导方向。 */
export type ThemeMode = 'light' | 'dark';

export interface ThemeDefinition {
  id: ThemeId;
  /** 展示名。专有名词（Dracula 等）不翻译，直接写字面量。 */
  name: string;
  mode: ThemeMode;
  /** 界面与编辑器共用的背景色。 */
  bg: string;
  /** 正文色。 */
  fg: string;
  /** 强调色：按钮、焦点环、选中态、进度条。 */
  accent: string;
  /** 强调色上的文字色。 */
  accentFg: string;
  /**
   * 括号彩虹的三档颜色。
   *
   * 从该主题的语法调色板里取三支**色相差别明显**的颜色，
   * 这样括号彩虹与主题是同一套配色，而不是外挂上去的。
   *
   * 顺序约定：[0] 紫/蓝系、[1] 绿/青系、[2] 橙/黄系——
   * 这个顺序在几乎所有主题里都能取到对比清晰的三个色相。
   */
  rainbow: [string, string, string];
  /**
   * 缩略图用的语法色。
   *
   * 仅供设置面板的**主题预览**使用：用几根彩色短线模拟真实代码的配色，
   * 让用户一眼看出「这套主题长什么样」，而不是只看两个色块。
   *
   * 取值必须与 `editor` 里的 `styles` 一致——缩略图若与真实编辑器
   * 不是同一套颜色，预览就失去意义。这几支色也就是该主题最具辨识度的
   * 那几种语法元素（关键字 / 字符串 / 函数 / 类型 / 注释）。
   */
  preview: {
    keyword: string;
    string: string;
    fn: string;
    type: string;
    comment: string;
  };
  /** 编辑器扩展（含界面样式与语法高亮）。 */
  editor: Extension;
}

/**
 * 默认亮色主题：Sesame Light。
 *
 * 用项目原有的暖调中性色，保持「默认外观」与既有设计规范一致。
 * 其余主题是给想要经典配色的用户的选项。
 *
 * 语法色沿用 app.css 时期手工调过的那套暖褐 + 紫/蓝/绿点缀，
 * 因为它已经与本项目的整体气质磨合过。
 */
const sesameLight: ThemeDefinition = {
  id: 'sesame-light',
  name: 'Sesame Light',
  mode: 'light',
  bg: '#ffffff',
  fg: '#2c2723',
  accent: '#8a5a2b',
  accentFg: '#ffffff',
  // 取自下面语法高亮里的关键字紫 / 字符串绿 / 数字橙
  rainbow: ['#7c3aed', '#15803d', '#b45309'],
  /* 缩略图用的语法色，与下面 styles 保持一致 */
  preview: {
    keyword: '#7c3aed',
    string: '#15803d',
    fn: '#1d4ed8',
    type: '#0e7490',
    comment: '#7d8f69',
  },
  editor: createTheme({
    theme: 'light',
    settings: {
      background: '#ffffff',
      foreground: '#2c2723',
      caret: '#8a5a2b',
      selection: 'rgba(196, 148, 92, 0.35)',
      selectionMatch: 'rgba(196, 148, 92, 0.25)',
      lineHighlight: 'rgba(120, 100, 80, 0.06)',
      gutterBackground: '#ffffff',
      gutterForeground: '#9a9086',
      // 无边框：靠留白与更淡的行号色区分（见 design.md）
      gutterBorder: 'transparent',
    },
    styles: [
      { tag: t.keyword, color: '#7c3aed' },
      {
        tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
        color: '#8a3a1f',
      },
      { tag: [t.function(t.variableName), t.labelName], color: '#1d4ed8' },
      { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#a16207' },
      { tag: [t.definition(t.name), t.separator], color: '#57534e' },
      { tag: [t.typeName, t.className, t.namespace], color: '#0e7490' },
      { tag: [t.number, t.bool, t.null], color: '#b45309' },
      { tag: [t.operator, t.operatorKeyword], color: '#6b6259' },
      { tag: [t.string, t.special(t.string)], color: '#15803d' },
      { tag: [t.meta, t.comment], color: '#7d8f69', fontStyle: 'italic' },
      { tag: t.strong, fontWeight: 'bold' },
      { tag: t.emphasis, fontStyle: 'italic' },
      { tag: t.strikethrough, textDecoration: 'line-through' },
      { tag: t.link, color: '#1d4ed8', textDecoration: 'underline' },
      { tag: t.heading, fontWeight: 'bold', color: '#7c2d12' },
      { tag: [t.atom, t.special(t.variableName)], color: '#a16207' },
      { tag: t.invalid, color: '#dc2626' },
    ],
  }),
};

/** 默认暗色主题：Sesame Dark。与亮色共用同一套色相关系，只调明度。 */
const sesameDark: ThemeDefinition = {
  id: 'sesame-dark',
  name: 'Sesame Dark',
  mode: 'dark',
  bg: '#191715',
  fg: '#ebe6e0',
  accent: '#d99a5b',
  accentFg: '#241c14',
  // 暗色下用比亮色更亮的三档，否则与背景对比不足
  rainbow: ['#c4a2f0', '#9ecf8a', '#e89a6a'],
  /* 缩略图用的语法色，与下面 styles 保持一致 */
  preview: {
    keyword: '#c4a2f0',
    string: '#9ecf8a',
    fn: '#8fb8f0',
    type: '#7fc9d6',
    comment: '#8a9480',
  },
  editor: createTheme({
    theme: 'dark',
    settings: {
      background: '#191715',
      foreground: '#ebe6e0',
      caret: '#d99a5b',
      selection: 'rgba(160, 120, 70, 0.4)',
      selectionMatch: 'rgba(160, 120, 70, 0.3)',
      lineHighlight: 'rgba(255, 255, 255, 0.04)',
      gutterBackground: '#191715',
      gutterForeground: '#7d746a',
      gutterActiveForeground: '#ebe6e0',
      gutterBorder: 'transparent',
    },
    styles: [
      { tag: t.keyword, color: '#c4a2f0' },
      {
        tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
        color: '#e8b48c',
      },
      { tag: [t.function(t.variableName), t.labelName], color: '#8fb8f0' },
      { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#e0c080' },
      { tag: [t.definition(t.name), t.separator], color: '#d5cec6' },
      { tag: [t.typeName, t.className, t.namespace], color: '#7fc9d6' },
      { tag: [t.number, t.bool, t.null], color: '#e89a6a' },
      { tag: [t.operator, t.operatorKeyword], color: '#b3aaa0' },
      { tag: [t.string, t.special(t.string)], color: '#9ecf8a' },
      { tag: [t.meta, t.comment], color: '#8a9480', fontStyle: 'italic' },
      { tag: t.strong, fontWeight: 'bold' },
      { tag: t.emphasis, fontStyle: 'italic' },
      { tag: t.strikethrough, textDecoration: 'line-through' },
      { tag: t.link, color: '#8fb8f0', textDecoration: 'underline' },
      { tag: t.heading, fontWeight: 'bold', color: '#e8b48c' },
      { tag: [t.atom, t.special(t.variableName)], color: '#e0c080' },
      { tag: t.invalid, color: '#f07070' },
    ],
  }),
};

/**
 * 内置主题清单。
 *
 * 顺序即设置面板的展示顺序：先默认两套，再按知名度排经典主题，
 * 亮暗交错排列便于对照挑选。
 *
 * 界面基准色对齐各主题官方 settings 的 background / foreground，
 * 强调色取该主题调色板中最具代表性的那一支。
 */
export const THEMES: readonly ThemeDefinition[] = [
  sesameLight,
  sesameDark,
  {
    id: 'dracula',
    name: 'Dracula',
    mode: 'dark',
    bg: '#282a36',
    fg: '#f8f8f2',
    accent: '#bd93f9',
    accentFg: '#21222c',
    rainbow: ['#bd93f9', '#50fa7b', '#ffb86c'],
    /* 缩略图用的语法色，与下面 styles 保持一致 */
    preview: {
      keyword: '#ff79c6',
      string: '#f1fa8c',
      fn: '#50fa7b',
      type: '#8be9fd',
      comment: '#6272a4',
    },
    editor: dracula,
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    mode: 'light',
    bg: '#ffffff',
    fg: '#24292e',
    accent: '#0969da',
    accentFg: '#ffffff',
    rainbow: ['#8250df', '#116329', '#953800'],
    /* 缩略图用的语法色，与下面 styles 保持一致 */
    preview: {
      keyword: '#d73a49',
      string: '#032f62',
      fn: '#6f42c1',
      type: '#005cc5',
      comment: '#6a737d',
    },
    editor: githubLight,
  },
  {
    id: 'monokai',
    name: 'Monokai',
    mode: 'dark',
    bg: '#272822',
    fg: '#f8f8f2',
    accent: '#a6e22e',
    accentFg: '#1e1f1c',
    rainbow: ['#ae81ff', '#a6e22e', '#fd971f'],
    /* 缩略图用的语法色，与下面 styles 保持一致 */
    preview: {
      keyword: '#f92672',
      string: '#e6db74',
      fn: '#a6e22e',
      type: '#66d9ef',
      comment: '#88846f',
    },
    editor: monokai,
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    mode: 'dark',
    bg: '#0d1117',
    fg: '#c9d1d9',
    accent: '#58a6ff',
    accentFg: '#0d1117',
    rainbow: ['#d2a8ff', '#7ee787', '#ffa657'],
    /* 缩略图用的语法色，与下面 styles 保持一致 */
    preview: {
      keyword: '#ff7b72',
      string: '#a5d6ff',
      fn: '#d2a8ff',
      type: '#79c0ff',
      comment: '#8b949e',
    },
    editor: githubDark,
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    mode: 'dark',
    bg: '#282c34',
    fg: '#abb2bf',
    accent: '#61afef',
    accentFg: '#21252b',
    rainbow: ['#c678dd', '#98c379', '#d19a66'],
    /* 缩略图用的语法色，与下面 styles 保持一致 */
    preview: {
      keyword: '#c678dd',
      string: '#98c379',
      fn: '#61afef',
      type: '#e5c07b',
      comment: '#7d8799',
    },
    editor: atomone,
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    mode: 'light',
    bg: '#fdf6e3',
    fg: '#657b83',
    accent: '#268bd2',
    accentFg: '#fdf6e3',
    rainbow: ['#6c71c4', '#859900', '#cb4b16'],
    /* 缩略图用的语法色，与下面 styles 保持一致 */
    preview: {
      keyword: '#859900',
      string: '#2aa198',
      fn: '#268bd2',
      type: '#b58900',
      comment: '#93a1a1',
    },
    editor: solarizedLight,
  },
  {
    id: 'nord',
    name: 'Nord',
    mode: 'dark',
    bg: '#2e3440',
    fg: '#d8dee9',
    accent: '#88c0d0',
    accentFg: '#2e3440',
    rainbow: ['#b48ead', '#a3be8c', '#ebcb8b'],
    /* 缩略图用的语法色，与下面 styles 保持一致 */
    preview: {
      keyword: '#5e81ac',
      string: '#a3be8c',
      fn: '#8fbcbb',
      type: '#ebcb8b',
      comment: '#4c566a',
    },
    editor: nord,
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    mode: 'dark',
    bg: '#002b36',
    fg: '#839496',
    accent: '#2aa198',
    accentFg: '#002b36',
    rainbow: ['#6c71c4', '#859900', '#cb4b16'],
    /* 缩略图用的语法色，与下面 styles 保持一致 */
    preview: {
      keyword: '#859900',
      string: '#2aa198',
      fn: '#268bd2',
      type: '#b58900',
      comment: '#586e75',
    },
    editor: solarizedDark,
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    mode: 'dark',
    bg: '#1a1b26',
    fg: '#c0caf5',
    accent: '#7aa2f7',
    accentFg: '#1a1b26',
    rainbow: ['#bb9af7', '#9ece6a', '#ff9e64'],
    /* 缩略图用的语法色，与下面 styles 保持一致 */
    preview: {
      keyword: '#bb9af7',
      string: '#9ece6a',
      fn: '#7aa2f7',
      type: '#0db9d7',
      comment: '#444b6a',
    },
    editor: tokyoNight,
  },
  {
    id: 'vscode-light',
    name: 'VS Code Light',
    mode: 'light',
    bg: '#ffffff',
    fg: '#383a42',
    accent: '#0070c1',
    accentFg: '#ffffff',
    rainbow: ['#af00db', '#098658', '#795e26'],
    /* 缩略图用的语法色，与下面 styles 保持一致 */
    preview: {
      keyword: '#0000ff',
      string: '#a31515',
      fn: '#795e26',
      type: '#267f99',
      comment: '#008000',
    },
    editor: vscodeLight,
  },
  {
    id: 'vscode-dark',
    name: 'VS Code Dark',
    mode: 'dark',
    bg: '#1e1e1e',
    fg: '#d4d4d4',
    accent: '#569cd6',
    accentFg: '#1e1e1e',
    rainbow: ['#c586c0', '#6a9955', '#ce9178'],
    /* 缩略图用的语法色，与下面 styles 保持一致 */
    preview: {
      keyword: '#569cd6',
      string: '#ce9178',
      fn: '#dcdcaa',
      type: '#4ec9b0',
      comment: '#6a9955',
    },
    editor: vscodeDark,
  },
];

/** 默认主题 id。 */
export const DEFAULT_THEME: ThemeId = 'sesame-light';

/**
 * 按 id 取主题。
 *
 * 找不到时回落到默认亮色，而**不是抛错**：设置文件可能被手改坏、
 * 或来自装了更多主题的旧版本。为此让整个应用白屏是不划算的。
 */
export function themeById(id: string): ThemeDefinition {
  return THEMES.find((item) => item.id === id) ?? THEMES[0]!;
}
