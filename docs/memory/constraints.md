# Constraints

Project-wide baseline. Subsystem constraints live in `areas/`.

## MC-CON-20261003-a6b7c8d9 — 外观改动以 design.md 为准

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- repo:docs/design/design.md

Constraint:
外观约定遵循 `docs/design/design.md`，新增约定先更新该文件。

## MC-CON-20261003-c9d0e1f2 — 前端实现三条约定

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: behavior
Evidence:
- user-confirmed

Constraint:
用 Tailwind 工具类而非自定义类名；优先复用组件库组件；文案先写中文且简短。

## MC-CON-20261003-c8c9d0e1 — 不得删除项目已有文件

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: security
Evidence:
- user-confirmed

Constraint:
不得删除已有文件；需要变更时改为新增、改写，或先征求确认。

## MC-CON-20261003-b7b8c9d0 — 不得用 PowerShell 正则改写源码

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: security
Evidence:
- user-confirmed

Constraint:
改源码一律用编辑工具，禁止 `-replace` 批量改写；已两次致编码事故。

## MC-CON-20261003-d9d0e1f2 — 依赖用 pnpm 与 npmmirror

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: workflow
Evidence:
- repo:.npmrc

Constraint:
依赖与脚本一律用 pnpm；npm 走 `registry.npmmirror.com`，Cargo 走 rsproxy。
