/**
 * Multi-select file picker (SCT-01, SCT-06).
 *
 * Uses a flat alphabetical searchable list (per SCT-06).
 * Files are picked one at a time from a search dropdown.
 * Selected files are displayed as removable tags below the picker.
 *
 * Spec/Guideline file pickers show helper text explaining the distinction (SCT-06):
 *   - spec_files:     "WHAT to build (requirements, user stories, design docs)"
 *   - guideline_files: "HOW to build (coding standards, style guides)"
 */

import { fileIconName } from './icons.js';
import { createTag, createInputField } from './ui.js';

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
  wrapper.className = 'field-picker';

  // Helper text (SCT-06: tooltip/helper for spec vs guideline distinction)
  if (helperText) {
    const helper = document.createElement('small');
    helper.textContent = helperText;
    wrapper.appendChild(helper);
  }

  // Search input with icon (creates a .field-picker-search wrapper)
  const searchRow = createInputField({
    iconName: 'file',
    placeholder,
    ariaLabel: placeholder,
  });
  const searchInput = searchRow._inputEl;

  // Dropdown list (inside searchRow for CSS positioning)
  const dropdownList = document.createElement('div');
  dropdownList.className = 'field-picker-dropdown';
  searchRow.appendChild(dropdownList);
  wrapper.appendChild(searchRow);

  // Selected files tags container
  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'cloud';
  wrapper.appendChild(tagsContainer);

  container.appendChild(wrapper);

  // --- Render functions ---

  function renderTags() {
    tagsContainer.innerHTML = '';
    for (const path of selectedPaths) {
      const tag = createTag({
        label: path,
        iconName: fileIconName(path),
        title: path,
        onRemove: () => {
          selectedPaths = selectedPaths.filter((p) => p !== path);
          renderTags();
          onChange([...selectedPaths]);
        },
      });
      tagsContainer.appendChild(tag);
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
      empty.className = 'field-picker-empty';
      empty.textContent = 'No files available. Select a repo first.';
      dropdownList.appendChild(empty);
      return;
    }

    if (available.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'field-picker-empty';
      empty.textContent = filter ? 'No matches' : 'All files selected';
      dropdownList.appendChild(empty);
      return;
    }

    for (const path of available) {
      const item = document.createElement('div');
      item.className = 'field-picker-item';
      item.title = path;
      item.textContent = path;
      item.addEventListener('click', () => {
        selectedPaths = [...selectedPaths, path];
        searchInput.value = '';
        dropdownList.classList.remove('field-picker-dropdown--open');
        renderTags();
        renderDropdown('');
        onChange([...selectedPaths]);
      });
      dropdownList.appendChild(item);
    }
  }

  // --- Events ---

  searchInput.addEventListener('focus', () => {
    renderDropdown(searchInput.value);
    dropdownList.classList.add('field-picker-dropdown--open');
  });

  searchInput.addEventListener('input', () => {
    renderDropdown(searchInput.value);
    dropdownList.classList.add('field-picker-dropdown--open');
  });

  document.addEventListener('click', (e) => {
    if (!searchRow.contains(e.target)) {
      dropdownList.classList.remove('field-picker-dropdown--open');
    }
  });

  // Initial render
  renderTags();
}
