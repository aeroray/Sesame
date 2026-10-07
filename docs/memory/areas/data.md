# Area: Data

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261008-a1b2c3d4 — 保存一律原子写入

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261011-f1e2d3c4
Facet: security
Evidence:
- repo:src-tauri/src/core/atomic.rs

Decision:
保存走临时文件 + fsync + rename；保存前复核外部修改指纹，冲突时给三个出口。

Reason:
直接覆写断电会留下半截文件。

## MC-AREA-20261008-b2c3d4e5 — 三层保存与草稿、会话

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261007-c1d2e3f4
Facet: behavior
Evidence:
- repo:src-tauri/src/commands/draft.rs

Decision:
主动保存 → 自动保存 → 草稿备份（始终开启）。关窗口用 `onCloseRequested` 并先冲刷草稿。

Reason:
未命名标签只能靠草稿保住，`beforeunload` 拦不住。

## MC-AREA-20261008-c3d4e5f6 — 编码探测与手动纠正

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261018-e5f6a7b8
Facet: data-model
Evidence:
- repo:src-tauri/src/core/encoding.rs

Decision:
打开按 BOM → UTF-8 → GBK 探测，保存按原编码写回；可点状态栏手动纠正。

Reason:
探测不可能全对，纠正入口放状态栏更现实。

## MC-AREA-20261008-e5f6a7b8 — 状态层与 IPC 边界

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: architecture
Evidence:
- repo:src/lib/ipc/fs.ts

Decision:
状态层不得依赖 actions 层；路径、编码与 IO 全在 Rust 侧完成。

Reason:
依赖倒挂会让状态层无法单独测试。
