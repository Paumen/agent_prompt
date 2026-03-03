# Claude Code Instructions

## Product Overview

Single-page web app that generates prompts for agentic llm.

This product is build in stages (A-Z), phases (1-9), steps (1-99).

### Stage A: Initial Implementation (A1-A9) 
Core app build — **COMPLETE**

| ID | Phase | Status | Summary |
|---|---|---|---|
| A1 | CSS Foundation | ✅ Complete | Design tokens, card shell, feedback styles, a11y |
| A2 | State Management | ✅ Complete | setState/subscribe, localStorage persistence, deterministic prompt |
| A3 | Build Pipeline & Flow Loading | ✅ Complete | YAML→JSON plugin, schema validation, runtime loader |
| A4 | GitHub API & Caching | ✅ Complete | Repos/branches/trees/PRs/issues, 15-min TTL cache, limit enforcement |
| A5 | Config Card | ✅ Complete | PAT/username fields, repo/branch selection, background fetch |
| A6 | Task Card (Dual-Panel) | ✅ Complete | Flow selection, Situation/Target fields, Quality Meter |
| A7 | Steps Card (Auto-Gen) | ✅ Complete | Dynamic step generation, lens pills, delete actions |
| A8 | Prompt Output | ✅ Complete | XML generation, Copy action, Claude.ai deep-link, notes field |
| A9 | Polish & Constraints | ✅ Complete | ≤2 clicks, zero h-scroll, mobile-first audit |

### Stage B: UX/UI fixes and improvements (B1-B6) 

UAT remediation — **COMPLETE**

| B1 | Global Visual Foundation | ✅ Complete | Shadow system, icon migration to Octicon SVGs, field depth |
| B2 | Config Card Refinement | ✅ Complete | Expansion logic, credential UI, iconography |
| B3 | Task Card (Dual-Panel) | ✅ Complete | Visual separation, validation UI, hierarchy, compact layout |
| B4 | Steps & Output Logic | ✅ Complete | Step styling, multi-select outputs, file consolidation, lens stability |
| B5 | Prompt Card & Actions | ✅ Complete | Header actions, icon animation, XML highlighting, quality tooltip |
| B6 | Final UAT & Regression | ✅ Complete | Viewport audit, performance, a11y validation, PO approved |

### Stage C: Redesign Framework (C1-C5)
CSS framework consolidation to eliminate bloat — **IN PROGRESS (Phases C1–C2 complete, Phase C3 starting)**

Details in @spec/redesign-plan-review.md

| ID | Phase | Status | Summary |
|---|---|---|---|
| C1 | CSS Quick Wins | ✅ Complete | Pill/flex/surface consolidation, accent light-dark fix, shadow-inset-sm fix |
| C2 | Framework Definition | ✅ Complete | 4 CSS files (layout/components/special), ui.js factories, clamp() responsive, container queries |
| C3 | Structural Application |  ✅ Complete | Migrate cards to new framework (prompt → steps → config → tasks order) |
| C4 | Pattern Cleanup | ⏳ Pending | Remove card-specific CSS, target <40 core classes, delete old styles.css, no inline styles |
| C5 | Test Simplification | ⏳ Pending | Replace DOM tests with behavior tests, reduce count to <150-200 |

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

PRs require product owner approval before merge.

**Working with the product owner:**

- The product owner is non-technical. Use plain language in PR descriptions, status summaries, and questions — explain _what it does and why_, not just _what files changed_.
- When starting a new task or session, ask about context and intent first rather than assuming. Confirm understanding before writing code.
