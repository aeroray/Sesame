/**
 * CodeMirror 内置搜索面板的本地化。
 *
 * 直接用官方 `search()` 扩展而不是自己写面板：
 * 它已经处理了正则、大小写、整词、跨行匹配、替换、高亮等边界情况，
 * 自己重写只会引入一堆难测的缺陷。这里只把文案换成字典里的那份。
 *
 * 键名必须与 @codemirror/search 内部调用 `phrase(...)` 时使用的英文字符串完全一致。
 * 因此下面的键是**英文字面量**，只有取值来自 `t()`——把键也翻译掉，
 * 面板就会因为查不到短语而回退成英文。
 *
 * 值里的 `$` 是 CodeMirror 自己的插值占位符（`phrase()` 会替换它），
 * 与 `t()` 的 `{name}` 是两套互不干涉的机制，不要改写成 `{...}`。
 */

import type { Extension } from '@codemirror/state';
import { EditorState } from '@codemirror/state';
import { t } from '$lib/i18n';

/**
 * 构建搜索面板与查找命令用到的全部短语。
 *
 * 做成函数而不是模块级常量：常量在模块加载时求值一次就固定了，
 * 之后切换界面语言不会更新；每次调用才能取到当前语言。
 */
function buildPhrases(): Record<string, string> {
  return {
    // 面板主体
    Find: t('search.find'),
    Replace: t('search.replace'),
    // 按钮
    next: t('search.next'),
    previous: t('search.previous'),
    all: t('search.selectAllMatches'),
    replace: t('search.replaceOne'),
    'replace all': t('search.replaceAll'),
    close: t('search.close'),
    go: t('search.go'),
    // 选项
    'match case': t('search.matchCase'),
    regexp: t('search.regexp'),
    'by word': t('search.byWord'),
    // 跳转到行
    'Go to line': t('search.goToLine'),
    // 屏幕阅读器播报
    'current match': t('search.currentMatch'),
    'on line': t('search.onLine'),
    'replaced match on line $': t('search.replacedOnLine'),
    'replaced $ matches': t('search.replacedCount'),
  };
}

/** 本地化的搜索面板扩展。 */
export function searchPhrases(): Extension {
  return EditorState.phrases.of(buildPhrases());
}
