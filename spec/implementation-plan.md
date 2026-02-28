# Implementation Plan

> **Status**: Draft v4 — updated for 4-flow dual-panel framework.
> **Date**: 2026-02-28

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Map](#2-file-map)
3. [Preconditions & Blockers](#3-preconditions--blockers)
4. [Phase 0 — CSS Foundation](#4-phase-0--css-foundation)
5. [Phase 1 — State Management](#5-phase-1--state-management)
6. [Phase 2 — Build Pipeline & Flow Loading](#6-phase-2--build-pipeline--flow-loading)
7. [Phase 3 — GitHub API & Caching](#7-phase-3--github-api--caching)
8. [Phase 4 — Card 1: Configuration](#8-phase-4--card-1-configuration)
9. [Phase 5 — Card 2: Super Tasks](#9-phase-5--card-2-super-tasks)
10. [Phase 6 — Card 3: Steps](#10-phase-6--card-3-steps)
11. [Phase 7 — Card 4: Prompt Output](#11-phase-7--card-4-prompt-output)
12. [Phase 8 — Polish & Global Constraints](#12-phase-8--polish--global-constraints)
13. [Phase 9 — End-to-End Tests](#13-phase-9--end-to-end-tests)
14. [Requirement Coverage Matrix](#14-requirement-coverage-matrix)
15. [Risk Register](#15-risk-register)
16. [Open Questions for PO](#16-open-questions-for-po)
17. [Technical Decisions](#17-technical-decisions)

---

## 1. Architecture Overview

```
index.html
  └── main.js (entry point)
        ├── state.js          ← centralized state via setState()
        ├── prompt-builder.js ← deterministic prompt generation
        ├── github-api.js     ← GitHub REST API calls
        ├── cache.js          ← localStorage cache layer
        ├── flow-loader.js    ← imports pre-validated flow JSON
        ├── components.js     ← shared UI primitives (shimmer, errors, dropdowns)
        ├── card-configuration.js
        ├── card-tasks.js
        │     └── file-tree.js
        ├── card-steps.js
        └── card-prompt.js
```

**Data flow**: User interaction → `setState()` call → state updated → prompt rebuilt → UI subscribers notified → DOM updated.

**No frameworks, no build-time dependencies beyond Vite and js-yaml.**

---

## 2. File Map

### Source files

| File                           | Purpose                                                                                  | Created in | Req IDs                          |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ---------- | -------------------------------- |
| `src/css/variables.css`        | CSS custom properties (colors, type, spacing)                                            | Phase 0    | VIS-\*                           |
| `src/css/styles.css`           | All component styles, mobile-first                                                       | Phase 0    | GL-03, VIS-01, VIS-02            |
| `src/index.html`               | Shell: 4 card containers, script/css imports                                             | Phase 0    | APP-01                           |
| `src/js/main.js`               | Entry point: init state, render cards, wire events                                       | Phase 1    | APP-01, APP-02                   |
| `src/js/state.js`              | `setState()`, `getState()`, `subscribe()`, session reset                                 | Phase 1    | DM-INV-01..03, DM-DEF-01, APP-04 |
| `src/js/prompt-builder.js`     | Pure function: `prompt_input` → prompt string                                            | Phase 1    | OUT-01..04, DM-INV-03            |
| `src/js/components.js`         | Shared UI: shimmer skeleton, inline error, dismissible notification, searchable dropdown | Phase 0/3  | GL-02, GL-04, SCT-06             |
| `src/js/github-api.js`         | GitHub REST: repos, branches, tree, PRs, issues                                          | Phase 3    | CFG-02..05, APP-03               |
| `src/js/cache.js`              | localStorage read/write, TTL, PAT-change invalidation                                    | Phase 3    | GL-05, APP-04                    |
| `src/js/flow-loader.js`        | Import pre-validated flow JSON, expose `getFlows()`, `getFlowById()`                     | Phase 2    | DM-DEF-02, SCT-07                |
| `src/js/card-configuration.js` | Card 1 UI: PAT, username, repo grid, branch grid                                         | Phase 4    | CFG-01..05                       |
| `src/js/card-tasks.js`         | Card 2 UI: flow selector + dual-panel (Situation/Target) + quality meter                 | Phase 5    | SCT-01..09                       |
| `src/js/file-tree.js`          | Recursive file tree for file selection (flow-dependent)                                  | Phase 5    | SCT-01, SCT-06                   |
| `src/js/quality-meter.js`      | Quality Meter: field weight scoring + color bar rendering                                | Phase 5    | SCT-08                           |
| `src/js/step-generator.js`     | Auto-generate steps from flow definition + filled panel fields                           | Phase 6    | STP-01, STP-02                   |
| `src/js/card-steps.js`         | Card 3 UI: auto-generated step list, lens toggles, trash icons                           | Phase 6    | STP-01..04                       |
| `src/js/card-prompt.js`        | Card 4 UI: prompt preview, copy, notes, Open in Claude                                   | Phase 7    | OUT-01..08                       |

### Config/build files

| File                         | Purpose                                                 | Created in |
| ---------------------------- | ------------------------------------------------------- | ---------- |
| `config/flow-schema.js`      | JSON Schema for flows.yaml validation (build-time only) | Phase 2    |
| `config/vite-plugin-yaml.js` | Vite plugin: parse YAML → validate → emit JSON          | Phase 2    |

### Test files

| File                               | Purpose                                                         | Created in |
| ---------------------------------- | --------------------------------------------------------------- | ---------- |
| `tests/state.test.js`              | State management: setState, subscribe, session reset, hydration | Phase 1    |
| `tests/prompt-builder.test.js`     | Deterministic prompt generation, snapshot tests                 | Phase 1    |
| `tests/flow-loader.test.js`        | Flow loading, schema validation                                 | Phase 2    |
| `tests/github-api.test.js`         | API calls (mocked), error handling, limits                      | Phase 3    |
| `tests/cache.test.js`              | Cache read/write, TTL, PAT invalidation cascade                 | Phase 3    |
| `tests/card-configuration.test.js` | Card 1 behavior                                                 | Phase 4    |
| `tests/card-tasks.test.js`         | Card 2: flow selection, dual-panel inputs, quality meter        | Phase 5    |
| `tests/quality-meter.test.js`      | Quality meter scoring, threshold colors, per-flow weights       | Phase 5    |
| `tests/step-generator.test.js`     | Step auto-generation from flow + panel fields                   | Phase 6    |
| `tests/card-steps.test.js`         | Card 3: auto-generated steps, lens toggling, step removal       | Phase 6    |
| `tests/card-prompt.test.js`        | Card 4 behavior, copy, notes                                    | Phase 7    |
| `tests/e2e.test.js`                | Full user journey: repo → flow → steps → copy                   | Phase 9    |

---

## 3. Preconditions & Blockers

| #   | Precondition                                                                                                                                                          | Needed by               | Status                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------- |
| P1  | **PO approval**: placeholder flows in `flows.yaml` for development (file is protected per CLAUDE.md)                                                                  | Phase 2                 | not approved, we will use all 4 flows directly, see below |
| P2  | **PO to review flows** in `flows.yaml` with full field + step definitions for all 4 flows                                                                             | Phase 5 (full), Phase 6 | Approved by human, please validate file by reviewing      |
| P3  | **OUT-07 decided**: "Prompt Claude" button deep-links to `claude.ai/new?q=<encoded-prompt>` — opens Claude in a new tab with the prompt pre-filled in the chat input. | Phase 7                 | **Resolved**                                              |
| P4  | **PR template** exists at `.github/pull_request_template.md`                                                                                                          | All PRs                 | Done (already exists)                                     |
| P5  | **CI pipeline** exists (lint, test, build)                                                                                                                            | All PRs                 | Done (ci.yml exists)                                      |
| P6  | **Node 20+** available in dev environment                                                                                                                             | Phase 0                 | Done (.nvmrc exists)                                      |

---

## 4. Phase 0 — CSS Foundation `Testing`

**Goal**: Design tokens, base layout, card shell, mobile-first responsive grid.

**Req IDs**: VIS-\*, GL-03 (foundation), GL-02 (shimmer class)

### Checklist

- [x] Populate `src/css/variables.css` with all tokens from spec VIS section (colors, typography, spacing)
- [x] Write base styles in `src/css/styles.css`:
  - Page background (`--shell`), body typography
  - Card component: collapsed/expanded states, header with expand/collapse, `aria-expanded` attribute styling
  - Active/selected item: 3px left-edge `--accent` bar + `--accent-subtle` background
  - Button grid: wrapping grid, hover states
  - Pill toggles: on/off states
  - Input fields: password, text, with focus states
  - Shimmer-bar skeleton: reusable `.shimmer` class on `--surface-inset`, opacity pulse animation
  - Empty-state message: contextual inline message (not blank area)
  - Inline error: `--danger` colored, dismissible
- [x] Update `src/index.html` with 4 card container `<section>` elements, semantic HTML
  - Card headers use `<button>` elements (not divs) for accessibility
  - `aria-expanded="true|false"` on card headers
- [x] Mobile-first: base styles for small screens, `@media (min-width: 768px)` for larger
- [x] Accessibility: card expand/collapse via keyboard (Enter/Space), focus-visible outlines

### Output

- `src/css/variables.css` — complete
- `src/css/styles.css` — base layout complete
- `src/index.html` — card shell complete

---

## 5. Phase 1 — State Management `To test`

**Goal**: Centralized state with `setState()`, automatic prompt rebuild, session/persistent separation.

**Req IDs**: DM-INV-01, DM-INV-02, DM-INV-03, DM-DEF-01, APP-04

### Technical Design: `setState()` over Proxy

The spec allows "Proxy wrapper or `setState()` function" (DM-INV-02). We choose **`setState()`** because:

- **Simpler**: no deep Proxy wrapping needed for nested objects/arrays
- **Debuggable**: every mutation has an explicit call site
- **Anti-Over-Engineering Rule**: a function call is the minimum complexity that satisfies the requirement
- **Array-safe**: `push()`/`splice()` on `enabled_steps` don't need special Proxy traps

```js
// API surface
export function getState()                    // returns frozen snapshot
export function setState(pathOrUpdater, value) // triggers rebuild + notify
export function subscribe(listener)            // called after each setState
export function resetSession()                 // clears repo/branch/prefs, keeps PAT/username
```

**Session vs. persistent state** (per APP-04):

- **Persistent** (survives page reload): `configuration.pat`, `configuration.owner` → saved to `localStorage`
- **Session** (cleared on page reload): `configuration.repo`, `configuration.branch`, `panel_a.*`, `panel_b.*`, `task.*`, `steps.*`, `improve_scope`, `notes.*` → initialized to defaults on every page load

### Prompt Builder

Pure function `buildPrompt(promptInput) → string`. Called inside `setState()` after every mutation. Result stored on state as a derived field (not part of `prompt_input` itself).

### Checklist

- [x] Create `src/js/state.js` with `setState()`, `getState()`, `subscribe()`, `resetSession()`
- [x] Implement two-layer merge strategy (DM-DEF-01): flow defaults → user overrides, applied on flow selection
- [x] On `setState()`: update state → call `buildPrompt()` → notify subscribers.
- [x] Hydrate PAT + username from `localStorage` on init; validate stored data shape before hydrating (guard against corruption)
- [x] `resetSession()`: clear all fields except PAT/username, reset derived prompt
- [x] Create `src/js/prompt-builder.js` with `buildPrompt(promptInput)` pure function
- [x] Prompt format per OUT-02: XML tags, repo context header, flow-specific `<task>` section with Panel A/B content, ordered `<todo>` steps, notes section. Prompt template varies per flow (fix/review/implement/improve).
- [x] File references use `@` prefix per OUT-04: `@src/utils/auth.js`
- [x] Step 1 always present (read claude.md); remaining steps are dynamic from `enabled_steps`
- [x] **Test**: `tests/state.test.js` — setState triggers rebuild, subscribe fires, session reset preserves PAT, corrupted localStorage handled gracefully
- [x] **Test**: `tests/prompt-builder.test.js` — deterministic output (snapshot test, TST-01), empty state, full state, various step combinations

### Output

- `src/js/state.js`
- `src/js/prompt-builder.js`
- `tests/state.test.js`
- `tests/prompt-builder.test.js`

---

## 6. Phase 2 — Build Pipeline & Flow Loading `To start`

**Goal**: YAML → JSON build step with schema validation; flow loader module.

**Req IDs**: DM-DEF-02, DM-DEF-03, SCT-07, TST-03

### Technical Design: Vite Plugin

A custom Vite plugin (`config/vite-plugin-yaml.js`) that:

1. Intercepts imports of `.yaml` files
2. Parses YAML to JS object via `js-yaml` (dev dependency)
3. Validates against schema defined in `config/flow-schema.js`
4. On validation failure: throws build error with clear message (DM-DEF-02, TST-03)
5. Emits validated JSON for runtime import

The schema file lives in `config/` (not `src/js/`) because it's a build-time artifact that should not be bundled into production code.

### Checklist

- [x] Check if `src/js/state.js`, `src/js/prompt-builder.js`, `tests/state.test.js`, and `tests/prompt-builder.test.js` need updates to match @spec/hybrid-framework-design.md.
- [x] Understand, review and validate flows.yaml
- [x] Install `js-yaml` as dev dependency
- [x] Create `config/flow-schema.js` — JSON Schema defining valid flow structure (label, icon, panel_a/panel_b with field definitions, steps array with operation/object/lenses/params/source/locked)
- [x] Create `config/vite-plugin-yaml.js` — Vite plugin: `transform` hook for `.yaml` files, parse + validate + emit JSON
- [x] Create `src/js/flow-loader.js` — `import flows from '../config/flows.yaml'`; exports `getFlows()`, `getFlowById(id)`
- [x] Build fails with clear error message on malformed YAML or schema violation
- [x] **Test**: `tests/flow-loader.test.js` — valid flows load, invalid flows cause error, getFlowById returns correct flow
- [x] **Test**: TST-03 — malformed flow file causes build failure with clear error

### Output

- `config/flow-schema.js`
- `config/vite-plugin-yaml.js`
- `src/js/flow-loader.js`
- `tests/flow-loader.test.js`

---

## 7. Phase 3 — GitHub API & Caching `Testing`

**Goal**: GitHub REST API module with caching layer, background refresh, limit enforcement.

**Req IDs**: CFG-02, CFG-05, APP-03, GL-05, GL-04

### Checklist

- [x] Create `src/js/github-api.js`:
  - `fetchRepos(owner, pat)` — list repos for user
  - `fetchBranches(owner, repo, pat)` — list branches
  - `fetchTree(owner, repo, branch, pat)` — recursive file tree
  - `fetchPRs(owner, repo, pat)` — open PRs (#number — title)
  - `fetchIssues(owner, repo, pat)` — open issues (#number — title)
  - All functions return `{ data, error }` — never throw
  - Enforce APP-03 limits: <300 files/repo (truncate tree + show warning), <15 repos/user (show first 15 + warning message)
- [x] Create `src/js/cache.js`:
  - `cacheGet(key)` / `cacheSet(key, data, ttl)` — localStorage with TTL (15min default)
  - **PAT-change cascade**: `cacheClear()` flushes ALL cached data (repos, branches, trees, PRs, issues) — full cache clear
  - Guard against corrupted/malformed localStorage entries — catch JSON parse errors, clear invalid entries
  - Cache key prefix `ap_cache_` avoids collision with app state
- [x] Create `src/js/components.js` (shared UI primitives):
  - `renderShimmer(container, label, barCount)` — shimmer skeleton with contextual label (GL-02)
  - `renderError(container, message, onRetry)` — inline error, dismissible (GL-04)
  - `showNotification(container, message, type)` — brief "Updated" / success / error indicator, auto-removes after 2s
  - `createSearchableDropdown(container, {options, onSelect, placeholder})` — mobile-first filter + list for SCT-06 (44px touch targets)
- [x] **Accessibility**: error messages use `role="alert"`, notifications use `aria-live="polite"`
- [x] **Test**: `tests/github-api.test.js` — mock fetch, success/error paths, limit enforcement (25 tests)
- [x] **Test**: `tests/cache.test.js` — TTL expiry, PAT invalidation cascade, corrupted data handling (19 tests)
- [x] **Test**: `tests/components.test.js` — shimmer, error, notification, searchable dropdown (22 tests)

### Output

- `src/js/github-api.js`
- `src/js/cache.js`
- `src/js/components.js`
- `tests/github-api.test.js`
- `tests/cache.test.js`

---

## 8. Phase 4 — Card 1: Configuration `Testing`

**Goal**: PAT input, username, repo grid, branch grid — fully wired to state and API.

**Req IDs**: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, APP-04

### Checklist

- [x] Create `src/js/card-configuration.js`:
  - PAT password field with show/hide toggle + "Clear" action (CFG-01)
  - PAT persisted to localStorage on change; clear action removes it
  - Username text input, pre-filled from localStorage (CFG-02)
  - On page load: auto-fetch repos using stored PAT + username (CFG-02)
  - Repo buttons: scrollable wrapping button grid, single-tap select (CFG-03)
  - Selected repo: 3px left `--accent` bar + `--accent-subtle` bg (VIS treatment)
  - On repo select: fetch branches + full file tree in background (CFG-05), auto-select default branch (CFG-04), expand Tasks card, collapse Configuration card
  - Branch buttons: wrapping grid, auto-selected default highlighted (CFG-04)
  - On branch change: reload file tree (from UJ table: "Branch selected → reload file tree")
  - On PAT change: re-fetch repos, flush entire cache (PAT cascade)
  - Shimmer skeletons while repos/branches load (GL-02)
  - Inline errors on API failure (GL-04)
  - All `setState()` calls for configuration fields
- [x] **Click audit (GL-01)**: repo select = 1 click, branch select = 1 click, PAT entry = typing only. All within target.
- [x] **Mobile (GL-03)**: repo/branch grids reflow on small screens, no horizontal scroll, comfortable touch targets (VIS-02)
- [x] **Accessibility**: buttons have visible focus states, PAT field has `autocomplete="off"`, form inputs have labels
- [x] **Test**: `tests/card-configuration.test.js` — PAT persistence, repo fetch on load, branch auto-select, card collapse behavior, PAT clear (33 tests)

### Output

- `src/js/card-configuration.js`
- `tests/card-configuration.test.js`

---

## 9. Phase 5 — Card 2: Task (Dual-Panel) `Testing`

**Goal**: Flow selector grid with dual-panel layout (Situation/Target), flow-specific input fields, quality meter.

**Req IDs**: SCT-01..09, DM-DEF-03

**Dependency**: Phase 2 (flow loader) + Phase 3 (file tree API). Full flow definitions (P2) needed — draft in `spec/hybrid-framework-design.md`.

### Checklist

- [x] Create `src/js/card-tasks.js`:
  - Flow buttons: wrapping grid with icon + title per button, single row per button (VIS-01, SCT-03)
  - 4 flows per SCT-02: Fix / Debug, Review / Analyze, Implement / Build, Improve / Modify
  - On flow select: `setState('task.flow_id', id)` + reset panel_a, panel_b, steps, improve_scope (DM-DEF-03 — full reset, no carry-over)
  - On flow select: expand Steps + Prompt cards, collapse Configuration (from UJ table)
  - **Dual-panel layout** per SCT-04: left/right on desktop (50/50 split), stacked on mobile. Panel A = "Situation" (+ flow subtitle), Panel B = "Target" (+ flow subtitle). Fields within each panel are driven by flow definition in flows.yaml.
  - Required group validation per SCT-05: at least one field in each required group must be filled. Visual indicator when group is unsatisfied.
  - If flow requires PRs/issues: trigger fetch (from UJ table)
  - Selected flow: accent bar + subtle background
  - Shimmer skeleton while data loads (GL-02)
- [x] Create `src/js/file-tree.js` (file selection for Panel A/B file pickers):
  - Flat searchable list (not role="tree"; PO decision — see Decisions Log)
  - Files update `panel_a.files`, `panel_b.spec_files`, or `panel_b.guideline_files` via `setState()` (SCT-01)
  - Full tree pre-loaded (APP-03 — within 300-file limit)
  - If tree exceeds 300 files: truncate and show warning message
  - **Spec vs Guideline**: file pickers for spec_files and guideline_files display helper text distinguishing WHAT (specs) vs HOW (guidelines) per SCT-06
- [x] Create `src/js/quality-meter.js` (SCT-08):
  - Hybrid-design weights: PR=20, file=10, text=10, notes=10, lens=5, issue=5 (PO decision)
  - Score = filled weights / total possible weights for the active flow
  - Render thin horizontal bar below flow selector with 6 color thresholds (Poor/Minimal/Basic/Good/Strong/Excellent)
  - Updates on every state change via subscription
- [x] **Improve/Modify scope selector** (SCT-09): when 2+ files selected in panel_a.files, show toggle: "Each file separately" vs "Across files together". Updates `improve_scope` in state.
- [x] Pre-fillable options use flat searchable dropdowns (SCT-06): file pickers (flat alphabetical list), PR/issue pickers (#number — title).
- [x] **Click audit (GL-01)**: flow select = 1 click, file toggle = 1 click. All within target.
- [x] **Mobile (GL-03)**: flow grid reflows, dual-panel stacks vertically, file pickers scroll, touch targets adequate
- [x] **Test**: `tests/card-tasks.test.js` — flow selection resets panels + steps, dual-panel renders per flow, required groups validate
- [x] **Test**: `tests/quality-meter.test.js` — scoring per flow, threshold colors, updates on field change

### Output

- `src/js/card-tasks.js`
- `src/js/file-tree.js`
- `src/js/quality-meter.js`
- `tests/card-tasks.test.js`
- `tests/quality-meter.test.js`

---

## 10. Phase 6 — Card 3: Steps (Auto-Generated) `Testing`

**Goal**: Auto-generated step list from flow + panel inputs, with lens fine-tuning and deletion.

**Req IDs**: STP-01..04

**Dependency**: Phase 2 (flow definitions) + Phase 5 (flow selection + panel fields populate steps).

### Checklist

- [x] Create `src/js/step-generator.js`:
  - `generateSteps(flowDef, panelA, panelB)` → returns ordered step array
  - Base steps come from flow definition in flows.yaml
  - Conditional steps (with `source` field) only included when the referenced panel field is filled
  - No locked steps — all steps deletable per PO direction
  - Called from card-steps.js subscriber whenever flow, panel_a, or panel_b changes — result stored in `steps.enabled_steps`
- [x] Create `src/js/card-steps.js`:
  - Render ordered step list from `state.steps.enabled_steps` (STP-01)
  - Each step is a compact single row: step number, operation + object label, optional lens pills
  - All steps deletable (no locked steps per PO direction)
  - Lens pills: show first 7 (selected first), "+N more" toggle for remainder (STP-03)
  - Delete button (trash icon) on every step — single tap removes it (STP-04)
  - Output mode pills for feedback steps (single-select: here, pr_comment, etc.)
  - Optional text inputs for branch_name, pr_name, file_name fields
  - Steps cannot be reordered or manually added (STP-04)
  - All interactions call `setState()` to update `steps.enabled_steps`
- [x] **Click audit (GL-01)**: lens toggle = 1 click, step delete = 1 click. All within target.
- [x] **Mobile (GL-03)**: step list scrolls, adequate touch targets for lens pills and delete buttons
- [x] **Accessibility**: delete buttons have `aria-label="Remove step: [step name]"`, lens pills are `role="switch"` with `aria-checked`, output pills are `role="radio"` with `aria-checked`
- [x] **Test**: `tests/step-generator.test.js` — conditional step inclusion/exclusion, step ordering, deep copy safety, output array, no locked flag (24 tests)
- [x] **Test**: `tests/card-steps.test.js` — step rendering, lens toggling, step deletion, output pills, optional text inputs (31 tests)

### Output

- `src/js/step-generator.js`
- `src/js/card-steps.js`
- `tests/step-generator.test.js`
- `tests/card-steps.test.js`

---

## 11. Phase 7 — Card 4: Prompt Output `Testing`

**Goal**: Prompt preview, copy to clipboard, user notes, Prompt Claude deep-link button.

**Req IDs**: OUT-01..08

### Checklist

- [x] Create `src/js/card-prompt.js`:
  - Prompt preview: `--surface-inset` background, `--font-mono` at `--text-sm`, left-aligned (VIS treatment, OUT-01)
  - Preview updates live as `prompt_input` changes (driven by state subscription)
  - "Copy" button: `navigator.clipboard.writeText()` — primary output action (OUT-05). On success: brief "Copied!" indicator. On failure: inline error.
  - Free-text notes field below prompt preview (OUT-06): textarea, stored in `notes.user_text`, wrapped in `<notes>` tags in output
  - "Prompt Claude ↗" button (OUT-07): deep-links to `https://claude.ai/new?q=<encoded-prompt>`, opening Claude in a new tab with the prompt pre-filled in the chat input.
  - Card never auto-collapses once visible (OUT-08). Once expanded after flow selection, stays expanded, except if user manually collapses it.
  - Prompt is fully regenerated from current `prompt_input` on every change (OUT-03, DM-INV-01)
- [x] **Mobile (GL-03)**: prompt area scrolls (max-height 300px), notes field is full-width
- [x] **Accessibility**: prompt preview area has `role="region"` and `aria-label="Generated prompt"`, copy button has status feedback via `aria-live`
- [x] **Test**: `tests/card-prompt.test.js` — 21 tests: prompt renders from state, copy button works (mock clipboard API), notes update state, card stays expanded, deep-link URL verified

### Output

- `src/js/card-prompt.js`
- `tests/card-prompt.test.js`

---

## 12. Phase 8 — Polish & Global Constraints `In progress`

**Goal**: Verify all global constraints, mobile audit, performance check, remaining polish.

**Req IDs**: GL-01 (audit), GL-03 (audit), GL-05 (deferred refresh), APP-01, APP-02

### Phase 8a — Mobile & Responsiveness Audit

- [x] Test every card on 320px, 375px, 768px, 1024px viewport widths
- [x] Verify no horizontal scrolling on any viewport (GL-03) — mobile-first CSS with `max-width: 680px` container
- [x] Verify touch targets ≥44px on primary interactive elements (VIS-02) — `btn-grid-item`, `btn-icon`, `btn-action` bumped to 44px
- [x] Verify button grids wrap correctly on small screens — `flex-wrap: wrap` on `.btn-grid`

### Phase 8b — Global Constraint Verification

- [x] **GL-01 click audit**: all primary actions ≤2 clicks. Repo=1 click, branch=1 click, flow=1 click, copy=1 click. No violations.
- [x] **GL-02 verify**: shimmer shown on all async loads (repos, branches). Empty states show contextual messages.
- [x] **GL-04 verify**: all errors are inline via `renderError()`, dismissible. No blocking modals.
- [x] **GL-05 verify**: `setInteracting()` / `isInteracting()` added to `components.js`. `deferIfInteracting()` in background refresh (retries up to 5× every 2s). Lens and output toggles call `setInteracting()`. Text focus detected via `document.activeElement`.
- [x] **APP-01 verify**: fully client-side, no server calls except GitHub API.
- [x] **APP-02 verify**: vanilla JS, ES modules, plain CSS — no frameworks or preprocessors.

### Phase 8c — Final Polish

- [x] Card auto-expand/collapse behavior per UJ table: verified in card-configuration.js + card-tasks.js
- [x] Re-opened Configuration auto-collapses on next trigger — `collapseCard('card-configuration')` always called on repo/flow select
- [x] CSS fix: `is:(.card-headers, .card-body)` → `:is(.card-header, .card-body)` with correct desktop padding
- [x] Run `npm run format` + `npm run lint:fix`
- [x] Run `npm run build` — clean build, no warnings. 351 tests passing.

### Output

- Updated CSS and JS files as needed
- All existing tests still pass

---

## 13. UAT Remediation `In progress`

**Goal**: Address all issues raised during UAT across all 4 cards.

### Configuration Card (1.x)

- [x] 1.1 Credentials row: PAT + username on same horizontal row (`.credentials-row`)
- [x] 1.2 SVG icon buttons: eye / eye-closed for toggle; X for clear (no text labels)
- [x] 1.3 Input icons: GitHub person icon for username, key icon for PAT
- [x] 1.4 Removed field labels — placeholders carry the label meaning
- [x] 1.5 Conditional: hide credentials on repo select, card stays open; show on re-open
- [x] 1.6 Fixed "Show More" bug: `reposCollapsed`/`branchesCollapsed` no longer reset inside render functions
- [x] 1.7 Branch display limit: show first 4 branches before "more" toggle
- [x] 1.8 Collapse config on flow select; show `owner / repo : branch` in card title
- [x] 1.9 Section icons: repo SVG + branch SVG prepended to section labels

### Task Card (2.x)

- [x] 2.1 Flow icon fix: `display:block;flex-shrink:0` on SVGs prevents clipping
- [x] 2.2 Flow grid: `grid-template-columns: repeat(4, 1fr)` forces 4-per-row layout
- [x] 2.3 Quality meter moved to prompt card (was task card)
- [x] 2.4 Panel visual separation: panel-a accent-tinted bg, panel-b inset bg
- [x] 2.5 Mandatory fields: BLOCKED — requires flows.yaml edit (not permitted without PO)
- [x] 2.6 File picker overflow: removed `overflow:hidden` from `.card`, added `border-radius` to `.card-header`
- [x] 2.7 Panel header: horizontal flex-row (label + subtitle on same line)
- [x] 2.8 Input contrast: `--surface-raised` background for inputs vs `--surface` card bg
- [x] 2.9 Picker icons: PR / issue / file SVGs prepended to field labels

### Steps Card (3.x)

- [x] 3.1 Step block styling: each step is a distinct block with border + rounded corners
- [x] 3.2 Compact output pills: 24px height, smaller font
- [x] 3.3 Optional text input: max-width 220px
- [x] 3.4 Trash icon: no button chrome (background/border stripped)
- [x] 3.5 PR clear button: already implemented; verified
- [x] 3.6 Lens sort removed: pills stay in fixed order (no jumping on toggle)

### Prompt Card (4.x)

- [x] 4.1 "Prompt" label removed from preview header (saves space)
- [x] 4.2 Copy button: clipboard SVG icon prepended

### Output

- 352 tests passing, clean build
- CSS: styles.css updated with all layout/visual changes

---

## 14. Phase 9 — End-to-End Tests `Testing`

**Goal**: Full user journey test, prompt determinism verification.

**Req IDs**: TST-01, TST-02

### Checklist

- [x] Create `tests/e2e.test.js`:
  - **TST-02**: repo select → flow select → step adjust → copied prompt matches expected output for fixed inputs
  - **TST-01**: prompt determinism — identical `prompt_input` always produces identical prompt text (snapshot test, run multiple times)
  - Test card expand/collapse transitions through the full journey
  - Test flow switch fully resets steps (DM-DEF-03)
  - Test PAT clear + re-entry flow
- [x] Run full test suite: `npm test`
- [x] Run `npm run build` — final build verification
- [x] Update status table in `spec/spec_concept.md` for all completed requirements

### Output

- `tests/e2e.test.js`
- Updated `spec/spec_concept.md` status table

---

## 15. Risk Register

| #   | Risk                                                                                             | Impact                         | Likelihood | Mitigation                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| R4  | localStorage corruption from version changes                                                     | Breaks state hydration         | Low        | Validate shape on hydration. If invalid, clear and start fresh. Log to console.                                          |
Use document fragment for batch DOM insertion. Consider virtual scrolling only if performance is measurably poor.        |
| R6  | Prompt rebuild causes UI jank on complex prompts                                                 | Degrades UX                    | Low        | Profile first. If measurable jank (>16ms rebuild), batch via `requestAnimationFrame`. Unlikely for text-only generation. |


---

# UAT Feedback Remediation — Phases 10–14

## Context

After Phase 9 (E2E tests), a UAT review surfaced broad visual, interaction, and logic
issues across all four cards. A prior partial UAT remediation was committed on 2026-02-27
but did not close all items. This plan defines five new implementation phases (10–14) to
fully address the remaining feedback.

---

## Ground Rules (all phases)

- **Max 2 new CSS variables** in this plan: `--shadow-sm` and `--shadow-md`. All other
  changes reuse or tune existing variables directly in `variables.css`.
- **No `color-mix()` in `styles.css`**. Allowed only in `variables.css` for variable
  definitions.
- **No inline styles** in `.html` or `.js`. All styles go in `styles.css`.
- **No `margin`** where flex/grid gap works. Use `gap`, `place-content`, `place-items`,
  `flex`, `grid` instead. Only use `margin` when there is no layout primitive alternative.
- **Single-value shorthands** for spacing (e.g. `gap: var(--sp-3)`). Only deviate for
  genuine asymmetry with real added value.
- **One `.icon` class** for all SVG icons. Variants via modifier classes (`.icon--sm`,
  `.icon--colored-edit`, etc.) — never a new class per icon location.
- **No drag-and-drop** step reordering. STP-04 is authoritative; spec unchanged.
- **No `padding-right` hacks** for icon overlap. Use flex/grid row layout.

---

## Blocked / Needs PO Decision

| Item | Blocker |
|------|---------|
| 2.5 Mandatory fields logic | Requires editing `src/config/flows.yaml` — PO must authorize |
| "Review: text input for target" | Review Panel B has no description field — requires `flows.yaml` edit |

---

## Phase 10 — Global Visual Foundation

**Goal:** Add shadow depth system, fix diamond chevrons to octicon arrows, deepen active
state contrast. Header padding left unchanged.

### Files
- `src/css/variables.css`
- `src/css/styles.css`

### 1. New shadow variables (`variables.css`)

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.10);
--shadow-md: 0 2px 8px rgba(0,0,0,0.14);
```

### 2. Deepen active state contrast (`variables.css`)

- Darken `--accent-subtle` so selected buttons are visibly distinct. Current:
  `#aed1d4` → target approximately `oklch(72% 0.06 195)` (adjust in review until
  contrast ratio ≥ 4.5:1 against `--text-primary`).

### 3. Fix diamond chevrons (`styles.css` + JS)

- Current chevron is a CSS border/transform trick producing a diamond shape.
- Replace: inline an octicon `chevron-down` SVG (16×16, `viewBox="0 0 16 16"`) in
  the card header toggle wherever it is built in JS. Apply classes `.icon .icon--chevron`.
- CSS:
  ```css
  .icon--chevron { transition: transform 0.2s ease; }
  .card--open .icon--chevron { transform: rotate(180deg); }
  ```
- `.icon { flex-shrink: 0; display: block; }` — ensures no clipping for all icons.
- No per-card variant class. One rule covers all card chevrons.

### 4. Depth: cards and input fields (`styles.css`)

- `.card`: `box-shadow: var(--shadow-sm)`
- `.input-field`: `box-shadow: inset 0 1px 2px rgba(0,0,0,0.06)` (recessed feel,
  no new variable needed for this specific raw value).

### Verification (Phase 10)
- Chevrons animate without looking like diamonds
- Cards have visible drop shadow
- Selected buttons visually distinct from unselected (contrast check)

---

## Phase 11 — Config Card Polish

**Goal:** Fix Show More (render all, no auto-collapse on selection), inline eye/clear as
flex siblings, username clear icon, repo/branch icons per button, fill row with "more"
at end.

### Files
- `src/js/card-configuration.js`
- `src/css/styles.css`

### 1. Show More Logic fix (UAT 1.6)

- `renderRepoButtons()`: when `reposCollapsed === false`, slice/filter must be removed —
  render all repo items.
- `renderBranchButtons()`: same, render all branches when expanded.
- **No collapse on selection**: Remove any code that sets `reposCollapsed = true` /
  `branchesCollapsed = true` after the user picks a repo or branch. Grid stays expanded
  until user clicks "Less".
- "Less" button: the **last child** in the flex row (after all items). Styled as a
  secondary grid button with `.icon--chevron` (pointing up).

### 2. Branch display limit (UAT 1.7)

- Default visible (collapsed): **3** branches. Selected branch always visible even if
  beyond limit.

### 3. Fill-row layout with "More" at end

- Repo and branch grids: `display: flex; flex-wrap: wrap; gap: var(--sp-2)`.
- "More" / "Less" is a natural last flex child at end of row — no `margin-left: auto`.
- Buttons: `width: auto`, using `min-width` from `.btn-grid-item` existing styles.

### 4. Repo/branch icon on each button

- Each repo button: prepend `repo` octicon SVG (`<svg class="icon icon--sm">`).
- Each branch button: prepend `git-branch` octicon SVG.
- Octicon paths inlined in `card-configuration.js` (same pattern as Phase 5 flow icons).

### 5. Eye / Clear as flex siblings (UAT 1.3, Overall)

Layout for credential row (flex row of siblings — **no padding hacks**):

```
[icon-left] [input flex:1] [eye-btn?] [clear-btn?]
```

HTML structure:
```html
<div class="input-row">
  <svg class="icon icon--sm"><!-- key or github --></svg>
  <input class="input-field" …>
  <button class="btn-icon js-eye-btn" hidden><!-- eye svg --></button>
  <button class="btn-icon js-clear-btn" hidden><!-- × svg --></button>
</div>
```

- `hidden` removed by JS when input has a value.
- PAT eye button: shows `eye` octicon when field is `type="password"`, `eye-closed`
  when `type="text"`. Swapped by JS toggling a class (`.eye-open` / `.eye-closed`) which
  CSS uses to `display: block / none` the two pre-rendered SVG spans.
- CSS:
  ```css
  .input-row { display: flex; align-items: center; gap: var(--sp-2); }
  .input-row .input-field { flex: 1; min-width: 0; }
  .btn-icon { background: none; border: none; color: var(--text-tertiary); width: 28px; height: 28px; display: grid; place-content: center; }
  ```

### 6. Input icons (UAT 1.3)

- Username `.input-row` left icon: GitHub mark SVG (`.icon.icon--sm`).
- PAT `.input-row` left icon: `key` octicon (not `lock`).
- Both use `.icon.icon--sm`; no new class.

### 7. Section icons improvement (UAT 1.9)

- Repos heading icon: `repo` octicon; branches heading icon: `git-branch` octicon.
- Both use `.icon.icon--sm`. The `.icon { flex-shrink: 0; }` rule (from Phase 10)
  prevents clipping.

### Verification (Phase 11)
- `renderRepoButtons` expanded: all repos in DOM (new unit test)
- `renderBranchButtons` expanded: all branches in DOM (new unit test)
- Selecting a repo does not collapse the grid
- Eye/clear visible only when PAT field has a value
- Eye icon swaps to eye-closed when PAT is revealed
- Username has a clear (×) icon that removes its value

---

## Phase 12 — Task Card Polish

**Goal:** Fix flow icon clipping with one unified icon rule, stacked-card panel
separation, input contrast, picker icons, button hierarchy, compact field labels,
inline mandatory warning icons.

### Files
- `src/js/card-tasks.js`
- `src/css/styles.css`

### 1. Flow Icon Fixes — one unified rule (UAT 2.1)

- **One CSS rule** covers icons inside all `.btn-grid-item` contexts:
  ```css
  .btn-grid-item .icon { width: 20px; height: 20px; display: block; }
  ```
- Remove any `overflow: hidden` on `.btn-grid-item` or `.flow-icon` that clips SVGs.
- Remove the dedicated `.flow-icon` class if it only duplicates this. If it serves a
  semantic purpose (e.g. coloring when selected), rename to `.icon--flow` and merge with
  `.icon`.
- Verify `viewBox="0 0 16 16"` on all 4 inlined octicons in `card-tasks.js`.

### 2. Panel Visual Separation — Two Stacked Cards (UAT 2.4)

Panel A and Panel B rendered as two distinct card blocks with a gap. Depth from borders
and shadow — not padding or whitespace.

- Panel A: `background: var(--surface-raised); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-sm);`
- Panel B: `background: var(--surface-inset); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-sm);`
- Wrapper: `display: flex; flex-direction: column; gap: var(--sp-4);`

### 3. Input Field Contrast (UAT 2.8)

- All `.input-field`: `background: var(--surface-inset); border: 1px solid var(--border);`
  (`--surface-inset = oklch(94% 0.015 85)` is noticeably warmer/darker than card body.)

### 4. Picker Icons (UAT 2.9)

- Verify `renderPickerField()` prepends `.icon.icon--sm` SVGs for PR, issue, file.
- Picker label icon sizing: `.picker-label .icon { width: 14px; height: 14px; }` (added
  as a scoped rule, not a new class — reuses `.icon` with scoped size override).

### 5. Task Button Visual Hierarchy

- Unselected: `background: var(--surface-raised); border: 1px solid var(--border);
  color: var(--text-secondary);`
- Selected: `background: var(--surface-inset); border-color: var(--accent);
  color: var(--text-primary);` + `4px` left border `var(--accent)`.
- Icon color: unselected = `--text-tertiary`, selected = `--accent`. Via
  `.btn-grid-item.selected .icon { color: var(--accent); }`.

### 6. Mandatory Field Visual Cues

- Show a small `alert` octicon (`.icon.icon--sm`, `--danger` color) inline next to the
  field label when its required group is unsatisfied.
- No error text visible at rest. On hover (desktop) / tap (mobile): a `<span
  role="tooltip">` with the message appears adjacent to the icon.
- Remove the full-width error block. Inline icon only.
- CSS: `.req-icon { color: var(--danger); }` and `.req-tooltip` with
  `position: absolute; background: var(--surface-raised); border: 1px solid var(--border);
  border-radius: var(--radius); font-size: var(--text-sm); box-shadow: var(--shadow-md);`

### 7. Compact Task Card Labels

- Field labels: `font-size: var(--text-sm)`.
- Panel subtitle rendered inline with panel header: `Situation · What's happening now`
  — `<span class="panel-subtitle">` separated by ` · `, not a new line.
- Field row gap: `gap: var(--sp-3)`.

### Verification (Phase 12)
- Flow icons not clipped at 20×20px in all 4 flow buttons
- Panels visually distinct (raised white vs warm gray) with shadow
- Input fields clearly darker/warmer than card body
- Mandatory icon visible; tooltip on hover/tap only

---

## Phase 13 — Steps Card Polish

**Goal:** Block-styled step rows with operation-color + object icons, compact output
mode icons with static labels and brief float on interaction, file step consolidation
(individual removal), lens stability, multi-select outputs.

### Files
- `src/js/card-steps.js`
- `src/js/step-generator.js`
- `src/js/prompt-builder.js`
- `src/css/styles.css`

### 1. Step Block Styling (UAT 3.1)

- `.step-row`: `background: var(--surface-raised); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-sm); padding: var(--sp-3) var(--sp-4);`
- Step number badge: `background: var(--accent); color: var(--surface-raised);
  border-radius: 50%; width: 20px; height: 20px; font-size: var(--text-sm);
  flex-shrink: 0; display: grid; place-content: center;`

### 2. Step Object Icons + Operation Color

Each step row gets a leading icon based on **object type**, colored by **operation type**.

Object → octicon:

| Object | Octicon |
|--------|---------|
| file / files | `file` |
| branch | `git-branch` |
| PR | `git-pull-request` |
| issue | `issue-opened` |
| tests | `beaker` |
| commit | `git-commit` |
| report | `file-text` |

Operation → color class (applied to `.icon`):

| Operation | Class | Color |
|-----------|-------|-------|
| read / analyze | `.icon--read` | `--text-secondary` |
| edit / modify | `.icon--edit` | `--accent` |
| create / commit | `.icon--create` | `--success` |
| validate / run | `.icon--validate` | `--accent-hover` |

CSS:
```css
.icon--read    { color: var(--text-secondary); }
.icon--edit    { color: var(--accent); }
.icon--create  { color: var(--success); }
.icon--validate { color: var(--accent-hover); }
```

### 3. Output Mode Icons — Static Labels + Brief Float (UAT 3.2)

- Replace output pill row with a flex row of icon-toggle-buttons. Each has:
  - SVG icon (`.icon.icon--sm`)
  - Static `<span class="output-label">` (5–7 chars) below the icon, always visible
    (like a tab bar): `Here`, `PR Com`, `Inline`, `Issue`, `File`
  - On toggle (click/tap): brief floating text (full mode name, ~1.5s) via CSS
    `@keyframes` animation on a `<span class="output-float">` element.
- CSS: each output button = `display: flex; flex-direction: column; align-items: center;
  gap: var(--sp-1);`
- **Multi-select**: checkbox behavior — multiple modes active simultaneously.
  State: `outputs_selected: [str]` (array) replaces `output_selected: str`.
- Update `prompt-builder.js` to include all active modes.

### 4. Optional Text Input Sizing (UAT 3.3)

- `.step-optional-text`: `display: flex; align-items: center; gap: var(--sp-2);`
  Label and input on the same flex row.
- Input: `width: 160px; font-size: var(--text-sm);` — remove `flex-grow: 1`.

### 5. PR Clear Button (UAT 3.5)

- Audit `renderPickerSelection()` in `card-tasks.js`: confirm `clearBtn` click listener
  calls `setState()` to null `pr_number` / `issue_number`.
- Add unit test if not covered.

### 6. Lens Stability (UAT 3.6)

- Confirm `renderStepLenses()` has no sort logic — active lenses stay in fixed position.
- Expanded "+more" section does **not** collapse when a lens is toggled.
- Store per-step expanded state in a module-level `Set<stepId>` that persists across
  re-renders; resets on flow switch.

### 7. File Step Consolidation

- `step-generator.js`: merge multiple "Read: @file" steps for the same flow section into
  one: `{ operation: 'read', object: 'files', params: { files: [path1, path2, …] } }`.
- `card-steps.js`: render file paths as removable pills inside the step row. Each pill
  has its own `×` button removing only that file. Removing the last file removes the step.
- `prompt-builder.js`: expand back to individual `Read: @file` lines per path in output.

### 8. Output Mode State Migration

- `output_selected: str` → `outputs_selected: [str]`. Default: `[output_modes[0]]`.
- Update `state.js` `migrateState()` to convert existing single string to array.

### Verification (Phase 13)
- Step rows visually distinct blocks with icon + number badge
- File step: multiple files merged into one step; each file removable individually
- Output modes: multiple can be active; static label always visible; float label on toggle
- Lens order stable on toggle; expanded section stays open
- Optional text input on one row, constrained width

---

## Phase 14 — Prompt Card Polish

**Goal:** Compact button row in card header, modern copy icon swap, XML syntax
highlighting in prompt area, quality meter tooltip.

### Files
- `src/js/card-prompt.js`
- `src/css/styles.css`

### 1. Button Repositioning & Hierarchy (UAT 4.1)

- Card header: `display: flex; align-items: center; justify-content: space-between;`
- Button group (right side of header): Copy (secondary) + "Prompt Claude" (primary).
- "Prompt Claude": `background: var(--accent); color: var(--surface-raised);` — primary.
- "Copy": `background: transparent; border: 1px solid var(--border); color: var(--text-primary);` — ghost.
- Remove any standalone "Prompt" heading in card body if header already labels it.
- Quality meter stays at top of card body, immediately below the header.

### 2. Copy Button Modern Feedback (UAT 4.2)

- Add `clipboard` octicon SVG and `check` octicon SVG — both pre-rendered in the button
  DOM; one hidden at a time via CSS:
  ```css
  .btn-copy .icon-check    { display: none; }
  .btn-copy.btn--copied .icon-clipboard { display: none; }
  .btn-copy.btn--copied .icon-check    { display: block; }
  ```
- JS: adds `.btn--copied` on click; removes it after 2 seconds. No "Copied!" text span.
  No JS DOM manipulation for the icon — only the class toggle.

### 3. Prompt Area Polish

- `.prompt-output`: `background: var(--surface-inset); border: 1px solid var(--border);
  min-height: 140px;`

### 4. XML Syntax Highlighting

- In `card-prompt.js`: process prompt text through `highlightXml(text)` before setting
  `<pre>` content as `innerHTML`.
- `highlightXml(text)`:
  1. Escape text nodes: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;` in non-tag segments.
  2. Regex-replace XML tag sequences with `<span class="xml-tag">…</span>`.
- CSS: `.xml-tag { color: var(--accent); font-weight: 600; }`
- Security: text-node content is fully HTML-escaped before injection.

### 5. Quality Meter Tooltip

- Append an `info` octicon button (`.btn-icon`) next to the quality meter label.
- On hover/focus (desktop) or tap (mobile — second tap hides): a `<div role="tooltip">`
  shows scoring criteria.
- CSS: `position: absolute; background: var(--surface-raised); border: 1px solid
  var(--border); border-radius: var(--radius); font-size: var(--text-sm);
  box-shadow: var(--shadow-md);`

### Verification (Phase 14)
- Buttons in header right — no extra vertical row
- Copy: clipboard → check icon on click, reverts after 2s, no external text
- Prompt area background warm/inset
- XML tags highlighted in accent color
- Quality meter tooltip appears on hover/tap

---

## Final Regression (after Phase 14)

Full manual walkthrough on 375px mobile viewport:
1. `npm run lint` passes
2. `npm run build` passes
3. `npm test` passes (all existing + new tests green)
4. Chevrons animate (not diamond-shaped)
5. Show More expands all repos/branches; selection does not auto-collapse list
6. Flow icons not clipped, colored correctly when selected
7. Panel A/B look like two distinct stacked cards
8. Step rows visually distinct blocks with icons
9. Output mode icons have static short labels; float label on toggle
10. Copy shows check icon swap; no external text
11. Prompt XML tags highlighted; XSS-safe

---

## New Tests to Add

| Phase | Test |
|-------|------|
| 11 | `renderRepoButtons` expanded → all repos in DOM |
| 11 | `renderBranchButtons` expanded → all branches in DOM |
| 11 | Selecting a repo does not set `reposCollapsed = true` |
| 13 | Multiple read steps → merged into one step with `params.files` array |
| 13 | Single file removable from merged step |
| 13 | Two output modes can be active simultaneously in `outputs_selected` |
| 14 | `highlightXml`: XSS-safe — `<script>` in text node becomes `&lt;script&gt;` |
| 14 | `highlightXml`: XML tag wrapped in `.xml-tag` span |

---



                                                                                                                                                          
