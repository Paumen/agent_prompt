/**
 * JSON Schema for flows.yaml validation (build-time only).
 * Used by vite-plugin-yaml to validate flow definitions at build time.
 * Build fails with clear error on schema violation (DM-DEF-02, TST-03).
 */

const VALID_FIELD_TYPES = [
  'text',
  'file_picker_multi',
  'issue_picker',
  'pr_picker',
  'lens_picker',
];

const VALID_OPERATIONS = [
  'read',
  'create',
  'edit',
  'delete',
  'rename',
  'move',
  'merge',
  'split',
  'search',
  'scan',
  'compare',
  'analyze',
  'validate',
  'commit',
  'open',
];

const VALID_ICONS = ['bug', 'search', 'plus', 'arrow-up'];

/**
 * Validate a single field definition within a panel.
 */
function validateField(fieldName, field, flowId, panelName, errors) {
  if (!field || typeof field !== 'object') {
    errors.push(
      `Flow "${flowId}" > ${panelName} > fields > "${fieldName}": must be an object`
    );
    return;
  }

  if (!field.type || !VALID_FIELD_TYPES.includes(field.type)) {
    errors.push(
      `Flow "${flowId}" > ${panelName} > fields > "${fieldName}": invalid type "${field.type}". Must be one of: ${VALID_FIELD_TYPES.join(', ')}`
    );
  }

  // Optional field properties
  if ('placeholder' in field && typeof field.placeholder !== 'string') {
    errors.push(
      `Flow "${flowId}" > ${panelName} > fields > "${fieldName}": "placeholder" must be a string`
    );
  }
  if ('required' in field && typeof field.required !== 'boolean') {
    errors.push(
      `Flow "${flowId}" > ${panelName} > fields > "${fieldName}": "required" must be a boolean`
    );
  }
  if ('required_group' in field && typeof field.required_group !== 'string') {
    errors.push(
      `Flow "${flowId}" > ${panelName} > fields > "${fieldName}": "required_group" must be a string`
    );
  }
  if ('label' in field && typeof field.label !== 'string') {
    errors.push(
      `Flow "${flowId}" > ${panelName} > fields > "${fieldName}": "label" must be a string`
    );
  }
  if ('default' in field && !Array.isArray(field.default)) {
    errors.push(
      `Flow "${flowId}" > ${panelName} > fields > "${fieldName}": "default" must be an array`
    );
  }
}

/**
 * Validate a panel definition (panel_a or panel_b).
 */
function validatePanel(panel, flowId, panelName, errors) {
  if (!panel || typeof panel !== 'object') {
    errors.push(`Flow "${flowId}": missing or invalid "${panelName}"`);
    return;
  }

  if (!panel.label || typeof panel.label !== 'string') {
    errors.push(`Flow "${flowId}" > ${panelName}: missing "label" (string)`);
  }

  if (!panel.subtitle || typeof panel.subtitle !== 'string') {
    errors.push(`Flow "${flowId}" > ${panelName}: missing "subtitle" (string)`);
  }

  if (!panel.fields || typeof panel.fields !== 'object') {
    errors.push(`Flow "${flowId}" > ${panelName}: missing "fields" (object)`);
    return;
  }

  for (const [fieldName, field] of Object.entries(panel.fields)) {
    validateField(fieldName, field, flowId, panelName, errors);
  }
}

/**
 * Validate a single step definition.
 */
function validateStep(step, index, flowId, errors) {
  if (!step || typeof step !== 'object') {
    errors.push(`Flow "${flowId}" > steps[${index}]: must be an object`);
    return;
  }

  if (!step.id || typeof step.id !== 'string') {
    errors.push(`Flow "${flowId}" > steps[${index}]: missing "id" (string)`);
  }

  if (!step.operation || typeof step.operation !== 'string') {
    errors.push(
      `Flow "${flowId}" > steps[${index}] (${step.id || '?'}): missing "operation" (string)`
    );
  } else if (!VALID_OPERATIONS.includes(step.operation)) {
    errors.push(
      `Flow "${flowId}" > steps[${index}] (${step.id}): invalid operation "${step.operation}". Must be one of: ${VALID_OPERATIONS.join(', ')}`
    );
  }

  if (!step.object || typeof step.object !== 'string') {
    errors.push(
      `Flow "${flowId}" > steps[${index}] (${step.id || '?'}): missing "object" (string)`
    );
  }

  // Optional step properties
  if ('source' in step) {
    if (typeof step.source !== 'string') {
      errors.push(
        `Flow "${flowId}" > steps[${index}] (${step.id || '?'}): "source" must be a string`
      );
    } else if (!/^panel_[ab]\./.test(step.source)) {
      errors.push(
        `Flow "${flowId}" > steps[${index}] (${step.id || '?'}): "source" must reference panel_a or panel_b (got "${step.source}")`
      );
    }
  }

  if (
    'params' in step &&
    (typeof step.params !== 'object' || step.params === null)
  ) {
    errors.push(
      `Flow "${flowId}" > steps[${index}] (${step.id || '?'}): "params" must be an object`
    );
  }

  if ('lenses' in step) {
    const l = step.lenses;
    if (!Array.isArray(l) && (typeof l !== 'object' || l === null)) {
      errors.push(
        `Flow "${flowId}" > steps[${index}] (${step.id || '?'}): "lenses" must be an array or object`
      );
    }
  }
}

/**
 * Validate a single flow definition.
 */
function validateFlow(flowId, flow, errors) {
  if (!flow || typeof flow !== 'object') {
    errors.push(`Flow "${flowId}": must be an object`);
    return;
  }

  if (!flow.label || typeof flow.label !== 'string') {
    errors.push(`Flow "${flowId}": missing "label" (string)`);
  }

  if (!flow.icon || typeof flow.icon !== 'string') {
    errors.push(`Flow "${flowId}": missing "icon" (string)`);
  } else if (!VALID_ICONS.includes(flow.icon)) {
    errors.push(
      `Flow "${flowId}": invalid icon "${flow.icon}". Must be one of: ${VALID_ICONS.join(', ')}`
    );
  }

  validatePanel(flow.panel_a, flowId, 'panel_a', errors);
  validatePanel(flow.panel_b, flowId, 'panel_b', errors);

  // Optional multi_file block
  if ('multi_file' in flow) {
    const mf = flow.multi_file;
    if (!mf || typeof mf !== 'object') {
      errors.push(`Flow "${flowId}": "multi_file" must be an object`);
    } else if (mf.scope_selector) {
      const ss = mf.scope_selector;
      if (!ss.label || typeof ss.label !== 'string') {
        errors.push(
          `Flow "${flowId}" > multi_file > scope_selector: missing "label" (string)`
        );
      }
      if (!ss.options || typeof ss.options !== 'object') {
        errors.push(
          `Flow "${flowId}" > multi_file > scope_selector: missing "options" (object)`
        );
      }
    }
  }

  if (!flow.steps || !Array.isArray(flow.steps)) {
    errors.push(`Flow "${flowId}": missing "steps" (array)`);
  } else {
    if (flow.steps.length === 0) {
      errors.push(`Flow "${flowId}": steps array must not be empty`);
    }
    flow.steps.forEach((step, i) => validateStep(step, i, flowId, errors));
  }
}

/**
 * Validate the full flows.yaml parsed object.
 * Returns { valid: boolean, errors: string[] }.
 */
export function validateFlows(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('flows.yaml: root must be an object');
    return { valid: false, errors };
  }

  if (!data.flows || typeof data.flows !== 'object') {
    errors.push('flows.yaml: missing "flows" key at root');
    return { valid: false, errors };
  }

  const flowIds = Object.keys(data.flows);
  if (flowIds.length === 0) {
    errors.push('flows.yaml: "flows" must contain at least one flow');
    return { valid: false, errors };
  }

  for (const [flowId, flow] of Object.entries(data.flows)) {
    validateFlow(flowId, flow, errors);
  }

  return { valid: errors.length === 0, errors };
}

export { VALID_FIELD_TYPES, VALID_OPERATIONS, VALID_ICONS };
