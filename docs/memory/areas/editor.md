# Area: Editor

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261007-a1b2c3d4 — 行号栏与折叠栏

Status: active
Scope: area:editor
Entry-Type: decision
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- repo:src/lib/editor/fold-gutter.ts

Decision:
行号用 flex 居中而非默认行盒；折叠标记用 SVG chevron，两者一起开关。

Reason:
行号字号小 1px，行盒贴顶、墨迹偏高。

## MC-AREA-20261007-b2c3d4e5 — 编辑器装配与面板对齐

Status: active
Scope: area:editor
Entry-Type: decision
Subject: MC-SUBJ-20261020-a1b2c3d4
Facet: architecture
Evidence:
- repo:src/lib/editor/extensions.ts

Decision:
扩展手工装配、分 Compartment，视图与正文不进响应式状态；查找面板用 flex 居中。

Reason:
手工装配才能按设置项热重配。

## MC-AREA-20261007-d4e5f6a7 — 大文件与深休眠

Status: active
Scope: area:editor
Entry-Type: decision
Subject: MC-SUBJ-20261018-e5f6a7b8
Facet: performance
Evidence:
- repo:src/lib/editor/large-file.svelte.ts

Decision:
>5 MB 只加载前缀，分块追加不触发脏标记；深休眠按取正文、`detachView`、写回的顺序。

Reason:
顺序颠倒会把刚保存的正文删掉。

## MC-AREA-20261007-e5f6a7b8 — 图片查看器按真实尺寸布局

Status: active
Scope: area:editor
Entry-Type: decision
Subject: MC-SUBJ-20261021-d4e5f6a7
Facet: interface
Evidence:
- repo:src/lib/components/editor/ImageViewer.svelte

Decision:
默认适应窗口并用 `ResizeObserver` 跟随，按缩放后的真实尺寸布局，不用 `transform`。

Reason:
「原尺寸 + transform」缩小时仍保留溢出范围。
