# Stage D — Progressive Disclosure Redesign

---

## Overview

Stage D builds on the Stage C redesign framework to add progressive disclosure, validation feedback, and modern CSS techniques. This plan integrates architectural fixes for native HTML5 behaviors, CSS-driven validation, and visually sequenced reset cascades.

**Target browsers:** Latest Greatest Chrome, Firefox, Edge. No legacy fallbacks — users are assumed to be bleeding-edge developers.

**PR Structure:** 3 PRs grouped by user-facing value:

1. **PR1 — Native Card Foundation** (D1): `<details>`/`<summary>` migration. Ship independently to validate browser behavior before building on top.
2. **PR2 — Progressive Disclosure & Guards** (D2 + D5 + D6 + D7): The core UX value — reset cascade, guided card flow, guard states, and card-meta enrichment. All serve the same goal: guiding users through the journey.
3. **PR3 — Validation & Flow Polish** (D4): CSS-driven validation framework and flow selector upgrade.

**Animation budget:** Max 4 motion types app-wide:

1. Card open/close (`::details-content` transition)
2. Reset cascade (staggered `transition-delay` dissolve)

---

## Card State Machine

Each card has exactly one state at any time, managed via `data-card-state` attribute:

```
LOCKED → SKIPPABLE → ACTIVE → SUFFICIENT → COMPLETE
  ↑                                 |           |
  └──────────── RESET ←─────────────┴───────────┘
```

| State        | Attribute                      | Visual treatment                 | Behavior                                                                                                         |
| :----------- | :----------------------------- | :------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| `locked`     | `data-card-state="locked"`     | Muted, non-interactive body      | Card cannot open. `<summary>` click shows tooltip explaining missing prerequisite (e.g., "Configure repo first") |
| `skippable`  | `data-card-state="skippable"`  | Muted but openable               | Card can be manually opened/explored, but upstream card hasn't reached `sufficient` yet. User can peek ahead     |
| `active`     | `data-card-state="active"`     | Full opacity, highlighted border | The guided "next step" — fully interactive, receives focus on transition                                         |
| `sufficient` | `data-card-state="sufficient"` | Slightly dimmed (`opacity: 0.6`) | All required fields filled; user can still fill optional fields. Downstream card transitions to `active`         |
| `complete`   | `data-card-state="complete"`   | Dimmed (`opacity: 0.35`)         | All fields filled or no further input possible. Editing triggers downstream reset                                |

**Transitions:**

- App init → Card 1 `active`, Cards 2–4 `locked`
- Card 1 hard prerequisites met (repo configured) → Card 2 transitions `locked` → `skippable`
- Preceding card reaches `sufficient` → next card transitions `skippable` → `active`
- All required fields filled → card transitions `active` → `sufficient`
- All fields filled (or no more input possible) → card transitions `sufficient` → `complete`
- Upstream data cleared → downstream cards transition to `locked` via reset cascade
- User re-edits `sufficient`/`complete` card → `:focus-within` temporarily undims; downstream cards may reset depending on what changed

**Locked vs Skippable — when to use which:**
| Scenario | State | Rationale |
|:---------|:------|:----------|
| Steps card, no repo configured | `locked` | Cannot function without repo — hard prerequisite |
| Steps card, repo set but task optional fields empty | `skippable` | User may want to peek at steps while still filling task details |
| Prompt card, no flow selected | `locked` | Cannot generate prompt without flow — hard prerequisite |
| Prompt card, flow selected but steps not reviewed | `skippable` | User may want to preview prompt shape before customizing steps |

**Single source of truth:** The disclosure controller in JS manages `data-card-state` on each `<details>` element. CSS uses `[data-card-state="..."]` selectors exclusively — no parallel `:has()` dependency detection in CSS.

---

## Phase D1: Card Infrastructure Migration

### Goal

Replace JS-driven `.card--open` toggle with native `<details>`/`<summary>`, removing `initCardToggles()`, `expandCard()`, `collapseCard()`, and the `.card--open` class entirely.

### Key Changes

- [x] D101 – `<section class="card">` → `<details class="card">`

- [x] D102 – `<button class="card-header">` → `<summary class="card-header">`

- [x] D103 – Normalize all card header titles to use `<h3>` consistently (Card 3 Steps currently uses `<span>` — align with other cards)
- [x] D104 – `.card-body` sits after `<summary>`, wrapped by `::details-content` automatically
- [x] D105 – CSS: Remove `.card:not(:where(.card--open)) > .card-body { display: none }` (layout.css:115-117) — replaced by native `<details>` behavior
- [x] D106 – JS: Remove `initCardToggles()` from main.js (lines 10-24), `expandCard()`/`collapseCard()` from components.js (lines 20-38)
- [x] D107 – Chevron icon appending logic relocates from `initCardToggles()` into lightweight `initChevrons()` init
- [ ] D108 – **Edge Case (Validation):** Skipped — no `<form>` element exists yet; deferred to future phase
- [x] D110 – **Caution:** Do **not** use the `name` attribute on `<details>` unless an exclusive accordion is required; the current design allows multiple open cards simultaneously
- [x] D111 – Audit and migrate click listeners: Replace click listeners on `.card-header` (or elements becoming `<summary>`) with `toggle` listeners on the parent `<details>` for native compatibility and to prevent browser conflicts
  - Example: In `card-configuration.js` (line 551), swap the header click listener for a `<details>` `toggle` listener; check `event.target.open` to detect expansion
  - **Edge Case (Ctrl+F):** Use `toggle` listeners to sync app state when browsers auto-expand cards during text searches

### Sub-panel migration (card-tasks.js)

- [x] D112 – `renderDualPanels()` creates nested cards as `<details open class="card">` with `<summary class="card-header">`
- [x] D113 – `renderPanelHeader()` creates `<summary>`, click handler removed (native toggle replaces it)

### `::details-content` animation

- [x] D114 –

```css
details {
  interpolate-size: allow-keywords; /* Enables block-size animation */
}
details::details-content {
  block-size: 0;
  overflow: clip;
  transition:
    block-size 0.3s ease,
    content-visibility 0.3s ease;
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

- [x] D201 – Add `<span class="card-meta">` inside each `<summary>`, after the title
- [x] D202 – `.card-meta` styles in components.css; `:has()` rule removed (unnecessary — grid `auto` column handles h3 sizing)
- [x] D203 – Refactor `setConfigCardSummary()` → `updateConfigCardMeta()` to populate `.card-meta` instead of directly manipulating the title element's first child

### Metadata content per card

| Card          | Collapsed summary shows         |
| :------------ | :------------------------------ |
| Configuration | owner/repo/branch icons + names |
| Task          | Selected flow name              |
| Steps         | Step count (e.g., "3 steps")    |
| Prompt        | quality meter                   |

- [x] D204 – Populate `.card-meta` for Task (flow name), Steps (step count), and Prompt (quality meter moved from body to header) cards

---

## Phase D4: Validation & Feedback Framework

### Goal

Replace JS-driven `renderError()` and `updateRequiredGroupIndicators()` with CSS-driven validation feedback using `:user-valid`/`:user-invalid` and `:has()` on native elements.

### Key Changes

- [x] D401 – `:user-valid`/`:user-invalid` on native `<input>`/`<textarea>` with `required` attribute
- [x] D402 – For `.field-picker` (non-native element): use `data-state="invalid"` attribute set by JS, styled with `:has()` selectors. No Web Components in Stage D
- [x] D403 – JS layer sets `data-next-to-fill` on the first empty required field for CSS highlighting (single mechanism — replaces both the prior `:placeholder-shown` and `data-next-to-fill` approaches)
- [x] D404 – `color-mix()` for focus glow effects
- [x] D405 – Remove `.required-group-dot` system
- [x] D406 – `field-sizing: content` on text inputs for auto-sizing

---

## Phase D5: Reset & Cascade Logic

### Goal

When upstream data changes (e.g., user clears PAT, switches repo, changes flow), downstream cards dissolve and reset in a visually sequenced cascade.

### Key Changes

- [x] D501 – `resetDownstream(from)` function extending existing `resetSession()` (state.js lines 187-198)
- [x] D502 – **Focus Management:** Programmatically move `document.activeElement` to the next logical input or the next card's `<summary>` post-transition to prevent focus drop to `<body>`
- [x] D503 – State mutation during animation: Use `requestAnimationFrame` batching to coalesce rapid `setState()` calls. Subscriber notifications are naturally deferred to the next frame — no `_suppressNotify` flag, preserving DM-INV-02 invariant:

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

- [x] D504 – Stagger timing: Offset card `transition-delay` by 50–100ms for a sequential dissolve. Maintain a 300ms duration to ensure the flow is responsive and progressive
- [x] D505 – `resetDownstream()` updates `data-card-state` on affected cards (transitions them to `locked` via the card state machine)

### Reset cascade table

"Dissolve" = set `data-card-state="locked"` (visual collapse via D6 CSS). "Clear state" = wipe the corresponding state slice. Branch-level changes only dissolve — step/task data is branch-independent and must be preserved.

Re-selecting the same flow is a no-op (no reset, no re-render) to prevent accidental data loss.

| Trigger         | Cards affected      | Dissolves cards | Clears state              |
| :-------------- | :------------------ | :-------------- | :------------------------ |
| Clear PAT       | Task, Steps, Prompt | ✓               | task + panels + steps     |
| Clear username  | Task, Steps, Prompt | ✓               | task + panels + steps     |
| Clear repo      | Task, Steps, Prompt | ✓               | task + panels + steps     |
| Clear branch    | Steps, Prompt       | ✓               | — (data preserved)        |
| Flow switch     | Steps, Prompt       | ✓               | panels + steps (new flow) |
| Same-flow click | —                   | —               | — (no-op)                 |

---

## Phase D6: Progressive Disclosure Flow

### Goal

Guide users through a step-by-step journey: highlight the active card, dim completed cards. **Lead with guidance, not gating** — users can freely navigate between cards but are visually guided toward the next logical step.

### Key Changes

- [x] D601 – CSS for all five card states:

```css
[data-card-state='locked'] {
  opacity: 0.3;
}
[data-card-state='skippable'] {
  opacity: 0.5;
}
[data-card-state='active'] {
  opacity: 1;
  border-color: var(--accent-a);
}
[data-card-state='sufficient'] {
  opacity: 0.6;
}
[data-card-state='complete'] {
  opacity: 0.35;
}
```

- [x] D602 – `pointer-events: auto` on `<summary>` for all non-active states — always allow expand/collapse (except `locked` which prevents open)
- [x] D603 – `:focus-within` undims `sufficient`/`complete` cards for re-editing: `[data-card-state="sufficient"]:focus-within, [data-card-state="complete"]:focus-within { opacity: 1 }`
- [x] D604 – `[data-card-state="skippable"]` cards can be manually opened — body renders but with muted styling to signal "you can look, but upstream isn't done"
- [x] D605 – Disclosure controller: JS module that observes state changes and updates `data-card-state` on each `<details>` element. Single orchestration point for both card-level and field-level visibility. Evaluates:
  - Hard prerequisites (locked vs skippable)
  - Required field completeness (active → sufficient)
  - Full field completeness (sufficient → complete)

---

## Phase D7: Non-Happy Path Guards

### Goal

When hard prerequisites are missing (e.g., no repo selected), prevent card from opening and show a tooltip explaining what's needed. **`locked` is reserved for truly impossible states** — cards the user could reasonably peek at use `skippable` instead.

### Key Changes

- [x] D701 – `[data-card-state="locked"]` styling: card cannot be opened (JS prevents `<details>` from toggling open). Body content hidden
- [x] D702 – `anchor-name` / CSS anchor positioning for guard tooltips on `<summary>` of `locked` cards
- [x] D703 – On `locked` card `<summary>` click: prevent open, show tooltip with prerequisite message. Subtle `prefers-reduced-motion`-respecting highlight pulse:

```css
@keyframes highlight-pulse {
  0%,
  100% {
    outline-color: transparent;
  }
  50% {
    outline-color: var(--accent-a);
  }
}
[data-card-state='locked'] > summary:active {
  animation: highlight-pulse 0.6s ease;
}
@media (prefers-reduced-motion: reduce) {
  [data-card-state='locked'] > summary:active {
    animation: none;
    outline: 2px solid var(--accent-a);
  }
}
```

- [x] D704 – Guard conditions managed by the disclosure controller (D605), not by scattered CSS `:has()` selectors — keeps dependency logic in one place
- [x] D705 – `[data-card-state="skippable"]` cards allow open but show a subtle banner/hint inside the card body indicating upstream is incomplete (e.g., "Complete Task card for best results")
