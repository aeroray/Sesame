# Sesame Design Spec

Sole authority for Sesame's appearance. Read before any UI change; do not start a second set of rules inside components.

Scope: all UI under `src/`. Constraints: [../memory/constraints.md](../memory/constraints.md). Decisions: [../memory/decisions.md](../memory/decisions.md).

---

## 1. Design positioning

Lightweight text editor, not an IDE. Three claims:

1. **Content first** — UI yields to text. No decorative illustrations, gradient backgrounds, or large rounded cards.
2. **Compact** — desktop density, above web. Line height and padding take the minimum that stays legible.
3. **Quiet** — exactly one accent colour, only for active state, focus, and progress. Everything else neutral greyscale.

### Supported platforms

**Windows and macOS only.** Detection centralised in [`../src/lib/utils/platform.ts`](../../src/lib/utils/platform.ts).

No Linux target: traffic lights, file associations, and packaging differ per desktop environment; cost exceeds benefit. **Do not add Linux branches or conditional compilation in UI code.**

### UI languages

**Simplified Chinese and English**, default follows system. Implementation: [`../src/lib/i18n/`](../../src/lib/i18n/).

Copy style: buttons use verb phrases (新建文件, not 点击此处新建文件); status uses noun phrases (就绪, 大文件模式). No politeness filler such as 请 or 您可以.

## 2. Colour

All colour in **oklch**, never hex — matching L across light/dark holds contrast automatically.

### 2.1 Two token layers

| Layer | Naming | Use |
| --- | --- | --- |
| shadcn standard tokens | `--background` `--primary` `--muted` `--border` `--ring` … | **Used inside the component library**; do not reference by hand |
| Own semantic tokens | `--surface` `--content` `--border-subtle` `--border-strong` | **Used by business components**; see below |

shadcn components (`src/lib/components/ui/`) reference layer 1; business code using layer 1 would inherit business styles when the library theme is swapped.

### 2.2 Own semantic tokens (business components use only this set)

| Token | Use | Light | Dark |
| --- | --- | --- | --- |
| `--surface` | main background | `oklch(0.99 0.002 65)` | `oklch(0.19 0.006 60)` |
| `--surface-raised` | raised surface (dialogs, cards) | `oklch(1 0 0)` | `oklch(0.23 0.007 60)` |
| `--surface-sunken` | sunken surface (title bar, tab bar, status bar) | `oklch(0.96 0.003 65)` | `oklch(0.16 0.005 60)` |
| `--border-subtle` | ordinary dividers | `oklch(0.91 0.004 65)` | `oklch(0.29 0.007 60)` |
| `--border-strong` | edges needing emphasis, scrollbars | `oklch(0.84 0.006 65)` | `oklch(0.37 0.008 60)` |
| `--content` | body text | `oklch(0.22 0.008 60)` | `oklch(0.93 0.004 65)` |
| `--content-muted` | secondary text | `oklch(0.5 0.008 60)` | `oklch(0.68 0.007 65)` |
| `--content-faint` | weakest hints (placeholders, timestamps) | `oklch(0.65 0.006 60)` | `oklch(0.52 0.006 65)` |

Tailwind utilities: `bg-surface` `text-content` `border-border-subtle`, etc.

### 2.3 Theme (skin) system

**A colour scheme is a whole theme, not one "accent colour".**

Rejected: light/dark + switchable accent — accent and editor colours were unrelated systems ("pine green" made buttons green while editor keywords stayed warm brown). Use the mature-editor (VS Code / Sublime / JetBrains) **theme model**: one theme fixes UI colours, editor colours and syntax highlighting together.

#### Single source of truth: 4 base colours + derivation

30+ tokens × 13 themes = 400 hand-written numbers: unmaintainable, and guarantees "changed the background, forgot the border".

Each theme declares only **4 base colours** (`bg` / `fg` / `accent` / `accentFg`); the rest derive in [`theme-tokens.ts`](../../src/lib/theme/theme-tokens.ts) via `color-mix()` at fixed ratios:

| Derivation target | Method |
| --- | --- |
| Raised surface / sunken surface / card | Blend background toward white or black |
| Secondary / weakest body text | Retire foreground toward the **background** colour |
| Three border levels | Same, at lower ratios |
| Accent 10-step scale | Blend accent toward white or black |

**Light and dark run opposite directions** — light "raised = whiter", dark "raised = lighter" — on the same ratio set, so contrast holds by construction.

#### Syntax highlighting comes from community packages, never hand-picked

Use `@uiw/codemirror-theme-*` directly (MIT, updated 2026-09). Hand-colouring 13 themes × 20 syntax tags is error-prone and cannot match what users see for the same-named theme elsewhere — "Dracula" must look like the familiar Dracula.

13 built in: Sesame Light / Dark, Dracula, Monokai, One Dark, Nord, Tokyo Night, GitHub Light / Dark, Solarized Light / Dark, VS Code Light / Dark.

**Measured values match the official specs bit for bit** (Dracula background `#282a36`, keyword `#ff79c6`, string `#f1fa8c`; pixel-level colour difference 0).

Two upstream deviations **deliberately kept** — matching other tools beats matching the spec documents:

- Dracula `propertyName` `#66d9ef`, not in the official palette; `number` undefined.
- Nord foreground pure white `#FFFFFF`; spec is nord4 `#d8dee9`.

#### Theme picker: thumbnail code preview + light/dark grouping

**Never express a theme as "swatch + name".** Rejected: background + accent swatches — Dracula and Monokai are both dark purple and indistinguishable as swatches.

[`ThemeThumbnail.svelte`](../../src/lib/components/common/ThemeThumbnail.svelte) draws short lines in the theme's **real syntax colours** (keyword, string, function, type, comment).

- **Colours must equal the real editor's**: from `ThemeDefinition.preview`, same values as the theme's `editor.styles`.
- **Line widths deliberately irregular** — equal-length lines look like a barcode; "word length" looks like code.

**Group by light / dark** — 13 flat themes make a long, hard-to-scan list. In-group order = `THEMES` order.

#### Dialogs must have a height cap, or content overflows the window

`dialog-content` defaults to `grid` with no height limit. The 13-theme preview list grew content past the window and cut the bottom "restore defaults" / "done" buttons off outside it (**measured; users cannot reach them**).

Fix — all three parts required:

```svelte
<DialogContent
  class="sm:max-w-3xl h-[34rem] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]"
>
  <DialogHeader />
  <div class="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">…</div>
  <DialogFooter />
</DialogContent>
```

1. **Fixed height `h-[34rem]`, not `max-h-*`.** `max-h` follows content — tall on "Appearance" (13 themes), short on "General" (one item) — so **the whole window jumps on every switch**. Measured difference between the two pages: **0 px**.
2. **The `0` in `minmax(0, 1fr)`**: without it a grid item's min-height is its content height, so content stretches the scroll area and `overflow` stops working.
3. **Write `overflow-x-hidden` explicitly**: `overflow-y: auto` only implies "x is visible", and visible mixed with auto makes the browser compute x as auto — slightly over-wide content then yields a horizontal scrollbar. The scroll container also needs `min-w-0`, else a flex item's min-width is its content width and bursts the container.

#### Width overrides need the `sm:` prefix

`dialog-content` defaults include `sm:max-w-sm`, and **`sm:` variant rules come after unprefixed rules**, so a bare `max-w-3xl` is overridden — measured: dialog pinned at 24rem, left category column squeezed the right content to nothing, "interface font" wrapped into vertical text. Write `sm:max-w-3xl`.

#### Gutter divider: theme packages miss it, so we must backstop it

CodeMirror's default theme draws the gutter line via `&light .cm-gutters` / `&.cm-gutters-before { borderRightWidth: 1px }` — **more specific** than a bare `.cm-gutters`, so `border: none` cannot override.

Theme packages handle it **inconsistently** (measured by reading every source file):

| Sets `gutterBorder: transparent` | Does not (default line shows through) |
| --- | --- |
| Dracula, Monokai, Solarized, One Dark, VS Code, Tokyo Night | **Nord, GitHub** |

Suppression therefore lives in `sesameUiTheme` (`baseTheme`, theme-independent) as a single backstop.

> Lost once when switching to theme packages — it lived in the deleted `lightUi` / `darkUi` and was not carried over. **Any "theme-independent" editor style belongs in `baseTheme`, not a specific theme**, so migrations cannot drop it.

#### Every in-theme decoration must follow the theme

**Every coloured editor decoration must take its colour from the theme**, or it becomes the one jarring element after a theme switch.

Same trap hit twice:

| Decoration | Original problem | Now |
| --- | --- | --- |
| Matching-bracket background | Hardcoded warm beige, off-theme | `var(--match-bracket)` (theme accent) |
| Rainbow brackets, 3 levels | Hardcoded blue/green/orange, unchanged across themes | `var(--rainbow-0/1/2)` (theme syntax colours) |
| Indent guides | Hardcoded greys | `var(--indent-guide)` |

Rainbow bracket colours come from **each theme's syntax palette** (Dracula: `#bd93f9` / `#50fa7b` / `#ffb86c`).

Test: **a decoration whose colour is absent from `theme-tokens.ts` output has been missed.**

#### Accent scale: single direction, shared by light and dark

The 10 accent levels (selected background, hover, focus ring, buttons) **derive proportionally from `accent`** — 10 fewer hand-written values per theme.

**1. `weight` is the accent share, not the blended white/black share.**

```js
mix(accent, 'white', 8)   // → color-mix(accent 8%, white) = very pale
mix(accent, 'white', 96)  // → color-mix(accent 96%, white) = almost solid
```

Level 50 as `weight: 96`, read as "96% white", made `--brand-50` almost solid accent — measured luminance gap from a white background 0.855 vs 0.871 for the densest 500 — so the settings panel's selected item became **a solid block of colour**.

**2. One scale only: 50 lightest → 900 darkest, shared by light and dark.** No second, reversed scale for dark.

```
bg-brand-100 text-brand-900  dark:bg-brand-900/40 dark:text-brand-100
```

Light = pale background, dark text; dark = **dark background, light text**; both **same direction**. A reversed dark scale makes `brand-900` a pale pastel, `dark:bg-brand-900/40` no longer a dark background, and the selected state glow harshly.

Dark's "pale" semantics (`--accent`) come from `brand-900` + opacity. Scale in `:root` (single direction); `.dark` only **semantic remapping**, never redefines the scale.

#### `--primary` must not be `accent` directly

`accent` is a theme's most representative colour but not necessarily fit for "filled-button background + white text". Measured: **Solarized Light** `#268bd2` on white text is **3.41** contrast, below WCAG AA's 4.5.

`--primary` takes a point on the scale:

| Mode | Value | Rationale |
| --- | --- | --- |
| Light | `brand-600` (one step darker than accent) | White text legible; Solarized Light 3.41 → **4.73** |
| Dark | `brand-500` (i.e. accent itself) | Preserves theme identity; the paler 400 turns the button into a slab of grey-white and Dracula becomes indistinguishable from Monokai |

Button text and selected-item text contrast is **≥ 4.5 for all 13 themes**.

#### Verification: measure contrast, do not trust the eye

The eye cannot tell 3.41 from 4.5.

- **Let the browser resolve `color-mix`, then normalise.** In `style.color`, `getComputedStyle` returns `oklab(...)`, **not** `rgb(...)`, so regex-matching rgb misses everything (the first probe failed here). Use canvas: `ctx.fillStyle = <any CSS colour>`, then `getImageData` — guaranteed sRGB components, no oklab→sRGB conversion to write.
- **Write criteria semantically, not by level number.** "50 must be closer to the background than 500" assumes a light theme; dark backgrounds make 900 closest. Test: scale **monotonic**, selected background **pale enough**, button / selected-item text **contrast meets the threshold**.

#### Status bar and large-file banner

Every status bar item needs a hover tooltip describing **what happens on click**:

| Item | Tooltip |
| --- | --- |
| Line N / Column M | Cursor position (line · column) |
| Language | File language |
| Encoding | Choose text encoding… |
| Line endings | Line ending style |

- **A tooltip must not hang on only half an item.** Line/column split into two `<span>`s left `title` only on "line", so hovering "column" showed nothing; the language item was missed too. One `span` for the whole item, or every `span` gets one.
- **The tooltip describes the click's result, not the action.** Encoding read "reopen with the specified encoding…", but clicking **first opens a picker** and the user chooses again. Use "Choose text encoding…".

Large-file banner's two buttons each get a semantically matching icon:

| Button | Icon | Rationale |
| --- | --- | --- |
| Continue loading | `Plus` | "Add another chunk", matching the chunked-loading mechanism |
| Load all | `ChevronsDown` | All the way at once |

Rejected: `ChevronsDown` for "continue loading" — reads as "scroll to the very bottom", a jump rather than a load.

#### Shortcut hints must go through `formatKeys()`

On macOS the key is Cmd and `formatKeys()` renders `⌘`; **hardcoded `Ctrl+` shows macOS users hints that do not match reality** (three occurrences in the app menu).

The shortcut panel must match actual bindings **one-to-one**: `Ctrl+Shift+T` (reopen closed) and `Ctrl+Shift+C` (copy path) were registered but unlisted — an omission implies the feature does not exist.

#### Verification: render pure presentational components straight in the browser

`LargeFileBanner` and `StatusBar` are "props in, DOM out" and **need no Tauri runtime**: `mount()` onto a plain `div`, render in headless Edge with several typical datasets, export DOM text, `title` attributes and icon class names — faster than launching the app, easier to cover edge states.

Caught: the new `editor.language` key did not exist and rendered as the literal `editor.language` (also caught by `svelte-check`).

> `host.querySelector('div')` returns the **outer wrapper**, not the component root — measures `rgba(0,0,0,0)`, misdiagnosed as "the theme colour is not applied". Take the target container's `firstElementChild`.

#### Size cost

13 themes incl. syntax highlighting: **3.6 KB gzip** net. CSS shrank 0.5 KB — the near-duplicate light/dark editor styles (nearly 500 lines) merged into one, colours moved to CSS variables.

### 2.4 Colour usage rules

- **Restraint**: accent only for the active tab's top indicator bar, unsaved dot, focus ring, `primary` button, sidebar active item background, welcome-page brand block, large-file banner. No accent background on ordinary cards or list items.
- **The large-file banner is the only large-area accent** — "file not fully loaded" must be noticed and deserves the weight. Any other new full-bar / full-block background must be discussed first.
- **Status colours only for status**: `--destructive` only for the close button's hover and errors, never decorative.
- **No hex or `rgb()` inside components.** New colour → add a token first.
- **A new theme needs only 4 colour values**: add an entry in `lib/theme/palettes.ts`.

#### The accent must **actually appear** in the UI

A correct token chain does **not** equal the user seeing the theme colour. Measured: under Dracula a full screenshot held only **80 pixels** of accent `#bd93f9` (the 2px active-tab underline) — tokens all resolved, but the welcome page's two buttons were `variant="outline"` (neutral grey) and the brand block `bg-brand-100` (extremely pale), so **the landing page showed no theme colour at all**.

- **Welcome-page brand block fills with `bg-primary`**, not a pale background — the landing page's most prominent element, the theme's first manifestation.
- **Every page has at least one `primary` filled button.** The welcome page's "open file" is the primary action — `variant="default"`; secondary actions `outline`.
- After changing theme-related styles, **count accent-coloured pixels in a screenshot**, do not verify token resolution. 80 → about 3700 after the fix.

### 2.5 Input control contrast requirements

`--input` in dark mode must be **clearly brighter than the background** (currently `oklch(0.42 0.008 60)`, background `0.16`).

Rejected: `--input` at `oklch(0.32)` — settings-panel toggles nearly invisible in dark mode, fill and background differing by little luminance. **Every new toggle, slider, or text input must be visually confirmed in dark mode.**

---

## 3. Typography

```css
--font-sans: 'Inter', -apple-system, 'Segoe UI', 'PingFang SC',
             'Microsoft YaHei', 'Source Han Sans SC', sans-serif;
--font-mono: 'JetBrains Mono', 'Cascadia Code', 'SF Mono', Consolas, monospace;
```

Chinese fonts must explicitly list `PingFang SC` / `Microsoft YaHei` / `Source Han Sans SC`; otherwise Windows falls back to a serif face.

### Font size ladder (4 levels only)

| Class | Size | Use |
| --- | --- | --- |
| `text-xs` | 12px | Tab bar, status bar, sidebar lists, form hints |
| `text-sm` | 14px | Default body text, form labels, buttons, menu items |
| `text-base` | 16px | Welcome-page title, dialog titles, Markdown preview h3 |
| `text-lg` | 18px | Welcome-page brand mark (this one place only) |

**No arbitrary values** (`text-[13px]`). Needing a new size means the ladder design is wrong — discuss first.

`text-[11px]` and `text-[10px]` are **deliberate exceptions** for auxiliary text weaker than `text-xs`: status bar, settings description rows, sidebar/menu counts and timestamps, large-file banner. No other arbitrary sizes.

Font weight: only `font-normal` and `font-medium` / `font-semibold`. Never `font-bold`.

Mono font for: code, paths, line/column numbers, size numbers, version numbers.

---

## 4. Spacing and Sizing

### 4.1 Fixed Heights (UI Skeleton)

| Area | Height | Class |
| --- | --- | --- |
| Title bar | 36px | `h-9` |
| Tab bar | 36px | `h-9` |
| Image viewer toolbar | 32px | `h-8` |
| Status bar | 24px | `h-6` |
| Large-file notice bar | auto | `py-1.5` |

Title bar + tab bar + status bar = 96px fixed; rest → content area. Changing these three heights requires re-confirming the content area is usable at the minimum window size (720×480).

### 4.2 Padding Conventions

| Context | Value |
| --- | --- |
| Title bar / tab bar | `px-1.5` ~ `px-3` |
| Status bar | `px-2` |
| Sidebar content | `p-2` |
| Dialogs | component-supplied `p-4` |
| Markdown preview body | `px-8 py-6` |

### 4.3 Icon Sizes

| Context | Size |
| --- | --- |
| Icon inside status-bar buttons | `size-3` |
| Tab bar / sidebar icons | `size-3.5` |
| Title bar icons | `size-4` |
| Welcome page large icons | `size-6` or larger |

Icon-button hit-area minimum `size-5` (20px); title-bar window buttons `size-9` (36px). Never shrink a hit area below 20px.

---

## 5. Radii and Borders

| Class | Use |
| --- | --- |
| `rounded-none` | Title-bar window buttons (flush to edges) |
| `rounded-xs` | Small markers, close buttons |
| `rounded-md` | List items, cards, inputs, tooltips |
| `rounded-lg` | Welcome-page brand block, `primary` button |
| `rounded-full` | Switches, unsaved dot, progress bar |

Borders uniformly `border-border-subtle`. Draw a line only where it separates hierarchy levels; do not border every container — layer by background light/dark, not outlines. Sole accent edge: active tab top `h-0.5 bg-brand-500`.

---

## 6. Component-Library Conventions

### 6.1 Prefer the Component Library over Native Tags

shadcn-svelte components under `src/lib/components/ui/` are first choice:

| Need | Use | Do not use |
| --- | --- | --- |
| Button | `Button` | `<button>` |
| Text input | `Input` / `Textarea` | `<input>` / `<textarea>` |
| Switch | `Switch` | `<input type="checkbox">` |
| Dropdown select | `Select` | `<select>` |
| Dialog | `Dialog` | `<dialog>` |
| Icon button + hint | `Hint` (project wrapper, see 6.3) | bare `Button` + hand-rolled Tooltip |
| Scroll area | `ScrollArea` | `overflow-auto` |
| Shortcut display | `Kbd` | `<kbd>` |
| Label badge | `Badge` | hand-written span |

Exceptions — native elements fit better for: tab-bar tab items, welcome-page recent-file rows, image-viewer image container (need precise drag control, native `draggable`, `transform` zoom). Each native element needs a one-line code comment explaining why.

### 6.2 State Variants Must Be Declared by app.css

Never delete the `@custom-variant` block at the top of `src/app.css`: it maps the `data-state="checked"` bits-ui emits onto the `data-checked:` shorthand used by component class names. Deleting it drops styling for switches, selected states and expanded states — a switch degrades into an almost invisible dark dot. See [../memory/decisions.md](../memory/decisions.md).

New state variant → first confirm `app.css` has the matching `@custom-variant`.

### 6.3 The `Hint` Wrapper

All icon buttons must use `src/lib/components/common/Hint.svelte`:

```svelte
<Hint label="Toggle sidebar · Ctrl+B" onclick={toggleSidebar}>
  <PanelLeft class="size-4" />
</Hint>
```

Covers Tooltip's four-layer structure, `aria-label`, hover state, hit area. Props: `side` (popup direction, default `bottom`), `active` (toggle-button background), `danger` (red hover for destructive actions), `class` (size classes, default `size-7`).

**Do not** repeat `TooltipProvider > TooltipRoot > TooltipTrigger > TooltipContent` in business components.

### 6.4 `Select` Must Be Passed `items`

Pass `items`: `<Select type="single" value={v} onValueChange={f} items={items}>` with `<SelectItem value={item.value} label={item.label}>`. Without it the closed menu shows the raw value (English `system`, `utf-8` instead of the Chinese labels) — bits-ui cannot read option text from the DOM while closed, relying only on `items` or the cache of mounted items.

---

## 7. Icons

Functional icons: `@lucide/svelte` (not the deprecated `lucide-svelte`), line style, `stroke-width` at its default.

Forbidden: emoji as icons; mixing icon libraries.

### App Brand Logo

Brand mark: dark grey ground, milk-white sesame seed, amber text cursor; seed hugs the cursor with two small milk-white hands. Fixed colours, never tinted by the editor theme. Functional buttons keep Lucide and theme tokens.

Single generation source: `app-icon.png` in the repo root. `pnpm icons` sync-generates desktop PNGs, Windows ICO, macOS ICNS, and store icons into `src-tauri/icons/`, plus `public/logo.png`, `public/favicon.png`, `public/favicon.ico`. Never modify derived icons individually.

Windows ICO, desktop PNGs, frontend brand assets: an SVG viewport crops roughly 8.3% transparent padding per edge so the visible subject fills the system icon cell; the source is not redrawn. macOS ICNS keeps the original canvas and padding. When adjusting the source, check the padding ratio in `scripts/generate-icons.mjs` and the 16 / 32 / 48 pixel results. The Rust build script watches `icons/` so incremental builds do not reuse stale Windows EXE icon resources. NSIS installer and uninstaller hooks end with `windows/installer-hooks.nsh` notifying the Windows Shell to invalidate the icon cache, so a reinstalled EXE at the same path does not keep an old size or artwork.

Welcome page, Windows custom title bar, and app-menu brand item all use `common/AppLogo.svelte`, with no extra background colour, radius, or shadow. App name already next to the logo → empty alt (avoid assistive tech reading it twice). README references the generated `128x128@2x.png`.

Icons already in use (check here before adding one, to avoid different shapes for the same meaning):

| Icon | Meaning |
| --- | --- |
| `PanelLeft` | Sidebar toggle |
| `Minus` `Square` `X` | Minimize / maximize / close |
| `Plus` | New tab |
| `FileText` | Text file |
| `Image` | Image file |
| `FolderOpen` | Open file |
| `Clock` | Recently opened |
| `Layers` | Opened list |
| `Moon` | Hibernated |
| `Eye` / `Code` | Preview / back to edit |
| `WrapText` / `Hash` | Word wrap / line numbers |
| `Settings` / `Keyboard` / `Menu` | Settings / shortcuts / app menu |
| `Sun` / `Monitor` | Light / follow system |
| `ZoomIn` `ZoomOut` `Maximize` `SquareDot` | Zoom in / zoom out / fit window / actual size |
| `ExternalLink` | Open with external program |
| `Loader2` | Loading (with `animate-spin`) |
| `FileWarning` / `ChevronsDown` | Large-file notice / continue loading |
| `RotateCcw` | Restore defaults |

**A feature may appear in this table only once.** Different shapes for the same meaning read as two features (see the `Hint` in 6.3, the toggle buttons in 12).

### Why "Actual Size" Is `SquareDot`

Rejected: the **text** `1:1` — in an image context it reads backwards as "aspect ratio 1:1" (square), not "100% zoom", giving a ratio the user cannot verify instead of a clickable action.

Candidates compared side by side at the real 14px size:

| Candidate | Why rejected |
| --- | --- |
| `Scan` `Fullscreen` `Focus` `ScanSquare` | Corner brackets — **same shape as `Maximize` for "fit window"**; two corner-bracket boxes in one row are guaranteed to be misread |
| `Maximize2` `Expand` `Scaling` `MoveDiagonal` | Arrows — zoom in/out already sits in the same row; arrow semantics collide |
| `Crop` `Frame` `Ratio` | Wrong semantics, or confused with aspect ratio |
| `SquareDimensions` `Ruler` `RulerDimensionLine` | Expresses "size / measurement", not "show as-is at pixel scale" |
| **`SquareDot`** | Chosen — box + solid centre dot: one pixel dot landing in one pixel cell |

`SquareDot` and `Maximize` are a pair of **antonym shapes**: one expands outward to fill, one stays fixed. The buttons sit adjacent; opposing shapes distinguish them better than similar semantics.

## 8. Interaction states

Every clickable element needs all four states, no exceptions:

| State | Behaviour |
| --- | --- |
| Default | colours from semantic tokens |
| Hover | `hover:` changes background or text colour, `transition-colors` |
| Focus | `:focus-visible` gets a 2px brand outline from app.css globally |
| Disabled | `disabled:opacity-50 disabled:pointer-events-none` |

**Never remove the focus ring.** No `outline-none` unless equivalent visible feedback is provided at the same time.

Duration: `transition-colors` or `duration-100`~`200`. Layout properties (`width`, `height`) transition only on sidebar collapse: `transition-[width] duration-200`. **Never transition `all`** — it drags `transform` along into unintended movement animations.

`prefers-reduced-motion` is handled globally in app.css; components must not repeat it.

---

## 9. Copy / wording rules

UI copy **always goes through the i18n dictionary**; no Chinese string literals in components.

| Location | Rule | Example |
| --- | --- | --- |
| Button | verb + noun, 2–4 characters | New file / Open file / Replace all / Restore defaults |
| Menu item | noun or verb phrase | Settings / Shortcuts / Light / Dark |
| Status | noun phrase | Ready / Image / Large-file mode / Asleep |
| Empty state | state the fact + the next step | No files opened yet / Drop a file into the window, or press Ctrl+O |
| Error | state the cause, no jargon | No access permission: xxx (not `EACCES`) |
| Confirm dialog | question + explicit consequence | "xxx" has unsaved changes. Save? |

Numbers and paths use `tabular-nums` so widths don't jitter when values change.

### Internationalization (i18n)

Two languages: Simplified Chinese and English. Default follows the system (`navigator.languages`; anything starting with `zh` → Simplified Chinese, everything else → English); user can override in settings.

**Do not introduce an i18n framework.** Two languages, ~160 strings, no lazy-loaded language packs, no plural-rule files, no date/number localization. One typed dictionary plus `t()` suffices.

#### Structure

```
src/lib/i18n/
  locale.ts         language tag, system-language detection (pure functions, no state)
  locale.svelte.ts  current language as $state (**must be .svelte.ts**)
  messages/en.ts    English, the single source of the dictionary shape
  messages/zh-CN.ts Chinese, annotated with the same type
  index.ts          t() and re-exports
```

**`locale` must live in a `.svelte.ts` file.** Runes work only in `.svelte` / `.svelte.ts`; in a plain `.ts` it throws `rune_outside_svelte` at startup and **white-screens the whole app**, and `svelte-check` cannot catch it. Already hit once.

#### Type safety

`Messages = typeof en`; the Chinese file is annotated with that same type. Therefore:

- Missing translation → compile error (runtime fallback to English would let missing translations slip into a release).
- Extra key not in `en` → compile error.
- `t()`'s key parameter is type-constrained; a wrong key does not compile.

**Do not add `as const` to the English file** — it narrows every value to a string literal (`'Save'` instead of `string`), so a Chinese `'保存'` fails to typecheck and the dictionary becomes untranslatable.

#### Usage

```svelte
<p>{t('welcome.emptyTitle')}</p>
<span>{t('tab.close', { name: tab.name })}</span>
```

- Placeholders use `{name}`, interpolated by `t()`. Missing argument is left verbatim (UI shows `{name}`) — easier to locate than a silent empty string.
- Plurals use `{ one, other }`, selected by `count`. Chinese writes the same form for both — no CLDR rules; English only distinguishes 1 from the rest.

#### What must not go into the dictionary

- **Code comments**: stay Chinese; not UI copy.
- **`console.*` logs**: developer-facing, don't change with UI language. Always via [`log.ts`](../../src/lib/utils/log.ts).
- **Language names**: always written in their own language (Chinese「简体中文」, English `English`), never translated — else an English user misconfigured to Chinese sees「英语」and cannot switch back.

#### Native dialog button copy gotcha

Custom button copy → every platform returns **the button text itself**, not `Yes`/`No`; the dialog and the comparison must use the same copy captured at the same moment:

```ts
const btnSave = t('action.save');
const answer = await message(..., { buttons: { yes: btnSave } });
if (answer === btnSave) return 'save';
```

Re-reading the copy for the comparison fails after a language switch — "Don't save" is treated as "Cancel". `close-tab.ts` and `save-file.ts` follow this pattern.

### Numbers in the status bar must carry labels

A bare number tells the reader nothing: cursor position used to show only `19:17` and users could not tell what it was. Every status-bar item needs a readable label or `title` tooltip:

| Item | Display | Tooltip |
| --- | --- | --- |
| Cursor position | Line 19, Col 17 | Cursor position (line:col) |
| Language | JavaScript | — (self-evident) |
| Encoding | UTF-8 (**clickable**) | Reopen with encoding… |
| Line endings | CRLF | Line ending style |

`UTF-8` / `CRLF` are common knowledge for developers and can stay as-is; a bare number pair like line/column is unreadable without a label.

**Encoding must be clickable**: detection can never be fully right (Big5 / Shift_JIS / BOM-less UTF-16LE are all misdetected as GBK in testing), so users need a correction entry point. An untitled tab has no on-disk file to re-read → non-clickable text.

### Decorative feature defaults

"Indent guides" and "rainbow brackets" are both optional decorations, with **opposite defaults**:

| Feature | Default | Reason |
| --- | --- | --- |
| Indent guides | **on** | Very faint vertical lines that help judge nesting depth, with almost no visual weight |
| Rainbow brackets | **off** | Multicoloured brackets actively grab attention, in tension with the "quiet" positioning |

Criterion: "does it compete for attention", not "is it useful".

Rainbow brackets has two further hard constraints (see `editor/rainbow-brackets.ts`): disabled past 200,000 characters (precomputation is O(n)); brackets inside strings and comments must be skipped — otherwise `printf("(((")` mislevels every bracket after it and shifts all the colours.

---

## 10. New-component checklist

Confirm each item before writing a new UI:

- [ ] Colours only from the section 2.2 semantic tokens, no hard-coded hex
- [ ] Font size on the section 3 scale (fine-tuning exceptions only for 10px/11px caption text)
- [ ] Radius chosen from section 5, no invented values
- [ ] Buttons/inputs/switches/dialogs prefer the components under `ui/`
- [ ] Icon buttons use `Hint`, with a Chinese `label`
- [ ] Any `Select` is passed `items`
- [ ] Clickable elements have hover, focus and disabled states
- [ ] Copy is Chinese, concise, without polite filler
- [ ] **Eyeballed in both light and dark** (especially contrast of input-type controls)
- [ ] No layout breakage at the minimum window size 720×480
- [ ] `pnpm check` has zero errors

---

## 11. Known implementation constraints (read before changing styles)

1. **Never delete the `@custom-variant` block in `app.css`** — deleting it kills all component state styles.
2. **`--input` must be clearly brighter than the background in dark mode** — otherwise switches are invisible.
3. **Register the line-number gutter before the folding gutter** — CodeMirror orders gutters by extension registration order; wrong order puts the fold arrow left of the line numbers. See `src/lib/editor/extensions.ts`.
4. **The CodeMirror search panel needs its own dark styles** — built-in styles assume a light background; see `.cm-panel.cm-search` in `src/lib/editor/themes.ts`.
5. **The icon library is `@lucide/svelte`**, not `lucide-svelte`.
6. **Markdown-preview HTML must pass through DOMPurify** — `marked` does not escape raw HTML. Do not remove sanitization when touching the preview component.
7. **Danger buttons must set both `hover:` and `dark:hover:`.** `Button`'s `ghost` variant carries `dark:hover:bg-muted/50`, whose selector wins over a bare `hover:bg-destructive`; with only the latter it does not turn red in dark mode. See the `danger` branch of `Hint.svelte`.
8. **`Hint`'s state classes must come after the caller's `class`** — `cn` is tailwind-merge, so the later same-family utility wins; reversed order lets the caller's `bg-*` eat the `active`/`danger` background.

## 12. List and action-column layout conventions

Hover action buttons (welcome-page recent files, sidebar lists):

- **Action button shares one slot with adjacent secondary info**: hover fades one in, the other out (time column: "21 minutes ago" → remove button). No extra row-end column → nothing "looks missing" unhovered, header needs no compensating alignment.
- Container **fixed width**; both elements absolute, overlapping; hover toggles `opacity` only. `display` toggle or adaptive width → row width jumps.
- **Never nest `<button>` in `<button>`**: invalid HTML, browser scrambles structure. Clickable row + inner action button → inner uses `span` + `role="button"` + `tabindex="0"`, Enter / Space handled manually.
- Action buttons: `focus-visible:opacity-100`.

### Toggle buttons: distinguish by text colour only, icon unchanged

| State | Colour |
| --- | --- |
| On | `text-content` (bright; follows theme foreground) |
| Off | `text-content-faint` (grey) |

**No background colour.** Rejected: brand-coloured bg — too heavy for the status bar; `bg-surface` only — invisible against the status-bar bg.

**Icon never changes** — else one two-state toggle reads as two features. Tooltip still spells out "on / off" (colour-unsure users, screen readers).

Measured (dark theme): active icon brightest pixel 232, inactive 105.

See `active` branch of [`Hint.svelte`](../../src/lib/components/common/Hint.svelte), [`StatusBar.svelte`](../../src/lib/components/layout/StatusBar.svelte).

- **Same-kind controls share one size**: home-page vs sidebar "remove" (`size-3.5` vs `size-3`) looked different. Search other instances before changing an icon size.

### Dialogs with custom buttons return the **button text**, not Yes/No

`message()` (`@tauri-apps/plugin-dialog`) with custom button copy returns **the button text itself** on every platform:

| Platform | Implementation | Return value |
| --- | --- | --- |
| Windows | rfd `win_cid` | `Custom("保存")` / `Custom("不保存")` / `Custom("取消")` |
| macOS | rfd `NSAlert` | `Custom(copy)` |
| Linux | zenity branch | `Custom(copy)` |

**Testing for `'Yes'` / `'No'` never works.** `close-tab.ts` tested `answer === 'No'` — never true on Windows, so "Don't save" acted as "Cancel", clicking did nothing.

Extract button copy into a constant; compare the return value against that same constant. See `askUnsaved` in [`close-tab.ts`](../../src/lib/actions/close-tab.ts).

### Do not write angle-bracketed tag names in a Svelte `<script>` comment

Bracketed tag name in a `<script>` comment parses as a **real tag**, so `<script>` cannot close: `` `<script>` was left open ``.

**Rule: never bracket a tag name in a comment** — write "style block" or `style block`.

### Verifying styles requires the browser's computed values, not the source

**Layout-shape** changes (centering, fitting, alignment) must be measured over CDP against computed style + `getBoundingClientRect`: launch Edge with `--remote-debugging-port` (headless fine), take `webSocketDebuggerUrl` from `/json/list`, connect, `Runtime.evaluate` a measurement of `getComputedStyle(el)` properties + `el.getBoundingClientRect()` + element offset from the container/window centreline. Node 26 ships `WebSocket` and `fetch`; no deps.

**A class name present in build output proves nothing** — a CSS declaration is not necessarily computed.

#### Debugging trap: `!important` declarations are reordered to the end by CSSOM

`rule.cssText` reorders **`!important` declarations to the end**, easily truncated out of view and read as "declaration missing" (measured in Chrome: a leading `width: fit-content !important` prints after `max-width` and `color`).

**Print full `cssText`, or read `rule.style.getPropertyValue('width')`** — never conclude from a truncated string.

Comments inside a rule body do **not** swallow declarations (measured); project writes explanations above the rule for readability only.

### Scrollbars take no space — you must make room manually

bits-ui `ScrollArea` scrollbar is `position: absolute` **overlay**, 10px wide; does not widen the container.

- Scroll-container content needs its own right padding (`pr-3` / `pr-4`), else the scrollbar covers text.
- **Include it in alignment math.** The table header sits outside the scroll container; without the same value it ends right of the list content — cause of the "Clear"/timestamp misalignment. Current: welcome-page list `pr-3` + row `px-2` = 20px, header `pl-2 pr-5`; sidebar `p-2 pr-4` = 16px, header and rows both `px-1.5`.
- Buttons carry their own horizontal padding (`px-1.5`), indenting text past the box; `-mr-1.5` pulls the box back so text right edges align.

---

## 13. Typography

### The font stack must explicitly include CJK fonts

**Root cause of "Chinese and English look like two different fonts in the editor"**: monospace fonts (Consolas, JetBrains Mono…) contain no CJK glyphs; an English-only stack falls back to the system CJK font (often SimSun on Windows) → one line mixes monospace sans-serif English with serif Chinese, mismatched widths and style.

Fix: list CJK fonts explicitly; the browser resolves per character, controlling both scripts.

CJK list = `CJK_FALLBACK` in [`fonts.ts`](../../src/lib/utils/fonts.ts), **shared by UI and editor fonts** — separate copies drift.

### Font settings

| Setting | Default | Notes |
| --- | --- | --- |
| UI font | empty string | Empty = built-in stack in `app.css`. Non-empty overrides `--font-sans` |
| Editor font | empty string | Empty = built-in default **monospace** stack (independent of UI font) |

**The editor font does not follow the UI font.** Both defaults display "follow system default" but fall back to `--font-sans` vs `--font-mono`; monospace is a baseline requirement for code editing, and following the UI font would cost code alignment.

### Line-number font belongs to the editor

**The gutter follows the editor font, not the UI font** — line numbers share the code's column and align line by line. VSCode does the same (`editor.fontFamily`).

Font on `.cm-content` alone leaves the gutter inheriting `--font-sans` from body. `editorFontTheme()` sets the same stack on `.cm-content` and `.cm-gutters`.

### Font picker

Popover + searchable list, not a Select: hundreds of fonts; a dropdown can be neither searched nor previewed.

- **Loading state required** — directory scan, hundreds of ms first time.
- **Preview text needs Chinese and English** (currently "Sesame sesame 中文 123"); English-only hides the CJK fallback problem.
- Entry previews in its own font; font name renders in the UI default font.
- Enumeration failure → default option only; never brick the settings panel.

---

## 14. Editor gutter (line numbers and fold column)

### Fold markers are SVG chevron icons, aligned to their row

VSCode-style chevron: **down** expanded, **right** folded.

**SVG icon only — never CSS borders, never a font character.**

| Approach | Problem |
| --- | --- |
| Font character (`⌄` / `›`) | Varies with user's font, weight uncontrollable, smears at small sizes |
| CSS borders | Squeezed by the cell; larger `padding` touches the edge; reads one size smaller than the line numbers |
| **SVG icon** (current) | Fixed geometry, controllable `stroke-width`, size in `em` follows font size |

Path matches Lucide `chevron-down` / `chevron-right`; folded = same path rotated `-90deg`.

1. **Position**: marker is inline text in a fixed-height box on the baseline — measured ~4px below the line number in the same row. **Fix**: `.cm-foldGutter .cm-gutterElement` → `display:flex` + `align-items:center`.
2. **Padding**: default near zero; icon touches line numbers and border. **Fix**: cell `padding: 0 4px`, icon container `1.25em`. CodeMirror derives gutter width from content width → column widens, icon unsquashed.

Folded arrow `--brand-600` to mark the folded row.

See [../src/lib/editor/fold-gutter.ts](../../src/lib/editor/fold-gutter.ts).

### Line numbers and fold column toggle together

Same **Compartment** — must toggle together: fold markers lose their reference without line numbers. Rejected: fold gutter as fixed extension — disabling line numbers left the fold icons visible (measured).

Keep `codeFolding()` when disabled: folding capability + keybindings, no visible element; Ctrl+Shift+[ still works.

### Line numbers are not selectable

`user-select: none` on line numbers and fold column — copying code otherwise drags the digits in.

Rule must be `.cm-editor .cm-content`, **not** `.cm-editor` (includes the gutter).

### Line-number left/right padding must be symmetric

Right whitespace reserves one fold-marker width; without an equal left gap the digits shift right and look uncentred. Both sides `0.6em`.

### Line-number side gaps are equal, the right one occupied by the fold icon

```
[ line-number column: padLeft + digits + padRight ][ fold column: MARKER_SIZE ]
```

Digits right-aligned → gap **left** = `padLeft`, gap **right** = `padRight + MARKER_SIZE`. Equal ⇒ `padLeft = MARKER_SIZE`, `padRight = 0`.

Also remove CodeMirror's default `min-width: 20px` — cell wider than the digits; `flex-end` absorbs the surplus left, so the left gap exceeds `MARKER_SIZE`. Safe: a separate hidden spacer computes width from the **max line number** → gutter width stable while scrolling.

Measured (13px font, `MARKER_SIZE = 1.25em`): left 17px, right 18px.

### Line numbers must be flex-centred, not left to the default line box

Line numbers and fold arrows **must share one alignment mechanism** — else they differ by half a pixel to several pixels.

Default: digits laid on the **line box** (`text-align: right`, no flex). Cell height derives from the **body font size**, digits are 1px smaller → line box shorter than the cell, sits at top → ink ~1.5px above the row centre, while the flex-centred arrow holds centre.

**Fix**: `.cm-lineNumbers .cm-gutterElement` → `display: flex` + `align-items: center`, keep `justify-content: flex-end`.

Measured: centre deviation **≤0.5px** on every row.

### Plain text between icon buttons needs `leading-none` to align with the icons

Toolbar zoom ratio is a **text** element (`适应` / `100%`) between `size-6` icon buttons. Measured (895×70 screenshot, DPR 1):

| Element | Ink centre | vs toolbar content-box centre (52.5) |
| --- | --- | --- |
| Five icon buttons | 53.0 | +0.5 |
| `适应` text | 52.0 | **−0.5** |

Text sits **1px higher** than the icons in the same row.

**Root cause: `align-items: center` centres the line box, not the ink.** Line-box height = `line-height`; toolbar inherits `text-[11px]` → `1.5 × 11px = 16.5px`, and CJK ink sits high inside the em box line.

**Fix**: `leading-none` (`line-height: 1`) on that text element.

Measured (same Chromium + build-output CSS, ink centre via threshold bounding box):

| Fix | Δ (text − icon) |
| --- | --- |
| none | **−1.00px** |
| `leading-none` | **0.00px** |
| `h-6` + flex centring | −1.00px (**useless** — still centres the fractional line box) |
| `text-box: trim-both cap alphabetic` | −0.33px (clips glyphs in mixed CJK/Latin) |

- An `inline-flex h-6 items-center justify-center` wrapper still centres that 16.5px line box; the offset is unchanged. Only `line-height` fixes it.
- Offset present at DPR 1, 2 and 4, no drift with the threshold, but **whole pixels only at DPR 1 (real-machine default)** — verify at DPR 1, never extrapolate from high DPR.

### Gutter registration order

**Line numbers before fold column.** CodeMirror lays gutters out left to right in extension registration order; reversed → fold markers left of the line numbers.

### Two CSS-variable naming schemes

Tailwind v4 `@theme` generates only `--color-brand-*`; **`var(--brand-500)` in a component or CodeMirror theme resolves to nothing.**

Short names need raw tokens in `:root` (this project does) mapped by `@theme inline`. Writing only `--color-brand-*` made `:focus-visible`'s `outline: 2px solid var(--brand-500)` an invalid declaration → **keyboard focus ring invisible** — accessibility defect, not cosmetic.

## 15. Save strategy

Two file classes, different save paths:

| | Existing file (opened) | New file (untitled) |
| --- | --- | --- |
| Has a path | yes | **no** |
| Autosave | write straight back to the original file | nothing to write to |
| Ctrl+S | write straight back | open "Save As" to pick a path |
| Close window | confirm dialog if unsaved | confirm dialog if unsaved |

### Three protection layers

Cost low → high, reliability high → low:

1. **Explicit user save** (Ctrl+S) — content lands in the user's own file.
2. **Autosave** (optional toggle) — after typing stops, write back to the **original file**. Path-holding tabs only.
3. **Draft backup** (always on) — unsaved body text → `drafts/` in the app data directory. Touches no user file; every tab; only safety net for untitled tabs.

**Draft backup is independent of the autosave toggle** — the data-safety floor, never user-switchable. Autosave off = "don't proactively modify user files", not "content may be lost".

### Restore directly on startup, no confirmation dialog

Restore any existing draft — **no modal on the startup path**. Restoring is non-destructive (content is already in the draft); discarding = close the tab. Keep the choice in the UI.

Only when content was actually restored: one auto-dismissing title-bar status line naming the extra tab.

### Atomic writes are the baseline, not an optimisation

**Every save: temp file → fsync → rename** ([atomic.rs](../../src-tauri/src/core/atomic.rs)). `fs::write` over the target leaves a truncated file ("neither old nor new") on crash or power loss mid-write.

1. **Temp file in the target's own directory** — cross-device `rename` is not atomic (copy + delete).
2. **`sync_all()` before rename** — OS-cache flush is not enough; power loss can leave the target empty or truncated.
3. **Windows: rename fails when the target is in use** (antivirus, indexers). Retry with backoff, then report the error truthfully. **Never "delete the target, then rename"** — window where the file is deleted but the new one has not arrived.

### External-modification conflict: re-check before save + update baseline after

A desktop editor cannot exclusively own a file (terminal scripts, Git branch switches, other editors); "disk never changes after open" → one Ctrl+S **silently clobbers other changes**.

1. **Fingerprint on open** (`mtime` + size) = persistence baseline.
2. **Re-check before save**: mismatch → `conflict` error, refuse to write. Deleted file also counts; do not resurrect.
3. **Three exits on conflict**:
   - **Overwrite disk** — my content wins, loses the other changes (word this explicitly)
   - **Load disk** — discard my edits, re-read
   - **Save As** — keep both, safest, default
4. **Update the baseline on successful save** — else your own write's mtime reads as an external modification and every save raises a conflict dialog.

Use `mtime + size`, not a content hash: hashing reads the whole file; rehashing a few-MB file per save is not worth it; any real write updates mtime.

### When a write cannot succeed, give an exit, not a dead end

Read-only files, files locked by another process, directories without write permission: these saves will fail. Never just pop "Save failed":

- state the reason (in Chinese, not an errno)
- offer "Save As to another location"
- if the user defers, **keep the dirty state** and state "your changes are still in the editor"

Content must never be lost because one write failed.

### Why drafts are mandatory

Untitled body text had nowhere to land on disk: no path → autosave cannot help; the session snapshot records paths only, no body text. Measured: "new → type → close window" loses content silently, empty array in `session.json`.

- **Untitled content survives restart** as an equally untitled dirty tab, body intact.
- **Crash protection**: after a force-kill, the last backup is still on disk.

### Draft lifecycle

| Moment | Action |
| --- | --- |
| Tab becomes dirty | write a draft after a 2-second debounce |
| Before closing the window | **flush immediately** drafts for all dirty tabs (cannot wait for the debounce) |
| Save succeeds | delete that draft |
| User chooses "Don't save" | delete that draft |
| Window closed and user handled every tab | clear all drafts |

Without the last row, the next launch restores just-handled content ("unsaved changes" despite having saved).

### Draft deletion must not pre-check "was it ever written"

`dropDraft` early-returned on "written this session"; a draft restored from disk at startup never went through the write path, so it could never be deleted and reappeared on restart. Deletion is idempotent (missing file = success): **just call it**, no pre-check.

### Editor search panel: vertical alignment must use flex, not `vertical-align`

Three defects, all from `vertical-align` and the inline baseline:

| Element | Default approach | Consequence |
| --- | --- | --- |
| Input / buttons | `vertical-align: middle` | not on the same centreline as the checkbox |
| Checkbox | inline, aligned to baseline | sits too high relative to the text |
| Close button | `position: absolute; top: 0` | pinned to the panel top; no size, looks small and off-position |

**Fix**: panel `display: flex` + `align-items: center`.

- Clear CodeMirror's `margin: .2em .6em .2em 0`; spacing via container `gap` (else a gap opens between checkbox and its text).
- Checkbox label `inline-flex` + `gap`.
- Close button: 20px hit area; `top: 50%` + `translateY(-50%)`; `26px` right padding on the panel (absolutely positioned, out of flow).
- **Change light and dark rules together** — else alignment shifts on theme switch.

**Trap: the button gradient is `background-image`, not `background-color`**: `'&light .cm-button': { backgroundImage: 'linear-gradient(#eff1f5, #d9d9df)' }`, `'&dark .cm-button': { backgroundImage: 'linear-gradient(...)' }` (`@codemirror/view`). `backgroundColor: 'transparent'` **does not override it**; write `backgroundImage: 'none'`, repeated for `hover` and `active`.

### Title bar: skeleton actions left, window actions right

Split by **scope of effect**, not frequency:

| Position | What goes there | Examples |
| --- | --- | --- |
| **Left** | operations affecting the **UI skeleton** | sidebar toggle, app menu (hamburger) |
| **Right** | **window-level** operations | theme switch, minimise/maximise/close |

Hamburger moved right → left: same "change the interface layout" class as the sidebar toggle.

**Theme switch is its own button** ([ThemeMenu.svelte](../../src/lib/components/layout/ThemeMenu.svelte)), not in the hamburger: high-frequency, two levels deep costs a click, three options only. Rejected: duplicating it in both places — users guess "which one is real"; the menu copy was removed.

Two judgements, both in `ThemeMenu`; do not merge:

- **Icon: `mode.current`** (resolved theme). Under follow-system `settings.theme` is `'system'`, not a drawable icon.
- **Checkmark: `settings.theme`.** System dark → `mode.current === 'dark'` and `settings.theme === 'system'` true at once, so `mode.current` shows both "Dark" and "Follow system" as current.

### Status bar: no placeholder text in the empty state

No file open → status bar **shows nothing**, no "Ready". It was a non-clickable placeholder; the status bar carries facts about the current file (line/column, language, encoding, line endings).

### Action feedback: one line of status text in the title-bar centre, not toast

**No toast; no `svelte-sonner`.** [StatusLine.svelte](../../src/lib/components/layout/StatusLine.svelte) + [status.svelte.ts](../../src/lib/state/status.svelte.ts).

#### Why toasts were dropped

Unsuitable for operation confirmations:

1. **Intrusive** — floating card that moves and disappears on its own.
2. **Positionally meaningless** — bottom-right (or top-centre) has no spatial relation to the event; drags the gaze off the document.
3. **Redundant** — the dirty dot clears and the status bar updates anyway.

**Fix**: one short line (icon + text) in the title-bar centre, auto-dismisses after a few seconds.

#### The title-bar centre no longer shows the file name

The tab bar already shows it less than 40px away. The space goes to what changes: "did the thing that just happened succeed".

#### Status line vs native dialog: the division of labour

| Purpose | Form | Example |
| --- | --- | --- |
| **Inform** (no user decision) | Title-bar status line, auto-dismiss | Saved; disk contents loaded |
| **Decide** (user must choose) | Native `message()` dialog | Overwrite disk / load disk / save as; save / don't save / cancel |

**A decision must never be a single line that disappears** (it vanishes while the operation waits); "Saved" must never raise a click-requiring dialog.

#### Duration tiers by tone

| Tone | Duration | Colour |
| --- | --- | --- |
| success | 2.2s | green |
| info | 2.6s | secondary text colour |
| warning | 4s | amber |
| error | 6s | destructive |

**Consecutive calls replace the previous message; never queue** — queuing lags messages far behind actions.

#### Two easily missed details

1. **Animation key = incrementing sequence number, never the text.** Consecutive "Saved" messages share identical text, so with text as `{#key}` the second does not remount; only an auto-incremented `seq` replays the fade-in.
2. **Clear "Saved" on the next edit** — else the title bar says "Saved" while the document is dirty. Clear only `success`; errors and warnings must not be interrupted by a keystroke.

#### Keep the copy short

"Saved", not "File saved successfully"; "Not saved, changes are still in the editor", not "The save operation failed; your changes remain in the editor, please retry later". Long text truncates.

#### Colour the icon and text only — no background fill

A coloured background reads as a system notification. Four tones = one icon + one text colour each.

### WebView2 browser accelerator keys must be disabled

WebView2 (Chromium) ships **browser** accelerators: `Ctrl+F` find bar, `Ctrl+P` print, `F3` next match, `Ctrl+plus` zoom — web-page features, not desktop-app features; the user expects the editor's own find panel.

Fix: `with_browser_accelerator_keys(false)` on the main window in `lib.rs` (WebView2 `SetAreBrowserAcceleratorKeysEnabled(false)`). Keeps copy/paste/select-all.

`Cargo.toml` must declare both `webview2-com` and `windows`, **versions matching wry's in `Cargo.lock`** — else COM types are incompatible.

### A navigation guard must be installed, denying external navigation by default

Tauri default **allows all navigation** (`|_, _| true`): one external link click in the Markdown preview replaces the app UI with a web page; no address bar, no back button — restart only.

1. **Frontend** (`MarkdownPreview.svelte`): event delegation intercepts `<a>` clicks, hands `http(s)` links to the `opener` plugin's `openUrl`.
2. **Rust** (`navigation_guard` in `lib.rs`): allow only the app's own origin, deny the rest — the backstop.

The window is declared in `tauri.conf.json`, so no `WebviewWindowBuilder` `.on_navigation()`, and app-level `tauri::Builder` has no such hook; **plugins** do. Mount the guard on a minimal plugin.

---

## 16. Known implementation traps (read before changing code)

### Svelte 5: runes only work inside `.svelte` / `.svelte.ts`

Runes in a plain `.ts` throw `rune_outside_svelte` **at startup** and **blank the whole app**; **`svelte-check` stays green** and misses it.

**Rule: a module declaring runes must have a filename ending in `.svelte.ts`.** Pure functions and types stay in plain `.ts` (`i18n/locale.ts`); state goes in its own `.svelte.ts` (`i18n/locale.svelte.ts`).

Debug: attach over CDP, read console exceptions (script in the "verifying styles" section below).

### Svelte 5: `$derived` does not update when reading a plain `Set` / `Map`

`$derived` recomputes only when a **reactive source it read** changes; adding to or removing from a plain `Set` / `Map` emits no signal, so the value is computed once and stays stale.

Rejected: plain `Set` of loading tab ids (`state/images.svelte.ts`) read by `isLoading()` and wrapped in `$derived` in `ImageViewer` — `loading` stayed `false`, so a read showed "cannot display this image" instead of a loading state.

**Rule: any collection state read by `$derived` / the template must live in a reactive container.** Convention here: `$state.raw` holding an immutable object, replaced wholesale on every change:

```ts
let loading = $state.raw<Record<string, boolean>>({});
// Replace wholesale on write so that reading loading[id] establishes the dependency
loading = { ...loading, [id]: true };
```

### CodeMirror: `updateListener` does not fire for the initial state

It never runs at view creation — only on the first edit or scroll, so using it for a "first computation" leaves the feature looking broken on open.

Rejected: indent guides and bracket rainbow built with `StateField` + `updateListener` — opening a file showed no lines or colours.

**Correct approach: `ViewPlugin`.** Its constructor runs at view creation, covering the initial state, and it holds the `EditorView`, so it reads `visibleRanges` directly.

### CodeMirror: precomputed caches go in `StateField`, decorations in `ViewPlugin`

"The state before entering the viewport" (e.g. bracket nesting depth at the start of a line) is not computable from the visible range alone.

- **`StateField` caches the precomputed result** (depth at each line start), recomputed once per document change;
- **`ViewPlugin` only reads the cache and builds decorations**, O(visible lines) per scroll.

Bracket rainbow works this way; rescanning from scratch per scroll is O(n) at the bottom of the file.

### Scanning text: skipped ranges need a cursor that only advances

With ranges that must not be counted (strings/comments), **do not linearly search at every character** — O(characters × ranges), unusable at hundreds of thousands of characters.

`syntaxTree.iterate` yields nodes in **ascending** position order, so one forward-only index suffices, amortised O(1). `scanBrackets` (bracket rainbow) is written this way.

### CSS: `background-repeat: repeat-x` makes the gradient fill the whole line

Two different "repeats" conflated:

- `background-size: 2ch` controls only the width of **each gradient**;
- `background-repeat: repeat-x` repeats that one copy across the **whole line**.

Together: dense striping, one guide every 2 characters, like ruled paper. Correct fix — split repetition into two layers:

1. **Outer** `no-repeat`, `background-size` limiting this copy to **the line's indent width** (per-line inline CSS variable).
2. **Inner** `repeating-linear-gradient` drawing lines at indent-step intervals within that width.

### Svelte 5: an `$effect` calling an external function that reads and writes the same state needs `untrack`

`$effect` tracks **every** reactive value read during synchronous execution. A callee that both reads and writes the same state (`ensureImage` reads `images` / `loading` and writes `loading`) re-triggers the effect through that write; it converges only because the second pass early-returns — an implicit dependency that easily becomes an infinite loop in later changes.

Wrap such calls in `untrack()`.

### Internal paths use forward slashes; convert to native separators before showing the user

Rust normalises paths to forward slashes with `paths::to_slash()` (`C:/Users/...`). **Internal convention**: cross-platform comparison and deduplication rely on it, and unit tests pin the behaviour.

It **must not be handed to the user directly**. Measured: `Ctrl+Shift+C` copied `C:/Users/PC/AppData/Local/Temp/x.txt` — PowerShell accepts it, but cmd.exe's `cd`, many build scripts, and the Run dialog do not.

**Rule: `tab.path` is an internal representation; never use it directly for display or hand it to a system shell.** Convert through `toDisplayPath()` in `file-actions.ts` (Windows back to `\`; macOS is already `/`). Both `copyPath` and `revealInFolder` go through this conversion.

### Indent guides: use the community library, do not hand-roll

**Use `@replit/codemirror-indentation-markers`; do not implement this yourself.**

Rejected: three hand-written versions, each failed by measurement — broken vertical lines, lines hugging the gutter border, misalignment with text, body text faded along with the lines via `opacity`. Two parts are underestimated:

1. **Rendering layer.** A background gradient on `.cm-line` interferes with that line's own selection highlight and current-line background, and padding-box vs content-box decides whether the line drifts onto the gutter border. The library uses an **absolutely positioned `::before`** (`z-index: -1`, `left: 2px`), separating "drawing the line" from "the line's background".
2. **Level inference.** Which indent level an empty line inherits is a genuine heuristic; "reuse the previous line" draws wrong on empty lines at block start/end. The library **searches both forward and backward for the nearest non-empty lines** and decides from their level relationship (`IndentationMap`) — Ace / Monaco lineage.

**Criterion: where an accepted implementation exists and the details are far deeper than they look, use the mature library** — you save the edge cases that only surface when it runs.

- **Set `markerType` to `codeOnly`, not the default `fullScope`.** `fullScope` draws lines to the **end of the scope**, leaving contentless vertical lines dangling after an object literal (measured: lines ran to the bottom of the editor). `codeOnly` stops lines at the scope's **last non-empty line**.
- **Pass the colour as `var(--indent-guide)`.** The library assigns it to `--indent-marker-bg-color`; CSS variables nest and it still resolves, so the line colour follows `:root` / `.dark` on theme switch — no two colour sets in JS.

### Editor gutter: separate with whitespace, not lines and colour blocks

Gutter and body share the **same background, no divider line**.

Rejected: slightly darker background plus a 1px right border — fragmented the editor's left half into two colour blocks, and the guide lines hugged that border. Separation now comes from whitespace: line numbers 1px smaller than the body text and a lighter colour.

- **`border: none` does not clear that divider.** CodeMirror's default theme adds it under `&light .cm-gutters` via `&.cm-gutters-before { borderRightWidth: 1px }`, **more specific** than `.cm-gutters`; write `&.cm-gutters-before { borderRightWidth: 0 }` to override it (measured).
- **Current-line highlight must be the same colour on both sides.** `.cm-activeLine` and `.cm-activeLineGutter` need exactly matching backgrounds, otherwise the highlight band breaks at the gutter/body boundary and shows a seam (the two differed by 10x chroma before).

### Matching-bracket highlight: follow "whose colour it is"

Which colour the cursor-adjacent bracket's tint layer takes depends on whether rainbow brackets are on, because the two features' DOM is nested. Measured CodeMirror structure:

```html
<span class="cm-rainbow-1"><span class="cm-matchingBracket">[</span></span>
```

The matching bracket is the **inner** span; the rainbow class is its **direct parent**.

| Case | Tint colour | Selector |
| --- | --- | --- |
| Rainbow on | that bracket's **own colour** | `[class*="cm-rainbow-"] > .cm-matchingBracket` |
| Rainbow off | **accent** `--brand-500` | `.cm-matchingBracket` |

The first is more specific (extra parent qualifier) and naturally overrides the second — **no `!important` needed**.

- **The rainbow-on rule uses `currentColor`.** The inner span inherits the outer rainbow colour, so `color-mix(in oklch, currentColor 22%, transparent)` yields a same-hue tint directly.
- **The parent uses the attribute prefix `[class*="cm-rainbow-"]`, not a list of class names**, so 3 → 4 levels later needs no change.

Rejected: hardcoded `oklch(0.88 0.06 62 / 0.5)` (warm beige) left over from before the accent-colour system — a blue/green/orange bracket turned beige under the cursor and did not move when the accent colour changed.

Dark theme opacity must be 28-30%; lower is nearly invisible on a dark background.

### CSS `transform` does not change the layout box size

Images are laid out at their actual scaled `width / height`, so the scroll range is the true size. Rejected: "original-size image + `transform`" — still kept original-size overflow when scaled down.

Image viewer:

- Fit-to-window = actual visible area minus 16px padding on all sides; small images are not upscaled by default; `ResizeObserver` follows window, sidebar, and tab-visibility changes.
- Default zoom and "Reset" both restore fit-to-window. Manual zoom starts from the current displayed scale and preserves the image position at the viewport centre; original size switches to 100% separately.
- Zoom range 1%-800%. Ctrl + mouse wheel zooms centred on the pointer position; plain wheel keeps scrolling the image. Wheel listener is non-passive and cancels browser page zoom; normalize deltas by pixel, line, or page for both mice and trackpads.
- Space = hand mode, left-drag pans; use pointer capture while dragging so panning is not interrupted on leaving the viewport. Exit hand mode on Space release, tab switch, or window blur. Inputs, editable content, and dialogs do not intercept Space.
- Image canvas and editor area show no whole-block focus outline; hand mode moves focus to the canvas so the last-clicked toolbar button shows no keyboard focus ring. Keyboard navigation hints for buttons, inputs, and tabs remain.
- Centering container: `max-content` sizing, `min-w-full / min-h-full`, grid centering — centred when smaller than the viewport, scrollable to all four edges when larger; scrollbars appear only when image plus padding exceeds that direction.

Status bar: original pixel dimensions, file size, format; the generic "Image" label is gone. Top toolbar keeps only zoom, reset, fit-to-window, original size, and "Open with external program".

External open: Windows calls the system application picker; macOS selects the installed .app and then opens the original file. The Windows installer registers OpenWithProgids, SupportedTypes, and RegisteredApplications/Capabilities; NSIS and MSI candidates are generated from the file-type list in `tauri.conf.json`; the user's UserChoice default is never modified.

Window is created `visible: false` and shown after the window-state plugin restores position and size — avoids a centre-then-jump on startup.

### The shortcuts panel must match the real bindings

`ShortcutsDialog` editor shortcuts are defined in CodeMirror keymaps, not in this project's code. **Verify against `node_modules/@codemirror/*` before writing anything into the panel.**

Errors found: `Ctrl+H Replace` (`searchKeymap` has no `Mod-h` at all), `Ctrl+Shift+Z Redo` (`historyKeymap` uses `Mod-y`; Windows/Linux use `Ctrl+Y`; `Ctrl+Shift+Z` only works on macOS and Linux).

Editor built-ins live in `EDITOR_HOTKEYS` in `utils/hotkeys.ts`, verified and maintained in one place — a panel that promises what it cannot do is worse than no panel.

---

## 17. Related files

| File | Purpose |
| --- | --- |
| [../src/app.css](../../src/app.css) | Token definitions, `@custom-variant`, global base styles |
| [../src/constants.ts](../../src/constants.ts) | Font-size range, thresholds, extension list |
| [../src/lib/components/common/Hint.svelte](../../src/lib/components/common/Hint.svelte) | Icon-button + tooltip wrapper |
| [../src/lib/components/layout/StatusLine.svelte](../../src/lib/components/layout/StatusLine.svelte) | Action feedback in the title-bar centre |
| [../src/lib/state/status.svelte.ts](../../src/lib/state/status.svelte.ts) | Status-hint state and duration |
| [../src/lib/editor/themes.ts](../../src/lib/editor/themes.ts) | CodeMirror light/dark themes and syntax highlighting |
| [../src/lib/utils/hotkeys.ts](../../src/lib/utils/hotkeys.ts) | Global shortcut registration + `EDITOR_HOTKEYS` (for the panel) |
| [../src/lib/components/ui/](../../src/lib/components/ui/) | shadcn-svelte components (vendor code: change styles, not structure) |