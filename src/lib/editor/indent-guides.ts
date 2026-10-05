/**
 * 缩进参考线。
 *
 * 长函数里很难看清某一行属于哪一层嵌套。参考线在每一级缩进处画一条竖线，
 * 这是现代编辑器的标配，对阅读嵌套较深的代码帮助很大。
 *
 * ## 实现方式与取舍
 *
 * 用**行装饰 + 重复渐变背景**，而不是「为每个缩进层级生成一个装饰」：
 *
 * - 一个行装饰在整行上重复绘制竖线：`background-size` 取一个缩进宽度，
 *   `repeat-x` 就让线在每个缩进位出现。装饰数量与**行数**同阶，
 *   而不是与「行数 × 层级」同阶。
 * - 若改为每层一个装饰，一个 20 层嵌套的行就要 20 个装饰，
 *   长文件里装饰总数会爆炸。
 *
 * ## 为什么用 ViewPlugin 而不是 StateField + updateListener
 *
 * 这是踩过的坑：`updateListener` **不会为初始状态触发**，
 * 因此视图刚创建时装饰是空的，参考线要等到用户第一次编辑或滚动才出现——
 * 看起来就是「功能没生效」。
 *
 * `ViewPlugin` 的构造函数在视图创建时就会跑，天然覆盖初始状态。
 * 而且它持有 `EditorView`，能直接读 `visibleRanges` 只处理可见行。
 *
 * ## 只处理视口内的行
 *
 * 成本与**屏幕高度**相关，与文件总行数无关。可见行数通常只有几十行，
 * 每次滚动同步重算完全来得及，因此不需要额外的节流或 rAF 合并。
 */

import type { EditorState, Extension, Range } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

/**
 * 数出某行的缩进**列数**。
 *
 * 空格算 1 列，制表符按 `tabSize` 折算——与 CodeMirror 自身的列计算一致。
 * 遇到第一个非空白字符即停：行中间的空白不算缩进。
 */
function indentColumns(text: string, tabSize: number): number {
  let columns = 0;

  for (const ch of text) {
    if (ch === ' ') {
      columns += 1;
    } else if (ch === '\t') {
      columns += tabSize;
    } else {
      break;
    }
  }

  return columns;
}

/**
 * 一行有缩进时的装饰。
 *
 * ## 几何必须用**像素**，且必须锚在内容盒上
 *
 * 这里有两个都踩过的坑，合起来就是「线对不齐、贴到行号边框」：
 *
 * 1. **`ch` 不等于真实字符宽。** `ch` 是字体里 `0` 字形的宽度，
 *    而 CodeMirror 是按它自己**实测**的 `defaultCharacterWidth` 排版文本的。
 *    两者在多数等宽字体下相同，但不保证——一旦不等，缩进越多偏得越远。
 *    因此这里直接用 `view.defaultCharacterWidth` 换算成 `px`，
 *    与文本排版用同一个数字，天然对齐。
 * 2. **背景默认从 `padding-box` 起算，而文本从 `content-box` 起算。**
 *    `.cm-line` 有 CodeMirror 默认的 `padding: 0 2px 0 6px`，
 *    于是 `background-position: 0` 画在 padding 外沿——
 *    比文本起点左偏 6px，视觉上就「贴着行号边框」。
 *    主题里用 `background-origin: content-box` 修正（见 `indentGuideTheme`）。
 *
 * ## 宽度只覆盖**完整的**缩进层级
 *
 * 缩进不总是 `tabSize` 的整数倍（混用空格与制表符、或者手写 3 空格）。
 * 若直接把 `columns * charWidth` 当宽度，渐变会在右端切出**半条线**的残影。
 * 因此层数取 `floor(columns / tabSize)`，宽度取 `层数 × 步长`，
 * 只画完整层级。
 */
function guideDecoration(levels: number, charWidth: number, tabSize: number): Decoration {
  const step = tabSize * charWidth;

  return Decoration.line({
    class: 'cm-indent-guide',
    attributes: {
      style: `--indent-width:${levels * step}px;--indent-step:${step}px`,
    },
  });
}

/**
 * 数出一个缩进列数对应几级参考线。
 *
 * 只算完整层级——半级缩进不画线（见 `guideDecoration` 的说明）。
 */
function guideLevels(columns: number, tabSize: number): number {
  return Math.floor(columns / tabSize);
}

/**
 * 按当前视口生成装饰。
 *
 * ## 空行必须继承上一行的缩进
 *
 * 这是「竖线中间断开」的根因：空行的缩进列数是 0，按「无缩进就不画」
 * 处理的话，一个代码块中间夹一个空行，参考线就在那里断掉。
 * 实测用户截图里那几处断口正是空行造成的。
 *
 * 因此空行沿用**上一行的有效层级**，让块内的竖线视觉上连成一条。
 * 只有真正顶格的代码行（有内容且缩进为 0）才不画线。
 *
 * 视口的第一行若是空行，向后（向上）找最近的非空行作为种子；
 * 查找范围有上限，避免一个满是空行的文件把首帧拖慢。
 */
const BLANK_LOOKBACK = 200;

function buildGuides(view: EditorView): DecorationSet {
  const { state } = view;
  const tabSize = state.tabSize;
  /*
   * 用 CodeMirror 实测的字符宽度，而不是 CSS 的 `ch`。
   *
   * 这个值在字体或字号变化后会变，因此 `guidePlugin.update` 也要监听它
   * （见那里的说明）——否则用户改字号后线会整体错位。
   */
  const charWidth = view.defaultCharacterWidth;
  const ranges: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const first = state.doc.lineAt(from).number;
    const last = state.doc.lineAt(to).number;

    // 逐行向下走，空行沿用上一个有效层级
    let carried = -1;

    for (let n = first; n <= last; n++) {
      const line = state.doc.line(n);
      const blank = line.text.trim() === '';

      if (!blank) {
        const levels = guideLevels(indentColumns(line.text, tabSize), tabSize);
        carried = levels;
        if (levels > 0) {
          ranges.push(guideDecoration(levels, charWidth, tabSize).range(line.from));
        }
        continue;
      }

      // 空行：继承。视口首行则向上找种子
      let levels = carried;
      if (levels < 0) levels = lookbackLevels(state, n, tabSize);

      if (levels > 0) {
        carried = levels;
        ranges.push(guideDecoration(levels, charWidth, tabSize).range(line.from));
      }
    }
  }

  // 行号递增，位置天然有序；显式传 true 让 CodeMirror 跳过排序
  return Decoration.set(ranges, true);
}

/** 向上找最近非空行的缩进层级，用于视口首行是空行的情形。 */
function lookbackLevels(state: EditorState, lineNumber: number, tabSize: number): number {
  const stop = Math.max(1, lineNumber - BLANK_LOOKBACK);
  for (let n = lineNumber - 1; n >= stop; n--) {
    const text = state.doc.line(n).text;
    if (text.trim() === '') continue;
    return guideLevels(indentColumns(text, tabSize), tabSize);
  }
  return 0;
}

/**
 * 参考线插件。
 *
 * 构造函数负责**初始**计算（这一点 updateListener 做不到），
 * `update` 负责后续变化。
 *
 * ## 三个必须重算的触发条件
 *
 * 1. **文档变化**——行的缩进深度可能变了。
 * 2. **视口变化**——新进入视野的行需要补画。
 * 3. **字符宽度变化**——拖宽窗口、改字号、换字体都会改变
 *    `defaultCharacterWidth`，而参考线的位置是按它换算的像素值。
 *    不重算的话，用户改个字号线就整体错位。
 *
 * `geometryChanged` 覆盖第 3 点的大部分情况，但不能只依赖它：
 * 字体加载完成时几何可能变而 `geometryChanged` 不一定置位，
 * 因此这里**显式比对**字符宽度与 tabSize。
 */
const guidePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private charWidth: number;
    private tabSize: number;

    constructor(view: EditorView) {
      this.charWidth = view.defaultCharacterWidth;
      this.tabSize = view.state.tabSize;
      this.decorations = buildGuides(view);
    }

    update(update: ViewUpdate) {
      const charWidth = update.view.defaultCharacterWidth;
      const tabSize = update.view.state.tabSize;

      const metricsChanged = charWidth !== this.charWidth || tabSize !== this.tabSize;

      if (update.docChanged || update.viewportChanged || update.geometryChanged || metricsChanged) {
        this.charWidth = charWidth;
        this.tabSize = tabSize;
        this.decorations = buildGuides(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

/** 缩进参考线扩展。 */
export function indentGuides(): Extension {
  return guidePlugin;
}

/**
 * 参考线样式。
 *
 * 这个模块的样式改过几轮，每一轮都对应一个**实测**出来的缺陷，
 * 下面逐条记下来，避免以后又被改回去。
 *
 * ## 1. 渐变必须限制在缩进宽度内，不能铺满整行
 *
 * 第一版把 `background-size` 设成缩进宽度、同时用 `repeat-x`，
 * 结果竖线**横跨整个行宽**、每 2 个字符一条，像稿纸。
 * 原因是 `repeat-x` 让那一份渐变在**整行**重复，而 `background-size`
 * 只控制每条渐变的宽度，两者叠加就成了密纹。
 *
 * 正解是把「重复」拆成两层：
 * - **外层** `no-repeat`，用 `background-size` 把这一份限制为该行缩进宽度；
 * - **内层** 用 `repeating-linear-gradient` 在这份宽度里按步长重复画线。
 *
 * ## 2. 必须用 `background-origin: content-box`
 *
 * `.cm-line` 有 CodeMirror 默认的 `padding: 0 2px 0 6px`。
 * 背景默认从 **padding 盒**起算，而文本从 **content 盒**起算，
 * 于是每条参考线都比文本网格**左偏 6px**——看起来就是「贴着行号边框」。
 * `background-origin: content-box` 让两者对齐到同一个原点。
 *
 * ## 3. 绝不给这个元素设 `opacity`
 *
 * 早期用 `opacity: 0.5` 让线变淡，但 `.cm-indent-guide` 是**整行**的类，
 * `opacity` 会把该行的**文字一起变淡**——实测代码明显发灰。
 * 淡色必须写进颜色本身（`--indent-guide` 带 alpha），而不是靠元素透明度。
 *
 * ## 4. 线画在每个缩进单位的**中间**
 *
 * 第 k 级的线落在 `(k + 0.5) * step`，而不是 `k * step`。
 * 后者会让最外层那条线正好压在文本起点（内容盒最左侧），
 * 视觉上就是「贴住行号边框」。取中点还保证同一级缩进在不同行上
 * x 完全一致，从而跨行连成一条不间断的竖线。
 *
 * 因此渐变的首段要空出半个步长，且**最后必须有一个落在
 * `var(--indent-step)` 的停止点**——`repeating-linear-gradient`
 * 的重复周期由最远的色标位置决定，少了它周期会缩成半步长。
 */
export function indentGuideTheme(): Extension {
  return EditorView.baseTheme({
    '.cm-indent-guide': {
      backgroundImage:
        'repeating-linear-gradient(to right,' +
        ' transparent 0 calc(var(--indent-step) / 2),' +
        ' var(--indent-guide) calc(var(--indent-step) / 2) calc(var(--indent-step) / 2 + 1px),' +
        ' transparent calc(var(--indent-step) / 2 + 1px) var(--indent-step))',
      // 只画一份；宽度由内联样式限制为「该行的缩进宽度」
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'var(--indent-width, 100%) 100%',
      // 关键：让背景与文本共用同一个原点（见上文第 2 条）
      backgroundOrigin: 'content-box',
      backgroundClip: 'content-box',
      backgroundPosition: '0 0',
    },
  });
}

/**
 * 供调试：计算某段文本里哪些行有缩进（返回 1 基行号）。
 *
 * 本项目前端没有测试框架，因此这不是「供测试」。保留它是作为排查
 * 「参考线为什么没画出来」时的探针，可在 DevTools 控制台手动调用。
 */
export function guideLineNumbers(lines: readonly string[], tabSize: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? '';
    if (indentColumns(text, tabSize) > 0) out.push(i + 1);
  }
  return out;
}
