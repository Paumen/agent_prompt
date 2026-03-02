// @vitest-environment jsdom
/**
 * Tests for card-prompt.js
 * OUT-01..08: Prompt rendering, copy button, notes, Prompt Claude deep-link.
 * Phase 14: highlightXml, copy icon swap, quality meter tooltip.
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

// Quality meter mock: returns a real labelEl so tooltip tests work
let mockLabelEl = null;
vi.mock('../src/js/quality-meter.js', () => ({
  renderQualityMeter: vi.fn((container) => {
    container.className = 'quality-meter';
    mockLabelEl = document.createElement('div');
    mockLabelEl.className = 'quality-meter-label';
    container.appendChild(mockLabelEl);
    return { update: vi.fn(), unsubscribe: vi.fn(), labelEl: mockLabelEl };
  }),
}));

import { initPromptCard, highlightXml } from '../src/js/card-prompt.js';
import { getState, setState, subscribe } from '../src/js/state.js';
import { renderQualityMeter } from '../src/js/quality-meter.js';

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
  mockLabelEl = null;
  getState.mockReturnValue(structuredClone(mockState));
  subscribe.mockReturnValue(() => {});
});

afterEach(() => {
  document.body.innerHTML = '';
});

// --- Phase 14: highlightXml unit tests ---

describe('highlightXml (Phase 14 UAT 4.4)', () => {
  it('wraps XML open tags in xml-tag spans', () => {
    const result = highlightXml('<prompt>');
    expect(result).toContain('<span class="xml-tag">');
    expect(result).toContain('&lt;prompt&gt;');
  });

  it('wraps XML closing tags in xml-tag spans', () => {
    const result = highlightXml('</task>');
    expect(result).toContain('<span class="xml-tag">&lt;/task&gt;</span>');
  });

  it('escapes text nodes (no HTML injection)', () => {
    const result = highlightXml('hello & <world>');
    // & escaped to &amp;
    expect(result).toContain('&amp;');
    // The < > around "world" form an XML tag and get wrapped, but escaped
    expect(result).not.toContain('<world>');
  });

  it('leaves plain text unchanged (except HTML escaping)', () => {
    const result = highlightXml('Step 1: Read @file.js');
    expect(result).toBe('Step 1: Read @file.js');
    expect(result).not.toContain('<span');
  });

  it('handles tags with attributes', () => {
    const result = highlightXml('<task flow="fix">');
    expect(result).toContain('<span class="xml-tag">');
    expect(result).toContain('&lt;task flow=');
    expect(result).toContain('&gt;</span>');
  });

  it('textContent of highlighted output equals original string', () => {
    // Create a temp element to verify round-trip
    const el = document.createElement('span');
    el.innerHTML = highlightXml(MOCK_PROMPT);
    expect(el.textContent).toBe(MOCK_PROMPT);
  });

  it('escapes ampersands in text nodes', () => {
    const result = highlightXml('a & b');
    expect(result).toBe('a &amp; b');
  });

  it('handles empty string', () => {
    expect(highlightXml('')).toBe('');
  });
});

// --- Tests ---

describe('initPromptCard — quality meter (2.3)', () => {
  it('renders quality meter in prompt card', () => {
    initPromptCard();
    expect(renderQualityMeter).toHaveBeenCalled();
  });
});

describe('initPromptCard — rendering (Phase 14: uses innerHTML for XML highlight)', () => {
  it('renders prompt preview with correct text content from state._prompt (OUT-01, OUT-02)', () => {
    initPromptCard();
    const preview = document.querySelector('.prompt-output');
    expect(preview).toBeTruthy();
    // textContent equals original since span wrappers don't add text
    expect(preview.textContent).toBe(MOCK_PROMPT);
  });

  it('prompt preview uses innerHTML (XML highlighting active)', () => {
    initPromptCard();
    const preview = document.querySelector('.prompt-output');
    // The preview should contain xml-tag spans wrapping the XML tags
    expect(preview.innerHTML).toContain('<span class="xml-tag">');
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

  it('updates preview textContent when subscriber fires with new prompt', () => {
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
    const btn = document.querySelector('.btn-copy');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Copy');
  });

  it('copy button has clipboard and check icons pre-rendered in DOM (Phase 14 UAT 4.2)', () => {
    initPromptCard();
    const btn = document.querySelector('.btn-copy');
    expect(btn.querySelector('.icon-clipboard')).toBeTruthy();
    expect(btn.querySelector('.icon-check')).toBeTruthy();
  });

  it('copy status span has aria-live=polite and sr-only class (a11y)', () => {
    initPromptCard();
    const status = document.querySelector('.copy-status');
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.classList.contains('sr-only')).toBe(true);
  });

  it('calls clipboard.writeText with the current prompt on copy click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    initPromptCard();
    document.querySelector('.btn-copy').click();

    expect(writeText).toHaveBeenCalledWith(MOCK_PROMPT);
  });

  it('adds btn--copied class on successful copy (Phase 14 UAT 4.2)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    initPromptCard();
    const btn = document.querySelector('.btn-copy');
    btn.click();
    await flushPromises();

    expect(btn.classList.contains('btn--copied')).toBe(true);
  });

  it('updates aria-live status span on successful copy (screen reader feedback)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    initPromptCard();
    document.querySelector('.btn-copy').click();
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
    document.querySelector('.btn-copy').click();
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
    document.querySelector('.btn-copy').click();

    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('initPromptCard — Prompt Claude deep-link (OUT-07)', () => {
  it('renders a Prompt Claude button with primary class', () => {
    initPromptCard();
    const btn = Array.from(document.querySelectorAll('.btn-action')).find((b) =>
      b.textContent.includes('Prompt Claude')
    );
    expect(btn).toBeTruthy();
    expect(btn.classList.contains('btn-action--primary')).toBe(true);
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

describe('initPromptCard — Quality meter tooltip (Phase 14 UAT 5)', () => {
  it('renders an info button next to the quality meter label', () => {
    initPromptCard();
    const infoBtn = document.querySelector('.meter-info-btn');
    expect(infoBtn).toBeTruthy();
  });

  it('info button has aria-label for accessibility', () => {
    initPromptCard();
    const infoBtn = document.querySelector('.meter-info-btn');
    expect(infoBtn.getAttribute('aria-label')).toBeTruthy();
  });

  it('tooltip is hidden by default', () => {
    initPromptCard();
    const tooltip = document.querySelector('.meter-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip.classList.contains('meter-tooltip--visible')).toBe(false);
    expect(tooltip.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows tooltip when info button is clicked', () => {
    initPromptCard();
    const infoBtn = document.querySelector('.meter-info-btn');
    infoBtn.click();
    const tooltip = document.querySelector('.meter-tooltip');
    expect(tooltip.classList.contains('meter-tooltip--visible')).toBe(true);
    expect(tooltip.getAttribute('aria-hidden')).toBe('false');
  });

  it('hides tooltip on second click (toggle)', () => {
    initPromptCard();
    const infoBtn = document.querySelector('.meter-info-btn');
    infoBtn.click();
    infoBtn.click();
    const tooltip = document.querySelector('.meter-tooltip');
    expect(tooltip.classList.contains('meter-tooltip--visible')).toBe(false);
  });

  it('hides tooltip when clicking elsewhere on the document', () => {
    initPromptCard();
    const infoBtn = document.querySelector('.meter-info-btn');
    infoBtn.click();
    // Simulate document-level click
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const tooltip = document.querySelector('.meter-tooltip');
    expect(tooltip.classList.contains('meter-tooltip--visible')).toBe(false);
  });

  it('tooltip contains a plain-language description', () => {
    initPromptCard();
    const infoBtn = document.querySelector('.meter-info-btn');
    infoBtn.click();
    const tooltip = document.querySelector('.meter-tooltip');
    expect(tooltip.textContent.length).toBeGreaterThan(20);
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
