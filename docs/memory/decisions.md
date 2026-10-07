# Decisions

Entries are newest first.
Subsystem knowledge lives in `areas/`; only cross-cutting choices stay here.

## MC-DEC-20261003-a1b2c3d4 — 前端用 Svelte 5 + Vite + Tailwind v4

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: architecture
Evidence:
- repo:package.json

Decision:
单页前端用 Svelte 5 + Vite，样式用 Tailwind v4 CSS-first 配置；不用 SvelteKit。

Reason:
桌面壳由 Tauri 提供，不需要路由与 SSR。

## MC-DEC-20261003-c1d2e3f4 — 外观规范集中于 design.md

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: adoption-policy
Evidence:
- repo:docs/design/design.md

Decision:
外观与交互约定统一写在 `docs/design/design.md`，改外观前先读、新增约定先更新它。

Reason:
组件里各写一套会让同类控件慢慢长得不一样。

## MC-DEC-20261020-a1b2c3d4 — 双语界面用自建类型化字典

Status: active
Scope: project
Subject: MC-SUBJ-20261020-b2c3d4e5
Facet: interface
Evidence:
- repo:src/lib/i18n/messages/en.ts

Decision:
字典放 `lib/i18n/`，英文那份是结构来源，漏译在 svelte-check 报错。

Reason:
只为两种语言引整套框架不划算，类型系统能保证两份同步。

## MC-DEC-20261020-c3d4e5f6 — 平台收敛为 Windows + macOS

Status: active
Scope: project
Subject: MC-SUBJ-20261020-c3d4e5f6
Facet: architecture
Evidence:
- repo:src/lib/utils/platform.ts

Decision:
只支持 Windows 与 macOS，平台判定收敛为两值。

Reason:
Linux 的红绿灯、文件关联与打包格式在各桌面环境都不同。

## MC-DEC-20261020-d4e5f6a7 — 单实例插件必须第一个注册

Status: active
Scope: project
Subject: MC-SUBJ-20261020-c3d4e5f6
Facet: lifecycle
Evidence:
- repo:src-tauri/src/lib.rs

Decision:
`tauri-plugin-single-instance` 必须第一个注册，再次打开文件时复用已有窗口。

Reason:
排在后面会先初始化一遍再丢弃，可能留下半初始化状态。

## MC-DEC-20261021-a1b2c3d4 — 视图重建时保留撤销历史

Status: active
Scope: project
Subject: MC-SUBJ-20261021-b2c3d4e5
Facet: behavior
Evidence:
- repo:src/lib/editor/create-view.ts

Decision:
重建视图时导出并传回撤销历史；取出即清除，整体替换内容时丢弃。

Reason:
休眠唤醒与切预览都会销毁视图，撤销栈随之丢失。

## MC-DEC-20261021-b2c3d4e5 — 装饰性功能看是否争夺注意力

Status: active
Scope: project
Subject: MC-SUBJ-20261021-c3d4e5f6
Facet: interface
Evidence:
- user-confirmed

Decision:
缩进参考线默认开启，括号彩虹默认关闭。

Reason:
参考线可被忽略，多色括号是主动吸引注意力的装饰。
