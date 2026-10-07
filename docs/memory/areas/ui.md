# Area: UI

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261009-a1b2c3d4 — 操作反馈用标题栏状态提示

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: interface
Evidence:
- repo:src/lib/state/status.svelte.ts

Decision:
告知类反馈在标题栏中央显示一行并自动消失；需要决策的事走原生对话框。

Reason:
toast 浮在内容上还会移动。

## MC-AREA-20261009-b2c3d4e5 — 窗口骨架

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: workflow
Evidence:
- repo:src/lib/components/layout/Shell.svelte

Decision:
标题栏 + 标签栏 + 编辑区，侧栏默认折叠（Ctrl+B）。

Reason:
紧凑三行是「轻量」在界面上的体现。

## MC-AREA-20261009-e5f6a7b8 — 对话框返回按钮文字

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261009-b1c2d3e4
Facet: interface
Evidence:
- repo:src/lib/utils/hotkeys.ts

Decision:
`message()` 配自定义按钮时返回按钮文字本身；标点键快捷键比对 `event.code`。

Reason:
输入法会改写标点键的 `event.key`。

## MC-AREA-20261009-f6a7b8c9 — 开关与悬停操作列

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: lifecycle
Evidence:
- repo:src/lib/components/layout/Sidebar.svelte

Decision:
开关激活态只用文字颜色区分、图标不变；悬停按钮与相邻信息重叠，只切 `opacity`。

Reason:
换图标会让同一开关像两个功能。

## MC-AREA-20261011-a1b2c3d4 — 图标按钮之间的纯文字加 leading-none

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261021-d4e5f6a7
Facet: behavior
Evidence:
- repo:src/lib/components/editor/ImageViewer.svelte

Decision:
图标按钮之间的纯文字必须加 `leading-none` 才与图标对齐。

Reason:
居中作用于行盒，行高 1.5 倍时中文墨迹偏高 1px。
