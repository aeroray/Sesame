/**
 * 英文文案。**这是字典结构的唯一来源**——
 * 中文版必须满足同一份 `Messages` 类型，漏译或拼错 key 都会在编译期报错。
 *
 * ## 约定
 *
 * - key 用点分层级，按**功能域**分组，不按组件分。
 *   同一个词（如「保存」）在多个组件里出现，只该有一条文案。
 * - 占位符用 `{name}` 形式，由 `t()` 做插值。
 * - 需要按数量变形的文案用 `{ one, other }`，由 `t()` 依据 `count` 选择。
 *   中文没有单复数变化，两个值写一样即可——这是刻意的，
 *   好过为中文单独开一套机制。
 * - **日志与 `console` 消息不进字典**：它们是给开发者看的，
 *   不该跟随界面语言变化，也不该占用翻译工作量。
 */
export const en = {
  app: {
    tagline: 'Lightweight text editor',
  },

  /** 自定义标题栏上的窗口控制按钮。 */
  window: {
    minimize: 'Minimize',
    maximize: 'Maximize',
    restore: 'Restore down',
  },

  /** 通用动作词。多处复用，改一次即全局生效。 */
  action: {
    save: 'Save',
    saveAs: 'Save As',
    discard: 'Don’t Save',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'OK',
    reset: 'Restore Defaults',
    copyPath: 'Copy file path',
    revealInFolder: 'Show in folder',
    reopenClosed: 'Reopen closed tab',
    closeOthers: 'Close other tabs',
    closeToRight: 'Close tabs to the right',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    done: 'Done',
  },

  /** 右键菜单。 */
  contextMenu: {
    recentlyClosed: 'Recently closed',
    noClosedTabs: 'Nothing to reopen',
    pasteFailed: 'The clipboard holds no text',
  },

  menu: {
    settings: 'Settings',
    shortcuts: 'Keyboard Shortcuts',
  },

  tab: {
    recoveredFile: 'Recovered {name}',
    untitled: 'Untitled',
    new: 'New file',
    newWithKey: 'New file · Ctrl+N',
    close: 'Close {name}',
    closeDirty: 'Close {name} (unsaved)',
    next: 'Next tab',
    previous: 'Previous tab',
    welcome: 'Welcome page',
  },

  sidebar: {
    open: 'Open files',
    recent: 'Recent',
    toggleWithKey: 'Toggle sidebar · Ctrl+B',
    noOpenFiles: 'No files open',
    noOtherRecents: 'No other recent files',
    sleeping: 'Sleeping (reopening restores it)',
    sleepingShort: 'Sleeping',
    removeFromList: 'Remove {name} from list',
  },

  welcome: {
    newFile: 'New file',
    openFile: 'Open file',
    recentHeader: 'Recently opened',
    clear: 'Clear',
    emptyTitle: 'No files opened yet',
    emptyHint: 'Drop a file into the window, or press Ctrl+O',
    /* 最近文件条目的右键菜单。 */
    open: 'Open',
    removeFromList: 'Remove from list',
  },

  /** 标题栏中央的操作反馈。力求短。 */
  status: {
    saved: 'Saved',
    savedWithNewEdits: 'Saved, but edited again',
    loadedFromDisk: 'Reloaded from disk',
    savedAsPartial: 'Saved as — only the loaded part',
    unsavedStillInEditor: 'Not saved; your edits are still here',
    largeFileMode: 'Large file — switched to chunked mode',
    noClosedTabs: 'No recently closed tabs',
    pathCopied: 'Path copied',
    noPathToCopy: 'This tab has no path yet',
    noPathToReveal: 'This tab has no path yet',
    nothingSelected: 'Nothing selected',
    restoredDrafts: {
      one: 'Restored {count} unsaved file',
      other: 'Restored {count} unsaved files',
    },
    restoredSession: {
      one: 'Reopened {count} file from last session',
      other: 'Reopened {count} files from last session',
    },
  },

  /** 编辑器内命令的显示名（快捷键面板用）。 */
  command: {
    openFile: 'Open file',
    closeTab: 'Close tab',
    toggleSidebar: 'Toggle sidebar',

    find: 'Find',
    findNext: 'Find next',
    selectAllMatches: 'Select all matches',
    gotoLine: 'Go to line',
    triggerCompletion: 'Trigger completion',
    undo: 'Undo',
    redo: 'Redo',
    toggleComment: 'Toggle line comment',
    indentLess: 'Decrease indent',
    indentMore: 'Increase indent',
    moveLine: 'Move line up / down',
    copyLine: 'Copy line up / down',
    selectAll: 'Select all',
  },

  shortcuts: {
    groupFile: 'File',
    groupEdit: 'Edit',
    groupView: 'View',
  },

  settings: {
    title: 'Settings',
    description: 'Changes are saved automatically.',

    theme: 'Theme',
    themePlaceholder: 'Choose a theme',
    /* 主题分组的标题。主题名是专有名词，不翻译；这两个词是分组标签。 */
    themeLight: 'Light',
    themeDark: 'Dark',

    /* 设置面板的分类标签。 */
    groupAppearance: 'Appearance',
    groupEditor: 'Editor',
    groupFiles: 'Files & Saving',
    groupSystem: 'General',
    groupShortcuts: 'Shortcuts',
    groupAbout: 'About',

    language: 'Language',

    uiFont: 'Interface font',
    editorFont: 'Editor font',
    followSystemFont: 'System default',

    fontSize: 'Font size',
    fontSizePlaceholder: 'Choose a size',
    fontSizeValue: '{size} px',

    tabSize: 'Tab width',
    tabSizePlaceholder: 'Choose a width',
    tabSizeValue: {
      one: '{size} space',
      other: '{size} spaces',
    },

    wordWrap: 'Word wrap',
    showLineNumbers: 'Line numbers',
    showIndentGuides: 'Indent guides',
    rainbowBrackets: 'Rainbow brackets',
    rainbowBracketsHint: 'Color brackets by nesting depth',

    /** 语言选项里的「跟随系统」。 */
    languageSystem: 'Follow system',

    autoSave: 'Autosave',
    autoSaveHint: 'Write to disk after you stop typing',
    hibernate: 'Background hibernation',
    hibernateHint: 'Release memory for large files left idle',
    restoreSession: 'Restore last session',
    restoreSessionHint: 'Reopen your files on launch',

    /* 关于面板。版本号运行时从 Tauri 读取，不写死在字典里。 */
    aboutVersion: 'Version {version}',
    aboutTagline: 'A lightweight text editor and file viewer.',
    aboutPlatform: 'Platform',
    aboutEngine: 'Engine',
    aboutEngineValue: 'Tauri 2 · Svelte 5 · CodeMirror 6',
    aboutLicense: 'License',
    aboutLicenseValue: 'MIT',
  },

  /*
   * 自动更新。
   *
   * 单独成组而不是塞进 `settings`：这些文案由 `state/update.svelte.ts`
   * 与 `UpdatePanel` 使用，与设置项无关；错误信息更是要在状态模块里
   * 直接引用，挂在 `settings.*` 下会让那个模块的语义变得别扭。
   *
   * 三条错误分开写而不是共用一句「更新失败」：签名校验失败意味着
   * 下载到的包**不是我们发布的**，与断网是完全不同的两件事，
   * 用户该做的处置也不同（前者不该重试，后者该检查网络）。
   */
  update: {
    title: 'Updates',
    check: 'Check for updates',
    checking: 'Checking…',
    upToDate: 'You are on the latest version',
    available: 'Version {version} is available',
    download: 'Download and install',
    downloading: 'Downloading… {percent}%',
    downloadingUnknown: 'Downloading…',
    installing: 'Installing — the app will restart',
    retry: 'Try again',
    notes: "What's new",
    errorSignature: 'The downloaded package failed its signature check and was not installed.',
    errorNetwork: 'Could not reach the update server. Check your connection and try again.',
    errorGeneric: 'The update could not be completed.',
  },

  /** 编辑器状态栏。 */
  editor: {
    readonly: 'Read-only',
    binary: 'Binary file · read-only',
    /*
     * 行列拆成两条文案，中间的分隔符由 StatusBar 统一渲染
     * （理由见 zh-CN.ts 的同名条目）。
     */
    lineNumber: 'Line {line}',
    columnNumber: 'Col {column}',
    lineColumnTitle: 'Cursor position (line · column)',
    /** 状态栏语言项的提示。 */
    language: 'File language',
    encoding: 'Text encoding',
    lineEnding: 'Line endings',
    largeFileBadge: 'Large file',
    image: 'Image',

    preview: 'Preview Markdown',
    backToEditor: 'Back to editing',

    wordWrapOn: 'Word wrap: on',
    wordWrapOff: 'Word wrap: off',
    lineNumbersOn: 'Line numbers: on',
    lineNumbersOff: 'Line numbers: off',

    /** 懒加载的预览分块还没到位时的占位文案。 */
    loadingPreview: 'Loading preview…',

    /** 大文件提示条。 */
    largeFileTitle: 'Large file',
    largeFileProgress: 'Loaded {loaded} of {total} ({percent}%)',
    loadMore: 'Load more',
    loadAll: 'Load everything',
    /** 正在追加下一块。 */
    loadingMore: 'Loading',
    /** 查找只覆盖已加载部分时的提醒。 */
    searchPartial: 'Only the loaded part is searched — {remaining} not loaded yet',
  },

  image: {
    viewArea: 'Image preview',
    spacePan: 'Hold Space and drag to pan the image',
    panShortcut: 'Space + drag',
    wheelZoom: 'Zoom image with Ctrl + mouse wheel',
    wheelShortcut: 'Ctrl + mouse wheel',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    fit: 'Fit to window',
    fitShort: 'Fit',
    actualSize: 'Actual size',
    openExternal: 'Open with external app',
    chooseExternalApp: 'Choose an application to open this image',
    applications: 'Applications',
    /** 图片还没读完时的占位文案。 */
    loading: 'Reading image…',
    /** 图片数据拿到了但没法渲染（格式损坏等）。 */
    displayFailed: 'Could not display this image',
    copyImage: 'Copy image',
    imageCopied: 'Image copied',
    copyImageFailed: 'Could not copy the image',
    saveAs: 'Save image as…',
    saveAsTitle: 'Save image as',
    savedAs: 'Saved as {name}',
    setWallpaper: 'Set as desktop wallpaper',
    wallpaperSet: 'Desktop wallpaper updated',
    rotateCW: 'Rotate right',
    rotateCCW: 'Rotate left',
    flipH: 'Flip horizontally',
    flipV: 'Flip vertically',
    resetTransform: 'Reset rotation and flip',
    saveTitle: 'Save image',
    lossySaveWarning:
      'This format loses quality when re-encoded. Overwrite the original file anyway?',
    formatNotWritable:
      'This format cannot store the rotation: the original file stays untouched and a PNG copy will be saved instead. Continue?',
    savedRotated: 'Image saved',
  },

  fontPicker: {
    search: 'Search fonts',
    loading: 'Reading system fonts…',
    loadFailed: 'Could not read system fonts',
    noMatch: 'No matching fonts',
    monospace: 'Monospace',
    moreResults: '{count} more — keep typing to narrow down',
  },

  encoding: {
    /** 手动指定编码的入口。 */
    change: 'Reopen with encoding…',
    title: 'Reopen with encoding',
    loseChanges: 'Reopening will discard the unsaved changes in this tab. Continue?',
    reopened: 'Reopened as {encoding}',
  },

  lineEnding: {
    change: 'Convert line endings…',
    title: 'Line endings',
    lf: 'LF (Unix)',
    crlf: 'CRLF (Windows)',
    cr: 'CR (legacy Mac)',
    changed: 'Line endings set to {style} — saved on next save',
  },

  /** 需要用户**做决定**的原生对话框。 */
  dialog: {
    unsavedTitle: 'Unsaved changes',
    unsavedMessage: '“{name}” has unsaved changes.',

    conflictTitle: 'File changed on disk',
    conflictMessage: '“{name}” was modified by another program.',
    conflictOverwrite: 'Overwrite',
    conflictReload: 'Reload from disk',
    conflictSaveAs: 'Save As',

    saveFailedTitle: 'Could not save',
    saveFailedQuestion: '{reason}\n\nSave to a different location instead?',
    saveLater: 'Later',
  },

  /** 操作失败提示（标题栏状态栏里的一行字）。 */
  error: {
    documentChangedDuringReload: 'The document changed while reloading. Your edits have been kept.',
    draftDeleteFailed: 'Could not remove the draft backup. Please try closing again.',
    lossyDecodeReadonly:
      'Some bytes could not be decoded. This file is read-only; choose the correct encoding to edit it.',
    draftBackupFailed: 'Draft backup failed. The window will stay open to protect your edits.',
    saveTargetAlreadyOpen:
      'The destination is already open in another tab. Choose a different file.',
    generic: 'Something went wrong',
    openFailed: 'Could not open the file',
    openImageFailed: 'Could not open the image',
    openDialogFailed: 'Could not open the file dialog',
    saveFailed: 'Could not save',
    saveAsFailed: 'Could not save as',
    reloadFailed: 'Could not reload',
    loadFailed: 'Could not load',
    readImageFailed: 'Could not read the image',
    openExternallyFailed: 'Could not open with an external app',
    writeBlocked: 'Could not write to this file',
    notWritable: 'Image files cannot be saved',
    nothingToSave: 'There is nothing to save',
    unknown: 'An unknown error occurred',
    renderFailed: 'Could not render this document',
    copyFailed: 'Could not copy to the clipboard',
    revealFailed: 'Could not show the file in its folder',
    encodingFailed: 'Could not reopen with that encoding',
    saveImageFailed: 'Could not save the image',
    imageConflict:
      'The image changed on disk, so it cannot be overwritten. Choose where to save a rotated copy.',
    imageTooLargeToTransform: 'This image has too many pixels to rotate or flip.',
    imageCopyExtensionMismatch:
      'The copy must end in .{extension}, or its contents will not match its extension.',
    imageCopyAlsoModified: 'That file was also changed on disk. Please choose another location.',
    wallpaperFailed: 'Could not set the desktop wallpaper',
  },

  /** 相对时间（最近文件列表）。 */
  time: {
    justNow: 'Just now',
    minutesAgo: {
      one: '{count} minute ago',
      other: '{count} minutes ago',
    },
    hoursAgo: {
      one: '{count} hour ago',
      other: '{count} hours ago',
    },
    daysAgo: {
      one: '{count} day ago',
      other: '{count} days ago',
    },
  },

  /** 原生文件对话框里的类型过滤名。 */
  fileFilter: {
    textAndCode: 'Text and code',
    images: 'Images',
    allFiles: 'All files',
  },

  /** 折叠栏图标的提示。 */
  fold: {
    collapse: 'Fold this line',
    expand: 'Unfold this line',
  },

  /**
   * 状态栏里的语言显示名。
   *
   * 只有「纯文本」需要翻译——其余都是语言自身的名字
   * （Markdown、JSON、Rust……），任何界面语言下写法都相同。
   */
  language: {
    plaintext: 'Plain text',
  },

  /**
   * CodeMirror 内置搜索面板的文案。
   *
   * **键名（`Find`、`next`……）必须与 @codemirror/search 内部
   * 调用 `phrase()` 时使用的英文字符串逐字一致**，改动键名会让面板回退成英文。
   * 值里的 `$` 是 CodeMirror 自己的占位符，与 `t()` 的 `{name}` 互不干涉。
   */
  search: {
    find: 'Find',
    replace: 'Replace',
    next: 'Next',
    previous: 'Previous',
    selectAllMatches: 'Select all',
    replaceOne: 'Replace',
    replaceAll: 'Replace all',
    close: 'Close',
    go: 'Go',
    matchCase: 'Match case',
    regexp: 'Regular expression',
    byWord: 'Whole word',
    goToLine: 'Go to line',
    currentMatch: 'Current match',
    onLine: 'on line',
    replacedOnLine: 'replaced match on line $',
    replacedCount: 'replaced $ matches',
  },

  /** 语言自身的名称。永远用该语言书写，不翻译。 */
  locale: {
    'zh-CN': '简体中文',
    en: 'English',
  },
};

/**
 * 字典类型。
 *
 * 用 `typeof en` 而不是手写 interface：改英文文案时类型自动跟着变，
 * 中文版漏了哪条会立刻在 `svelte-check` 里报出来。
 *
 * **注意这里不能给 `en` 加 `as const`。** 那会把每个值收窄成字符串字面量
 * （`'Save'` 而不是 `string`），于是中文版写 `'保存'` 就会因为
 * 「类型不匹配」而编译失败——字典本身反而没法翻译了。
 */
export type Messages = typeof en;
