/**
 * ui.js — Component factory for the UI framework.
 *
 * Exports functions that create DOM elements with correct CSS class names,
 * ARIA attributes, and event wiring. Card files call these instead of
 * manual createElement chains.
 *
 * IN scope: DOM creation, CSS classes, ARIA attrs, event callback wiring.
 * OUT of scope: State management, business logic, card-specific composition,
 *               layout decisions, icons (icons.js owns those).
 *
 * Litmus test: if a function would only be called from one card file,
 * it does NOT belong here.
 */

import { icon, fileIconName } from './icons.js';

// ============================================================
// BUTTONS
// ============================================================

export function createButton(type, options = {}) {
  const {
    label,
    iconName,
    iconClass = 'icon-btn',
    selected = false,
    onClick,
    ariaLabel,
    title,
    dataset,
  } = options;

  const btn = document.createElement('button');
  btn.type = 'button';

  const classMap = {
    primary: 'btn-primary',
    select: 'btn-select',
    action: 'btn-action',
    pill: 'btn-pill',
    icon: 'btn-icon',
  };

  btn.className = classMap[type] || classMap.action;

  // Icon-with-label variant
  if (type === 'icon' && label) {
    btn.classList.add('btn-icon--labeled');
  }

  // Selected/on state
  if (selected) {
    if (type === 'select') {
      btn.classList.add('btn-select--selected');
      btn.setAttribute('aria-selected', 'true');
    } else if (type === 'pill') {
      btn.classList.add('btn-pill--on');
      btn.setAttribute('aria-checked', 'true');
    }
  } else {
    if (type === 'select') {
      btn.setAttribute('aria-selected', 'false');
    } else if (type === 'pill') {
      btn.setAttribute('aria-checked', 'false');
    }
  }

  // Icon
  if (iconName) {
    btn.appendChild(icon(iconName, iconClass));
  }

  // Label text
  if (label) {
    const textNode = document.createTextNode(label);
    btn.appendChild(textNode);
  }

  // Attributes
  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
  if (title) btn.title = title;
  if (dataset) {
    for (const [key, value] of Object.entries(dataset)) {
      btn.dataset[key] = value;
    }
  }

  // Event
  if (onClick) btn.addEventListener('click', onClick);

  return btn;
}

// ============================================================
// INPUT FIELDS
// ============================================================

/**
 * Create an input field (text input or textarea).
 *
 * @param {object} options
 * @param {string} [options.placeholder] - placeholder text
 * @param {string} [options.value] - initial value
 * @param {'text'|'password'|'textarea'} [options.type='text'] - input type
 * @param {string} [options.id] - element id
 * @param {string} [options.iconName] - optional icon prepended to input
 * @param {Function} [options.onInput] - input event handler
 * @param {Function} [options.onChange] - change event handler
 * @param {string} [options.ariaLabel] - accessible label
 * @param {number} [options.rows] - textarea rows (only for type='textarea')
 * @returns {HTMLElement} - input or textarea element (or a wrapper if icon is included)
 */
export function createInputField(options = {}) {
  const {
    placeholder = '',
    value = '',
    type = 'text',
    id,
    iconName,
    onInput,
    onChange,
    ariaLabel,
    rows = 3,
  } = options;

  let field;

  if (type === 'textarea') {
    field = document.createElement('textarea');
    field.className = 'input-field input-field--textarea';
    field.rows = rows;
  } else {
    field = document.createElement('input');
    field.type = type;
    field.className = 'input-field';
  }

  field.placeholder = placeholder;
  field.value = value;
  if (id) field.id = id;
  if (ariaLabel) field.setAttribute('aria-label', ariaLabel);
  field.setAttribute('autocomplete', 'off');

  if (onInput) field.addEventListener('input', onInput);
  if (onChange) field.addEventListener('change', onChange);

  // If icon requested, wrap in a search row
  if (iconName) {
    const row = document.createElement('div');
    row.className = 'field-picker-search';
    row.appendChild(icon(iconName, 'icon-btn'));
    row.appendChild(field);
    // Expose the actual input via a property so callers can access it
    row._inputEl = field;
    return row;
  }

  return field;
}

// ============================================================
// PICKERS (search + dropdown + tags)
// ============================================================

/**
 * Create a searchable picker with dropdown and selected tags.
 *
 * @param {object} options
 * @param {{ value: *, label: string }[]} options.items - available items
 * @param {*[]} [options.selected=[]] - currently selected values
 * @param {Function} options.onSelect - called with selected item when picked
 * @param {Function} [options.onRemove] - called with item value when tag is removed
 * @param {string} [options.placeholder='Search…'] - search input placeholder
 * @param {Function} [options.iconFn] - (item) => iconName for custom icons per item
 * @param {string} [options.searchIconName] - icon for the search input
 * @param {boolean} [options.multiSelect=false] - allow multiple selections
 * @param {string} [options.helperText] - optional helper text shown above picker
 * @param {object} [options.emptyMessages] - custom empty state messages
 * @param {string} [options.emptyMessages.noItems] - message when no items available
 * @param {string} [options.emptyMessages.noMatches] - message when search has no matches
 * @param {HTMLElement} [options.container] - optional container to render into
 * @returns {HTMLElement} - the picker container element
 */
export function createPicker(options = {}) {
  const {
    items = [],
    selected = [],
    onSelect,
    onRemove,
    placeholder = 'Search\u2026',
    iconFn,
    searchIconName,
    multiSelect = false,
    helperText = '',
    emptyMessages = {},
    container: renderContainer,
    tagTextClass,
  } = options;

  const container = document.createElement('div');
  container.className = 'field-picker';

  // Helper text (shown above the picker)
  if (helperText) {
    const helper = document.createElement('small');
    helper.textContent = helperText;
    container.appendChild(helper);
  }

  // Search input
  const searchRow = document.createElement('div');
  searchRow.className = 'field-picker-search';

  if (searchIconName) {
    searchRow.appendChild(icon(searchIconName, 'icon-btn'));
  }

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'input-field';
  searchInput.placeholder = placeholder;
  searchInput.setAttribute('autocomplete', 'off');
  searchInput.setAttribute('aria-label', placeholder);
  searchRow.appendChild(searchInput);

  // Dropdown (inside searchRow for CSS positioning)
  const dropdown = document.createElement('div');
  dropdown.className = 'field-picker-dropdown';
  searchRow.appendChild(dropdown);

  container.appendChild(searchRow);

  // Tags container (for multi-select)
  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'cloud';
  if (multiSelect) {
    container.appendChild(tagsContainer);
  }

  // Expose elements for external access
  container._searchInput = searchInput;
  container._dropdown = dropdown;
  container._tagsContainer = tagsContainer;

  // Render dropdown list
  function renderDropdown(filter = '') {
    dropdown.innerHTML = '';
    const lower = filter.toLowerCase();
    const selectedValues = new Set(selected);

    const filtered = items.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) &&
        (!multiSelect || !selectedValues.has(item.value))
    );

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'field-picker-empty';
      const noItemsMsg = emptyMessages.noItems || 'No items available';
      const noMatchesMsg = emptyMessages.noMatches || 'No matches';
      empty.textContent = filter ? noMatchesMsg : noItemsMsg;
      dropdown.appendChild(empty);
      return;
    }

    for (const item of filtered) {
      const el = document.createElement('div');
      el.className = 'field-picker-item';
      el.textContent = item.label;
      if (item.title) el.title = item.title;

      el.addEventListener('click', () => {
        if (onSelect) onSelect(item);
        searchInput.value = '';
        dropdown.classList.remove('field-picker-dropdown--open');
      });

      dropdown.appendChild(el);
    }
  }

  // Render selected tags
  function renderTags() {
    tagsContainer.innerHTML = '';
    for (const val of selected) {
      const item = items.find((i) => i.value === val);
      const tagLabel = item ? item.label : String(val);
      const tagEl = createTag({
        label: tagLabel,
        title: tagLabel,
        iconName: iconFn ? iconFn(val) : undefined,
        textClass: tagTextClass,
        onRemove: onRemove
          ? () => {
              onRemove(val);
            }
          : undefined,
      });
      tagsContainer.appendChild(tagEl);
    }
  }

  // Events
  searchInput.addEventListener('focus', () => {
    renderDropdown(searchInput.value);
    dropdown.classList.add('field-picker-dropdown--open');
  });

  searchInput.addEventListener('input', () => {
    renderDropdown(searchInput.value);
    dropdown.classList.add('field-picker-dropdown--open');
  });

  document.addEventListener('click', (e) => {
    if (!searchRow.contains(e.target)) {
      dropdown.classList.remove('field-picker-dropdown--open');
    }
  });

  // Initial render
  if (multiSelect) renderTags();

  // Auto-render into container if provided
  if (renderContainer) {
    renderContainer.appendChild(container);
  }

  return container;
}

// ============================================================
// TAGS
// ============================================================

/**
 * Create a tag element (pill shape with optional remove button).
 *
 * @param {object} options
 * @param {string} options.label - display text (truncated, full on hover)
 * @param {string} [options.iconName] - icon name
 * @param {Function} [options.onRemove] - remove handler; shows X button when provided
 * @param {string} [options.title] - full text for hover tooltip
 * @returns {HTMLElement}
 */
export function createTag(options = {}) {
  const { label, iconName, onRemove, title, textClass } = options;

  const tag = document.createElement('span');
  tag.className = 'tag';
  if (title) tag.title = title;

  if (iconName) {
    tag.appendChild(icon(iconName, 'icon-btn'));
  }

  const text = document.createElement('span');
  text.className = textClass ? `tag-text ${textClass}` : 'tag-text';
  text.textContent = label;
  tag.appendChild(text);

  if (onRemove) {
    const removeBtn = createButton('icon', {
      iconName: 'x',
      iconClass: 'icon-remove',
      ariaLabel: `Remove ${label}`,
      onClick: (e) => {
        e.stopPropagation();
        onRemove();
      },
    });
    tag.appendChild(removeBtn);
  }

  return tag;
}

// ============================================================
// MORE/LESS TOGGLE
// ============================================================

/**
 * Create a "show more / show less" toggle button.
 *
 * @param {object} options
 * @param {number} options.hiddenCount - number of hidden items
 * @param {boolean} [options.expanded=false] - initial expanded state
 * @param {Function} options.onToggle - called with new expanded state (boolean)
 * @param {string} [options.activeLabel] - label suffix when items are active (e.g. "3 active")
 * @returns {HTMLButtonElement}
 */
export function createMoreLess(options = {}) {
  const { hiddenCount, expanded = false, onToggle, activeLabel } = options;

  let isExpanded = expanded;

  function getLabel() {
    if (isExpanded) return 'Show fewer';
    const suffix = activeLabel ? ` (${activeLabel})` : '';
    return `+${hiddenCount} more${suffix}`;
  }

  const btn = createButton('action', {
    label: getLabel(),
  });

  btn.addEventListener('click', () => {
    isExpanded = !isExpanded;
    btn.textContent = getLabel();
    if (onToggle) onToggle(isExpanded);
  });

  // Expose update method for external label refresh
  btn._updateLabel = (newActiveLabel) => {
    const suffix = newActiveLabel ? ` (${newActiveLabel})` : '';
    if (!isExpanded) {
      btn.textContent = `+${hiddenCount} more${suffix}`;
    }
  };

  return btn;
}

// ============================================================
// LABELS
// ============================================================

/**
 * Create a label element for input rows.
 *
 * @param {string} text - label text
 * @param {object} [options]
 * @param {boolean} [options.required=false] - show required indicator
 * @param {string} [options.htmlFor] - the id of the associated input
 * @returns {HTMLLabelElement}
 */
export function createLabel(text, options = {}) {
  const { required = false, htmlFor } = options;

  const label = document.createElement('label');
  if (htmlFor) label.htmlFor = htmlFor;

  label.appendChild(document.createTextNode(text));

  if (required) {
    const req = document.createElement('span');
    req.textContent = ' *';
    req.setAttribute('aria-hidden', 'true');
    label.appendChild(req);
  }

  return label;
}

// ============================================================
// CARD EXPAND / COLLAPSE
// ============================================================

/**
 * Expand a card by ID.
 * Sets the native `open` attribute on the <details> element.
 *
 * @param {string} id - card element ID (e.g., 'card-steps')
 */
export function expandCard(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.open = true;
}

/**
 * Collapse a card by ID.
 * Removes the native `open` attribute from the <details> element.
 *
 * @param {string} id - card element ID (e.g., 'card-configuration')
 */
export function collapseCard(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.open = false;
}

// ============================================================
// MID-INTERACTION TRACKING (GL-05)
// ============================================================

let _isInteracting = false;
let _interactionTimer = null;

/**
 * Signal that the user is actively interacting (e.g. toggled a lens or file).
 * Auto-clears after 2 seconds of inactivity.
 */
export function setInteracting() {
  _isInteracting = true;
  clearTimeout(_interactionTimer);
  _interactionTimer = setTimeout(() => {
    _isInteracting = false;
  }, 2000);
}

/**
 * Returns true if the user is mid-interaction:
 * - setInteracting() was called within the last 2 seconds, OR
 * - an input/textarea/select has active focus
 */
export function isInteracting() {
  return (
    _isInteracting ||
    (typeof document !== 'undefined' &&
      !!document.activeElement?.matches('input, textarea, select'))
  );
}

// ============================================================
// SHIMMER / ERROR / NOTIFICATION
// ============================================================

/**
 * Render shimmer skeleton bars with contextual label.
 * Replaces container content.
 *
 * @param {HTMLElement} container
 * @param {string} label - e.g. "Loading repos…"
 * @param {number} [barCount=2] - number of shimmer bars to show
 */
export function renderShimmer(container, label, barCount = 2) {
  container.innerHTML = '';

  const labelEl = document.createElement('div');
  labelEl.className = 'shimmer-label';
  labelEl.textContent = label;
  container.appendChild(labelEl);

  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'shimmer shimmer-bar';
    container.appendChild(bar);
  }
}

/**
 * Render inline dismissible error message.
 * Appends to container (does not replace content).
 *
 * @param {HTMLElement} container
 * @param {string} message
 * @param {Function} [onRetry] - optional retry callback; shows Retry button when provided
 */
export function renderError(container, message, onRetry) {
  const el = document.createElement('div');
  el.className = 'error-inline';
  el.setAttribute('role', 'alert');

  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  el.appendChild(msgSpan);

  const actions = document.createElement('span');
  actions.className = 'error-actions';

  if (onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-retry';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', onRetry);
    actions.appendChild(retryBtn);
  }

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'btn-dismiss';
  dismissBtn.textContent = '×';
  dismissBtn.setAttribute('aria-label', 'Dismiss error');
  dismissBtn.addEventListener('click', () => el.remove());
  actions.appendChild(dismissBtn);

  el.appendChild(actions);
  container.appendChild(el);
}

/**
 * Show brief notification that auto-removes after 2 seconds.
 * Replaces any existing notification in the container.
 *
 * @param {HTMLElement} container
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
export function showNotification(container, message, type) {
  // Remove existing notification in this container
  const existing = container.querySelector('.notification');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `notification notification--${type}`;
  el.setAttribute('aria-live', 'polite');
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => el.remove(), 2000);
}

// ============================================================
// FILE PICKER (SCT-01, SCT-06)
// ============================================================

/**
 * Create a multi-select file picker widget.
 *
 * Stateful wrapper around createPicker for file selection.
 * Uses a flat alphabetical searchable list (per SCT-06).
 * Files are picked one at a time from a search dropdown.
 * Selected files are displayed as removable tags below the picker.
 *
 * @param {HTMLElement} container - element to render into
 * @param {object} config
 * @param {{ path: string }[] | string[]} config.files - available files from getFileTree()
 * @param {string[]} config.selected - currently selected file paths
 * @param {Function} config.onChange - called with updated selected paths array
 * @param {string} [config.placeholder] - search input placeholder text
 * @param {string} [config.helperText] - tooltip/helper text for spec vs guideline distinction
 */
export function createFilePicker(container, config) {
  const {
    files = [],
    selected = [],
    onChange,
    placeholder = 'Search files\u2026',
    helperText = '',
  } = config;

  // Normalize files: accept both {path} objects and plain strings
  const allPaths = files
    .map((f) => (typeof f === 'string' ? f : f.path))
    .filter(Boolean)
    .sort();

  // Track selection internally
  let selectedPaths = [...selected];

  // Build wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'field-picker';

  // Helper text
  if (helperText) {
    const helper = document.createElement('small');
    helper.textContent = helperText;
    wrapper.appendChild(helper);
  }

  // Create picker using createPicker (search + dropdown)
  const pickerItems = allPaths.map((path) => ({
    value: path,
    label: path,
    title: path,
  }));

  const picker = createPicker({
    items: pickerItems,
    placeholder,
    searchIconName: 'file',
    emptyMessages: {
      noItems: 'No files available. Select a repo first.',
      noMatches: 'No matches',
    },
    onSelect: (item) => {
      selectedPaths = [...selectedPaths, item.value];
      renderTags();
      onChange([...selectedPaths]);
    },
  });

  wrapper.appendChild(picker);

  // Tags container for selected files
  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'cloud';
  wrapper.appendChild(tagsContainer);

  container.appendChild(wrapper);

  // Render selected files as tags
  function renderTags() {
    tagsContainer.innerHTML = '';
    for (const path of selectedPaths) {
      const tag = createTag({
        label: path,
        iconName: fileIconName(path),
        title: path,
        textClass: 'truncate-start',
        onRemove: () => {
          selectedPaths = selectedPaths.filter((p) => p !== path);
          renderTags();
          onChange([...selectedPaths]);
        },
      });
      tagsContainer.appendChild(tag);
    }
  }

  // Initial render
  renderTags();
}
