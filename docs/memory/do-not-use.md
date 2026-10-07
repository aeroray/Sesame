# Do Not Use / Tombstones

Rejected options and known failed paths. Check before reintroducing an approach.
Tombstones are newest first.

## MC-DNU-20261009-a1b2c3d4 — 不用 toast 做操作反馈

Status: active
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: adoption-policy
Evidence:
- repo:src/lib/state/status.svelte.ts

Rejected:
`toast` / `svelte-sonner` 及其自研替代品。

Reason:
卡片浮在内容上还会移动，与「刚发生了什么」无空间关联。已改为标题栏状态提示；期间「保留 sonner 改胶囊」「自研 Toaster」「改中性底」三条路都属同一方向的反复，不要再走。

## MC-DNU-20261009-b2c3d4e5 — 样式块内不写标签名注释

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: performance
Evidence:
- repo:docs/design/design.md

Rejected:
在 Svelte 脚本注释里用尖括号写标签名。

Reason:
解析器会当成真实标签并报 left open，整个组件编译失败。
