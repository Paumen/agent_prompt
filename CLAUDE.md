# Agent Prompt — Claude Code Instructions

## Project Overview

Single-page web app that generates prompts for AI-powered GitHub automation. The app has a two-layer architecture:

- **Atomic Task Model** (back-end logic): Load context, analyze (run lenses), plan, generate artifacts, apply changes, verify, report.
- **Flows** (front-end UI): User-facing experiences that bundle atomic tasks — Review PR, Fix PR, Create from spec, Rewrite docs, Refactor structure, Operate GitHub.

The UI consists of five collapsible, resizable cards: Configuration, Scope, Tasks, Steps, Prompts.

**Current phase**: Repository setup complete. Implementation not yet started.

## Authority Hierarchy

In case of conflicts between files, the higher-ranked file is always correct:

```
spec/spec_concept.md  >  src/config/flows.yaml  >  source code
```

If a conflict exists, update the lower-ranked file to match. If unclear, ask the user.

## File Guide

| File                                                | Purpose                                                                   | How to use                                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spec/spec_concept.md`                              | THE authoritative spec. Has an Implementation Status table at the bottom. | Consult FIRST for any requirement question. Check status table for progress.                                                                                          |
| `spec/spec_and_framework_and_schemas_trade-offs.md` | Brainstorm/reference material for task schemas, lenses, flow configs.     | Only consult when you need detail on a specific feature. Search for the relevant section — do NOT read the whole file. Will be deleted after `flows.yaml` is created. |
| `spec/TASK_FRAMEWORK_IDEA.md`                       | High-level intent mapping: user intents → agent actions.                  | Quick reference for understanding the scope of the app.                                                                                                               |
| `src/config/flows.yaml`                             | Flow/task/step definitions. Single source of truth for app behavior.      | Implement EXACTLY as defined here. Never modify without asking.                                                                                                       |

## File Permissions

- **NEVER** edit `spec/spec_concept.md`, `spec/TASK_FRAMEWORK_IDEA.md`, or `spec/spec_and_framework_and_schemas_trade-offs.md` without asking the user first. **Exception**: Status updates to the Implementation Status table and entries to the Decisions Log in `spec/spec_concept.md` are permitted as part of the normal workflow.
- **NEVER** edit `src/config/flows.yaml` without asking the user first.
- **NEVER** edit `.github/workflows/` without asking the user first.
- **MAY** freely edit files in `src/` (except `src/config/flows.yaml`), `tests/`, and `package.json`.

## Anti-Over-Engineering Rule

Before implementing complex logic, evaluate if there is a simpler alternative that achieves the same result. If the spec seems over-engineered for the use case, flag it and suggest a simpler approach before proceeding. Prefer the simplest solution that fully satisfies the requirement.

## CSS Rules

- Use CSS custom properties (variables) defined in `src/css/variables.css`.
- Minimize class names — reuse elements, prefer semantic HTML selectors.
- Mobile-first: base styles for mobile, `@media` queries for larger screens.
- No CSS frameworks, no preprocessors — plain CSS only.
- Any new color, size, or spacing value must be added as a variable first in `variables.css`.

## Code Conventions

- Vanilla JavaScript with ES modules.
- No unnecessary abstractions — keep code direct and readable.
- One feature per file where practical.
- All asset references in HTML must use relative paths (starting with `./`), not absolute paths starting with `/`. Vite's `base` config handles path rewriting during build.
- Run `npm run build` before creating a PR to catch build errors early.

## Commands

```
npm run dev       # Start local dev server with hot reload
npm run build     # Production build (outputs to dist/)
npm run lint      # Check code quality
npm run lint:fix  # Auto-fix lint issues
npm run format    # Auto-format all files with Prettier
npm test          # Run all tests
```

## Workflow

1. Write a test for every feature/requirement implemented.
2. After implementing a spec requirement, update its status in the Implementation Status table at the bottom of `spec/spec_concept.md` (`pending` → `implemented` → `tested`).
3. Log significant technical decisions in the Decisions Log section of `spec/spec_concept.md`.
4. Every PR must fill in the PR template (requirements addressed, testing done).
5. Run `npm run format` and `npm run lint:fix` before committing.
6. Run `npm run build` before creating a PR.

## Team

- **Product Owner (user)**: Writes specs, defines requirements, reviews and approves PRs.
- **Claude Code (lead engineer)**: Implements features, writes tests, creates PRs. Handles cross-file changes.
- **Z.ai / GLM-5 (dev support)**: Single-file fixes, maintenance, prototyping.
- **Gemini Code Assist (reviewer)**: Automated PR review, security checks. Check its comments before requesting human review.

PRs require product owner approval before merge.

**Working with the product owner:**

- The product owner is non-technical. Use plain language in PR descriptions, status summaries, and questions — explain _what it does and why_, not just _what files changed_.
- When starting a new task or session, ask about context and intent first rather than assuming. Confirm understanding before writing code.
- "Keep it basic" means the minimum setup that prevents downstream rework — not the minimum number of files or features.
