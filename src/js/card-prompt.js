/**
 * Card 4: Prompt Output
 *
 * Live prompt preview, copy to clipboard, deep-link to Claude with prompt
 * pre-filled, optional notes textarea.
 *
 * Req IDs: OUT-01..08
 * Phase 14: highlightXml, copy icon swap, quality meter tooltip.
 */

import { getState, setState, subscribe } from './state.js';
import { renderQualityMeter } from './quality-meter.js';

// --- Module-level references ---

let elBody = null;
let elPreview = null;
let elCopyStatus = null;
let elNotes = null;
let copyBtn = null;

// --- XML Syntax Highlighting (Phase 14, UAT 4.4) ---

/**
 * Escape HTML special chars and wrap XML tag patterns in highlight spans.
 * Security: all text-node content is fully escaped before innerHTML injection.
 *
 * @param {string} text - raw prompt text
 * @returns {string} HTML string safe for innerHTML
 */
export function highlightXml(text) {
  // Step 1: escape all HTML special chars (prevents injection)
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Step 2: find escaped XML tag patterns and wrap in highlight span
  // Matches: &lt;[/]tagname[ attrs]&gt;
  // [^&]*? stops at & (beginning of &gt;), preventing greedy overconsumption
  return escaped.replace(
    /&lt;\/?[\w][\w.-]*(?:\s[^&]*?)?&gt;/g,
    '<span class="xml-tag">$&</span>'
  );
}

// --- Rendering ---

function renderPromptCard() {
  if (!elBody) return;

  const state = getState();
  const prompt = state._prompt || '';

  // OUT-01, OUT-03: live preview, fully regenerated from current state
  // Phase 14: use innerHTML with XML highlighting instead of textContent
  if (elPreview) {
    if (prompt) {
      elPreview.innerHTML = highlightXml(prompt);
      elPreview.classList.remove('prompt-output--empty');
    } else {
      elPreview.textContent = 'Select a flow to generate a prompt.';
      elPreview.classList.add('prompt-output--empty');
    }
  }

  // Notes: update only when not actively editing (OUT-06)
  if (elNotes && elNotes !== document.activeElement) {
    elNotes.value = state.notes?.user_text || '';
  }
}

// --- Event handlers ---

function onCopy() {
  const state = getState();
  const prompt = state._prompt || '';
  if (!prompt) return;

  navigator.clipboard.writeText(prompt).then(
    () => {
      // Phase 14 UAT 4.2: icon swap via class toggle
      if (copyBtn) {
        copyBtn.classList.add('btn--copied');
        setTimeout(() => copyBtn?.classList.remove('btn--copied'), 2000);
      }
      // Keep aria-live for screen readers (visually hidden)
      showCopyStatus('Copied!', 'success');
    },
    () => showCopyStatus('Copy failed', 'error')
  );
}

function showCopyStatus(message, type) {
  if (!elCopyStatus) return;
  elCopyStatus.textContent = message;
  elCopyStatus.dataset.type = type;
  setTimeout(() => {
    if (elCopyStatus) {
      elCopyStatus.textContent = '';
      delete elCopyStatus.dataset.type;
    }
  }, 2000);
}

// OUT-07: deep-link to Claude with prompt pre-filled via URL query parameter
function onPromptClaude() {
  const state = getState();
  const prompt = state._prompt || '';
  const url = prompt
    ? `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
    : 'https://claude.ai/new';
  window.open(url, '_blank', 'noopener,noreferrer');
}

function onNotesChange(value) {
  setState('notes.user_text', value);
}

import { icon } from './icons.js';

// --- Quality Meter Tooltip (Phase 14, UAT 5) ---

function initMeterTooltip(labelEl) {
  labelEl.classList.add('quality-meter-label--with-tooltip');

  const wrapper = document.createElement('span');
  wrapper.className = 'meter-info-wrapper';

  const infoBtn = document.createElement('button');
  infoBtn.type = 'button';
  infoBtn.className = 'btn-icon meter-info-btn';
  infoBtn.setAttribute('aria-label', 'How is the quality score calculated?');
  infoBtn.appendChild(icon('info', 'icon-info'));

  const tooltip = document.createElement('div');
  tooltip.role = 'tooltip';
  tooltip.className = 'meter-tooltip';
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.textContent =
    'Score reflects how many fields you have filled in for the selected flow. ' +
    'Adding files, a PR or issue, descriptions, lenses, and notes all raise the score.';

  wrapper.appendChild(infoBtn);
  wrapper.appendChild(tooltip);
  labelEl.appendChild(wrapper);

  // Toggle on info button click
  infoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = tooltip.classList.toggle('meter-tooltip--visible');
    tooltip.setAttribute('aria-hidden', String(!isVisible));
  });

  // Close when clicking anywhere else on the document
  document.addEventListener('click', () => {
    if (tooltip.classList.contains('meter-tooltip--visible')) {
      tooltip.classList.remove('meter-tooltip--visible');
      tooltip.setAttribute('aria-hidden', 'true');
    }
  });
}

// --- Initialization ---

export function initPromptCard() {
  elBody = document.getElementById('bd-prompt');
  if (!elBody) return;

  // === Quality meter ===
  const meterContainer = document.createElement('div');
  elBody.appendChild(meterContainer);
  const { labelEl } = renderQualityMeter(meterContainer);
  // Phase 14: append info tooltip button next to meter label
  if (labelEl) initMeterTooltip(labelEl);

  // === Preview region (role=region for a11y) ===
  const region = document.createElement('div');
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', 'Generated prompt');
  region.className = 'prompt-region';

  // Preview header: action buttons top-right (Phase 14 UAT 4.1)
  const previewHeader = document.createElement('div');
  previewHeader.className = 'prompt-preview-header';

  // aria-live status span for screen readers (visually hidden, UAT 4.2)
  elCopyStatus = document.createElement('span');
  elCopyStatus.className = 'copy-status sr-only';
  elCopyStatus.setAttribute('aria-live', 'polite');

  // Copy button: clipboard icon + check icon
  copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn-action btn-copy';
  const clipboardIcon = icon('copy', 'icon-btn');
  clipboardIcon.classList.add('icon-clipboard');
  const checkIcon = icon('check', 'icon-btn');
  checkIcon.classList.add('icon-check');
  copyBtn.appendChild(clipboardIcon);
  copyBtn.appendChild(checkIcon);
  copyBtn.appendChild(document.createTextNode(' Copy'));
  copyBtn.addEventListener('click', onCopy);

  // Prompt Claude button (OUT-07): deep-links to claude.ai/new?q=<encoded-prompt>
  const promptClaudeBtn = document.createElement('button');
  promptClaudeBtn.type = 'button';
  promptClaudeBtn.className = 'btn-action btn-action--primary';
  promptClaudeBtn.appendChild(icon('paper-airplane', 'icon-btn'));
  promptClaudeBtn.appendChild(document.createTextNode(' Prompt Claude'));
  promptClaudeBtn.title =
    'Open Claude in a new tab with this prompt pre-filled in the chat input';
  promptClaudeBtn.addEventListener('click', onPromptClaude);

  previewHeader.appendChild(elCopyStatus);
  previewHeader.appendChild(copyBtn);
  previewHeader.appendChild(promptClaudeBtn);

  // Prompt preview (OUT-01: XML-tagged output, OUT-02: flow-specific format)
  elPreview = document.createElement('pre');
  elPreview.className = 'prompt-output';

  region.appendChild(previewHeader);
  region.appendChild(elPreview);

  // === Notes section (OUT-06) ===
  const notesSection = document.createElement('div');
  notesSection.className = 'prompt-notes';

  const notesLabel = document.createElement('label');
  notesLabel.htmlFor = 'notes-user-text';
  notesLabel.className = 'field-label';
  notesLabel.textContent = 'Notes';

  elNotes = document.createElement('textarea');
  elNotes.id = 'notes-user-text';
  elNotes.className = 'input-field field-textarea';
  elNotes.placeholder = 'Optional notes appended to your prompt\u2026';
  elNotes.rows = 3;
  elNotes.addEventListener('input', () => onNotesChange(elNotes.value));

  notesSection.appendChild(notesLabel);
  notesSection.appendChild(elNotes);

  elBody.appendChild(region);
  elBody.appendChild(notesSection);

  // Initial render
  renderPromptCard();

  // OUT-03: subscribe to all state changes for live prompt updates
  subscribe(renderPromptCard);
}
