# Area: Editor

Memory here applies only when touched files or task scope match this area.

## MC-AREA-20261007-a1b2c3d4 — Line-number and fold gutter

Status: active
Scope: area:editor
Entry-Type: decision
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- repo:src/lib/editor/fold-gutter.ts

Decision:
Centre line numbers with flex, not the default line box. Draw fold markers as SVG chevrons. Toggle both together.

Reason:
Line numbers use a 1px smaller font, so their line box is shorter than the cell and sits high.

## MC-AREA-20261007-b2c3d4e5 — Editor assembly and panel alignment

Status: active
Scope: area:editor
Entry-Type: decision
Subject: MC-SUBJ-20261020-a1b2c3d4
Facet: architecture
Evidence:
- repo:src/lib/editor/extensions.ts

Decision:
Assemble extensions by hand in Compartments. Keep the `EditorView` and document text out of reactive state. Centre the search panel with flex.

Reason:
Hand assembly is what makes per-setting hot reconfiguration possible.

## MC-AREA-20261007-d4e5f6a7 — Large files and deep sleep

Status: active
Scope: area:editor
Entry-Type: decision
Subject: MC-SUBJ-20261018-e5f6a7b8
Facet: performance
Evidence:
- repo:src/lib/editor/large-file.svelte.ts

Decision:
Over 5 MB load a prefix only; chunked appends must not mark the tab dirty. Deep sleep runs take-text, `detachView`, write-back, in that order.

Reason:
Reversing the order deletes the text just saved.

## MC-AREA-20261007-e5f6a7b8 — Image viewer: true-size layout and transforms

Status: active
Scope: area:editor
Entry-Type: decision
Subject: MC-SUBJ-20261021-d4e5f6a7
Facet: interface
Evidence:
- repo:src/lib/components/editor/ImageViewer.svelte

Decision:
Fit to window by default via `ResizeObserver`. Rotate/flip redraw pixels on a canvas; keep `(turns, flipH, flipV)`.

Reason:
CSS `transform` changes only the display, so the box keeps its old size and edges cannot be scrolled to.

## MC-AREA-20261105-f6a7b8c9 — Image clipboard goes through canvas

Status: active
Scope: area:editor
Entry-Type: decision
Subject: MC-SUBJ-20261021-d4e5f6a7
Facet: compatibility
Evidence:
- repo:src/lib/utils/clipboard.ts

Decision:
Draw the data URL to a canvas, read `getImageData`, then `Image.new` and `image.close()`.

Reason:
`writeImage`'s path/bytes branches need tauri's `image-png` / `image-ico` features, which are off.


