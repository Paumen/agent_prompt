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

import { icon } from './icons.js';

// Object type → Octicon name (for step icons)
const OBJECT_ICON_MAP = {
  file: 'file',
  files: 'file',
  branch: 'git-branch',
  pull_request: 'git-pull-request',
  issue: 'issue-opened',
  tests: 'checklist',
  changes: 'diff',
  review_feedback: 'comment',
  implementation: 'rocket',
  acceptance_criteria: 'check',
  improvements: 'compose',
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

// Output mode → Octicon name
const OUTPUT_ICON_MAP = {
  here: 'comment',
  pr_comment: 'git-pull-request',
  pr_inline_comments: 'comment-discussion',
  issue_comment: 'issue-opened',
  report_file: 'file',
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

  // Object icon
  const iconName = OBJECT_ICON_MAP[step.object] || 'file';
  header.appendChild(icon(iconName, 'icon-btn'));

  const label = document.createElement('span');
  label.className = 'step-label';
  label.textContent = formatStepLabel(step);
  header.appendChild(label);

  // Delete button — all steps are removable (STP-04)
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn-icon step-delete';
  deleteBtn.appendChild(icon('trash', 'icon-remove'));
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
    removeBtn.appendChild(icon('x', 'icon-remove'));
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
    const iconName = OUTPUT_ICON_MAP[mode] || 'comment';
    btn.appendChild(icon(iconName, 'icon-btn'));

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
