# DOM-CSS Analysis Report

| Metric | Count |
|--------|-------|
| CSS classes defined | 60 |
| Classes used (HTML+JS) | 63 |
| Unused CSS classes | 1 |
| Undefined classes | 4 |
| Inline style violations | 5 |

## Elements Without Classes

| Element | Occurrences | Without Class | Violations |
|---------|-------------|---------------|------------|
| `<span>` | 20 | 12 | index.html:19, index.html:33, index.html:47, index.html:61, cards/card-configuration.js:69, cards/card-configuration.js:78, cards/card-configuration.js:87, cards/card-steps.js:137, cards/card-tasks.js:178, common/components.js:106, common/ui.js:427, logic/quality-meter.js:163 |
| `<label>` | 9 | 9 | cards/card-configuration.js:121, cards/card-configuration.js:161, cards/card-configuration.js:291, cards/card-configuration.js:378, cards/card-configuration.js:459, cards/card-configuration.js:516, cards/card-steps.js:222, cards/card-steps.js:240, common/ui.js:421 |
| `<div>` | 46 | 4 | cards/card-configuration.js:462, cards/card-configuration.js:519, cards/card-prompt.js:158, logic/quality-meter.js:159 |
| `<small>` | 2 | 2 | cards/card-tasks.js:181, common/file-tree.js:52 |
| `<template>` | 1 | 1 | common/icons.js:103 |

## Unused CSS Classes

- `.wrapper` — defined at css/layout.css:160, css/layout.css:168

## Undefined Classes (used but not in CSS)

- `.btn-dismiss` — used at common/components.js:122
- `.btn-retry` — used at common/components.js:115
- `.error-actions` — used at common/components.js:111
- `.error-inline` — used at common/components.js:103

## Inline Style Violations

- **cards/card-tasks.js:523** — `dot.style.opacity = dot._satisfied ? '0.2' : '1';`
- **cards/card-tasks.js:551** — `d.style.opacity = isSatisfied ? '0.2' : '1';`
- **logic/quality-meter.js:173** — `bar.style.width = `${score}%`;`
- **logic/quality-meter.js:174** — `bar.style.backgroundColor = color;`
- **logic/quality-meter.js:178** — `labelTextEl.style.color = color;`

## Approximate DOM Tree (L3–L7)

```
section#card-configuration.card.card--open [Grid 1fr] — index.html:13
  button.card-header [Grid 1fr auto] — index.html:14
    span — index.html:19
  div#bd-configuration.card-body [Grid 1fr] — index.html:21
    span — cards/card-configuration.js:69
    span — cards/card-configuration.js:78
    span — cards/card-configuration.js:87
    label — cards/card-configuration.js:121
    span.icon-eye-on — cards/card-configuration.js:138
    span.icon-eye-off — cards/card-configuration.js:141
    label — cards/card-configuration.js:161
    label — cards/card-configuration.js:516
    div — cards/card-configuration.js:519
section#card-tasks.card [Grid 1fr] — index.html:27
  button.card-header [Grid 1fr auto] — index.html:28
    span — index.html:33
  div#bd-tasks.card-body [Grid 1fr] — index.html:35
    div.card.card--open [Grid 1fr] — cards/card-tasks.js:124
      div.card-body [Grid 1fr] — cards/card-tasks.js:134
    div.card.card--open [Grid 1fr] — cards/card-tasks.js:141
      div.card-body [Grid 1fr] — cards/card-tasks.js:151
    button.card-header [Grid 1fr auto] — cards/card-tasks.js:172
      span — cards/card-tasks.js:178
        small — cards/card-tasks.js:181
    div.input [Grid clamp 1fr] — cards/card-tasks.js:206
    span.required-group-dot [inline-block] — cards/card-tasks.js:215
    div.field-picker [Flex column] — cards/card-tasks.js:290
      div.empty-state — cards/card-tasks.js:328
      div.empty-state — cards/card-tasks.js:328
    div.cloud [Flex row wrap] — cards/card-tasks.js:413
    div.input [Grid clamp 1fr] — cards/card-tasks.js:467
section#card-steps.card [Grid 1fr] — index.html:41
  button.card-header [Grid 1fr auto] — index.html:42
    span — index.html:47
  div#bd-steps.card-body [Grid 1fr] — index.html:49
    div.empty-state — cards/card-steps.js:113
    ol.output-block [Flex column] — cards/card-steps.js:120
    li.output.output-field [Grid auto 1fr auto] — cards/card-steps.js:132
      span — cards/card-steps.js:137
    div.cloud [Flex row wrap] — cards/card-steps.js:269
      label — cards/card-steps.js:240
      div.cloud [Flex row wrap] — cards/card-steps.js:244
    div.input [Grid clamp 1fr] — cards/card-steps.js:219
      label — cards/card-steps.js:240
    span.output-float — cards/card-steps.js:412
section#card-prompt.card [Grid 1fr] — index.html:55
  button.card-header [Grid 1fr auto] — index.html:56
    span — index.html:61
  div#bd-prompt.card-body [Grid 1fr] — index.html:63
    span.meter-info-wrapper [Flex row] — cards/card-prompt.js:116
      div.meter-tooltip — cards/card-prompt.js:125
    div — cards/card-prompt.js:158
    pre.prompt-output — cards/card-prompt.js:164
      div.cloud [Flex row wrap] — cards/card-prompt.js:174
    div.input [Grid clamp 1fr] — cards/card-prompt.js:210
```

## Class Usage Map

### cards/card-configuration.js

- `.input` × 6
- `.is-shown` × 2
- `.cloud` × 2
- `.js-eye-btn` × 1
- `.icon-eye-on` × 1
- `.icon-eye-off` × 1
- `.card--open` × 1
- `.icon-btn` × 1
- `.icon` × 1
- `.icon-remove` × 1

### cards/card-prompt.js

- `.meter-tooltip--visible` × 3
- `.prompt-output--empty` × 2
- `.input` × 1
- `.cloud` × 1
- `.icon-btn` × 1
- `.icon` × 1
- `.btn--copied` × 1
- `.meter-info-wrapper` × 1
- `.meter-tooltip` × 1
- `.prompt-output` × 1
- `.sr-only` × 1
- `.btn-copy` × 1
- `.icon-clipboard` × 1
- `.icon-check` × 1
- `.xml-tag` × 1

### cards/card-steps.js

- `.cloud` × 3
- `.input` × 2
- `.icon` × 1
- `.icon-remove` × 1
- `.empty-state` × 1
- `.output-block` × 1
- `.output` × 1
- `.output-field` × 1
- `.btn-pill--on` × 1
- `.output-float` × 1

### cards/card-tasks.js

- `.card--open` × 3
- `.card-body` × 3
- `.input` × 2
- `.empty-state` × 2
- `.btn-pill--on` × 2
- `.btn-select--selected` × 2
- `.card` × 2
- `.cloud` × 1
- `.icon-btn` × 1
- `.card-header` × 1
- `.icon--chevron` × 1
- `.required-group-dot` × 1
- `.field-picker` × 1

### common/components.js

- `.card--open` × 2
- `.shimmer-label` × 1
- `.shimmer` × 1
- `.shimmer-bar` × 1
- `.error-inline` × 1
- `.error-actions` × 1
- `.btn-retry` × 1
- `.btn-dismiss` × 1
- `.notification` × 1
- `.notification--success` × 1
- `.notification--error` × 1
- `.notification--info` × 1

### common/file-tree.js

- `.field-picker-dropdown--open` × 4
- `.field-picker-empty` × 2
- `.input` × 1
- `.cloud` × 1
- `.field-picker` × 1
- `.field-picker-dropdown` × 1
- `.field-picker-item` × 1

### common/icons.js

- `.icon` × 1

### common/main.js

- `.card--open` × 1
- `.icon-btn` × 1
- `.icon--chevron` × 1

### common/ui.js

- `.field-picker-dropdown--open` × 4
- `.input-field` × 3
- `.field-picker-search` × 2
- `.input` × 1
- `.cloud` × 1
- `.icon-btn` × 1
- `.icon` × 1
- `.icon-remove` × 1
- `.btn-pill--on` × 1
- `.btn-select--selected` × 1
- `.field-picker` × 1
- `.field-picker-dropdown` × 1
- `.field-picker-empty` × 1
- `.field-picker-item` × 1
- `.btn-icon--labeled` × 1
- `.input-field--textarea` × 1
- `.tag` × 1
- `.tag-text` × 1
- `.btn-primary` × 1
- `.btn-select` × 1
- `.btn-action` × 1
- `.btn-pill` × 1
- `.btn-icon` × 1

### index.html

- `.card` × 4
- `.card-header` × 4
- `.card-body` × 4
- `.card--open` × 1

### logic/quality-meter.js

- `.quality-meter` × 1
- `.quality-meter-track` × 1
- `.quality-meter-bar` × 1
