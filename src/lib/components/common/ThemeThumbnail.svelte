<script lang="ts">
/**
 * 主题缩略图。
 *
 * ## 为什么不用两个色块
 *
 * 早先每个主题只用「背景色 + 强调色」两个小色块示意。问题是：
 * **色块说明不了一套主题长什么样**——Dracula 和 Monokai 都是深紫调，
 * 光看色块几乎分不出来；而用户真正在意的其实是代码显示出来的效果。
 *
 * 这里画出**缩略的代码行**：用该主题真实的语法色渲染几根彩色短线，
 * 模拟「关键字、字符串、函数、类型、注释」的样子。用户一眼就能看出
 * 这套主题的性格，比读名字快得多。
 *
 * ## 颜色必须与真实编辑器一致
 *
 * 取自 `ThemeDefinition.preview`，而那几支色与主题的 `editor.styles`
 * 是同一套值。缩略图若与真实编辑器不是同一配色，预览就失去意义。
 *
 * ## 线条宽度是刻意不规则的
 *
 * 若每根线一样长，看起来像条形码；按「词长」排布才像代码。
 * 用固定的一组宽度模拟真实代码的参差感。
 */
import type { ThemeDefinition } from '$lib/theme/palettes';

interface Props {
  theme: ThemeDefinition;
  /** 尺寸档位。`sm` 用于标题栏下拉，`md` 用于设置面板。 */
  size?: 'sm' | 'md';
}

let { theme, size = 'md' }: Props = $props();

const p = $derived(theme.preview);

/*
 * 模拟三行代码。每行是若干「词」，每个词有颜色与相对宽度。
 * 宽度用 flex 比例表示，不写死像素——这样缩略图能适应不同尺寸。
 */
const rows = $derived([
  // 第一行：关键字 + 函数名 + 圆括号
  [
    { color: p.keyword, w: 3 },
    { color: p.fn, w: 4 },
    { color: p.comment, w: 1 },
  ],
  // 第二行：缩进 + 类型 + 字符串
  [
    { color: p.type, w: 2 },
    { color: p.string, w: 5 },
  ],
  // 第三行：注释（整行）
  [{ color: p.comment, w: 6 }],
]);

/** 尺寸相关的类名。 */
const box = $derived(size === 'sm' ? 'h-7 w-11 gap-[3px] p-1' : 'h-9 w-14 gap-1 p-1.5');
const bar = $derived(size === 'sm' ? 'h-[3px]' : 'h-1');
</script>

<!--
  缩略图本体。
  背景与前景都来自主题数据，因此每套主题的缩略图都不同。
-->
<span
  class="flex shrink-0 flex-col justify-center overflow-hidden rounded-md ring-1 ring-black/10 {box}"
  style="background-color: {theme.bg}"
  aria-hidden="true"
>
  {#each rows as row, i (i)}
    <span class="flex items-center gap-[3px]" style="padding-left: {i === 1 ? '18%' : '0'}">
      {#each row as word, j (j)}
        <span
          class="rounded-full {bar}"
          style="background-color: {word.color}; flex: {word.w} 1 0%"
        ></span>
      {/each}
    </span>
  {/each}
</span>
