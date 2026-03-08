// @vitest-environment jsdom
/**
 * Tests for card-tasks.js
 * SCT-01..09: Flow selection, dual-panel, required groups.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// --- Mock dependencies ---

vi.mock('../src/core/state.js', () => ({
  getState: vi.fn(() => ({
    task: { flow_id: '' },
    configuration: {
      owner: 'user',
      repo: 'repo',
      branch: 'main',
      pat: 'tok',
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
    steps: { enabled_steps: [] },
    improve_scope: null,
    notes: { user_text: '' },
    _prompt: '',
  })),
  setState: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  applyFlowDefaults: vi.fn(),
  resetDownstream: vi.fn(),
  getValueByPath: vi.fn((obj, path) =>
    path.split('.').reduce((o, k) => o?.[k], obj)
  ),
}));

vi.mock('../src/logic/flow-loader.js', () => ({
  getFlows: vi.fn(() => ({
    fix: {
      icon: 'bug',
      panel_a: {
        label: 'Current State',
        subtitle: "What's happening now",
        fields: {
          description: { type: 'text', required_group: 'a_required' },
          issue_number: {
            type: 'issue_picker',
            required_group: 'a_required',
          },
          files: { type: 'file_picker_multi' },
        },
      },
      panel_b: {
        label: 'Expected Outcome',
        subtitle: 'How it should work',
        fields: { description: { type: 'text' } },
      },
      steps: [],
    },
    review: {
      icon: 'codescan',
      panel_a: {
        label: 'Review Subject',
        subtitle: 'The PR or code to examine',
        fields: {
          description: { type: 'text' },
          pr_number: { type: 'pr_picker', required_group: 'a_required' },
        },
      },
      panel_b: { label: 'Criteria', subtitle: 'Standards', fields: {} },
      steps: [],
    },
    implement: {
      label: 'Implement / Build',
      icon: 'rocket',
      panel_a: { label: 'Context', subtitle: 'Background', fields: {} },
      panel_b: {
        label: 'Requirements',
        subtitle: 'What to build',
        fields: {},
      },
      steps: [],
    },
    improve: {
      icon: 'compose',
      panel_a: { label: 'Current', subtitle: 'What exists', fields: {} },
      panel_b: { label: 'Desired', subtitle: 'Improvements', fields: {} },
      steps: [],
    },
  })),
  getFlowById: vi.fn(() => null),
  ALL_LENSES: [],
}));

vi.mock('../src/cards/card-configuration.js', () => ({
  getFileTree: vi.fn(() => [{ path: 'src/index.js' }]),
}));

vi.mock('../src/common/github-api.js', () => ({
  fetchPRs: vi.fn(() => Promise.resolve({ data: [], error: null })),
  fetchIssues: vi.fn(() => Promise.resolve({ data: [], error: null })),
}));

vi.mock('../src/common/cache.js', () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

vi.mock('../src/common/components.js', () => ({
  renderShimmer: vi.fn(),
  renderError: vi.fn(),
  showNotification: vi.fn(),
  expandCard: vi.fn((id) => {
    const card = document.getElementById(id);
    if (card) card.open = true;
  }),
  collapseCard: vi.fn((id) => {
    const card = document.getElementById(id);
    if (card) card.open = false;
  }),
}));

vi.mock('../src/logic/quality-meter.js', () => ({
  renderQualityMeter: vi.fn(() => ({ update: vi.fn() })),
}));

vi.mock('../src/common/file-tree.js', () => ({
  createFilePicker: vi.fn((container) => {
    container.appendChild(document.createElement('div'));
  }),
}));

import { initTasksCard } from '../src/cards/card-tasks.js';
import { getState, subscribe, applyFlowDefaults } from '../src/core/state.js';

// --- Setup ---

function createTasksCard() {
  document.body.innerHTML = `
    <details class="card" id="card-configuration">
      <summary class="card-header"><h3>Configuration</h3><span class="card-meta"></span></summary>
    </details>
    <details class="card" id="card-tasks" open>
      <summary class="card-header"><h3>Task</h3><span class="card-meta"></span></summary>
      <div class="card-body" id="bd-tasks"></div>
    </details>
    <details class="card" id="card-steps">
      <summary class="card-header"><h3>Steps</h3><span class="card-meta"></span></summary>
    </details>
    <details class="card" id="card-prompt">
      <summary class="card-header"><h3>Prompt</h3><span class="card-meta"></span></summary>
    </details>
  `;
}

beforeEach(() => {
  createTasksCard();
  vi.clearAllMocks();
  subscribe.mockReturnValue(() => {});
});

afterEach(() => {
  document.body.innerHTML = '';
});

// --- Tests ---

describe('initTasksCard', () => {
  it('renders 4 flow buttons', () => {
    initTasksCard();
    const buttons = document.querySelectorAll('.btn-select[data-flow-id]');
    expect(buttons.length).toBe(4);
  });

  it('subscribes to state changes', () => {
    initTasksCard();
    expect(subscribe).toHaveBeenCalled();
  });

  it('handles missing bd-tasks element', () => {
    document.body.innerHTML = '';
    expect(() => initTasksCard()).not.toThrow();
  });
});

describe('flow button click', () => {
  it('calls applyFlowDefaults and marks button selected', () => {
    initTasksCard();
    const buttons = document.querySelectorAll('.btn-select[data-flow-id]');
    buttons[0].click();
    expect(applyFlowDefaults).toHaveBeenCalled();
    expect(buttons[0].classList.contains('btn-select--selected')).toBe(true);
  });

  it('deselects previous button on new selection', () => {
    initTasksCard();
    const buttons = document.querySelectorAll('.btn-select[data-flow-id]');
    buttons[0].click();
    buttons[1].click();
    expect(buttons[0].classList.contains('btn-select--selected')).toBe(false);
    expect(buttons[1].classList.contains('btn-select--selected')).toBe(true);
  });



  it('renders nested card panels after flow selection', () => {
    initTasksCard();
    document.querySelector('.btn-select[data-flow-id]').click();
    // Panels are now nested .card elements inside the tasks card-body
    const nestedCards = document.querySelectorAll('#bd-tasks .card');
    expect(nestedCards.length).toBeGreaterThanOrEqual(2);
  });
});

describe('nested card panel layout', () => {
  it('renders Panel A and Panel B with labels', () => {
    initTasksCard();
    document.querySelector('.btn-select[data-flow-id]').click();

    const nestedCards = document.querySelectorAll('#bd-tasks .card');
    expect(nestedCards.length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).toContain('Situation');
    expect(document.body.textContent).toContain('Target');
  });
});

describe('required group validation (SCT-05)', () => {
  it('shows required group dot indicator', () => {
    initTasksCard();
    document.querySelector('.btn-select[data-flow-id]').click();
    expect(document.querySelector('.required-group-dot')).not.toBeNull();
  });
});

describe('improve scope selector (SCT-09)', () => {
  it('shows scope selector when 2+ files in improve flow', () => {
    getState.mockReturnValue({
      task: { flow_id: 'improve' },
      configuration: {
        owner: 'user',
        repo: 'repo',
        branch: 'main',
        pat: 'tok',
      },
      panel_a: {
        description: '',
        issue_number: null,
        pr_number: null,
        files: ['a.js', 'b.js'],
      },
      panel_b: {
        description: '',
        issue_number: null,
        spec_files: [],
        guideline_files: [],
        acceptance_criteria: '',
        lenses: [],
      },
      steps: { enabled_steps: [] },
      improve_scope: null,
      notes: { user_text: '' },
      _prompt: '',
    });

    initTasksCard();
    const improveBtn = Array.from(
      document.querySelectorAll('.btn-select[data-flow-id]')
    ).find((b) => b.dataset.flowId === 'improve');
    improveBtn.click();

    const subscriberCb = subscribe.mock.calls[0][0];
    subscriberCb(getState());

    // Scope selector uses .input class and contains scope buttons
    const scopeButtons = document.querySelectorAll('.btn-select[data-scope]');
    expect(scopeButtons.length).toBe(2);
  });
});

describe('Task Card Polish', () => {
  it('flow icons use class="icon"', () => {
    initTasksCard();
    expect(
      document.querySelectorAll('.btn-select[data-flow-id] .icon').length
    ).toBe(4);
  });

  it('panel header uses dot separator', () => {
    initTasksCard();
    document.querySelector('.btn-select[data-flow-id]').click();
    // Separator is now inline styled, but textContent still contains ·
    expect(document.body.textContent).toContain('·');
  });
});

describe('PR clear button', () => {
  it('renders clear button when PR is selected', () => {
    getState.mockReturnValue({
      task: { flow_id: 'review' },
      configuration: {
        owner: 'user',
        repo: 'repo',
        branch: 'main',
        pat: 'tok',
      },
      panel_a: {
        description: '',
        issue_number: null,
        pr_number: 42,
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
      steps: { enabled_steps: [] },
      improve_scope: null,
      notes: { user_text: '' },
      _prompt: '',
    });

    initTasksCard();
    const reviewBtn = Array.from(
      document.querySelectorAll('.btn-select[data-flow-id]')
    ).find((b) => b.dataset.flowId === 'review');
    reviewBtn.click();

    // PR selection now renders as a tag with remove button
    const clearBtn = document.querySelector(
      '.tag .btn-icon[aria-label^="Remove"]'
    );
    expect(clearBtn).not.toBeNull();
  });
});
