/**
 * 全局常量。魔法数字集中在此，便于统一调整。
 */

import { t } from '$lib/i18n';

/** 分块读取的块大小。 */
export const CHUNK_SIZE = 1024 * 1024;

/**
 * 「全部加载」允许读入的最大字节数。
 *
 * 超过此值只继续按块加载，不一次性铺满内存——
 * WebView 里塞进几百兆文本会让整个应用卡死。
 */
export const MAX_LOAD_ALL_BYTES = 32 * 1024 * 1024;

/** 单个 Tab 进入浅休眠的闲置时长（毫秒）。 */
export const HIBERNATE_SHALLOW_AFTER = 30 * 60 * 1000;

/** 单个 Tab 进入深休眠的闲置时长（毫秒）。 */
export const HIBERNATE_DEEP_AFTER = 2 * 60 * 60 * 1000;

/** 只有大于此体积的文件才参与休眠。 */
export const HIBERNATE_MIN_SIZE = 2 * 1024 * 1024;

/** 休眠巡检间隔（毫秒）。 */
export const HIBERNATE_TICK = 60 * 1000;

/** 最近文件在欢迎页展示的最大条数。 */
export const RECENT_DISPLAY_LIMIT = 8;

/** 设置持久化的文件名。 */
export const SETTINGS_STORE_FILE = 'settings.json';

/** 设置存储中的键名。 */
export const SETTINGS_KEY = 'settings';

/** 编辑器字号可选范围。 */
export const FONT_SIZE_MIN = 11;
export const FONT_SIZE_MAX = 24;

/** 自动保存的防抖时长（毫秒）。 */
export const AUTOSAVE_DEBOUNCE = 1200;

/** 可预览的图片扩展名。与 Rust 端 `lang_map::image_mime` 保持一致。 */
export const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'avif',
] as const;

/**
 * 支持打开的文件类型过滤（用于原生对话框）。
 *
 * 做成**函数**而不是常量数组：过滤名要跟随界面语言，
 * 而常量在模块加载时求值一次就固定了，之后切换语言不会更新。
 * 每次打开对话框时调用一次，取到的就是当前语言的名称。
 */
export function fileFilters(): { name: string; extensions: string[] }[] {
  return [
    {
      name: t('fileFilter.textAndCode'),
      extensions: [
        'txt',
        'log',
        'md',
        'markdown',
        'json',
        'jsonc',
        'yaml',
        'yml',
        'toml',
        'ini',
        'cfg',
        'conf',
        'html',
        'htm',
        'css',
        'scss',
        'less',
        'js',
        'mjs',
        'cjs',
        'jsx',
        'ts',
        'tsx',
        'svelte',
        'vue',
        'rs',
        'go',
        'py',
        'java',
        'c',
        'h',
        'cpp',
        'hpp',
        'sql',
        'xml',
        'svg',
        'sh',
        'bash',
        'ps1',
        'bat',
        'cmd',
        'csv',
        'tsv',
      ],
    },
    {
      name: t('fileFilter.images'),
      extensions: [...IMAGE_EXTENSIONS],
    },
    { name: t('fileFilter.allFiles'), extensions: ['*'] },
  ];
}
