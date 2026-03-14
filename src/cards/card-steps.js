/**
 * Card 3: Steps
 *
 * Auto-generated step list from flow + panel inputs.
 * Users can toggle lenses, delete any step, and provide optional text.
 *
 * Req IDs: STP-01..04
 */

import { getState, setState, subscribe } from "../core/state.js";
import { getFlowById, ALL_LENSES } from "../logic/flow-loader.js";
import { generateSteps, reconcileSteps } from "../logic/step-generator.js";
import { fileIconName } from "../common/icons.js";
import { getFileTree, renderFlowSelector } from "./card-configuration.js";
import { getCachedIssues, getCachedPRs } from "./card-tasks.js";
import {
  createButton,
  createPicker,
  createTag,
  createInputField,
  createMoreLess,
  setInteracting,
} from "../common/ui.js";

// Show first 7 lenses. Rest behind "more" button.
const INITIAL_LENS_COUNT = 7;

// Output mode labels
const OUTPUT_LABELS = {
  here: "Here (in chat)",
  pr_comment: "PR comment",
  pr_inline_comments: "PR inline comments",
  issue_comment: "Issue comment",
  report_file: "Report file",
};

const OUTPUT_SHORT_LABELS = {
  here: "Here",
  pr_comment: "PR Com",
  pr_inline_comments: "Inline",
  issue_comment: "Issue",
  report_file: "File",
};

const OUTPUT_ICON_MAP = {
  here: "comment",
  pr_comment: "git-pull-request",
  pr_inline_comments: "comment-discussion",
  issue_comment: "issue-opened",
  report_file: "file",
};

// --- Module-level state ---

let elBody = null;
let previousStepSnapshot = "";
let elStepsMeta = null;

// Lens expanded state — persists across re-renders; resets on flow switch
const expandedSteps = new Map();

// --- Generic step labels ---

const STEP_LABELS = {
  context: "Context",
  read: "Read",
  analyze: "Analyze",
  plan: "Plan",
  implement: "Implement",
  test: "Test",
  commit: "Commit",
  report: "Report",
};

// --- Step label formatting ---

function formatStepLabel(step) {
  // Use generic label if available, fall back to operation:object
  const label = STEP_LABELS[step.id];
  if (label) {
    if (step.id === "context" && step.params?.file) {
      return `${label}: @${step.params.file}`;
    }
    if (step.id === "read") {
      const count =
        (step.params?.files?.length || 0) +
        (step.params?.issues?.length || 0) +
        (step.params?.pr_number ? 1 : 0);
      if (count > 0) return `${label}: ${count} source${count > 1 ? "s" : ""}`;
    }
    return label;
  }

  const op = step.operation.charAt(0).toUpperCase() + step.operation.slice(1);
  const obj = step.object.replace(/_/g, " ");

  if (step.params?.file) {
    return `${op}: @${step.params.file}`;
  }

  if (step.params?.files?.length > 0) {
    const n = step.params.files.length;
    return `${op}: ${n} file${n > 1 ? "s" : ""}`;
  }

  return `${op}: ${obj}`;
}

function getOptionalTextPlaceholder(step) {
  if (step.branch_name !== undefined) return "Branch name (optional)";
  if (step.pr_name !== undefined) return "PR title (optional)";
  if (step.file_name !== undefined) return "File name (optional)";
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

function renderStep0(state) {
  const { include_repo, include_pat } = state.configuration || {};
  const repoOn = include_repo !== false;
  const patOn = include_pat !== false;

  const li = document.createElement("li");
  li.className = "output output-field";
  li.dataset.stepId = "step-0";

  const label = document.createElement("span");
  label.textContent = "Context";
  li.appendChild(label);

  const cloud = document.createElement("div");
  cloud.className = "cloud";

  const repoBtn = createButton("pill", {
    label: "Repository",
    selected: repoOn,
    ariaLabel: repoOn
      ? "Repository included in prompt"
      : "Repository excluded from prompt",
    onClick: () => onToggleIncludeRepo(),
  });
  repoBtn.setAttribute("role", "checkbox");
  repoBtn.setAttribute("aria-checked", String(repoOn));
  cloud.appendChild(repoBtn);

  const patBtn = createButton("pill", {
    label: "PAT token",
    selected: patOn,
    ariaLabel: patOn ? "PAT included in prompt" : "PAT excluded from prompt",
    onClick: () => onToggleIncludePat(),
  });
  patBtn.setAttribute("role", "checkbox");
  patBtn.setAttribute("aria-checked", String(patOn));
  cloud.appendChild(patBtn);

  li.appendChild(cloud);

  const deleteBtn = createButton("icon", {
    iconName: "trash",
    iconClass: "icon-remove",
    title: "Remove context step",
    ariaLabel: "Remove context step",
    onClick: () => onRemoveStep0(),
  });
  li.appendChild(deleteBtn);

  return li;
}

function renderStepList() {
  if (!elBody) return;

  const state = getState();
  const { enabled_steps: steps = [], removed_step_ids: removedIds = [] } =
    state.steps || {};
  const { include_repo, include_pat } = state.configuration || {};

  const stepSnapshot = JSON.stringify({
    steps,
    removedIds,
    include_repo,
    include_pat,
  });
  if (stepSnapshot === previousStepSnapshot) return;
  previousStepSnapshot = stepSnapshot;

  // Update card-meta with step count (D204)
  if (elStepsMeta) {
    elStepsMeta.textContent =
      steps.length > 0
        ? `${steps.length} step${steps.length !== 1 ? "s" : ""}`
        : "";
  }

  elBody.innerHTML = "";

  if (steps.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Select a flow to generate steps.";
    elBody.appendChild(empty);
    return;
  }

  const list = document.createElement("ol");
  list.className = "output-block";
  list.setAttribute("role", "list");

  // Prepend Step 0 (context toggles) unless user removed it
  if (!removedIds.includes("step-0")) {
    list.appendChild(renderStep0(state));
  }

  steps.forEach((step, index) => {
    list.appendChild(renderStepRow(step, index));
  });

  elBody.appendChild(list);
}

function renderStepRow(step, index) {
  const li = document.createElement("li");
  li.className = "output output-field";
  li.dataset.stepId = step.id;

  // Col 2 (col 1 is the CSS counter ::before): Label
  const label = document.createElement("span");
  label.textContent = formatStepLabel(step);
  li.appendChild(label);

  // Cols 3–4: Sub-items placed directly in the grid
  const sources = step.sources || (step.source ? [step.source] : []);

  // PR picker
  if (sources.some((s) => s.endsWith(".pr_number"))) {
    renderStepPRPicker(li, step, index);
  }

  // File picker
  if (
    (sources.some((s) => s.endsWith(".files")) && step.params) ||
    step.has_file_picker
  ) {
    renderStepFilePicker(li, step, index);
  }

  // Issue picker
  if (
    sources.some((s) => s.endsWith(".issue_number")) ||
    step.has_issue_picker
  ) {
    renderStepIssuePicker(li, step, index);
  }

  // File pills — legacy display for steps without a dedicated file picker
  const hasFilePicker =
    sources.some((s) => s.endsWith(".files")) || step.has_file_picker;
  if (!hasFilePicker && step.params?.files?.length > 0) {
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

  // Col 5: Delete button
  const deleteBtn = createButton("icon", {
    iconName: "trash",
    iconClass: "icon-remove",
    title: "Remove step",
    ariaLabel: `Remove step: ${formatStepLabel(step)}`,
    onClick: () => onDeleteStep(step.id),
  });
  li.appendChild(deleteBtn);

  return li;
}

function renderFilePills(step) {
  const container = document.createElement("div");
  container.className = "cloud";

  for (const filePath of step.params.files) {
    const segments = filePath.split("/");
    const tag = createTag({
      label: "@" + segments[segments.length - 1],
      iconName: fileIconName(filePath),
      title: filePath,
      textClass: "truncate-start",
      onRemove: () => onRemoveFileFromStep(step, filePath),
    });
    container.appendChild(tag);
  }

  return container;
}

function renderStepFilePicker(li, step, index) {
  const files = getFileTree();
  const allPaths = files
    .map((f) => (typeof f === "string" ? f : f.path))
    .filter(Boolean)
    .sort();
  const selected = step.params.files || [];

  const picker = createPicker({
    items: allPaths.map((p) => ({ value: p, label: p, title: p })),
    selected,
    placeholder: "Search files…",
    searchIconName: "file",
    multiSelect: true,
    iconFn: (val) => fileIconName(val),
    tagLabelFn: (val) => val.split("/").pop(),
    tagTextClass: "truncate-start",
    onSelect: (item) => onUpdateStepFiles(index, [...selected, item.value]),
    onRemove: (value) =>
      onUpdateStepFiles(
        index,
        selected.filter((v) => v !== value),
      ),
  });

  li.appendChild(picker);
}

function renderStepPRPicker(li, step, index) {
  const prs = getCachedPRs();
  const pickerItems = prs.map(({ number, title }) => ({
    value: number,
    label: `#${number} — ${title}`,
  }));

  const selected =
    step.params?.pr_number !== null && step.params?.pr_number !== undefined
      ? [step.params.pr_number]
      : [];

  const picker = createPicker({
    items: pickerItems,
    selected,
    placeholder: "Search pull requests…",
    searchIconName: "git-pull-request",
    multiSelect: true,
    tagTextClass: "truncate-end",
    onSelect: (item) => onUpdateStepPR(index, item.value),
    onRemove: () => onUpdateStepPR(index, null),
  });

  li.appendChild(picker);
}

function renderStepIssuePicker(li, step, index) {
  const issues = getCachedIssues();
  const pickerItems = issues.map(({ number, title }) => ({
    value: number,
    label: `#${number} — ${title}`,
  }));

  const picker = createPicker({
    items: pickerItems,
    selected: step.params?.issues || [],
    placeholder: "Search issues…",
    searchIconName: "issue-opened",
    multiSelect: true,
    tagTextClass: "truncate-end",
    onSelect: (item) =>
      onUpdateStepIssues(index, [...(step.params?.issues || []), item.value]),
    onRemove: (value) =>
      onUpdateStepIssues(
        index,
        (step.params?.issues || []).filter((v) => v !== value),
      ),
  });

  li.appendChild(picker);
}

function renderOptionalTextRow(step, index) {
  return createInputField({
    placeholder: getOptionalTextPlaceholder(step),
    value: step.name_provided || "",
    onInput: (e) => onOptionalTextChange(index, e.target.value),
  });
}

function renderOutputIcons(step, index) {
  const cloud = document.createElement("div");
  cloud.className = "cloud";

  const selected =
    step.outputs_selected ||
    (step.output_selected ? [step.output_selected] : [step.output[0]]);

  for (const mode of step.output) {
    const isOn = selected.includes(mode);
    const btn = createButton("pill", {
      label: OUTPUT_SHORT_LABELS[mode] || mode,
      iconName: OUTPUT_ICON_MAP[mode] || "comment",
      selected: isOn,
      ariaLabel: OUTPUT_LABELS[mode] || mode,
      onClick: () => onSelectOutput(index, mode, btn),
    });
    btn.setAttribute("role", "checkbox");
    cloud.appendChild(btn);
  }

  return cloud;
}

function renderStepLenses(step, stepIndex) {
  const container = document.createElement("div");
  container.className = "cloud";

  const activeLenses = step.lenses || [];
  const initial = ALL_LENSES.slice(0, INITIAL_LENS_COUNT);
  const remainder = ALL_LENSES.slice(INITIAL_LENS_COUNT);

  // Primary lenses
  for (const lens of initial) {
    container.appendChild(createLensPill(lens, activeLenses, stepIndex));
  }

  // "More" button for remaining lenses
  if (remainder.length > 0) {
    const activeRemainder = remainder.filter((l) => activeLenses.includes(l));
    const isExpanded = expandedSteps.get(step.id) || false;

    const extraPills = [];
    for (const lens of remainder) {
      const pill = createLensPill(lens, activeLenses, stepIndex);
      pill.hidden = !isExpanded;
      extraPills.push(pill);
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
        for (const pill of extraPills) {
          pill.hidden = !nowExpanded;
        }
      },
    });

    container.appendChild(moreBtn);
    for (const pill of extraPills) {
      container.appendChild(pill);
    }
  }

  return container;
}

function createLensPill(lens, activeLenses, stepIndex) {
  const isOn = activeLenses.includes(lens);
  return createButton("pill", {
    label: lens.replace(/_/g, " "),
    selected: isOn,
    onClick: () => onToggleLens(stepIndex, lens),
  });
}

// --- Event handlers ---

function updateStepParam(stepIndex, paramKey, value, state) {
  const currentState = state || getState();
  const steps = (currentState.steps.enabled_steps || []).map((s) => ({ ...s }));
  if (stepIndex < 0 || stepIndex >= steps.length) return;
  steps[stepIndex] = {
    ...steps[stepIndex],
    params: { ...(steps[stepIndex].params || {}), [paramKey]: value },
  };
  setState("steps.enabled_steps", steps);
}

function onRemoveStep0() {
  const state = getState();
  const removedIds = [...(state.steps.removed_step_ids || []), "step-0"];
  setState((current) => ({
    steps: { ...current.steps, removed_step_ids: removedIds },
    configuration: {
      ...current.configuration,
      include_repo: false,
      include_pat: false,
    },
  }));
}

function onToggleIncludeRepo() {
  const state = getState();
  setState(
    "configuration.include_repo",
    state.configuration.include_repo === false ? true : false,
  );
}

function onToggleIncludePat() {
  const state = getState();
  setState(
    "configuration.include_pat",
    state.configuration.include_pat === false ? true : false,
  );
}

function onDeleteStep(stepId) {
  const state = getState();
  const removedIds = [...(state.steps.removed_step_ids || []), stepId];
  const newSteps = (state.steps.enabled_steps || []).filter(
    (s) => s.id !== stepId,
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
  const state = getState();
  const idx = (state.steps.enabled_steps || []).findIndex(
    (s) => s.id === step.id,
  );
  if (idx === -1) return;
  const currentFiles = state.steps.enabled_steps[idx].params?.files || [];
  updateStepParam(
    idx,
    "files",
    currentFiles.filter((f) => f !== filePath),
  );
}

function onUpdateStepFiles(stepIndex, files) {
  updateStepParam(stepIndex, "files", files);
}

function onUpdateStepPR(stepIndex, prNumber) {
  updateStepParam(stepIndex, "pr_number", prNumber);
}

function onUpdateStepIssues(stepIndex, issues) {
  updateStepParam(stepIndex, "issues", issues);
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

  setState("steps.enabled_steps", steps);

  // Sync to task card lens picker if this flow uses one (panel_b.lenses)
  if (state.panel_b?.lenses !== undefined) {
    setState("panel_b.lenses", newLenses);
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
  setState("steps.enabled_steps", steps);

  // Update button state visually
  const isNowOn = newSelected.includes(mode);
  btn.setAttribute("aria-checked", String(isNowOn));
  btn.classList.toggle("btn-pill--on", isNowOn);

}

function onOptionalTextChange(stepIndex, value) {
  const state = getState();
  const steps = (state.steps.enabled_steps || []).map((s) => ({ ...s }));
  if (stepIndex < 0 || stepIndex >= steps.length) return;
  steps[stepIndex] = { ...steps[stepIndex], name_provided: value || undefined };
  setState("steps.enabled_steps", steps);
}

// --- Step regeneration on panel changes ---

let lastFlowId = "";
let lastPanelASnapshot = "";
let lastPanelBSnapshot = "";

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
    snapshot.steps.removed_step_ids,
  );

  const currentJson = JSON.stringify(snapshot.steps.enabled_steps);
  const newJson = JSON.stringify(reconciled);
  if (currentJson !== newJson) {
    setState("steps.enabled_steps", reconciled);
  }
}

// --- State subscription ---

function onStateChange(snapshot) {
  regenerateIfNeeded(snapshot);
  renderStepList();
}

// --- Initialization ---

export function initStepsCard() {
  elBody = document.getElementById("bd-steps");
  if (!elBody) return;

  // Add tab-style layout class to card
  document.getElementById("card-steps").classList.add("card-tabs");

  // Remove card-meta (step count no longer shown in header)
  const metaEl = document.querySelector("#card-steps .card-meta");
  if (metaEl) metaEl.remove();
  elStepsMeta = null;

  // Render flow selector buttons in the card header (before chevron)
  const header = document.querySelector("#card-steps .card-header");
  const chevron = header?.querySelector(".icon--chevron");
  if (header) renderFlowSelector(header, chevron);

  previousStepSnapshot = "";
  expandedSteps.clear();

  renderStepList();
  subscribe(onStateChange);
}
