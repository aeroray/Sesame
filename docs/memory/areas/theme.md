# Area: Theme

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261010-a1b2c3d4 — 主题令牌由 JS 推导

Status: active
Scope: area:theme
Entry-Type: decision
Subject: MC-SUBJ-20261014-a1b2c3d4
Facet: interface
Evidence:
- repo:src/lib/theme/theme-tokens.ts

Decision:
令牌推导后写入 `<html>` 内联样式，CSS 只留兜底值；强调色靠 `data-accent` 切换。

Reason:
写死在 CSS 里必然「改了背景忘了改边框」。

## MC-AREA-20261010-b2c3d4e5 — 字体栈必须显式含中文

Status: active
Scope: area:theme
Entry-Type: decision
Subject: MC-SUBJ-20261004-f1e2d3c4
Facet: interface
Evidence:
- repo:src/app.css

Decision:
界面与编辑器字体可分别设置且回落到不同栈，两栈都要显式列出中文字体。

Reason:
等宽字体几乎不含中文字形，混排时会出现两种字体。

## MC-AREA-20261010-c3d4e5f6 — app.css 的状态变体桥接不可删

Status: active
Scope: area:theme
Entry-Type: constraint
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: compatibility
Evidence:
- repo:src/app.css

Constraint:
`app.css` 顶部把 bits-ui 的 `data-state` 映射到 `data-checked:` 等变体的声明必须保留。

Reason:
删掉后开关、选中态、展开态会全部失去样式。
