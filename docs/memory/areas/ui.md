# Area: UI

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261009-a1b2c3d4 — Title-bar feedback, not toasts

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: interface
Evidence:
- repo:src/lib/state/status.svelte.ts

Decision:
Informational feedback shows one line in the title-bar centre and auto-dismisses; decisions use a native dialog.

Reason:
See `do-not-use.md`.

## MC-AREA-20261009-b2c3d4e5 — Window skeleton

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: workflow
Evidence:
- repo:src/lib/components/layout/Shell.svelte

Decision:
Title bar, tab strip, editor area; sidebar collapsed by default (Ctrl+B).

Reason:
Three compact rows express the lightweight positioning.

## MC-AREA-20261102-c3d4e5f6 — Menus split by owner

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: architecture
Evidence:
- repo:src/lib/components/layout/AppMenu.svelte

Decision:
Hamburger holds app-level items only. File actions go to the tab menu, text actions to the editor menu, reopen-closed to the tab strip, version to Settings > About.

Reason:
One flat list mixed three ownerships.

## MC-AREA-20261009-e5f6a7b8 — Dialogs return button text

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261009-b1c2d3e4
Facet: interface
Evidence:
- repo:src/lib/utils/hotkeys.ts

Decision:
`message()` with custom buttons returns the button text itself. Match punctuation shortcuts on `event.code`.

Reason:
Input methods rewrite `event.key`.

## MC-AREA-20261009-f6a7b8c9 — Toggles and hover action columns

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: lifecycle
Evidence:
- repo:src/lib/components/layout/Sidebar.svelte

Decision:
Active toggles differ by text colour only, icon unchanged. Hover actions overlap neighbouring info via `opacity`.

Reason:
A swapped icon makes one toggle look like two features.

## MC-AREA-20261011-a1b2c3d4 — `leading-none` between icon buttons

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261021-d4e5f6a7
Facet: behavior
Evidence:
- repo:src/lib/components/editor/ImageViewer.svelte

Decision:
Plain text between icon buttons needs `leading-none` to align.

Reason:
Centring acts on the line box: at 1.5 line-height CJK ink sits 1px high.
