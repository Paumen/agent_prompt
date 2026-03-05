---
name: css-guide
description: CSS conventions, prohibited patterns, and style architecture. Invoke before editing any .css file or when resolving CSS lint/build errors.
---

CSS Style Guide — invoke before editing any `.css` file or when resolving CSS lint/build errors.

This skill governs all CSS work. Reference files in `spec/css-guide/` provide deeper guidance for complex work.

---

## When to Use This Skill

- **Always** before editing or creating any `.css` file.
- **Always** when a stylelint error, CSS build error, or visual bug occurs.
- **On error**: read `spec/css-guide/prohibited.md` before attempting fixes.
- **On design-heavy work** (new components, animations, layout changes): also read `spec/css-guide/patterns.md` and `spec/css-guide/architecture.md`.

---

## Pre-Flight Checklist

Before making ANY CSS change, complete these steps in order:

1. **Identify target file(s)** using the File Map below.
2. **Check permissions** — does this file require explicit human permission? (See Permissions below.)
3. **Read the current state** of the file you will edit.
4. **Make the change** following the Do/Don't table below.
5. **Validation is automatic** — the PostToolUse hook runs stylelint with `--fix` on every `.css` edit.
6. **If errors remain**: read `spec/css-guide/prohibited.md`, fix using the approved alternative.
7. **Run `./scripts/css-check.sh`** for full validation (stylelint + dead code detection).
8. **Run `npm run build`** to catch any remaining issues.

---

## File Map

```
src/css/
├── variables.css    — Design tokens only (colors, spacing, typography, etc.)
│                      PROTECTED: requires human permission to edit.
│                      HUMAN names all new custom properties.
│
├── layout.css       — Grid definitions, structural rules, container queries.
│                      Purely spatial: no colors, no typography.
│
├── components.css   — Component styles: buttons, inputs, tags, icons, etc.
│                      Surface colors, text, borders, interaction states.
│
└── special.css      — One-off component styles (quality meter, shimmer, notifications).
                       PROTECTED: requires human permission to edit.
                       Goal: keep this file small and shrinking.
```

**Import order:** `variables.css` → `layout.css` → `components.css` → `special.css`

---

## Folder Structure (this skill)

```
.claude/commands/css-guide.md          ← This file. Core rules, always loaded.
scripts/css-check.sh                   ← Stylelint + dead CSS class detection. Run for full validation.
spec/css-guide/
├── prohibited.md                      ← Prohibited properties/values with rationales + alternatives.
│                                        Read when: stylelint errors, unclear what to use.
├── patterns.md                        ← Component & interaction patterns with code examples.
│                                        Read when: new components, animations, interaction states.
└── architecture.md                    ← CSS architecture deep-dive (layers, scoping, sizing, theming).
                                         Read when: structural layout work, theming, responsiveness.
```

**Automation:**

- **PostToolUse hook** auto-runs `stylelint --fix` on every `.css` file edit.
- **`./scripts/css-check.sh`** runs full validation: stylelint + dead code detection.
- **`./scripts/css-check.sh src/css/layout.css`** runs checks on a single file.

---

## Permissions

Permissions are defined in `CLAUDE.md` (File Permissions section) and are the single source of truth. This skill does NOT duplicate those rules — refer to `CLAUDE.md` for the canonical list.

**CSS-specific reminders** (derived from CLAUDE.md):

- `variables.css` and `special.css` require explicit human permission per edit.
- New CSS classes require permission. Reuse existing classes first.
- Inline styles in `.js` or `.html` require permission.
- New color, size, or spacing values must be added as variables first, after human approval.
- Linter/formatter config changes require permission.

**Permission Request Format:**
When you need permission, request it individually (not bundled) with:

1. **Request ID#** (sequential, e.g., #01)
2. **Affected File(s)**
3. **Exception Needed** (specific property/value/class)
4. **Rationale & Evidence** (why the standard is insufficient)
5. **Alternatives Considered**

> Example: Request ID: #01 | File: layout.css | Exception: new class `.card-collapsed` | Rationale: no existing class covers this state, `:has()` selector insufficient because [...] | Alternatives: using `[data-state]` attribute (tested, specificity conflict with...)

**Granting Permission:**
Permission is valid **only** if the human responds with the request ID# and the code: `SESAMOPENU`. This forces deliberate evaluation — not reflexive approval. Permissions are single-use and expire at the end of the session.

---

## Do's and Don'ts

| Feature            | Do (Modern / Preferred)                       | Don't (Legacy / Avoid)             | Why                                             |
| :----------------- | :-------------------------------------------- | :--------------------------------- | :---------------------------------------------- |
| **Spacing**        | `gap: 1rem;`                                  | `margin-bottom: 1rem;`             | `gap` manages flow without orphaned margins.    |
| **2D Layout**      | `display: grid;` / `subgrid;`                 | `float` / `table` / `flex` grids   | Modern CSS is robust and content-aware.         |
| **Responsiveness** | `@container (width > 400px)`                  | `@media (min-width: 768px)`        | Components should be spatially self-aware.      |
| **Dark Mode**      | `color: light-dark(#000, #fff);`              | `.dark-mode { color: #fff; }`      | Native engine handling vs. class toggling.      |
| **Logic**          | `:has(.input-error)`                          | JS `.classList.add()`              | Reduces JS-to-CSS dependency.                   |
| **Dimensions**     | `width: auto;` / intrinsic                    | `width: 100vw;` / `500px;`         | Hard-coded units break scalability.             |
| **Interactions**   | `<details>` / `<summary>`                     | `div` + JS click listeners         | Accessible, zero-JS functionality.              |
| **Shorthand**      | `padding: 1rem;` / `inset: 0;`                | `padding-top` / `top: 0; left: 0;` | Reduces code volume and override complexity.    |
| **Units**          | `cqi`/ `rem` / `clamp()`                      | `px` for font or spacing           | `px` ignores user browser/zoom preferences.     |
| **State**          | `[aria-expanded="true"]`                      | `.is-active` / `.is-open`          | Semantic, accessible, no custom classes needed. |
| **Colors**         | `var(--color-*)` from variables.css           | Hard-coded hex/rgb/oklch           | Tokens ensure consistency and themeability.     |
| **Hover**          | `color-mix(in srgb, var(--brand), black 15%)` | Hard-coded hover color             | Derived mathematically from one token.          |

---

## Development Standards

- **KISS & DRY:** The best solution usually involves removing CSS, not adding it.
- **Modern-First (2026+):** Optimize for modern engines. Zero legacy fallbacks.
- **No Dead Code:** Delete unused styles immediately. Don't keep "just in case" rules.
- **Decoupled:** Changes in one layer (HTML/CSS/JS) should not force updates in others.
- **No Hacks:** Never bypass linters (e.g., `[id=foo]` to dodge ID rules, oklch tricks to avoid variables).
- **No Compensating CSS:** If a wrapper is removed, verify if the parent handles layout naturally before adding rules.
- **Component Reuse:** Reuse generic classes (`.card`, `.btn-pill`). Don't create new structures for minor visual variations.

---

## Margin Exception

`margin` is prohibited for spacing between siblings — use `gap` instead.

**Allowed exceptions:**

- Top-level elements (children of `<body>`) where `gap` cannot be applied.
- Negative margins for specific alignment corrections (must document rationale in a comment).

When in doubt: if `gap` can achieve the same result, use `gap`.

---

## Error Recovery: When Stylelint Fails

Follow this decision tree — do NOT guess or try random fixes:

1. **Read the exact error message.** Identify the property, value, and rule that failed.
2. **Check `spec/css-guide/prohibited.md`** for the prohibited item and its approved alternative.
3. **If the alternative requires a variable** that doesn't exist → request permission to add it to `variables.css`.
4. **If the alternative requires a new class** → request permission with the format above.
5. **If you genuinely cannot find an alternative** → STOP and ask the human. Explain what you tried.
6. **NEVER** modify stylelint config, eslint config, or use inline styles to work around the error.
7. **After fixing**, re-run `npm run stylelint` to confirm the fix worked.

---

## When You're Stuck

If you cannot achieve the visual result without a prohibited property or pattern:

1. **STOP.** Do not try workarounds, hacks, or "creative" solutions.
2. **Report to the human** with:
   - What you're trying to achieve visually.
   - Which convention is blocking you.
   - What alternatives you already considered and why they don't work.
3. **Wait for guidance.** The human may grant an exception, suggest an approach you hadn't considered, or adjust the requirement.

The cost of asking is zero. The cost of a CSS hack is technical debt that compounds.

---

## Reference Files

For deeper guidance, read the appropriate reference file from `spec/css-guide/`:

| File              | Read when...                                                                                 |
| :---------------- | :------------------------------------------------------------------------------------------- |
| `prohibited.md`   | Stylelint error, unsure what's prohibited, need the approved alternative                     |
| `patterns.md`     | Building new components, adding animations, interaction states, hover/focus patterns         |
| `architecture.md` | Structural layout work, `@layer`/`@scope` usage, theming, container queries, sizing strategy |
