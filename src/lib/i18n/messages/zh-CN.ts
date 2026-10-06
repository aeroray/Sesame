/**
 * 中文文案。
 *
 * 类型标注为 `Messages`（即英文那份的结构），因此：
 * - 漏掉任何一个 key → 编译报错
 * - 多写一个不存在的 key → 编译报错
 * - 嵌套结构写错 → 编译报错
 *
 * 这比「运行时回退到英文」更可靠：回退会让漏译悄无声息地溜进发布版。
 *
 * 中文没有单复数变化，`one` / `other` 两处写一样即可。
 */
import type { Messages } from './en';

export const zhCN: Messages = {
  app: {
    name: 'Sesame',
    tagline: '轻量文本编辑器',
  },

  window: {
    minimize: '最小化',
    maximize: '最大化',
    restore: '向下还原',
  },

  action: {
    save: '保存',
    saveAs: '另存为',
    discard: '不保存',
    cancel: '取消',
    close: '关闭',
    confirm: '确定',
    reset: '恢复默认',
    copyPath: '复制文件路径',
    revealInFolder: '在文件夹中显示',
    reopenClosed: '重新打开已关闭的标签',
    done: '完成',
    gotIt: '知道了',
  },

  menu: {
    label: '应用菜单',
    settings: '设置',
    shortcuts: '快捷键',
    language: '语言',
    current: '当前',
  },

  tab: {
    untitled: '未命名',
    new: '新建标签页',
    newWithKey: '新建标签页 · Ctrl+N',
    close: '关闭 {name}',
    closeDirty: '关闭 {name}（未保存）',
    next: '下一个标签页',
    previous: '上一个标签页',
  },

  sidebar: {
    open: '已打开',
    recent: '最近',
    toggleWithKey: '切换侧边栏 · Ctrl+B',
    noOpenFiles: '暂无打开的文件',
    noOtherRecents: '没有其它最近文件',
    sleeping: '已休眠（重新打开即恢复）',
    sleepingShort: '已休眠',
    removeFromList: '从列表移除 {name}',
  },

  welcome: {
    newFile: '新建文件',
    openFile: '打开文件',
    recentHeader: '最近打开',
    clear: '清空',
    emptyTitle: '还没有打开过文件',
    emptyHint: '把文件拖到窗口里，或按 Ctrl+O 选择',
  },

  status: {
    saved: '已保存',
    savedWithNewEdits: '已保存，但期间又有改动',
    loadedFromDisk: '已加载磁盘内容',
    savedAsPartial: '已另存为，仅含已加载部分',
    unsavedStillInEditor: '未保存，修改仍在编辑器中',
    largeFileMode: '文件较大，已切换为大文件模式',
    noClosedTabs: '没有刚关闭的标签',
    pathCopied: '已复制路径',
    noPathToCopy: '此标签还没有路径',
    noPathToReveal: '此标签还没有路径',
    restoredDrafts: {
      one: '已恢复 {count} 个未保存的文件',
      other: '已恢复 {count} 个未保存的文件',
    },
    restoredSession: {
      one: '已恢复上次的 {count} 个文件',
      other: '已恢复上次的 {count} 个文件',
    },
  },

  command: {
    openFile: '打开文件',
    closeTab: '关闭标签页',
    toggleSidebar: '切换侧边栏',

    find: '查找',
    findNext: '下一个匹配',
    selectAllMatches: '选中全部匹配',
    gotoLine: '跳转到行',
    triggerCompletion: '触发补全',
    undo: '撤销',
    redo: '重做',
    toggleComment: '切换行注释',
    indentLess: '减少缩进',
    indentMore: '增加缩进',
    moveLine: '上移 / 下移当前行',
    copyLine: '向上 / 向下复制当前行',
    selectAll: '全选',
  },

  shortcuts: {
    title: '快捷键',
    description: '编辑器内的操作与常见编辑器一致。',
    groupFile: '文件',
    groupEdit: '编辑',
    groupView: '视图',
  },

  settings: {
    title: '设置',
    description: '这些设置会自动保存。',

    theme: '主题',
    themePlaceholder: '选择主题',
    /* 主题分组的标题。主题名是专有名词，不翻译；这两个词是分组标签。 */
    themeLight: '浅色',
    themeDark: '深色',

    /*
     * 设置面板的分类标签。
     *
     * 用 Tab 而不是一路平铺：设置项已有十几条，平铺会让「找某一项」
     * 变成通读全文。分类后每屏只呈现一类，找起来快得多。
     */
    groupAppearance: '外观',
    groupEditor: '编辑器',
    groupFiles: '文件与保存',
    groupSystem: '通用',

    language: '语言',

    uiFont: '界面字体',
    editorFont: '编辑器字体',
    followSystemFont: '跟随系统默认',

    fontSize: '字号',
    fontSizePlaceholder: '选择字号',
    fontSizeValue: '{size} px',

    tabSize: '制表符宽度',
    tabSizePlaceholder: '选择宽度',
    tabSizeValue: {
      one: '{size} 空格',
      other: '{size} 空格',
    },

    wordWrap: '自动换行',
    showLineNumbers: '显示行号',
    showIndentGuides: '缩进参考线',
    rainbowBrackets: '括号彩虹',
    rainbowBracketsHint: '按嵌套层级给括号上色',

    languageSystem: '跟随系统',

    autoSave: '自动保存',
    autoSaveHint: '停止输入后自动写入磁盘',
    hibernate: '后台休眠',
    hibernateHint: '长时间未用的大文件释放内存',
    restoreSession: '恢复上次会话',
    restoreSessionHint: '启动时重新打开上次的文件',
  },

  editor: {
    binary: '二进制文件 · 不可编辑保存',
    /*
     * 行列拆成两条文案，中间的分隔符由 StatusBar 统一渲染。
     *
     * 早先是一条 `行 {line} · 列 {column}`，把分隔符写死在文案里，
     * 结果它与同一行其他分隔符的颜色不同（前者跟正文色、
     * 后者是更淡的 border-strong）。拆开后全栏只有一种分隔符。
     */
    lineNumber: '行 {line}',
    columnNumber: '列 {column}',
    lineColumnTitle: '光标位置（行 · 列）',
    /** 状态栏语言项的提示。 */
    language: '文件语言',
    encoding: '文本编码',
    lineEnding: '换行风格',
    largeFileBadge: '大文件模式',
    image: '图片',

    preview: '预览 Markdown',
    backToEditor: '返回编辑',

    wordWrapOn: '自动换行：已开启',
    wordWrapOff: '自动换行：已关闭',
    lineNumbersOn: '显示行号：已开启',
    lineNumbersOff: '显示行号：已关闭',

    largeFileTitle: '大文件模式',
    largeFileProgress: '已载入 {loaded} / {total}（{percent}%）',
    loadMore: '继续加载',
    loadAll: '全部加载',
    loadingMore: '载入中',
    loadingPreview: '正在加载预览…',
    searchPartial: '只搜索已加载的部分，还有 {remaining} 未加载',
  },

  image: {
    zoomOut: '缩小',
    zoomIn: '放大',
    fit: '适应窗口',
    fitShort: '适应',
    actualSize: '原始尺寸',
    openExternal: '用默认程序打开',
    loading: '正在读取图片…',
    displayFailed: '无法显示此图片',
  },

  fontPicker: {
    search: '搜索字体',
    loading: '正在读取系统字体…',
    loadFailed: '无法读取系统字体',
    noMatch: '没有匹配的字体',
    monospace: '等宽',
    moreResults: '还有 {count} 个，继续输入以缩小范围',
  },

  encoding: {
    /*
     * 状态栏编码项的悬停提示。
     *
     * 早先这里写的是「以指定编码重新打开…」，但点击后**先弹出编码选择器**，
     * 用户还要再选一次。提示描述的是「点完之后发生的那件最终的事」，
     * 而不是「点击这个动作会带来什么」——两者不一致会让人以为点错了。
     * 改成「选择编码」：既准确，也没有承诺「立刻重开」。
     */
    change: '选择文本编码…',
    title: '以指定编码重新打开',
    description: '将从磁盘重新读取内容，本标签未保存的修改会丢失。',
    autoDetected: '自动探测',
    unsupported: '不支持这种编码',
    loseChanges: '重新打开会丢弃本标签未保存的修改。要继续吗？',
    reopened: '已按 {encoding} 重新打开',
  },

  lineEnding: {
    change: '转换换行风格…',
    title: '换行风格',
    lf: 'LF（Unix）',
    crlf: 'CRLF（Windows）',
    cr: 'CR（旧版 Mac）',
  },

  dialog: {
    unsavedTitle: '未保存的修改',
    unsavedMessage: '「{name}」有未保存的修改。',

    conflictTitle: '文件已被外部修改',
    conflictMessage: '「{name}」已被其他程序修改。',
    conflictOverwrite: '覆盖磁盘',
    conflictReload: '加载磁盘',
    conflictSaveAs: '另存为',

    saveFailedTitle: '保存失败',
    saveFailedQuestion: '{reason}\n\n要另存到其他位置吗？',
    saveLater: '稍后再说',
  },

  error: {
    generic: '操作失败',
    openFailed: '无法打开文件',
    openImageFailed: '无法打开图片',
    openDialogFailed: '打开文件失败',
    saveFailed: '保存失败',
    saveAsFailed: '另存为失败',
    reloadFailed: '重新加载失败',
    loadFailed: '加载失败',
    readImageFailed: '无法读取图片',
    openExternallyFailed: '无法用默认程序打开',
    writeBlocked: '无法写入该文件',
    notWritable: '图片不支持保存',
    nothingToSave: '没有可保存的内容',
    unknown: '发生未知错误',
    linkOpenFailed: '打开链接失败',
    renderFailed: '无法渲染此文档',
    copyFailed: '无法复制到剪贴板',
    revealFailed: '无法在文件夹中显示',
    encodingFailed: '无法用该编码重新打开',
  },

  time: {
    justNow: '刚刚',
    minutesAgo: {
      one: '{count} 分钟前',
      other: '{count} 分钟前',
    },
    hoursAgo: {
      one: '{count} 小时前',
      other: '{count} 小时前',
    },
    daysAgo: {
      one: '{count} 天前',
      other: '{count} 天前',
    },
  },

  fileFilter: {
    textAndCode: '文本与代码',
    images: '图片',
    allFiles: '全部文件',
  },

  fold: {
    collapse: '折叠这一行',
    expand: '展开这一行',
  },

  language: {
    plaintext: '纯文本',
  },

  search: {
    find: '查找',
    replace: '替换',
    next: '下一个',
    previous: '上一个',
    selectAllMatches: '全选匹配',
    replaceOne: '替换',
    replaceAll: '全部替换',
    close: '关闭',
    go: '跳转',
    matchCase: '区分大小写',
    regexp: '正则表达式',
    byWord: '整词匹配',
    goToLine: '跳转到行',
    currentMatch: '当前匹配',
    onLine: '位于第',
    replacedOnLine: '已替换第 $ 行的匹配',
    replacedCount: '已替换 $ 处匹配',
  },

  locale: {
    'zh-CN': '简体中文',
    en: 'English',
  },
};
