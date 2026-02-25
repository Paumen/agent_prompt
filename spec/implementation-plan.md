# Implementation Plan

**Status**: Draft v3 — updated for 4-flow dual-panel framework.
**Date**: 2026-02-25

---

## LLM Complexity Rating Legend

Each phase and checklist item is rated on a 5-point complexity scale indicating the recommended LLM capability level for implementation.

### Complexity Scale

| Level | Complexity | Description | Recommended Models |
|-------|------------|-------------|-------------------|
| **5** | Very High | Novel architecture, multi-system integration, complex algorithms, significant judgment calls | **Claude Opus 4**, GPT-4o, Gemini Ultra 2, Claude 3.5 Opus |
| **4** | High | Complex state management, custom tooling, intricate business logic, cross-cutting concerns | **Claude Sonnet 4**, GPT-4 Turbo, Gemini Pro 2, DeepSeek V3 |
| **3** | Medium | Standard patterns with moderate complexity, some design decisions, well-documented APIs | **Claude Sonnet 4**, GPT-4o-mini, Gemini Flash, Llama 3.1 70B |
| **2** | Low-Medium | Straightforward implementations, clear specifications, minimal ambiguity | **Claude Haiku 3.5**, GPT-4o-mini, Gemini Flash 2, Llama 3.1 8B |
| **1** | Low | Repetitive tasks, boilerplate, simple transformations, well-defined tests | **Claude Haiku 3.5**, Gemini Flash Lite, Llama 3.1 8B, Mistral 7B |

### Reference Models by Capability

| Tier | Models | Best For |
|------|--------|----------|
| **Tier 1 (Opus-class)** | Claude Opus 4, GPT-4o, Gemini Ultra 2, Claude 3.5 Opus | Architecture, complex integrations, novel problems |
| **Tier 2 (Sonnet-class)** | Claude Sonnet 4, GPT-4 Turbo, DeepSeek V3, Gemini Pro 2 | Production code, complex features, refactoring |
| **Tier 3 (Balanced)** | Claude Sonnet 4, GPT-4o-mini, Gemini Flash, Llama 3.1 70B | Standard features, well-defined components |
| **Tier 4 (Haiku-class)** | Claude Haiku 3.5, Gemini Flash 2, GPT-4o-mini | Boilerplate, tests, simple UI, documentation |
| **Tier 5 (Lightweight)** | Llama 3.1 8B, Mistral 7B, Gemini Flash Lite | Simple transformations, lint fixes, formatting |

### Rating Criteria

| Factor | Low (1-2) | Medium (3) | High (4-5) |
|--------|-----------|------------|------------|
| **Ambiguity** | Clear spec, minimal decisions | Some interpretation needed | Significant judgment required |
| **Dependencies** | Isolated component | 2-3 dependencies | Many interdependent systems |
| **Domain Knowledge** | Standard patterns | Moderate learning curve | Deep expertise needed |
| **Error Handling** | Simple success/fail | Multiple edge cases | Complex failure modes |
| **Testing** | Straightforward unit tests | Integration + unit tests | E2E + mocking + edge cases |
>>>>>>> main

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
9. [Phase 5 — Card 2: Task (Dual-Panel)](#9-phase-5--card-2-task-dual-panel)
10. [Phase 6 — Card 3: Steps](#10-phase-6--card-3-steps)
11. [Phase 7 — Card 4: Prompt Output](#11-phase-7--card-4-prompt-output)
12. [Phase 8 — Polish & Global Constraints](#12-phase-8--polish--global-constraints)
13. [Phase 9 — End-to-End Tests](#13-phase-9--end-to-end-tests)
14. [Requirement Coverage Matrix](#14-requirement-coverage-matrix)
15. [Risk Register](#15-risk-register)
16. [Resolved Questions](#16-resolved-questions)
17. [Technical Decisions](#17-technical-decisions)

---

## 1. Architecture Overview

**Phase Complexity Rating: N/A** (documentation only)

```
index.html
  └── main.js (entry point)
        ├── state.js          ← centralized state via setState()
        ├── prompt-builder.js ← deterministic prompt generation
        ├── step-generator.js ← auto-generate steps from flow + panel fields
        ├── quality-meter.js  ← field weight scoring + color bar
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

**Phase Complexity Rating: N/A** (documentation only)

### Source files

| File                           | Purpose                                                                                  | Created in | Req IDs                          |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ---------- | -------------------------------- |
| `src/css/variables.css`        | CSS custom properties (colors, type, spacing)                                            | Phase 0    | VIS-\*                           |
| `src/css/styles.css`           | All component styles, mobile-first                                                       | Phase 0    | GL-03, VIS-01, VIS-02            |
| `src/index.html`               | Shell: 4 card containers, script/css imports                                             | Phase 0    | APP-01                           |
| `src/js/main.js`               | Entry point: init state, render cards, wire events                                       | Phase 1    | APP-01, APP-02                   |
| `src/js/state.js`              | `setState()`, `getState()`, `subscribe()`, session reset, migration                     | Phase 1    | DM-INV-01..03, DM-DEF-01, APP-04 |
| `src/js/prompt-builder.js`     | Pure function: `prompt_input` → prompt string (flow-specific templates)                  | Phase 1    | OUT-01..04, DM-INV-03            |
| `src/js/step-generator.js`     | Auto-generate steps from flow definition + filled panel fields                           | Phase 6    | STP-01, STP-02                   |
| `src/js/quality-meter.js`      | Quality Meter: field weight scoring + color bar rendering                                | Phase 5    | SCT-08                           |
| `src/js/components.js`         | Shared UI: shimmer skeleton, inline error, dismissible notification, searchable dropdown | Phase 0/3  | GL-02, GL-04, SCT-06             |
| `src/js/github-api.js`         | GitHub REST: repos, branches, tree, PRs, issues                                          | Phase 3    | CFG-02..05, APP-03               |
| `src/js/cache.js`              | localStorage read/write, TTL, PAT-change invalidation                                    | Phase 3    | GL-05, APP-04                    |
| `src/js/flow-loader.js`        | Import pre-validated flow JSON, expose `getFlows()`, `getFlowById()`                     | Phase 2    | DM-DEF-02, SCT-07                |
| `src/js/card-configuration.js` | Card 1 UI: PAT, username, repo grid, branch grid                                         | Phase 4    | CFG-01..05                       |
| `src/js/card-tasks.js`         | Card 2 UI: flow selector + dual-panel (Situation/Target) + quality meter                 | Phase 5    | SCT-01..09                       |
| `src/js/file-tree.js`          | Recursive file tree for file selection (flow-dependent)                                  | Phase 5    | SCT-01, SCT-06                   |
<<<<<<< claude/alternative-prompt-frameworks-uEn1j
| `src/js/quality-meter.js`      | Quality Meter: field weight scoring + color bar rendering                                | Phase 5    | SCT-08                           |
| `src/js/step-generator.js`     | Auto-generate steps from flow definition + filled panel fields                           | Phase 6    | STP-01, STP-02                   |
=======
>>>>>>> main
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

| #   | Precondition                                                                                              | Needed by               | Status                                  |
| --- | --------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------- |
| P1  | **PO approval**: placeholder flows in `flows.yaml` for development (file is protected per CLAUDE.md)      | Phase 2                 | **Ask PO when Phase 2 starts**          |
| P2  | **PO to review flows** in `flows.yaml` with full field + step definitions for all 4 flows                 | Phase 5 (full), Phase 6 | **Draft in hybrid-framework-design.md** |
| P3  | **OUT-07 decided**: button opens `claude.ai` only (no prompt transfer). Label must clearly indicate this. | Phase 7                 | **Resolved**                            |
| P4  | **PR template** exists at `.github/pull_request_template.md`                                              | All PRs                 | Done (already exists)                   |
| P5  | **CI pipeline** exists (lint, test, build)                                                                | All PRs                 | Done (ci.yml exists)                    |
| P6  | **Node 20+** available in dev environment                                                                 | Phase 0                 | Done (.nvmrc exists)                    |
<<<<<<< claude/alternative-prompt-frameworks-uEn1j

### Mock Flow Structure (for P1)

While waiting for PO-approved flows, development uses a placeholder structure based on the hybrid framework design. This exercises all field types and step variations:

```yaml
# Placeholder — 2 of 4 flows for development testing
flows:
  fix:
    label: 'Fix / Debug'
    icon: 'bug'
    panel_a:
      label: 'Situation'
      subtitle: "What's happening now"
      fields:
        description:
          type: text
          placeholder: 'Describe the issue...'
          required_group: a_required
        issue_number:
          type: issue_picker
          required_group: a_required
        files:
          type: file_picker_multi
    panel_b:
      label: 'Target'
      subtitle: 'How it should work after the fix'
      fields:
        description:
          type: text
        spec_files:
          type: file_picker_multi
        guideline_files:
          type: file_picker_multi
    steps:
      - id: read-claude
        operation: read
        object: file
        params: { file: 'claude.md' }
        locked: true
      - id: read-location
        operation: read
        object: files
        source: panel_a.files
      - id: read-issue
        operation: read
        object: issue
        source: panel_a.issue_number
      - id: identify-cause
        operation: analyze
        object: issue
        lenses: [error_handling, semantics]
      - id: create-branch
        operation: create
        object: branch
      - id: implement-fix
        operation: edit
        object: files
        lenses: [error_handling, semantics]
      - id: run-tests
        operation: validate
        object: tests
      - id: commit-pr
        operation: commit
        object: changes
        params: { open_pr: true }

  review:
    label: 'Review / Analyze'
    icon: 'search'
    panel_a:
      label: 'Situation'
      subtitle: 'The PR or code to examine'
      fields:
        description:
          type: text
        pr_number:
          type: pr_picker
          required_group: a_required
        files:
          type: file_picker_multi
          required_group: a_required
    panel_b:
      label: 'Target'
      subtitle: 'Standards and criteria'
      fields:
        lenses:
          type: lens_picker
          default: [semantics, structure]
        spec_files:
          type: file_picker_multi
        guideline_files:
          type: file_picker_multi
    steps:
      - id: read-claude
        operation: read
        object: file
        params: { file: 'claude.md' }
        locked: true
      - id: review-pr
        operation: analyze
        object: pull_request
        source: panel_a.pr_number
        lenses: []
      - id: review-files
        operation: analyze
        object: files
        source: panel_a.files
        lenses: []
      - id: provide-feedback
        operation: create
        object: review_feedback
```

This structure covers: required groups (at least one of), conditional steps (via `source`), locked steps, lens pills with defaults, multiple field types (text, file_picker_multi, issue_picker, pr_picker, lens_picker), and dual-panel layout. Full 4-flow YAML in `spec/hybrid-framework-design.md`.
=======
>>>>>>> main

---

## 4. Phase 0 — CSS Foundation `Testing`

### Phase Complexity: **⭐⭐ Level 2** (Low-Medium)

**Rationale**: CSS design tokens and base styles are straightforward with clear VIS spec. Some judgment needed for responsive breakpoints and accessibility patterns.

**Recommended Model**: Claude Haiku 3.5 or Claude Sonnet 4

**Goal**: Design tokens, base layout, card shell, mobile-first responsive grid.

**Req IDs**: VIS-\*, GL-03 (foundation), GL-02 (shimmer class)

### Checklist

| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 0.1 | Populate `src/css/variables.css` with all tokens from spec VIS section (colors, typography, spacing) | **1** | Direct translation from spec table to CSS custom properties |
| 0.2 | Write base styles in `src/css/styles.css`: page background, body typography, card component states | **2** | Standard CSS patterns, minor judgment on specificity |
| 0.3 | Active/selected item styling: 3px left-edge accent bar + subtle background | **1** | Clear spec, straightforward CSS |
| 0.4 | Button grid: wrapping grid, hover states | **1** | Standard CSS Grid pattern |
| 0.5 | Pill toggles: on/off states | **1** | Simple state styling |
| 0.6 | Input fields: password, text, with focus states | **1** | Standard form styling |
| 0.7 | Shimmer-bar skeleton: reusable `.shimmer` class with opacity pulse animation | **2** | CSS animation, but well-defined pattern |
| 0.8 | Empty-state message: contextual inline message | **1** | Simple text styling |
| 0.9 | Inline error: danger colored, dismissible | **2** | Minor interaction pattern |
| 0.10 | Update `src/index.html` with 4 card container elements, semantic HTML, accessibility attributes | **1** | Straightforward HTML structure |
| 0.11 | Mobile-first: base styles + `@media (min-width: 768px)` for larger | **2** | Standard responsive pattern |
| 0.12 | Accessibility: card expand/collapse via keyboard, focus-visible outlines | **2** | Standard a11y patterns, some testing needed |

### Output

- `src/css/variables.css` — complete
- `src/css/styles.css` — base layout complete
- `src/index.html` — card shell complete

---

## 5. Phase 1 — State Management `To start`

### Phase Complexity: **⭐⭐⭐⭐ Level 4** (High)

**Rationale**: Core state management with complex merge strategy, localStorage persistence, migration logic, and prompt builder with flow-specific templates. Foundation for entire app.

**Recommended Model**: Claude Sonnet 4 or Claude Opus 4

**Goal**: Centralized state with `setState()`, automatic prompt rebuild, session/persistent separation, migration.

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
export function migrateState(state)            // handles version migrations
```

**Session vs. persistent state** (per APP-04):

- **Persistent** (survives page reload): `configuration.pat`, `configuration.owner` → saved to `localStorage`
- **Session** (cleared on page reload): `configuration.repo`, `configuration.branch`, `panel_a.*`, `panel_b.*`, `task.*`, `steps.*`, `improve_scope`, `notes.*` → initialized to defaults on every page load

### Prompt Builder

Pure function `buildPrompt(promptInput) → string`. Called inside `setState()` after every mutation. Now supports **4 flow-specific templates** (fix/review/implement/improve). Result stored on state as a derived field.

### Checklist

<<<<<<< claude/alternative-prompt-frameworks-uEn1j
- [ ] Create `src/js/state.js` with `setState()`, `getState()`, `subscribe()`, `resetSession()`
- [ ] Implement two-layer merge strategy (DM-DEF-01): flow defaults → user overrides, applied on flow selection
- [ ] On `setState()`: update state → call `buildPrompt()` → notify subscribers.
- [ ] Hydrate PAT + username from `localStorage` on init; validate stored data shape before hydrating (guard against corruption)
- [ ] `resetSession()`: clear all fields except PAT/username, reset derived prompt
- [ ] Create `src/js/prompt-builder.js` with `buildPrompt(promptInput)` pure function
- [ ] Prompt format per OUT-02: XML tags, repo context header, flow-specific `<task>` section with Panel A/B content, ordered `<todo>` steps, notes section. Prompt template varies per flow (fix/review/implement/improve).
- [ ] File references use `@` prefix per OUT-04: `@src/utils/auth.js`
- [ ] Step 1 always present (read claude.md); remaining steps are dynamic from `enabled_steps`
- [ ] **Test**: `tests/state.test.js` — setState triggers rebuild, subscribe fires, session reset preserves PAT, corrupted localStorage handled gracefully
- [ ] **Test**: `tests/prompt-builder.test.js` — deterministic output (snapshot test, TST-01), empty state, full state, various step combinations
=======
| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 1.1 | Create `src/js/state.js` with `setState()`, `getState()`, `subscribe()`, `resetSession()` | **3** | Standard pattern but needs careful implementation |
| 1.2 | Implement two-layer merge strategy (DM-DEF-01): flow defaults → user overrides | **4** | Complex deep merge with edge cases |
| 1.3 | On `setState()`: update state → call `buildPrompt()` → notify subscribers | **2** | Straightforward flow once architecture is clear |
| 1.4 | Hydrate PAT + username from `localStorage` on init; validate stored data shape | **3** | Need validation logic and error handling |
| 1.5 | `resetSession()`: clear all fields except PAT/username, reset derived prompt | **2** | Clear spec, straightforward |
| 1.6 | Implement `migrateState()` for v0 → v1.0 transition (context.selected_files → panel_a.files) | **3** | One-time migration with data transformation |
| 1.7 | Create `src/js/prompt-builder.js` with `buildPrompt(promptInput)` pure function | **3** | Core logic, needs template structure |
| 1.8 | Implement 4 flow-specific prompt templates (fix/review/implement/improve) | **4** | Multiple templates, handlebars-style interpolation, conditional sections |
| 1.9 | Prompt format per OUT-02: XML tags, repo context header, flow-specific `<task>` section, `<todo>` steps | **3** | Template design with XML structure |
| 1.10 | File references use `@` prefix per OUT-04 | **1** | Simple string formatting |
| 1.11 | **Test**: `tests/state.test.js` — setState triggers rebuild, subscribe fires, session reset, migration | **2** | Well-defined test cases |
| 1.12 | **Test**: `tests/prompt-builder.test.js` — deterministic output (snapshot test), all 4 flows | **2** | Snapshot tests are straightforward |
>>>>>>> main

### Output

- `src/js/state.js`
- `src/js/prompt-builder.js`
- `tests/state.test.js`
- `tests/prompt-builder.test.js`

---

## 6. Phase 2 — Build Pipeline & Flow Loading `To start`

### Phase Complexity: **⭐⭐⭐⭐ Level 4** (High)

**Rationale**: Custom Vite plugin with YAML parsing and JSON Schema validation. Build-time tooling with error handling and clear developer feedback.

**Recommended Model**: Claude Sonnet 4 or Claude Opus 4

**Goal**: YAML → JSON build step with schema validation; flow loader module.

**Req IDs**: DM-DEF-02, DM-DEF-03, SCT-07, TST-03

**Blocker**: P1 — needs PO approval for placeholder flows in `flows.yaml`.

### Technical Design: Vite Plugin

A custom Vite plugin (`config/vite-plugin-yaml.js`) that:

1. Intercepts imports of `.yaml` files
2. Parses YAML to JS object via `js-yaml` (dev dependency)
3. Validates against schema defined in `config/flow-schema.js`
4. On validation failure: throws build error with clear message (DM-DEF-02, TST-03)
5. Emits validated JSON for runtime import

The schema file lives in `config/` (not `src/js/`) because it's a build-time artifact that should not be bundled into production code.

### Checklist

<<<<<<< claude/alternative-prompt-frameworks-uEn1j
- [ ] Install `js-yaml` as dev dependency
- [ ] Create `config/flow-schema.js` — JSON Schema defining valid flow structure (label, icon, panel_a/panel_b with field definitions, steps array with operation/object/lenses/params/source/locked)
- [ ] Create `config/vite-plugin-yaml.js` — Vite plugin: `transform` hook for `.yaml` files, parse + validate + emit JSON
- [ ] Create `src/js/flow-loader.js` — `import flows from '../config/flows.yaml'`; exports `getFlows()`, `getFlowById(id)`
- [ ] Build fails with clear error message on malformed YAML or schema violation
- [ ] **Test**: `tests/flow-loader.test.js` — valid flows load, invalid flows cause error, getFlowById returns correct flow
- [ ] **Test**: TST-03 — malformed flow file causes build failure with clear error
=======
| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 2.1 | Install `js-yaml` as dev dependency | **1** | Single npm command |
| 2.2 | Create `config/flow-schema.js` — JSON Schema for panel_a/panel_b/fields/steps structure | **4** | Complex schema with nested conditionals, required groups |
| 2.3 | Create `config/vite-plugin-yaml.js` — Vite plugin with transform hook | **4** | Custom Vite plugin, error handling, HMR integration |
| 2.4 | Create `src/js/flow-loader.js` — import flows, export `getFlows()`, `getFlowById(id)` | **2** | Simple wrapper around imported JSON |
| 2.5 | Build fails with clear error message on malformed YAML or schema violation | **3** | Error formatting for developer experience |
| 2.6 | **Test**: `tests/flow-loader.test.js` — valid flows load, invalid cause error, getFlowById | **2** | Straightforward unit tests |
| 2.7 | **Test**: TST-03 — malformed flow file causes build failure with clear error | **2** | Integration test for build failure |
>>>>>>> main

### Output

- `config/flow-schema.js`
- `config/vite-plugin-yaml.js`
- `src/js/flow-loader.js`
- `tests/flow-loader.test.js`

---

## 7. Phase 3 — GitHub API & Caching `To start`

### Phase Complexity: **⭐⭐⭐ Level 3** (Medium)

**Rationale**: Standard REST API integration with caching layer. Background refresh adds moderate complexity. Well-documented GitHub API.

**Recommended Model**: Claude Sonnet 4

**Goal**: GitHub REST API module with caching layer, background refresh, limit enforcement.

**Req IDs**: CFG-02, CFG-05, APP-03, GL-05, GL-04

### Checklist

| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 3.1 | Create `src/js/github-api.js` with `fetchRepos()`, `fetchBranches()`, `fetchTree()`, `fetchPRs()`, `fetchIssues()` | **2** | Standard REST calls, well-documented API |
| 3.2 | All functions return `{ data, error }` — never throw | **2** | Consistent error handling pattern |
| 3.3 | Enforce APP-03 limits: <300 files/repo, <15 repos/user with warnings | **3** | Limit enforcement + user feedback |
| 3.4 | Create `src/js/cache.js` with `cacheGet()` / `cacheSet()` with TTL | **2** | Standard localStorage pattern |
| 3.5 | PAT-change cascade: flush ALL cached data when PAT changes | **2** | Clear cache invalidation pattern |
| 3.6 | Background refresh: return cached immediately, fetch fresh in background | **4** | Async coordination, state management |
| 3.7 | Mid-interaction deferral: defer re-render if user is active | **4** | Complex interaction tracking, timing logic |
| 3.8 | Guard against corrupted localStorage entries | **2** | JSON parse error handling |
| 3.9 | Create `src/js/components.js`: `renderShimmer()`, `renderError()`, `renderNotification()` | **2** | Standard DOM manipulation |
| 3.10 | Create `renderSearchableDropdown()` with keyboard nav, mobile-friendly | **4** | Complex UI component with a11y |
| 3.11 | Accessibility: error messages use `role="alert"`, notifications use `aria-live` | **2** | Standard a11y attributes |
| 3.12 | **Test**: `tests/github-api.test.js` — mock fetch, success/error paths, limits | **2** | Standard API mocking |
| 3.13 | **Test**: `tests/cache.test.js` — TTL, PAT cascade, corruption handling | **2** | Straightforward unit tests |

### Output

- `src/js/github-api.js`
- `src/js/cache.js`
- `src/js/components.js`
- `tests/github-api.test.js`
- `tests/cache.test.js`

---

## 8. Phase 4 — Card 1: Configuration `To start`

### Phase Complexity: **⭐⭐⭐ Level 3** (Medium)

**Rationale**: Card UI with multiple interactions, API integration, and state wiring. Clear spec but requires careful coordination.

**Recommended Model**: Claude Sonnet 4

**Goal**: PAT input, username, repo grid, branch grid — fully wired to state and API.

**Req IDs**: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, APP-04

### Checklist

| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 4.1 | Create `src/js/card-configuration.js` basic structure | **2** | Standard card pattern |
| 4.2 | PAT password field with show/hide toggle + "Clear" action | **2** | Standard form interaction |
| 4.3 | PAT persisted to localStorage on change; clear removes it | **1** | Direct localStorage calls |
| 4.4 | Username text input, pre-filled from localStorage | **1** | Simple form field |
| 4.5 | On page load: auto-fetch repos using stored PAT + username | **2** | API call + shimmer |
| 4.6 | Repo buttons: scrollable wrapping button grid, single-tap select | **2** | Standard button grid |
| 4.7 | Selected repo: accent bar + subtle background (VIS treatment) | **1** | CSS class application |
| 4.8 | On repo select: fetch branches + file tree, auto-select default branch | **3** | Multiple async operations, coordination |
| 4.9 | Branch buttons: wrapping grid, auto-selected default highlighted | **2** | Standard button grid |
| 4.10 | On branch change: reload file tree | **2** | API call + state update |
| 4.11 | On PAT change: re-fetch repos, flush entire cache | **2** | API call + cache clear |
| 4.12 | Shimmer skeletons while repos/branches load | **1** | Use shared component |
| 4.13 | Inline errors on API failure | **2** | Use shared component |
| 4.14 | Card expand/collapse behavior per UJ table | **2** | State-driven UI |
| 4.15 | **Test**: `tests/card-configuration.test.js` — PAT persistence, repo fetch, branch auto-select | **2** | Standard unit tests |

### Output

- `src/js/card-configuration.js`
- `tests/card-configuration.test.js`

---

## 9. Phase 5 — Card 2: Task (Dual-Panel) `To start`
<<<<<<< claude/alternative-prompt-frameworks-uEn1j

**Goal**: Flow selector grid with dual-panel layout (Situation/Target), flow-specific input fields, quality meter.

**Req IDs**: SCT-01..09, DM-DEF-03

=======

### Phase Complexity: **⭐⭐⭐⭐⭐ Level 5** (Very High)

**Rationale**: Most complex phase. Dual-panel layout with flow-specific fields, auto-generated steps, quality meter, multi-file scope. Core of the new hybrid framework.

**Recommended Model**: Claude Opus 4 or Claude Sonnet 4

**Goal**: Flow selector + dual-panel (Situation/Target) with flow-specific fields, quality meter, step auto-generation trigger.

**Req IDs**: SCT-01..09, DM-DEF-03

>>>>>>> main
**Dependency**: Phase 2 (flow loader) + Phase 3 (file tree API). Full flow definitions (P2) needed — draft in `spec/hybrid-framework-design.md`.

### Checklist

<<<<<<< claude/alternative-prompt-frameworks-uEn1j
- [ ] Create `src/js/card-tasks.js`:
  - Flow buttons: wrapping grid with icon + title per button, single row per button (VIS-01, SCT-03)
  - 4 flows per SCT-02: Fix / Debug, Review / Analyze, Implement / Build, Improve / Modify
  - On flow select: `setState('task.flow_id', id)` + reset panel_a, panel_b, steps, improve_scope (DM-DEF-03 — full reset, no carry-over)
  - On flow select: expand Steps + Prompt cards, collapse Configuration (from UJ table)
  - **Dual-panel layout** per SCT-04: left/right on desktop (50/50 split), stacked on mobile. Panel A = "Situation" (+ flow subtitle), Panel B = "Target" (+ flow subtitle). Fields within each panel are driven by flow definition in flows.yaml.
  - Required group validation per SCT-05: at least one field in each required group must be filled. Visual indicator when group is unsatisfied.
  - If flow requires PRs/issues: trigger fetch (from UJ table)
  - Selected flow: accent bar + subtle background
  - Shimmer skeleton while data loads (GL-02)
- [ ] Create `src/js/file-tree.js` (file selection for Panel A/B file pickers):
  - Render recursive file tree from API data when flow requires file selection
  - Files update `panel_a.files`, `panel_b.spec_files`, or `panel_b.guideline_files` via `setState()` (SCT-01)
  - Full tree pre-loaded (APP-03 — within 300-file limit)
  - If tree exceeds 300 files: truncate and show warning message
  - **Spec vs Guideline**: file pickers for spec_files and guideline_files display tooltip/helper text distinguishing WHAT (specs) vs HOW (guidelines) per SCT-06
  - **Accessibility**: tree uses `role="tree"` / `role="treeitem"`, keyboard navigation
- [ ] Create `src/js/quality-meter.js` (SCT-08):
  - Calculate score from filled fields: each field type has a fixed weight (required text=25, required selector=20, optional text=15, file picker=15, lens picker=10, notes=5)
  - Score = filled weights / total possible weights for the active flow
  - Render thin horizontal bar below flow selector with 4 color thresholds (red ≤30%, orange 31-55%, yellow 56-75%, green 76-100%)
  - Updates on every state change via subscription
- [ ] **Improve/Modify scope selector** (SCT-09): when 2+ files selected in panel_a.files, show toggle: "Each file separately" vs "Across files together". Updates `improve_scope` in state.
- [ ] Pre-fillable options use flat searchable dropdowns (SCT-06): file pickers (flat alphabetical list), PR/issue pickers (#number — title). Uses shared `renderSearchableDropdown()` from `components.js`
- [ ] **Click audit (GL-01)**: flow select = 1 click, file toggle = 1 click. All within target.
- [ ] **Mobile (GL-03)**: flow grid reflows, dual-panel stacks vertically, file pickers scroll, touch targets adequate
- [ ] **Test**: `tests/card-tasks.test.js` — flow selection resets panels + steps, dual-panel renders per flow, required groups validate
- [ ] **Test**: `tests/quality-meter.test.js` — scoring per flow, threshold colors, updates on field change
=======
| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 5.1 | Create `src/js/card-tasks.js` basic structure with dual-panel layout | **3** | New dual-panel pattern, responsive stacking |
| 5.2 | Flow buttons: 4 flows (Fix/Debug, Review/Analyze, Implement/Build, Improve/Modify) | **2** | Standard button grid |
| 5.3 | On flow select: `setState('task.flow_id', id)` + trigger step auto-generation | **3** | State + side effect coordination |
| 5.4 | On flow select: expand Steps + Prompt cards, collapse Configuration | **2** | Card visibility management |
| 5.5 | Render Panel A (Situation) with flow-specific fields from flow definition | **4** | Dynamic field rendering based on YAML config |
| 5.6 | Render Panel B (Target) with flow-specific fields from flow definition | **4** | Dynamic field rendering, conditional visibility |
| 5.7 | Handle `required_group` validation (at least one of X or Y required) | **4** | Complex validation logic with UX feedback |
| 5.8 | Mandatory input fields clearly marked as required | **1** | Visual indicator |
| 5.9 | File picker: render recursive file tree from API data | **3** | Tree component with checkboxes |
| 5.10 | PR/issue pickers: searchable dropdown with #number — title format | **3** | Use shared dropdown component |
| 5.11 | Lens picker: multi-select with predefined options | **2** | Standard multi-select |
| 5.12 | Create `src/js/quality-meter.js`: field weight scoring + color bar | **3** | New component, calculation logic |
| 5.13 | Quality meter: update in real-time as fields are filled | **2** | State subscription |
| 5.14 | Quality meter: per-flow weight calculation (different required fields per flow) | **3** | Dynamic weight calculation |
| 5.15 | Multi-file scope selector (Improve flow only): "Each file separately" vs "Across files together" | **3** | Conditional UI, state management |
| 5.16 | Scope selector appears only when 2+ files selected | **2** | Conditional rendering |
| 5.17 | Panel field changes trigger step auto-generation (add/remove conditional steps) | **5** | Complex step generation logic |
| 5.18 | **Test**: `tests/card-tasks.test.js` — flow selection, dual-panel inputs, scope selector | **3** | Multiple interaction tests |
| 5.19 | **Test**: `tests/quality-meter.test.js` — scoring, threshold colors, per-flow weights | **2** | Unit tests for calculation logic |
>>>>>>> main

### Output

- `src/js/card-tasks.js`
- `src/js/file-tree.js`
- `src/js/quality-meter.js`
- `tests/card-tasks.test.js`
- `tests/quality-meter.test.js`

---

## 10. Phase 6 — Card 3: Steps (Auto-Generated) `To start`

<<<<<<< claude/alternative-prompt-frameworks-uEn1j
**Goal**: Auto-generated step list from flow + panel inputs, with lens fine-tuning and deletion.
=======
### Phase Complexity: **⭐⭐⭐⭐ Level 4** (High)

**Rationale**: Step auto-generation engine with conditional logic, locked steps, lens toggles. Core of the guided workflow.

**Recommended Model**: Claude Sonnet 4 or Claude Opus 4

**Goal**: Auto-generated step list with lens toggles, locked steps, deletion.
>>>>>>> main

**Req IDs**: STP-01..04

**Dependency**: Phase 2 (flow definitions) + Phase 5 (flow selection + panel fields populate steps).

### Checklist

<<<<<<< claude/alternative-prompt-frameworks-uEn1j
- [ ] Create `src/js/step-generator.js`:
  - `generateSteps(flowDef, panelA, panelB, improveScope)` → returns ordered step array
  - Base steps come from flow definition in flows.yaml
  - Conditional steps (with `source` field) only included when the referenced panel field is filled
  - Locked steps (e.g., "Read @claude.md") are always included
  - Called from `setState()` whenever flow, panel_a, or panel_b changes — result stored in `steps.enabled_steps`
- [ ] Create `src/js/card-steps.js`:
  - Render ordered step list from `state.steps.enabled_steps` (STP-01)
  - Each step is a compact single row: step number, operation + object label, optional lens pills
  - Locked steps: no trash icon, visual indicator (e.g., lock icon or dimmed trash)
  - Lens pills: pre-selected based on flow defaults, user can toggle on/off per step (STP-03)
  - Delete button (trash icon) on each non-locked step — single tap removes it (STP-04)
  - Steps cannot be reordered or manually added (STP-04)
  - All interactions call `setState()` to update `steps.enabled_steps`
- [ ] **Click audit (GL-01)**: lens toggle = 1 click, step delete = 1 click. All within target.
- [ ] **Mobile (GL-03)**: step list scrolls, adequate touch targets for lens pills and delete buttons
- [ ] **Accessibility**: delete buttons have `aria-label="Remove step: [step name]"`, lens pills are `role="switch"` with `aria-checked`
- [ ] **Test**: `tests/step-generator.test.js` — conditional step inclusion/exclusion, locked steps always present, improve_scope affects steps
- [ ] **Test**: `tests/card-steps.test.js` — step rendering, lens toggling updates state, step deletion, locked steps not removable
=======
| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 6.1 | Create `src/js/step-generator.js`: generate steps from flow definition + panel fields | **5** | Core algorithm with complex conditional logic |
| 6.2 | Handle conditional steps: add when field is filled, remove when field is cleared | **4** | State watching + step list manipulation |
| 6.3 | Handle locked steps: cannot be removed (e.g., "Read @claude.md") | **2** | Simple flag check |
| 6.4 | Handle step `source` references: map to panel field values | **4** | Dynamic step content from state |
| 6.5 | Create `src/js/card-steps.js`: render ordered step list | **2** | Standard list rendering |
| 6.6 | Each step shows: operation + object label, optional lenses, optional params | **3** | Dynamic step content |
| 6.7 | Locked steps show visual indicator (lock icon, no trash) | **2** | Conditional rendering |
| 6.8 | Lens pills: pre-selected based on flow defaults, user can toggle on/off | **3** | State management for lenses |
| 6.9 | Add custom lenses via free-text input | **2** | Simple input field |
| 6.10 | Delete button (trash icon) on non-locked steps | **1** | Simple action |
| 6.11 | All interactions call `setState()` to update `steps.enabled_steps` | **2** | Standard state updates |
| 6.12 | Steps cannot be reordered or added manually | **1** | No implementation needed |
| 6.13 | **Test**: `tests/step-generator.test.js` — step generation from flow + panel fields | **3** | Test complex conditional logic |
| 6.14 | **Test**: `tests/card-steps.test.js` — step rendering, lens toggling, step deletion | **2** | Standard UI tests |
>>>>>>> main

### Output

- `src/js/step-generator.js`
- `src/js/card-steps.js`
- `tests/step-generator.test.js`
- `tests/card-steps.test.js`

---

## 11. Phase 7 — Card 4: Prompt Output `To start`

### Phase Complexity: **⭐⭐ Level 2** (Low-Medium)

**Rationale**: Straightforward output display with clipboard API. Clear spec, minimal complexity.

**Recommended Model**: Claude Haiku 3.5 or Claude Sonnet 4

**Goal**: Prompt preview, copy to clipboard, user notes, Open in Claude button.

**Req IDs**: OUT-01..08

### Checklist

| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 7.1 | Create `src/js/card-prompt.js` basic structure | **1** | Standard card pattern |
| 7.2 | Prompt preview: `--surface-inset` background, `--font-mono` at `--text-sm`, left-aligned | **1** | CSS styling |
| 7.3 | Preview updates live as `prompt_input` changes (state subscription) | **2** | Subscribe to state changes |
| 7.4 | "Copy" button: `navigator.clipboard.writeText()` with success/failure feedback | **2** | Clipboard API + user feedback |
| 7.5 | Free-text notes field below prompt preview (textarea, stored in `notes.user_text`) | **1** | Simple textarea |
| 7.6 | "Open in Claude" button opens `https://claude.ai` in new tab (no prompt transfer) | **1** | Simple link |
| 7.7 | Card never auto-collapses once visible (OUT-08) | **1** | No implementation needed |
| 7.8 | Large prompt consideration: show character count if >10,000 chars | **2** | Simple length check |
| 7.9 | Accessibility: prompt preview has `role="region"`, copy button has `aria-live` feedback | **2** | Standard a11y |
| 7.10 | **Test**: `tests/card-prompt.test.js` — prompt renders, copy works, notes update | **2** | Standard UI tests |

### Output

- `src/js/card-prompt.js`
- `tests/card-prompt.test.js`

---

## 12. Phase 8 — Polish & Global Constraints `To start`

### Phase Complexity: **⭐⭐ Level 2** (Low-Medium)

**Rationale**: Verification and polish tasks. Manual testing, minor fixes. No new complex features.

**Recommended Model**: Claude Haiku 3.5 or Claude Sonnet 4

**Goal**: Verify all global constraints, mobile audit, performance check, remaining polish.

**Req IDs**: GL-01 (audit), GL-03 (audit), GL-05 (deferred refresh), APP-01, APP-02

### Phase 8a — Mobile & Responsiveness Audit

| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 8.1 | Test every card on 320px, 375px, 768px, 1024px viewport widths | **1** | Manual testing |
| 8.2 | Verify no horizontal scrolling on any viewport (GL-03) | **1** | Manual verification |
| 8.3 | Verify touch targets ≥44px on all interactive elements (VIS-02) | **1** | Manual verification |
| 8.4 | Verify button grids wrap correctly on small screens | **1** | Manual verification |
| 8.5 | Fix any responsive issues found | **2** | Minor CSS adjustments |

### Phase 8b — Global Constraint Verification

| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 8.6 | GL-01 click audit: walk through entire user journey, count clicks | **1** | Manual verification |
| 8.7 | GL-02 verify: all async loads show shimmer, empty states show message | **1** | Manual verification |
| 8.8 | GL-04 verify: all error states are inline, dismissible | **1** | Manual verification |
| 8.9 | GL-05 verify: background refresh with "Updated" indicator | **2** | Integration test |
| 8.10 | GL-05 verify: mid-interaction deferral (input focus or recent toggle) | **3** | Timing-based testing |
| 8.11 | APP-01 verify: fully client-side, no server calls except GitHub API | **1** | Code review |
| 8.12 | APP-02 verify: vanilla JS, ES modules, plain CSS | **1** | Code review |

### Phase 8c — Final Polish

| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 8.13 | Card auto-expand/collapse behavior per UJ table | **2** | Minor JS adjustments |
| 8.14 | Re-opened Configuration auto-collapses on next trigger | **2** | State management |
| 8.15 | Run `npm run format` + `npm run lint:fix` | **1** | Automated tooling |
| 8.16 | Run `npm run build` — verify clean build with no warnings | **1** | Automated verification |

### Output

- Updated CSS and JS files as needed
- All existing tests still pass

---

## 13. Phase 9 — End-to-End Tests `To start`

### Phase Complexity: **⭐⭐⭐ Level 3** (Medium)

**Rationale**: E2E tests require mocking multiple systems and testing full user journeys. Standard testing patterns.

**Recommended Model**: Claude Sonnet 4

**Goal**: Full user journey test, prompt determinism verification.

**Req IDs**: TST-01, TST-02

### Checklist

| # | Item | Complexity | Rationale |
|---|------|------------|-----------|
| 9.1 | Create `tests/e2e.test.js` basic structure with test environment | **2** | Test setup |
| 9.2 | TST-02: repo select → flow select → step adjust → copied prompt matches expected | **3** | Full journey test with assertions |
| 9.3 | TST-01: prompt determinism — identical input produces identical output (run multiple times) | **2** | Snapshot comparison |
| 9.4 | Test card expand/collapse transitions through the full journey | **2** | UI state verification |
| 9.5 | Test flow switch fully resets steps (DM-DEF-03) | **2** | State reset verification |
| 9.6 | Test PAT clear + re-entry flow | **2** | Auth flow test |
| 9.7 | Test all 4 flows with their specific fields | **3** | Multiple test scenarios |
| 9.8 | Run full test suite: `npm test` | **1** | Automated verification |
| 9.9 | Run `npm run build` — final build verification | **1** | Automated verification |
| 9.10 | Update status table in `spec/spec_concept.md` for all completed requirements | **1** | Documentation update |

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
<<<<<<< claude/alternative-prompt-frameworks-uEn1j
| SCT-01    | 5                        | 5              | Panel A files flagged for "read upfront"   |
| SCT-02    | 5                        | 5              | 4 predefined flows (dual-panel)            |
=======
| SCT-01    | 5                        | 5              | Files flagged for LLM to "read upfront"    |
| SCT-02    | 5                        | 5              | 4 predefined flows                         |
>>>>>>> main
| SCT-03    | 5                        | 5              | Flow button grid                           |
| SCT-04    | 5                        | 5              | Dual-panel Situation/Target layout         |
| SCT-05    | 5                        | 5              | Required group validation                  |
| SCT-06    | 5                        | 5              | Searchable dropdowns + spec/guide tooltips |
| SCT-07    | 2                        | 2              | flows.yaml definitions                     |
<<<<<<< claude/alternative-prompt-frameworks-uEn1j
| SCT-08    | 5                        | 5              | Quality Meter scoring + color bar          |
| SCT-09    | 5                        | 5              | Improve multi-file scope selector          |
| STP-01    | 6                        | 6              | Auto-generated steps + delete              |
| STP-02    | 6                        | 6              | Conditional steps from panel fields        |
| STP-03    | 6                        | 6              | Lens pills per step                        |
| STP-04    | 6                        | 6              | Step removal (non-locked only)             |
=======
| SCT-08    | 5                        | 5              | Quality Meter                              |
| SCT-09    | 5, 6                     | 6              | Step auto-generation                       |
| STP-01    | 6                        | 6              | Ordered list + delete                      |
| STP-02    | 6                        | 6              | Locked steps, step data model              |
| STP-03    | 6                        | 6              | Lens pills                                 |
| STP-04    | 6                        | 6              | Step removal                               |
>>>>>>> main
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
| R1  | `flows.yaml` not authored by PO in time                                                          | Blocks Phase 5 (full), Phase 6 | Medium     | Use detailed mock flows from hybrid-framework-design.md. Design UI to handle any number of steps/lenses/params.         |
| R2  | Searchable dropdown in vanilla JS is complex (keyboard nav, mobile touch, scroll, search filter) | Delays Phase 5                 | Medium     | Start with a simpler select-based dropdown. Enhance to searchable only if file/PR lists are long enough to warrant it.   |
| R3  | ~~**OUT-07**: deep link feasibility~~                                                            | ~~Degrades Phase 7 feature~~   | —          | **Resolved**: PO decided button opens `claude.ai` only (no prompt transfer). Label must clearly indicate this.           |
| R4  | localStorage corruption from version changes                                                     | Breaks state hydration         | Low        | Validate shape on hydration + migration function. If invalid, clear and start fresh. Log to console.                     |
| R5  | Large file trees (close to 300-file limit) cause slow rendering                                  | Degrades UX on large repos     | Low        | Use document fragment for batch DOM insertion. Consider virtual scrolling only if performance is measurably poor.        |
| R6  | Prompt rebuild causes UI jank on complex prompts                                                 | Degrades UX                    | Low        | Profile first. If measurable jank (>16ms rebuild), batch via `requestAnimationFrame`. Unlikely for text-only generation. |
| R7  | State schema drift between spec_concept.md and implementation                                    | Confusion during development   | High       | **Mitigated**: Updated spec_concept.md with panel_a/panel_b structure and version field.                                 |
| R8  | Step auto-generation race conditions from rapid field changes                                    | UI flicker, incorrect steps    | Medium     | Debounce field changes; batch step updates in single render cycle.                                                       |
| R9  | Locked step edge case: "Read @claude.md" but repo doesn't have the file                          | Confusing UX                   | Medium     | Pre-check file existence; show warning if missing; make step conditional.                                                |

---

## 16. Resolved Questions (PO Decisions — 2026-02-24/25)

1. **File/folder selection moved after task selection**: File selection is now optional and flow-dependent (not a separate Scope section). Clearer UX, simpler tree logic, more background loading time, less vertical space.

2. **OUT-07 Deep link**: Verified feasible. Button opens `claude.ai` (no prompt transfer). Label must clearly indicate it only opens the site.

3. **VIS-03 added**: Minimum 2 open + 2 collapsed cards visible in viewport. Tightening UI requirements to ensure minimal vertical scrolling.

4. **GL-05 mid-interaction**: Agreed — mid-interaction defined as: user has active focus on an input field, OR has toggled a checkbox/lens within the last 2 seconds.

5. **Hybrid framework adopted**: 4 flows (Fix/Debug, Review/Analyze, Implement/Build, Improve/Modify) replace 6 flows. Dual-panel layout (Situation → Target) with auto-generated steps.

6. **State version field**: Added `version: "1.0"` to state schema with migration logic for v0 → v1.0 transition.

7. **Panel naming**: Option D chosen — "Situation" / "Target" with flow-specific subtitles.

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
| **Dual-panel layout** for Task card                  | Aligns with mental model of "Situation → Target". Responsive stacking on mobile. Clearer than monolithic form.                                                                        |
| **Auto-generated steps**                             | Reduces user burden. Steps update dynamically as panel fields are filled. No manual step creation needed.                                                                             |
| **Quality Meter with fixed weights**                 | Simpler than dynamic scoring. Provides clear feedback without false precision of percentages.                                                                                         |

---

## 18. Phase Complexity Summary

| Phase | Description | Complexity | Recommended Model |
|-------|-------------|------------|-------------------|
| **0** | CSS Foundation | ⭐⭐ Level 2 | Claude Haiku 3.5 / Sonnet 4 |
| **1** | State Management | ⭐⭐⭐⭐ Level 4 | Claude Sonnet 4 / Opus 4 |
| **2** | Build Pipeline & Flow Loading | ⭐⭐⭐⭐ Level 4 | Claude Sonnet 4 / Opus 4 |
| **3** | GitHub API & Caching | ⭐⭐⭐ Level 3 | Claude Sonnet 4 |
| **4** | Card 1: Configuration | ⭐⭐⭐ Level 3 | Claude Sonnet 4 |
| **5** | Card 2: Task (Dual-Panel) | ⭐⭐⭐⭐⭐ Level 5 | Claude Opus 4 / Sonnet 4 |
| **6** | Card 3: Steps | ⭐⭐⭐⭐ Level 4 | Claude Sonnet 4 / Opus 4 |
| **7** | Card 4: Prompt Output | ⭐⭐ Level 2 | Claude Haiku 3.5 / Sonnet 4 |
| **8** | Polish & Global Constraints | ⭐⭐ Level 2 | Claude Haiku 3.5 / Sonnet 4 |
| **9** | End-to-End Tests | ⭐⭐⭐ Level 3 | Claude Sonnet 4 |

### Complexity Distribution

```
Level 5: ████ Phase 5 (Task card with dual-panel + step generation)
Level 4: ████████ Phases 1, 2, 6 (State, Build pipeline, Steps)
Level 3: ████████ Phases 3, 4, 9 (API, Config card, E2E tests)
Level 2: ████████ Phases 0, 7, 8 (CSS, Prompt output, Polish)
Level 1: None (no phase is purely boilerplate)
```

### Critical Path (High Complexity)

**Phases 1 → 2 → 5 → 6** form the critical path requiring the most capable models:

1. **Phase 1**: State management is foundational — errors here cascade
2. **Phase 2**: Flow schema defines the entire system structure
3. **Phase 5**: Dual-panel UI + step generation is the core feature
4. **Phase 6**: Step auto-generation engine drives the guided workflow

**Recommendation**: Use **Claude Opus 4** for Phases 5 and 6. Use **Claude Sonnet 4** for Phases 1, 2, 3, 4, and 9. Use **Claude Haiku 3.5** for Phases 0, 7, and 8.
