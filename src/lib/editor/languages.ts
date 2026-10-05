/**
 * 语言类型 → CodeMirror 语言扩展的懒加载映射。
 *
 * 语言包体积不小，全部静态引入会撑爆首屏预算，
 * 因此这里只保存动态 import 函数，用到才加载。
 *
 * 注意：`@codemirror/lang-shell` 并不存在，shell / toml 等
 * 只能通过 `@codemirror/legacy-modes` + StreamLanguage 接入。
 */

import type { Extension } from '@codemirror/state';
import { t } from '$lib/i18n';
import type { LanguageId } from '$lib/state/types';

type Loader = () => Promise<Extension>;

/** 已加载的语言扩展缓存，避免重复 import。 */
const cache = new Map<LanguageId, Extension>();

/** 静态映射：每个语言标识对应一个懒加载函数。 */
const loaders: Record<LanguageId, Loader> = {
  markdown: async () => {
    const { markdown } = await import('@codemirror/lang-markdown');
    return markdown();
  },
  json: async () => {
    const { json } = await import('@codemirror/lang-json');
    return json();
  },
  yaml: async () => {
    const { yaml } = await import('@codemirror/lang-yaml');
    return yaml();
  },
  toml: async () => legacyMode('toml'),
  ini: async () => legacyMode('properties'),
  html: async () => {
    const { html } = await import('@codemirror/lang-html');
    return html();
  },
  css: async () => {
    const { css } = await import('@codemirror/lang-css');
    return css();
  },
  javascript: async () => {
    const { javascript } = await import('@codemirror/lang-javascript');
    return javascript();
  },
  typescript: async () => {
    const { javascript } = await import('@codemirror/lang-javascript');
    return javascript({ typescript: true });
  },
  rust: async () => {
    const { rust } = await import('@codemirror/lang-rust');
    return rust();
  },
  go: async () => {
    const { go } = await import('@codemirror/lang-go');
    return go();
  },
  python: async () => {
    const { python } = await import('@codemirror/lang-python');
    return python();
  },
  java: async () => {
    const { java } = await import('@codemirror/lang-java');
    return java();
  },
  c: async () => {
    const { cpp } = await import('@codemirror/lang-cpp');
    return cpp();
  },
  cpp: async () => {
    const { cpp } = await import('@codemirror/lang-cpp');
    return cpp();
  },
  sql: async () => {
    const { sql } = await import('@codemirror/lang-sql');
    return sql();
  },
  xml: async () => {
    const { xml } = await import('@codemirror/lang-xml');
    return xml();
  },
  shell: async () => legacyMode('shell'),
  // 纯文本不需要语法扩展，返回空数组
  plaintext: async () => [],
};

/**
 * 通过 legacy-modes 接入 CM5 时代的语言模式。
 *
 * 这些语言在 CodeMirror 6 没有独立语言包，
 * 官方推荐的做法就是 StreamLanguage + legacy-modes。
 */
async function legacyMode(mode: 'shell' | 'toml' | 'properties'): Promise<Extension> {
  const { StreamLanguage } = await import('@codemirror/language');

  switch (mode) {
    case 'shell': {
      const { shell } = await import('@codemirror/legacy-modes/mode/shell');
      return StreamLanguage.define(shell);
    }
    case 'toml': {
      const { toml } = await import('@codemirror/legacy-modes/mode/toml');
      return StreamLanguage.define(toml);
    }
    case 'properties': {
      const { properties } = await import('@codemirror/legacy-modes/mode/properties');
      return StreamLanguage.define(properties);
    }
  }
}

/**
 * 取得语言扩展。同一语言只加载一次。
 *
 * 加载失败时回退到纯文本，不让语法包的问题阻塞编辑器。
 */
export async function getLanguageExtension(language: LanguageId): Promise<Extension> {
  const cached = cache.get(language);
  if (cached) return cached;

  const loader = loaders[language] ?? loaders.plaintext;
  let extension: Extension;
  try {
    extension = await loader();
  } catch (err) {
    console.error(`加载语言包失败：${language}`, err);
    extension = [];
  }

  cache.set(language, extension);
  return extension;
}

/**
 * 语言标识 → 状态栏显示名。
 *
 * 除「纯文本」外，其余都是语言自身的名字（Markdown、JSON、Rust……），
 * 任何界面语言下写法都相同，因此直接写字面量、不进字典。
 *
 * 「纯文本」用 **getter** 而不是普通属性：普通属性在模块加载时求值一次
 * 就固定了，之后切换语言不会更新；getter 在每次读取时（即渲染时）
 * 才调 `t()`，读到的就是当前语言。这样调用方仍然写
 * `LANGUAGE_LABELS[tab.language]`，不需要为响应式改动任何一处。
 */
export const LANGUAGE_LABELS: Record<LanguageId, string> = {
  markdown: 'Markdown',
  json: 'JSON',
  yaml: 'YAML',
  toml: 'TOML',
  ini: 'INI',
  html: 'HTML',
  css: 'CSS',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  rust: 'Rust',
  go: 'Go',
  python: 'Python',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  sql: 'SQL',
  xml: 'XML',
  shell: 'Shell',
  get plaintext() {
    return t('language.plaintext');
  },
};
