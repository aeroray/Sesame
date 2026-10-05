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
 * ## 只处理视口内的行
 *
 * 用 `EditorView.decorations.compute` 并显式依赖 `viewport`：
 * `StateField` 拿不到视口信息，只能全量计算，几万行的文件会明显变慢。
 * 但 `compute` 的回调**只拿到 state**，拿不到 view 的视口——
 * 因此这里改用 `EditorView.updateListener` 配合 `view.visibleRanges`
 * 主动 dispatch 装饰，见下方 `indentGuides`。
 */

import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';
import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state';

/** 一行有缩进时的装饰。 */
const guideLine = Decoration.line({ class: 'cm-indent-guide' });

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

/** 用新的装饰替换旧的。 */
const setGuides = StateEffect.define<DecorationSet>();

/**
 * 装饰字段。
 *
 * 装饰由 `updateListener` 主动 dispatch（因为它需要 view 的视口信息），
 * 这里只负责保存与映射。
 *
 * `map` 让装饰在文档编辑后跟随位置移动——否则插入一行之后，
 * 下面所有行的参考线都会错位一行。
 */
const guideField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(guides, tr) {
    // 显式设置时直接替换
    for (const e of tr.effects) {
      if (e.is(setGuides)) return e.value;
    }
    // 文档变化时映射位置；否则原样保留
    return tr.docChanged ? guides.map(tr.changes) : guides;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * 按当前视口重算装饰。
 *
 * 只遍历可见行，因此成本与**屏幕高度**相关，与文件总行数无关。
 */
function refreshGuides(view: EditorView): void {
  const { state } = view;
  const tabSize = state.tabSize;
  const ranges: ReturnType<typeof guideLine.range>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const first = state.doc.lineAt(from).number;
    const last = state.doc.lineAt(to).number;

    for (let n = first; n <= last; n++) {
      const line = state.doc.line(n);
      if (indentColumns(line.text, tabSize) === 0) continue;
      ranges.push(guideLine.range(line.from));
    }
  }

  // 行号递增，位置天然有序；显式传 true 让 CodeMirror 跳过排序
  view.dispatch({ effects: setGuides.of(Decoration.set(ranges, true)) });
}

/**
 * 缩进参考线扩展。
 *
 * 三个触发点：
 * - 初始挂载
 * - 文档变化（行数与缩进都可能变）
 * - 视口变化（滚动，需要补画新进入视野的行）
 *
 * 用 `requestAnimationFrame` 合并同一帧内的多次刷新：
 * 快速滚动会连续触发 `viewportChanged`，逐次重算纯属浪费。
 */
export function indentGuides(): Extension {
  return [
    guideField,
    EditorView.updateListener.of((update) => {
      if (!update.docChanged && !update.viewportChanged && !update.geometryChanged) return;
      scheduleRefresh(update.view);
    }),
  ];
}

/** 每个 view 一个待执行的刷新句柄，避免重复排队。 */
const pending = new WeakMap<EditorView, number>();

function scheduleRefresh(view: EditorView): void {
  if (pending.has(view)) return;

  const handle = requestAnimationFrame(() => {
    pending.delete(view);
    refreshGuides(view);
  });

  pending.set(view, handle);
}

/**
 * 参考线样式。
 *
 * ## 为什么用 backgroundImage 而不是 border-left
 *
 * `border-left` 只能画一条线，而参考线需要在**每一级**缩进都出现。
 * 重复渐变能在整行宽度上按 `background-size` 的步长重复绘制，
 * 一次搞定所有层级。
 *
 * 用 `--border-strong` 而不是 `--border-subtle`：后者在深色主题下
 * 几乎看不见。透明度再压一档，保证它不抢正文注意力。
 */
export const indentGuideTheme: Extension = EditorView.baseTheme({
  '.cm-indent-guide': {
    backgroundImage:
      'linear-gradient(to right, var(--border-strong) 1px, transparent 1px)',
    backgroundRepeat: 'repeat-x',
    // 步长 = 一个缩进宽度（1ch ≈ 一个字符宽），高度铺满整行
    backgroundSize: '1ch 100%',
    // 从 0.5ch 起画，让线落在缩进块的中间而不是紧贴行首
    backgroundPosition: '0.5ch 0',
    opacity: '0.4',
  },
});
