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
  getValueByPath,
} from './state.js';
import { getFlows, getFlowById, ALL_LENSES } from './flow-loader.js';
import { getFileTree, setConfigCardSummary } from './card-configuration.js';
import { fetchPRs, fetchIssues } from './github-api.js';
import { cacheGet, cacheSet } from './cache.js';
import { renderShimmer, expandCard, collapseCard } from './components.js';
import { createFilePicker } from './file-tree.js';
import {
  createButton,
  createInputField,
  createLabel,
  createPicker,
  createTag,
} from './ui.js';

// --- Module-level state ---

let elBody = null;
let elFlowGrid = null;
let elPanelArea = null;
let currentFlowId = null;

// Cached PR/issue data
let cachedPRs = null;
let cachedIssues = null;
let isLoadingPRs = false;
let isLoadingIssues = false;

// Scope selector element (for show/hide)
let elScopeSelector = null;

// --- Flow grid ---

function renderFlowSelector() {
  elFlowGrid = document.createElement('div');
  elFlowGrid.className = 'wrapper';
  elFlowGrid.setAttribute('role', 'listbox');
  elFlowGrid.setAttribute('aria-label', 'Select a flow');

  const flows = getFlows();
  for (const [flowId, flowDef] of Object.entries(flows)) {
    const btn = createButton('select', {
      label: flowDef.label,
      iconName: flowDef.icon || undefined,
      onClick: () => onFlowSelect(flowId, flowDef),
      dataset: { flowId },
    });
    btn.setAttribute('role', 'option');
    elFlowGrid.appendChild(btn);
  }

  elBody.appendChild(elFlowGrid);
}

// --- Panel area (rendered after flow selection) ---

function renderPanelArea() {
  elPanelArea = document.createElement('div');
  elPanelArea.className = 'card-body';
  elBody.appendChild(elPanelArea);
}

// --- Flow selection handler ---

function onFlowSelect(flowId, flowDef) {
  currentFlowId = flowId;
  cachedPRs = null;
  cachedIssues = null;

  // Apply defaults to state (DM-DEF-03)
  applyFlowDefaults(flowId, flowDef);

  // Update flow button selection
  const buttons = elFlowGrid.querySelectorAll('.btn-select');
  for (const btn of buttons) {
    const isSelected = btn.dataset.flowId === flowId;
    btn.classList.toggle('btn-select--selected', isSelected);
    btn.setAttribute('aria-selected', String(isSelected));
  }

  // Render dual panels for this flow
  renderDualPanels(flowId, flowDef);

  // Prefetch PRs/issues this flow needs (GL-05)
  if (requiresPRs(flowDef)) prefetchPRs();
  if (requiresIssues(flowDef)) prefetchIssues();

  // Expand Steps + Prompt, collapse Configuration with summary (1.8, UJ table)
  expandCard('card-steps');
  expandCard('card-prompt');
  collapseCard('card-configuration');
  const { owner, repo, branch } = getState().configuration;
  if (repo) {
    setConfigCardSummary(`${owner} / ${repo} : ${branch}`);
  }
}

// --- Dual panel rendering ---

function renderDualPanels(flowId, flowDef) {
  elPanelArea.innerHTML = '';
  elScopeSelector = null;

  // Panel A — Situation (card-in-card)
  const panelA = document.createElement('div');
  panelA.className = 'card-in-card card-in-card--open';

  const panelAHeader = renderPanelHeader(
    'Situation',
    flowDef.panel_a.subtitle || ''
  );
  panelA.appendChild(panelAHeader);
  renderPanelFields(panelA, flowDef.panel_a.fields, 'panel_a');

  // Panel B — Target (card-in-card)
  const panelB = document.createElement('div');
  panelB.className = 'card-in-card card-in-card--open';

  const panelBHeader = renderPanelHeader(
    'Target',
    flowDef.panel_b.subtitle || ''
  );
  panelB.appendChild(panelBHeader);
  renderPanelFields(panelB, flowDef.panel_b.fields, 'panel_b');

  elPanelArea.appendChild(panelA);
  elPanelArea.appendChild(panelB);

  // Improve/Modify scope selector (SCT-09, shown when 2+ files)
  if (flowId === 'improve') {
    elScopeSelector = renderScopeSelector();
    elPanelArea.appendChild(elScopeSelector);
    updateScopeSelector();
  }

  // Required group indicators
  updateRequiredGroupIndicators();
}

function renderPanelHeader(genericLabel, flowSubtitle) {
  const header = document.createElement('div');
  header.className = 'card-title';

  const label = document.createElement('span');
  label.textContent = genericLabel;
  header.appendChild(label);

  if (flowSubtitle) {
    const subtitle = document.createElement('small');
    subtitle.textContent = `· ${flowSubtitle}`;
    header.appendChild(subtitle);
  }

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

    // Required group indicator (SCT-05)
    if (fieldDef.required_group) {
      const indicator = document.createElement('span');
      indicator.className = 'required-group-dot';
      indicator.setAttribute(
        'data-group',
        `${panelKey}.${fieldDef.required_group}`
      );
      indicator.setAttribute('aria-hidden', 'true');
      indicator.title = 'At least one field in this group is required';
      label.appendChild(indicator);
    }

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
      updateRequiredGroupIndicators();
    },
  });

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
      updateRequiredGroupIndicators();
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
      updateRequiredGroupIndicators();
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
      updateRequiredGroupIndicators();
      // Show/hide scope selector if improve flow + panel_a.files
      if (currentFlowId === 'improve' && statePath === 'panel_a.files') {
        updateScopeSelector();
      }
    },
  });
}

function renderLensPicker(container, statePath, currentLenses) {
  const pillGroup = document.createElement('div');
  pillGroup.className = 'wrapper';

  for (const lens of ALL_LENSES) {
    const isOn = currentLenses.includes(lens);
    const pill = createButton('pill', {
      label: lens.replace(/_/g, ' '),
      selected: isOn,
    });
    pill.setAttribute('role', 'switch');

    pill.addEventListener('click', () => {
      const state = getState();
      const current = getValueByPath(state, statePath) || [];
      const newLenses = current.includes(lens)
        ? current.filter((l) => l !== lens)
        : [...current, lens];
      setState(statePath, newLenses);

      // Update pill UI
      const nowOn = newLenses.includes(lens);
      pill.setAttribute('aria-checked', String(nowOn));
      pill.classList.toggle('btn-pill--on', nowOn);
    });

    pillGroup.appendChild(pill);
  }

  container.appendChild(pillGroup);
}

// --- Improve scope selector (SCT-09) ---

function renderScopeSelector() {
  const scopeEl = document.createElement('div');
  scopeEl.className = 'input';
  scopeEl.hidden = true; // hidden until 2+ files selected

  const scopeLabel = createLabel('How should files be improved?');
  scopeEl.appendChild(scopeLabel);

  const scopeOptions = document.createElement('div');
  scopeOptions.className = 'wrapper';

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
        for (const b of scopeOptions.querySelectorAll('.btn-select')) {
          const isSelected = b.dataset.scope === opt.value;
          b.classList.toggle('btn-select--selected', isSelected);
          b.setAttribute('aria-selected', String(isSelected));
        }
      },
    });
    scopeOptions.appendChild(btn);
  }

  scopeEl.appendChild(scopeOptions);
  return scopeEl;
}

function updateScopeSelector() {
  if (!elScopeSelector || currentFlowId !== 'improve') return;
  const state = getState();
  const fileCount = (state.panel_a?.files || []).length;
  elScopeSelector.hidden = fileCount < 2;
}

// --- Required group validation (SCT-05) ---

function updateRequiredGroupIndicators() {
  if (!elPanelArea) return;

  const state = getState();
  const flowDef = getFlowById(currentFlowId);
  if (!flowDef) return;

  // Collect unique group keys from dots
  const dots = elPanelArea.querySelectorAll('.required-group-dot');
  const processed = new Set();

  for (const dot of dots) {
    const groupKey = dot.dataset.group; // e.g., "panel_a.a_required"
    if (processed.has(groupKey)) {
      // Already computed — just apply the cached result
      dot.style.opacity = dot._satisfied ? '0.2' : '1';
      continue;
    }

    const panelKey = groupKey.split('.')[0];
    const groupName = groupKey.split('.').slice(1).join('.');

    const panelDef = panelKey === 'panel_a' ? flowDef.panel_a : flowDef.panel_b;
    if (!panelDef?.fields) continue;

    const groupFields = Object.entries(panelDef.fields)
      .filter(([, fDef]) => fDef.required_group === groupName)
      .map(([fName]) => fName);

    const isSatisfied = groupFields.some((fName) => {
      const val = getValueByPath(state, `${panelKey}.${fName}`);
      if (val === null || val === undefined) return false;
      if (Array.isArray(val)) return val.length > 0;
      return String(val).trim().length > 0;
    });

    processed.add(groupKey);

    // Update all dots for this group
    const allGroupDots = elPanelArea.querySelectorAll(
      `.required-group-dot[data-group="${groupKey}"]`
    );
    allGroupDots.forEach((d) => {
      d.style.opacity = isSatisfied ? '0.2' : '1';
    });
  }
}

// --- GitHub data fetching ---

function requiresPRs(flowDef) {
  return hasFieldOfType(flowDef, 'pr_picker');
}

function requiresIssues(flowDef) {
  return hasFieldOfType(flowDef, 'issue_picker');
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

function onStateChange(_state) {
  // Update scope selector visibility
  if (currentFlowId === 'improve') {
    updateScopeSelector();
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

export function initTasksCard() {
  elBody = document.getElementById('bd-tasks');
  if (!elBody) return;

  elBody.innerHTML = '';

  renderFlowSelector();
  renderPanelArea();

  // Subscribe to state changes for reactive updates
  subscribe(onStateChange);
}
