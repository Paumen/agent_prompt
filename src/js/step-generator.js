/**
 * Step generator — produces steps from flow definition + current panel state.
 *
 * Pure functions:
 * - generateSteps(flowDef, panelA, panelB) → ordered step array
 * - reconcileSteps(generated, currentSteps, removedIds) → reconciled array
 *
 * Req IDs: STP-01, STP-02
 */

/**
 * Check if a step's source field is filled in the panel data.
 * Source format: "panel_a.field_name" or "panel_b.field_name"
 */
export function isSourceFilled(source, panelA, panelB) {
  if (!source) return true;

  const parts = source.split('.');
  if (parts.length !== 2) return false;

  const [panel, field] = parts;
  const data = panel === 'panel_a' ? panelA : panelB;
  const value = data?.[field];

  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  return false;
}

/**
 * Generate steps from flow definition based on current panel state.
 * Conditional steps (with `source` field) are only included when
 * the referenced panel field is filled (STP-02).
 *
 * Returns step objects with `locked` flag added.
 */
export function generateSteps(flowDef, panelA, panelB) {
  if (!flowDef?.steps) return [];

  const steps = [];

  for (const stepDef of flowDef.steps) {
    // Conditional step: skip if source field is not filled
    if (stepDef.source && !isSourceFilled(stepDef.source, panelA, panelB)) {
      continue;
    }

    const step = {
      id: stepDef.id,
      operation: stepDef.operation,
      object: stepDef.object,
    };

    // Copy optional fields
    if (stepDef.lenses) step.lenses = [...stepDef.lenses];
    if (stepDef.params) step.params = { ...stepDef.params };
    if (stepDef.source) step.source = stepDef.source;
    if (stepDef.output) step.output = [...stepDef.output];
    if (stepDef.branch_name !== undefined)
      step.branch_name = stepDef.branch_name;
    if (stepDef.pr_name !== undefined) step.pr_name = stepDef.pr_name;
    if (stepDef.file_name !== undefined) step.file_name = stepDef.file_name;

    steps.push(step);
  }

  return steps;
}

/**
 * Reconcile newly generated steps with current user-modified steps.
 * Preserves user lens customizations and name_provided values.
 * Respects user deletions (removedIds) — deleted steps stay deleted
 * until flow switch clears removedIds.
 */
export function reconcileSteps(generated, currentSteps, removedIds) {
  const currentMap = new Map((currentSteps || []).map((s) => [s.id, s]));
  const removedSet = new Set(removedIds || []);

  return generated
    .filter((step) => !removedSet.has(step.id))
    .map((step) => {
      const existing = currentMap.get(step.id);
      if (existing) {
        // Preserve user modifications (lens toggling, name_provided, output_selected)
        return {
          ...step,
          lenses: existing.lenses ?? step.lenses,
          name_provided: existing.name_provided,
          output_selected: existing.output_selected,
        };
      }
      return step;
    });
}
