/**
 * Pure function: prompt_input → structured XML prompt string.
 * DM-INV-03: identical input always produces identical output (deterministic).
 *
 * Flow-specific templates per OUT-02 and hybrid-framework-design.md.
 * Each flow produces a <prompt> with <context>, flow-specific <task> section,
 * and <todo> step list.
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

  lines.push('<prompt>');

  // Context section — same across all flows
  lines.push('  <context>');
  const flowLabel = FLOW_LABELS[flowId] || flowId || 'task';
  // Spec uses task="debug" for fix flow, other flows match their flow ID
  const taskId = TASK_IDS[flowId] || flowId || 'task';

  if (includeRepo) {
    lines.push(
      `    Please help <task="${escapeXml(taskId)}"> ${escapeXml(flowLabel)} </task> by executing below 'todo' steps`
    );
    lines.push(
      `    for <repository> https://github.com/${escapeXml(owner)}/${escapeXml(repo)} </repository>`
    );
    lines.push(`    on <branch> ${escapeXml(branch || 'main')} </branch>.`);
  } else {
    lines.push(
      `    Please help <task="${escapeXml(taskId)}"> ${escapeXml(flowLabel)} </task> by executing below 'todo' steps.`
    );
  }

  if (pat && includePat) {
    lines.push(`    Authenticate using PAT: <PAT> ${escapeXml(pat)} </PAT>.`);
  }
  lines.push(
    '    Please provide one sentence feedback to HUMAN (me) here (in this interface) after each step (except step 1), and proceed to next step.'
  );
  lines.push('  </context>');

  // Todo section — build step list
  lines.push('  <todo>');

  let stepNum = 1;
  let taskStepInserted = false;
  const enabledSteps = steps?.enabled_steps || [];

  for (const step of enabledSteps) {
    // Context step (read claude.md) — rendered as "Read @claude.md"
    if (step.id === 'context') {
      lines.push(`    Step ${stepNum}: Read @claude.md`);
      stepNum++;
      // Insert flow-specific understanding step right after context
      const taskStep = buildTaskStep(flowId, panel_a, panel_b, improve_scope);
      if (taskStep) {
        lines.push(`    Step ${stepNum}: ${taskStep}`);
        stepNum++;
      }
      taskStepInserted = true;
      continue;
    }

    // If context was removed by user, insert understanding step before first regular step
    if (!taskStepInserted) {
      const taskStep = buildTaskStep(flowId, panel_a, panel_b, improve_scope);
      if (taskStep) {
        lines.push(`    Step ${stepNum}: ${taskStep}`);
        stepNum++;
      }
      taskStepInserted = true;
    }

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

    // Commit step — includes branch creation, commit, and PR opening
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
      const feedback = buildReviewFeedback(
        step.outputs_selected ||
          (step.output_selected
            ? [step.output_selected]
            : step.output?.[0]
              ? [step.output[0]]
              : null)
      );
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

  // If no enabled_steps at all, still insert the understanding step
  if (!taskStepInserted) {
    const taskStep = buildTaskStep(flowId, panel_a, panel_b, improve_scope);
    if (taskStep) {
      lines.push(`    Step ${stepNum}: ${taskStep}`);
      stepNum++;
    }
  }

  lines.push('  </todo>');
  lines.push('</prompt>');

  return lines.join('\n');
}

// --- Flow labels ---

const FLOW_LABELS = {
  fix: 'Fix / Debug',
  review: 'Review / Analyze',
  implement: 'Implement / Build',
  improve: 'Improve / Modify',
};

// Spec task attribute values (hybrid-framework-design.md: fix → "debug")
const TASK_IDS = {
  fix: 'debug',
  review: 'review',
  implement: 'implement',
  improve: 'improve',
};

// --- Flow-specific task step builders ---

function buildTaskStep(flowId, panelA, panelB, improveScope) {
  switch (flowId) {
    case 'fix':
      return buildFixTaskStep(panelA, panelB);
    case 'review':
      return buildReviewTaskStep(panelA, panelB);
    case 'implement':
      return buildImplementTaskStep(panelA, panelB);
    case 'improve':
      return buildImproveTaskStep(panelA, panelB, improveScope);
    default:
      return buildGenericTaskStep(panelA, panelB);
  }
}

function buildFixTaskStep(panelA, panelB) {
  const parts = [
    "Read and investigate the 'undesired_behavior' and 'expected_behavior' to understand the issue:",
  ];

  // Panel A — undesired behavior
  parts.push('              <undesired_behavior>');
  if (panelA?.description) {
    parts.push(
      `                Undesired behavior observed by user is: ${escapeXml(panelA.description)}.`
    );
  }
  if (panelA?.issue_number) {
    parts.push(
      `                Attempt to learn more regarding the undesired behavior by reading issue #${escapeXml(String(panelA.issue_number))}.`
    );
  }
  if (panelA?.files?.length > 0) {
    parts.push(
      `                Attempt to learn more regarding the undesired behavior by reading files ${formatFileList(panelA.files)}.`
    );
  }
  parts.push('              </undesired_behavior>');

  // Panel B — expected behavior
  parts.push('              <expected_behavior>');
  if (panelB?.description) {
    parts.push(
      `                Expected behavior after the fix: ${escapeXml(panelB.description)}.`
    );
  }
  if (panelB?.spec_files?.length > 0) {
    parts.push(
      `                Reference specifications: ${formatFileList(panelB.spec_files)}.`
    );
  }
  if (panelB?.guideline_files?.length > 0) {
    parts.push(
      `                Follow guidelines: ${formatFileList(panelB.guideline_files)}.`
    );
  }
  parts.push('              </expected_behavior>');

  parts.push(
    '             If unclear or high ambiguity, STOP and DO NOT proceed to next steps, share your interpretation with HUMAN and ask for confirmation or clarification, and await HUMAN feedback.'
  );

  return parts.join('\n');
}

function buildReviewTaskStep(panelA, panelB) {
  const parts = [
    "Read and investigate the 'review_subject' and 'review_criteria' to understand what to review:",
  ];

  // Panel A — review subject
  parts.push('              <review_subject>');
  if (panelA?.pr_number) {
    parts.push(
      `                Review PR #${escapeXml(String(panelA.pr_number))}. Fetch and examine the PR diff.`
    );
  }
  if (panelA?.files?.length > 0) {
    parts.push(
      `                Review files: ${formatFileList(panelA.files)}. Read and examine each file.`
    );
  }
  if (panelA?.description) {
    parts.push(
      `                Context provided by user: ${escapeXml(panelA.description)}.`
    );
  }
  parts.push('              </review_subject>');

  // Panel B — review criteria
  parts.push('              <review_criteria>');
  if (panelB?.lenses?.length > 0) {
    parts.push(
      `                Focus on: [${panelB.lenses.map(escapeXml).join(', ')}].`
    );
  }
  if (panelB?.spec_files?.length > 0) {
    parts.push(
      `                Evaluate against specifications: ${formatFileList(panelB.spec_files)}.`
    );
  }
  if (panelB?.guideline_files?.length > 0) {
    parts.push(
      `                Evaluate against guidelines: ${formatFileList(panelB.guideline_files)}.`
    );
  }
  parts.push('              </review_criteria>');

  parts.push(
    '             If unclear or high ambiguity about what to review or the criteria, STOP and DO NOT proceed to next steps, share your interpretation with HUMAN and ask for confirmation or clarification, and await HUMAN feedback.'
  );

  return parts.join('\n');
}

function buildImplementTaskStep(panelA, panelB) {
  const parts = [
    "Read and investigate the 'existing_context' and 'requirements' to understand what to build:",
  ];

  // Panel A — existing context
  parts.push('              <existing_context>');
  if (panelA?.description) {
    parts.push(
      `                Context provided by user: ${escapeXml(panelA.description)}.`
    );
  }
  if (panelA?.files?.length > 0) {
    parts.push(
      `                Build upon existing files: ${formatFileList(panelA.files)}.`
    );
  }
  parts.push('              </existing_context>');

  // Panel B — requirements
  parts.push('              <requirements>');
  if (panelB?.description) {
    parts.push(`                ${escapeXml(panelB.description)}`);
  }
  if (panelB?.spec_files?.length > 0) {
    parts.push(
      `                Specifications to follow: ${formatFileList(panelB.spec_files)}.`
    );
  }
  if (panelB?.acceptance_criteria) {
    parts.push(
      `                Acceptance criteria: ${escapeXml(panelB.acceptance_criteria)}.`
    );
  }
  parts.push('              </requirements>');

  parts.push(
    '             If unclear or high ambiguity about what to build, STOP and DO NOT proceed to next steps, share your interpretation with HUMAN and ask for confirmation or clarification, and await HUMAN feedback.'
  );

  return parts.join('\n');
}

function buildImproveTaskStep(panelA, panelB, improveScope) {
  const parts = [
    "Read and investigate the 'current_state' and 'desired_outcome' to understand what to improve:",
  ];

  // Panel A — current state
  parts.push('              <current_state>');
  if (panelA?.description) {
    parts.push(`                ${escapeXml(panelA.description)}`);
  }
  if (panelA?.issue_number) {
    parts.push(
      `                Related issue describing current state: #${escapeXml(String(panelA.issue_number))}. Read this issue for context.`
    );
  }
  if (panelA?.files?.length > 0) {
    parts.push(
      `                Files to improve: ${formatFileList(panelA.files)}.`
    );
  }
  parts.push('              </current_state>');

  // Panel B — desired outcome
  parts.push('              <desired_outcome>');
  if (panelB?.description) {
    parts.push(
      `                Desired improvements: ${escapeXml(panelB.description)}.`
    );
  }
  if (panelB?.issue_number) {
    parts.push(
      `                Desired state per issue: #${escapeXml(String(panelB.issue_number))}. Read this issue for target state.`
    );
  }
  if (panelB?.guideline_files?.length > 0) {
    parts.push(
      `                Reference files for target style: ${formatFileList(panelB.guideline_files)}.`
    );
  }
  if (panelB?.lenses?.length > 0) {
    parts.push(
      `                Focus on: [${panelB.lenses.map(escapeXml).join(', ')}].`
    );
  }
  parts.push('              </desired_outcome>');

  // Scope instruction for multi-file improve
  if (improveScope === 'across_files') {
    parts.push(
      '              <scope>Apply improvements across all files as a unified change, considering relationships between files.</scope>'
    );
  } else if (improveScope === 'each_file') {
    parts.push(
      '              <scope>Apply improvements to each file independently.</scope>'
    );
  }

  parts.push(
    '             If unclear or high ambiguity about what improvements to make, STOP and DO NOT proceed to next steps, share your interpretation with HUMAN and ask for confirmation or clarification, and await HUMAN feedback.'
  );

  return parts.join('\n');
}

function buildGenericTaskStep(panelA, panelB) {
  // Fallback for unknown/empty flow — include whatever panel data is available
  const hasPanelContent =
    panelA?.description ||
    panelA?.files?.length > 0 ||
    panelB?.description ||
    panelB?.spec_files?.length > 0;

  if (!hasPanelContent) return null;

  const parts = ['Understand the task:'];
  if (panelA?.description) {
    parts.push(`              Context: ${escapeXml(panelA.description)}.`);
  }
  if (panelA?.files?.length > 0) {
    parts.push(`              Files: ${formatFileList(panelA.files)}.`);
  }
  if (panelB?.description) {
    parts.push(`              Goal: ${escapeXml(panelB.description)}.`);
  }
  if (panelB?.spec_files?.length > 0) {
    parts.push(`              Specs: ${formatFileList(panelB.spec_files)}.`);
  }

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
    const fs = reportSteps[0];
    if (fs.outputs_selected?.length > 0) {
      outputMode = fs.outputs_selected;
    } else if (fs.output_selected) {
      outputMode = [fs.output_selected];
    } else {
      outputMode = fs.output?.[0] ? [fs.output[0]] : null;
    }
  }

  switch (flowId) {
    case 'fix':
      return [
        'Provide concise feedback to HUMAN (me) here (in this interface) include:',
        '              - Your understanding of the issue in one sentence.',
        '              - The root cause you identified.',
        '              - The action you took: create branch (incl name and link), implemented fix by editing files (incl file names), ran tests (incl which ones), verified issue is solved, committed PR (incl PR name and link)',
      ].join('\n');
    case 'review':
      return buildReviewFeedback(
        Array.isArray(outputMode)
          ? outputMode
          : outputMode
            ? [outputMode]
            : null
      );
    case 'implement':
      return [
        'Provide concise feedback to HUMAN (me) here (in this interface) include:',
        '              - Summary of what you implemented in one sentence.',
        '              - Files created or modified with brief description of changes.',
        '              - Tests run and results.',
        '              - PR link.',
      ].join('\n');
    case 'improve':
      return [
        'Provide concise feedback to HUMAN (me) here (in this interface) include:',
        '              - Summary of improvements made, one sentence each improvement type.',
        '              - Files modified with brief description of changes.',
        '              - How the improvements address the desired outcome.',
        '              - PR link.',
      ].join('\n');
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

  const lines = [`Provide feedback ${deliveryClause} include:`];

  // Include mode-specific instructions for each selected mode
  if (modes.includes('pr_inline_comments')) {
    lines.push(
      '              - For inline comments: note the issue, severity label, and suggested fix at the relevant line.'
    );
  }
  if (modes.some((m) => ['pr_comment', 'issue_comment'].includes(m))) {
    lines.push(
      '              - Provide a link to the comment to HUMAN (me) here (in this interface).'
    );
  }
  if (modes.includes('report_file')) {
    lines.push(
      '              - Commit the report file and provide the file link to HUMAN (me) here (in this interface).'
    );
  }

  lines.push(
    '              - Summary of what you reviewed in one sentence.',
    '              - Number of issues found by severity.',
    '              - Top 3 most important findings with file/line references.'
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

// --- Helpers ---

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
