# DOM-CSS Analysis Report

| Metric | Count |
|--------|-------|
| CSS classes defined | 43 |
| Classes used (HTML+JS) | 45 |
| Unused CSS classes | 0 |
| Undefined classes | 2 |
| Inline style violations | 0 |

## Elements Without Classes

| Element | Occurrences | Without Class | Violations |
|---------|-------------|---------------|------------|
| `<span>` | 11 | 6 | cards/card-configuration.js:47, cards/card-configuration.js:53, cards/card-steps.js:134, cards/card-steps.js:234, common/ui.js:259, common/ui.js:312 |
| `<h3>` | 3 | 3 | index.html:16, index.html:27, index.html:38 |
| `<template>` | 1 | 1 | common/icons.js:103 |
| `<button>` | 3 | 1 | common/ui.js:345 |
| `<small>` | 1 | 1 | common/ui.js:138 |
| `<label>` | 1 | 1 | common/ui.js:307 |

## Unused CSS Classes

None detected.

## Undefined Classes (used but not in CSS)

- `.btn-retry` — used at common/ui.js:339
- `.error-inline` — used at common/ui.js:333

## Inline Style Violations

None detected.

## Approximate DOM Tree (L3–L7)

```
L3 details#card-configuration.card [Grid 1fr] — index.html:14
├─ L4 summary.card-header [Grid auto 1fr 1fr 1fr 1fr minmax(5cqi, auto)] — index.html:15
│  ├─ L5 h3 — index.html:16
│  └─ L5 span.card-meta [Flex row] — index.html:17
└─ L4 div#bd-configuration.card-body [Grid 8×1fr] — index.html:19
   ├─ L5 span — cards/card-configuration.js:47
   ├─ L5 span — cards/card-configuration.js:53
   ├─ L5 span.truncate-start — cards/card-configuration.js:59
   └─ L5 input.input-field — cards/card-configuration.js:164

L3 details#card-steps.card [Grid 1fr] — index.html:25
├─ L4 summary.card-header [Grid auto 1fr 1fr 1fr 1fr minmax(5cqi, auto)] — index.html:26
│  ├─ L5 h3 — index.html:27
│  └─ L5 span.card-meta [Flex row] — index.html:28
└─ L4 div#bd-steps.card-body [Grid 8×1fr] — index.html:30
   ├─ L5 li.output.output-field [Grid auto minmax(0, 1fr) minmax(0, 4fr) minmax(0, 4fr) auto] — cards/card-steps.js:229
   │  ├─ L6 span — cards/card-steps.js:234
   │  ├─ L6 div.cloud [Flex row wrap] — cards/card-steps.js:405
   │  └─ L6 span — cards/card-steps.js:234
   ├─ L5 div.empty-state — cards/card-steps.js:205
   ├─ L5 ol.output-block [Flex column] — cards/card-steps.js:212
   └─ L5 div.cloud [Flex row wrap] — cards/card-steps.js:429

L3 details#card-prompt.card [Grid 1fr] — index.html:36
├─ L4 summary.card-header [Grid auto 1fr 1fr 1fr 1fr minmax(5cqi, auto)] — index.html:37
│  ├─ L5 h3 — index.html:38
│  └─ L5 span.card-meta [Flex row] — index.html:39
└─ L4 div#bd-prompt.card-body [Grid 8×1fr] — index.html:41
   ├─ L5 pre.prompt-output — cards/card-prompt.js:127
   ├─ L5 div.input [Grid clamp 1fr] — cards/card-prompt.js:173
   └─ L5 div.input [Grid clamp 1fr] — cards/card-prompt.js:184
```

## Class Usage Map

### cards/card-configuration.js

- `.field-picker` × 2
- `.truncate-start` × 1
- `.btn-select--selected` × 1
- `.input-field` × 1
- `.icon-btn` × 1
- `.icon` × 1
- `.icon-remove` × 1
- `.input` × 1

### cards/card-prompt.js

- `.input` × 2
- `.icon-btn` × 1
- `.btn--copied` × 1
- `.prompt-output` × 1
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
- `.truncate-end` × 1
- `.card-tabs` × 1

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
- `.btn-icon--labeled` × 1
- `.input-field--textarea` × 1
- `.field-picker-dropdown` × 1
- `.field-picker-empty` × 1
- `.field-picker-item` × 1
- `.tag` × 1
- `.shimmer` × 1
- `.shimmer-bar` × 1
- `.error-inline` × 1
- `.btn-retry` × 1
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

## Cross-File Class Map

*Classes appearing in 3+ files (CSS definitions + HTML/JS usage).*

### `.icon` (6 files)

- cards/card-configuration.js
- cards/card-steps.js
- common/icons.js
- common/ui.js
- css/components.css
- css/layout.css

### `.icon-btn` (5 files)

- cards/card-configuration.js
- cards/card-prompt.js
- common/main.js
- common/ui.js
- css/components.css

### `.cloud` (4 files)

- cards/card-steps.js
- common/ui.js
- css/components.css
- css/layout.css

### `.field-picker` (4 files)

- cards/card-configuration.js
- common/ui.js
- css/components.css
- css/layout.css

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

### `.btn-copy` (3 files)

- cards/card-prompt.js
- css/components.css
- css/layout.css

### `.btn-icon` (3 files)

- common/ui.js
- css/components.css
- css/layout.css

### `.btn-primary` (3 files)

- common/ui.js
- css/components.css
- css/layout.css

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

### `.card-tabs` (3 files)

- cards/card-steps.js
- css/components.css
- css/layout.css

### `.field-picker-search` (3 files)

- common/ui.js
- css/components.css
- css/layout.css

### `.truncate-start` (3 files)

- cards/card-configuration.js
- cards/card-steps.js
- css/components.css
