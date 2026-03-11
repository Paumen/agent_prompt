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
 * Source types that have a dedicated in-step picker.
 * These steps always appear regardless of panel state so the user
 * can make their selection directly in the step row.
 */
const PICKER_SOURCE_SUFFIXES = ['.files', '.issue_number', '.pr_number'];

function hasStepPicker(source) {
  return PICKER_SOURCE_SUFFIXES.some((s) => source?.endsWith(s));
}

/**
 * Get the merge key for a step, or null if the step is not mergeable.
 * Consecutive steps sharing the same non-null key are merged into one.
 */
function getMergeKey(step) {
  if (step.operation === 'analyze') return 'analyze';
  if (step.operation === 'create' && step.object === 'review_feedback')
    return 'create:review_feedback';
  // Read steps with dedicated pickers (always shown) can be merged.
  // Conditional read steps (spec_files, guideline_files — no picker) return null
  // and break the group, so they remain as separate steps.
  if (step.operation === 'read' && hasStepPicker(step.source)) return 'read';
  return null;
}

/**
 * Merge consecutive steps that share the same merge key into a single step.
 * The merged step uses the first step's id/operation/object, combines sources
 * into a `sources` array, merges params, unions lenses, and tracks the
 * original step IDs in `_mergedIds`.
 */
function mergeStepGroups(steps) {
  const result = [];
  let i = 0;

  while (i < steps.length) {
    const step = steps[i];
    const key = getMergeKey(step);

    if (key === null) {
      result.push(step);
      i++;
      continue;
    }

    // Gather consecutive steps with the same merge key
    const group = [step];
    while (
      i + group.length < steps.length &&
      getMergeKey(steps[i + group.length]) === key
    ) {
      group.push(steps[i + group.length]);
    }

    if (group.length === 1) {
      result.push(step);
      i++;
      continue;
    }

    // Build merged step from group
    const first = group[0];
    const sources = group.filter((s) => s.source).map((s) => s.source);
    const params = group.reduce(
      (acc, s) => ({ ...acc, ...(s.params || {}) }),
      {}
    );

    // Union lenses across all steps that define them
    const hasLenses = group.some((s) => s.lenses !== undefined);
    const lenses = hasLenses
      ? [...new Set(group.flatMap((s) => s.lenses || []))]
      : undefined;

    // Union output arrays
    const allOutputs = group.flatMap((s) => s.output || []);
    const output =
      allOutputs.length > 0 ? [...new Set(allOutputs)] : undefined;

    const merged = {
      id: first.id,
      operation: first.operation,
      object: first.object,
      _mergedIds: group.map((s) => s.id),
    };
    if (sources.length > 0) merged.sources = sources;
    if (lenses !== undefined) merged.lenses = lenses;
    if (output) merged.output = output;
    if (Object.keys(params).length > 0) merged.params = params;

    result.push(merged);
    i += group.length;
  }

  return result;
}

/**
 * Generate steps from flow definition based on current panel state.
 * Conditional steps (with `source` field) are only included when
 * the referenced panel field is filled (STP-02), UNLESS the step has
 * a dedicated in-step picker — those always appear so the user can
 * select directly in the step row without touching the task card.
 *
 * For file-sourced steps, params.files is populated from panel data.
 * For issue-sourced steps, params.issues is populated from panel data.
 * For PR-sourced steps, params.pr_number is populated from panel data.
 *
 * Consecutive steps of the same mergeable kind (analyze, review_feedback)
 * are merged into a single step with a `sources` array (STP-03).
 *
 * @returns {Array<Object>} An array of step objects.
 */
export function generateSteps(flowDef, panelA, panelB) {
  if (!flowDef?.steps) return [];

  const steps = [];

  for (const stepDef of flowDef.steps) {
    // Conditional step: skip if source field is not filled.
    // Exception: steps with a dedicated picker always appear so the user
    // can select directly in the step row.
    if (
      stepDef.source &&
      !hasStepPicker(stepDef.source) &&
      !isSourceFilled(stepDef.source, panelA, panelB)
    ) {
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
        issues:
          issueNumber !== null && issueNumber !== undefined
            ? [issueNumber]
            : [],
      };
    }

    // For PR-sourced steps, initialize params.pr_number from panel data.
    if (stepDef.source?.endsWith('.pr_number')) {
      const [panel, field] = stepDef.source.split('.');
      const data = panel === 'panel_a' ? panelA : panelB;
      const prNumber = data?.[field];
      step.params = {
        ...(step.params || {}),
        pr_number:
          prNumber !== null && prNumber !== undefined ? prNumber : null,
      };
    }

    steps.push(step);
  }

  return mergeStepGroups(steps);
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
        // and per-step file/issue/PR selections)
        const hasPerStepParams =
          existing.params?.files !== undefined ||
          existing.params?.issues !== undefined ||
          existing.params?.pr_number !== undefined;
        const preservedParams = hasPerStepParams
          ? {
              ...(step.params || {}),
              ...(existing.params?.files !== undefined && {
                files: existing.params.files,
              }),
              ...(existing.params?.issues !== undefined && {
                issues: existing.params.issues,
              }),
              ...(existing.params?.pr_number !== undefined && {
                pr_number: existing.params.pr_number,
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
