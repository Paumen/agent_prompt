/**
 * Simplified State Management
 *
 * A minimal reactive state store with:
 * - Direct state access via getState()
 * - Path-based updates via setState('path.to.value', value)
 * - Updater function support via setState(state => newState)
 * - Subscriber notifications (batched via RAF for DOM sync)
 * - localStorage persistence for credentials
 * - Automatic prompt rebuilding
 */

import { buildPrompt } from "./prompt-builder.js";

// ============================================================================
// DEFAULT STATE
// ============================================================================

const CURRENT_VERSION = "1.0";

const DEFAULT_STATE = {
  version: CURRENT_VERSION,
  configuration: {
    owner: "",
    repo: "",
    branch: "",
    pat: "",
    include_repo: true,
    include_pat: true,
  },
  task: { flow_id: "" },
  panel_a: {
    description: "",
    issue_number: null,
    pr_number: null,
    files: [],
  },
  panel_b: {
    description: "",
    issue_number: null,
    spec_files: [],
    guideline_files: [],
    acceptance_criteria: "",
    lenses: [],
  },
  steps: {
    enabled_steps: [],
    removed_step_ids: [],
  },
  improve_scope: null,
  output: { destination: "clipboard" },
};

// ============================================================================
// INTERNALS
// ============================================================================

let state = clone(DEFAULT_STATE);
let prompt = "";
const subscribers = new Set();

// Notification batching - ensures DOM updates happen before notifications
let pendingNotify = false;

// Persistence config
const STORAGE_KEY = "agent_prompt_state";

// Downstream reset map - which state sections to reset when upstream data changes
const DOWNSTREAM_MAP = {
  pat: {
    reset: ["task", "panels", "steps"],
    cards: ["card-steps", "card-prompt"],
  },
  owner: {
    reset: ["task", "panels", "steps"],
    cards: ["card-steps", "card-prompt"],
  },
  repo: {
    reset: ["task", "panels", "steps"],
    cards: ["card-steps", "card-prompt"],
  },
  branch: { reset: [], cards: ["card-steps", "card-prompt"] },
  flow: { reset: [], cards: ["card-steps", "card-prompt"] },
};

// ============================================================================
// UTILITIES
// ============================================================================

/** Deep clone using JSON (simple and reliable for serializable data) */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Keys that could pollute prototypes - block these in path-based updates */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Check if a key is safe to use */
function isSafeKey(key) {
  return !DANGEROUS_KEYS.has(key);
}

/**
 * Get a value from an object by dot-notation path.
 * @param {object} obj - source object
 * @param {string} path - dot-notation path (e.g., 'panel_a.description')
 * @returns {*} value at path, or undefined if not found
 */
export function getValueByPath(obj, path) {
  return path.split(".").reduce((o, key) => o?.[key], obj);
}

/**
 * Set a value in an object by dot-notation path.
 * Blocks dangerous keys to prevent prototype pollution.
 * @param {object} obj - target object
 * @param {string} path - dot-notation path
 * @param {*} value - value to set
 */
function setByPath(obj, path, value) {
  const keys = path.split(".");
  if (!keys.every(isSafeKey)) return; // Block dangerous paths

  const last = keys.pop();
  const target = keys.reduce((o, k) => {
    if (o[k] === null || o[k] === undefined || typeof o[k] !== "object") {
      o[k] = {};
    }
    return o[k];
  }, obj);
  target[last] = value;
}

/** Load persisted credentials from localStorage */
function loadPersistent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === "object") {
      if (typeof saved.pat === "string") state.configuration.pat = saved.pat;
      if (typeof saved.owner === "string")
        state.configuration.owner = saved.owner;
      if (typeof saved.repo === "string") state.configuration.repo = saved.repo;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/** Save persisted credentials to localStorage */
function savePersistent() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        pat: state.configuration.pat,
        owner: state.configuration.owner,
        repo: state.configuration.repo,
      }),
    );
  } catch {
    // Storage unavailable - ignore silently
  }
}

/** Notify all subscribers with current state */
function notify() {
  const snapshot = getState();
  for (const listener of subscribers) {
    listener(snapshot);
  }
}

/**
 * Schedule notification - uses RAF to batch updates, falling back to sync in test env.
 * This ensures DOM rendering completes before subscribers are notified.
 */
function scheduleNotify() {
  if (pendingNotify) return;
  pendingNotify = true;

  // Use RAF for batching in browser, but fallback to sync for tests
  if (
    typeof requestAnimationFrame === "function" &&
    typeof window !== "undefined"
  ) {
    requestAnimationFrame(() => {
      pendingNotify = false;
      notify();
    });
  } else {
    // Test environment - use queueMicrotask for async behavior without RAF
    queueMicrotask(() => {
      pendingNotify = false;
      notify();
    });
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get current state snapshot with derived _prompt.
 * Returns a frozen copy to prevent direct mutation.
 */
export function getState() {
  const snapshot = clone(state);
  snapshot._prompt = prompt;
  return Object.freeze(snapshot);
}

/**
 * Update state and notify subscribers.
 *
 * @param {string|Function} pathOrUpdater - dot-path string or updater function
 * @param {*} [value] - value to set (when pathOrUpdater is a string)
 *
 * Examples:
 *   setState('panel_a.description', 'Fix the bug')
 *   setState(state => ({ ...state, improve_scope: 'each_file' }))
 */
export function setState(pathOrUpdater, value) {
  if (typeof pathOrUpdater === "string") {
    setByPath(state, pathOrUpdater, value);
    // Persist if changing a persistent field
    if (
      [
        "configuration.pat",
        "configuration.owner",
        "configuration.repo",
      ].includes(pathOrUpdater)
    ) {
      savePersistent();
    }
  } else if (typeof pathOrUpdater === "function") {
    const updates = pathOrUpdater(state);
    if (updates && typeof updates === "object") {
      // Filter out dangerous keys from updater result
      for (const key of Object.keys(updates)) {
        if (isSafeKey(key)) {
          state[key] = updates[key];
        }
      }
    }
    savePersistent(); // Updater might change persistent fields
  } else {
    return;
  }

  // Rebuild prompt and schedule notification
  prompt = buildPrompt(state);
  scheduleNotify();
}

/**
 * Subscribe to state changes.
 * @param {Function} listener - called with state snapshot on changes
 * @returns {Function} unsubscribe function
 */
export function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

/**
 * Reset session state, keeping persistent credentials.
 */
export function resetSession() {
  const { pat, owner } = state.configuration;
  state = clone(DEFAULT_STATE);
  state.configuration.pat = pat;
  state.configuration.owner = owner;
  prompt = buildPrompt(state);
  scheduleNotify();
}

/**
 * Apply flow defaults when selecting a new flow.
 * Resets panels and steps to defaults, then applies flow-specific settings.
 */
export function applyFlowDefaults(flowId, flowDef) {
  state.task.flow_id = flowId;
  state.panel_a = clone(DEFAULT_STATE.panel_a);
  state.panel_b = clone(DEFAULT_STATE.panel_b);
  state.improve_scope = null;
  state.steps.enabled_steps = Array.isArray(flowDef?.steps)
    ? clone(flowDef.steps)
    : [];
  state.steps.removed_step_ids = [];

  // Apply flow-specific default lenses
  if (flowDef?.panel_b?.fields?.lenses?.default) {
    state.panel_b.lenses = [...flowDef.panel_b.fields.lenses.default];
  }

  prompt = buildPrompt(state);
  scheduleNotify();
}

/**
 * Reset downstream state when upstream data changes.
 * Marks affected cards as locked.
 *
 * @param {'pat'|'owner'|'repo'|'branch'|'flow'} from - trigger source
 * @returns {string[]} IDs of affected card elements
 */
export function resetDownstream(from) {
  const target = DOWNSTREAM_MAP[from];
  if (!target) return [];

  // Reset state sections
  if (target.reset.includes("task")) {
    state.task = clone(DEFAULT_STATE.task);
  }
  if (target.reset.includes("panels")) {
    state.panel_a = clone(DEFAULT_STATE.panel_a);
    state.panel_b = clone(DEFAULT_STATE.panel_b);
  }
  if (target.reset.includes("steps")) {
    state.steps = clone(DEFAULT_STATE.steps);
    state.improve_scope = null;
  }

  prompt = buildPrompt(state);

  // Mark affected cards as locked
  for (const cardId of target.cards) {
    const el = document.getElementById(cardId);
    if (el) el.dataset.cardState = "locked";
  }

  scheduleNotify();
  return target.cards;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

loadPersistent();
prompt = buildPrompt(state);

// Expose for testing
export { DEFAULT_STATE, STORAGE_KEY, CURRENT_VERSION };
