<script lang="ts">
  /**
   * 标题栏中央的状态提示。
   *
   * 取代了原先的 toast：位置固定、不遮挡内容、几秒后自动消失。
   * 设计取舍见 `state/status.svelte.ts`。
   *
   * ## 为什么这里不再显示文件名
   *
   * 原先这里一直显示当前标签的文件名——但标签栏已经写着同样的名字，
   * 两者相距不到 40px，纯属重复。空间留给真正会变的信息：
   * 「刚才那件事做成了没有」。
   *
   * ## 过渡
   *
   * 用 `{#if}` + CSS 过渡而不是 `transition:` 指令：
   * 提示会**整条替换**（文字和语气同时变），指令式过渡在内容变化时的
   * 行为不好预测，而这里只需要「淡入淡出」一种效果。
   */
  import { CircleCheck, CircleX, Info, TriangleAlert } from '@lucide/svelte';
  import { status, type StatusKind } from '$lib/state/status.svelte';

  /** 语气 → 图标。 */
  const ICONS: Record<StatusKind, typeof CircleCheck> = {
    success: CircleCheck,
    error: CircleX,
    warning: TriangleAlert,
    info: Info,
  };

  /**
   * 语气 → 文字颜色。
   *
   * 只有图标与文字上色，**不加底色**——标题栏是常驻界面元素，
   * 一块彩色背景会显得像系统通知，与「安静」的定位冲突。
   */
  const COLORS: Record<StatusKind, string> = {
    success: 'text-[oklch(0.55_0.13_150)]',
    error: 'text-destructive',
    warning: 'text-[oklch(0.62_0.14_75)]',
    info: 'text-content-muted',
  };

  const current = $derived(status.current);
</script>

<!--
  aria-live="polite"：提示出现时读屏软件会播报，但不打断当前朗读。
  用 polite 而不是 assertive——「已保存」不值得打断用户。
-->
<div class="pointer-events-none flex min-w-0 items-center gap-1.5" aria-live="polite">
  {#if current}
    <!--
      key 用 seq：同一句「已保存」连续出现两次时也能重新挂载，
      从而重新播放一次淡入动画。只用文字做 key 的话第二次不会有任何反应。
    -->
    {#key current.seq}
      {@const Icon = ICONS[current.kind]}
      <span
        class="flex min-w-0 items-center gap-1.5 px-2 text-xs {COLORS[current.kind]}"
        style="animation: status-in 160ms ease-out"
      >
        <Icon class="size-3.5 shrink-0" />
        <span class="truncate">{current.text}</span>
      </span>
    {/key}
  {/if}
</div>

<style>
  /*
   * 淡入 + 轻微上移。
   *
   * 位移只用 2px：标题栏很窄，位移大了会显得晃。
   * 没有对应的淡出动画——提示是被定时器直接清掉的，
   * 加淡出需要额外维护「正在消失」状态，而 160ms 的淡入已经足够柔和。
   */
  @keyframes status-in {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 尊重「减少动态效果」偏好 */
  @media (prefers-reduced-motion: reduce) {
    span {
      animation: none !important;
    }
  }
</style>
