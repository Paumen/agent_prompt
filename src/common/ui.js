/**
 * ui.js — Component factory for the UI framework.
 * Focus: DOM creation, CSS classes, ARIA, and event wiring.
 * Excludes: State management, business logic, icons.
 * Rule: If a function is card-specific, it does NOT belong here.
 */

import { icon } from './icons.js';

// --- BUTTONS ---

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

  if (type === 'icon' && label) btn.classList.add('btn-icon--labeled');

  if (selected) {
    const isSelect = type === 'select';
    btn.classList.add(isSelect ? 'btn-select--selected' : 'btn-pill--on');
    btn.setAttribute(isSelect ? 'aria-selected' : 'aria-checked', 'true');
  } else if (['select', 'pill'].includes(type)) {
    btn.setAttribute(
      type === 'select' ? 'aria-selected' : 'aria-checked',
      'false'
    );
  }

  if (iconName) btn.appendChild(icon(iconName, iconClass));
  if (label) btn.appendChild(document.createTextNode(label));

  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
  if (title) btn.title = title;
  if (dataset)
    Object.entries(dataset).forEach(([k, v]) => (btn.dataset[k] = v));
  if (onClick) btn.addEventListener('click', onClick);

  return btn;
}

// --- INPUTS & PICKERS ---

/**
 * @returns {HTMLElement} Input/textarea, or a wrapper div if iconName is provided.
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

  if (iconName) {
    const row = document.createElement('div');
    row.className = 'field-picker-search';
    row.appendChild(icon(iconName, 'icon-btn'));
    row.appendChild(field);
    row._inputEl = field; // Access for callers
    return row;
  }

  return field;
}

/**
 * @param {object} options
 * @param {*[]} [options.selected=[]]
 * @param {Function} options.onSelect - (item) => void
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
    tagLabelFn,
  } = options;

  const container = document.createElement('div');
  container.className = 'field-picker';

  if (helperText) {
    const helper = document.createElement('small');
    helper.textContent = helperText;
    container.appendChild(helper);
  }

  const searchRow = document.createElement('div');
  searchRow.className = 'field-picker-search';

  if (searchIconName) searchRow.appendChild(icon(searchIconName, 'icon-btn'));

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'input-field';
  searchInput.placeholder = placeholder;
  searchInput.setAttribute('autocomplete', 'off');
  searchInput.setAttribute('aria-label', placeholder);
  searchRow.appendChild(searchInput);

  const dropdown = document.createElement('div');
  dropdown.className = 'field-picker-dropdown';
  searchRow.appendChild(dropdown);
  container.appendChild(searchRow);

  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'cloud';
  if (multiSelect) container.appendChild(tagsContainer);

  container._searchInput = searchInput;
  container._dropdown = dropdown;
  container._tagsContainer = tagsContainer;

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
      empty.textContent = filter
        ? emptyMessages.noMatches || 'No matches'
        : emptyMessages.noItems || 'No items available';
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

  function renderTags() {
    tagsContainer.innerHTML = '';
    for (const val of selected) {
      const item = items.find((i) => i.value === val);
      const tagLabel = tagLabelFn
        ? tagLabelFn(val)
        : item
          ? item.label
          : String(val);
      tagsContainer.appendChild(
        createTag({
          label: tagLabel,
          title: tagLabel,
          iconName: iconFn ? iconFn(val) : undefined,
          textClass: tagTextClass,
          onRemove: onRemove ? () => onRemove(val) : undefined,
        })
      );
    }
  }

  searchInput.addEventListener('focus', () => {
    renderDropdown(searchInput.value);
    dropdown.classList.add('field-picker-dropdown--open');
  });

  searchInput.addEventListener('input', () => {
    renderDropdown(searchInput.value);
    dropdown.classList.add('field-picker-dropdown--open');
  });

  document.addEventListener('click', (e) => {
    if (!searchRow.contains(e.target))
      dropdown.classList.remove('field-picker-dropdown--open');
  });

  if (multiSelect) renderTags();
  if (renderContainer) renderContainer.appendChild(container);

  return container;
}

// --- TAGS & TOGGLES ---

export function createTag(options = {}) {
  const { label, iconName, onRemove, title, textClass } = options;

  const tag = document.createElement('span');
  tag.className = 'tag';
  if (title) tag.title = title;

  if (iconName) tag.appendChild(icon(iconName, 'icon-btn'));

  const text = document.createElement('span');
  text.className = textClass ? `tag-text ${textClass}` : 'tag-text';
  text.textContent = label;
  tag.appendChild(text);

  if (onRemove) {
    tag.appendChild(
      createButton('icon', {
        iconName: 'x',
        iconClass: 'icon-remove',
        ariaLabel: `Remove ${label}`,
        onClick: (e) => {
          e.stopPropagation();
          onRemove();
        },
      })
    );
  }

  return tag;
}

export function createMoreLess(options = {}) {
  const { hiddenCount, expanded = false, onToggle, activeLabel } = options;
  let isExpanded = expanded;

  const getLabel = () => {
    if (isExpanded) return 'Show fewer';
    return `+${hiddenCount} more${activeLabel ? ` (${activeLabel})` : ''}`;
  };

  const btn = createButton('action', { label: getLabel() });

  btn.addEventListener('click', () => {
    isExpanded = !isExpanded;
    btn.textContent = getLabel();
    if (onToggle) onToggle(isExpanded);
  });

  btn._updateLabel = (newActive) => {
    if (!isExpanded)
      btn.textContent = `+${hiddenCount} more${newActive ? ` (${newActive})` : ''}`;
  };

  return btn;
}

export function createLabel(text, { required = false, htmlFor } = {}) {
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

// --- HELPERS ---

export const expandCard = (id) => {
  const c = document.getElementById(id);
  if (c) c.open = true;
};
export const collapseCard = (id) => {
  const c = document.getElementById(id);
  if (c) c.open = false;
};

export function renderShimmer(container, label, barCount = 2) {
  container.innerHTML = `<div class="shimmer-label">${label}</div>`;
  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'shimmer shimmer-bar';
    container.appendChild(bar);
  }
}

export function renderError(container, message, onRetry) {
  const el = document.createElement('div');
  el.className = 'error-inline';
  el.setAttribute('role', 'alert');
  el.innerHTML = `<span>${message}</span>`;

  if (onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-retry';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', onRetry);
    el.appendChild(retryBtn);
  }

  const dismissBtn = document.createElement('button');
  dismissBtn.setAttribute('aria-label', 'Dismiss error');
  dismissBtn.textContent = '×';
  dismissBtn.addEventListener('click', () => el.remove());
  el.appendChild(dismissBtn);

  container.appendChild(el);
}
