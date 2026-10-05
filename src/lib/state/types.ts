/**
 * 共享类型定义。与 Rust 端 `model/file_meta.rs` 的序列化结构一一对应。
 */

/**
 * Rust 端返回的结构化错误。
 *
 * 取值必须与 `src-tauri/src/model/error.rs` 的 `AppError::code()` 完全一致。
 * 早先这里漏了 `conflict`、却多了一个后端从不产生的 `unknown_encoding`——
 * 于是按 code 做分支的地方（`save-file.ts` 判断冲突）在类型上就丢了出口。
 */
export interface AppError {
  code:
    | 'not_found'
    | 'permission_denied'
    | 'not_a_file'
    | 'too_large'
    | 'invalid_path'
    | 'unsupported'
    | 'conflict'
    | 'io';
  message: string;
}

/** 文件元数据。 */
export interface FileMeta {
  path: string;
  name: string;
  size: number;
  /** Unix 毫秒时间戳。 */
  modified: number | null;
  /**
   * 文件是否带「只读」属性。
   *
   * 注意这只反映 Windows 的 `FILE_ATTRIBUTE_READONLY`，
   * **不包含** ACL 层面的写权限拒绝。因此它只能用于**提前提示**，
   * 不能当作「一定能写」或「一定不能写」的判据——
   * 真正的失败仍由保存时的 io 错误兜住。
   */
  readonly: boolean;
}

/** 语言标识，与 Rust `core/lang_map.rs` 保持一致。 */
export type LanguageId =
  | 'markdown'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'ini'
  | 'html'
  | 'css'
  | 'javascript'
  | 'typescript'
  | 'rust'
  | 'go'
  | 'python'
  | 'java'
  | 'c'
  | 'cpp'
  | 'sql'
  | 'xml'
  | 'shell'
  | 'plaintext';

/** 换行风格。 */
export type LineEnding = 'lf' | 'crlf' | 'cr';

/** 打开文件后的完整负载。 */
export interface FilePayload {
  meta: FileMeta;
  content: string;
  language: LanguageId;
  encoding: string;
  hasBom: boolean;
  lineEnding: LineEnding;
  /** 内容是否被截断（超大文件未内联读取）。 */
  truncated: boolean;
}

/** 分块读取结果。 */
export interface TextChunk {
  content: string;
  offset: number;
  nextOffset: number;
  eof: boolean;
}

/** 保存结果。 */
export interface SaveResult {
  path: string;
  size: number;
  modified: number | null;
  /**
   * 大文件保存时**实际写入的前缀字节数**；普通保存为 `null`。
   *
   * 必须用它更新「已加载字节数」，不能沿用保存前的旧值——
   * 用户在前缀里增删字符后，新文件中前缀的长度已经变了，
   * 用旧偏移会让下次保存把尾部复制到错误位置，内容被重复。
   */
  prefixBytes: number | null;
}

/** 最近文件条目。 */
export interface RecentEntry {
  path: string;
  name: string;
  /** Unix 毫秒时间戳。 */
  openedAt: number;
}

/** 上次会话中的一个标签页。 */
export interface SessionTab {
  path: string;
  line: number;
  column: number;
  scrollTop: number;
}

/** 上次会话的完整快照。 */
export interface SessionSnapshot {
  tabs: SessionTab[];
  activePath: string | null;
}

/** 图片读取结果。 */
export interface ImagePayload {
  /** 可直接用于 `<img src>` 的 data URL。 */
  dataUrl: string;
  mime: string;
  size: number;
  name: string;
  path: string;
}

/**
 * 一份草稿备份。
 *
 * 用于把「未保存的正文」暂存到磁盘，解决未命名标签关闭即丢失的问题。
 * 字段与 `Tab` 对齐，恢复时可直接还原成标签页。
 */
export interface Draft {
  id: string;
  path: string | null;
  name: string;
  content: string;
  language: string;
  encoding: string;
  lineEnding: string;
  hasBom: boolean;
  /** 备份时间，Unix 毫秒。 */
  savedAt: number;
}

/** 一个可选字体。 */
export interface FontFamily {
  /** 传给 CSS `font-family` 的名称。 */
  name: string;
  /** 是否为等宽字体。 */
  monospaced: boolean;
}

/** Tab 休眠状态。 */
export type SleepState = 'none' | 'shallow' | 'deep';

/**
 * 标签页承载的内容类型。
 *
 * `text` 走 CodeMirror；`image` 走图片查看器。
 * SVG 归为 `text`（它本质是 XML），但额外允许切换图片预览。
 */
export type TabKind = 'text' | 'image';

/** 一个打开的标签页。 */
export interface Tab {
  id: string;
  /** 文件绝对路径；`null` 表示未命名的空白标签。 */
  path: string | null;
  name: string;
  kind: TabKind;
  language: LanguageId;
  encoding: string;
  lineEnding: LineEnding;
  hasBom: boolean;
  dirty: boolean;
  /** 是否为大文件分块模式。 */
  truncated: boolean;
  scrollTop: number;
  cursorLine: number;
  cursorColumn: number;
  lastActiveAt: number;
  sleep: SleepState;
}

/**
 * 强调色标识。
 *
 * 每个值对应 app.css 里的一条 `--brand-*` 色阶；
 * `indigo` 是默认值，不写 `data-accent` 属性。
 */
export type AccentId = 'indigo' | 'pine' | 'rose' | 'amber';

/**
 * 界面语言。
 *
 * `system` 表示跟随系统语言——这是默认值，也是绝大多数用户该用的选项。
 * 用户显式选过 `zh-CN` 或 `en` 之后就不再跟随系统。
 */
export type LanguageSetting = 'system' | 'zh-CN' | 'en';

/** 应用设置。 */
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  accent: AccentId;
  /** 界面语言。默认跟随系统。 */
  language: LanguageSetting;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
  autoSave: boolean;
  hibernateEnabled: boolean;
  /** 是否恢复上次会话的标签页。 */
  restoreSession: boolean;
  /**
   * 界面字体。
   *
   * 空字符串表示「跟随系统默认」，即用 app.css 的内置无衬线字体栈
   * （含中英文回退）。
   */
  uiFont: string;
  /**
   * 编辑器字体。
   *
   * 空字符串表示「跟随系统默认」，即用内置的**等宽**字体栈。
   *
   * 注意：编辑器字体**不跟随界面字体**。编辑器是代码编辑面，等宽是基本要求；
   * 跟随界面字体反而会让代码失去对齐。两者各自回落到不同的内置栈。
   */
  editorFont: string;
}
