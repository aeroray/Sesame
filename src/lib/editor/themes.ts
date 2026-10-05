/**
 * 编辑器中「与主题无关」的那部分样式。
 *
 * ## 分工
 *
 * 配色（背景、前景、行号、语法高亮、光标、选中）由主题包负责——
 * 见 `lib/theme/palettes.ts` 里的 `@uiw/codemirror-theme-*`。
 * 本文件只管主题包**不涉及**的东西：
 *
 * - 搜索面板的布局（CodeMirror 内置样式是「网页控件」风格，对齐靠不住）
 * - 折叠占位符、提示气泡、自动补全列表
 * - 匹配括号、搜索命中、缩进参考线等 Sesame 特有的细节
 *
 * ## 全部用 CSS 变量，因此不需要亮暗两份
 *
 * 早先这里有 `lightUi` / `darkUi` 两段几乎相同的样式，只有色值不同，
 * 加起来近 500 行。现在色值全部走 `var(--...)`（由主题写入 `<html>`），
 * 布局规则只写一遍——**换主题时这份样式不需要变**。
 *
 * 这样也消除了「改了亮色忘了改暗色」这类不一致：它们本来就是同一份布局。
 */

import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { CJK_FALLBACK, quoteFont } from '$lib/utils/fonts';

/**
 * 搜索面板与各类浮层的样式。
 *
 * 与主题无关，因此用 `baseTheme`——它不带亮暗标记，
 * 所有主题下都生效。
 */
export const sesameUiTheme: Extension = EditorView.baseTheme({
  /*
   * 匹配括号的高亮。
   *
   * 默认用**主题强调色**。早先这里写死 `oklch(0.88 0.06 62 / 0.5)`
   * （暖米色），是强调色系统引入前留下的，导致括号高亮与整体配色脱节、
   * 换主题时纹丝不动。
   */
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: 'color-mix(in oklab, var(--match-bracket) 26%, transparent)',
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
   * 用属性前缀而不是逐个列出档位类名：档位数以后从 3 调到 4 时不用改。
   * 这条比上面那条更具体，会自然覆盖它，不需要 `!important`。
   */
  '[class*="cm-rainbow-"] > .cm-matchingBracket, [class*="cm-rainbow-"] > .cm-nonmatchingBracket': {
    backgroundColor: 'color-mix(in oklab, currentColor 24%, transparent)',
  },

  '.cm-searchMatch': {
    backgroundColor: 'color-mix(in oklab, var(--match-bracket) 30%, transparent)',
    outline: '1px solid color-mix(in oklab, var(--match-bracket) 55%, transparent)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'color-mix(in oklab, var(--match-bracket) 50%, transparent)',
  },

  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--secondary)',
    border: 'none',
    color: 'var(--content-muted)',
    padding: '0 4px',
    borderRadius: '0.25rem',
  },

  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    boxShadow: '0 4px 16px rgb(0 0 0 / 0.16)',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-foreground)',
  },

  '.cm-panels': {
    backgroundColor: 'var(--surface-sunken)',
    color: 'var(--content)',
    borderTop: '1px solid var(--border-subtle)',
  },

  /*
   * 搜索面板布局。
   *
   * CodeMirror 内置样式是「网页控件」风格，且**垂直对齐靠不住**：
   * - `.cm-textfield` / `.cm-button` 用 `vertical-align: middle`
   * - 复选框是行内元素，按基线对齐，与文字不在同一中线上
   * - 关闭按钮 `position: absolute; top: 0`，被钉在面板顶端
   *
   * 因此统一改成 flex，让所有子项由 `align-items: center` 居中，
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
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: '0.25rem',
    padding: '0 6px',
    height: '22px',
    outline: 'none',
  },
  '.cm-panel.cm-search input[type=text]:focus': {
    borderColor: 'var(--ring)',
  },
  '.cm-panel.cm-search input[type=text]::placeholder': {
    color: 'var(--content-faint)',
  },
  /*
   * 按钮：幽灵按钮观感（透明底 + 悬停才出现底色）。
   *
   * 必须同时清掉 `backgroundImage`：CodeMirror 的默认按钮是用
   * `linear-gradient(...)` 画的渐变底，只设 `backgroundColor` 覆盖不掉它，
   * 按钮仍会显示那条深灰渐变（实测如此）。亮暗主题都设了这条渐变，
   * 因此 `:hover` / `:active` 也要各写一遍。
   */
  '.cm-panel.cm-search button': {
    backgroundImage: 'none',
    backgroundColor: 'transparent',
    color: 'var(--content-muted)',
    border: '1px solid var(--border)',
    borderRadius: '0.25rem',
    padding: '0 8px',
    height: '22px',
    cursor: 'pointer',
    transition: 'background-color 120ms ease',
  },
  '.cm-panel.cm-search button:hover': {
    backgroundImage: 'none',
    backgroundColor: 'var(--secondary)',
  },
  '.cm-panel.cm-search button:active': {
    backgroundImage: 'none',
    backgroundColor: 'var(--muted)',
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
    color: 'var(--content-muted)',
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
    accentColor: 'var(--ring)',
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
    color: 'var(--content-faint)',
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
    backgroundColor: 'var(--secondary)',
    color: 'var(--content)',
  },
});

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
