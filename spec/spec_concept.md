# Implementation Specification

Single-page web app that fetches GitHub repo data, lets users configure agentic LLM tasks via guided flows, and outputs a structured Claude-optimized prompt copyable in one click.

---

## GL — Global Constraints

These rules apply to every part of the application unless explicitly exempted.

- GL-01 No action in the standard flow requires more than two clicks/taps from the user. **Exception:** file tree navigation in the Scope section — deep folder expansion may exceed two clicks.
- GL-02 The user never needs to type what can be selected from pre-loaded data.
- GL-03 The UI never shows empty screens while data loads — a universal shimmer-bar skeleton with a contextual loading label (e.g., "Loading repositories…") is shown in each loading area. Layout-faithful per-component skeletons are not required. Empty data states (no PRs exist, no issues, zero search results) show a brief contextual message — not a blank area.
- GL-04 Mobile-first responsive design: every interaction works on a phone screen without horizontal scrolling.
- GL-05 Errors (invalid PAT, repo not found, branch deleted, PAT expired, rate limits, network failure) use inline error feedback — not blocking modals, not hidden. Error states are dismissible and the user can correct input (e.g., edit or clear PAT) and retry manually. No automatic retry logic for v1.
- GL-06 All GitHub fetches start as early as possible (eager/background loading). Fetched data is cached in localStorage and shown instantly on revisit. A background fetch then retrieves fresh data — on completion the UI shows a brief "Updated" indicator and re-renders once. If the user is mid-interaction (e.g., selecting files), the re-render is deferred until the interaction completes. No silent replacement of data the user is actively viewing.

---

## APP — Application Architecture

- APP-01 Single-page web application; fully client-side, no backend. GitHub API called directly from browser. Single-repo scope per prompt; single-user tool.
- APP-02 Tech stack: vanilla JavaScript with ES modules, plain CSS.
- APP-03 Target scale: repos with fewer than 300 files; users with fewer than 15 repos. Full file tree eager loading is acceptable within these bounds.
- APP-04 No smart flow suggestions per repo — uniform flow list for all repos.
- APP-05 The app persists PAT and username in localStorage across sessions. Repo/branch/preferences are not restored — each visit starts fresh after authentication. Previously loaded repo data (file tree, branches) is cached per GL-06.

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

  scope: {
    selected_folders: [path] // folders included as scope guidance
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
- DM-INV-02 Outputs always reflect the latest `prompt_input`. All mutations go through a centralized state setter (Proxy wrapper or `setState()` function) that automatically triggers a synchronous prompt rebuild — no manual rebuild calls at individual mutation sites.
- DM-INV-03 Identical `prompt_input` always produces identical prompt text (deterministic output).

### DM-DEF — Defaults & Merge Strategy

- DM-DEF-01 Defaults are applied via deterministic two-layer merge: **flow defaults → user overrides**. Flow defaults are the starting point; user changes override them in-place. No base-defaults layer, no provenance tracking per field. Each flow defines its own complete set of defaults.
- DM-DEF-02 `flows.yaml` is the single source of truth for flow definitions (flow metadata, step sequences, default lenses, default params). It is converted to JSON at build time (Vite plugin) and schema-validated during the build step. At runtime the app imports pre-validated JSON — no YAML parsing or runtime validation needed. Build fails with a clear error if the schema is invalid.
- DM-DEF-03 Flow selection always fully resets `steps.enabled_steps` and all step-level values to the flow's defaults. No user overrides are carried across flow switches — selecting a flow starts fresh every time.

---

## UJ — User Journey

This is the single source of truth for **what happens when**. Card sections below define content and layout only.

| Event                     | Card State                                    | Data Change                                                                                |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Page load                 | Configuration expanded; all others collapsed  | Load PAT + username from localStorage; begin background repo fetch                         |
| Repo selected             | Expand Scope & Tasks; collapse Configuration  | Set `configuration.repo`; fetch branches + file tree; auto-select default branch           |
| Branch selected           | —                                             | Set `configuration.branch`; reload file tree                                               |
| PAT edited/cleared        | —                                             | Update `configuration.pat`; re-fetch repos if PAT changed                                  |
| File/folder selected      | —                                             | Update `scope.selected_files` / `scope.selected_folders`                                   |
| Flow selected             | Expand Steps + Prompt; collapse Configuration | Set `task.flow_id`; apply flow defaults per DM-DEF; fetch PRs/issues if flow requires them |
| Any `prompt_input` change | —                                             | Rebuild prompt (DM-INV-02)                                                                 |

---

## Layout — Four Cards

The UI is a vertical stack of four collapsible cards. Each card has an expand/collapse toggle. Cards auto-expand based on user progression (see UJ table). The Configuration card also auto-collapses on repo select and flow select. No manual-override tracking — if the user re-opens Configuration and then triggers an auto-collapse event, it collapses again. Other cards never auto-collapse; the user closes them manually if desired.

### Card 1 — Configuration `CFG`

Purpose: Authentication and target selection.

- CFG-01 PAT input is a password field with show/hide toggle. A "Clear" action lets the user remove the stored PAT. PAT is persisted in localStorage.
- CFG-02 GitHub username input is pre-filled from localStorage. On page load, repositories are automatically fetched — no manual trigger required.
- CFG-03 Repository buttons are displayed as a scrollable, wrapping button grid so the user can select one with a single tap.
- CFG-04 On repo selection, branch buttons appear (pre-loaded in background per GL-06). The default branch is auto-selected.
- CFG-05 On repo selection, branches and the full recursive file tree load eagerly in the background. PRs and issues are fetched on-demand when a flow that needs them is selected. No on-demand lazy loading of tree levels.

### Card 2 — Scope & Tasks `SCT`

Purpose: Define codebase boundaries and select a high-level automation task.

This card has two sections: **Scope** (optional) and **Tasks**.

#### Scope section

- SCT-01 A file/folder tree view with independent checkboxes for folders and files. Checking a folder does not auto-check its children and vice versa — folders and files serve different semantic purposes (SCT-02 vs SCT-03). No tri-state (partial) checkbox logic. The full tree is pre-loaded (see CFG-05 / APP-03).
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
- SCT-05 Flows are displayed as a button grid with icon and title per button, fitting multiple buttons per row.
- SCT-06 Each flow is a flat list of steps — no optional sub-step toggles. Users remove unwanted steps via STP-06.
- SCT-07 PR references use PR number only — the prompt does not embed diff content. The LLM is assumed to have GitHub access and can fetch PR data using the PR number and PAT.
- SCT-08 Write-oriented flows instruct the LLM to create a new branch; branch naming is left to the LLM's judgment if not specified by the user.
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
- STP-05 Steps with pre-fillable options use flat searchable dropdowns pre-loaded from the repo — the user selects, never types. File pickers show a flat alphabetically-sorted list of all file paths (type-to-filter); PR and issue pickers show `#number — title` lists. No tree-view pickers at step level. Scope selections from SCT-01 do not constrain step-level dropdowns; they are independent selections serving different purposes (scope = LLM focus guidance, step dropdowns = specific action targets).
- STP-06 The user can remove any step. Reordering and adding custom steps are not required for v1.
- STP-07 Step granularity is moderate — assume LLM competence. Don't micro-instruct what it already knows how to do. This is a design guideline for authoring flow definitions (SCT-09), not a runtime behavior.

### Card 4 — Prompt `OUT`

Purpose: Final output and extraction.

Card 4 never auto-collapses. Once visible (after flow selection), it remains visible.

- OUT-01 The generated prompt is structured using XML tags. It opens with repo context, then lists configured steps.
- OUT-02 Prompt format (step 3-7 are dymamic examples):

```xml
<prompt>
  <context>
    Execute the following steps for repository [owner/repo] on branch [branch].
    Scope: [selected folders, if any].
    Authenticate using PAT: [PAT value].
  </context>
  <steps>
    Step 1: Read: @claude.md
    Step 2: Read: [selected files, if any].
    Step 3: Create new branch from [default branch]
    Step 4: Edit [file] — focus on [semantics, syntax, structure]
    Step 5: Commit changes
    Step 6: Test and verify
    Step 7: Open PR
  </steps>
</prompt>
<notes>
     [optional: user's free-text comments]
</notes>
```

- OUT-03 The prompt is plain text, fully regenerated from current `prompt_input` each time any field changes. Deterministic output per DM-INV-03.
- OUT-04 Files reference example: `@src/utils/auth.js`, and directory/folder reference example: `@src/components/`.
- OUT-05 The prompt is purely task-oriented — no system preamble, persona, or commit conventions.
- OUT-06 A "Copy" button copies the full prompt to clipboard — this is the primary output action.
- OUT-07 An optional free-text field below the prompt preview lets the user append human notes (included in `<notes>` tags, stored in `notes.user_text`).
- OUT-08 An "Open in Claude" button (claude.ai deep link) is deferred to post-v1.
- OUT-09 During development, the PAT is included explicitly in the prompt. A future version may use environment variable references instead.

---

## VIS — Visual Design & Interaction

### Theme: Arctic Bone × Vellum

Warm-shifted backgrounds with smoke and ivory treatments. The feel is a refined reading surface — like good paper under controlled light.

#### Color Tokens

| Token              | Value     | Usage                                                                                   |
| ------------------ | --------- | --------------------------------------------------------------------------------------- |
| `--shell`          | `#e8e6e1` | Page background. Smoke-grey, warm-shifted.                                              |
| `--surface`        | `#f5f0ea` | Card backgrounds. Warm linen.                                                           |
| `--surface-raised` | `#faf7f2` | Hovered cards, active inputs. Birch paper.                                              |
| `--surface-inset`  | `#eceae5` | Inset wells: code preview, prompt output area.                                          |
| `--text-primary`   | `#2c2926` | Body text. Near-black, warm.                                                            |
| `--text-secondary` | `#6b6560` | Labels, captions, placeholders.                                                         |
| `--text-tertiary`  | `#9a9490` | Disabled text, subtle hints.                                                            |
| `--border`         | `#d6d2cc` | Card borders, dividers.                                                                 |
| `--border-focus`   | `#a09a94` | Focused input borders.                                                                  |
| `--accent`         | `#4A6D70` | Active-state left-edge gutter bar, selected toggles, primary buttons. Muted steel-blue. |
| `--accent-hover`   | `#326a89` | Hover state for accent elements.                                                        |
| `--accent-subtle`  | `#e9f0f5` | Accent background tint (selected items, active flow button).                            |
| `--danger`         | `#c2553a` | Error text, delete icon hover. Warm red.                                                |
| `--success`        | `#4a8c6f` | Success feedback. Muted green.                                                          |

#### Typography

| Token           | Value                                               |
| --------------- | --------------------------------------------------- |
| `--font-body`   | `system-ui, -apple-system, sans-serif`              |
| `--font-mono`   | `"SF Mono", "Cascadia Code", "Consolas", monospace` |
| `--text-sm`     | `0.75rem` (12px)                                    |
| `--text-base`   | `0.875rem` (14px)                                   |
| `--text-lg`     | `1.125rem` (18px)                                   |
| `--line-height` | `1.3`                                               |

#### Spacing Scale

`--sp-1` through `--sp-6`: `2px, 4px, 8px, 12px, 16px, 24px`.

#### Component Treatments

- **Cards** sit on `--surface` with a `1px` `--border` and `8px` border-radius. Card header uses `--text-primary` at `--text-base` weight 600.
- **Active/selected items** (selected repo, selected flow, selected branch) display a `3px` left-edge `--accent` bar — like a code editor gutter marker. Background shifts to `--accent-subtle`.
- **Buttons** (repo grid, flow grid, branch grid) use `--surface-raised` background, `--border`, and `--text-primary`. On hover: `--surface-raised` brightens slightly, border becomes `--border-focus`.
- **Toggles** use pill-shaped containers. Off state: `--surface` bg, `--text-secondary`. On state: `--accent-subtle` bg, `--accent` text, `--accent` border.
- **Prompt output area** uses `--surface-inset` with `--font-mono` at `--text-sm`. Left-aligned, no syntax highlighting.
- **Skeleton loading states** use a single reusable shimmer-bar class on `--surface-inset` with a subtle horizontal shimmer animation (opacity pulse, not color shift). One generic shimmer pattern is reused across all loading areas — no per-component skeleton shapes required (see GL-03).

### Layout Rules

- VIS-01 Each selectable option (repo, branch, flow button) displays icon and title on a single row — never stacked vertically. Buttons use a wrapping grid.
- VIS-02 Task/flow buttons and input selectors sit within comfortable thumb/scroll reach.

---

## Reference: Objects, Operations, Lenses

These lists define the vocabulary available to flows and steps. They serve as the pool from which flow-to-step definitions (SCT-09) draw — not every item is used by every flow, and the app does not need to build generic UI for all of them.

**Objects** (GitHub entities a step can act on): repository, branch, file, folder, file tree, pull request, issue, commit, PR comments, review comments, labels, diff hunks, CI status.

**Operations** (actions a step can perform): read, create, edit, delete, rename, move, merge, split, search, scan, compare, analyze, validate, commit, open (PR/issue).

**Focus Lenses** (configurable review dimensions): semantics, syntax, security, performance, structure, dependencies, duplications, redundancies, error handling, naming conventions, test coverage, type safety, documentation completeness, accessibility.

---

## TST — Test Criteria

Each requirement above is its own acceptance test. The following tests add specific methodology beyond their parent requirement:

- TST-08 Prompt determinism: identical `prompt_input` always produces identical prompt text (snapshot test).
- TST-10 End-to-end: repo select → scope select → flow select → step adjust → copied prompt matches expected output for fixed inputs.
- TST-13 `flows.yaml` schema validation: malformed flow file causes the build to fail with a clear error message.

---

## Implementation Status

| ID        | Requirement                                            | Status  |
| --------- | ------------------------------------------------------ | ------- |
| GL-01     | Two-click max (except tree navigation)                 | pending |
| GL-02     | No typing when selection is possible                   | pending |
| GL-03     | Universal shimmer-bar loading states                   | pending |
| GL-04     | Mobile-first responsive                                | pending |
| GL-05     | Inline error feedback, no modals                       | pending |
| GL-06     | Eager fetch + localStorage cache + visible refresh     | pending |
| APP-01    | Client-side SPA, no backend                            | pending |
| APP-02    | Vanilla JS + plain CSS                                 | pending |
| APP-03    | Scale target: <300 files, <15 repos                    | pending |
| APP-04    | Uniform flow list for all repos                        | pending |
| APP-05    | Persist PAT + username only                            | pending |
| DM-INV-01 | Outputs from current prompt_input only                 | pending |
| DM-INV-02 | Centralized state setter with auto-rebuild             | pending |
| DM-INV-03 | Deterministic prompt generation                        | pending |
| DM-DEF-01 | Two-layer defaults merge (flow → user)                 | pending |
| DM-DEF-02 | flows.yaml as single source, build-time validated      | pending |
| DM-DEF-03 | Flow switch = full reset to flow defaults              | pending |
| CFG-01    | PAT password field with show/hide/clear                | pending |
| CFG-02    | Username pre-fill + auto-fetch repos                   | pending |
| CFG-03    | Repo button grid, single-tap select                    | pending |
| CFG-04    | Branch buttons, default auto-selected                  | pending |
| CFG-05    | Eager load branches + file tree on repo select         | pending |
| SCT-01    | File/folder tree with independent checkboxes           | pending |
| SCT-02    | Selected folders → prompt scope                        | pending |
| SCT-03    | Selected files → prompt "read upfront"                 | pending |
| SCT-04    | 6 predefined flows                                     | pending |
| SCT-05    | Flow button grid with icons                            | pending |
| SCT-06    | Flat step lists, remove unwanted via STP-06            | pending |
| SCT-07    | PR reference by number only                            | pending |
| SCT-08    | Write flows instruct LLM to create branch              | pending |
| SCT-09    | Flow-step definitions designed separately              | pending |
| STP-01    | Steps as ordered list with delete                      | pending |
| STP-02    | Step data model (operation + object + optional fields) | pending |
| STP-03    | Lens toggles pre-selected from flow                    | pending |
| STP-04    | Mandatory input fields inline with step                | pending |
| STP-05    | Native select dropdowns from repo data                 | pending |
| STP-06    | Remove steps; no reorder/add for v1                    | pending |
| OUT-01    | XML-tagged prompt structure                            | pending |
| OUT-02    | Prompt format per template                             | pending |
| OUT-03    | Full regeneration on any change                        | pending |
| OUT-04    | File/folder reference syntax                           | pending |
| OUT-05    | Task-oriented only, no system preamble                 | pending |
| OUT-06    | One-tap copy to clipboard                              | pending |
| OUT-07    | Free-text notes field                                  | pending |
| OUT-08    | "Open in Claude" deferred to post-v1                   | pending |
| OUT-09    | PAT included explicitly for now                        | pending |
| VIS-01    | Single-row buttons, wrapping grid                      | pending |
| VIS-02    | Thumb-reachable controls                               | pending |
| TST-08    | Prompt determinism snapshot test                       | pending |
| TST-10    | End-to-end flow test                                   | pending |
| TST-13    | flows.yaml build-time validation test                  | pending |

---

## Decisions Log

| Date       | Decision                                                                                                                        | Rationale                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-02-20 | GitHub Pages for hosting                                                                                                        | Free for public repos, auto-deploys on merge, always-latest live URL                                                                                                     |
| 2026-02-20 | Status tracking in spec_concept.md                                                                                              | Avoids duplication. Status table + Decisions Log in the authoritative spec.                                                                                              |
| 2026-02-21 | Tool configs moved to `config/`, spec files to `spec/`                                                                          | Cleaner root. `config/` = how to build. `spec/` = what to build.                                                                                                         |
| 2026-02-21 | Prettier needs two flags when config outside root                                                                               | `--config config/.prettierrc` + `--ignore-path config/.prettierignore`. Vite/ESLint need one flag each.                                                                  |
| 2026-02-22 | Merged v1 + v2 specs into v3                                                                                                    | v2 had the better product definition; v1 contributed canonical data model, invariants, test criteria, status tracking, and decisions log.                                |
| 2026-02-22 | GL-06: Cache-then-fetch with visible refresh, no silent swap                                                                    | Eliminates race conditions where user acts on stale data that gets silently replaced. Brief "Updated" indicator is negligible UX cost.                                   |
| 2026-02-22 | SCT-01: Independent folder/file checkboxes, no tri-state                                                                        | Folders (scope) and files (context) already serve different purposes — tri-state propagation added complexity without matching the semantic model.                       |
| 2026-02-22 | DM-INV-02: Centralized state setter with auto-rebuild                                                                           | Proxy or setState() makes the "output always matches state" invariant structurally impossible to violate, vs. manual rebuild calls at every mutation site.               |
| 2026-02-22 | DM-DEF-01: Two-layer merge (flow defaults → user), no provenance tracking                                                       | Three-layer merge with dirty-tracking per field was over-engineered. Each flow defines its own complete defaults; no base-defaults layer needed.                         |
| 2026-02-22 | DM-DEF-02: Build-time YAML→JSON + build-time schema validation                                                                  | Catches malformed flows before deploy (better than runtime errors). Zero runtime overhead, no YAML parser in bundle, stays within zero-dependency constraint.            |
| 2026-02-22 | GL-03: Universal shimmer-bar skeleton, not per-component skeletons                                                              | Loading states are transient (<2s). Generic shimmer + label achieves the same "no empty screens" goal with a single reusable CSS class instead of 6+ custom skeletons.   |
| 2026-02-22 | STP-05: Flat searchable dropdowns for step-level pickers                                                                        | Flat type-to-filter lists are faster than tree navigation for targeted file selection. Avoids duplicating the SCT-01 tree in miniature inside each step card.            |
| 2026-02-22 | APP-05: Persist PAT + username only, no repo/branch restoration                                                                 | Restoring full selection state requires validating stale references (deleted repos, renamed branches). PAT + username cover the tedious part; repo selection is 1 click. |
| 2026-02-22 | Card collapse: auto-collapse Configuration only, no manual-override tracking                                                    | Simplifies card state management. Cards only auto-open (except Configuration which also auto-closes). No per-card manual override flags needed.                          |
| 2026-02-22 | CFG-05: Lazy-load PRs/issues on flow select, not repo select                                                                    | PRs/issues only needed by 2 of 6 flows. Saves ~2 API calls per repo selection and simplifies the cache.                                                                  |
| 2026-02-22 | SCT-06: Flat step lists, no composite sub-step toggles                                                                          | Step deletion (STP-06) already covers the use case. One interaction pattern instead of two.                                                                              |
| 2026-02-22 | S1-S5: Spec cleanup — fixed OUT-04 dup, merged DM intro, replaced UJ prose with table, dropped VIS-03, trimmed TST to 3 entries | Reduced spec size and redundancy. Fewer duplicate tracking rows. Each requirement is its own acceptance test.                                                            |
