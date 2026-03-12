// @vitest-environment jsdom
/**
 * Tests for card-prompt.js
 *
 * Tests UI behaviors specific to prompt card:
 * - XML highlighting
 * - Copy button (success/failure feedback)
 * - Description textareas (panel_a / panel_b)
 * - Prompt Claude deep-link
 *
 * Prompt generation is tested in prompt-builder.test.js and e2e.test.js
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setupPromptCard, cleanupDOM } from './helpers/dom-fixtures.js';
import { createMockState } from './helpers/state-factory.js';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const MOCK_PROMPT =
  '<prompt><context>Please help debug</context><todo>Step 1: Read @claude.md</todo></prompt>';

const mockState = createMockState({
  task: { flow_id: 'fix' },
  configuration: {
    owner: 'testuser',
    repo: 'testrepo',
    branch: 'main',
    pat: 'ghp_test',
  },
  _prompt: MOCK_PROMPT,
});

vi.mock('../src/core/state.js', () => ({
  getState: vi.fn(() => structuredClone(mockState)),
  setState: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  getValueByPath: vi.fn((obj, path) =>
    path.split('.').reduce((o, k) => o?.[k], obj)
  ),
}));

vi.mock('../src/logic/flow-loader.js', () => ({
  getFlowById: vi.fn((flowId) => {
    if (flowId === 'fix') {
      return {
        panel_a: {
          label: 'Current State',
          fields: {
            description: {
              type: 'text',
              placeholder: 'Describe the issue...',
            },
          },
        },
        panel_b: {
          label: 'Expected Outcome',
          fields: {
            description: {
              type: 'text',
              placeholder: 'Describe expected behavior...',
            },
          },
        },
      };
    }
    return null;
  }),
}));

import { initPromptCard, highlightXml } from '../src/cards/card-prompt.js';
import { getState, setState, subscribe } from '../src/core/state.js';

beforeEach(() => {
  setupPromptCard();
  vi.clearAllMocks();
  getState.mockReturnValue(structuredClone(mockState));
  subscribe.mockReturnValue(() => {});
});

afterEach(() => {
  cleanupDOM();
});

// --- Tests ---

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

describe('Copy button', () => {
  it('copies prompt to clipboard and shows success feedback', async () => {
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

    getState.mockReturnValue(createMockState({ _prompt: '' }));
    initPromptCard();
    document.querySelector('.btn-copy').click();

    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('Description textareas', () => {
  it('renders two textareas for panel_a and panel_b descriptions', () => {
    initPromptCard();
    const textareas = document.querySelectorAll('textarea');
    expect(textareas.length).toBe(2);
  });

  it('updates panel_a.description state on input', () => {
    initPromptCard();
    const textareas = document.querySelectorAll('textarea');
    textareas[0].value = 'bug description';
    textareas[0].dispatchEvent(new Event('input'));
    expect(setState).toHaveBeenCalledWith(
      'panel_a.description',
      'bug description'
    );
  });

  it('updates panel_b.description state on input', () => {
    initPromptCard();
    const textareas = document.querySelectorAll('textarea');
    textareas[1].value = 'expected behavior';
    textareas[1].dispatchEvent(new Event('input'));
    expect(setState).toHaveBeenCalledWith(
      'panel_b.description',
      'expected behavior'
    );
  });

  it('populates textareas from state', () => {
    getState.mockReturnValue(
      createMockState({
        task: { flow_id: 'fix' },
        panel_a: { description: 'existing bug' },
        panel_b: { description: 'should work' },
        _prompt: MOCK_PROMPT,
      })
    );
    initPromptCard();

    const textareas = document.querySelectorAll('textarea');
    expect(textareas[0].value).toBe('existing bug');
    expect(textareas[1].value).toBe('should work');
  });

  it('preserves user input when textarea has focus during state update', () => {
    let cb = null;
    subscribe.mockImplementation((fn) => {
      cb = fn;
      return () => {};
    });
    initPromptCard();

    const textareas = document.querySelectorAll('textarea');
    textareas[0].value = 'typing';
    Object.defineProperty(document, 'activeElement', {
      get: () => textareas[0],
      configurable: true,
    });

    getState.mockReturnValue(
      createMockState({
        task: { flow_id: 'fix' },
        panel_a: { description: 'from state' },
        _prompt: MOCK_PROMPT,
      })
    );
    cb();

    expect(textareas[0].value).toBe('typing');
  });
});

describe('Prompt Claude button', () => {
  it('opens claude.ai/new with encoded prompt', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    initPromptCard();

    document.querySelector('.btn-primary').click();

    const url = openSpy.mock.calls[0][0];
    expect(url).toContain('claude.ai/new');
    expect(url).toContain(encodeURIComponent(MOCK_PROMPT));
    openSpy.mockRestore();
  });
});
