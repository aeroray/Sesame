/**
 * 折叠栏（行号右侧那一列）。
 *
 * 这里替换掉 CodeMirror 默认的箭头标记，原因有两点：
 *
 * 1. **位置**：默认实现把标记作为行内元素放进一个固定高度的盒子里，
 *    字形按基线排布，结果标记比同行行号低约 4px，看起来像挂在两行之间。
 *    这里改用 flex 居中，标记与所在行严格对齐。
 *
 * 2. **样式与尺寸**：默认的 `⌄` / `›` 是字体里的字符，字形细小、粗细不可控，
 *    且随用户所选字体而变。这里改用 **SVG 图标**（几何与 Lucide 的
 *    `chevron-down` / `chevron-right` 一致），尺寸用 em 跟随字号，
 *    并给单元格留出左右内边距，避免图标贴着行号或边框。
 *
 * 展开时箭头朝下，折叠时旋转为朝右——与 VSCode 的折叠栏表现一致。
 */

import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { t } from '$lib/i18n';

/** SVG 命名空间。 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Lucide `chevron-down` 的路径数据。
 *
 * 折叠态用同一个路径旋转 -90°（逆时针）得到朝右的箭头，
 * 这样两种状态共用一份几何，旋转动画也自然。
 */
const CHEVRON_DOWN_PATH = 'm6 9 6 6 6-6';

/**
 * 生成一个折叠标记（SVG 图标）。
 *
 * @param open `true` 表示该行当前是展开的（箭头朝下）；
 *             `false` 表示该行当前已折叠（箭头朝右）。
 *
 * 语义对照：CodeMirror 的 `markerDOM(open)` 里 `open` 指「折叠区间当前是否展开」，
 * 因此 `open === true` 对应「已展开」。
 */
export function foldMarkerDOM(open: boolean): HTMLElement {
  const span = document.createElement('span');
  span.className = open ? 'cm-foldMarker cm-foldMarker-open' : 'cm-foldMarker cm-foldMarker-closed';
  span.title = open ? t('fold.collapse') : t('fold.expand');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  // 2.5 而非 Lucide 默认的 2：小尺寸下略粗一点更清晰
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // 图标是纯装饰，语义由 title 提供
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', CHEVRON_DOWN_PATH);
  svg.appendChild(path);
  span.appendChild(svg);

  return span;
}

/**
 * 折叠标记的尺寸。
 *
 * 这个值同时决定两件事，必须保持一致：
 * 1. 折叠栏那一列的宽度；
 * 2. 行号**左侧**留出的空隙宽度。
 *
 * 这样行号左右两侧的空间相等，数字在整条 gutter 里是居中的；
 * 而右侧那份空间正好被折叠图标占用（见 `lineNumberGutterTheme`）。
 */
const MARKER_SIZE = '1.25em';

/**
 * 折叠栏样式。
 *
 * 尺寸都用 em，跟随 `editorFontTheme()` 设在 `.cm-gutters` 上的字号，
 * 因此用户调大字号时图标同步放大。
 */
export function foldGutterTheme(): Extension {
  return EditorView.baseTheme({
    /*
     * 单元格成为 flex 容器并垂直居中。
     * 默认实现是行内文本按基线排布，标记因此比同行行号低几个像素。
     *
     * 宽度固定为 MARKER_SIZE：这一列的宽度就是「图标占位」，
     * 行号左侧会留出同样宽度的空隙来对应它。
     */
    '.cm-foldGutter .cm-gutterElement': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: MARKER_SIZE,
    },

    '.cm-foldMarker': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: MARKER_SIZE,
      height: MARKER_SIZE,
      // 默认偏淡，悬停时提亮，避免整列图标喧宾夺主
      opacity: '0.55',
      transition: 'opacity 120ms ease, transform 120ms ease',
    },

    '.cm-foldMarker svg': {
      width: '100%',
      height: '100%',
      // 让 SVG 撑满容器，避免基线对齐带来的额外偏移
      display: 'block',
    },

    // 展开：箭头朝下，不旋转
    '.cm-foldMarker-open': {
      transform: 'rotate(0deg)',
    },

    /*
     * 折叠：箭头朝右。CSS 的 rotate 正值是顺时针，
     * 因此 -90deg 为逆时针，把朝下的箭头转为朝右。
     */
    '.cm-foldMarker-closed': {
      transform: 'rotate(-90deg)',
      // 折叠后颜色加重，让「哪一行被折叠了」一眼可见
      color: 'var(--brand-600)',
      opacity: '1',
    },

    // 悬停整行时提亮标记，明确「这里可以点」
    '.cm-foldGutter .cm-gutterElement:hover .cm-foldMarker': {
      opacity: '1',
    },
  });
}

/**
 * 行号栏样式。
 *
 * 字体由 `editorFontTheme()` 设在 `.cm-gutters` 上（与正文同一字体栈），
 * 这里只补数字排版与间距相关的部分。
 */
export function lineNumberGutterTheme(): Extension {
  return EditorView.baseTheme({
    /*
     * 用 flex 垂直居中，与折叠栏保持同一套对齐机制。
     *
     * 为什么不能只靠默认的行盒排布：CodeMirror 把每个 gutter 单元格的高度
     * 设成**正文行高**（由正文字号算出），但行号用的是小 1px 的字号，
     * 它的行盒比单元格矮，于是贴着单元格顶部摆放，数字墨迹比真正的行中心
     * 偏高约 1.5px（实测）。折叠箭头是 flex 居中的，两者就对不齐了。
     *
     * `justify-content: flex-end` 保留默认的右对齐。
     */
    '.cm-lineNumbers .cm-gutterElement': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      /*
       * 让数字左右两侧的空隙**恒等**，且右侧那份正好容纳折叠图标。
       *
       * gutter 的实际布局是：
       *   [ 行号列：padLeft + 数字 + padRight ][ 折叠列：MARKER_SIZE ]
       * 数字在行号列里是右对齐的，所以：
       *   左侧空隙 = padLeft
       *   右侧空隙 = padRight + MARKER_SIZE（折叠列始终占位）
       * 要两者相等，就取 padLeft = MARKER_SIZE、padRight = 0。
       *
       * 这样无论行号是几位数，两侧空隙都恒为 MARKER_SIZE，数字始终居中。
       */
      padding: `0 0 0 ${MARKER_SIZE}`,
      /*
       * 移除 CodeMirror 默认的 `min-width: 20px`。
       *
       * 它会让单元格比数字宽，多出的宽度被 flex-end 吸收到左侧，
       * 使左侧空隙大于 MARKER_SIZE，左右又不等了。
       * 去掉它是安全的：CodeMirror 另有一个隐藏的 spacer 元素，
       * 其宽度按**最大行号**计算，gutter 整体宽度依然稳定，不会随滚动抖动。
       */
      minWidth: '0',
      // 等宽数字：不同位数的行号宽度稳定，滚动时不会左右抖动
      fontVariantNumeric: 'tabular-nums',
      // 数字偏淡，不与正文争视觉；当前行恢复满对比度
      opacity: '0.7',
      /*
       * 行号不可选中。
       *
       * 用户想复制代码时很容易把行号一起选进去，粘出来的内容里混着数字，
       * 非常困扰（实测被指出）。行号是导航辅助，不是文档内容。
       */
      userSelect: 'none',
      cursor: 'default',
    },
    '.cm-lineNumbers .cm-activeLineGutter': {
      opacity: '1',
    },
  });
}
