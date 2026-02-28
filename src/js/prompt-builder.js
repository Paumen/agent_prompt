/**
 * Pure function: prompt_input → structured XML prompt string.
 * DM-INV-03: identical input always produces identical output (deterministic).
 *
 * Flow-specific templates per OUT-02 and hybrid-framework-design.md.
 * Each flow produces a <prompt> with <context>, flow-specific <task> section,
 * <todo> step list, and optional <notes>.
 */
export function buildPrompt(state) {
  if (!state) return '';

  const { configuration, task, panel_a, panel_b, steps, notes, improve_scope } =
    state;
  const { owner, repo, branch, pat } = configuration || {};

  // Need at minimum a repo to generate a useful prompt
  if (!owner || !repo) return '';

  const flowId = task?.flow_id || '';
  const lines = [];

  lines.push('<prompt>');

  // Context section — same across all flows
  lines.push('  <context>');
  const flowLabel = FLOW_LABELS[flowId] || flowId || 'task';
  // Spec uses task="debug" for fix flow, other flows match their flow ID
  const taskId = TASK_IDS[flowId] || flowId || 'task';
  lines.push(
    `    Please help <task="${esc(taskId)}"> ${esc(flowLabel)} </task> by executing below 'todo' steps`
  );
  lines.push(
    `    for <repository> https://github.com/${esc(owner)}/${esc(repo)} </repository>`
  );
  lines.push(`    on <branch> ${esc(branch || 'main')} </branch>.`);
  if (pat) {
    lines.push(`    Authenticate using PAT: <PAT> ${esc(pat)} </PAT>.`);
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
    // STP-04: read-claude is a regular removable step, rendered as "Read @claude.md"
    if (step.id === 'read-claude') {
      lines.push(`    Step ${stepNum}: Read @claude.md`);
      stepNum++;
      // Insert flow-specific understanding step right after read-claude
      const taskStep = buildTaskStep(flowId, panel_a, panel_b, improve_scope);
      if (taskStep) {
        lines.push(`    Step ${stepNum}: ${taskStep}`);
        stepNum++;
      }
      taskStepInserted = true;
      continue;
    }

    // If read-claude was removed by user, insert understanding step before first regular step
    if (!taskStepInserted) {
      const taskStep = buildTaskStep(flowId, panel_a, panel_b, improve_scope);
      if (taskStep) {
        lines.push(`    Step ${stepNum}: ${taskStep}`);
        stepNum++;
      }
      taskStepInserted = true;
    }

    // Phase 13: expand params.files into individual Read lines per file
    if (step.params?.files?.length > 0 && step.operation === 'read') {
      for (const filePath of step.params.files) {
        lines.push(`    Step ${stepNum}: Read @${esc(filePath)}`);
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

  // Final feedback step — uses output mode from the last feedback-type step
  const feedbackStep = buildFeedbackStep(flowId, enabledSteps);
  if (feedbackStep) {
    lines.push(`    Step ${stepNum}: ${feedbackStep}`);
  }

  lines.push('  </todo>');
  lines.push('</prompt>');

  // Notes section (OUT-06)
  const userNotes = notes?.user_text?.trim();
  if (userNotes) {
    lines.push('<notes>');
    lines.push(`  Critical note: ${esc(userNotes)}`);
    lines.push('</notes>');
  }

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
      `                Undesired behavior observed by user is: ${esc(panelA.description)}.`
    );
  }
  if (panelA?.issue_number) {
    parts.push(
      `                Attempt to learn more regarding the undesired behavior by reading issue #${esc(String(panelA.issue_number))}.`
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
      `                Expected behavior after the fix: ${esc(panelB.description)}.`
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
      `                Review PR #${esc(String(panelA.pr_number))}. Fetch and examine the PR diff.`
    );
  }
  if (panelA?.files?.length > 0) {
    parts.push(
      `                Review files: ${formatFileList(panelA.files)}. Read and examine each file.`
    );
  }
  if (panelA?.description) {
    parts.push(
      `                Context provided by user: ${esc(panelA.description)}.`
    );
  }
  parts.push('              </review_subject>');

  // Panel B — review criteria
  parts.push('              <review_criteria>');
  if (panelB?.lenses?.length > 0) {
    parts.push(
      `                Focus on: [${panelB.lenses.map(esc).join(', ')}].`
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
      `                Context provided by user: ${esc(panelA.description)}.`
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
    parts.push(`                ${esc(panelB.description)}`);
  }
  if (panelB?.spec_files?.length > 0) {
    parts.push(
      `                Specifications to follow: ${formatFileList(panelB.spec_files)}.`
    );
  }
  if (panelB?.acceptance_criteria) {
    parts.push(
      `                Acceptance criteria: ${esc(panelB.acceptance_criteria)}.`
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
    parts.push(`                ${esc(panelA.description)}`);
  }
  if (panelA?.issue_number) {
    parts.push(
      `                Related issue describing current state: #${esc(String(panelA.issue_number))}. Read this issue for context.`
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
      `                Desired improvements: ${esc(panelB.description)}.`
    );
  }
  if (panelB?.issue_number) {
    parts.push(
      `                Desired state per issue: #${esc(String(panelB.issue_number))}. Read this issue for target state.`
    );
  }
  if (panelB?.guideline_files?.length > 0) {
    parts.push(
      `                Reference files for target style: ${formatFileList(panelB.guideline_files)}.`
    );
  }
  if (panelB?.lenses?.length > 0) {
    parts.push(
      `                Focus on: [${panelB.lenses.map(esc).join(', ')}].`
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
    parts.push(`              Context: ${esc(panelA.description)}.`);
  }
  if (panelA?.files?.length > 0) {
    parts.push(`              Files: ${formatFileList(panelA.files)}.`);
  }
  if (panelB?.description) {
    parts.push(`              Goal: ${esc(panelB.description)}.`);
  }
  if (panelB?.spec_files?.length > 0) {
    parts.push(`              Specs: ${formatFileList(panelB.spec_files)}.`);
  }

  return parts.join('\n');
}

// --- Feedback step builders ---

/**
 * Build the final feedback step. For review flow, checks output modes
 * from enabled_steps feedback steps (outputs_selected array, Phase 13).
 * When multiple modes are selected, the prompt combines all into one instruction.
 */
function buildFeedbackStep(flowId, enabledSteps) {
  // Find output modes from feedback-type steps
  const feedbackSteps = (enabledSteps || []).filter(
    (s) =>
      s.id === 'provide-feedback-pr' ||
      s.id === 'provide-feedback-files' ||
      s.object === 'review_feedback'
  );
  // Phase 13: prefer outputs_selected (array); fall back to legacy output_selected (string)
  let outputMode = null;
  if (feedbackSteps.length > 0) {
    const fs = feedbackSteps[0];
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
 * Review flow supports multiple output modes (Phase 13: outputs_selected array).
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
 * Format a single step object into a readable string.
 * Handles operation, object, params, lenses, name_provided, and output.
 */
function formatStep(step) {
  if (!step) return '';

  const parts = [];

  // Operation + object (STP-02 minimum: 1x operation, 1x object)
  const op = capitalize(esc(step.operation || ''));
  const obj = esc(step.object || '');
  parts.push(`${op} ${obj}`.trim());

  // Params — add relevant details
  if (step.params) {
    const paramParts = [];
    for (const [key, val] of Object.entries(step.params)) {
      if (val !== null && val !== undefined && val !== '') {
        // File references get @ prefix (OUT-04)
        const escaped = esc(String(val));
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
    parts.push(`— focus on [${lenses.map(esc).join(', ')}]`);
  }

  // User-provided name for branch/PR/file (name_provided field)
  if (step.name_provided) {
    parts.push(`— name it ${esc(step.name_provided)}`);
  }

  return parts.join(' ');
}

// --- Helpers ---

/**
 * Format a list of file paths as @-prefixed references (OUT-04).
 */
function formatFileList(files) {
  if (!files || files.length === 0) return '';
  return files.map((f) => `@${esc(f)}`).join(', ');
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
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
