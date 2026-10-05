/**
 * 编辑器主题。与 app.css 中的令牌保持一致，
 * 但这里必须用具体色值——CodeMirror 的样式注入在组件作用域之外。
 *
 * 字体与字号不在这里写死：它们由用户在设置里决定，
 * 通过 `editorFontTheme()` 生成的动态主题注入（见文件末尾）。
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { CJK_FALLBACK, quoteFont } from '$lib/utils/fonts';

/** 亮色主题的界面样式。 */
const lightUi = EditorView.theme(
  {
    '&': {
      color: 'oklch(0.22 0.008 60)',
      backgroundColor: 'oklch(1 0 0)',
    },
    '.cm-content': {
      caretColor: 'oklch(0.56 0.13 52)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'oklch(0.56 0.13 52)',
      borderLeftWidth: '2px',
    },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'oklch(0.88 0.06 62 / 0.55)',
      },
    '.cm-activeLine': {
      backgroundColor: 'oklch(0.96 0.003 65 / 0.7)',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'oklch(0.88 0.06 62 / 0.4)',
    },
    /*
     * 行号区与正文同底色，且不画右侧分隔线。
     *
     * 早先是略深的底色 + 一条 1px 右边框，想把「行号」与「正文」分开。
     * 实测那样反而割裂：编辑器左半边被切成两块色，参考线又紧贴着
     * 那条边框，看起来像线「贴到了边界上」。
     * 现在的做法是靠**留白**区分——行号本身比正文小 1px 且颜色更淡，
     * 已经足够形成层级，不需要再加线条和色块。
     *
     * 底色必须与 `.cm-editor` 的 backgroundColor 完全一致，
     * 否则滚动到边缘时能看出接缝。
     */
    '.cm-gutters': {
      backgroundColor: 'oklch(1 0 0)',
      color: 'oklch(0.65 0.006 60)',
      border: 'none',
      /*
       * 必须显式清掉 `borderRightWidth`。
       *
       * CodeMirror 的默认主题是在 `&light .cm-gutters` 里用
       * `&.cm-gutters-before { borderRightWidth: 1px }` 加这条线的，
       * 它的选择器比这里的 `.cm-gutters` **更具体**，
       * 只写 `border: none` 覆盖不掉——分隔线依然会出现（实测如此）。
       */
      '&.cm-gutters-before': { borderRightWidth: '0px' },
      '&.cm-gutters-after': { borderLeftWidth: '0px' },
    },
    /*
     * 当前行高亮。
     *
     * 行号区必须与正文用**完全相同**的底色，否则高亮横带会在
     * 行号与正文的交界处断开、露出一个色块接缝。
     * 早先这里用的是偏暖的 `oklch(0.94 0.032 65 / 0.6)`，
     * 与正文的 `oklch(0.96 0.003 65 / 0.7)` 色相不同（chroma 差 10 倍），
     * 把行号区底色改成与正文一致之后，这个差异就会直接暴露出来。
     */
    '.cm-activeLineGutter': {
      backgroundColor: 'oklch(0.96 0.003 65 / 0.7)',
      color: 'oklch(0.22 0.008 60)',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'oklch(0.94 0.032 65)',
      border: 'none',
      color: 'oklch(0.5 0.008 60)',
      padding: '0 4px',
      borderRadius: '0.25rem',
    },
    /*
     * 匹配括号的高亮。
     *
     * ## 默认用**强调色**，而不是写死的颜色
     *
     * 早先这里写死 `oklch(0.88 0.06 62 / 0.5)`（暖米色），
     * 那是强调色系统引入之前留下的。结果是括号高亮与整体配色脱节，
     * 用户换强调色时它纹丝不动。
     *
     * 现在用 `var(--brand-500)`——与按钮、焦点描边同一个来源，
     * 换强调色时括号高亮跟着变。
     */
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'color-mix(in oklch, var(--brand-500) 24%, transparent)',
      outline: 'none',
      borderRadius: '2px',
    },
    /*
     * 开启括号彩虹时，改用**该括号自己的颜色**做底纹。
     *
     * CodeMirror 生成的 DOM 是**嵌套**的，实测确认：
     *     <span class="cm-rainbow-1"><span class="cm-matchingBracket">[</span></span>
     * 匹配括号是内层 span，彩虹类是它的**直接父级**。
     * 因此用子选择器 `>` 精确匹配「有彩虹父级」的情形，
     * 内层通过 `currentColor` 拿到外层的彩虹色。
     *
     * 用属性前缀 `[class*="cm-rainbow-"]` 而不是逐个列出三个类名：
     * 档位数以后若从 3 调到 4，这条规则不需要跟着改。
     *
     * 这条比上面那条更具体（多一个父级限定），因此会覆盖它——
     * 不需要 `!important`，也不依赖选择器书写顺序。
     */
    '[class*="cm-rainbow-"] > .cm-matchingBracket, [class*="cm-rainbow-"] > .cm-nonmatchingBracket':
      {
        backgroundColor: 'color-mix(in oklch, currentColor 22%, transparent)',
      },
    '.cm-searchMatch': {
      backgroundColor: 'oklch(0.88 0.06 62 / 0.6)',
      outline: '1px solid oklch(0.72 0.12 58)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'oklch(0.8 0.09 60 / 0.8)',
    },
    '.cm-tooltip': {
      backgroundColor: 'oklch(1 0 0)',
      border: '1px solid oklch(0.84 0.006 65)',
      borderRadius: '0.5rem',
      boxShadow: '0 4px 16px oklch(0.22 0.008 60 / 0.12)',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'oklch(0.94 0.032 65)',
      color: 'oklch(0.22 0.008 60)',
    },
    '.cm-panels': {
      backgroundColor: 'oklch(0.96 0.003 65)',
      color: 'oklch(0.22 0.008 60)',
      borderTop: '1px solid oklch(0.91 0.004 65)',
    },
    /*
     * 搜索面板（亮色）。
     *
     * CodeMirror 内置样式是「网页控件」风格，且**垂直对齐靠不住**：
     * - `.cm-textfield` / `.cm-button` 用 `vertical-align: middle`
     * - 复选框是行内元素，按基线对齐，与文字不在同一中线上
     * - 关闭按钮 `position: absolute; top: 0`，被钉在面板顶端
     *
     * 因此这里统一改成 flex 布局，让所有子项由 `align-items: center` 居中，
     * 不再依赖 vertical-align 与基线。
     */
    '.cm-panel.cm-search': {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      // 右侧留出关闭按钮的宽度（它是绝对定位，不占流）
      padding: '5px 26px 5px 8px',
      fontSize: '12px',
      gap: '4px',
    },
    /*
     * 清掉 CodeMirror 给的 `margin: .2em .6em .2em 0`。
     * 间距改由容器的 `gap` 统一控制，否则每项右边多出的外边距会让
     * 复选框与它的文字之间裂开一道缝。
     */
    '.cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label': {
      margin: '0',
      fontSize: '12px',
      fontFamily: 'var(--font-sans)',
      lineHeight: '1.4',
    },
    '.cm-panel.cm-search input[type=text]': {
      backgroundColor: 'oklch(1 0 0)',
      color: 'oklch(0.22 0.008 60)',
      border: '1px solid oklch(0.91 0.004 65)',
      borderRadius: '0.25rem',
      padding: '0 6px',
      height: '22px',
      outline: 'none',
    },
    '.cm-panel.cm-search input[type=text]:focus': {
      borderColor: 'oklch(0.64 0.14 55)',
    },
    '.cm-panel.cm-search input[type=text]::placeholder': {
      color: 'oklch(0.65 0.006 60)',
    },
    /*
     * 按钮：幽灵按钮观感（透明底 + 悬停才出现底色）。
     *
     * 必须同时清掉 `backgroundImage`：CodeMirror 的默认按钮是用
     * `linear-gradient(...)` 画的渐变底，只设 `backgroundColor` 覆盖不掉它，
     * 按钮仍会显示那条深灰渐变（实测如此）。
     */
    '.cm-panel.cm-search button': {
      backgroundImage: 'none',
      backgroundColor: 'transparent',
      color: 'oklch(0.35 0.008 60)',
      border: '1px solid oklch(0.91 0.004 65)',
      borderRadius: '0.25rem',
      padding: '0 8px',
      height: '22px',
      cursor: 'pointer',
      transition: 'background-color 120ms ease',
    },
    '.cm-panel.cm-search button:hover': {
      backgroundImage: 'none',
      backgroundColor: 'oklch(0.94 0.004 65)',
    },
    '.cm-panel.cm-search button:active': {
      backgroundImage: 'none',
      backgroundColor: 'oklch(0.9 0.006 65)',
    },
    /*
     * 复选框标签。
     *
     * 用 inline-flex + align-items: center 把复选框与文字真正居中；
     * 靠默认的行内基线对齐会让复选框偏高（实测如此）。
     */
    '.cm-panel.cm-search label': {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      color: 'oklch(0.5 0.008 60)',
      fontSize: '11px',
      // CodeMirror 默认 `white-space: pre`，长标签会被撑成一行
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      userSelect: 'none',
    },
    '.cm-panel.cm-search input[type=checkbox]': {
      // 清掉默认外边距，间距由 label 的 gap 提供
      margin: '0',
      width: '13px',
      height: '13px',
      accentColor: 'oklch(0.64 0.14 55)',
      cursor: 'pointer',
      // 复选框自身不再受基线影响
      flexShrink: '0',
    },
    /*
     * 关闭按钮。
     *
     * CodeMirror 默认把它 `position: absolute; top: 0` 钉在顶端，
     * 且没有尺寸——所以显得又小又偏。这里给它一个 20px 的点击区，
     * 并用 `top: 50%` + `translateY(-50%)` 让它与整行垂直居中。
     */
    '.cm-panel.cm-search button[name=close]': {
      position: 'absolute',
      top: '50%',
      right: '6px',
      transform: 'translateY(-50%)',
      backgroundImage: 'none',
      backgroundColor: 'transparent',
      border: 'none',
      color: 'oklch(0.65 0.006 60)',
      width: '20px',
      height: '20px',
      padding: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '0.25rem',
      fontSize: '15px',
      lineHeight: '1',
    },
    '.cm-panel.cm-search button[name=close]:hover': {
      backgroundImage: 'none',
      backgroundColor: 'oklch(0.94 0.004 65)',
      color: 'oklch(0.22 0.008 60)',
    },
  },
  { dark: false },
);

/** 暗色主题的界面样式。 */
const darkUi = EditorView.theme(
  {
    '&': {
      color: 'oklch(0.93 0.004 65)',
      backgroundColor: 'oklch(0.19 0.006 60)',
    },
    '.cm-content': {
      caretColor: 'oklch(0.72 0.12 58)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'oklch(0.72 0.12 58)',
      borderLeftWidth: '2px',
    },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'oklch(0.47 0.11 50 / 0.45)',
      },
    '.cm-activeLine': {
      backgroundColor: 'oklch(0.23 0.007 60 / 0.6)',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'oklch(0.47 0.11 50 / 0.35)',
    },
    /*
     * 行号区与正文同底色、无右分隔线（理由见亮色主题的说明）。
     * 这里必须与 `&.backgroundColor` 一致：oklch(0.19 0.006 60)。
     */
    '.cm-gutters': {
      backgroundColor: 'oklch(0.19 0.006 60)',
      color: 'oklch(0.52 0.006 65)',
      border: 'none',
      // 同亮色主题：默认那条分隔线来自更具体的选择器，必须显式清掉
      '&.cm-gutters-before': { borderRightWidth: '0px' },
      '&.cm-gutters-after': { borderLeftWidth: '0px' },
    },
    // 与正文 `.cm-activeLine` 同色，保证高亮横带跨行号连续（理由见亮色主题）
    '.cm-activeLineGutter': {
      backgroundColor: 'oklch(0.23 0.007 60 / 0.6)',
      color: 'oklch(0.93 0.004 65)',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'oklch(0.29 0.007 60)',
      border: 'none',
      color: 'oklch(0.68 0.007 65)',
      padding: '0 4px',
      borderRadius: '0.25rem',
    },
    /*
     * 匹配括号高亮（暗色）。
     *
     * 与亮色主题同一套逻辑：默认用强调色，开了彩虹则用括号自己的颜色。
     * 亮色用 24% 的底纹，暗色提到 30%——深底上低透明度几乎看不出来。
     */
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'color-mix(in oklch, var(--brand-500) 30%, transparent)',
      outline: 'none',
      borderRadius: '2px',
    },
    '[class*="cm-rainbow-"] > .cm-matchingBracket, [class*="cm-rainbow-"] > .cm-nonmatchingBracket':
      {
        backgroundColor: 'color-mix(in oklch, currentColor 28%, transparent)',
      },
    '.cm-searchMatch': {
      backgroundColor: 'oklch(0.47 0.11 50 / 0.5)',
      outline: '1px solid oklch(0.64 0.14 55)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'oklch(0.56 0.13 52 / 0.7)',
    },
    '.cm-tooltip': {
      backgroundColor: 'oklch(0.23 0.007 60)',
      border: '1px solid oklch(0.37 0.008 60)',
      borderRadius: '0.5rem',
      boxShadow: '0 4px 16px oklch(0 0 0 / 0.4)',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'oklch(0.29 0.007 60)',
      color: 'oklch(0.93 0.004 65)',
    },
    '.cm-panels': {
      backgroundColor: 'oklch(0.23 0.007 60)',
      color: 'oklch(0.93 0.004 65)',
      borderTop: '1px solid oklch(0.29 0.007 60)',
    },
    /*
     * 搜索面板（暗色）。
     *
     * 布局与亮色**完全一致**（flex 居中、清 margin、关闭按钮居中），
     * 这里只覆盖颜色。两份若只改一处，切主题时对齐就会变——
     * 因此改布局必须两边同步。
     */
    '.cm-panel.cm-search': {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      padding: '5px 26px 5px 8px',
      fontSize: '12px',
      gap: '4px',
    },
    '.cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label': {
      margin: '0',
      fontSize: '12px',
      fontFamily: 'var(--font-sans)',
      lineHeight: '1.4',
    },
    '.cm-panel.cm-search input[type=text]': {
      backgroundColor: 'oklch(0.42 0.008 60)',
      color: 'oklch(0.95 0.004 65)',
      border: '1px solid oklch(0.5 0.008 60)',
      borderRadius: '0.25rem',
      padding: '0 6px',
      height: '22px',
      outline: 'none',
    },
    '.cm-panel.cm-search input[type=text]:focus': {
      borderColor: 'oklch(0.72 0.12 58)',
    },
    '.cm-panel.cm-search input[type=text]::placeholder': {
      color: 'oklch(0.72 0.006 65)',
    },
    /*
     * 按钮（暗色）。同样必须清掉 `backgroundImage`——
     * CodeMirror 用 `&dark .cm-button` 也设了一条渐变底，只改 backgroundColor 无效。
     */
    '.cm-panel.cm-search button': {
      backgroundImage: 'none',
      backgroundColor: 'transparent',
      color: 'oklch(0.9 0.004 65)',
      border: '1px solid oklch(0.42 0.008 60)',
      borderRadius: '0.25rem',
      padding: '0 8px',
      height: '22px',
      cursor: 'pointer',
      transition: 'background-color 120ms ease',
    },
    '.cm-panel.cm-search button:hover': {
      backgroundImage: 'none',
      backgroundColor: 'oklch(0.32 0.007 60)',
    },
    '.cm-panel.cm-search button:active': {
      backgroundImage: 'none',
      backgroundColor: 'oklch(0.38 0.008 60)',
    },
    '.cm-panel.cm-search label': {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      color: 'oklch(0.68 0.007 65)',
      fontSize: '11px',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      userSelect: 'none',
    },
    '.cm-panel.cm-search input[type=checkbox]': {
      margin: '0',
      width: '13px',
      height: '13px',
      accentColor: 'oklch(0.72 0.12 58)',
      cursor: 'pointer',
      flexShrink: '0',
    },
    '.cm-panel.cm-search button[name=close]': {
      position: 'absolute',
      top: '50%',
      right: '6px',
      transform: 'translateY(-50%)',
      backgroundImage: 'none',
      backgroundColor: 'transparent',
      border: 'none',
      color: 'oklch(0.75 0.006 65)',
      width: '20px',
      height: '20px',
      padding: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '0.25rem',
      fontSize: '15px',
      lineHeight: '1',
    },
    '.cm-panel.cm-search button[name=close]:hover': {
      backgroundImage: 'none',
      backgroundColor: 'oklch(0.32 0.007 60)',
      color: 'oklch(0.95 0.004 65)',
    },
  },
  { dark: true },
);

/** 亮色语法高亮。 */
const lightHighlight = HighlightStyle.define(
  [
    { tag: t.keyword, color: 'oklch(0.5 0.18 300)' },
    {
      tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
      color: 'oklch(0.45 0.12 30)',
    },
    { tag: [t.function(t.variableName), t.labelName], color: 'oklch(0.48 0.13 250)' },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: 'oklch(0.5 0.14 60)' },
    { tag: [t.definition(t.name), t.separator], color: 'oklch(0.35 0.02 60)' },
    { tag: [t.typeName, t.className, t.namespace], color: 'oklch(0.5 0.11 200)' },
    { tag: [t.number, t.bool, t.null], color: 'oklch(0.5 0.15 30)' },
    { tag: [t.operator, t.operatorKeyword], color: 'oklch(0.45 0.06 60)' },
    { tag: [t.string, t.special(t.string)], color: 'oklch(0.45 0.13 150)' },
    { tag: [t.meta, t.comment], color: 'oklch(0.6 0.02 120)', fontStyle: 'italic' },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: 'oklch(0.5 0.14 250)', textDecoration: 'underline' },
    { tag: t.heading, fontWeight: 'bold', color: 'oklch(0.35 0.1 50)' },
    { tag: [t.atom, t.special(t.variableName)], color: 'oklch(0.5 0.14 40)' },
    { tag: t.invalid, color: 'oklch(0.55 0.2 25)' },
  ],
  { themeType: 'light' },
);

/** 暗色语法高亮。 */
const darkHighlight = HighlightStyle.define(
  [
    { tag: t.keyword, color: 'oklch(0.78 0.12 300)' },
    {
      tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
      color: 'oklch(0.82 0.09 30)',
    },
    { tag: [t.function(t.variableName), t.labelName], color: 'oklch(0.78 0.1 250)' },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: 'oklch(0.82 0.1 70)' },
    { tag: [t.definition(t.name), t.separator], color: 'oklch(0.88 0.01 65)' },
    { tag: [t.typeName, t.className, t.namespace], color: 'oklch(0.8 0.09 200)' },
    { tag: [t.number, t.bool, t.null], color: 'oklch(0.8 0.11 35)' },
    { tag: [t.operator, t.operatorKeyword], color: 'oklch(0.75 0.03 65)' },
    { tag: [t.string, t.special(t.string)], color: 'oklch(0.8 0.1 150)' },
    { tag: [t.meta, t.comment], color: 'oklch(0.62 0.02 130)', fontStyle: 'italic' },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: 'oklch(0.78 0.1 250)', textDecoration: 'underline' },
    { tag: t.heading, fontWeight: 'bold', color: 'oklch(0.85 0.08 60)' },
    { tag: [t.atom, t.special(t.variableName)], color: 'oklch(0.82 0.1 45)' },
    { tag: t.invalid, color: 'oklch(0.7 0.16 25)' },
  ],
  { themeType: 'dark' },
);

/** 取得指定模式的主题扩展。 */
export function editorTheme(dark: boolean): Extension {
  return dark
    ? [darkUi, syntaxHighlighting(darkHighlight)]
    : [lightUi, syntaxHighlighting(lightHighlight)];
}

/**
 * 由用户选择生成编辑器字体主题。
 *
 * 字体栈的组装顺序（从左到右匹配）：
 *   用户选的字体 → 默认等宽（补拉丁字形）→ 中文字体 → monospace
 *
 * 行号栏**跟随编辑器字体**，而不是界面字体：行号属于代码编辑面，
 * 与代码同栏显示、需要逐行对齐，用同一字体才视觉连贯（VSCode 同此做法）。
 * 早先只给 `.cm-content` 设了字体，行号便落回界面的无衬线字体，
 * 一列数字与正文风格割裂。
 *
 * @param editorFont 编辑器字体。空字符串表示使用内置的默认等宽字体栈。
 * @param fontSize 字号（px）。
 */
export function editorFontTheme(editorFont: string, fontSize: number): Extension {
  const stack: string[] = [];

  if (editorFont) {
    stack.push(quoteFont(editorFont));
    // 用户选的字体可能不含等宽拉丁字形（例如中文字体），补一层默认等宽
    stack.push('var(--font-mono)');
  } else {
    // 默认：用 app.css 里已带中文回退的等宽栈
    stack.push('var(--font-mono)');
  }

  stack.push(...CJK_FALLBACK.map(quoteFont), 'monospace');

  const family = stack.join(', ');

  return EditorView.theme({
    '&': { fontSize: `${fontSize}px` },
    // 正文与行号共用同一字体栈，保证一列数字与代码风格一致
    '.cm-content': { fontFamily: family },
    '.cm-gutters': {
      fontFamily: family,
      // 行号比正文小 1px，避免抢视觉；下限 9px 防止字号设得过小时行号消失
      fontSize: `${Math.max(fontSize - 1, 9)}px`,
    },
  });
}
