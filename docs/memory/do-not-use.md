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
Lists Reload / Save as / Print / Inspect, unrelated to editing. A capture-phase guard runs before bits-ui's handler, so any `stopPropagation` kills every custom menu.

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
Cards float above content and move on their own, so they carry no spatial link to what happened. Three variants failed alike; do not retry.

## MC-DNU-20261009-b2c3d4e5 — No characters that break a parser or console

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: performance
Evidence:
- repo:docs/memory/areas/ui.md

Rejected:
Tag names in Svelte script comments; `/* */` in a template region; a comment's closing marker inside a comment; bullet, not-equal or hamburger glyphs in memory prose.

Reason:
Tag names leave the component unclosed. A template renders `/* */` as text, so it showed in the toolbar. The memory CLI prints to a GBK console and dies on a symbol it cannot encode, so `read` exits non-zero and routing looks broken though memory is valid. Write words, not symbols.

