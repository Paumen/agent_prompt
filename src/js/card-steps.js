/**
 * Card 3: Steps
 *
 * Auto-generated step list from flow + panel inputs.
 * Users can toggle lenses, delete any step, and provide optional text.
 *
 * Req IDs: STP-01..04
 * Phase 13: step badge, object icons, file pills, output multi-select, lens stability
 */

import { getState, setState, subscribe } from './state.js';
import { getFlowById } from './flow-loader.js';
import { generateSteps, reconcileSteps } from './step-generator.js';
import { setInteracting } from './components.js';

// Available lenses (from flows.yaml vocabulary)
const ALL_LENSES = [
  'semantics',
  'syntax',
  'security',
  'performance',
  'structure',
  'dependencies',
  'duplications',
  'redundancies',
  'error_handling',
  'naming_conventions',
  'test_coverage',
  'type_safety',
  'documentation_completeness',
  'accessibility',
];

// Show first 7 lenses. Rest behind "more" button.
const INITIAL_LENS_COUNT = 7;

// Trash icon SVG (Octicon)
const TRASH_ICON = `<svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style="display:block"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/></svg>`;

// Object → octicon SVG (step icon, Phase 13)
const OBJECT_ICONS = {
  file: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg>`,
  files: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg>`,
  branch: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>`,
  pull_request: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/></svg>`,
  issue: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/></svg>`,
  tests: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 1.75A.75.75 0 0 1 .75 1h3a.75.75 0 0 1 .75.75V3h7.5V1.75a.75.75 0 0 1 1.5 0v.75h.75a.75.75 0 0 1 0 1.5H14v9.75a.75.75 0 0 1-.75.75H2.75a.75.75 0 0 1-.75-.75V4h-.75A.75.75 0 0 1 0 3.25Zm1.5 2.5V13h12V4.25a.75.75 0 0 0-.75-.75h-10.5a.75.75 0 0 0-.75.75Z"/></svg>`,
  changes: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25v-7.5C1 1.784 1.784 1 2.75 1ZM2.5 2.75v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25H2.75a.25.25 0 0 0-.25.25Z"/></svg>`,
  review_feedback: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`,
  implementation: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/></svg>`,
  acceptance_criteria: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`,
  improvements: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3.47 7.78a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L9 4.81v7.44a.75.75 0 0 1-1.5 0V4.81L4.53 7.78a.75.75 0 0 1-1.06 0Z"/></svg>`,
};

// Operation → CSS color class (Phase 13)
const OPERATION_COLOR_CLASS = {
  read: 'icon--read',
  analyze: 'icon--read',
  edit: 'icon--edit',
  modify: 'icon--edit',
  create: 'icon--create',
  commit: 'icon--create',
  validate: 'icon--validate',
};

// Output mode full labels
const OUTPUT_LABELS = {
  here: 'Here (in chat)',
  pr_comment: 'PR comment',
  pr_inline_comments: 'PR inline comments',
  issue_comment: 'Issue comment',
  report_file: 'Report file',
};

// Output mode short labels for icon buttons (≤6 chars)
const OUTPUT_SHORT_LABELS = {
  here: 'Here',
  pr_comment: 'PR Com',
  pr_inline_comments: 'Inline',
  issue_comment: 'Issue',
  report_file: 'File',
};

// Output mode icons
const OUTPUT_ICONS = {
  here: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`,
  pr_comment: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/></svg>`,
  pr_inline_comments: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25v-7.5C1 1.784 1.784 1 2.75 1ZM2.5 2.75v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25H2.75a.25.25 0 0 0-.25.25Z"/></svg>`,
  issue_comment: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/></svg>`,
  report_file: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg>`,
};

// --- Module-level state ---

let elBody = null;
let previousStepSnapshot = '';

// Module-level lens expanded state — persists across re-renders; resets on flow switch (Phase 13)
const expandedSteps = new Map();

// --- Step label formatting ---

function formatStepLabel(step) {
  const op = step.operation.charAt(0).toUpperCase() + step.operation.slice(1);
  const obj = step.object.replace(/_/g, ' ');

  // Single file (e.g. read-claude)
  if (step.params?.file) {
    return `${op}: @${step.params.file}`;
  }

  // Multi-file consolidated step: show count in label; files shown as pills below
  if (step.params?.files?.length > 0) {
    const n = step.params.files.length;
    return `${op}: ${n} file${n > 1 ? 's' : ''}`;
  }

  return `${op}: ${obj}`;
}

function getOptionalTextPlaceholder(step) {
  if (step.branch_name !== undefined) return 'Branch name (optional)';
  if (step.pr_name !== undefined) return 'PR title (optional)';
  if (step.file_name !== undefined) return 'File name (optional)';
  return null;
}

function getOptionalTextLabel(step) {
  if (step.branch_name !== undefined) return 'Branch:';
  if (step.pr_name !== undefined) return 'PR title:';
  if (step.file_name !== undefined) return 'File name:';
  return null;
}

function hasOptionalText(step) {
  return (
    step.branch_name !== undefined ||
    step.pr_name !== undefined ||
    step.file_name !== undefined
  );
}

// --- Rendering ---

function renderStepList() {
  if (!elBody) return;

  const state = getState();
  const steps = state.steps?.enabled_steps || [];

  // Skip re-render if steps haven't changed
  const stepSnapshot = JSON.stringify(steps);
  if (stepSnapshot === previousStepSnapshot) return;
  previousStepSnapshot = stepSnapshot;

  elBody.innerHTML = '';

  if (steps.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Select a flow to generate steps.';
    elBody.appendChild(empty);
    return;
  }

  const list = document.createElement('ol');
  list.className = 'step-list';
  list.setAttribute('role', 'list');

  steps.forEach((step, index) => {
    const li = renderStepRow(step, index);
    list.appendChild(li);
  });

  elBody.appendChild(list);
}

function renderStepRow(step, index) {
  const li = document.createElement('li');
  li.className = 'step-row';
  li.dataset.stepId = step.id;

  // Step header: badge + icon + label + delete button
  const header = document.createElement('div');
  header.className = 'step-header';

  // Step number badge (replaces CSS counter, Phase 13)
  const badge = document.createElement('span');
  badge.className = 'step-badge';
  badge.textContent = String(index + 1);
  badge.setAttribute('aria-hidden', 'true');
  header.appendChild(badge);

  // Object icon, colored by operation (Phase 13)
  const iconSvg = OBJECT_ICONS[step.object] || OBJECT_ICONS.file;
  const colorClass = OPERATION_COLOR_CLASS[step.operation] || 'icon--read';
  const iconWrapper = document.createElement('span');
  iconWrapper.className = `step-object-icon ${colorClass}`;
  iconWrapper.innerHTML = iconSvg;
  header.appendChild(iconWrapper);

  const label = document.createElement('span');
  label.className = 'step-label';
  label.textContent = formatStepLabel(step);
  header.appendChild(label);

  // Delete button — all steps are removable (STP-04)
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn-icon step-delete';
  deleteBtn.innerHTML = TRASH_ICON;
  deleteBtn.title = 'Remove step';
  deleteBtn.setAttribute('aria-label', `Remove step: ${formatStepLabel(step)}`);
  deleteBtn.addEventListener('click', () => onDeleteStep(step.id));
  header.appendChild(deleteBtn);

  li.appendChild(header);

  // File pills — for consolidated file steps (Phase 13)
  if (step.params?.files?.length > 0) {
    const filesContainer = renderFilePills(step);
    li.appendChild(filesContainer);
  }

  // Optional text input — on one flex row with label (Phase 13)
  if (hasOptionalText(step)) {
    const placeholder = getOptionalTextPlaceholder(step);
    const textLabel = getOptionalTextLabel(step);

    const row = document.createElement('div');
    row.className = 'step-optional-row';

    const lbl = document.createElement('span');
    lbl.className = 'step-sub-label';
    lbl.textContent = textLabel;
    row.appendChild(lbl);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-field step-optional-text';
    input.placeholder = placeholder;
    input.value = step.name_provided || '';
    input.addEventListener('input', () => {
      onOptionalTextChange(index, input.value);
    });
    row.appendChild(input);

    li.appendChild(row);
  }

  // Output mode icon buttons (Phase 13 multi-select)
  if (Array.isArray(step.output) && step.output.length > 0) {
    const outputContainer = renderOutputIcons(step, index);
    li.appendChild(outputContainer);
  }

  // Lens pills (if step has lenses array)
  if (step.lenses !== undefined) {
    const lensContainer = renderStepLenses(step, index);
    li.appendChild(lensContainer);
  }

  return li;
}

function renderFilePills(step) {
  const container = document.createElement('div');
  container.className = 'step-files';

  for (const filePath of step.params.files) {
    const pill = document.createElement('span');
    pill.className = 'step-file-pill';

    const nameSpan = document.createElement('span');
    // Show last path segment; full path on hover
    const segments = filePath.split('/');
    nameSpan.textContent = '@' + segments[segments.length - 1];
    nameSpan.title = filePath;
    pill.appendChild(nameSpan);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'step-file-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.setAttribute('aria-label', `Remove ${filePath}`);
    removeBtn.addEventListener('click', () => {
      onRemoveFileFromStep(step, filePath);
    });
    pill.appendChild(removeBtn);

    container.appendChild(pill);
  }

  return container;
}

function renderOutputIcons(step, stepIndex) {
  const container = document.createElement('div');
  container.className = 'step-output-modes';

  const label = document.createElement('span');
  label.className = 'step-sub-label';
  label.textContent = 'Deliver via:';
  container.appendChild(label);

  const iconRow = document.createElement('div');
  iconRow.className = 'step-output-icons';

  // Resolve selected modes — support old output_selected string for migration
  const selected =
    step.outputs_selected ||
    (step.output_selected ? [step.output_selected] : [step.output[0]]);

  for (const mode of step.output) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'output-mode-btn';
    btn.setAttribute('role', 'checkbox');
    btn.setAttribute('aria-label', OUTPUT_LABELS[mode] || mode);

    const isOn = selected.includes(mode);
    btn.setAttribute('aria-checked', String(isOn));
    if (isOn) btn.classList.add('output-mode-btn--on');

    // Icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.innerHTML = OUTPUT_ICONS[mode] || OUTPUT_ICONS.here;
    btn.appendChild(iconSpan);

    // Static short label
    const shortLabel = document.createElement('span');
    shortLabel.className = 'output-label';
    shortLabel.textContent = OUTPUT_SHORT_LABELS[mode] || mode;
    btn.appendChild(shortLabel);

    btn.addEventListener('click', () => {
      onSelectOutput(stepIndex, mode, btn);
    });

    iconRow.appendChild(btn);
  }

  container.appendChild(iconRow);
  return container;
}

function renderStepLenses(step, stepIndex) {
  const container = document.createElement('div');
  container.className = 'step-lenses';

  const activeLenses = step.lenses || [];

  // Fixed order (no sort) — active lenses stay in fixed position (STP-03 / Phase 13)
  const initial = ALL_LENSES.slice(0, INITIAL_LENS_COUNT);
  const remainder = ALL_LENSES.slice(INITIAL_LENS_COUNT);

  const pillGroup = document.createElement('div');
  pillGroup.className = 'pill-group step-lens-pills';

  for (const lens of initial) {
    pillGroup.appendChild(createLensPill(lens, activeLenses, stepIndex));
  }

  container.appendChild(pillGroup);

  // "More" button for remaining lenses
  if (remainder.length > 0) {
    const activeRemainder = remainder.filter((l) => activeLenses.includes(l));

    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'step-more-lenses';

    // Restore expanded state from module-level map (Phase 13 lens stability)
    const isExpanded = expandedSteps.get(step.id) || false;

    const extraGroup = document.createElement('div');
    extraGroup.className = 'pill-group step-lens-pills step-lens-extra';
    extraGroup.style.display = isExpanded ? 'flex' : 'none';

    moreBtn.textContent = isExpanded
      ? 'Show fewer'
      : activeRemainder.length > 0
        ? `+${remainder.length} more (${activeRemainder.length} active)`
        : `+${remainder.length} more`;

    for (const lens of remainder) {
      extraGroup.appendChild(createLensPill(lens, activeLenses, stepIndex));
    }

    moreBtn.addEventListener('click', () => {
      const nowExpanded = !expandedSteps.get(step.id);
      expandedSteps.set(step.id, nowExpanded);
      extraGroup.style.display = nowExpanded ? 'flex' : 'none';
      if (nowExpanded) {
        moreBtn.textContent = 'Show fewer';
      } else {
        const updatedActive = remainder.filter((l) => {
          const st = getState();
          const stepLenses = st.steps?.enabled_steps?.[stepIndex]?.lenses || [];
          return stepLenses.includes(l);
        });
        moreBtn.textContent =
          updatedActive.length > 0
            ? `+${remainder.length} more (${updatedActive.length} active)`
            : `+${remainder.length} more`;
      }
    });

    container.appendChild(moreBtn);
    container.appendChild(extraGroup);
  }

  return container;
}

function createLensPill(lens, activeLenses, stepIndex) {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'pill';
  pill.textContent = lens.replace(/_/g, ' ');
  pill.setAttribute('role', 'switch');

  const isOn = activeLenses.includes(lens);
  pill.setAttribute('aria-checked', String(isOn));
  if (isOn) pill.classList.add('pill--on');

  pill.addEventListener('click', () => {
    onToggleLens(stepIndex, lens);
  });

  return pill;
}

// --- Event handlers ---

function onDeleteStep(stepId) {
  const state = getState();
  const removedIds = [...(state.steps.removed_step_ids || []), stepId];
  const newSteps = (state.steps.enabled_steps || []).filter(
    (s) => s.id !== stepId
  );

  setState((current) => ({
    steps: {
      ...current.steps,
      enabled_steps: newSteps,
      removed_step_ids: removedIds,
    },
  }));
}

/**
 * Remove a file from the step's source panel field (Phase 13).
 * Since the step source == panel field, removing from panel auto-removes from step
 * via regenerateIfNeeded. If the panel field becomes empty, the conditional step
 * is automatically excluded from generated steps.
 */
function onRemoveFileFromStep(step, filePath) {
  const source = step.source; // e.g. 'panel_a.files'
  if (!source) return;

  const state = getState();
  const [panel, field] = source.split('.');
  const currentFiles = state[panel]?.[field] || [];
  const newFiles = currentFiles.filter((f) => f !== filePath);

  setState(source, newFiles);
}

function onToggleLens(stepIndex, lens) {
  setInteracting(); // GL-05: flag mid-interaction to defer background refresh
  const state = getState();
  const steps = (state.steps.enabled_steps || []).map((s) => ({ ...s }));

  if (stepIndex < 0 || stepIndex >= steps.length) return;

  const step = steps[stepIndex];
  const current = step.lenses || [];

  step.lenses = current.includes(lens)
    ? current.filter((l) => l !== lens)
    : [...current, lens];

  setState('steps.enabled_steps', steps);
}

/**
 * Toggle an output mode in/out of outputs_selected array (Phase 13 multi-select).
 */
function onSelectOutput(stepIndex, mode, btn) {
  setInteracting(); // GL-05: flag mid-interaction to defer background refresh
  const state = getState();
  const steps = (state.steps.enabled_steps || []).map((s) => ({ ...s }));

  if (stepIndex < 0 || stepIndex >= steps.length) return;

  const step = steps[stepIndex];
  // Migrate from old single-string format if needed
  const current =
    step.outputs_selected ||
    (step.output_selected
      ? [step.output_selected]
      : [step.output?.[0]].filter(Boolean));

  const newSelected = current.includes(mode)
    ? current.filter((m) => m !== mode)
    : [...current, mode];

  steps[stepIndex] = { ...step, outputs_selected: newSelected };
  setState('steps.enabled_steps', steps);

  // Float-up toast showing the full mode name (Phase 13)
  const float = document.createElement('span');
  float.className = 'output-float';
  float.textContent = OUTPUT_LABELS[mode] || mode;
  btn.appendChild(float);
  float.addEventListener('animationend', () => float.remove());
}

function onOptionalTextChange(stepIndex, value) {
  const state = getState();
  const steps = (state.steps.enabled_steps || []).map((s) => ({ ...s }));

  if (stepIndex < 0 || stepIndex >= steps.length) return;

  steps[stepIndex].name_provided = value || undefined;
  setState('steps.enabled_steps', steps);
}

// --- Step regeneration on panel changes ---

let lastFlowId = '';
let lastPanelASnapshot = '';
let lastPanelBSnapshot = '';

function regenerateIfNeeded(snapshot) {
  const flowId = snapshot.task?.flow_id;
  if (!flowId) return;

  const panelASnap = JSON.stringify(snapshot.panel_a || {});
  const panelBSnap = JSON.stringify(snapshot.panel_b || {});

  // Only regenerate when flow or panel data changed
  if (
    flowId === lastFlowId &&
    panelASnap === lastPanelASnapshot &&
    panelBSnap === lastPanelBSnapshot
  ) {
    return;
  }

  // Reset lens expanded state on flow switch (Phase 13)
  if (flowId !== lastFlowId) {
    expandedSteps.clear();
  }

  lastFlowId = flowId;
  lastPanelASnapshot = panelASnap;
  lastPanelBSnapshot = panelBSnap;

  const flowDef = getFlowById(flowId);
  if (!flowDef) return;

  const generated = generateSteps(flowDef, snapshot.panel_a, snapshot.panel_b);
  const reconciled = reconcileSteps(
    generated,
    snapshot.steps.enabled_steps,
    snapshot.steps.removed_step_ids
  );

  // Only update if steps actually changed
  const currentJson = JSON.stringify(snapshot.steps.enabled_steps);
  const newJson = JSON.stringify(reconciled);
  if (currentJson !== newJson) {
    setState('steps.enabled_steps', reconciled);
  }
}

// --- State subscription ---

function onStateChange(snapshot) {
  regenerateIfNeeded(snapshot);
  renderStepList();
}

// --- Initialization ---

export function initStepsCard() {
  elBody = document.getElementById('bd-steps');
  if (!elBody) return;

  // Reset snapshot to force initial render
  previousStepSnapshot = '';

  // Clear lens expanded state on card (re-)init
  expandedSteps.clear();

  renderStepList();
  subscribe(onStateChange);
}
