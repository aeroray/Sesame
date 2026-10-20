# Decisions

Entries are newest first.
Subsystem knowledge lives in `areas/`; only cross-cutting choices stay here.

## MC-DEC-20261102-e5f6a7b8 — Clipboard goes through Rust

Status: active
Scope: project
Subject: MC-SUBJ-20261020-c3d4e5f6
Facet: compatibility
Evidence:
- repo:src/lib/utils/clipboard.ts

Decision:
Use `tauri-plugin-clipboard-manager` with only the text permissions.

Reason:
`navigator.clipboard` is built for untrusted pages.

## MC-DEC-20261003-a1b2c3d4 — Svelte 5 + Vite + Tailwind v4, no SvelteKit

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: architecture
Evidence:
- repo:package.json

Decision:
Single-page frontend on Svelte 5 + Vite with Tailwind v4 CSS-first config.

Reason:
Tauri supplies the desktop shell.

## MC-DEC-20261003-c1d2e3f4 — Appearance rules live in design.md

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: adoption-policy
Evidence:
- repo:docs/design/design.md

Decision:
All appearance and interaction conventions live in `docs/design/design.md`.

Reason:
Rules scattered across components drift.

## MC-DEC-20261020-a1b2c3d4 — Typed hand-rolled i18n dictionary

Status: active
Scope: project
Subject: MC-SUBJ-20261020-b2c3d4e5
Facet: interface
Evidence:
- repo:src/lib/i18n/messages/en.ts

Decision:
Dictionary under `lib/i18n/`; the English file is the structural source, so a missing translation fails `svelte-check`.

Reason:
A framework is overkill for two languages.

## MC-DEC-20261020-c3d4e5f6 — Windows and macOS only

Status: active
Scope: project
Subject: MC-SUBJ-20261020-c3d4e5f6
Facet: architecture
Evidence:
- repo:src/lib/utils/platform.ts

Decision:
Support Windows and macOS only; platform detection collapses to two values.

Reason:
Linux packaging and decorations differ.

## MC-DEC-20261020-d4e5f6a7 — Single-instance plugin registers first

Status: active
Scope: project
Subject: MC-SUBJ-20261020-c3d4e5f6
Facet: lifecycle
Evidence:
- repo:src-tauri/src/lib.rs

Decision:
Register `tauri-plugin-single-instance` first; reopening a file reuses the window.

Reason:
Registering it later discards other plugins.

## MC-DEC-20261021-a1b2c3d4 — Preserve undo history across view rebuilds

Status: active
Scope: project
Subject: MC-SUBJ-20261021-b2c3d4e5
Facet: behavior
Evidence:
- repo:src/lib/editor/create-view.ts

Decision:
Export and restore undo history when rebuilding the view; drop it on a full replace.

Reason:
Sleep and preview both destroy the view.

## MC-DEC-20261021-b2c3d4e5 — Decorative defaults depend on attention cost

Status: active
Scope: project
Subject: MC-SUBJ-20261021-c3d4e5f6
Facet: interface
Evidence:
- user-confirmed

Decision:
Indent guides, rainbow brackets, auto-save and a 16px font all default on.

Reason:
The user overruled the earlier "brackets off" default.
