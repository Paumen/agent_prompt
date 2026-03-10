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
 * For file-sourced steps (object === 'files' with an array source),
 * params.files is populated from the panel data so individual files can be
 * rendered as removable pills in the UI.
 *
 * @returns {Array<Object>} An array of step objects.
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

    // For file-sourced steps, initialize params.files from panel data.
    // - source ending in '.files' → per-step file picker; always init to [] or panel selection
    // - object === 'files' && operation === 'read' → spec/guideline files (read-specs etc.)
    const isFilesSource = stepDef.source?.endsWith('.files');
    const isReadFilesOp =
      stepDef.object === 'files' && stepDef.operation === 'read';
    if (isFilesSource || isReadFilesOp) {
      const [panel, field] = stepDef.source.split('.');
      const data = panel === 'panel_a' ? panelA : panelB;
      const files = data?.[field];
      step.params = {
        ...(step.params || {}),
        // For '.files' source steps: always init (empty or filled) so picker can render.
        // For read-files op (spec/guideline): only set when files available (legacy behavior).
        files: isFilesSource
          ? Array.isArray(files)
            ? [...files]
            : []
          : Array.isArray(files) && files.length > 0
            ? [...files]
            : undefined,
      };
      // Remove undefined params.files to keep object clean
      if (step.params.files === undefined) {
        delete step.params.files;
      }
    }

    // For issue-sourced steps, initialize params.issues from panel data.
    if (stepDef.source?.endsWith('.issue_number')) {
      const [panel, field] = stepDef.source.split('.');
      const data = panel === 'panel_a' ? panelA : panelB;
      const issueNumber = data?.[field];
      step.params = {
        ...(step.params || {}),
        issues: issueNumber !== null && issueNumber !== undefined ? [issueNumber] : [],
      };
    }

    steps.push(step);
  }

  return steps;
}

/**
 * Reconcile newly generated steps with current user-modified steps.
 * Preserves user lens customizations and name_provided values.
 * Respects user deletions (removedIds) — deleted steps stay deleted
 * until flow switch clears removedIds.
 *
 * Also preserves outputs_selected (array). If existing step
 * has old-format output_selected (string), migrates it to array format.
 */
export function reconcileSteps(generated, currentSteps, removedIds) {
  const currentMap = new Map((currentSteps || []).map((s) => [s.id, s]));
  const removedSet = new Set(removedIds || []);

  return generated
    .filter((step) => !removedSet.has(step.id))
    .map((step) => {
      const existing = currentMap.get(step.id);
      if (existing) {
        // Migrate output_selected (string) → outputs_selected (array)
        let outputsSelected = existing.outputs_selected;
        if (!outputsSelected && existing.output_selected) {
          outputsSelected = [existing.output_selected];
        }

        // Preserve user modifications (lens toggling, name_provided, outputs_selected,
        // and per-step file/issue selections)
        const preservedParams =
          existing.params?.files !== undefined ||
          existing.params?.issues !== undefined
            ? {
                ...(step.params || {}),
                ...(existing.params?.files !== undefined && {
                  files: existing.params.files,
                }),
                ...(existing.params?.issues !== undefined && {
                  issues: existing.params.issues,
                }),
              }
            : step.params;

        return {
          ...step,
          lenses: existing.lenses ?? step.lenses,
          name_provided: existing.name_provided,
          outputs_selected: outputsSelected,
          ...(preservedParams !== undefined && { params: preservedParams }),
        };
      }
      return step;
    });
}
