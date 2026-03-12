/**
 * Disclosure Controller (D605) – Simplified Behavior
 *
 * Manages expand/collapse and visual state of all cards/panels.
 * State machine per card: LOCKED → ACTIVE → COMPLETE.
 *
 * - LOCKED:   Cannot be opened; prerequisite missing.
 * - ACTIVE:   Interactive, can be opened (expands when entering ACTIVE).
 * - COMPLETE: Data entered, card collapses and cannot be reopened.
 *
 * The UI may still show dimmed/hint states via CSS based on data,
 * but the core state machine is now linear and predictable.
 *
 * Usage: call `initDisclosureController()` once after DOM is ready.
 */

import { getState, subscribe, getValueByPath } from '../core/state.js';
import { getFlowById } from './flow-loader.js';

// --- Constants ---
const CARD_IDS = [
  'card-configuration',
  'card-tasks',
  'card-steps',
  'card-prompt',
];

// --- Interaction flags (only used to unlock steps/prompt) ---
let stepsInteracted = false;
let targetInteracted = false; // still used for target field enabling

// --- Previous states (for transition detection) ---
let prevStates = {};

// --- Value helpers ---
const hasValue = (val) =>
  val != null &&
  (!Array.isArray(val) || val.length > 0) &&
  (typeof val !== 'string' || val.trim() !== '');

const fieldHasValue = (state, path) => hasValue(getValueByPath(state, path));

const panelHasAnyValue = (state, panelKey, panelDef) =>
  panelDef?.fields
    ? Object.keys(panelDef.fields).some((fName) =>
        hasValue(getValueByPath(state, `${panelKey}.${fName}`))
      )
    : false;

// --- Sufficiency rules (simplified but still flow‑aware) ---
function situationSufficient(state, flowId, flowDef) {
  if (!flowId || !flowDef) return false;
  switch (flowId) {
    case 'fix':
    case 'review':
      // required_group a_required must have at least one value
      return groupHasValue(state, 'panel_a', 'a_required', flowDef.panel_a);
    default:
      // implement/improve always sufficient (no required fields in situation)
      return true;
  }
}

function targetSufficient(state, flowId, flowDef) {
  if (!flowId || !flowDef) return false;
  switch (flowId) {
    case 'fix':
      return panelHasAnyValue(state, 'panel_b', flowDef.panel_b);
    case 'review':
      // Review needs either interaction or a user‑provided file
      return targetInteracted ||
             fieldHasValue(state, 'panel_b.spec_files') ||
             fieldHasValue(state, 'panel_b.guideline_files');
    case 'implement':
      return fieldHasValue(state, 'panel_b.description') ||
             panelHasAnyValue(state, 'panel_b', flowDef.panel_b);
    case 'improve':
      return panelHasAnyValue(state, 'panel_b', flowDef.panel_b);
    default:
      return panelHasAnyValue(state, 'panel_b', flowDef.panel_b);
  }
}

function groupHasValue(state, panelKey, group, panelDef) {
  if (!panelDef?.fields) return true;
  const groupFields = Object.entries(panelDef.fields)
    .filter(([, def]) => def.required_group === group)
    .map(([name]) => name);
  if (groupFields.length === 0) return true;
  return groupFields.some((fName) =>
    hasValue(getValueByPath(state, `${panelKey}.${fName}`))
  );
}

// --- Compute card states (only 'locked' | 'active' | 'complete') ---
function computeCardStates() {
  const state = getState();
  const { pat, owner, repo, branch } = state.configuration;
  const coreReady = !!(pat && owner && repo);
  const flowId = state.task?.flow_id;
  const flowDef = flowId ? getFlowById(flowId) : null;
  const flowSelected = !!flowId;

  // Sufficiency of panels (needed for steps/prompt unlocking)
  const sitDone = situationSufficient(state, flowId, flowDef);
  const tgtDone = targetSufficient(state, flowId, flowDef);
  const stepsHaveItems = (state.steps?.enabled_steps || []).length > 0;
  const promptHasValue = !!state._prompt;

  return {
    'card-configuration': (() => {
      if (!coreReady) return 'active'; // always active until core missing? Actually core missing means config is still active (needs input). So active.
      if (!flowSelected) return 'active';
      return branch ? 'complete' : 'active'; // branch set → complete, else still active
    })(),

    'card-tasks': (() => {
      if (!coreReady) return 'locked';
      if (!flowSelected) return 'active';
      // Tasks are complete only when both panels are done
      return (sitDone && tgtDone) ? 'complete' : 'active';
    })(),

    'card-steps': (() => {
      if (!flowSelected) return 'locked';
      if (!sitDone || !tgtDone) return 'locked'; // prerequisite panels not done → locked
      // Steps become active once panels are done
      if (!stepsInteracted) return 'active';
      return stepsHaveItems ? 'complete' : 'active';
    })(),

    'card-prompt': (() => {
      if (!flowSelected) return 'locked';
      if (!sitDone || !tgtDone) return 'locked';
      if (!stepsInteracted) return 'locked'; // steps not yet used
      return promptHasValue ? 'complete' : 'active';
    })(),

    // Panel states (used for styling, not for open/close logic)
    'panel-situation': (() => {
      if (!flowSelected) return 'locked';
      return sitDone ? 'complete' : 'active';
    })(),

    'panel-target': (() => {
      if (!flowSelected) return 'locked';
      return tgtDone ? 'complete' : 'active';
    })(),
  };
}

// --- DOM update (applies states and transitions) ---
function applyStates(newStates) {
  // Update main cards
  CARD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = prevStates[id];
    const next = newStates[id];
    if (prev === next) return;

    el.dataset.cardState = next;

    // Open when entering 'active' (unless previously complete? we only open on transition from non-active to active)
    const wasNotActive = prev !== 'active';
    if (next === 'active' && wasNotActive) {
      el.open = true;
    }
    // Close when entering 'complete'
    if (next === 'complete') {
      el.open = false;
    }
    // If entering 'locked', ensure closed
    if (next === 'locked') {
      el.open = false;
    }
  });

  // Update panels (only dataset, no auto open/close for panels)
  const sitEl = document.querySelector('[data-panel="situation"]');
  const tgtEl = document.querySelector('[data-panel="target"]');
  if (sitEl) sitEl.dataset.cardState = newStates['panel-situation'];
  if (tgtEl) tgtEl.dataset.cardState = newStates['panel-target'];

  // D502: Move focus to newly active card
  for (const id of CARD_IDS) {
    if (newStates[id] === 'active' && prevStates[id] !== 'active') {
      requestAnimationFrame(() => {
        document.getElementById(id)?.querySelector('summary')?.focus();
      });
      break;
    }
  }

  // D705: Guard hints (only show for cards in 'active' state with missing data)
  // We'll keep this but simplify: show hint only when card is active but prerequisite not met.
  // Actually with simplified states, steps/prompt are locked until prerequisites, so no need for hint there.
  // But we might want hints for panels? We'll keep original but adapt.
  ensureGuardHint('bd-steps', newStates['card-steps'], 'Fill in Task details to enable steps');
  ensureGuardHint('bd-prompt', newStates['card-prompt'], 'Complete steps to continue');

  // D403: Highlight first empty required field (unchanged)
  updateNextToFill();

  prevStates = { ...newStates };
}

// --- Guard hint helper (unchanged) ---
function ensureGuardHint(bodyId, cardState, message) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  let hint = body.querySelector('.guard-hint');
  if (cardState === 'active') {
    if (!hint) {
      hint = document.createElement('p');
      hint.className = 'guard-hint';
      hint.textContent = message;
      body.prepend(hint);
    }
  } else if (hint) {
    hint.remove();
  }
}

// --- D403: Next‑to‑fill highlighting (unchanged) ---
function updateNextToFill() {
  const prev = document.querySelector('[data-next-to-fill]');
  if (prev) delete prev.dataset.nextToFill;
  document.querySelectorAll('.input').forEach((row) => {
    if (
      row.querySelector('.input-field:required:invalid') ||
      row.querySelector('[data-state="invalid"]')
    ) {
      row.dataset.nextToFill = '';
    }
  });
}

// --- Event handlers ---
function onCardToggle(e) {
  const details = e.currentTarget;
  // Prevent opening if locked
  if (details.dataset.cardState === 'locked' && details.open) {
    details.open = false;
  }
}

function onStepsInteraction() {
  if (!stepsInteracted) {
    stepsInteracted = true;
    applyStates(computeCardStates());
  }
}

function onTargetInteraction() {
  if (!targetInteracted) {
    targetInteracted = true;
    applyStates(computeCardStates());
  }
}

function trackStepsInteraction() {
  const stepsCard = document.getElementById('card-steps');
  if (!stepsCard) return;
  stepsCard.addEventListener('toggle', () => stepsCard.open && onStepsInteraction());
  stepsCard.addEventListener('pointerenter', onStepsInteraction, { once: true });
}

function trackTargetInteraction() {
  const observer = new MutationObserver(() => {
    const tgtEl = document.querySelector('[data-panel="target"]');
    if (tgtEl && !tgtEl._tracked) {
      tgtEl._tracked = true;
      tgtEl.addEventListener('toggle', () => tgtEl.open && onTargetInteraction());
      tgtEl.addEventListener('pointerenter', onTargetInteraction, { once: true });
    }
  });
  observer.observe(document.getElementById('bd-tasks'), { childList: true, subtree: true });
}

// --- Initialisation ---
export function initDisclosureController() {
  trackStepsInteraction();
  trackTargetInteraction();

  CARD_IDS.forEach((id) => {
    document.getElementById(id)?.addEventListener('toggle', onCardToggle);
  });

  // Initial render
  applyStates(computeCardStates());

  // React to state changes
  subscribe(() => applyStates(computeCardStates()));

  // Reset interaction flags when flow changes
  let lastFlowId = getState().task?.flow_id || '';
  subscribe((snapshot) => {
    const newFlow = snapshot.task?.flow_id || '';
    if (newFlow !== lastFlowId) {
      lastFlowId = newFlow;
      stepsInteracted = false;
      targetInteracted = false;
    }
  });
}
