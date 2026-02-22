# Implementation Specification

Single-page web app that fetches GitHub repo data, lets users configure agentic LLM tasks via guided flows, and outputs a structured Claude-optimized prompt copyable in one click.

---

## GL — Global Constraints

These rules apply to every part of the application unless explicitly exempted.

- GL-01 No action in the standard flow requires more than two clicks/taps from the user. **Exception:** file tree navigation in the Scope section — deep folder expansion may exceed two clicks.
- GL-02 The user never needs to type what can be selected from pre-loaded data.
- GL-03 The UI never shows empty screens while data loads — skeleton states or progressive loading are mandatory. Empty data states (no PRs exist, no issues, zero search results) show a brief contextual message — not a blank area.
- GL-04 Mobile-first responsive design: every interaction works on a phone screen without horizontal scrolling.
- GL-05 Errors (invalid PAT, repo not found, branch deleted, PAT expired, rate limits, network failure) use inline error feedback — not blocking modals, not hidden. Error states are dismissible and the user can correct input (e.g., edit or clear PAT) and retry manually. No automatic retry logic for v1.
- GL-06 All GitHub fetches start as early as possible (eager/background loading). Fetched data is cached in localStorage and shown instantly on revisit; a background refresh updates silently.

---

## APP — Application Architecture

- APP-01 Single-page web application; fully client-side, no backend. GitHub API called directly from browser. Single-repo scope per prompt; single-user tool.
- APP-02 Tech stack: vanilla JavaScript with ES modules, plain CSS.
- APP-03 Target scale: repos with fewer than 500 files; users with fewer than 30 repos. Full file tree eager loading is acceptable within these bounds.
- APP-04 No smart flow suggestions per repo — uniform flow list for all repos.
- APP-05 The app persists across sessions in localStorage: GitHub PAT, username, and last-used repo/branch/preferences. Previously loaded repo data (file tree, branches, PRs, issues) is cached per GL-06.

---

## DM — Canonical Data Model

All UI cards read and write a single shared state object. This is the single source of truth for prompt generation. Any change to `prompt_input` triggers a full prompt rebuild. Outputs are derived only from the current `prompt_input` — never from stale or partial state.

```
prompt_input (JSON-serializable, snake_case):

  configuration: {
    owner: str,              // GitHub username
    repo: str,               // selected repository name
    branch: str,             // selected branch
    pat: str                 // GitHub personal access token
  }

  scope: {
    selected_files: [path],  // files flagged for LLM to "read upfront"
    selected_folders: [path] // folders included as scope guidance
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
      params: {}             // step-specific parameters (file name, PR number, etc.)
    }]
  }

  notes: {
    user_text: str           // optional free-text appended to prompt
  }

  output: {
    destination: 'clipboard' // v1: clipboard only
  }
```

### DM-INV — Data Model Invariants

- DM-INV-01 Outputs are derived only from current `prompt_input` — never cached or stale fragments.
- DM-INV-02 Outputs always reflect the latest `prompt_input`. Any mutation triggers a synchronous rebuild before the next render.
- DM-INV-03 Identical `prompt_input` always produces identical prompt text (deterministic output).

### DM-DEF — Defaults & Merge Strategy

- DM-DEF-01 Defaults are applied via deterministic three-layer merge: **base defaults → flow defaults → user overrides**. Each layer wholly replaces the keys it defines; no deep-merge surprises.
- DM-DEF-02 `flows.yaml` is the single source of truth for flow definitions (flow metadata, step sequences, default lenses, default params). It is schema-validated at startup.
- DM-DEF-03 Flow selection resets `steps.enabled_steps` and step-level defaults to the flow's definition. User overrides made after flow selection are preserved until the user selects a different flow.

---

## User Journey (state machine)

This is the single source of truth for **what happens when**. Card sections below define content and layout only.

```
Page Load
  → PAT + username pre-loaded from localStorage
  → Repos fetched automatically in background (GL-06)

User selects Repo
  → Full file tree, branches, PRs, issues all load eagerly (APP-03)
  → Default branch auto-selected
  → Scope & Tasks card expands
  → Configuration card collapses

User optionally selects folders/files as scope
User optionally switches branch
  → Branch switch refreshes contextual data (PRs, issues, files)

User selects Task/Flow
  → Steps card populates with predefined steps and smart defaults
  → Prompt card becomes visible (and remains visible from this point)
  → Configuration card collapses (if not already)

Most step options are prefilled with smart defaults
Some steps require mandatory user input (e.g., file name for "Create new file")

User optionally removes steps, adjusts defaults, toggles lenses
User can revisit and adjust any previous selection at any time
  → Auto-collapse rules do NOT override manual user state;
    once the user manually expands a card, it stays expanded
    until the user collapses it

User clicks Copy button
```

### UJ — UI Transition Rules (detailed)

| Event | UI Change | State Change |
|---|---|---|
| Page load | Configuration expanded; all others collapsed | Load PAT + username from localStorage; begin background repo fetch |
| Repo selected | Expand Scope & Tasks; collapse Configuration | Set `configuration.repo`; fetch branches, file tree, PRs, issues; auto-select default branch |
| Branch selected | None | Set `configuration.branch`; reload file tree, PRs, issues |
| PAT edited/cleared | None | Update `configuration.pat`; re-fetch repos if PAT changed |
| File/folder selected | None | Update `scope.selected_files` / `scope.selected_folders` immediately and reversibly |
| Flow selected | Expand Steps + Prompt; collapse Configuration | Set `task.flow_id`; apply flow defaults to `steps.enabled_steps` per DM-DEF |
| Any `prompt_input` field changed | None | Rebuild prompt from `prompt_input` (DM-INV-02) |

---

## Layout — Four Cards

The UI is a vertical stack of four collapsible cards. Each card has an expand/collapse toggle. Cards auto-expand/collapse based on user progression (see state machine), but the user can manually override at any time with a single tap. Manual overrides stick — auto-collapse rules do not fight the user.

### Card 1 — Configuration `CFG`

Purpose: Authentication and target selection.

- CFG-01 PAT input is a password field with show/hide toggle. A "Clear" action lets the user remove the stored PAT. PAT is persisted in localStorage.
- CFG-02 GitHub username input is pre-filled from localStorage. On page load, repositories are automatically fetched — no manual trigger required.
- CFG-03 Repository buttons are displayed as a scrollable, wrapping button grid so the user can select one with a single tap.
- CFG-04 On repo selection, branch buttons appear (pre-loaded in background per GL-06). The default branch is auto-selected.
- CFG-05 On repo selection, the full recursive file tree, PRs (number + title), issues (number + title), and branches all load eagerly in the background. No on-demand lazy loading of tree levels.

### Card 2 — Scope & Tasks `SCT`

Purpose: Define codebase boundaries and select a high-level automation task.

This card has two sections: **Scope** (optional) and **Tasks**.

#### Scope section

- SCT-01 A file/folder tree view with checkboxes. The full tree is pre-loaded (see CFG-05 / APP-03).
- SCT-02 Selected folders are added to the prompt as "Scope" — guidance for the LLM on where to focus.
- SCT-03 Selected files are flagged in the prompt for the LLM to "read upfront."

#### Tasks section

- SCT-04 The app presents a fixed set of predefined flows (maximum 10). The definitive v1 list:
  1. **Review PR** — review an open pull request with configurable focus lenses.
  2. **Implement Feature** — from spec file(s) or from user description.
  3. **Fix Bug / Issue** — from GitHub issue or user description.
  4. **Refactor** — restructure code with configurable scope and focus.
  5. **Write Tests** — add test coverage for selected files/modules.
  6. **Write Documentation** — generate or update docs for selected scope.
  7. **Security Audit** — scan for vulnerabilities and suggest fixes.
  8. **Dependency Update** — review and update dependencies.
  9. **Code Migration** — migrate code patterns, frameworks, or language versions.
  10. **Performance Optimization** — identify and fix performance bottlenecks.
- SCT-05 Flows are displayed as a button grid with icon and title per button, fitting multiple buttons per row.
- SCT-06 Composite tasks are handled as optional sub-steps within a base flow (e.g., Review PR has an optional "Apply fixes" toggle), not as separate composite flows.
- SCT-07 PR references use PR number only — the prompt does not embed diff content. The LLM is assumed to have GitHub access and can fetch PR data using the PR number and PAT.
- SCT-08 Write-oriented flows instruct the LLM to create a new branch; branch naming is left to the LLM's judgment.
- SCT-09 Flow-to-step definitions will be designed one-by-one (human + LLM collaboration). This spec defines the step data model and UI; individual flow step sequences are defined separately in `flows.yaml` (see DM-DEF-02).

### Card 3 — Steps `STP`

Purpose: Granular control and refinement of the selected flow.

- STP-01 Steps appear as an ordered list. Each step can be deleted with a single tap (trash icon).
- STP-02 Step data model — a step contains at minimum:
  - 1× operation (required) — e.g., read, create, edit, open, review, commit.
  - 1× object (required) — e.g., file, branch, PR, issue.
  - Depending on the step, it may also include any combination of:
    - Focus lenses (optional toggles) — e.g., semantics, syntax, security, performance, structure.
    - Additional object(s) (rare).
    - Text input field (for mandatory user input, e.g., file name, description).
    - On/off toggles (for optional sub-behaviors).
- STP-03 Where a step has lenses, they are displayed as toggles pre-selected based on the flow. The user can toggle any lens on or off.
- STP-04 Where a step requires mandatory user input (e.g., new file name, spec description), a text input field is shown inline with the step, clearly marked as required.
- STP-05 Steps with pre-fillable options (file pickers, PR selectors) show data pre-loaded from the repo — the user selects, never types. Scope selections from SCT-01 do not constrain step-level file pickers; they are independent selections serving different purposes (scope = LLM focus guidance, step pickers = specific action targets).
- STP-06 The user can remove any step. Reordering and adding custom steps are not required for v1.
- STP-07 Step granularity is moderate — assume LLM competence. Don't micro-instruct what it already knows how to do. This is a design guideline for authoring flow definitions (SCT-09), not a runtime behavior.

### Card 4 — Prompt `OUT`

Purpose: Final output and extraction.

Card 4 never auto-collapses. Once visible (after flow selection), it remains visible.

- OUT-01 The generated prompt is structured using XML tags. It opens with repo context, then lists configured steps.
- OUT-02 Prompt format:
```xml
<prompt>
  <context>
    Execute the following steps for repository [owner/repo] on branch [branch].
    Scope: [selected folders, if any].
    Read upfront: [selected files, if any].
    Authenticate using PAT: [PAT value].
  </context>
  <steps>
    Step 1: Read file(s): [file names]
    Step 2: Create new branch from [default branch]
    Step 3: Edit [file] — focus on [semantics, syntax, structure]
    Step 4: Commit changes
    Step 5: Open PR
  </steps>
</prompt>
<notes>
  [optional: user's free-text comments]
</notes>
```
- OUT-03 The prompt is plain text, fully regenerated from current `prompt_input` each time any field changes. Deterministic output per DM-INV-03.
- OUT-04 The prompt is purely task-oriented — no system preamble, persona, or commit conventions.
- OUT-05 A "Copy" button copies the full prompt to clipboard — this is the primary output action.
- OUT-06 An optional free-text field below the prompt preview lets the user append human notes (included in `<notes>` tags, stored in `notes.user_text`).
- OUT-07 An "Open in Claude" button (claude.ai deep link) is deferred to post-v1 unless trivially implementable via URL query parameter.
- OUT-08 During development, the PAT is included explicitly in the prompt. A future version may use environment variable references instead.

---

## VIS — Visual Design & Interaction

### Theme: Arctic Bone × Vellum

Warm-shifted backgrounds with smoke and ivory treatments. The feel is a refined reading surface — like good paper under controlled light.

#### Color Tokens

| Token | Value | Usage |
|---|---|---|
| `--shell` | `#e8e6e1` | Page background. Smoke-grey, warm-shifted. |
| `--surface` | `#f5f0ea` | Card backgrounds. Warm linen. |
| `--surface-raised` | `#faf7f2` | Hovered cards, active inputs. Birch paper. |
| `--surface-inset` | `#eceae5` | Inset wells: code preview, prompt output area. |
| `--text-primary` | `#2c2926` | Body text. Near-black, warm. |
| `--text-secondary` | `#6b6560` | Labels, captions, placeholders. |
| `--text-tertiary` | `#9a9490` | Disabled text, subtle hints. |
| `--border` | `#d6d2cc` | Card borders, dividers. |
| `--border-focus` | `#a09a94` | Focused input borders. |
| `--accent` | `#3d7b9e` | Active-state left-edge gutter bar, selected toggles, primary buttons. Muted steel-blue. |
| `--accent-hover` | `#326a89` | Hover state for accent elements. |
| `--accent-subtle` | `#e9f0f5` | Accent background tint (selected items, active flow button). |
| `--danger` | `#c2553a` | Error text, delete icon hover. Warm red. |
| `--success` | `#4a8c6f` | Success feedback. Muted green. |

#### Typography

| Token | Value |
|---|---|
| `--font-body` | `system-ui, -apple-system, sans-serif` |
| `--font-mono` | `"SF Mono", "Cascadia Code", "Consolas", monospace` |
| `--text-sm` | `0.8125rem` (13px) |
| `--text-base` | `0.9375rem` (15px) |
| `--text-lg` | `1.125rem` (18px) |
| `--line-height` | `1.5` |

#### Spacing Scale

`--sp-1` through `--sp-6`: `4px, 8px, 12px, 16px, 24px, 32px`.

#### Component Treatments

- **Cards** sit on `--surface` with a `1px` `--border` and `8px` border-radius. Card header uses `--text-primary` at `--text-base` weight 600.
- **Active/selected items** (selected repo, selected flow, selected branch) display a `3px` left-edge `--accent` bar — like a code editor gutter marker. Background shifts to `--accent-subtle`.
- **Buttons** (repo grid, flow grid, branch grid) use `--surface-raised` background, `--border`, and `--text-primary`. On hover: `--surface-raised` brightens slightly, border becomes `--border-focus`.
- **Toggles/lenses** use pill-shaped containers. Off state: `--surface` bg, `--text-secondary`. On state: `--accent-subtle` bg, `--accent` text, `--accent` border.
- **Prompt output area** uses `--surface-inset` with `--font-mono` at `--text-sm`. Left-aligned, no syntax highlighting.
- **Skeleton loading states** use `--surface-inset` with a subtle horizontal shimmer animation (opacity pulse, not color shift).

### Layout Rules

- VIS-01 Each selectable option (repo, branch, flow button) displays icon and title on a single row — never stacked vertically. Buttons use a wrapping grid; at narrow viewports (< 380px), buttons go full-width single-column.
- VIS-02 Task/flow buttons and input selectors sit within comfortable thumb/scroll reach.
- VIS-03 File selection uses a tree-view with expand/collapse and checkboxes (Card 2, Scope section).

---

## Reference: Objects, Operations, Lenses

These lists define the vocabulary available to flows and steps. They serve as the pool from which flow-to-step definitions (SCT-09) draw — not every item is used by every flow, and the app does not need to build generic UI for all of them.

**Objects** (GitHub entities a step can act on): repository, branch, file, folder, file tree, pull request, issue, commit, PR comments, review comments, labels, diff hunks, CI status.

**Operations** (actions a step can perform): read, create, edit, delete, rename, move, merge, split, search, scan, compare, analyze, validate, commit, open (PR/issue).

**Focus Lenses** (configurable review dimensions): semantics, syntax, security, performance, structure, dependencies, duplications, redundancies, error handling, naming conventions, test coverage, type safety, documentation completeness, accessibility.

---

## TST — Test Criteria

Each requirement should be verifiable. These are the acceptance tests for v1.

- TST-01 Page load with valid cached PAT: repos appear without user action; Configuration card expanded, others collapsed.
- TST-02 Repo selection: branches, file tree, PRs, issues all load; default branch auto-selected; Scope & Tasks card expands.
- TST-03 Branch switch: file tree, PRs, issues refresh; `prompt_input.configuration.branch` updates.
- TST-04 File/folder tree: lazy-expands on click; checkbox toggles update `scope.selected_files` / `scope.selected_folders` immediately and reversibly.
- TST-05 Flow selection from `flows.yaml`: steps populate with flow defaults; Steps + Prompt cards expand.
- TST-06 Step toggles: enabling/disabling a step updates `steps.enabled_steps` and the prompt output.
- TST-07 Lens toggles: toggling a lens on a step updates that step's `lenses` array and the prompt output.
- TST-08 Prompt determinism: identical `prompt_input` always produces identical prompt text (snapshot test).
- TST-09 Copy button: clipboard content matches displayed prompt.
- TST-10 End-to-end: repo select → scope select → flow select → step adjust → copied prompt matches expected output for fixed inputs.
- TST-11 Manual card expand/collapse overrides auto-collapse and persists until the user changes it.
- TST-12 Error states: invalid PAT, missing repo, network failure all show inline errors per GL-05; user can correct and retry.
- TST-13 `flows.yaml` schema validation: malformed flow file prevents startup with a clear error.

---

## Implementation Status

| ID | Requirement | Status |
|---|---|---|
| GL-01 | Two-click max (except tree navigation) | pending |
| GL-02 | No typing when selection is possible | pending |
| GL-03 | Skeleton/loading states, no empty screens | pending |
| GL-04 | Mobile-first responsive | pending |
| GL-05 | Inline error feedback, no modals | pending |
| GL-06 | Eager fetch + localStorage cache + silent refresh | pending |
| APP-01 | Client-side SPA, no backend | pending |
| APP-02 | Vanilla JS + plain CSS | pending |
| APP-03 | Scale target: <500 files, <30 repos | pending |
| APP-04 | Uniform flow list for all repos | pending |
| APP-05 | Session persistence in localStorage | pending |
| DM-INV-01 | Outputs from current prompt_input only | pending |
| DM-INV-02 | Outputs always reflect latest prompt_input | pending |
| DM-INV-03 | Deterministic prompt generation | pending |
| DM-DEF-01 | Three-layer defaults merge | pending |
| DM-DEF-02 | flows.yaml as single source, schema-validated | pending |
| DM-DEF-03 | Flow selection resets steps to flow defaults | pending |
| CFG-01 | PAT password field with show/hide/clear | pending |
| CFG-02 | Username pre-fill + auto-fetch repos | pending |
| CFG-03 | Repo button grid, single-tap select | pending |
| CFG-04 | Branch buttons, default auto-selected | pending |
| CFG-05 | Eager load tree + PRs + issues on repo select | pending |
| SCT-01 | File/folder tree with checkboxes | pending |
| SCT-02 | Selected folders → prompt scope | pending |
| SCT-03 | Selected files → prompt "read upfront" | pending |
| SCT-04 | 10 predefined flows | pending |
| SCT-05 | Flow button grid with icons | pending |
| SCT-06 | Composite tasks as sub-steps, not separate flows | pending |
| SCT-07 | PR reference by number only | pending |
| SCT-08 | Write flows instruct LLM to create branch | pending |
| SCT-09 | Flow-step definitions designed separately | pending |
| STP-01 | Steps as ordered list with delete | pending |
| STP-02 | Step data model (operation + object + optional fields) | pending |
| STP-03 | Lens toggles pre-selected from flow | pending |
| STP-04 | Mandatory input fields inline with step | pending |
| STP-05 | Pre-fillable options from repo data | pending |
| STP-06 | Remove steps; no reorder/add for v1 | pending |
| OUT-01 | XML-tagged prompt structure | pending |
| OUT-02 | Prompt format per template | pending |
| OUT-03 | Full regeneration on any change | pending |
| OUT-04 | Task-oriented only, no system preamble | pending |
| OUT-05 | One-tap copy to clipboard | pending |
| OUT-06 | Free-text notes field | pending |
| OUT-07 | "Open in Claude" deferred to post-v1 | pending |
| OUT-08 | PAT included explicitly for now | pending |
| VIS-01 | Single-row buttons, wrapping grid | pending |
| VIS-02 | Thumb-reachable controls | pending |
| VIS-03 | Tree-view with checkboxes | pending |
| TST-01 | Page load with cached PAT test | pending |
| TST-02 | Repo selection integration test | pending |
| TST-03 | Branch switch test | pending |
| TST-04 | Tree expand + checkbox test | pending |
| TST-05 | Flow selection + defaults test | pending |
| TST-06 | Step toggle test | pending |
| TST-07 | Lens toggle test | pending |
| TST-08 | Prompt determinism snapshot test | pending |
| TST-09 | Copy button clipboard test | pending |
| TST-10 | End-to-end flow test | pending |
| TST-11 | Manual card state persistence test | pending |
| TST-12 | Error state display test | pending |
| TST-13 | flows.yaml schema validation test | pending |

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-02-20 | Vite as build tool | Simple config, fast dev server, builds to static files for GitHub Pages |
| 2026-02-20 | Vanilla JS (no framework) | Matches spec simplicity, avoids unnecessary complexity for a single-page app |
| 2026-02-20 | Plain CSS with variables | Per VIS theme: minimize classes, reuse tokens. Easy to adjust. |
| 2026-02-20 | GitHub Pages for hosting | Free for public repos, auto-deploys on merge, always-latest live URL |
| 2026-02-20 | Status tracking in spec_concept.md | Avoids duplication. Status table + Decisions Log in the authoritative spec. |
| 2026-02-21 | Tool configs moved to `config/`, spec files to `spec/` | Cleaner root. `config/` = how to build. `spec/` = what to build. |
| 2026-02-21 | Prettier needs two flags when config outside root | `--config config/.prettierrc` + `--ignore-path config/.prettierignore`. Vite/ESLint need one flag each. |
| 2026-02-22 | Merged v1 + v2 specs into v3 | v2 had the better product definition; v1 contributed canonical data model, invariants, test criteria, status tracking, and decisions log. |
