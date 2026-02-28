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
    id: 'implement-fix',
    operation: 'edit',
    object: 'files',
    lenses: [],
  },
  {
    id: 'run-tests',
    operation: 'validate',
    object: 'tests',
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
  steps: {
    enabled_steps: mockSteps,
    removed_step_ids: [],
  },
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
import { getState, setState, subscribe } from '../src/js/state.js';

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
  subscribe.mockReturnValue(() => {});
});

afterEach(() => {
  document.body.innerHTML = '';
});

// --- Tests ---

describe('initStepsCard', () => {
  it('renders step list from state', () => {
    initStepsCard();
    const body = document.getElementById('bd-steps');
    const steps = body.querySelectorAll('.step-row');
    expect(steps.length).toBe(6);
  });

  it('shows empty state when no steps', () => {
    getState.mockReturnValue({
      ...mockState,
      steps: { enabled_steps: [], removed_step_ids: [] },
    });
    initStepsCard();
    const body = document.getElementById('bd-steps');
    expect(body.textContent).toContain('Select a flow to generate steps.');
  });

  it('subscribes to state changes', () => {
    initStepsCard();
    expect(subscribe).toHaveBeenCalled();
  });

  it('does nothing if bd-steps element is missing', () => {
    document.body.innerHTML = '';
    expect(() => initStepsCard()).not.toThrow();
  });
});

describe('step rendering (STP-01)', () => {
  it('renders step labels with operation and object', () => {
    initStepsCard();
    const body = document.getElementById('bd-steps');
    const labels = body.querySelectorAll('.step-label');
    expect(labels[0].textContent).toContain('Read: @claude.md');
    expect(labels[1].textContent).toContain('Analyze: issue');
    expect(labels[2].textContent).toContain('Create: branch');
  });

  it('shows step numbers via CSS counter', () => {
    initStepsCard();
    const list = document.querySelector('.step-list');
    expect(list).not.toBeNull();
    expect(list.tagName).toBe('OL');
  });

  it('adds data-step-id attribute to each step row', () => {
    initStepsCard();
    const rows = document.querySelectorAll('.step-row');
    expect(rows[0].dataset.stepId).toBe('read-claude');
    expect(rows[1].dataset.stepId).toBe('identify-cause');
  });
});

describe('step deletion (STP-04)', () => {
  it('renders delete button on every step', () => {
    initStepsCard();
    const deleteButtons = document.querySelectorAll('.step-delete');
    expect(deleteButtons.length).toBe(6);
  });

  it('renders delete button on read-claude step (not locked)', () => {
    initStepsCard();
    const firstRow = document.querySelector('[data-step-id="read-claude"]');
    const deleteBtn = firstRow.querySelector('.step-delete');
    expect(deleteBtn).not.toBeNull();
  });

  it('calls setState when delete is clicked', () => {
    initStepsCard();
    const deleteBtn = document.querySelector('.step-delete');
    deleteBtn.click();
    expect(setState).toHaveBeenCalled();
  });

  it('passes removed step id to setState', () => {
    initStepsCard();
    const firstDeleteBtn = document.querySelector(
      '[data-step-id="read-claude"] .step-delete'
    );
    firstDeleteBtn.click();

    const call = setState.mock.calls[0];
    // setState is called with a function updater
    expect(typeof call[0]).toBe('function');

    // Call the updater to inspect the result
    const result = call[0](structuredClone(mockState));
    expect(result.steps.removed_step_ids).toContain('read-claude');
    expect(
      result.steps.enabled_steps.find((s) => s.id === 'read-claude')
    ).toBeUndefined();
  });

  it('has accessible aria-label on delete buttons', () => {
    initStepsCard();
    const deleteButtons = document.querySelectorAll('.step-delete');
    for (const btn of deleteButtons) {
      expect(btn.getAttribute('aria-label')).toMatch(/^Remove step:/);
    }
  });
});

describe('lens pills (STP-03)', () => {
  it('renders lens pills on steps with lenses array', () => {
    initStepsCard();
    const identifyCauseRow = document.querySelector(
      '[data-step-id="identify-cause"]'
    );
    const pills = identifyCauseRow.querySelectorAll('.pill');
    expect(pills.length).toBeGreaterThan(0);
  });

  it('does not render lens pills on steps without lenses', () => {
    initStepsCard();
    const runTestsRow = document.querySelector('[data-step-id="run-tests"]');
    const pills = runTestsRow.querySelectorAll('.pill');
    expect(pills.length).toBe(0);
  });

  it('marks active lenses as checked', () => {
    initStepsCard();
    const identifyCauseRow = document.querySelector(
      '[data-step-id="identify-cause"]'
    );
    const semanticsPill = Array.from(
      identifyCauseRow.querySelectorAll('.pill')
    ).find((p) => p.textContent === 'semantics');
    expect(semanticsPill).not.toBeUndefined();
    expect(semanticsPill.getAttribute('aria-checked')).toBe('true');
    expect(semanticsPill.classList.contains('pill--on')).toBe(true);
  });

  it('marks inactive lenses as unchecked', () => {
    initStepsCard();
    const identifyCauseRow = document.querySelector(
      '[data-step-id="identify-cause"]'
    );
    const securityPill = Array.from(
      identifyCauseRow.querySelectorAll('.pill')
    ).find((p) => p.textContent === 'security');
    expect(securityPill).not.toBeUndefined();
    expect(securityPill.getAttribute('aria-checked')).toBe('false');
  });

  it('renders lens pills with role="switch"', () => {
    initStepsCard();
    const identifyCauseRow = document.querySelector(
      '[data-step-id="identify-cause"]'
    );
    const pills = identifyCauseRow.querySelectorAll('.pill');
    for (const pill of pills) {
      expect(pill.getAttribute('role')).toBe('switch');
    }
  });

  it('calls setState when lens pill is clicked', () => {
    initStepsCard();
    const identifyCauseRow = document.querySelector(
      '[data-step-id="identify-cause"]'
    );
    const pills = identifyCauseRow.querySelectorAll('.pill');
    pills[0].click();
    expect(setState).toHaveBeenCalledWith(
      'steps.enabled_steps',
      expect.any(Array)
    );
  });

  it('shows "more" button when there are more than 7 lenses', () => {
    initStepsCard();
    const identifyCauseRow = document.querySelector(
      '[data-step-id="identify-cause"]'
    );
    const moreBtn = identifyCauseRow.querySelector('.step-more-lenses');
    expect(moreBtn).not.toBeNull();
    expect(moreBtn.textContent).toContain('more');
  });

  it('shows extra lenses when "more" button is clicked', () => {
    initStepsCard();
    const identifyCauseRow = document.querySelector(
      '[data-step-id="identify-cause"]'
    );
    const moreBtn = identifyCauseRow.querySelector('.step-more-lenses');
    const extraGroup = identifyCauseRow.querySelector('.step-lens-extra');

    expect(extraGroup.style.display).toBe('none');
    moreBtn.click();
    expect(extraGroup.style.display).toBe('flex');
  });

  it('toggles "more" button text between "Show fewer" and "+N more"', () => {
    initStepsCard();
    const identifyCauseRow = document.querySelector(
      '[data-step-id="identify-cause"]'
    );
    const moreBtn = identifyCauseRow.querySelector('.step-more-lenses');

    moreBtn.click();
    expect(moreBtn.textContent).toBe('Show fewer');

    moreBtn.click();
    expect(moreBtn.textContent).toContain('more');
  });
});

describe('step badge (Phase 13)', () => {
  it('renders a step-badge element for each step', () => {
    initStepsCard();
    const badges = document.querySelectorAll('.step-badge');
    expect(badges.length).toBe(6);
  });

  it('step-badge shows the correct 1-based step number', () => {
    initStepsCard();
    const badges = document.querySelectorAll('.step-badge');
    expect(badges[0].textContent).toBe('1');
    expect(badges[1].textContent).toBe('2');
    expect(badges[5].textContent).toBe('6');
  });
});

describe('file pills (Phase 13)', () => {
  const stepsWithFiles = [
    {
      id: 'read-location',
      operation: 'read',
      object: 'files',
      source: 'panel_a.files',
      params: { files: ['src/app.js', 'src/utils.js'] },
    },
  ];

  beforeEach(() => {
    getState.mockReturnValue({
      ...mockState,
      panel_a: { ...mockState.panel_a, files: ['src/app.js', 'src/utils.js'] },
      steps: { enabled_steps: stepsWithFiles, removed_step_ids: [] },
    });
  });

  it('renders file pills for steps with params.files', () => {
    initStepsCard();
    const row = document.querySelector('[data-step-id="read-location"]');
    const pills = row.querySelectorAll('.step-file-pill');
    expect(pills.length).toBe(2);
  });

  it('each file pill shows the filename', () => {
    initStepsCard();
    const row = document.querySelector('[data-step-id="read-location"]');
    const pills = row.querySelectorAll('.step-file-pill');
    expect(pills[0].textContent).toContain('@app.js');
    expect(pills[1].textContent).toContain('@utils.js');
  });

  it('each file pill has a remove button', () => {
    initStepsCard();
    const row = document.querySelector('[data-step-id="read-location"]');
    const removeBtns = row.querySelectorAll('.step-file-remove');
    expect(removeBtns.length).toBe(2);
  });

  it('clicking a file pill remove button calls setState on the source panel field', () => {
    initStepsCard();
    const row = document.querySelector('[data-step-id="read-location"]');
    const removeBtns = row.querySelectorAll('.step-file-remove');
    removeBtns[0].click(); // Remove 'src/app.js'
    expect(setState).toHaveBeenCalledWith('panel_a.files', ['src/utils.js']);
  });
});

describe('optional text inputs', () => {
  it('renders text input for steps with branch_name', () => {
    initStepsCard();
    const branchRow = document.querySelector('[data-step-id="create-branch"]');
    const input = branchRow.querySelector('.step-optional-text');
    expect(input).not.toBeNull();
    expect(input.placeholder).toBe('Branch name (optional)');
  });

  it('renders text input for steps with pr_name', () => {
    initStepsCard();
    const prRow = document.querySelector('[data-step-id="commit-pr"]');
    const input = prRow.querySelector('.step-optional-text');
    expect(input).not.toBeNull();
    expect(input.placeholder).toBe('PR title (optional)');
  });

  it('does not render text input for steps without optional text fields', () => {
    initStepsCard();
    const testsRow = document.querySelector('[data-step-id="run-tests"]');
    const input = testsRow.querySelector('.step-optional-text');
    expect(input).toBeNull();
  });

  it('calls setState when optional text is changed', () => {
    initStepsCard();
    const branchRow = document.querySelector('[data-step-id="create-branch"]');
    const input = branchRow.querySelector('.step-optional-text');

    // Simulate typing
    input.value = 'fix/bug-123';
    input.dispatchEvent(new Event('input'));

    expect(setState).toHaveBeenCalledWith(
      'steps.enabled_steps',
      expect.any(Array)
    );
  });
});

describe('output mode icon buttons (Phase 13 multi-select)', () => {
  const stepsWithOutput = [
    {
      id: 'provide-feedback-pr',
      operation: 'create',
      object: 'review_feedback',
      source: 'panel_a.pr_number',
      output: ['here', 'pr_comment', 'pr_inline_comments'],
    },
  ];

  beforeEach(() => {
    getState.mockReturnValue({
      ...mockState,
      task: { flow_id: 'review' },
      steps: {
        enabled_steps: stepsWithOutput,
        removed_step_ids: [],
      },
    });
  });

  it('renders output icon buttons for steps with output array', () => {
    initStepsCard();
    const feedbackRow = document.querySelector(
      '[data-step-id="provide-feedback-pr"]'
    );
    const outputBtns = feedbackRow.querySelectorAll('.output-mode-btn');
    expect(outputBtns.length).toBe(3);
  });

  it('shows "Deliver via:" label', () => {
    initStepsCard();
    const feedbackRow = document.querySelector(
      '[data-step-id="provide-feedback-pr"]'
    );
    expect(feedbackRow.textContent).toContain('Deliver via:');
  });

  it('pre-selects the first output option', () => {
    initStepsCard();
    const feedbackRow = document.querySelector(
      '[data-step-id="provide-feedback-pr"]'
    );
    const btns = feedbackRow.querySelectorAll('.output-mode-btn');
    expect(btns[0].getAttribute('aria-checked')).toBe('true');
    expect(btns[0].classList.contains('output-mode-btn--on')).toBe(true);
    expect(btns[1].getAttribute('aria-checked')).toBe('false');
  });

  it('uses role="checkbox" for output buttons (multi-select)', () => {
    initStepsCard();
    const feedbackRow = document.querySelector(
      '[data-step-id="provide-feedback-pr"]'
    );
    const btns = feedbackRow.querySelectorAll('.output-mode-btn');
    for (const btn of btns) {
      expect(btn.getAttribute('role')).toBe('checkbox');
    }
  });

  it('calls setState when output button is clicked', () => {
    initStepsCard();
    const feedbackRow = document.querySelector(
      '[data-step-id="provide-feedback-pr"]'
    );
    const btns = feedbackRow.querySelectorAll('.output-mode-btn');
    btns[1].click(); // Click "PR comment"
    expect(setState).toHaveBeenCalledWith(
      'steps.enabled_steps',
      expect.any(Array)
    );
  });

  it('renders short labels for output modes inside .output-label', () => {
    initStepsCard();
    const feedbackRow = document.querySelector(
      '[data-step-id="provide-feedback-pr"]'
    );
    const labels = feedbackRow.querySelectorAll('.output-label');
    expect(labels[0].textContent).toBe('Here');
    expect(labels[1].textContent).toBe('PR Com');
    expect(labels[2].textContent).toBe('Inline');
  });

  it('allows multiple output modes to be selected simultaneously', () => {
    // Step already has outputs_selected with two modes
    getState.mockReturnValue({
      ...mockState,
      task: { flow_id: 'review' },
      steps: {
        enabled_steps: [
          {
            ...stepsWithOutput[0],
            outputs_selected: ['here', 'pr_comment'],
          },
        ],
        removed_step_ids: [],
      },
    });
    initStepsCard();
    const feedbackRow = document.querySelector(
      '[data-step-id="provide-feedback-pr"]'
    );
    const btns = feedbackRow.querySelectorAll('.output-mode-btn');
    expect(btns[0].getAttribute('aria-checked')).toBe('true');
    expect(btns[1].getAttribute('aria-checked')).toBe('true');
    expect(btns[2].getAttribute('aria-checked')).toBe('false');
  });
});
