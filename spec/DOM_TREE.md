# Agent Prompt — DOM Tree

## Overview

Single-page web app with 4 collapsible cards stacked vertically. All cards are JavaScript-populated from a static HTML skeleton.

---

## Full DOM Structure

```
html
└── head
    ├── meta charset="UTF-8"
    ├── meta name="viewport" content="width=device-width, initial-scale=1.0"
    ├── title: "Agent Prompt"
    └── link rel="stylesheet" href="./css/styles.css"

└── body
    └── main#app

        ├── section.card.card--open#card-configuration
        │   ├── button.card-header (aria-expanded="true", aria-controls="bd-configuration")
        │   │   ├── span.card-title: "Configuration"
        │   │   └── svg.icon-btn.icon--chevron (toggle icon)
        │   │
        │   └── div.card-body#bd-configuration (populated by card-configuration.js)
        │       ├── div.input-row
        │       │   ├── label
        │       │   ├── input[type="password"] (PAT field)
        │       │   ├── button.icon-btn (show/hide PAT)
        │       │   └── button.icon-btn (clear PAT)
        │       │
        │       ├── div.input-row
        │       │   ├── label
        │       │   ├── input[type="text"] (GitHub username)
        │       │   └── button.icon-btn (clear username)
        │       │
        │       ├── section (repos)
        │       │   ├── h3
        │       │   └── div.btn-grid#repo-grid
        │       │       └── button.btn-grid-item (repeating per repo)
        │       │           ├── svg.icon-btn (repo icon)
        │       │           └── span.btn-label
        │       │
        │       └── section (branches)
        │           ├── h3
        │           └── div.btn-grid#branch-grid
        │               └── button.btn-grid-item (repeating per branch)
        │                   ├── svg.icon-btn (branch icon)
        │                   └── span.btn-label
        │
        ├── section.card#card-tasks
        │   ├── button.card-header (aria-expanded="false", aria-controls="bd-tasks")
        │   │   ├── span.card-title: "Task"
        │   │   └── svg.icon-btn.icon--chevron
        │   │
        │   └── div.card-body#bd-tasks (populated by card-tasks.js)
        │       ├── div.btn-grid.flow-grid (role="listbox", aria-label="Select a flow")
        │       │   └── button.btn-grid-item.flow-btn (repeating, 4 flows)
        │       │       ├── svg.icon-btn (flow icon)
        │       │       └── span.flow-btn-label: "Fix / Debug", "Review / Analyze", etc.
        │       │
        │       ├── div.quality-meter-container (rendered by quality-meter.js)
        │       │   ├── div.quality-meter-bar
        │       │   │   └── div.quality-meter-fill (style: width %, background-color)
        │       │   └── button.icon-btn.quality-meter-tooltip-btn (with tooltip)
        │       │
        │       └── div.panel-area (after flow selection; populated by card-tasks.js)
        │           │
        │           ├── div.dual-panel
        │           │   │
        │           │   ├── div.panel.panel-a
        │           │   │   ├── h3: "Situation" (+ flow-specific subtitle)
        │           │   │   └── div.panel-fields
        │           │   │       ├── div.field-group (repeating per field in Panel A)
        │           │   │       │   ├── label
        │           │   │       │   ├── span.required-indicator (7px dot, if required)
        │           │   │       │   │   └── title="At least one required field must be filled"
        │           │   │       │   │
        │           │   │       │   ├── FIELD TYPES (varies by flow):
        │           │   │       │   │
        │           │   │       │   ├── TYPE: text
        │           │   │       │   │   └── textarea.panel-input
        │           │   │       │   │
        │           │   │       │   ├── TYPE: number
        │           │   │       │   │   └── input[type="number"].panel-input
        │           │   │       │   │
        │           │   │       │   ├── TYPE: select (dropdown picker)
        │           │   │       │   │   ├── div.picker-wrapper
        │           │   │       │   │   │   ├── input.picker-search (searchable)
        │           │   │       │   │   │   └── div.picker-options (popover)
        │           │   │       │   │   │       └── button.picker-option (repeating)
        │           │   │       │   │   │           ├── svg.icon
        │           │   │       │   │   │           └── span: option label
        │           │   │       │   │   │
        │           │   │       │   │   └── div.picker-selected
        │           │   │       │   │       └── span.pill (repeating per selection)
        │           │   │       │   │           ├── span: selected item
        │           │   │       │   │           └── button.icon-btn (remove pill)
        │           │   │       │   │
        │           │   │       │   ├── TYPE: file-picker (flat searchable file list)
        │           │   │       │   │   ├── input.file-picker-search
        │           │   │       │   │   ├── div.file-picker-list
        │           │   │       │   │   │   └── button.file-picker-item (repeating)
        │           │   │       │   │   │       ├── svg.icon-btn (file-code or file)
        │           │   │       │   │   │       ├── span.file-name
        │           │   │       │   │   │       └── span.file-sublabel (context)
        │           │   │       │   │   │
        │           │   │       │   │   └── div.file-picker-selected
        │           │   │       │   │       └── span.pill (repeating per file)
        │           │   │       │   │           ├── span: file path
        │           │   │       │   │           └── button.icon-btn (remove file)
        │           │   │
        │           │   └── div.panel.panel-b
        │           │       ├── h3: "Target" (+ flow-specific subtitle)
        │           │       └── div.panel-fields
        │           │           └── (same field structure as Panel A)
        │           │
        │           └── div.scope-selector (if Improve flow + 2+ files selected)
        │               ├── h3
        │               └── div.btn-group
        │                   ├── button: "Each file separately"
        │                   └── button: "Across files together"
        │
        ├── section.card#card-steps
        │   ├── button.card-header (aria-expanded="false", aria-controls="bd-steps")
        │   │   ├── span.card-title: "Steps"
        │   │   └── svg.icon-btn.icon--chevron
        │   │
        │   └── div.card-body#bd-steps (populated by card-steps.js)
        │       └── div.steps-list
        │           ├── div.step-item (repeating per step)
        │           │   ├── div.step-header
        │           │   │   ├── span.step-badge: "1", "2", "3", etc. (operation index)
        │           │   │   ├── svg.icon-btn (object icon: e.g., code, issue, pr, file)
        │           │   │   ├── span.step-title: operation name
        │           │   │   ├── span.step-object: object name
        │           │   │   ├── div.file-pills (if step.params.files present)
        │           │   │   │   └── span.pill (repeating per file)
        │           │   │   │       ├── span: file path
        │           │   │   │       └── button.icon-btn (remove file)
        │           │   │   │
        │           │   │   └── button.icon-btn.delete-step (trash icon)
        │           │   │
        │           │   └── div.step-lenses
        │           │       ├── h4: "Lenses"
        │           │       ├── div.lens-pills
        │           │       │   ├── button.pill.lens-pill (repeating, first 7 lenses)
        │           │       │   │   └── span: lens name
        │           │       │   │
        │           │       │   ├── button.icon-btn.lens-more-btn (if >7 lenses)
        │           │       │   │   └── text: "+N more"
        │           │       │   │
        │           │       │   └── div.lens-pills-expanded (initially hidden, toggle via +N button)
        │           │       │       └── button.pill.lens-pill (repeating, remaining lenses)
        │           │       │
        │           │       └── h4: "Output Modes"
        │           │           └── div.output-modes
        │           │               └── label.checkbox-label (repeating per mode)
        │           │                   ├── input[type="checkbox"]
        │           │                   └── span: mode label (Here, PR comment, etc.)
        │
        └── section.card#card-prompt
            ├── button.card-header (aria-expanded="false", aria-controls="bd-prompt")
            │   ├── span.card-title: "Prompt"
            │   └── svg.icon-btn.icon--chevron
            │
            └── div.card-body#bd-prompt (populated by card-prompt.js)
                ├── div.prompt-toolbar
                │   ├── button.icon-btn.copy-btn (clipboard icon; swaps to check on copy)
                │   │   └── span.sr-only#copy-status (aria-live="polite", visually hidden)
                │   │
                │   └── a.btn.btn-primary (href="https://claude.ai/new?q=...", target="_blank")
                │       └── text: "Prompt Claude"
                │
                ├── pre.prompt-output#prompt-preview
                │   └── text content (XML with syntax highlighting spans)
                │       └── span.xml-tag (repeating per XML tag)
                │
                └── div.notes-section
                    ├── label: "Notes (optional)"
                    └── textarea#notes-input (placeholder="Add any additional context...")

    └── script[type="module" src="./js/main.js"]
```

---

## Key Structural Patterns

### 1. Card Layout

- **Static skeleton**: All 4 cards defined in HTML with empty bodies
- **JS population**: Each card's body is populated by its corresponding module:
  - `card-configuration.js` → `#bd-configuration`
  - `card-tasks.js` → `#bd-tasks`
  - `card-steps.js` → `#bd-steps`
  - `card-prompt.js` → `#bd-prompt`
- **Toggle**: `.card-header` button toggles `.card--open` class on parent `.card`

### 2. State-Driven Updates

- All rendered content is derived from centralized state object (`prompt_input`)
- State changes trigger automatic re-renders via subscription system
- DOM updates are deferred if user is mid-interaction (GL-05)

### 3. Form Fields (Panel A/B)

Multiple input types, all populated from `flows.yaml` field definitions:

- **text**: `textarea`
- **number**: `input[type="number"]`
- **select**: Custom picker component with search
- **file-picker**: Flat searchable list with pills
- **pr-picker / issue-picker**: Similar picker pattern
- All selections displayed as removable `.pill` elements

### 4. Steps

- Auto-generated list from step-generator.js
- Each step has:
  - Badge (operation index)
  - Object icon
  - Operation + object name
  - File pills (if applicable)
  - Lens toggles (7 visible + "+N more" expansion)
  - Output mode checkboxes
  - Delete button

### 5. Prompt Output

- Live preview with XML syntax highlighting
- Copy button (icon swap on success)
- "Prompt Claude" deep-link button
- Optional notes textarea

### 6. Icons

- All icons are inline SVG elements generated via `icons.js` utility
- Common icons: `chevron-down`, `repo`, `git-branch`, `mark-github`, `file`, `file-code`, etc.

---

## Data Flow Summary

```
State (prompt_input)
    ↓ (subscription)
Card Render Functions (card-*.js)
    ↓ (createElement + appendChild)
DOM Elements
    ↓ (event listeners)
User Interactions
    ↓ (setState calls)
State Update → [back to render]
```

---

## Accessibility

- **Semantic HTML**: `main`, `section`, `button`, `label`, `input`
- **ARIA**: `role="listbox"`, `role="option"`, `aria-expanded`, `aria-selected`, `aria-controls`, `aria-live`
- **Screen reader support**: Hidden status messages (`.sr-only`), descriptive labels, tooltips
- **Keyboard navigation**: Standard form inputs + button grid focus management (delegated to browser)
