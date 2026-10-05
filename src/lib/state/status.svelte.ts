/**
 * 顶部状态提示。
 *
 * ## 为什么不用 toast
 *
 * 「已保存」这类反馈是**操作确认**，不是需要用户处理的通知。用浮动 toast 表达它
 * 有两个问题：一是它盖在内容上、还会自己动，抢注意力；二是它出现的位置
 * （右下角或顶部居中）与「刚刚发生了什么」没有空间上的关联。
 *
 * 改为在标题栏中央显示一行简短文字、几秒后自动消失：
 * 位置固定、不遮挡内容、不需要用户做任何事。信息量完全一样，打扰程度低得多。
 *
 * ## 为什么不用浏览器的 alert / 自定义模态框
 *
 * 那些需要用户点击才能继续，代价更大。这里只做「告知」，不阻断操作。
 *
 * ## 分工
 *
 * - **状态提示**（本模块）：操作成功、轻量告知——几秒后自动消失。
 * - **原生对话框**（`save-file.ts` / `close-tab.ts` 里的 `message()`）：
 *   需要用户**做决定**的事——覆盖还是重新加载、保存还是不保存。
 *   这些绝不能只显示一行字，因为用户必须给出选择。
 */

/** 提示的语气，决定图标与颜色。 */
export type StatusKind = 'success' | 'error' | 'warning' | 'info';

/** 当前要显示的一条提示。 */
interface StatusMessage {
  /** 纯文字，力求简短（「已保存」而不是「文件保存成功」）。 */
  text: string;
  kind: StatusKind;
  /**
   * 递增序号。
   *
   * 用于「同一条文字连续出现两次」时也能重新触发动画——
   * 若只比较文本，第二次不会被认为是新消息，提示看起来没反应。
   */
  seq: number;
}

/** 响应式状态。`null` 表示当前没有提示。 */
export const status = $state<{ current: StatusMessage | null }>({ current: null });

/**
 * 各类提示的停留时长（毫秒）。
 *
 * 成功提示一闪而过即可；错误要留久一点，因为用户可能需要看清原因。
 */
const DURATION: Record<StatusKind, number> = {
  success: 2200,
  info: 2600,
  warning: 4000,
  // 错误给足阅读时间，但仍然会自动消失——真正需要决策的错误走原生对话框
  error: 6000,
};

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/** 清除待触发的定时器。 */
function clearTimer(): void {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
}

/**
 * 显示一条提示。
 *
 * 连续调用会替换上一条并重新计时——不排队。
 * 排队会让提示严重滞后于操作（用户已经做完三件事，屏幕还在报第一件）。
 */
export function showStatus(text: string, kind: StatusKind = 'info'): void {
  clearTimer();
  status.current = { text, kind, seq: ++seq };

  timer = setTimeout(() => {
    timer = undefined;
    status.current = null;
  }, DURATION[kind]);
}

/** 立即清除提示。 */
export function clearStatus(): void {
  clearTimer();
  status.current = null;
}

/**
 * 只清除「成功」类提示。
 *
 * 用于「用户又改了内容」这类场景：上一次的「已保存」已经不再成立，
 * 留着会从操作确认变成误导。但错误与警告往往还没到阅读时间，
 * 不该被一次按键打断。
 */
export function clearSuccess(): void {
  if (status.current?.kind === 'success') clearStatus();
}

/**
 * 四个语气对应的快捷方法。
 *
 * 保留这层包装而不是让调用方直接写 `showStatus(text, 'success')`：
 * 调用点大多是「报告一次成功/失败」，写成 `notify.success('已保存')`
 * 更短、也更难把语气写错。
 */
export const notify = {
  success: (text: string) => showStatus(text, 'success'),
  error: (text: string) => showStatus(text, 'error'),
  info: (text: string) => showStatus(text, 'info'),
  warning: (text: string) => showStatus(text, 'warning'),
};
