/**
 * Pure function: prompt_input → structured XML prompt string.
 * DM-INV-03: identical input always produces identical output (deterministic).
 *
 * Format per OUT-02:
 * <prompt>
 *   <context>...</context>
 *   <todo>...</todo>
 * </prompt>
 * <notes>...</notes>
 */
export function buildPrompt(state) {
  if (!state) return '';

  const { configuration, context, steps, notes } = state;
  const { owner, repo, branch, pat } = configuration || {};

  // Need at minimum a repo to generate a useful prompt
  if (!owner || !repo) return '';

  const lines = [];

  // Open prompt
  lines.push('<prompt>');

  // Context section
  lines.push('  <context>');
  lines.push(
    `    Execute the following TODO steps for <repository> https://github.com/${esc(owner)}/${esc(repo)} </repository> on <branch> ${esc(branch || 'main')} </branch>.`
  );
  if (pat) {
    lines.push(`    Authenticate using PAT: <PAT> ${esc(pat)} </PAT>.`);
  }
  lines.push('  </context>');

  // Todo section — build step list
  lines.push('  <todo>');

  let stepNum = 1;

  // Step 1 always: Read claude.md (per spec)
  lines.push(`    Step ${stepNum}: Read: @claude.md`);
  stepNum++;

  // Step 2: Read selected files (if any) — per OUT-04 with @ prefix
  const files = context?.selected_files || [];
  if (files.length > 0) {
    const fileRefs = files.map((f) => `@${esc(f)}`).join(', ');
    lines.push(`    Step ${stepNum}: Read: ${fileRefs}`);
    stepNum++;
  }

  // Remaining steps from enabled_steps
  const enabledSteps = steps?.enabled_steps || [];
  for (const step of enabledSteps) {
    const desc = formatStep(step);
    lines.push(`    Step ${stepNum}: ${desc}`);
    stepNum++;
  }

  lines.push('  </todo>');
  lines.push('</prompt>');

  // Notes section (OUT-06)
  const userNotes = notes?.user_text?.trim();
  if (userNotes) {
    lines.push('<notes>');
    lines.push(`  ${esc(userNotes)}`);
    lines.push('</notes>');
  }

  return lines.join('\n');
}

/**
 * Format a single step object into a readable string.
 */
function formatStep(step) {
  if (!step) return '';

  const parts = [];

  // Operation + object (STP-02 minimum: 1× operation, 1× object)
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
  if (lenses.length > 0) {
    parts.push(`— focus on [${lenses.map(esc).join(', ')}]`);
  }

  return parts.join(' ');
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
