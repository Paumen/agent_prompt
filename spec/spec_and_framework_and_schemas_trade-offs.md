• Back-end: many small atomic tasks/subtasks (for reliable prompt building + agent execution)
• Front-end: a few simple “flows” (task bundles) that progressively reveal details only when needed, while still letting power users see everything (collapsed) with defaults preselected.

---

0. Core idea (so it stays coherent)
   Two layers
   A) Atomic Task Model (back-end)
   Everything the agent can do is one of these atomic tasks:

1) Load context (PR/commit/issue/files/folders)
2) Analyze (run lenses)
3) Plan (decide actions + risks)
4) Generate artifacts (review text, inline comments, patches, new files)
5) Apply changes (branch/commit/open PR/write comments)
6) Verify (tests/checks/formatting)
7) Report (summary + next steps)
   Atomic tasks are composable into flows.
   B) Flows (front-end)
   Users pick a “flow” that bundles multiple atomic tasks into a guided experience:
   • Review PR
   • Fix PR
   • Create from spec
   • Rewrite docs
   • Refactor structure
   • Operate GitHub (branches/PR/issues/workflows/projects)

---

1. Your task grammar (canonical schema)
   Use this grammar everywhere (UI → variable map → prompt generator → agent runner):
   1.1 Canonical “Task Request” object
   intent:
   mode: review | fix | create | refactor | operate
   taskid: string # from catalog, e.g. review.pr.diff
   target:
   type: pr | commit | issue | files | folder | workflow | project
   id: string # PR#, SHA, issue#, workflow name, etc.
   scope:
   include: # context to load - diff | comments | filestouched | fullfiles | issuebody | issuecomments - filepaths: [] # optional explicit list - folderpaths: [] # optional explicit list
   filters:
   includeglobs: [] # e.g. ["src//.ts"]
   excludeglobs: [] # e.g. ["/.snap"]
   maxfiles: number
   maxlines: number
   lens:
   selected: # show all in UI; default = all selected - syntax - semantics - interdependencies - structure - efficiency - conflicts - redundancies - duplications - ambiguity
   priorities: [] # optional ordering or weights
   output:
   destination: - prreviewcomment - prinlinecomments - commitinlinecomments - issuecomment - newreviewfile - patchonly - branchcommit - branchcommitopenpr - createfilesonly
   format: markdown | githubreview | unifieddiff | json
   apply:
   writemode: draftonly | applychanges
   branch:
   name: string | null
   base: string | null
   commit:
   message: string | null
   pr:
   title: string | null
   body: string | null
   reviewers: []
   labels: []
   constraints:
   risklevel: low | medium | high
   timebudget: short | normal | deep
   assumptions: []
   model:
   family: modelagnostic | openai | anthropic | other
   styleprofile: default | terse | detailed
   This schema is your “source of truth”.

---

2. Lens framework (show all, preselected)
   You explicitly want all lenses visible and selected by default, with the ability to unselect.
   2.1 Lens list (UI chips with “All selected” default)
   • ✅ Syntax
   • ✅ Semantics
   • ✅ Interdependencies
   • ✅ Structure
   • ✅ Efficiency
   • ✅ Conflicts
   • ✅ Redundancies
   • ✅ Duplications
   • ✅ Ambiguity
   Optional add-ons (hidden behind “More”)
   If you want to expand later without breaking v1:
   • Security
   • Testing
   • Docs/Spec compliance
   • Observability (logging/metrics)
   2.2 Lens behavior rules (important)
   • Default: all selected
   • If user unselects all → automatically revert to Semantics + Structure (safe minimum)
   • If target is Operate → hide lenses by default (they don’t apply), but keep an “Advanced” toggle.

---

3. Full catalog (back-end atomic tasks + user-facing flows)
   You said: back-end should have separate tasks/subtasks, but front-end shows task flows that might bundle multiple tasks.
   So:
   • Task catalog: atomic tasks (fine-grained)
   • Flow catalog: bundles of tasks (what user selects)
   3.1 Atomic Task Catalog (back-end)
   Below are the atomic tasks you’ll reuse everywhere.
   A) Context loading tasks
   • ctx.load.pr (diff, files touched, comments, metadata)
   • ctx.load.commit (diff, parent, changed files)
   • ctx.load.issue (body, comments, labels, linked PRs)
   • ctx.load.files (file contents)
   • ctx.load.folder (tree + file contents)
   • ctx.load.workflow (YAML, runs, logs if available)
   • ctx.load.project (projects, fields/cards)
   B) Analysis tasks (run lenses)
   • analyze.code.lenses (apply selected lenses to code artifacts)
   • analyze.diff.lenses
   • analyze.comments.triage (cluster comments, detect unresolved threads)
   • analyze.duplicates (duplication/redundancy scan)
   • analyze.conflicts (merge conflict risk / divergent changes)
   • analyze.spec_alignment (compare spec/docs vs implementation)
   C) Planning tasks
   • plan.review (severity ranking + recommendations)
   • plan.patch (change plan + file touch list + risk)
   • plan.refactor (file/folder move plan + dependencies)
   • plan.ops (execution plan, dry-run steps)
   D) Artifact generation tasks
   • gen.review.summary (PR comment style summary)
   • gen.review.inline (inline comments with locations)
   • gen.review.file (create review.md)
   • gen.patch.unified_diff
   • gen.files.from_spec (create files from description/spec)
   • gen.rewrite.docs (rewrite existing docs/specs)
   • gen.rewrite.code (rewrite / refactor code body)
   • gen.commit_message
   • gen.pr_title_body
   E) Apply/write tasks (guarded)
   • apply.branch.create
   • apply.commit.create
   • apply.pr.open
   • apply.comment.post
   • apply.inline.post
   • apply.file.write (new/modified files)
   • apply.branch.merge/delete
   • apply.pr.merge/delete
   • apply.issue.create/update/label/assign/link
   • apply.workflow.trigger/create/modify
   • apply.project.create/update
   F) Verify tasks
   • verify.format (lint/format instructions, optional)
   • verify.tests.plan (what to run)
   • verify.checklist (manual verification list)

---

3.2 Flow Catalog (front-end “task flows”)
These are the flows users pick first. Each flow maps to a bundle of atomic tasks.

1. Review flows (read-only by default)

1) Review PR
   o tasks: ctx.load.pr → analyze.diff.lenses → plan.review → gen.review.summary|inline|file
2) Investigate PR comments
   o tasks: ctx.load.pr (comments) → analyze.comments.triage → plan.review → output
3) Review Commit
   o tasks: ctx.load.commit → analyze.diff.lenses → plan.review → output
4) Review Files / Folder
   o tasks: ctx.load.files|folder → analyze.code.lenses → output
5) Compare Files / Folder
   o tasks: ctx.load.files|folder → analyze.duplicates + analyze.conflicts → output
6) Investigate Issue
   o tasks: ctx.load.issue → plan.review → output

2. Fix flows (draft patch by default; apply optional)

7) Fix PR
   o tasks: ctx.load.pr → analyze.diff.lenses → plan.patch → gen.patch.unified_diff → optional apply tasks
8) Fix Files
   o tasks: ctx.load.files → analyze.code.lenses → plan.patch → patch → optional apply

3. Create / Rewrite flows (your added requirement)

9) Create file(s) from spec/description
   o tasks: ctx.load.folder (target location) → gen.files.from_spec → optional apply.file.write + apply.commit.create + PR
10) Rewrite / update existing file(s)
    • tasks: ctx.load.files → gen.rewrite.docs|code → patch → optional apply
11) Write docs from code (reverse)
    • tasks: ctx.load.files → analyze.code.lenses → gen.files.from_spec (docs) → apply optional

4. Refactor structure flows

12) Merge files
13) Split file
14) Move/rename files
15) Remove files/folders
    • each: ctx.load.folder → plan.refactor → gen.patch → optional apply

5. Operate flows (always dry-run first)

16) Branch ops: create/merge/delete
17) PR ops: create/merge/delete, add reviewers/labels, link issue
18) Issue ops: create/delete/label/assign/link/merge
19) Workflow ops: trigger/create/modify
20) Project ops: create/edit/delete/move cards/fields

---

4. Defaults (so users see everything but succeed fast)
   4.1 Default choices by flow
   Review PR (default)
   • Scope: ✅ diff + ✅ files_touched metadata
   • Lenses: ✅ all selected
   • Output: pr_review_comment (default), inline comments only for “High confidence” findings
   • Apply: draft_only
   Fix PR (default)
   • Scope: ✅ diff + ✅ files_touched
   • Lenses: ✅ all
   • Output: patch_only
   • Apply: draft_only (user can toggle “Apply changes”)
   Create from spec (default)
   • Scope: folder path only + any referenced files user chooses
   • Lenses: ✅ structure + ✅ semantics + ✅ interdependencies + ✅ ambiguity (keep all selected visible, but these can be highlighted)
   • Output: create_files_only + patch_only
   • Apply: off
   Operate flows (default)
   • Dry-run always shown first
   • Apply requires explicit “Execute” step

---

5. Decision tree (what gets shown when)
   This is the simplest tree that still supports all your combinations.
   Start
   ├─ Pick Flow (one of 20 flows)
   │ ├─ Auto-set Mode + Target type + Default Output + Default Scope
   │ └─ Reveal Stepper
   ├─ Identify Target (PR#/SHA/Issue#/Files/Folder/Workflow/Project)
   ├─ Scope (what to load)
   │ ├─ Quick scope presets (default preselected)
   │ └─ Detailed scope (include/exclude globs, max files/lines)
   ├─ Lenses (all shown, all selected)
   │ └─ Optional “Prioritize” ordering
   ├─ Output (destination + format)
   ├─ Apply (draft vs apply)
   │ ├─ If apply: branch + commit + PR fields appear
   │ └─ If destructive ops: show confirmation + dry-run summary
   └─ Prompt Preview (copy) + (optional) Run Agent

---

6. Stepper screens (web page / GitHub App UI)
   You asked for stepper screens and field behavior. Here’s a concrete stepper design.
   Screen 1 — “What do you want to do?”
   UI: Flow cards (20 flows grouped)
   • Review (PR/Commit/Files/Compare/Issue)
   • Fix (PR/Files)
   • Create/Rewrite (Create from spec, Rewrite, Docs from code)
   • Refactor (Merge/Split/Move/Remove)
   • Operate (Branch/PR/Issue/Workflow/Project)
   Behavior
   • Selecting a flow sets defaults and determines which next screens are required.
   • Show a tiny “defaults preview” under each card:
   o output default + apply default

---

Screen 2 — “Select Target”
Fields (conditional)
• PR #: number picker + repo selector (if needed)
• Commit SHA: text + auto-validate
• Issue #: number picker
• Files: file picker (tree) with search
• Folder: folder picker
• Workflow/Project: dropdown list
Behavior
• If launched inside a PR/Issue context (GitHub App) → auto-fill target and skip to screen 3.

---

Screen 3 — “Scope”
Always show:
• Included artifacts checklist (defaults preselected):
o Diff
o Comments
o Files touched
o Full file contents (expensive)
o Issue body / comments (for issue flows)
Detailed scope (collapsed by default)
• Include globs
• Exclude globs
• Max files / max lines
• “Exclude generated/vendor” toggle
Behavior
• Show a live “scope preview” (file list + counts).
• If user selects “Full file contents”, show warning: “May increase cost/time”.

---

Screen 4 — “Lenses”
Requirement: show all lenses, all selected.
UI:
• 9 lens checkboxes (all checked)
• Optional “Prioritize” drag order (collapsed)
• Optional “Strictness” slider:
o “Relaxed” → fewer suggestions
o “Strict” → comprehensive review
Behavior
• Unselecting a lens reduces analysis instructions, not scope.
• If all lenses unchecked → auto-select Semantics + Structure (with toast).

---

Screen 5 — “Output”
Destination
• For review flows: PR comment / inline / review file / issue comment
• For fix/create/refactor: patch / create files / branch+commit / branch+commit+open PR
Format
• Markdown
• GitHub Review format
• Unified diff
Behavior
• Inline comments option appears only when diffs are in scope.
• “Review file” asks for filename (default: review.md or reviews/<pr>-review.md).

---

Screen 6 — “Apply changes” (only if relevant)
Toggle
• ✅ Draft only (default)
• ☐ Apply changes
If Apply changes enabled, show:
• Branch name (default: llm/<task_id>/<short-target-id>)
• Commit message (auto-generated; editable)
• PR title/body (auto-generated; editable)
• Reviewers/labels (optional)
Safety behavior
• Destructive ops: require typed confirmation (DELETE) and show dry-run plan first.
• Always show “What will change” summary before execution.

---

Screen 7 — “Prompt Preview & Run”
Two tabs
• Prompt (copy): the filled template
• JSON request: the canonical schema object (for API)
Buttons
• Copy prompt
• Download .md prompt
• Run (if agent execution enabled)

---

7. Variable map (UI → canonical object → prompt placeholders)
   Below is the mapping you’ll implement.
   7.1 Key variables
   • {{mode}} → intent.mode
   • {{task_id}} → intent.task_id
   • {{target_type}} → target.type
   • {{target_id}} → target.id
   • {{scope_include}} → scope.include
   • {{include_globs}} / {{exclude_globs}}
   • {{lens_selected}} → lens.selected
   • {{output_destination}} → output.destination
   • {{output_format}} → output.format
   • {{write_mode}} → apply.write_mode
   • {{branch_name}} / {{commit_message}} / {{pr_title}} / {{pr_body}}
   • {{risk_level}} / {{time_budget}}
   • {{loaded_artifacts}} (populated by context loader if you run agent; otherwise empty for copy-only)
   7.2 “Prompt modules” mapping
   Build the prompt from modules so model-specific adapters are easy.
   • Module A: Role + operating rules
   • Module B: Task definition (mode/task/target)
   • Module C: Context requested (scope)
   • Module D: Lens instructions
   • Module E: Output contract (destination + format)
   • Module F: Apply plan (if apply)
   • Module G: Reporting format (what sections to produce)

---

8. Prompt templates (model-agnostic + adapters)
   8.1 Model-agnostic base template (recommended)
   You are an LLM agent working in a GitHub repository context.

TASK

- MODE: {{mode}}
- TASKID: {{taskid}}
- TARGET: {{targettype}} {{targetid}}

SCOPE (load and use only what is listed)

- Include: {{scopeinclude}}
- Include globs: {{includeglobs}}
- Exclude globs: {{excludeglobs}}
- Limits: maxfiles={{maxfiles}}, maxlines={{maxlines}}

LENSES (all selected unless user unchecked)
{{lensselected}}

CONSTRAINTS

- Risk level: {{risklevel}}
- Time budget: {{timebudget}}
- Assumptions: {{assumptions}}

OUTPUT CONTRACT

- Destination: {{outputdestination}}
- Format: {{outputformat}}

APPLY (only if enabled)

- Write mode: {{writemode}}
- Branch: {{branchname}}
- Commit message: {{commitmessage}}
- PR: {{prtitle}}

RESPONSE FORMAT

1. Scope summary (what you used)
2. Findings ranked (P0/P1/P2) with file/line references when possible
3. Recommendations / Patch
4. Risks & tradeoffs
5. Verification checklist (tests/commands or manual steps)

INPUT ARTIFACTS
{{loaded_artifacts}}
8.2 Model-specific “wrappers” (optional)
Keep the content identical, only adjust formatting wrappers:
• Anthropic-style adapter: wrap sections in XML tags (<task>...</task>) for easier parsing
• OpenAI-style adapter: provide a JSON header block before the natural language instructions
• “Strict tool mode” adapter: add “Return JSON only” schemas when calling tools
This meets your “model-agnostic, with specific configs” goal.

---

9. File creation + writes + rewrites (explicit support)
   You asked to include:
   • file creation from spec/description
   • writes
   • rewrites
   Here’s how to represent them consistently.
   9.1 Create from spec (inputs)
   Add a “Spec” panel in scope:
   • Spec source:
   o Text input
   o Link to issue/PR comment
   o Existing spec file(s)
   • Output location:
   o folder path
   o file names list
   • Constraints:
   o language/framework
   o style conventions
   o “must integrate with existing modules” toggle
   9.2 Rewrite (inputs)
   • Select files
   • Rewrite type:
   o Improve clarity/readability
   o Reorganize structure
   o Update to match spec
   • Preserve behavior toggle (default ON)
   • Optional: “no public API changes” toggle
   9.3 Output options for create/rewrite
   • Patch only (default)
   • Create files only
   • Branch + commit
   • Branch + commit + open PR

---

10. Safety + quality guardrails (especially for “apply changes”)
    Always implement these behaviors:

1) Draft-only default for anything that modifies the repo
2) Dry-run plan shown before destructive ops
3) Minimal-diff preference (no drive-by refactors unless selected)
4) Scope enforcement: never touch files outside selected scope unless user explicitly expands scope
5) Change budget option (max files changed, max lines changed)
   These guardrails should also be encoded into the prompt rules.

---

11. Putting it together: “Task spec” system (data-driven UI + prompt)
    You’ll want a declarative spec that drives:
    • which screens appear
    • which fields are required
    • defaults
    • what atomic tasks run
    • what output destinations are allowed
    Example flow spec (conceptual)
    flow:
    id: review.pr
    label: "Review PR"
    mode: review
    targettype: pr
    requiredfields: [target.id]
    defaults:
    scope.include: [diff, filestouched]
    lens.selected: [syntax, semantics, interdependencies, structure, efficiency, conflicts, redundancies, duplications, ambiguity]
    output.destination: prreviewcomment
    output.format: githubreview
    apply.writemode: draftonly
    allowed:
    output.destination: [prreviewcomment, prinlinecomments, newreviewfile]
    pipeline: - ctx.load.pr - analyze.diff.lenses - plan.review - gen.review.summary
    This lets you keep back-end granularity while keeping front-end simple.

---

12. What you get if you implement this framework
    • A UI that’s intuitive (flow-first)
    • A back-end that’s precise (atomic tasks)
    • A prompt generator that’s consistent (canonical schema + module-based template)
    • “All options visible” without overload (collapsed sections + defaults preselected)
    • Clean support for create/rewrite/apply with guardrails

---

 

---

1. The core model (two-layer architecture)
   1.1 Backend: atomic tasks (small, composable)
   Atomic tasks are predictable and let you build prompts/agent actions reliably.
   Atomic task phases

1) context — locate & load repo artifacts (PR/commit/issue/files/folders)
2) analyze — run selected lenses + extract findings
3) plan — decide minimal changes / refactor steps / ops plan
4) generate — produce review text / patches / new files / commit/PR text
5) apply — write to GitHub (branch/commit/PR/comments/files)
6) verify — propose tests/checks + sanity validation
7) report — summarize actions + risks + next steps
   1.2 Frontend: flows (simple user choices)
   User sees flow-first choices (few), each flow bundles multiple atomic tasks (many).
   Example: Fix PR flow = load PR → analyze diff → plan patch → generate patch → (optional) apply changes → verify → report.

---

2. Canonical request schema (your single “source of truth”)
   Everything in the UI maps to this object. Your prompt generator simply fills it.
   request:
   intent:
   flowid: string # e.g. "fix.pr"
   mode: review|fix|create|refactor|operate
   title: string # friendly display name
   target:
   repo: string # owner/name or implicit
   type: pr|commit|issue|files|folder|workflow|project
   id: string|null # PR#, SHA, Issue#, workflow name, etc.
   ref: string|null # branch/tag if relevant
   scope: # Because agent can find diffs itself, scope is mostly "what to consider"
   consider: - diff - comments - filestouched - fullfiles - issuebody - issuecomments - relatedprs - relatedissues - cilogs - repotree
   filters:
   includeglobs: [] # optional
   excludeglobs: []
   paths: [] # explicit file/folder paths
   maxfiles: 50
   maxlines: 8000
   excludegenerated: true
   lens: # UI shows all lenses, all selected by default
   selected: - syntax - semantics - interdependencies - structure - efficiency - conflicts - redundancies - duplications - ambiguity
   strictness: normal # relaxed|normal|strict
   priorities: [] # optional ordering
   create: # only for create/rewrite flows
   specsource:
   type: text|issue|file|url
   value: string
   scaffold:
   enabled: false
   template: component|service|cli|library|api|docs|tests|fullstack|custom
   files: [] # optional explicit file plan
   location:
   basepath: string|null
   output:
   destination: - promptonly - prreviewcomment - prinlinecomments - issuecomment - reviewfile - patchunifieddiff - filesmanifest - branchcommit - branchcommitopenpr - opsexecution
   format: markdown|githubreview|unifieddiff|json
   apply:
   writemode: draftonly|applychanges
   branch:
   create: true
   name: string|null
   base: string|null
   commit:
   message: string|null
   pr:
   open: false
   title: string|null
   body: string|null
   reviewers: []
   labels: []
   linkissues: []
   repopolicy: # defaults you can prefill (editable)
   branching: "feature/_ or llm/_"
   requiretests: true
   style: "follow existing conventions"
   lintcommand: "npm run lint"
   testcommand: "npm test"
   buildcommand: "npm run build"
   constraints:
   risklevel: low|medium|high
   timebudget: short|normal|deep
   changebudget:
   maxfileschanged: 10
   maxlocchanged: 400
   model:
   profile: modelagnostic|openai|anthropic|custom
   verbosity: concise|normal|detailed

---

3. Lens system (show all, preselected)
   UI rule (as you requested)
   • Show all lenses as checkboxes
   • Default: all checked
   • If user unchecks all → auto-enable Semantics + Structure (and show a small toast)
   Optional “Strictness” slider
   • Relaxed: fewer suggestions, focus on high-confidence issues
   • Normal: balanced
   • Strict: exhaustive checks and edge-case hunting

---

4. Atomic task library (backend catalog)
   Use these IDs in pipelines.
   4.1 Context loaders
   • ctx.pr.load (metadata, diff, touched files, comments)
   • ctx.commit.load (diff, touched files)
   • ctx.issue.load (body, comments, linked PRs)
   • ctx.files.load (file contents for selected paths)
   • ctx.folder.load (tree + contents for selected folder)
   • ctx.workflow.load (YAML + recent runs)
   • ctx.ci.logs.load (logs if available)
   • ctx.project.load (boards, fields, cards)
   Since “agent can find diffs themselves”, ctx.\*.load can be executed by the agent, and your prompt can simply instruct it to fetch relevant data based on target.
   4.2 Analysis tasks
   • analyze.diff.lenses
   • analyze.code.lenses
   • analyze.comments.triage
   • analyze.duplicates
   • analyze.conflicts_risk
   • analyze.spec_alignment
   • analyze.dependency_impact
   4.3 Planning tasks
   • plan.review_findings (rank P0/P1/P2)
   • plan.patch_minimal
   • plan.refactor_steps
   • plan.scaffold_files (for multi-file creation)
   • plan.ops_dry_run
   4.4 Generation tasks
   • gen.review.summary
   • gen.review.inline
   • gen.review.file (e.g., review.md)
   • gen.patch.unified_diff
   • gen.files.from_spec (new files content)
   • gen.rewrite.files (rewrites existing)
   • gen.commit_message
   • gen.pr_title_body
   4.5 Apply tasks (guarded)
   • apply.comment.post
   • apply.inline.post
   • apply.files.write
   • apply.branch.create
   • apply.commit.create
   • apply.pr.open
   • apply.pr.merge
   • apply.branch.merge/delete
   • apply.issue.create/update/label/assign/link
   • apply.workflow.trigger/create/modify
   4.6 Verify + report
   • verify.suggest_commands
   • verify.checklist
   • report.summary

---

5. Flow catalog (frontend) — full list with defaults + pipelines
   Each flow defines:
   • flow_id
   • required inputs
   • defaults
   • allowed outputs
   • atomic pipeline
   I’ll group them by category.

---

5.1 Review flows (read-only by default)
A) review.pr
Goal: review PR changes\ Target: PR #\ Defaults:
• scope.consider: [diff, files_touched, comments] (comments optional but prechecked)
• lenses: all selected
• output: pr_review_comment, format github_review
• apply: draft_only
Pipeline:
• ctx.pr.load
• analyze.diff.lenses
• plan.review_findings
• gen.review.summary
• (optional) gen.review.inline
• report.summary

---

B) review.pr_comments
Goal: investigate PR comment threads\ Defaults:
• scope.consider: [comments, diff, files_touched]
• output: pr_review_comment
Pipeline:
• ctx.pr.load
• analyze.comments.triage
• plan.review_findings
• gen.review.summary

---

C) review.commit
Target: commit SHA\ Defaults: scope [diff, files_touched]\ Output: commit inline (if supported) or review file
Pipeline: ctx.commit.load → analyze.diff.lenses → plan.review_findings → gen.review.summary

---

D) review.files
Target: files list\ Defaults: scope [full_files] with include paths\ Output: review_file
Pipeline: ctx.files.load → analyze.code.lenses → plan.review_findings → gen.review.file

---

E) review.compare_files
Target: 2+ files or folder\ Defaults: lenses preselected; scope includes [full_files]\ Pipeline: ctx.files.load|ctx.folder.load → analyze.duplicates → analyze.conflicts_risk → gen.review.summary

---

F) review.issue
Target: issue #\ Defaults: scope [issue_body, issue_comments, related_prs]\ Pipeline: ctx.issue.load → plan.review_findings → gen.review.summary

---

5.2 Fix flows (draft patch default, apply optional)
G) fix.pr
Goal: propose fixes for PR changes\ Defaults:
• output: patch_unified_diff
• apply: draft_only
• change_budget: max 10 files, 400 LOC
Pipeline:
• ctx.pr.load
• analyze.diff.lenses
• plan.patch_minimal
• gen.patch.unified_diff
• verify.suggest_commands
• report.summary
• If apply: apply.branch.create → apply.files.write → apply.commit.create → apply.pr.open

---

H) fix.files
Target: selected files\ Pipeline: ctx.files.load → analyze.code.lenses → plan.patch_minimal → gen.patch.unified_diff → verify → report → optional apply

---

I) fix.issue
Goal: fix based on issue description (create patch)\ Defaults: scope [issue_body, issue_comments, repo_tree]\ Pipeline: ctx.issue.load → analyze.spec_alignment → plan.patch_minimal → gen.patch.unified_diff → optional apply

---

5.3 Create / scaffold flows (multi-file supported)
J) create.from_spec
Goal: create new files from a spec/description\ Target: folder path (or repo root)\ Defaults:
• scope.consider: [repo_tree, related_issues]
• create.scaffold.enabled: true (default ON for this flow)
• output: files_manifest + patch_unified_diff (draft)
• apply: draft_only
Pipeline:
• ctx.folder.load (repo_tree only, optionally load existing relevant files if user selects)
• plan.scaffold_files (file list + responsibilities)
• gen.files.from_spec (multi-file)
• gen.patch.unified_diff
• verify.checklist
• optional apply tasks
Scaffold templates (dropdown):
• component (ui component + styles + story)
• service (service + interface + tests)
• api (routes + handlers + schemas + tests)
• library (entry + modules + docs + tests)
• docs (md + examples)
• fullstack (api + ui + shared types + tests)
• custom (user-defined file plan)

---

K) create.tests_from_code
Goal: generate tests for selected code\ Defaults: scope [full_files] on selected code; output patch\ Pipeline: ctx.files.load → analyze.code.lenses → gen.files.from_spec (tests) → gen.patch → verify

---

L) create.docs_from_code
Goal: generate docs/spec from code\ Defaults: output review_file or new docs file(s)\ Pipeline: ctx.files.load → analyze.code.lenses → gen.files.from_spec (docs) → optional apply

---

5.4 Rewrite flows (docs or code)
M) rewrite.docs
Goal: rewrite docs for clarity/structure\ Defaults: preserve meaning ON\ Pipeline: ctx.files.load → gen.rewrite.files → gen.patch → report
N) rewrite.code
Goal: rewrite code section(s) while preserving behavior\ Defaults: “preserve behavior” ON, “no public API change” ON\ Pipeline: ctx.files.load → analyze.code.lenses → gen.rewrite.files → gen.patch → verify

---

5.5 Refactor structure flows
O) refactor.merge_files
Target: 2+ files\ Pipeline: ctx.files.load → plan.refactor_steps → gen.patch → verify → optional apply
P) refactor.split_file
Target: single file + new file names/locations\ Pipeline: ctx.files.load → plan.refactor_steps → gen.patch → verify
Q) refactor.move_files
Target: files + destination folder\ Pipeline: ctx.folder.load → plan.refactor_steps → gen.patch → verify
R) refactor.remove
Target: files/folders\ Pipeline: ctx.folder.load → plan.refactor_steps → gen.patch → verify\ Guardrail: destructive confirmation + dry-run summary

---

5.6 Operate flows (dry-run first, always)
S) ops.branch
Create/merge/delete branch\ Pipeline: plan.ops*dry_run → apply.branch.* → report.summary
T) ops.pr
Create/merge/delete PR, add reviewers/labels, link issues\ Pipeline: plan.ops*dry_run → apply.pr.* → report
U) ops.issue
Create/delete/label/assign/link/merge issues\ Pipeline: plan.ops*dry_run → apply.issue.* → report
V) ops.workflow
Trigger/create/modify workflow\ Pipeline: ctx.workflow.load(optional) → plan.ops*dry_run → apply.workflow.* → report
W) ops.project
Projects/cards/fields operations\ Pipeline: plan.ops_dry_run → apply.project.\* → report

---

6. Decision tree (what the UI reveals when)
   You want: users can “see all options”, but details only appear once they pick a task.
   Tree

1) Pick flow (shows overview + default summary)
2) Pick target (PR#/SHA/files/folder/issue/workflow/project)
3) Scope (what to consider)
   o minimal controls + optional advanced filters
4) Lenses (all visible, all selected)
5) Output
6) Apply changes (only if flow supports writes)
7) Prompt preview / copy (+ optional Run)

---

7. Stepper screens + field behavior (ready to implement)
   Screen 1 — Choose flow
   UI: grouped flow cards\ Behavior:
   • Selecting a flow sets:
   o intent.flow_id, intent.mode, target.type
   o defaults for scope/lenses/output/apply
   Show a small “Defaults” line under each card, e.g.:
   • “Output: PR comment • Apply: Draft only • Lenses: All”

---

Screen 2 — Select target
Fields depend on target type
• PR: number input (+ repo selector if not implicit)
• Commit: SHA
• Issue: number
• Files/folder: picker tree with search
• Workflow/project: dropdown (if available)
Behavior
• If app is opened inside PR/issue context → auto-fill & skip

---

Screen 3 — Scope (what to consider)
Checklist (preselected defaults per flow)
• Diff
• Comments
• Files touched
• Full file contents (warn “expensive”)
• Issue body/comments
• Related PRs/issues
• CI logs
• Repo tree
Advanced (collapsed)
• include_globs / exclude_globs
• explicit paths
• max_files / max_lines
• exclude_generated toggle
Behavior
• Live preview: “estimated context size”
• If user selects “full_files” without filters → suggest adding include_globs

---

Screen 4 — Lenses (all visible, all selected)
Controls
• 9 checkboxes (default checked)
• strictness slider
• optional “prioritize lenses” (collapsed)
Behavior
• Uncheck all → auto-check Semantics + Structure

---

Screen 5 — Output
Destination options change by flow
• Review: PR comment / inline / review file
• Fix/create/refactor: patch / files manifest / branch+commit / branch+commit+PR
• Operate: ops execution summary
Behavior
• Inline comments only enabled if diff is in scope (or target is PR/commit)
• If “review file” chosen → ask filename, default review.md or reviews/<target>.md

---

Screen 6 — Apply changes (only when relevant)
Toggle
• Draft only (default)
• Apply changes
If apply enabled:
• Branch name default: llm/<flow_id>/<target_id>
• Commit message auto-generated (editable)
• PR open toggle (default off except “fix.pr” where you might default on)
• PR title/body auto-generated
• reviewers/labels optional
Guardrails
• Destructive operations require typed confirmation
• Show “execution plan” before running

---

Screen 7 — Prompt preview & copy
Tabs
• Prompt (model-agnostic)
• JSON request (canonical object)
Buttons
• Copy prompt
• Copy JSON
• Run (if GitHub App has execution permission)

---

8. Variable map (UI → schema → prompt placeholders)
   Key mapping
   • Flow picker → intent.flow*id, intent.mode, intent.title
   • Target fields → target.type, target.id, target.repo, target.ref
   • Scope checkboxes → scope.consider[]
   • Filters → scope.filters.*
   • Lenses → lens.selected[], lens.strictness
   • Output → output.destination[], output.format
   • Apply toggle → apply.write*mode
   • Branch/commit/PR fields → apply.branch.*, apply.commit._, apply.pr._
   • Repo defaults → repo*policy.*
   • Constraints → constraints.\_

---

9. Prompt generator (modules + model adapters)
   9.1 Base model-agnostic prompt (stable)
   Use a consistent structure so output quality is predictable.
   You are an LLM agent operating on a GitHub repository.

INTENT

- Flow: {{flowid}} ({{mode}})
- Task: {{title}}

TARGET

- Repo: {{repo}}
- Target: {{targettype}} {{targetid}}
- Ref (if applicable): {{ref}}

SCOPE (you may fetch required data yourself)
Consider:
{{scopeconsiderlist}}

Filters:

- Include globs: {{includeglobs}}
- Exclude globs: {{excludeglobs}}
- Explicit paths: {{paths}}
- Limits: maxfiles={{maxfiles}}, maxlines={{maxlines}}
- Exclude generated/vendor: {{excludegenerated}}

LENSES (all selected unless unchecked)
Selected lenses:
{{lensselectedlist}}
Strictness: {{strictness}}

CONSTRAINTS

- Risk level: {{risklevel}}
- Time budget: {{timebudget}}
- Change budget: maxfileschanged={{maxfileschanged}}, maxlocchanged={{maxlocchanged}}

REPO POLICY (follow these unless the task says otherwise)

- Branching: {{branching}}
- Style: {{style}}
- Lint: {{lintcommand}}
- Test: {{testcommand}}
- Build: {{buildcommand}}
- Require tests: {{requiretests}}

OUTPUT CONTRACT

- Destination: {{outputdestination}}
- Format: {{outputformat}}

APPLY CHANGES

- Write mode: {{writemode}}
- Branch: {{branchname}}
- Commit message: {{commitmessage}}
- Open PR: {{openpr}}
- PR title/body: {{pr_title}}

RESPONSE FORMAT

1. Scope summary (what you fetched/used)
2. Findings ranked (P0/P1/P2) + evidence (file/line where possible)
3. Proposed changes (patch in unified diff if applicable)
4. Risks & trade-offs
5. Verification checklist (commands + manual checks)
   9.2 Model-specific adapters (optional wrappers)
   Keep the content identical; only wrap it:
   • Anthropic adapter: wrap sections in XML tags (<intent>...</intent>)
   • OpenAI adapter: include a JSON header block then instructions
   • Tool-mode adapter: add strict output schema instructions
   This gives you “model-agnostic + per-model configs” without duplicating logic.

---

10. Common repo rules (prefill defaults)
    You said “include most common ones.” Here’s a safe default set:
    Repo policy defaults
    • Follow existing coding conventions in touched areas
    • Avoid repo-wide refactors unless explicitly in scope
    • Prefer minimal diffs; don’t change public APIs unless requested
    • Add/adjust tests when behavior changes
    • Keep formatting consistent (run formatter if available)
    • Update docs when behavior/interfaces change
    Default commands (editable)
    • JS/TS: npm test, npm run lint, npm run build
    • Python: pytest, ruff, mypy
    • Java: mvn test / gradle test
    • .NET: dotnet test
    • Go: go test ./...
    In UI, show these as editable fields under “Repo policy”.

---

11. “Show all options, but easy defaults” (how to do it)
    Your requirement is slightly contradictory unless you use visual hierarchy:
    • Always show everything, but:
    o keep “advanced” sections collapsed
    o preselect sensible defaults
    o add short helper text and warnings
    Practical UI patterns:
    • Lenses: show all (checked) ✅
    • Scope: show list (checked) ✅, but advanced filters collapsed
    • Output: show all valid destinations, default highlighted
    • Apply: off by default, with clear guardrail messaging

---

 

---

1. UX structure: 5 cards, same style, collapsible + resizable
   Cards (left-to-right / top-to-bottom stacking on mobile)

1) Configuration (expanded by default)
2) Scope (collapsed initially)
3) Tasks (collapsed initially)
4) Steps (collapsed initially)
5) Prompts (collapsed initially)
   Card behavior rules (matches your draft)
   • All cards:
   o manually collapse/expand
   o manually resize height (drag handle)
   o same CSS class for container + shared button styles
   o minimize vertical whitespace (tight padding, compact rows)
   • Auto-expand/collapse rules:
   o Selecting repo → expands Scope
   o Selecting first file/folder → expands Tasks, collapses Configuration
   o Selecting a Task/Flow → expands Steps and Prompts
   • It must be possible to test:
   o each card alone (with mocked state)
   o end-to-end full flow (with mocked GitHub API)

---

2. App state model (single source of truth)
   Use one canonical state object that every card reads/writes. This is the backbone for reliable prompt generation.
   Canonical request schema (UI → prompt generator → agent)
   request:
   configuration:
   pat: string|null
   repoowner: "paumen"
   repo: string|null
   branch: string|null
   scope:
   selectedfiles: [] # explicit file paths
   selectedfolders: [] # explicit folder paths
   includeglobs: []
   excludeglobs: []
   excludegenerated: true
   task:
   flowid: string|null # e.g. "fix.pr" or "create.fromspec"
   mode: review|fix|create|refactor|operate
   target:
   type: pr|commit|issue|files|folder|workflow|project
   id: string|null
   lenses:
   selected: [syntax, semantics, interdependencies, structure, efficiency, conflicts, redundancies, duplications, ambiguity]
   strictness: normal
   output:
   destination: prreviewcomment|prinlinecomments|reviewfile|patchunifieddiff|branchcommitopenpr|…
   format: markdown|githubreview|unifieddiff|json
   apply:
   writemode: draftonly|applychanges
   branchname: string|null
   commitmessage: string|null
   openpr: boolean
   prtitle: string|null
   prbody: string|null
   create:
   specfilepath: string|null # for create-from-spec default
   scaffoldtemplate: component|service|api|library|docs|fullstack|custom
   basepath: string|null
   steps:
   enabledatomicsteps: [] # toggles in Steps card
   prompt:
   modelprofile: modelagnostic|anthropic|openai|custom
   verbosity: concise|normal|detailed
   generated_text: string
   Why this helps:
   • Each card can be tested by injecting a mock request state.
   • Prompt generation becomes deterministic.

---

3. Decision tree + event rules (the “flow logic”)
   High-level decision tree

1) Configuration
   o choose repo → triggers: load branches + load root tree
2) Scope
   o pick files/folders → triggers: add “read” steps + unlock tasks
3) Tasks
   o choose flow button → triggers: seed default steps + output + apply settings
4) Steps
   o toggle atomic steps → triggers: prompt updates
5) Prompts
   o copy prompt (and optionally run)
   Event model (minimal but complete)
   E1: RepoSelected(repo)
   • set configuration.repo
   • fetch branches → render buttons
   • expand Scope card
   • update prompt: repo link
   E2: BranchSelected(branch)
   • set configuration.branch (default main)
   • reload tree for that branch
   • update prompt: branch in scope definition
   E3: PATChanged(pat) / PATCleared
   • set configuration.pat
   • update prompt: auth note (and API capability constraints)
   E4: ScopeSelectionChanged(files[], folders[])
   • update scope.selected\_\*
   • add/update “read context” steps for files
   • add folders into scope section of prompt
   • if first selection: expand Tasks, collapse Configuration
   E5: FlowSelected(flow_id)
   • set task.flow_id, task.mode, and set defaults:
   o lenses (all selected)
   o output destination default (per flow)
   o apply defaults (draft_only unless user explicitly flips apply)
   o steps list seeded
   • expand Steps and Prompts
   E6: OutputChanged / ApplyToggled / LensToggled / StepToggled
   • regenerate prompt immediately

---

4. UI card specs (fields + behavior + defaults)
   4.1 Configuration card (expanded by default)
   Must show
   • Repo buttons for each repo under https://github.com/paumen/
   • Branch buttons after repo selected
   • PAT field preloaded by default + “Clear” + “Paste” action
   • Main branch preselected by default
   Interaction design (mobile-first)
   • Repos: horizontal wrap of buttons (tap once)
   • Branches: same
   • PAT: compact input row:
   o [ PAT input ] [📋 Paste] [✖ Clear]
   • Minimal vertical spacing:
   o tight padding, small button height, two columns on mobile where possible
   Triggers
   • Repo selected → expand Scope, load tree, update prompt repo URL
   • Branch selected → reload tree + update prompt branch
   • PAT changed → update prompt auth note + scope limitations

---

4.2 Scope card (collapsed initially)
Tree behavior
• Initially show root only (folders + files)
• Folders expandable
• Each node has:
o icon (folder/file + filetype)
o checkbox (select)
o optional “select all in folder” action
Selection rules
• User can select one, multiple, or all
• On first selection:
o expand Tasks
o collapse Configuration
o add a “read” step for selected files to Steps
o add folders to “scope definition” in prompt
• User can unselect at any time (prompt updates immediately)
Low-click patterns
• Provide quick action chips above tree:
o Select all Clear selection Only code files Only docs\ (“Only code files” uses extension heuristics: .ts/.js/.py/.java/.go/.cs etc)

---

4.3 Tasks card (collapsed initially)
This card is the “flow catalog” and should be button-first.
Layout
• Grouped button sections (accordion within the card if needed):
o Review
o Fix
o Create/Rewrite
o Refactor
o Operate
Button behavior
• One tap selects a flow
• Selected flow button shows “active” state
• Each flow button shows a tiny default summary (1 line max):
o e.g. Fix PR • Branch+Commit+Open PR • Draft
Your key requirement
backend has separate tasks/subtasks; frontend shows bundled flows\ So each button maps to a flow which seeds the Steps list.

---

4.4 Steps card (collapsed initially)
This card exposes your atomic tasks/subtasks (backend granularity) only after a user chose a flow.
What it shows
• A compact checklist of steps with:
o step icon
o step name
o optional “details” chevron
• Steps are preselected by default (based on the flow)
• Users can disable steps (prompt updates)
Example step list (Fix PR)
• ✅ Load PR context (agent fetches diff)
• ✅ Analyze with lenses
• ✅ Plan minimal patch
• ✅ Generate unified diff patch
• ✅ Create branch
• ✅ Commit changes
• ✅ Open PR
• ✅ Provide verification checklist
Important gating
• If apply.write_mode = draft_only, show “Create branch/commit/open PR” steps as:
o still visible (so user “sees all options”)
o but marked as inactive unless Apply is enabled
o one tap on “Apply changes” flips them on

---

4.5 Prompts card (collapsed initially)
Two tabs
• Prompt (copyable filled template)
• JSON (the canonical request object)
Buttons
• Copy prompt
• Copy JSON
• optional: Run (only for GitHub App mode with permissions)
Prompt updates live
• any change in config/scope/task/steps/lenses/output/apply regenerates the prompt text

---

5. Flow catalog (frontend) + defaults (backend-ready)
   You asked for full catalog incl. scope, defaults, specifics. Here’s a v1 set that covers everything you listed plus spec-based creation/rewrites.
   5.1 Review flows

1) review.pr – Review PR diff (agent fetches diff)
2) review.pr_comments – Investigate PR comments/threads
3) review.commit – Review commit diff
4) review.issue – Investigate issue (body + comments)
5) review.files – Review selected files
6) review.compare – Compare files/folder (dupes/conflicts/ambiguity)
   Defaults
   • Lenses: ✅ all selected
   • Apply: draft_only
   • Output: comment/review file depending on target context\ (If target is PR → default PR comment)
   5.2 Fix flows (your default: Branch+Commit+Open PR)
7) fix.pr – Fix PR
8) fix.files – Fix selected files
9) fix.issue – Fix based on issue + implementation
   Defaults
   • Output destination: branch_commit_open_pr ✅ (your choice)
   • Apply: draft_only (still safest; user can flip to execute)
   • Steps include branch/commit/PR steps but gated by Apply
   5.3 Create / Rewrite flows
10) create.from_spec – Create multi-file scaffold from spec file (repo link) ✅ (your choice)
11) create.tests_from_code – Generate tests
12) create.docs_from_code – Generate docs/spec from code
13) rewrite.docs – Rewrite docs
14) rewrite.code – Rewrite code (preserve behavior)
    Defaults for create.from_spec
    • Spec source: spec file in repo (user picks file in Scope)
    • Scaffold: enabled = true
    • Output destination: branch_commit_open_pr (visible) but gated by Apply
    • Base path: inferred from selected folder (or repo root)
    5.4 Refactor flows
15) refactor.merge_files
16) refactor.split_file
17) refactor.move_files
18) refactor.remove_files
19) refactor.remove_folder
    5.5 Operate flows (dry-run-first)
20) ops.branch
21) ops.pr
22) ops.issue
23) ops.workflow
24) ops.project

---

6. Atomic step catalog (backend tasks/subtasks)
   These are the “Steps card” items + what you’ll use to build prompts precisely.
   Context
   • ctx.load.repo_tree
   • ctx.load.pr
   • ctx.load.commit
   • ctx.load.issue
   • ctx.read.files (selected file contents)
   • ctx.read.spec_file (for create.from_spec)
   • ctx.load.ci_logs (optional)
   Analyze
   • analyze.lenses (uses selected lenses)
   • analyze.comments (triage threads)
   • analyze.compare (dupes/conflicts/overlap)
   • analyze.spec_alignment
   Plan
   • plan.review_findings
   • plan.patch_minimal
   • plan.scaffold (file list + responsibilities)
   • plan.refactor_steps
   • plan.ops_dry_run
   Generate
   • gen.review_comment
   • gen.inline_comments
   • gen.review_file
   • gen.patch_unified_diff
   • gen.files_from_spec
   • gen.rewrite_files
   • gen.commit_message
   • gen.pr_title_body
   Apply (gated)
   • apply.create_branch
   • apply.write_files
   • apply.commit
   • apply.open_pr
   • apply.post_comment
   • apply.post_inline_comments
   • apply.ops_execute
   Verify/Report
   • verify.suggest_commands
   • verify.checklist
   • report.summary

---

7. Output destinations (unified + consistent)
   Keep “destination” separate from “channel” (web/app/cli). Your UI is the channel.
   Destinations
   • pr_review_comment
   • pr_inline_comments
   • issue_comment
   • review_file (e.g., review.md)
   • patch_unified_diff
   • files_manifest (list of files to create)
   • branch_commit
   • branch_commit_open_pr
   • ops_execution
   Default mapping
   • Review PR → pr_review_comment
   • Fix PR → branch_commit_open_pr (but gated by Apply)
   • Create from spec → branch_commit_open_pr (gated) + include files_manifest in prompt output

---

8. Lenses (show all, default all selected)
   As you wanted, the UI shows all lens toggles, all selected:
   • ✅ Syntax
   • ✅ Semantics
   • ✅ Interdependencies
   • ✅ Structure
   • ✅ Efficiency
   • ✅ Conflicts
   • ✅ Redundancies
   • ✅ Duplications
   • ✅ Ambiguity
   Add Strictness: Relaxed / Normal / Strict (default Normal)

---

9. Prompt framework (modules + variable map)
   9.1 Prompt modules (composable)
   Build prompt text from modules so it stays clean and model-agnostic.

1) Role + guardrails
2) Target + repo/branch
3) Scope (selected files/folders + globs)
4) Spec (if create.from_spec)
5) Lenses + strictness
6) Steps (atomic step checklist)
7) Output contract
8) Apply contract (if enabled/gated)
9) Response format
   9.2 Variable map (UI → placeholders)
   • Repo button → {{repo_url}}, {{repo}}
   • Branch button → {{branch}}
   • PAT → {{auth_note}} (never embed PAT in prompt; only note that agent has auth)
   • Scope selection:
   o files → {{read_files}}
   o folders → {{scope_folders}}
   o globs → {{include_globs}}, {{exclude_globs}}
   • Task flow → {{flow_id}}, {{mode}}
   • Steps toggles → {{enabled_steps}}
   • Lenses → {{lenses}}, {{strictness}}
   • Output destination → {{destination}}, {{format}}
   • Apply:
   o write_mode → {{write_mode}}
   o branch/commit/PR fields → {{branch_name}}, {{commit_message}}, {{pr_title}}, {{pr_body}}

---

10. Default prompt template (model-agnostic)
    This is what the Prompts card generates (filled) and users can copy.
    You are an LLM agent operating on a GitHub repository. Follow scope strictly. Prefer minimal diffs.

TARGET

- Repo: {{repourl}}
- Branch: {{branch}}
- Task flow: {{flowid}} ({{mode}})

SCOPE

- Selected folders (treat as scope boundaries):
  {{scopefolders}}
- Read these files (use as primary context):
  {{readfiles}}
- Include globs: {{includeglobs}}
- Exclude globs: {{excludeglobs}}
- Exclude generated/vendor: {{excludegenerated}}

SPEC (only if applicable)

- Spec file in repo: {{specfilepath}}

LENSES (all selected unless unchecked)

- Selected: {{lenses}}
- Strictness: {{strictness}}

STEPS (execute in order; skip disabled)
{{enabledsteps}}

OUTPUT CONTRACT

- Destination: {{destination}}
- Format: {{format}}

APPLY CHANGES

- Write mode: {{writemode}}
- If applychanges: create branch, commit, and open PR
  - Branch name: {{branchname}}
  - Commit message: {{commitmessage}}
  - PR title/body: {{pr_title}}

RESPONSE FORMAT

1. Scope summary (what you used/fetched)
2. Findings ranked (P0/P1/P2) with file/line evidence where possible
3. Proposed changes (unified diff patch or file contents)
4. Risks & trade-offs
5. Verification checklist (tests/commands + manual checks)
   Important security note: never include the PAT in the prompt text. Only store it in app config and use it for API calls.

---

11. Your specific UI requirements (translated into buildable behavior)
    11.1 Collapsible + resizable cards (plain CSS)
    Design pattern
    • Each card header: title + icons: expand/collapse, reset height
    • Each card footer: a thin drag handle for resizing (cursor: ns-resize)
    State
    • cardStates = { configuration:{open:true,height:...}, scope:{open:false,...} ... }
    Consistency
    • All cards share class .app-card
    • All buttons share .btn variants (.btn-primary, .btn-chip, .btn-ghost)
    11.2 Minimize vertical whitespace
    Use compact defaults:
    • small padding (8–10px)
    • tight line-height
    • icon+label buttons
    • avoid stacked labels; use inline labels
    • tree nodes height ~32px
    11.3 Buttons > dropdowns
    • Repos: buttons
    • Branches: buttons
    • Flows: buttons
    • Output: segmented buttons
    • Strictness: 3-button segmented control
    Dropdown only when it truly saves space (e.g., long list of workflows/projects).
    11.4 Icons
    Good places:
    • repo / branch icons
    • file tree: folder/file + filetype badge
    • flows: review 🔍, fix 🛠, create ✨, refactor 🧩, operate ⚙️
    • steps: load/analyze/plan/generate/apply/verify/report icons

---

12. Testing strategy (each card alone + end-to-end)
    12.1 Unit tests per card (isolated)
    Mock the global request state + mock GitHub API service.
    • Configuration card:
    o loads repos list
    o selecting repo triggers branch fetch + Scope expand
    o PAT clear/paste updates state
    • Scope card:
    o tree renders root collapsed
    o folder expands
    o selecting file adds read step + expands Tasks
    • Tasks card:
    o selecting flow seeds default steps + expands Steps/Prompts
    • Steps card:
    o toggling step modifies prompt
    o apply-gated steps show inactive until apply enabled
    • Prompts card:
    o prompt regenerates on state change
    o copy outputs stable
    12.2 End-to-end tests
    With a mocked GitHub API:

1) repo select → branch select → file select → flow select → prompt copy
2) create-from-spec:
   o select spec file → scaffold → prompt includes spec path
3) apply enabled:
   o branch name + PR text appear

---

13. Small but important clarifications (so v1 behaves well)
    A) Fix PR default = Branch+Commit+Open PR
    You chose this. To keep it safe + consistent with “copy prompt” usage:
    • Default output destination: branch_commit_open_pr ✅
    • Default write_mode: draft_only ✅ (still prevents accidental writes)
    • If user flips “Apply changes” → write_mode becomes apply_changes and those steps activate
    So users see the full automation path immediately, but execution stays guarded.
    B) Create-from-spec uses “spec file link in repository”
    Implementation:
    • In Scope card, user selects the spec file.
    • In Tasks card, flow create.from_spec uses that file as create.spec_file_path.
    • Steps include: read spec → plan scaffold → generate files → patch → branch/commit/PR (gated).

---

 

---

2. Updated Single Spec Document (copy-only prompt generator, Operate kept)
   2.0 Product scope statement
   SPEC-ENG-00: The product MUST generate copyable prompts and JSON requests and MUST NOT execute GitHub write operations itself.

---

2.1 Canonical data model (normative)
Canonical prompt inputs (single source of truth)
promptinput:
configuration: { owner, repo, branch }
scope: { selectedfiles, selectedfolders, includeglobs, excludeglobs, excludegenerated }
task: { flowid }
steps: { enabledstepids }
lenses: { selected[], strictness }
output: { destination, format }
create: { specfilepath, scaffoldtemplate, basepath }
model: { profile, verbosity }

---

2.2 Engine requirements (SPEC-ENG-##)
SPEC-ENG-01: The app MUST be data-driven by a single flows.yaml that defines all flows, their default values, allowed outputs, and step pipelines.\
SPEC-ENG-02: The app MUST store all user selections in one canonical prompt_input object that all cards read from and write to.\
SPEC-ENG-03: The app MUST rebuild the complete prompt from scratch from the current prompt_input whenever any field in prompt_input changes.\
SPEC-ENG-04: The app MUST generate two synchronized copy outputs: (a) prompt text and (b) JSON for the current prompt_input.\
SPEC-ENG-05: The app MUST render the Steps list from the selected flow pipeline and include only steps.enabled_step_ids in the prompt “STEPS” section.\
SPEC-ENG-06: The app MUST support model adapters that wrap the same base prompt content without changing which prompt_input fields are included.\

---

2.3 State requirements (SPEC-STS-##)
SPEC-STS-01: The app MUST persist per-card UI state (expanded/collapsed and height) locally per user session.\
SPEC-STS-02: On first load, Configuration MUST be expanded and Scope/Tasks/Steps/Prompts MUST be collapsed.\
SPEC-STS-03: Selecting a repo MUST set configuration.repo, fetch branches, set default branch, and fetch the root tree for that branch.\
SPEC-STS-04: Selecting a branch MUST set configuration.branch and reload the root tree for that branch.\
SPEC-STS-05: Editing or clearing PAT MUST update configuration.pat_present and MUST populate prompt text or JSON with the PAT value.\
SPEC-STS-06: Selecting/unselecting files or folders MUST update scope.selected_files and scope.selected_folders immediately and reversibly.\
SPEC-STS-07: Selecting a flow MUST set task.flow_id and apply that flow’s defaults to lenses, output, steps, and create fields.\

---

2.4 UX/UI requirements (SPEC-UIX-##)
Cards + styling
SPEC-UIX-01: The UI SHOULD present exactly five cards: Configuration, Scope, Tasks, Steps, and Prompts.\
SPEC-UIX-02: Each card SHOULD be manually collapsible/expandable and manually resizable in height.\
SPEC-UIX-04: The UI MUST minimize vertical whitespace using compact spacing and single-row controls where possible.
SPEC-UIX-04: The Configuration card MUST render repo selection as one-tap buttons for repositories under https://github.com/paumen/.\
SPEC-UIX-06: After repo selection, the Configuration card MUST render branch selection as one-tap buttons and preselect the main branch.\
SPEC-UIX-07: The Configuration card MUST provide PAT input with one-tap Paste and Clear actions and allow manual edit.
Scope card
SPEC-UIX-08: The Scope card MUST render the repo tree initially as root-level folders and files only.\
SPEC-UIX-09: The Scope card MUST support expanding folders on demand and selecting one or multiple files and folders.\
SPEC-UIX-10: The Scope card SHOULD provide one-tap quick actions for Select All, Reset, etc.
Tasks card
SPEC-UIX-11: The Tasks card MUST render flow buttons from flows.yaml grouped into defined categories. \
SPEC-UIX-12: Selecting a flow MUST visually mark it active and update Steps and prompt outputs.
Steps card
SPEC-UIX-13: The Steps card MUST render the selected flow’s pipeline as a compact checklist and allow toggling each step. And show default options and enable user to change the default \
SPEC-UIX-14: The Steps card MUST default all pipeline steps to enabled unless overridden by the flow defaults.
Prompts card
SPEC-UIX-15: The Prompts card MUST provide two tabs (Prompt and JSON) and each MUST support one-tap copy.

---

2.5 Non-functional requirements (SPEC-NFR-##)
SPEC-NFR-01: The UI MUST be mobile-friendly by minimizing taps using button-first controls and sensible defaults.\
SPEC-NFR-02: Repo data loading MUST be non-blocking and MUST show a visible loading state while fetching.\
SPEC-NFR-03: Loading speeds Github meta data SHOULD be as follows:
• Prio 1 If github user name known Repository IDs loading starts on user opening page and competes <400ms (assuming PAT key is available, user has 100mbs internet speeds, and 8gb ram) on first use, and <100ms on revisits via cache.
• Prio 2 If github user name known branch IDs loading starts on user opening page and competes <500ms (assuming PAT key is available, user has 100mbs internet speeds, and 8gb ram) on first use, and <100ms on revisits via cache.
SPEC-NFR-04: Loading speeds Github Repo tree data SHOULD be as follows:
• Prio 1 Repository tree Root folders/files loading takes < 400ms after user selected repository (default main branch) on first use, and <100ms on revisits via cache.
• Prio 2 If github user name known PR IDs and Issue IDs loading starts on user opening page and competes <500ms (assuming PAT key is available, user has 100mbs internet speeds, and 8gb ram) on first use, and <100ms on revisits via cache.
• Prio 3 Repository tree folders/files on deeper levels are loaded on background and user can select instantly <100ms. Or <500ms if user is faster than background loading (assuming PAT key is available, user has 100mbs internet speeds, and 8gb ram) on first use, and <100ms on revisits via cache..
• Prio 4 Repository tree folders/files of other branches are loaded on background and user can select instantly <100ms. Or <500ms if user is faster than background loading on first use (assuming PAT key is available, user has 100mbs internet speeds, and 8gb ram) on first use, and <100ms on revisits via cache..
SPEC-NFR-05: All other user interaction speeds not mentioned SHOULD be perceived as instant <100ms.
SPEC-NFR-06: CSS should be easily maintainable. Meaning minimizing number of different , classes, reusing classes, using variables, specific rules, etc. For example all cards can share the same container CSS class and all interactive elements can use a shared button style.\

---

2.6 Invariants (INVARIANT-##) — minimal, no repeats
INVARIANT-01: All prompt outputs MUST be derived only from the current canonical prompt_input.\
INVARIANT-2: The generated prompt MUST always reflect the latest prompt_input without stale fields.\

---

2.7 UI transition rules (single table replaces multiple requirements)
Event UI change State change
Repo selected Expand Scope set repo, fetch branches, set default branch, load root tree
Branch selected No forced expand/collapse set branch, reload root tree
First file/folder selected Expand Tasks, collapse Configuration update scope selections
Flow selected Expand Steps and Prompts set flow_id and apply flow defaults
Any input changed No forced expand/collapse rebuild prompt from prompt_input

---

2.8 Test criteria (TST-##) — primary verification list
TST-01: Repo/branch loading works with mocked GitHub responses and updates configuration.repo and configuration.branch correctly.\
TST-02: Repo tree renders root-only initially, expands folders on demand, and selection/unselection updates scope.selected\_\* correctly.\
TST-03: Flow buttons render from flows.yaml and selecting a flow applies its defaults to prompt_input fields.\
TST-04: Toggling Steps updates steps.enabled_step_ids and updates the prompt “STEPS” section accordingly.\
TST-05: Prompt and JSON copy outputs match snapshots for a fixed prompt_input and flow spec version.\
TST-06: A user can select repo and branch, select scope items, select a flow, and copy a prompt and JSON that match the current selections.\
TST-07: The UI provides five consistent, collapsible, resizable cards optimized for mobile usage with compact spacing.\
TST-08: Operate and create-from-spec flows remain available and produce prompts containing the relevant selected scope and spec file path.

 
1.1 Product scope (normative)
SPEC-ENG-00: The product MUST only generate copyable outputs: (a) prompt text and (b) JSON requests.

2.1 Canonical data model (single source of truth)
`prompt_input` (snake_case, JSON-serializable):

- configuration: { owner:str, repo:str, branch:str }
- scope: { selected_files:[path], selected_folders:[path], include_globs:[glob], exclude_globs:[glob], exclude_generated:bool }
- task: { flow_id:str }
- steps: { enabled_step_ids:[id] }
- lenses: { selected:[id], strictness:('low'|'med'|'high') }
- output: { destination:('clipboard'|'file'), format:('prompt'|'json'|'both') }
- create: { spec_file_path:path, scaffold_template:str, base_path:path }
- model: { profile:str, verbosity:('short'|'normal'|'verbose') }

  3.1 Engine requirements (SPEC-ENG-##)
  SPEC-ENG-01: flows.yaml MUST be the only flow definition source and MUST be schema-validated at startup.
  SPEC-ENG-02: All UI cards MUST read/write the same `prompt_input` object.
  SPEC-ENG-03: Any `prompt_input` change MUST trigger a full prompt rebuild (no incremental string edits).
  SPEC-ENG-04: The app MUST render two synchronized copy outputs: prompt text and JSON of `prompt_input` (minus secrets).
  SPEC-ENG-05: Steps UI MUST be derived from the selected flow pipeline; prompt “STEPS” MUST include only `enabled_step_ids`.
  SPEC-ENG-06: Model adapters MAY change wrapper text/formatting but MUST NOT change the included `prompt_input` fields.
  SPEC-ENG-07: Flow defaults MUST be applied via deterministic merge order: base defaults → flow defaults → user overrides.

  3.2 State requirements (SPEC-STS-##)
  SPEC-STS-01: Persist per-card UI state (expanded/collapsed, height) locally per session.
  SPEC-STS-02: First load: Configuration expanded; other cards collapsed.
  SPEC-STS-03: Repo select sets configuration.repo, fetches branches, selects default branch, loads root tree.
  SPEC-STS-04: Branch select sets configuration.branch and reloads tree.
  SPEC-STS-05: Editing or clearing PAT MUST update configuration.pat*present and populates prompt text with the PAT value
  SPEC-STS-06: File/folder selection updates `scope.selected*\*` immediately and reversibly.
  SPEC-STS-07: Flow select sets task.flow_id and applies flow defaults to lenses/output/steps/create.

  3.3 UX/UI requirements (SPEC-UIX-##)
  SPEC-UIX-01: Show five cards: Configuration, Scope, Tasks, Steps, Prompts.
  SPEC-UIX-02: Cards are collapsible and resizable.
  SPEC-UIX-03: Use compact spacing; prefer single-row controls.
  SPEC-UIX-04: Repo/branch selection MUST be one-tap buttons for the configured GitHub owner (default: paumen).
  SPEC-UIX-05: Steps checklist MUST support toggling and show per-step configurable options if defined in flows.yaml.
  SPEC-UIX-06: Prompts card MUST have Prompt/JSON tabs with one-tap copy.

  3.4 Non-functional requirements (SPEC-NFR-##)
  SPEC-NFR-01: Mobile-first: minimize taps with button-first controls and sane defaults.
  SPEC-NFR-02: All network loads are non-blocking and show a loading state + error state.
  SPEC-NFR-03: Performance targets measured as p95 (warm cache) and p95 (cold cache) under stated assumptions.
  SPEC-NFR-04: Cache strategy MUST be defined (keys, TTL, invalidation for repo/branch changes).
  SPEC-NFR-05: CSS MUST minimize unique classes; reuse tokens/variables and shared component styles.

  4.1 Invariants (INVARIANT-##)
  INVARIANT-01: Prompt outputs are derived only from the current `prompt_input`.
  INVARIANT-02: Prompt outputs always reflect the latest `prompt_input` (no stale fields).

---

5.1 UI transition rules (single table replaces multiple requirements)
Event UI change State change
Repo selected Expand Scope set repo, fetch branches, set default branch, load root tree
Branch selected No forced expand/collapse set branch, reload root tree
First file/folder selected Expand Tasks, collapse Configuration update scope selections
Flow selected Expand Steps and Prompts set flow_id and apply flow defaults
Any input changed No forced expand/collapse rebuild prompt from prompt_input

---

6.1 Test criteria (TST-##) — primary verification list
TST-01: Repo/branch loading works with mocked GitHub responses and updates configuration.repo and configuration.branch correctly.\
TST-02: Repo tree renders root-only initially, expands folders on demand, and selection/unselection updates scope.selected\_\* correctly.\
TST-03: Flow buttons render from flows.yaml and selecting a flow applies its defaults to prompt_input fields.\
TST-04: Toggling Steps updates steps.enabled_step_ids and updates the prompt “STEPS” section accordingly.\
TST-05: Prompt and JSON copy outputs match snapshots for a fixed prompt_input and flow spec version.\
TST-06: A user can select repo and branch, select scope items, select a flow, and copy a prompt and JSON that match the current selections.\
TST-07: The UI provides five consistent, collapsible, resizable cards optimized for mobile usage with compact spacing.\
TST-08: Operate and create-from-spec flows remain available and produce prompts containing the relevant selected scope and spec file path.

 
1.1 Product scope (normative)
SPEC-ENG-00: The product MUST only generate copyable prompt text
2.1 Canonical data model (single source of truth)
prompt*input (snake_case, JSON-serializable):
• configuration: { owner:str, repo:str, branch:str, pat:str }
• scope: { selected_files:[path], selected_folders:[path], include_globs:[glob], exclude_globs:[glob], exclude_generated:bool }
• task: { flow_id:str }
• steps: { enabled_step_ids:[id] }
• lenses: { selected:[id], strictness:('low'|'med'|'high') }
• output: { destination:('clipboard'|'file'), format:('prompt'|'json'|'both') }
• create: { spec_file_path:path, scaffold_template:str, base_path:path }
• model: { profile:str, verbosity:('short'|'normal'|'verbose') }
3.1 Engine requirements (SPEC-ENG-##)
• SPEC-ENG-01: flows.yaml MUST be the only flow definition source and MUST be schema-validated at startup.
• SPEC-ENG-02: All cards MUST read/write the same prompt_input.
• SPEC-ENG-03: Any prompt_input change MUST trigger a full prompt rebuild.
• SPEC-ENG-04: Steps UI MUST be derived from the selected flow pipeline; prompt “STEPS” MUST include only steps.enabled_step_ids.
• SPEC-ENG-05: Model adapters MAY change wrapper text/formatting but MUST NOT change included prompt_input fields.
• SPEC-ENG-06: Apply defaults via deterministic merge: base defaults → flow defaults → user overrides.
3.2 State requirements (SPEC-STS-##)
• SPEC-STS-01: Persist per-card UI state (expanded/collapsed, height) locally per session.
• SPEC-STS-02: First load: Configuration expanded; all other cards collapsed.
• SPEC-STS-03: Repo select: set configuration.repo, fetch branches, select default branch, load root tree.
• SPEC-STS-04: Branch select: set configuration.branch, reload tree.
• SPEC-STS-05: Editing/clearing PAT: update configuration.pat.
• SPEC-STS-06: File/folder selection updates scope.selected*_ immediately and reversibly.
• SPEC-STS-07: Flow select: set task.flow*id and apply flow defaults to lenses/output/steps/create.
3.3 UX/UI requirements (SPEC-UIX-##)
• SPEC-UIX-01: Five cards: Configuration, Scope, Tasks, Steps, Prompts.
• SPEC-UIX-02: Cards are collapsible + resizable.
• SPEC-UIX-03: Compact spacing; prefer single-row controls.
• SPEC-UIX-04: Repo/branch selection MUST be one-tap buttons for the configured GitHub owner (default: paumen).
• SPEC-UIX-05: Steps checklist supports toggling and per-step options from flows.yaml.
• SPEC-UIX-06: Prompts card has Prompt with one-tap copy.
3.4 Non-functional requirements (SPEC-NFR-##)
• SPEC-NFR-01: Mobile-first: minimize taps with button-first controls + sane defaults.
• SPEC-NFR-02: Network loads are non-blocking and show loading + error states.
• SPEC-NFR-03: Define p95 targets (warm cache vs cold cache) with explicit assumptions.
• SPEC-NFR-04: Define cache strategy (keys, TTL, invalidation on repo/branch change).
• SPEC-NFR-05: CSS minimizes unique classes; reuse tokens/variables + shared styles.
4.1 Invariants (INVARIANT-##)
• INVARIANT-01: Outputs are derived only from current prompt_input.
• INVARIANT-02: Outputs always reflect the latest prompt_input.
5.1 UI transition rules
Event UI change State change
Repo selected Expand Scope set repo, fetch branches, set default branch, load root tree
Branch selected none set branch, reload root tree
First file/folder selected Expand Tasks; collapse Configuration update scope selections
Flow selected Expand Steps + Prompts set flow_id + apply flow defaults
Any input changed none rebuild prompt from prompt_input
6.1 Test criteria (TST-##)
• TST-01: Mocked GitHub repo/branch loading updates configuration.repo / configuration.branch.
• TST-02: Tree lazy-expands; selection updates scope.selected*_.
• TST-03: Flows render from flows.yaml; selecting applies defaults.
• TST-04: Step toggles update steps.enabled_step_ids and prompt “STEPS”.
• TST-05: Prompt copy outputs match snapshots for fixed inputs.
• TST-06: End-to-end selection → copied outputs match UI state.
• TST-07: Five consistent cards, collapsible/resizable, mobile-optimized.
• TST-08: Operate + create-from-spec flows produce prompts with selected scope + create.spec_file_path.
