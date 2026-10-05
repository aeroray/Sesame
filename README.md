<div align="center">

<img src="src-tauri/icons/128x128@2x.png" alt="Sesame" width="112" />

# Sesame

**A fast, lightweight text editor and file viewer for the desktop.**

Opens instantly, stays out of the way, and handles the files other editors choke on —
huge logs, GBK-encoded configs, a stray PNG you just want to look at.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](#install)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB.svg)](https://tauri.app)
[![Binary size](https://img.shields.io/badge/binary-3.8%20MB-brightgreen.svg)](#why-it-stays-small)

[English](README.md) · [简体中文](README.zh-CN.md)

<img src="docs/assets/screenshot.png" alt="Sesame showing a Rust file with syntax highlighting" width="820" />

</div>

---

## Why Sesame

Most text editors make you choose between a toy that can't open your logs and an IDE
that takes four seconds to start. Sesame is for the third case: you want to **look at a
file, or change three lines in it**, right now.

- **It opens.** No splash screen, no project indexing, no "loading workspace".
- **It doesn't lose your work.** Every save is atomic, and unsaved edits are backed up
  continuously — a crash or a force-quit won't cost you anything.
- **It doesn't corrupt your files.** The encoding, line endings and BOM you opened with
  are the ones written back. Binary files are refused, not mangled.
- **It handles files that don't fit in memory.** Files over 5 MB are read in 1 MB
  chunks, and saving streams the untouched tail straight from disk instead of pulling
  it into memory. Saving is capped at 256 MB per write.

## Features

| | |
| --- | --- |
| **Syntax highlighting** | 18 languages via CodeMirror 6, loaded lazily — they cost nothing until you open one |
| **Large files** | Files over 5 MB load in 1 MB chunks; saving streams the untouched tail back from disk instead of reading it into memory (writes capped at 256 MB) |
| **Encodings** | Detected on open (BOM → strict UTF-8 → GBK, including UTF-16 via BOM) and written back exactly as found. Detection isn't perfect — click the encoding in the status bar to reopen with a different one |
| **Line endings** | LF, CRLF and CR preserved per file — no silent conversion |
| **Safety net** | Atomic writes, external-modification detection, autosave, and always-on draft backup for untitled buffers |
| **Multi-tab** | Drag to reorder, per-tab cursor and scroll position, session restore on relaunch, reopen a closed tab with `Ctrl+Shift+T` |
| **Markdown preview** | Rendered and sanitized with DOMPurify; external links open in your browser, not inside the app |
| **Image viewer** | Zoom, fit-to-window, 1:1, open in default app |
| **Find & replace** | Regex, case-sensitive, whole-word and cross-line search, with replace |
| **Indent guides** | Faint vertical rules at each indent level; toggle in settings |
| **Memory-friendly** | Tabs you haven't touched release their editor instances after a while, and restore instantly when you come back |
| **Theming** | Light/dark/system, four accent colors, and separately configurable UI and editor fonts |
| **Interface language** | English and Simplified Chinese, following your system language by default |

### Why it stays small

The shipped binary is about **3.8 MB**. Sesame uses the operating system's own webview
(WebView2 on Windows, WKWebView on macOS) rather than bundling a browser engine — which
is also why it starts as fast as it does.

### Platform support

**Windows and macOS only.** Both are supported by the same codebase; the differences are
handled in `src/lib/utils/platform.ts`.

Linux is not a target. The window chrome, file associations and packaging formats differ
across desktop environments there, and the maintenance cost outweighed the benefit for a
project of this size.

## Install

> **Status: early.** Version 0.1.0 is functional and has been tested on Windows, but
> prebuilt installers are not published yet. Building from source takes a few minutes.

### Build from source

**Prerequisites**

- [Rust](https://rustup.rs) 1.90 or newer
- [Node.js](https://nodejs.org) 20 or newer, with [pnpm](https://pnpm.io)
- Your platform's Tauri dependencies — see the
  [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/). On Windows
  this means the **C++ Build Tools** and **WebView2** (preinstalled on Windows 11).
  On macOS you need Xcode Command Line Tools; WKWebView is part of the system.

> **Windows is the tested platform.** The macOS build is expected to work — the only
> platform-specific code is the title bar and the Cmd-key handling — but it has not been
> verified on real hardware. If you build it on a Mac, please report what you find.

**Build**

```sh
git clone https://github.com/OWNER/sesame.git
cd sesame
pnpm install
pnpm tauri build
```

The installer lands in `src-tauri/target/release/bundle/`.

**Run in development**

```sh
pnpm tauri dev
```

## Usage

Open a file any of four ways:

- **Ctrl+O** — file dialog
- **Drag and drop** it onto the window
- **Pass it on the command line** — `sesame notes.md`
- **Double-click** it, if you registered Sesame as the handler during install

### Keyboard shortcuts

App-level:

| Action | Shortcut |
| --- | --- |
| New tab / Open / Save / Save as | `Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S` |
| Close tab | `Ctrl+W` |
| Reopen closed tab | `Ctrl+Shift+T` |
| Copy file path | `Ctrl+Shift+C` |
| Toggle sidebar | `Ctrl+B` |
| Markdown preview | `Ctrl+Shift+M` |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Settings / Shortcuts | `Ctrl+,` / `Ctrl+/` |

In the editor:

| Action | Shortcut |
| --- | --- |
| Find / Find next | `Ctrl+F` / `Ctrl+G` |
| Select all matches | `Ctrl+Shift+L` |
| Go to line | `Ctrl+Alt+G` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |
| Toggle line comment | `Ctrl+/` |
| Indent / outdent | `Ctrl+]` / `Ctrl+[` |
| Move line up / down | `Alt+↑` / `Alt+↓` |
| Copy line up / down | `Shift+Alt+↑` / `Shift+Alt+↓` |

Press **Ctrl+/** in the app for the same list.

### Opening files from your file manager

Sesame runs as a **single instance**: opening a second file hands it to the window that is
already running rather than starting another copy. Two processes writing the same settings
and session files would overwrite each other's state.

### Your edits are protected in three layers

1. **Manual save** (`Ctrl+S`) — writes back to the original file.
2. **Autosave** (optional) — debounced write-back for files that have a path.
3. **Draft backup** (always on) — unsaved content is written to the app data directory,
   including untitled buffers. Restored silently on next launch.

Saves are atomic: content goes to a temporary file in the same directory, is flushed to
disk, and only then replaces the original. An interrupted save leaves the previous
version intact rather than a half-written file.

If the file changed on disk since you opened it, Sesame tells you and offers to
**overwrite**, **reload from disk**, or **save as** — it will not silently discard
someone else's changes.

## Configuration

Settings are stored in your platform's app data directory:

| Platform | Location |
| --- | --- |
| Windows | `%APPDATA%\com.sesame.app\` |
| macOS | `~/Library/Application Support/com.sesame.app/` |
| Linux | `~/.local/share/com.sesame.app/` |

`settings.json` holds preferences; `recent.json`, `session.json` and `drafts/` are
managed separately so that clearing your recent-files list never touches your session
or your unsaved work.

## Tech stack

| Layer | Choice |
| --- | --- |
| Shell | [Tauri 2](https://tauri.app) (Rust) |
| UI | [Svelte 5](https://svelte.dev) with runes — no SvelteKit, no SSR, no router |
| Build | [Vite](https://vite.dev) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) (CSS-first config) |
| Components | [shadcn-svelte](https://shadcn-svelte.com) + [bits-ui](https://bits-ui.com) |
| Editor | [CodeMirror 6](https://codemirror.net) |
| Markdown | [marked](https://marked.js.org) + [DOMPurify](https://github.com/cure53/DOMPurify) |

All file I/O, encoding conversion, language detection and path normalization happen in
Rust; the frontend only passes strings across the IPC boundary.

## Development

```sh
pnpm install        # install dependencies
pnpm tauri dev      # run the app with hot reload
pnpm check          # type-check (svelte-check)
pnpm lint           # lint and format check (Biome)
cargo test --lib    # run the Rust unit tests, from src-tauri/
```

Project documentation lives in [`docs/`](docs/):

- [`docs/design/design.md`](docs/design/design.md) — the single source of truth for
  anything visual. Read this before changing UI.
- [`docs/memory/`](docs/memory/) — architecture decisions, constraints, and project brief.

## Contributing

Issues and pull requests are welcome. Before opening a PR:

1. Run `pnpm check`, `pnpm lint` and `cargo test --lib` — all three should be clean.
2. If your change affects appearance, read `docs/design/design.md` first and follow it.
3. Keep the UI text concise and in Chinese; keep code comments in Chinese to match the
   existing codebase.

## License

[MIT](LICENSE) © Sesame contributors
