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

  configuration: {
    owner: str,              // GitHub username
    repo: str,               // selected repository name
    branch: str,             // selected branch
    pat: str                 // GitHub personal access token
  }

  context: {
    selected_files: [path],  // files flagged for LLM to "read upfront"
  }

  task: {
    flow_id: str             // selected flow from flows.yaml
  }

  steps: {
    enabled_steps: [{        // ordered list of active steps
      id: str,
      operation: str,        // e.g., read, create, edit, commit, open
      object: str,           // e.g., file, branch, PR, issue
      lenses: [str],         // active focus lenses for this step
      params: {}             // step-specific parameters (file name, PR number, issue number, etc.)
    }]
  }

  notes: {
    user_text: str           // optional free-text appended to prompt
  }

  output: {
    destination: 'clipboard'
  }
```

### DM-INV — Data Model Invariants

- DM-INV-01 Outputs are derived only from current `prompt_input` — never cached or stale fragments.
- DM-INV-02 Outputs always reflect the latest `prompt_input`. All mutations go through a centralized state setter (Proxy wrapper or `setState()`) that auto-triggers prompt rebuild — no manual rebuild calls needed.
- DM-INV-03 Identical `prompt_input` always produces identical prompt text (deterministic output).

### DM-DEF — Defaults & Merge Strategy

- DM-DEF-01 Defaults use two-layer merge: **flow defaults → user overrides**. User changes override flow defaults in-place. No base-defaults layer, no field provenance tracking. Each flow defines its own complete defaults.
- DM-DEF-02 `flows.yaml` is the single source of truth for flow definitions (metadata, steps, lenses, params). Converted to JSON at build time via Vite plugin with schema validation. Runtime imports pre-validated JSON. Build fails with clear error on invalid schema.
- DM-DEF-03 Flow selection always fully resets `steps.enabled_steps` and all step-level values to the flow's defaults. No user overrides are carried across flow switches.

---

## UJ — User Journey

This is the single source of truth for **what happens when**. Card sections below define content and layout only.

| Event                     | Card State                                                                         | Data Change                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Page load                 | Configuration expanded; all others collapsed                                       | Load PAT + username from localStorage; begin background repo fetch                         |
| Repo selected             | Expand Tasks                                                                       | Set `configuration.repo`; fetch branches + file tree; auto-select default branch           |
| Branch selected           | —                                                                                  | Set `configuration.branch`; reload file tree                                               |
| PAT edited/cleared        | —                                                                                  | Update `configuration.pat`; re-fetch repos if PAT changed                                  |
| Flow selected             | Expand Steps + Prompt; show flow-specific mandatory fields; collapse Configuration | Set `task.flow_id`; apply flow defaults per DM-DEF; fetch PRs/issues if flow requires them |
| File selected             | —                                                                                  | Update `context.selected_files`                                                            |
| Any `prompt_input` change | —                                                                                  | Rebuild prompt (DM-INV-02)                                                                 |

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

### Card 2 — Super Tasks `SCT`

Define a high-level automation task.

- SCT-01 Selected files are flagged in the prompt for the LLM to "read upfront."
- SCT-02 The app presents a fixed set of predefined flows:
  1. **Review PR** — review an open pull request with configurable focus lenses.
  2. **Implement Feature** — from spec file(s) or from user description.
  3. **Fix Bug / Issue** — from GitHub issue or user description.
  4. **Refactor** — restructure code with configurable scope and focus.
  5. **Write Tests** — add test coverage for selected files/modules.
  6. **Write Documentation** — generate or update docs for selected scope.
- SCT-03 Flows are displayed as a button grid with icon and title per button, fitting multiple buttons per row.
- SCT-04 Flow selection shows flow-specific input fields. Examples: "Implement Feature" shows a mandatory description field plus optional spec file picker (at least one required); "advanced" toggle reveals current/expected behavior and acceptance criteria fields. "Review PR" shows a list of open PRs to select.
- SCT-05 Where a flow requires mandatory user input (e.g., spec description), input field is clearly marked as required.
- SCT-06 Pre-fillable options use flat searchable dropdowns. File pickers: flat alphabetical list. PR/issue pickers: #number — title.
- SCT-07 Flow-to-step definitions in flows.yaml. Spec defines step data model/UI. Prompt-content rules live as comments in flows.yaml.

### Card 3 — Steps `STP`

Purpose: Granular control and refinement of the selected flow.

- STP-01 Steps appear as an ordered list. Each step can be deleted with a single tap (trash icon).
- STP-02 Data model minimums: 1× operation, 1× object. Optional: lenses, additional objects, text input, toggles. Unlike SCT-04, defaults are pre-applied — users only change what they want. Examples: "Write Documentation" defaults to LLM-chosen filename (user can override); optional file picker for conventions/style guide with "+" button to add more context files.
- STP-03 Lenses display as pre-selected pills (based on flow). Users can toggle any lens on/off or add custom lenses via free-text input.
- STP-04 The user can remove any step.

### Card 4 — Prompt `OUT`

Purpose: Final output and extraction.

- OUT-01 The generated prompt is structured using XML tags. It opens with repo context, then lists configured steps.
- OUT-02 Prompt format (step 2-6 are dynamic examples):

```xml
<prompt>
  <context>
    Execute the following TODO steps for <repository> https://github.com/{{owner}}/{{repo}} </repository> on <branch> {{branch}} </branch>.
    Authenticate using PAT: <PAT> {{pat}} </PAT>.
  </context>
  <todo>
    Step 1: Read: @claude.md
    Step 2: Create new branch from [default branch]
    Step 3: Edit [file] — focus on [semantics, syntax, structure]
    Step 4: Commit changes
    Step 5: Test and verify
    Step 6: Open PR
  </todo>
</prompt>
<notes>
  [optional: user's free-text comments]
</notes>
```

- OUT-03 The prompt is plain text, fully regenerated from current `prompt_input` each time any field changes. Deterministic output per DM-INV-03.
- OUT-04 Files reference example: `@src/utils/auth.js`.
- OUT-05 A "Copy" button copies the full prompt to clipboard — this is the primary output action.
- OUT-06 An optional free-text field below the prompt preview lets the user append human notes (included in `<notes>` tags, stored in `notes.user_text`).
- OUT-07 An "Open in Claude" button (claude.ai deep link — verified feasible).
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
-

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
| APP-04    | To start    | ◻    | —   | ◻   |                                                  |
| DM-INV-01 | To start    | ◻    | ◻   | —   |                                                  |
| DM-INV-02 | To start    | ◻    | ◻   | —   |                                                  |
| DM-INV-03 | To start    | ◻    | ◻   | —   | Snapshot test                                    |
| DM-DEF-01 | To start    | ◻    | ◻   | —   |                                                  |
| DM-DEF-02 | To start    | ◻    | —   | —   | Build-time validation                            |
| DM-DEF-03 | To start    | ◻    | ◻   | ◻   |                                                  |
| CFG-01    | To start    | ◻    | ◻   | ◻   |                                                  |
| CFG-02    | To start    | ◻    | ◻   | ◻   |                                                  |
| CFG-03    | To start    | ◻    | —   | ◻   |                                                  |
| CFG-04    | To start    | ◻    | ◻   | ◻   |                                                  |
| CFG-05    | To start    | ◻    | ◻   | ◻   |                                                  |
| SCT-01    | To start    | ◻    | ◻   | ◻   |                                                  |
| SCT-02    | To start    | ◻    | —   | ◻   |                                                  |
| SCT-03    | To start    | —    | —   | ◻   | Visual/layout only                               |
| SCT-04    | To start    | ◻    | ◻   | ◻   |                                                  |
| SCT-05    | To start    | ◻    | —   | ◻   |                                                  |
| SCT-06    | To start    | ◻    | ◻   | ◻   |                                                  |
| SCT-07    | To start    | ◻    | —   | —   | Build-time, covered by DM-DEF-02                 |
| STP-01    | To start    | ◻    | ◻   | ◻   |                                                  |
| STP-02    | To start    | ◻    | —   | ◻   |                                                  |
| STP-03    | To start    | ◻    | ◻   | ◻   |                                                  |
| STP-04    | To start    | ◻    | —   | ◻   |                                                  |
| OUT-01    | To start    | ◻    | ◻   | ◻   |                                                  |
| OUT-02    | To start    | ◻    | ◻   | ◻   |                                                  |
| OUT-03    | To start    | ◻    | ◻   | —   | Deterministic — DM-INV-03                        |
| OUT-04    | To start    | ◻    | —   | —   |                                                  |
| OUT-05    | To start    | ◻    | ◻   | ◻   |                                                  |
| OUT-06    | To start    | ◻    | —   | ◻   |                                                  |
| OUT-07    | To start    | —    | —   | ◻   | Opens claude.ai only                             |
| OUT-08    | To start    | —    | ◻   | ◻   | Behavioral constraint                            |
| VIS-01    | Testing     | —    | —   | ◻   | Phase 0: CSS grid layout done                    |
| VIS-02    | Testing     | —    | —   | ◻   | Phase 0: touch targets set                       |
| VIS-03    | Testing     | —    | —   | ◻   | Phase 0: card layout CSS done                    |
| TST-01    | To start    | ◻    | ◻   | —   | Snapshot test                                    |
| TST-02    | To start    | —    | ◻   | —   | E2e test                                         |
| TST-03    | To start    | ◻    | —   | —   | Build-time validation                            |

---

## Decisions Log

| Date       | Decision                                                                                                                                                                                   | Rationale                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 2026-02-20 | GitHub Pages for hosting                                                                                                                                                                   | Free for public repos, auto-deploys on merge, always-latest live URL                                                           |
| 2026-02-20 | Status tracking in spec_concept.md                                                                                                                                                         | Avoids duplication. Status table + Decisions Log in the authoritative spec.                                                    |
| 2026-02-21 | Tool configs moved to `config/`, spec files to `spec/`                                                                                                                                     | Cleaner root. `config/` = how to build. `spec/` = what to build.                                                               |
| 2026-02-24 | File/folder selection moved after task selection (optional, flow-dependent)                                                                                                                | Clearer UX, simpler tree logic, more background loading time, less vertical space                                              |
| 2026-02-24 | Deep link to claude.ai is hard requirement for first build                                                                                                                                 | Investigated and verified feasible, no backup needed                                                                           |
| 2026-02-24 | Tightening UI requirements to ensure minimal vertical scrolling                                                                                                                            | Clearer for user                                                                                                               |
| 2026-02-24 | Enhanced status tracking: 5 lifecycle statuses (To start, In progress, Testing, 🏁 Approved, 🚫 Blocked) + independent test columns (Unit, SIT, UAT) with N/A/pending/failed/passed states | Differentiates partial vs. full implementation, testing types, and human-only sign-off. PO is sole gatekeeper for 🏁 Approved. |
