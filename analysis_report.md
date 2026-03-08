# DOM-CSS Analysis Report

| Metric | Count |
|--------|-------|
| CSS classes defined | 63 |
| Classes used (HTML+JS) | 66 |
| Unused CSS classes | 3 |
| Undefined classes | 6 |
| Inline style violations | 3 |

## Elements Without Classes

| Element | Occurrences | Without Class | Violations |
|---------|-------------|---------------|------------|
| `<span>` | 19 | 7 | cards/card-configuration.js:57, cards/card-configuration.js:64, cards/card-steps.js:146, cards/card-tasks.js:187, common/components.js:104, common/ui.js:427, logic/quality-meter.js:163 |
| `<h3>` | 4 | 4 | index.html:15, index.html:26, index.html:37, index.html:48 |
| `<label>` | 3 | 3 | cards/card-steps.js:231, cards/card-steps.js:249, common/ui.js:421 |
| `<div>` | 43 | 2 | cards/card-prompt.js:160, logic/quality-meter.js:159 |
| `<small>` | 2 | 2 | cards/card-tasks.js:190, common/file-tree.js:52 |
| `<template>` | 1 | 1 | common/icons.js:103 |

## Unused CSS Classes

- `.guard-tooltip--prompt` — defined at css/layout.css:133
- `.guard-tooltip--steps` — defined at css/layout.css:129
- `.guard-tooltip--tasks` — defined at css/layout.css:125

## Undefined Classes (used but not in CSS)

- `.btn-dismiss` — used at common/components.js:120
- `.btn-retry` — used at common/components.js:113
- `.error-actions` — used at common/components.js:109
- `.error-inline` — used at common/components.js:101
- `.is-shown` — used at cards/card-configuration.js:178, cards/card-configuration.js:188
- `.js-eye-btn` — used at cards/card-configuration.js:122

## Inline Style Violations

- **logic/quality-meter.js:174** — `bar.style.width = `${score}%`;`
- **logic/quality-meter.js:175** — `bar.style.backgroundColor = color;`
- **logic/quality-meter.js:179** — `labelTextEl.style.color = color;`

## Approximate DOM Tree (L3–L7)

```
L3 details#card-configuration.card [Grid 1fr] — index.html:13
├─ L4 summary.card-header [Grid auto 1fr auto] — index.html:14
│  ├─ L5 h3 — index.html:15
│  └─ L5 span.card-meta [Flex row] — index.html:16
└─ L4 div#bd-configuration.card-body [Grid 8×1fr] — index.html:18
   ├─ L5 span — cards/card-configuration.js:57
   ├─ L5 span — cards/card-configuration.js:64
   ├─ L5 span.truncate-start — cards/card-configuration.js:71
   ├─ L5 span.icon-eye-on — cards/card-configuration.js:124
   └─ L5 span.icon-eye-off — cards/card-configuration.js:127

L3 details#card-tasks.card [Grid 1fr] — index.html:24
├─ L4 summary.card-header [Grid auto 1fr auto] — index.html:25
│  ├─ L5 h3 — index.html:26
│  └─ L5 span.card-meta [Flex row] — index.html:27
└─ L4 div#bd-tasks.card-body [Grid 8×1fr] — index.html:29
   ├─ L5 details.card [Grid 1fr] — cards/card-tasks.js:135
   │  └─ L6 div.card-body [Grid 8×1fr] — cards/card-tasks.js:146
   ├─ L5 details.card [Grid 1fr] — cards/card-tasks.js:152
   │  └─ L6 div.card-body [Grid 8×1fr] — cards/card-tasks.js:163
   ├─ L5 summary.card-header [Grid auto 1fr auto] — cards/card-tasks.js:184
   │  └─ L6 span — cards/card-tasks.js:187
   │     └─ L7 small — cards/card-tasks.js:190
   ├─ L5 div.input [Grid clamp 1fr] — cards/card-tasks.js:207
   ├─ L5 div.field-picker [Flex column] — cards/card-tasks.js:286
   │  ├─ L6 div.empty-state — cards/card-tasks.js:333
   │  └─ L6 div.empty-state — cards/card-tasks.js:333
   ├─ L5 div.cloud [Flex row wrap] — cards/card-tasks.js:426
   └─ L5 div.input [Grid clamp 1fr] — cards/card-tasks.js:480

L3 details#card-steps.card [Grid 1fr] — index.html:35
├─ L4 summary.card-header [Grid auto 1fr auto] — index.html:36
│  ├─ L5 h3 — index.html:37
│  └─ L5 span.card-meta [Flex row] — index.html:38
└─ L4 div#bd-steps.card-body [Grid 8×1fr] — index.html:40
   ├─ L5 div.empty-state — cards/card-steps.js:122
   ├─ L5 ol.output-block [Flex column] — cards/card-steps.js:129
   ├─ L5 li.output.output-field [Grid auto 1fr auto] — cards/card-steps.js:141
   │  └─ L6 span — cards/card-steps.js:146
   ├─ L5 div.cloud [Flex row wrap] — cards/card-steps.js:278
   │  ├─ L6 label — cards/card-steps.js:249
   │  └─ L6 div.cloud [Flex row wrap] — cards/card-steps.js:253
   ├─ L5 div.input [Grid clamp 1fr] — cards/card-steps.js:228
   │  └─ L6 label — cards/card-steps.js:249
   └─ L5 span.output-float — cards/card-steps.js:421

L3 details#card-prompt.card [Grid 1fr] — index.html:46
├─ L4 summary.card-header [Grid auto 1fr auto] — index.html:47
│  ├─ L5 h3 — index.html:48
│  └─ L5 span.card-meta [Flex row] — index.html:49
└─ L4 div#bd-prompt.card-body [Grid 8×1fr] — index.html:51
   ├─ L5 span.meter-info-wrapper [Flex row] — cards/card-prompt.js:116
   │  └─ L6 div.meter-tooltip — cards/card-prompt.js:125
   ├─ L5 div — cards/card-prompt.js:160
   ├─ L5 pre.prompt-output — cards/card-prompt.js:167
   │  └─ L6 div.cloud [Flex row wrap] — cards/card-prompt.js:177
   └─ L5 div.input [Grid clamp 1fr] — cards/card-prompt.js:213
```

## Class Usage Map

### cards/card-configuration.js

- `.field-picker` × 2
- `.is-shown` × 2
- `.truncate-start` × 1
- `.js-eye-btn` × 1
- `.icon-eye-on` × 1
- `.icon-eye-off` × 1
- `.icon-btn` × 1
- `.icon` × 1
- `.icon-remove` × 1
- `.input` × 1

### cards/card-prompt.js

- `.meter-tooltip--visible` × 3
- `.prompt-output--empty` × 2
- `.icon-btn` × 1
- `.icon` × 1
- `.input` × 1
- `.btn--copied` × 1
- `.meter-info-wrapper` × 1
- `.meter-tooltip` × 1
- `.prompt-output` × 1
- `.cloud` × 1
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

- `.card-body` × 3
- `.btn-select--selected` × 3
- `.input` × 2
- `.empty-state` × 2
- `.btn-pill--on` × 2
- `.card` × 2
- `.field-picker` × 1
- `.icon-btn` × 1
- `.cloud` × 1
- `.card-header` × 1
- `.icon--chevron` × 1

### common/components.js

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
- `.field-picker` × 1
- `.input` × 1
- `.cloud` × 1
- `.field-picker-dropdown` × 1
- `.field-picker-item` × 1

### common/icons.js

- `.icon` × 1

### common/main.js

- `.icon-btn` × 1
- `.icon--chevron` × 1

### common/ui.js

- `.field-picker-dropdown--open` × 4
- `.input-field` × 3
- `.field-picker-search` × 2
- `.field-picker` × 1
- `.icon-btn` × 1
- `.icon` × 1
- `.icon-remove` × 1
- `.input` × 1
- `.cloud` × 1
- `.btn-pill--on` × 1
- `.btn-select--selected` × 1
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
- `.card-meta` × 4
- `.card-body` × 4

### logic/disclosure-controller.js

- `.guard-tooltip--visible` × 2
- `.guard-hint` × 1
- `.guard-tooltip` × 1

### logic/quality-meter.js

- `.quality-meter` × 1
- `.quality-meter-track` × 1
- `.quality-meter-bar` × 1

## Cross-File Class Map

*Classes appearing in 3+ files (CSS definitions + HTML/JS usage).*

### `.cloud` (7 files)

- cards/card-prompt.js
- cards/card-steps.js
- cards/card-tasks.js
- common/file-tree.js
- common/ui.js
- css/layout.css
- css/special.css

### `.icon` (7 files)

- cards/card-configuration.js
- cards/card-prompt.js
- cards/card-steps.js
- common/icons.js
- common/ui.js
- css/components.css
- css/layout.css

### `.input` (7 files)

- cards/card-configuration.js
- cards/card-prompt.js
- cards/card-steps.js
- cards/card-tasks.js
- common/file-tree.js
- common/ui.js
- css/layout.css

### `.field-picker` (6 files)

- cards/card-configuration.js
- cards/card-tasks.js
- common/file-tree.js
- common/ui.js
- css/components.css
- css/layout.css

### `.icon-btn` (6 files)

- cards/card-configuration.js
- cards/card-prompt.js
- cards/card-tasks.js
- common/main.js
- common/ui.js
- css/components.css

### `.btn-pill--on` (4 files)

- cards/card-steps.js
- cards/card-tasks.js
- common/ui.js
- css/components.css

### `.card` (4 files)

- cards/card-tasks.js
- css/components.css
- css/layout.css
- index.html

### `.card-header` (4 files)

- cards/card-tasks.js
- css/components.css
- css/layout.css
- index.html

### `.icon--chevron` (4 files)

- cards/card-tasks.js
- common/main.js
- css/components.css
- css/layout.css

### `.icon-remove` (4 files)

- cards/card-configuration.js
- cards/card-steps.js
- common/ui.js
- css/components.css

### `.btn-select` (3 files)

- common/ui.js
- css/components.css
- css/layout.css

### `.btn-select--selected` (3 files)

- cards/card-tasks.js
- common/ui.js
- css/components.css

### `.card-body` (3 files)

- cards/card-tasks.js
- css/layout.css
- index.html

### `.empty-state` (3 files)

- cards/card-steps.js
- cards/card-tasks.js
- css/components.css

### `.field-picker-dropdown` (3 files)

- common/file-tree.js
- common/ui.js
- css/components.css

### `.field-picker-dropdown--open` (3 files)

- common/file-tree.js
- common/ui.js
- css/components.css

### `.field-picker-empty` (3 files)

- common/file-tree.js
- common/ui.js
- css/components.css

### `.field-picker-item` (3 files)

- common/file-tree.js
- common/ui.js
- css/components.css

### `.field-picker-search` (3 files)

- common/ui.js
- css/components.css
- css/layout.css

### `.guard-hint` (3 files)

- css/components.css
- css/layout.css
- logic/disclosure-controller.js

### `.guard-tooltip` (3 files)

- css/components.css
- css/layout.css
- logic/disclosure-controller.js

### `.input-field` (3 files)

- common/ui.js
- css/components.css
- css/layout.css

### `.output-field` (3 files)

- cards/card-steps.js
- css/components.css
- css/layout.css
