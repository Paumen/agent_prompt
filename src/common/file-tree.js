/**
 * Multi-select file picker (SCT-01, SCT-06).
 *
 * Stateful wrapper around createPicker for file selection.
 * Uses a flat alphabetical searchable list (per SCT-06).
 * Files are picked one at a time from a search dropdown.
 * Selected files are displayed as removable tags below the picker.
 *
 * Spec/Guideline file pickers show helper text explaining the distinction (SCT-06):
 *   - spec_files:     "WHAT to build (requirements, user stories, design docs)"
 *   - guideline_files: "HOW to build (coding standards, style guides)"
 */

import { fileIconName } from './icons.js';
import { createPicker, createTag } from './ui.js';

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
