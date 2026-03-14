/**
 * Pure function: prompt_input → structured XML prompt string.
 * DM-INV-03: identical input always produces identical output (deterministic).
 */
export function buildPrompt(state) {
  if (!state) return '';

  const { configuration, task, panel_a, panel_b, steps, improve_scope } = state;
  const { owner, repo, branch, pat, include_repo, include_pat } =
    configuration || {};

  const includeRepo = include_repo !== false;
  const includePat = include_pat !== false;

  // Need at minimum an owner; also require repo when include_repo is on
  if (!owner) return '';
  if (includeRepo && !repo) return '';

  const flowId = task?.flow_id || '';
  const lines = [];

  // Context section — same across all flows
  const flowLabel = FLOW_LABELS[flowId] || flowId || 'task';
  let contextLine = `  <context> <task> ${escapeXml(flowLabel)} </task> Execute the steps below`;
  if (includeRepo) {
    contextLine += ` in <repository> https://github.com/${escapeXml(owner)}/${escapeXml(repo)} </repository> branch <branch> ${escapeXml(branch || 'main')} </branch>.`;
  } else {
    contextLine += '.';
  }
  if (pat && includePat) {
    contextLine += ` PAT: <PAT> ${escapeXml(pat)} </PAT>.`;
  }
  contextLine += '  </context>';
  lines.push(contextLine);

  // Todo section — build step list
  lines.push('  <todo>');

  let stepNum = 1;
  const enabledSteps = steps?.enabled_steps || [];
  const taskStepString = buildTaskStep(flowId, panel_a, panel_b, improve_scope);

  // Insert flow-specific task step before other steps
  if (taskStepString) {
    lines.push(`    Step ${stepNum}: ${taskStepString}`);
    stepNum++;
  }

  for (let i = 0; i < enabledSteps.length; i++) {
    const step = enabledSteps[i];

    // Skip context step — no longer rendered
    if (step.id === 'context') continue;

    // Read step — single line listing all sources
    if (step.id === 'read') {
      const parts = [];
      if (step.params?.files?.length > 0) {
        parts.push(step.params.files.map((f) => `@${escapeXml(f)}`).join(', '));
      }
      if (step.params?.issues?.length > 0) {
        parts.push(
          step.params.issues
            .map((i) => `issue #${escapeXml(String(i))}`)
            .join(', ')
        );
      }
      if (step.params?.pr_number) {
        parts.push(`PR #${escapeXml(String(step.params.pr_number))}`);
      }
      if (parts.length > 0) {
        lines.push(`    Step ${stepNum}: Read ${parts.join(', ')}`);
        stepNum++;
      }
      continue;
    }

    // Commit step — includes commit, and PR opening
    if (step.id === 'commit') {
      const desc = formatCommitStep(step);
      lines.push(`    Step ${stepNum}: ${desc}`);
      stepNum++;
      // Append flow-specific feedback instruction
      const feedback = buildFeedbackStep(flowId, enabledSteps);
      if (feedback) {
        lines.push(`    Step ${stepNum}: ${feedback}`);
        stepNum++;
      }
      continue;
    }

    // Report step (review flow) — feedback with output modes
    if (step.id === 'report') {
      const feedback = buildReviewFeedback(getOutputModes(step));
      if (feedback) {
        lines.push(`    Step ${stepNum}: ${feedback}`);
        stepNum++;
      }
      continue;
    }

    const desc = formatStep(step);
    if (desc) {
      lines.push(`    Step ${stepNum}: ${desc}`);
      stepNum++;
    }
  }

  lines.push('  </todo>');

  return lines.join('\n');
}

// --- Flow labels ---

const FLOW_LABELS = {
  fix: 'Fix / Debug',
  review: 'Review / Analyze',
  implement: 'Implement / Build',
  improve: 'Improve / Modify',
};

// --- Flow-specific task step config & builder ---

/**
 * Per-flow config for building the task step.
 * Each field: { key, type, label, dot } where:
 *   type: "text" | "issue" | "pr" | "files" | "lenses"
 *   label: prefix string (default "")
 *   dot: whether to append "." (default true)
 * Panel tag: XML wrapper tag name, or null for plain indented lines.
 */
const FLOW_TASK_CONFIGS = {
  fix: {
    heading: 'Investigate the issue:',
    panels: [
      {
        panelKey: 'panel_a',
        tag: 'undesired_behavior',
        fields: [
          { key: 'description', type: 'text', label: 'Bug: ' },
          { key: 'issue_number', type: 'issue', label: 'Read issue ' },
          { key: 'files', type: 'files', label: 'Read ' },
        ],
      },
      {
        panelKey: 'panel_b',
        tag: 'expected_behavior',
        fields: [
          { key: 'description', type: 'text', label: 'Expected: ' },
          { key: 'spec_files', type: 'files', label: 'Specs: ' },
          { key: 'guideline_files', type: 'files', label: 'Guidelines: ' },
        ],
      },
    ],
  },
  review: {
    heading: 'Review the subject against criteria:',
    panels: [
      {
        panelKey: 'panel_a',
        tag: 'review_subject',
        fields: [
          { key: 'pr_number', type: 'pr', label: 'Review PR ' },
          { key: 'files', type: 'files', label: 'Review ' },
          { key: 'description', type: 'text', label: 'Context: ' },
        ],
      },
      {
        panelKey: 'panel_b',
        tag: 'review_criteria',
        fields: [
          { key: 'lenses', type: 'lenses', label: 'Focus: ' },
          { key: 'spec_files', type: 'files', label: 'Specs: ' },
          { key: 'guideline_files', type: 'files', label: 'Guidelines: ' },
        ],
      },
    ],
  },
  implement: {
    heading: 'Implement per context and requirements:',
    panels: [
      {
        panelKey: 'panel_a',
        tag: 'existing_context',
        fields: [
          { key: 'description', type: 'text', label: 'Context: ' },
          { key: 'files', type: 'files', label: 'Build on: ' },
        ],
      },
      {
        panelKey: 'panel_b',
        tag: 'requirements',
        fields: [
          { key: 'description', type: 'text', label: '', dot: false },
          { key: 'spec_files', type: 'files', label: 'Specs: ' },
          { key: 'acceptance_criteria', type: 'text', label: 'Acceptance: ' },
        ],
      },
    ],
  },
  improve: {
    heading: 'Improve per current state and desired outcome:',
    panels: [
      {
        panelKey: 'panel_a',
        tag: 'current_state',
        fields: [
          { key: 'description', type: 'text', label: '', dot: false },
          { key: 'issue_number', type: 'issue', label: 'Read issue ' },
          { key: 'files', type: 'files', label: 'Files: ' },
        ],
      },
      {
        panelKey: 'panel_b',
        tag: 'desired_outcome',
        fields: [
          { key: 'description', type: 'text', label: 'Goal: ' },
          { key: 'issue_number', type: 'issue', label: 'Target per issue ' },
          {
            key: 'guideline_files',
            type: 'files',
            label: 'Style reference: ',
          },
          { key: 'lenses', type: 'lenses', label: 'Focus: ' },
        ],
      },
    ],
  },
  default: {
    heading: 'Understand the task:',
    returnNullIfEmpty: true,
    panels: [
      {
        panelKey: 'panel_a',
        tag: null,
        fields: [
          { key: 'description', type: 'text', label: 'Context: ' },
          { key: 'files', type: 'files', label: 'Files: ' },
        ],
      },
      {
        panelKey: 'panel_b',
        tag: null,
        fields: [
          { key: 'description', type: 'text', label: 'Goal: ' },
          { key: 'spec_files', type: 'files', label: 'Specs: ' },
        ],
      },
    ],
  },
};

function buildTaskStep(flowId, panelA, panelB, improveScope) {
  const panels = { panel_a: panelA, panel_b: panelB };
  const config = FLOW_TASK_CONFIGS[flowId] || FLOW_TASK_CONFIGS.default;
  const parts = [config.heading];
  let hasContent = false;

  for (const pc of config.panels) {
    const panel = panels[pc.panelKey];
    if (!panel) continue;

    if (pc.tag) {
      const section = buildPanelSection(
        pc.tag,
        panel,
        pc.fields.map((f) => ({
          condition: hasFieldValue(f.type, panel, f.key),
          text: formatField(f, panel[f.key]),
        }))
      );
      if (section) {
        parts.push(section);
        hasContent = true;
      }
    } else {
      for (const f of pc.fields) {
        if (hasFieldValue(f.type, panel, f.key)) {
          parts.push(`              ${formatField(f, panel[f.key])}`);
          hasContent = true;
        }
      }
    }
  }

  if (flowId === 'improve') {
    if (improveScope === 'across_files') {
      parts.push(
        '              <scope>Apply as unified cross-file change.</scope>'
      );
    } else if (improveScope === 'each_file') {
      parts.push(
        '              <scope>Apply to each file independently.</scope>'
      );
    }
  }

  if (config.returnNullIfEmpty && !hasContent) return null;
  return parts.join('\n');
}

// --- Feedback step builders ---

/**
 * Build the feedback step for non-review flows.
 * Checks output modes from feedback-type steps (outputs_selected array).
 */
function buildFeedbackStep(flowId, enabledSteps) {
  // Find output modes from report-type steps (if any)
  const reportSteps = (enabledSteps || []).filter(
    (s) => s.id === 'report' || s.object === 'review_feedback'
  );
  let outputMode = null;
  if (reportSteps.length > 0) {
    outputMode = getOutputModes(reportSteps[0]);
  }

  switch (flowId) {
    case 'fix':
      return 'Report results here:';
    case 'review':
      return buildReviewFeedback(
        Array.isArray(outputMode)
          ? outputMode
          : outputMode
            ? [outputMode]
            : null
      );
    case 'implement':
      return 'Report results here:';
    case 'improve':
      return 'Report results here:';
    default:
      return null;
  }
}

/**
 * Review flow supports multiple output modes (outputs_selected array).
 * When multiple modes are selected, the instruction mentions all delivery methods.
 *
 * @param {string[]|null} outputModes - array of selected mode IDs, or null for default
 */
function buildReviewFeedback(outputModes) {
  const modes = outputModes?.length > 0 ? outputModes : ['here'];

  // Build delivery clause from all selected modes
  const MODE_VERBS = {
    here: 'here (in this interface)',
    pr_comment: 'as a PR comment',
    pr_inline_comments: 'via PR inline comments at relevant line numbers',
    issue_comment: 'as a GitHub issue comment',
    report_file: 'as a committed report file in the repository',
  };
  const deliveryParts = modes.map((m) => MODE_VERBS[m] || m);
  const deliveryClause =
    deliveryParts.length === 1
      ? deliveryParts[0]
      : deliveryParts.slice(0, -1).join(', ') +
        ' AND ' +
        deliveryParts[deliveryParts.length - 1];

  const lines = [`Report feedback ${deliveryClause}:`];

  if (modes.includes('pr_inline_comments')) {
    lines.push(
      '              - Inline: issue, severity, suggested fix at relevant line.'
    );
  }
  if (modes.some((m) => ['pr_comment', 'issue_comment'].includes(m))) {
    lines.push('              - Link the comment here.');
  }
  if (modes.includes('report_file')) {
    lines.push('              - Commit report file, link here.');
  }

  lines.push(
    '              - One-sentence summary.',
    '              - Issue count by severity.',
    '              - Top 3 findings with file/line references.'
  );

  return lines.join('\n');
}

// --- Step formatting ---

/**
 * Format a commit step into a readable string.
 */
function formatCommitStep(step) {
  const parts = ['Create branch'];
  if (step.name_provided && step.branch_name !== undefined) {
    parts[0] = `Create branch "${escapeXml(step.name_provided)}"`;
  }
  parts.push('commit changes, and open draft PR');
  if (step.name_provided && step.pr_name !== undefined) {
    parts.push(`titled "${escapeXml(step.name_provided)}"`);
  }
  return parts.join(', ');
}

/**
 * Format a single step object into a readable string.
 * Handles operation, object, params, lenses, name_provided, and output.
 */
function formatStep(step) {
  if (!step) return '';

  const parts = [];

  // Operation + object (STP-02 minimum: 1x operation, 1x object)
  const op = capitalize(escapeXml(step.operation || ''));
  const obj = escapeXml(step.object || '');
  parts.push(`${op} ${obj}`.trim());

  // Params — add relevant details
  if (step.params) {
    const paramParts = [];
    for (const [key, val] of Object.entries(step.params)) {
      if (val !== null && val !== undefined && val !== '') {
        // File references get @ prefix (OUT-04)
        const escaped = escapeXml(String(val));
        const display = key === 'file' ? `@${escaped}` : escaped;
        paramParts.push(display);
      }
    }
    if (paramParts.length > 0) {
      parts.push(paramParts.join(', '));
    }
  }

  // Lenses (STP-03)
  const lenses = step.lenses || [];
  if (Array.isArray(lenses) && lenses.length > 0) {
    parts.push(`— focus on [${lenses.map(escapeXml).join(', ')}]`);
  }

  // User-provided name for branch/PR/file (name_provided field)
  if (step.name_provided) {
    parts.push(`— name it ${escapeXml(step.name_provided)}`);
  }

  return parts.join(' ');
}

// --- Field formatting helpers ---

/**
 * Check whether a panel field has a meaningful value.
 */
function hasFieldValue(type, panel, key) {
  const val = panel?.[key];
  if (type === 'files' || type === 'lenses') return val?.length > 0;
  return !!val;
}

/**
 * Format a single field entry: label + formatted value + optional dot.
 */
function formatField(field, value) {
  const formatted = formatFieldValue(field.type, value);
  const dot = field.dot !== false ? '.' : '';
  return `${field.label || ''}${formatted}${dot}`;
}

/**
 * Format a field value by type.
 */
function formatFieldValue(type, value) {
  switch (type) {
    case 'text':
      return escapeXml(value);
    case 'issue':
      return `#${escapeXml(String(value))}`;
    case 'pr':
      return `#${escapeXml(String(value))} diff`;
    case 'files':
      return formatFileList(value);
    case 'lenses':
      return `[${(value || []).map(escapeXml).join(', ')}]`;
    default:
      return escapeXml(String(value));
  }
}

// --- Helpers ---

/**
 * Helper to extract output modes from a step safely.
 */
function getOutputModes(step) {
  if (!step) return null;
  if (step.outputs_selected?.length > 0) return step.outputs_selected;
  if (step.output_selected) return [step.output_selected];
  if (step.output?.[0]) return [step.output[0]];
  return null;
}

/**
 * Helper to generate repeating XML panel sections conditionally.
 */
function buildPanelSection(tagName, panel, instructions) {
  if (!panel) return '';
  const parts = [`              <${tagName}>`];
  for (const { condition, text } of instructions) {
    if (condition) parts.push(`                ${text}`);
  }
  parts.push(`              </${tagName}>`);
  return parts.length > 2 ? parts.join('\n') : '';
}

/**
 * Format a list of file paths as @-prefixed references (OUT-04).
 */
function formatFileList(files) {
  if (!files || files.length === 0) return '';
  return files.map((f) => `@${escapeXml(f)}`).join(', ');
}

/**
 * Capitalize first letter.
 */
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/**
 * Escape XML-sensitive characters in user content.
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
