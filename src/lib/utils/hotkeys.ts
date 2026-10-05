/**
 * 应用级快捷键。
 *
 * 编辑器内部的快捷键由 CodeMirror 的 keymap 处理（见 extensions.ts），
 * 这里只处理编辑器之外、作用于整个应用的快捷键。
 *
 * 标点键（逗号、斜杠等）不能只比对 `event.key`：
 * 中文输入法激活时这些键可能被 IME 拦截或改写，
 * 因此同时比对不受布局与 IME 影响的 `event.code`。
 */

import type { MessageKey } from '$lib/i18n';

export interface HotkeyBinding {
  /** 组合键描述，例如 `Ctrl+N`。 */
  keys: string;
  /** 说明文案，用于快捷键面板。 */
  label: string;
  /** 分组，用于快捷键面板归类。 */
  group: string;
  handler: () => void;
}

/**
 * 编辑器内建的快捷键，仅用于「快捷键」面板展示。
 *
 * 这些由 CodeMirror 的 keymap 处理（见 `editor/extensions.ts`），
 * 不经过本模块的注册流程，因此没有 handler。
 *
 * **只列已经核对过的绑定。** 早先这里手写了一份，写进了两个并不存在的组合键
 * （`Ctrl+H` 替换、`Ctrl+Shift+Z` 重做）——CodeMirror 的 `searchKeymap`
 * 根本没有 `Mod-h`，而重做在 Windows 上是 `Ctrl+Y`（`Mod-y`），
 * `Ctrl+Shift+Z` 只在 macOS 与 Linux 上成立。面板承诺了做不到的事，比不写更糟。
 *
 * 依据（逐条核对过源码）：
 * - `@codemirror/commands` 的 `historyKeymap`：Mod-z 撤销、Mod-y 重做、
 *   Mod-[ 减少缩进、Mod-] 增加缩进、Mod-/ 切换注释
 * - 同包的 `defaultKeymap`：Alt-ArrowUp/Down 移动行、
 *   Shift-Alt-ArrowUp/Down 复制行
 * - `@codemirror/search` 的 `searchKeymap`：Mod-f 查找、Mod-g 下一个匹配、
 *   Mod-Shift-l 选中全部匹配、Mod-Alt-g 跳转到行
 * - `@codemirror/autocomplete` 的 `completionKeymap`：Ctrl-Space 手动触发补全
 *
 * `label` 存的是**文案 key**（见 `i18n/messages` 的 `command.*`），
 * 由快捷键面板在渲染时用 `t()` 解析——在这里求值会固定在模块加载时的语言。
 */
export const EDITOR_HOTKEYS: { keys: string; label: MessageKey }[] = [
  { keys: 'Ctrl+F', label: 'command.find' },
  { keys: 'Ctrl+G', label: 'command.findNext' },
  { keys: 'Ctrl+Shift+L', label: 'command.selectAllMatches' },
  { keys: 'Ctrl+Alt+G', label: 'command.gotoLine' },
  { keys: 'Ctrl+Space', label: 'command.triggerCompletion' },
  { keys: 'Ctrl+Z', label: 'command.undo' },
  // Windows 与 Linux 用 Ctrl+Y；macOS 的 Mod 即 Cmd，对应 Cmd+Shift+Z
  { keys: 'Ctrl+Y', label: 'command.redo' },
  { keys: 'Ctrl+/', label: 'command.toggleComment' },
  { keys: 'Ctrl+[', label: 'command.indentLess' },
  { keys: 'Ctrl+]', label: 'command.indentMore' },
  { keys: 'Alt+↑ / Alt+↓', label: 'command.moveLine' },
  { keys: 'Shift+Alt+↑ / ↓', label: 'command.copyLine' },
  { keys: 'Ctrl+A', label: 'command.selectAll' },
];

/**
 * 标点键的 `event.code` 映射。
 *
 * 这些键在不同键盘布局与输入法状态下 `event.key` 不可靠，
 * 但 `event.code` 始终是物理键位。
 */
const PUNCTUATION_CODES: Record<string, string> = {
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  ';': 'Semicolon',
  "'": 'Quote',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  '-': 'Minus',
  '=': 'Equal',
  '`': 'Backquote',
};

/** 特殊键的 `event.key` 值。 */
const NAMED_KEYS = new Set(['enter', 'escape', 'tab', 'space', 'backspace', 'delete']);

const IS_MAC =
  typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

/** 判断事件是否匹配组合键描述。 */
function matches(event: KeyboardEvent, keys: string): boolean {
  const parts = keys
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const key = parts[parts.length - 1] ?? '';

  const wantsCtrl = parts.includes('ctrl') || parts.includes('cmd');
  const wantsShift = parts.includes('shift');
  const wantsAlt = parts.includes('alt');

  // macOS 用 Cmd，其他平台用 Ctrl；描述里统一写 Ctrl
  const ctrlPressed = IS_MAC ? event.metaKey : event.ctrlKey;

  if (wantsCtrl !== ctrlPressed) return false;
  if (wantsShift !== event.shiftKey) return false;
  if (wantsAlt !== event.altKey) return false;

  // 标点键：优先用物理键位比对，绕开输入法对 event.key 的改写
  const expectedCode = PUNCTUATION_CODES[key];
  if (expectedCode) {
    return event.code === expectedCode;
  }

  const eventKey = event.key.toLowerCase();

  if (NAMED_KEYS.has(key)) {
    // 空格键的 event.key 是一个空格字符
    return key === 'space' ? eventKey === ' ' : eventKey === key;
  }

  return eventKey === key;
}

/**
 * 注册全局快捷键。
 *
 * 返回注销函数，供组件在销毁时调用。
 */
export function registerHotkeys(bindings: HotkeyBinding[]): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    // 编辑器已经处理过的按键不再重复触发应用快捷键。
    // 否则 Ctrl+/ 会既切换注释又打开快捷键面板——CodeMirror 绑定了 Mod-/，
    // 且它不调用 stopPropagation，事件仍会冒泡到这里。
    if (event.defaultPrevented) return;

    for (const binding of bindings) {
      if (!matches(event, binding.keys)) continue;
      event.preventDefault();
      event.stopPropagation();
      binding.handler();
      return;
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}

/** 把组合键描述格式化为展示文本（macOS 用符号）。 */
export function formatKeys(keys: string): string {
  if (!IS_MAC) return keys;

  return keys
    .replace(/Ctrl/gi, '⌘')
    .replace(/Shift/gi, '⇧')
    .replace(/Alt/gi, '⌥')
    .replace(/\+/g, '');
}
