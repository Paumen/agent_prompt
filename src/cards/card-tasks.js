/**
 * Card 2: Task
 *
 * Flow selector grid + dual-panel (Situation / Target) + quality meter.
 * Fields within each panel are driven by flows.yaml field definitions.
 *
 * Req IDs: SCT-01..09, DM-DEF-03
 */

import {
  getState,
  setState,
  subscribe,
  applyFlowDefaults,
  resetDownstream,
  getValueByPath,
} from '../core/state.js';
import { getFlows, getFlowById, ALL_LENSES } from '../logic/flow-loader.js';
import { getFileTree } from './card-configuration.js';
import { fetchPRs, fetchIssues } from '../common/github-api.js';
import { cacheGet, cacheSet } from '../common/cache.js';
import { renderShimmer } from '../common/components.js';
import { createFilePicker } from '../common/file-tree.js';
import {
  createButton,
  createInputField,
  createLabel,
  createPicker,
  createTag,
} from '../common/ui.js';
import { icon } from '../common/icons.js';

// --- Module-level state ---

let elBody = null;
let elPanelArea = null;
let currentFlowId = null;

// D401/D402: Field element references for validation management
const fieldElements = new Map(); // statePath → { el, type, fieldDef }

// Lens picker sync
let elLensPillGroup = null;
let lastLensStatePath = null;
let lastTaskLensSnapshot = '';

// Cached PR/issue data
let cachedPRs = null;
let cachedIssues = null;
let isLoadingPRs = false;
let isLoadingIssues = false;

// Scope selector element (for show/hide)
let elScopeSelector = null;

// --- Card meta (D204) ---

function updateTaskCardMeta(flowLabel) {
  const metaEl = document.querySelector('#card-tasks .card-meta');
  if (!metaEl) return;
  metaEl.textContent = flowLabel || '';
}

// --- Flow grid ---

function renderFlowSelector() {
  const flows = getFlows();
  for (const [flowId, flowDef] of Object.entries(flows)) {
    const btn = createButton('select', {
      label: flowDef.label,
      iconName: flowDef.icon || undefined,
      onClick: () => onFlowSelect(flowId, flowDef),
      dataset: { flowId },
    });
    elBody.appendChild(btn);
  }
}

// --- Panel area (rendered after flow selection) ---

function renderPanelArea() {
  elPanelArea = document.createElement('div');
  elPanelArea.className = 'card-body';
  elBody.appendChild(elPanelArea);

  // AC 2.1: Create placeholder panels (closed, locked) before flow selection.
  // Replaced with flow-specific panels when a flow is selected.
  renderPlaceholderPanels();
}

function renderPlaceholderPanels() {
  const sitPanel = document.createElement('details');
  sitPanel.className = 'card';
  sitPanel.dataset.panel = 'situation';
  sitPanel.dataset.cardState = 'locked';
  sitPanel.open = false;

  const sitHeader = document.createElement('summary');
  sitHeader.className = 'card-header';
  const sitTitle = document.createElement('span');
  sitTitle.textContent = 'Situation';
  sitHeader.appendChild(sitTitle);
  sitPanel.appendChild(sitHeader);

  const tgtPanel = document.createElement('details');
  tgtPanel.className = 'card';
  tgtPanel.dataset.panel = 'target';
  tgtPanel.dataset.cardState = 'locked';
  tgtPanel.open = false;

  const tgtHeader = document.createElement('summary');
  tgtHeader.className = 'card-header';
  const tgtTitle = document.createElement('span');
  tgtTitle.textContent = 'Target';
  tgtHeader.appendChild(tgtTitle);
  tgtPanel.appendChild(tgtHeader);

  elPanelArea.appendChild(sitPanel);
  elPanelArea.appendChild(tgtPanel);
}

// --- Flow selection handler ---

function onFlowSelect(flowId, flowDef) {
  // Re-selecting the same flow: skip reset/defaults to preserve panel fields
  if (flowId === currentFlowId) return;

  currentFlowId = flowId;
  cachedPRs = null;
  cachedIssues = null;

  // Dissolve downstream cards before applying new flow (D505)
  resetDownstream('flow');

  // Apply defaults to state (DM-DEF-03) — coalesces with above via RAF
  applyFlowDefaults(flowId, flowDef);

  // Update flow button selection (direct children only, not scope buttons)
  const buttons = elBody.querySelectorAll(':scope > .btn-select');
  for (const btn of buttons) {
    const isSelected = btn.dataset.flowId === flowId;
    btn.classList.toggle('btn-select--selected', isSelected);
    btn.setAttribute('aria-selected', String(isSelected));
  }

  // Update card-meta with flow name (D204)
  updateTaskCardMeta(flowDef.label);

  // Render dual panels for this flow
  renderDualPanels(flowId, flowDef);

  // Prefetch PRs/issues this flow needs (GL-05)
  if (requiresPRs(flowDef)) prefetchPRs();
  if (requiresIssues(flowDef)) prefetchIssues();

  // D605: Disclosure controller manages expand/collapse and focus transitions
}

// --- Dual panel rendering ---

function renderDualPanels(flowId, flowDef) {
  elPanelArea.innerHTML = '';
  fieldElements.clear();
  elScopeSelector = null;
  elLensPillGroup = null;
  lastLensStatePath = null;
  lastTaskLensSnapshot = '';

  // Panel A — Situation (nested <details> card, D112)
  const panelA = document.createElement('details');
  panelA.className = 'card';
  panelA.dataset.panel = 'situation';
  panelA.open = true;

  const panelAHeader = renderPanelHeader(
    'Situation',
    flowDef.panel_a.subtitle || ''
  );
  panelA.appendChild(panelAHeader);

  const panelABody = document.createElement('div');
  panelABody.className = 'card-body';
  renderPanelFields(panelABody, flowDef.panel_a.fields, 'panel_a');
  panelA.appendChild(panelABody);

  // Panel B — Target (nested <details> card, D112)
  const panelB = document.createElement('details');
  panelB.className = 'card';
  panelB.dataset.panel = 'target';
  panelB.open = false; // D605: starts collapsed, disclosure controller manages open state

  const panelBHeader = renderPanelHeader(
    'Target',
    flowDef.panel_b.subtitle || ''
  );
  panelB.appendChild(panelBHeader);

  const panelBBody = document.createElement('div');
  panelBBody.className = 'card-body';
  renderPanelFields(panelBBody, flowDef.panel_b.fields, 'panel_b');
  panelB.appendChild(panelBBody);

  elPanelArea.appendChild(panelA);
  elPanelArea.appendChild(panelB);

  // Improve/Modify scope selector (SCT-09, shown when 2+ files)
  if (flowId === 'improve') {
    elScopeSelector = renderScopeSelector();
    elPanelArea.appendChild(elScopeSelector);
    updateScopeSelector();
  }

  // D401/D402: Initial validation state
  updateFieldValidation();
}

function renderPanelHeader(genericLabel, flowSubtitle) {
  // D113: <summary> — native <details> handles toggle, no click handler needed
  const header = document.createElement('summary');
  header.className = 'card-header';

  const titleSpan = document.createElement('span');
  titleSpan.textContent = genericLabel;
  if (flowSubtitle) {
    const subtitle = document.createElement('small');
    subtitle.textContent = ` · ${flowSubtitle}`;
    titleSpan.appendChild(subtitle);
  }
  header.appendChild(titleSpan);

  const chevron = icon('chevron-down', 'icon-btn');
  chevron.classList.add('icon--chevron');
  header.appendChild(chevron);

  return header;
}

function renderPanelFields(panelEl, fieldsMap, panelKey) {
  if (!fieldsMap) return;

  for (const [fieldName, fieldDef] of Object.entries(fieldsMap)) {
    const fieldRow = document.createElement('div');
    fieldRow.className = 'input';

    // Label
    const labelText = fieldDef.label || fieldNameToLabel(fieldName);
    const label = createLabel(labelText, { required: !!fieldDef.required });

    fieldRow.appendChild(label);

    // Field widget
    renderFieldWidget(fieldRow, fieldName, fieldDef, panelKey);

    panelEl.appendChild(fieldRow);
  }
}

// --- Field widget renderers ---

function renderFieldWidget(container, fieldName, fieldDef, panelKey) {
  const statePath = `${panelKey}.${fieldName}`;
  const state = getState();
  const currentValue = getValueByPath(state, statePath);

  switch (fieldDef.type) {
    case 'text':
      renderTextField(container, fieldDef, statePath, currentValue);
      break;

    case 'issue_picker':
      renderPickerField(container, fieldDef, statePath, 'issue', currentValue);
      break;

    case 'pr_picker':
      renderPickerField(container, fieldDef, statePath, 'pr', currentValue);
      break;

    case 'file_picker_multi':
      renderFilePicker(
        container,
        fieldDef,
        fieldName,
        statePath,
        currentValue || []
      );
      break;

    case 'lens_picker':
      renderLensPicker(container, statePath, currentValue || []);
      break;

    default:
      break;
  }
}

function renderTextField(container, fieldDef, statePath, currentValue) {
  const textarea = createInputField({
    type: 'textarea',
    placeholder: fieldDef.placeholder || '',
    value: currentValue || '',
    rows: 3,
    onInput: (e) => {
      setState(statePath, e.target.value);
      updateFieldValidation();
    },
  });

  // D401: Add required for native validation
  if (fieldDef.required || fieldDef.required_group) {
    textarea.required = true;
  }

  // D401/D402: Store reference for group validation management
  fieldElements.set(statePath, { el: textarea, type: 'text', fieldDef });

  container.appendChild(textarea);
}

function renderPickerField(container, fieldDef, statePath, kind, currentValue) {
  const pickerWrapper = document.createElement('div');
  pickerWrapper.className = 'field-picker';

  // Show current selection if any
  if (currentValue) {
    renderPickerSelection(pickerWrapper, currentValue, statePath, kind);
  } else {
    renderPickerDropdown(pickerWrapper, fieldDef, statePath, kind);
  }

  container.appendChild(pickerWrapper);

  // D402: Store reference for group validation
  if (fieldDef.required_group) {
    fieldElements.set(statePath, {
      el: pickerWrapper,
      type: 'picker',
      fieldDef,
    });
  }
}

function renderPickerDropdown(pickerWrapper, fieldDef, statePath, kind) {
  pickerWrapper.innerHTML = '';

  // Shimmer while loading
  const items = kind === 'pr' ? cachedPRs : cachedIssues;
  const isLoading = kind === 'pr' ? isLoadingPRs : isLoadingIssues;

  if (isLoading) {
    renderShimmer(
      pickerWrapper,
      `Loading ${kind === 'pr' ? 'pull requests' : 'issues'}…`,
      2
    );
    return;
  }

  if (!items) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = `No ${kind === 'pr' ? 'PRs' : 'issues'} loaded yet.`;
    pickerWrapper.appendChild(empty);
    return;
  }

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = `No open ${kind === 'pr' ? 'pull requests' : 'issues'} found.`;
    pickerWrapper.appendChild(empty);
    return;
  }

  const pickerIconName = kind === 'pr' ? 'git-pull-request' : 'issue-opened';
  const placeholder =
    fieldDef.placeholder || `Select ${kind === 'pr' ? 'PR' : 'issue'}`;

  const pickerItems = items.map(({ number, title }) => ({
    value: number,
    label: `#${number} — ${title}`,
  }));

  const picker = createPicker({
    items: pickerItems,
    placeholder,
    searchIconName: pickerIconName,
    onSelect: (item) => {
      setState(statePath, item.value);
      renderPickerSelection(
        pickerWrapper,
        item.value,
        statePath,
        kind,
        item.label
      );
      updateFieldValidation();
    },
  });

  pickerWrapper.appendChild(picker);
}

function renderPickerSelection(
  pickerWrapper,
  value,
  statePath,
  kind,
  labelText
) {
  pickerWrapper.innerHTML = '';

  const iconName = kind === 'pr' ? 'git-pull-request' : 'issue-opened';
  const tag = createTag({
    label: labelText || `#${value}`,
    iconName,
    onRemove: () => {
      setState(statePath, null);
      updateFieldValidation();
      const fieldDef = { placeholder: '' };
      renderPickerDropdown(pickerWrapper, fieldDef, statePath, kind);
    },
  });

  pickerWrapper.appendChild(tag);
}

function renderFilePicker(
  container,
  fieldDef,
  fieldName,
  statePath,
  currentSelected
) {
  const files = getFileTree();

  createFilePicker(container, {
    files,
    selected: currentSelected,
    placeholder: fieldDef.placeholder || 'Search files…',
    onChange: (selectedPaths) => {
      setState(statePath, selectedPaths);
      updateFieldValidation();
      // Show/hide scope selector if improve flow + panel_a.files
      if (currentFlowId === 'improve' && statePath === 'panel_a.files') {
        updateScopeSelector();
      }
    },
  });

  // D402: Store reference for group validation
  if (fieldDef.required_group) {
    const pickerEl = container.querySelector('.field-picker');
    if (pickerEl) {
      fieldElements.set(statePath, { el: pickerEl, type: 'picker', fieldDef });
    }
  }
}

function renderLensPicker(container, statePath, currentLenses) {
  const cloud = document.createElement('div');
  cloud.className = 'cloud';
  container.appendChild(cloud);

  elLensPillGroup = cloud;
  lastLensStatePath = statePath;
  lastTaskLensSnapshot = JSON.stringify(currentLenses);

  for (const lens of ALL_LENSES) {
    const isOn = currentLenses.includes(lens);
    const pill = createButton('pill', {
      label: lens.replace(/_/g, ' '),
      selected: isOn,
    });
    pill.setAttribute('role', 'switch');
    pill.dataset.lens = lens;

    pill.addEventListener('click', () => {
      const state = getState();
      const current = getValueByPath(state, statePath) || [];
      const newLenses = current.includes(lens)
        ? current.filter((l) => l !== lens)
        : [...current, lens];

      // Sync to all lens-enabled steps
      const updatedSteps = (state.steps?.enabled_steps || []).map((s) =>
        s.lenses !== undefined ? { ...s, lenses: newLenses } : s
      );

      setState(statePath, newLenses);
      setState('steps.enabled_steps', updatedSteps);

      // Update pill UI
      const nowOn = newLenses.includes(lens);
      pill.setAttribute('aria-checked', String(nowOn));
      pill.classList.toggle('btn-pill--on', nowOn);
    });

    cloud.appendChild(pill);
  }
}

function updateLensPillStates(activeLenses) {
  if (!elLensPillGroup) return;
  for (const pill of elLensPillGroup.querySelectorAll('[data-lens]')) {
    const isOn = activeLenses.includes(pill.dataset.lens);
    pill.setAttribute('aria-checked', String(isOn));
    pill.classList.toggle('btn-pill--on', isOn);
  }
}

// --- Improve scope selector (SCT-09) ---

function renderScopeSelector() {
  const scopeEl = document.createElement('div');
  scopeEl.className = 'input';
  scopeEl.hidden = true; // hidden until 2+ files selected

  const scopeLabel = createLabel('How should files be improved?');
  scopeEl.appendChild(scopeLabel);

  const options = [
    { value: 'each_file', label: 'Each file separately' },
    { value: 'across_files', label: 'Across files together' },
  ];

  for (const opt of options) {
    const btn = createButton('select', {
      label: opt.label,
      selected: getState().improve_scope === opt.value,
      dataset: { scope: opt.value },
      onClick: () => {
        setState('improve_scope', opt.value);
        for (const b of scopeEl.querySelectorAll('.btn-select')) {
          const isSelected = b.dataset.scope === opt.value;
          b.classList.toggle('btn-select--selected', isSelected);
          b.setAttribute('aria-selected', String(isSelected));
        }
      },
    });
    scopeEl.appendChild(btn);
  }

  return scopeEl;
}

function updateScopeSelector() {
  if (!elScopeSelector || currentFlowId !== 'improve') return;
  const state = getState();
  const fileCount = (state.panel_a?.files || []).length;
  elScopeSelector.hidden = fileCount < 2;
}

// --- D401/D402: Field validation management ---

/**
 * Toggle `required` on text inputs and `data-state` on pickers
 * based on required_group satisfaction.
 *
 * When a group is satisfied (at least one member has a value),
 * `required` is removed from text inputs so :invalid no longer matches.
 * When unsatisfied, `required` is added and pickers get data-state="invalid".
 */
function updateFieldValidation() {
  if (!elPanelArea) return;

  const state = getState();

  // Group fields by required_group
  const groups = new Map();
  for (const [statePath, entry] of fieldElements) {
    if (!entry.fieldDef.required_group) continue;
    const panelKey = statePath.split('.')[0];
    const groupKey = `${panelKey}.${entry.fieldDef.required_group}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push({ statePath, entry });
  }

  // Evaluate each group
  for (const [, members] of groups) {
    const isSatisfied = members.some(({ statePath }) => {
      const val = getValueByPath(state, statePath);
      if (val === null || val === undefined) return false;
      if (Array.isArray(val)) return val.length > 0;
      return String(val).trim().length > 0;
    });

    for (const { entry } of members) {
      if (entry.type === 'text') {
        entry.el.required = !isSatisfied;
      } else if (entry.type === 'picker') {
        if (isSatisfied) {
          delete entry.el.dataset.state;
        } else {
          entry.el.dataset.state = 'invalid';
        }
      }
    }
  }
}

// --- GitHub data fetching ---

function requiresPRs(flowDef) {
  if (hasFieldOfType(flowDef, 'pr_picker')) return true;
  return hasStepSource(flowDef, '.pr_number');
}

function requiresIssues(flowDef) {
  if (hasFieldOfType(flowDef, 'issue_picker')) return true;
  return hasStepSource(flowDef, '.issue_number');
}

function hasStepSource(flowDef, suffix) {
  return (
    flowDef.steps?.some((s) => {
      if (s.source?.endsWith(suffix)) return true;
      if (Array.isArray(s.sources))
        return s.sources.some((src) => src.endsWith(suffix));
      return false;
    }) ?? false
  );
}

function hasFieldOfType(flowDef, type) {
  for (const panel of [flowDef.panel_a, flowDef.panel_b]) {
    if (!panel?.fields) continue;
    for (const fieldDef of Object.values(panel.fields)) {
      if (fieldDef.type === type) return true;
    }
  }
  return false;
}

async function prefetchPRs() {
  const { owner, repo, pat } = getState().configuration;
  if (!owner || !repo || !pat) return;

  const cacheKey = `prs_${owner}_${repo}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    cachedPRs = cached;
    refreshPickerFields('pr');
    return;
  }

  isLoadingPRs = true;
  refreshPickerFields('pr');

  const result = await fetchPRs(owner, repo, pat);
  isLoadingPRs = false;

  if (!result.error) {
    cachedPRs = result.data;
    cacheSet(cacheKey, result.data);
  } else {
    cachedPRs = [];
  }
  refreshPickerFields('pr');
}

async function prefetchIssues() {
  const { owner, repo, pat } = getState().configuration;
  if (!owner || !repo || !pat) return;

  const cacheKey = `issues_${owner}_${repo}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    cachedIssues = cached;
    refreshPickerFields('issue');
    return;
  }

  isLoadingIssues = true;
  refreshPickerFields('issue');

  const result = await fetchIssues(owner, repo, pat);
  isLoadingIssues = false;

  if (!result.error) {
    cachedIssues = result.data;
    cacheSet(cacheKey, result.data);
  } else {
    cachedIssues = [];
  }
  refreshPickerFields('issue');
}

function refreshPickerFields(kind) {
  if (!elPanelArea) return;
  // Re-render picker fields that are still in shimmer/empty state
  // This is called after fetch completes; re-renders only unselected pickers
  const type = kind === 'pr' ? 'pr_picker' : 'issue_picker';
  const flowDef = getFlowById(currentFlowId);
  if (!flowDef) return;

  for (const [panelKey, panelDef] of [
    ['panel_a', flowDef.panel_a],
    ['panel_b', flowDef.panel_b],
  ]) {
    if (!panelDef?.fields) continue;
    for (const [fieldName, fieldDef] of Object.entries(panelDef.fields)) {
      if (fieldDef.type !== type) continue;

      const statePath = `${panelKey}.${fieldName}`;
      const state = getState();
      const currentValue = getValueByPath(state, statePath);
      if (currentValue) continue; // already selected

      // Find the field-picker in DOM and re-render
      const wrappers = elPanelArea.querySelectorAll('.field-picker');
      for (const pickerWrapper of wrappers) {
        // Heuristic to match the wrapper to the field
        const group = pickerWrapper.closest('.input');
        const label = group?.querySelector('label');
        if (
          label?.textContent?.startsWith(
            fieldDef.label || fieldNameToLabel(fieldName)
          )
        ) {
          renderPickerDropdown(pickerWrapper, fieldDef, statePath, kind);
        }
      }
    }
  }
}

// --- State subscription ---

function onStateChange(newState) {
  // Sync flow button selection when flow_id changes externally (e.g. resetDownstream)
  if (newState.task.flow_id !== currentFlowId) {
    currentFlowId = newState.task.flow_id || null;
    const buttons = elBody?.querySelectorAll(':scope > .btn-select');
    if (buttons) {
      for (const btn of buttons) {
        const isSelected = btn.dataset.flowId === currentFlowId;
        btn.classList.toggle('btn-select--selected', isSelected);
        btn.setAttribute('aria-selected', String(isSelected));
      }
    }
  }

  // Update scope selector visibility
  if (currentFlowId === 'improve') {
    updateScopeSelector();
  }

  // Update lens picker pill UI when panel_b.lenses changes externally (e.g. from steps card)
  if (elLensPillGroup && lastLensStatePath) {
    const currentLenses = getValueByPath(newState, lastLensStatePath) || [];
    const snap = JSON.stringify(currentLenses);
    if (snap !== lastTaskLensSnapshot) {
      lastTaskLensSnapshot = snap;
      updateLensPillStates(currentLenses);
    }
  }
}

// --- Helpers ---

function fieldNameToLabel(fieldName) {
  const labels = {
    description: 'Description',
    issue_number: 'GitHub Issue',
    pr_number: 'Pull Request',
    files: 'Files',
    spec_files: 'Spec Files',
    guideline_files: 'Guideline Files',
    acceptance_criteria: 'Acceptance Criteria',
    lenses: 'Focus Lenses',
  };
  return (
    labels[fieldName] ||
    fieldName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// --- Initialization ---

/** @returns {Array} cached issues list (empty if not yet loaded) */
export function getCachedIssues() {
  return cachedIssues || [];
}

/** @returns {Array} cached PRs list (empty if not yet loaded) */
export function getCachedPRs() {
  return cachedPRs || [];
}

export function initTasksCard() {
  elBody = document.getElementById('bd-tasks');
  if (!elBody) return;

  currentFlowId = null;
  elBody.innerHTML = '';

  renderFlowSelector();
  renderPanelArea();

  // Subscribe to state changes for reactive updates
  subscribe(onStateChange);
}
