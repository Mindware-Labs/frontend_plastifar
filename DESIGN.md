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

This is a tool for people who sit in it for a full shift, and the interface behaves like a well-ruled ledger rather than a dashboard. Everything structural is a hairline: a 1 px rule under the top bar, to the right of the sidebar, under the section tabs, under each table row. There are no cards, no panels-within-panels, no tinted containers to signal "this is a section". White is the working surface, `#f5f5f6` is the resting surface, and the difference between them is the only tonal move the system makes.

Colour is used as a signal and nothing else. Pantone 185 C red appears on the primary action, on the active navigation state, on focus, and on the granted cell of the permission matrix — nowhere as decoration. Green 348 C means healthy or valid. Amber means intermediate, pending, or changed-but-unsaved. Everything else is grey, and the grey scale is fine-grained enough (five neutrals for text and three for rules) that hierarchy comes from weight and value rather than from boxes.

Density is deliberate and consistent. Table rows land at 32–40 px, form controls at 40 px, criteria-bar controls at 32 px, sidebar module rows at 40 px, the top bar and the sidebar header at 64 px. Two developers build separate modules against this system, and the end user must not be able to tell where one module ends and the next begins; the measurements above are what makes that true.

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
- **Headline** (700, 20px, −0.02em): unused in the panel proper since `ModuleHeader` dropped its page title (the TopBar breadcrumb names the page instead); kept on the ramp for the day a screen genuinely needs a heading between Display and Title.
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

The application frame is fixed and shared: a sidebar on the left (white, hairline right edge) holding the logo and the four modules as a vertical list, and on the right a 64 px top bar (white, hairline bottom) above the page at `32px` horizontal padding, `16px` top and `48px` bottom. The sidebar is 220 px expanded, collapses to 64 px icon-only on its own toggle, and below `lg` it leaves the flow entirely and reappears as an overlay panel — same scrim and dialog shadow as `Modal` — triggered by the top bar's menu button.

**The breadcrumb lives in the top bar, never in the page.** This is an App Shell rule, not a per-page choice: `AppLayout` resolves the current route to a crumb trail (`src/lib/breadcrumbs.ts`) and hands it to `TopBar`, which renders it on the left — mobile-menu trigger, then the trail, then a flexible spacer, then the account menu, all in the same 64 px row; the breadcrumb never adds a row or grows the bar's height. Ancestors are `muted` and, where they have a route, links; the current page is `ink` and semibold and is never a link. Below `sm` the trail collapses to the current page's label alone — the Sidebar already answers "where can I go," so a phone-width screen doesn't also need the full trail. A page contributes nothing to this by default: `resolveBreadcrumb` walks the same `SIDEBAR_NAV` tree (`src/lib/navigation.ts`) that draws the Sidebar, so a route registered there is on the breadcrumb for free. The one thing a page still owns is a record's own name in its own fiche route (`/staff/:id`, `/clientes/:id`, …) — those aren't in the static tree because the id makes them un-registrable in advance. A fiche calls `useDynamicBreadcrumb(name)` (`src/context/useBreadcrumb.ts`) once its data resolves, and the trail's last segment swaps from a generic placeholder ("Colaborador", "Cliente") to the real name; the hook cleans up on unmount and `AppLayout` also resets on every path change, so a stale name from the previous fiche never survives a navigation. `ModuleHeader`'s `backTo` prop is gone — it was a second, duplicate way to say "go back to the list" that the breadcrumb's own ancestor links already say.

Inside the page, every listing screen follows the same vertical order and nothing is inserted between the steps:

1. **Module header** — no title, no summary: the breadcrumb in the TopBar already names the current page, so `ModuleHeader` repeating it as a page-level heading was the same fact twice. What's left is only what the breadcrumb can't say: the primary action, right-aligned on a hairline, and — on a record detail — the section tabs for that record's own sub-views (Datos/Accesos, Datos/Contactos/Historial). A module with neither is just the hairline, holding the page's top edge before the criteria row.
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
- **Sidebar (220 px / 64 px collapsed):** white, hairline right edge. Header row at 64 px holds the logo (the isotipo alone when collapsed) and a collapse toggle. Each module row is 40 px, 17 px Lucide icon plus 13.5px label, a 2 px left border. Active is `ink`, semibold, red left border and a 4 %-alpha red wash; inactive is `muted` medium and darkens to `ink` with a `fill` wash on hover. Collapsed rows keep only the icon, centred, with the label as a native tooltip.

  **All static routes live here, not inside the view.** A module that owns a catalog or a family of sections (Personal, Reportes, Configuración) carries its children as a nested list under a chevron toggle: 32 px rows at 12.5px, indented with a hairline left rule, red text (no wash, no left border) when active. A group opens on its own when the route enters it and stays that way until the person collapses it by hand — that's one small piece of derived-not-effected state, not a stored "last opened" preference. Collapsed (icon-only) mode never shows children: there's no room for the label, so it's a shortcut to the module's first child route, not a flyout. `ModuleHeader`'s `sections` prop still exists, but only for navigation a static menu can't express — the tabs inside a single record's own fiche (a staff member's Datos/Accesos, a client's Datos/Contactos/Historial), where the route carries an id. Every module-level and catalog-level route stopped using it.
- **Section tabs:** the same active language at 13px on the header's hairline, sharing that rule with the module's primary action.
- **Back link:** a small `muted` chevron-plus-label above the title, present only on detail screens.

### Dialogs
Centred, max 512 px wide, 2 px radius, hairline border, dialog shadow, over an `ink`/45 % blurred scrim. The head is a hairline-separated block with the title and optional description; the footer is a hairline-separated `canvas` strip with right-aligned actions. Focus enters the first field, not the close button; Tab is trapped; Escape closes; focus returns to the trigger on unmount. Native `alert`/`confirm`/`prompt` are forbidden — `ConfirmDialog` is the panel's own, with a 40 px square tone tile (red for destructive, amber for reversible-with-consequence) to the left of the copy.

### Select (custom combobox)
The native select is not used: it cannot take the family, the radius, or the colour, and it renders differently in every browser. `Select` is a `role="combobox"` trigger sharing the exact field grammar, with its listbox rendered in a portal so a dialog's scroll cannot clip it. The panel flips above the trigger when there is no room below and closes on scroll rather than chasing it. The selected option is semibold `ink` with a red check; the keyboard-active option takes a `fill` wash.

### Tooltip
`src/components/ui/Tooltip.tsx` — no library behind it. Shows on hover or keyboard focus of its child, hides on the opposite; lives in normal flow above the trigger (`bottom-full`, centred), not a portal, because its one use so far (a contact's name/role/email over an avatar in a table cell) never sits near a clipping edge — if a future use does, give it a portal then, don't add one pre-emptively. Same floating-panel shadow, hairline border and 2 px radius as every other floating surface; text is `ink`, secondary lines `faint`. `pointer-events-none` on the bubble so it never steals the hover it's describing.

### Permission Matrix (signature)
A cross-tabulation, not a form: permissions run down the vertical axis grouped by module, roles across the horizontal. The permission column freezes left and the head freezes top, so at the sixth column it is still clear which row is being marked. Each cell is a 24 px square switch with the same 2 px radius as every other control: granted is an 8 %-alpha red fill with a red check; ungranted is white with a `line-strong` hairline and a grey minus; a role that grants everything shows a lock and is not focusable. A cell changed since load carries a 2 px amber ring at 45 % — the amber says "not saved yet", and it disappears on save.

Its one authored motion is the **crosshair**: hovering or focusing a cell tints its whole row and its whole column to `canvas`. The grid is a single tab stop with roving arrow-key navigation inside it; one stop per cell would cost 96 keystrokes to cross.

### Charts (Dashboard)
Built on `recharts` — the one exception to "no new dependencies" (agreed for this surface, since real hover and a crosshair are not worth hand-rolling in SVG). Grid is `line`, axis ticks are `faint` at 10.5px, no axis lines on the value axis. Tooltip is custom-rendered in the panel's own vocabulary (white ground, `line` hairline, floating-panel shadow, Montserrat labels) — never recharts' default styling.

Every chart on this surface is a single magnitude (ticket count, SLA compliance, activity density), never multi-series identity — so it stays inside the existing semaphore, or a sequential ramp of one hue for density: `brand-red` for the peak/highlighted bar, a light-to-dark `color-mix` step of `brand-red` for the activity heatmap (6%–96%, never pure white or pure red), red/amber/green for the SLA gauge. No categorical chart palette exists in this codebase; if a future chart needs to plot several named series at once, derive and validate one with the `dataviz` skill's method before reaching for a color, and document it here — don't reuse a UI chrome color for series identity.

**Second deliberate exception, requested and confirmed: the Dashboard is a card surface, not a flat one, and it never scrolls as a page.** ~~It never scrolls as a page~~ — superseded below; everything else stands. Every other module in the panel follows the No-Card Rule below; the Dashboard alone wraps every panel in `DashboardCard` (`src/pages/dashboard/DashboardCard.tsx`) — white ground, 16 px radius, a soft two-layer shadow. This is a scoped, disclosed break from uniformity, not a drift: `DashboardCard` must never be imported outside `src/pages/dashboard`, and no other module's tables or panels take a card or a shadow.

**Fourth revision — the current state.** Built directly against a reference the team named "Busza": a bus-operator admin dashboard, studied for composition and density, not colour (its purple accent never made it in — `brand-red` carries the same job here). Three things changed from the pass before this one, each fixing a named complaint:

1. **The page no longer fits one viewport** (superseding the second exception's "never scrolls" line above). A rich tickets table needs room; the page scrolls like every other page now (`main`'s own `overflow-y-auto`).
2. **A tinted canvas, not white-on-white.** `DashboardPage` paints its own `bg-fill` behind everything — `-mx-8 -mt-4 -mb-12` cancels `main`'s padding so the tint reaches the edges, then the same padding is re-applied inside. White `DashboardCard`s read as objects sitting on a surface now, the way the reference's pale-lavender canvas makes its white cards read; every other module stays on plain white, this is local to the Dashboard alone.
3. **Rows, not a sidebar.** The reference never runs a tall sidebar next to a tall main column — it alternates a narrow analytical module and a wider richer one, row by row. This page now does the same: KPI strip, then the three `mono-charts` cards (below), then [`SystemStatusCard` + a small SLA card, stacked narrow | the tickets table, wide], each row full width before the next begins. The table finally gets a full row to itself instead of racing a column of unrelated charts for the same vertical space — that "disconnected sidebar" was the complaint this row structure answers.

**KPI cards.** Icon-and-label ride together as one small unit at the top of the card (a 20 px tinted square, not a big separate circular badge), a disabled "more options" affordance sits top-right (real component, `Tooltip`-explained, not wired to anything yet — honest about why), then a 28 px figure, a filled delta pill (not bare coloured text), and a bar sparkline bottom-right. A tile whose number wants action now (`Sin asignar` > 0, `SLA en riesgo` > 0) carries `emphasis`: a 2 px colour-matched ring around the whole card — the same device the reference uses on its one standout tile — rather than every card being an identical white rectangle. A card earns the ring from its data, never from a fixed list.

**`SystemStatusCard`.** The one intentionally two-tone surface: a white top half (icon, headline, one line of copy) over an `ink` footer strip holding a real timestamp and a working "Actualizar" button that re-runs the mock fetch — mirroring the reference's dark status-and-sync module, built on a colour the panel already uses everywhere else rather than a new one.

**`src/pages/dashboard/mono-charts/` — a literal-structure port, recoloured to house style.** Three components (`MonoRoundedBarChart`, `MonoRoundedDonutChart`, `MonoRoundedStreamChart`) plus their shared tooltip and mobile hook were ported near-verbatim from `github.com/Subhan-code/Amicro--Micro-transitions-` (MIT) — markup, class structure, and behaviour (Col/Fila toggle, hover-scaled donut segments, gradient streams) are unchanged. The original shipped monochrome-dark only (`#181818`/`#131313`, white/`neutral-400` marks); that broke against the rest of the panel, so the palette was swapped for house colours: the card shell is now the same white/`border-line-soft`/soft-shadow surface as `DashboardCard`, the chart stage sits on `bg-canvas`, primary series use `brand-red`, and the stream's second series uses `brand-green` (creado vs. resuelto, the same semaphore the rest of the Dashboard already uses). The donut ranks its segments by magnitude — red for the top category, fading grays for the rest — rather than a fixed categorical palette, since there is no fixed identity per slice to preserve. Confined to this one folder and this one row of the Dashboard; nothing outside `mono-charts/` reads its class patterns, and the dark theme branch was dropped rather than kept dead. Built on `recharts`, already a dependency — no new package was added to ship it.

**Tickets table.** The flagship widget (`TicketsTable.tsx`), and the one place in the panel with its own `ColumnPicker`, toolbar (search + four `Select` filters + filter chips), and disabled-with-tooltip primary action ("Nuevo ticket" — there is nowhere to send it until the real Bandeja exists, and a button that pretends to work is worse than one that says why it doesn't). Status, priority and SLA are never colour-only: every badge carries an icon paired with its label, on the panel's existing four badge tones — no new hues were added for this. Row actions are real `RowAction` icons that fade in on hover or keyboard focus (`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`, `Row`'s new optional `className` prop carrying `group`) rather than sitting lit at all times competing with the data. Below `lg` the table becomes a stack of cards, one per ticket, carrying the same fields in a different shape — never a horizontally-scrolling table squeezed into a phone width.

### Motion
Nine named keyframes, all short and all functional: page-entry rise (0.75s), fade, scrim-in (0.18s), modal-in (0.24s), field-error shake (0.4s), toast-in (0.4s), toast progress, and two very slow ambient drifts used only in the auth background. Everything is disabled wholesale under `prefers-reduced-motion: reduce`.

## Do's and Don'ts

### Do:
- **Do** let the table be the page: full width, hairline rows, first and last cells flush with the module edge.
- **Do** use 40 px controls in forms and dialogs, and 32 px controls in the criteria row and pagination.
- **Do** set every column head in Montserrat 600, 10px, uppercase, 0.08em tracking, in `faint`.
- **Do** give every screen exactly one `ModuleHeader` — section tabs and the primary action on the tab rule, nothing else; the page's name lives in the breadcrumb, not here.
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
- **Don't** add a kicker, eyebrow, or micro-caps line above a heading anywhere in the panel. There is no exception; the one the build used to carry is gone (see below).

### Resolved: the modal eyebrow is gone
`Modal` used to expose an `eyebrow` prop, and this document carried it as a disclosed violation on the grounds that removing it from one module would leave that module's dialogs visibly different from the rest. That reasoning also named the fix — panel-wide, `Modal.tsx` and every call site in one move — and that is what happened: the prop is deleted from `Modal` and `ConfirmDialog`, and all fifteen call sites with it.

Two things went with it. The head's `mt-*` chain became `flex flex-col gap-1`, because with no eyebrow the `mt-1` on the `<h2>` was a stray 4 px offset. And `tracking-[0.14em]` — a fourth tracking value on no ramp, which had been hiding inside the eyebrow's own styles — no longer exists anywhere in the panel.

One call site carried real information rather than decoration: `ChangePasswordModal`'s "Paso 1 de 2" / "Paso 2 de 2". That moved into the dialog title, which is where a step counter belongs.
