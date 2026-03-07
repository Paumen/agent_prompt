# Deferred Issues — Stage D Review

Items deferred from Stage D scope during architectural review. Create as GitHub issues flagged as `enhancement`.

---

## 1. Web Component: `<custom-picker>` with ElementInternals

**Original:** D402 proposed refactoring `.field-picker` to a `<custom-picker>` Web Component using `ElementInternals.states` API for `:state(valid)`/`:state(invalid)`.

**Why deferred:** Web Components introduce a new architectural paradigm (shadow DOM boundary, form association, style migration). Stage D should prove the progressive disclosure UX first using `data-valid`/`data-invalid` attributes on native elements. Web Components are a natural Stage E concern once the UX foundation is stable.

**Scope when implemented:**

- Shadow DOM vs light DOM decision
- Form participation via `ElementInternals`
- Migration path for existing `.field-picker` CSS
- Integration with validation framework (D4)

**Labels:** `enhancement`, `stage-e-candidate`

---

## 2. `<dialog>` Guidance Overlay

**Original:** D604 proposed a `<dialog>` guidance overlay with `::backdrop` dimming for progressive disclosure.

**Why deferred:** Zero detail was specified — trigger conditions, content, dismiss behavior, and relationship to progressive disclosure were all undefined. Needs proper UX design before implementation.

**Scope when implemented:**

- Define trigger conditions (first visit? empty state? user action?)
- Content strategy (what guidance to show per card)
- Dismiss behavior (one-time? per-session? dismissible?)
- Relationship to card state machine (does it interact with `data-card-state`?)

**Labels:** `enhancement`, `ux-design-needed`
