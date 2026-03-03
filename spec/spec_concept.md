# Specification

Single-page web app that fetches GitHub repo data, lets users configure agentic LLM tasks via guided flows, and outputs a structured Claude-optimized prompt copyable in one click.

---

## GL — Global Constraints

- GL-01 Design principles: minimize clicks (target ≤2 for any action), prefer selection over typing where possible.
- GL-02 Use universal shimmer-bar skeleton with contextual loading label while data loads. Empty data states show brief contextual message, not a blank area.
- GL-03 Mobile-first responsive design: every interaction works on a phone screen without horizontal scrolling.
- GL-04 Inline error feedback (no blocking modals). Dismissible. User can correct input and manually retry.
- GL-05 Eager/background loading for all GitHub fetches. Cache in `localStorage`; show instantly on revisit. Background fetch retrieves fresh data → shows brief "Updated" indicator → re-renders once (deferred if mid-interaction). No silent replacement of active views.

---

## APP — Application Architecture

- APP-01: SPA; fully client-side. Direct GitHub API calls. Single-repo scope per prompt; single-user.
- APP-02: Vanilla JS, ES modules, plain CSS.
- APP-03: Main target group: <300 files/repo, <15 repos/user. Full file tree eager loading permitted.
- APP-04: Persist PAT/username in `localStorage`. Repo/branch/prefs reset per session. Cached repo data (file tree, branches) persists across sessions.

---

## DM — Canonical Data Model

All UI cards read and write a single shared state object (`prompt_input`). This is the single source of truth for prompt generation.

### DM-INV — Data Model Invariants

- DM-INV-01 Outputs are derived only from current `prompt_input` — never cached or stale fragments.
- DM-INV-02 Outputs always reflect the latest `prompt_input`. All mutations go through a centralized state setter (Proxy wrapper or `setState()`) that auto-triggers prompt rebuild — no manual rebuild calls needed.
- DM-INV-03 Identical `prompt_input` always produces identical prompt text (deterministic output).

### DM-DEF — Defaults & Merge Strategy

- DM-DEF-01 Defaults use two-layer merge: **flow defaults → user overrides**. User changes override flow defaults in-place. No base-defaults layer, no field provenance tracking. Each flow defines its own complete defaults.
- DM-DEF-02 `flows.yaml` is the single source of truth for flow definitions (field configuration, step templates, lenses, params). Converted to JSON at build time via Vite plugin with schema validation. Runtime imports pre-validated JSON. Build fails with clear error on invalid schema.
- DM-DEF-03 Flow selection always fully resets `panel_a`, `panel_b`, `steps.enabled_steps`, and `improve_scope` to the flow's defaults. No user overrides are carried across flow switches.

---

## UJ — User Journey

This is the single source of truth for **what happens when**. Card sections below define content and layout only.

| Event                      | UI State                                             | Data Change                                          |
| -------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Page load                  | Config card expanded; all others collapsed           | Load PAT + owner from localStorage                   |
| Repo selected              | Expand Task card                                     | Set `configuration.repo`; fetch branches + file tree |
| Branch selected            | —                                                    | Set `configuration.branch`                           |
| Flow selected              | Expand Task fields + Steps + Prompt; collapse Config | Set `task.flow_id`; load default steps from flow     |
| Panel A field changed      | Quality meter updates; steps update                  | Update `panel_a.*`; add/remove conditional steps     |
| Panel B field changed      | Quality meter updates; steps update                  | Update `panel_b.*`; add/remove conditional steps     |
| Step lens toggled          | Prompt preview updates                               | Update `steps.enabled_steps[n].lenses`               |
| Step removed               | Step disappears; prompt updates                      | Remove from `steps.enabled_steps`                    |
| Improve: 2+ files selected | Scope selector appears                               | —                                                    |
| Scope selected             | Steps update with scope instruction                  | Set `improve_scope`                                  |
| Any `prompt_input` change  | Prompt preview updates                               | Rebuild prompt (DM-INV-02)                           |
| Copy clicked               | "Copied!" feedback                                   | Copy prompt to clipboard                             |

---

## Layout

Vertical stack of 4 collapsible cards. Auto-expand based on progression. Config card auto-collapses on repo/flow select. Re-opened Config auto-collapses on next trigger. Other cards require manual close.

### Card 1 — Configuration `CFG`

Authentication and target selection.

- CFG-01 PAT input is a password field with show/hide toggle. A "Clear" action lets the user remove the stored PAT. PAT is persisted in localStorage.
- CFG-02 GitHub username input is pre-filled from localStorage. On page load, repositories are automatically fetched.
- CFG-03 Repository buttons are displayed as a scrollable, wrapping button grid so the user can select one with a single tap.
- CFG-04 On repo selection, branch buttons appear (pre-loaded in background per GL-06). The default branch is auto-selected.
- CFG-05 Repo selection triggers eager background load of branches and full recursive file tree. PRs/issues fetched on-demand per flow.

### Card 2 — Task `SCT`

Define the task using a dual-panel layout: **Situation** (what exists) → **Target** (what's needed).

- SCT-01 Files selected in Panel A are flagged in the prompt for the LLM to "read upfront."
- SCT-02 The app presents 4 predefined flows:
  1. **Debug** — identify and resolve issues by capturing current state vs expected outcome.
  2. **Review** — examine PRs, code, or documents against specified criteria and lenses.
  3. **Implement** — create something new from requirements, description, and/or acceptance criteria.
  4. **Improve** — enhance or refine existing work with configurable focus lenses.
- SCT-03 Flows are displayed as a button grid with icon and title per button, fitting multiple buttons per row.
- SCT-04 Flow selection shows a dual-panel layout (left/right on desktop, stacked on mobile). Each panel has a generic label ("Situation" / "Target") plus a flow-specific subtitle. Fields within each panel are flow-specific (defined in flows.yaml). Examples: "Fix / Debug" Situation panel shows description field + issue picker + location file picker; Target panel shows expected behavior field + spec file picker + guideline file picker. "Review / Analyze" Situation panel shows context field + PR picker + file picker. See `spec/hybrid-framework-design.md` for full field mapping per flow.
- SCT-05 Where a flow requires mandatory user input, the field is clearly marked as required. Required group logic: at least one field in a required group must be filled (e.g., description OR issue for Fix/Debug).
- SCT-06 Pre-fillable options use flat searchable dropdowns. File pickers: flat alphabetical list. PR/issue pickers: #number — title. Spec/guideline file pickers use tooltip helper text to clarify the distinction (specs = WHAT to build, guidelines = HOW to build).
- SCT-07 Flow field definitions and step templates in flows.yaml. Spec defines field types and step data model. See `spec/hybrid-framework-design.md` for full flows.yaml structure.
- SCT-08 Quality Meter: a thin horizontal bar below the flow selector showing prompt completeness. Color transitions at 4 thresholds (red/orange/yellow/green). Score = filled field weights / total possible weights for the active flow. Updates in real-time.
- SCT-09 Improve/Modify flow: when 2+ files are selected in Panel A, a scope selector appears: "Each file separately" vs "Across files together". This affects the prompt instructions.

### Card 3 — Steps `STP`

Purpose: Fine-tuning of auto-generated steps.

- STP-01 Steps are auto-generated when a flow is selected and updated dynamically as the user fills Panel A/B fields. Steps appear as an ordered list. Each step can be deleted with a single tap (trash icon).
- STP-02 Data model minimums: 1× operation, 1× object. Optional: lenses, params. Steps with a `source` field in flows.yaml are conditional — they appear only when the referenced field is filled (e.g., "Read issue #N" appears only when an issue is selected).
- STP-03 Lenses display as pre-selected pills (based on flow defaults). Users can toggle any lens on/off per step.
- STP-04 The user can remove any step. Steps cannot be reordered or manually added.

### Card 4 — Prompt `OUT`

Purpose: Final output and extraction.

- OUT-01 The generated prompt is structured using XML tags. It opens with repo context, then a flow-specific `<task>` section (with Panel A/B content), then a `<todo>` step list.
- OUT-02 Prompt format varies per flow. Each flow has a `<task flow="...">` section with flow-specific XML tags for Panel A and Panel B content, followed by a `<todo>` step list. Example (Fix/Debug flow):

See `spec/hybrid-framework-design.md` for prompt templates for all 4 flows.

- OUT-03 The prompt is plain text, fully regenerated from current `prompt_input` each time any field changes. Deterministic output per DM-INV-03.
- OUT-04 File reference example: `@src/utils/auth.js`.
- OUT-05 A "Copy" button copies the full prompt to clipboard — this is the primary output action.
- OUT-06 An optional free-text field below the prompt preview lets the user append human notes (included in `<notes>` tags, stored in `notes.user_text`).
- OUT-07 A "Prompt Claude" button deep-links to `https://claude.ai/new?q=<encoded-prompt>`, opening Claude in a new tab with the prompt pre-filled in the chat input.
- OUT-08 Card 4 never auto-collapses. Once visible (after flow selection), it remains visible, except if user manually collapses it.

---

## VIS — Visual Design & Interaction

### Theme: Arctic Bone × Vellum

### Layout Rules

- VIS-01 Each selectable option (repo, branch, flow button) displays icon and title on a single row — never stacked vertically. Buttons use a wrapping grid.
- VIS-02 Task/flow buttons and input selectors sit within comfortable thumb/scroll reach.
- VIS-03 Minimum 2 open + 2 collapsed cards visible in viewport. Keep headers/titles/descriptions short (ask PO if unsure). Reduce vertical footprint via: explanatory text on hover or via info icon; inline labels; multiple fields per row; smart accordion design; minimal vertical padding (e.g., stacked step bars); small font for non-essential info; colors/borders/bevels instead of gaps. After selection, hide other options behind "show more" button. Truncate long names with full title on hover.

---

## TST — Test Criteria

Each requirement above is its own acceptance test. The following tests add specific methodology beyond their parent requirement:

- TST-01 Prompt determinism: identical `prompt_input` always produces identical prompt text (snapshot test).
- TST-02 End-to-end: repo select → flow select → flow input → step adjust → copied prompt matches expected output for fixed inputs.
- TST-03 `flows.yaml` schema validation: malformed flow file causes the build to fail with a clear error message.

---

## Status

### Legend

**Lifecycle statuses**

| Status      | Meaning                                            | Moved by    |
| ----------- | -------------------------------------------------- | ----------- |
| To start    | Not yet started                                    | —           |
| In progress | Implementation actively underway                   | Claude Code |
| Testing     | Code complete, testing in progress                 | Claude Code |
| 🏁 Approved | PO reviewed and signed off                         | PO only     |
| 🚫 Blocked  | Waiting on dependency, decision, or external input | Anyone      |

**Test columns** — tracked independently per requirement. Not all requirements need all test types.

| Icon | Meaning                  |
| ---- | ------------------------ |
| —    | N/A for this requirement |
| ◻    | Applicable, not yet run  |
| ❌   | Failed                   |
| ✅   | Passed                   |

### Implementation Status

| ID        | Status      | Unit | SIT | UAT | Notes                                                                    |
| --------- | ----------- | ---- | --- | --- | ------------------------------------------------------------------------ |
| GL-01     | Testing     | —    | ◻   | ◻   | Phase 8: click audit passed — all actions ≤2 clicks                      |
| GL-02     | Testing     | ✅   | ◻   | ◻   | Phase 0: shimmer CSS. Phase 3: JS component done                         |
| GL-03     | 🏁 Approved | —    | ◻   | ◻   | Phase 8: mobile-first CSS verified; no h-scroll                          |
| GL-04     | Testing     | ✅   | ◻   | ◻   | Phase 0: error CSS. Phase 3: JS component done                           |
| GL-05     | Testing     | ✅   | ◻   | ◻   | Phase 8: mid-interaction deferral added (retry ×5 every 2s)              |
| APP-01    | Testing     | —    | —   | ◻   | Phase 0: SPA shell created                                               |
| APP-02    | 🏁 Approved | —    | —   | ◻   | Phase 0: vanilla JS + plain CSS                                          |
| APP-03    | Testing     | ✅   | ◻   | ◻   | Phase 3: limit enforcement in github-api.js                              |
| APP-04    | Testing     | ✅   | —   | ◻   | PAT/owner persist; session resets on reload                              |
| DM-INV-01 | Testing     | ✅   | ◻   | —   | getState() returns derived prompt                                        |
| DM-INV-02 | Testing     | ✅   | ◻   | —   | setState() auto-rebuilds prompt                                          |
| DM-INV-03 | Testing     | ✅   | ◻   | —   | Snapshot test passes (TST-01)                                            |
| DM-DEF-01 | Testing     | ✅   | ◻   | —   | deepMerge for flow defaults → user overrides                             |
| DM-DEF-02 | Testing     | ✅   | —   | —   | YAML→JSON + schema validation via Vite plugin                            |
| DM-DEF-03 | Testing     | ✅   | ◻   | ◻   | applyFlowDefaults() resets panels/steps fully                            |
| CFG-01    | Testing     | ✅   | ◻   | ◻   | PAT field + show/hide + clear action                                     |
| CFG-02    | 🏁 Approved | ✅   | ◻   | ◻   | Username + auto-fetch repos on load                                      |
| CFG-03    | 🏁 Approved | ✅   | —   | ◻   | Repo button grid + single-tap select                                     |
| CFG-04    | 🏁 Approved | ✅   | ◻   | ◻   | Branch buttons + auto-select default                                     |
| CFG-05    | 🏁 Approved | ✅   | ◻   | ◻   | Background fetch branches + file tree                                    |
| SCT-01    | Testing     | ✅   | ◻   | ◻   | Flow selector grid (4 flows) + unified `.icon` class (Phase 12)          |
| SCT-02    | Testing     | ✅   | —   | ◻   | Dual-panel layout (new)                                                  |
| SCT-03    | 🏁 Approved | ✅   | ◻   | ◻   | card-tasks.js renders all field types                                    |
| SCT-04    | 🏁 Approved | ✅   | —   | ◻   | Panel A/B layout per flow definition                                     |
| SCT-05    | Testing     | ✅   | ◻   | ◻   | Required group dot (7px) + tooltip; error block removed (Phase 12)       |
| SCT-06    | 🏁 Approved | ✅   | ◻   | ◻   | Flat searchable file picker with pills                                   |
| SCT-07    | Testing     | ✅   | —   | —   | flows.yaml validated at build-time                                       |
| SCT-08    | 🏁 Approved | ✅   | ◻   | ◻   | Quality Meter                                                            |
| SCT-09    | 🏁 Approved | ✅   | ◻   | ◻   | Improve multi-file scope selector                                        |
| STP-01    | Testing     | ✅   | ◻   | ◻   | Phase 13: step badge, object icons, file step consolidation              |
| STP-02    | Testing     | ✅   | —   | ◻   | Phase 13: params.files populated from panel data                         |
| STP-03    | Testing     | ✅   | ◻   | ◻   | Phase 13: lens stability via module-level Map; expanded state persists   |
| STP-04    | Testing     | ✅   | —   | ◻   | Phase 13: file pill removal (panel + step); output mode multi-select     |
| OUT-01    | Testing     | ✅   | ◻   | ◻   | Phase 13: prompt-builder handles params.files + outputs_selected array   |
| OUT-02    | 🏁 Approved | ✅   | ◻   | ◻   | Phase 13: multi-mode feedback combines all selected output modes         |
| OUT-03    | Testing     | ✅   | ◻   | —   | Live re-render via state subscription                                    |
| OUT-04    | 🏁 Approved | ✅   | —   | —   | @ prefix in prompt-builder.js                                            |
| OUT-05    | Testing     | ✅   | ◻   | ◻   | Phase 14: copy icon swap (clipboard→check), aria-live kept hidden        |
| OUT-06    | 🏁 Approved | ✅   | —   | ◻   | Phase 14: notes textarea (no change)                                     |
| OUT-07    | 🏁 Approved | ✅   | —   | ◻   | Phase 14: Prompt Claude solid-accent primary button                      |
| OUT-08    | 🏁 Approved | —    | ◻   | ◻   | Phase 14: card stays expanded; only manual collapse                      |
| VIS-01    | Testing     | —    | —   | ◻   | Phase 12: unified icon rule, panel accent border, · subtitle separator   |
| VIS-02    | Testing     | —    | —   | ◻   | Phase 0: touch targets set                                               |
| VIS-03    | Testing     | —    | —   | ◻   | Phase 0: card layout CSS done                                            |
| TST-01    | 🏁 Approved | ✅   | ✅  | —   | Snapshot test in prompt-builder.test.js + e2e determinism test           |
| TST-02    | 🏁 Approved | ✅   | ✅  | —   | E2e tests: Fix + Review journeys, card transitions, flow reset, PAT flow |
| TST-03    | 🏁 Approved | ✅   | —   | —   | Schema validation errors tested in flow-loader                           |

---

## Decisions

| ID  | Decision                                                                                                                                                                    | Rationale                                                                                                      | Rating |
| :-- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :----- |
| D01 | GitHub Pages hosting and doc-based status tracking in spec_concept.md.                                                                                                      | Free, auto-deploying single source of truth.                                                                   | 2      |
| D02 | Root cleanup; separated build configs (config/) from specification files (spec/) and guidelines.                                                                            | Separates build logic from project definitions.                                                                | 3      |
| D03 | Selection flow moves from Task to Repo/Branch; grids collapse to summaries after selection.                                                                                 | Optimizes vertical space and improves UX flow.                                                                 | 3      |
| D04 | Deep-link to Claude.ai via URL-encoded query; includes 300px max-height preview with sticky toolbar.                                                                        | Hard requirement; ensures compact, actionable prompt transfer.                                                 | 5      |
| D05 | UI uses .card--open toggles, color-mix() backgrounds, and tight vertical spacing.                                                                                           | Simple CSS-driven patterns reduce JS overhead.                                                                 | 2      |
| D06 | Centralized setState() with derived frozen prompts and interaction-aware background retry logic.                                                                            | Safer, debuggable state management; prevents UI jitter.                                                        | 4      |
| D07 | Redesigned 4 core flows with dual-panels, auto-generated steps, and flow-specific XML prompt templates.                                                                     | Balances complexity with high-quality context-aware instructions.                                              | 5      |
| D08 | Quality Meter uses 6 color thresholds and weighted fields from hybrid design.                                                                                               | Finer feedback granularity without over-engineering.                                                           | 3      |
| D09 | Custom Vite YAML-to-JSON plugin with path-specific functional schema validation.                                                                                            | Seamless HMR integration; avoids heavy external dependencies.                                                  | 4      |
| D10 | Data model uses panel A/B structure, versioning, and arrays to track deletions.                                                                                             | Aligns with canonical spec; ensures state persistence.                                                         | 4      |
| D11 | Inlined Octicon SVG paths and 44px primary touch targets.                                                                                                                   | Improves mobile accessibility without external libraries.                                                      | 2      |
| D12 | Flat searchable file list, sub-label context hints, and lens pill "+N more" toggle.                                                                                         | Simplified mobile UX; keeps controls compact.                                                                  | 3      |
| D13 | All steps made deletable; no locked steps permitted.                                                                                                                        | Prioritizes user control and code simplicity.                                                                  | 3      |
| D14 | UAT fixes: merged credential rows, icon-only buttons, 4-per-row grid, and distinct panel backgrounds.                                                                       | Addresses all stakeholder visual feedback and layout.                                                          | 4      |
| D15 | E2E testing covers 2 representative flows using inline snapshots.                                                                                                           | Sufficient coverage while minimizing maintenance overhead.                                                     | 4      |
| D16 | Phase 12: Panels share same background; Panel A distinguished by 3px left accent border instead of color difference.                                                        | PO preference for same color; accent border is minimal and clear.                                              | 3      |
| D17 | Phase 12: Required group indicator uses enlarged 7px dot with native tooltip; no alert icon, no full-width error block.                                                     | PO chose simplest approach — dot + hover tooltip is sufficient.                                                | 2      |
| D18 | Phase 13: Module-level `expandedSteps = new Map()` for lens stability across re-renders; cleared on flow switch and card init.                                              | Persist state between state-driven re-renders without extra state fields; cleared on init prevents test bleed. | 3      |
| D19 | Phase 13: File pill removal removes from panel field (panel + step), not tracked per-step. Last file removed = conditional step auto-excluded via `isSourceFilled()`.       | Simpler than per-step tracking; cascades correctly via existing regeneration logic.                            | 4      |
| D20 | Phase 13: `outputs_selected: string[]` replaces `output_selected: string`; `reconcileSteps()` migrates legacy format on load.                                               | Multi-select requires array; migration prevents breaking existing saved state.                                 | 4      |
| D21 | Phase 13: Multi-mode feedback prompt combines all selected delivery methods into one sentence with AND separator + mode-specific bullets.                                   | PO chose combined instruction over separate paragraphs; reduces prompt redundancy.                             | 3      |
| D22 | Phase 14: Copy button uses pre-rendered clipboard+check SVGs with `.btn--copied` class toggle; no JS DOM manipulation. aria-live span kept but visually hidden (.sr-only).  | Spec required no text span; screen reader support preserved via hidden aria-live.                              | 3      |
| D23 | Phase 14: XML highlighting via two-step `highlightXml()`: escape all HTML first, then regex-wrap escaped tag patterns in spans. Uses innerHTML on `<pre>`.                  | Security-first: all text escaped before injection; textContent round-trip verified in tests.                   | 4      |
| D24 | Phase 14: Quality meter tooltip appended to `labelEl` returned by `renderQualityMeter()`; quality-meter.js uses child `<span>` for text so tooltip button survives updates. | Avoids overwriting child elements on label update; keeps tooltip logic in card-prompt.js.                      | 3      |
| D25 | Phase 14: Tooltip content is a brief plain-language description (not weights/thresholds). PO chose "rough explanation of how it works" over numeric scoring details.        | Simpler, friendlier for non-technical users; numeric weights were confusing without context.                   | 3      |
| D26 | Redesign Phase 1: New CSS framework (layout.css, components.css, special.css) + ui.js factory coexist with old styles.css via `v2-` prefix. No old classes modified.        | Allows incremental migration card-by-card without big-bang. v2- prefix prevents collisions during coexistence. | 4      |
| D27 | Redesign Phase 1: `clamp()` applied to spacing/font variables for responsive sizing; `container-type: inline-size` on v2-card for container queries.                        | Framework-first: building responsive primitives now avoids retrofitting later. Per redesign plan section e.    | 4      |
| D28 | Redesign Phase 1: Accent colors wrapped in `light-dark()`; `--shadow-inset-sm` defined; `--bg-inset-darker` added.                                                          | Fixes 3 existing bugs/gaps identified in redesign review (sections c, m). Trivial effort, high value.          | 2      |
