/**
 * Quality Meter (SCT-08).
 *
 * Scores prompt completeness based on filled fields.
 * Renders a thin horizontal bar with 6 color thresholds.
 *
 * Weights from spec/hybrid-framework-design.md:
 *   PR picker: 20 | file picker: 10 | text: 10 | notes: 10 | lens picker: 5 | issue picker: 5
 *
 * Thresholds (6 levels):
 *   0–50: Poor (red) | 51–60: Minimal | 61–70: Basic | 71–80: Good | 81–90: Strong | 91–100: Excellent (green)
 */

import { subscribe, getState } from './state.js';

// --- Field weights ---

const WEIGHTS = {
  pr_picker: 20,
  file_picker_multi: 10,
  text: 10,
  notes: 10,
  lens_picker: 5,
  issue_picker: 5,
};

// --- Color thresholds (6 levels, descending order) ---

const THRESHOLDS = [
  { min: 91, color: '#4a8c6f', label: 'Excellent' },
  { min: 81, color: '#6aaa7a', label: 'Strong' },
  { min: 71, color: '#a8c042', label: 'Good' },
  { min: 61, color: '#c8a830', label: 'Basic' },
  { min: 51, color: '#d07820', label: 'Minimal' },
  { min: 0, color: '#c2553a', label: 'Poor' },
];

// --- Flow field definitions for scoring ---
// Each entry: [stateField, fieldType] where stateField is a dot-path into state

const FLOW_FIELDS = {
  fix: [
    ['panel_a.description', 'text'],
    ['panel_a.issue_number', 'issue_picker'],
    ['panel_a.files', 'file_picker_multi'],
    ['panel_b.description', 'text'],
    ['panel_b.spec_files', 'file_picker_multi'],
    ['panel_b.guideline_files', 'file_picker_multi'],
    ['notes.user_text', 'notes'],
  ],
  review: [
    ['panel_a.description', 'text'],
    ['panel_a.pr_number', 'pr_picker'],
    ['panel_a.files', 'file_picker_multi'],
    ['panel_b.lenses', 'lens_picker'],
    ['panel_b.spec_files', 'file_picker_multi'],
    ['panel_b.guideline_files', 'file_picker_multi'],
    ['notes.user_text', 'notes'],
  ],
  implement: [
    ['panel_a.description', 'text'],
    ['panel_a.files', 'file_picker_multi'],
    ['panel_b.description', 'text'],
    ['panel_b.spec_files', 'file_picker_multi'],
    ['panel_b.acceptance_criteria', 'text'],
    ['notes.user_text', 'notes'],
  ],
  improve: [
    ['panel_a.description', 'text'],
    ['panel_a.issue_number', 'issue_picker'],
    ['panel_a.files', 'file_picker_multi'],
    ['panel_b.lenses', 'lens_picker'],
    ['panel_b.description', 'text'],
    ['panel_b.issue_number', 'issue_picker'],
    ['panel_b.guideline_files', 'file_picker_multi'],
    ['notes.user_text', 'notes'],
  ],
};

// --- Helpers ---

function getValueByPath(state, path) {
  return path.split('.').reduce((obj, key) => obj?.[key], state);
}

function isFieldFilled(value, type) {
  if (value === null || value === undefined) return false;
  if (type === 'file_picker_multi' || type === 'lens_picker') {
    return Array.isArray(value) && value.length > 0;
  }
  if (type === 'issue_picker' || type === 'pr_picker') {
    return value !== null && value !== undefined && value !== 0;
  }
  return typeof value === 'string' && value.trim().length > 0;
}

// --- Public API ---

/**
 * Get total possible weight for a flow.
 * Returns 0 if flow is unknown.
 */
export function getTotalWeight(flowId) {
  const fields = FLOW_FIELDS[flowId];
  if (!fields) return 0;
  return fields.reduce((sum, [, type]) => sum + (WEIGHTS[type] || 0), 0);
}

/**
 * Calculate completeness score (0–100) for the current state.
 * Returns 0 if no flow is selected or flow is unknown.
 */
export function calculateScore(state) {
  const flowId = state?.task?.flow_id;
  const fields = FLOW_FIELDS[flowId];
  if (!fields || fields.length === 0) return 0;

  const total = getTotalWeight(flowId);
  if (total === 0) return 0;

  let filled = 0;
  for (const [path, type] of fields) {
    const value = getValueByPath(state, path);
    if (isFieldFilled(value, type)) {
      filled += WEIGHTS[type] || 0;
    }
  }

  return Math.round((filled / total) * 100);
}

/**
 * Get threshold color and label for a score (0–100).
 */
export function getThresholdColor(score) {
  for (const threshold of THRESHOLDS) {
    if (score >= threshold.min) return threshold;
  }
  return THRESHOLDS[THRESHOLDS.length - 1];
}

/**
 * Render the quality meter bar and wire it to state updates.
 *
 * @param {HTMLElement} container - element to render the meter into
 * @returns {{ update: Function }} - manual update function
 */
export function renderQualityMeter(container) {
  container.innerHTML = '';
  container.className = 'quality-meter';

  const track = document.createElement('div');
  track.className = 'quality-meter-track';
  track.setAttribute('role', 'meter');
  track.setAttribute('aria-label', 'Prompt quality');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-valuenow', '0');

  const bar = document.createElement('div');
  bar.className = 'quality-meter-bar';

  const label = document.createElement('div');
  label.className = 'quality-meter-label';

  track.appendChild(bar);
  container.appendChild(track);
  container.appendChild(label);

  function update(state) {
    const score = calculateScore(state);
    const { color, label: labelText } = getThresholdColor(score);
    bar.style.width = `${score}%`;
    bar.style.backgroundColor = color;
    track.setAttribute('aria-valuenow', String(score));
    track.setAttribute('aria-valuetext', `${score}% — ${labelText}`);
    label.textContent = score > 0 ? labelText : '';
    label.style.color = color;
  }

  // Initialize with current state
  update(getState());

  // Subscribe to future state changes
  const unsubscribe = subscribe((state) => update(state));

  return { update, unsubscribe };
}
