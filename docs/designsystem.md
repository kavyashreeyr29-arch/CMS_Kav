# ElevatoHub Design System

**Status:** v1.0 — documents the visual language already implemented in the interactive prototype (`pulse-dashboard.jsx`), formalized for consistent use as the product grows.

---

## 1. Design Principles

1. **Dense but calm.** This is an operations tool people live in for hours — favor compact, scannable layouts over decorative whitespace, but never at the cost of legibility.
2. **Color carries meaning, not decoration.** Every color in the palette maps to a specific status, priority, or role. If a new color is needed, it needs a new meaning first.
3. **Mono for data, Grotesk for identity, Inter for reading.** Numbers, IDs, and timestamps get a monospace treatment so they align and scan predictably; headings get a distinct display face; body copy stays in a plain, highly legible sans.
4. **Every role sees the same bones.** Admin, Developer, and Client all use the same components — cards, chips, tables, modals — just with different content and permissions. Don't fork the visual system per role.

---

## 2. Color

### 2.1 Core tokens

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#F4F5FA` | App background |
| `--surface` | `#FFFFFF` | Cards, panels, modals, tables |
| `--surface-2` | `#EEF0F6` | Recessed surfaces — input backgrounds, table headers, kanban columns |
| `--ink` | `#13161F` | Primary text |
| `--ink-soft` | `#676F82` | Secondary text, labels |
| `--ink-faint` | `#9AA1B2` | Placeholder text, disabled, tertiary metadata |
| `--border` | `#E3E5EF` | Hairline borders throughout |
| `--brand` | `#362F9E` | Primary brand color — buttons, active states, links, focus rings |
| `--brand-soft` | `#EDECFB` | Brand tint — active nav backgrounds, badges, avatar fills |
| `--lime` | `#B4FF39` | Signature accent — logo mark, active sidebar icon only. Used sparingly; never for large fills or body text. |

### 2.2 Semantic / status colors

| Color | Hex | Meaning |
|---|---|---|
| Critical / Danger | `#E2483B` | Critical priority, overdue, reopened status, destructive actions |
| High / Warning | `#F5A524` | High priority, "in progress," due-soon states |
| Medium / Info | `#3B6CF4` | Medium priority, "in review"/"QA testing" status |
| Low / Neutral | `#7C8598` | Low priority, neutral/default status dot |
| Success | `#1DB88E` / `#16946E` | Closed/completed, green health, SLA met |

### 2.3 Ageing scale (sequential, not categorical)

Used for the ticket-ageing heatmap — 5 steps from fresh to stale:

`#1DB88E → #7FD858 → #F5C518 → #F5A524 → #E2483B`
(0–2 days · 3–5 days · 6–10 days · 11–20 days · 21+ days)

### 2.4 Label / category palette

A rotating 10-color palette assigns a consistent color to each issue label (Login Issue, Coupon Issue, etc.) via a deterministic hash of the label name — so a label's color never changes even as labels are added or removed by Admin:

`#362F9E` `#2563EB` `#16946E` `#C87F0A` `#E2483B` `#5B3DE0` `#0EA5A5` `#DB2777` `#7C8598` `#8E5A2B`

### 2.5 Channel colors (notifications)

| Channel | Color |
|---|---|
| Email | `#2563EB` on `#E4F0FF` |
| Microsoft Teams | `#5B3DE0` on `#EDE6FF` (Teams notification cards use the full `#5B3DE0` as a header fill) |

---

## 3. Typography

| Role | Typeface | Weight(s) | Usage |
|---|---|---|---|
| **Display** | Space Grotesk | 500 / 600 / 700 | Page titles, panel titles, KPI values, modal titles, brand wordmark |
| **Body / UI** | Inter | 400 / 500 / 600 | Everything else — labels, buttons, table cells, form fields |
| **Mono / Data** | IBM Plex Mono | 400 / 500 / 600 | Ticket IDs, dates, timestamps, hour/minute counters, email addresses, currency-free numeric stats |

**Type scale (approximate, in px):**

| Use | Size | Weight | Notes |
|---|---|---|---|
| KPI value | 21 | 700 | Space Grotesk |
| Modal title | 15 | 700 | Space Grotesk |
| Panel title | 13.5 | 700 | Space Grotesk |
| Body / table cell | 11.5–12.5 | 400–500 | Inter |
| Meta / label | 9.5–10.5 | 600–700, uppercase, `+0.03em` tracking | Inter, small-caps-style field labels |
| Chips (priority, source, label) | 9.5–10.5 | 600 | Inter |

---

## 4. Spacing & Layout

- Base unit: **4px**. Common increments used throughout: 4, 6, 8, 9, 10, 12, 14, 16, 18, 20, 22.
- Page content padding: `20px 22px 40px`.
- Card/panel padding: `16px 18px`.
- Modal body padding: `20px`.
- Border radius scale: **7px** (small chips/buttons), **8–9px** (inputs, kanban cards), **10–12px** (panels, cards, modals), **20px** (pill-shaped chips/badges), **50%** (avatars, status dots).
- Grid gaps: 10px (KPI grid), 12px (panel rows, project/kanban grids).

---

## 5. Elevation

Elevation is used sparingly and increases with interactivity, not just hierarchy:

| Level | Shadow | Used on |
|---|---|---|
| Resting | `0 1px 2px rgba(19,22,31,0.03)` | Panels, tables, ticket cards at rest |
| Topbar | `0 1px 0 rgba(19,22,31,0.06), 0 4px 14px rgba(19,22,31,0.03)` | Sticky top bar |
| Hover lift | `translateY(-2px)` + `0 8–10px 18–22px rgba(19,22,31,0.06–0.09)` | KPI cards, project cards, kanban cards on hover |
| Dropdown/popover | `0 12–16px 28–34px rgba(19,22,31,0.14–0.16)` | Bell dropdown, role switcher |
| Modal | `0 24px 60px rgba(0,0,0,0.28)` + backdrop blur `2px` on a `rgba(19,22,31,0.5)` scrim | All modals |

---

## 6. Iconography

- **Library:** Lucide icons exclusively, 13–17px depending on context (13 in tabs/buttons, 15–17 in modal headers/sidebar).
- Icons are always paired with a text label except in the collapsed sidebar rail, where a tooltip-equivalent is implied by icon shape alone (dashboard = grid, tickets = ticket, board = trello-style columns, etc.).
- Status is communicated redundantly through **color + icon + text**, never color alone (accessibility requirement — see Section 10).

---

## 7. Core Components

### 7.1 Buttons

| Variant | Style |
|---|---|
| Primary | `--brand` fill, white text, 8px radius, hover = darker fill + lift + shadow |
| Secondary/Ghost | `--surface-2` fill, `--ink` text, no border |
| Destructive | `#FCEBEA` fill, `#E2483B` text (used for "Reopen," "Remove," "Delete") |
| Icon-only | 34×34px, 1px border, `--surface` fill, hover = brand border + brand icon color |

### 7.2 Chips & Badges

All chips share: pill radius (20px), small uppercase-adjacent text (9.5–10.5px), tinted background at ~13% opacity of the semantic color with full-opacity text.

- **Priority chip** — semantic priority color.
- **Source chip** — neutral `--surface-2` background.
- **Label chip** — hashed label color (Section 2.4), includes a small tag icon.
- **Status dot** — 8px filled circle, semantic status color, always paired with the status text.
- **Health dot** — 9px filled circle, green/amber/red, used on project cards.

### 7.3 Cards

- **KPI card:** icon in a tinted 24×24 rounded square, large Space Grotesk value, small label, optional sub-caption. Hover lifts 2px with a soft shadow.
- **Project card:** code chip + health dot header, name, client/PM line, status pill + priority chip, document-folder count, footer row (dates / ticket stats).
- **Kanban card:** colored left border (priority), draggable, ID + grip icon row, title, 2-line clamped description, footer (priority chip + assignee avatar). New: a small pulsing timer icon appears in the footer when a timer is actively running on that card's ticket.

### 7.4 Tables

- Header row: `--surface-2` background, 10px uppercase labels, `--ink-faint`.
- Row height driven by 9–12px vertical padding; hover = `#FAFAFD` background, cursor pointer (rows are click targets that open detail views).
- Overdue rows get a `#FFF6F5` tint.
- Wide tables (ticket list, comms log, analytics) sit inside a horizontally scrollable container so columns never break the layout on smaller viewports.

### 7.5 Modals

- Centered overlay, blurred scrim, 14px radius, sticky header and footer so long content (attachments, comments, history) scrolls independently.
- Standard widths: `sm` 420px (confirmations, add-user), `md` 620px (notification preview), `lg` 800px (ticket/project detail, create forms), `xl` 920px (permission matrix, wide tables).

### 7.6 Forms

- Inputs/selects/textareas: 1px `--border`, 8px radius, 8–10px padding, focus state = `--brand` border (no glow/ring, keep it quiet).
- Field labels: 10.5px, 700 weight, uppercase, `--ink-soft`.
- Mention picker & watcher chips: clickable pill tags below the relevant textarea, inserting/toggling on click rather than requiring typed syntax.
- File upload: dashed dropzone (click or drag-drop), uploaded files render as a 4-column thumbnail grid with a download button (top-left) and, where editable, a remove button (top-right).

### 7.7 Timer indicator (new)

To make an active timer impossible to miss without opening a ticket:
- **List/table context:** replace the static "Time logged" value with a small red pulsing dot + "Timer running · Xm" in place of (or alongside) the total, using the same visual language as the overdue-row tint — urgent, not alarming.
- **Kanban card context:** a small clock/timer icon badge in the card footer, filled red while running.
- **Ticket detail context:** the Start/Stop button itself changes from brand-filled ("Start timer") to danger-tinted ("Stop timer · running Xm"), consistent with the destructive-action color convention.

### 7.8 Role switcher & permission surfaces

- Role switcher: avatar + name/identity + chevron, opening a grouped dropdown (Full access / Field team / External) with one-line blurbs per role.
- Permission matrix modal: capability rows × role columns, green check / muted X, plus text-value rows (ticket scope, allowed statuses) where a boolean doesn't capture the nuance.

---

## 8. Data Visualization

- **Library:** Recharts.
- **Line charts** (trend, burndown): 2.2px stroke, no dots, brand color for the primary series, green for "closed/actual," light dashed gray for a baseline/ideal reference line.
- **Bar charts** (created vs. closed): 4px top radius, brand + green pairing, `barGap: 4`.
- **Donut/pie** (priority breakdown): inner radius 48 / outer 72, 2px pad angle, semantic priority colors, legend below rather than beside.
- **Custom bar rows** (workload, label breakdown): not charted via Recharts — built as simple flex rows with a track + fill div, because these need to interleave with avatars/text labels more tightly than a chart library allows.
- Axis and grid lines are always muted (`--ink-faint` ticks, `#EEF0F6` gridlines, no vertical gridlines) — the data should read as ink on paper, not as chart-library defaults.

---

## 9. Motion

- Standard transition: `all .15s ease` on interactive elements (buttons, cards, nav items, inputs).
- Hover lift: `translateY(-1px)` (buttons) to `translateY(-2px)` (cards), always paired with a shadow increase, never scale transforms (keeps text crisp).
- Drag-and-drop: dragged card drops to 60% opacity; drop-target column gets a dashed brand border + brand-tinted background while a drag is over it.
- No motion is purely decorative — every transition exists to confirm an interaction registered (hover, drag, click).

---

## 10. Accessibility Notes

- Status is never color-only: every colored dot/chip carries a text label alongside it.
- Focus states rely on border-color change (`--brand`) rather than a glow, but must be paired with a visible focus outline in the production build (the prototype omits browser default outlines for visual polish — this is a gap to close before ship).
- Minimum interactive target size: 34×34px for icon-only buttons.
- Color contrast: body text (`--ink` on `--surface`/`--bg`) exceeds WCAG AA; verify tinted chip text (e.g., priority chips at ~13% background opacity) meets AA before production — some combinations (Low priority gray-on-gray) are borderline and should be re-checked.

---

## 11. Voice & Content Guidelines

- Empty states are instructive, not apologetic: *"No tickets raised yet — use 'New ticket' to raise your first one,"* not *"Nothing here."*
- Restricted-access banners state the boundary plainly and explain the "why" in one clause: *"You're viewing tickets raised via Call Center — as a Call Center Agent, you can raise tickets, comment, take updates, and close them."*
- AI-assisted content (Section 13 of the PRD) must always be labeled as such in the UI — never presented indistinguishably from human-entered data.

---

## 12. Naming in UI

With the rename to **ElevatoHub**, update:
- Sidebar wordmark ("P" logo mark → "E," or a redesigned monogram — recommend a simple lockup of an upward chevron/arrow inside the existing lime gradient square, keeping the "elevate" motif literal).
- Topbar title ("Pulse" → "ElevatoHub") and tagline ("Portfolio control room" can stay, or shift to "Elevate your delivery.").
- All simulated email/Teams notification sender names ("Pulse PM," "notifications@pulse-pm.io") → "ElevatoHub" / "notifications@elevatohub.io" (or final domain).
