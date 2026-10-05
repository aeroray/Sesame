/**
 * 括号彩虹：按嵌套层级给括号上不同颜色。
 *
 * ## 默认关闭
 *
 * 它与设计规范里「安静」的主张有张力——彩色括号是主动吸引注意力的装饰。
 * 因此做成**可选设置且默认关闭**：需要的人打开，不需要的人完全感知不到。
 *
 * ## 层级怎么算
 *
 * 难点是「视口内某一行的括号处于第几层」——只扫可见行算不出来，
 * 必须知道进入视口时的起始层级。三种做法：
 *
 * 1. 每次从文档开头扫到视口末尾 —— 滚到底部时 O(n)，不可接受。
 * 2. 只扫视口、忽略进入前的深度 —— 层级会错，颜色乱跳。
 * 3. **预计算每行行首的深度并缓存** —— 本文采用。
 *
 * 缓存放在 `StateField` 里：文档变化时重算一次（O(n)），
 * 之后任意行的起始深度都是 O(1) 查表，滚动时零成本。
 *
 * ## 为什么要跳过字符串与注释
 *
 * `printf("(((")` 里的三个左括号若参与计数，后面所有括号的层级都会错位、
 * 颜色整体偏掉。因此扫的时候要跳过这些区间。
 *
 * ## 性能上的两个关键决定
 *
 * 1. **文档超过阈值直接不启用**。预计算是 O(n) 且要为每行存一个数；
 *    大文件模式下语法高亮本身就是负担，再叠一层只会更卡。
 * 2. **跳过区间用游标推进，不是每字符线性查找**。
 *    后者是 O(字符数 × 区间数)，几十万字符的文档会慢到不可用。
 *    区间由 `syntaxTree.iterate` 按文档顺序产生，因此一个只前进的
 *    下标就够了。
 */

import {
  EditorView,
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

/**
 * 超过这个文档长度就不启用（字符数）。
 *
 * 取 20 万：约 4 MB 的纯 ASCII 文本。到这个量级时语法高亮本身
 * 已经开始吃力，彩色括号的边际价值不足以抵消开销。
 */
const MAX_DOC_LENGTH = 200_000;

/** 颜色档位数。超过就回绕。 */
const DEPTH_COLORS = 3;

/** 参与着色的括号字符。 */
const OPENERS = '([{';
const CLOSERS = ')]}';

/** 一个括号标记。 */
const bracketMark = (depth: number) =>
  Decoration.mark({ class: `cm-rainbow-${depth % DEPTH_COLORS}` });

/**
 * 跳过区间：字符串与注释。
 *
 * 用游标推进消费，见 `scanBrackets`。
 */
type SkipRanges = [number, number][];

/** 取出 `[from, to)` 内的字符串/注释区间，按位置升序。 */
function skipRanges(state: EditorState, from: number, to: number): SkipRanges {
  const out: SkipRanges = [];

  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      // 这些节点里的括号不参与配对
      if (/string|comment|regexp/i.test(node.name)) {
        out.push([node.from, node.to]);
      }
    },
  });

  return out;
}

/**
 * 扫描一段文本，累计括号深度。
 *
 * @param text 待扫描的文本
 * @param startDepth 扫描开始前的深度
 * @param baseOffset `text` 在文档中的起始位置，用于与跳过区间比对
 * @param skips 跳过区间（按位置升序）
 * @param onBracket 每遇到一个参与计数的括号时回调（位置, 深度）
 * @returns 扫描结束后的深度
 */
function scanBrackets(
  text: string,
  startDepth: number,
  baseOffset: number,
  skips: SkipRanges,
  onBracket?: (pos: number, depth: number) => void,
): number {
  let depth = startDepth;
  /*
   * 跳过区间的游标。区间按位置升序且不重叠，因此只前进不回退——
   * 这是把「每字符线性查找」降成「均摊 O(1)」的关键。
   */
  let skipIndex = 0;

  for (let i = 0; i < text.length; i++) {
    const pos = baseOffset + i;
    // `charAt` 而不是 `text[i]`：后者在 `noUncheckedIndexedAccess` 下
    // 类型是 `string | undefined`，而这里已经由循环条件保证有字符。
    const ch = text.charAt(i);

    // 推进游标，跳过所有已经结束的区间
    while (skipIndex < skips.length && (skips[skipIndex]?.[1] ?? Infinity) <= pos) {
      skipIndex++;
    }

    // 落在当前区间内则不计
    const current = skips[skipIndex];
    const inSkip = current !== undefined && pos >= current[0];

    if (!inSkip) {
      if (OPENERS.includes(ch)) {
        onBracket?.(pos, depth);
        depth += 1;
      } else if (CLOSERS.includes(ch)) {
        depth = Math.max(0, depth - 1);
        onBracket?.(pos, depth);
      }
    }
  }

  return depth;
}

/**
 * 每行**行首**的括号深度。
 *
 * `depths[i]` = 第 i+1 行开头时已有多少个未闭合的左括号。
 * 文档过大时为 `null`，表示不启用。
 */
const depthField = StateField.define<number[] | null>({
  create: (state) => computeDepths(state),
  update(value, tr) {
    if (!tr.docChanged) return value;
    return computeDepths(tr.state);
  },
});

/**
 * 预计算每行行首的深度。
 *
 * 必须扫全文而不是可见范围——只有从文档开头数起，行首深度才是准的。
 * 返回 `null` 表示文档太大，不启用。
 */
function computeDepths(state: EditorState): number[] | null {
  const doc = state.doc;
  if (doc.length > MAX_DOC_LENGTH) return null;

  const depths: number[] = new Array(doc.lines);
  depths[0] = 0;

  // 全文的跳过区间。成本与文档长度相关，因此有上面的上限兜着。
  const skips = skipRanges(state, 0, doc.length);

  let depth = 0;
  let skipIndex = 0;

  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    depths[n - 1] = depth;

    for (let i = 0; i < line.text.length; i++) {
      const pos = line.from + i;
      const ch = line.text.charAt(i);

      while (skipIndex < skips.length && (skips[skipIndex]?.[1] ?? Infinity) <= pos) {
        skipIndex++;
      }
      const current = skips[skipIndex];
      if (current !== undefined && pos >= current[0]) continue;

      if (OPENERS.includes(ch)) depth += 1;
      else if (CLOSERS.includes(ch)) depth = Math.max(0, depth - 1);
    }
  }

  return depths;
}

/** 为可见范围内的括号生成着色标记。 */
function buildMarks(view: EditorView): DecorationSet {
  const { state } = view;
  const depths = state.field(depthField, false);
  if (!depths) return Decoration.none;

  const marks: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const first = state.doc.lineAt(from).number;
    const last = state.doc.lineAt(to).number;

    // 跳过区间只取可见范围，成本与屏幕高度相关
    const skips = skipRanges(state, from, to);
    let depth = depths[first - 1] ?? 0;

    for (let n = first; n <= last; n++) {
      const line = state.doc.line(n);
      depth = scanBrackets(line.text, depth, line.from, skips, (pos, d) => {
        marks.push(bracketMark(d).range(pos, pos + 1));
      });
    }
  }

  return Decoration.set(marks, true);
}

/**
 * 括号彩虹扩展。
 *
 * `ViewPlugin` 的构造函数会为初始状态算一次，因此刚打开文件时括号
 * 就是有色的。用 `updateListener` 做不到这一点——它不为初始状态触发，
 * 缩进参考线踩过那个坑。
 */
export function rainbowBrackets(): Extension {
  return [
    depthField,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildMarks(view);
        }

        update(update: ViewUpdate) {
          // 文档变化会重算 depthField；视口变化要补画新进入视野的行
          if (update.docChanged || update.viewportChanged) {
            this.decorations = buildMarks(update.view);
          }
        }
      },
      { decorations: (p) => p.decorations },
    ),
  ];
}

/**
 * 三档颜色。
 *
 * 用色相区分而不是明度：明度差在深色主题下容易被背景吞掉。
 * 三档足够看出层级，又不会像七色那样花。
 *
 * 深色主题单独提亮一档，否则三档都偏暗、与正文对比不足。
 */
export const rainbowBracketsTheme: Extension = EditorView.baseTheme({
  '.cm-rainbow-0': { color: 'oklch(0.62 0.16 264)' },
  '.cm-rainbow-1': { color: 'oklch(0.58 0.15 150)' },
  '.cm-rainbow-2': { color: 'oklch(0.64 0.16 40)' },

  '&dark .cm-rainbow-0': { color: 'oklch(0.76 0.13 264)' },
  '&dark .cm-rainbow-1': { color: 'oklch(0.78 0.13 150)' },
  '&dark .cm-rainbow-2': { color: 'oklch(0.8 0.13 40)' },
});

/**
 * 供测试与调试：取一段文本里每个括号的层级。
 *
 * 纯函数，不依赖 EditorView，因此可以直接单测层级算法。
 */
export function bracketDepths(text: string, startDepth = 0): number[] {
  const out: number[] = [];
  scanBrackets(text, startDepth, 0, [], (_pos, depth) => out.push(depth));
  return out;
}

/** 供测试与调试：扫描一段文本后的最终深度。 */
export function finalDepth(text: string, startDepth = 0): number {
  return scanBrackets(text, startDepth, 0, []);
}
