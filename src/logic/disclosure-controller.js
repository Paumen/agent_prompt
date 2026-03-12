/**
 * Disclosure Controller (D605) – Simplified Behavior
 *
 * Manages expand/collapse and visual state of all cards.
 * State machine per card: LOCKED → ACTIVE → COMPLETE.
 *
 * - LOCKED:   Cannot be opened; prerequisite missing.
 * - ACTIVE:   Interactive, can be opened (expands when entering ACTIVE).
 * - COMPLETE: Data entered, card collapses and cannot be reopened.
 *
 * Usage: call `initDisclosureController()` once after DOM is ready.
 */

import { getState, subscribe } from '../core/state.js';

// --- Constants ---
const CARD_IDS = ['card-configuration', 'card-steps', 'card-prompt'];

// --- Interaction flags ---
let stepsInteracted = false;

// --- Previous states (for transition detection) ---
let prevStates = {};

// --- Compute card states (only 'locked' | 'active' | 'complete') ---
function computeCardStates() {
  const state = getState();
  const { pat, owner, repo, branch } = state.configuration;
  const coreReady = !!(pat && owner && repo);
  const flowSelected = !!state.task?.flow_id;
  const stepsHaveItems = (state.steps?.enabled_steps || []).length > 0;
  const promptHasValue = !!state._prompt;

  return {
    'card-configuration': (() => {
      if (!coreReady) return 'active';
      if (!flowSelected) return 'active';
      return branch ? 'complete' : 'active';
    })(),

    'card-steps': (() => {
      if (!flowSelected) return 'locked';
      if (!stepsInteracted) return 'active';
      return stepsHaveItems ? 'active';
    })(),

    'card-prompt': (() => {
      if (!flowSelected) return 'locked';
      return promptHasValue ? 'active';
    })(),
  };
}

// --- DOM update (applies states and transitions) ---
function applyStates(newStates) {
  CARD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = prevStates[id];
    const next = newStates[id];
    if (prev === next) return;

    el.dataset.cardState = next;

    const wasNotActive = prev !== 'active';
    if (next === 'active' && wasNotActive) {
      el.open = true;
    }
    if (next === 'complete') {
      el.open = false;
    }
    if (next === 'locked') {
      el.open = false;
    }
  });

  // D502: Move focus to newly active card
  for (const id of CARD_IDS) {
    if (newStates[id] === 'active' && prevStates[id] !== 'active') {
      requestAnimationFrame(() => {
        document.getElementById(id)?.querySelector('summary')?.focus();
      });
      break;
    }
  }

  ensureGuardHint(
    'bd-steps',
    newStates['card-steps'],
    'Select a flow to enable steps'
  );

  updateNextToFill();

  prevStates = { ...newStates };
}

// --- Guard hint helper ---
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

// --- D403: Next‑to‑fill highlighting ---
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

function trackStepsInteraction() {
  const stepsCard = document.getElementById('card-steps');
  if (!stepsCard) return;
  stepsCard.addEventListener(
    'toggle',
    () => stepsCard.open && onStepsInteraction()
  );
  stepsCard.addEventListener('pointerenter', onStepsInteraction, {
    once: true,
  });
}

// --- Initialisation ---
export function initDisclosureController() {
  trackStepsInteraction();

  CARD_IDS.forEach((id) => {
    document.getElementById(id)?.addEventListener('toggle', onCardToggle);
  });

  applyStates(computeCardStates());

  // Reset interaction flag and prevStates when flow changes, then apply new states.
  let lastFlowId = getState().task?.flow_id || '';
  subscribe((snapshot) => {
    const newFlow = snapshot.task?.flow_id || '';
    if (newFlow !== lastFlowId) {
      lastFlowId = newFlow;
      stepsInteracted = false;
      // Force locked->active transition on flow change to ensure cards expand.
      prevStates['card-steps'] = 'locked';
      prevStates['card-prompt'] = 'locked';
    }
    applyStates(computeCardStates());
  });
}
