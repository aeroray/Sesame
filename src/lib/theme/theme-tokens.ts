/**
 * 由主题的基准色推导全部界面令牌。
 *
 * ## 为什么推导而不是逐条声明
 *
 * 界面有 30 多个令牌（背景/卡片/浮层/次级/静音/边框/输入框/正文三级……）。
 * 若每套主题都手写这 30 个色值，13 套主题就是 400 个数——不可能维护，
 * 而且一定会出现「改了背景忘了改边框」这类不一致。
 *
 * 这里只要求每套主题给出 **4 个基准色**，其余用 `color-mix()` 按固定比例
 * 推导。好处：
 *
 * - 新增主题的成本 = 4 个色值
 * - 亮暗两套共用同一套比例，对比度关系天然一致
 * - 想整体调深浅时只改比例，一处生效
 *
 * ## 亮暗用不同的混合方向
 *
 * 亮色主题的层级是「越浮起越白」，暗色是「越浮起越亮」——两者方向相反，
 * 因此 `deriveTokens()` 按 `mode` 分两套比例。
 *
 * 这些比例是照着原有手工调过的亮暗两套令牌反推出来的，视觉上等价。
 */

import type { ThemeDefinition } from './palettes';

/** 一个主题推导出的全部界面令牌。 */
export type ThemeTokens = Record<string, string>;

/**
 * 把基准色与白色/黑色按比例混合。
 *
 * `color-mix()` 由浏览器解析，因此这里返回的是**字符串**而不是计算后的色值。
 * 好处是主题切换时只需换 `<html>` 上的变量，不必重算。
 *
 * @param base 基准色
 * @param mixWith 混合目标
 * @param weight 基准色占比（0-100）
 */
function mix(base: string, mixWith: 'white' | 'black', weight: number): string {
  return `color-mix(in oklab, ${base} ${weight}%, ${mixWith})`;
}

/**
 * 在两个**主题色**之间插值。
 *
 * 与 `mix()` 的区别：那个是「往纯白/纯黑掺」，这个是在前景色与背景色
 * 之间过渡。推导正文次级色、边框色时用它——它们应该是
 * 「前景色往背景色方向退」，而不是往纯白退（纯白在彩色主题上会发灰）。
 *
 * @param from 起点色（通常前景）
 * @param to 终点色（通常背景）
 * @param weight 起点色占比（0-100）
 */
function blend(from: string, to: string, weight: number): string {
  return `color-mix(in oklab, ${from} ${weight}%, ${to})`;
}

/**
 * 色阶推导用的小工具：把强调色按「向白或向黑」的比例混合。
 *
 * 单独抽出来是因为色阶那一段要写 20 次，直接调 `mix` 会把
 * `'white' | 'black'` 字面量类型绕过去（TS 会把变量推断成 `string`）。
 */
function step(base: string, dir: 'white' | 'black', weight: number): string {
  return mix(base, dir, weight);
}

/**
 * 由主题推导界面令牌。
 *
 * 比例命名规则：`mix(bg, 'white', 96)` 表示「96% 的背景色 + 4% 白」，
 * 即比背景略亮一点点。
 */
export function deriveTokens(theme: ThemeDefinition): ThemeTokens {
  const { bg, fg, accent, accentFg, mode } = theme;
  const light = mode === 'light';

  /*
   * 层级色。亮色往白里走、暗色往白里走但幅度更小——
   * 暗色下过亮会显得脏，因此幅度普遍只有亮色的一半左右。
   */
  const raised = light ? mix(bg, 'white', 100) : mix(bg, 'white', 92);
  const sunken = light ? mix(bg, 'black', 96) : mix(bg, 'black', 88);
  const card = light ? mix(bg, 'white', 100) : mix(bg, 'white', 94);
  const popover = card;
  const secondary = light ? mix(bg, 'black', 95) : mix(bg, 'white', 88);
  const muted = light ? mix(bg, 'black', 96) : mix(bg, 'white', 90);

  /*
   * 正文三级。亮色从深到浅，暗色从浅到深，但**都不是纯黑/纯白**：
   * 纯色在彩色背景上会显得生硬。
   */
  const content = fg;
  const contentMuted = blend(fg, bg, 62);
  const contentFaint = blend(fg, bg, 42);

  /*
   * 边框。必须比内容淡得多，否则界面会显得「框框很多」。
   */
  const border = blend(fg, bg, light ? 14 : 18);
  const borderStrong = blend(fg, bg, light ? 24 : 30);
  const borderSubtle = blend(fg, bg, light ? 9 : 12);

  /*
   * 输入类控件的底色必须与背景拉开，否则暗色下开关看不见。
   */
  const input = blend(fg, bg, light ? 14 : 26);

  /*
   * 缩进参考线：画在正文所在行上，必须比边框更淡。
   * 透明度写进色值而不是给元素设 opacity（那会连带淡化文字）。
   */
  const indentGuide = blend(fg, bg, light ? 16 : 26);
  const indentGuideActive = blend(fg, bg, light ? 30 : 42);

  /*
   * 强调色的 10 级色阶。
   *
   * 界面里强调色有多个层次：选中底（100）、悬停（200）、焦点环（500）、
   * 按钮（600）、暗色按钮（400）。原来这 10 级是手写的常量，
   * 每套主题要写 10 个值；现在按固定比例从强调色推导，4 个基准色就够。
   *
   * 亮色的 50/100 是「往白里掺」，暗色相反——暗色下的浅色底必须压暗，
   * 否则会亮得刺眼。
   */
  const brandSteps: Array<[string, string]> = light
    ? [
        ['50', step(accent, 'white', 96)],
        ['100', step(accent, 'white', 90)],
        ['200', step(accent, 'white', 78)],
        ['300', step(accent, 'white', 62)],
        ['400', step(accent, 'white', 45)],
        ['500', accent],
        ['600', step(accent, 'black', 85)],
        ['700', step(accent, 'black', 72)],
        ['800', step(accent, 'black', 58)],
        ['900', step(accent, 'black', 45)],
      ]
    : [
        ['50', step(accent, 'black', 30)],
        ['100', step(accent, 'black', 45)],
        ['200', step(accent, 'black', 62)],
        ['300', step(accent, 'black', 80)],
        ['400', step(accent, 'white', 88)],
        ['500', accent],
        ['600', step(accent, 'white', 92)],
        ['700', step(accent, 'white', 80)],
        ['800', step(accent, 'white', 68)],
        ['900', step(accent, 'white', 55)],
      ];

  return {
    // ---- shadcn 标准令牌 ----
    '--background': bg,
    '--foreground': fg,
    '--card': card,
    '--card-foreground': fg,
    '--popover': popover,
    '--popover-foreground': fg,
    '--secondary': secondary,
    '--secondary-foreground': content,
    '--muted': muted,
    '--muted-foreground': contentMuted,
    '--border': border,
    '--input': input,

    '--primary': accent,
    '--primary-foreground': accentFg,
    '--ring': accent,
    '--accent': light ? mix(accent, 'white', 88) : mix(accent, 'black', 82),
    '--accent-foreground': light ? mix(accent, 'black', 78) : mix(accent, 'white', 88),

    // 危险色（删除类操作）。不随主题变，但要与背景协调。
    '--destructive': light ? '#c0392b' : '#e06c60',
    '--destructive-foreground': light ? '#ffffff' : '#1a1010',

    // ---- 自有语义令牌：界面层级 ----
    '--surface': bg,
    '--surface-raised': raised,
    '--surface-sunken': sunken,
    '--border-subtle': borderSubtle,
    '--border-strong': borderStrong,
    '--indent-guide': indentGuide,
    '--indent-guide-active': indentGuideActive,
    '--content': content,
    '--content-muted': contentMuted,
    '--content-faint': contentFaint,

    /*
     * 匹配括号底纹用的强调色（见 editor/themes.ts）。
     */
    '--match-bracket': accent,

    // ---- 强调色色阶（供 bg-brand-* / text-brand-* 等工具类使用）----
    ...Object.fromEntries(brandSteps.map(([step_, value]) => [`--brand-${step_}`, value])),
  };
}
