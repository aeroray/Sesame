# Project Brief

Purpose:
- Sesame is a lightweight desktop text editor and file viewer: fast to open, small footprint, handles large files and multiple encodings.
- Audience: developers who want to glance at or lightly edit text, code, and config files without launching a heavy IDE.
- Windows and macOS only; UI in Simplified Chinese and English.

Current direction:
- All planned features are complete and verified on real hardware: editing, tabs, sidebar, settings, themes, Markdown preview, find and replace, chunked large files, image viewer, session restore, autosave, draft backup, bilingual UI.
- Appearance rules live in `docs/design/design.md`; subsystem memory lives in `docs/memory/areas/`.

System shape:
- Tauri 2 shell + Svelte 5 + Vite single-page frontend, Tailwind v4 CSS-first, components from shadcn-svelte and bits-ui.
- Editor is CodeMirror 6; tabs hold either `text` or `image`.
- Encoding: new files UTF-8; open detects and saves write back the original encoding. Files over 5 MB load a prefix only, and saving splices the on-disk tail back.
- Three save layers: explicit save, autosave, draft backup; all use atomic writes.
- Persistence is split four ways: settings via `tauri-plugin-store`; recent files, session, and drafts each stored as JSON by the Rust side.
- Feedback uses the title-bar status line, not toasts. Rust is layered as `commands` / `core` / `model`.

Verification:
- 61 Rust unit tests pass; `svelte-check` reports zero errors; initial JS is about 277 KB gzipped.
- Real-hardware checks cover save conflicts, read-only binaries, repeated saves of large files, deep-sleep round trips, session and draft restore, and language switching.
- Windows verified; macOS expected to work but not tested on real hardware.
