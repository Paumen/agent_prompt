# CSS Architecture

Reference file for structural layout work, theming, container queries, and sizing strategy.

---

## Structure & Layout

### The "Gap" Rule

Use `gap` within `grid` (preferred) or `flex` for all spacing between siblings. Never use margin for sibling spacing.

### Sizing

Minimal use of hard-coded `width` or `height`. Prefer:

- `auto` / intrinsic sizing
- `clamp()` for fluid ranges
- `min-content` / `max-content` / `fit-content`

### Fluidity

Components rely on parent width via `@container`. `@media` is reserved for true viewport concerns only (print, orientation, `prefers-reduced-motion`).

```css
/* Do: container query */
@container (width > 400px) {
  .card {
    grid-template-columns: 1fr 1fr;
  }
}

/* Don't: media query for component logic */
@media (min-width: 768px) {
  .card {
    grid-template-columns: 1fr 1fr;
  }
}
```

---

## Logic, State & Variables

### Organization

- Use `@layer` for specificity control: `reset`, `base`, `components`, `utilities`.
- Use `@scope` for style isolation when components risk bleeding into siblings.

### Semantic State

Target native attributes instead of custom classes:

```css
/* Do */
[aria-expanded="true"] { ... }
[aria-selected="true"] { ... }
[aria-checked="true"]  { ... }

/* Don't */
.is-active  { ... }
.is-open    { ... }
.is-checked { ... }
```

### Units

| Context        | Unit                    |
| :------------- | :---------------------- |
| Font sizes     | `rem`, `em`             |
| Spacing / gaps | `rem`                   |
| Dimensions     | `dvh`, `cqi`, `clamp()` |
| Borders        | `px` (only exception)   |

### Naming

Human determines all new CSS Custom Property names in `variables.css`. Never invent variable names without permission.

---

## Theming & Native HTML

### Native UI

Use `accent-color` for form elements (checkboxes, radio buttons, range sliders).

### Functions

Maximize use of:

- `clamp()` — fluid sizing
- `minmax()` — grid track sizing
- `color-mix()` — derived color states
- `light-dark()` — theme-aware colors

### Motion

Use `@starting-style` and `transition-behavior: allow-discrete` for entry/exit animations. Limit transitions to `transform` and `opacity` for hardware acceleration.

### Development Principles

KISS & DRY: The best solution usually involves removing CSS, not adding it.
Modern-First (2026+): Optimize for modern engines. Zero legacy fallbacks.
No Dead Code: Delete unused styles immediately. Don't keep "just in case" rules.
Decoupled: Changes in one layer (HTML/CSS/JS) should not force updates in others.
No Hacks: Never bypass linters (e.g., [id=foo] to dodge ID rules, oklch tricks to avoid variables).
No Compensating CSS: If a wrapper is removed, verify if the parent handles layout naturally before adding rules.
Component Reuse: Reuse generic classes (.card, .btn-pill). Don't create new structures for minor visual variations.
