// @vitest-environment jsdom
/**
 * Tests for card-steps.js
 *
 * Tests UI behaviors specific to steps card:
 * - Step rendering with lenses and file pills
 * - Lens pill toggling
 * - Optional text inputs (branch name, PR name)
 * - Output mode buttons
 *
 * Step deletion → prompt update is tested in e2e.test.js
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setupStepsCard, cleanupDOM } from './helpers/dom-fixtures.js';
import { createMockState, createMockSteps } from './helpers/state-factory.js';

// --- Mock dependencies ---

const mockSteps = createMockSteps(4);

const mockState = createMockState({
  task: { flow_id: 'fix' },
  configuration: { owner: 'user', repo: 'repo', branch: 'main', pat: 'tok' },
  steps: { enabled_steps: mockSteps, removed_step_ids: [] },
});

vi.mock('../src/core/state.js', () => ({
  getState: vi.fn(() => structuredClone(mockState)),
  setState: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock('../src/logic/flow-loader.js', () => ({
  getFlowById: vi.fn(() => null),
  ALL_LENSES: [
    'semantics',
    'syntax',
    'security',
    'performance',
    'structure',
    'dependencies',
    'duplications',
    'redundancies',
    'error_handling',
    'naming_conventions',
    'test_coverage',
    'type_safety',
    'documentation_completeness',
    'accessibility',
  ],
}));

vi.mock('../src/logic/step-generator.js', () => ({
  generateSteps: vi.fn(() => []),
  reconcileSteps: vi.fn((generated) => generated),
}));

import { initStepsCard } from '../src/cards/card-steps.js';
import { getState, setState } from '../src/core/state.js';

// --- Setup ---

beforeEach(() => {
  setupStepsCard();
  vi.clearAllMocks();
  getState.mockReturnValue(structuredClone(mockState));
});

afterEach(() => {
  cleanupDOM();
});

// --- Tests ---

describe('Step rendering (STP-01)', () => {
  it('renders step list from state with correct labels', () => {
    initStepsCard();
    const rows = document.querySelectorAll('.output-field');
    // Step 0 (context row) + 4 enabled steps
    expect(rows.length).toBe(5);
    expect(rows[0].children[0].textContent).toContain('Context');
    expect(rows[1].children[0].textContent).toContain('Read: @claude.md');
    expect(rows[2].children[0].textContent).toContain('Analyze: issue');
  });

  it('uses ordered list for step numbering', () => {
    initStepsCard();
    expect(document.querySelector('#bd-steps ol').tagName).toBe('OL');
  });

  it('adds data-step-id attribute', () => {
    initStepsCard();
    expect(document.querySelector('[data-step-id="read-claude"]')).toBeTruthy();
  });

  it('shows empty state when no steps', () => {
    getState.mockReturnValue(
      createMockState({
        steps: { enabled_steps: [], removed_step_ids: [] },
      })
    );
    initStepsCard();
    expect(document.getElementById('bd-steps').textContent).toContain(
      'Select a flow'
    );
  });
});

describe('Lens pills (STP-03)', () => {
  it('renders lens pills on steps with lenses, marks active correctly', () => {
    initStepsCard();
    const row = document.querySelector('[data-step-id="identify-cause"]');
    const pills = row.querySelectorAll('.btn-pill');

    expect(pills.length).toBeGreaterThan(0);

    const semanticsPill = Array.from(pills).find(
      (p) => p.textContent === 'semantics'
    );
    expect(semanticsPill.getAttribute('aria-checked')).toBe('true');
    expect(semanticsPill.classList.contains('btn-pill--on')).toBe(true);

    const securityPill = Array.from(pills).find(
      (p) => p.textContent === 'security'
    );
    expect(securityPill.getAttribute('aria-checked')).toBe('false');
  });

  it('calls setState when lens pill is clicked', () => {
    initStepsCard();
    document.querySelector('[data-step-id="identify-cause"] .btn-pill').click();
    expect(setState).toHaveBeenCalledWith(
      'steps.enabled_steps',
      expect.any(Array)
    );
  });
});

describe('File pills', () => {
  beforeEach(() => {
    getState.mockReturnValue(
      createMockState({
        panel_a: { files: ['src/app.js', 'src/utils.js'] },
        steps: {
          enabled_steps: [
            {
              id: 'read-files',
              operation: 'read',
              object: 'files',
              source: 'panel_a.files',
              params: { files: ['src/app.js', 'src/utils.js'] },
            },
          ],
          removed_step_ids: [],
        },
      })
    );
  });

  it('renders file tags with remove buttons', () => {
    initStepsCard();
    expect(document.querySelectorAll('.tag').length).toBe(2);
    expect(
      document.querySelectorAll('.tag .btn-icon[aria-label^="Remove"]').length
    ).toBe(2);
  });

  it('clicking remove calls setState', () => {
    initStepsCard();
    document.querySelector('.tag .btn-icon[aria-label^="Remove"]').click();
    // File removal now updates the step's own params.files (per-step ownership)
    expect(setState).toHaveBeenCalledWith(
      'steps.enabled_steps',
      expect.arrayContaining([
        expect.objectContaining({ params: { files: ['src/utils.js'] } }),
      ])
    );
  });
});

describe('Optional text inputs', () => {
  it('renders text inputs for steps with branch_name or pr_name', () => {
    initStepsCard();
    expect(
      document.querySelector('[data-step-id="create-branch"] input.input-field')
    ).toBeTruthy();
    expect(
      document.querySelector('[data-step-id="commit-pr"] input.input-field')
    ).toBeTruthy();
  });

  it('calls setState on input change', () => {
    initStepsCard();
    const input = document.querySelector(
      '[data-step-id="create-branch"] input.input-field'
    );
    input.value = 'fix/bug-123';
    input.dispatchEvent(new Event('input'));
    expect(setState).toHaveBeenCalled();
  });
});

describe('Output mode buttons', () => {
  beforeEach(() => {
    getState.mockReturnValue(
      createMockState({
        task: { flow_id: 'review' },
        steps: {
          enabled_steps: [
            {
              id: 'feedback',
              operation: 'create',
              object: 'review_feedback',
              output: ['here', 'pr_comment', 'pr_inline_comments'],
            },
          ],
          removed_step_ids: [],
        },
      })
    );
  });

  it('renders output buttons with correct roles', () => {
    initStepsCard();
    const btns = document.querySelectorAll('.btn-pill[role="checkbox"]');
    // 2 step-0 context pills (Repo + PAT) + 3 output mode buttons
    expect(btns.length).toBe(5);
    expect(btns[0].getAttribute('role')).toBe('checkbox');
    expect(btns[0].getAttribute('aria-checked')).toBe('true');
  });

  it('calls setState on click', () => {
    initStepsCard();
    document.querySelectorAll('.btn-pill[role="checkbox"]')[1].click();
    expect(setState).toHaveBeenCalled();
  });
});
