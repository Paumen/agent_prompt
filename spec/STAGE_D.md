# Stage D — Progressive Disclosure Redesign

---

## Overview

Stage D builds on the Stage C redesign framework to add progressive disclosure, validation feedback, and modern CSS techniques. This plan integrates architectural fixes for native HTML5 behaviors, Web Components for robust validation, and the View Transitions API for state cascades.

**PR Structure:** 3 PRs following dependency order:

1. **PR1 — Infrastructure** (D1 + D2 + D3): `<details>` migration, card header enrichment, flow tab-cards.
2. **PR2 — Validation & Reset** (D4 + D5): ElementInternals validation + View Transitions reset cascade.
3. **PR3 — Flow & Polish** (D6 + D7): Progressive disclosure, progress meter, guard states.

---

## Phase D1: Card Infrastructure Migration

### Goal

Replace JS-driven `.card--open` toggle with native `<details>`/`<summary>`, removing `initCardToggles()`, `expandCard()`, `collapseCard()`, and the `.card--open` class entirely.

### Key Changes

[ ] D101 – `<section class="card">` → `<details class="card">`
[ ] D102 – `<button class="card-header">` → `<summary class="card-header">`
[ ] D103 – `.card-body` sits after `<summary>`, wrapped by `::details-content` automatically
[ ] D104 – CSS: Remove `.card:not(:where(.card--open)) > .card-body { display: none }` (layout.css:115-117) – replaced by native `<details>` behavior
[ ] D105 – JS: Remove `initCardToggles()` from main.js (lines 10-24), `expandCard()`/`collapseCard()` from components.js (lines 20-38)
[ ] D106 – Chevron icon appending logic relocates from `initCardToggles()` into static `<summary>` HTML or a lightweight init
[ ] D107 – **Edge Case (Validation):** Intercept form submission to set `open = true` on parent `<details>` of `:invalid` elements before native focus attempts.
[ ] D108 – **Accessibility:** Explicitly **remove** `aria-expanded` and `aria-controls` from all `<summary>` elements – the browser provides correct semantics natively.
[ ] D109 – **Caution:** Do **not** use the `name` attribute on `<details>` unless an exclusive accordion is required; the current design allows multiple open cards simultaneously.
[ ] D110 – Audit and migrate click listeners: Replace click listeners on `.card-header` (or elements becoming `<summary>`) with `toggle` listeners on the parent `<details>` for native compatibility and to prevent browser conflicts.
  - Example: In `card-configuration.js` (line 551), swap the header click listener for a `<details>` `toggle` listener; check `event.target.open` to detect expansion.
  - **Edge Case (Ctrl+F):** Use `toggle` listeners to sync app state when browsers auto-expand cards during text searches.


### Sub-panel migration (card-tasks.js)

[ ] D112 – `renderDualPanels()` (lines 123-169) creates nested cards as `<div class="card card--open">` with `<button class="card-header">`. These must become `<details open class="card">` with `<summary class="card-header">`.
[ ] D113 – `renderPanelHeader()` (lines 171-200) changes from creating a `<button>` to creating a `<summary>`, and its click handler is removed (native toggle replaces it).

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

## Phase D2: Card Header Enrichment & Summary State

### Goal

Add inline metadata to `<summary>` elements showing key state when card is collapsed (e.g., owner/repo/branch in config card header, selected flow in task card header).

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

[ ] D204 – Populate `.card-meta` for Task, Steps, and Prompt cards accordingly.
[ ] D205 – Style the existing quality meter (quality-meter.js) with `color-mix()` for color transitions


---

## Phase D3: Flow Selector as Tab-Cards

### Goal

Convert flow selector buttons to a tab-card metaphor using hidden radio inputs + visible labels, enabling CSS `:checked` state for visual selection without JS class toggling.

### Key Changes

[ ] D301 – Hidden `<input type="radio">` + `<label>` for each flow option
[ ] D302 – `:checked` drives visual state (background, border, shadow, z-index)
[ ] D303 – `@starting-style` for smooth panel entry when switching flows

[ ] D304 – Modify existing `.btn-select--selected` styles 
[ ] D305 – Wire radio `change` event to `onFlowSelect()`.
[ ] D306 – Use `@container` queries for mobile row-wrapping fallback.

---

## Phase D4: Validation & Feedback Framework

### Goal

Replace JS-driven `renderError()` and `updateRequiredGroupIndicators()` with CSS-driven validation feedback using `:user-valid`/`:user-invalid` and `:has()`.

### Key Changes

[ ] D401 – `:user-valid`/`:user-invalid` on native `<input>`/`<textarea>` with `required` attribute
[ ] D402 – **Web Components:** Refactor `.field-picker` to `<custom-picker>`. Use `ElementInternals.states` API to apply `:state(valid)` or `:state(invalid)`, matching native behavior without fragile `:has()` structural chains.
[ ] D403 – JS layer sets `data-next-to-fill` on the first empty required field for CSS highlighting.
[ ] D404 – `color-mix()` for focus glow effects
[ ] D405 – `:placeholder-shown` for "next-to-fill" highlighting
[ ] D406 – Remove `.required-group-dot` system
[ ] D407 – `field-sizing: content` on text inputs for auto-sizing

---

## Phase D5: Reset & Cascade Logic

### Goal

When upstream data changes (e.g., user clears PAT, switches repo, changes flow), downstream cards dissolve and reset in a visually sequenced cascade.

### Key Changes

[ ] D501 – `resetDownstream(from)` function extending existing `resetSession()` (state.js lines 187-198)
[ ] D502 – **Focus Management:** Programmatically move `document.activeElement` to the next logical input or the next card's `<summary>` post-transition to prevent focus drop to `<body>`.
[ ] D503 – State mutation during animation. Batch `setState()` to avoid mid-dissolve re-renders. Defer subscriber notifications until the animation completes using a `_suppressNotify` flag or queue pattern.
[ ] D504 – Stagger timing: Offset card `transition-delay` by 50–100ms for a sequential reveal. Maintain a 300ms duration for parallel dissolving to ensure the flow is responsive and progressive.


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

Guide users through a step-by-step journey: highlight the next card to fill, dim completed cards.

### Key Changes

[ ] D601 – `.card--completed { opacity: 0.35 }` — visually de-emphasize completed cards
[ ] D602 – `pointer-events: auto` on `<summary>` for dimmed cards.
[ ] D603 – `:focus-within` on a card can auto-undim it for re-editing
[ ] D604 `<dialog>` guidance overlay with `::backdrop` dimming
[ ] D605 **`animation-timeline: scroll()`**. Consider tying the meter animation to scroll position through the cards (visual "progress through the page" effect). 

---

## Phase D7: Non-Happy Path Guards

### Goal

When prerequisites are missing (e.g., no repo selected), guard downstream cards with tooltips explaining what's needed.

### Key Changes

[ ] D701 – CSS `:has()` selectors for cross-card dependency detection
[ ] D702 – `anchor-name` / CSS anchor positioning for guard tooltips
[ ] D703 – Shake animation on guarded card click attempts
[ ] D704 – 
Shake keyframes definition:
  ```css
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25%      { transform: translateX(-4px); }
    75%      { transform: translateX(4px); }
  }
  ``` 
