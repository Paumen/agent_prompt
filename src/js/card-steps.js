/**
 * Card 3: Steps
 *
 * Auto-generated step list from flow + panel inputs.
 * Users can toggle lenses, delete any step, and provide optional text.
 *
 * Req IDs: STP-01..04
 */

import { getState, setState, subscribe } from './state.js';
import { getFlowById, ALL_LENSES } from './flow-loader.js';
import { generateSteps, reconcileSteps } from './step-generator.js';
import { setInteracting } from './components.js';
import { fileIconName } from './icons.js';
import {
  createButton,
  createTag,
  createInputField,
  createMoreLess,
} from './ui.js';

// Show first 7 lenses. Rest behind "more" button.
const INITIAL_LENS_COUNT = 7;

// Output mode labels
const OUTPUT_LABELS = {
  here: 'Here (in chat)',
  pr_comment: 'PR comment',
  pr_inline_comments: 'PR inline comments',
  issue_comment: 'Issue comment',
  report_file: 'Report file',
};

const OUTPUT_SHORT_LABELS = {
  here: 'Here',
  pr_comment: 'PR Com',
  pr_inline_comments: 'Inline',
  issue_comment: 'Issue',
  report_file: 'File',
};

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

// Lens expanded state — persists across re-renders; resets on flow switch
const expandedSteps = new Map();

// --- Step label formatting ---

function formatStepLabel(step) {
  const op = step.operation.charAt(0).toUpperCase() + step.operation.slice(1);
  const obj = step.object.replace(/_/g, ' ');

  if (step.params?.file) {
    return `${op}: @${step.params.file}`;
  }

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
  list.className = 'output-block';
  list.setAttribute('role', 'list');

  steps.forEach((step, index) => {
    list.appendChild(renderStepRow(step, index));
  });

  elBody.appendChild(list);
}

function renderStepRow(step, index) {
  const li = document.createElement('li');
  li.className = 'output output-field';
  li.dataset.stepId = step.id;

  // Label (col 1 — col 0 is the CSS counter ::before)
  const label = document.createElement('span');
  label.textContent = formatStepLabel(step);
  li.appendChild(label);

  // Delete button (col 3)
  const deleteBtn = createButton('icon', {
    iconName: 'trash',
    iconClass: 'icon-remove',
    title: 'Remove step',
    ariaLabel: `Remove step: ${formatStepLabel(step)}`,
    onClick: () => onDeleteStep(step.id),
  });
  li.appendChild(deleteBtn);

  // --- Sub-items (auto-placed to col 2/-1 via CSS nth-child rule) ---

  // Source pill (PR/Issue reference)
  if (
    (step.object === 'pull_request' || step.object === 'issue') &&
    step.source
  ) {
    const iconName =
      step.object === 'pull_request' ? 'git-pull-request' : 'issue-opened';
    const prefix = step.object === 'pull_request' ? 'PR' : 'Issue';
    const pill = renderSourcePill(step.source, iconName, prefix);
    if (pill) li.appendChild(pill);
  }

  // File pills
  if (step.params?.files?.length > 0) {
    li.appendChild(renderFilePills(step));
  }

  // Optional text input
  if (hasOptionalText(step)) {
    li.appendChild(renderOptionalTextRow(step, index));
  }

  // Output mode buttons
  if (Array.isArray(step.output) && step.output.length > 0) {
    li.appendChild(renderOutputIcons(step, index));
  }

  // Lens pills
  if (step.lenses !== undefined) {
    li.appendChild(renderStepLenses(step, index));
  }

  return li;
}

function renderSourcePill(source, iconName, labelPrefix) {
  const state = getState();
  const [panel, field] = source.split('.');
  const value = state[panel]?.[field];
  if (!value) return null;

  return createTag({
    label: `${labelPrefix} #${value}`,
    iconName,
  });
}

function renderFilePills(step) {
  const container = document.createElement('div');
  container.className = 'wrapper';

  for (const filePath of step.params.files) {
    const segments = filePath.split('/');
    const tag = createTag({
      label: '@' + segments[segments.length - 1],
      iconName: fileIconName(filePath),
      title: filePath,
      onRemove: () => onRemoveFileFromStep(step, filePath),
    });
    container.appendChild(tag);
  }

  return container;
}

function renderOptionalTextRow(step, index) {
  const row = document.createElement('div');
  row.className = 'input';

  const lbl = document.createElement('label');
  lbl.textContent = getOptionalTextLabel(step);
  row.appendChild(lbl);

  const input = createInputField({
    placeholder: getOptionalTextPlaceholder(step),
    value: step.name_provided || '',
    onInput: (e) => onOptionalTextChange(index, e.target.value),
  });
  row.appendChild(input);

  return row;
}

function renderOutputIcons(step, index) {
  const container = document.createElement('div');
  container.className = 'input';

  const lbl = document.createElement('label');
  lbl.textContent = 'Deliver via:';
  container.appendChild(lbl);

  const pillGroup = document.createElement('div');
  pillGroup.className = 'wrapper';

  const selected =
    step.outputs_selected ||
    (step.output_selected ? [step.output_selected] : [step.output[0]]);

  for (const mode of step.output) {
    const isOn = selected.includes(mode);
    const btn = createButton('pill', {
      label: OUTPUT_SHORT_LABELS[mode] || mode,
      iconName: OUTPUT_ICON_MAP[mode] || 'comment',
      selected: isOn,
      ariaLabel: OUTPUT_LABELS[mode] || mode,
      onClick: () => onSelectOutput(index, mode, btn),
    });
    btn.setAttribute('role', 'checkbox');
    pillGroup.appendChild(btn);
  }

  container.appendChild(pillGroup);
  return container;
}

function renderStepLenses(step, stepIndex) {
  const container = document.createElement('div');

  const activeLenses = step.lenses || [];
  const initial = ALL_LENSES.slice(0, INITIAL_LENS_COUNT);
  const remainder = ALL_LENSES.slice(INITIAL_LENS_COUNT);

  // Primary lenses
  const pillGroup = document.createElement('div');
  pillGroup.className = 'wrapper';

  for (const lens of initial) {
    pillGroup.appendChild(createLensPill(lens, activeLenses, stepIndex));
  }

  container.appendChild(pillGroup);

  // "More" button for remaining lenses
  if (remainder.length > 0) {
    const activeRemainder = remainder.filter((l) => activeLenses.includes(l));
    const isExpanded = expandedSteps.get(step.id) || false;

    const extraGroup = document.createElement('div');
    extraGroup.className = 'wrapper';
    extraGroup.hidden = !isExpanded;

    for (const lens of remainder) {
      extraGroup.appendChild(createLensPill(lens, activeLenses, stepIndex));
    }

    const moreBtn = createMoreLess({
      hiddenCount: remainder.length,
      expanded: isExpanded,
      activeLabel:
        activeRemainder.length > 0
          ? `${activeRemainder.length} active`
          : undefined,
      onToggle: (nowExpanded) => {
        expandedSteps.set(step.id, nowExpanded);
        extraGroup.hidden = !nowExpanded;
      },
    });

    container.appendChild(moreBtn);
    container.appendChild(extraGroup);
  }

  return container;
}

function createLensPill(lens, activeLenses, stepIndex) {
  const isOn = activeLenses.includes(lens);
  return createButton('pill', {
    label: lens.replace(/_/g, ' '),
    selected: isOn,
    onClick: () => onToggleLens(stepIndex, lens),
  });
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

function onRemoveFileFromStep(step, filePath) {
  const source = step.source;
  if (!source) return;

  const state = getState();
  const [panel, field] = source.split('.');
  const currentFiles = state[panel]?.[field] || [];
  const newFiles = currentFiles.filter((f) => f !== filePath);

  setState(source, newFiles);
}

function onToggleLens(stepIndex, lens) {
  setInteracting();
  const state = getState();
  const steps = (state.steps.enabled_steps || []).map((s) => ({ ...s }));

  if (stepIndex < 0 || stepIndex >= steps.length) return;

  const step = steps[stepIndex];
  const current = step.lenses || [];

  const newLenses = current.includes(lens)
    ? current.filter((l) => l !== lens)
    : [...current, lens];

  // Sync all lens-enabled steps to the same selection
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].lenses !== undefined) {
      steps[i] = { ...steps[i], lenses: newLenses };
    }
  }

  setState('steps.enabled_steps', steps);

  // Sync to task card lens picker if this flow uses one (panel_b.lenses)
  if (state.panel_b?.lenses !== undefined) {
    setState('panel_b.lenses', newLenses);
  }
}

function onSelectOutput(stepIndex, mode, btn) {
  setInteracting();
  const state = getState();
  const steps = (state.steps.enabled_steps || []).map((s) => ({ ...s }));

  if (stepIndex < 0 || stepIndex >= steps.length) return;

  const step = steps[stepIndex];
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

  // Update button state visually
  const isNowOn = newSelected.includes(mode);
  btn.setAttribute('aria-checked', String(isNowOn));
  btn.classList.toggle('btn-pill--on', isNowOn);

  // Float-up toast
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

  if (
    flowId === lastFlowId &&
    panelASnap === lastPanelASnapshot &&
    panelBSnap === lastPanelBSnapshot
  ) {
    return;
  }

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

  previousStepSnapshot = '';
  expandedSteps.clear();

  renderStepList();
  subscribe(onStateChange);
}
