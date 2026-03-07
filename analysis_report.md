# DOM-CSS Analysis Report

| Metric | Count | Target | Temp | status |
|--------|-------|-------|-------|-------|
| CSS classes | 60 | <50 | 55| 🔴 |
| used (HTML+JS) | 63 | ||
| Unused | 1 | 0 | 1 | 🟠 |
| Undefined | 4  | 0 | 1 | 🔴|
| Inline | 5 | 3 | 5 |🟠|



## Elements Without Classes 🔴

| Element | no-Class | Violations |
|---------|-----------------|------------|
| `<span>` | 12/20  | index.html:19, index.html:33, index.html:47, index.html:61, card-configuration.js:69, card-configuration.js:78, card-configuration.js:87, card-steps.js:137, card-tasks.js:178, ccomponents.js:106, ui.js:427, quality-meter.js:163 |
| `<div>` | 4/46 | card-configuration.js:462, card-configuration.js:519, card-prompt.js:158, quality-meter.js:159 |
| `<small>` | 2/2 | card-tasks.js:181, file-tree.js:52 |
| `<template>` | 1/1 | icons.js:103 |

## Unused CSS Classes 🔴

- `.wrapper` — defined at css/layout.css:160, css/layout.css:168 

## Undefined Classes (used but not in CSS) 🔴

- `.btn-dismiss` — used at components.js:122 
- `.btn-retry` — used at ccomponents.js:115 
- `.error-actions` — used at components.js:111 
- `.error-inline` — used at components.js:103 

## Inline Style Violations

- **cards/card-tasks.js:523** — `dot.style.opacity = dot._satisfied ? '0.2' : '1';`🟠
- **cards/card-tasks.js:551** — `d.style.opacity = isSatisfied ? '0.2' : '1';`🟠
- **logic/quality-meter.js:173** — `bar.style.width = `${score}%`;`🟡
- **logic/quality-meter.js:174** — `bar.style.backgroundColor = color;`🟡
- **logic/quality-meter.js:178** — `labelTextEl.style.color = color;`🟡

## Approximate DOM Tree (L3–L7)

```
L3 section#card-configuration.card.card--open [Grid 1fr] — index.html:13
├─ L4 button.card-header [Grid 1fr auto] — index.html:14
│  └─ L5 span — index.html:19
└─ L4 div#bd-configuration.card-body [Grid 1fr] — index.html:21
   ├─ L5 span — card-configuration.js:69
   ├─ L5 span — card-configuration.js:78
   ├─ L5 span — card-configuration.js:87
   ├─ L5 label — card-configuration.js:121
   ├─ L5 span.icon-eye-on — card-configuration.js:138
   ├─ L5 span.icon-eye-off — card-configuration.js:141
   ├─ L5 label — card-configuration.js:161
   ├─ L5 label — card-configuration.js:516
   └─ L5 div — card-configuration.js:519

L3 section#card-tasks.card [Grid 1fr] — index.html:27
├─ L4 button.card-header [Grid 1fr auto] — index.html:28
│  └─ L5 span — index.html:33
└─ L4 div#bd-tasks.card-body [Grid 1fr] — index.html:35
   ├─ L5 div.card.card--open [Grid 1fr] — card-tasks.js:124
   │  └─ L6 div.card-body [Grid 1fr] — card-tasks.js:134
   ├─ L5 div.card.card--open [Grid 1fr] — card-tasks.js:141
   │  └─ L6 div.card-body [Grid 1fr] — card-tasks.js:151
   ├─ L5 button.card-header [Grid 1fr auto] — card-tasks.js:172
   │  └─ L6 span — ccard-tasks.js:178
   │     └─ L7 small — card-tasks.js:181
   ├─ L5 div.input [Grid clamp 1fr] — card-tasks.js:206
   ├─ L5 span.required-group-dot [inline-block] — cards/card-tasks.js:215
   ├─ L5 div.field-picker [Flex column] — card-tasks.js:290
   │  ├─ L6 div.empty-state — card-tasks.js:328
   │  └─ L6 div.empty-state — card-tasks.js:328
   ├─ L5 div.cloud [Flex row wrap] — card-tasks.js:413
   └─ L5 div.input [Grid clamp 1fr] — card-tasks.js:467

L3 section#card-steps.card [Grid 1fr] — index.html:41
├─ L4 button.card-header [Grid 1fr auto] — index.html:42
│  └─ L5 span — index.html:47
└─ L4 div#bd-steps.card-body [Grid 1fr] — index.html:49
   ├─ L5 div.empty-state — cards/card-steps.js:113
   ├─ L5 ol.output-block [Flex column] — card-steps.js:120
   ├─ L5 li.output.output-field [Grid auto 1fr auto] — card-steps.js:132
   │  └─ L6 span — card-steps.js:137
   ├─ L5 div.cloud [Flex row wrap] — card-steps.js:269
   │  ├─ L6 label — cards/card-steps.js:240
   │  └─ L6 div.cloud [Flex row wrap] — card-steps.js:244
   ├─ L5 div.input [Grid clamp 1fr] — card-steps.js:219
   │  └─ L6 label — card-steps.js:240
   └─ L5 span.output-float — card-steps.js:412

L3 section#card-prompt.card [Grid 1fr] — index.html:55
├─ L4 button.card-header [Grid 1fr auto] — index.html:56
│  └─ L5 span — index.html:61
└─ L4 div#bd-prompt.card-body [Grid 1fr] — index.html:63
   ├─ L5 span.meter-info-wrapper [Flex row] — cards/card-prompt.js:116
   │  └─ L6 div.meter-tooltip — card-prompt.js:125
   ├─ L5 div — card-prompt.js:158
   ├─ L5 pre.prompt-output — card-prompt.js:164
   │  └─ L6 div.cloud [Flex row wrap] — card-prompt.js:174
   └─ L5 div.input [Grid clamp 1fr] — card-prompt.js:210
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

## Cross-File Class Map

*Classes appearing in 3+ files (CSS definitions + HTML/JS usage).*

### `.cloud` (8 files)

- cards/card-configuration.js
- cards/card-prompt.js
- cards/card-steps.js
- cards/card-tasks.js
- common/file-tree.js
- common/ui.js
- css/layout.css
- css/special.css

### `.input` (7 files)

- cards/card-configuration.js
- cards/card-prompt.js
- cards/card-steps.js
- cards/card-tasks.js
- common/file-tree.js
- common/ui.js
- css/layout.css

### `.card--open` (6 files)

- cards/card-configuration.js
- cards/card-tasks.js
- common/components.js
- common/main.js
- css/layout.css
- index.html

### `.icon` (6 files)

- cards/card-configuration.js
- cards/card-prompt.js
- cards/card-steps.js
- common/icons.js
- common/ui.js
- css/components.css

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

### `.card-header` (4 files)

- cards/card-tasks.js
- css/components.css
- css/layout.css
- index.html

### `.field-picker` (4 files)

- cards/card-tasks.js
- common/file-tree.js
- common/ui.js
- css/components.css

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

### `.card` (3 files)

- cards/card-tasks.js
- css/layout.css
- index.html

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

### `.icon--chevron` (3 files)

- cards/card-tasks.js
- common/main.js
- css/components.css

### `.input-field` (3 files)

- common/ui.js
- css/components.css
- css/layout.css

### `.output-field` (3 files)

- cards/card-steps.js
- css/components.css
- css/layout.css
