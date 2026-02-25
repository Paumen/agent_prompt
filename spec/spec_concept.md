# Implementation Specification

Single-page web app that fetches GitHub repo data, lets users configure agentic LLM tasks via guided flows, and outputs a structured Claude-optimized prompt copyable in one click.

---

## GL — Global Constraints

- GL-01 Design principles: minimize clicks (target ≤2 for any action, except deep tree navigation), prefer selection over typing.
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
    flow_id: "fix" | "review" | "implement" | "improve"  // selected flow
  }

  panel_a: {                        // "Situation" panel
    description: str,               // free-text description of current state
    issue_number: int | null,       // GitHub issue selector
    pr_number: int | null,          // GitHub PR selector (review flow only)
    files: [path]                   // file picker: location / supporting / starting files
  }

  panel_b: {                        // "Target" panel
    description: str,               // free-text desired outcome / criteria / build spec
    issue_number: int | null,       // GitHub issue (improve flow — desired state from issue)
    spec_files: [path],             // specification/requirement documents
    guideline_files: [path],        // style guides, coding standards
    acceptance_criteria: str,       // how to know it's done (implement flow)
    lenses: [str]                   // focus lenses (review / improve flows)
  }

  steps: {
    enabled_steps: [{               // auto-generated from flow, user can fine-tune
      id: str,
      operation: str,               // e.g., read, create, edit, commit, analyze
      object: str,                  // e.g., file, branch, PR, issue, pull_request
      lenses: [str],                // user-adjustable focus lenses per step
      params: {}                    // step-specific parameters
    }]
  }

  improve_scope: "each_file" | "across_files" | null   // improve flow only: multi-file handling

  notes: {
    user_text: str                  // optional free-text appended to prompt
  }

  output: {
    destination: 'clipboard'
  }
```

### Field Validation per Flow

| Field                         |   Fix/Debug    | Review/Analyze | Implement/Build |         Improve/Modify          |
| ----------------------------- | :------------: | :------------: | :-------------: | :-----------------------------: |
| **Panel A (Situation)**       |                |                |                 |                                 |
| `panel_a.description`         |   Required\*   |    Optional    |    Optional     |           Required\*            |
| `panel_a.issue_number`        |   Required\*   |       —        |        —        |           Required\*            |
| `panel_a.pr_number`           |       —        |  Required\*\*  |        —        |                —                |
| `panel_a.files`               |    Optional    |  Required\*\*  |    Optional     |            Optional             |
| **Panel B (Target)**          |                |                |                 |                                 |
| `panel_b.description`         |    Optional    |       —        |    Required     |            Optional             |
| `panel_b.issue_number`        |       —        |       —        |        —        |            Optional             |
| `panel_b.spec_files`          |    Optional    |    Optional    |    Optional     |                —                |
| `panel_b.guideline_files`     |    Optional    |    Optional    |        —        | Optional (as "reference files") |
| `panel_b.acceptance_criteria` |       —        |       —        |    Optional     |                —                |
| `panel_b.lenses`              |       —        |    Optional    |        —        |            Optional             |
| **Other**                     |                |                |                 |                                 |
| `improve_scope`               |       —        |       —        |        —        |       Shown when 2+ files       |

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
        description: '',
        issue_number: null,
        pr_number: null,
        files: state.context?.selected_files || []
      },
      panel_b: {
        description: '',
        issue_number: null,
        spec_files: [],
        guideline_files: [],
        acceptance_criteria: '',
        lenses: []
      },
      steps: state.steps || { enabled_steps: [] },
      improve_scope: null,
      notes: state.notes || { user_text: '' },
      output: { destination: 'clipboard' }
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
- DM-DEF-02 `flows.yaml` is the single source of truth for flow definitions (metadata, steps, lenses, params). Converted to JSON at build time via Vite plugin with schema validation. Runtime imports pre-validated JSON. Build fails with clear error on invalid schema.
- DM-DEF-03 Flow selection always fully resets `steps.enabled_steps` and all step-level values to the flow's defaults. No user overrides are carried across flow switches. Steps are auto-generated from flow definition and updated as panel fields are filled.

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

### Card 2 — Task `SCT` (Dual-Panel Layout)

Define a high-level automation task using dual-panel layout (Situation → Target).

- SCT-01 Flow selector at top with 4 predefined flows displayed as a button grid:
  1. **Fix / Debug** — Bug, error, broken behavior.
  2. **Review / Analyze** — PR review, code analysis, audits.
  3. **Implement / Build** — New feature, new file, greenfield.
  4. **Improve / Modify** — Refactor, optimize, enhance.
- SCT-02 Dual-panel layout (left/right on desktop, stacked on mobile):
  - **Panel A (Situation)** — What's happening now / what exists
  - **Panel B (Target)** — Desired outcome / criteria
- SCT-03 Flow-specific fields render in each panel based on flow definition in `flows.yaml`. Required fields marked with indicator.
- SCT-04 Validation: "at least one of X or Y" for fields with `required_group`.
- SCT-05 Quality Meter appears below flow selector, showing prompt completeness via color-coded bar.
- SCT-06 Pre-fillable options (PR, issue, file pickers) use flat searchable dropdowns.
- SCT-07 Flow definitions in `flows.yaml` include panel field configuration and step templates.
- SCT-08 Multi-file scope selector (Improve flow only): "Each file separately" vs "Across files together".
- SCT-09 Steps auto-generated when flow selected; updated as panel fields are filled.

### Card 3 — Steps `STP`

Purpose: Fine-tune auto-generated steps.

- STP-01 Steps appear as an ordered list, auto-generated from flow definition. Each step can be deleted with a single tap (trash icon) except locked steps.
- STP-02 Locked steps (e.g., "Read @claude.md") cannot be removed and show visual indicator.
- STP-03 Lenses display as pre-selected pills (based on flow). Users can toggle any lens on/off or add custom lenses via free-text input.
- STP-04 Steps cannot be reordered or added manually — auto-generation keeps it simple.

### Card 4 — Prompt `OUT`

Purpose: Final output and extraction.

- OUT-01 The generated prompt is structured using XML tags with flow-specific `<task>` section.
- OUT-02 Prompt format varies by flow (see `hybrid-framework-design.md` for templates):

```xml
<prompt>
  <context>
    Execute the following task for <repository> https://github.com/{{owner}}/{{repo}} </repository>
    on <branch> {{branch}} </branch>.
    Authenticate using PAT: <PAT> {{pat}} </PAT>.
  </context>
  <task flow="{{flow_id}}">
    <current_state>
      {{panel_a.description}}
      {{#if issue}}Related issue: #{{issue_number}}{{/if}}
      {{#if files}}Location: {{files as @-prefixed list}}{{/if}}
    </current_state>
    <expected_outcome>
      {{panel_b.description}}
      {{#if spec_files}}Specifications: {{spec_files as @-prefixed list}}{{/if}}
    </expected_outcome>
  </task>
  <todo>
    Step 1: Read @claude.md
    Step 2: {{dynamic steps based on panel inputs}}
    ...
    Step N: Commit changes and open PR
  </todo>
</prompt>
<notes>{{user_text}}</notes>
```

- OUT-03 The prompt is plain text, fully regenerated from current `prompt_input` each time any field changes. Deterministic output per DM-INV-03.
- OUT-04 Files reference example: `@src/utils/auth.js`.
- OUT-05 A "Copy" button copies the full prompt to clipboard — this is the primary output action.
- OUT-06 An optional free-text field below the prompt preview lets the user append human notes (included in `<notes>` tags, stored in `notes.user_text`).
- OUT-07 An "Open in Claude" button opens claude.ai in a new tab (no prompt transfer — user copies first).
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
| GL-02     | In progress | ◻    | ◻   | ◻   | Phase 0: shimmer CSS done. JS component Phase 3  |
| GL-03     | In progress | —    | ◻   | ◻   | Phase 0: foundation CSS done. Per-card Phase 4–7 |
| GL-04     | In progress | ◻    | ◻   | ◻   | Phase 0: error CSS done. JS component Phase 3    |
| GL-05     | To start    | ◻    | ◻   | ◻   |                                                  |
| APP-01    | Testing     | —    | —   | ◻   | Phase 0: SPA shell created                       |
| APP-02    | Testing     | —    | —   | ◻   | Phase 0: vanilla JS + plain CSS                  |
| APP-03    | To start    | ◻    | ◻   | ◻   |                                                  |
| APP-04    | Testing     | ✅   | —   | ◻   | PAT/owner persist; session resets on reload      |
| DM-INV-01 | Testing     | ✅   | ◻   | —   | getState() returns derived prompt                |
| DM-INV-02 | Testing     | ✅   | ◻   | —   | setState() auto-rebuilds prompt                  |
| DM-INV-03 | Testing     | ✅   | ◻   | —   | Snapshot test passes (TST-01)                    |
| DM-DEF-01 | Testing     | ✅   | ◻   | —   | deepMerge for flow defaults → user overrides     |
| DM-DEF-02 | To start    | ◻    | —   | —   | Build-time validation                            |
| DM-DEF-03 | To start    | ◻    | ◻   | ◻   |                                                  |
| CFG-01    | To start    | ◻    | ◻   | ◻   |                                                  |
| CFG-02    | To start    | ◻    | ◻   | ◻   |                                                  |
| CFG-03    | To start    | ◻    | —   | ◻   |                                                  |
| CFG-04    | To start    | ◻    | ◻   | ◻   |                                                  |
| CFG-05    | To start    | ◻    | ◻   | ◻   |                                                  |
| SCT-01    | To start    | ◻    | ◻   | ◻   |                                                  |
| SCT-02    | To start    | ◻    | —   | ◻   | Dual-panel layout (new)                          |
| SCT-03    | To start    | ◻    | ◻   | ◻   |                                                  |
| SCT-04    | To start    | ◻    | —   | ◻   |                                                  |
| SCT-05    | To start    | ◻    | ◻   | ◻   | Quality Meter (new)                              |
| SCT-06    | To start    | ◻    | ◻   | ◻   |                                                  |
| SCT-07    | To start    | ◻    | —   | —   | Build-time, covered by DM-DEF-02                 |
| SCT-08    | To start    | ◻    | ◻   | ◻   | Multi-file scope selector (new)                  |
| SCT-09    | To start    | ◻    | ◻   | ◻   | Step auto-generation (new)                       |
| STP-01    | To start    | ◻    | ◻   | ◻   |                                                  |
| STP-02    | To start    | ◻    | —   | ◻   | Locked steps (new)                               |
| STP-03    | To start    | ◻    | ◻   | ◻   |                                                  |
| STP-04    | To start    | ◻    | —   | ◻   |                                                  |
| OUT-01    | To start    | ◻    | ◻   | ◻   |                                                  |
| OUT-02    | To start    | ◻    | ◻   | ◻   | Flow-specific templates                          |
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
| TST-03    | To start    | ◻    | —   | —   | Build-time validation                            |

---

## Decisions Log

| Date       | Decision                                                                                          | Rationale                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 2026-02-20 | GitHub Pages for hosting                                                                          | Free for public repos, auto-deploys on merge, always-latest live URL                  |
| 2026-02-20 | Status tracking in spec_concept.md                                                                | Avoids duplication. Status table + Decisions Log in the authoritative spec.           |
| 2026-02-21 | Tool configs moved to `config/`, spec files to `spec/`                                            | Cleaner root. `config/` = how to build. `spec/` = what to build.                      |
| 2026-02-24 | File/folder selection moved after task selection (optional, flow-dependent)                       | Clearer UX, simpler tree logic, more background loading time, less vertical space     |
| 2026-02-24 | Deep link to claude.ai is hard requirement for first build                                        | Investigated and verified feasible, no backup needed                                  |
| 2026-02-24 | Tightening UI requirements to ensure minimal vertical scrolling                                   | Clearer for user                                                                      |
| 2026-02-24 | Phase 0: `.card--open` class drives card body visibility; `aria-expanded` on button mirrors state | Simple toggle pattern; CSS class is set by JS in Phase 1. No redundant JS in Phase 0. |
| 2026-02-24 | Phase 0: `color-mix()` used for error/notification tinted backgrounds                             | Modern browsers only per spec; avoids adding extra color tokens for subtle tints.     |
| 2026-02-24 | Phase 1: `setState()` over Proxy for centralized state                                            | Simpler, debuggable, array-safe. No deep Proxy wrapping needed.                       |
| 2026-02-24 | Phase 1: `_prompt` as derived field on frozen state snapshot                                      | Always in sync via auto-rebuild in `setState()`. Satisfies DM-INV-01/02.              |
| 2026-02-24 | Phase 1: jsdom test environment for state.js only; prompt-builder stays in node                   | State tests need `localStorage`; keeping node env for pure functions avoids overhead. |
| 2026-02-25 | Hybrid framework: 4 flows replace 6 flows                                                         | Simpler mental model; Fix/Debug, Review/Analyze, Implement/Build, Improve/Modify      |
| 2026-02-25 | Dual-panel layout: Situation → Target                                                             | Intuitive mapping of current state to desired outcome per flow                        |
| 2026-02-25 | Auto-generated steps from flow definition                                                         | Reduces user burden; steps update dynamically as fields are filled                    |
| 2026-02-25 | State schema version field added                                                                  | Enables migration for future schema changes; v1.0 for hybrid framework                |
| 2026-02-25 | Data model uses panel_a/panel_b instead of context.selected_files                                 | Aligns with dual-panel UI; clearer separation of situation vs target                  |
