---
name: Plastifar Operations Panel
description: An internal panel where the table is the page — hairline structure, one red, and no decoration that does not do work.
colors:
  brand-red: "#e4002b"
  brand-red-dark: "#b8001f"
  brand-red-light: "#f0234a"
  brand-green: "#007c39"
  brand-bio: "#63a70c"
  brand-gray: "#515151"
  ink: "#1b1b1d"
  canvas: "#f5f5f6"
  fill: "#f1f1f3"
  line: "#e7e7ea"
  line-soft: "#f0f0f2"
  line-strong: "#dcdce0"
  muted: "#63636d"
  faint: "#71717a"
  warn: "#9a5c04"
typography:
  display:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  body-compact:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
  action:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10.5px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  edge: "2px"
  pill: "9999px"
spacing:
  hair: "4px"
  tight: "8px"
  snug: "12px"
  base: "16px"
  wide: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-red}"
    textColor: "#ffffff"
    typography: "{typography.action}"
    rounded: "{rounded.edge}"
    height: "36px"
    padding: "0 16px"
  button-primary-sm:
    backgroundColor: "{colors.brand-red}"
    textColor: "#ffffff"
    typography: "{typography.action}"
    rounded: "{rounded.edge}"
    height: "32px"
    padding: "0 14px"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.brand-gray}"
    typography: "{typography.action}"
    rounded: "{rounded.edge}"
    height: "36px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "#ffffff"
    textColor: "{colors.brand-red}"
    typography: "{typography.action}"
    rounded: "{rounded.edge}"
    height: "36px"
    padding: "0 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.brand-gray}"
    typography: "{typography.action}"
    rounded: "{rounded.edge}"
    height: "36px"
    padding: "0 16px"
  control-md:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.edge}"
    height: "40px"
    padding: "0 12px"
    size: "13.5px"
  control-sm:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.edge}"
    height: "32px"
    padding: "0 12px"
    size: "12.5px"
  table-head-cell:
    backgroundColor: "#ffffff"
    textColor: "{colors.faint}"
    typography: "{typography.label}"
    padding: "10px 14px"
  table-cell:
    backgroundColor: "#ffffff"
    textColor: "{colors.brand-gray}"
    typography: "{typography.body-compact}"
    padding: "10px 14px"
  chip-filter:
    backgroundColor: "#ffffff"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 14px"
  chip-filter-active:
    backgroundColor: "{colors.brand-red}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 14px"
  badge-neutral:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.brand-gray}"
    rounded: "{rounded.pill}"
    height: "22px"
    padding: "0 10px"
  badge-red:
    backgroundColor: "rgba(228,0,43,0.08)"
    textColor: "{colors.brand-red-dark}"
    rounded: "{rounded.pill}"
    height: "22px"
    padding: "0 10px"
  badge-green:
    backgroundColor: "rgba(0,124,57,0.08)"
    textColor: "{colors.brand-green}"
    rounded: "{rounded.pill}"
    height: "22px"
    padding: "0 10px"
  modal-panel:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.edge}"
    width: "512px"
    padding: "20px 24px"
  matrix-cell:
    backgroundColor: "#ffffff"
    textColor: "#a1a1aa"
    rounded: "{rounded.edge}"
    size: "24px"
  matrix-cell-granted:
    backgroundColor: "rgba(228,0,43,0.08)"
    textColor: "{colors.brand-red}"
    rounded: "{rounded.edge}"
    size: "24px"
---

# Design System: Plastifar Operations Panel

## Overview

**Creative North Star: "The Working Table"**

This is a tool for people who sit in it for a full shift, and the interface behaves like a well-ruled ledger rather than a dashboard. Everything structural is a hairline: a 1 px rule under the top bar, under the module bar, under the section tabs, under each table row. There are no cards, no panels-within-panels, no tinted containers to signal "this is a section". White is the working surface, `#f5f5f6` is the resting surface, and the difference between them is the only tonal move the system makes.

Colour is used as a signal and nothing else. Pantone 185 C red appears on the primary action, on the active navigation state, on focus, and on the granted cell of the permission matrix — nowhere as decoration. Green 348 C means healthy or valid. Amber means intermediate, pending, or changed-but-unsaved. Everything else is grey, and the grey scale is fine-grained enough (five neutrals for text and three for rules) that hierarchy comes from weight and value rather than from boxes.

Density is deliberate and consistent. Table rows land at 32–40 px, form controls at 40 px, criteria-bar controls at 32 px, module tabs at 47 px, the top bar at 64 px. Two developers build separate modules against this system, and the end user must not be able to tell where one module ends and the next begins; the measurements above are what makes that true.

**Key Characteristics:**
- Hairline structure, no cards — the table is the page.
- One red, spent only on the primary action and the active state.
- A single 2 px radius on every control, the logotype's industrial stroke.
- Montserrat small caps for every label; Poppins for every sentence.
- Depth exists only for things that float above the page.
- Motion is short, functional, and fully disabled under `prefers-reduced-motion`.

## Colors

A near-monochrome working surface with one institutional red used as a signal, a green for health, and a single amber reserved for the in-between.

### Primary
- **Plastifar Red** (`{colors.brand-red}`, Pantone 185 C): the primary button, the active module tab and section tab, the active filter chip, the focus ring (at 10–25 % alpha), the sort-direction caret, the granted cell in the permission matrix, and the required-field asterisk. It never fills a large area and never appears twice in the same role on one screen.
- **Deep Red** (`{colors.brand-red-dark}`): red text on white — inline error messages, the "Administrador" badge label, the sign-out menu item. It is the legible form of the brand red; the brand red itself is a fill colour, not a text colour on white.
- **Bright Red** (`{colors.brand-red-light}`): reserved for gradient and illustrative use in the brand marks. Not used on interface controls.

### Secondary
- **Plastifar Green** (`{colors.brand-green}`, Pantone 348 C): healthy or confirmed state only — the active status dot, the valid-field border and check, the success alert, the "own client" badge.
- **Bio Green** (`{colors.brand-bio}`, Pantone 369 C): avatar palette and brand marks only. It carries no interface state.

### Tertiary
- **Signal Amber** (`{colors.warn}`): intermediate states exclusively — the "sin asignar" pill, the warn tone of the confirmation dialog, the ring on a matrix cell changed but not yet saved. It is a screen-support colour, not an institutional one, and it is darkened to 5.4:1 on white so it can carry text.

### Neutral
- **Interface Ink** (`{colors.ink}`): headings, primary row values, the value a person actually reads. Also the modal scrim at 45 % and the top-bar avatar fill.
- **Institutional Grey** (`{colors.brand-gray}`, Cool Gray 11 C): default body text and secondary table cells.
- **Muted Grey** (`{colors.muted}`): supporting text, pagination copy, icon-button rest state. 5.9:1 on white.
- **Faint Grey** (`{colors.faint}`): the quietest legible tier — column heads, field labels, hints, empty states, permission keys. 4.8:1 on white; this is the floor, nothing lighter carries text.
- **Canvas** (`{colors.canvas}`): the resting surface — page background of the auth area, row hover, modal footer, crosshair tint in the matrix, disabled control fill.
- **Fill** (`{colors.fill}`): the pressed/hover wash under icon buttons, menu items, and neutral badges.
- **Rule** (`{colors.line}`), **Soft Rule** (`{colors.line-soft}`), **Strong Rule** (`{colors.line-strong}`): the three-step hairline scale. Strong bounds an interactive control, plain bounds a structural edge, soft separates rows inside a set.

### Named Rules
**The One Red Rule.** Red marks the primary action and the active state, and nothing else. If a screen shows two reds that mean two different things, one of them is wrong.

**The Amber Middle Rule.** Amber is only ever "not yet": pending, unassigned, changed-but-unsaved. It never means error (that is red) and never means success (that is green).

**The Contrast Floor Rule.** No text sits below 4.5:1 on its own background. `muted`, `faint` and `warn` were darkened to meet that floor; do not lighten them back for aesthetic balance, and do not introduce a fourth grey between `faint` and `line-strong`.

## Typography

**Display Font:** Montserrat (with `ui-sans-serif`, `system-ui`, `sans-serif`)
**Body Font:** Poppins (with `ui-sans-serif`, `system-ui`, `sans-serif`)
**Label Font:** Montserrat, small caps — same family as display, distinct role.

**Character:** Montserrat carries the industrial, geometric weight of the logotype and is used only where the interface names something: titles, labels, buttons, column heads. Poppins is rounder and softer and carries every sentence a person actually reads. The pairing is deliberately narrow — two families, no third voice.

### Hierarchy
- **Display** (700, 30px, 1.12, −0.03em): the auth-area title only. One per screen, and only outside the panel chrome.
- **Headline** (700, 20px, −0.02em): the module title in `ModuleHeader`. Exactly one per page.
- **Title** (700, 17px, −0.01em): dialog titles.
- **Body** (400, 13.5px, relaxed): dialog copy, form-control text, empty states. Long explanatory paragraphs cap at ~76ch.
- **Body Compact** (400, 12.5px): table cells, module summary, pagination, alerts, section tabs at 13px.
- **Label** (600, 10px, uppercase, 0.08em tracking, `faint`): column heads and group heads. Form labels are the same treatment at 10.5px.
- **Action** (600, 11.5px, uppercase, 0.06em tracking): every button, without exception.
- **Code** (monospace, 10.5px, `faint`): machine identifiers such as permission keys. Nothing else is set in mono.

### Named Rules
**The Two Voices Rule.** Montserrat names things; Poppins says things. A label, a column head, a button or a title is Montserrat. A sentence is Poppins. No third family enters the panel.

**The Small-Caps Head Rule.** Every column head across every table in the panel is Montserrat 600 at 10px with 0.08em tracking in `faint`. This is the single strongest signal that two modules were built by the same hand; it does not vary by module, by table width, or by taste.

## Layout

The application frame is fixed and shared: a 64 px top bar (white, hairline bottom, logo left, account menu right), a 47 px module bar below it (white, hairline bottom, tabs with a 2 px red underline when active), then the page at `32px` horizontal padding, `16px` top and `48px` bottom.

Inside the page, every listing screen follows the same vertical order and nothing is inserted between the steps:

1. **Module header** — title with the summary on the same baseline (separated by a 14 px hairline divider, not stacked below it, so the table gains height), section tabs on a hairline, and the primary action right-aligned on that same rule. A record detail replaces the title with the record name and adds a back link above it.
2. **Criteria row** — search (240 px), one or two selects (200–220 px), a vertical hairline, then filter chips with counts. A column picker, when present, is pushed to the far right with `ml-auto`: it does not filter rows, it changes what is looked at, and it must not sit among the filters.
3. **The table** — full width, no wrapper.
4. **Empty state** — a centred single line in `faint` at 13.5px, phrased differently for "nothing exists yet" and "nothing matches this filter".
5. **Pagination** — range on the left, page-size select and page window on the right.

Spacing runs on a 4 px grid: `4 / 8 / 12 / 16 / 24 / 32`. The criteria row and the block above the table both sit at `12px`. Table cells are `10px 14px`.

Layouts must work at 1366 px with no horizontal overflow. Wide tables scroll inside their own container rather than widening the page. Below `sm`, the frozen head and the max-height window in the matrix are dropped: a two-axis scroll box inside a scrolling page is worse than a long page.

### Named Rules
**The No-Card Rule.** Tables are never wrapped in a card, a border, or a tinted panel. The table is the page. Its first cell sits flush with the left module edge and its last cell flush with the right — `first-child` loses its left padding, `last-child` loses its right.

**The Criteria-Bar Rule.** Every control that narrows what the table shows lives in one row directly above the table, at 32 px height. A search field in the top bar reads as searching the whole application; it belongs to the table it filters.

## Elevation & Depth

The panel is flat. Structure comes from hairlines and from the one-step tonal difference between white and `canvas`; no surface that belongs to the page carries a shadow. Shadow is the signal for "this is floating above the page and will go away" — portals, dropdowns, dialogs — plus one soft coloured bloom under the primary button.

### Shadow Vocabulary
- **Primary bloom** (`box-shadow: 0 10px 20px -12px rgba(228,0,43,0.55)`): under the primary button only. It is a tinted glow, not an offset, and it reads as the button being the warm point of the screen.
- **Floating panel** (`box-shadow: 0 4px 8px rgba(27,27,29,0.04), 0 24px 48px -20px rgba(27,27,29,0.28)`): select listboxes, the column picker, the account menu.
- **Dialog** (`box-shadow: 0 4px 10px rgba(27,27,29,0.06), 0 32px 64px -28px rgba(27,27,29,0.45)`): the modal panel, over an `ink`/45 % scrim with a 2 px backdrop blur.

### Named Rules
**The Flat Page Rule.** If an element scrolls with the page, it has no shadow. If it floats over the page, it has exactly one of the two shadows above. There is no third elevation and no hover-lift on page content.

## Shapes

One radius governs every control: **2 px** (`{rounded.edge}`) — buttons, inputs, selects, dialogs, dropdown panels, icon buttons, matrix cells, checkboxes. It is nearly square on purpose: the logotype's industrial stroke. There is no `sm/md/lg` radius scale to choose from, and adding one would be a visible break.

The only fully round shapes are the ones that are conceptually round: avatars, the status dot (7 px), count badges, filter chips, and the clear-search button. A pill means "a small token about a record"; a 2 px rectangle means "a control".

Borders are always 1 px and always from the three-step rule scale. Interactive controls at rest take `line-strong`; structural edges take `line`; row separators inside a set take `line-soft`. The one 3 px element in the system is the accent bar on the left edge of an alert.

## Components

### Buttons
- **Shape:** near-square (2 px), Montserrat 600 small caps at 11.5px with 0.06em tracking, icon and label separated by 8 px.
- **Sizes:** 36 px default in forms and dialogs; 32 px when aligned with section tabs or the criteria row.
- **Primary:** solid brand red on white text, with the primary bloom shadow. Hover brightens 5 %; active nudges down 1 px. One primary per screen region.
- **Secondary:** white with a `line-strong` hairline and grey label; hover fills with `canvas`.
- **Danger:** white with a red hairline and red label — a destructive action is outlined, never solid. Solid red is reserved for the affirmative primary.
- **Ghost:** label only; hover fills with `fill`.
- **Focus:** a 3 px red ring at 25 % alpha, always visible on keyboard focus.
- **Loading:** the label stays and a 14 px spinning ring in the current colour is prepended; the button never changes width by swapping its label for a spinner.

### Chips
- **Filter chip:** pill, 32 px, with a count pill inside it. Inactive is white with a `line` hairline and muted label; active is solid brand red with white text and a white/22 % count. The count is part of the chip, never a separate element.
- **Badge:** 22 px pill, no border, 8 %-alpha tint of its tone — neutral (`fill`), red (privilege), green (own/healthy). Semibold at 11.5px.

### Tables
- **Head row:** one hairline below in `line`, Montserrat small-caps heads in `faint`. A sortable head is a button that darkens to `ink` on hover and shows a red caret when it is the active sort.
- **Body row:** `line-soft` separator, last row loses it, hover tints to `canvas`, a row awaiting an action drops to 60 % opacity.
- **Cells:** `10px 14px`; first and last cells flush with the module edge.
- **Stale data:** while a refetch is in flight the whole table fades to 60 % rather than being replaced by a spinner. A spinner appears only on the first load.

### Inputs / Fields
- **Style:** white ground, 1 px `line-strong` hairline, 2 px radius, 40 px in forms and 32 px in criteria bars. Label above in Montserrat small caps at 10.5px in `faint`, with a red asterisk when required.
- **Hover:** the hairline darkens to zinc-400.
- **Focus:** the hairline turns brand red and a 3 px red ring at 10 % appears.
- **Valid:** green hairline plus a green check inside the right edge — and only after the person has touched the field. The panel never pre-praises and never pre-scolds.
- **Error:** red hairline, a 2 %-alpha red wash, and a message below in `brand-red-dark` at 11.5px with a 14 px alert icon, entering with a short horizontal shake.
- **Checkbox:** the entire bordered row is the hit area; when checked, the row takes a red hairline at 35 % and a 3 %-alpha red wash.

### Navigation
- **Module bar (47 px):** white, hairline bottom, 15 px Lucide icon plus 13.5px label. Active is `ink`, semibold, with a 2 px red bottom border; inactive is `muted` medium and darkens to `ink` on hover.
- **Section tabs:** the same active language at 13px on the header's hairline, sharing that rule with the module's primary action.
- **Back link:** a small `muted` chevron-plus-label above the title, present only on detail screens.

### Dialogs
Centred, max 512 px wide, 2 px radius, hairline border, dialog shadow, over an `ink`/45 % blurred scrim. The head is a hairline-separated block with the title and optional description; the footer is a hairline-separated `canvas` strip with right-aligned actions. Focus enters the first field, not the close button; Tab is trapped; Escape closes; focus returns to the trigger on unmount. Native `alert`/`confirm`/`prompt` are forbidden — `ConfirmDialog` is the panel's own, with a 40 px square tone tile (red for destructive, amber for reversible-with-consequence) to the left of the copy.

### Select (custom combobox)
The native select is not used: it cannot take the family, the radius, or the colour, and it renders differently in every browser. `Select` is a `role="combobox"` trigger sharing the exact field grammar, with its listbox rendered in a portal so a dialog's scroll cannot clip it. The panel flips above the trigger when there is no room below and closes on scroll rather than chasing it. The selected option is semibold `ink` with a red check; the keyboard-active option takes a `fill` wash.

### Permission Matrix (signature)
A cross-tabulation, not a form: permissions run down the vertical axis grouped by module, roles across the horizontal. The permission column freezes left and the head freezes top, so at the sixth column it is still clear which row is being marked. Each cell is a 24 px square switch with the same 2 px radius as every other control: granted is an 8 %-alpha red fill with a red check; ungranted is white with a `line-strong` hairline and a grey minus; a role that grants everything shows a lock and is not focusable. A cell changed since load carries a 2 px amber ring at 45 % — the amber says "not saved yet", and it disappears on save.

Its one authored motion is the **crosshair**: hovering or focusing a cell tints its whole row and its whole column to `canvas`. The grid is a single tab stop with roving arrow-key navigation inside it; one stop per cell would cost 96 keystrokes to cross.

### Motion
Nine named keyframes, all short and all functional: page-entry rise (0.75s), fade, scrim-in (0.18s), modal-in (0.24s), field-error shake (0.4s), toast-in (0.4s), toast progress, and two very slow ambient drifts used only in the auth background. Everything is disabled wholesale under `prefers-reduced-motion: reduce`.

## Do's and Don'ts

### Do:
- **Do** let the table be the page: full width, hairline rows, first and last cells flush with the module edge.
- **Do** use 40 px controls in forms and dialogs, and 32 px controls in the criteria row and pagination.
- **Do** set every column head in Montserrat 600, 10px, uppercase, 0.08em tracking, in `faint`.
- **Do** give every screen exactly one `ModuleHeader` — title, inline summary, section tabs, primary action on the tab rule.
- **Do** reserve red for the primary action and the active state, green for healthy, amber for pending or unsaved.
- **Do** keep the 2 px radius on every control and full-round only on avatars, dots, badges and chips.
- **Do** reuse `Button`, `Select`, `DataTable`, `Modal`, `Field`, `FilterChip` and `Pagination` as they are; a new variant is a team decision, not an individual one.
- **Do** fade a table to 60 % while refetching and reserve the spinner for the first load.
- **Do** state a field's valid state only after the person has touched it.

### Don't:
- **Don't** wrap a table in a card, a border, or a tinted panel.
- **Don't** put a search or filter control in the top bar; it belongs in the criteria row above the table it affects.
- **Don't** add a second radius step, a third font family, or a fourth grey to the ramp.
- **Don't** use solid red for a destructive button — destructive is outlined red on white; solid red is the affirmative primary.
- **Don't** shadow anything that scrolls with the page, and never use a hard offset shadow: the two shadows in this system are diffuse and belong to floating panels only.
- **Don't** lighten `muted`, `faint` or `warn`; they sit at the 4.5:1 floor deliberately.
- **Don't** use `alert()`, `confirm()` or `prompt()` — `ConfirmDialog` exists.
- **Don't** add a kicker, eyebrow, or micro-caps line above a heading anywhere in the panel. See the carried exception below.

### Carried exception: the modal eyebrow
`Modal` exposes an `eyebrow` prop and every dialog in the panel currently passes one (`StaffModal`, `RoleModal`, `ConfirmDialog`, and the Permisos dialogs). This is a violation the build carries, not a rule of this system: it is a kicker above a heading, and new surfaces must not treat it as house style. It survives only because removing it from one module would leave that module's dialogs visibly different from every other module's, and uniformity across modules is a product requirement. The correct fix is panel-wide: when the eyebrow goes, it goes from `Modal.tsx` and every call site at once. Until then, do not add `eyebrow` to any dialog in a new module, and do not introduce a kicker anywhere outside `Modal`.
