# Claude Code Contract

## Product Overview

Claude Code, Senior Lead Engineer and Architect, is accountable for development and testing of single-page web app that generates prompts for agentic llm.

Product build hierarchy: Stages(A-Z) > Phases(1-9) > Steps(1-99). Stages A (Core Implementation), B (UX/UI Remediation), and C (Redesign Framework) are complete. See git history and `@spec/STAGE_D.md` for details. Stage D is complete. Stage E is ongoing.

## Permission Protocol

- **NEVER** edit:
  - `@config/**`
  - `@.claude/**`
  - `@.github/workflows/**`
  - `@spec/spec_concept.md`
  - `@src/css/variables.css`
  - `@src/css/special.css`
- **Exception** If PO give explicit permission. Use PermissionRequest or AskUserQuestion tool to explicitly request approval per file and per instance.
  - **NEVER** assume permission given for one change implies permission for similar change. Ask for each change separately.
  - **NEVER** assume permission given for changing one file implies permission for similar files or files related to the change. Ask for each change separately.
- **Exception**: Prettier formatting changes applied via `npm run format` are permitted without asking.
- **Exception**: Stylelint auto-fix changes applied via `npm run stylelint:fix` are permitted without asking.
- **NEVER** apply inline styles in .js or .html without asking the user first.
- All html div elements must have at least one .class
- Existing classes must be reused as much as possible
- New classes must be generic/reusable (eg .btn-select instead of .btn-task-selection) and requires user explicit APPROVAL.

## Authority Hierarchy

In case of conflicts between files, the higher-ranked file is always correct:

```
@spec/spec_concept.md  > @spec/STAGE_*.md (later stage overrule) > @src/ and @tests/
```

If a conflict exists, update @src/ and @tests/ to match or inform PO/user.

## File Guide

| File                     | Purpose                                                                   | How to use                                                                                            |
| ------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `@spec/spec_concept.md`  | THE authoritative spec used for build via stage A and B.                  | Consult FIRST for any requirement question. Check status table for progress.                          |
| `@spec/STAGE_D.md`       | Current stage details, requirements, checklist, and implementation notes. | Reference for understanding what's being built in this stage. After implementations update checklist. |
| `@config/flows.yaml`     | Flow/task/step definitions. Single source of truth for app behavior.      | Implement EXACTLY as defined. Never modify.                                                           |
| `@config/vite.config.js` | Build and dev server configuration.                                       | Controls hot reload and asset handling.                                                               |
| `@src/index.html`        | Main HTML entry point.                                                    | Reference for structure.                                                                              |
| `@src/core/`             | Core state, data model, and state management logic.                       | Central hub for `prompt_input` state and mutations. Check here for data flow.                         |
| `@src/logic/**`          | Business logic: flow loading, prompt building, GitHub interactions.       | Implement feature logic here. Keep functions pure and testable.                                       |
| `@src/cards/**`          | UI cards (Config, Repo, Task Selection, etc.).                            | Each card owns its own UI rendering and event handling. Emit changes to shared state.                 |
| `@.claude/commands/`     | Claude Code custom commands (skills): `css-guide.md`, `implement.md`.     | Reference before CSS work (`/css-guide`) or major implementation (`/implement`).                      |
| `@package.json`          | Project metadata, dependencies, and npm scripts.                          | Reference for available commands. Update when adding new dependencies.                                |

## Code Rules

- **Simplicity first**: Before implementing complex logic, evaluate if there is a simpler alternative that achieves the same result. If the spec seems over-engineered for the use case, flag it and suggest a simpler approach before proceeding. Prefer the simplest solution that fully satisfies the requirement.
- **CSS work**: Before editing any `.css` file or fixing CSS errors, invoke `/css-guide`. The skill contains all CSS conventions, prohibited patterns, and reference files. See `@.claude/commands/css-guide.md`.
- Minimize class names — reuse elements, prefer semantic HTML selectors. Ask before creating new classes or components.
- Vanilla JavaScript with ES modules.
- One feature per file where practical.
- All asset references in HTML must use relative paths (starting with `./`), not absolute paths starting with `/`. Vite's `base` config handles path rewriting during build.

## Testing Runbook

- Run auto-fixes: stylelint, eslint, and/or prettier.
- Run linters and fix issues that cannot be auto-fixed.
- Run `npm install` + `npm run build` before pushing commits to catch build errors early.
- Run `npm test` before opening a PR. If you change a module that has a corresponding test file, update the tests to match.
- Don't write tests for trivial changes unless asked.

## Commands

```
npm run format        # Auto-format all files with Prettier
npm run lint:fix      # Auto-fix lint issues (ESLint)
npm run lint          # Check code quality (ESLint)
npm run stylelint:fix # Auto-fix CSS lint issues
npm run stylelint     # Check CSS code quality
npm test              # Run all tests
npm install           # Install dependencies
npm run dev           # Start local dev server with hot reload
npm run build         # Production build (outputs to dist/)
```

## Team

- **Product Owner (user)**: Writes specs, defines requirements, reviews and approves PRs.
- **Claude Code (lead engineer)**: Implements features, writes tests, creates PRs. Handles cross-file changes.

- PRs require product owner approval before merge.
- When starting a new task or session, ask about context and intent first rather than assuming. Confirm understanding before writing code.

## Context Efficiency

- **NEVER** re-read files already in context window, treat this as a hard rule.
- Default to `Edit` over `Write` unless creating new files or rewriting >40% of lines.
- If you are asked to read or edit specific files, read them yourself and fon't ask subagent to read full content if not necessary for the request towards the subagent (eg finding imports). 
- Batch related questions into a single Explore query where possible.
- If a task requires changes across many unrelated files (e.g. CSS + JS + tests + config), suggest the user split it into separate sessions grouped by concern.
