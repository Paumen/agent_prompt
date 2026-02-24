# Implementation Specification

Single-page web app that fetches GitHub repo data, lets users configure agentic LLM tasks via guided flows, and outputs a structured Claude-optimized prompt copyable in one click.

---

## GL — Global Constraints

- GL-01 Design principles: minimize clicks (target ≤2 for any action, except deep tree navigation), prefer selection over typing._
- GL-02 Use universal shimmer-bar skeleton with contextual loading label while data loads. Empty data states show brief contextual message, not a blank area. — not a blank area.
- GL-03 Mobile-first responsive design: every interaction works on a phone screen without horizontal scrolling.
- GL-04 Inline error feedback (no blocking modals). Dismissible. User can correct input and manually retry.
- GL-05 Eager/background loading for all GitHub fetches. Cache in `localStorage`; show instantly on revisit. Background fetch retrieves fresh data → shows brief "Updated" indicator → re-renders once (deferred if mid-interaction). No silent replacement of active views.

---

## APP — Application Architecture

- APP-01:** SPA; fully client-side. Direct GitHub API calls. Single-repo scope per prompt; single-user.
- APP-02: Vanilla JS, ES modules, plain CSS.
- APP-03: Limits: <300 files/repo, <15 repos/user. Full file tree eager loading permitted.
-APP-05: Persist PAT/username in `localStorage`. Repo/branch/prefs reset per session. Cached repo data (file tree, branches) persists per GL-06.

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
    destination: 'clipboard' // 
  }
```

### DM-INV — Data Model Invariants

- DM-INV-01 Outputs are derived only from current `prompt_input` — never cached or stale fragments.
- DM-INV-02 Outputs always reflect the latest `prompt_input`. All mutations go through a centralized state setter (Proxy wrapper or `setState()` function) that automatically triggers a synchronous prompt rebuild — no manual rebuild calls at individual mutation sites.
- DM-INV-03 Identical `prompt_input` always produces identical prompt text (deterministic output).

### DM-DEF — Defaults & Merge Strategy

- DM-DEF-01 Defaults are applied via deterministic two-layer merge: **flow defaults → user overrides**. Flow defaults are the starting point; user changes override them in-place. No base-defaults layer, no provenance tracking per field. Each flow defines its own complete set of defaults.
- DM-DEF-02 `flows.yaml` is the single source of truth for flow definitions (flow metadata, step sequences, default lenses, default params). It is converted to JSON at build time (Vite plugin) and schema-validated during the build step. At runtime the app imports pre-validated Json. Build fails with a clear error if the schema is invalid.
- DM-DEF-03 Flow selection always fully resets `steps.enabled_steps` and all step-level values to the flow's defaults. No user overrides are carried across flow switches.

---

## UJ — User Journey

This is the single source of truth for **what happens when**. Card sections below define content and layout only.

| Event                     | Card State                                    | Data Change                                                                                |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Page load                 | Configuration expanded; all others collapsed  | Load PAT + username from localStorage; begin background repo fetch                         |
| Repo selected             | Expand Tasks                                  | Set `configuration.repo`; fetch branches + file tree; auto-select default branch           |
| Branch selected           | —                                             | Set `configuration.branch`; reload file tree                                               |
| PAT edited/cleared        | —                                             | Update `configuration.pat`; re-fetch repos if PAT changed                                  |
| Flow selected             | Expand Steps + Prompt; collapse Configuration | Set `task.flow_id`; apply flow defaults per DM-DEF; fetch PRs/issues if flow requires them |
| File selected             | —                                             | Update `scope.selected_files`                                                              |
| Any `prompt_input` change | —                                             | Rebuild prompt (DM-INV-02)                                                                 |

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
- SCT-022 The app presents a fixed set of predefined flows:
  1. **Review PR** — review an open pull request with configurable focus lenses.
  2. **Implement Feature** — from spec file(s) or from user description.
  3. **Fix Bug / Issue** — from GitHub issue or user description.
  4. **Refactor** — restructure code with configurable scope and focus.
  5. **Write Tests** — add test coverage for selected files/modules.
  6. **Write Documentation** — generate or update docs for selected scope.
- SCT-03 Flows are displayed as a button grid with icon and title per button, fitting multiple buttons per row.
- SCT-04 If a flow is selected additional input fields for the specific flow will appear. For example: when "implement feature" is selected, a text input field (mandatory) to describe what to implement (an optional "advanced" option that shows more fields like "current behavior" and "expected" behavior" and "acceptance criteria") and a file picker for adding specification file for requirement (at least one of them must be filled, other becomes optional.  Example "Review PR" list of open PRs to select by user.
- STP-05 Where a flow requires mandatory user input (e.g., spec description), input field is clearly marked as required.
- STP-06 Pre-fillable options use flat searchable dropdowns. File pickers: flat alphabetical list. PR/issue pickers: #number — title. 
- SCT-07 Flow-to-step definitions in flows.yaml. Spec defines step data model/UI. Prompt-content rules live as comments in flows.yaml.

### Card 3 — Steps `STP`

Purpose: Granular control and refinement of the selected flow.

- STP-01 Steps appear as an ordered list. Each step can be deleted with a single tap (trash icon).
- STP-02 Data model minimums: 1× operation, 1× object. Optional: focus lenses, additional objects, required text input, on/off toggles. Note difference compared to SCT-04 is that  STP-02 inputs do not require user decision, if user doesn't touch them, the default will be used. For example: For "write documentation" an option (default) to let llm determine the file name, and an option (optional) to let user fill file name themselves. Example 2: a file picker for adding conventions or style guide (optional), and an "add" / "+" button to add aditional conext files.
- STP-03 Where a step has lenses, they are displayed as pills pre-selected based on the flow. The user can toggle any lens on or off. Also there will be an option to add lenses manually with free text field user can fill.
- STP-04 The user can remove any step.

### Card 4 — Prompt `OUT`

Purpose: Final output and extraction.

- OUT-01 The generated prompt is structured using XML tags. It opens with repo context, then lists configured steps.
- OUT-02 Prompt format (step 3-6 are dymamic examples):

```xml
<prompt>
  <context>
    Execute following steps for repository [htttps://github.com/owner/repo] on branch [branch].
    Authenticate using PAT: [PAT value].
  </context>
  <steps>
    Step 1: Read: @claude.md
    Step 2: Create new branch from [default branch]
    Step 3: Edit [file] — focus on [semantics, syntax, structure]
    Step 4: Commit changes
    Step 5: Test and verify
    Step 6: Open PR
  </steps>
</prompt>
<notes>
     [optional: user's free-text comments]
</notes>
```

- OUT-03 The prompt is plain text, fully regenerated from current `prompt_input` each time any field changes. Deterministic output per DM-INV-03.
- OUT-04 Files reference example: `@src/utils/auth.js`, and directory/folder reference example: `@src/components/`.
- OUT-05 A "Copy" button copies the full prompt to clipboard — this is the primary output action.
- OUT-06 An optional free-text field below the prompt preview lets the user append human notes (included in `<notes>` tags, stored in `notes.user_text`).
- OUT-07 An "Open in Claude" button (claude.ai deep link, human investigated: this is possible).
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

| Token           | Value                                               |
| --------------- | --------------------------------------------------- |
| `--font-body`   | `system-ui, -apple-system, sans-serif`              |
| `--font-mono`   | `"SF Mono", "Cascadia Code", "Consolas", monospace` |
| `--text-sm`     | `0.75rem` (12px)                                    |
| `--text-base`   | `0.875rem` (14px)                                   |
| `--text-lg`     | `1.125rem` (18px)                                   |
| `--line-height` | `1.1`                                               |

#### Spacing Scale

`--sp-1` through `--sp-6`: `2px, 4px, 8px, 12px, 16px, 24px`.

#### Component Treatments

- **Cards** sit on `--surface` with a `1px` `--border` and `8px` border-radius. Card header uses `--text-primary` at `--text-base` weight 600.
- **Active/selected items** (selected repo, selected flow, selected branch) display a `3px` left-edge `--accent` bar — like a code editor gutter marker. Background shifts to `--accent-subtle`.
- **Buttons** (repo grid, flow grid, branch grid) use `--surface-raised` background, `--border`, and `--text-primary`. On hover: `--surface-raised` brightens slightly, border becomes `--border-focus`.
- **Toggles** use pill-shaped containers. Off state: `--surface` bg, `--text-secondary`. On state: `--accent-subtle` bg, `--accent` text, `--accent` border.
- **Prompt output area** uses `--surface-inset` with `--font-mono` at `--text-sm`. Left-aligned, no syntax highlighting.
- **Skeleton loading states** Single reusable shimmer-bar class on --surface-inset, opacity pulse.
- 
### Layout Rules

- VIS-01 Each selectable option (repo, branch, flow button) displays icon and title on a single row — never stacked vertically. Buttons use a wrapping grid.
- VIS-02 Task/flow buttons and input selectors sit within comfortable thumb/scroll reach.

---

## TST — Test Criteria

Each requirement above is its own acceptance test. The following tests add specific methodology beyond their parent requirement:

- TST-08 Prompt determinism: identical `prompt_input` always produces identical prompt text (snapshot test).
- TST-10 End-to-end: repo select → scope select → flow select → step adjust → copied prompt matches expected output for fixed inputs.
- TST-13 `flows.yaml` schema validation: malformed flow file causes the build to fail with a clear error message.

---

##  Status


| ID        | Status  |
| ------    | ------- |
| GL-01     | pending |
| GL-02     | pending |
| GL-03     | pending |
| GL-04     | pending |
| GL-05     | pending |
| APP-01    | pending |
| APP-02    | pending |
| APP-03    | pending |
| APP-04    | pending |
| APP-05    | pending |
| DM-INV-01 | pending |
| DM-INV-02 | pending |
| DM-INV-03 | pending |
| DM-DEF-01 | pending |
| DM-DEF-02 | pending |
| DM-DEF-03 | pending |
| CFG-01    | pending |
| CFG-02    | pending |
| CFG-03    | pending |
| CFG-04    | pending |
| CFG-05    | pending |
| SCT-01    | pending |
| SCT-02    | pending |
| SCT-03    | pending |
| SCT-04    | pending |
| SCT-05    | pending |
| SCT-06    | pending |
| SCT-07    | pending |
| STP-01    | pending |
| STP-02    | pending |
| STP-03    | pending |
| STP-04    | pending |
| STP-05    | pending |
| STP-06    | pending |
| OUT-01    | pending |
| OUT-02    | pending |
| OUT-03    | pending |
| OUT-04    | pending |
| OUT-05    | pending |
| OUT-06    | pending |
| OUT-07    | pending |
| OUT-08    | pending |
| VIS-01    | pending |
| VIS-02    | pending |
| TST-08    | pending |
| TST-10    | pending |
| TST-13    | pending |

---

## Decisions Log

| Date       | Decision                                                                                                                        | Rationale                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-02-20 | GitHub Pages for hosting                                                                                                        | Free for public repos, auto-deploys on merge, always-latest live URL                                                                                                     |
| 2026-02-20 | Status tracking in spec_concept.md                                                                                              | Avoids duplication. Status table + Decisions Log in the authoritative spec.                                                                                              |
| 2026-02-21 | Tool configs moved to `config/`, spec files to `spec/`                                                                          | Cleaner root. `config/` = how to build. `spec/` = what to build.                                                                                                         |


