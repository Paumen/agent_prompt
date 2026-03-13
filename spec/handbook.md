# HTML and CSS Modern Features Reference

`<details>`, `<summary>`, `::details-content`

The `<details>` element creates a disclosure widget: its first child `<summary>` is the clickable label that toggles visibility of the rest of the content. When closed, only the summary is shown (often with a triangle indicator); when opened, the remaining content is revealed. The open attribute controls initial state. If no `<summary>` is provided, the user agent supplies a default label. The `::details-content` CSS pseudo-element refers to the collapsible part of a `<details>` box (excluding the `<summary>`).

Meaningful use cases include creating accordion sections or progressive disclosure without JavaScript. Developers often use `<details>` for collapsible content panels, FAQ items, or grouping optional advanced settings. The name attribute on multiple `<details>` elements can link them into a single-selection accordion (only one open at a time).

Common and edge-case examples:

Basic disclosure:

```css
<details>
  <summary>More Info</summary>
  <p>Hidden content here.</p>
</details>
```

Initially open:

```css
<details open><summary>Details (open)</summary><p>Content visible.</p></details>
```

Styling summary and content:

```css
details summary {
  cursor: pointer;
}
details::details-content {
  padding: 8px;
  background: #f0f0f0;
}
details[open] summary {
  font-weight: bold;
}
```

Accordion grouping (same name):

```css
<details name="grp"><summary>A</summary><div>Content A</div></details>
<details name="grp"><summary>B</summary><div>Content B</div></details>
```

Only one in the “grp” will remain open at once.

`:has()`

The `:has()` CSS pseudo-class selects an element if it contains (or is followed/preceded by) elements matching a selector list. It effectively provides a “parent” or relational selector. For example, `section:has(img)` matches any `<section>` with at least one `<img>` descendant; `h1:has(+ h2)` matches an `<h1>` followed immediately by an `<h2>`.

Use cases include styling a container based on its children or state, without extra classes. Examples: highlighting a form `<fieldset>"` if it contains an invalid field (`fieldset:has(:invalid)`), styling a menu button if its submenu is open, or applying layout changes only when certain content exists. It can combine multiple conditions, e.g. `article:has(> .featured, .highlighted)` to select an article containing either child. Sibling/child combinations are powerful: for instance, an image gallery page could use `div:has(img[src*="thumbnail"])` to style containers with specific images.

Examples:

```css
/* Style any section that directly contains an image */
section:has(> img) {
  border: 2px solid #88f;
}

/* Style a heading if immediately followed by a subtitle */
h1:has(+ h2.subtitle) {
  margin-bottom: 0;
  color: navy;
}

/* Mark form group red if it contains an invalid input */
form:has(input:invalid) {
  border: 2px solid red;
}

/* Complex: if a container has either .error or .warning */
.container:has(.error, .warning) {
  background: pink;
}
```

These patterns demonstrate leveraging `:has()` for parent-based and relational styling.

`<datalist>`

The `<datalist>` element defines a set of `<option>` suggestions for an `<input>` (bound via the input’s list attribute). When the user focuses on the input, the browser can show a dropdown of these suggested values. Unlike `<select>`, the user can enter custom values not in the list – `<datalist>` only provides autocomplete hints.

Use cases: form inputs with known possible values (e.g. country names, previously entered search terms, color hex codes). It enhances UX by suggesting values without restricting input. Common examples include `<input list="...">` for free-form but assisted text entry in forms (e.g. browser/autocomplete for search fields, datalist of predefined tags).

Examples:

```html
<label
  >Choose a browser:
  <input list="browsers" />
</label>
<datalist id="browsers">
  <option value="Chrome"></option>
  <option value="Firefox"></option>
  <option value="Safari"></option>
  <option value="Edge"></option>
</datalist>

<!-- Numeric suggestions -->
<input type="number" list="nums" min="1" max="10" />
<datalist id="nums">
  <option value="1"></option>
  <option value="5"></option>
  <option value="10"></option>
</datalist>
```

Browser support is broad but styling is limited. Useful input types include text, number, email, URL, etc., to suggest common values without validation.

`Field Sizing`(field-sizing: content, width: min-content, etc.)

The CSS `field-sizing` property (value content) and intrinsic sizing keywords (min-content, max-content, fit-content) enable automatic sizing of form controls based on their contents. For example, setting field-sizing: content; on an `<input>` or `<textarea>` makes them shrink to fit their placeholder or typed text, growing as content is added (up to `max-width`). This behavior applies to text-like inputs, `<select>`, and `<textarea>`.

Use cases: forms where fields adjust to content length without explicit widths. For example, an expanding chat input field or a select box that only fits its chosen value. It avoids overflow or unwanted width. When using intrinsic sizing, remember to set sensible `min-width`/`max-width` bounds.

Examples:

```css
/* Auto-size text fields to their content */
input[type="text"],
textarea {
  field-sizing: content;
  min-inline-size: 5ch;
  max-inline-size: 50ch;
}

/* Auto-size a multiple select to show all options */
select[multiple] {
  field-sizing: content;
  max-inline-size: 200px;
}
```

Using `width: min-content;` on a container similarly shrinks it to the smallest width needed for content. Note: size attribute on inputs is ignored with `field-sizing: content`. This feature is new (available in modern browsers) and helps create flexible, content-aware form layouts.

`anchor-name` (CSS Anchor Positioning)

The anchor-name CSS property defines an element as an anchor by assigning it a custom name. A positioned element (with position: absolute or fixed) can then set position-anchor: `<name>` to attach itself to that anchor. Using the `anchor()` function in inset properties (e.g. `left: anchor(right)`) then positions the anchored element relative to the anchor’s edges. This effectively changes the containing block of the positioned element to the anchor, “tethering” them.

Use cases: tooltips, info boxes, or popovers anchored to a specific element on the page. For example, anchoring a tooltip to an icon without extra DOM, purely in CSS. When multiple anchors share the same name, the last in source order is used. Anchors can be any box-generating element or pseudo-element.

Examples:

```html
<div class="anchor-icon">⚓</div>
<div class="info-box">Info about the icon.</div>
```

```css
/* Define the anchor name */
.anchor-icon {
  anchor-name: --myAnchor;
}

/* Anchor-position the info box */
.info-box {
  position: fixed;
  position-anchor: --myAnchor;
  left: anchor(right); /* box's left edge to anchor's right edge */
  top: anchor(top);
  margin-left: 5px;
  background: lightyellow;
}
```

In this example (from MDN), `.info-box` stays attached to `.anchor-icon` even on scroll. Multiple positioned elements can use the same anchor name to create tooltips or popups around one anchor.

`:user-valid`, `:user-invalid`

These pseudo-classes target form controls after user interaction. `:user-valid` matches a control whose value validates correctly after the user has edited it; :user-invalid matches one whose value is invalid after user editing. Unlike `:valid/:invalid` (which fire on page load or on form submission), :user-valid/invalid only apply after the user has modified the input.

Use cases: styling fields only in response to user input. This avoids showing error styles on untouched fields. Common patterns:

```css
input:user-valid {
  border-color: green;
}
input:user-invalid {
  border-color: red;
}
```

For example, a checkmark icon can appear after user corrects a field, or a red outline after a mistyped entry. Example from Google’s guidance:

```css
input:required:user-invalid {
  border-color: red;
}
input:required:user-valid {
  border-color: green;
}
```

One can also use adjacent icons:

```css
input:user-valid + span::after {
  content: "✔";
  color: green;
}
input:user-invalid + span::after {
  content: "✖";
  color: red;
}
```

These pseudo-classes improve UX by giving feedback only after user attempts to fill the field.

`<meter>`

The <meter> element represents a gauge of a scalar value within a known range. Common examples include a battery level, disk usage, or progress percentage. It is rendered as a bar (or other native gauge) and can reflect thresholds with low, high, and optimum attributes. If value is outside min/max, it clamps to nearest end. low and high define subranges, and optimum can indicate a target value, allowing the browser to color ranges differently.

Use cases: display of meter-like data in dashboards, forms, or status pages. For example, embedding a CPU usage meter, volume level, or voting result gauge. Unlike `<progress>`, `<meter>` is for fractional values not necessarily tied to task completion.

Examples:

```html
<label
  >Battery level:
  <meter min="0" max="100" value="75">75%</meter>
</label>

<meter min="0" max="100" low="20" high="80" optimum="60" value="50">50%</meter>
```

In the second example, values ≤20 or ≥80 can appear in a different color (green/yellow/red) depending on browser. The content (e.g. “50%”) is fallback for user agents that don’t render the meter bar. While its styling is limited, common properties like color or background can sometimes be applied to customize appearance.

`color-mix()`

The color-mix() CSS function blends two colors in a specified color space. Syntax:

`color-mix(in <colorspace> [<hue-method>], <color1> [<percentage>], <color2> [<percentage>])`

It returns the mixed color. For example color-mix(in srgb, red 25%, blue 75%) produces a purple that is 25% red, 75% blue in sRGB space. You can mix in perceptual spaces (e.g. oklab) or add alpha by mixing with transparent.

Use cases: dynamic theming and color generation. For instance, creating tints or shades:

```css
:root {
  --base: #a71e14;
  --base-light: color-mix(in oklab, var(--base) 50%, white);
}
```

This --base-light is a 50% mix of #a71e14 and white in Oklab space. Another example is adding transparency:

```css
:root {
  --primary: blue;
}
.overlay {
  background: color-mix(in srgb, var(--primary) 50%, transparent);
}
```

This yields a 50% transparent version of the primary color. The function allows arbitrary interpolation (e.g. via Lab, HSL with longer/shorter hue) for desired gradients. It has broad support since 2023.

`animation-timeline: scroll()`

The animation-timeline CSS property can use `scroll()` to tie an element’s CSS animation to scrolling. Setting `animation-timeline: scroll()` creates an anonymous scroll progress timeline (the nearest scroll container by default) for the animation. As you scroll, the animation’s progress shifts accordingly.

Use cases: scroll-driven animations and parallax effects without JavaScript. For example, fade-in elements as they enter the viewport:

```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
img {
  animation: fadeIn 1s linear both;
  animation-timeline: scroll();
}
```

The image will fade in gradually as the page scrolls. One can also define named scroll timelines on containers with `scroll-timeline-name` and use them:

```css
#container {
  scroll-timeline-name: --myScroll;
  scroll-timeline-axis: inline;
  overflow-x: scroll;
}
#shape {
  animation: rotate 1s linear infinite alternate;
  animation-timeline: --myScroll;
}
```

Finally, using the function syntax selects the nearest scrollable container:

```css
#shape {
  animation-timeline: scroll(inline nearest);
}
```

In MDN’s examples, switching from a named timeline to scroll(inline nearest) enabled horizontal scroll-driven animation in the same container. Modern browsers now support `scroll-linked` animation syntax.

`::backdrop`

The `::backdrop` pseudo-element represents the backdrop layer behind an element in the top layer (modal elements). It covers the full viewport under elements like a `<dialog>` shown with `showModal()`, any element in fullscreen, or a <popover> opened with `showPopover()`. Each top-layer element has its own backdrop.

Use cases: styling or dimming the background behind modal dialogs or fullscreen content. For example:

```css
dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}
```

This darkens the page when a dialog is open. In MDN’s example, a dialog backdrop was styled salmon pink:

```css
dialog::backdrop {
  background-color: salmon;
}
```

The backdrop appears only when the element is active (e.g. dialog.showModal() is called). You can apply any CSS to `::backdrop` (color, blur via backdrop-filter, etc.) to achieve custom overlay effects. This pseudo-element is widely supported (since 2022).

`<dialog>``

The `<dialog>` element defines a modal or non-modal dialog box. It can be shown programmatically with JavaScript: `dialog.showModal()` makes it modal (blocking interaction outside and showing a backdrop), and dialog.show() makes it non-modal. Calling `dialog.close()` or using a form with method="dialog" closes it. The presence of the open attribute or these methods controls visibility (by default, absent/open attribute means hidden).

Use cases: implementing pop-up dialogs, alerts, or input forms without external libraries. Since `<dialog>` includes focus trapping and backdrop support, it simplifies modals. Example:

```html
<dialog id="dlg">
  <p>Confirm action?</p>
  <button onclick="dlg.close()">OK</button>
</dialog>
<button id="openBtn">Open Dialog</button>
<script>
  const dlg = document.getElementById("dlg");
  document.getElementById("openBtn").onclick = () => dlg.showModal();
</script>
```

When `showModal()` is called, the dialog appears centered with a backdrop (modifiable via `::backdrop`). The `<dialog>` element supports attributes like open and closedBy, and works with `<form method="dialog">` to automatically close on form submission. It is supported in modern browsers (since around 2022) for building native modals.

`@starting-style`

The `@starting-style` at-rule provides initial styles for elements upon their first style update, enabling CSS transitions on entry. By default, transitions don’t run when an element first appears or changes from display:none to visible. Using `@starting-style`, you define the “from” state of the element so a transition can occur.

Use cases: entry animations for dialogs, popovers, or dynamically added elements. Example – fade in a dialog when shown:

```css
dialog {
  transition: opacity 0.3s ease;
  opacity: 1;
}
@starting-style {
  dialog {
    opacity: 0;
  }
}
```

Here, when dialog is opened, it starts at opacity: 0 and transitions to 1. You can also nest @starting-style inside a selector:

```css
dialog {
  @starting-style {
    opacity: 0;
    transform: translateY(-20px);
  }
  transition:
    opacity 0.3s,
    transform 0.3s;
  opacity: 1;
  transform: none;
}
```

Note: The `@starting-style` block must come after the style it complements (or be more specific) so it isn’t overridden. This at-rule is useful only for CSS transitions (not needed for `@keyframes`). It is relatively new (working in browsers as of mid-2024).

`:checked`

The :checked pseudo-class matches any `<input type="radio">`, `<input type="checkbox">`, or `<option>` in a `<select>` that is selected (checked/on).

Use cases: styling form controls when selected or using checkboxes/radios for toggling UI purely via CSS. Examples:

```css
input[type="checkbox"]:checked + .content {
  display: block;
}
```

A common pattern is a hidden checkbox controlling visibility:

```html
<input type="checkbox" id="toggle" /><label for="toggle">Menu</label>
<nav class="menu">...</nav>
```

```css
#toggle:checked + label + .menu {
  display: block;
}
```

This shows the menu only when the checkbox is checked. Similarly, tabs can be made from radio buttons:

```css
.tab:checked + .tabContent {
  font-weight: bold;
}
```

For custom form styling:

```css
input:checked {
  outline: 2px solid blue;
}
```

Since :checked has been available for years, it is widely used in CSS-only widgets.

`:disabled`

The `:disabled` pseudo-class matches any form control that is disabled (cannot be interacted with).

Use cases: visually indicate inactive fields and prevent interactions. Common styles include graying out:

```css
input:disabled {
  background-color: #eee;
  color: #666;
}
```

Example from MDN highlights disabled fields in a form:

```css
input[type="text"]:disabled {
  background: #cccccc;
}
```

A fieldset or label can also style children:

```css
fieldset:disabled {
  opacity: 0.5;
}
```

In dynamic forms, enabling/disabling fields via JS will automatically apply :disabled styles. This pseudo-class is supported across browsers since at least 2015.

`@layer`

The `@layer` at-rule creates named cascade layers to group and order CSS rules. Layers affect cascade order: rules in later-declared layers override earlier ones regardless of specificity (except `!important`, which inverts priority). This provides finer control over conflicts. By default, unlayered styles override layered ones, and among layers the last-declared has highest priority.

Use cases: organizing CSS (e.g. reset, base, components, utilities) to prevent accidental overrides. For example:

```css
@layer reset, base, theme;
@layer base {
  h1 {
    color: green;
    border: 2px solid green;
  }
}
@layer theme {
  h1 {
    color: rebeccapurple;
  }
}
```

Because theme is declared after base, its color: rebeccapurple wins, while `border: green` from base still applies. You can also declare anonymous layers:

```css
@layer utilities {
  .alert {
    background: yellow;
  }
}
@layer utilities {
  .alert {
    border: 1px solid black;
  }
}
```

Layers help CSS architecture (e.g. isolating third-party libraries in one layer). The basic syntax is either `@layer name { ... }` for block or `@layer name;` to declare empty layers. This feature is widely supported (since early 2022) for complex projects.

`@scope`

The `@scope` at-rule confines style rules to a specific part of the DOM. You declare a scope root (and optionally a scope limit) so that enclosed selectors only apply within that subtree. This avoids overly-specific selectors and style bleed. Inside an inline `<style>` (without prelude), `@scope` implicitly scopes to the parent element of the style tag.

Use cases: styling components or themes without affecting rest of page. For example:

```css
@scope (.light-scheme) {
  :scope {
    background: plum;
  }
  a {
    color: darkmagenta;
  }
}
@scope (.dark-scheme) {
  :scope {
    background: darkmagenta;
    color: antiquewhite;
  }
  a {
    color: plum;
  }
}
```

These only apply to links and background within elements having those classes. Another use: “donut” scopes with a limit

```css
@scope (.feature) to (figure) {
  img {
    border: 5px solid black;
    background: goldenrod;
  }
}
```

This styles all `<img>` under .feature except those inside a `<figure>`. Inline example (in a `<style>``):

```css
<div class="widget">
  <style>
    @scope {
      button { font-weight: bold; }
    }
  </style>
  <button>Click me</button>
</div>
```

Here the `<button>` is styled only inside its parent .widget. This rule is new (CSS Scoping Module) and supported in modern browsers (behind flags in some).

`@property`

The` @property` at-rule (CSS Properties and Values API) registers a custom property’s characteristics. You specify its syntax (value type), whether it inherits, and an initial-value. This enables type-checking and smoother transitions on CSS variables.

Use cases: defining and safeguarding CSS custom properties (variables). For example, to ensure a variable holds only colors and to give it a default:

```css
@property --logo-color {
  syntax: "<color>";
  inherits: false;
  initial-value: #c0ffee;
}
```

This registers `--logo-color` to only accept `<color>` values, not inherit, defaulting to `#c0ffee`. Now animations or interpolations on `--logo-color` are type-aware. Similarly:

```css
@property --rotation {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
```

Means --rotation can only be angles. Without @property, all CSS variables default to inheriting from parent and have no type constraints. Registration (via @property or CSS.registerProperty() in JS) is recommended when animating variables or building component libraries for predictable behavior.

`:placeholder-shown`

The `:placeholder-shown` pseudo-class matches `<input>` or `<textarea>` elements that are currently displaying their placeholder text (i.e. empty and with a placeholder attribute).

Use cases: styling empty fields differently, such as showing hints or hiding floating labels only when input is empty. Examples:

```css
input:placeholder-shown {
  background-color: ivory;
  border: 2px solid darkorange;
}
input:not(:placeholder-shown) {
  border: 2px solid darkgreen;
}
```

Or to toggle a sibling hint:

```html
<input placeholder="Name" /> <span class="hint">Enter your full name</span>
```

```css
input:placeholder-shown + .hint {
  display: block;
}
input:not(:placeholder-shown) + .hint {
  display: none;
}
```

`:placeholder-shown` is supported in all modern browsers (since 2020). It only matches elements with a placeholder attribute; if no placeholder is present, it never matches.

`:focus`, `:focus-within`

The `:focus` pseudo-class applies to an element that has keyboard or mouse focus (e.g. clicked or tabbed). The `:focus-within` pseudo-class matches an element if it or any of its descendants is focused. This includes focus within shadow DOMs.

Use cases: highlighting active inputs or their containers. For example:

```css
input:focus {
  outline: 2px solid blue;
}

focuses the input itself. A common pattern is:

form:focus-within {
  background: #ffff88;
  color: black;
}
```

This applies when any form field inside the `<form>`` is focused, drawing attention to the whole form. Or:

`fieldset:focus-within { border: 2px solid teal; }`

to mark a group of controls. `:focus-within` is useful for styling parent elements (menus, containers, cards) when any child is active. It is well-supported (since around 2020) and works in sync with form navigation. Behavioral example:

```html
<form>
  <label>Name: <input type="text" /></label>
  <label>Email: <input type="email" /></label>
</form>
```

```css
form {
  border: 1px solid gray;
  padding: 5px;
}
form:focus-within {
  background: #eef;
  border-color: #55f;
}
```

Here the form highlights when you click into either input. `:focus-within` thus helps in building accessible, keyboard-friendly UI.

Sources: Authoritative references from MDN and CSS specifications, among others. Each feature is demonstrated with code for fast application.
