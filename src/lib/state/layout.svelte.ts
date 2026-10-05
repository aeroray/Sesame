/**
 * 界面布局状态（与内容无关的纯 UI 状态）。
 */

/** 侧边栏是否展开。默认折叠，符合「编辑区优先」的定位。 */
export const layout = $state({
  sidebarOpen: false,
});

/** 切换侧边栏。 */
export function toggleSidebar(): void {
  layout.sidebarOpen = !layout.sidebarOpen;
}

/**
 * 处于 Markdown 预览模式的标签页集合。
 *
 * 用普通对象记录而不是给 Tab 加字段：预览是纯粹的视图开关，
 * 不属于文档本身的状态，放进 Tab 会让会话恢复等逻辑误以为它需要持久化。
 */
export const preview = $state<{ tabs: Record<string, boolean> }>({ tabs: {} });

/**
 * 预览用的正文快照。
 *
 * 必须单独保存，不能在渲染时现读：打开预览会立刻卸载编辑器视图，
 * 若等到渲染时再取内容，拿到的已经是卸载后清空的旧值，预览会显示上一版内容。
 *
 * 用 `$state.raw` 而非 `$state`：正文整体替换、从不逐字段修改，
 * 深层代理大文本既浪费内存又拖慢渲染。
 */
let previewTexts = $state.raw<Record<string, string>>({});

/** 读取某个标签页的预览正文。 */
export function getPreviewText(tabId: string): string {
  return previewTexts[tabId] ?? '';
}

/** 某个标签页是否处于预览模式。 */
export function isPreviewing(tabId: string): boolean {
  return preview.tabs[tabId] === true;
}

/**
 * 切换预览模式。
 *
 * `content` 由调用方在卸载编辑器**之前**取好并传入——
 * 这里刻意不去读视图，避免与 tabs 模块形成循环依赖。
 */
export function togglePreview(tabId: string, content: string): void {
  const turningOn = !preview.tabs[tabId];

  if (turningOn) {
    previewTexts = { ...previewTexts, [tabId]: content };
  } else if (previewTexts[tabId] !== undefined) {
    // 关闭预览时释放快照：Markdown 原文可能很大，留着没有意义
    const { [tabId]: _text, ...rest } = previewTexts;
    previewTexts = rest;
  }

  preview.tabs = { ...preview.tabs, [tabId]: turningOn };
}

/** 关闭标签页时清理预览状态与快照。 */
export function clearPreview(tabId: string): void {
  if (preview.tabs[tabId]) {
    const { [tabId]: _flag, ...restFlags } = preview.tabs;
    preview.tabs = restFlags;
  }

  if (previewTexts[tabId] !== undefined) {
    const { [tabId]: _text, ...restTexts } = previewTexts;
    previewTexts = restTexts;
  }
}
