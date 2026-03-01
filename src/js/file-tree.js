/**
 * Multi-select file picker (SCT-01, SCT-06).
 *
 * Uses a flat alphabetical searchable list (per SCT-06).
 * Files are picked one at a time from a search dropdown.
 * Selected files are displayed as removable pills below the picker.
 *
 * Spec/Guideline file pickers show helper text explaining the distinction (SCT-06):
 *   - spec_files:     "WHAT to build (requirements, user stories, design docs)"
 *   - guideline_files: "HOW to build (coding standards, style guides)"
 */

import { icon } from './icons.js';

/**
 * Create a multi-select file picker widget.
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
    placeholder = 'Search files…',
    helperText = '',
  } = config;

  // Normalize files: accept both {path} objects and plain strings
  const allPaths = files
    .map((f) => (typeof f === 'string' ? f : f.path))
    .filter(Boolean)
    .sort();

  // Track current selection (copy of initial)
  let selectedPaths = [...selected];

  // --- Build UI ---

  const wrapper = document.createElement('div');
  wrapper.className = 'file-picker-wrapper';

  // Helper text (SCT-06: tooltip/helper for spec vs guideline distinction)
  if (helperText) {
    const helper = document.createElement('div');
    helper.className = 'file-picker-helper';
    helper.textContent = helperText;
    wrapper.appendChild(helper);
  }

  // Search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'input-field file-picker-search';
  searchInput.placeholder = placeholder;
  searchInput.setAttribute('autocomplete', 'off');
  searchInput.setAttribute('aria-label', placeholder);

  // Dropdown list
  const dropdownList = document.createElement('div');
  dropdownList.className = 'dropdown-list file-picker-list';

  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'dropdown-wrapper';
  searchWrapper.appendChild(searchInput);
  searchWrapper.appendChild(dropdownList);
  wrapper.appendChild(searchWrapper);

  // Selected files pills container
  const pillsContainer = document.createElement('div');
  pillsContainer.className = 'selected-files';
  wrapper.appendChild(pillsContainer);

  container.appendChild(wrapper);

  // --- Render functions ---

  function renderPills() {
    pillsContainer.innerHTML = '';
    for (const path of selectedPaths) {
      const pill = document.createElement('div');
      pill.className = 'selected-file-pill';
      pill.title = path;

      const name = document.createElement('span');
      name.className = 'selected-file-name';
      name.textContent = path;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'selected-file-remove btn-icon';
      removeBtn.setAttribute('aria-label', `Remove ${path}`);
      removeBtn.appendChild(icon('x', 'icon-remove'));
      removeBtn.addEventListener('click', () => {
        selectedPaths = selectedPaths.filter((p) => p !== path);
        renderPills();
        onChange([...selectedPaths]);
      });

      pill.appendChild(name);
      pill.appendChild(removeBtn);
      pillsContainer.appendChild(pill);
    }
  }

  function renderDropdown(filter = '') {
    dropdownList.innerHTML = '';
    const lower = filter.toLowerCase();
    const available = allPaths.filter(
      (p) => p.toLowerCase().includes(lower) && !selectedPaths.includes(p)
    );

    if (allPaths.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dropdown-empty';
      empty.textContent = 'No files available. Select a repo first.';
      dropdownList.appendChild(empty);
      return;
    }

    if (available.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dropdown-empty';
      empty.textContent = filter ? 'No matches' : 'All files selected';
      dropdownList.appendChild(empty);
      return;
    }

    for (const path of available) {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.title = path;
      item.textContent = path;
      item.addEventListener('click', () => {
        selectedPaths = [...selectedPaths, path];
        searchInput.value = '';
        dropdownList.classList.remove('dropdown-list--open');
        renderPills();
        renderDropdown('');
        onChange([...selectedPaths]);
      });
      dropdownList.appendChild(item);
    }
  }

  // --- Events ---

  searchInput.addEventListener('focus', () => {
    renderDropdown(searchInput.value);
    dropdownList.classList.add('dropdown-list--open');
  });

  searchInput.addEventListener('input', () => {
    renderDropdown(searchInput.value);
    dropdownList.classList.add('dropdown-list--open');
  });

  document.addEventListener('click', (e) => {
    if (!searchWrapper.contains(e.target)) {
      dropdownList.classList.remove('dropdown-list--open');
    }
  });

  // Initial render
  renderPills();
}
