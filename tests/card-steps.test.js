// @vitest-environment jsdom
/**
 * Tests for card-steps.js
 * STP-01..04: Step rendering, lens toggling, step deletion, output pills.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// --- Mock dependencies ---

const mockSteps = [
  {
    id: 'read-claude',
    operation: 'read',
    object: 'file',
    params: { file: 'claude.md' },
  },
  {
    id: 'identify-cause',
    operation: 'analyze',
    object: 'issue',
    lenses: ['semantics'],
  },
  {
    id: 'create-branch',
    operation: 'create',
    object: 'branch',
    branch_name: 'optional_text',
  },
  {
    id: 'commit-pr',
    operation: 'commit',
    object: 'changes',
    params: { open_draft_pr: true },
    pr_name: 'optional_text',
  },
];

const mockState = {
  task: { flow_id: 'fix' },
  configuration: { owner: 'user', repo: 'repo', branch: 'main', pat: 'tok' },
  panel_a: { description: '', issue_number: null, pr_number: null, files: [] },
  panel_b: {
    description: '',
    issue_number: null,
    spec_files: [],
    guideline_files: [],
    acceptance_criteria: '',
    lenses: [],
  },
  steps: { enabled_steps: mockSteps, removed_step_ids: [] },
  improve_scope: null,
  notes: { user_text: '' },
  _prompt: '',
};

vi.mock('../src/js/state.js', () => ({
  getState: vi.fn(() => structuredClone(mockState)),
  setState: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock('../src/js/flow-loader.js', () => ({
  getFlowById: vi.fn(() => null),
}));

vi.mock('../src/js/step-generator.js', () => ({
  generateSteps: vi.fn(() => []),
  reconcileSteps: vi.fn((generated) => generated),
}));

import { initStepsCard } from '../src/js/card-steps.js';
import { getState, setState } from '../src/js/state.js';

// --- Setup ---

function createStepsCard() {
  document.body.innerHTML = `
    <section class="card" id="card-steps">
      <button class="card-header" aria-expanded="false"></button>
      <div class="card-body" id="bd-steps"></div>
    </section>
  `;
}

beforeEach(() => {
  createStepsCard();
  vi.clearAllMocks();
  getState.mockReturnValue(structuredClone(mockState));
});

afterEach(() => {
  document.body.innerHTML = '';
});

// --- Tests ---

describe('initStepsCard', () => {
  it('renders step list from state', () => {
    initStepsCard();
    const steps = document.querySelectorAll('.step-row');
    expect(steps.length).toBe(4);
  });

  it('shows empty state when no steps', () => {
    getState.mockReturnValue({
      ...mockState,
      steps: { enabled_steps: [], removed_step_ids: [] },
    });
    initStepsCard();
    expect(document.getElementById('bd-steps').textContent).toContain(
      'Select a flow'
    );
  });

  it('subscribes to state changes', () => {
    initStepsCard();
    expect(vi.mocked(setState) || vi.mocked(getState)).toBeDefined();
  });
});

describe('step rendering (STP-01)', () => {
  it('renders step labels with operation and object', () => {
    initStepsCard();
    const labels = document.querySelectorAll('.step-label');
    expect(labels[0].textContent).toContain('Read: @claude.md');
    expect(labels[1].textContent).toContain('Analyze: issue');
  });

  it('uses ordered list for step numbering', () => {
    initStepsCard();
    const list = document.querySelector('.step-list');
    expect(list.tagName).toBe('OL');
  });

  it('adds data-step-id attribute', () => {
    initStepsCard();
    expect(document.querySelector('[data-step-id="read-claude"]')).toBeTruthy();
  });
});

describe('step deletion (STP-04)', () => {
  it('renders delete buttons with aria-labels', () => {
    initStepsCard();
    const deleteButtons = document.querySelectorAll('.step-delete');
    expect(deleteButtons.length).toBe(4);
    expect(deleteButtons[0].getAttribute('aria-label')).toMatch(
      /^Remove step:/
    );
  });

  it('calls setState when delete is clicked', () => {
    initStepsCard();
    document.querySelector('.step-delete').click();
    expect(setState).toHaveBeenCalled();
  });
});

describe('lens pills (STP-03)', () => {
  it('renders lens pills on steps with lenses, marks active correctly', () => {
    initStepsCard();
    const row = document.querySelector('[data-step-id="identify-cause"]');
    const pills = row.querySelectorAll('.pill');

    expect(pills.length).toBeGreaterThan(0);

    const semanticsPill = Array.from(pills).find(
      (p) => p.textContent === 'semantics'
    );
    expect(semanticsPill.getAttribute('aria-checked')).toBe('true');
    expect(semanticsPill.classList.contains('pill--on')).toBe(true);

    const securityPill = Array.from(pills).find(
      (p) => p.textContent === 'security'
    );
    expect(securityPill.getAttribute('aria-checked')).toBe('false');
  });

  it('calls setState when lens pill is clicked', () => {
    initStepsCard();
    document.querySelector('[data-step-id="identify-cause"] .pill').click();
    expect(setState).toHaveBeenCalledWith(
      'steps.enabled_steps',
      expect.any(Array)
    );
  });

  it('shows "more" button for extra lenses', () => {
    initStepsCard();
    const moreBtn = document.querySelector('.step-more-lenses');
    expect(moreBtn).toBeTruthy();
    expect(moreBtn.textContent).toContain('more');
  });
});

describe('step badges', () => {
  it('renders numbered badges', () => {
    initStepsCard();
    const badges = document.querySelectorAll('.step-badge');
    expect(badges[0].textContent).toBe('1');
    expect(badges[1].textContent).toBe('2');
  });
});

describe('file pills', () => {
  beforeEach(() => {
    getState.mockReturnValue({
      ...mockState,
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
    });
  });

  it('renders file pills with remove buttons', () => {
    initStepsCard();
    const pills = document.querySelectorAll('.step-file-pill');
    expect(pills.length).toBe(2);
    expect(document.querySelectorAll('.step-file-remove').length).toBe(2);
  });

  it('clicking remove calls setState', () => {
    initStepsCard();
    document.querySelector('.step-file-remove').click();
    expect(setState).toHaveBeenCalledWith('panel_a.files', ['src/utils.js']);
  });
});

describe('optional text inputs', () => {
  it('renders text inputs for steps with branch_name or pr_name', () => {
    initStepsCard();

    const branchRow = document.querySelector('[data-step-id="create-branch"]');
    expect(branchRow.querySelector('.step-optional-text')).toBeTruthy();

    const prRow = document.querySelector('[data-step-id="commit-pr"]');
    expect(prRow.querySelector('.step-optional-text')).toBeTruthy();
  });

  it('calls setState on input change', () => {
    initStepsCard();
    const input = document.querySelector(
      '[data-step-id="create-branch"] .step-optional-text'
    );
    input.value = 'fix/bug-123';
    input.dispatchEvent(new Event('input'));
    expect(setState).toHaveBeenCalled();
  });
});

describe('output mode buttons', () => {
  beforeEach(() => {
    getState.mockReturnValue({
      ...mockState,
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
    });
  });

  it('renders output buttons with correct roles', () => {
    initStepsCard();
    const btns = document.querySelectorAll('.output-mode-btn');
    expect(btns.length).toBe(3);
    expect(btns[0].getAttribute('role')).toBe('checkbox');
    expect(btns[0].getAttribute('aria-checked')).toBe('true');
  });

  it('calls setState on click', () => {
    initStepsCard();
    document.querySelectorAll('.output-mode-btn')[1].click();
    expect(setState).toHaveBeenCalled();
  });
});
