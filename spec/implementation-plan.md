# Implementation Plan (v4)

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
12. [UAT Feedback Remediation — Phases 10–14](#12-UAT-Feedback-Remediation-Phases-10-till-14)

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

## 12. UAT Feedback Remediation Phases 10 till 14

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

### Blocked / Needs PO Decision

| Item                            | Blocker                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| 2.5 Mandatory fields logic      | Requires editing `src/config/flows.yaml` — PO must authorize         |
| "Review: text input for target" | Review Panel B has no description field — requires `flows.yaml` edit |

---

### Phase 10 — Global Visual Foundation

**Goal:** Add shadow depth system, fix diamond chevrons to octicon arrows, deepen active
state contrast. Header padding left unchanged.

#### Files

- `src/css/variables.css`
- `src/css/styles.css`

#### 1. New shadow variables (`variables.css`)

```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.14);
```

#### 2. Deepen active state contrast (`variables.css`)

- Darken `--accent-subtle` so selected buttons are visibly distinct. Current:
  `#aed1d4` → target approximately `oklch(72% 0.06 195)` (adjust in review until
  contrast ratio ≥ 4.5:1 against `--text-primary`).

####3. Fix diamond chevrons (`styles.css` + JS)

- Current chevron is a CSS border/transform trick producing a diamond shape.
- Replace: inline an octicon `chevron-down` SVG (16×16, `viewBox="0 0 16 16"`) in
  the card header toggle wherever it is built in JS. Apply classes `.icon .icon--chevron`.
- CSS:
  ```css
  .icon--chevron {
    transition: transform 0.2s ease;
  }
  .card--open .icon--chevron {
    transform: rotate(180deg);
  }
  ```
- `.icon { flex-shrink: 0; display: block; }` — ensures no clipping for all icons.
- No per-card variant class. One rule covers all card chevrons.

#### 4. Depth: cards and input fields (`styles.css`)

- `.card`: `box-shadow: var(--shadow-sm)`
- `.input-field`: `box-shadow: inset 0 1px 2px rgba(0,0,0,0.06)` (recessed feel,
  no new variable needed for this specific raw value).

#### Verification (Phase 10)

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
  <input class="input-field" … />
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
  .input-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .input-row .input-field {
    flex: 1;
    min-width: 0;
  }
  .btn-icon {
    background: none;
    border: none;
    color: var(--text-tertiary);
    width: 28px;
    height: 28px;
    display: grid;
    place-content: center;
  }
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
  .btn-grid-item .icon {
    width: 20px;
    height: 20px;
    display: block;
  }
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
  — `<span class="panel-subtitle">` separated by `·`, not a new line.
- Field row gap: `gap: var(--sp-3)`.

### Verification (Phase 12)

- [x] Flow icons not clipped at 20×20px in all 4 flow buttons
- [x] Panels visually distinct (same background, Panel A has left accent border) with shadow
- [x] Input fields clearly darker/warmer than card body (global `--surface-inset`)
- [x] Required group dot (7px) with tooltip on hover; full-width error block removed
- [x] Picker icons use `.icon.icon--sm` class, no inline styles
- [x] Selected button icons colored `--accent`
- [x] Panel subtitle inline with `·` separator

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

| Object       | Octicon            |
| ------------ | ------------------ |
| file / files | `file`             |
| branch       | `git-branch`       |
| PR           | `git-pull-request` |
| issue        | `issue-opened`     |
| tests        | `beaker`           |
| commit       | `git-commit`       |
| report       | `file-text`        |

Operation → color class (applied to `.icon`):

| Operation       | Class             | Color              |
| --------------- | ----------------- | ------------------ |
| read / analyze  | `.icon--read`     | `--text-secondary` |
| edit / modify   | `.icon--edit`     | `--accent`         |
| create / commit | `.icon--create`   | `--success`        |
| validate / run  | `.icon--validate` | `--accent-hover`   |

CSS:

```css
.icon--read {
  color: var(--text-secondary);
}
.icon--edit {
  color: var(--accent);
}
.icon--create {
  color: var(--success);
}
.icon--validate {
  color: var(--accent-hover);
}
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
  .btn-copy .icon-check {
    display: none;
  }
  .btn-copy.btn--copied .icon-clipboard {
    display: none;
  }
  .btn-copy.btn--copied .icon-check {
    display: block;
  }
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

| Phase | Test                                                                        |
| ----- | --------------------------------------------------------------------------- |
| 11    | `renderRepoButtons` expanded → all repos in DOM                             |
| 11    | `renderBranchButtons` expanded → all branches in DOM                        |
| 11    | Selecting a repo does not set `reposCollapsed = true`                       |
| 13    | Multiple read steps → merged into one step with `params.files` array        |
| 13    | Single file removable from merged step                                      |
| 13    | Two output modes can be active simultaneously in `outputs_selected`         |
| 14    | `highlightXml`: XSS-safe — `<script>` in text node becomes `&lt;script&gt;` |
| 14    | `highlightXml`: XML tag wrapped in `.xml-tag` span                          |

---
