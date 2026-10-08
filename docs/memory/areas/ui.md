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
Informational feedback shows one line in the title-bar centre and auto-dismisses; decisions use a dialog.

## MC-AREA-20261009-b2c3d4e5 — Window skeleton

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: workflow
Evidence:
- repo:src/lib/components/layout/Shell.svelte

Decision:
Title bar, tab strip, editor area; sidebar collapsed by default (Ctrl+B). Window title is `Sesame` with no file open, else the active tab's name plus a dot when dirty.

## MC-AREA-20261102-c3d4e5f6 — Menus split by owner

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: architecture
Evidence:
- repo:src/lib/components/layout/TitleBar.svelte

Decision:
Settings is a title-bar gear, not a hamburger. File actions to the tab menu, text actions to the editor menu, reopen-closed to the tab strip. Every title-bar button carries a tooltip.

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

## MC-AREA-20261009-f6a7b8c9 — File rows in lists

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261110-c5d6e7f8
Facet: lifecycle
Evidence:
- repo:src/lib/utils/file-icon.ts

Decision:
Icons come from `fileIcon(kind, language)` everywhere, fields from the backend; Markdown must not share plain text's icon. Recents rows open one shared context menu; the welcome page shows two path segments, the sidebar none.

## MC-AREA-20261011-a1b2c3d4 — Image toolbar: grouped, no reflow

Status: active
Scope: area:ui
Entry-Type: decision
Subject: MC-SUBJ-20261021-d4e5f6a7
Facet: behavior
Evidence:
- repo:src/lib/components/editor/ImageViewer.svelte

Decision:
Four groups split by 1px rules: zoom | view mode | rotate/flip/reset | external. Buttons keep their place in all states; dirty follows the result, not the click.
