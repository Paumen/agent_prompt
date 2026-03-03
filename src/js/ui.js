/**
 * ui.js — Component factory for the redesigned UI framework.
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
 *
 */
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
    primary: 'v2-btn-primary',
    select: 'v2-btn-select',
    action: 'v2-btn-action',
    pill: 'v2-btn-pill',
    icon: 'v2-btn-icon',
  };

  btn.className = classMap[type] || classMap.action;

  // Icon-with-label variant
  if (type === 'icon' && label) {
    btn.classList.add('v2-btn-icon--labeled');
  }

  // Selected/on state
  if (selected) {
    if (type === 'select') {
      btn.classList.add('v2-btn-select--selected');
      btn.setAttribute('aria-selected', 'true');
    } else if (type === 'pill') {
      btn.classList.add('v2-btn-pill--on');
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
    field.className = 'v2-input-field v2-input-field--textarea';
    field.rows = rows;
  } else {
    field = document.createElement('input');
    field.type = type;
    field.className = 'v2-input-field';
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
    row.className = 'v2-field-picker-search';
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
  } = options;

  const container = document.createElement('div');
  container.className = 'v2-field-picker';

  // Search input
  const searchRow = document.createElement('div');
  searchRow.className = 'v2-field-picker-search';

  if (searchIconName) {
    searchRow.appendChild(icon(searchIconName, 'icon-btn'));
  }

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'v2-input-field';
  searchInput.placeholder = placeholder;
  searchInput.setAttribute('autocomplete', 'off');
  searchInput.setAttribute('aria-label', placeholder);
  searchRow.appendChild(searchInput);

  // Dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'v2-field-picker-dropdown';

  const searchWrapper = document.createElement('div');
  searchWrapper.style.position = 'relative';
  searchWrapper.appendChild(searchRow);
  searchWrapper.appendChild(dropdown);

  container.appendChild(searchWrapper);

  // Tags container (for multi-select)
  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'v2-field-picker-tags';
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
      empty.className = 'v2-field-picker-empty';
      empty.textContent = filter ? 'No matches' : 'No items available';
      dropdown.appendChild(empty);
      return;
    }

    for (const item of filtered) {
      const el = document.createElement('div');
      el.className = 'v2-field-picker-item';
      el.textContent = item.label;
      if (item.title) el.title = item.title;

      el.addEventListener('click', () => {
        if (onSelect) onSelect(item);
        searchInput.value = '';
        dropdown.classList.remove('v2-field-picker-dropdown--open');
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
    dropdown.classList.add('v2-field-picker-dropdown--open');
  });

  searchInput.addEventListener('input', () => {
    renderDropdown(searchInput.value);
    dropdown.classList.add('v2-field-picker-dropdown--open');
  });

  document.addEventListener('click', (e) => {
    if (!searchWrapper.contains(e.target)) {
      dropdown.classList.remove('v2-field-picker-dropdown--open');
    }
  });

  // Initial render
  if (multiSelect) renderTags();

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
  const { label, iconName, onRemove, title } = options;

  const tag = document.createElement('span');
  tag.className = 'v2-tag';
  if (title) tag.title = title;

  if (iconName) {
    tag.appendChild(icon(iconName, 'icon-btn'));
  }

  const text = document.createElement('span');
  text.className = 'v2-tag-text';
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
// BUTTON GRID
// ============================================================

/**
 * Create a grid of buttons (e.g. flow selector, repo list).
 *
 * @param {object[]} buttons - array of button configs
 * @param {string} buttons[].label - button text
 * @param {string} [buttons[].iconName] - icon name
 * @param {boolean} [buttons[].selected] - selected state
 * @param {Function} [buttons[].onClick] - click handler
 * @param {object} [buttons[].dataset] - data attributes
 * @param {object} [gridOptions]
 * @param {'select'|'pill'|'action'} [gridOptions.buttonType='select'] - type of buttons
 * @param {string} [gridOptions.role='listbox'] - ARIA role for the grid
 * @param {string} [gridOptions.ariaLabel] - accessible label
 * @param {number} [gridOptions.columns] - fixed column count (CSS grid)
 * @returns {HTMLElement}
 */
export function createButtonGrid(buttons, gridOptions = {}) {
  const {
    buttonType = 'select',
    role = 'listbox',
    ariaLabel,
    columns,
  } = gridOptions;

  const grid = document.createElement('div');
  grid.style.display = 'flex';
  grid.style.flexWrap = 'wrap';
  grid.style.gap = 'var(--sp-2)';

  if (columns) {
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    grid.style.gap = 'var(--sp-4)';
  }

  if (role) grid.setAttribute('role', role);
  if (ariaLabel) grid.setAttribute('aria-label', ariaLabel);

  for (const btnConfig of buttons) {
    const btn = createButton(buttonType, {
      label: btnConfig.label,
      iconName: btnConfig.iconName,
      selected: btnConfig.selected,
      onClick: btnConfig.onClick,
      dataset: btnConfig.dataset,
    });

    if (role === 'listbox') {
      btn.setAttribute('role', 'option');
    }

    grid.appendChild(btn);
  }

  return grid;
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
    req.style.color = 'var(--caution-dark)';
    label.appendChild(req);
  }

  return label;
}
