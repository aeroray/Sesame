# Area: Theme

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261010-a1b2c3d4 — Theme tokens derived in JS

Status: active
Scope: area:theme
Entry-Type: decision
Subject: MC-SUBJ-20261014-a1b2c3d4
Facet: interface
Evidence:
- repo:src/lib/theme/theme-tokens.ts

Decision:
Derive tokens and write them as inline styles on `<html>`; CSS keeps fallbacks. Accents switch via `data-accent`.

Reason:
Hard-coding them in CSS guarantees someone changes a background and forgets a border.

## MC-AREA-20261010-b2c3d4e5 — Font stacks must name a CJK font

Status: active
Scope: area:theme
Entry-Type: decision
Subject: MC-SUBJ-20261004-f1e2d3c4
Facet: interface
Evidence:
- repo:src/app.css

Decision:
UI and editor fonts fall back to different stacks; both must list a CJK font.

Reason:
Monospace fonts rarely include CJK glyphs, so omitting one puts two fonts on a line.

## MC-AREA-20261010-c3d4e5f6 — app.css state-variant bridge is load-bearing

Status: active
Scope: area:theme
Entry-Type: constraint
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: compatibility
Evidence:
- repo:src/app.css

Constraint:
Keep the `app.css` declarations mapping bits-ui `data-state` onto variants like `data-checked:`.

Reason:
Removing them strips styling from switches and selected states.

## MC-AREA-20261103-d4e5f6a7 — Icon buttons need `bg-clip-border`

Status: active
Scope: area:theme
Entry-Type: decision
Subject: MC-SUBJ-20261015-c3d4e5f6
Facet: interface
Evidence:
- repo:src/lib/components/common/Hint.svelte

Decision:
`Hint` appends `bg-clip-border` to every icon button.

Reason:
Button base has `bg-clip-padding`, so hover fills skip the 1px border ring. Tailwind v4 only emits classes present in source.

## MC-AREA-20261104-e5f6a7b8 — Popover lists use plain overflow

Status: active
Scope: area:theme
Entry-Type: decision
Subject: MC-SUBJ-20261015-c3d4e5f6
Facet: workflow
Evidence:
- repo:src/lib/components/common/EncodingPicker.svelte

Decision:
Popover lists use `overflow-y-auto` + `max-h-*`, never `ScrollArea`. Mark rows: check = current, dot = other.

Reason:
`ScrollArea`'s `size-full` viewport never scrolls under `max-height`. Scroll only when needed.



