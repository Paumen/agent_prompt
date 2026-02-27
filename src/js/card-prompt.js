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

// --- Module-level references ---

let elBody = null;
let elPreview = null;
let elCopyStatus = null;
let elNotes = null;

// --- Rendering ---

function renderPromptCard() {
  if (!elBody) return;

  const state = getState();
  const prompt = state._prompt || '';

  // OUT-01, OUT-03: live preview, fully regenerated from current state
  if (elPreview) {
    if (prompt) {
      elPreview.textContent = prompt;
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
    () => showCopyStatus('Copied!', 'success'),
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

// --- Initialization ---

// Copy SVG icon (4.2)
const ICON_COPY = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true" style="display:block"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`;

export function initPromptCard() {
  elBody = document.getElementById('bd-prompt');
  if (!elBody) return;

  // === Quality meter (2.3 — moved from task card) ===
  const meterContainer = document.createElement('div');
  elBody.appendChild(meterContainer);
  renderQualityMeter(meterContainer);

  // === Preview region (role=region for a11y) ===
  const region = document.createElement('div');
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', 'Generated prompt');
  region.className = 'prompt-region';

  // Preview header: copy status + action buttons (4.1 — "Prompt" label removed)
  const previewHeader = document.createElement('div');
  previewHeader.className = 'prompt-preview-header';

  // Copy status span (aria-live for screen readers, OUT-05)
  elCopyStatus = document.createElement('span');
  elCopyStatus.className = 'copy-status';
  elCopyStatus.setAttribute('aria-live', 'polite');

  // Copy button with icon (OUT-05, 4.2)
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn-action';
  copyBtn.innerHTML = `${ICON_COPY} Copy`;
  copyBtn.addEventListener('click', onCopy);

  // Prompt Claude button (OUT-07): deep-links to claude.ai/new?q=<encoded-prompt>
  const promptClaudeBtn = document.createElement('button');
  promptClaudeBtn.type = 'button';
  promptClaudeBtn.className = 'btn-action btn-action--primary';
  promptClaudeBtn.textContent = 'Prompt Claude \u2197';
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
