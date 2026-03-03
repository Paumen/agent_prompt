# Agent Prompt — Claude Code Instructions

## Project Overview

Single-page web app that generates prompts agentic llm.

**Current phase**: Repository setup complete. Implementation v1 completed, V2 phase 0, 1, and 2 complete, phase 3 to start.

## Authority Hierarchy

In case of conflicts between files, the higher-ranked file is always correct:

```
@spec/spec_concept.md  > @src/config/flows.yaml > @source code
```

If a conflict exists, update the lower-ranked file to match. If unclear, ask the user.

## File Guide

| File                    | Purpose                                                                   | How to use                                                                   |
| ----------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `spec/spec_concept.md`  | THE authoritative spec. Has an Implementation Status table at the bottom. | Consult FIRST for any requirement question. Check status table for progress. |
| `src/config/flows.yaml` | Flow/task/step definitions. Single source of truth for app behavior.      | Implement EXACTLY as defined here. Never modify without asking.              |

## File Permissions

- **NEVER** edit `spec/spec_concept.md`, `src/config/flows.yaml`, `.github/workflows/`, edit `src/css/variables.css`, OR `src/css/specials.css` without asking the user first.
- **Exception**: Prettier formatting changes applied via `npm run format` are permitted without asking.

## Anti-Over-Engineering Rule

Before implementing complex logic, evaluate if there is a simpler alternative that achieves the same result. If the spec seems over-engineered for the use case, flag it and suggest a simpler approach before proceeding. Prefer the simplest solution that fully satisfies the requirement.

## Code Conventions

- Vanilla JavaScript with ES modules.
- No unnecessary abstractions — keep code direct and readable.
- One feature per file where practical.
- All asset references in HTML must use relative paths (starting with `./`), not absolute paths starting with `/`. Vite's `base` config handles path rewriting during build.
- Run `npm run build` before creating a PR to catch build errors early.
- **NEVER** apply inline styles in .js or .html without asking the user first.
- Use CSS custom properties (variables) defined in `src/css/variables.css`. Request if you need other or adjustments.
- Minimize class names — reuse elements, prefer semantic HTML selectors. Ask before creating new classes or components.
- Use modern futures like light-dark, container queries, cqi, dvh, clamp(), :is(), :had(), :where(), etc.
- Plain CSS only.
- Any new color, size, or spacing value must be added as a variable first in `variables.css` and only after approval user.

## Commands

```
npm run dev       # Start local dev server with hot reload
npm run build     # Production build (outputs to dist/)
npm run lint      # Check code quality
npm run lint:fix  # Auto-fix lint issues
npm run format    # Auto-format all files with Prettier
npm test          # Run all tests
```

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
