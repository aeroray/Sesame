# Constraints

Project-wide baseline. Subsystem constraints live in `areas/`.

## MC-CON-20261003-a6b7c8d9 — design.md governs appearance

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- repo:docs/design/design.md

Constraint:
Appearance follows `docs/design/design.md`. Add conventions there first.

## MC-CON-20261003-c9d0e1f2 — Three frontend rules

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: behavior
Evidence:
- user-confirmed

Constraint:
Tailwind utility classes, not custom class names. Reuse component-library components. UI copy in Chinese.

## MC-CON-20261003-c8c9d0e1 — Never delete existing project files

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: security
Evidence:
- user-confirmed

Constraint:
Do not delete existing files; add or rewrite instead, or ask first.

## MC-CON-20261003-b7b8c9d0 — No PowerShell regex rewrites of source

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: security
Evidence:
- user-confirmed

Constraint:
Edit source with editing tools only; never batch-rewrite with `-replace`. Two incidents so far.

## MC-CON-20261003-d9d0e1f2 — pnpm plus npmmirror

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: workflow
Evidence:
- repo:.npmrc

Constraint:
Use pnpm. npm resolves via `registry.npmmirror.com`; Cargo via rsproxy.

