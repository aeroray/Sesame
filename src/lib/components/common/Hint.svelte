<script lang="ts">
  /**
   * 带提示气泡的图标按钮。
   *
   * 界面里所有图标按钮都需要提示，把「按钮 + 四层 Tooltip 结构」封装一次，
   * 调用方只关心图标、提示文字与点击行为。
   */
  import {
    Provider as TooltipProvider,
    Root as TooltipRoot,
    Trigger as TooltipTrigger,
    Content as TooltipContent,
  } from '$lib/components/ui/tooltip';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils/cn';
  import type { Snippet } from 'svelte';

  interface Props {
    /** 提示文字，同时作为无障碍标签。 */
    label: string;
    /** 气泡方向。 */
    side?: 'top' | 'right' | 'bottom' | 'left';
    /** 按钮尺寸类，默认 `size-7`。 */
    class?: string;
    /** 是否处于激活态（用于开关型按钮）。 */
    active?: boolean;
    /**
     * 这个按钮是否是「开关」。
     *
     * 只有开关才该带 `aria-pressed`。Hint 也用于一次性动作
     * （最小化、放大、用默认程序打开、新建标签页……），
     * 无条件输出 `aria-pressed="false"` 会让读屏软件把每一个动作按钮
     * 都播报成「处于关闭状态的切换按钮」——语义是错的。
     */
    toggle?: boolean;
    /** 是否为危险操作：悬停时变红，提示这是破坏性动作。 */
    danger?: boolean;
    onclick?: (event: MouseEvent) => void;
    /** 图标内容。 */
    children: Snippet;
  }

  let {
    label,
    side = 'bottom',
    class: className = 'size-7',
    active = false,
    toggle = false,
    danger = false,
    onclick,
    children,
  }: Props = $props();

  /**
   * 类名合并顺序很关键。
   *
   * 1. `cn` 内部是 tailwind-merge，同族工具类后写者胜出，
   *    因此调用方的 `className` 之后才追加状态类。
   * 2. danger 必须**同时**给出 `hover:` 与 `dark:hover:`。
   *    Button 的 ghost 变体带有 `dark:hover:bg-muted/50`，它在暗色下的
   *    选择器优先级高于单独的 `hover:bg-destructive`，只写后者会被盖掉，
   *    关闭按钮在暗色下就不会变红（实测如此）。
   * 3. **激活态只用文字颜色区分，不加底色**。
   *    早先试过品牌色底，视觉上过重、与状态栏整体不协调。
   *    现在：激活 = 亮色（跟随当前主题的前景色），未激活 = 灰色。
   *    这是最克制的做法，也符合「开关只该是一个信号」的定位。
   */
  const classes = $derived(
    cn(
      className,
      active && !danger
        ? 'text-content hover:text-content'
        : 'text-content-faint',
      danger
        ? 'hover:bg-destructive hover:text-white dark:hover:bg-destructive dark:hover:text-white'
        : active
          ? ''
          : 'hover:text-content',
    ),
  );
</script>

<TooltipProvider delayDuration={400}>
  <TooltipRoot>
    <TooltipTrigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="ghost"
          size="icon"
          class={classes}
          aria-label={label}
          aria-pressed={toggle ? active : undefined}
          {onclick}
        >
          {@render children()}
        </Button>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent {side}>{label}</TooltipContent>
  </TooltipRoot>
</TooltipProvider>
