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

  const parts = source.split(".");
  if (parts.length !== 2) return false;

  const [panel, field] = parts;
  const data = panel === "panel_a" ? panelA : panelB;
  const value = data?.[field];

  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return true;
  if (typeof value === "string") return value.trim() !== "";
  return false;
}

/**
 * Source types that have a dedicated in-step picker.
 * These sources always cause a step to appear regardless of panel state
 * so the user can make their selection directly in the step row.
 */
const PICKER_SOURCE_SUFFIXES = [".files", ".issue_number", ".pr_number"];

function hasStepPicker(source) {
  return PICKER_SOURCE_SUFFIXES.some((s) => source?.endsWith(s));
}

/**
 * Resolve a source reference to its panel data value.
 */
function resolveSource(source, panelA, panelB) {
  const [panel, field] = source.split(".");
  const data = panel === "panel_a" ? panelA : panelB;
  return data?.[field];
}

/**
 * Process a sources array to populate params and set picker flags on a step.
 * Handles file, issue, and PR sources, plus non-picker sources like spec_files.
 */
function processSources(step, sources, panelA, panelB) {
  const allFiles = step.params?.file ? [step.params.file] : [];
  const allIssues = [];
  let hasFilePicker = false;
  let hasIssuePicker = false;
  let prNumber = null;
  let hasPrSource = false;

  for (const src of sources) {
    const value = resolveSource(src, panelA, panelB);

    if (src.endsWith(".files")) {
      hasFilePicker = true;
      if (Array.isArray(value)) allFiles.push(...value);
    } else if (src.endsWith(".issue_number")) {
      hasIssuePicker = true;
      if (value !== null && value !== undefined) allIssues.push(value);
    } else if (src.endsWith(".pr_number")) {
      hasPrSource = true;
      prNumber = value ?? null;
    } else {
      // Non-picker source (spec_files, guideline_files) — add files if present
      if (Array.isArray(value) && value.length > 0) allFiles.push(...value);
    }
  }

  step.sources = sources;
  step.params = {
    ...(step.params || {}),
    ...(hasFilePicker || allFiles.length > 0
      ? { files: [...new Set(allFiles)] }
      : {}),
    ...(hasIssuePicker ? { issues: allIssues } : {}),
    ...(hasPrSource ? { pr_number: prNumber } : {}),
  };

  if (hasFilePicker) step.has_file_picker = true;
  if (hasIssuePicker) step.has_issue_picker = true;
}

/**
 * Generate steps from flow definition based on current panel state.
 *
 * Steps with `sources` (plural) array are processed to populate params
 * and picker flags from all referenced panel fields.
 *
 * Steps with a single `source` are handled as a one-element sources array.
 *
 * Steps without sources always appear.
 * Steps with sources appear if any source has a picker suffix or is filled.
 *
 * @returns {Array<Object>} An array of step objects.
 */
export function generateSteps(flowDef, panelA, panelB) {
  if (!flowDef?.steps) return [];

  const steps = [];

  for (const stepDef of flowDef.steps) {
    // Resolve sources: prefer plural, fall back to singular, default to empty
    const sources = stepDef.sources || (stepDef.source ? [stepDef.source] : []);

    // Conditional: skip if no sources filled and no picker sources
    if (sources.length > 0) {
      const hasPickerSource = sources.some((s) => hasStepPicker(s));
      const anyFilled = sources.some((s) => isSourceFilled(s, panelA, panelB));
      if (!hasPickerSource && !anyFilled) continue;
    }

    const step = {
      id: stepDef.id,
      operation: stepDef.operation,
      object: stepDef.object,
    };

    // Copy optional fields
    if (stepDef.lenses) step.lenses = [...stepDef.lenses];
    if (stepDef.params) step.params = { ...stepDef.params };
    if (stepDef.output) step.output = [...stepDef.output];
    if (stepDef.branch_name !== undefined)
      step.branch_name = stepDef.branch_name;
    if (stepDef.pr_name !== undefined) step.pr_name = stepDef.pr_name;
    if (stepDef.file_name !== undefined) step.file_name = stepDef.file_name;

    // Process sources for data binding and picker flags
    if (sources.length > 0) {
      processSources(step, sources, panelA, panelB);
    }

    steps.push(step);
  }

  // Merge consecutive edit + test into a single "edit" step
  return mergeEditAndTest(steps);
}

/**
 * If an "edit" step is immediately followed by a "test" step,
 * absorb test's sources/params into edit and drop test.
 */
function mergeEditAndTest(steps) {
  const result = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const next = steps[i + 1];
    if (step.id === "edit" && next?.id === "test") {
      const merged = { ...step };
      const editSources = step.sources || [];
      const testSources = next.sources || [];
      if (testSources.length > 0) {
        merged.sources = [...editSources, ...testSources];
      }
      if (next.has_file_picker) merged.has_file_picker = true;
      if (next.has_issue_picker) merged.has_issue_picker = true;
      if (next.params) {
        merged.params = { ...(step.params || {}), ...next.params };
      }
      result.push(merged);
      i++; // skip test
    } else {
      result.push(step);
    }
  }
  return result;
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
