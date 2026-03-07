# Stage D — Progressive Disclosure Redesign (Plan + Review Amendments)

---

## Overview

Stage D builds on the Stage C redesign framework to add progressive disclosure, validation feedback, and modern CSS techniques. The plan was reviewed for feasibility, technical accuracy, completeness, simplicity, and risks. This document integrates the review findings as **amendments** within each phase.

**PR Structure:** 3 PRs following dependency order:

1. **PR1 — Infrastructure** (D1 + D2): `<details>` migration + card header enrichment
2. **PR2 — Validation & Flow** (D3 + D4 + D5): Progressive disclosure + validation + reset cascade
3. **PR3 — Polish** (D6 + D7 + D8): Progress meter + tab-cards + guard states

---

## Phase D1: Card Infrastructure Migration

### Goal

Replace JS-driven `.card--open` toggle with native `<details>`/`<summary>`, removing `initCardToggles()`, `expandCard()`, `collapseCard()`, and the `.card--open` class entirely.

### Key Changes

- `<section class="card">` → `<details class="card">`
- `<button class="card-header">` → `<summary class="card-header">`
- `.card-body` sits after `<summary>`, wrapped by `::details-content` automatically
- CSS: `.card:not(:where(.card--open)) > .card-body { display: none }` (layout.css:115-117) → removed, replaced by native `<details>` behavior
- JS: Remove `initCardToggles()` from main.js (lines 10-24), `expandCard()`/`collapseCard()` from components.js (lines 20-38)
- Chevron icon appending logic relocates from `initCardToggles()` into static `<summary>` HTML or a lightweight init

### Sub-panel migration (card-tasks.js)

`renderDualPanels()` (lines 123-169) creates nested cards as `<div class="card card--open">` with `<button class="card-header">`. These must become `<details open class="card">` with `<summary class="card-header">`. `renderPanelHeader()` (lines 171-200) changes from creating a `<button>` to creating a `<summary>`, and its click handler is removed (native toggle replaces it).

### `::details-content` animation

```css
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

### Review Amendments

| # | Issue | Severity | Resolution |
|:--|:------|:---------|:-----------|
| C2 | **`block-size: auto` does not interpolate** without `interpolate-size: allow-keywords` (Chrome 129+) or `calc-size()`. Without this, open/close snaps instead of animating. | Critical | Add `interpolate-size: allow-keywords` on `details`. Fallback: if unsupported, accept snap behavior (no animation). Document browser requirement. |
| M10 | **Accessibility: remove redundant ARIA.** `<summary>` has built-in disclosure semantics. Keeping `aria-expanded` and `aria-controls` creates conflicts. | Minor | Explicitly remove `aria-expanded` and `aria-controls` from all `<summary>` elements. Browser handles these natively for `<details>`. |
| R1 | **CSS rule conflict during migration.** The old `.card:not(.card--open) > .card-body { display: none }` and new `::details-content` rules must not coexist. | Risk | Remove the old rule in the same commit that introduces `<details>`. No phased coexistence. |
| R2 | **`name` attribute creates exclusive accordion.** Current app allows multiple cards open simultaneously. | Risk | Do NOT use the `name` attribute on `<details>` unless PO explicitly requests exclusive accordion. |
| R3 | **Event listeners on `.card-header` click.** Several card JS modules listen for `click` on `.card-header`. With `<details>`, the native `toggle` event replaces these. | Risk | Migrate all `.card-header` click listeners to `toggle` event on the parent `<details>`. Specifically: card-configuration.js line 551 (click listener for re-opening config card) must use `toggle` event instead. |

### New CSS Classes

None. Reuses `.card`, `.card-header`, `.card-body`.

---

## Phase D2: Card Header Enrichment & Summary State

### Goal

Add inline metadata to `<summary>` elements showing key state when card is collapsed (e.g., owner/repo/branch in config card header, selected flow in task card header).

### Key Changes

- Add `<span class="card-meta">` inside each `<summary>`, after the title
- `:has()` selector: `summary:has(.card-meta:not(:empty))` to style headers with content
- Refactor `setConfigCardSummary()` (card-configuration.js lines 48-88) to populate `.card-meta` instead of directly manipulating the title element's first child

### Metadata content per card

| Card | Collapsed summary shows |
|:-----|:------------------------|
| Configuration | owner/repo/branch icons + names |
| Task | Selected flow name |
| Steps | Step count (e.g., "3 steps") |
| Prompt | *None initially — card never auto-collapses per OUT-08* |

### Review Amendments

| # | Issue | Severity | Resolution |
|:--|:------|:---------|:-----------|
| N1 | **`.card-meta` is a new CSS class** — requires user approval per CLAUDE.md. | Approval needed | Request PO approval before implementation. |
| M5 | **Mobile overflow.** Summary content (owner/repo/branch + flow) could overflow on narrow screens. | Moderate | Apply `text-overflow: ellipsis`, `overflow: hidden`, `white-space: nowrap` and a `max-width` constraint (e.g., `60%`) on `.card-meta`. |

### New CSS Classes

- `.card-meta` — **requires PO approval**

---

## Phase D3: Progressive Disclosure Flow & Transitions

### Goal

Guide users through a step-by-step journey: highlight the next card to fill, dim completed cards.

### Key Changes

- `.card--dimmed { opacity: 0.35 }` — visually de-emphasize completed cards
- Stagger timing using `transition-delay` per card for sequential reveals
- `:focus-within` on a card can auto-undim it for re-editing

### Review Amendments

| # | Issue | Severity | Resolution |
|:--|:------|:---------|:-----------|
| C3 | **`pointer-events: none` on dimmed cards contradicts `:focus-within` undim and D8 guard click tooltips.** User cannot click into a card to give it focus if pointer events are blocked. Keyboard tabbing behavior is inconsistent across browsers. | Critical | **Resolution: Do NOT use `pointer-events: none` on the whole card.** Instead: (a) keep `pointer-events: auto` on `<summary>` so headers remain clickable, (b) apply `pointer-events: none` only on `.card-body` within dimmed cards if interaction blocking is desired, (c) `:focus-within` then works because clicking `<summary>` gives focus to the `<details>` element. |
| M5 | **Spec deviation.** The progressive disclosure journey (dim completed, highlight next, granular Situation→Target→Steps) goes beyond what the current UJ table in `spec_concept.md` defines. | Moderate | Flag to PO before implementation. Get explicit approval for the expanded progressive disclosure flow, or scope down to match the existing UJ table ("Flow selected → Expand Task fields + Steps + Prompt; collapse Config"). |
| M-OUT08 | **OUT-08 conflict.** Spec says Card 4 (Prompt) never auto-collapses once opened. Progressive disclosure must never dim or collapse the Prompt card. | Moderate | Add explicit exception: Prompt card is excluded from dimming and auto-collapse logic. Once opened, it stays open and fully interactive. |
| R4 | **Mobile hover.** Plan mentions "Hover/touch on Steps card → Situation sub-`<details>` fades/collapses." Hover does not exist on touch devices. | Risk | Use a different trigger for touch: explicit tap on a "collapse" control within the sub-panel, or let the user manually toggle via `<summary>`. No hover-driven structural changes. |
| R5 | **Race conditions.** Rapid user input could cause dim/undim transitions to overlap. | Risk | Debounce dim/undim transitions. Use a single `requestAnimationFrame` guard to prevent overlapping state changes. |
| N2 | **`.card--dimmed` is a new CSS class** — requires user approval. | Approval needed | Request PO approval before implementation. |

### New CSS Classes

- `.card--dimmed` — **requires PO approval**

---

## Phase D4: Validation & Feedback Framework

### Goal

Replace JS-driven `renderError()` and `updateRequiredGroupIndicators()` with CSS-driven validation feedback using `:user-valid`/`:user-invalid` and `:has()`.

### Key Changes

- `:user-valid`/`:user-invalid` on native `<input>`/`<textarea>` with `required` attribute
- `color-mix()` for focus glow effects
- `:placeholder-shown` for "next-to-fill" highlighting
- Remove `.required-group-dot` system

### Review Amendments

| # | Issue | Severity | Resolution |
|:--|:------|:---------|:-----------|
| C1 | **`:user-valid`/`:user-invalid` only works on native form controls.** The app's primary inputs (repo picker, branch picker, PR picker, issue picker, file picker, lens toggles, flow selector, scope selector) are all custom `<div>`-based components. Only ~30% of inputs (PAT, username, description, acceptance criteria, notes) are native and covered. | Critical | **Hybrid strategy required.** Use `:user-valid`/`:user-invalid` for native `<input>`/`<textarea>`. For custom components, use `:has()` + structural selectors: `.field-picker:has(.tag)` means "has a selection", `.field-picker:not(:has(.tag))` means "empty". For button-based selectors (lens, flow, scope), use `:has([aria-checked="true"])` or `:has(.btn-select--selected)`. Document which inputs use which validation approach. |
| C4 | **"Next-to-fill" selector is incorrect.** `:first-of-type` selects by HTML element type, not by state. It won't correctly identify the first empty required field if the first `<input>` is already filled. | Critical | **Redesign the selector.** Options: (a) JS-assisted approach: set `data-next-to-fill` attribute on the first empty required field after each state change — CSS styles `[data-next-to-fill]`; (b) use ordered sibling combinators if DOM structure permits; (c) accept that "next" highlighting requires minimal JS. **Recommendation: option (a)** — thin JS layer sets one data attribute, CSS handles all visual effects. |
| M6 | **Required-group validation gap.** Removing `updateRequiredGroupIndicators()` without replacement loses "at least one of description OR issue must be filled" logic. `:user-invalid` cannot express group validation. | Moderate | Use `:has()` for group validation: `.card:has(.group-a :user-valid) .group-a .required-indicator { display: none }`. If the group contains a custom picker, combine: `.card:has(.group-a .field-picker:has(.tag)) .group-a .required-indicator { display: none }`. This CSS-only approach checks "at least one field in the group is valid/filled." |
| M8 | **`renderError()` removal is premature.** Network errors (API failures, rate limits, auth errors) are distinct from field validation. | Moderate | **Keep `renderError()` for system/network errors.** Only remove field-validation error rendering (inline red borders, required dots). Rename or scope `renderError()` to `renderSystemError()` to clarify its purpose. Field validation becomes CSS-driven; system errors stay JS-driven. |

### Input validation coverage map

| Input | Element | Validation approach |
|:------|:--------|:-------------------|
| PAT input | `<input type="password">` | `:user-valid`/`:user-invalid` + `required` |
| Username input | `<input type="text">` | `:user-valid`/`:user-invalid` + `required` |
| Description textarea | `<textarea>` | `:user-valid`/`:user-invalid` + `required` |
| Acceptance criteria | `<textarea>` | `:user-valid`/`:user-invalid` + `required` |
| Notes textarea | `<textarea>` | `:user-valid`/`:user-invalid` + `required` |
| Repo picker | Custom `<div>` | `:has()` — `.field-picker:has(.tag)` |
| Branch picker | Custom `<div>` | `:has()` — `.field-picker:has(.tag)` |
| PR picker | Custom `<div>` | `:has()` — `.field-picker:has(.tag)` |
| Issue picker | Custom `<div>` | `:has()` — `.field-picker:has(.tag)` |
| File picker | Custom `<div>` | `:has()` — `.field-picker:has(.tag)` |
| Lens toggles | `<button>` | `:has([aria-checked="true"])` |
| Flow selector | `<button>` | `:has(.btn-select--selected)` |

### New CSS Classes

None proposed. Uses existing classes + pseudo-classes + data attributes.

---

## Phase D5: Reset & Cascade Logic

### Goal

When upstream data changes (e.g., user clears PAT, switches repo, changes flow), downstream cards dissolve and reset in a visually sequenced cascade.

### Key Changes

- `resetDownstream(from)` function extending existing `resetSession()` (state.js lines 187-198)
- `.card--dissolving` animation: `opacity 0.3s, transform 0.3s`
- Stagger timing: 50-100ms offset per card (not 300-500ms — review found that too slow for 3+ cards)
- `transitionend` event to sequence reset → dissolve → re-render

### Reset cascade table

| Trigger | Cards affected | Behavior |
|:--------|:---------------|:---------|
| Clear PAT | Task, Steps, Prompt | Dissolve all, clear state |
| Clear username | Task, Steps, Prompt | Dissolve all, clear state |
| Clear repo | Task (partial), Steps, Prompt | Dissolve downstream, clear repo-dependent state |
| Clear branch | Steps, Prompt | Dissolve downstream |
| Flow switch | Steps, Prompt | Dissolve, apply new flow defaults |

### Review Amendments

| # | Issue | Severity | Resolution |
|:--|:------|:---------|:-----------|
| M11 | **`transitionend` reliability.** If no transition occurs (element already at target opacity), the event never fires. | Minor | Add a `setTimeout` fallback at `transition-duration + 50ms`. If `transitionend` fires first, clear the timeout. |
| R6 | **State mutation during animation.** If `setState()` triggers subscriber notifications during dissolve, cards re-render mid-animation. | Risk | Batch state changes: clear downstream state, defer subscriber notifications until dissolve animation completes. Use a `_suppressNotify` flag or queue pattern during the dissolve sequence. |
| R7 | **User interaction during dissolve.** If user clicks while cards are dissolving, race conditions occur. | Risk | Set `pointer-events: none` on dissolving cards (`.card--dissolving { pointer-events: none }`). This is safe here because the card is being destroyed/rebuilt. |
| N3 | **`.card--dissolving` is a new CSS class** — requires user approval. | Approval needed | Request PO approval before implementation. |
| R8 | **Stagger timing.** Original 300-500ms per card feels slow with 3+ cards. | Risk | Use 50-100ms stagger offset per card, with 300ms total transition duration. Parallel dissolution with slight offset. |

### New CSS Classes

- `.card--dissolving` — **requires PO approval**

---

## Phase D6: Progress Meter & Guidance

### Goal

Enhance the quality meter with `<meter>` element styling and optionally add a `<dialog>`-based guidance overlay.

### Key Changes

- Style the existing quality meter (quality-meter.js) with `color-mix()` for color transitions
- Optional: `<dialog>` guidance overlay with `::backdrop` dimming

### Review Amendments

| # | Issue | Severity | Resolution |
|:--|:------|:---------|:-----------|
| M9 | **`<meter>` cross-browser styling.** Only WebKit pseudo-elements (`-webkit-meter-optimum-value`) shown in plan. Firefox uses `::-moz-meter-bar`. | Moderate | **Use a styled `<div>` with `role="meter"` instead.** Set `aria-valuenow`, `aria-valuemin`, `aria-valuemax` for accessibility. This gives full CSS control without cross-browser pseudo-element fragility. The current quality-meter.js (line 148) already uses a `<div>` with `role="meter"` — keep this pattern. |
| M-EXIST | **Quality meter already exists** in quality-meter.js, rendered in card-prompt.js. The spec (SCT-08) places it "below the flow selector." | Moderate | Clarify with PO: does the meter move to the Task card `<summary>`, or stay in its current location? If it moves, update SCT-08 in spec. If it stays, D6 only enhances styling, not placement. |
| M-SCROLL | **`animation-timeline: scroll()` is unused.** Listed in handbook but not applied in any phase. | Moderate | Consider tying the meter animation to scroll position through the cards (visual "progress through the page" effect). If not useful, explicitly descope from D6 with rationale. |

### New CSS Classes

None proposed.

---

## Phase D7: Flow Selector as Tab-Cards

### Goal

Convert flow selector buttons to a tab-card metaphor using hidden radio inputs + visible labels, enabling CSS `:checked` state for visual selection without JS class toggling.

### Key Changes

- Hidden `<input type="radio">` + `<label>` for each flow option
- `:checked` drives visual state (background, border, shadow, z-index)
- `@starting-style` for smooth panel entry when switching flows
- `field-sizing: content` on text inputs for auto-sizing
- Modify existing `.btn-select--selected` styles (no new class)

### Review Amendments

| # | Issue | Severity | Resolution |
|:--|:------|:---------|:-----------|
| R9 | **Radio input + existing JS conflict.** Current `onFlowSelect()` reads `dataset.flowId` from clicked buttons. Radio inputs need `value` attributes, and the handler reads `e.target.value`. | Risk | Wire `change` event on radio inputs to call `onFlowSelect()`. Set radio `value` to match flow IDs. JS drives state changes via `change` event; CSS handles visual state via `:checked`. This hybrid is explicit and standard. |
| R10 | **Mobile tab-card layout.** Horizontal tabs wrapping to multiple rows breaks the "connected card" visual metaphor (shadow lifting, connected border). | Risk | Add a responsive fallback: at narrow widths, tabs stack vertically or revert to the current wrapping grid without tab-card visual treatment. Use `@container` query on the parent. |
| M-DATALIST | **`<datalist>` listed in handbook but unused.** | Moderate | Either incorporate `<datalist>` for repo/branch picker suggestions (significant refactor — custom pickers → native `<input list="">` + `<datalist>`) or explicitly descope with rationale. **Recommendation: descope.** The current custom pickers provide search, multi-select, and tag display that `<datalist>` cannot replicate. |

### New CSS Classes

None. Modifies existing `.btn-select--selected`.

---

## Phase D8: Non-Happy Path Guards

### Goal

When prerequisites are missing (e.g., no repo selected), guard downstream cards with tooltips explaining what's needed.

### Key Changes

- CSS `:has()` selectors for cross-card dependency detection
- `anchor-name` / CSS anchor positioning for guard tooltips
- Shake animation on guarded card click attempts

### Review Amendments

| # | Issue | Severity | Resolution |
|:--|:------|:---------|:-----------|
| C3-D8 | **`pointer-events: none` on dimmed cards prevents click detection for guard tooltips.** The plan says "clicking a dimmed card" triggers a tooltip, but dimmed cards block pointer events. | Critical | Per D3 resolution: `pointer-events: auto` on `<summary>`, `pointer-events: none` only on `.card-body`. Guard tooltips trigger on `<summary>` click/hover, which remains interactive. |
| R11 | **Incorrect `:has()` selector.** Plan references `.repo-picker` class which doesn't exist. The repo picker uses `.field-picker`, same class as branch/PR/issue pickers — no distinguishing class. | Risk | Reference specific IDs or data attributes instead: `#card-configuration:has([data-picker="repo"]:not(:has(.tag)))`. Alternatively, add `data-picker="repo"` / `data-picker="branch"` attributes to distinguish pickers. These are data attributes, not CSS classes, so no approval needed. |
| M7 | **`anchor-name` browser support.** Chrome 125+, Safari 18+. Firefox support uncertain as of March 2026. | Moderate | Provide `position: absolute` within `position: relative` parent as fallback. Use `@supports(anchor-name: --x)` to progressively enhance with CSS anchor positioning where available. |
| R12 | **`@keyframes shake` not defined.** The shake animation is mentioned but no keyframe definition provided. | Risk | Define: `@keyframes shake { 0%, 100% { transform: translateX(0) } 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }` |
| R13 | **Keyboard accessibility.** When a user tabs into a guarded card, screen readers need clear feedback about why the card is not interactive. | Risk | Add `aria-disabled="true"` and `aria-describedby` pointing to a visually-hidden span with the guard message (e.g., "Select a repository first"). |
| R14 | **CSS `:has()` fragility.** Guard selectors depend on DOM structure. If structure changes in other phases, selectors break silently. | Risk | Consider a thin JS layer: set `data-guard="needs-repo"` on cards via JS when prerequisites are unmet. CSS styles `[data-guard]` for visual effects. This is more maintainable than deep structural `:has()` chains while keeping visuals CSS-driven. |

### New CSS Classes

None proposed. Uses data attributes for guard states.

---

## Technique Coverage Summary

| Technique | Used? | Phase | Status after review |
|:----------|:------|:------|:-------------------|
| `<details>`/`<summary>` | Yes | D1 | Sound. Core migration. |
| `::details-content` | Yes | D1 | Needs `interpolate-size: allow-keywords`. Fallback: snap. |
| `:has()` | Yes | D2-D4, D8 | Heavy use. Some selectors corrected (D8). Hybrid with data attributes recommended for guards. |
| `<datalist>` | **Descoped** | — | Custom pickers provide features `<datalist>` cannot (search, multi-select, tags). |
| `field-sizing` | Yes | D7 | Auto-sizing text inputs. Chrome 123+. |
| `anchor-name` | Yes | D8 | Guard tooltips. Needs `@supports` fallback for Firefox. |
| `:user-valid`/`:user-invalid` | Partial | D4 | Only native `<input>`/`<textarea>`. Custom components use `:has()` hybrid. |
| `<meter>` | **Replaced** | D6 | Use styled `<div role="meter">` instead for cross-browser control. Already exists in codebase. |
| `color-mix()` | Yes | D4, D6 | Focus glow and meter colors. Well-supported. |
| `animation-timeline: scroll()` | **TBD** | D6 | Consider for meter-to-scroll binding. Descope if not useful. PO decision. |
| `::backdrop` | Yes | D6 | Dialog overlay. Optional feature. |
| `<dialog>` | Yes | D6 | Guidance overlay. Optional feature. |
| `@starting-style` | Yes | D1, D7 | Entry animations for details and flow panels. Correct usage. |
| `:checked` | Yes | D7 | Flow tab-cards via radio inputs. |
| `:disabled` | Yes | D8 | Guard states. |
| `:placeholder-shown` | Yes | D4 | "Next-to-fill" detection. Needs JS-assisted `data-next-to-fill` approach. |
| `:focus`/`:focus-within` | Yes | D3, D4 | Works with amended `pointer-events` strategy (summary stays clickable). |
| `@layer` | **Not used** | — | Could organize migration CSS layers. Low priority. |
| `@scope` | **Not used** | — | Could scope panel-specific styles. Low priority. |
| `@property` | **Not used** | — | Could enable animating meter color custom properties. Consider for D6. |

---

## New CSS Classes Requiring PO Approval

| Class | Phase | Purpose |
|:------|:------|:--------|
| `.card-meta` | D2 | Inline metadata span inside `<summary>` |
| `.card--dimmed` | D3 | Reduced opacity for completed/inactive cards |
| `.card--dissolving` | D5 | Reset cascade animation state |

---

## Phase Ordering

```
D1 (details migration) → D2 (header enrichment) → D7 (tab-cards) → D4 (validation) → D3 (progressive disclosure) → D5 (reset cascade) → D6 (meter + guidance) → D8 (guards)
```

**Change from original:** D7 moved before D4. The flow selector's tab-card structure (radio inputs with `:checked`) is a natural integration point for the validation framework. Building tab-cards first means D4's validation rules can account for radio state from the start.

---

## Critical Issues Tracker

All 4 critical issues from review with their resolutions:

| # | Issue | Phase | Resolution | Status |
|:--|:------|:------|:-----------|:-------|
| C1 | `:user-valid`/`:user-invalid` gap on custom components | D4 | Hybrid strategy: native pseudo-classes for `<input>`/`<textarea>`, `:has()` structural selectors for custom pickers/buttons | Resolved in plan |
| C2 | `::details-content` `block-size: auto` animation | D1 | Use `interpolate-size: allow-keywords`. Fallback: snap behavior | Resolved in plan |
| C3 | `pointer-events: none` contradicts `:focus-within` and guard clicks | D3, D8 | `pointer-events: auto` on `<summary>`, `pointer-events: none` only on `.card-body` when dimmed | Resolved in plan |
| C4 | `:first-of-type` does not select "first empty field" | D4 | JS-set `data-next-to-fill` attribute; CSS styles the attribute | Resolved in plan |

---

## Protected File Check

| File | Edited? | Notes |
|:-----|:--------|:------|
| `spec/spec_concept.md` | No | UJ table may need PO update after D3 |
| `config/flows.yaml` | No | |
| `src/css/variables.css` | Possibly | New custom properties (transition durations, guard colors) may be needed. **Permission required per CLAUDE.md.** |
| `src/css/special.css` | No | |
| `.github/workflows/` | No | |
