/**
 * 文件图标：按「类别 + 语言」选一个图标。
 *
 * ## 为什么需要它
 *
 * 最近文件列表（首屏与侧栏）原先**写死** `FileText`，
 * 于是图片、Markdown、HTML 全都长一个样，只有标签页上的图标是对的
 * （那里按 `tab.kind` 分支）。同一份文件在两个地方显示不同图标，
 * 用户会以为列表里的条目不是同一个文件。
 *
 * ## 为什么类别由后端给
 *
 * `kind` / `language` 由 Rust 侧用**与打开文件时相同的那套判定**算出
 * （见 `commands/recent.rs` 的 `classify`）。前端不再自己按扩展名猜——
 * 编码选择器就吃过两边各维护一份、逐渐漂移的亏
 * （见 `state/encodings.svelte.ts` 的说明）。
 *
 * 因此这里的职责**只是把标识映射成图标**，不做任何分类判断。
 */

import {
  Braces,
  FileBraces,
  FileCode,
  FileCog,
  FileImage,
  FilePen,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType,
  Globe,
  Hash,
  type LucideIcon,
} from '@lucide/svelte';

/**
 * 语言标识 → 图标。
 *
 * 粒度按「用户能否一眼区分」来定，不追求每种语言一个图标：
 * 语言有 19 种，而图标过多反而失去区分度。同类语言共用一个，
 * 例如 C / C++ / Java / Go / Rust 都是 `FileCode`。
 *
 * 但**几类最常见的文件必须彼此可分**，否则图标就白加了：
 * 图片、Markdown、纯文本、代码、JSON、HTML 各自不同。
 * 其中 Markdown 与纯文本最容易撞——都用 `FileText` 的话，
 * 「最近打开」里一个 `.md` 与一个 `.txt` 长得完全一样（实测发现过）。
 *
 * 注意图标名：`FileJson` 在 `@lucide/svelte` 里**没有导出**
 * （文件存在但未进 `icons/index.js`），因此 JSON 用 `FileBraces`
 * ——它画的正是一对大括号，语义上更贴切。
 */
const BY_LANGUAGE: Record<string, LucideIcon> = {
  // Markdown 用「带笔的文档」：它是可读可写的文档，与纯文本区分开
  markdown: FilePen,
  json: FileBraces,
  yaml: FileCog,
  toml: FileCog,
  ini: FileCog,
  html: Globe,
  xml: Braces,
  css: Hash,
  javascript: FileCode,
  typescript: FileCode,
  rust: FileCode,
  go: FileCode,
  python: FileCode,
  java: FileCode,
  c: FileCode,
  cpp: FileCode,
  sql: FileSpreadsheet,
  shell: FileTerminal,
  // 纯文本用最朴素的文档图标——它是「没有特殊类型」的那一类
  plaintext: FileText,
};

/**
 * 取一个文件该用的图标。
 *
 * @param kind     后端给的类别：`text` / `image`（空串视为未知）
 * @param language 后端给的语言标识，仅 `text` 时有意义
 *
 * 未知类别回退到 `FileType`（一个带问号的通用文件），而不是 `FileText`：
 * 后者会让人误以为「已经识别成文本了」，而实际是没认出来。
 */
export function fileIcon(kind: string, language: string): LucideIcon {
  if (kind === 'image') return FileImage;
  if (kind === 'text') return BY_LANGUAGE[language] ?? FileType;
  return FileType;
}
