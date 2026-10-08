# Area: Data

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261008-a1b2c3d4 — All saves are atomic

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261011-f1e2d3c4
Facet: security
Evidence:
- repo:src-tauri/src/core/atomic.rs

Decision:
Save via temp file, fsync, rename. Re-check the external-modification fingerprint first and offer three exits on conflict.

Reason:
Overwriting in place leaves a truncated file if power fails.

## MC-AREA-20261008-b2c3d4e5 — Three save layers plus draft and session

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261007-c1d2e3f4
Facet: behavior
Evidence:
- repo:src-tauri/src/commands/draft.rs

Decision:
Explicit save, then autosave, then always-on draft backup. Close through `onCloseRequested` and flush drafts first.

Reason:
Untitled tabs survive only through drafts, and `beforeunload` cannot block a Tauri close.

## MC-AREA-20261008-c3d4e5f6 — Encoding detection with manual override

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261018-e5f6a7b8
Facet: data-model
Evidence:
- repo:src-tauri/src/core/encoding.rs

Decision:
Detect BOM, then UTF-8, then GBK on open, and write back the original encoding. Let users correct it from the status bar.

Reason:
Detection cannot always be right, and a status-bar entry beats asking users to reopen the file.

## MC-AREA-20261008-e5f6a7b8 — State layer and IPC boundary

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: architecture
Evidence:
- repo:src/lib/ipc/fs.ts

Decision:
The state layer must not depend on the actions layer. Path, encoding, and all IO live in Rust.

Reason:
Inverted dependencies make the state layer untestable in isolation.

## MC-AREA-20261106-a7b8c9d0 — Image save-as and wallpaper

Status: active
Scope: area:data
Entry-Type: decision
Subject: MC-SUBJ-20261018-f6a7b8c9
Facet: workflow
Evidence:
- repo:src-tauri/src/core/wallpaper.rs

Decision:
`save_image_as` copies bytes via `atomic::write_bytes`, never re-encoding. `set_as_wallpaper` (Windows only) converts to BMP via .NET, keeping the temp file.

Reason:
Re-encoding drops EXIF. `SPI_SETDESKWALLPAPER` ignores non-BMP silently; deleting the BMP reverts the wallpaper.
