# Hybrid Framework — Full Design (v2)

## Context

The user designed a hybrid framework with 4 flows and a Quality Meter. This document works out that design into a full implementation-ready specification. See "Appendix: 5 Alternative Frameworks" at the bottom for the original exploration.

**Core problem**: Claude Code wastes effort when it (a) doesn't know which files matter, (b) doesn't understand the exact desired outcome, (c) reads unnecessary context into its window, (d) gets vague instructions.

**What Claude Code needs from a good prompt:**

1. Which files to read FIRST (prevents searching/scanning the whole repo)
2. What the exact desired outcome is (prevents going in the wrong direction)
3. Minimal but precise context (prevents reading unnecessary files and clogging the context window)
4. How to verify it's done (prevents partial or wrong implementations)

**Design principle**: A clear, specific prompt naturally prevents Claude from touching things it shouldn't. Fences/boundaries are unnecessary when the prompt clearly defines what to work on. Vague prompts are the root cause of Claude drift — the framework's job is to prevent vagueness.

---

## Panel Naming — Decided: Option D (Situation / Target)

Generic "Situation → Target" labels across all flows, with flow-specific subtitles.

| Flow            | Panel A (Situation)                                       | Panel B (Target)                                        |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Fix/Debug       | **Situation** — What's happening now                      | **Target** — How it should work after the fix           |
| Review/Analyze  | **Situation** — The PR, code, or document to examine      | **Target** — Standards and criteria for the review      |
| Implement/Build | **Situation** — Existing context to build upon (optional) | **Target** — What to build and how to know it's done    |
| Improve/Modify  | **Situation** — What exists and what needs improvement    | **Target** — What the improved version should look like |

---

## The 4 Flows

| Flow        | Label             | Core use case                     |
| ----------- | ----------------- | --------------------------------- |
| `fix`       | Fix / Debug       | Bug, error, broken behavior       |
| `review`    | Review / Analyze  | PR review, code analysis, audits  |
| `implement` | Implement / Build | New feature, new file, greenfield |
| `improve`   | Improve / Modify  | Refactor, optimize, enhance       |

Every flow uses a **dual-panel layout** (left/right on desktop, stacked on mobile). Panel labels follow whichever naming option is chosen above.

---

## Data Model

Replaces the current `prompt_input` shape in `src/js/state.js`.

```
prompt_input:

  configuration: {
    owner: str,
    repo: str,
    branch: str,
    pat: str
  }

  task: {
    flow_id: "fix" | "review" | "implement" | "improve"
  }

  panel_a: {                        # "Situation" panel
    description: str,               # free-text
    issue_number: int | null,       # GitHub issue selector
    pr_number: int | null,          # GitHub PR selector (review flow only)
    files: [path]                   # file picker: location / supporting / starting files
  }

  panel_b: {                        # "Target" panel
    description: str,               # free-text desired outcome / criteria / build spec
    issue_number: int | null,       # GitHub issue (improve flow — desired state from issue)
    spec_files: [path],             # specification/requirement documents
    guideline_files: [path],        # style guides, coding standards
    acceptance_criteria: str,       # how to know it's done (implement flow)
    lenses: [str]                   # focus lenses (improve flow)
  }

  steps: {
    enabled_steps: [{               # auto-generated from flow, user can fine-tune
      id: str,
      operation: str,
      object: str,
      lenses: [str],                # user-adjustable focus lenses per step
      file_name: str,
      pr_name: str,
      directory: str,
      branch_name: str,
      params: {}
    }]
  }

  improve_scope: "each_file" | "across_files" | null   # improve flow only

  notes: {
    user_text: str
  }

  output: {
    destination: 'clipboard' | 'copy to claude'
  }
```

### Which fields appear in which flow

| Field                         |   Fix/Debug    | Review/Analyze | Implement/Build |         Improve/Modify          |
| ----------------------------- | :------------: | :------------: | :-------------: | :-----------------------------: |
| **Panel A (Situation)**       |                |                |                 |                                 |
| `panel_a.description`         |   Required\*   |    Optional    |    Optional     |           Required\*            |
| `panel_a.issue_number`        |   Required\*   |       —        |        —        |           Required\*            |
| `panel_a.pr_number`           |       —        |  Required\*\*  |        —        |                —                |
| `panel_a.files`               |    Optional    |  Required\*\*  |    Optional     |            Optional             |
| **Panel B (Target)**          |                |                |                 |                                 |
| `panel_b.description`         |    Optional    |       —        |   Required\*      |            Optional             |
| `panel_b.issue_number`        |       —        |       —        |   Hidden required\*    |            Optional             |
| `panel_b.user_story_template` |       —        |       —        |   Required\*      |           Hidden Optional              |
| `panel_b.spec_files`          |    Optional    |    Optional    |    Optional     |                —                |
| `panel_b.guideline_files`     |    Optional    |    Optional    |        —        | Optional (as "reference files") |
| `panel_b.acceptance_criteria` |       —        |       —        |    Optional     |                —                |
| **Steps**                     |                |                |                 |                                 |
| `steps.enabled_steps`         | Auto-generated | Auto-generated | Auto-generated  |         Auto-generated          |
| `Step lenses`                 |    Per step    |    Per step    |    Per step     |            Per step             |
| `file_name  `                 |    Per step    |    Per step    |    Per step     |            Per step             |
| `pr_name  `                   |    Per step    |    Per step    |    Per step     |            Per step             |
| `pr_name  `                   |    Per step    |    Per step    |    Per step     |            Per step             |
| `output `                     |    Per step    |    Per step    |    Per step     |            Per step             |
| **Other**                     |                |                |                 |                                 |
| `improve_scope`               |       —        | Shown at 2+ files |        —        |       Shown at 2+ files       |
| `notes.user_text`             |    Optional    |    Optional    |    Optional     |            Optional             |

`*` = At least one field marked `*` in Panel A must be filled (description OR issue_number).
`**` = Review flow: at least one of PR or files required. Either or both can be filled. In the prompt, PR input results in "review the PR diff" instruction; file input results in "review these files" instruction. When both are provided, both are included.

### Validation rules per flow

- **Fix/Debug**: Panel A requires `description` OR `issue_number`. Panel B has no required fields.
- **Review/Analyze**: Panel A requires `pr_number` OR `files` (both allowed). Panel B has no required fields.
- **Implement/Build**: Panel B requires `description` (what to build). Panel A is entirely optional.
- **Improve/Modify**: Panel A requires `description` OR `issue_number`. Panel B has no required fields. When 2+ files selected, `improve_scope` selector appears: "Improve each file separately" vs "Improve across files together".

---

## Steps (Auto-Generated + Fine-Tunable)

Steps are NOT removed. They are **auto-generated** when a flow is selected and **updated** as the user fills in fields. The user can fine-tune steps (toggle lenses, remove steps) but does not create steps from scratch.

### How steps are generated

1. **Flow selection** → base step template is loaded from `flows.yaml`
2. **User fills fields** → steps update dynamically:
   - Filing `issue_number` → adds "Read issue #N" step
   - Filing `pr_number` → adds "Fetch PR #N diff" step
   - Selecting `spec_files` → adds "Read specification files" step
   - Selecting `guideline_files` → adds "Read guideline files" step
   - Selecting `panel_a.files` → adds "Read [files]" step
3. **User can fine-tune**:
   - Toggle lenses on/off per step (pre-selected from flow defaults)
   - Remove any step (trash icon)
   - Steps cannot be reordered or added manually (keeps it simple)

### Default step templates per flow

**Fix / Debug:**

```
1. Read @claude.md
2. [if files] Read: @location-files
3. [if issue] Read issue #N
4. [if spec_files] Read: @spec-files
5. [if guideline_files] Read: @guideline-files
6. Identify root cause
7. Create new branch
8. Implement fix — lenses: [error_handling, semantics]
9. Run tests
10. Commit changes and open PR
```

**Review / Analyze:**

```
1. Read @claude.md
2. [if spec_files] Read: @spec-files
3. [if guideline_files] Read: @guideline-files
4. [if pr] Fetch and review PR #N diff — lenses: [user-selected or defaults]
5. [if files] Read and analyze: @review-files — lenses: [user-selected or defaults]
6. Provide structured feedback with specific file/line references
```

**Implement / Build:**

```
1. Read @claude.md
2. [if panel_a.files] Read: @starting-files
3. [if spec_files] Read: @spec-files
4. Create new branch
5. Implement requirements — lenses: [semantics, structure]
6. [if acceptance_criteria] Verify acceptance criteria
7. Run tests
8. Commit changes and open PR
```

**Improve / Modify:**

```
1. Read @claude.md
2. [if files] Read: @files-to-improve
3. [if issue] Read issue #N
4. [if guideline_files] Read: @reference-files
5. Create new branch
6. Apply improvements — lenses: [user-selected or defaults]
7. [if improve_scope == "across_files"] Apply improvements across all files as a unified change
7. [if improve_scope == "each_file"] Apply improvements to each file independently
8. Verify improvements
9. Commit changes and open PR
```

### Step display in UI (Card 3 — Steps)

Steps appear as a compact ordered list (same as current STP card design):

- Each step is a single row: step number, description, lens pills (togglable), trash icon
- Conditional steps (from user input) appear/disappear as fields are filled
- Lenses are shown as togglable pills (pre-selected per flow, user can turn on/off)
- No drag-to-reorder, no "add step" button

---

## Improve / Modify: Multi-File Scope

When the user selects 2+ files in `panel_a.files`, a scope selector appears:

**"How should the LLM approach these files?"**

- **Each file separately** — Apply improvements to each file independently. The LLM treats each file as a separate task.
- **Across files together** — Apply improvements across all files as a unified change. The LLM considers relationships between files (e.g., reducing redundancies by consolidating shared logic, aligning formatting across files, removing duplicated definitions).

This generates different prompt instructions:

- "Each file separately" → `<instruction>Apply the following improvements to each file independently: {{files}}</instruction>`
- "Across files together" → `<instruction>Apply the following improvements across all files, considering their relationships: {{files}}</instruction>`

---

## Flows.yaml Structure

Each flow defines its field configuration AND step templates.

```yaml
flows:
  fix:
    label: 'Fix / Debug'
    icon: 'bug'
    panel_a:
      label: 'Current State' # or per naming option chosen
      subtitle: "What's happening now"
      fields:
        description:
          type: text
          placeholder: 'Describe the issue: error messages, unexpected behavior, steps to reproduce...'
          required_group: a_required
        issue_number:
          type: issue_picker
          placeholder: 'Select a GitHub issue'
          required_group: a_required
        files:
          type: file_picker_multi
          placeholder: 'Where does the issue occur?'
    panel_b:
      label: 'Expected Outcome'
      subtitle: 'How it should work after the fix'
      fields:
        description:
          type: text
          placeholder: 'Describe the expected behavior after the fix is applied...'
        spec_files:
          type: file_picker_multi
          placeholder: 'Requirements or specification documents'
        guideline_files:
          type: file_picker_multi
          placeholder: 'Style guides or coding standards'
    steps:
      - id: read-claude
        operation: read
        object: file
        params: { file: 'claude.md' }
        locked: true # user cannot remove
      - id: read-location
        operation: read
        object: files
        source: panel_a.files # conditional: only if files selected
      - id: read-issue
        operation: read
        object: issue
        source: panel_a.issue_number # conditional: only if issue selected
      - id: read-specs
        operation: read
        object: files
        source: panel_b.spec_files
      - id: read-guidelines
        operation: read
        object: files
        source: panel_b.guideline_files
      - id: identify-cause
        operation: analyze
        object: issue
        lenses: [error_handling, semantics]
      - id: create-branch
        operation: create
        object: branch
      - id: implement-fix
        operation: edit
        object: files
        lenses: [error_handling, semantics]
      - id: run-tests
        operation: validate
        object: tests
      - id: commit-pr
        operation: commit
        object: changes
        params: { open_pr: true }

  review:
    label: 'Review / Analyze'
    icon: 'search'
    panel_a:
      label: 'Review Subject'
      subtitle: 'The PR, code, or document to examine'
      fields:
        description:
          type: text
          placeholder: 'Background, specific questions, or areas of concern...'
        pr_number:
          type: pr_picker
          placeholder: 'Select a pull request'
          required_group: a_required
        files:
          type: file_picker_multi
          placeholder: 'Files to review'
          required_group: a_required
    panel_b:
      label: 'Review Criteria'
      subtitle: 'Standards and criteria for the review'
      fields:
        lenses:
          type: lens_picker
          default: [semantics, structure]
        spec_files:
          type: file_picker_multi
          placeholder: 'Requirements the code should meet'
        guideline_files:
          type: file_picker_multi
          placeholder: 'Standards to check against'
    steps:
      - id: read-claude
        operation: read
        object: file
        params: { file: 'claude.md' }
        locked: true
      - id: read-specs
        operation: read
        object: files
        source: panel_b.spec_files
      - id: read-guidelines
        operation: read
        object: files
        source: panel_b.guideline_files
      - id: review-pr
        operation: analyze
        object: pull_request
        source: panel_a.pr_number
        lenses: [] # populated from panel_b.lenses
      - id: review-files
        operation: analyze
        object: files
        source: panel_a.files
        lenses: [] # populated from panel_b.lenses
      - id: provide-feedback
        operation: create
        object: review_feedback

  implement:
    label: 'Implement / Build'
    icon: 'plus'
    panel_a:
      label: 'Context'
      subtitle: 'Existing code or context to build upon (optional)'
      fields:
        description:
          type: text
          placeholder: 'Background, constraints, or existing context...'
        files:
          type: file_picker_multi
          placeholder: 'Existing files to build upon'
    panel_b:
      label: 'Requirements'
      subtitle: 'What to build and completion criteria'
      fields:
        description:
          type: text
          required: true
          placeholder: 'Describe what to build: functionality, behavior, constraints...'
        spec_files:
          type: file_picker_multi
          placeholder: 'Requirement docs, user stories, technical specs'
        acceptance_criteria:
          type: text
          placeholder: "How to know it's done: test cases, edge cases, quality standards..."
    steps:
      - id: read-claude
        operation: read
        object: file
        params: { file: 'claude.md' }
        locked: true
      - id: read-starting
        operation: read
        object: files
        source: panel_a.files
      - id: read-specs
        operation: read
        object: files
        source: panel_b.spec_files
      - id: create-branch
        operation: create
        object: branch
      - id: implement
        operation: create
        object: implementation
        lenses: [semantics, structure]
      - id: verify-criteria
        operation: validate
        object: acceptance_criteria
        source: panel_b.acceptance_criteria
      - id: run-tests
        operation: validate
        object: tests
      - id: commit-pr
        operation: commit
        object: changes
        params: { open_pr: true }

  improve:
    label: 'Improve / Modify'
    icon: 'arrow-up'
    panel_a:
      label: 'Current State'
      subtitle: 'What exists and what needs improvement'
      fields:
        description:
          type: text
          placeholder: 'What to enhance: pain points, inefficiencies, areas to improve...'
          required_group: a_required
        issue_number:
          type: issue_picker
          placeholder: 'Select a related GitHub issue'
          required_group: a_required
        files:
          type: file_picker_multi
          placeholder: 'Files to improve'
    panel_b:
      label: 'Desired Outcome'
      subtitle: 'What the improved version should look like'
      fields:
        lenses:
          type: lens_picker
          default: []
        description:
          type: text
          placeholder: 'Describe the desired improvements, goals, or constraints...'
        issue_number:
          type: issue_picker
          placeholder: 'Issue describing the desired state'
        guideline_files:
          type: file_picker_multi
          label: 'Reference files'
          placeholder: 'Style guides, examples of desired output, or specs'
    multi_file:
      scope_selector:
        label: 'How should files be improved?'
        options:
          each_file: 'Each file separately'
          across_files: 'Across files together'
        show_when: 'panel_a.files.length >= 2'
    steps:
      - id: read-claude
        operation: read
        object: file
        params: { file: 'claude.md' }
        locked: true
      - id: read-files
        operation: read
        object: files
        source: panel_a.files
      - id: read-issue-current
        operation: read
        object: issue
        source: panel_a.issue_number
      - id: read-issue-desired
        operation: read
        object: issue
        source: panel_b.issue_number
      - id: read-references
        operation: read
        object: files
        source: panel_b.guideline_files
      - id: create-branch
        operation: create
        object: branch
      - id: apply-improvements
        operation: edit
        object: files
        lenses: [] # populated from panel_b.lenses
      - id: verify
        operation: validate
        object: improvements
      - id: commit-pr
        operation: commit
        object: changes
        params: { open_pr: true }
```

---

## Quality Meter

A visual bar showing prompt completeness. Color transitions at thresholds. No exact percentage displayed.

### Scoring

Each input field has a fixed weight. Score = filled weights / total possible weights for the active flow.

| Field type                      | Weight |
| ------------------------------- | ------ |
| Required text field (filled)    | 25     |
| Required selector (filled)      | 20     |
| Optional text field (filled)    | 15     |
| File picker (1+ files selected) | 15     |
| Lens picker (1+ selected)       | 10     |
| Notes (filled)                  | 5      |

### Display thresholds

| Score range | Color  | Label   |
| ----------- | ------ | ------- |
| 0-30%       | Red    | Minimal |
| 31-55%      | Orange | Basic   |
| 56-75%      | Yellow | Good    |
| 76-100%     | Green  | Strong  |

The meter appears as a thin horizontal bar below the flow selector, always visible. It updates in real-time as fields are filled.

---

## Generated Prompt Structure

### Fix / Debug

```xml
<prompt>
  <context>
    Execute the following task for <repository> https://github.com/{{owner}}/{{repo}} </repository>
    on <branch> {{branch}} </branch>.
    Authenticate using PAT: <PAT> {{pat}} </PAT>.
  </context>
  <task flow="fix">
    <current_state>
      {{panel_a.description}}
      {{#if issue}}Related issue: #{{issue_number}}{{/if}}
      {{#if files}}Location: {{files as @-prefixed list}}{{/if}}
    </current_state>
    <expected_outcome>
      {{#if panel_b.description}}{{panel_b.description}}{{/if}}
      {{#if spec_files}}Specifications: {{spec_files as @-prefixed list}}{{/if}}
      {{#if guideline_files}}Guidelines: {{guideline_files as @-prefixed list}}{{/if}}
    </expected_outcome>
  </task>
  <todo>
    Step 1: Read @claude.md
    Step 2: Read {{all referenced files}}
    {{#if issue}}Step N: Read issue #{{issue_number}}{{/if}}
    Step N: Identify the root cause — focus on [{{lenses}}]
    Step N: Create new branch
    Step N: Implement fix — focus on [{{lenses}}]
    Step N: Run tests
    Step N: Commit changes and open PR
  </todo>
</prompt>
<notes>{{user_text}}</notes>
```

### Review / Analyze

```xml
<prompt>
  <context>...</context>
  <task flow="review">
    <subject>
      {{#if pr_number}}Review PR #{{pr_number}}{{/if}}
      {{#if files}}Review files: {{files as @-prefixed list}}{{/if}}
      {{#if panel_a.description}}Context: {{panel_a.description}}{{/if}}
    </subject>
    <criteria>
      {{#if lenses}}Focus on: [{{lenses}}]{{/if}}
      {{#if spec_files}}Evaluate against specifications: {{spec_files as @-prefixed list}}{{/if}}
      {{#if guideline_files}}Evaluate against guidelines: {{guideline_files as @-prefixed list}}{{/if}}
    </criteria>
  </task>
  <todo>
    Step 1: Read @claude.md
    {{#if spec/guideline files}}Step N: Read specification/guideline files{{/if}}
    {{#if pr}}Step N: Fetch and review PR #{{pr_number}} diff — focus on [{{lenses}}]{{/if}}
    {{#if files}}Step N: Read and analyze {{files}} — focus on [{{lenses}}]{{/if}}
    Step N: Provide structured feedback with file/line references
  </todo>
</prompt>
<notes>{{user_text}}</notes>
```

### Implement / Build

```xml
<prompt>
  <context>...</context>
  <task flow="implement">
    <context>
      {{#if panel_a.description}}{{panel_a.description}}{{/if}}
      {{#if panel_a.files}}Build upon: {{files as @-prefixed list}}{{/if}}
    </context>
    <requirements>
      {{panel_b.description}}
      {{#if spec_files}}Specifications: {{spec_files as @-prefixed list}}{{/if}}
      {{#if acceptance_criteria}}Acceptance criteria: {{acceptance_criteria}}{{/if}}
    </requirements>
  </task>
  <todo>
    Step 1: Read @claude.md
    {{#if starting files}}Step N: Read starting files{{/if}}
    {{#if spec_files}}Step N: Read specification files{{/if}}
    Step N: Create new branch
    Step N: Implement requirements — focus on [{{lenses}}]
    {{#if acceptance_criteria}}Step N: Verify acceptance criteria{{/if}}
    Step N: Run tests
    Step N: Commit changes and open PR
  </todo>
</prompt>
<notes>{{user_text}}</notes>
```

### Improve / Modify

```xml
<prompt>
  <context>...</context>
  <task flow="improve">
    <current_state>
      {{panel_a.description}}
      {{#if issue_a}}Related issue: #{{issue_number}}{{/if}}
      {{#if files}}Files to improve: {{files as @-prefixed list}}{{/if}}
    </current_state>
    <desired_outcome>
      {{#if lenses}}Focus on: [{{lenses}}]{{/if}}
      {{#if panel_b.description}}{{panel_b.description}}{{/if}}
      {{#if issue_b}}Desired state per issue: #{{issue_number}}{{/if}}
      {{#if guideline_files}}Reference: {{guideline_files as @-prefixed list}}{{/if}}
    </desired_outcome>
    {{#if improve_scope == "across_files"}}
    <scope>Apply improvements across all files as a unified change, considering relationships between files.</scope>
    {{/if}}
    {{#if improve_scope == "each_file"}}
    <scope>Apply improvements to each file independently.</scope>
    {{/if}}
  </task>
  <todo>
    Step 1: Read @claude.md
    Step N: Read {{files to improve}}
    {{#if issues}}Step N: Read issue(s){{/if}}
    {{#if guideline_files}}Step N: Read reference files{{/if}}
    Step N: Create new branch
    Step N: Apply improvements — focus on [{{lenses}}]
    Step N: Verify improvements
    Step N: Commit changes and open PR
  </todo>
</prompt>
<notes>{{user_text}}</notes>
```

---

## User Journey

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

### Card layout (4 cards)

1. **Card 1 — Configuration** (same as current spec CFG)
2. **Card 2 — Task** (replaces SCT): flow selector buttons at top, then dual-panel layout with flow-specific fields, quality meter bar
3. **Card 3 — Steps** (simplified STP): auto-generated step list with toggleable lenses and trash icons. No add/reorder.
4. **Card 4 — Prompt** (same as current OUT): preview + copy + notes + Open in Claude

---

## Spec vs. Guideline: UX Distinction — Decided: Labels + Helper Text

Two separate file pickers with tooltip/helper text to explain the distinction:

- **"Specifications"** — tooltip: "Documents that define WHAT should be built (requirements, user stories, design docs)"
- **"Guidelines"** — tooltip: "Documents that define HOW it should be built (coding standards, style guides)"

---

## Mapping to Existing Code

### `src/js/state.js` changes

- `DEFAULT_STATE` shape: replace `context.selected_files` with `panel_a`/`panel_b`, keep `steps.enabled_steps`, add `improve_scope`
- `PERSISTENT_KEYS` unchanged
- `setState()`/`getState()`/`subscribe()` pattern unchanged
- `resetSession()` resets panel and step fields
- New: step auto-generation logic when flow or fields change

### `src/js/prompt-builder.js` changes

- `buildPrompt()` switches on `state.task.flow_id` to select the right prompt template
- Each flow has a template function that interpolates panel values AND step list
- `formatStep()` stays but generates from auto-built steps rather than purely user-defined
- Determinism (DM-INV-03) preserved — same input always produces same output

### `src/config/flows.yaml` changes

- Complete rewrite with the YAML structure shown above (4 flows with field + step definitions)
- Build-time validation (DM-DEF-02) validates the new schema
- Steps defined per flow with `source` references to conditional fields

### `src/index.html` changes

- Card 2 becomes dual-panel task card with flow-specific field rendering
- Card 3 stays as simplified steps card (auto-generated, lens toggles, trash icons)
- Quality meter bar added to Card 2

---

## Resolved Decisions

| #   | Question                | Decision                                      |
| --- | ----------------------- | --------------------------------------------- |
| 1   | Panel naming            | Option D: Situation / Target + flow subtitles |
| 2   | Spec vs. Guideline UX   | Labels + tooltip helper text                  |
| 3   | Quality meter placement | Below flow selector                           |

---

## Comparison Matrix

| Criterion                        | F1: Three Signals | F2: Behavioral Delta | F3: Smart Recipes | F4: Waypoint Nav | F5: Effort Tiers | **Hybrid (User)** |
| -------------------------------- | :---------------: | :------------------: | :---------------: | :--------------: | :--------------: | :---------------: |
| **Min user effort**              |     Low (20s)     |     Medium (30s)     |     Low (25s)     |    Low (20s)     |  Very low (10s)  | **Medium (30s)**  |
| **Max precision ceiling**        |      Medium       |         High         |       High        |    Very high     |    Very high     |     **High**      |
| **Flow/mode count**              |         3         |          3           |         6         |        3         |   0 (3 tiers)    |       **4**       |
| **Learning curve**               |     Very low      |         Low          |      Medium       |      Medium      |     Very low     |      **Low**      |
| **Lazy-user prompt quality**     |       Good        |         Good         |       Good        |       Good       |       Weak       |     **Good**      |
| **Thorough-user prompt quality** |       Good        |      Very good       |     Very good     |    Excellent     |    Excellent     |   **Very good**   |
| **Prevents file searching**      |       Good        |         Good         |       Good        |    Excellent     |     Variable     |     **Good**      |
| **Prevents context clogging**    |      Medium       |         Good         |       Good        |    Excellent     |     Variable     |     **Good**      |
| **Prevents wrong direction**     |      Medium       |      Very good       |       Good        |       Good       |     Variable     |   **Very good**   |
| **Fits "review PR" task**        |      Awkward      |       Awkward        |      Natural      |     Awkward      |     Natural      |    **Natural**    |
| **Fits "fix bug" task**          |      Natural      |      Excellent       |      Natural      |     Natural      |     Natural      |   **Excellent**   |
| **Fits "new feature" task**      |      Natural      |         Good         |      Natural      |       Good       |     Natural      |    **Natural**    |
| **Implementation complexity**    |        Low        |      Low-medium      |      Medium       |   Medium-high    |       High       |    **Medium**     |
| **Migration from current spec**  |   Major rewrite   |    Major rewrite     |    Incremental    |  Major rewrite   |  Major rewrite   |   **Moderate**    |

