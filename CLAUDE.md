# Agent Prompt — Claude Code Instructions

## Project Overview

Single-page web app that generates prompts agentic llm.

**Current phase**: Repository setup complete. Implementation v1 completed, V2 phase 0, 1, and 2 complete, phase 3 to start.

## Phase Status Summary

### Initial Implementation (IMPL-00 to IMPL-14)
Core app build and UAT remediation — **COMPLETE (Phase 14 signed off by PO)**

| ID | Phase | Status | Summary |
|---|---|---|---|
| IMPL-00 | CSS Foundation | ✅ Complete | Design tokens, card shell, feedback styles, a11y |
| IMPL-01 | State Management | ✅ Complete | setState/subscribe, localStorage persistence, deterministic prompt |
| IMPL-02 | Build Pipeline & Flow Loading | ✅ Complete | YAML→JSON plugin, schema validation, runtime loader |
| IMPL-03 | GitHub API & Caching | ✅ Complete | Repos/branches/trees/PRs/issues, 15-min TTL cache, limit enforcement |
| IMPL-04 | Config Card | ✅ Complete | PAT/username fields, repo/branch selection, background fetch |
| IMPL-05 | Task Card (Dual-Panel) | ✅ Complete | Flow selection, Situation/Target fields, Quality Meter |
| IMPL-06 | Steps Card (Auto-Gen) | ✅ Complete | Dynamic step generation, lens pills, delete actions |
| IMPL-07 | Prompt Output | ✅ Complete | XML generation, Copy action, Claude.ai deep-link, notes field |
| IMPL-08 | Polish & Constraints | ✅ Complete | ≤2 clicks, zero h-scroll, mobile-first audit |
| IMPL-09 | Global Visual Foundation | ✅ Complete | Shadow system, icon migration to Octicon SVGs, field depth |
| IMPL-10 | Config Card Refinement | ✅ Complete | Expansion logic, credential UI, iconography |
| IMPL-11 | Task Card (Dual-Panel) | ✅ Complete | Visual separation, validation UI, hierarchy, compact layout |
| IMPL-12 | Steps & Output Logic | ✅ Complete | Step styling, multi-select outputs, file consolidation, lens stability |
| IMPL-13 | Prompt Card & Actions | ✅ Complete | Header actions, icon animation, XML highlighting, quality tooltip |
| IMPL-14 | Final UAT & Regression | ✅ Complete | Viewport audit, performance, a11y validation, PO approved |

### Redesign Framework (REDESIGN-00 to REDESIGN-04)
CSS framework consolidation to eliminate bloat — **IN PROGRESS (Phases 0–1 complete, Phase 2 starting)**

| ID | Phase | Status | Summary |
|---|---|---|---|
| REDESIGN-00 | CSS Quick Wins | ✅ Complete | Pill/flex/surface consolidation, accent light-dark fix, shadow-inset-sm fix |
| REDESIGN-01 | Framework Definition | ✅ Complete | 4 CSS files (layout/components/special), ui.js factories, clamp() responsive, container queries |
| REDESIGN-02 | Structural Application | 🔄 In Progress | Migrate cards to new framework (prompt → steps → config → tasks order) |
| REDESIGN-03 | Pattern Cleanup | ⏳ Pending | Remove card-specific CSS, target <50 core classes, delete old styles.css |
| REDESIGN-04 | Test Simplification | ⏳ Pending | Replace DOM tests with behavior tests, reduce count to 200–250 |

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
