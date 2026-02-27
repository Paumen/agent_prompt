/**
 * Card 3: Steps
 *
 * Auto-generated step list from flow + panel inputs.
 * Users can toggle lenses, delete any step, and provide optional text.
 *
 * Req IDs: STP-01..04
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

// Show first 7 lenses (preselected first, then others). Rest behind "more" button.
const INITIAL_LENS_COUNT = 7;

// Trash icon SVG (Octicon)
const TRASH_ICON = `<svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style="display:block"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/></svg>`;

// --- Module-level state ---

let elBody = null;
let previousStepSnapshot = '';

// --- Step label formatting ---

function formatStepLabel(step) {
  const op = step.operation.charAt(0).toUpperCase() + step.operation.slice(1);
  const obj = step.object.replace(/_/g, ' ');

  if (step.params?.file) {
    return `${op}: @${step.params.file}`;
  }

  return `${op}: ${obj}`;
}

function getOptionalTextPlaceholder(step) {
  if (step.branch_name !== undefined) return 'Branch name (optional)';
  if (step.pr_name !== undefined) return 'PR title (optional)';
  if (step.file_name !== undefined) return 'File name (optional)';
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

  // Step header: label + delete button
  const header = document.createElement('div');
  header.className = 'step-header';

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

  // Optional text input (branch_name, pr_name, file_name)
  if (hasOptionalText(step)) {
    const placeholder = getOptionalTextPlaceholder(step);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-field step-optional-text';
    input.placeholder = placeholder;
    input.value = step.name_provided || '';
    input.addEventListener('input', () => {
      onOptionalTextChange(index, input.value);
    });
    li.appendChild(input);
  }

  // Output mode pills (for feedback steps with output options)
  if (Array.isArray(step.output) && step.output.length > 0) {
    const outputContainer = renderOutputPills(step, index);
    li.appendChild(outputContainer);
  }

  // Lens pills (if step has lenses array)
  if (step.lenses !== undefined) {
    const lensContainer = renderStepLenses(step, index);
    li.appendChild(lensContainer);
  }

  return li;
}

// Output mode labels for human-readable display
const OUTPUT_LABELS = {
  here: 'Here (in chat)',
  pr_comment: 'PR comment',
  pr_inline_comments: 'PR inline comments',
  issue_comment: 'Issue comment',
  report_file: 'Report file',
};

function renderOutputPills(step, stepIndex) {
  const container = document.createElement('div');
  container.className = 'step-output-modes';

  const label = document.createElement('span');
  label.className = 'step-sub-label';
  label.textContent = 'Deliver feedback via:';
  container.appendChild(label);

  const pillGroup = document.createElement('div');
  pillGroup.className = 'pill-group step-output-pills';

  const selected = step.output_selected || step.output[0];

  for (const mode of step.output) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'pill';
    pill.textContent = OUTPUT_LABELS[mode] || mode.replace(/_/g, ' ');
    pill.setAttribute('role', 'radio');

    const isOn = mode === selected;
    pill.setAttribute('aria-checked', String(isOn));
    if (isOn) pill.classList.add('pill--on');

    pill.addEventListener('click', () => {
      onSelectOutput(stepIndex, mode);
    });

    pillGroup.appendChild(pill);
  }

  container.appendChild(pillGroup);
  return container;
}

function renderStepLenses(step, stepIndex) {
  const container = document.createElement('div');
  container.className = 'step-lenses';

  const activeLenses = step.lenses || [];

  // Fixed order (no sort) — sorting caused positions to jump on toggle (3.6)
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
    moreBtn.textContent =
      activeRemainder.length > 0
        ? `+${remainder.length} more (${activeRemainder.length} active)`
        : `+${remainder.length} more`;

    const extraGroup = document.createElement('div');
    extraGroup.className = 'pill-group step-lens-pills step-lens-extra';
    extraGroup.style.display = 'none';

    for (const lens of remainder) {
      extraGroup.appendChild(createLensPill(lens, activeLenses, stepIndex));
    }

    let expanded = false;
    moreBtn.addEventListener('click', () => {
      expanded = !expanded;
      extraGroup.style.display = expanded ? 'flex' : 'none';
      if (expanded) {
        moreBtn.textContent = 'Show fewer';
      } else {
        const updatedActive = remainder.filter((l) => {
          const state = getState();
          const stepLenses =
            state.steps?.enabled_steps?.[stepIndex]?.lenses || [];
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

function onSelectOutput(stepIndex, mode) {
  setInteracting(); // GL-05: flag mid-interaction to defer background refresh
  const state = getState();
  const steps = (state.steps.enabled_steps || []).map((s) => ({ ...s }));

  if (stepIndex < 0 || stepIndex >= steps.length) return;

  steps[stepIndex].output_selected = mode;
  setState('steps.enabled_steps', steps);
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

  renderStepList();
  subscribe(onStateChange);
}
