// @vitest-environment jsdom
/**
 * Tests for card-prompt.js
 * OUT-01..08: Prompt rendering, copy button, notes, Prompt Claude deep-link.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

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
  panel_a: { description: '', issue_number: null, pr_number: null, files: [] },
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

vi.mock('../src/core/state.js', () => ({
  getState: vi.fn(() => structuredClone(mockState)),
  setState: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock('../src/js/quality-meter.js', () => ({
  renderQualityMeter: vi.fn((container) => {
    container.className = 'quality-meter';
    const labelEl = document.createElement('div');
    labelEl.className = 'quality-meter-label';
    container.appendChild(labelEl);
    return { update: vi.fn(), unsubscribe: vi.fn(), labelEl };
  }),
}));

import { initPromptCard, highlightXml } from '../src/js/card-prompt.js';
import { getState, setState, subscribe } from '../src/core/state.js';

function createPromptCard() {
  document.body.innerHTML = `
    <section class="card" id="card-prompt">
      <button class="card-header" aria-expanded="false"></button>
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

describe('highlightXml', () => {
  it('wraps XML tags in spans and escapes content', () => {
    const result = highlightXml('<prompt>text & more</prompt>');
    expect(result).toContain('<span class="xml-tag">');
    expect(result).toContain('&lt;prompt&gt;');
    expect(result).toContain('&amp;');
  });

  it('textContent of highlighted output equals original', () => {
    const el = document.createElement('span');
    el.innerHTML = highlightXml(MOCK_PROMPT);
    expect(el.textContent).toBe(MOCK_PROMPT);
  });
});

describe('initPromptCard — rendering', () => {
  it('renders prompt preview with XML highlighting, empty state when no prompt', () => {
    initPromptCard();
    const previewCode = document.querySelector('.prompt-output code');
    expect(previewCode.textContent).toBe(MOCK_PROMPT);
    expect(previewCode.innerHTML).toContain('<span class="xml-tag">');
    expect(
      previewCode
        .closest('.prompt-output')
        .classList.contains('prompt-output--empty')
    ).toBe(false);

    // Empty state
    getState.mockReturnValue({ ...mockState, _prompt: '' });
    createPromptCard();
    initPromptCard();
    const emptyCode = document.querySelector('.prompt-output code');
    expect(emptyCode.textContent).toBe('Select a flow to generate a prompt.');
    expect(
      emptyCode
        .closest('.prompt-output')
        .classList.contains('prompt-output--empty')
    ).toBe(true);
  });

  it('subscribes to state and updates preview', () => {
    let cb = null;
    subscribe.mockImplementation((fn) => {
      cb = fn;
      return () => {};
    });
    initPromptCard();

    const newPrompt = '<prompt>updated</prompt>';
    getState.mockReturnValue({ ...mockState, _prompt: newPrompt });
    cb();

    expect(document.querySelector('.prompt-output code').textContent).toBe(
      newPrompt
    );
  });
});

describe('initPromptCard — Copy button', () => {
  it('copies prompt to clipboard and shows success/failure feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    initPromptCard();
    document.querySelector('.btn-copy').click();

    expect(writeText).toHaveBeenCalledWith(MOCK_PROMPT);
    await flushPromises();
    expect(
      document.querySelector('.btn-copy').classList.contains('btn--copied')
    ).toBe(true);
    expect(
      document.querySelector('.sr-only[aria-live="polite"]').textContent
    ).toBe('Copied!');
  });

  it('shows error on clipboard failure', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('fail'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    initPromptCard();
    document.querySelector('.btn-copy').click();
    await flushPromises();

    expect(
      document.querySelector('.sr-only[aria-live="polite"]').textContent
    ).toBe('Copy failed');
  });

  it('does not copy when prompt is empty', () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    getState.mockReturnValue({ ...mockState, _prompt: '' });
    initPromptCard();
    document.querySelector('.btn-copy').click();

    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('initPromptCard — Notes textarea', () => {
  it('renders textarea populated from state and updates on input', () => {
    getState.mockReturnValue({ ...mockState, notes: { user_text: 'my note' } });
    initPromptCard();

    const textarea = document.querySelector('textarea');
    expect(textarea.value).toBe('my note');

    textarea.value = 'updated';
    textarea.dispatchEvent(new Event('input'));
    expect(setState).toHaveBeenCalledWith('notes.user_text', 'updated');
  });

  it('preserves user input when textarea has focus during state update', () => {
    let cb = null;
    subscribe.mockImplementation((fn) => {
      cb = fn;
      return () => {};
    });
    initPromptCard();

    const textarea = document.querySelector('textarea');
    textarea.value = 'typing';
    Object.defineProperty(document, 'activeElement', {
      get: () => textarea,
      configurable: true,
    });

    getState.mockReturnValue({
      ...mockState,
      notes: { user_text: 'from state' },
    });
    cb();

    expect(textarea.value).toBe('typing');
  });
});

describe('initPromptCard — Prompt Claude button', () => {
  it('opens claude.ai/new with encoded prompt', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    initPromptCard();

    const btn = document.querySelector('.btn-primary');
    btn.click();

    const url = openSpy.mock.calls[0][0];
    expect(url).toContain('claude.ai/new');
    expect(url).toContain(encodeURIComponent(MOCK_PROMPT));
    openSpy.mockRestore();
  });
});

describe('initPromptCard — Quality meter tooltip', () => {
  it('toggles tooltip on info button click', () => {
    initPromptCard();
    const btn = document.querySelector('.meter-info-wrapper .btn-icon');
    const tooltip = document.querySelector('.meter-tooltip');

    expect(tooltip.classList.contains('meter-tooltip--visible')).toBe(false);
    btn.click();
    expect(tooltip.classList.contains('meter-tooltip--visible')).toBe(true);
    btn.click();
    expect(tooltip.classList.contains('meter-tooltip--visible')).toBe(false);
  });
});
