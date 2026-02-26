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
  }

  steps: {
    enabled_steps: [{               # auto-generated from flow, user can fine-tune
      id: str,
      operation: str,
      object: str,
      lenses: [str],                # user-adjustable focus lenses
      name_provided: str,           # by default name for new Branch/PR/file will be up to the llm, but user has the option to provide name in input text field if they want.
      directory: str,               # folder where to place newly created files
      output: str,                  # user-adjustable output types, user can toggle in steps where they want output: in llm interface, pr_comment, pr_inline_comment, issue_comment, file_report, etc. Defaults per flow are selected.
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

| Field                         |   Fix/Debug    | Review/Analyze |  Implement/Build  |  Improve/Modify   |
| ----------------------------- | :------------: | :------------: | :---------------: | :---------------: |
| **Panel A (Situation)**       |                |                |                   |                   |
| `panel_a.description`         |   Required\*   |    Optional    |     Optional      |    Required\*     |
| `panel_a.issue_number`        |   Required\*   |       —        |         —         |    Required\*     |
| `panel_a.pr_number`           |       —        |  Required\*\*  |         —         |         —         |
| `panel_a.files`               |    Optional    |  Required\*\*  |     Optional      |     Optional      |
| **Panel B (Target)**          |                |                |                   |                   |
| `panel_b.description`         |   Required\*   |   Required\*   |    Required\*     |     Optional      |
| `Step lenses`                 |       —        |   Required\*   |         —         |    Required\*     |
| `panel_b.issue_number`        |   Required\*   |       —        | Hidden required\* | Hidden Required\* |
| `panel_b.user_story_template` |       —        |       —        | Hidden Required\* | Hidden Required\* |
| `panel_b.spec_files`          |    Optional    |    Optional    |     Optional      |         —         |
| `panel_b.guideline_files`     |    Optional    |    Optional    |         —         |     Optional      |
| `panel_b.acceptance_criteria` |       —        |       —        |     Optional      |         —         |
| **Steps**                     |                |                |                   |                   |
| `steps.enabled_steps`         | Auto-generated | Auto-generated |  Auto-generated   |  Auto-generated   |
| `lenses`                      |    Per step    |    Per step    |     Per step      |     Per step      |
| `file_name  `                 |    Per step    |    Per step    |     Per step      |     Per step      |
| `pr_name  `                   |    Per step    |    Per step    |     Per step      |     Per step      |
| `pr_name  `                   |    Per step    |    Per step    |     Per step      |     Per step      |
| `output `                     |    Per step    |    Per step    |     Per step      |     Per step      |
| **Other**                     |                |                |                   |                   |
| `improve_scope`               |       —        | Shown 2+ files |         —         |  Shown 2+ files   |
| `notes.user_text`             |    Optional    |    Optional    |     Optional      |     Optional      |

`*` = At least one field marked `*` in Panelmust be filled.
`**` = Review flow: at least one of PR or files required. Either or both can be filled. In the prompt, PR input results in "review the PR diff" instruction; file input results in "review these files" instruction. When both are provided, both are included.

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
   - Determine new file/pr/branch names (override default of letting the llm ).
   - Remove any step (trash icon)
   - Steps cannot be reordered or added manually (keeps it simple)

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

## Quality Meter

A visual bar showing prompt completeness. Color transitions at thresholds. No exact percentage displayed.

### Scoring

Each input field has a fixed weight. Score = filled weights / total possible weights for the active flow.

| Flow              | Base Weight |
| ----------------- | ----------- |
| Fix / Debug       | 30          |
| Review / Analyse  | 40          |
| Improve / Modify  | 40          |
| Implement / Build | 40          |

| Field type                      | Weight |
| ------------------------------- | ------ |
| selector PR                     | 20     |
| File picker (1+ files selected) | 10     |
| text field filled               | 10     |
| Notes (filled)                  | 10     |
| Lens picker (1+ selected)       | 5      |
| selector issue                  | 5      |

### Display thresholds

| Score range | Color  | Label     |
| ----------- | ------ | --------- |
| 0-50%       | Red    | Poor      |
| 51-60%      | Orange | Minimal   |
| 61-70%      | Yellow | Basic     |
| 71-80%      | lime   | Good      |
| 78-90%      | lGreen | Strong    |
| 91-100%     | Green  | Excellent |

The meter appears as a thin horizontal bar below the flow selector, always visible. It updates in real-time as fields are filled.

---

## Generated Prompt Structure

### Fix / Debug

```xml
<prompt>
  <context>
    Pleasae help <task="debug"> {{task}} </task> by executing below 'todo' steps
    for <repository> https://github.com/{{owner}}/{{repo}} </repository>
    on <branch> {{branch}} </branch>.
    Authenticate using PAT: <PAT> {{pat}} </PAT>.
    Please provide one sentence feedback to HUMAN (me) here (in this interface) after each step (except step 1), and proceed to next step.
  </context>
  <todo>
    Step 1: Read @claude.md
    Step N: Read and investigate the `undesired_behavior` and `expected_behavior` to understand the issue:
              <undesired_behavior>
                {{#if description}} Undisered behavior observed by user is: {{description}}. {{/if}}
                {{#if issue}} Attempt to learn more regarding the undesired behavior by reading issue #{{issue_number}}. {{/if}}
                {{#if files}} Attempt to learn more regarding the undesired behavior by reading file {{files as @-prefixed list}}. {{/if}}
              </undesired_behavior>
              <expected_behavior>
                {{#if description}} Undisered behavior observed by user is: {{description}}. {{/if}}
                {{#if issue}} Attempt to learn more regarding the undesired behavior by reading issue #{{issue_number}}. {{/if}}
                {{#if file}} Attempt to learn more regarding the undesired behavior by reading file {{file}}. {{/if}}
               </expected_behavior>
             If unclear or high ambiguity, STOP and DONOT proceed to next steps, share your interpreation with HUMAN and ask for confirmation or clarification, and await HUMAN feedback.
    Step N: Identify the root cause. {{#if lenses}} Focus on: {{lenses}}] {{/if}}
    Step N: Create new branch. {{#if branch_name}} Name it {{branch_name}}] {{/if}}
    Step N: Implement fix. {{#if lenses}} Focus on: {{lenses}}] {{/if}}
    Step N: Run tests.
    Step N: Verify if 'undisered_behavior' is resolved and 'expected_behavior' is realized.
    Step N: Commit changes and open PR. {{#if pr_name}} Name it {{branch_name}}] {{/if}}
    Step N: Provide consice feedback to HUMAN (me) here (in this interface) include:
              - Your understanding of the issue in one sentence.
              - The root caue you identified.
              - The action your took: create branch (incl name and link), implemented fix by editing files (incl files names), ran tests (incl which ones), verfiied issue is solved, commited PR (incl PR name and link)
  </todo>
</prompt>
<notes>
    Critical note: {{user_text}}
</notes>

```

### Review / Analyze

```xml
<prompt>
  <context>
    Please help <task="review"> {{task}} </task> by executing below 'todo' steps
    for <repository> https://github.com/{{owner}}/{{repo}} </repository>
    on <branch> {{branch}} </branch>.
    Authenticate using PAT: <PAT> {{pat}} </PAT>.
    Please provide one sentence feedback to HUMAN (me) here (in this interface) after each step (except step 1), and proceed to next step.
  </context>
  <todo>
    Step 1: Read @claude.md
    Step N: Read and investigate the `review_subject` and `review_criteria` to understand what to review:
              <review_subject>
                {{#if pr_number}}Review PR #{{pr_number}}. Fetch and examine the PR diff. {{/if}}
                {{#if files}}Review files: {{files as @-prefixed list}}. Read and examine each file. {{/if}}
                {{#if panel_a.description}}Context provided by user: {{panel_a.description}}. {{/if}}
              </review_subject>
              <review_criteria>
                {{#if lenses}}Focus on: [{{lenses}}]. {{/if}}
                {{#if spec_files}}Evaluate against specifications: {{spec_files as @-prefixed list}}. {{/if}}
                {{#if guideline_files}}Evaluate against guidelines: {{guideline_files as @-prefixed list}}. {{/if}}
              </review_criteria>
             If unclear or high ambiguity about what to review or the criteria, STOP and DONOT proceed to next steps, share your interpretation with HUMAN and ask for confirmation or clarification, and await HUMAN feedback.
    Step N: Provide structured feedback with specific file/line references, organized by severity (critical issues, suggestions, nitpicks).

 {{if output="here"}}
       Step N: Provide concise feedback to HUMAN (me) here (in this interface) include:
              - Summary of what you reviewed in one sentence.
              - Number of issues found by severity.
              - Top 3 most important findings with file/line references.
 {{/if}}
 {{if output="pr_comment"}}
       Step N: Provide feedback in PR comment on PR {{PR number}} include:
              - Summary of what you reviewed in one sentence.
              - Number of issues found by severity label.
              - Top 3 most important findings with file/line references.
              - Provide link to PR commment to HUMAN (me) here (in this interface) include.
 {{/if}}
 {{if output="pr_inline_comments"}}
       Step N: Provide feedback via PR inline comment at relevant line numbers and include:
              - Issue you found.
              - severity label.
              - Suggested fix.
 {{/if}}

 {{/if}}
  </todo>
</prompt>
<notes>
    Critical note: {{user_text}}
</notes>
```

### Implement / Build

```xml
<prompt>
  <context>
    Please help <task="implement"> {{task}} </task> by executing below 'todo' steps
    for <repository> https://github.com/{{owner}}/{{repo}} </repository>
    on <branch> {{branch}} </branch>.
    Authenticate using PAT: <PAT> {{pat}} </PAT>.
    Please provide one sentence feedback to HUMAN (me) here (in this interface) after each step (except step 1), and proceed to next step.
  </context>
  <todo>
    Step 1: Read @claude.md
    Step N: Read and investigate the `existing_context` and `requirements` to understand what to build:
              <existing_context>
                {{#if panel_a.description}}Context provided by user: {{panel_a.description}}. {{/if}}
                {{#if panel_a.files}}Build upon existing files: {{files as @-prefixed list}}. {{/if}}
              </existing_context>
              <requirements>
                {{panel_b.description}}
                {{#if spec_files}}Specifications to follow: {{spec_files as @-prefixed list}}. {{/if}}
                {{#if acceptance_criteria}}Acceptance criteria: {{acceptance_criteria}}. {{/if}}
              </requirements>
             If unclear or high ambiguity about what to build, STOP and DONOT proceed to next steps, share your interpretation with HUMAN and ask for confirmation or clarification, and await HUMAN feedback.
    Step N: Create new branch. {{#if branch_name}} Name it {{branch_name}}. {{/if}}
    Step N: Implement requirements. {{#if lenses}} Focus on: [{{lenses}}]. {{/if}}
    Step N: Run tests.
    {{#if acceptance_criteria}}Step N: Verify acceptance criteria: {{acceptance_criteria}}. {{/if}}
    Step N: Commit changes and open PR. {{#if pr_name}} Name it {{pr_name}}. {{/if}}
    Step N: Provide concise feedback to HUMAN (me) here (in this interface) include:
              - Summary of what you implemented in one sentence.
              - Files created or modified with brief description of changes.
              - Tests run and results.
              - PR link.
  </todo>
</prompt>
<notes>
    Critical note: {{user_text}}
</notes>
```

### Improve / Modify

```xml
<prompt>
  <context>
    Please help <task="improve"> {{task}} </task> by executing below 'todo' steps
    for <repository> https://github.com/{{owner}}/{{repo}} </repository>
    on <branch> {{branch}} </branch>.
    Authenticate using PAT: <PAT> {{pat}} </PAT>.
    Please provide one sentence feedback to HUMAN (me) here (in this interface) after each step (except step 1), and proceed to next step.
  </context>
  <todo>
    Step 1: Read @claude.md
    Step N: Read and investigate the `current_state` and `desired_outcome` to understand what to improve:
              <current_state>
                {{panel_a.description}}
                {{#if issue_a}}Related issue describing current state: #{{issue_a}}. Read this issue for context. {{/if}}
                {{#if files}}Files to improve: {{files as @-prefixed list}}. {{/if}}
              </current_state>
              <desired_outcome>
                {{#if panel_b.description}}Desired improvements: {{panel_b.description}}. {{/if}}
                {{#if issue_b}}Desired state per issue: #{{issue_b}}. Read this issue for target state. {{/if}}
                {{#if guideline_files}}Reference files for target style: {{guideline_files as @-prefixed list}}. {{/if}}
                {{#if lenses}}Focus on: [{{lenses}}]. {{/if}}
              </desired_outcome>
              {{#if improve_scope == "across_files"}}
              <scope>Apply improvements across all files as a unified change, considering relationships between files.</scope>
              {{/if}}
              {{#if improve_scope == "each_file"}}
              <scope>Apply improvements to each file independently.</scope>
              {{/if}}
             If unclear or high ambiguity about what improvements to make, STOP and DONOT proceed to next steps, share your interpretation with HUMAN and ask for confirmation or clarification, and await HUMAN feedback.
    Step N: Create new branch. {{#if branch_name}} Name it {{branch_name}}. {{/if}}
    Step N: Apply improvements.
    Step N: Verify improvements meet the desired outcome.
    Step N: Commit changes and open PR. {{#if pr_name}} Name it {{pr_name}}. {{/if}}
    Step N: Provide concise feedback to HUMAN (me) here (in this interface) include:
              - Summary of improvements made one sentence each improvement type.
              - Files modified with brief description of changes.
              - How the improvements address the desired outcome.
              - PR link.
  </todo>
</prompt>
<notes>
    Critical note: {{user_text}}
</notes>
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
| Step output toggled        | Prompt preview updates                               | Update `steps.enabled_steps[n].output`               |
| Step name provide          | Prompt preview updates                               | Update `steps.enabled_steps[n].name_provided`        |
| Step removed               | Step disappears; prompt updates                      | Remove from `steps.enabled_steps`                    |
| Improve: 2+ files selected | Scope selector appears                               | —                                                    |
| Scope selected             | Steps update with scope instruction                  | Set `improve_scope`                                  |
| Any `prompt_input` change  | Prompt preview updates                               | Rebuild prompt (DM-INV-02)                           |
| Copy clicked               | "Copied!" feedback                                   | Copy prompt to clipboard                             |

### Card layout (4 cards)

1. **Card 1 — Configuration** (same as current spec CFG)
2. **Card 2 — Task** (replaces SCT): flow selector buttons at top, then dual-panel layout with flow-specific fields, quality meter bar
3. **Card 3 — Steps**: auto-generated step list with toggleable lenses, optional fields, filename addiiton text fields, and trash icons. No add/reorder.
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
