/**
 * Flow loader module (DM-DEF-02, SCT-07).
 * Imports pre-validated flow JSON (built by vite-plugin-yaml at build time).
 * Exports getFlows() and getFlowById(id) for runtime use.
 */
import flowData from '../config/flows.yaml';

const flows = flowData?.flows || {};

/**
 * Returns all flow definitions as a frozen object.
 * Keys are flow IDs (e.g., "fix", "review", "implement", "improve").
 */
export function getFlows() {
  return flows;
}

/**
 * Returns a single flow definition by ID, or null if not found.
 */
export function getFlowById(id) {
  return flows[id] || null;
}

/**
 * Returns an array of flow IDs.
 */
export function getFlowIds() {
  return Object.keys(flows);
}
