/**
 * CodeMirror 内置搜索面板的中文化。
 *
 * 直接用官方 `search()` 扩展而不是自己写面板：
 * 它已经处理了正则、大小写、整词、跨行匹配、替换、高亮等边界情况，
 * 自己重写只会引入一堆难测的缺陷。这里只把文案换成中文。
 *
 * 键名必须与 @codemirror/search 内部调用 `phrase(...)` 时使用的英文字符串完全一致。
 */

import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';

/** 搜索面板与查找命令用到的全部短语。 */
const PHRASES: Record<string, string> = {
  // 面板主体
  Find: '查找',
  Replace: '替换',
  // 按钮
  next: '下一个',
  previous: '上一个',
  all: '全选匹配',
  replace: '替换',
  'replace all': '全部替换',
  close: '关闭',
  go: '跳转',
  // 选项
  'match case': '区分大小写',
  regexp: '正则表达式',
  'by word': '整词匹配',
  // 跳转到行
  'Go to line': '跳转到行',
  // 屏幕阅读器播报
  'current match': '当前匹配',
  'on line': '位于第',
  'replaced match on line $': '已替换第 $ 行的匹配',
  'replaced $ matches': '已替换 $ 处匹配',
};

/** 中文化的搜索面板扩展。 */
export function searchPhrases(): Extension {
  return EditorState.phrases.of(PHRASES);
}
