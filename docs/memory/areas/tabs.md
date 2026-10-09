# Area: Tab strip

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261111-a1b2c3d4 — New tabs append on the right

Status: active
Scope: area:tabs
Entry-Type: decision
Subject: MC-SUBJ-20261111-d6e7f8a9
Facet: behavior
Evidence:
- repo:src/lib/state/tabs.svelte.ts

Decision:
Every creation path pushes to the end of `tabs.items`; none unshift. Activate via `activateTab`, not by assigning `activeId`.

Reason:
The old `unshift` claimed to match mainstream editors, which is false. It also moved the tab being read one slot over.

## MC-AREA-20261111-b2c3d4e5 — Reorder by pointer events, not HTML5 drag

Status: active
Scope: area:tabs
Entry-Type: decision
Subject: MC-SUBJ-20261111-d6e7f8a9
Facet: architecture
Evidence:
- repo:src/lib/components/tabs/TabBar.svelte

Decision:
Reorder via pointer events with `setPointerCapture`; never `draggable` on a tab. 5px threshold, live reorder by nearest centre, suppress the post-drag click.

Reason:
wry replaces WebView2's drop target when `dragDropEnabled` is on, so in-page HTML5 drag events never fire.

## MC-AREA-20261111-e5f6a7b8 — Verify WebView2 in the app, not Edge

Status: active
Scope: area:tabs
Entry-Type: decision
Subject: MC-SUBJ-20261111-d6e7f8a9
Facet: workflow
Evidence:
- repo:src/lib/components/layout/Shell.svelte

Decision:
`Ctrl+Tab` and `Ctrl+Shift+Tab` cycle tabs, verified working. Test WebView2 keys in the built app, not headless Edge.

Reason:
Edge eats `Ctrl+Tab` for its own tabs, so the shell "proves" a bug that is not there.

## MC-AREA-20261111-d4e5f6a7 — Welcome page stays mounted

Status: active
Scope: area:tabs
Entry-Type: decision
Subject: MC-SUBJ-20261111-d6e7f8a9
Facet: lifecycle
Evidence:
- repo:src/lib/components/tabs/TabBar.svelte

Decision:
The strip's left end holds a welcome button, disabled while that page shows. Display: `tabs.length === 0 || welcome.requested`. Keep welcome page and editors mounted via `class:hidden`.

Reason:
Otherwise opening any file made the recent list unreachable; unmounting discards undo.

