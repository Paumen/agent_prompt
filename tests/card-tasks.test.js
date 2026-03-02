// @vitest-environment jsdom
/**
 * Tests for card-tasks.js
 * SCT-01..09: Flow selection, dual-panel, required groups.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// --- Mock dependencies ---

vi.mock('../src/js/state.js', () => ({
  getState: vi.fn(() => ({
    task: { flow_id: '' },
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
    steps: { enabled_steps: [] },
    improve_scope: null,
    notes: { user_text: '' },
    _prompt: '',
  })),
  setState: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  applyFlowDefaults: vi.fn(),
}));

vi.mock('../src/js/flow-loader.js', () => ({
  getFlows: vi.fn(() => ({
    fix: {
      label: 'Fix / Debug',
      icon: 'bug',
      panel_a: {
        label: 'Current State',
        subtitle: "What's happening now",
        fields: {
          description: { type: 'text', required_group: 'a_required' },
          issue_number: { type: 'issue_picker', required_group: 'a_required' },
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
      label: 'Review / Analyze',
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
      panel_b: { label: 'Requirements', subtitle: 'What to build', fields: {} },
      steps: [],
    },
    improve: {
      label: 'Improve / Modify',
      icon: 'compose',
      panel_a: { label: 'Current', subtitle: 'What exists', fields: {} },
      panel_b: { label: 'Desired', subtitle: 'Improvements', fields: {} },
      steps: [],
    },
  })),
  getFlowById: vi.fn(() => null),
}));

vi.mock('../src/js/card-configuration.js', () => ({
  getFileTree: vi.fn(() => [{ path: 'src/index.js' }]),
  setConfigCardSummary: vi.fn(),
}));

vi.mock('../src/js/github-api.js', () => ({
  fetchPRs: vi.fn(() => Promise.resolve({ data: [], error: null })),
  fetchIssues: vi.fn(() => Promise.resolve({ data: [], error: null })),
}));

vi.mock('../src/js/cache.js', () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

vi.mock('../src/js/components.js', () => ({
  renderShimmer: vi.fn(),
  renderError: vi.fn(),
  showNotification: vi.fn(),
  createSearchableDropdown: vi.fn((container) => {
    container.appendChild(document.createElement('input'));
  }),
}));

vi.mock('../src/js/quality-meter.js', () => ({
  renderQualityMeter: vi.fn(() => ({ update: vi.fn() })),
}));

vi.mock('../src/js/file-tree.js', () => ({
  createFilePicker: vi.fn((container) => {
    container.appendChild(document.createElement('div'));
  }),
}));

import { initTasksCard } from '../src/js/card-tasks.js';
import {
  getState,
  setState,
  subscribe,
  applyFlowDefaults,
} from '../src/js/state.js';

// --- Setup ---

function createTasksCard() {
  document.body.innerHTML = `
    <section class="card" id="card-configuration">
      <button class="card-header" aria-expanded="false"></button>
    </section>
    <section class="card card--open" id="card-tasks">
      <button class="card-header" aria-expanded="true"></button>
      <div class="card-body" id="bd-tasks"></div>
    </section>
    <section class="card" id="card-steps">
      <button class="card-header" aria-expanded="false"></button>
    </section>
    <section class="card" id="card-prompt">
      <button class="card-header" aria-expanded="false"></button>
    </section>
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
    const buttons = document.querySelectorAll('.flow-btn');
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
    const buttons = document.querySelectorAll('.flow-btn');
    buttons[0].click();
    expect(applyFlowDefaults).toHaveBeenCalled();
    expect(buttons[0].classList.contains('item-selected')).toBe(true);
  });

  it('deselects previous button on new selection', () => {
    initTasksCard();
    const buttons = document.querySelectorAll('.flow-btn');
    buttons[0].click();
    buttons[1].click();
    expect(buttons[0].classList.contains('item-selected')).toBe(false);
    expect(buttons[1].classList.contains('item-selected')).toBe(true);
  });

  it('expands Steps and Prompt cards, collapses Config', () => {
    document.getElementById('card-configuration').classList.add('card--open');
    initTasksCard();
    document.querySelector('.flow-btn').click();

    expect(
      document.getElementById('card-steps').classList.contains('card--open')
    ).toBe(true);
    expect(
      document.getElementById('card-prompt').classList.contains('card--open')
    ).toBe(true);
    expect(
      document
        .getElementById('card-configuration')
        .classList.contains('card--open')
    ).toBe(false);
  });

  it('renders dual panels after flow selection', () => {
    initTasksCard();
    document.querySelector('.flow-btn').click();
    expect(document.querySelector('.dual-panel')).not.toBeNull();
  });
});

describe('dual-panel layout', () => {
  it('renders Panel A and Panel B with labels', () => {
    initTasksCard();
    document.querySelector('.flow-btn').click();

    expect(document.querySelector('.panel-a')).not.toBeNull();
    expect(document.querySelector('.panel-b')).not.toBeNull();
    expect(document.body.textContent).toContain('Situation');
    expect(document.body.textContent).toContain('Target');
  });
});

describe('required group validation (SCT-05)', () => {
  it('shows required group dot indicator', () => {
    initTasksCard();
    document.querySelector('.flow-btn').click(); // fix flow has required group
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
    const improveBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
      (b) => b.textContent.includes('Improve')
    );
    improveBtn.click();

    const subscriberCb = subscribe.mock.calls[0][0];
    subscriberCb(getState());

    expect(document.querySelector('.scope-selector')).not.toBeNull();
  });
});

describe('flow switch resets panels (DM-DEF-03)', () => {
  it('calls applyFlowDefaults on each flow switch', () => {
    initTasksCard();
    const buttons = document.querySelectorAll('.flow-btn');
    buttons[0].click();
    buttons[1].click();
    buttons[2].click();
    expect(applyFlowDefaults).toHaveBeenCalledTimes(3);
  });
});

describe('Phase 12: Task Card Polish', () => {
  it('flow icons use class="icon"', () => {
    initTasksCard();
    expect(document.querySelectorAll('.flow-btn .icon').length).toBe(4);
  });

  it('panel header uses · separator', () => {
    initTasksCard();
    document.querySelector('.flow-btn').click();
    const sep = document.querySelector('.panel-sep');
    expect(sep).not.toBeNull();
    expect(sep.textContent).toBe('·');
  });
});

describe('Phase 13: PR clear button', () => {
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
    const reviewBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
      (b) => b.textContent.includes('Review')
    );
    reviewBtn.click();

    const clearBtn = document.querySelector('.picker-clear');
    expect(clearBtn).not.toBeNull();
  });
});
