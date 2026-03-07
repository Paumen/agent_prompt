# Stage D — Progressive Disclosure Redesign

---

## Overview

Stage D builds on the Stage C redesign framework to add progressive disclosure, validation feedback, and modern CSS techniques. This plan integrates architectural fixes for native HTML5 behaviors, CSS-driven validation, and visually sequenced reset cascades.

**Target browsers:** Latest stable Chrome, Firefox, Safari, Edge. No legacy fallbacks — users are assumed to be bleeding-edge developers.

**PR Structure:** 3 PRs grouped by user-facing value:

1. **PR1 — Native Card Foundation** (D1): `<details>`/`<summary>` migration. Ship independently to validate browser behavior before building on top.
2. **PR2 — Progressive Disclosure & Guards** (D2 + D5 + D6 + D7): The core UX value — reset cascade, guided card flow, guard states, and card-meta enrichment. All serve the same goal: guiding users through the journey.
3. **PR3 — Validation & Flow Polish** (D3 + D4): CSS-driven validation framework and flow selector upgrade.

**Animation budget:** Max 2 motion types app-wide:
1. Card open/close (`::details-content` transition)
2. Reset cascade (staggered `transition-delay` dissolve)

All animations respect `prefers-reduced-motion`.

---

## Card State Machine

Each card has exactly one state at any time, managed via `data-card-state` attribute:

```
LOCKED → ACTIVE → COMPLETED
  ↑                    |
  └──── RESET ←────────┘
```

| State | Attribute | Visual treatment | Behavior |
|:------|:----------|:-----------------|:---------|
| `locked` | `data-card-state="locked"` | Muted, non-interactive body | `<summary>` clickable, shows tooltip explaining prerequisite |
| `active` | `data-card-state="active"` | Full opacity, highlighted border | Fully interactive, receives focus on transition |
| `completed` | `data-card-state="completed"` | `opacity: 0.35`, dimmed | `<summary>` clickable to re-expand; `:focus-within` undims for re-editing |

**Transitions:**
- App init → Card 1 `active`, Cards 2–4 `locked`
- Card completes prerequisites → next card transitions `locked` → `active`
- Upstream data cleared → downstream cards transition to `locked` via reset cascade
- User re-edits completed card → `:focus-within` temporarily undims; downstream cards may reset depending on what changed

**Single source of truth:** The disclosure controller in JS manages `data-card-state` on each `<details>` element. CSS uses `[data-card-state="..."]` selectors exclusively — no parallel `:has()` dependency detection in CSS.

---

## Phase D1: Card Infrastructure Migration

### Goal

Replace JS-driven `.card--open` toggle with native `<details>`/`<summary>`, removing `initCardToggles()`, `expandCard()`, `collapseCard()`, and the `.card--open` class entirely.

### Key Changes

[ ] D101 – `<section class="card">` → `<details class="card">`
[ ] D102 – `<button class="card-header">` → `<summary class="card-header">`
[ ] D103 – Normalize all card header titles to use `<h3>` consistently (Card 3 Steps currently uses `<span>` — align with other cards)
[ ] D104 – `.card-body` sits after `<summary>`, wrapped by `::details-content` automatically
[ ] D105 – CSS: Remove `.card:not(:where(.card--open)) > .card-body { display: none }` (layout.css:115-117) — replaced by native `<details>` behavior
[ ] D106 – JS: Remove `initCardToggles()` from main.js (lines 10-24), `expandCard()`/`collapseCard()` from components.js (lines 20-38)
[ ] D107 – Chevron icon appending logic relocates from `initCardToggles()` into static `<summary>` HTML or a lightweight init
[ ] D108 – **Edge Case (Validation):** Intercept form submission to set `open = true` on parent `<details>` of `:invalid` elements before native focus attempts
[ ] D109 – **Accessibility:** Explicitly **remove** `aria-expanded` and `aria-controls` from all `<summary>` elements — the browser provides correct semantics natively
[ ] D110 – **Caution:** Do **not** use the `name` attribute on `<details>` unless an exclusive accordion is required; the current design allows multiple open cards simultaneously
[ ] D111 – Audit and migrate click listeners: Replace click listeners on `.card-header` (or elements becoming `<summary>`) with `toggle` listeners on the parent `<details>` for native compatibility and to prevent browser conflicts
  - Example: In `card-configuration.js` (line 551), swap the header click listener for a `<details>` `toggle` listener; check `event.target.open` to detect expansion
  - **Edge Case (Ctrl+F):** Use `toggle` listeners to sync app state when browsers auto-expand cards during text searches

### Sub-panel migration (card-tasks.js)

[ ] D112 – `renderDualPanels()` (lines 123-169) creates nested cards as `<div class="card card--open">` with `<button class="card-header">`. These must become `<details open class="card">` with `<summary class="card-header">`
[ ] D113 – `renderPanelHeader()` (lines 171-200) changes from creating a `<button>` to creating a `<summary>`, and its click handler is removed (native toggle replaces it)

### `::details-content` animation

[ ] D114 –
```css
details {
  interpolate-size: allow-keywords; /* Enables block-size animation */
}
details::details-content {
  block-size: 0;
  overflow: clip;
  transition: block-size 0.3s ease, content-visibility 0.3s ease;
  content-visibility: hidden;
}
details[open]::details-content {
  block-size: auto;
  content-visibility: visible;
}
@starting-style {
  details[open]::details-content {
    block-size: 0;
    content-visibility: hidden;
  }
}
```

---

## Phase D2: Card Header Enrichment & Summary State

### Goal

Add inline metadata to `<summary>` elements showing key state when card is collapsed (e.g., owner/repo/branch in config card header, selected flow in task card header). This metadata becomes valuable once progressive disclosure (D6) is in place — users need at-a-glance state for regularly collapsed cards.

### Key Changes

[ ] D201 – Add `<span class="card-meta">` inside each `<summary>`, after the title
[ ] D202 – `:has()` selector: `summary:has(.card-meta:not(:empty))` to style headers with content
[ ] D203 – Refactor `setConfigCardSummary()` (card-configuration.js lines 48-88) to populate `.card-meta` instead of directly manipulating the title element's first child

### Metadata content per card

| Card | Collapsed summary shows |
|:-----|:------------------------|
| Configuration | owner/repo/branch icons + names |
| Task | Selected flow name |
| Steps | Step count (e.g., "3 steps") |
| Prompt | quality meter |

[ ] D204 – Populate `.card-meta` for Task, Steps, and Prompt cards accordingly
[ ] D205 – Style the existing quality meter (quality-meter.js) with `color-mix()` for color transitions

---

## Phase D3: Flow Selector Visual Upgrade

### Goal

Upgrade flow selector buttons to a tab-card look and feel while keeping the implementation simple. Use CSS `:checked` on hidden radios for selection state, avoiding JS class toggling. Keep implementation lightweight — the existing button grid works; this is a visual refinement, not a rewrite.

### Key Changes

[ ] D301 – Hidden `<input type="radio">` + `<label>` for each flow option, styled as tab-cards
[ ] D302 – `:checked` drives visual state (background, border, shadow, z-index)
[ ] D303 – Reuse existing `.btn-select` styles as base, extend with tab-card appearance (raised selected card, flush unselected)
[ ] D304 – Wire radio `change` event to `onFlowSelect()`
[ ] D305 – Use `@container` queries for mobile row-wrapping fallback

---

## Phase D4: Validation & Feedback Framework

### Goal

Replace JS-driven `renderError()` and `updateRequiredGroupIndicators()` with CSS-driven validation feedback using `:user-valid`/`:user-invalid` and `:has()` on native elements.

### Key Changes

[ ] D401 – `:user-valid`/`:user-invalid` on native `<input>`/`<textarea>` with `required` attribute
[ ] D402 – For `.field-picker` (non-native element): use `data-valid`/`data-invalid` attributes set by JS, styled with `[data-valid]`/`[data-invalid]` selectors. No Web Components in Stage D
[ ] D403 – JS layer sets `data-next-to-fill` on the first empty required field for CSS highlighting (single mechanism — replaces both the prior `:placeholder-shown` and `data-next-to-fill` approaches)
[ ] D404 – `color-mix()` for focus glow effects
[ ] D405 – Remove `.required-group-dot` system
[ ] D406 – `field-sizing: content` on text inputs for auto-sizing

---

## Phase D5: Reset & Cascade Logic

### Goal

When upstream data changes (e.g., user clears PAT, switches repo, changes flow), downstream cards dissolve and reset in a visually sequenced cascade.

### Key Changes

[ ] D501 – `resetDownstream(from)` function extending existing `resetSession()` (state.js lines 187-198)
[ ] D502 – **Focus Management:** Programmatically move `document.activeElement` to the next logical input or the next card's `<summary>` post-transition to prevent focus drop to `<body>`
[ ] D503 – State mutation during animation: Use `requestAnimationFrame` batching to coalesce rapid `setState()` calls. Subscriber notifications are naturally deferred to the next frame — no `_suppressNotify` flag, preserving DM-INV-02 invariant:
```js
let notifyScheduled = false;
function scheduleNotify() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  requestAnimationFrame(() => {
    notifyScheduled = false;
    const snapshot = getState();
    for (const listener of subscribers) listener(snapshot);
  });
}
```
[ ] D504 – Stagger timing: Offset card `transition-delay` by 50–100ms for a sequential dissolve. Maintain a 300ms duration to ensure the flow is responsive and progressive
[ ] D505 – `resetDownstream()` updates `data-card-state` on affected cards (transitions them to `locked` via the card state machine)

### Reset cascade table

| Trigger | Cards affected | Behavior |
|:--------|:---------------|:---------|
| Clear PAT | Task, Steps, Prompt | Dissolve all, clear state |
| Clear username | Task, Steps, Prompt | Dissolve all, clear state |
| Clear repo | Task (partial), Steps, Prompt | Dissolve downstream, clear repo-dependent state |
| Clear branch | Steps, Prompt | Dissolve downstream |
| Flow switch | Steps, Prompt | Dissolve, apply new flow defaults |

---

## Phase D6: Progressive Disclosure Flow

### Goal

Guide users through a step-by-step journey: highlight the active card, dim completed cards. **Lead with guidance, not gating** — users can freely navigate between cards but are visually guided toward the next logical step.

### Key Changes

[ ] D601 – `[data-card-state="completed"] { opacity: 0.35 }` — visually de-emphasize completed cards
[ ] D602 – `pointer-events: auto` on `<summary>` for dimmed cards — always allow expand/collapse
[ ] D603 – `:focus-within` on a card undims it for re-editing: `[data-card-state="completed"]:focus-within { opacity: 1 }`
[ ] D604 – `[data-card-state="active"]` receives a subtle highlighted border (e.g., `border-color: var(--accent-a)`) to draw attention
[ ] D605 – Disclosure controller: JS module that observes state changes and updates `data-card-state` on each `<details>` element. Single orchestration point for both card-level and field-level visibility

---

## Phase D7: Non-Happy Path Guards

### Goal

When prerequisites are missing (e.g., no repo selected), guard downstream cards with tooltips explaining what's needed. **Limited to truly impossible states** — don't lock cards a user could reasonably want to peek at.

### Key Changes

[ ] D701 – `[data-card-state="locked"]` styling: muted body content, `<summary>` remains interactive
[ ] D702 – `anchor-name` / CSS anchor positioning for guard tooltips on `<summary>` of locked cards
[ ] D703 – On locked card `<summary>` click: show tooltip with prerequisite message. No shake animation — use a subtle `prefers-reduced-motion`-respecting highlight pulse instead:
```css
@keyframes highlight-pulse {
  0%, 100% { outline-color: transparent; }
  50% { outline-color: var(--accent-a); }
}
[data-card-state="locked"] > summary:active {
  animation: highlight-pulse 0.6s ease;
}
@media (prefers-reduced-motion: reduce) {
  [data-card-state="locked"] > summary:active {
    animation: none;
    outline: 2px solid var(--accent-a);
  }
}
```
[ ] D704 – Guard conditions managed by the disclosure controller (D605), not by scattered CSS `:has()` selectors — keeps dependency logic in one place
