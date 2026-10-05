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

import type { Extension, Range } from '@codemirror/state';
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
 * 宽度通过**内联 CSS 变量**给出，而不是固定类名：每行的缩进深度都不同，
 * 参考线只该画在「该行的缩进区域」内，不能铺满整行。
 * 见 `buildGuides` 与 `indentGuideTheme` 的说明。
 */
function guideDecoration(indentCols: number, tabSize: number): Decoration {
  return Decoration.line({
    class: 'cm-indent-guide',
    attributes: {
      // 缩进区域宽度：线只画到这里
      style: `--indent-width:${indentCols}ch;--indent-step:${tabSize}ch`,
    },
  });
}

/**
 * 按当前视口生成装饰。
 *
 * 没有缩进的行不加装饰——参考线只该出现在有缩进的行上。
 */
function buildGuides(view: EditorView): DecorationSet {
  const { state } = view;
  const tabSize = state.tabSize;
  const ranges: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const first = state.doc.lineAt(from).number;
    const last = state.doc.lineAt(to).number;

    for (let n = first; n <= last; n++) {
      const line = state.doc.line(n);
      const cols = indentColumns(line.text, tabSize);
      if (cols === 0) continue;
      ranges.push(guideDecoration(cols, tabSize).range(line.from));
    }
  }

  // 行号递增，位置天然有序；显式传 true 让 CodeMirror 跳过排序
  return Decoration.set(ranges, true);
}

/**
 * 参考线插件。
 *
 * 构造函数负责**初始**计算（这一点 updateListener 做不到），
 * `update` 负责后续的文档、视口与缩进宽度变化。
 *
 * `tabSize` 变化也必须重算：竖线间距来自每行内联的 `--indent-step`，
 * 而那个值是在生成装饰时按当时的 `tabSize` 写死的。
 * 不重算的话，用户把缩进从 2 改成 4，线还停在原来的间距上。
 * 判据用 `state.tabSize` 的前后对比——它由 `EditorState.tabSize` facet
 * 提供，改设置时 `reconfigure` 会让它变化。
 */
const guidePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private tabSize: number;

    constructor(view: EditorView) {
      this.tabSize = view.state.tabSize;
      this.decorations = buildGuides(view);
    }

    update(update: ViewUpdate) {
      const tabSize = update.view.state.tabSize;
      const tabSizeChanged = tabSize !== this.tabSize;

      if (update.docChanged || update.viewportChanged || update.geometryChanged || tabSizeChanged) {
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
 * ## 关键：渐变必须**限制在缩进宽度内**，不能铺满整行
 *
 * 这是本实现踩过的最大一个坑。第一版把 `background-size` 设成缩进宽度、
 * 同时用 `background-repeat: repeat-x` 铺满整行，结果是竖线**横跨整个行宽**、
 * 每 2 个字符一条——看起来像稿纸，而不是缩进参考线。
 * 因为 `repeat-x` 会让那一份渐变在整行重复，而 `background-size`
 * 只控制每条渐变的宽度，两者叠加就成了密纹。
 *
 * 正确做法是把「重复」分成两层，不能混淆：
 *
 * 1. **外层**：`background-repeat: no-repeat`，只画一份，
 *    并用 `background-size` 把这一份的宽度限制为**该行的缩进宽度**
 *    （由内联样式给出，见 `buildGuides`）。
 * 2. **内层**：用 `repeating-linear-gradient` 在这份宽度里
 *    按一个缩进步长重复画线。
 *
 * ## 颜色
 *
 * 用 `--border-strong` 而不是 `--border-subtle`：后者在深色主题下
 * 几乎看不见。透明度再压一档，保证它不抢正文注意力。
 *
 * 注意这里**不需要 tabSize 参数**：竖线间距由每行内联的
 * `--indent-step` 变量给出（见 `guideDecoration`），
 * 因此改缩进宽度时不必重建这份主题，重算装饰即可。
 */
export function indentGuideTheme(): Extension {
  return EditorView.baseTheme({
    '.cm-indent-guide': {
      /*
       * 内层渐变：一个缩进宽度里画一条线，然后按该宽度重复。
       * `background-size` 的宽度由内联样式按行缩进覆盖，
       * 这里的值只是兜底（行没有内联宽度时用它）。
       */
      backgroundImage:
        'repeating-linear-gradient(to right, var(--border-strong) 0 1px, transparent 1px var(--indent-step))',
      // 只画一份：宽度由内联样式限制为「该行的缩进宽度」
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'var(--indent-width, 100%) 100%',
      backgroundPosition: '0 0',
      opacity: '0.5',
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
