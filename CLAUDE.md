# Claude Code Instructions

## Product Overview

Single-page web app that generates prompts for agentic llm.

Product build hierarchy: Stages(A-Z) > Phases(1-9) > Steps(1-99). Stages A (Core Implementation), B (UX/UI Remediation), and C (Redesign Framework) are complete. See git history and `@spec/STAGE_C.md` for details. Current work begins at Stage D.

## Authority Hierarchy

In case of conflicts between files, the higher-ranked file is always correct:

```
@spec/spec_concept.md  > other files @spec/ > @config/flows.yaml > @src/ and @tests/
```

If a conflict exists, update the lower-ranked file to match. If unclear, ask the user.

## File Guide

| File                   | Purpose                                                                   | How to use                                                                   |
| ---------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `spec/spec_concept.md` | THE authoritative spec. Has an Implementation Status table at the bottom. | Consult FIRST for any requirement question. Check status table for progress. |
| `config/flows.yaml`    | Flow/task/step definitions. Single source of truth for app behavior.      | Implement EXACTLY as defined here. Never modify without asking.              |

## File Permissions

- **NEVER** edit `spec/spec_concept.md`, `config/flows.yaml`, `.github/workflows/`, `src/css/variables.css`, or `src/css/specials.css` without asking the user for explicit permission first.
  - **NEVER** assume permission given for one change implies permission for similar change. Ask for each change separately.
  - **NEVER** assume permission given for changing one file implies permission for similar files or files related to the change. Ask for each change separately.
- **Exception**: Prettier formatting changes applied via `npm run format` are permitted without asking.
- **Exception**: Stylelint auto-fix changes applied via `npm run stylelint:fix` are permitted without asking.

## Code Conventions

- **Simplicity first**: Before implementing complex logic, evaluate if there is a simpler alternative that achieves the same result. If the spec seems over-engineered for the use case, flag it and suggest a simpler approach before proceeding. Prefer the simplest solution that fully satisfies the requirement.
- Vanilla JavaScript with ES modules.
- No unnecessary abstractions — keep code direct and readable.
- One feature per file where practical.
- All asset references in HTML must use relative paths (starting with `./`), not absolute paths starting with `/`. Vite's `base` config handles path rewriting during build.
- Run `npm run build` before creating a PR to catch build errors early.
- **NEVER** apply inline styles in .js or .html without asking the user first.
- Use CSS custom properties (variables) defined in `src/css/variables.css`. Ask before adding or adjusting variables.
- Minimize class names — reuse elements, prefer semantic HTML selectors. Ask before creating new classes or components.
- Use modern features like light-dark, @container, cqi, dvh, clamp(), :is(), :has(), :where(), etc.
- Plain CSS only.
- Any new color, size, or spacing value must be added as a variable first in `variables.css` and only after user approval.

## Commands

```
npm install
npm run dev       # Start local dev server with hot reload
npm run build     # Production build (outputs to dist/)
npm run lint          # Check code quality (ESLint)
npm run lint:fix      # Auto-fix lint issues (ESLint)
npm run stylelint     # Check CSS code quality
npm run stylelint:fix # Auto-fix CSS lint issues
npm run format        # Auto-format all files with Prettier
npm test              # Run all tests
```

## Testing

- Run `npm test` before opening a PR. If you change a module that has a corresponding test file, update the tests to match.
- Don't write tests for trivial changes unless asked.

## Team

- **Product Owner (user)**: Writes specs, defines requirements, reviews and approves PRs.
- **Claude Code (lead engineer)**: Implements features, writes tests, creates PRs. Handles cross-file changes.
- **Z.ai / GLM-5 (dev support)**: Single-file fixes, maintenance, prototyping.
- **Gemini Code Assist (reviewer)**: Automated PR review, security checks. Check its comments before requesting human review.

- PRs require product owner approval before merge.
- When starting a new task or session, ask about context and intent first rather than assuming. Confirm understanding before writing code.

## Context Efficiency

- Default to `Edit` over `Write` unless creating new files or rewriting >50% of lines.
- If you already know you will edit a file, only `Read` the file immediately before editing it — don't pre-read.
- Use Explore agent (not direct reads) when research spans 4+ files.
- **NEVER** re-read files already in context window — treat this as a hard rule.
- Batch related questions into a single Explore query where possible.
- If a task requires changes across many unrelated files (e.g. CSS + JS + tests + config), suggest the user split it into separate sessions grouped by concern.
