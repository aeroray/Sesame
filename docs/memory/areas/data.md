# Area: Data

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261008-a1b2c3d4 — Saves are atomic and re-checked

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261011-f1e2d3c4
Facet: security
Evidence:
- repo:src-tauri/src/commands/fs.rs

Decision:
Temp file, fsync, rename, fingerprint re-checked first; a truncated save re-checks even when forced.

Reason:
A splice offset only fits the file it was measured on.

## MC-AREA-20261008-b2c3d4e5 — Three save layers plus draft and session

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261007-c1d2e3f4
Facet: behavior
Evidence:
- repo:src/lib/actions/save-file.ts

Decision:
Explicit save, autosave, then draft backup. A silent save never opens a dialog and stays dirty.

Reason:
Background persistence must not steal focus.

## MC-AREA-20261008-c3d4e5f6 — Encoding detection with manual override

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261018-e5f6a7b8
Facet: data-model
Evidence:
- repo:src-tauri/src/core/encoding.rs

Decision:
Detect BOM, then UTF-8, then GBK, writing back the original encoding.

Reason:
Detection cannot always be right.

## MC-AREA-20261008-e5f6a7b8 — State layer and IPC boundary

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: architecture
Evidence:
- repo:src/lib/ipc/fs.ts

Decision:
The state layer must not depend on the actions layer; IO lives in Rust.

Reason:
Inverted dependencies make the state layer untestable alone.

## MC-AREA-20261106-a7b8c9d0 — Image write paths

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261018-f6a7b8c9
Facet: workflow
Evidence:
- repo:src/lib/actions/save-image.ts
- repo:src-tauri/src/core/wallpaper.rs

Decision:
`save_image_as` copies bytes, never re-encoding; `saveTab` routes images to `saveImage`. Wallpaper converts to BMP and keeps the temp file.

Reason:
`saveTab` rejects images, and the wallpaper API ignores non-BMP silently.

## MC-AREA-20261020-d4e5f6a7 — Settings stay in Rust

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261018-f6a7b8c9
Facet: architecture
Evidence:
- repo:src-tauri/src/commands/settings.rs

Decision:
Read and write `settings.json` through a Rust command; never grant `store:*`.

Reason:
That plugin cannot scope its path.
