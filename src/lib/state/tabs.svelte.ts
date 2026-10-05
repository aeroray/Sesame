/**
 * 标签页状态。
 *
 * Svelte 5 runes 要求：模块不能直接导出会被重新赋值的 `$state` 绑定，
 * 因此这里把整个状态装在一个对象里，通过改属性触发响应。
 *
 * 关于 EditorView：视图实例是命令式对象，放进 `$state` 会被深层代理，
 * 代理后的 DOM 对象行为异常且拖慢性能，所以句柄表单独放在普通 Map 里，
 * 只把「哪些 id 有视图」这一事实通过 `$state` 暴露给 UI。
 */

import * as ipc from '$lib/ipc/fs';
import type { LanguageId, LineEnding, Tab } from '$lib/state/types';
import type { EditorHandle } from '$lib/editor/create-view';
import { clearPreview } from '$lib/state/layout.svelte';
import { releaseImage } from '$lib/state/images.svelte';
import { rememberClosed } from '$lib/state/closed-tabs.svelte';
import { t } from '$lib/i18n';

/** 视图句柄表。故意不是响应式的。 */
const views = new Map<string, EditorHandle>();

/**
 * 标签页的初始内容。
 *
 * 文档正文可能很大，放进 `$state` 会被深层代理，既浪费内存又拖慢访问，
 * 因此单独用普通 Map 保存，只在创建视图时读取一次。
 */
const pendingContent = new Map<string, string>();

/** 记录标签页的初始内容。 */
export function setTabContent(id: string, content: string): void {
  pendingContent.set(id, content);
}

/**
 * 替换标签页的正文，**同时更新已挂载的编辑器视图**。
 *
 * 与 `setTabContent` 的区别很关键：后者只写「待用正文」这个 Map，
 * 而它只在**创建视图时**被读取一次。若视图已经挂载，只调 `setTabContent`
 * 不会改变屏幕上看到的内容。
 *
 * 「加载磁盘上的最新内容」就是踩了这个坑：正文写进了 Map、脏标记也清了，
 * 但编辑器里仍是旧内容。用户看到没反应，随后一次 Ctrl+S 会把旧内容
 * 重新写回磁盘，**静默覆盖掉刚刚加载的新内容**。
 */
export function replaceTabContent(id: string, content: string): void {
  setTabContent(id, content);

  const handle = views.get(id);
  if (handle) handle.setContent(content);
}

/** 读取初始内容但不删除（视图重建时仍需要）。 */
export function peekTabContent(id: string): string {
  return pendingContent.get(id) ?? '';
}

/**
 * 该标签是否持有正文。
 *
 * 用来区分「正文是空串」与「从未加载过正文」——
 * 后者必须拒绝保存，否则会用一个空串覆盖磁盘上的文件。
 */
export function hasTabContent(id: string): boolean {
  return pendingContent.has(id);
}

/**
 * 待恢复的光标与滚动位置。
 *
 * 视图创建时只读一次 `tab.scrollTop`，而恢复会话/休眠唤醒的赋值
 * 往往发生在视图挂载之后，直接改 tab 字段是无效的（实测光标总是回到第 1 行）。
 * 因此把目标位置放进这里，由 EditorHost 在创建视图时消费。
 */
const restoreTargets = new Map<
  string,
  { line: number; column: number; scrollTop: number }
>();

/** 登记待恢复的位置。 */
export function setRestoreTarget(
  id: string,
  target: { line: number; column: number; scrollTop: number },
): void {
  restoreTargets.set(id, target);
}

/** 取出并清除待恢复的位置。 */
export function takeRestoreTarget(
  id: string,
): { line: number; column: number; scrollTop: number } | undefined {
  const target = restoreTargets.get(id);
  restoreTargets.delete(id);
  return target;
}

/** 生成一个短且唯一的 id。 */
function newId(): string {
  return crypto.randomUUID();
}

/** 标签页集合与激活项。 */
export const tabs = $state<{
  items: Tab[];
  activeId: string | null;
}>({
  items: [],
  activeId: null,
});

/** 当前激活的标签页。 */
export function activeTab(): Tab | null {
  if (!tabs.activeId) return null;
  return tabs.items.find((t) => t.id === tabs.activeId) ?? null;
}

/**
 * 把路径规范化为正斜杠形式。
 *
 * 后端一律返回正斜杠（`D:/a/b.md`），但对话框、拖拽与命令行传来的是原生分隔符
 * （`D:\a\b.md`）。不统一的话 `findByPath` 在 Windows 上永远匹配不上，
 * 同一个文件会被打开成两个标签，先后保存会互相覆盖。
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/** 按路径查找已打开的标签页。 */
export function findByPath(path: string): Tab | null {
  const key = normalizePath(path);
  return tabs.items.find((t) => t.path !== null && normalizePath(t.path) === key) ?? null;
}

/** 注册视图句柄。 */
export function attachView(id: string, handle: EditorHandle): void {
  views.set(id, handle);
}

/** 取得视图句柄。 */
export function getView(id: string): EditorHandle | undefined {
  return views.get(id);
}

/** 移除视图句柄并销毁视图。 */
export function detachView(id: string): void {
  const handle = views.get(id);
  if (handle) {
    handle.destroy();
    views.delete(id);
  }
  pendingContent.delete(id);
}

/** 创建一个空白标签页。 */
export function createBlankTab(): Tab {
  const tab: Tab = {
    id: newId(),
    path: null,
    // 占位名。界面上一律用 `tabDisplayName()` 取展示名，
    // 这样未命名标签能跟随语言切换，而这里存的值只作为文件名兜底。
    name: 'Untitled',
    kind: 'text',
    language: 'plaintext',
    encoding: 'utf-8',
    lineEnding: 'lf',
    hasBom: false,
    dirty: false,
    truncated: false,
    scrollTop: 0,
    cursorLine: 1,
    cursorColumn: 1,
    lastActiveAt: Date.now(),
    sleep: 'none',
  };
  // 新标签插到最前，与主流编辑器一致
  tabs.items.unshift(tab);
  tabs.activeId = tab.id;

  // 空白标签的正文就是空串——必须显式登记，
  // 否则「从未加载正文」与「正文为空」无法区分，保存会被误拒。
  setTabContent(tab.id, '');

  return tab;
}

/** 由已打开的文件创建标签页。 */
export function createTabFromPayload(payload: {
  meta: { path: string; name: string };
  content: string;
  language: string;
  encoding: string;
  lineEnding: string;
  hasBom: boolean;
  truncated: boolean;
}): Tab {
  const tab: Tab = {
    id: newId(),
    path: payload.meta.path,
    name: payload.meta.name,
    kind: 'text',
    language: payload.language as LanguageId,
    encoding: payload.encoding,
    lineEnding: payload.lineEnding as LineEnding,
    hasBom: payload.hasBom,
    dirty: false,
    truncated: payload.truncated,
    scrollTop: 0,
    cursorLine: 1,
    cursorColumn: 1,
    lastActiveAt: Date.now(),
    sleep: 'none',
  };
  setTabContent(tab.id, payload.content);
  tabs.items.unshift(tab);
  tabs.activeId = tab.id;
  return tab;
}

/**
 * 由草稿备份还原标签页。
 *
 * 与 `createBlankTab` 的区别：带上草稿里的正文、语言与编码，
 * 并标记为脏——它确实还没保存到任何文件。
 */
export function createTabFromDraft(draft: {
  id: string;
  path: string | null;
  name: string;
  content: string;
  language: string;
  encoding: string;
  lineEnding: string;
  hasBom: boolean;
}): Tab {
  const tab: Tab = {
    id: draft.id,
    path: draft.path,
    name: draft.name,
    kind: 'text',
    language: draft.language as LanguageId,
    encoding: draft.encoding,
    lineEnding: draft.lineEnding as LineEnding,
    hasBom: draft.hasBom,
    // 草稿意味着「有内容尚未落盘」，因此是脏的
    dirty: true,
    truncated: false,
    scrollTop: 0,
    cursorLine: 1,
    cursorColumn: 1,
    lastActiveAt: Date.now(),
    sleep: 'none',
  };
  setTabContent(tab.id, draft.content);
  tabs.items.push(tab);
  return tab;
}

/** 由图片创建标签页。 */
export function createImageTab(payload: {
  path: string;
  name: string;
  size: number;
}): Tab {
  const tab: Tab = {
    id: newId(),
    path: payload.path,
    name: payload.name,
    kind: 'image',
    language: 'plaintext',
    encoding: 'binary',
    lineEnding: 'lf',
    hasBom: false,
    dirty: false,
    truncated: false,
    scrollTop: 0,
    cursorLine: 1,
    cursorColumn: 1,
    lastActiveAt: Date.now(),
    sleep: 'none',
  };
  tabs.items.unshift(tab);
  tabs.activeId = tab.id;
  return tab;
}

/** 激活标签页。 */
export function activateTab(id: string): void {
  const tab = tabs.items.find((t) => t.id === id);
  if (!tab) return;
  tabs.activeId = id;
  tab.lastActiveAt = Date.now();
  // 重新激活即唤醒：EditorHost 的 effect 依赖 sleep，
  // 置回 none 会触发它用保留的正文重建视图。
  tab.sleep = 'none';
}

/** 标记为已修改。 */
export function markDirty(id: string, dirty = true): void {
  const tab = tabs.items.find((t) => t.id === id);
  if (tab) tab.dirty = dirty;
  if (dirty) bumpEditVersion(id);
}

/**
 * 每个标签页的编辑版本号。
 *
 * 用于避免「保存期间又改了内容，保存完成后却把脏标记清掉」——
 * 那会让标签显示为已保存，随后关闭时不再提示，改动直接丢失。
 * 保存前记下版本号，写完比对，只有期间没有新编辑才清除脏标记。
 */
const editVersions = new Map<string, number>();

/** 递增编辑版本号。 */
function bumpEditVersion(id: string): void {
  editVersions.set(id, (editVersions.get(id) ?? 0) + 1);
}

/** 读取当前编辑版本号。 */
export function editVersion(id: string): number {
  return editVersions.get(id) ?? 0;
}

/** 更新光标位置。 */
export function updateCursor(id: string, line: number, column: number): void {
  const tab = tabs.items.find((t) => t.id === id);
  if (!tab) return;
  tab.cursorLine = line;
  tab.cursorColumn = column;
  tab.lastActiveAt = Date.now();
}

/** 更新滚动位置。 */
export function updateScroll(id: string, scrollTop: number): void {
  const tab = tabs.items.find((t) => t.id === id);
  if (tab) tab.scrollTop = scrollTop;
}

/**
 * 把标签从一处移动到另一处。
 *
 * 用于拖拽排序。索引越界时不做任何事，避免拖拽边界情况把数组弄乱。
 */
export function moveTab(fromIndex: number, toIndex: number): void {
  const len = tabs.items.length;
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= len) return;
  if (toIndex < 0 || toIndex >= len) return;

  const [moved] = tabs.items.splice(fromIndex, 1);
  if (!moved) return;
  tabs.items.splice(toIndex, 0, moved);
}

/** 重命名标签（另存为后更新）。 */
export function renameTab(id: string, path: string, name: string): void {
  const tab = tabs.items.find((t) => t.id === id);
  if (!tab) return;
  tab.path = path;
  tab.name = name;
}

/**
 * 标签页的**展示名**。
 *
 * 未命名标签（没有路径）显示本地化的「未命名」而不是 `tab.name`——
 * 后者是创建时写入的固定字符串，切语言不会变。
 *
 * 之所以不在创建时就把翻译写进 `tab.name`：那个字段同时被用作
 * 「另存为」对话框的默认文件名（`defaultPath: tab.path ?? tab.name`）。
 * 若里面存的是中文「未命名」，英文用户另存新文件时文件名会是中文。
 * 因此字段保持语言中立的占位值，展示时再翻译。
 *
 * 这个函数读 `locale.current`（经由 `t()`），因此在模板里调用它
 * 会自动跟随语言切换。
 */
export function tabDisplayName(tab: Tab): string {
  return tab.path === null ? t('tab.untitled') : tab.name;
}

/**
 * 设置「是否处于大文件模式」。
 *
 * 另存为之后需要置回 `false`：新文件里就是编辑器持有的全部内容，
 * 不再是「只加载了一部分」的状态。若留着 `true`，状态栏会一直挂着
 * 「大文件模式」徽标，与磁盘上的实际情况不符。
 */
export function setTruncated(id: string, truncated: boolean): void {
  const tab = tabs.items.find((t) => t.id === id);
  if (tab) tab.truncated = truncated;
}

/**
 * 单个标签页的完整清理。
 *
 * 抽成一处供 closeTab / closeOtherTabs / closeAllTabs 共用——
 * 早先后两者漏掉了 `closeFile`，导致 Rust 侧的文件状态记录随标签开关无界增长。
 *
 * 注意这里**不**清理分块加载进度：那需要 import `large-file.svelte.ts`，
 * 而后者已经 import 本模块的 `getView`，会形成循环依赖。
 * 进度改由休眠巡检周期回收（见 `hibernation.svelte.ts` 的 `pruneProgress`）——
 * 标签 id 是 UUID 不会复用，因此延迟回收是安全的。
 */
function teardown(id: string, path: string | null): void {
  detachView(id);
  clearPreview(id);
  releaseImage(id);

  // 清理后端的状态记录
  if (path) {
    ipc.closeFile(path).catch((err) => {
      console.error('清理文件状态失败', err);
    });
  }
}

/**
 * 关闭标签页。
 *
 * 返回关闭后应当激活的标签 id（若还有标签）。
 */
export function closeTab(id: string): void {
  const index = tabs.items.findIndex((t) => t.id === id);
  if (index === -1) return;

  const [removed] = tabs.items.splice(index, 1);
  if (removed) rememberClosed(removed);
  teardown(id, removed?.path ?? null);

  if (tabs.activeId === id) {
    // 优先激活右侧邻居，没有则取左侧
    const next = tabs.items[index] ?? tabs.items[index - 1] ?? null;
    tabs.activeId = next?.id ?? null;
  }
}

/** 关闭其它标签页。 */
export function closeOtherTabs(id: string): void {
  const keep = tabs.items.find((t) => t.id === id);
  if (!keep) return;

  for (const tab of tabs.items) {
    if (tab.id !== id) {
      rememberClosed(tab);
      teardown(tab.id, tab.path);
    }
  }
  tabs.items = [keep];
  tabs.activeId = id;
}

/**
 * 关闭全部标签页。
 *
 * 会记入历史栈，因此「关闭全部」之后仍可用 Ctrl+Shift+T 逐个恢复——
 * 这是用户最容易误触的操作，必须可撤销。
 */
export function closeAllTabs(): void {
  for (const tab of tabs.items) {
    rememberClosed(tab);
    teardown(tab.id, tab.path);
  }
  tabs.items = [];
  tabs.activeId = null;
}
