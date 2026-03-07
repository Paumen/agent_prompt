# Stage D — Progressive Disclosure Redesign (Plan + Review Amendments)

---

## Overview

Stage D builds on the Stage C redesign framework to add progressive disclosure, validation feedback, and modern CSS techniques. This plan integrates architectural fixes for native HTML5 behaviors, Web Components for robust validation, and the View Transitions API for state cascades.

**PR Structure:** 3 PRs following dependency order:

1. **PR1 — Infrastructure** (D1 + D2 + D7): `<details>` migration, card header enrichment, flow tab-cards.
2. **PR2 — Validation & Reset** (D4 + D5): ElementInternals validation + View Transitions reset cascade.
3. **PR3 — Flow & Polish** (D3 + D6 + D8): Progressive disclosure, progress meter, guard states.

---

## Phase D1: Card Infrastructure Migration

### Goal
Replace JS-driven `.card--open` toggle with native `<details>`/`<summary>`, removing `initCardToggles()`, `expandCard()`, `collapseCard()`, and the `.card--open` class.

### Key Changes
- `<section class="card">` → `<details class="card">`
- `<button class="card-header">` → `<summary class="card-header">`
- `.card-body` wrapped by `::details-content` automatically.
- CSS: Remove `.card:not(:where(.card--open)) > .card-body { display: none }`.
- **Edge Case (Ctrl+F):** Add `toggle` event listener to synchronize app state when browsers force-open cards during text searches.
- **Edge Case (Validation):** Intercept form submission to set `open = true` on parent `<details>` of `:invalid` elements before native focus attempts.

### Review Amendments
| # | Issue | Severity | Resolution |
|:--|:------|:---------|:-----------|
| C2 | `block-size: auto` no interpolation | Critical | Add `interpolate-size: allow-keywords` on `details`. Fallback: snap behavior. |
| M10| Redundant ARIA | Minor | Remove `aria-expanded` and `aria-controls` from `<summary>`. |
| R3 | Event listener conflict | Risk | Migrate all `.card-header` click listeners to `toggle` events on the parent `<details>`. |

---

## Phase D2: Card Header Enrichment & Summary State

### Goal
Add inline metadata to `<summary>` elements showing key state when card is collapsed.

### Key Changes
- Add `<span class="card-meta">` inside each `<summary>`.
- Selector: `summary:has(.card-meta:not(:empty))` for styling.
- **New CSS Class:** `.card-meta` (**Requires PO Approval**).

---

## Phase D7: Flow Selector as Tab-Cards

### Goal
Convert flow selector buttons to a tab-card metaphor using hidden radio inputs.

### Key Changes
- Hidden `<input type="radio">` + `<label>` for each flow option.
- CSS `:checked` drives visual state (elevation, border, background).
- Wire radio `change` event to `onFlowSelect()`.
- **Modern Technique:** Use `@container` queries for mobile row-wrapping fallback.

---

## Phase D4: Validation & Feedback Framework

### Goal
Replace JS-driven `renderError()` with CSS-driven validation using native pseudo-classes and Web Components.

### Key Changes
- `:user-valid`/`:user-invalid` on native `<input>`/`<textarea>`.
- **Web Components:** Refactor `.field-picker` to `<custom-picker>`. Use `ElementInternals.states` API to apply `:state(valid)` or `:state(invalid)`, matching native behavior without fragile `:has()` structural chains.
- JS layer sets `data-next-to-fill` on the first empty required field for CSS highlighting.

---

## Phase D5: Reset & Cascade Logic

### Goal
Sequentially reset downstream cards when upstream data changes without race conditions.

### Key Changes
- Wrap `resetDownstream(from)` DOM updates inside `document.startViewTransition()`.
- Eliminates manual `.card--dissolving` classes and `transitionend` timeouts.
- **Focus Management:** Programmatically move `document.activeElement` to the next logical input or the next card's `<summary>` post-transition to prevent focus drop to `<body>`.

---

## Phase D3: Progressive Disclosure Flow

### Goal
Visually de-emphasize completed cards and highlight the active path.

### Key Changes
- `.card--dimmed { opacity: 0.35 }` (**Requires PO Approval**).
- `pointer-events: auto` on `<summary>`, `pointer-events: none` on `.card-body` for dimmed cards.
- **Exclusion:** Prompt card (Card 4) never auto-collapses or dims per OUT-08.

---

## Phase D6: Progress Meter & Guidance

### Goal
Enhance quality meter styling.

### Key Changes
- Style existing `<div role="meter">` using `color-mix()` for dynamic transitions.
- Avoid `<meter>` element due to cross-browser pseudo-element fragmentation.

---

## Phase D8: Non-Happy Path Guards

### Goal
Guard downstream cards with tooltips explaining missing prerequisites.

### Key Changes
- Use JS to set `data-guard="needs-repo"` (or similar) on cards.
- **Anchor Positioning:** Use `anchor-name` for tooltips with a `position: absolute` fallback via `@supports` for Firefox.
- **Accessibility:** Add `aria-disabled="true"` and `aria-describedby` pointing to the guard message.

---

## Technique Coverage Summary

| Technique | Used? | Phase | Status |
|:----------|:------|:------|:-------|
| `<details>`/`<summary>` | Yes | D1 | Core migration. |
| `::details-content` | Yes | D1 | Needs `interpolate-size`. |
| View Transitions API | Yes | D5 | Replaces manual dissolve animations. |
| Web Components | Yes | D4 | Replaces custom picker validation logic. |
| `anchor-name` | Yes | D8 | Guard tooltips. |
| `:user-valid` | Yes | D4 | Native inputs only. |
| `color-mix()` | Yes | D4, D6 | Focus and meter colors. |
| `@container` | Yes | D7 | Mobile tab-card layout. |

---

## Critical Blockers & Approvals Needed

1. **`src/css/variables.css`**: Edits required for transition durations, guard colors, and focus glows. **Permission needed.**
2. **`spec/spec_concept.md`**: Phase D3 expands disclosure beyond the current UJ table. **PO approval needed.**
3. **New Classes**: `.card-meta` and `.card--dimmed` require approval per CLAUDE.md.
