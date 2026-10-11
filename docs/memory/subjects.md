# Subject Registry

Subjects provide stable identity for managed decisions, constraints, and rejected approaches.
This registry is protocol metadata and is not part of normal task context.

Entries are newest first.

## MC-SUBJ-20261003-a1b2c3d4 — Sesame stack

Status: active
Kind: concept
Canonical-Ref: feature:sesame-stack
Evidence:
- repo:package.json
- repo:src-tauri/Cargo.toml

Aliases:
- Sesame stack
- build and dependencies

## MC-SUBJ-20261003-b2c3d4e5 — Frontend conventions

Status: active
Kind: concept
Canonical-Ref: feature:sesame-frontend-conventions
Evidence:
- user-confirmed
- repo:src/app.css

Aliases:
- Frontend conventions
- frontend implementation rules

## MC-SUBJ-20261004-f1e2d3c4 — Typography

Status: active
Kind: concept
Canonical-Ref: feature:sesame-typography
Evidence:
- repo:src/app.css
- repo:src/lib/components/dialogs/SettingsDialog.svelte

Aliases:
- Typography
- font settings

## MC-SUBJ-20261005-e1f2a3b4 — Editor gutter and decorations

Status: active
Kind: concept
Canonical-Ref: feature:sesame-editor-gutter
Evidence:
- repo:src/lib/editor/fold-gutter.ts
- repo:src/lib/editor/extensions.ts

Aliases:
- Editor gutter and decorations
- line numbers and fold gutter

## MC-SUBJ-20261007-c1d2e3f4 — Draft backup and session restore

Status: active
Kind: concept
Canonical-Ref: feature:sesame-draft-session
Evidence:
- repo:src-tauri/src/commands/draft.rs
- repo:src-tauri/src/commands/session.rs

Aliases:
- Draft backup and session restore
- draft backup

## MC-SUBJ-20261009-b1c2d3e4 — Native dialog interaction

Status: active
Kind: concept
Canonical-Ref: feature:sesame-native-dialog
Evidence:
- repo:src-tauri/src/lib.rs

Aliases:
- Native dialog interaction
- confirm dialog

## MC-SUBJ-20261011-f1e2d3c4 — Save policy

Status: active
Kind: concept
Canonical-Ref: feature:sesame-save-policy
Evidence:
- repo:src-tauri/src/core/atomic.rs
- repo:src-tauri/src/commands/fs.rs

Aliases:
- Save policy
- atomic write

## MC-SUBJ-20261012-e1f2a3b4 — Operation feedback

Status: active
Kind: concept
Canonical-Ref: feature:sesame-feedback
Evidence:
- repo:src/lib/components/layout/StatusLine.svelte
- repo:src/lib/state/status.svelte.ts

Aliases:
- Operation feedback
- status line

## MC-SUBJ-20261014-a1b2c3d4 — Theming and accents

Status: active
Kind: concept
Canonical-Ref: feature:sesame-theming
Evidence:
- repo:src/lib/theme/theme-tokens.ts

Aliases:
- Theming and accents
- theme system

## MC-SUBJ-20261015-c3d4e5f6 — Style verification method

Status: active
Kind: concept
Canonical-Ref: feature:sesame-style-verification
Evidence:
- user-confirmed

Aliases:
- Style verification method
- browser measurement

## MC-SUBJ-20261016-d4e5f6a7 — Verify scripts and process management

Status: active
Kind: concept
Canonical-Ref: feature:sesame-verify-scripts
Evidence:
- user-confirmed

Aliases:
- Verify scripts and process management
- verify scripts

## MC-SUBJ-20261018-a1b2c3d4 — Shortcut contract

Status: active
Kind: concept
Canonical-Ref: feature:sesame-shortcuts
Evidence:
- repo:src/lib/utils/hotkeys.ts

Aliases:
- Shortcut contract
- keyboard shortcuts

## MC-SUBJ-20261018-e5f6a7b8 — Large files and binary safety

Status: active
Kind: concept
Canonical-Ref: feature:sesame-large-file
Evidence:
- repo:src-tauri/src/core/encoding.rs
- repo:src-tauri/src/commands/fs.rs

Aliases:
- Large files and binary safety
- large file handling

## MC-SUBJ-20261018-f6a7b8c9 — Navigation and security boundary

Status: active
Kind: concept
Canonical-Ref: feature:sesame-navigation-guard
Evidence:
- repo:src-tauri/src/lib.rs

Aliases:
- Navigation and security boundary
- navigation guard

## MC-SUBJ-20261020-a1b2c3d4 — Editor extension assembly

Status: active
Kind: concept
Canonical-Ref: feature:sesame-editor-extensions
Evidence:
- repo:src/lib/editor/extensions.ts

Aliases:
- Editor extension assembly
- editor extensions

## MC-SUBJ-20261020-b2c3d4e5 — Internationalization

Status: active
Kind: concept
Canonical-Ref: feature:sesame-i18n
Evidence:
- repo:src/lib/i18n/messages/en.ts

Aliases:
- Internationalization
- bilingual UI

## MC-SUBJ-20261020-c3d4e5f6 — Platform and app assembly

Status: active
Kind: concept
Canonical-Ref: feature:sesame-platform
Evidence:
- repo:src-tauri/tauri.conf.json
- repo:src/lib/utils/platform.ts

Aliases:
- Platform and app assembly
- platform support

## MC-SUBJ-20261021-b2c3d4e5 — Undo history

Status: active
Kind: concept
Canonical-Ref: feature:sesame-undo-history
Evidence:
- repo:src/lib/editor/create-view.ts

Aliases:
- Undo history
- undo stack

## MC-SUBJ-20261021-c3d4e5f6 — Decorative feature defaults

Status: active
Kind: concept
Canonical-Ref: feature:sesame-decorative-defaults
Evidence:
- user-confirmed

Aliases:
- Decorative feature defaults
- feature defaults

## MC-SUBJ-20261021-d4e5f6a7 — Image viewer

Status: active
Kind: concept
Canonical-Ref: feature:sesame-image-viewer
Evidence:
- repo:src/lib/components/editor/ImageViewer.svelte

Aliases:
- Image viewer
- image preview

## MC-SUBJ-20261110-c5d6e7f8 — File lists

Status: active
Kind: concept
Canonical-Ref: feature:sesame-file-lists
Evidence:
- repo:src/lib/utils/file-icon.ts
- repo:src/lib/components/welcome/WelcomePage.svelte

Aliases:
- File lists
- recents list
- file rows

## MC-SUBJ-20261111-d6e7f8a9 — Tab strip

Status: active
Kind: concept
Canonical-Ref: feature:sesame-tab-strip
Evidence:
- repo:src/lib/components/tabs/TabBar.svelte
- repo:src/lib/state/tabs.svelte.ts

Aliases:
- Tab strip
- tab bar
- tab ordering

## MC-SUBJ-20261111-e7f8a9b0 — Release and auto-update

Status: active
Kind: concept
Canonical-Ref: feature:sesame-release
Evidence:
- repo:.github/workflows/release.yml
- repo:src/lib/state/update.svelte.ts

Aliases:
- Release and auto-update
- release pipeline
- updater

## MC-SUBJ-20261111-f1a2b3c4 — Verification method

Status: active
Kind: concept
Canonical-Ref: feature:sesame-verification
Evidence:
- repo:docs/design/design.md

Aliases:
- Verification method
- how to verify
- probe harness
