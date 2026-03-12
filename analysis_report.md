# DOM-CSS Analysis Report

| Metric                  | Count |
| ----------------------- | ----- |
| CSS classes defined     | 59    |
| Classes used (HTML+JS)  | 62    |
| Unused CSS classes      | 3     |
| Undefined classes       | 6     |
| Inline style violations | 3     |

## Elements Without Classes

| Element      | Occurrences | Without Class | Violations                                                                                                                                                                                                                                 |
| ------------ | ----------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<span>`     | 18          | 9             | cards/card-configuration.js:69, cards/card-configuration.js:76, cards/card-configuration.js:96, cards/card-steps.js:136, cards/card-steps.js:236, common/components.js:104, common/ui.js:358, common/ui.js:451, logic/quality-meter.js:164 |
| `<h3>`       | 3           | 3             | index.html:16, index.html:27, index.html:38                                                                                                                                                                                                |
| `<small>`    | 2           | 2             | common/file-tree.js:52, common/ui.js:206                                                                                                                                                                                                   |
| `<div>`      | 28          | 1             | cards/card-prompt.js:148                                                                                                                                                                                                                   |
| `<template>` | 1           | 1             | common/icons.js:103                                                                                                                                                                                                                        |
| `<label>`    | 1           | 1             | common/ui.js:445                                                                                                                                                                                                                           |

## Unused CSS Classes

- `.meter-info-wrapper` — defined at css/special.css:39
- `.meter-tooltip` — defined at css/special.css:46
- `.meter-tooltip--visible` — defined at css/special.css:63

## Undefined Classes (used but not in CSS)

- `.btn-dismiss` — used at common/components.js:120
- `.btn-retry` — used at common/components.js:113
- `.error-actions` — used at common/components.js:109
- `.error-inline` — used at common/components.js:101
- `.is-shown` — used at cards/card-configuration.js:266, cards/card-configuration.js:276
- `.js-eye-btn` — used at cards/card-configuration.js:146

## Inline Style Violations

- **logic/quality-meter.js:175** — `bar.style.width = `${score}%`;`
- **logic/quality-meter.js:176** — `bar.style.backgroundColor = color;`
- **logic/quality-meter.js:180** — `labelTextEl.style.color = color;`

## Approximate DOM Tree (L3–L7)

```
L3 details#card-configuration.card [Grid 1fr] — index.html:14
├─ L4 summary.card-header [Grid auto 1fr auto] — index.html:15
│  ├─ L5 h3 — index.html:16
│  └─ L5 span.card-meta [Flex row] — index.html:17
└─ L4 div#bd-configuration.card-body [Grid 8×1fr] — index.html:19
   ├─ L5 span — cards/card-configuration.js:69
   ├─ L5 span — cards/card-configuration.js:76
   ├─ L5 span.truncate-start — cards/card-configuration.js:83
   ├─ L5 span — cards/card-configuration.js:96
   ├─ L5 span.icon-eye-on — cards/card-configuration.js:148
   ├─ L5 span.icon-eye-off — cards/card-configuration.js:151
   └─ L5 input.input-field — cards/card-configuration.js:223

L3 details#card-steps.card [Grid 1fr] — index.html:25
├─ L4 summary.card-header [Grid auto 1fr auto] — index.html:26
│  ├─ L5 h3 — index.html:27
│  └─ L5 span.card-meta [Flex row] — index.html:28
└─ L4 div#bd-steps.card-body [Grid 8×1fr] — index.html:30
   ├─ L5 li.output.output-field [Grid auto minmax(0, 1fr) minmax(0, 4fr) minmax(0, 4fr) auto] — cards/card-steps.js:231
   │  ├─ L6 span — cards/card-steps.js:236
   │  ├─ L6 div.cloud [Flex row wrap] — cards/card-steps.js:388
   │  └─ L6 span — cards/card-steps.js:236
   ├─ L5 div.empty-state — cards/card-steps.js:207
   ├─ L5 ol.output-block [Flex column] — cards/card-steps.js:214
   ├─ L5 div.cloud [Flex row wrap] — cards/card-steps.js:412
   └─ L5 span.output-float — cards/card-steps.js:623

L3 details#card-prompt.card [Grid 1fr] — index.html:36
├─ L4 summary.card-header [Grid auto 1fr auto] — index.html:37
│  ├─ L5 h3 — index.html:38
│  └─ L5 span.card-meta [Flex row] — index.html:39
└─ L4 div#bd-prompt.card-body [Grid 8×1fr] — index.html:41
   ├─ L5 div — cards/card-prompt.js:148
   ├─ L5 pre.prompt-output — cards/card-prompt.js:154
   │  └─ L6 div.cloud [Flex row wrap] — cards/card-prompt.js:164
   ├─ L5 div.input [Grid clamp 1fr] — cards/card-prompt.js:200
   └─ L5 div.input [Grid clamp 1fr] — cards/card-prompt.js:211
```

## Class Usage Map

### cards/card-configuration.js

- `.field-picker` × 2
- `.btn-select--selected` × 2
- `.is-shown` × 2
- `.truncate-start` × 1
- `.js-eye-btn` × 1
- `.icon-eye-on` × 1
- `.icon-eye-off` × 1
- `.input-field` × 1
- `.guard-hint` × 1
- `.icon-btn` × 1
- `.icon` × 1
- `.icon-remove` × 1
- `.input` × 1

### cards/card-prompt.js

- `.input` × 2
- `.prompt-output--empty` × 2
- `.icon-btn` × 1
- `.btn--copied` × 1
- `.prompt-output` × 1
- `.cloud` × 1
- `.sr-only` × 1
- `.btn-copy` × 1
- `.icon-clipboard` × 1
- `.icon-check` × 1
- `.xml-tag` × 1

### cards/card-steps.js

- `.cloud` × 4
- `.output` × 2
- `.output-field` × 2
- `.truncate-start` × 1
- `.icon` × 1
- `.icon-remove` × 1
- `.empty-state` × 1
- `.output-block` × 1
- `.btn-pill--on` × 1
- `.output-float` × 1
- `.truncate-end` × 1

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

- `.truncate-start` × 1
- `.field-picker` × 1
- `.cloud` × 1

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
- `.btn-select--selected` × 1
- `.icon-btn` × 1
- `.icon` × 1
- `.icon-remove` × 1
- `.input` × 1
- `.cloud` × 1
- `.btn-pill--on` × 1
- `.btn-icon--labeled` × 1
- `.input-field--textarea` × 1
- `.field-picker-dropdown` × 1
- `.field-picker-empty` × 1
- `.field-picker-item` × 1
- `.tag` × 1
- `.btn-primary` × 1
- `.btn-select` × 1
- `.btn-action` × 1
- `.btn-pill` × 1
- `.btn-icon` × 1
- `.tag-text` × 1

### index.html

- `.card` × 3
- `.card-header` × 3
- `.card-meta` × 3
- `.card-body` × 3

### logic/disclosure-controller.js

- `.guard-hint` × 1

### logic/quality-meter.js

- `.quality-meter` × 1
- `.quality-meter-track` × 1
- `.quality-meter-bar` × 1
- `.card-meta` × 1

## Cross-File Class Map

_Classes appearing in 3+ files (CSS definitions + HTML/JS usage)._

### `.cloud` (6 files)

- cards/card-prompt.js
- cards/card-steps.js
- common/file-tree.js
- common/ui.js
- css/layout.css
- css/special.css

### `.icon` (6 files)

- cards/card-configuration.js
- cards/card-steps.js
- common/icons.js
- common/ui.js
- css/components.css
- css/layout.css

### `.field-picker` (5 files)

- cards/card-configuration.js
- common/file-tree.js
- common/ui.js
- css/components.css
- css/layout.css

### `.icon-btn` (5 files)

- cards/card-configuration.js
- cards/card-prompt.js
- common/main.js
- common/ui.js
- css/components.css

### `.guard-hint` (4 files)

- cards/card-configuration.js
- css/components.css
- css/layout.css
- logic/disclosure-controller.js

### `.icon-remove` (4 files)

- cards/card-configuration.js
- cards/card-steps.js
- common/ui.js
- css/components.css

### `.input` (4 files)

- cards/card-configuration.js
- cards/card-prompt.js
- common/ui.js
- css/layout.css

### `.input-field` (4 files)

- cards/card-configuration.js
- common/ui.js
- css/components.css
- css/layout.css

### `.truncate-start` (4 files)

- cards/card-configuration.js
- cards/card-steps.js
- common/file-tree.js
- css/components.css

### `.btn-icon` (3 files)

- common/ui.js
- css/components.css
- css/layout.css

### `.btn-pill--on` (3 files)

- cards/card-steps.js
- common/ui.js
- css/components.css

### `.btn-select` (3 files)

- common/ui.js
- css/components.css
- css/layout.css

### `.btn-select--selected` (3 files)

- cards/card-configuration.js
- common/ui.js
- css/components.css

### `.card-header` (3 files)

- css/components.css
- css/layout.css
- index.html

### `.card-meta` (3 files)

- css/layout.css
- index.html
- logic/quality-meter.js

### `.field-picker-search` (3 files)

- common/ui.js
- css/components.css
- css/layout.css

### `.icon--chevron` (3 files)

- common/main.js
- css/components.css
- css/layout.css
