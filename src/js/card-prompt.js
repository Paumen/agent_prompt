/**
 * Card 4: Prompt Output
 *
 * Live prompt preview, copy to clipboard, deep-link to Claude with prompt
 * pre-filled, optional notes textarea.
 *
 * Req IDs: OUT-01..08
 */

import { getState, setState, subscribe } from './state.js';
import { renderQualityMeter } from './quality-meter.js';
import { icon } from './icons.js';
import { createButton, createInputField, createLabel } from './ui.js';

// --- Module-level references ---

let elBody = null;
let elPreview = null;
let elCopyStatus = null;
let elNotes = null;
let copyBtn = null;

// --- XML Syntax Highlighting ---

/**
 * Escape HTML special chars and wrap XML tag patterns in highlight spans.
 * Security: all text-node content is fully escaped before innerHTML injection.
 *
 * @param {string} text - raw prompt text
 * @returns {string} HTML string safe for innerHTML
 */
export function highlightXml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

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

  if (elPreview) {
    if (prompt) {
      elPreview.innerHTML = highlightXml(prompt);
      elPreview.parentElement.classList.remove('prompt-output--empty');
    } else {
      elPreview.textContent = 'Select a flow to generate a prompt.';
      elPreview.parentElement.classList.add('prompt-output--empty');
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
      if (copyBtn) {
        copyBtn.classList.add('btn--copied');
        setTimeout(() => copyBtn?.classList.remove('btn--copied'), 2000);
      }
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

// OUT-07: deep-link to Claude with prompt pre-filled
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

// --- Quality Meter Tooltip ---

function initMeterTooltip(labelEl) {
  const wrapper = document.createElement('span');
  wrapper.className = 'meter-info-wrapper';

  const infoBtn = createButton('icon', {
    ariaLabel: 'How is the quality score calculated?',
    iconName: 'info',
    iconClass: 'icon-btn',
  });

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

  infoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = tooltip.classList.toggle('meter-tooltip--visible');
    tooltip.setAttribute('aria-hidden', String(!isVisible));
  });

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
  if (labelEl) initMeterTooltip(labelEl);

  // === Prompt preview ===
  const preEl = document.createElement('pre');
  preEl.className = 'prompt-output';
  preEl.setAttribute('role', 'region');
  preEl.setAttribute('aria-label', 'Generated prompt');

  // Code element holds the text content (survives action bar)
  elPreview = document.createElement('code');
  preEl.appendChild(elPreview);

  // Action bar: positioned top-right inside preview via .prompt-output > .wrapper
  const actionBar = document.createElement('div');
  actionBar.className = 'wrapper wrapper--flex';

  // Screen reader copy status
  elCopyStatus = document.createElement('span');
  elCopyStatus.className = 'sr-only';
  elCopyStatus.setAttribute('aria-live', 'polite');

  // Copy button: dual icons (clipboard → check on copy)
  copyBtn = createButton('action', { onClick: onCopy });
  copyBtn.classList.add('btn-copy');
  copyBtn.textContent = ''; // clear default
  const clipboardIcon = icon('copy', 'icon-btn');
  clipboardIcon.classList.add('icon-clipboard');
  const checkIcon = icon('check', 'icon-btn');
  checkIcon.classList.add('icon-check');
  copyBtn.appendChild(clipboardIcon);
  copyBtn.appendChild(checkIcon);
  copyBtn.appendChild(document.createTextNode(' Copy'));

  // Prompt Claude button
  const promptClaudeBtn = createButton('primary', {
    label: ' Prompt Claude',
    iconName: 'paper-airplane',
    onClick: onPromptClaude,
    title:
      'Open Claude in a new tab with this prompt pre-filled in the chat input',
  });

  actionBar.appendChild(elCopyStatus);
  actionBar.appendChild(copyBtn);
  actionBar.appendChild(promptClaudeBtn);

  preEl.appendChild(actionBar);

  // === Notes section (OUT-06) — uses .input grid layout ===
  const notesRow = document.createElement('div');
  notesRow.className = 'input';

  const notesLabel = createLabel('Notes', { htmlFor: 'notes-user-text' });
  notesRow.appendChild(notesLabel);

  elNotes = createInputField({
    type: 'textarea',
    id: 'notes-user-text',
    placeholder: 'Optional notes appended to your prompt\u2026',
    rows: 3,
    onInput: () => onNotesChange(elNotes.value),
  });
  notesRow.appendChild(elNotes);

  elBody.appendChild(preEl);
  elBody.appendChild(notesRow);

  // Initial render
  renderPromptCard();

  // OUT-03: subscribe for live prompt updates
  subscribe(renderPromptCard);
}
