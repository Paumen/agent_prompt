# Redesign Plan — Review (Updated with PO Feedback)

---

## a. Problem Definition — Verified and Confirmed

| Claim                            | Verdict       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CSS bloat & near-duplication** | **Confirmed** | 93 unique class selectors. Breakdown: Steps 23, Input/Picker 24, Button/Pill 17, Icon 14, Panel 11, Meter 10, Card 8, Config 6, Prompt 6, Shimmer 3. Many near-duplicates with slight variations (font-weight, color, spacing). Meter alone has 10 classes including `.meter-info-btn`, `.meter-tooltip`, `.meter-tooltip--visible` for what is essentially a standard icon+tooltip pattern. Naming mixes BEM and other conventions making it hard to read. Cleanup effort doesn't stick — redundancies return with each feature. |
| **DOM class soup**               | **Confirmed** | While the actual DOM nesting is moderate (max 6 levels), the 93 CSS classes — many card- or component-specific — create a false impression of complexity. When reading CSS you can't tell what the structure is. `display: contents` flattens visually but doesn't simplify the mental model or the code.                                                                                                                                                                                                                         |
| **Limited responsiveness**       | **Confirmed** | Only 1 breakpoint (768px). Only responsive change: dual-panel stacks. No container queries, no viewport units, no dynamic sizing. Fixed `max-width: 680px`. 3-value spacing scale (2/4/8px) doesn't adapt.                                                                                                                                                                                                                                                                                                                        |
| **UI clutter**                   | **Confirmed** | User-tested. Users confirmed cognitive strain.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Maintainability**              | **Confirmed** | Card-specific classes (6 for config, 6 for prompt, 23 for steps) couple CSS to specific cards. Moving a field between cards means touching CSS + JS. Near-duplicate patterns require manual cleanup that doesn't persist. Inconsistent naming makes onboarding harder.                                                                                                                                                                                                                                                            |

**Bottom line:** All problems are real. The redesign is justified as a structural investment, not emergency remediation. The codebase works but fights against itself as features are added.

---

## b. Solution Direction — Assessment

**The direction is correct.** Grid-first layout, standardized components, fewer classes, flatter DOM. This addresses all five problems directly.

**Corrections and clarifications based on PO feedback:**

| Item                         | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **JS rendering changes**     | Will need to touch all card JS files. The framework defines the target; JS changes follow from it.                                                                                                                                                                                                                                                                                                                                                                                               |
| **Dropdown/popover**         | These become `field-picker` — the search input + dropdown + selected pills pattern. Already covered under Input-field-picker in the framework.                                                                                                                                                                                                                                                                                                                                                   |
| **Quality meter**            | Accepted as a "special component" that reuses standard elements where possible (icon+tooltip = btn-icon, the bar itself = output-styled). Will get a `special.css` for its unique styling.                                                                                                                                                                                                                                                                                                       |
| **Scope selector**           | Currently not working. Lower priority. Defer.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Repos/branches → pickers** | This adopts an existing input pattern (same as PR/Issue pickers), not a new feature. Separate PR if no conflict with grid layout.                                                                                                                                                                                                                                                                                                                                                                |
| **Button count**             | See revised taxonomy below — reduced to **5 types** (from 7 proposed, vs 6 current). Target: challenge further to 4.                                                                                                                                                                                                                                                                                                                                                                             |
| **Label vs Tag**             | **Error in draft.** Label = 1-2 words describing something (e.g., input field label). No background. Tag = shaped element with bg, remove button (e.g., selected file pill). `input-label` class can be removed — labels are just text in the grid.                                                                                                                                                                                                                                              |
| **Accessibility**            | Existing ARIA attributes, keyboard nav, and screen reader support will be preserved. These are HTML attributes, not CSS — they survive the restructure as long as semantic HTML elements stay correct. In plain terms: the things that make the app usable for people with disabilities don't live in CSS, they live in the HTML elements and their properties. As long as we keep using `<button>` for clickable things, `<label>` for labels, and the right `aria-*` attributes, this is safe. |
| **"In addition" items**      | These are **roadmap items**, not afterthoughts. See dependency assessment below.                                                                                                                                                                                                                                                                                                                                                                                                                 |

---

## c. Updated Component Framework

**Notation:** `Cols × Rows` where `auto` = any number of rows/columns. Surface color noted after.

| Component        | Layout                               | Surface                | Notes                                                                                                                                                   |
| :--------------- | :----------------------------------- | :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **body**         | Grid: 1 col × auto rows              | `--shell`              | Contains cards. Currently 4, but `auto` rows means any number works.                                                                                    |
| **card**         | Grid: 1 col × auto rows              | `--bg`                 | Contains: btn-icon header + card-in-card(s) and/or input(s) and/or output(s).                                                                           |
| **card-in-card** | Grid: 1 col × auto rows              | `--bg-raised`          | Same as card but raised surface + left accent border. Replaces panel-a/panel-b.                                                                         |
| **input**        | Grid: 2 cols × auto rows (20% / 80%) | inherit                | Label in col 1, field in col 2. For consistent look across all cards. If subgrid can achieve both consistency AND label-width flexibility, prefer that. |
| **input-field**  | Flex                                 | `--bg-inset` (lighter) | Text input, textarea. Second column of input grid.                                                                                                      |
| **field-picker** | Flex                                 | `--bg-inset` (lighter) | Search input + dropdown popover + selected tag pills. Replaces current picker-wrapper/dropdown-wrapper/file-picker-wrapper.                             |
| **input-grid**   | Grid: auto × auto                    | inherit                | Additional content area below field (e.g., pills row, helper text). Second column, second row.                                                          |
| **output**       | —                                    | `--bg-inset` (darker)  | Spans full width of parent card.                                                                                                                        |
| **output-field** | Grid: 5 cols × 2 rows                | —                      | Columns: step#, label, content, content, trash. For step rows.                                                                                          |
| **output-block** | Flex                                 | —                      | Prompt code-block display.                                                                                                                              |

### Button Taxonomy (5 types — final)

| Type            | Look                                                | Behavior                         | Current equivalent                  | Used for                                      |
| :-------------- | :-------------------------------------------------- | :------------------------------- | :---------------------------------- | :-------------------------------------------- |
| **btn-primary** | Accent bg, white text                               | Triggers main action             | `.btn-action--primary`              | "Prompt Claude"                               |
| **btn-select**  | Accent border/text when selected, neutral otherwise | Single-select from options       | `.btn-grid-item` + `.item-selected` | Task/flow picker                              |
| **btn-action**  | Rectangular, neutral border                         | One-shot action                  | `.btn-action`                       | Copy                                          |
| **btn-pill**    | Pill shape, neutral border, darker bg when selected | Multi-select toggle              | `.pill` + `.pill--on`               | Lenses, output modes                          |
| **btn-icon**    | No bg (transparent/inherit), icon ± label           | Tertiary action, collapse/expand | `.btn-icon`, `.card-header`         | Clear, remove, info, card headers, eye toggle |

### Other Elements

| Element   | Description                                                                                                                                      |
| :-------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **tag**   | Pill/tag shape, `--bg-inset` darker bg, has remove button. Shows truncated text, full path/title on hover. Used for selected files, PRs, issues. |
| **label** | Plain text, 1-2 words. No background. Lives in grid col 1 of input rows. NOT a class — just a `<label>` element.                                 |
| **icon**  | Inline SVG via `icons.js`. Standardized size.                                                                                                    |

### Special Components (isolated CSS allowed)

| Component          | Reuses                                      | Own styling                                                               |
| :----------------- | :------------------------------------------ | :------------------------------------------------------------------------ |
| **Quality meter**  | btn-icon (for info button), tooltip pattern | Bar + track + thresholds                                                  |
| **Shimmer/loader** | —                                           | Animation keyframes                                                       |
| **Notifications**  | —                                           | Float animation (if these are actually used; PO hasn't seen them trigger) |

---

## d. Updated Implications

| Implication                          | Detail                                                                                                                                                                                                                                                                             |
| :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **~50% class reduction**             | From 93 → target <40 core classes. Using `inherit`, `:has()`, `:where()`, pseudo-classes, and standardization. Isolated specials excluded from count. The proposed framework has ~20 core classes; adding variants, states, and interaction patterns realistically lands at 35-45. |
| **Flatter DOM**                      | Remove wrappers: `dual-panel`, `panel-area`, `input-row`, `dropdown-wrapper`, `panel-field-group`. Elements live directly in their parent grid.                                                                                                                                    |
| **JS changes across all card files** | All 4 card JS files + components.js + quality-meter.js need class name updates and DOM structure changes. This is the bulk of the work.                                                                                                                                            |
| **One functional change**            | Repos/branches adopt picker pattern (like PRs/issues). Separate PR.                                                                                                                                                                                                                |
| **Panels → card-in-card**            | `panel-a`/`panel-b`/`dual-panel` replaced by `card-in-card` class.                                                                                                                                                                                                                 |
| **No card-specific classes**         | All `cfg-*`, `prompt-*` etc. replaced with generic framework classes.                                                                                                                                                                                                              |
| **Reduced spacing rules**            | Grid `gap` handles most spacing. Elements fill their parents.                                                                                                                                                                                                                      |
| **CSS variables updates**            | Fix accent colors (`light-dark()`), add `--bg-inset-darker` if needed, apply `clamp()` to spacing/font values (see roadmap dependency assessment).                                                                                                                                 |
| **Test simplification**              | See testing strategy below.                                                                                                                                                                                                                                                        |
| **Max-width → 800px**                | Wider container for more breathing room                                                                                                                                                                                                                                            |

---

## e. "In Addition" — Roadmap Dependency Assessment

| Item                                         | Dependency on Redesign?                                                                                                                                                                       | Efficiency Gain if Combined?                                                                                                                                                             | Recommendation                                                                                                                      |
| :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| **Container queries**                        | **YES — strong.** If we build grid layouts with only `@media` breakpoints, we'll need to rework them for container queries later. Cards should be their own container context from the start. | **HIGH.** Setting `container-type: inline-size` on cards and using `@container` instead of `@media` for card-internal layouts is trivial when writing new CSS — but painful to retrofit. | **INCLUDE in core redesign.** Define container context on cards. Use `@container` for card-internal breakpoints.                    |
| **Dynamic sizing (clamp)**                   | **PARTIAL.** If we define spacing and font sizes now without `clamp()`, every value gets touched again later.                                                                                 | **HIGH.** When writing new `gap`, `padding`, `font-size` rules, applying `clamp(min, preferred, max)` is one extra step. Retrofitting later means touching every rule twice.             | **INCLUDE in core redesign.** Apply `clamp()` to spacing and font sizes as new rules are written.                                   |
| **Light-dark all colors**                    | **NO direct dependency.** Just 3 variables in `variables.css` need wrapping.                                                                                                                  | **HIGH.** It's 3 lines of change.                                                                                                                                                        | **INCLUDE in core redesign.** Fix the 3 accent color variables. Trivial effort.                                                     |
| **Focus modes (:focus-within, :has)**        | **LOW.** This layers on top of any layout. Independent of grid structure.                                                                                                                     | **LOW.** Pure UX enhancement. No efficiency loss from deferring.                                                                                                                         | **ROADMAP.** No dependency, no efficiency gain. Do after redesign is stable.                                                        |
| **Progressive disclosure (collapse/expand)** | **PARTIAL.** Card-in-card should support collapsing (like cards do). The grid layout needs `auto` rows that can collapse to 0.                                                                | **MEDIUM.** If card-in-card inherits the card collapse pattern, it's one CSS rule.                                                                                                       | **INCLUDE basic mechanism** (card-in-card supports collapse). Defer advanced progressive disclosure (dimming, focusing) to ROADMAP. |

**Summary:** Include container queries, `clamp()`, light-dark fix, and basic card-in-card collapse in the core redesign. Defer focus modes and advanced progressive disclosure to roadmap.

---

## f. Risks + Mitigation

| Risk                                                         | Likelihood | Impact | Mitigation                                                                                                                                                    |
| :----------------------------------------------------------- | :--------- | :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Regression in functionality** — touching all card JS files | High       | High   | Structural redesign first (CSS + grid framework), then update JS card-by-card. Test core functionality (prompt generation, state management) after each card. |
| **Scope creep** — roadmap items bleeding into core           | High       | Medium | Hard boundary: core redesign = grid layout + standardized classes + container queries + clamp(). Focus modes and advanced disclosure = separate PRs.          |
| **"Big bang" breaks everything**                             | Medium     | High   | Mitigate by doing CSS quick wins first (reducing blast radius), then structural changes. Use feature branch. PO visual review before merge.                   |
| **Test maintenance**                                         | Medium     | Medium | Simplify tests alongside (see testing strategy). Don't maintain 432 tests through a redesign.                                                                 |
| **Inconsistent look during work**                            | Medium     | Low    | Expected during beta. Feature branch isolates from users.                                                                                                     |

---

## g. Impact / Effort

| Phase                               | What                                                                                                                                                | Impact     | Effort                  | Dependencies                                                     |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :---------------------- | :--------------------------------------------------------------- |
| **C1 Quick wins**                   | CSS consolidation: merge near-duplicate pills, extract shared flex patterns, extract shared surface pattern                                         | Medium     | Low (CSS-only)          | None                                                             |
| **C2 Framework**                    | Define new CSS grid classes (body, card, card-in-card, input, output, btn-\*). Container queries on cards. `clamp()` values. Fix accent light-dark. | High       | Medium                  | Phase 0                                                          |
| **C3 Apply structurally**           | Update HTML skeleton + all card JS files to use new framework. Remove card-specific classes. Flatten DOM.                                           | High       | High (majority of work) | Phase 1                                                          |
| **C4 Pattern cleanup**              | Standardize remaining patterns (field-picker, tags, icons). Remove old CSS.                                                                         | Medium     | Medium                  | Phase 2                                                          |
| **C5 Test simplification**          | Reduce to ~200-250 focused tests. Remove DOM-structure tests.                                                                                       | Medium     | Medium                  | Phase 2-3                                                        |
| **Separate: Repos → pickers**       | Convert repo/branch grids to field-picker pattern                                                                                                   | Low-Medium | Medium                  | Phase 1 (needs field-picker class), no conflict with grid layout |
| **Roadmap: Focus modes**            | `:focus-within` / `:has()` to dim non-active cards                                                                                                  | Medium     | Low-Medium              | Phase 2 complete                                                 |
| **Roadmap: Progressive disclosure** | Advanced collapse/expand beyond basic card-in-card                                                                                                  | Medium     | Medium                  | Phase 2 complete                                                 |

---

## h. Alternatives

**The PO has chosen: structural redesign with Strategy 1+3 approach.** For the record, alternatives considered:

| Alternative                                                                   | Pros                                                                 | Cons                                                               | Verdict                                                             |
| :---------------------------------------------------------------------------- | :------------------------------------------------------------------- | :----------------------------------------------------------------- | :------------------------------------------------------------------ |
| CSS-only refactor                                                             | Low risk, fast                                                       | Doesn't flatten DOM or remove card-specific classes                | Insufficient — doesn't solve maintainability                        |
| Card-by-card                                                                  | Low risk per card                                                    | Risks sub-optimizing per card instead of building a true framework | Rejected — correctly identified as the maintainability anti-pattern |
| Full big-bang                                                                 | Clean end state                                                      | Max risk                                                           | Too risky without preparation                                       |
| **Chosen: Quick wins → Framework → Structural application → Pattern cleanup** | Framework-first ensures consistency. Quick wins reduce blast radius. | More planning upfront                                              | **Selected**                                                        |

---

## i. Target File Structure

### CSS: 4 Files

| File               | Purpose                             | Contains                                                                                                                                                                                                                                                                                                               |
| :----------------- | :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **variables.css**  | Design tokens                       | Colors (all `light-dark()`), spacing (`clamp()` values), typography, borders, shadows. Single source of truth for every value.                                                                                                                                                                                         |
| **layout.css**     | Grid definitions + structural rules | `body` grid, `.card` grid, `.card-in-card` grid, `.input` grid, `.input-grid`, `.output`, `.output-field` grid, `.output-block`. Container query definitions (`container-type: inline-size` on cards). `@container` breakpoints for card-internal layout shifts. Max-width. No colors, no typography — purely spatial. |
| **components.css** | Component styles                    | `.btn-primary`, `.btn-select`, `.btn-action`, `.btn-pill`, `.btn-icon` (and their states: hover, focus, selected, disabled). `.input-field`, `.field-picker`, `.tag`, `.icon`. Surface colors, text colors, borders on components. Interaction states (`:hover`, `:focus-visible`, `[aria-checked]`).                  |
| **special.css**    | One-off components                  | Quality meter (bar, track, thresholds, colors). Shimmer/loader animation (if kept). Notification float animation (if kept). Anything that doesn't fit the standard component set. Goal: keep this file small and shrinking.                                                                                            |

**Why 4 files instead of 1:**

- `variables.css` is already separate — stays.
- Splitting layout from components means you can change how things look (components.css) without touching where they go (layout.css) and vice versa. This directly supports the goal of "adjust layout via CSS only."
- `special.css` isolates exceptions. If it grows, that's a smell.

**Import order matters:** `variables.css` → `layout.css` → `components.css` → `special.css`. Later files can override earlier ones without specificity hacks.

**Estimated sizes (post-redesign):**

| File           | Current equivalent                          | Target                                                     |
| :------------- | :------------------------------------------ | :--------------------------------------------------------- |
| variables.css  | 54 lines                                    | ~60 lines (adding `clamp()` values, fixing `light-dark()`) |
| layout.css     | ~150 lines scattered in styles.css          | ~100 lines                                                 |
| components.css | ~650 lines scattered in styles.css          | ~250-300 lines                                             |
| special.css    | ~120 lines (meter + shimmer + notification) | ~60 lines (if kept)                                        |
| **Total**      | **926 lines**                               | **~450-550 lines (40-50% reduction)**                      |

---

### JS: Component Factory + Thinner Card Files

#### Current state

| File                  | Lines     | DOM creation lines | className/classList calls |
| :-------------------- | :-------- | :----------------- | :------------------------ |
| card-tasks.js         | 821       | ~280               | 43                        |
| card-configuration.js | 679       | ~180               | 35                        |
| card-steps.js         | 636       | ~260               | 28                        |
| card-prompt.js        | 253       | ~110               | 22                        |
| components.js         | 198       | ~100               | 16                        |
| file-tree.js          | 223       | ~100               | 17                        |
| quality-meter.js      | 193       | ~35                | —                         |
| **Subtotal UI files** | **3,003** | **~1,065**         | **161**                   |

~35% of UI code is DOM creation boilerplate. Across files, **6 patterns repeat 3+ times each**, totaling ~343 lines of near-identical code:

| Repeated pattern                        | Occurrences | ~Lines each |
| :-------------------------------------- | :---------- | :---------- |
| Dropdown (search input + filtered list) | 3 files     | ~50         |
| Button grid (icon + label + state)      | 5 places    | ~12         |
| Pills/tags (icon + text + remove)       | 6 places    | ~8          |
| Input rows (icon + input + actions)     | 3 files     | ~15         |
| "More/Less" toggle                      | 3 places    | ~8          |
| Labels with required indicator          | 2 places    | ~8          |

#### Target structure

**Card files do NOT get obsoleted.** They get thinner. Each card file keeps its card-specific orchestration (what goes in the card, in what order, wired to what state) and business logic (API calls, validation, caching). What moves out is the repetitive DOM creation — that goes to a shared component factory.

| File                      | Role after redesign                                                                                                                                                                                                                                                                                            | Estimated size                            |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| **ui.js** (new)           | Component factory. Exports functions like `createInputField()`, `createPicker()`, `createButtonGrid()`, `createPill()`, `createTag()`, `createMoreLess()`. Each returns a DOM element with correct classes, ARIA attributes, and event wiring. Card files call these instead of manual `createElement` chains. | ~200-250 lines                            |
| **card-configuration.js** | Orchestration: which fields appear, in what order. Business logic: PAT validation, repo/branch loading, caching, API calls. Calls `ui.js` for all DOM creation.                                                                                                                                                | ~450-500 lines (from 679, ~30% reduction) |
| **card-tasks.js**         | Orchestration: flow selector, panel fields, field dispatch. Business logic: prefetch, required group validation. Calls `ui.js` for DOM creation.                                                                                                                                                               | ~550-600 lines (from 821, ~30% reduction) |
| **card-steps.js**         | Orchestration: step list, per-step rows. Business logic: step regeneration, lens toggling. Calls `ui.js` for DOM creation.                                                                                                                                                                                     | ~400-450 lines (from 636, ~30% reduction) |
| **card-prompt.js**        | Orchestration: meter, preview, notes, copy/prompt buttons. Business logic: XML highlighting, clipboard, deep-link. Calls `ui.js` for DOM creation.                                                                                                                                                             | ~180-200 lines (from 253, ~25% reduction) |
| **components.js**         | Shrinks. Shimmer, error, notification stay here (or move to `special.js` / get removed if unused). `createSearchableDropdown` moves to `ui.js`. `setInteracting` stays.                                                                                                                                        | ~80-100 lines (from 198)                  |
| **file-tree.js**          | Becomes a thin wrapper around `ui.js` picker + card-specific file logic.                                                                                                                                                                                                                                       | ~120-150 lines (from 223)                 |
| **quality-meter.js**      | Mostly business logic (scoring). DOM creation minimal. Stays roughly the same.                                                                                                                                                                                                                                 | ~170-190 lines (from 193)                 |

**Why NOT obsolete card files and put everything in components?**

- Card files own the _composition_ — which components appear in which card, in which order, wired to which state fields. This is card-specific by definition.
- Business logic (API calls, validation, caching in card-configuration; step regeneration in card-steps; flow prefetch in card-tasks) is inherently card-specific.
- What's NOT card-specific is _how_ to build a button, input field, or picker — that's what `ui.js` handles.
- Analogy: `ui.js` is the building materials catalog. Card files are the architects that assemble each room.

#### `ui.js` — Proposed API

```js
// Buttons
createButton(type, { label, icon, selected, onClick, ariaLabel });
// type: 'primary' | 'select' | 'action' | 'pill' | 'icon'

// Input fields
createInputField({ placeholder, value, type, icon, onInput, onChange });

// Pickers (search + dropdown + tags)
createPicker({ items, selected, onSelect, onRemove, placeholder, iconFn });

// Tags
createTag({ label, icon, onRemove, title });

// Button grid
createButtonGrid(buttons, { role, ariaLabel, columns });
// buttons: array of { label, icon, selected, onClick }

// More/Less toggle
createMoreLess({ hiddenCount, expanded, onToggle });

// Labels
createLabel(text, { required });
```

Each function returns a DOM element with the correct framework class names already applied. Card files never write `className = 'btn-pill'` directly — they call `createButton('pill', {...})`. This means if class names ever change again, only `ui.js` needs updating.

#### `ui.js` — Scope Boundaries

**IN scope** (belongs in `ui.js`):

- DOM element creation for reusable components (buttons, inputs, pickers, tags, grids)
- Applying the correct CSS class names from the framework
- Setting ARIA attributes (`role`, `aria-checked`, `aria-expanded`, `aria-label`)
- Wiring event callbacks passed in as parameters (`onClick`, `onInput`, `onRemove`, `onToggle`)
- Returning a ready-to-append DOM element or fragment

**OUT of scope** (does NOT belong in `ui.js`):

- **Card-specific composition logic** — which components appear in which card, in what order, wired to which state fields. This stays in card files. `ui.js` builds a picker; `card-tasks.js` decides that card 2 has a file picker in panel A wired to `state.selectedFiles`.
- **Business logic** — API calls, validation, caching, data transforms, scoring. Never in `ui.js`. Example: PAT validation stays in `card-configuration.js`, step regeneration stays in `card-steps.js`, quality scoring stays in `quality-meter.js`.
- **State management** — `getState()`, `setState()`, `subscribe()` are never called inside `ui.js`. Card files read state and pass values into `ui.js` factory functions. Card files subscribe to state changes and call `ui.js` to update or re-render.
- **One-off / special components** — Quality meter bar+track, shimmer animations, notification floats. These have unique DOM structures that don't repeat. They use local DOM creation in their own files (`quality-meter.js`, `components.js`) or get removed if unused. Adding them to `ui.js` would bloat it with single-use functions.
- **Layout decisions** — `ui.js` does not decide grid column counts, container widths, or responsive breakpoints. That's CSS (`layout.css`). `ui.js` creates elements; CSS places them.
- **Icons** — `icons.js` already handles SVG creation. `ui.js` calls `icon()` but doesn't own it.

**Litmus test:** If a function would only be called from one card file, it does NOT belong in `ui.js`. If it's called from 2+ card files (or reasonably could be), it does.

#### Summary: JS line count impact

|                 | Current   | Target           | Reduction                 |
| :-------------- | :-------- | :--------------- | :------------------------ |
| Card files (4)  | 2,389     | ~1,580-1,750     | ~30%                      |
| components.js   | 198       | ~80-100          | ~50%                      |
| file-tree.js    | 223       | ~120-150         | ~40%                      |
| ui.js (new)     | 0         | ~200-250         | (new)                     |
| **Net UI code** | **2,810** | **~1,980-2,250** | **~20-30% net reduction** |

The reduction is modest in raw lines because business logic doesn't shrink — it's the _complexity per line_ that improves. Card files become readable orchestration; DOM boilerplate is gone.

---

## j. Implementation Strategy (1+3 Hybrid)

**Sequence:**

1. **CSS Quick Wins** (low risk, immediate value)
   - Merge near-duplicate pill classes (4 → 1 base + modifiers)
   - Extract shared flex-wrap utility (7 near-identical patterns)
   - Extract shared surface pattern (border/shadow/radius)
   - Fix accent color `light-dark()` gap (3 variables)
   - Fix `--shadow-inset-sm` undefined variable bug

2. **Define CSS Framework + `ui.js`** (new files, not yet wired)
   - Split `styles.css` → `layout.css` + `components.css` + `special.css`
   - Write the grid classes: body, card, card-in-card, input grid, output
   - Write btn-primary, btn-select, btn-action, btn-pill, btn-icon
   - Write tag, field-picker base
   - Set `container-type: inline-size` on cards
   - Apply `clamp()` to spacing and font values
   - Set max-width to 800px
   - Create `ui.js` with component factory functions
   - Both old AND new classes/files coexist temporarily

3. **Apply Framework Structurally** (the "big" step, card by card)
   - Update HTML skeleton to use new grid classes
   - Start with card-prompt (smallest, ~253 lines) as proof of concept
   - Then card-steps, card-configuration, card-tasks
   - For each card: swap `createElement` boilerplate → `ui.js` calls, flatten DOM, use new CSS classes
   - Remove wrapper divs (dual-panel, panel-area, input-row, dropdown-wrapper)
   - Delete old CSS as each card migrates
   - Extract `ALL_LENSES` and other duplicated constants to shared module

4. **Pattern-by-Pattern Cleanup**
   - Sweep for any remaining card-specific classes
   - Standardize remaining one-offs
   - Verify class count target (<50 core)
   - Delete orphaned CSS and empty old `styles.css`

5. **Test Simplification** (alongside steps 3-4)
   - Replace DOM-structure tests with behavior tests
   - Remove low-value tests
   - Target ~150-200 tests

**Key principle (from PO):** We build the framework first, then cards conform to it. NOT the other way around. Each component sits in its grid; it should not matter which card it's in. This IS the maintainability fix.

### Phase Validation Criteria (Exit Gates)

Each phase must pass its exit gate before the next phase begins.

**Phase C1 — CSS Quick Wins:**

- [x] All quick-win CSS changes merged (pill consolidation, flex utility, surface pattern, accent light-dark fix, shadow-inset-sm fix)
- [x] `npm run build` passes with zero errors
- [x] `npm run lint` passes
- [x] Visual regression check: PO confirms app looks identical before and after (no visible changes — these are internal consolidations only)
- [x] All existing tests still pass (`npm test`)

**Phase C2 — Framework Definition:**

- [x] 4 new CSS files created: `variables.css` (updated), `layout.css`, `components.css`, `special.css`
- [x] All grid classes defined and documented (body, card, card-in-card, input, output, btn-\*)
- [x] `container-type: inline-size` set on card elements
- [x] `clamp()` applied to spacing and font-size variables
- [x] `ui.js` created with all factory functions (`createButton`, `createInputField`, `createPicker`, `createTag`, `createButtonGrid`, `createMoreLess`, `createLabel`)
- [x] Old `styles.css` and new CSS files coexist without conflicts — both class systems work simultaneously
- [x] `npm run build` passes
- [x] A standalone HTML test page or Storybook-like preview demonstrates each `ui.js` component works correctly in isolation
- [x] PO reviews component preview and confirms visual direction

**Phase C3 — Structural Application (per card):**

Exit gate applies _after each card migration_, not just at the end:

- [x] Card uses only new framework classes — zero card-specific CSS classes remain for that card
- [x] Card DOM is flatter: no `dual-panel`, `panel-area`, `input-row`, or `dropdown-wrapper` wrappers
- [x] Card JS uses `ui.js` factory functions — no direct `className` or `classList.add` for framework components
- [x] All functional tests for that card pass (state changes, user interactions produce correct results)
- [x] Accessibility spot-check: ARIA attributes preserved, keyboard navigation works, focus outlines visible
- [x] `npm run build` passes
- [x] PO visual review: card looks correct at mobile (375px), tablet (768px), and desktop (1200px) widths

Card migration order: card-prompt → card-steps → card-configuration → card-tasks

**Phase C4 — Pattern Cleanup:**

- [ ] Zero card-specific CSS classes remain across entire app
- [ ] Core class count < 50 (excluding special.css)
- [x] Old `styles.css` deleted entirely — all styles live in 4 new files
- [ ] No orphaned CSS rules (every rule is referenced by at least one element)
- [ ] No inline styles in .js or .html
- [ ] `ALL_LENSES` and other duplicated constants extracted to shared module
- [ ] `npm run build` + `npm run lint` + `npm test` all pass

**Phase C5 — Test Simplification:**

- [ ] DOM-structure tests replaced with behavior tests (test what the user sees, not what classes exist)
- [ ] Low-value tests removed (framework wiring, header text assertions)
- [ ] Test count in range ~200-250 (down from 432)
- [ ] All remaining tests pass
- [ ] No test references old class names or removed DOM wrappers
- [ ] `npm test` passes with zero failures

---

## k3. Open Items / Decisions Required

| #   | Item                                                                                                                                                                                                                                                                                                                                         | Status                                                                                                                                                                              |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **btn-action vs btn-select merge → reach 4 button types?**                                                                                                                                                                                                                                                                                   | **Closed — keep 5.** The semantic distinction aids accessibility (screen readers announce selected state for `btn-select` but not `btn-action`) and maintainability. See section c. |
| 2   | **Input grid: fixed 20%/80% vs subgrid for flexibility?** If subgrid can keep labels consistent across cards while adapting to content, it's the best of both worlds.                                                                                                                                                                        | Open — will prototype both                                                                                                                                                          |
| 3   | **notifications: obsoleted?** PO hasn't seen them. Verify if functional before including in framework. If unused, remove.                                                                                                                                                                                                                    | Open                                                                                                                                                                                |
| 5   | **CSS file split: `layout.css` + `components.css` + `special.css`?** PO proposed this split. Adopted in plan. Confirm naming convention before Phase 2.                                                                                                                                                                                      | Adopted — naming TBD                                                                                                                                                                |
| 6   | **`ui.js` scope: just DOM creation or also event wiring?** If `ui.js` only creates elements, card files still wire events. If `ui.js` also wires events (via callback params), card files shrink more but `ui.js` grows. Recommendation: include callback params in factory functions (like `onClick`, `onInput`) — this is the natural API. | Open — prototype will clarify                                                                                                                                                       |

---

## l. Roadmap Items (No Dependency on Core Redesign)

| Item                                | Description                                              | Can do after                       |
| :---------------------------------- | :------------------------------------------------------- | :--------------------------------- |
| **Focus modes**                     | `:focus-within` + `:has()` to dim non-active cards       | Phase 2                            |
| **Advanced progressive disclosure** | Collapsing sections beyond basic card-in-card            | Phase 2                            |
| **Repos/branches → pickers**        | Adopt field-picker pattern for repo and branch selection | Phase 1 (needs field-picker class) |

**Meter has 10 classes and ~200 lines for a bar + label + tooltip.** PO correctly flags this as over-engineered. During Phase 3, reduce to standard output-styling + btn-icon + a few special rules.
