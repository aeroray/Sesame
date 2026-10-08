# Sesame Design Spec

Sole authoritative source for Sesame's appearance. **Read before any UI change.** No second set of rules inside components.

Scope: all UI code under `src/`. See [../memory/constraints.md](../memory/constraints.md), [../memory/decisions.md](../memory/decisions.md).

---

## 1. Design positioning

Sesame is a **lightweight text editor**, not an IDE.

1. **Content first** — UI yields to text. No decorative illustrations, no gradient backgrounds, no large rounded-corner cards.
2. **Compact** — desktop density. Minimum legible line height and padding, not the large value that "lets it breathe".
3. **Quiet** — exactly one accent colour, only in active state, focus and progress. Everything else neutral greyscale.

### Supported platforms

**Windows and macOS only.** Detection centralised in [`platform.ts`](../../src/lib/utils/platform.ts).

Rejected: Linux — traffic lights, file associations and packaging differ per desktop environment; maintenance far exceeds benefit. **No Linux branches in UI code**, no conditional compilation.

### UI languages

**Simplified Chinese and English**, default follows the system. Implementation: [`../src/lib/i18n/`](../../src/lib/i18n/). Copy rules: 文案规范 below.

Buttons use verb phrases (新建文件, not 点击此处新建文件); status uses noun phrases (就绪, 大文件模式). No politeness filler (请, 您可以).

---

## 2. Colour

**oklch** only, never hex — matching L across light/dark holds contrast automatically.

### 2.1 Two token layers

| Layer | Naming | Use |
| --- | --- | --- |
| shadcn standard tokens | `--background` `--primary` `--muted` `--border` `--ring` … | **Used inside the component library**; do not reference by hand |
| Own semantic tokens | `--surface` `--content` `--border-subtle` `--border-strong` | **Used by business components**; see below |

shadcn components (`src/lib/components/ui/`) reference layer 1 — a library-theme swap would drag business code with them.

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

Tailwind: `bg-surface` `text-content` `border-border-subtle`, etc.

### 2.3 Theme (skin) system

**A colour scheme is a whole theme, not one "accent colour".** Rejected: light/dark + switchable accent — accent and editor colours drifted ("pine green" turned buttons green, editor keywords stayed brown). One theme fixes UI, editor and syntax colours together.

#### Single source of truth: 4 base colours + derivation

Rejected: 30+ tokens × 13 themes = 400 hand-written numbers — unmaintainable, guarantees "changed the background, forgot the border".

Each theme declares **4 base colours** (`bg` / `fg` / `accent` / `accentFg`); the rest derive in [`theme-tokens.ts`](../../src/lib/theme/theme-tokens.ts) via `color-mix()` at fixed ratios:

| Derivation target | Method |
| --- | --- |
| Raised surface / sunken surface / card | Blend background toward white or black |
| Secondary / weakest body text | Retire foreground toward the **background** colour |
| Three border levels | Same, at lower ratios |
| Accent 10-step scale | Blend accent toward white or black |

Light: raised is whiter. Dark: raised is lighter. Same ratios both ways.

#### Syntax highlighting comes from community packages, never hand-picked

Use `@uiw/codemirror-theme-*` directly (MIT, updated 2026-09). Rejected: hand-colouring 13 themes × 20 syntax tags — "Dracula" must look like the familiar Dracula.

13 built in: Sesame Light / Dark, Dracula, Monokai, One Dark, Nord, Tokyo Night, GitHub Light / Dark, Solarized Light / Dark, VS Code Light / Dark.

**Measured values match the official specs bit for bit** (Dracula background `#282a36`, keyword `#ff79c6`, string `#f1fa8c`; pixel-level difference 0).

Upstream deviations **deliberately kept** — matching other tools beats matching the spec documents:

- Dracula `propertyName` `#66d9ef`, not in the official palette; `number` undefined.
- Nord foreground pure white `#FFFFFF`; spec is nord4 `#d8dee9`.

#### Theme picker: thumbnail code preview + light/dark grouping

**Never express a theme as "swatch + name".** Rejected: background + accent swatches — Dracula and Monokai are both dark purple. [`ThemeThumbnail.svelte`](../../src/lib/components/common/ThemeThumbnail.svelte) draws short lines in the theme's **real syntax colours** (keyword, string, function, type, comment):

- **Colours must match the real editor** — `ThemeDefinition.preview`, same values as `editor.styles`.
- **Line widths deliberately irregular** — equal lengths look like a barcode.
- **Group by light / dark**; in-group order = `THEMES`.

#### Dialogs must have a height cap, or content overflows the window

`dialog-content` defaults to `grid`, no height limit; the 13-theme list grew past the window and cut "restore defaults" / "done" off it (**measured; unreachable**).

Fix — all three parts required:

```svelte
<DialogContent class="sm:max-w-3xl h-[34rem] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
<div class="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">…</div>
```

1. **Fixed `h-[34rem]`, not `max-h-*`** — `max-h` follows content and **the window jumps on every switch**. Measured difference: **0 px**.
2. **The `0` in `minmax(0, 1fr)`** — otherwise content stretches the scroll area and `overflow` stops working.
3. **`overflow-x-hidden` explicit** — with `overflow-y: auto` the browser computes x as auto too, giving a horizontal scrollbar. Scroll container also needs `min-w-0`.

#### Width overrides need the `sm:` prefix

`dialog-content` defaults include `sm:max-w-sm`; **`sm:` rules come after unprefixed ones**, overriding bare `max-w-3xl` — measured: dialog pinned at 24rem, "interface font" wrapped to vertical text. Write `sm:max-w-3xl`.

#### Gutter divider: theme packages miss it, so we must backstop it

CodeMirror's default theme draws the gutter line via `&light .cm-gutters` / `&.cm-gutters-before { borderRightWidth: 1px }` — **more specific** than bare `.cm-gutters`, so `border: none` cannot override:

| Sets `gutterBorder: transparent` | Does not (line shows through) |
| --- | --- |
| Dracula, Monokai, Solarized, One Dark, VS Code, Tokyo Night | **Nord, GitHub** |

Suppress in `sesameUiTheme` (`baseTheme`, theme-independent).

> Lost once when switching to theme packages — it lived in the deleted `lightUi` / `darkUi`. **Theme-independent editor styles belong in `baseTheme`, not a specific theme.**

#### Every in-theme decoration must follow the theme

**Every coloured editor decoration takes its colour from the theme**, or it is the one jarring element after a theme switch.

| Decoration | Original problem | Now |
| --- | --- | --- |
| Matching-bracket background | Hardcoded warm beige, off-theme | `var(--match-bracket)` (theme accent) |
| Rainbow brackets, 3 levels | Hardcoded blue/green/orange | `var(--rainbow-0/1/2)` (theme syntax colours) |
| Indent guides | Hardcoded greys | `var(--indent-guide)` |

Rainbow colours come from **each theme's syntax palette** (Dracula: `#bd93f9` / `#50fa7b` / `#ffb86c`).

Test: **a decoration whose colour is absent from `theme-tokens.ts` output has been missed.**

#### Accent scale: single direction, shared by light and dark

The 10 accent levels (selected background, hover, focus ring, buttons) **derive proportionally from `accent`**.

**1. `weight` is the accent share, not the blended white/black share** — `mix(accent,'white',96)` = `color-mix(accent 96%, white)`. Level 50 as `weight: 96`, read as "96% white", made `--brand-50` almost solid (luminance gap from white 0.855 vs 0.871 for 500): the selected settings item became a solid block.

**2. One scale: 50 lightest → 900 darkest.** No reversed scale for dark.

```
bg-brand-100 text-brand-900  dark:bg-brand-900/40 dark:text-brand-100
```

Light = pale background, dark text; dark = dark background, light text. Reversed, `dark:bg-brand-900/40` is not dark and the selected state glows. Dark's "pale" `--accent` = `brand-900` + opacity. Scale in `:root`; `.dark` only **semantic remapping**.

#### `--primary` must not be `accent` directly

Measured: **Solarized Light** `#268bd2` on white text is **3.41**, below WCAG AA 4.5 — `accent` is not fit for "filled-button background + white text".

| Mode | Value | Rationale |
| --- | --- | --- |
| Light | `brand-600` (one step darker than accent) | White text legible; 3.41 → **4.73** |
| Dark | `brand-500` (i.e. accent itself) | Theme identity; the paler 400 makes a grey-white slab, Dracula indistinguishable from Monokai |

Contrast **≥ 4.5 for all 13 themes**.

#### Verification: measure contrast, do not trust the eye

The eye cannot tell 3.41 from 4.5.

- **Let the browser resolve `color-mix`, then normalise.** `getComputedStyle` returns `oklab(...)`, **not** `rgb(...)`, so regex-matching rgb misses everything. Canvas: `ctx.fillStyle = <any CSS colour>`, then `getImageData` — guaranteed sRGB.
- **Criteria semantic, not by level number** — "50 is closer to the background than 500" assumes a light theme; on dark, 900 is closest. Test: scale **monotonic**, selected background **pale enough**, text **contrast meets threshold**.

#### Status bar and large-file banner

Every status bar item needs a hover tooltip describing **what happens on click**:

| Item | Tooltip |
| --- | --- |
| Line N / Column M | Cursor position (line · column) |
| Language | File language |
| Encoding | Choose text encoding… |
| Line endings | Line ending style |

- **A tooltip must not hang on only half an item** — line/column split into two `<span>`s left `title` on "line" only. One `span` per item, or every `span` gets one.
- **The tooltip describes the click's result, not the action** — clicking encoding **first opens a picker**, so "Choose text encoding…".

| Button | Icon | Rationale |
| --- | --- | --- |
| Continue loading | `Plus` | Adds another chunk, matching chunked loading |
| Load all | `ChevronsDown` | All the way at once |

Rejected: `ChevronsDown` for "continue loading" — reads as "scroll to the bottom".

#### Shortcut hints must go through `formatKeys()`

`formatKeys()` renders `⌘` on macOS; **hardcoded `Ctrl+` shows hints that do not match reality** (three in the app menu). The shortcut panel must match bindings **one-to-one**: `Ctrl+Shift+T` (reopen closed) and `Ctrl+Shift+C` (copy path) were registered but unlisted.

#### Verification: render pure presentational components straight in the browser

`LargeFileBanner` and `StatusBar` are "props in, DOM out", **no Tauri runtime needed**: `mount()` onto a plain `div`, render in headless Edge, export DOM text, `title` attributes and icon class names. Caught: `editor.language` did not exist and rendered literally.

> `host.querySelector('div')` returns the **outer wrapper**, not the component root — measures `rgba(0,0,0,0)`, misdiagnosed as "theme colour not applied". Take the target container's `firstElementChild`.

#### Size cost

13 themes incl. syntax highlighting: **3.6 KB gzip** net; CSS shrank 0.5 KB — near-duplicate light/dark editor styles (nearly 500 lines) merged into one.

### 2.4 Colour usage rules

- **Restraint**: accent only for the active tab's top indicator bar, unsaved dot, focus ring, `primary` button, sidebar active item, welcome-page brand block, large-file banner. No accent background on ordinary cards or list items.
- **The large-file banner is the only large-area accent** — "file not fully loaded" must be noticed. Other full-bar backgrounds need discussion first.
- **Status colours only for status**: `--destructive` only for the close button's hover and errors.
- **No hex or `rgb()` inside components.** New colour → add a token first.
- **A new theme needs only 4 colour values**: add an entry in `lib/theme/palettes.ts`.

#### The accent must **actually appear** in the UI

A correct token chain does **not** equal the user seeing the theme colour. Measured: under Dracula a screenshot held only **80 pixels** of accent `#bd93f9` (the 2px active-tab underline) — buttons were `variant="outline"`, the brand block `bg-brand-100`.

- **Welcome-page brand block fills with `bg-primary`**, not a pale background.
- **Every page has at least one `primary` filled button** — welcome-page "open file" is primary (`variant="default"`); secondary actions `outline`.
- After theme-style changes **count accent-coloured pixels in a screenshot**, not token resolution. 80 → about 3700.

### 2.5 Input control contrast requirements

`--input` in dark mode must be **clearly brighter than the background** (`oklch(0.42 0.008 60)` vs background `0.16`).

Rejected: `oklch(0.32)` — settings toggles nearly invisible in dark mode. **Every new toggle, slider and text input must be visually confirmed in dark mode.**

---

## 3. Typography

```css
--font-sans: 'Inter', -apple-system, 'Segoe UI', 'PingFang SC',
             'Microsoft YaHei', 'Source Han Sans SC', sans-serif;
--font-mono: 'JetBrains Mono', 'Cascadia Code', 'SF Mono', Consolas, monospace;
```

Chinese fonts must explicitly list `PingFang SC` / `Microsoft YaHei` / `Source Han Sans SC`, else Windows falls back to a serif face.

### Font size ladder (4 levels only)

| Class | Size | Use |
| --- | --- | --- |
| `text-xs` | 12px | Tab bar, status bar, sidebar lists, form hints |
| `text-sm` | 14px | Default body text, form labels, buttons, menu items |
| `text-base` | 16px | Welcome-page title, dialog titles, Markdown preview h3 |
| `text-lg` | 18px | Welcome-page brand mark (this one place only) |

**No arbitrary values** (`text-[13px]`). A new size means the ladder design is wrong — discuss first.

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

96px fixed; rest → content. Change → re-verify at 720×480.

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

Hit area ≥ `size-5` (20px); title-bar window buttons `size-9` (36px).

---

## 5. Radii and Borders

| Class | Use |
| --- | --- |
| `rounded-none` | Title-bar window buttons |
| `rounded-xs` | Small markers, close buttons |
| `rounded-md` | List items, cards, inputs, tooltips |
| `rounded-lg` | Welcome-page brand block, `primary` button |
| `rounded-full` | Switches, unsaved dot, progress bar |

Borders `border-border-subtle`, only between hierarchy levels; layer by background. Accent: active tab top `h-0.5 bg-brand-500`.

---

## 6. Component-Library Conventions

### 6.1 Prefer the Component Library over Native Tags

Use shadcn-svelte in `src/lib/components/ui/`:

| Need | Use | Do not use |
| --- | --- | --- |
| Button | `Button` | `<button>` |
| Text input | `Input` / `Textarea` | `<input>` / `<textarea>` |
| Switch | `Switch` | `<input type="checkbox">` |
| Dropdown select | `Select` | `<select>` |
| Dialog | `Dialog` | `<dialog>` |
| Icon button + hint | `Hint` (see 6.3) | bare `Button` + manual Tooltip |
| Scroll area | `ScrollArea` | `overflow-auto` |
| Shortcut display | `Kbd` | `<kbd>` |
| Label badge | `Badge` | hand-written span |

Native only for tab-bar items, recent-file rows, image-viewer container (`draggable`, `transform` zoom) + one-line comment.

### 6.2 State Variants Must Be Declared by app.css

Never delete `@custom-variant` in `src/app.css` — maps bits-ui `data-state="checked"` → `data-checked:`; deletion kills switch/selected/expanded styling ([../memory/decisions.md](../memory/decisions.md)). New variant → add matching `@custom-variant`.

### 6.3 The `Hint` Wrapper

All icon buttons use `src/lib/components/common/Hint.svelte`:

```svelte
<Hint label="Toggle sidebar · Ctrl+B" onclick={toggleSidebar}><PanelLeft class="size-4" /></Hint>
```

Adds Tooltip, `aria-label`, hover, hit area. Props: `side` (`bottom`), `active` (toggle bg), `danger` (red hover), `class` (`size-7`). No `TooltipProvider > TooltipRoot > TooltipTrigger > TooltipContent` chains.

### 6.4 `Select` Must Be Passed `items`

`items` required — else the closed menu shows raw values (`system`, `utf-8`); bits-ui reads no option text while closed:

```svelte
<Select type="single" value={v} onValueChange={f} items={items}>
  {#each items as item (item.value)}<SelectItem value={item.value} label={item.label}>{item.label}</SelectItem>{/each}
</Select>
```

---

## 7. Icons

`@lucide/svelte` (not `lucide-svelte`), line style, default `stroke-width`. Forbidden: emoji icons; mixed libraries.

### App Brand Logo

Brand mark: fixed colours (dark ground / seed / amber cursor / hands), never theme-tinted; buttons: Lucide + theme tokens.

Only source `app-icon.png` (repo root); `pnpm icons` → `src-tauri/icons/` + `public/logo.png`, `public/favicon.png`, `public/favicon.ico`. Never edit derived icons.

Windows ICO / PNGs / frontend brands: crop ~8.3% padding per edge; macOS ICNS keeps the canvas. Source change → re-check `scripts/generate-icons.mjs` + 16/32/48px. Rust build watches `icons/`; `windows/installer-hooks.nsh` clears the icon cache. `common/AppLogo.svelte` (welcome page, title bar, app menu) — no added background/radius/shadow; empty alt when adjacent. README: `128x128@2x.png`.

Icons in use:

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

One icon per feature (6.3, 12).

### Why "Actual Size" Is `SquareDot`

Rejected: **text** `1:1` — reads as "aspect ratio 1:1", not "100% zoom". Candidates at 14px:

| Candidate | Why rejected |
| --- | --- |
| `Scan` `Fullscreen` `Focus` `ScanSquare` | Corner brackets collide with `Maximize` ("fit window") |
| `Maximize2` `Expand` `Scaling` `MoveDiagonal` | Arrows collide with zoom in/out |
| `Crop` `Frame` `Ratio` | Aspect-ratio confusion |
| `SquareDimensions` `Ruler` `RulerDimensionLine` | Size / measurement, not pixel scale |
| **`SquareDot`** | One pixel dot in one pixel cell |

`SquareDot` + `Maximize`: antonym shapes (expand vs fixed).

## 8. Interaction states

Four states on every clickable element:

| State | Behaviour |
| --- | --- |
| Default | colours from semantic tokens |
| Hover | `hover:` changes background or text colour, `transition-colors` |
| Focus | `:focus-visible` gets a 2px brand outline from app.css globally |
| Disabled | `disabled:opacity-50 disabled:pointer-events-none` |

**Never remove the focus ring** — no `outline-none` without equivalent feedback.

`transition-colors` or `duration-100`~`200`; layout props (`width`, `height`) only on sidebar collapse (`transition-[width] duration-200`). **Never `all`**. `prefers-reduced-motion` is global.

---

## 9. Copy / wording rules

UI copy always via the i18n dictionary; no Chinese literals in components.

| Location | Rule | Example |
| --- | --- | --- |
| Button | verb + noun, 2–4 characters | New file / Open file / Replace all / Restore defaults |
| Menu item | noun or verb phrase | Settings / Shortcuts / Light / Dark |
| Status | noun phrase | Ready / Image / Large-file mode / Asleep |
| Empty state | state the fact + the next step | No files opened yet / Drop a file into the window, or press Ctrl+O |
| Error | state the cause, no jargon | No access permission: xxx (not `EACCES`) |
| Confirm dialog | question + explicit consequence | "xxx" has unsaved changes. Save? |

Numbers and paths use `tabular-nums`.

### Internationalization (i18n)

Chinese + English; default `navigator.languages` (starting with `zh` → Chinese, else English); overridable in settings.

**No i18n framework** — 2 languages, ~160 strings; no lazy packs, plural rules or date/number localization. Dictionary + `t()`.

#### Structure

```
src/lib/i18n/
  locale.ts         language tag + system detection (pure)
  locale.svelte.ts  current language as $state (**must be .svelte.ts**)
  messages/en.ts    English — dictionary shape source
  messages/zh-CN.ts Chinese — same type
  index.ts          t() + re-exports
```

**`locale` must be in `.svelte.ts`** — runes work only in `.svelte`/`.svelte.ts`; a plain `.ts` throws `rune_outside_svelte` at startup, **white-screening the app**; `svelte-check` misses it.

#### Type safety

`Messages = typeof en`; Chinese file same type → missing/extra key = compile error; `t()`'s key type-constrained (English fallback ships gaps).

**No `as const` on the English file** — narrows values to literals (`'Save'` not `string`); Chinese `'保存'` fails typecheck.

#### Usage

- Placeholders `{name}`, e.g. `t('tab.close', { name: tab.name })`; missing argument stays verbatim (UI shows `{name}`).
- Plurals `{ one, other }` by `count`; Chinese one form, English 1 vs rest.

#### What must not go into the dictionary

- **Code comments** — stay Chinese.
- **`console.*` logs** — always via [`log.ts`](../../src/lib/utils/log.ts).
- **Language names** — own language only (「简体中文」, `English`), never translated.

#### Native dialog button copy gotcha

Custom button copy → platforms return the button text, not `Yes`/`No`; capture once, share with the comparison — re-reading breaks on language switch (`close-tab.ts`, `save-file.ts`).

### Numbers in the status bar must carry labels

Every status-bar item needs a label or `title` tooltip (`Line 19, Col 17`, not `19:17`); `UTF-8`/`CRLF` stay bare.

| Item | Display | Tooltip |
| --- | --- | --- |
| Cursor position | Line 19, Col 17 | Cursor position (line:col) |
| Language | JavaScript | — (self-evident) |
| Encoding | UTF-8 (**clickable**) | Reopen with encoding… |
| Line endings | CRLF (**clickable**) | Convert line endings… |

**Encoding must be clickable** — detection is never fully right (Big5 / Shift_JIS / BOM-less UTF-16LE misdetect as GBK); untitled tab → non-clickable.

**Line endings are clickable too** — CRLF into git shows the whole file as changed, and a stray `\r` breaks shebangs. Converting must be possible in place.

The conversion is a **field change plus a dirty flag**, not a rewrite: the backend already normalises every newline to `\n` on load and reapplies `tab.lineEnding` on save, so nothing in the document changes until the user saves. No confirmation dialog is needed (unlike encoding, which re-reads from disk and would discard edits). Binary tabs are not convertible.

### Popovers with a bounded list need a plain scroll container, not `ScrollArea`

**Rule: a popover list uses `overflow-y-auto` + `max-h-*`.** Used by the encoding and line-ending pickers.

Rejected: `ScrollArea`. Its viewport carries `size-full` (`height: 100%`), and against a parent that only has `max-height` a percentage height resolves to `auto` — the viewport grows with the content, never overflows, and **never scrolls**. Measured: `clientHeight` 418 = `scrollHeight` 418, i.e. immovable; with `overflow-y-auto` it becomes 256 / 418 and scrolls.

`app.css` already restyles raw scrollbars globally, so nothing is lost by not using the component.

**In a pick-one list, every row must show a marker**: a filled check for the current item, a hollow dot for the rest. Rejected: drawing the check only on the selected row — the column then reads as plain text and nothing signals that the rows are selectable. Both markers take the same width (`size-3.5`) so the labels stay on one left edge.

**The encoding list needs no scroll container at all.** `SELECTABLE_ENCODINGS` has 9 entries ≈ 313px total, and the minimum window height is 480px, so the whole list fits. Adding a scroll container costs a layer of interaction (the user must first discover it scrolls) and a scrollbar inside a popover looks worse. Rule: **add scrolling only when the content can actually exceed the available height.**

### The image viewer has its own context menu

Text and images get **different** menus, because they support different actions.

| Menu | Contents |
| --- | --- |
| Editor (text) | Cut, Copy, Paste, Copy path, Show in folder, Find, Go to line, Select all |
| Image viewer | Copy image, Save image as…, Copy path, Show in folder, Rotate left/right, Flip H/V, Reset transform, Open with external app, Set as desktop wallpaper (Windows only) |

**Copy image copies pixels, not a path** — the two are one row apart and produce completely different results, so they are separated by a rule and use distinguishable icons.

Implementation: `writeImage` accepts a path, PNG bytes, or RGBA. Only **RGBA** works here — the path and bytes branches both need tauri's `image-png` / `image-ico` features, which this project does not enable (`tauri = { features = [] }`). The data URL is therefore drawn to a canvas and read back with `getImageData` (straight, non-premultiplied alpha — exactly what the clipboard wants), wrapped as a `Uint8Array` sharing the same buffer (no copy), registered via `Image.new`, then released with `image.close()` — skipping that leaks the resource table.

Permission: `clipboard-manager:allow-write-image`. `Image.new` needs none of its own — `core:image:default` already includes `allow-new`.

**Save image as copies bytes; it never re-encodes.** The default filename keeps the original extension. Converting formats would need image codecs (a heavy dependency this project deliberately avoids) and would silently discard quality or EXIF data — that should not be a side effect of "save as". The copy goes through `atomic::write_bytes`, not `fs::copy`, so a failed write cannot leave a truncated file.

**Set as desktop wallpaper is Windows-only and is hidden, not disabled, on macOS.** There is no reliable public macOS equivalent (it would mean writing `com.apple.wallpaper` or driving AppleScript), so the item would always fail — better absent than permanently broken.

`SystemParametersInfoW(SPI_SETDESKWALLPAPER)` **only accepts BMP**; given a PNG or JPEG it returns success but the wallpaper does not change (silent failure). The image is therefore converted first via .NET's `System.Drawing` in a short PowerShell child process — .NET is guaranteed present on Windows and reads every format, so no codec dependency is added. The temporary BMP is deliberately **not deleted**: Windows records its path, and removing it makes the wallpaper fall back to a solid colour after a restart.

PowerShell paths must use `-LiteralPath`-style escaping (doubled single quotes): `[` and `]` are wildcards to PowerShell and would break ordinary `-Path` handling.

### Rotate and flip are in-memory until saved; the pixels are really redrawn

**Rule: rotation and flip change only the in-memory buffer and mark the tab dirty. The file is written on an explicit save.** Every current viewer works this way (Preview, IrfanView, Photoshop); writing to disk on a toolbar click is legacy Windows Photo Viewer behaviour, not current practice.

Rejected: writing immediately. JPEG re-encoding is lossy — measured `rgb(32,64,128)` → `rgb(30,66,123)` — so an immediate write loses quality on every click and cannot be undone. Rejected: marking dirty without providing a save path — `saveTab` rejects images, so the close prompt would offer a "save" that always errors.

**The pixels are genuinely redrawn on a canvas, never CSS-transformed.** `transform: rotate(90deg)` changes only the display: the box keeps its old dimensions, so the image is clipped or leaves gaps and the scroll range is wrong. The same reasoning already ruled out `transform` for zoom.

The display swap is pre-rendered to a data URL and fed to the existing `<img>`, so fit-to-window, zoom and scrolling need no special cases — they receive an ordinary image.

**Transform state is `(quarter turns, flipH, flipV)`**, not a matrix: 16 enumerable states, easy to compose and to test for identity. The canvas applies flip first, then rotation.

**EXIF orientation does not cause double rotation** (measured with `Orientation=6`: the file is 40×80, `<img>` reports 80×40, the canvas already shows the corrected pixels, and re-encoding **drops the EXIF segment**). That last part is exactly what IrfanView does — change pixels *and* reset orientation to 1 — so other software will not rotate the saved file again. The cost is that the rest of the EXIF (camera, timestamp) is lost; preserving it would mean parsing and rewriting the segment, which is not worth it here.

Shortcuts are `Ctrl+R` / `Ctrl+Shift+R` (rotate) and `Ctrl+H` / `Ctrl+Shift+H` (flip). Rejected: `Ctrl+[` / `Ctrl+]` — those are CodeMirror's indent commands. Rejected: bare `L` / `R` / `H` / `V` as IrfanView uses — `registerHotkeys` calls `preventDefault()` before the handler, so a bare letter would swallow every keystroke of that letter in the editor.

**Re-encoding is confirmed before overwriting a lossy format** (JPEG/WebP/GIF). PNG and BMP re-encode losslessly and skip the prompt, so the dialog does not become noise. The image is always re-encoded in its **original** format; "save as" never silently changes it.

A JPEG that is merely rotated is *not* re-encoded losslessly (no DCT-level path, which would need a JPEG library). The prompt exists precisely because of that.

**Dirty state follows the actual result, not the act of clicking.** `markDirty(id, !isIdentity(next))` — so rotate-left-then-right, or rotate-then-reset, returns the tab to clean. Rejected: marking dirty unconditionally, which made the close prompt ask to save an image identical to the one on disk (reported twice by the user). The same rule applies to the keyboard handler in `Shell.svelte`.

### The image toolbar is grouped, and never reflows

Four groups separated by 1px rules, in order of use: **zoom** | **view mode** | **rotate/flip/reset** | **open externally**. Rejected: eleven flat buttons — the user has to identify each icon to learn which ones belong together.

**Every button keeps its position in all states.** "Reset transform" used to appear only when a transform existed, which pushed every button to its right one slot over and made a hovered click land on a neighbour (reported as UI jitter). It is now always present and merely `disabled`. Measured: all ten buttons keep identical left edges with and without a transform.

**Rejected: a separate "reset zoom" button.** It called the same `setView(true)` as "fit to window" — two buttons, one action, and users had to guess the difference. "Fit to window" carries the active state, which already communicates the mode.

**"Actual size" uses `SquareDimensions`, not `SquareDot`.** The old square-plus-centre-dot said nothing about size; the new icon draws two opposing dimension brackets inside a frame — the standard "measured size" figure — and contrasts with the neighbouring "fit to window" corner arrows. Verified legible at the real 14px.

**No two toolbar buttons may share an icon.** `resetZoom` and `rotateCCW` both used `RotateCcw`; a duplicate is checked for whenever this toolbar changes.

### A file's icon must be the same everywhere it appears

**Rule: every list that shows a file resolves its icon through `utils/file-icon.ts`.** Tab strip, sidebar, and the welcome page's recents all use it.

The tab strip, the sidebar's open list, the sidebar's recents and the welcome page's recents previously each decided icons separately — the welcome page and sidebar hardcoded `FileText` for everything, and the tab strip drew an icon only for images. The same `.png` therefore looked like a text file in two of the four places.

**`kind` and `language` come from the backend, not from the extension in the frontend.** `commands/recent.rs` classifies with the same `lang_map` calls that opening a file uses, so a recents entry can never disagree with the tab it opens. This follows the rule already recorded for the encoding list: a classification owned by Rust must not be re-implemented in the frontend, because the two copies drift.

Image detection is checked **before** language: `image_mime` recognises `.svg`, while `detect_language` calls it `xml` — technically true, but the user should see an image icon.

**Markdown must not share an icon with plain text.** Both mapped to `FileText` at first, which made a `.md` and a `.txt` indistinguishable — the exact problem the icons exist to solve. Markdown now uses `FilePen`. Measured across 12 cases: 10 distinct icons, with image / Markdown / plain text / JSON / HTML all different from each other and similar languages deliberately sharing (`Rust` = `Python`).

`FileJson` is **not exported** by `@lucide/svelte` (the file exists but is absent from `icons/index.js`); JSON uses `FileBraces`.

### Recents rows show where a file is, and reveal it on hover

**Rule: the path column shows the last two directory segments, and turns into a "show in folder" button on hover.** The sidebar shows one segment (it is narrower).

Showing only `basename(dirname(path))` was too terse — two files named `notes.md` in different projects looked identical. The full path is still in `title`; only the tail is shown because the drive and top-level directories are the same on every machine and carry no information. A `…` prefix marks truncation.

Rejected: revealing on hover of the **whole row**. The row-wide `group` covers the path column too, so the path would be replaced by the icon the moment the pointer entered the row — hiding the very thing that column exists to show. A named group (`group/path`) scopes the reveal to that column, so the path stays readable while the pointer is on the filename.

The column keeps a **fixed width** and overlays the two states, so nothing shifts on hover. Measured: `name`, path column and time keep identical left edges with and without hover.

### Decorative feature defaults

Criterion: attention competition, not usefulness.

| Feature | Default |
| --- | --- |
| Indent guides | **on** |
| Rainbow brackets | **off** |

Rainbow brackets (`editor/rainbow-brackets.ts`): off past 200,000 chars (O(n) precomputation); skip brackets in strings/comments — else `printf("(((")` mislevels the rest.

---

## 10. New-component checklist

- [ ] Colours only from section 2.2 semantic tokens, no hard-coded hex
- [ ] Font size on the section 3 scale (10px/11px caption exceptions only)
- [ ] Radius chosen from section 5, no invented values
- [ ] Buttons/inputs/switches/dialogs prefer `ui/` components
- [ ] Icon buttons use `Hint`, with a Chinese `label`
- [ ] Any `Select` is passed `items`
- [ ] Clickable elements have hover, focus and disabled states
- [ ] Copy is Chinese, concise, without polite filler
- [ ] **Eyeballed in both light and dark** (especially contrast of input-type controls)
- [ ] No layout breakage at minimum window 720×480
- [ ] `pnpm check` has zero errors

---

## 11. Known implementation constraints (read before changing styles)

1. **Never delete the `@custom-variant` block in `app.css`** — kills all component state styles.
2. **Dark-mode `--input` brighter than the background** — else switches invisible.
3. **Line-number gutter before folding gutter** (`src/lib/editor/extensions.ts`) — CodeMirror orders gutters by registration; reversed puts the fold arrow left.
4. **CodeMirror search panel needs dark styles** — built-ins assume light (`.cm-panel.cm-search`, `src/lib/editor/themes.ts`).
5. **Icon library `@lucide/svelte`**, not `lucide-svelte`.
6. **Markdown-preview HTML through DOMPurify** — `marked` escapes no raw HTML; never drop it.
7. **Danger buttons: both `hover:` and `dark:hover:`** — `ghost`'s `dark:hover:bg-muted/50` outranks a bare `hover:bg-destructive` (`Hint.svelte`).
8. **`Hint` state classes after the caller's `class`** — `cn` is tailwind-merge; reversed, the caller's `bg-*` eats `active` / `danger`.

## 12. List and action-column layout conventions

Hover action buttons (welcome-page recent files, sidebar lists):

- **Action button shares one slot with adjacent secondary info**: hover fades one in, other out — e.g. time "21 minutes ago" → remove button. No extra row-end column → no header compensation.
- Container **fixed width**, both elements absolute and overlapping; hover toggles `opacity` only. `display` toggle or adaptive width → row width jumps.
- **Never nest `<button>` in `<button>`** — invalid HTML, browser scrambles structure. Clickable row + inner action: inner uses `span` + `role="button"` + `tabindex="0"`, Enter / Space handled manually.
- Action buttons: `focus-visible:opacity-100`.

### Toggle buttons: distinguish by text colour only, icon unchanged

| State | Colour |
| --- | --- |
| On | `text-content` (bright; follows theme foreground) |
| Off | `text-content-faint` (grey) |

**No background colour.** Rejected: brand-coloured bg (too heavy for the status bar); `bg-surface` only (invisible against status-bar bg).

**Icon never changes** — colour alone carries state. Tooltip still spells out "on / off".

Measured (dark theme): active icon brightest pixel 232, inactive 105.

See `active` branch of [`Hint.svelte`](../../src/lib/components/common/Hint.svelte), [`StatusBar.svelte`](../../src/lib/components/layout/StatusBar.svelte).

- **Same-kind controls share one size**: home-page vs sidebar "remove" (`size-3.5` vs `size-3`) visibly differed. Search for other instances before changing an icon size.

### Dialogs with custom buttons return the **button text**, not Yes/No

`message()` (`@tauri-apps/plugin-dialog`) with custom button copy returns **the button text itself**, every platform:

| Platform | Return value |
| --- | --- |
| Windows (rfd `win_cid`) | `Custom("保存")` / `Custom("不保存")` / `Custom("取消")` |
| macOS (rfd `NSAlert`) | `Custom(copy)` |
| Linux (zenity) | `Custom(copy)` |

**Testing for `'Yes'` / `'No'` never works**: `close-tab.ts` tested `answer === 'No'` — never true on Windows → "Don't save" acted as "Cancel", no-op.

Compare the return value against the same button-copy constant. See `askUnsaved` in [`close-tab.ts`](../../src/lib/actions/close-tab.ts).

### Do not write angle-bracketed tag names in a Svelte `<script>` comment

Bracketed tag name in a `<script>` comment parses as **real tag** → `<script>` cannot close: `` `<script>` was left open ``.

**Never bracket a tag name in a comment** — write "style block" or `style block`.

### Verifying styles requires the browser's computed values, not the source

Measure **layout-shape** changes (centering, fitting, alignment) over CDP: Edge `--remote-debugging-port` (headless fine) → `webSocketDebuggerUrl` from `/json/list` → `Runtime.evaluate` `getComputedStyle(el)` + `el.getBoundingClientRect()` + offset from container/window centreline.

**A class name in build output proves nothing** — a declaration is not necessarily computed.

#### Debugging trap: `!important` declarations are reordered to the end by CSSOM

`rule.cssText` moves **`!important` declarations to the end** — truncated out of view, reads as "declaration missing". Measured (Chrome): `width: fit-content !important` written first prints last.

Print the **full `cssText`**, or read `rule.style.getPropertyValue('width')` — never conclude from a truncated string.

**Print full `cssText`, or read `rule.style.getPropertyValue('width')`** — never conclude from a truncated string.

Comments in a rule body do **not** swallow declarations (measured); explanations go above the rule.

### Scrollbars take no space — you must make room manually

bits-ui `ScrollArea` scrollbar is `position: absolute` **overlay**, 10px wide; does not widen the container.

- Scroll-container content needs its own right padding (`pr-3` / `pr-4`), else the scrollbar covers text.
- **Include it in alignment math**: the table header sits outside the scroll container; missing the same value it ends right of the list content — the "Clear"/timestamp misalignment. Current: welcome list `pr-3` + row `px-2` = 20px, header `pl-2 pr-5`; sidebar `p-2 pr-4` = 16px, header and rows both `px-1.5`.
- Buttons carry their own horizontal padding (`px-1.5`), indenting text past the box; `-mr-1.5` pulls the box back so text edges align.

---

## 13. Typography

### The font stack must explicitly include CJK fonts

**Fix: list CJK fonts explicitly.** Monospace fonts (Consolas, JetBrains Mono…) hold no CJK glyphs; English-only stacks fall back to the system CJK font (SimSun on Windows) → English monospace sans-serif, Chinese serif in one line.

CJK list = `CJK_FALLBACK` in [`fonts.ts`](../../src/lib/utils/fonts.ts), **shared by UI and editor fonts** — separate copies drift.

### Font settings

| Setting | Default | Notes |
| --- | --- | --- |
| UI font | empty string | Empty = built-in stack in `app.css`. Non-empty overrides `--font-sans` |
| Editor font | empty string | Empty = built-in default **monospace** stack (independent of UI font) |

**Editor font does not follow UI font**: both defaults display "follow system default" but fall back to `--font-sans` vs `--font-mono`. Monospace is a code-editing baseline.

### Line-number font belongs to the editor

**Gutter follows the editor font, not the UI font** — line numbers share the code's column (VSCode: `editor.fontFamily`).

`.cm-content`-only font leaves the gutter inheriting `--font-sans` from body; `editorFontTheme()` sets both `.cm-content` and `.cm-gutters`.

### Font picker

Popover + searchable list, not a Select — no search, no preview.

- **Loading state required** — directory scan, hundreds of ms first time.
- **Preview text needs Chinese and English** (currently "Sesame sesame 中文 123").
- Entry previews in its own font; font name renders in the UI default font.
- Enumeration failure → default option only; never brick the settings panel.

---

## 14. Editor gutter (line numbers and fold column)

### Fold markers are SVG chevron icons, aligned to their row

VSCode-style chevron: **down** expanded, **right** folded.

**SVG icon only — never CSS borders, never a font character.**

| Approach | Problem |
| --- | --- |
| Font character (`⌄` / `›`) | Varies with user font; weight uncontrollable; smears when small |
| CSS borders | Squeezed by cell; larger `padding` touches edge; reads a size smaller than the line numbers |
| **SVG icon** (current) | Fixed geometry; controllable `stroke-width`; `em` size follows font size |

Path matches Lucide `chevron-down` / `chevron-right`; folded = same path rotated `-90deg`.

1. **Position**: marker is inline text in a fixed-height box on the baseline — measured ~4px below the row's line number. **Fix**: `.cm-foldGutter .cm-gutterElement` → `display:flex` + `align-items:center`.
2. **Padding**: default near zero; icon touches line numbers and border. **Fix**: cell `padding: 0 4px`, icon container `1.25em`. Gutter width derives from content width → column widens, icon unsquashed.

Folded arrow `--brand-600` marks the folded row.

See [../src/lib/editor/fold-gutter.ts](../../src/lib/editor/fold-gutter.ts).

### Line numbers and fold column toggle together

Same **Compartment** — must toggle together: fold markers lose their reference without line numbers. Rejected: fold gutter as fixed extension — disabling line numbers left fold icons visible.

Keep `codeFolding()` when disabled: folding capability + keybindings, no visible element; Ctrl+Shift+[ still works.

### Line numbers are not selectable

`user-select: none` on line numbers and fold column — copying code otherwise drags the digits in. Rule must be `.cm-editor .cm-content`, **not** `.cm-editor` (includes the gutter).

### Line-number left/right padding must be symmetric

Right whitespace reserves one fold-marker width; without an equal left gap the digits look uncentred. Both sides `0.6em`.

### Line-number side gaps are equal, the right one occupied by the fold icon

`[ line-number column: padLeft + digits + padRight ][ fold column: MARKER_SIZE ]`

Digits right-aligned → left gap = `padLeft`, right gap = `padRight + MARKER_SIZE`. Equal ⇒ `padLeft = MARKER_SIZE`, `padRight = 0`.

Remove CodeMirror's default `min-width: 20px`: cell wider than the digits, `flex-end` absorbs the surplus left → left gap exceeds `MARKER_SIZE`. Safe — a hidden spacer sizes from the **max line number**.

Measured (13px font, `MARKER_SIZE = 1.25em`): left 17px, right 18px.

### Line numbers must be flex-centred, not left to the default line box

Line numbers and fold arrows **must share one alignment mechanism** — else they differ by half a pixel to several pixels.

Default: digits on the **line box** (`text-align: right`, no flex); cell height from **body font size** vs digits 1px smaller → line box at top, ink ~1.5px above row centre, arrow flex-centred.

**Fix**: `.cm-lineNumbers .cm-gutterElement` → `display: flex` + `align-items: center`, keep `justify-content: flex-end`.

Measured: centre deviation **≤0.5px** on every row.

### Plain text between icon buttons needs `leading-none` to align with the icons

Toolbar zoom ratio is a **text** element (`适应` / `100%`) between `size-6` icon buttons. Measured (895×70 screenshot, DPR 1):

| Element | Ink centre | vs toolbar content-box centre (52.5) |
| --- | --- | --- |
| Five icon buttons | 53.0 | +0.5 |
| `适应` text | 52.0 | **−0.5** |

Text sits **1px higher** than the icons.

**Root cause: `align-items: center` centres the line box, not the ink.** Line-box height = `line-height`; toolbar inherits `text-[11px]` → `1.5 × 11px = 16.5px`; CJK ink sits high in the em box line.

**Fix**: `leading-none` (`line-height: 1`) on that text element.

Measured (same Chromium + build-output CSS, ink centre via threshold bounding box):

| Fix | Δ (text − icon) |
| --- | --- |
| none | **−1.00px** |
| `leading-none` | **0.00px** |
| `h-6` + flex centring | −1.00px (**useless** — still centres the fractional line box) |
| `text-box: trim-both cap alphabetic` | −0.33px (clips glyphs in mixed CJK/Latin) |

- `inline-flex h-6 items-center justify-center` wrapper still centres that 16.5px line box; offset unchanged. Only `line-height` fixes it.
- Offset present at DPR 1, 2, 4, no threshold drift, but **whole pixels only at DPR 1 (real-machine default)** — verify at DPR 1, never extrapolate from high DPR.

### Gutter registration order

**Line numbers before fold column.** CodeMirror lays gutters out left to right in registration order; reversed → fold markers left of the line numbers.

### Two CSS-variable naming schemes

Tailwind v4 `@theme` generates only `--color-brand-*`; **`var(--brand-500)` in a component or CodeMirror theme resolves to nothing.**

Short names need raw tokens in `:root` (this project does) mapped by `@theme inline`. With only `--color-brand-*`, `:focus-visible`'s `outline: 2px solid var(--brand-500)` was invalid → **focus ring invisible**.

## 15. Save strategy

Two file classes:

| | Existing file (opened) | New file (untitled) |
| --- | --- | --- |
| Path | yes | **no** |
| Autosave | write back to the original file | nothing to write to |
| Ctrl+S | write back | open "Save As" to pick a path |
| Close window | confirm if unsaved | confirm if unsaved |

### Three protection layers

1. **Explicit user save** (Ctrl+S) — end goal.
2. **Autosave** (optional toggle) — after typing stops, write back to the **original file**; path-holding tabs only.
3. **Draft backup** (always on) — unsaved body text → `drafts/` in the app data directory; touches no user file; every tab; only safety net for untitled tabs.

**Draft backup is independent of the autosave toggle** and never user-switchable; autosave off ≠ content may be lost.

### Restore directly on startup, no confirmation dialog

Restore any existing draft. **No modal on the startup path** — keep the choice in the UI. Non-destructive (discard = close the tab). Status line naming the extra tab only when content was restored.

### Atomic writes are the baseline, not an optimisation

**Every save: temp file → fsync → rename** ([atomic.rs](../../src-tauri/src/core/atomic.rs)). **Never overwrite the target in place with `fs::write`** — crash or power loss mid-write → truncated file ("neither old nor new").

1. **Temp file in the target's own directory** — cross-device `rename` is not atomic.
2. **`sync_all()` before rename** — OS-cache flush insufficient; power loss can empty or truncate the target.
3. **Windows: rename fails when the target is in use** (antivirus, indexers). Retry with backoff, then report the error truthfully — **never "delete the target, then rename"** (deleted-but-not-replaced window).

### External-modification conflict: re-check before save + update baseline after

Without a re-check, one Ctrl+S **silently clobbers other changes**.

1. **Fingerprint on open** (`mtime` + size) = persistence baseline.
2. **Re-check before save**: mismatch → `conflict` error, refuse to write. Deleted file also counts; do not resurrect.
3. **Three exits on conflict**:
   - **Overwrite disk** — my content wins, loses the other changes (word this explicitly)
   - **Load disk** — discard my edits, re-read
   - **Save As** — keep both, safest, default
4. **Update baseline on successful save** — else your own write's mtime triggers a conflict on every save.

Rejected: content hash — full read per save; any real write updates mtime.

### When a write cannot succeed, give an exit, not a dead end

Read-only / locked / non-writable-directory saves fail. Never just "Save failed":

- state the reason (Chinese, not an errno)
- offer "Save As to another location"
- user defers → **keep the dirty state**, "your changes are still in the editor"

Content must never be lost to one failed write.

### Why drafts are mandatory

Untitled body text has no disk home: no path, no snapshot body. Measured: "new → type → close window" loses content silently, empty array in `session.json`.

- **Untitled content survives restart** — untitled dirty tab, body intact.
- **Crash protection**: last backup on disk after a force-kill.

### Draft lifecycle

| Moment | Action |
| --- | --- |
| Tab becomes dirty | write a draft after a 2-second debounce |
| Before closing the window | **flush immediately** all dirty tabs' drafts (cannot wait for the debounce) |
| Save succeeds | delete that draft |
| User chooses "Don't save" | delete that draft |
| All tabs handled, window closed | clear all drafts |

Without it, the next launch restores just-handled content ("unsaved changes" after saving).

### Draft deletion must not pre-check "was it ever written"

`dropDraft` early-returned on "written this session", so a disk-restored draft was never deleted, reappearing on restart. Deletion is idempotent (missing file = success): **just call it**.

### Editor search panel: vertical alignment must use flex, not `vertical-align`

All three defects come from `vertical-align` + inline baseline:

| Element | Default approach | Consequence |
| --- | --- | --- |
| Input / buttons | `vertical-align: middle` | not on the same centreline as the checkbox |
| Checkbox | inline, aligned to baseline | sits too high relative to the text |
| Close button | `position: absolute; top: 0` | pinned to the panel top; no size, looks off-position |

**Fix**: panel `display: flex` + `align-items: center`.

- Clear CodeMirror's `margin: .2em .6em .2em 0`; space via container `gap`.
- Checkbox label `inline-flex` + `gap`.
- Close button: 20px hit area; `top: 50%` + `translateY(-50%)`; `26px` panel right padding (absolutely positioned).
- **Change light and dark rules together** — else alignment shifts on theme switch.

**Trap: the button gradient is `background-image`, not `background-color`** (`@codemirror/view`): `'&light .cm-button': { backgroundImage: 'linear-gradient(#eff1f5, #d9d9df)' }`, `'&dark .cm-button'` likewise. `backgroundColor: 'transparent'` **does not override it**; write `backgroundImage: 'none'`, repeated for `hover` and `active`.

### Title bar: skeleton actions left, window actions right

Split by **scope of effect**, not frequency:

| Position | What goes there | Examples |
| --- | --- | --- |
| **Left** | operations affecting the **UI skeleton** | sidebar toggle, settings (gear) |
| **Right** | **window-level** operations | theme switch, minimise/maximise/close |

**The settings entry is a gear, not a hamburger.** Rejected: a hamburger menu holding two items. On desktop the hamburger conventionally means "the menu bar, collapsed" (JetBrains' version contains the whole File/Edit/View bar), so using it for two entries implies there is more inside. A gear means "settings" with no learning cost, and it opens the dialog directly instead of menu-then-item.

**Theme switch is its own button** ([ThemeMenu.svelte](../../src/lib/components/layout/ThemeMenu.svelte)), not inside the settings dialog: high-frequency; 3 options. Rejected: duplicating it — users guess which is real.

Two judgements in `ThemeMenu`; do not merge:

- **Icon: `mode.current`** (resolved theme) — under follow-system `settings.theme` is `'system'`, not a drawable icon.
- **Checkmark: `settings.theme`.** System dark → `mode.current === 'dark'` and `settings.theme === 'system'` both true, so `mode.current` marks both "Dark" and "Follow system" current.

### Menus are split by *what the action belongs to*, not collected into one list

Rule: **app-level → the title bar or Settings; document-level → the tab's context menu; text-level → the editor's context menu.** Rejected: a single flat app menu — it forces the user to read the whole list on every visit, and it hides actions behind an unrelated object.

| Owner | Home | Contents |
| --- | --- | --- |
| Whole app | Title-bar gear → Settings | all settings; Shortcuts and About are tabs inside it |
| A specific file | Tab context menu (`TabItem.svelte`) | Copy path, Show in folder, Close, Close others, Close to the right |
| The tab strip | Blank area right of the tabs (`TabBar.svelte`) | Reopen closed tab, Recently closed ▸, New tab |
| Text content | Editor context menu (`EditorHost.svelte`) | Cut, Copy, Paste, Copy path, Show in folder, Find, Go to line, Select all |

Precedent: VS Code registers `copyFilePath` / `revealInExplorer` in six menus and **`MenuId.EditorContext` is not one of them**; Notepad++ ships `contextMenu.xml` (content) and `tabContextMenu.xml` (tab) as separate files; Sublime documents `Context.sublime-menu` vs `Tab Context.sublime-menu`.

- **Settings and Shortcuts are one surface.** `Ctrl+,` lands on Appearance, `Ctrl+/` on Shortcuts; both open the same dialog. Rejected: a separate shortcuts dialog — two dialogs imply they are unrelated features (JetBrains and Notepad++ both nest the keymap inside Settings).
- **The version number is read at runtime** via `getVersion()`, never hard-coded. Rejected: a hand-written copy drifts from `package.json` / `Cargo.toml` / `tauri.conf.json`.
- **Unavailable items are disabled, not hidden**, and an empty submenu shows one greyed line rather than collapsing.
- **Tab-strip blank area keeps `min-w-6`**: with many tabs it must stay clickable, or "recently closed" becomes unreachable.
- **The editor menu owns Cut / Copy / Paste.** Blocking the native menu removes the only built-in entry point for them (CodeMirror exports no clipboard commands), so they must be re-provided; order follows VS Code's `9_cutcopypaste` group. Copy/cut act on the DOM selection; paste reads the clipboard via the Rust plugin and dispatches a CodeMirror transaction (never DOM surgery — that would skip undo history and the dirty flag).

### Clipboard access goes through Rust, never `navigator.clipboard`

**Rule: reading or writing the clipboard uses `tauri-plugin-clipboard-manager`** ([clipboard.ts](../../src/lib/utils/clipboard.ts)).

The Web Clipboard API's permission model exists **for web pages**: a page is untrusted, so reading the clipboard needs explicit user consent, and `readText()` rejects when it is denied. A desktop app has no such premise — the user installed it, and the clipboard is their own. Using the Web API turns Paste, one of the most basic editing actions, into something that can raise a permission prompt.

Rejected: `navigator.clipboard.readText()` — prompts for permission; rejected: `try { await navigator.clipboard.writeText() } catch { execCommand }` as the primary path — it worked, but only because the app happens to be a secure context, and it left the prompt risk on the read side.

Scope is deliberately minimal: `capabilities/default.json` grants **only** `clipboard-manager:allow-read-text` and `allow-write-text`. The plugin's own `default` set is empty by design ("the clipboard can be inherently dangerous"), which matches this project's allow-list policy.

Cut/Copy are the exception: they must act on the **editor's selection** (copy reads it, cut also deletes it), which is a DOM-selection operation, so they use `document.execCommand('copy' | 'cut')` — CodeMirror mirrors its selection onto the DOM selection, so this works. `execCommand` also stays as the write fallback if the plugin call fails.

Both sides must share a major version: `Cargo.lock` and `package.json` are pinned to the same `@tauri-apps/plugin-clipboard-manager` / `tauri-plugin-clipboard-manager` release.

### All native WebView menus and DevTools are blocked, app-wide

**Never let the WebView show its own context menu anywhere.** Rejected: allowing it in text inputs — in a text editor those items ("Reload", "Save as", "Print", "Inspect") have nothing to do with the task, and "Inspect" turns the window into a debugger.

Two independent layers, both required:

1. **Rust** — `SetAreDefaultContextMenusEnabled(false)` and `SetAreDevToolsEnabled(false)` in `harden_webview` ([lib.rs](../../src-tauri/src/lib.rs)). Both live on the base `ICoreWebView2Settings`, so no `cast` is needed.
2. **Frontend** — a single `window` listener in [`context-menu-guard.ts`](../../src/lib/utils/context-menu-guard.ts), installed **before** `mount()` in `main.ts`. Rust covers Windows only (WKWebView has no equivalent switch) and its call may fail without stopping startup, so the frontend cannot assume it worked.

**The frontend listener must use the bubble phase, never `{ capture: true }`.** `preventDefault()` cancels the browser menu but does not stop propagation, which is exactly how the custom menus work: bits-ui listens for `contextmenu` on its own element and renders in place. Capture phase would run before the component sees the event, and any future `stopPropagation()` would kill every custom menu at once. Verified: the custom-menu handler fires first, the guard last.

**One global listener, not per-component `oncontextmenu`.** Per-component handlers are guaranteed to be missed whenever a new surface is added.


### Status bar: no placeholder text in the empty state

No file open → status bar **shows nothing**, no "Ready": a placeholder; the bar carries current-file facts (line/column, language, encoding, line endings).

### Action feedback: one line of status text in the title-bar centre, not toast

**No toast; no `svelte-sonner`.** [StatusLine.svelte](../../src/lib/components/layout/StatusLine.svelte) + [status.svelte.ts](../../src/lib/state/status.svelte.ts).

#### Why toasts were dropped

Rejected for confirmations: intrusive (self-dismissing card); positionally meaningless; redundant (dirty dot clears, status bar updates).

**Fix**: one short line (icon + text) in the title-bar centre, auto-dismissing after a few seconds.

#### The title-bar centre no longer shows the file name

Tab bar already shows the name <40px away; this space shows whether the last action succeeded.

#### Status line vs native dialog: the division of labour

| Purpose | Form | Example |
| --- | --- | --- |
| **Inform** (no user decision) | Title-bar status line, auto-dismiss | Saved; disk contents loaded |
| **Decide** (user must choose) | Native `message()` dialog | Overwrite disk / load disk / save as; save / don't save / cancel |

**A decision must never be a single line that disappears**; "Saved" must never raise a click-requiring dialog.

#### Duration tiers by tone

| Tone | Duration | Colour |
| --- | --- | --- |
| success | 2.2s | green |
| info | 2.6s | secondary text colour |
| warning | 4s | amber |
| error | 6s | destructive |

**Consecutive calls replace the previous message; never queue.**

#### Two easily missed details

1. **Animation key = incrementing sequence number, never the text** — identical text means `{#key}` on text never remounts; only auto-incremented `seq` replays the fade-in.
2. **Clear "Saved" on the next edit** — else the title bar says "Saved" while dirty. Clear only `success`; errors and warnings must not be interrupted by a keystroke.

#### Keep the copy short

"Saved", not "File saved successfully"; "Not saved, changes are still in the editor", not a full sentence. Long text truncates.

#### Colour the icon and text only — no background fill

A fill reads as a system notification. Four tones = one icon + one text colour each.

### WebView2 browser accelerator keys must be disabled

WebView2 (Chromium) ships **browser** accelerators: `Ctrl+F` find bar, `Ctrl+P` print, `F3` next match, `Ctrl+plus` zoom — web-page features, not app features.

Fix: `SetAreBrowserAcceleratorKeysEnabled(false)` in `harden_webview` ([lib.rs](../../src-tauri/src/lib.rs)). Keeps copy/paste/select-all. Same call also disables the native context menus and DevTools — see "All native WebView menus and DevTools are blocked, app-wide".

`Cargo.toml` must declare both `webview2-com` and `windows`, **versions matching wry's in `Cargo.lock`** — else COM types incompatible.

### A navigation guard must be installed, denying external navigation by default

Tauri default **allows all navigation** (`|_, _| true`): one external link click in the Markdown preview replaces the app UI with a web page; no address bar, no back button — restart only.

1. **Frontend** (`MarkdownPreview.svelte`): event delegation intercepts `<a>` clicks, hands `http(s)` links to the `opener` plugin's `openUrl`.
2. **Rust** (`navigation_guard` in `lib.rs`): allow only the app's own origin, deny the rest — the backstop.

No `.on_navigation()` on the window (`tauri.conf.json`-declared, no `WebviewWindowBuilder`) or on `tauri::Builder`; **plugins** have the hook. Mount the guard on a minimal plugin.

---

## 16. Known implementation traps (read before changing code)

### Svelte 5: runes only work inside `.svelte` / `.svelte.ts`

Runes in plain `.ts` → `rune_outside_svelte` **at startup**, blanking the app; `svelte-check` misses it.

**Rule: a rune-declaring module's filename must end `.svelte.ts`** — types and pure functions in `.ts` (`i18n/locale.ts`), state in its own file (`i18n/locale.svelte.ts`).

### Svelte 5: `$derived` does not update when reading a plain `Set` / `Map`

`$derived` recomputes only on a **reactive source it read**; plain `Set` / `Map` mutation emits no signal → computed once, stale forever.

**Rule: collection state read by `$derived` / the template must be reactive** — here `$state.raw` over an immutable object, replaced wholesale:

```ts
let loading = $state.raw<Record<string, boolean>>({});
loading = { ...loading, [id]: true }; // wholesale replace → reading loading[id] tracks
```

Rejected: `Set` of loading ids (`state/images.svelte.ts`) read by `isLoading()` + `$derived` (`ImageViewer`) — `loading` stuck `false`.

### CodeMirror: `updateListener` does not fire for the initial state

Runs on first edit or scroll, never at view creation → a "first computation" breaks on open. Rejected: indent guides + bracket rainbow via `StateField` + `updateListener`.

**Use `ViewPlugin`**: constructor runs at view creation (covers initial state); holds the `EditorView`, so it reads `visibleRanges` directly.

### CodeMirror: precomputed caches go in `StateField`, decorations in `ViewPlugin`

Pre-viewport state (e.g. bracket depth at line start) is not computable from the visible range.

- `StateField`: caches it (depth per line start), recomputed once per document change.
- `ViewPlugin`: reads the cache, decorations only — O(visible lines) per scroll.

Rescanning per scroll is O(n) at EOF.

### Scanning text: skipped ranges need a cursor that only advances

Ranges not counted (strings/comments): **no** per-character linear search — O(characters × ranges), unusable at hundreds of thousands of characters. `syntaxTree.iterate` yields **ascending** positions → one forward-only index, amortised O(1) (`scanBrackets`).

### CSS: `background-repeat: repeat-x` makes the gradient fill the whole line

Two conflated "repeats" → dense striping, one guide every 2 characters: `background-size: 2ch` = width of **each gradient** only; `background-repeat: repeat-x` repeats that copy across the **whole line**.

Fix — two layers: **outer** `no-repeat`, `background-size` = the line's indent width (per-line inline CSS variable); **inner** `repeating-linear-gradient` at indent steps.

### Svelte 5: an `$effect` calling an external function that reads and writes the same state needs `untrack`

`$effect` tracks **every** reactive value read during synchronous execution, so a callee reading and writing the same state (`ensureImage`: reads `images` / `loading`, writes `loading`) re-triggers it via that write — converging only because the second pass early-returns, else an infinite loop. Wrap such calls in `untrack()`.

### Internal paths use forward slashes; convert to native separators before showing the user

`paths::to_slash()` (Rust) normalises to forward slashes (`C:/Users/...`) — an **internal convention**; cross-platform comparison and dedup rely on it, unit tests pin it. Measured: `Ctrl+Shift+C` copied `C:/Users/PC/AppData/Local/Temp/x.txt` — PowerShell accepts it; cmd.exe `cd`, build scripts, and the Run dialog do not.

**Rule: `tab.path` is internal; never display it or hand it to a system shell.** Convert via `toDisplayPath()` (`file-actions.ts`) — Windows → `\`, macOS `/`; `copyPath` / `revealInFolder` both convert.

### Indent guides: use the community library, do not hand-roll

**Use `@replit/codemirror-indentation-markers`; do not implement it yourself.**

Rejected: three hand-written versions — broken lines, gutter-border hugging, misalignment, faint text via `opacity`. Library: `::before` (`z-index: -1`, `left: 2px`) + `IndentationMap`.

- **`markerType: codeOnly`, not `fullScope`** — `fullScope` draws to the **end of the scope**, dangling contentless lines after an object literal (measured: to the editor bottom); `codeOnly` stops at the last non-empty line.
- Colour as `var(--indent-guide)`; mapped to `--indent-marker-bg-color`; CSS variables nest, so it follows `:root` / `.dark` on theme switch.

### Editor gutter: separate with whitespace, not lines and colour blocks

Gutter and body share the **same background, no divider line**; separation is whitespace — line numbers 1px smaller than body text, lighter colour. Rejected: darker background + 1px right border — split the left half into colour blocks.

- **`border: none` does not clear that divider**: `&light .cm-gutters` adds it via `&.cm-gutters-before { borderRightWidth: 1px }`, **more specific** than `.cm-gutters`; write `&.cm-gutters-before { borderRightWidth: 0 }`.
- **`.cm-activeLine` / `.cm-activeLineGutter` need matching backgrounds**, else the highlight band breaks at the boundary (10x chroma apart).

### Matching-bracket highlight: follow "whose colour it is"

Cursor-adjacent bracket gets a tint layer; colour depends on rainbow brackets — the rainbow span wraps `.cm-matchingBracket` (**inner**) as its **direct parent**.

| Case | Tint colour | Selector |
| --- | --- | --- |
| Rainbow on | that bracket's **own colour** | `[class*="cm-rainbow-"] > .cm-matchingBracket` |
| Rainbow off | **accent** `--brand-500` | `.cm-matchingBracket` |

First is more specific (extra parent qualifier) → overrides the second, **no `!important`**.

- `currentColor`: the inner span inherits the outer rainbow colour → `color-mix(in oklch, currentColor 22%, transparent)` gives a same-hue tint.
- Parent matched by attribute prefix `[class*="cm-rainbow-"]` → 3 → 4 levels later needs no change.
- Dark theme opacity 28-30%.
- Rejected: hardcoded `oklch(0.88 0.06 62 / 0.5)` (beige) — coloured brackets turned beige, ignored accents.

### CSS `transform` does not change the layout box size

Images laid out at scaled `width / height` → scroll range = true size. Rejected: original-size image + `transform` — overflow persisted when scaled down.

- Fit-to-window = visible area − 16px padding all sides; no upscaling; `ResizeObserver` tracks window/sidebar/tab changes. "Reset" and default zoom → fit-to-window; original size = 100%; range 1%-800%.
- Ctrl + wheel zooms at the pointer; plain wheel scrolls; non-passive listener cancels page zoom; deltas normalized by pixel / line / page.
- Space = hand mode; left-drag pans with pointer capture; exit on Space release, tab switch, window blur; inputs/dialogs do not intercept Space.
- No focus outline on canvas/editor; hand mode focuses the canvas → no focus ring on the last-clicked toolbar button; button / input / tab hints remain.
- Centering: `max-content`, `min-w-full / min-h-full`, grid centering — centred below viewport, scrollable to all four edges above.
- Status bar: pixel dimensions, file size, format; toolbar: zoom, reset, fit-to-window, original size, "Open with external program".
- External open: Windows → system app picker; macOS → installed `.app`. Installer registers OpenWithProgids, SupportedTypes, RegisteredApplications/Capabilities; NSIS + MSI from the `tauri.conf.json` file-type list; UserChoice default never modified.
- Window `visible: false` in config, then `show()` in `setup()`. **Not** restored by `tauri-plugin-window-state` — that plugin is gone (see below); if `show()` is ever removed, the window never appears.

### The shortcuts panel must match the real bindings

The shortcuts list (`common/ShortcutsList.svelte`, shown in Settings → Shortcuts) takes editor shortcuts from CodeMirror keymaps, not this project — **verify against `node_modules/@codemirror/*` first.**

Errors: `Ctrl+H Replace` (`searchKeymap` has no `Mod-h`); `Ctrl+Shift+Z Redo` (`historyKeymap` uses `Mod-y`; Windows/Linux use `Ctrl+Y`; `Ctrl+Shift+Z` works only on macOS and Linux). Built-ins live in `EDITOR_HOTKEYS` (`utils/hotkeys.ts`).

### Window: fixed 900×900, centred, position and size never remembered

**Rule: every launch opens at 900×900 in the centre of the screen.** `width`/`height`/`center` in `tauri.conf.json` and `tauri.macos.conf.json`.

Rejected: `tauri-plugin-window-state`. It recorded position/size and restored them, so a window the user nudged once reappeared somewhere else at a different size — which reads as "it did not start the way I expect" rather than as a convenience.

**Removing it has a non-obvious consequence.** The config sets `visible: false` (build the window first, show it once the frontend is mounted, to avoid a white flash), and that plugin was what called `show()`. Because its `restore_state` runs `should_show = state.visible; if … { self.show()? }`, dropping the plugin without adding an explicit `show()` leaves the window permanently invisible. `setup()` in `lib.rs` now calls `window.show()` and `set_focus()` itself.

No capability is needed for `show()`: `core:default` includes `core:window:default`, which covers it.

### Icon buttons need `bg-clip-border`, or the hover fill leaves a 1px ring

**Rule: `Hint` appends `bg-clip-border` to every icon button.**

Cause: the component library's Button base carries `border border-transparent bg-clip-padding`. `background-clip: padding-box` means the background is **not painted on the 1px border area**, so a hover fill stops one pixel short on every side and the title-bar colour (`--surface-sunken`) shows through — a visible white ring around the red Close button (measured: left and right each 1 px short).

Fix: `background-clip: border-box` → the fill covers the full 36×36. Layout is unchanged (the border stays 1px and transparent). Measured before/after: insets `left=1 right=1` → `left=0 right=0 top=0 bottom=0`.

Applied in `Hint` rather than only on the Close button: the cause is identical for every icon button; pale hover fills (`hover:bg-muted`) merely hide it because they are close to the bar colour.

**Tailwind v4 generates classes on demand** — `bg-clip-border` only enters the build because the string is now present in source. Referencing a class that appears nowhere produces no rule, which is why an earlier attempt to test it had no effect.

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
