# Subject Registry

Subjects provide stable identity for managed decisions, constraints, and rejected approaches.
This registry is protocol metadata and is not part of normal task context.

Entries are newest first.

## MC-SUBJ-20261003-a1b2c3d4 — Sesame 技术栈

Status: active
Kind: concept
Canonical-Ref: feature:sesame-stack
Evidence:
- repo:package.json
- repo:src-tauri/Cargo.toml

Aliases:
- Sesame 技术栈
- 技术栈
- 构建与依赖

## MC-SUBJ-20261003-b2c3d4e5 — 前端实现规范

Status: active
Kind: concept
Canonical-Ref: feature:sesame-frontend-conventions
Evidence:
- user-confirmed
- repo:src/app.css

Aliases:
- 前端实现规范
- 前端约定

## MC-SUBJ-20261004-f1e2d3c4 — 字体与排版

Status: active
Kind: concept
Canonical-Ref: feature:sesame-typography
Evidence:
- repo:src/app.css
- repo:src/lib/components/dialogs/SettingsDialog.svelte

Aliases:
- 字体与排版
- 字体设置

## MC-SUBJ-20261005-e1f2a3b4 — 编辑器 gutter 与装饰

Status: active
Kind: concept
Canonical-Ref: feature:sesame-editor-gutter
Evidence:
- repo:src/lib/editor/fold-gutter.ts
- repo:src/lib/editor/extensions.ts

Aliases:
- 编辑器 gutter 与装饰
- 行号与折叠栏

## MC-SUBJ-20261007-c1d2e3f4 — 草稿与会话恢复

Status: active
Kind: concept
Canonical-Ref: feature:sesame-draft-session
Evidence:
- repo:src-tauri/src/commands/draft.rs
- repo:src-tauri/src/commands/session.rs

Aliases:
- 草稿与会话恢复
- 草稿备份

## MC-SUBJ-20261009-b1c2d3e4 — 原生对话框交互

Status: active
Kind: concept
Canonical-Ref: feature:sesame-native-dialog
Evidence:
- repo:src-tauri/src/lib.rs

Aliases:
- 原生对话框交互
- 确认对话框

## MC-SUBJ-20261011-f1e2d3c4 — 保存策略

Status: active
Kind: concept
Canonical-Ref: feature:sesame-save-policy
Evidence:
- repo:src-tauri/src/core/atomic.rs
- repo:src-tauri/src/commands/fs.rs

Aliases:
- 保存策略
- 原子写入

## MC-SUBJ-20261012-e1f2a3b4 — 操作反馈

Status: active
Kind: concept
Canonical-Ref: feature:sesame-feedback
Evidence:
- repo:src/lib/components/layout/StatusLine.svelte
- repo:src/lib/state/status.svelte.ts

Aliases:
- 操作反馈
- 状态提示

## MC-SUBJ-20261014-a1b2c3d4 — 主题与强调色

Status: active
Kind: concept
Canonical-Ref: feature:sesame-theming
Evidence:
- repo:src/lib/theme/theme-tokens.ts

Aliases:
- 主题与强调色
- 主题系统

## MC-SUBJ-20261015-c3d4e5f6 — 样式验证方法

Status: active
Kind: concept
Canonical-Ref: feature:sesame-style-verification
Evidence:
- user-confirmed

Aliases:
- 样式验证方法
- 浏览器实测

## MC-SUBJ-20261016-d4e5f6a7 — 验证脚本与进程管理

Status: active
Kind: concept
Canonical-Ref: feature:sesame-verify-scripts
Evidence:
- user-confirmed

Aliases:
- 验证脚本与进程管理
- 验证脚本

## MC-SUBJ-20261018-a1b2c3d4 — 快捷键契约

Status: active
Kind: concept
Canonical-Ref: feature:sesame-shortcuts
Evidence:
- repo:src/lib/utils/hotkeys.ts

Aliases:
- 快捷键契约
- 快捷键

## MC-SUBJ-20261018-e5f6a7b8 — 大文件与二进制安全

Status: active
Kind: concept
Canonical-Ref: feature:sesame-large-file
Evidence:
- repo:src-tauri/src/core/encoding.rs
- repo:src-tauri/src/commands/fs.rs

Aliases:
- 大文件与二进制安全
- 大文件处理

## MC-SUBJ-20261018-f6a7b8c9 — 导航与安全边界

Status: active
Kind: concept
Canonical-Ref: feature:sesame-navigation-guard
Evidence:
- repo:src-tauri/src/lib.rs

Aliases:
- 导航与安全边界
- 导航守卫

## MC-SUBJ-20261020-a1b2c3d4 — 编辑器扩展装配

Status: active
Kind: concept
Canonical-Ref: feature:sesame-editor-extensions
Evidence:
- repo:src/lib/editor/extensions.ts

Aliases:
- 编辑器扩展装配
- 编辑器扩展

## MC-SUBJ-20261020-b2c3d4e5 — 国际化

Status: active
Kind: concept
Canonical-Ref: feature:sesame-i18n
Evidence:
- repo:src/lib/i18n/messages/en.ts

Aliases:
- 国际化
- 双语界面

## MC-SUBJ-20261020-c3d4e5f6 — 平台与应用装配

Status: active
Kind: concept
Canonical-Ref: feature:sesame-platform
Evidence:
- repo:src-tauri/tauri.conf.json
- repo:src/lib/utils/platform.ts

Aliases:
- 平台与应用装配
- 平台支持

## MC-SUBJ-20261021-b2c3d4e5 — 撤销历史

Status: active
Kind: concept
Canonical-Ref: feature:sesame-undo-history
Evidence:
- repo:src/lib/editor/create-view.ts

Aliases:
- 撤销历史
- undo 历史

## MC-SUBJ-20261021-c3d4e5f6 — 装饰性功能默认值

Status: active
Kind: concept
Canonical-Ref: feature:sesame-decorative-defaults
Evidence:
- user-confirmed

Aliases:
- 装饰性功能默认值
- 功能默认值

## MC-SUBJ-20261021-d4e5f6a7 — 图片查看器

Status: active
Kind: concept
Canonical-Ref: feature:sesame-image-viewer
Evidence:
- repo:src/lib/components/editor/ImageViewer.svelte

Aliases:
- 图片查看器
- 图片查看
