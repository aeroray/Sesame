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
 * 由主题推导界面令牌。
 *
 * 比例命名规则：`mix(bg, 'white', 96)` 表示「96% 的背景色 + 4% 白」，
 * 即比背景略亮一点点。
 */
export function deriveTokens(theme: ThemeDefinition): ThemeTokens {
  const { bg, fg, accent, accentFg, mode, rainbow } = theme;
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
   * 强调色的 10 级色阶：**50 最浅 → 900 最深，亮暗共用同一套**。
   *
   * ## `weight` 是「强调色占比」，不是「掺入的白/黑占比」
   *
   * 这一点曾经搞反过，值得写下来：
   *
   *     mix(accent, 'white', 96)  →  color-mix(accent 96%, white)
   *     →  96% 是强调色，只掺了 4% 白 → 几乎还是纯色
   *
   * 而「50 级」按 Tailwind / shadcn 的约定应当是**最淡的一级**
   * （浅色主题下几乎与白底同色）。所以要淡就该用**小**的 weight。
   *
   * 实测过：改之前亮色主题的 brand-50 与白底的亮度差是 0.855
   * （几乎就是实心强调色），而本该最浓的 brand-500 是 0.871——
   * 50 和 500 几乎一样浓。设置面板「选中项」用 `bg-brand-50`，
   * 于是呈现为**实心色块**。
   *
   * ## 为什么亮暗共用一套，而不是各写一套反向的
   *
   * 组件里的写法是（从项目初版就有）：
   *
   *     bg-brand-100 text-brand-900  dark:bg-brand-900/40 dark:text-brand-100
   *
   * 亮色 = 浅底深字，暗色 = **深底浅字**。也就是暗色要的 900 是「深」、
   * 100 是「浅」——**与亮色同向**。因此色阶必须单一方向。
   *
   * 我一度给暗色写了反向色阶（50 最深），结果 900 变成浅粉彩色，
   * `dark:bg-brand-900/40` 就不再是深色底，暗色下的选中态会发亮刺眼。
   *
   * 原始手工令牌也是这个结构：色阶定义在 `:root`（单一方向），
   * `.dark` 只做**语义重映射**（`--primary: brand-400` 等），不重定色阶。
   */
  const brandSteps: Array<[string, string]> = [
    ['50', mix(accent, 'white', 8)],
    ['100', mix(accent, 'white', 15)],
    ['200', mix(accent, 'white', 28)],
    ['300', mix(accent, 'white', 44)],
    ['400', mix(accent, 'white', 58)],
    ['500', accent],
    ['600', mix(accent, 'black', 87)],
    ['700', mix(accent, 'black', 73)],
    ['800', mix(accent, 'black', 59)],
    ['900', mix(accent, 'black', 45)],
  ];

  /** 按级取色阶。语义令牌从这里取，避免两处公式各写一遍而漂移。 */
  const brand = (k: string): string => brandSteps.find(([step_]) => step_ === k)?.[1] ?? accent;

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

    /*
     * 强调色的语义映射。
     *
     * ## `--primary` 不用生 accent，而是取色阶的一个点
     *
     * 主题给的 `accent` 是该主题**最具代表性的颜色**，但它不一定适合
     * 当作「填充按钮底 + 白字」。实测 Solarized Light：accent 是
     * `#268bd2`，与白字的对比度只有 **3.41**，低于 WCAG AA 要求的 4.5。
     *
     * 因此按亮暗各取色阶的一个点：
     *
     * - **亮色用 `600`**（比 accent 深一档）→ 白字够清楚。
     *   实测 Solarized Light 从 3.41 提到 **4.73**，达到 AA。
     * - **暗色用 `500`（即 accent 本体）**→ 保留主题辨识度。
     *   暗色下如果用偏白的 `400`，按钮会变成一层灰白，
     *   用户就看不出「这是 Dracula 还是 Monokai」了。
     *   各暗色主题的 accent 与 accentFg 对比度实测均 ≥ 4.75，本就够用。
     *
     * 这与重构前的意图一致（那时亮色 `--primary: var(--brand-600)`），
     * 只是现在由色阶推导，不必逐主题手写。
     *
     * `--ring` 用 500（强调色本体）：焦点环是细线，贴近原色最好看。
     */
    '--primary': light ? brand('600') : brand('500'),
    '--primary-foreground': accentFg,
    '--ring': accent,

    /*
     * `--accent` 是 shadcn 的「悬停/选中底色」语义，必须是**很淡**的一层。
     *
     * 亮色取 50（几乎与白底同色）；暗色取 900 再调低不透明度——
     * 直接取 50 会因为「50 是往白里掺」而在深底上变成一块亮斑。
     * 暗色下要的是「比背景略亮的深色」，所以用 900 配 40% 透明，
     * 这与组件里 `dark:bg-brand-900/40` 的写法一致。
     */
    '--accent': light ? brand('50') : `color-mix(in oklab, ${brand('900')} 40%, transparent)`,
    '--accent-foreground': light ? brand('800') : brand('100'),

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

    /*
     * 括号彩虹三档（见 editor/rainbow-brackets.ts）。
     *
     * 由主题提供而不是在编辑器里写死：换到 Monokai / Dracula 后，
     * 括号颜色必须跟着换，否则又是「界面一个配色、编辑器另一个配色」。
     */
    '--rainbow-0': rainbow[0],
    '--rainbow-1': rainbow[1],
    '--rainbow-2': rainbow[2],

    // ---- 强调色色阶（供 bg-brand-* / text-brand-* 等工具类使用）----
    ...Object.fromEntries(brandSteps.map(([step_, value]) => [`--brand-${step_}`, value])),
  };
}
