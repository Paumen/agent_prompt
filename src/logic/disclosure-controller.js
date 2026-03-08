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
let promptInteracted = false;
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
 * Check if ALL fields in a panel have values.
 */
function panelAllFilled(state, panelKey, panelDef) {
  if (!panelDef?.fields) return true;

  for (const [fName] of Object.entries(panelDef.fields)) {
    const val = getValueByPath(state, `${panelKey}.${fName}`);
    if (val === null || val === undefined) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    if (typeof val === 'string' && val.trim().length === 0) return false;
  }
  return true;
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
      return true;
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
  if (!branch) return 'sufficient';
  return 'complete';
}

function evaluateTaskState(state, configState) {
  if (configState !== 'sufficient' && configState !== 'complete') {
    return 'locked';
  }

  const flowId = state.task?.flow_id;
  if (!flowId) return 'active';

  const flowDef = getFlowById(flowId);
  if (!flowDef) return 'active';

  const sitOk = isSituationSufficient(state, flowId, flowDef);
  const tgtOk = isTargetSufficient(state, flowId, flowDef);

  if (!sitOk || !tgtOk) return 'active';

  const allFilledA = panelAllFilled(state, 'panel_a', flowDef.panel_a);
  const allFilledB = panelAllFilled(state, 'panel_b', flowDef.panel_b);

  if (allFilledA && allFilledB) return 'complete';
  return 'sufficient';
}

// --- Panel state evaluators ---

/**
 * Situation panel:
 * - locked: visible but collapsed when task card has no flow
 * - active: expand when flow is selected
 * - sufficient/complete: per flow rules
 */
function evaluateSituationState(state, flowId, flowDef) {
  if (!flowId || !flowDef) return 'locked';

  const sitOk = isSituationSufficient(state, flowId, flowDef);
  if (!sitOk) return 'active';

  const allFilled = panelAllFilled(state, 'panel_a', flowDef.panel_a);
  if (allFilled) return 'complete';
  return 'sufficient';
}

/**
 * Target panel:
 * - locked: when task card has no flow
 * - skippable: flow selected (except improve), no situation data yet
 * - active (improve): immediately on flow select
 * - skippable (other flows): expands dimmed when situation has data
 * - active: when situation sufficient, OR user interacts with target
 * - sufficient/complete: per flow rules
 */
function evaluateTargetState(state, flowId, flowDef, sitState) {
  if (!flowId || !flowDef) return 'locked';

  // Improve flow: target is immediately active
  if (flowId === 'improve') {
    const tgtOk = isTargetSufficient(state, flowId, flowDef);
    if (!tgtOk) return 'active';
    const allFilled = panelAllFilled(state, 'panel_b', flowDef.panel_b);
    return allFilled ? 'complete' : 'sufficient';
  }

  // Other flows: depends on situation state
  const sitSufficient = sitState === 'sufficient' || sitState === 'complete';

  if (sitSufficient || targetInteracted) {
    const tgtOk = isTargetSufficient(state, flowId, flowDef);
    if (!tgtOk) return 'active';
    const allFilled = panelAllFilled(state, 'panel_b', flowDef.panel_b);
    return allFilled ? 'complete' : 'sufficient';
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

  const sitOk = sitState === 'sufficient' || sitState === 'complete';
  const tgtOk = tgtState === 'sufficient' || tgtState === 'complete';

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

  const sitOk = sitState === 'sufficient' || sitState === 'complete';
  const tgtOk = tgtState === 'sufficient' || tgtState === 'complete';

  if (!sitOk || !tgtOk) return 'skippable';

  if (!stepsInteracted) return 'skippable';

  const prompt = state._prompt || '';
  if (!prompt) return 'active';

  const hasNotes = !!state.notes?.user_text?.trim();
  if (hasNotes) return 'complete';
  return 'sufficient';
}

// --- State application ---

function applyCardStates() {
  const state = getState();
  const flowId = state.task?.flow_id || '';
  const flowDef = flowId ? getFlowById(flowId) : null;

  // Evaluate all states
  const configState = evaluateConfigState(state);
  const taskState = evaluateTaskState(state, configState);
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

  // Config: collapse when a flow is selected (task goes from active-no-flow to active-with-flow)
  const configEl = document.getElementById('card-configuration');
  if (configEl && flowId && !prevStates._hadFlow) {
    configEl.open = false;
  }

  // Steps: expand when at least one panel becomes sufficient
  const stepsEl = document.getElementById('card-steps');
  if (stepsEl) {
    const prevStepsState = prevStates['card-steps'];
    const sitOk = sitState === 'sufficient' || sitState === 'complete';
    const tgtOk = tgtState === 'sufficient' || tgtState === 'complete';
    if (
      (sitOk || tgtOk) &&
      (prevStepsState === 'locked' || prevStepsState === 'skippable')
    ) {
      stepsEl.open = true;
    }
  }

  // Prompt: expand when both panels sufficient
  const promptEl = document.getElementById('card-prompt');
  if (promptEl) {
    const prevPromptState = prevStates['card-prompt'];
    const sitOk = sitState === 'sufficient' || sitState === 'complete';
    const tgtOk = tgtState === 'sufficient' || tgtState === 'complete';
    if (
      sitOk &&
      tgtOk &&
      (prevPromptState === 'locked' || prevPromptState === 'skippable')
    ) {
      promptEl.open = true;
    }
  }

  // Apply panel states
  const sitEl = document.querySelector('[data-panel="situation"]');
  const tgtEl = document.querySelector('[data-panel="target"]');

  applyPanelState(sitEl, 'panel-situation', sitState);
  applyPanelState(tgtEl, 'panel-target', tgtState);

  // Panel open/close transitions
  applyPanelOpenClose(sitEl, tgtEl, sitState, tgtState, stepsState);

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

  prevStates = { ...newStates, _hadFlow: !!flowId };
}

function applyMainCardState(cardId, cardState) {
  const el = document.getElementById(cardId);
  if (!el) return;

  const prev = prevStates[cardId];
  if (prev === cardState) return;

  el.dataset.cardState = cardState;

  // Auto-expand on transition to active from locked/skippable
  if (
    cardState === 'active' &&
    (prev === 'locked' || prev === 'skippable' || !prev)
  ) {
    el.open = true;
  }

  // Close on transition to locked
  if (cardState === 'locked') {
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

function applyPanelOpenClose(sitEl, tgtEl, sitState, tgtState, stepsState) {
  const prevSit = prevStates['panel-situation'];
  const prevTgt = prevStates['panel-target'];
  const prevSteps = prevStates['card-steps'];

  // Situation panel
  if (sitEl) {
    if (sitState === 'locked') {
      sitEl.open = false;
    } else if (sitState === 'active' && prevSit !== 'active') {
      sitEl.open = true;
    }
    // Collapse situation when steps card becomes active
    if (
      stepsState === 'active' &&
      prevSteps !== 'active' &&
      prevSteps &&
      (sitState === 'sufficient' || sitState === 'complete')
    ) {
      sitEl.open = false;
    }
  }

  // Target panel
  if (tgtEl) {
    if (tgtState === 'locked') {
      tgtEl.open = false;
    } else if (tgtState === 'active' && prevTgt !== 'active') {
      tgtEl.open = true;
    } else if (tgtState === 'skippable' && prevTgt === 'locked') {
      tgtEl.open = false;
    }
    // Collapse target when user has interacted with prompt card
    if (
      promptInteracted &&
      (tgtState === 'sufficient' || tgtState === 'complete') &&
      tgtEl.open
    ) {
      tgtEl.open = false;
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

function onPromptInteraction() {
  if (promptInteracted) return;
  promptInteracted = true;
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

function trackPromptInteraction(promptCard) {
  if (!promptCard) return;
  promptCard.addEventListener('toggle', () => {
    if (promptCard.open) onPromptInteraction();
  });
  promptCard.addEventListener('pointerenter', onPromptInteraction, {
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
  const promptCard = document.getElementById('card-prompt');

  trackStepsInteraction(stepsCard);
  trackPromptInteraction(promptCard);
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
      promptInteracted = false;
      targetInteracted = false;
    }
  });
}
