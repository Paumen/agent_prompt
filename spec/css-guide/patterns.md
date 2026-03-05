# Component & Interaction Patterns

Reference file for design-heavy work: new components, animations, interaction states.

---

## Component Naming & Specificity (Flat Architecture)

Keep the cascade perfectly flat. Over-nesting increases cognitive load and rendering time.

- **BEM-Lite:** Stripped-down Block-Element pattern. Blocks: `.card`, `.panel`, `.pill`. Elements: `.card-header`, `.dropdown-input`.
- **No Styling on IDs:** Never. IDs are strictly for JS hooks and ARIA references.
- **Shared Primitives:** Reuse core classes across contexts (e.g., `.input-field` for both text areas and dropdown searches).

---

## Motion & Cognitive Easing

Motion is not decorative — it is a cognitive anchor used to mask latency and guide focus.

### Hardware Acceleration

Limit transitions to `transform` and `opacity`. For expand/collapse, animate grid tracks combined with opacity fade.

### Zero-JS "Auto-Height" Transition

```css
.collapsible {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms ease-out;
}

.collapsible.open {
  grid-template-rows: 1fr;
}

.collapsible-content {
  overflow: hidden;
}
```

### Entry/Exit Animations

Use `@starting-style` and `transition-behavior: allow-discrete` for elements entering/leaving the DOM.

---

## Intelligent Interaction States

### Derived Hover States

Never hard-code hover colors. Use `color-mix` to derive states mathematically from a single brand token:

```css
.btn {
  --brand: var(--color-primary);
  background: var(--brand);
  transition: background 200ms;
}

.btn:hover {
  background: color-mix(in srgb, var(--brand), black 15%);
}
```

### Focus Anchoring

Dim siblings of a hovered item to reduce cognitive noise:

```css
.card-stack:has(.card:hover) .card:not(:hover) {
  opacity: 0.4;
  filter: grayscale(0.5);
  scale: 0.98;
}
```

### Native `<details>` Styling

Style the native element for a custom feel:

```css
details summary {
  cursor: pointer;
  list-style: none;
}

details summary::-webkit-details-marker {
  display: none;
}

details[open] summary {
  margin-block-end: 0.5rem;
  color: var(--color-primary);
}
```

---

## General UI/UX Principles

- **Asynchronous Feedback:** Use animated skeleton shimmers during data fetches to mask latency and maintain perceived performance.
- **High-Density Interactions:** Complex data (dense file trees, multi-select pickers) may break conventional touch-target rules, but primary actions remain distinctly accessible. Searchable dropdowns provide instant client-side filtering.
- **Non-Intrusive Error Handling:** Errors (API limits, auth failures) are inline and dismissible, preserving context without modal interruptions.
