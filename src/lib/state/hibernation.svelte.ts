/**
 * 后台休眠巡检。
 *
 * 长时间未使用的标签页释放编辑器实例以回收内存，但**不丢弃内容**：
 * 休眠前先把正文取出存进普通 Map，重新激活时用该内容重建视图。
 * 这样用户看到的行为与「从未休眠」一致，只是内存占用降下来。
 */

import { getView, detachView, setRestoreTarget, setTabContent, tabs } from '$lib/state/tabs.svelte';
import { pruneProgress } from '$lib/editor/large-file.svelte';
import { settings } from '$lib/state/settings.svelte';
import {
  HIBERNATE_DEEP_AFTER,
  HIBERNATE_MIN_SIZE,
  HIBERNATE_SHALLOW_AFTER,
  HIBERNATE_TICK,
} from '$src/constants';
import type { Tab } from '$lib/state/types';

/** 休眠状态。 */
export const hibernation = $state({
  /** 本会话累计休眠次数，仅用于诊断展示。 */
  sleptCount: 0,
});

/** 记录每个标签页最近一次的活动时间，避免频繁读取响应式对象。 */
const lastActive = new Map<string, number>();

/** 文件大小记录（打开时由调用方写入）。 */
const fileSizes = new Map<string, number>();

/** 记录文件大小，用于判断是否值得休眠。 */
export function noteFileSize(tabId: string, size: number): void {
  fileSizes.set(tabId, size);
}

/** 标记某个标签页刚刚活动过。 */
export function touch(tabId: string): void {
  lastActive.set(tabId, Date.now());
}

/**
 * 判断某个标签页现在应该处于哪个休眠档位。
 *
 * 只有「大到值得回收」的文件才参与休眠；
 * 小文件释放掉再重建的成本高于收益。
 */
function targetSleepState(tab: Tab, now: number): Tab['sleep'] {
  // 有未保存改动时绝不休眠，避免任何丢失内容的可能
  if (tab.dirty) return 'none';

  const size = fileSizes.get(tab.id) ?? 0;
  if (size < HIBERNATE_MIN_SIZE) return 'none';

  const since = now - (lastActive.get(tab.id) ?? tab.lastActiveAt);

  if (since >= HIBERNATE_DEEP_AFTER) return 'deep';
  if (since >= HIBERNATE_SHALLOW_AFTER) return 'shallow';
  return 'none';
}

/**
 * 对单个标签页执行休眠。
 *
 * 顺序很关键：`detachView` 会连带清空该标签页的待用正文，
 * 所以必须先销毁视图、再写回正文，否则刚保存的内容会被立刻删掉。
 */
function hibernate(tab: Tab): void {
  const handle = getView(tab.id);

  if (handle) {
    // 1. 先把正文与位置取出来
    const content = handle.getContent();
    const scrollTop = handle.view.scrollDOM.scrollTop;
    tab.scrollTop = scrollTop;

    // 2. 销毁视图（这一步会清掉 pendingContent）
    detachView(tab.id);

    // 3. 再写回正文，供重新激活时重建视图
    setTabContent(tab.id, content);

    // 4. 登记光标与滚动位置，由重建时的 EditorHost 消费。
    //    直接改 tab 字段是无效的——视图创建后不会再读它们。
    setRestoreTarget(tab.id, {
      line: tab.cursorLine,
      column: tab.cursorColumn,
      scrollTop,
    });
  }

  tab.sleep = 'deep';
  hibernation.sleptCount += 1;
}

/**
 * 清理已关闭标签的簿记。
 *
 * 放在巡检里而不是 closeTab 里，是为了避免 tabs ↔ hibernation 循环依赖。
 * 巡检本来就是周期性的，顺手回收即可，代价可以忽略。
 */
function pruneBookkeeping(): void {
  const live = new Set(tabs.items.map((t) => t.id));

  for (const id of lastActive.keys()) {
    if (!live.has(id)) lastActive.delete(id);
  }
  for (const id of fileSizes.keys()) {
    if (!live.has(id)) fileSizes.delete(id);
  }

  // 分块加载进度表同样需要回收，否则反复开关大文件会一直堆积。
  // 注意不能因为上面两个表为空就提前返回——进度表可能仍有残留。
  pruneProgress(live);
}

/**
 * 巡检一次。返回本次休眠的标签页数量。
 *
 * 两个档位的实际含义（不要把它们当成同一种「休眠」）：
 * - `shallow`：**只打标记**，不释放任何资源。作用是让侧栏能提示「这个标签闲置了」，
 *   并且它本身不产生任何风险，因此可以放心地早一点进入。
 * - `deep`：真正销毁编辑器视图以回收内存，正文被保留，重新激活时重建。
 *
 * 正在编辑的标签页（激活项）永不休眠。
 */
export function runSweep(now = Date.now()): number {
  // 先回收已关闭标签的簿记，避免长期运行后 Map 无界增长
  pruneBookkeeping();

  if (!settings.hibernateEnabled) return 0;

  let slept = 0;

  for (const tab of tabs.items) {
    // 当前激活的标签页保持活跃
    if (tab.id === tabs.activeId) {
      touch(tab.id);
      if (tab.sleep !== 'none') tab.sleep = 'none';
      continue;
    }

    const target = targetSleepState(tab, now);

    if (target === 'deep') {
      // 浅休眠的标签直接进入深休眠；已深休眠的不重复处理
      if (tab.sleep !== 'deep') {
        hibernate(tab);
        slept += 1;
      }
    } else if (target === 'shallow' && tab.sleep === 'none') {
      tab.sleep = 'shallow';
    } else if (target === 'none' && tab.sleep !== 'none') {
      tab.sleep = 'none';
    }
  }

  return slept;
}

/**
 * 启动定时巡检。返回停止函数。
 */
export function startHibernationLoop(): () => void {
  // 初始把当前已打开标签记为活跃
  for (const tab of tabs.items) {
    if (!lastActive.has(tab.id)) lastActive.set(tab.id, tab.lastActiveAt);
  }

  const timer = setInterval(() => {
    runSweep();
  }, HIBERNATE_TICK);

  return () => clearInterval(timer);
}
