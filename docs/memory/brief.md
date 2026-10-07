# Project Brief

Purpose:
- Sesame 是轻量桌面文本编辑器与文件查看器：打开快、占用小、支持大文件与多编码。
- 面向需要随手查看或小改文本、代码、配置的开发者。
- 只支持 Windows 与 macOS，界面为简体中文与英文。

Current direction:
- 计划内功能已完成并实机验证：编辑、多标签、侧栏、设置、主题、Markdown 预览、查找替换、大文件分块、图片查看、会话恢复、自动保存、草稿备份、二语界面。
- 界面规范以 `docs/design/design.md` 为准；子系统记忆在 `docs/memory/areas/`。

System shape:
- Tauri 2 + Svelte 5 + Vite 单页前端，Tailwind v4 CSS-first，组件基于 shadcn-svelte 与 bits-ui。
- 编辑器为 CodeMirror 6；标签页有 `text` 与 `image` 两种。
- 编码：新文件 UTF-8，打开时探测并按原编码写回；>5 MB 只加载前缀，保存时把磁盘尾部拼回。
- 保存三层：主动保存 → 自动保存 → 草稿备份，均走原子写入。
- 持久化四分：设置走 `tauri-plugin-store`，最近文件、会话、草稿各由 Rust 侧单独存 JSON。
- 操作反馈用标题栏状态提示，不用 toast。Rust 端按 `commands` / `core` / `model` 分层。

Verification:
- Rust 单测 61 项通过；`svelte-check` 零错误；首屏 JS 约 277 KB（gzip）。
- 实机验证覆盖保存冲突、二进制只读、大文件两次保存、深休眠往返、会话与草稿恢复、二语切换。
- 平台：Windows 实测；macOS 未在真机验证。
