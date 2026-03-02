# Redesign Plan — Review (Updated with PO Feedback)

---

## a. Problem Definition — Verified and Confirmed

| Claim | Verdict | Evidence |
|-------|---------|----------|
| **CSS bloat & near-duplication** | **Confirmed** | 93 unique class selectors. Breakdown: Steps 23, Input/Picker 24, Button/Pill 17, Icon 14, Panel 11, Meter 10, Card 8, Config 6, Prompt 6, Shimmer 3. Many near-duplicates with slight variations (font-weight, color, spacing). Meter alone has 10 classes including `.meter-info-btn`, `.meter-tooltip`, `.meter-tooltip--visible` for what is essentially a standard icon+tooltip pattern. Naming mixes BEM and other conventions making it hard to read. Cleanup effort doesn't stick — redundancies return with each feature. |
| **DOM class soup** | **Confirmed** | While the actual DOM nesting is moderate (max 6 levels), the 93 CSS classes — many card- or component-specific — create a false impression of complexity. When reading CSS you can't tell what the structure is. `display: contents` flattens visually but doesn't simplify the mental model or the code. |
| **Limited responsiveness** | **Confirmed** | Only 1 breakpoint (768px). Only responsive change: dual-panel stacks. No container queries, no viewport units, no dynamic sizing. Fixed `max-width: 680px`. 3-value spacing scale (2/4/8px) doesn't adapt. |
| **UI clutter** | **Confirmed** | User-tested. Users confirmed cognitive strain. |
| **Maintainability** | **Confirmed** | Card-specific classes (6 for config, 6 for prompt, 23 for steps) couple CSS to specific cards. Moving a field between cards means touching CSS + JS. Near-duplicate patterns require manual cleanup that doesn't persist. Inconsistent naming makes onboarding harder. |

**Bottom line:** All problems are real. The redesign is justified as a structural investment, not emergency remediation. The codebase works but fights against itself as features are added.

---

## b. Solution Direction — Assessment

**The direction is correct.** Grid-first layout, standardized components, fewer classes, flatter DOM. This addresses all five problems directly.

**Corrections and clarifications based on PO feedback:**

| Item | Resolution |
|------|-----------|
| **JS rendering changes** | Will need to touch all card JS files. The framework defines the target; JS changes follow from it. |
| **Dropdown/popover** | These become `field-picker` — the search input + dropdown + selected pills pattern. Already covered under Input-field-picker in the framework. |
| **Quality meter** | Accepted as a "special component" that reuses standard elements where possible (icon+tooltip = btn-icon, the bar itself = output-styled). Will get a `special.css` for its unique styling. |
| **Scope selector** | Currently not working. Lower priority. Defer. |
| **Repos/branches → pickers** | This adopts an existing input pattern (same as PR/Issue pickers), not a new feature. Separate PR if no conflict with grid layout. |
| **Button count** | See revised taxonomy below — reduced to **5 types** (from 7 proposed, vs 6 current). Target: challenge further to 4. |
| **Label vs Tag** | **Error in draft.** Label = 1-2 words describing something (e.g., input field label). No background. Tag = shaped element with bg, remove button (e.g., selected file pill). `input-label` class can be removed — labels are just text in the grid. |
| **Accessibility** | Existing ARIA attributes, keyboard nav, and screen reader support will be preserved. These are HTML attributes, not CSS — they survive the restructure as long as semantic HTML elements stay correct. In plain terms: the things that make the app usable for people with disabilities don't live in CSS, they live in the HTML elements and their properties. As long as we keep using `<button>` for clickable things, `<label>` for labels, and the right `aria-*` attributes, this is safe. |
| **"In addition" items** | These are **roadmap items**, not afterthoughts. See dependency assessment below. |

---

## c. Updated Component Framework

**Notation:** `Cols × Rows` where `auto` = any number of rows/columns. Surface color noted after.

| Component | Layout | Surface | Notes |
|:---|:---|:---|:---|
| **body** | Grid: 1 col × auto rows | `--shell` | Contains cards. Currently 4, but `auto` rows means any number works. |
| **card** | Grid: 1 col × auto rows | `--bg` | Contains: btn-icon header + card-in-card(s) and/or input(s) and/or output(s). |
| **card-in-card** | Grid: 1 col × auto rows | `--bg-raised` | Same as card but raised surface + left accent border. Replaces panel-a/panel-b. |
| **input** | Grid: 2 cols × auto rows (20% / 80%) | inherit | Label in col 1, field in col 2. For consistent look across all cards. If subgrid can achieve both consistency AND label-width flexibility, prefer that. |
| **input-field** | Flex | `--bg-inset` (lighter) | Text input, textarea. Second column of input grid. |
| **field-picker** | Flex | `--bg-inset` (lighter) | Search input + dropdown popover + selected tag pills. Replaces current picker-wrapper/dropdown-wrapper/file-picker-wrapper. |
| **input-grid** | Grid: auto × auto | inherit | Additional content area below field (e.g., pills row, helper text). Second column, second row. |
| **output** | — | `--bg-inset` (darker) | Spans full width of parent card. |
| **output-field** | Grid: 5 cols × 2 rows | — | Columns: step#, label, content, content, trash. For step rows. |
| **output-block** | Flex | — | Prompt code-block display. |

### Button Taxonomy (Target: 5 types, challenge to 4)

| Type | Look | Behavior | Current equivalent | Used for |
|:---|:---|:---|:---|:---|
| **btn-primary** | Accent bg, white text | Triggers main action | `.btn-action--primary` | "Prompt Claude" |
| **btn-select** | Accent border/text when selected, neutral otherwise | Single-select from options | `.btn-grid-item` + `.item-selected` | Task/flow picker |
| **btn-action** | Rectangular, neutral border | One-shot action | `.btn-action` | Copy |
| **btn-pill** | Pill shape, neutral border, darker bg when selected | Multi-select toggle | `.pill` + `.pill--on` | Lenses, output modes |
| **btn-icon** | No bg (transparent/inherit), icon ± label | Tertiary action, collapse/expand | `.btn-icon`, `.card-header` | Clear, remove, info, card headers, eye toggle |

**Can we reach 4?** Merge `btn-action` into `btn-select` (a select that's never "selected" is effectively an action button). This works if Copy just uses `btn-select` styling without a selected state. Trade-off: semantically muddier. PO to decide.

### Other Elements

| Element | Description |
|:---|:---|
| **tag** | Pill/tag shape, `--bg-inset` darker bg, has remove button. Shows truncated text, full path/title on hover. Used for selected files, PRs, issues. |
| **label** | Plain text, 1-2 words. No background. Lives in grid col 1 of input rows. NOT a class — just a `<label>` element. |
| **icon** | Inline SVG via `icons.js`. Standardized size. |

### Special Components (isolated CSS allowed)

| Component | Reuses | Own styling |
|:---|:---|:---|
| **Quality meter** | btn-icon (for info button), tooltip pattern | Bar + track + thresholds |
| **Shimmer/loader** | — | Animation keyframes (if these are actually used; PO hasn't seen them trigger) |
| **Notifications** | — | Float animation (if working) |

---

## d. Updated Implications

| Implication | Detail |
|:---|:---|
| **~50% class reduction** | From 93 → target <47 core classes. Using `inherit`, `:has()`, `:where()`, pseudo-classes, and standardization. Isolated specials excluded from count. The proposed framework has ~20 core classes; adding variants, states, and interaction patterns realistically lands at 35-45. |
| **Flatter DOM** | Remove wrappers: `dual-panel`, `panel-area`, `input-row`, `dropdown-wrapper`, `panel-field-group`. Elements live directly in their parent grid. |
| **JS changes across all card files** | All 4 card JS files + components.js + quality-meter.js need class name updates and DOM structure changes. This is the bulk of the work. |
| **One functional change** | Repos/branches adopt picker pattern (like PRs/issues). Separate PR. |
| **Panels → card-in-card** | `panel-a`/`panel-b`/`dual-panel` replaced by `card-in-card` class. |
| **No card-specific classes** | All `cfg-*`, `prompt-*` etc. replaced with generic framework classes. |
| **Reduced spacing rules** | Grid `gap` handles most spacing. Elements fill their parents. |
| **CSS variables updates** | Fix accent colors (`light-dark()`), add `--bg-inset-darker` if needed, apply `clamp()` to spacing/font values (see roadmap dependency assessment). |
| **Test simplification** | See testing strategy below. |
| **Max-width → 800px** | Wider container for more breathing room. |

### Testing Strategy

Current state: 432 test cases across 15 files. PO feedback: excessive for a simple webapp, tests rarely catch real issues, most bugs found in PR review and user testing.

**Approach for the redesign:**
- **Keep**: Functional tests (state changes, prompt building, step generation, flow loading, API calls). These test *logic*, not DOM structure, so they survive the redesign mostly intact.
- **Simplify**: DOM-structure tests (class name assertions, element counting). Replace with fewer, broader integration tests that verify *behavior* (e.g., "clicking a flow button updates the state" rather than "button has class `.item-selected`").
- **Remove**: Tests that test framework wiring rather than functionality (e.g., "card has correct header text").
- **Target**: ~200-250 meaningful tests (40-45% reduction) that test what matters.

---

## e. "In Addition" — Roadmap Dependency Assessment

| Item | Dependency on Redesign? | Efficiency Gain if Combined? | Recommendation |
|:---|:---|:---|:---|
| **Container queries** | **YES — strong.** If we build grid layouts with only `@media` breakpoints, we'll need to rework them for container queries later. Cards should be their own container context from the start. | **HIGH.** Setting `container-type: inline-size` on cards and using `@container` instead of `@media` for card-internal layouts is trivial when writing new CSS — but painful to retrofit. | **INCLUDE in core redesign.** Define container context on cards. Use `@container` for card-internal breakpoints. |
| **Dynamic sizing (clamp)** | **PARTIAL.** If we define spacing and font sizes now without `clamp()`, every value gets touched again later. | **HIGH.** When writing new `gap`, `padding`, `font-size` rules, applying `clamp(min, preferred, max)` is one extra step. Retrofitting later means touching every rule twice. | **INCLUDE in core redesign.** Apply `clamp()` to spacing and font sizes as new rules are written. |
| **Light-dark all colors** | **NO direct dependency.** Just 3 variables in `variables.css` need wrapping. | **HIGH.** It's 3 lines of change. | **INCLUDE in core redesign.** Fix the 3 accent color variables. Trivial effort. |
| **Focus modes (:focus-within, :has)** | **LOW.** This layers on top of any layout. Independent of grid structure. | **LOW.** Pure UX enhancement. No efficiency loss from deferring. | **ROADMAP.** No dependency, no efficiency gain. Do after redesign is stable. |
| **Progressive disclosure (collapse/expand)** | **PARTIAL.** Card-in-card should support collapsing (like cards do). The grid layout needs `auto` rows that can collapse to 0. | **MEDIUM.** If card-in-card inherits the card collapse pattern, it's one CSS rule. | **INCLUDE basic mechanism** (card-in-card supports collapse). Defer advanced progressive disclosure (dimming, focusing) to ROADMAP. |

**Summary:** Include container queries, `clamp()`, light-dark fix, and basic card-in-card collapse in the core redesign. Defer focus modes and advanced progressive disclosure to roadmap.

---

## f. Risks + Mitigation

| Risk | Likelihood | Impact | Mitigation |
|:---|:---|:---|:---|
| **Regression in functionality** — touching all card JS files | High | High | Structural redesign first (CSS + grid framework), then update JS card-by-card. Test core functionality (prompt generation, state management) after each card. |
| **Scope creep** — roadmap items bleeding into core | High | Medium | Hard boundary: core redesign = grid layout + standardized classes + container queries + clamp(). Focus modes and advanced disclosure = separate PRs. |
| **"Big bang" breaks everything** | Medium | High | Mitigate by doing CSS quick wins first (reducing blast radius), then structural changes. Use feature branch. PO visual review before merge. |
| **Test maintenance** | Medium | Medium | Simplify tests alongside (see testing strategy). Don't maintain 432 tests through a redesign. |
| **Inconsistent look during work** | Medium | Low | Expected during beta. Feature branch isolates from users. |

---

## g. Impact / Effort

| Phase | What | Impact | Effort | Dependencies |
|:---|:---|:---|:---|:---|
| **0. Quick wins** | CSS consolidation: merge near-duplicate pills, extract shared flex patterns, extract shared surface pattern | Medium | Low (CSS-only) | None |
| **1. Framework** | Define new CSS grid classes (body, card, card-in-card, input, output, btn-*). Container queries on cards. `clamp()` values. Fix accent light-dark. | High | Medium | Phase 0 |
| **2. Apply structurally** | Update HTML skeleton + all card JS files to use new framework. Remove card-specific classes. Flatten DOM. | High | High (majority of work) | Phase 1 |
| **3. Pattern cleanup** | Standardize remaining patterns (field-picker, tags, icons). Remove old CSS. | Medium | Medium | Phase 2 |
| **4. Test simplification** | Reduce to ~200-250 focused tests. Remove DOM-structure tests. | Medium | Medium | Phase 2-3 |
| **Separate: Repos → pickers** | Convert repo/branch grids to field-picker pattern | Low-Medium | Medium | Phase 1 (needs field-picker class), no conflict with grid layout |
| **Roadmap: Focus modes** | `:focus-within` / `:has()` to dim non-active cards | Medium | Low-Medium | Phase 2 complete |
| **Roadmap: Progressive disclosure** | Advanced collapse/expand beyond basic card-in-card | Medium | Medium | Phase 2 complete |

---

## h. Alternatives

**The PO has chosen: structural redesign with Strategy 1+3 approach.** For the record, alternatives considered:

| Alternative | Pros | Cons | Verdict |
|:---|:---|:---|:---|
| CSS-only refactor | Low risk, fast | Doesn't flatten DOM or remove card-specific classes | Insufficient — doesn't solve maintainability |
| Card-by-card | Low risk per card | Risks sub-optimizing per card instead of building a true framework | Rejected — correctly identified as the maintainability anti-pattern |
| Full big-bang | Clean end state | Max risk | Too risky without preparation |
| **Chosen: Quick wins → Framework → Structural application → Pattern cleanup** | Framework-first ensures consistency. Quick wins reduce blast radius. | More planning upfront | **Selected** |

---

## i. Implementation Strategy (1+3 Hybrid)

**Sequence:**

1. **CSS Quick Wins** (low risk, immediate value)
   - Merge near-duplicate pill classes (4 → 1 base + modifiers)
   - Extract shared flex-wrap utility (7 near-identical patterns)
   - Extract shared surface pattern (border/shadow/radius)
   - Fix accent color `light-dark()` gap (3 variables)
   - Fix `--shadow-inset-sm` undefined variable bug

2. **Define CSS Framework** (new classes, not yet applied)
   - Write the grid classes: body, card, card-in-card, input grid, output
   - Write btn-primary, btn-select, btn-action, btn-pill, btn-icon
   - Write tag, field-picker base
   - Set `container-type: inline-size` on cards
   - Apply `clamp()` to spacing and font values
   - Set max-width to 800px
   - Both old AND new classes coexist temporarily

3. **Apply Framework Structurally** (the "big" step)
   - Update HTML skeleton to use new grid classes
   - Update each card JS to use new classes and flatter DOM
   - Remove wrapper divs (dual-panel, panel-area, input-row, dropdown-wrapper)
   - This is where the old CSS gets deleted

4. **Pattern-by-Pattern Cleanup**
   - Sweep for any remaining card-specific classes
   - Standardize remaining one-offs
   - Verify class count target (<50 core)
   - Delete orphaned CSS

5. **Test Simplification** (alongside steps 3-4)
   - Replace DOM-structure tests with behavior tests
   - Remove low-value tests
   - Target ~200-250 tests

**Key principle (from PO):** We build the framework first, then cards conform to it. NOT the other way around. Each component sits in its grid; it should not matter which card it's in. This IS the maintainability fix.

---

## j. Open Items / Decisions Required

| # | Item | Status |
|:---|:---|:---|
| 1 | **btn-action vs btn-select merge → reach 4 button types?** PO: semantically muddier but simpler. Decide before Phase 2. | Open |
| 2 | **Input grid: fixed 20%/80% vs subgrid for flexibility?** If subgrid can keep labels consistent across cards while adapting to content, it's the best of both worlds. | Open — will prototype both |
| 3 | **Shimmer/loader/notifications: working?** PO hasn't seen them. Verify if functional before including in framework. If unused, remove. | Open — needs verification |
| 4 | **Test reduction target: ~200-250 acceptable?** PO confirmed desire for efficiency over coverage. | Approved in principle |

---

## k. Roadmap Items (No Dependency on Core Redesign)

| Item | Description | Can do after |
|:---|:---|:---|
| **Focus modes** | `:focus-within` + `:has()` to dim non-active cards | Phase 2 |
| **Advanced progressive disclosure** | Collapsing sections beyond basic card-in-card | Phase 2 |
| **Repos/branches → pickers** | Adopt field-picker pattern for repo and branch selection | Phase 1 (needs field-picker class) |

---

## l. Additional Observations

1. **`ALL_LENSES` is duplicated** in `card-tasks.js` (line 21) and `card-steps.js` (line 17). Should be extracted to a shared constant. Quick fix, independent of redesign.

2. **`--shadow-inset-sm`** is referenced in CSS (line 470, `.input-field`) but NOT defined in `variables.css`. Existing bug.

3. **An ASCII wireframe** of the Grid structure for each card would communicate the redesign better than a table. Recommend creating one before Phase 2 starts.

4. **Meter has 10 classes and ~200 lines for a bar + label + tooltip.** PO correctly flags this as over-engineered. During Phase 3, reduce to standard output-styling + btn-icon + a few special rules.
