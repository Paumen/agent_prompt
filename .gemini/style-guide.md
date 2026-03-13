1. Core Architecture & Philosophy

- Technology Stack: Stick to vanilla JavaScript with ES modules. Favor zero-JS fallbacks (using native HTML/CSS) for UI components wherever possible.
- KISS & Decoupling: The best solution usually involves removing CSS, not adding it. Changes in one layer (HTML/CSS/JS) must not force structural updates in the others.

2. JavaScript & State Management

- Single Source of Truth: All data mutations must go through the centralized state setter (setState()) to ensure deterministic UI rendering and prompt generation.
- No DOM-Coupled State: Never use parallel DOM toggles (like classList.add()) to manage visual data states; rely on state subscriptions and semantic HTML attributes.
- File Orchestration: Card files (e.g., card-tasks.js) are strictly for business logic, state orchestration, and API calls. All generic DOM element creation belongs in the ui.js component factory.

3. Layout & Sizing Strategy

- Contextual Spacing: Rely exclusively on gap within flex/grid parents for spacing between siblings. margin is strictly reserved for top-level <body> children where gap cannot be applied, or negative alignment corrections.
- Fluid Dimensioning: Prefer auto, intrinsic sizing, and clamp() for flexible elements rather than hard-coded widths/heights.
- The px Restriction: While your linter does not explicitly ban the px unit, it is strictly prohibited for font sizes and spacing. px is permitted only for border widths.

4. UI, State, & Interaction Patterns

- Semantic Native HTML: Leverage native HTML5 elements (like <details> and <summary>) for interactions such as expand/collapse, completely avoiding custom div + JS click listener patterns.
- Mathematical Hover States: Do not hard-code separate hover colors. Derive them mathematically from the base brand token using color-mix(in srgb, var(--brand), black 15%).
- Motion Budget: Limit transitions strictly to transform and opacity to preserve hardware acceleration and reduce cognitive noise. For elements entering or leaving the DOM, utilize @starting-style and transition-behavior: allow-discrete.
- Non-Intrusive Feedback: Error handling (API limits, auth failures) must be inline and dismissible, preserving context without using blocking modals. Use animated skeleton shimmers during data fetches to mask latency.
