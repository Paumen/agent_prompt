# Claude Code Instructions

## Product Overview

Single-page web app that generates prompts for agentic llm.

Product build hierarchy: Stages(A-Z) > Phases(1-9) > Steps(1-99).

### Stage A: Core Implementation — COMPLETE

- [x] A1 CSS Foundation: Design tokens, card shell, feedback styles, a11y
- [x] A2 State Management: setState/subscribe, localStorage, deterministic prompt
- [x] A3 Build Pipeline: YAML→JSON plugin, schema validation, runtime loader
- [x] A4 GitHub API & Caching: Repos/branches/trees, 15-min TTL, limit enforcement
- [x] A5 Config Card: PAT/username fields, repo/branch selection, background fetch
- [x] A6 Task Card: Flow selection, Situation/Target fields, Quality Meter
- [x] A7 Steps Card: Dynamic step generation, lens pills, delete actions
- [x] A8 Prompt Output: XML generation, Copy action, Claude.ai deep-link, notes field
- [x] A9 Polish & Constraints: ≤2 clicks, zero h-scroll, mobile-first audit

### Stage B: UX/UI Remediation — COMPLETE

- [x] B1 Global Visual Foundation: Shadow system, Octicon SVGs, field depth
- [x] B2 Config Card Refinement: Expansion logic, credential UI, iconography
- [x] B3 Task Card: Visual separation, validation UI, hierarchy, compact layout
- [x] B4 Steps & Output Logic: Step styling, multi-select, file consolidation, lens stability
- [x] B5 Prompt Card & Actions: Header actions, icon animation, XML highlighting, quality tooltip
- [x] B6 Final UAT & Regression: Viewport audit, performance, a11y validation, PO approved

### Stage C: Redesign Framework — COMPLETE (Ref: @spec/STAGE_C.md)

- [x] C1 CSS Quick Wins: Pill/flex/surface consolidation, accent fix, shadow-inset-sm fix
- [x] C2 Framework Definition: 4 CSS files, ui.js factories, clamp(), container queries
- [x] C3 Structural Application: Migrate cards (prompt → steps → config → tasks)
- [x] C4 Pattern Cleanup: Remove card-specific CSS, <40 core classes, delete old styles

## Authority Hierarchy

In case of conflicts between files, the higher-ranked file is always correct:

```
@spec/spec_concept.md  > other files @spec/ > @src/config/flows.yaml > @src/ and @tests/
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
npm install
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
- **Llamapreview (reviewer)**: Automated PR review, security checks. Check its comments before requesting human review.

- PRs require product owner approval before merge.
- When starting a new task or session, ask about context and intent first rather than assuming. Confirm understanding before writing code.

## Context Efficiency

- Default to `Edit` over `Write` unless creating new files or rewriting >50% of lines.
- Only `Read` a file immediately before editing it — don't pre-read for planning.
- Use Explore agent (not direct reads) when research spans 4+ files.
- Don't re-read files already in context.
- If a task requires changes across many unrelated files (e.g. CSS + JS + tests + config), suggest the user split it into separate sessions grouped by concern.
