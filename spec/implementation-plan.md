# Implementation Plan (v4)

## Table of Contents

1. [Architecture & File Map](#1-architecture--file-map)

## Table of Contents

1. [Architecture & File Map](#1-architecture--file-map)
2. [Preconditions](#2-preconditions)
3. [Phase 0 — CSS Foundation](#3-phase-0--css-foundation)
4. [Phase 1 — State Management](#4-phase-1--state-management)
5. [Phase 2 — Build Pipeline & Flow Loading](#5-phase-2--build-pipeline--flow-loading)
6. [Phase 3 — GitHub API & Caching](#6-phase-3--github-api--caching)
7. [Phase 4 — Card 1: Configuration](#7-phase-4--card-1-configuration)
8. [Phase 5 — Card 2: Task (Dual-Panel)](#8-phase-5--card-2-task-dual-panel)
9. [Phase 6 — Card 3: Steps (Auto-Generated)](#9-phase-6--card-3-steps-auto-generated)
10. [Phase 7 — Card 4: Prompt Output](#10-phase-7--card-4-prompt-output)
11. [Phase 8 — Polish & Constraints](#11-phase-8--polish--constraints)
12. [Phase 9 — Global Visual Foundation](#12-phase-9--global-visual-foundation)
13. [Phase 10 — Config Card Refinement](#13-phase-10--config-card-refinement)
14. [Phase 11 — Task Card (Dual-Panel)](#14-phase-11--task-card-dual-panel)
15. [Phase 12 — Steps Card & Output Logic](#15-phase-12--steps-card--output-logic)
16. [Phase 13 — Prompt Card & Action Header](#16-phase-13--prompt-card--action-header)
17. [Phase 14 — Final UAT & Regression](#17-phase-14--final-uat--regression)

---

## 1. Architecture & File Map

- **main.js**: Entry point; coordinates state and rendering.
- **state.js**: Centralized `setState()`/`subscribe()` logic.
- **prompt-builder.js**: Pure function for XML prompt generation.
- **github-api.js / cache.js**: REST integration with 15-min TTL and PAT-invalidation.
- **flow-loader.js**: Build-time YAML-to-JSON loader with schema validation.
- **UI Cards**: `card-configuration.js`, `card-tasks.js`, `card-steps.js`, `card-prompt.js`.
- **CSS**: `variables.css` (tokens) and `styles.css` (mobile-first grid, shimmers).

## 2. Preconditions

- **P1/P2**: PO approval of `flows.yaml` field/step definitions.
- **P3**: Deep-link target: `claude.ai/new?q=<prompt>`.
- **P4/P5**: Existing CI pipeline and PR templates.

## 3. Phase 0 — CSS Foundation

- **Design Tokens**: Implement all VIS section colors, typography, and spacing in `variables.css`.
- **Base UI**: Card shell (expand/collapse), accent bars (3px left-edge), and button grids.
- **Feedback**: `.shimmer` pulse for loading and `--danger` inline errors.
- **A11y**: Keyboard-navigable headers (Enter/Space) and `aria-expanded` states.

## 4. Phase 1 — State Management

- **setState Logic**: Use explicit `setState()` over Proxy for debuggable mutations.
- **Persistence**: Save PAT/Owner to `localStorage`; reset all other fields on reload.
- **Prompt Engine**: Pure `buildPrompt()` function using XML tags and `@file` prefixes.
- **Testing**: Validate state hydration, session resets, and deterministic prompt snapshots.

## 5. Phase 2 — Build Pipeline & Flow Loading

- **YAML Plugin**: Vite plugin to parse `flows.yaml` using `js-yaml`.
- **Validation**: Strict JSON Schema check during build; fail build on malformed flows.
- **Loader**: `flow-loader.js` to provide validated JSON to the runtime.

## 6. Phase 3 — GitHub API & Caching

- **API Services**: Fetch repos, branches, trees, PRs, and issues.
- **Constraints**: Enforce <300 files/repo and <15 repos/user limits.
- **Cache**: `localStorage` layer with 15-min TTL; flush all keys on PAT change.
- **Shared UI**: Searchable dropdowns (44px targets) and dismissible notifications.

## 7. Phase 4 — Card 1: Configuration

- **PAT Handling**: Password field with toggle/clear; immediate cache flush on change.
- **Workflow**: Auto-fetch repos on load; select repo → fetch branch/tree → expand Card 2.
- **UI**: Scrollable button grids with `--accent` selection highlights.

## 8. Phase 5 — Card 2: Task (Dual-Panel)

- **Flow Selection**: 4 flows (Fix, Review, Implement, Improve); full state reset on change.
- **Dual-Panel**: Responsive Situation (A) / Target (B) layout with flow-specific fields.
- **Quality Meter**: Weighted scoring (PR=20, File=10, etc.) with 6-tier color bar.
- **File Selection**: Flat searchable list for specs and guidelines.

## 9. Phase 6 — Card 3: Steps (Auto-Generated)

- **Generator**: Map flow definitions and panel inputs to an ordered `enabled_steps` array.
- **Interaction**: Deletable steps (trash icon); toggleable lens pills (first 7 visible).
- **Inputs**: Inline text fields for branch/PR names and output mode selection.

## 10. Phase 7 — Card 4: Prompt Output

- **Preview**: Live-updating mono-font preview in `--surface-inset`.
- **Actions**: `navigator.clipboard` copy button and "Prompt Claude" deep-link.
- **Notes**: Free-text textarea appended to prompt via `<notes>` tags.

## 11. Phase 8 — Polish & Constraints

- **GL-01/03**: Verify all primary actions ≤2 clicks and zero horizontal scroll on 320px viewports.
- **GL-05**: Background refresh logic to `deferIfInteracting()` (check `document.activeElement`).
- **Performance**: Final bundle audit; ensure vanilla JS/ESM compliance.

---

## UAT Feedback Remediation Phases 10 till 14

### Context

After Phase 9 (E2E tests), a UAT review surfaced broad visual, interaction, and logic
issues across all four cards. A prior partial UAT remediation was committed on 2026-02-27
but did not close all items. This plan defines five new implementation phases (10–14) to
fully address the remaining feedback.

---

### Ground Rules (all phases)

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

## 12. Phase 9 — Global Visual Foundation

[x] **Shadow System**: Implement `--shadow-sm` and `--shadow-md` for elevation; apply to cards and modals for improved cognitive mapping of layers.
[x] **Icon Migration**: Replace CSS-transform "diamonds" with inline Octicon SVGs; unify all iconography under a single `.icon` class with standard scaling.
[x] **Contrast & State**: Refine `--accent-subtle` for ≥4.5:1 contrast; use `oklch` for perceptually uniform selection states.
[x] **Field Depth**: Add internal shadows to `.input-field` to create a "recessed" affordance, distinguishing interactive areas from surface containers.

## 13. Phase 10 — Config Card Refinement

[x] **Expansion Logic**: Refactor `renderButtons()` to prevent auto-collapse on selection; ensure "Show More" persistence for user context.
[x] **Credential UI**: Implement flex-sibling layout `[icon][input][eye][clear]` for PAT/Username; toggle actions based on input state without layout shift.
[x] **Iconography**: Prepend context-specific Octicons (repo/git-branch) to all grid items; utilize flex-wrap for natural "More/Less" button placement.
[x] **Affordance**: Ensure PAT field uses `type="password"` by default with high-contrast visibility toggles.

## 14. Phase 11 — Task Card (Dual-Panel)

[x] **Visual Separation**: Redefine Situation/Target panels as stacked cards with distinct `--surface` tokens and 1px borders for depth.
[x] **Validation UI**: Replace disruptive error blocks with inline `alert` icons and hover-based tooltips; reduce visual noise while maintaining mandatory cues.
[x] **Hierarchy**: Implement 2-tier button system; selected flows use `--surface-inset` and `--accent` left-borders for immediate state feedback.
[x] **Compact Layout**: Inline panel subtitles with `·` separators; reduce field labels to `var(--text-sm)` for mobile-first density.

## 15. Phase 12 — Steps Card & Output Logic

[x] **Step Styling**: Render steps as distinct blocks with operation-coded icons (e.g., Green/Create, Blue/Edit) and circular number badges.
[x] **Multi-select Outputs**: Migrate output selection to an array-based checkbox behavior; implement "Tab Bar" toggles with static labels.
[x] **File Consolidation**: Merge redundant "Read" steps into single blocks with removable file pills; maintain individual file paths in the prompt engine.
[x] **Lens Stability**: Prevent layout "jumping" by fixing lens order; store expanded states in local module state to persist through re-renders.

## 16. Phase 13 — Prompt Card & Action Header

[x] **Header Actions**: Move "Copy" and "Prompt Claude" to the card header; establish clear Primary vs. Ghost visual hierarchy.
[x] **Feedback Loops**: Implement "Swap-and-Revert" icon animation for Copy (Clipboard → Check); avoid text labels to maintain UI cleanliness.
[x] **Syntax Highlighting**: Process preview through `highlightXml` utility to wrap tags in `.xml-tag` spans using `--accent` color tokens.
[x] **Quality Meter**: Append an `info` icon with a detailed scoring tooltip; ensure the color bar reflects weighted state changes reactively.

## 17. Phase 14 — Final UAT & Regression

[x] **Viewport Audit**: Verify zero horizontal scroll at 320px; ensure all touch targets (buttons/icons) meet 44px minimum height requirements.
[x] **Performance**: Final bundle audit for vanilla JS/ESM compliance; remove redundant event listeners and unused CSS tokens.
[x] **A11y Pass**: Validate `aria-expanded` states and ensure keyboard focus remains trapped in active input flows during credential entry.
