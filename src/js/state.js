import { buildPrompt } from './prompt-builder.js';

// --- Default state shape (DM canonical model) ---

const CURRENT_VERSION = '1.0';

const DEFAULT_STATE = {
  version: CURRENT_VERSION,
  configuration: {
    owner: '',
    repo: '',
    branch: '',
    pat: '',
  },
  task: {
    flow_id: '',
  },
  panel_a: {
    description: '',
    issue_number: null,
    pr_number: null,
    files: [],
  },
  panel_b: {
    description: '',
    issue_number: null,
    spec_files: [],
    guideline_files: [],
    acceptance_criteria: '',
    lenses: [],
  },
  steps: {
    enabled_steps: [],
    removed_step_ids: [],
  },
  improve_scope: null,
  notes: {
    user_text: '',
  },
  output: {
    destination: 'clipboard',
  },
};

// Keys persisted to localStorage (APP-04)
const PERSISTENT_KEYS = ['configuration.pat', 'configuration.owner'];
const STORAGE_KEY = 'agent_prompt_state';

// --- Internal state ---

let state = structuredClone(DEFAULT_STATE);
let prompt = '';
const subscribers = new Set();

// --- localStorage helpers ---

function loadPersistent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    // Guard against corruption: only hydrate known persistent fields
    if (saved && typeof saved === 'object') {
      if (typeof saved.pat === 'string') state.configuration.pat = saved.pat;
      if (typeof saved.owner === 'string')
        state.configuration.owner = saved.owner;
    }
  } catch {
    // Corrupted localStorage — ignore and use defaults
    localStorage.removeItem(STORAGE_KEY);
  }
}

function savePersistent() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        pat: state.configuration.pat,
        owner: state.configuration.owner,
      })
    );
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

// --- Safety helpers ---

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeKey(key) {
  return !DANGEROUS_KEYS.has(key);
}

// --- Path-based state access ---

function setByPath(obj, path, value) {
  const keys = path.split('.');
  if (!keys.every(isSafeKey)) return;
  const last = keys.pop();
  const target = keys.reduce((o, k) => {
    if (o[k] === null || o[k] === undefined || typeof o[k] !== 'object')
      o[k] = {};
    return o[k];
  }, obj);
  target[last] = value;
}

// --- Public API ---

/**
 * Returns a frozen snapshot of current state plus derived _prompt.
 * DM-INV-01: outputs derived only from current prompt_input.
 */
export function getState() {
  const snapshot = structuredClone(state);
  snapshot._prompt = prompt;
  return Object.freeze(snapshot);
}

/**
 * Update state and trigger prompt rebuild + subscriber notification.
 * DM-INV-02: all mutations go through here, auto-triggering rebuild.
 *
 * @param {string|Function} pathOrUpdater - dot-path string or updater fn
 * @param {*} [value] - value to set (when pathOrUpdater is a string)
 */
export function setState(pathOrUpdater, value) {
  if (typeof pathOrUpdater === 'function') {
    const updates = pathOrUpdater(structuredClone(state));
    if (updates && typeof updates === 'object') {
      Object.assign(state, deepMerge(state, updates));
    }
  } else if (typeof pathOrUpdater === 'string') {
    setByPath(state, pathOrUpdater, value);
  } else {
    return;
  }

  // Rebuild prompt (DM-INV-02)
  prompt = buildPrompt(state);

  // Persist PAT/username if changed
  if (
    typeof pathOrUpdater === 'string' &&
    PERSISTENT_KEYS.includes(pathOrUpdater)
  ) {
    savePersistent();
  } else if (typeof pathOrUpdater === 'function') {
    // Updater might change persistent fields — always save
    savePersistent();
  }

  // Notify subscribers
  const snapshot = getState();
  for (const listener of subscribers) {
    listener(snapshot);
  }
}

/**
 * Register a listener called after each setState.
 * Returns an unsubscribe function.
 */
export function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

/**
 * Clear session-scoped data, keep PAT + username (APP-04).
 * DM-DEF-03: flow switch resets steps fully.
 */
export function resetSession() {
  const { pat, owner } = state.configuration;
  state = structuredClone(DEFAULT_STATE);
  state.configuration.pat = pat;
  state.configuration.owner = owner;
  prompt = buildPrompt(state);

  const snapshot = getState();
  for (const listener of subscribers) {
    listener(snapshot);
  }
}

/**
 * Apply flow defaults to panel_a, panel_b, steps, and improve_scope (DM-DEF-03).
 * Called on flow selection — fully resets user overrides.
 */
export function applyFlowDefaults(flowId, flowDef) {
  state.task.flow_id = flowId;

  // Reset panels and steps to defaults (DM-DEF-03)
  state.panel_a = structuredClone(DEFAULT_STATE.panel_a);
  state.panel_b = structuredClone(DEFAULT_STATE.panel_b);
  state.improve_scope = null;

  // Populate enabled_steps from flow definition steps
  if (Array.isArray(flowDef?.steps)) {
    state.steps.enabled_steps = structuredClone(flowDef.steps);
  } else {
    state.steps.enabled_steps = [];
  }

  // Clear removed step tracking on flow switch
  state.steps.removed_step_ids = [];

  // Apply flow-specific default lenses to panel_b if defined
  if (flowDef?.panel_b?.fields?.lenses?.default) {
    state.panel_b.lenses = [...flowDef.panel_b.fields.lenses.default];
  }

  prompt = buildPrompt(state);

  const snapshot = getState();
  for (const listener of subscribers) {
    listener(snapshot);
  }
}

// --- Deep merge utility ---

function deepMerge(target, source) {
  const result = structuredClone(target);
  for (const key of Object.keys(source)) {
    if (!isSafeKey(key)) continue;
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = structuredClone(source[key]);
    }
  }
  return result;
}

// --- Initialization ---

loadPersistent();
prompt = buildPrompt(state);

// Expose for testing
export { DEFAULT_STATE, STORAGE_KEY, CURRENT_VERSION };
