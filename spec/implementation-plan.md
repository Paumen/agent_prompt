# Implementation Plan

> **Status**: Draft v3 — updated for 4-flow dual-panel framework.
> **Date**: 2026-02-25

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

| #   | Precondition                                                                                              | Needed by               | Status                                                    |
| --- | --------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------- |
| P1  | **PO approval**: placeholder flows in `flows.yaml` for development (file is protected per CLAUDE.md)      | Phase 2                 | not approved, we will use all 4 flows directly, see below |
| P2  | **PO to review flows** in `flows.yaml` with full field + step definitions for all 4 flows                 | Phase 5 (full), Phase 6 | Approved by human, please validate file by reviewing      |
| P3  | **OUT-07 decided**: button opens `claude.ai` only (no prompt transfer). Label must clearly indicate this. | Phase 7                 | **Resolved**                                              |
| P4  | **PR template** exists at `.github/pull_request_template.md`                                              | All PRs                 | Done (already exists)                                     |
| P5  | **CI pipeline** exists (lint, test, build)                                                                | All PRs                 | Done (ci.yml exists)                                      |
| P6  | **Node 20+** available in dev environment                                                                 | Phase 0                 | Done (.nvmrc exists)                                      |

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

## 11. Phase 7 — Card 4: Prompt Output `To start`

**Goal**: Prompt preview, copy to clipboard, user notes, Open in Claude button.

**Req IDs**: OUT-01..08

### Checklist

- [ ] Create `src/js/card-prompt.js`:
  - Prompt preview: `--surface-inset` background, `--font-mono` at `--text-sm`, left-aligned (VIS treatment, OUT-01)
  - Preview updates live as `prompt_input` changes (driven by state subscription)
  - "Copy" button: `navigator.clipboard.writeText()` — primary output action (OUT-05). On success: brief "Copied!" indicator. On failure: inline error.
    - **Note**: requires secure context (HTTPS or localhost). GitHub Pages serves HTTPS. No fallback for HTTP — modern browsers only.
  - Free-text notes field below prompt preview (OUT-06): textarea, stored in `notes.user_text`, wrapped in `<notes>` tags in output
  - "Open in Claude" button (OUT-07): opens `https://claude.ai` in a new tab. **Does not transfer the prompt** — user copies prompt first via the Copy button, then pastes in Claude. Button label must clearly communicate this (e.g., "Open Claude" not "Send to Claude").
  - Card never auto-collapses once visible (OUT-08). Once expanded after flow selection, stays expanded, except if user manually collapses it.
  - Prompt is fully regenerated from current `prompt_input` on every change (OUT-03, DM-INV-01)
- [ ] **Large prompt consideration**: if prompt exceeds ~10,000 characters, show character count as informational. No hard limit enforced in v1.
- [ ] **Mobile (GL-03)**: prompt area scrolls, copy button is fixed/accessible, notes field is full-width
- [ ] **Accessibility**: prompt preview area has `role="region"` and `aria-label="Generated prompt"`, copy button has status feedback via `aria-live`
- [ ] **Test**: `tests/card-prompt.test.js` — prompt renders from state, copy button works (mock clipboard API), notes update state, card stays visible

### Output

- `src/js/card-prompt.js`
- `tests/card-prompt.test.js`

---

## 12. Phase 8 — Polish & Global Constraints `To start`

**Goal**: Verify all global constraints, mobile audit, performance check, remaining polish.

**Req IDs**: GL-01 (audit), GL-03 (audit), GL-05 (deferred refresh), APP-01, APP-02

### Phase 8a — Mobile & Responsiveness Audit

- [ ] Test every card on 320px, 375px, 768px, 1024px viewport widths
- [ ] Verify no horizontal scrolling on any viewport (GL-03)
- [ ] Verify touch targets ≥44px on all interactive elements (VIS-02)
- [ ] Verify button grids (repo, branch, flow) wrap correctly on small screens

### Phase 8b — Global Constraint Verification

- [ ] **GL-01 click audit**: walk through entire user journey, count clicks for every action. Target ≤2 (except deep tree navigation). Document any violations and fix.
- [ ] **GL-02 verify**: all async loads show shimmer skeleton with contextual label. Empty states show message, not blank area.
- [ ] **GL-04 verify**: all error states are inline, dismissible. No blocking modals anywhere.
- [ ] **GL-05 verify**: background refresh works, shows "Updated" indicator, defers if mid-interaction (e.g., user is actively toggling file tree checkboxes or editing step lenses).
  - **Mid-interaction deferral** (PO-approved definition): user has active focus on an input field, OR has toggled a checkbox/lens within the last 2 seconds. Track via `isInteracting` flag. Background refresh waits until flag clears before re-rendering.
- [ ] **APP-01 verify**: fully client-side, no server calls except GitHub API
- [ ] **APP-02 verify**: vanilla JS, ES modules, plain CSS — no frameworks or preprocessors

### Phase 8c — Final Polish

- [ ] Card auto-expand/collapse behavior per UJ table: Configuration expanded on load, collapses on repo select, Tasks expands on repo select, Steps + Prompt expand on flow select
- [ ] Re-opened Configuration auto-collapses on next trigger (per Layout spec)
- [ ] Run `npm run format` + `npm run lint:fix`
- [ ] Run `npm run build` — verify clean build with no warnings

### Output

- Updated CSS and JS files as needed
- All existing tests still pass

---

## 13. Phase 9 — End-to-End Tests `To start`

**Goal**: Full user journey test, prompt determinism verification.

**Req IDs**: TST-01, TST-02

### Checklist

- [ ] Create `tests/e2e.test.js`:
  - **TST-02**: repo select → flow select → step adjust → copied prompt matches expected output for fixed inputs
  - **TST-01**: prompt determinism — identical `prompt_input` always produces identical prompt text (snapshot test, run multiple times)
  - Test card expand/collapse transitions through the full journey
  - Test flow switch fully resets steps (DM-DEF-03)
  - Test PAT clear + re-entry flow
- [ ] Run full test suite: `npm test`
- [ ] Run `npm run build` — final build verification
- [ ] Update status table in `spec/spec_concept.md` for all completed requirements

### Output

- `tests/e2e.test.js`
- Updated `spec/spec_concept.md` status table

---

## 14. Requirement Coverage Matrix

Every spec requirement mapped to its primary implementation phase and verification phase.

| Req ID    | Primary Phase            | Verified In    | Notes                                      |
| --------- | ------------------------ | -------------- | ------------------------------------------ |
| GL-01     | 4, 5, 6, 7 (each card)   | 8b             | Click audit per card + final audit         |
| GL-02     | 0 (class), 3 (component) | 8b             | Shimmer class in CSS, component in JS      |
| GL-03     | 0 (foundation)           | 4, 5, 6, 7, 8a | Mobile tested per card + final audit       |
| GL-04     | 3 (component)            | 4, 5, 6, 7, 8b | Error component used in each card          |
| GL-05     | 3 (cache)                | 8b             | Background refresh + deferred re-render    |
| APP-01    | 0                        | 8b             | SPA, client-side only                      |
| APP-02    | 0                        | 8b             | Vanilla JS, ES modules, plain CSS          |
| APP-03    | 3                        | 3              | Limit enforcement in API module            |
| APP-04    | 1                        | 1              | Session vs persistent state                |
| DM-INV-01 | 1                        | 1, 9           | Derived from current state only            |
| DM-INV-02 | 1                        | 1, 9           | setState() triggers prompt rebuild         |
| DM-INV-03 | 1                        | 1, 9           | Deterministic output, snapshot tests       |
| DM-DEF-01 | 1                        | 1              | Two-layer merge in setState                |
| DM-DEF-02 | 2                        | 2              | YAML → JSON + schema validation            |
| DM-DEF-03 | 5                        | 5, 9           | Flow selection resets steps                |
| CFG-01    | 4                        | 4              | PAT field + clear                          |
| CFG-02    | 4                        | 4              | Username + auto-fetch                      |
| CFG-03    | 4                        | 4              | Repo button grid                           |
| CFG-04    | 4                        | 4              | Branch buttons + auto-select               |
| CFG-05    | 4                        | 4              | Background fetch on repo select            |
| SCT-01    | 5                        | 5              | Panel A files flagged for "read upfront"   |
| SCT-02    | 5                        | 5              | 4 predefined flows (dual-panel)            |
| SCT-03    | 5                        | 5              | Flow button grid                           |
| SCT-04    | 5                        | 5              | Dual-panel Situation/Target layout         |
| SCT-05    | 5                        | 5              | Required group validation                  |
| SCT-06    | 5                        | 5              | Searchable dropdowns + spec/guide tooltips |
| SCT-07    | 2                        | 2              | flows.yaml definitions                     |
| SCT-08    | 5                        | 5              | Quality Meter scoring + color bar          |
| SCT-09    | 5                        | 5              | Improve multi-file scope selector          |
| STP-01    | 6                        | 6              | Auto-generated steps + delete              |
| STP-02    | 6                        | 6              | Conditional steps from panel fields        |
| STP-03    | 6                        | 6              | Lens pills per step                        |
| STP-04    | 6                        | 6              | Step removal (non-locked only)             |
| OUT-01    | 7                        | 7              | XML-tagged prompt                          |
| OUT-02    | 1, 7                     | 7, 9           | Prompt format (builder in 1, display in 7) |
| OUT-03    | 1                        | 1, 7           | Full regeneration                          |
| OUT-04    | 1                        | 1              | @ file references                          |
| OUT-05    | 7                        | 7              | Copy to clipboard                          |
| OUT-06    | 7                        | 7              | Notes textarea                             |
| OUT-07    | 7                        | 7              | Opens claude.ai only (no prompt transfer)  |
| OUT-08    | 7                        | 7, 8           | Card never auto-collapses                  |
| VIS-01    | 0                        | 4, 5           | Icon + title single row                    |
| VIS-02    | 0                        | 8a             | Thumb/scroll reach                         |
| VIS-03    | 0                        | 8a             | Minimum 2 open + 2 collapsed cards visible |
| TST-01    | 9                        | 9              | Prompt determinism                         |
| TST-02    | 9                        | 9              | End-to-end journey                         |
| TST-03    | 2                        | 2              | Schema validation failure                  |

---

## 15. Risk Register

| #   | Risk                                                                                             | Impact                         | Likelihood | Mitigation                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| R1  | `flows.yaml` not authored by PO in time                                                          | Blocks Phase 5 (full), Phase 6 | Medium     | Use detailed mock flows (defined above in Preconditions). Design UI to handle any number of steps/lenses/params.         |
| R2  | Searchable dropdown in vanilla JS is complex (keyboard nav, mobile touch, scroll, search filter) | Delays Phase 5                 | Medium     | Start with a simpler select-based dropdown. Enhance to searchable only if file/PR lists are long enough to warrant it.   |
| R3  | ~~**OUT-07**: deep link feasibility~~                                                            | ~~Degrades Phase 7 feature~~   | —          | **Resolved**: PO decided button opens `claude.ai` only (no prompt transfer). Label must clearly indicate this.           |
| R4  | localStorage corruption from version changes                                                     | Breaks state hydration         | Low        | Validate shape on hydration. If invalid, clear and start fresh. Log to console.                                          |
| R5  | Large file trees (close to 300-file limit) cause slow rendering                                  | Degrades UX on large repos     | Low        | Use document fragment for batch DOM insertion. Consider virtual scrolling only if performance is measurably poor.        |
| R6  | Prompt rebuild causes UI jank on complex prompts                                                 | Degrades UX                    | Low        | Profile first. If measurable jank (>16ms rebuild), batch via `requestAnimationFrame`. Unlikely for text-only generation. |

---

## 16. Resolved Questions (PO Decisions — 2026-02-24)

1. **File/folder selection moved after task selection**: File selection is now optional and flow-dependent (not a separate Scope section). Clearer UX, simpler tree logic, more background loading time, less vertical space.

2. **OUT-07 Deep link**: Verified feasible. Button opens `claude.ai` (no prompt transfer). Label must clearly indicate it only opens the site.

3. **VIS-03 added**: Minimum 2 open + 2 collapsed cards visible in viewport. Tightening UI requirements to ensure minimal vertical scrolling.

4. **GL-05 mid-interaction**: Agreed — mid-interaction defined as: user has active focus on an input field, OR has toggled a checkbox/lens within the last 2 seconds.

---

## 17. Technical Decisions

| Decision                                             | Rationale                                                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`setState()` over Proxy** for DM-INV-02            | Simpler, more debuggable, handles nested objects/arrays without deep wrapping. Spec explicitly allows either approach. Aligns with Anti-Over-Engineering Rule.                        |
| **Schema file in `config/`** not `src/js/`           | Build-time artifact. Should not be bundled into production code.                                                                                                                      |
| **Shared `components.js`** for UI primitives         | Shimmer, errors, notifications, and searchable dropdowns are needed across multiple cards. Shared module prevents duplication.                                                        |
| **Vite plugin** (not pre-build script) for YAML      | Cleaner integration with Vite's dev server (HMR support for flows.yaml changes). The `transform` hook is straightforward for this use case.                                           |
| **No Proxy, no reactive framework**                  | The app has ~6 state fields that change independently. Explicit `setState()` calls at ~15-20 interaction points is manageable and clear. A reactive system would be over-engineering. |
| **Modern browsers only** (Clipboard API, ES modules) | Spec targets developers using current tools. No IE11/legacy support needed. GitHub Pages serves HTTPS.                                                                                |
