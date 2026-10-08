# Do Not Use / Tombstones

Rejected options and known failed paths. Check before reintroducing an approach.
Tombstones are newest first.

## MC-DNU-20261102-d4e5f6a7 — No native WebView context menu anywhere

Status: active
Scope: project
Subject: MC-SUBJ-20261018-f6a7b8c9
Facet: security
Evidence:
- repo:src/lib/utils/context-menu-guard.ts

Rejected:
Letting the WebView show its own context menu; per-component `oncontextmenu` handlers; a capture-phase guard.

Reason:
Lists Reload / Save as / Print / Inspect, unrelated to editing; Inspect opens DevTools over the UI. Capture phase runs before bits-ui's handler, so any `stopPropagation` kills every custom menu.

## MC-DNU-20261009-a1b2c3d4 — No toast for operation feedback

Status: active
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: adoption-policy
Evidence:
- repo:src/lib/state/status.svelte.ts

Rejected:
`toast` / `svelte-sonner` and hand-rolled replacements.

Reason:
Cards float above content and move on their own, so they carry no spatial link to what just happened. Replaced by the title-bar status line. Three variants already failed the same way — restyled sonner pill, hand-rolled Toaster, neutral background — do not retry.

## MC-DNU-20261009-b2c3d4e5 — No tag names in script comments

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: performance
Evidence:
- repo:docs/design/design.md

Rejected:
Writing angle-bracket tag names inside Svelte script comments.

Reason:
The parser treats them as real tags, reports left open, and the whole component fails to compile.
