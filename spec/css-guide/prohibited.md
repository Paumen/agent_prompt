# Prohibited Properties, Values & Patterns

Consult this file when a stylelint error occurs or you're unsure whether a property/value is allowed.

---

## Prohibited Properties

| Property / Pattern                                  | Use Instead                   | Rationale                                                                     |
| :-------------------------------------------------- | :---------------------------- | :---------------------------------------------------------------------------- |
| `float`                                             | `display: grid` or `flex`     | Legacy layout. Grid/flex are content-aware.                                   |
| `margin` (between siblings)                         | `gap` within grid/flex parent | Gap manages flow without orphaned margins. See exceptions in main skill file. |
| `padding-top`, `padding-right`, etc.                | `padding` shorthand           | Reduces code volume and override complexity.                                  |
| `top`, `right`, `bottom`, `left` (set individually) | `inset` shorthand             | Same: fewer declarations, easier to scan.                                     |
| ID selectors for styling (`#foo`)                   | Class or element selectors    | IDs are reserved for JS hooks and ARIA references.                            |
| `[id=foo]` (attribute hack)                         | Don't style by ID at all      | This is a linter bypass hack.                                                 |

## Prohibited Values

| Value / Pattern               | Use Instead                                   | Rationale                                           |
| :---------------------------- | :-------------------------------------------- | :-------------------------------------------------- |
| `px` for font-size or spacing | `rem`, `em`, `clamp()`, `ch`                  | `px` ignores user browser/zoom preferences.         |
| `100vw` / fixed `px` widths   | `auto`, intrinsic sizing, `clamp()`           | Hard-coded units break scalability.                 |
| Hard-coded hex/rgb colors     | `var(--color-*)` from variables.css           | Tokens ensure consistency and themeability.         |
| Hard-coded oklch values       | `var(--color-*)` from variables.css           | Using oklch to avoid defined variables is a bypass. |
| Hard-coded hover colors       | `color-mix(in srgb, var(--token), black 15%)` | Derive states mathematically from tokens.           |

## Prohibited Patterns

| Pattern                                       | Use Instead                                | Rationale                                                          |
| :-------------------------------------------- | :----------------------------------------- | :----------------------------------------------------------------- |
| `@media (min-width: ...)` for component logic | `@container (width > ...)`                 | Components should be spatially self-aware, not viewport-dependent. |
| `.dark-mode { ... }` class toggling           | `light-dark()` function                    | Native engine handling; no JS class toggling needed.               |
| `.is-active`, `.is-open` state classes        | `[aria-expanded]`, `[aria-selected]`, etc. | Semantic, accessible, no custom classes needed.                    |
| JS `.classList.add()` for visual state        | `:has()`, `:is()`, attribute selectors     | Reduces JS-to-CSS coupling.                                        |
| `div` + JS click for expand/collapse          | `<details>` / `<summary>`                  | Accessible, zero-JS functionality.                                 |
| Inline styles in JS or HTML                   | CSS rules in appropriate `.css` file       | Decoupled architecture; never mix layers.                          |
| Modifying linter/formatter config to bypass   | Fix the code, not the config               | Config changes require explicit permission.                        |

## Allowed Exceptions

These are the ONLY cases where normally-prohibited values are permitted:

| Exception                           | Condition                                           | Example                                  |
| :---------------------------------- | :-------------------------------------------------- | :--------------------------------------- |
| `px` for border widths              | Always allowed                                      | `border: 1px solid var(--color-border);` |
| `px` in `clamp()` for min-height    | Scrollable containers only, must document rationale | `min-height: clamp(100px, 20vh, 300px);` |
| `margin` on body children           | Only where `gap` cannot be applied                  | Top-level layout elements                |
| `@media` for true viewport concerns | Print styles, orientation, prefers-reduced-motion   | Not for component responsiveness         |
