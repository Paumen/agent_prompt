/**
 * Disclosure Controller (D605)
 *
 * Single orchestration point for card state management.
 * Observes state changes and updates `data-card-state` on each
 * `<details>` card element. Prevents locked cards from opening.
 *
 * State machine per card:
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

// Track whether user has interacted with the steps card
let stepsInteracted = false;

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
      return isGroupSatisfied(state, 'panel_a', 'a_required', flowDef.panel_a);

    case 'review':
      return isGroupSatisfied(state, 'panel_a', 'a_required', flowDef.panel_a);

    case 'implement':
      return true;

    case 'improve':
      return true;

    default:
      // Unknown flow: check required groups if any, else default sufficient
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
      // panel_b.description is required: true
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

  if (!hasCoreConfig) return 'active'; // always interactive, user starts here
  if (!branch) return 'sufficient';
  return 'complete';
}

function evaluateTaskState(state, configState) {
  // Hard prerequisite: config must be sufficient (repo configured)
  if (configState !== 'sufficient' && configState !== 'complete') {
    return 'locked';
  }

  const flowId = state.task?.flow_id;
  if (!flowId) return 'active'; // config done, waiting for flow selection

  const flowDef = getFlowById(flowId);
  if (!flowDef) return 'active';

  const sitOk = isSituationSufficient(state, flowId, flowDef);
  const tgtOk = isTargetSufficient(state, flowId, flowDef);

  if (!sitOk || !tgtOk) return 'active';

  // Check if all fields in both panels are filled for complete
  const allFilledA = panelAllFilled(state, 'panel_a', flowDef.panel_a);
  const allFilledB = panelAllFilled(state, 'panel_b', flowDef.panel_b);

  if (allFilledA && allFilledB) return 'complete';
  return 'sufficient';
}

function evaluateStepsState(state, taskState) {
  const flowId = state.task?.flow_id;

  // Hard prerequisite: flow must be selected
  if (!flowId) return 'locked';

  // Skippable: flow set but task not yet sufficient
  if (taskState !== 'sufficient' && taskState !== 'complete') {
    return 'skippable';
  }

  const steps = state.steps?.enabled_steps || [];
  if (steps.length === 0) return 'active';

  // Sufficient: steps exist AND user has interacted with the card
  if (!stepsInteracted) return 'active';

  return 'sufficient';
}

function evaluatePromptState(state, stepsState) {
  const flowId = state.task?.flow_id;

  // Hard prerequisite: flow must be selected
  if (!flowId) return 'locked';

  // Skippable: flow set but steps not sufficient
  if (stepsState !== 'sufficient' && stepsState !== 'complete') {
    return 'skippable';
  }

  const prompt = state._prompt || '';
  if (!prompt) return 'active';

  const hasNotes = !!state.notes?.user_text?.trim();
  if (hasNotes) return 'complete';
  return 'sufficient';
}

// --- State application ---

function applyCardStates() {
  const state = getState();

  const configState = evaluateConfigState(state);
  const taskState = evaluateTaskState(state, configState);
  const stepsState = evaluateStepsState(state, taskState);
  const promptState = evaluatePromptState(state, stepsState);

  const states = {
    'card-configuration': configState,
    'card-tasks': taskState,
    'card-steps': stepsState,
    'card-prompt': promptState,
  };

  for (const [cardId, cardState] of Object.entries(states)) {
    const el = document.getElementById(cardId);
    if (!el) continue;

    const prev = el.dataset.cardState;
    if (prev !== cardState) {
      el.dataset.cardState = cardState;
    }
  }
}

// --- Locked card prevention ---

function onCardToggle(e) {
  const details = e.target.closest('details.card');
  if (!details) return;

  if (details.dataset.cardState === 'locked' && details.open) {
    // Prevent locked card from opening
    details.open = false;
  }
}

// --- Steps interaction tracking ---

function onStepsInteraction() {
  if (stepsInteracted) return;
  stepsInteracted = true;
  // Re-evaluate since sufficiency may change
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

// --- Initialization ---

/**
 * Initialize the disclosure controller.
 * Call after all card init functions have run.
 */
export function initDisclosureController() {
  // Track steps card interaction
  const stepsCard = document.getElementById('card-steps');
  trackStepsInteraction(stepsCard);

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

  // Reset stepsInteracted when flow changes (new steps = needs re-review)
  let lastFlowId = getState().task?.flow_id || '';
  subscribe((snapshot) => {
    const flowId = snapshot.task?.flow_id || '';
    if (flowId !== lastFlowId) {
      lastFlowId = flowId;
      stepsInteracted = false;
    }
  });
}
