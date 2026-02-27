// @vitest-environment jsdom
/**
 * Tests for card-prompt.js
 * OUT-01..08: Prompt rendering, copy button, notes, Prompt Claude deep-link.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Flush all pending microtasks (promise callbacks)
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// --- Mock state ---

const MOCK_PROMPT =
  '<prompt><context>Please help debug</context><todo>Step 1: Read @claude.md</todo></prompt>';

const mockState = {
  task: { flow_id: 'fix' },
  configuration: {
    owner: 'testuser',
    repo: 'testrepo',
    branch: 'main',
    pat: 'ghp_test',
  },
  panel_a: {
    description: '',
    issue_number: null,
    pr_number: null,
    files: [],
  },
  panel_b: {
    description: '',
    issue_number: null,
    spec_files: [],
    guideline_files: [],
    acceptance_criteria: '',
    lenses: [],
  },
  steps: { enabled_steps: [], removed_step_ids: [] },
  improve_scope: null,
  notes: { user_text: '' },
  _prompt: MOCK_PROMPT,
};

vi.mock('../src/js/state.js', () => ({
  getState: vi.fn(() => structuredClone(mockState)),
  setState: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

import { initPromptCard } from '../src/js/card-prompt.js';
import { getState, setState, subscribe } from '../src/js/state.js';

// --- Setup helpers ---

function createPromptCard() {
  document.body.innerHTML = `
    <section class="card" id="card-prompt">
      <button class="card-header" aria-expanded="false" aria-controls="bd-prompt"></button>
      <div class="card-body" id="bd-prompt"></div>
    </section>
  `;
}

beforeEach(() => {
  createPromptCard();
  vi.clearAllMocks();
  getState.mockReturnValue(structuredClone(mockState));
  subscribe.mockReturnValue(() => {});
});

afterEach(() => {
  document.body.innerHTML = '';
});

// --- Tests ---

describe('initPromptCard — rendering', () => {
  it('renders prompt preview with content from state._prompt (OUT-01, OUT-02)', () => {
    initPromptCard();
    const preview = document.querySelector('.prompt-output');
    expect(preview).toBeTruthy();
    expect(preview.textContent).toBe(MOCK_PROMPT);
  });

  it('shows empty-state message when _prompt is empty', () => {
    getState.mockReturnValue({ ...mockState, _prompt: '' });
    initPromptCard();
    const preview = document.querySelector('.prompt-output');
    expect(preview.textContent).toBe('Select a flow to generate a prompt.');
    expect(preview.classList.contains('prompt-output--empty')).toBe(true);
  });

  it('removes empty class when prompt is present', () => {
    initPromptCard();
    const preview = document.querySelector('.prompt-output');
    expect(preview.classList.contains('prompt-output--empty')).toBe(false);
  });

  it('preview region has role=region and aria-label (a11y)', () => {
    initPromptCard();
    const region = document.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    expect(region.getAttribute('aria-label')).toBe('Generated prompt');
  });

  it('subscribes to state changes for live updates (OUT-03)', () => {
    initPromptCard();
    expect(subscribe).toHaveBeenCalled();
  });

  it('updates preview when subscriber fires with new prompt', () => {
    let subscribedCallback = null;
    subscribe.mockImplementation((cb) => {
      subscribedCallback = cb;
      return () => {};
    });

    initPromptCard();

    const newPrompt = '<prompt><context>updated</context></prompt>';
    getState.mockReturnValue({ ...mockState, _prompt: newPrompt });
    subscribedCallback();

    const preview = document.querySelector('.prompt-output');
    expect(preview.textContent).toBe(newPrompt);
  });
});

describe('initPromptCard — Copy button (OUT-05)', () => {
  it('renders a Copy button', () => {
    initPromptCard();
    const copyBtn = Array.from(document.querySelectorAll('.btn-action')).find(
      (b) => b.textContent === 'Copy'
    );
    expect(copyBtn).toBeTruthy();
  });

  it('copy status span has aria-live=polite (a11y)', () => {
    initPromptCard();
    const status = document.querySelector('.copy-status');
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('calls clipboard.writeText with the current prompt on copy click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    initPromptCard();
    const copyBtn = Array.from(document.querySelectorAll('.btn-action')).find(
      (b) => b.textContent === 'Copy'
    );
    copyBtn.click();

    expect(writeText).toHaveBeenCalledWith(MOCK_PROMPT);
  });

  it('shows Copied! feedback on successful copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    initPromptCard();
    const copyBtn = Array.from(document.querySelectorAll('.btn-action')).find(
      (b) => b.textContent === 'Copy'
    );
    copyBtn.click();
    await flushPromises();

    const status = document.querySelector('.copy-status');
    expect(status.textContent).toBe('Copied!');
    expect(status.dataset.type).toBe('success');
  });

  it('shows Copy failed feedback on clipboard rejection', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    initPromptCard();
    const copyBtn = Array.from(document.querySelectorAll('.btn-action')).find(
      (b) => b.textContent === 'Copy'
    );
    copyBtn.click();
    await flushPromises();

    const status = document.querySelector('.copy-status');
    expect(status.textContent).toBe('Copy failed');
    expect(status.dataset.type).toBe('error');
  });

  it('does not call clipboard.writeText when prompt is empty', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    getState.mockReturnValue({ ...mockState, _prompt: '' });
    initPromptCard();
    const copyBtn = Array.from(document.querySelectorAll('.btn-action')).find(
      (b) => b.textContent === 'Copy'
    );
    copyBtn.click();

    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('initPromptCard — Prompt Claude deep-link (OUT-07)', () => {
  it('renders a Prompt Claude button', () => {
    initPromptCard();
    const openBtn = Array.from(document.querySelectorAll('.btn-action')).find(
      (b) => b.textContent.includes('Prompt Claude')
    );
    expect(openBtn).toBeTruthy();
  });

  it('opens claude.ai/new?q= with encoded prompt on click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    initPromptCard();

    const openBtn = Array.from(document.querySelectorAll('.btn-action')).find(
      (b) => b.textContent.includes('Prompt Claude')
    );
    openBtn.click();

    expect(openSpy).toHaveBeenCalledOnce();
    const [url, target, features] = openSpy.mock.calls[0];
    expect(url).toContain('claude.ai/new');
    expect(url).toContain(encodeURIComponent(MOCK_PROMPT));
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');

    openSpy.mockRestore();
  });

  it('opens claude.ai/new without query param when no prompt', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    getState.mockReturnValue({ ...mockState, _prompt: '' });

    initPromptCard();
    const openBtn = Array.from(document.querySelectorAll('.btn-action')).find(
      (b) => b.textContent.includes('Prompt Claude')
    );
    openBtn.click();

    expect(openSpy.mock.calls[0][0]).toBe('https://claude.ai/new');
    openSpy.mockRestore();
  });
});

describe('initPromptCard — Notes textarea (OUT-06)', () => {
  it('renders a notes textarea', () => {
    initPromptCard();
    expect(document.querySelector('textarea')).toBeTruthy();
  });

  it('notes textarea has a label', () => {
    initPromptCard();
    const label = document.querySelector('label[for="notes-user-text"]');
    expect(label).toBeTruthy();
    expect(label.textContent).toBe('Notes');
  });

  it('notes textarea is pre-populated from state.notes.user_text', () => {
    getState.mockReturnValue({
      ...mockState,
      notes: { user_text: 'Important context here' },
    });
    initPromptCard();
    const textarea = document.querySelector('textarea');
    expect(textarea.value).toBe('Important context here');
  });

  it('calls setState with notes.user_text on textarea input', () => {
    initPromptCard();
    const textarea = document.querySelector('textarea');
    textarea.value = 'new note text';
    textarea.dispatchEvent(new Event('input'));
    expect(setState).toHaveBeenCalledWith('notes.user_text', 'new note text');
  });

  it('notes textarea does not update when it has active focus', () => {
    let subscribedCallback = null;
    subscribe.mockImplementation((cb) => {
      subscribedCallback = cb;
      return () => {};
    });

    initPromptCard();
    const textarea = document.querySelector('textarea');
    textarea.value = 'typed by user';

    // Simulate textarea having active focus
    Object.defineProperty(document, 'activeElement', {
      get: () => textarea,
      configurable: true,
    });

    getState.mockReturnValue({
      ...mockState,
      notes: { user_text: 'from state' },
    });
    subscribedCallback();

    // Should preserve the user's typed value
    expect(textarea.value).toBe('typed by user');

    // Restore activeElement
    Object.defineProperty(document, 'activeElement', {
      get: () => document.body,
      configurable: true,
    });
  });
});

describe('initPromptCard — Card behavior (OUT-08)', () => {
  it('does not auto-collapse the card on state changes', () => {
    let subscribedCallback = null;
    subscribe.mockImplementation((cb) => {
      subscribedCallback = cb;
      return () => {};
    });

    // Simulate card being expanded
    const card = document.getElementById('card-prompt');
    card.classList.add('card--open');
    card.querySelector('.card-header').setAttribute('aria-expanded', 'true');

    initPromptCard();

    // Trigger multiple state changes
    subscribedCallback();
    subscribedCallback();

    // Card should remain expanded
    expect(card.classList.contains('card--open')).toBe(true);
    expect(
      card.querySelector('.card-header').getAttribute('aria-expanded')
    ).toBe('true');
  });
});
