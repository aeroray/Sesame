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
Use `tauri-plugin-clipboard-manager` for read/write, granting only `allow-read-text` and `allow-write-text`. Cut/Copy stay on `execCommand` (DOM selection).

Reason:
`navigator.clipboard` is built for untrusted pages, so paste could prompt. Rust and JS versions must match major.

## MC-DEC-20261003-a1b2c3d4 — Svelte 5 + Vite + Tailwind v4, no SvelteKit

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: architecture
Evidence:
- repo:package.json

Decision:
Single-page frontend on Svelte 5 + Vite, styled with Tailwind v4 CSS-first config. No SvelteKit.

Reason:
Tauri supplies the desktop shell, so routing and SSR are unnecessary.

## MC-DEC-20261003-c1d2e3f4 — Appearance rules live in design.md

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: adoption-policy
Evidence:
- repo:docs/design/design.md

Decision:
All appearance and interaction conventions live in `docs/design/design.md`. Read it before changing looks; update it before adding a convention.

Reason:
Rules scattered across components drift until similar controls no longer match.

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
An i18n framework is overkill for two languages; the type system keeps both files in sync.

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
Linux traffic lights, file associations, and packaging differ per desktop environment.

## MC-DEC-20261020-d4e5f6a7 — Single-instance plugin registers first

Status: active
Scope: project
Subject: MC-SUBJ-20261020-c3d4e5f6
Facet: lifecycle
Evidence:
- repo:src-tauri/src/lib.rs

Decision:
`tauri-plugin-single-instance` must be registered first; reopening a file reuses the existing window.

Reason:
Registering it later initializes and discards other plugins, possibly leaving half-initialized state.

## MC-DEC-20261021-a1b2c3d4 — Preserve undo history across view rebuilds

Status: active
Scope: project
Subject: MC-SUBJ-20261021-b2c3d4e5
Facet: behavior
Evidence:
- repo:src/lib/editor/create-view.ts

Decision:
Export and restore undo history when rebuilding the view; take-once, drop on full content replace.

Reason:
Sleep/wake and preview toggling both destroy the view, losing the undo stack.

## MC-DEC-20261021-b2c3d4e5 — Decorative defaults depend on attention cost

Status: active
Scope: project
Subject: MC-SUBJ-20261021-c3d4e5f6
Facet: interface
Evidence:
- user-confirmed

Decision:
Indent guides default on; rainbow brackets default off.

Reason:
Guides can be ignored, while multi-colour brackets actively compete for attention.
