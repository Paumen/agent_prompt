/**
 * Disclosure Controller (D605)
 *
 * Single orchestration point for card AND panel state management.
 * Observes state changes and updates `data-card-state` on each
 * `<details>` element. Controls expand/collapse transitions.
 * Prevents locked cards from opening.
 *
 * State machine per card/panel:
 *   LOCKED → SKIPPABLE → ACTIVE → SUFFICIENT → COMPLETE
 *
 * Req IDs: D601–D605
 */

import { getState, subscribe, getValueByPath } from '../core/state.js';
import { getFlowById } from './flow-loader.js';

// --- Card element references ---

const CARD_IDS = [
  'card-configuration',
  'card-tasks',
  'card-steps',
  'card-prompt',
];

// --- Interaction tracking flags ---

let stepsInteracted = false;
let targetInteracted = false;

// --- Previous states (for transition detection) ---

let prevStates = {};

// --- Sufficiency helpers ---

/**
 * Check if a required_group in a panel is satisfied.
 * A group is satisfied when at least one field in the group has a value.
 */
function isGroupSatisfied(state, panelKey, groupName, panelDef) {
  if (!panelDef?.fields) return true;

  const groupFields = Object.entries(panelDef.fields)
    .filter(([, fDef]) => fDef.required_group === groupName)
    .map(([fName]) => fName);

  if (groupFields.length === 0) return true;

  return groupFields.some((fName) => {
    const val = getValueByPath(state, `${panelKey}.${fName}`);
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    return String(val).trim().length > 0;
  });
}

/**
 * Check if a panel has any field with a value.
 */
function panelHasAnyValue(state, panelKey, panelDef) {
  if (!panelDef?.fields) return false;

  for (const [fName] of Object.entries(panelDef.fields)) {
    const val = getValueByPath(state, `${panelKey}.${fName}`);
    if (val === null || val === undefined) continue;
    if (Array.isArray(val) && val.length > 0) return true;
    if (typeof val === 'string' && val.trim().length > 0) return true;
    if (typeof val === 'number') return true;
  }
  return false;
}

/**
 * Check if a specific field has a value (for required: true fields).
 */
function fieldHasValue(state, statePath) {
  const val = getValueByPath(state, statePath);
  if (val === null || val === undefined) return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'string') return val.trim().length > 0;
  return true;
}

// --- Per-flow sufficiency logic ---

/**
 * Situation (panel_a) sufficiency per flow.
 *
 * fix: either issue_number or description filled
 * review: either pr_number or files selected
 * implement: per default sufficient
 * improve: per default sufficient
 */
function isSituationSufficient(state, flowId, flowDef) {
  switch (flowId) {
    case 'fix':
    case 'review':
      return isGroupSatisfied(state, 'panel_a', 'a_required', flowDef.panel_a);
    case 'implement':
    case 'improve':
      return true;
    default:
      return isGroupSatisfied(state, 'panel_a', 'a_required', flowDef.panel_a);
  }
}

/**
 * Target (panel_b) sufficiency per flow.
 *
 * fix: at least one input field filled
 * review: per default sufficient
 * implement: at least one field filled
 * improve: at least one field filled
 */
function isTargetSufficient(state, flowId, flowDef) {
  switch (flowId) {
    case 'fix':
      return panelHasAnyValue(state, 'panel_b', flowDef.panel_b);
    case 'review':
      // AC 2.3: Review target requires user interaction or non-default data.
      // Default lenses are auto-populated, so check for spec_files or guideline_files
      // which are user-provided, or explicit target interaction.
      return (
        targetInteracted ||
        fieldHasValue(state, 'panel_b.spec_files') ||
        fieldHasValue(state, 'panel_b.guideline_files')
      );
    case 'implement': {
      const hasRequired = fieldHasValue(state, 'panel_b.description');
      return hasRequired || panelHasAnyValue(state, 'panel_b', flowDef.panel_b);
    }
    case 'improve':
      return panelHasAnyValue(state, 'panel_b', flowDef.panel_b);
    default:
      return panelHasAnyValue(state, 'panel_b', flowDef.panel_b);
  }
}

// --- Card state evaluators ---

function evaluateConfigState(state) {
  const { pat, owner, repo, branch } = state.configuration;
  const hasCoreConfig = !!(pat && owner && repo);

  if (!hasCoreConfig) return 'active';

  // AC 1.3: Config stays active (undimmed) until a flow is selected
  const flowId = state.task?.flow_id;
  if (!flowId) return 'active';

  // Config complete when username + repo + branch + flow all set
  if (branch) return 'complete';

  // AC 2.2: Config transitions to dimmed (sufficient) once flow is selected
  return 'sufficient';
}

function evaluateTaskState(state) {
  // Task requires core config (pat + owner + repo)
  const { pat, owner, repo } = state.configuration;
  const hasCoreConfig = !!(pat && owner && repo);
  if (!hasCoreConfig) {
    return 'locked';
  }

  const flowId = state.task?.flow_id;
  if (!flowId) return 'active';

  const flowDef = getFlowById(flowId);
  if (!flowDef) return 'active';

  const sitOk = isSituationSufficient(state, flowId, flowDef);
  const tgtOk = isTargetSufficient(state, flowId, flowDef);

  if (!sitOk || !tgtOk) return 'active';

  return 'sufficient';
}

// --- Panel state evaluators ---

/**
 * Situation panel:
 * - locked: visible but collapsed when task card has no flow
 * - active: expand when flow is selected
 * - sufficient: per flow rules
 */
function evaluateSituationState(state, flowId, flowDef) {
  if (!flowId || !flowDef) return 'locked';

  const sitOk = isSituationSufficient(state, flowId, flowDef);
  if (!sitOk) return 'active';

  return 'sufficient';
}

/**
 * Target panel:
 * - locked: when task card has no flow
 * - skippable: flow selected (except improve), no situation data yet
 * - active (improve): immediately on flow select
 * - skippable (other flows): expands dimmed when situation has data
 * - active: when situation sufficient, OR user interacts with target
 * - sufficient: per flow rules
 */
function evaluateTargetState(state, flowId, flowDef, sitState) {
  if (!flowId || !flowDef) return 'locked';

  // Improve flow: target is immediately active
  if (flowId === 'improve') {
    const tgtOk = isTargetSufficient(state, flowId, flowDef);
    if (!tgtOk) return 'active';
    return 'sufficient';
  }

  // Other flows: depends on situation state
  const sitSufficient = sitState === 'sufficient';

  if (sitSufficient || targetInteracted) {
    const tgtOk = isTargetSufficient(state, flowId, flowDef);
    if (!tgtOk) return 'active';
    return 'sufficient';
  }

  // Situation has some data but not sufficient: target opens but dimmed
  const sitHasData = panelHasAnyValue(state, 'panel_a', flowDef.panel_a);
  if (sitHasData) return 'skippable';

  return 'skippable';
}

/**
 * Steps card:
 * - locked: no flow selected
 * - skippable: flow set but neither panel sufficient
 * - expands when situation OR target is sufficient
 * - active when BOTH situation and target are sufficient
 */
function evaluateStepsState(state, sitState, tgtState) {
  const flowId = state.task?.flow_id;
  if (!flowId) return 'locked';

  const sitOk = sitState === 'sufficient';
  const tgtOk = tgtState === 'sufficient';

  if (!sitOk && !tgtOk) return 'skippable';

  if (sitOk && tgtOk) {
    const steps = state.steps?.enabled_steps || [];
    if (steps.length === 0) return 'active';
    if (!stepsInteracted) return 'active';
    return 'sufficient';
  }

  // One panel sufficient: card expands but not fully active
  return 'skippable';
}

/**
 * Prompt card:
 * - locked: no flow selected
 * - skippable: flow set but not both panels sufficient
 * - expands when both situation AND target sufficient
 * - active after user interacted with steps card
 */
function evaluatePromptState(state, sitState, tgtState) {
  const flowId = state.task?.flow_id;
  if (!flowId) return 'locked';

  const sitOk = sitState === 'sufficient';
  const tgtOk = tgtState === 'sufficient';

  if (!sitOk || !tgtOk) return 'skippable';

  if (!stepsInteracted) return 'skippable';

  const prompt = state._prompt || '';
  if (!prompt) return 'active';

  return 'sufficient';
}

// --- State application ---

function applyCardStates() {
  const state = getState();
  const flowId = state.task?.flow_id || '';
  const flowDef = flowId ? getFlowById(flowId) : null;

  // Evaluate all states
  const configState = evaluateConfigState(state);
  const taskState = evaluateTaskState(state);
  const sitState = evaluateSituationState(state, flowId, flowDef);
  const tgtState = evaluateTargetState(state, flowId, flowDef, sitState);
  const stepsState = evaluateStepsState(state, sitState, tgtState);
  const promptState = evaluatePromptState(state, sitState, tgtState);

  const newStates = {
    'card-configuration': configState,
    'card-tasks': taskState,
    'card-steps': stepsState,
    'card-prompt': promptState,
    'panel-situation': sitState,
    'panel-target': tgtState,
  };

  // Apply main card states + auto-expand/collapse
  applyMainCardState('card-configuration', configState);
  applyMainCardState('card-tasks', taskState);
  applyMainCardState('card-steps', stepsState);
  applyMainCardState('card-prompt', promptState);

  // Apply panel states
  const sitEl = document.querySelector('[data-panel="situation"]');
  const tgtEl = document.querySelector('[data-panel="target"]');

  applyPanelState(sitEl, 'panel-situation', sitState);
  applyPanelState(tgtEl, 'panel-target', tgtState);

  // Panel open/close transitions
  applyPanelOpenClose(sitEl, tgtEl, sitState, tgtState);

  // D502: Focus transition — move focus to the newly active card's summary
  for (const cardId of CARD_IDS) {
    const cs = newStates[cardId];
    const prev = prevStates[cardId];
    if (cs === 'active' && prev !== 'active' && prev) {
      requestAnimationFrame(() => {
        document.getElementById(cardId)?.querySelector('summary')?.focus();
      });
      break;
    }
  }

  // D705: Guard hints for skippable cards
  ensureGuardHint(
    'bd-steps',
    stepsState,
    'Complete Task details for full step generation'
  );
  ensureGuardHint('bd-prompt', promptState, 'Review Steps to continue');

  // D403: Highlight first empty required field globally
  updateNextToFill();

  prevStates = { ...newStates, _hadFlow: !!flowId };
}

function applyMainCardState(cardId, cardState) {
  const el = document.getElementById(cardId);
  if (!el) return;

  const prev = prevStates[cardId];
  if (prev === cardState) return;

  el.dataset.cardState = cardState;

  // Expand when transitioning from locked to any other state.
  // Treat undefined (initial load) as 'locked' so restored config auto-expands cards.
  const effectivePrev = prev ?? 'locked';
  if (effectivePrev === 'locked' && cardState !== 'locked') {
    el.open = true;
  }

  // Collapse on transition to locked or complete
  if (cardState === 'locked' || cardState === 'complete') {
    el.open = false;
  }
}

function applyPanelState(el, stateKey, cardState) {
  if (!el) return;
  const prev = prevStates[stateKey];
  if (prev !== cardState) {
    el.dataset.cardState = cardState;
  }
}

function applyPanelOpenClose(sitEl, tgtEl, sitState, tgtState) {
  const prevSit = prevStates['panel-situation'];
  const prevTgt = prevStates['panel-target'];

  // Situation panel: collapse when locked, expand when leaving locked
  if (sitEl) {
    if (sitState === 'locked') {
      sitEl.open = false;
    } else if (prevSit === 'locked') {
      sitEl.open = true;
    }
  }

  // Target panel: collapse when locked, expand when leaving locked
  if (tgtEl) {
    if (tgtState === 'locked') {
      tgtEl.open = false;
    } else if (prevTgt === 'locked') {
      tgtEl.open = true;
    }
  }
}

// --- D403: Next-to-fill highlighting ---

/**
 * Set `data-next-to-fill` on the .input row containing the first
 * empty required field (native inputs or invalid pickers).
 */
function updateNextToFill() {
  const prev = document.querySelector('[data-next-to-fill]');
  if (prev) delete prev.dataset.nextToFill;

  const rows = document.querySelectorAll('.input');
  for (const row of rows) {
    const emptyRequired = row.querySelector('.input-field:required:invalid');
    if (emptyRequired) {
      row.dataset.nextToFill = '';
      return;
    }
    const invalidPicker = row.querySelector('[data-state="invalid"]');
    if (invalidPicker) {
      row.dataset.nextToFill = '';
      return;
    }
  }
}

// --- Guard hint (D705) ---

function ensureGuardHint(bodyId, cardState, message) {
  const body = document.getElementById(bodyId);
  if (!body) return;

  let hint = body.querySelector('.guard-hint');
  if (cardState === 'skippable') {
    if (!hint) {
      hint = document.createElement('p');
      hint.className = 'guard-hint';
      hint.textContent = message;
      body.prepend(hint);
    }
  }
}

// --- Guard tooltip (D702, D703) ---

let guardTooltip = null;
let guardTooltipTimer = null;

function createGuardTooltip() {
  const el = document.createElement('div');
  el.className = 'guard-tooltip';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);
  return el;
}

const CARD_KEY_MAP = {
  'card-tasks': 'tasks',
  'card-steps': 'steps',
  'card-prompt': 'prompt',
};

function getGuardMessage(cardId) {
  const state = getState();
  switch (cardId) {
    case 'card-tasks': {
      const { pat, owner, repo } = state.configuration;
      const missing = [];
      if (!pat) missing.push('PAT');
      if (!owner) missing.push('owner');
      if (!repo) missing.push('repo');
      return `Set ${missing.join(', ')} in Configuration`;
    }
    case 'card-steps':
    case 'card-prompt':
      return 'Select a flow in Task';
    default:
      return 'Complete previous steps first';
  }
}

function showGuardTooltip(cardId) {
  if (!guardTooltip) guardTooltip = createGuardTooltip();

  // Remove previous anchor class
  for (const key of Object.values(CARD_KEY_MAP)) {
    guardTooltip.classList.remove(`guard-tooltip--${key}`);
  }

  guardTooltip.textContent = getGuardMessage(cardId);
  guardTooltip.classList.add(`guard-tooltip--${CARD_KEY_MAP[cardId]}`);
  guardTooltip.classList.add('guard-tooltip--visible');

  clearTimeout(guardTooltipTimer);
  guardTooltipTimer = setTimeout(hideGuardTooltip, 3000);

  document.addEventListener('pointerdown', hideGuardTooltip, { once: true });
}

function hideGuardTooltip() {
  if (!guardTooltip) return;
  guardTooltip.classList.remove('guard-tooltip--visible');
  clearTimeout(guardTooltipTimer);
}

// --- Locked card prevention ---

function onCardToggle(e) {
  const details = e.currentTarget;
  if (details.dataset.cardState === 'locked' && details.open) {
    details.open = false;
    showGuardTooltip(details.id);
  }
}

// --- Interaction tracking ---

function onStepsInteraction() {
  if (stepsInteracted) return;
  stepsInteracted = true;
  applyCardStates();
}

function onTargetInteraction() {
  if (targetInteracted) return;
  targetInteracted = true;
  applyCardStates();
}

function trackStepsInteraction(stepsCard) {
  if (!stepsCard) return;
  stepsCard.addEventListener('toggle', () => {
    if (stepsCard.open) onStepsInteraction();
  });
  stepsCard.addEventListener('pointerenter', onStepsInteraction, {
    once: true,
  });
}

/**
 * Track target panel interaction via MutationObserver,
 * since the panel is created dynamically.
 */
function setupTargetTracking() {
  const taskBody = document.getElementById('bd-tasks');
  if (!taskBody) return;

  const observer = new MutationObserver(() => {
    const tgtEl = document.querySelector('[data-panel="target"]');
    if (tgtEl && !tgtEl._trackedTarget) {
      tgtEl._trackedTarget = true;
      tgtEl.addEventListener('toggle', () => {
        if (tgtEl.open) onTargetInteraction();
      });
      tgtEl.addEventListener('pointerenter', onTargetInteraction, {
        once: true,
      });
    }
  });

  observer.observe(taskBody, { childList: true, subtree: true });
}

// --- Initialization ---

/**
 * Initialize the disclosure controller.
 * Call after all card init functions have run.
 */
export function initDisclosureController() {
  const stepsCard = document.getElementById('card-steps');

  trackStepsInteraction(stepsCard);
  setupTargetTracking();

  // Prevent locked cards from opening
  for (const cardId of CARD_IDS) {
    const el = document.getElementById(cardId);
    if (el) {
      el.addEventListener('toggle', onCardToggle);
    }
  }

  // Initial evaluation
  applyCardStates();

  // Subscribe to state changes for reactive updates
  subscribe(applyCardStates);

  // Reset interaction flags when flow changes
  let lastFlowId = getState().task?.flow_id || '';
  subscribe((snapshot) => {
    const flowId = snapshot.task?.flow_id || '';
    if (flowId !== lastFlowId) {
      lastFlowId = flowId;
      stepsInteracted = false;
      targetInteracted = false;
    }
  });
}
