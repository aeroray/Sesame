# Do Not Use / Tombstones

Rejected options and known failed paths. Check before reintroducing an approach.
Tombstones are newest first.

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
Cards float above content and move on their own, so they carry no spatial link to what just happened. Replaced by the title-bar status line. Three variants already failed in the same direction — keep sonner restyled as a pill, hand-rolled Toaster, neutral background — so do not retry any of them.

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
