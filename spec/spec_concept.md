# Implementation Specification

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
- APP-03: Limits: <300 files/repo, <15 repos/user. Full file tree eager loading permitted.
- APP-04: Persist PAT/username in `localStorage`. Repo/branch/prefs reset per session. Cached repo data (file tree, branches) persists across sessions.

---

## DM — Canonical Data Model

All UI cards read and write a single shared state object (`prompt_input`). This is the single source of truth for prompt generation.

```
prompt_input (JSON-serializable, snake_case):

  version: str,                    // schema version, e.g., "1.0" — enables migration

  configuration: {
    owner: str,              // GitHub username
    repo: str,               // selected repository name
    branch: str,             // selected branch
    pat: str                 // GitHub personal access token
  }

  task: {
    flow_id: str             // "fix" | "review" | "implement" | "improve"
  }

  panel_a: {                 // "Situation" panel — what exists / what to examine
    description: str,        // free-text description
    issue_number: int|null,  // GitHub issue selector (fix, improve flows)
    pr_number: int|null,     // GitHub PR selector (review flow only)
    files: [path]            // file picker: location / supporting / starting files
  }

  panel_b: {                 // "Target" panel — desired outcome / criteria
    description: str,        // free-text desired outcome / build spec
    issue_number: int|null,  // GitHub issue (improve flow — desired state)
    spec_files: [path],      // specification/requirement documents
    guideline_files: [path], // style guides, coding standards
    acceptance_criteria: str, // how to know it's done (implement flow)
    lenses: [str]            // focus lenses (review / improve flows)
  }

  steps: {
    enabled_steps: [{        // auto-generated from flow, user can fine-tune
      id: str,
      operation: str,        // e.g., read, create, edit, commit, analyze, validate
      object: str,           // e.g., file, branch, PR, issue, tests
      lenses: [str],         // user-adjustable focus lenses per step
      params: {}             // step-specific parameters
    }]
  }

  improve_scope: str|null,   // "each_file" | "across_files" (improve flow, 2+ files)

  notes: {
    user_text: str                  // optional free-text appended to prompt
  }

  output: {
    destination: 'clipboard'
  }
```

### Field Validation per Flow

| Field                         | Fix/Debug  | Review/Analyze | Implement/Build |         Improve/Modify          |
| ----------------------------- | :--------: | :------------: | :-------------: | :-----------------------------: |
| **Panel A (Situation)**       |            |                |                 |                                 |
| `panel_a.description`         | Required\* |    Optional    |    Optional     |           Required\*            |
| `panel_a.issue_number`        | Required\* |       —        |        —        |           Required\*            |
| `panel_a.pr_number`           |     —      |  Required\*\*  |        —        |                —                |
| `panel_a.files`               |  Optional  |  Required\*\*  |    Optional     |            Optional             |
| **Panel B (Target)**          |            |                |                 |                                 |
| `panel_b.description`         |  Optional  |       —        |    Required     |            Optional             |
| `panel_b.issue_number`        |     —      |       —        |        —        |            Optional             |
| `panel_b.spec_files`          |  Optional  |    Optional    |    Optional     |                —                |
| `panel_b.guideline_files`     |  Optional  |    Optional    |        —        | Optional (as "reference files") |
| `panel_b.acceptance_criteria` |     —      |       —        |    Optional     |                —                |
| `panel_b.lenses`              |     —      |    Optional    |        —        |            Optional             |
| **Other**                     |            |                |                 |                                 |
| `improve_scope`               |     —      |       —        |        —        |       Shown when 2+ files       |

`\*` = At least one field marked `*` in Panel A must be filled (description OR issue_number).
`\*\*` = Review flow: at least one of PR or files required. Either or both can be filled.

### State Migration

When `version` field is missing or older than current, apply migration:

```javascript
function migrateState(state) {
  const CURRENT_VERSION = "1.0";

  if (!state.version) {
    // v0 (legacy) → v1.0 migration
    // Old structure had context.selected_files
    // New structure uses panel_a.files
    state = {
      version: CURRENT_VERSION,
      configuration: state.configuration || {},
      task: state.task || {},
      panel_a: {
        description: "",
        issue_number: null,
        pr_number: null,
        files: state.context?.selected_files || [],
      },
      panel_b: {
        description: "",
        issue_number: null,
        spec_files: [],
        guideline_files: [],
        acceptance_criteria: "",
        lenses: [],
      },
      steps: state.steps || { enabled_steps: [] },
      improve_scope: null,
      notes: state.notes || { user_text: "" },
      output: { destination: "clipboard" },
    };
    // Clear old context field
    delete state.context;
  }

  return state;
}
```

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
  1. **Fix / Debug** — identify and resolve issues by capturing current state vs expected outcome.
  2. **Review / Analyze** — examine PRs, code, or documents against specified criteria and lenses.
  3. **Implement / Build** — create something new from requirements, description, and/or acceptance criteria.
  4. **Improve / Modify** — enhance or refine existing work with configurable focus lenses.
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

```xml
<prompt>
  <context>
    Execute the following task for <repository> https://github.com/{{owner}}/{{repo}} </repository> on <branch> {{branch}} </branch>.
    Authenticate using PAT: <PAT> {{pat}} </PAT>.
  </context>
  <task flow="fix">
    <current_state>
      [Panel A: description, issue reference, location files]
    </current_state>
    <expected_outcome>
      [Panel B: expected behavior, spec files, guideline files]
    </expected_outcome>
  </task>
  <todo>
    Step 1: Read: @claude.md
    Step 2: Read: @src/utils/auth.js
    Step 3: Read issue #42
    Step 4: Identify root cause — focus on [error_handling, semantics]
    Step 5: Create new branch
    Step 6: Implement fix — focus on [error_handling, semantics]
    Step 7: Run tests
    Step 8: Commit changes and open PR
  </todo>
</prompt>
<notes>{{user_text}}</notes>
```

See `spec/hybrid-framework-design.md` for prompt templates for all 4 flows.

- OUT-03 The prompt is plain text, fully regenerated from current `prompt_input` each time any field changes. Deterministic output per DM-INV-03.
- OUT-04 File reference example: `@src/utils/auth.js`.
- OUT-05 A "Copy" button copies the full prompt to clipboard — this is the primary output action.
- OUT-06 An optional free-text field below the prompt preview lets the user append human notes (included in `<notes>` tags, stored in `notes.user_text`).
- OUT-07 An "Prompt Claude" button opens deeplink to claude.ai and pastes prompt in claude chat.
- OUT-08 Card 4 never auto-collapses. Once visible (after flow selection), it remains visible, except if user manually collapses it.

---

## VIS — Visual Design & Interaction

### Theme: Arctic Bone × Vellum

Warm-shifted backgrounds with smoke and ivory treatments. The feel is a refined reading surface — like good paper under controlled light.

#### Color Tokens

| Token              | Value     | Usage                                                                                   |
| ------------------ | --------- | --------------------------------------------------------------------------------------- |
| `--shell`          | `#e8e6e1` | Page background. Smoke-grey, warm-shifted.                                              |
| `--surface`        | `#f7f3ed` | Card backgrounds. Warm linen.                                                           |
| `--surface-raised` | `#faf7f2` | Hovered cards, active inputs. Birch paper.                                              |
| `--surface-inset`  | `#eceae5` | Inset wells: code preview, prompt output area.                                          |
| `--text-primary`   | `#2c2926` | Body text. Near-black, warm.                                                            |
| `--text-secondary` | `#6b6560` | Labels, captions, placeholders.                                                         |
| `--text-tertiary`  | `#9a9490` | Disabled text, subtle hints.                                                            |
| `--border`         | `#d6d2cc` | Card borders, dividers.                                                                 |
| `--border-focus`   | `#a09a94` | Focused input borders.                                                                  |
| `--accent`         | `#42767a` | Active-state left-edge gutter bar, selected toggles, primary buttons. Muted steel-blue. |
| `--accent-hover`   | `#326a89` | Hover state for accent elements.                                                        |
| `--accent-subtle`  | `#aed1d4` | Accent background tint (selected items, active flow button).                            |
| `--danger`         | `#c2553a` | Error text, delete icon hover. Warm red.                                                |
| `--success`        | `#4a8c6f` | Success feedback. Muted green.                                                          |

#### Typography

| Token                | Value                                               |
| -------------------- | --------------------------------------------------- |
| `--font-body`        | `system-ui, -apple-system, sans-serif`              |
| `--font-mono`        | `"SF Mono", "Cascadia Code", "Consolas", monospace` |
| `--text-sm`          | `0.6875rem` (11px)                                  |
| `--text-base`        | `0.875rem` (14px)                                   |
| `--text-lg`          | `1.125rem` (18px)                                   |
| `--line-height-sm`   | `1`                                                 |
| `--line-height-base` | `1.2`                                               |
| `--line-height-lg`   | `1.4`                                               |

#### Spacing Scale

`--sp-1` through `--sp-6`: `2px, 4px, 8px, 12px, 16px, 24px`.

#### Component Treatments

- **Cards** use `--surface` (or none) with `1px` or no `--border`, `6px` border-radius. Card header uses `--text-primary` at `--text-base` weight 600.
- **Active/selected items** (selected repo, selected flow, selected branch) display a `3px` left-edge `--accent` bar — like a code editor gutter marker. Background shifts to `--accent-subtle`.
- **Buttons** (repo grid, flow grid, branch grid) use `--surface-raised` background, `--border`, and `--text-primary`. On hover: `--surface-raised` brightens slightly, border becomes `--border-focus`.
- **Toggles** use pill-shaped containers. Off state: `--surface` bg, `--text-secondary`. On state: `--accent-subtle` bg, `--accent` text, `--accent` border.
- **Prompt output area** uses `--surface-inset` with `--font-mono` at `--text-sm`. Left-aligned, no syntax highlighting.
- **Skeleton loading** Single reusable shimmer-bar class on `--surface-inset` with opacity pulse.

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

| ID        | Status      | Unit | SIT | UAT | Notes                                            |
| --------- | ----------- | ---- | --- | --- | ------------------------------------------------ |
| GL-01     | To start    | —    | ◻   | ◻   | Click audit — verified per card                  |
| GL-02     | Testing     | ✅   | ◻   | ◻   | Phase 0: shimmer CSS. Phase 3: JS component done |
| GL-03     | In progress | —    | ◻   | ◻   | Phase 0: foundation CSS done. Per-card Phase 4–7 |
| GL-04     | Testing     | ✅   | ◻   | ◻   | Phase 0: error CSS. Phase 3: JS component done   |
| GL-05     | Testing     | ✅   | ◻   | ◻   | Phase 3: cache + notification component done     |
| APP-01    | Testing     | —    | —   | ◻   | Phase 0: SPA shell created                       |
| APP-02    | Testing     | —    | —   | ◻   | Phase 0: vanilla JS + plain CSS                  |
| APP-03    | Testing     | ✅   | ◻   | ◻   | Phase 3: limit enforcement in github-api.js      |
| APP-04    | Testing     | ✅   | —   | ◻   | PAT/owner persist; session resets on reload      |
| DM-INV-01 | Testing     | ✅   | ◻   | —   | getState() returns derived prompt                |
| DM-INV-02 | Testing     | ✅   | ◻   | —   | setState() auto-rebuilds prompt                  |
| DM-INV-03 | Testing     | ✅   | ◻   | —   | Snapshot test passes (TST-01)                    |
| DM-DEF-01 | Testing     | ✅   | ◻   | —   | deepMerge for flow defaults → user overrides     |
| DM-DEF-02 | Testing     | ✅   | —   | —   | YAML→JSON + schema validation via Vite plugin    |
| DM-DEF-03 | Testing     | ✅   | ◻   | ◻   | applyFlowDefaults() resets panels/steps fully    |
| CFG-01    | Testing     | ✅   | ◻   | ◻   | PAT field + show/hide + clear action             |
| CFG-02    | Testing     | ✅   | ◻   | ◻   | Username + auto-fetch repos on load              |
| CFG-03    | Testing     | ✅   | —   | ◻   | Repo button grid + single-tap select             |
| CFG-04    | Testing     | ✅   | ◻   | ◻   | Branch buttons + auto-select default             |
| CFG-05    | Testing     | ✅   | ◻   | ◻   | Background fetch branches + file tree            |
| SCT-01    | To start    | ◻    | ◻   | ◻   |                                                  |
| SCT-02    | To start    | ◻    | —   | ◻   | Dual-panel layout (new)                          |
| SCT-03    | To start    | ◻    | ◻   | ◻   |                                                  |
| SCT-04    | To start    | ◻    | —   | ◻   |                                                  |
| SCT-05    | To start    | ◻    | ◻   | ◻   | Quality Meter (new)                              |
| SCT-06    | To start    | ◻    | ◻   | ◻   |                                                  |
| SCT-07    | Testing     | ✅   | —   | —   | flows.yaml validated at build-time               |
| SCT-08    | To start    | ◻    | ◻   | ◻   | Quality Meter                                    |
| SCT-09    | To start    | ◻    | ◻   | ◻   | Improve multi-file scope selector                |
| STP-01    | To start    | ◻    | ◻   | ◻   | Auto-generated steps + fine-tuning               |
| STP-02    | To start    | ◻    | —   | ◻   |                                                  |
| STP-03    | To start    | ◻    | ◻   | ◻   |                                                  |
| STP-04    | To start    | ◻    | —   | ◻   |                                                  |
| OUT-01    | To start    | ◻    | ◻   | ◻   |                                                  |
| OUT-02    | Testing     | ✅   | ◻   | ◻   | Flow-specific templates in prompt-builder.js     |
| OUT-03    | To start    | ◻    | ◻   | —   | Deterministic — DM-INV-03                        |
| OUT-04    | To start    | ◻    | —   | —   |                                                  |
| OUT-05    | To start    | ◻    | ◻   | ◻   |                                                  |
| OUT-06    | To start    | ◻    | —   | ◻   |                                                  |
| OUT-07    | To start    | —    | —   | ◻   | Opens claude.ai only                             |
| OUT-08    | To start    | —    | ◻   | ◻   | Behavioral constraint                            |
| VIS-01    | Testing     | —    | —   | ◻   | Phase 0: CSS grid layout done                    |
| VIS-02    | Testing     | —    | —   | ◻   | Phase 0: touch targets set                       |
| VIS-03    | Testing     | —    | —   | ◻   | Phase 0: card layout CSS done                    |
| TST-01    | Testing     | ✅   | ◻   | —   | Snapshot test in prompt-builder.test.js          |
| TST-02    | To start    | —    | ◻   | —   | E2e test                                         |
| TST-03    | Testing     | ✅   | —   | —   | Schema validation errors tested in flow-loader   |

---

## Decisions Log

| Date       | Decision                                                                                                                                                                                                                                                        | Rationale                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-20 | GitHub Pages for hosting                                                                                                                                                                                                                                        | Free for public repos, auto-deploys on merge, always-latest live URL                                                                                                             |
| 2026-02-20 | Status tracking in spec_concept.md                                                                                                                                                                                                                              | Avoids duplication. Status table + Decisions Log in the authoritative spec.                                                                                                      |
| 2026-02-21 | Tool configs moved to `config/`, spec files to `spec/`                                                                                                                                                                                                          | Cleaner root. `config/` = how to build. `spec/` = what to build.                                                                                                                 |
| 2026-02-24 | File/folder selection moved after task selection (optional, flow-dependent)                                                                                                                                                                                     | Clearer UX, simpler tree logic, more background loading time, less vertical space                                                                                                |
| 2026-02-24 | Deep link to claude.ai is hard requirement for first build                                                                                                                                                                                                      | Investigated and verified feasible, no backup needed                                                                                                                             |
| 2026-02-24 | Tightening UI requirements to ensure minimal vertical scrolling                                                                                                                                                                                                 | Clearer for user                                                                                                                                                                 |
| 2026-02-24 | Phase 0: `.card--open` class drives card body visibility; `aria-expanded` on button mirrors state                                                                                                                                                               | Simple toggle pattern; CSS class is set by JS in Phase 1. No redundant JS in Phase 0.                                                                                            |
| 2026-02-24 | Phase 0: `color-mix()` used for error/notification tinted backgrounds                                                                                                                                                                                           | Modern browsers only per spec; avoids adding extra color tokens for subtle tints.                                                                                                |
| 2026-02-24 | Phase 1: `setState()` over Proxy for centralized state                                                                                                                                                                                                          | Simpler, debuggable, array-safe. No deep Proxy wrapping needed.                                                                                                                  |
| 2026-02-24 | Phase 1: `_prompt` as derived field on frozen state snapshot                                                                                                                                                                                                    | Always in sync via auto-rebuild in `setState()`. Satisfies DM-INV-01/02.                                                                                                         |
| 2026-02-24 | Phase 1: jsdom test environment for state.js only; prompt-builder stays in node                                                                                                                                                                                 | State tests need `localStorage`; keeping node env for pure functions avoids overhead.                                                                                            |
| 2026-02-25 | Redesigned to 4 flows (Fix/Debug, Review/Analyze, Implement/Build, Improve/Modify) with dual-panel layout per flow (Situation + Target).                                                                                                                        | Balances coverage with simplicity (4 vs 6). Current/desired structure gives built-in verification across all flows                                                               |
| 2026-02-25 | Steps auto-generated from flow + user inputs (toggle lenses/remove steps). No auto-suggestion of files. No explicit fences/boundaries section.                                                                                                                  | Reduces effort while keeping fine-tuning. Risk of wrong file suggestions > none; Claude explores independently. Clear, specific prompts prevent drift (vagueness is root cause). |
| 2026-02-25 | Quality Meter Fixed field weights + 4 color thresholds.                                                                                                                                                                                                         | Motivates thoroughness without over-engineering. Simple scoring, no word counting.                                                                                               |
| 2026-02-25 | Improve flow scope selector: "each file" vs "across files".                                                                                                                                                                                                     | Makes LLM intent clear for multi-file improvements; affects prompt instruction.                                                                                                  |
| 2026-02-25 | Spec files (WHAT to build) vs Guideline files (HOW to build).                                                                                                                                                                                                   | Valuable separation; UX challenge – needs tooltip for clarity.                                                                                                                   |
| 2026-02-26 | Phase 2: Custom Vite plugin for YAML→JSON with schema validation, not a pre-build script.                                                                                                                                                                       | Cleaner integration with Vite dev server (HMR for flows.yaml). `transform` hook is straightforward for this use case.                                                            |
| 2026-02-26 | Phase 2: Functional schema validation over JSON Schema library.                                                                                                                                                                                                 | Custom validator gives clear, path-specific error messages. No extra dependency needed. Simpler than configuring ajv for nested YAML-anchor-expanded structures.                 |
| 2026-02-26 | Phase 2: state.js updated from `context.selected_files` to `panel_a`/`panel_b` data model.                                                                                                                                                                      | Aligns with spec canonical data model (DM). `version` field added for future migration. `applyFlowDefaults()` added for DM-DEF-03 flow switching.                                |
| 2026-02-26 | Phase 2: Flow-specific prompt templates in prompt-builder.js using switch on `flow_id`.                                                                                                                                                                         | Each flow gets its own XML template (fix→undesired/expected, review→subject/criteria, implement→context/requirements, improve→current/desired). Matches hybrid-framework-design. |
| 2026-02-26 | flows.yaml cleanup: fixed typos (`branche_name`→`branch_name`, `filed`→`field`), output modes as machine-readable YAML array, step lenses as arrays (not field defs), added lenses to review panel_b, conditional feedback steps, run_tests to improve flow.    | One-time PO-approved edit. Aligns YAML data format with runtime code expectations. Machine-readable output keys match prompt-builder constants.                                  |
| 2026-02-26 | Phase 3: Cache TTL 15 min, `ap_cache_` prefix, mobile-first dropdown (no keyboard nav), auto-replace + 2s toast for background refresh. ESLint test config updated to include browser globals for jsdom tests.                                                  | PO decisions: 15min balances freshness vs API calls; mobile-first dropdown drops desktop keyboard nav to simplify; auto-replace avoids extra user click.                         |
| 2026-02-26 | Phase 4: VIS-03 collapse-after-selection for repo/branch grids. After selecting a repo or branch, grid collapses to show only the selected item + "+N more" button. File tree stored in card-configuration.js with exported `getFileTree()` getter for Phase 5. | PO chose collapse pattern to save vertical space. Exported getter is simplest sharing mechanism; can refactor to shared module later if needed.                                  |
