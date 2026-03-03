# STAGE B Implementation Plan (v1)

---

### CONTEXT UAT Feedback Remediation

After Stage A a UAT review surfaced broad visual, interaction, and logic
issues across all four cards. A prior partial UAT remediation was committed on 2026-02-27
but did not close all items. This plan defines six phases (B1-6) to
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

## 1. Phase B1 — Global Visual Foundation

[x] **Shadow System**: Implement `--shadow-sm` and `--shadow-md` for elevation; apply to cards and modals for improved cognitive mapping of layers.
[x] **Icon Migration**: Replace CSS-transform "diamonds" with inline Octicon SVGs; unify all iconography under a single `.icon` class with standard scaling.
[x] **Contrast & State**: Refine `--accent-subtle` for ≥4.5:1 contrast; use `oklch` for perceptually uniform selection states.
[x] **Field Depth**: Add internal shadows to `.input-field` to create a "recessed" affordance, distinguishing interactive areas from surface containers.

## 2. Phase B2 — Config Card Refinement

[x] **Expansion Logic**: Refactor `renderButtons()` to prevent auto-collapse on selection; ensure "Show More" persistence for user context.
[x] **Credential UI**: Implement flex-sibling layout `[icon][input][eye][clear]` for PAT/Username; toggle actions based on input state without layout shift.
[x] **Iconography**: Prepend context-specific Octicons (repo/git-branch) to all grid items; utilize flex-wrap for natural "More/Less" button placement.
[x] **Affordance**: Ensure PAT field uses `type="password"` by default with high-contrast visibility toggles.

## 3. Phase B3 — Task Card (Dual-Panel)

[x] **Visual Separation**: Redefine Situation/Target panels as stacked cards with distinct `--surface` tokens and 1px borders for depth.
[x] **Validation UI**: Replace disruptive error blocks with inline `alert` icons and hover-based tooltips; reduce visual noise while maintaining mandatory cues.
[x] **Hierarchy**: Implement 2-tier button system; selected flows use `--surface-inset` and `--accent` left-borders for immediate state feedback.
[x] **Compact Layout**: Inline panel subtitles with `·` separators; reduce field labels to `var(--text-sm)` for mobile-first density.

## 4. Phase B4 — Steps Card & Output Logic

[x] **Step Styling**: Render steps as distinct blocks with operation-coded icons (e.g., Green/Create, Blue/Edit) and circular number badges.
[x] **Multi-select Outputs**: Migrate output selection to an array-based checkbox behavior; implement "Tab Bar" toggles with static labels.
[x] **File Consolidation**: Merge redundant "Read" steps into single blocks with removable file pills; maintain individual file paths in the prompt engine.
[x] **Lens Stability**: Prevent layout "jumping" by fixing lens order; store expanded states in local module state to persist through re-renders.

## 5. Phase B5 — Prompt Card & Action Header

[x] **Header Actions**: Move "Copy" and "Prompt Claude" to the card header; establish clear Primary vs. Ghost visual hierarchy.
[x] **Feedback Loops**: Implement "Swap-and-Revert" icon animation for Copy (Clipboard → Check); avoid text labels to maintain UI cleanliness.
[x] **Syntax Highlighting**: Process preview through `highlightXml` utility to wrap tags in `.xml-tag` spans using `--accent` color tokens.
[x] **Quality Meter**: Append an `info` icon with a detailed scoring tooltip; ensure the color bar reflects weighted state changes reactively.

## 6. Phase B6 — Final UAT & Regression

[x] **Viewport Audit**: Verify zero horizontal scroll at 320px; ensure all touch targets (buttons/icons) meet 44px minimum height requirements.
[x] **Performance**: Final bundle audit for vanilla JS/ESM compliance; remove redundant event listeners and unused CSS tokens.
[x] **A11y Pass**: Validate `aria-expanded` states and ensure keyboard focus remains trapped in active input flows during credential entry.
