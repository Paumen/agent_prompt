/**
 * Card 2: Task
 *
 * Flow selector grid + dual-panel (Situation / Target) + quality meter.
 * Fields within each panel are driven by flows.yaml field definitions.
 *
 * Req IDs: SCT-01..09, DM-DEF-03
 */

import { getState, setState, subscribe, applyFlowDefaults } from "./state.js";
import { getFlows, getFlowById } from "./flow-loader.js";
import { getFileTree, setConfigCardSummary } from "./card-configuration.js";
import { fetchPRs, fetchIssues } from "./github-api.js";
import { cacheGet, cacheSet } from "./cache.js";
import { renderShimmer } from "./components.js";
import { createFilePicker } from "./file-tree.js";

// --- Octicon SVG paths (inline, no extra dependency) ---

const ICONS = {
  bug: `<svg aria-hidden="true" class="icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3.25 3.75A3.75 3.75 0 0 1 7 0h2a3.75 3.75 0 0 1 3.75 3.75v.25h1.5a.75.75 0 0 1 0 1.5H12.7l.43 4.73A3.751 3.751 0 0 1 15 13.75a.75.75 0 0 1-1.5 0 2.25 2.25 0 0 0-2.25-2.25h-6.5A2.25 2.25 0 0 0 2.5 13.75a.75.75 0 0 1-1.5 0A3.751 3.751 0 0 1 2.87 10.23L3.3 5.5H1.75a.75.75 0 0 1 0-1.5h1.5Zm1.5.25v.25h6.5V4a2.25 2.25 0 0 0-2.25-2.25H7A2.25 2.25 0 0 0 4.75 4ZM5.2 6 4.7 11.5h6.6L10.8 6Z"/></svg>`,
  search: `<svg aria-hidden="true" class="icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z"/></svg>`,
  plus: `<svg aria-hidden="true" class="icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/></svg>`,
  "arrow-up": `<svg aria-hidden="true" class="icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3.47 7.78a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L9 4.81v7.44a.75.75 0 0 1-1.5 0V4.81L4.53 7.78a.75.75 0 0 1-1.06 0Z"/></svg>`,
};

// Picker field icons
const ICON_PR = `<svg class="icon icon--sm" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/></svg>`;

const ICON_ISSUE = `<svg class="icon icon--sm" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/></svg>`;

const ICON_FILE = `<svg class="icon icon--sm" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg>`;

// All available lenses (from flows.yaml vocabulary)
const ALL_LENSES = [
  "semantics",
  "syntax",
  "security",
  "performance",
  "structure",
  "dependencies",
  "duplications",
  "redundancies",
  "error_handling",
  "naming_conventions",
  "test_coverage",
  "type_safety",
  "documentation_completeness",
  "accessibility",
];

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

// --- Card expand/collapse helpers ---

function expandCard(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.add("card--open");
  card.querySelector(".card-header")?.setAttribute("aria-expanded", "true");
}

function collapseCard(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.remove("card--open");
  card.querySelector(".card-header")?.setAttribute("aria-expanded", "false");
}

// --- Flow grid ---

function renderFlowSelector() {
  elFlowGrid = document.createElement("div");
  elFlowGrid.className = "btn-grid flow-grid";
  elFlowGrid.setAttribute("role", "listbox");
  elFlowGrid.setAttribute("aria-label", "Select a flow");

  const flows = getFlows();
  for (const [flowId, flowDef] of Object.entries(flows)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-grid-item flow-btn";
    btn.dataset.flowId = flowId;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", "false");

    const iconHtml = ICONS[flowDef.icon] || "";
    btn.innerHTML = `${iconHtml}<span class="flow-btn-label">${flowDef.label}</span>`;

    btn.addEventListener("click", () => onFlowSelect(flowId, flowDef));
    elFlowGrid.appendChild(btn);
  }

  elBody.appendChild(elFlowGrid);
}

// --- Panel area (rendered after flow selection) ---

function renderPanelArea() {
  elPanelArea = document.createElement("div");
  elPanelArea.className = "panel-area";
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
  const buttons = elFlowGrid.querySelectorAll(".flow-btn");
  for (const btn of buttons) {
    const isSelected = btn.dataset.flowId === flowId;
    btn.classList.toggle("item-selected", isSelected);
    btn.setAttribute("aria-selected", String(isSelected));
  }

  // Render dual panels for this flow
  renderDualPanels(flowId, flowDef);

  // Prefetch PRs/issues this flow needs (GL-05)
  if (requiresPRs(flowDef)) prefetchPRs();
  if (requiresIssues(flowDef)) prefetchIssues();

  // Expand Steps + Prompt, collapse Configuration with summary (1.8, UJ table)
  expandCard("card-steps");
  expandCard("card-prompt");
  collapseCard("card-configuration");
  const { owner, repo, branch } = getState().configuration;
  if (repo) {
    setConfigCardSummary(`${owner} / ${repo} : ${branch}`);
  }
}

// --- Dual panel rendering ---

function renderDualPanels(flowId, flowDef) {
  elPanelArea.innerHTML = "";
  elScopeSelector = null;

  const dualPanel = document.createElement("div");
  dualPanel.className = "dual-panel";

  // Panel A — Situation
  const panelA = document.createElement("div");
  panelA.className = "panel panel-a";

  const panelAHeader = renderPanelHeader(
    "Situation",
    flowDef.panel_a.subtitle || "",
  );
  panelA.appendChild(panelAHeader);
  renderPanelFields(panelA, flowDef.panel_a.fields, "panel_a");

  // Panel B — Target
  const panelB = document.createElement("div");
  panelB.className = "panel panel-b";

  const panelBHeader = renderPanelHeader(
    "Target",
    flowDef.panel_b.subtitle || "",
  );
  panelB.appendChild(panelBHeader);
  renderPanelFields(panelB, flowDef.panel_b.fields, "panel_b");

  dualPanel.appendChild(panelA);
  dualPanel.appendChild(panelB);
  elPanelArea.appendChild(dualPanel);

  // Improve/Modify scope selector (SCT-09, shown when 2+ files)
  if (flowId === "improve") {
    elScopeSelector = renderScopeSelector();
    elPanelArea.appendChild(elScopeSelector);
    updateScopeSelector();
  }

  // Required group indicators
  updateRequiredGroupIndicators();
}

function renderPanelHeader(genericLabel, flowSubtitle) {
  const header = document.createElement("div");
  header.className = "panel-header";

  const label = document.createElement("span");
  label.className = "panel-label";
  label.textContent = genericLabel;

  header.appendChild(label);

  if (flowSubtitle) {
    const sep = document.createElement("span");
    sep.className = "panel-sep";
    sep.textContent = "·";
    header.appendChild(sep);

    const subtitle = document.createElement("span");
    subtitle.className = "panel-subtitle";
    subtitle.textContent = flowSubtitle;
    header.appendChild(subtitle);
  }

  return header;
}

// Picker field icon map (2.9)
const PICKER_ICON_MAP = {
  pr_picker: ICON_PR,
  issue_picker: ICON_ISSUE,
  file_picker_multi: ICON_FILE,
};

function renderPanelFields(panelEl, fieldsMap, panelKey) {
  if (!fieldsMap) return;

  // Group fields by required_group for indicator tracking
  const requiredGroups = {};

  for (const [fieldName, fieldDef] of Object.entries(fieldsMap)) {
    if (fieldDef.required_group) {
      const gk = fieldDef.required_group;
      if (!requiredGroups[gk]) requiredGroups[gk] = [];
      requiredGroups[gk].push(fieldName);
    }
  }

  for (const [fieldName, fieldDef] of Object.entries(fieldsMap)) {
    const fieldGroup = document.createElement("div");
    fieldGroup.className = "panel-field-group";

    // Label
    const label = document.createElement("label");
    label.className = "field-label";

    const labelText = fieldDef.label || fieldNameToLabel(fieldName);

    // Picker icon prepended to label (2.9)
    const pickerIconSvg = PICKER_ICON_MAP[fieldDef.type];
    if (pickerIconSvg) {
      const ic = document.createElement("span");
      ic.className = "field-label-icon";
      ic.innerHTML = pickerIconSvg;
      label.appendChild(ic);
    }
    label.appendChild(document.createTextNode(labelText));

    // Required group indicator (SCT-05)
    if (fieldDef.required_group) {
      const indicator = document.createElement("span");
      indicator.className = "required-group-dot";
      indicator.setAttribute(
        "data-group",
        `${panelKey}.${fieldDef.required_group}`,
      );
      indicator.setAttribute("aria-hidden", "true");
      indicator.title = "At least one field in this group is required";
      label.appendChild(indicator);
    }

    if (fieldDef.required) {
      const req = document.createElement("span");
      req.className = "required";
      req.textContent = "*";
      req.setAttribute("aria-hidden", "true");
      label.appendChild(req);
    }

    fieldGroup.appendChild(label);

    // Field widget
    renderFieldWidget(fieldGroup, fieldName, fieldDef, panelKey);

    panelEl.appendChild(fieldGroup);
  }

  // Required group indicators are handled via dots on labels (tooltip on hover)
}

// --- Field widget renderers ---

function renderFieldWidget(container, fieldName, fieldDef, panelKey) {
  const statePath = `${panelKey}.${fieldName}`;
  const state = getState();
  const currentValue = getValueByPath(state, statePath);

  switch (fieldDef.type) {
    case "text":
      renderTextField(container, fieldDef, statePath, currentValue);
      break;

    case "issue_picker":
      renderPickerField(container, fieldDef, statePath, "issue", currentValue);
      break;

    case "pr_picker":
      renderPickerField(container, fieldDef, statePath, "pr", currentValue);
      break;

    case "file_picker_multi":
      renderFilePicker(
        container,
        fieldDef,
        fieldName,
        statePath,
        currentValue || [],
      );
      break;

    case "lens_picker":
      renderLensPicker(container, statePath, currentValue || []);
      break;

    default:
      break;
  }
}

function renderTextField(container, fieldDef, statePath, currentValue) {
  const textarea = document.createElement("textarea");
  textarea.className = "input-field field-textarea";
  textarea.placeholder = fieldDef.placeholder || "";
  textarea.value = currentValue || "";
  textarea.rows = 3;

  textarea.addEventListener("input", () => {
    setState(statePath, textarea.value);
    updateRequiredGroupIndicators();
  });

  container.appendChild(textarea);
}

function renderPickerField(container, fieldDef, statePath, kind, currentValue) {
  const pickerWrapper = document.createElement("div");
  pickerWrapper.className = "picker-wrapper";

  // Show current selection if any
  if (currentValue) {
    renderPickerSelection(pickerWrapper, currentValue, statePath, kind);
  } else {
    renderPickerDropdown(pickerWrapper, fieldDef, statePath, kind);
  }

  container.appendChild(pickerWrapper);
}

function renderPickerDropdown(pickerWrapper, fieldDef, statePath, kind) {
  pickerWrapper.innerHTML = "";

  // Shimmer while loading
  const items = kind === "pr" ? cachedPRs : cachedIssues;
  const isLoading = kind === "pr" ? isLoadingPRs : isLoadingIssues;

  if (isLoading) {
    renderShimmer(
      pickerWrapper,
      `Loading ${kind === "pr" ? "pull requests" : "issues"}…`,
      2,
    );
    return;
  }

  if (!items) {
    // No data yet — show a small message + try to load
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `No ${kind === "pr" ? "PRs" : "issues"} loaded yet.`;
    pickerWrapper.appendChild(empty);
    return;
  }

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `No open ${kind === "pr" ? "pull requests" : "issues"} found.`;
    pickerWrapper.appendChild(empty);
    return;
  }

  const options = items.map(({ number, title }) => ({
    value: number,
    label: `#${number} — ${title}`,
  }));

  const input = document.createElement("input");
  input.type = "text";
  input.className = "input-field dropdown-input";
  input.placeholder =
    fieldDef.placeholder || `Select ${kind === "pr" ? "PR" : "issue"}`;
  input.setAttribute("autocomplete", "off");
  input.setAttribute(
    "aria-label",
    fieldDef.placeholder || `Select ${kind === "pr" ? "PR" : "issue"}`,
  );

  const list = document.createElement("div");
  list.className = "dropdown-list";

  function renderList(filter = "") {
    list.innerHTML = "";
    const lower = filter.toLowerCase();
    const filtered = options.filter((o) =>
      o.label.toLowerCase().includes(lower),
    );

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "dropdown-empty";
      empty.textContent = "No matches";
      list.appendChild(empty);
      return;
    }

    for (const opt of filtered) {
      const item = document.createElement("div");
      item.className = "dropdown-item";
      item.textContent = opt.label;
      item.addEventListener("click", () => {
        setState(statePath, opt.value);
        renderPickerSelection(
          pickerWrapper,
          opt.value,
          statePath,
          kind,
          opt.label,
        );
        updateRequiredGroupIndicators();
        list.classList.remove("dropdown-list--open");
      });
      list.appendChild(item);
    }
  }

  input.addEventListener("focus", () => {
    renderList(input.value);
    list.classList.add("dropdown-list--open");
  });

  input.addEventListener("input", () => {
    renderList(input.value);
    list.classList.add("dropdown-list--open");
  });

  document.addEventListener("click", (e) => {
    if (!pickerWrapper.contains(e.target)) {
      list.classList.remove("dropdown-list--open");
    }
  });

  const wrapper = document.createElement("div");
  wrapper.className = "dropdown-wrapper";
  wrapper.appendChild(input);
  wrapper.appendChild(list);
  pickerWrapper.appendChild(wrapper);
}

function renderPickerSelection(
  pickerWrapper,
  value,
  statePath,
  kind,
  labelText,
) {
  pickerWrapper.innerHTML = "";

  const selRow = document.createElement("div");
  selRow.className = "picker-selected-row";

  const selLabel = document.createElement("span");
  selLabel.className = "picker-selected-value";
  selLabel.textContent = labelText || `#${value}`;

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn-icon picker-clear";
  clearBtn.setAttribute(
    "aria-label",
    `Clear ${kind === "pr" ? "PR" : "issue"} selection`,
  );
  clearBtn.textContent = "×";
  clearBtn.addEventListener("click", () => {
    setState(statePath, null);
    updateRequiredGroupIndicators();
    // Re-render dropdown
    const fieldDef = { placeholder: "" };
    renderPickerDropdown(pickerWrapper, fieldDef, statePath, kind);
  });

  selRow.appendChild(selLabel);
  selRow.appendChild(clearBtn);
  pickerWrapper.appendChild(selRow);
}

function renderFilePicker(
  container,
  fieldDef,
  fieldName,
  statePath,
  currentSelected,
) {
  const files = getFileTree();

  createFilePicker(container, {
    files,
    selected: currentSelected,
    placeholder: fieldDef.placeholder || "Search files…",
    onChange: (selectedPaths) => {
      setState(statePath, selectedPaths);
      updateRequiredGroupIndicators();
      // Show/hide scope selector if improve flow + panel_a.files
      if (currentFlowId === "improve" && statePath === "panel_a.files") {
        updateScopeSelector();
      }
    },
  });
}

function renderLensPicker(container, statePath, currentLenses) {
  const pillGroup = document.createElement("div");
  pillGroup.className = "pill-group lens-picker";

  for (const lens of ALL_LENSES) {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `pill ${currentLenses.includes(lens) ? "pill--on" : ""}`;
    pill.textContent = lens.replace(/_/g, " ");
    pill.setAttribute("role", "switch");
    const isOn = currentLenses.includes(lens);
    pill.setAttribute("aria-checked", String(isOn));

    pill.addEventListener("click", () => {
      const state = getState();
      const current = getValueByPath(state, statePath) || [];
      const newLenses = current.includes(lens)
        ? current.filter((l) => l !== lens)
        : [...current, lens];
      setState(statePath, newLenses);

      // Update pill UI
      const nowOn = newLenses.includes(lens);
      pill.setAttribute("aria-checked", String(nowOn));
      pill.classList.toggle("pill--on", nowOn);
    });

    pillGroup.appendChild(pill);
  }

  container.appendChild(pillGroup);
}

// --- Improve scope selector (SCT-09) ---

function renderScopeSelector() {
  const scopeEl = document.createElement("div");
  scopeEl.className = "scope-selector";
  scopeEl.style.display = "none"; // hidden until 2+ files selected

  const scopeLabel = document.createElement("div");
  scopeLabel.className = "field-label";
  scopeLabel.textContent = "How should files be improved?";

  const scopeOptions = document.createElement("div");
  scopeOptions.className = "btn-grid";

  const options = [
    { value: "each_file", label: "Each file separately" },
    { value: "across_files", label: "Across files together" },
  ];

  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn-grid-item scope-btn ${getState().improve_scope === opt.value ? "item-selected" : ""}`;
    btn.dataset.scope = opt.value;
    btn.textContent = opt.label;
    btn.setAttribute(
      "aria-selected",
      getState().improve_scope === opt.value ? "true" : "false",
    );

    btn.addEventListener("click", () => {
      setState("improve_scope", opt.value);
      for (const b of scopeOptions.querySelectorAll(".scope-btn")) {
        const isSelected = b.dataset.scope === opt.value;
        b.classList.toggle("item-selected", isSelected);
        b.setAttribute("aria-selected", String(isSelected));
      }
    });

    scopeOptions.appendChild(btn);
  }

  scopeEl.appendChild(scopeLabel);
  scopeEl.appendChild(scopeOptions);

  return scopeEl;
}

function updateScopeSelector() {
  if (!elScopeSelector || currentFlowId !== "improve") return;
  const state = getState();
  const fileCount = (state.panel_a?.files || []).length;
  elScopeSelector.style.display = fileCount >= 2 ? "block" : "none";
}

// --- Required group validation (SCT-05) ---

function updateRequiredGroupIndicators() {
  if (!elPanelArea) return;

  const state = getState();
  const flowDef = getFlowById(currentFlowId);
  if (!flowDef) return;

  // Collect unique group keys from dots
  const dots = elPanelArea.querySelectorAll(".required-group-dot");
  const processed = new Set();

  for (const dot of dots) {
    const groupKey = dot.dataset.group; // e.g., "panel_a.a_required"
    if (processed.has(groupKey)) {
      // Already computed — just apply the cached result
      dot.style.opacity = dot._satisfied ? "0.2" : "1";
      continue;
    }

    const panelKey = groupKey.split(".")[0];
    const groupName = groupKey.split(".").slice(1).join(".");

    const panelDef = panelKey === "panel_a" ? flowDef.panel_a : flowDef.panel_b;
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
      `.required-group-dot[data-group="${groupKey}"]`,
    );
    allGroupDots.forEach((d) => {
      d.style.opacity = isSatisfied ? "0.2" : "1";
    });
  }
}

// --- GitHub data fetching ---

function requiresPRs(flowDef) {
  return hasFieldOfType(flowDef, "pr_picker");
}

function requiresIssues(flowDef) {
  return hasFieldOfType(flowDef, "issue_picker");
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
    refreshPickerFields("pr");
    return;
  }

  isLoadingPRs = true;
  refreshPickerFields("pr");

  const result = await fetchPRs(owner, repo, pat);
  isLoadingPRs = false;

  if (!result.error) {
    cachedPRs = result.data;
    cacheSet(cacheKey, result.data);
  } else {
    cachedPRs = [];
  }
  refreshPickerFields("pr");
}

async function prefetchIssues() {
  const { owner, repo, pat } = getState().configuration;
  if (!owner || !repo || !pat) return;

  const cacheKey = `issues_${owner}_${repo}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    cachedIssues = cached;
    refreshPickerFields("issue");
    return;
  }

  isLoadingIssues = true;
  refreshPickerFields("issue");

  const result = await fetchIssues(owner, repo, pat);
  isLoadingIssues = false;

  if (!result.error) {
    cachedIssues = result.data;
    cacheSet(cacheKey, result.data);
  } else {
    cachedIssues = [];
  }
  refreshPickerFields("issue");
}

function refreshPickerFields(kind) {
  if (!elPanelArea) return;
  // Re-render picker fields that are still in shimmer/empty state
  // This is called after fetch completes; re-renders only unselected pickers
  const type = kind === "pr" ? "pr_picker" : "issue_picker";
  const flowDef = getFlowById(currentFlowId);
  if (!flowDef) return;

  for (const [panelKey, panelDef] of [
    ["panel_a", flowDef.panel_a],
    ["panel_b", flowDef.panel_b],
  ]) {
    if (!panelDef?.fields) continue;
    for (const [fieldName, fieldDef] of Object.entries(panelDef.fields)) {
      if (fieldDef.type !== type) continue;

      const statePath = `${panelKey}.${fieldName}`;
      const state = getState();
      const currentValue = getValueByPath(state, statePath);
      if (currentValue) continue; // already selected

      // Find the picker-wrapper in DOM and re-render
      const wrappers = elPanelArea.querySelectorAll(".picker-wrapper");
      for (const pickerWrapper of wrappers) {
        // Heuristic to match the wrapper to the field
        const group = pickerWrapper.closest(".panel-field-group");
        const label = group?.querySelector(".field-label");
        if (
          label?.textContent?.startsWith(
            fieldDef.label || fieldNameToLabel(fieldName),
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
  if (currentFlowId === "improve") {
    updateScopeSelector();
  }
}

// --- Helpers ---

function fieldNameToLabel(fieldName) {
  const labels = {
    description: "Description",
    issue_number: "GitHub Issue",
    pr_number: "Pull Request",
    files: "Files",
    spec_files: "Spec Files",
    guideline_files: "Guideline Files",
    acceptance_criteria: "Acceptance Criteria",
    lenses: "Focus Lenses",
  };
  return (
    labels[fieldName] ||
    fieldName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function getValueByPath(state, path) {
  return path.split(".").reduce((obj, key) => obj?.[key], state);
}

// --- Exported element getter (for testing) ---

export function getCardTasksEl() {
  return elBody;
}

// --- Initialization ---

export function initTasksCard() {
  elBody = document.getElementById("bd-tasks");
  if (!elBody) return;

  elBody.innerHTML = "";

  renderFlowSelector();
  renderPanelArea();

  // Subscribe to state changes for reactive updates
  subscribe(onStateChange);
}
