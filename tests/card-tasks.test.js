// @vitest-environment jsdom
/**
 * Tests for card-tasks.js
 * SCT-01..09: Flow selection, dual-panel, required groups, quality meter.
 *
 * Tests use JSDOM environment.
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
          description: {
            type: 'text',
            required_group: 'a_required',
            placeholder: 'Describe the issue...',
          },
          issue_number: {
            type: 'issue_picker',
            required_group: 'a_required',
            placeholder: 'Select GitHub issue',
          },
          files: {
            type: 'file_picker_multi',
            placeholder: 'Where does it occur?',
          },
        },
      },
      panel_b: {
        label: 'Expected Outcome',
        subtitle: 'How it should work after the fix',
        fields: {
          description: {
            type: 'text',
            placeholder: 'Describe expected behavior...',
          },
          spec_files: {
            type: 'file_picker_multi',
            placeholder: 'Requirements or spec file',
          },
          guideline_files: {
            type: 'file_picker_multi',
            placeholder: 'Style guides',
          },
        },
      },
      steps: [],
    },
    review: {
      label: 'Review / Analyze',
      icon: 'search',
      panel_a: {
        label: 'Review Subject',
        subtitle: 'The PR, code, or document to examine',
        fields: {
          description: { type: 'text', placeholder: 'Background...' },
          pr_number: {
            type: 'pr_picker',
            required_group: 'a_required',
            placeholder: 'Select a pull request',
          },
          files: {
            type: 'file_picker_multi',
            required_group: 'a_required',
            placeholder: 'Files to review',
          },
        },
      },
      panel_b: {
        label: 'Review Criteria',
        subtitle: 'Standards and criteria for the review',
        fields: {
          lenses: { type: 'lens_picker', default: ['semantics', 'structure'] },
          spec_files: {
            type: 'file_picker_multi',
            placeholder: 'specs to meet',
          },
          guideline_files: {
            type: 'file_picker_multi',
            placeholder: 'Standards to check',
          },
        },
      },
      steps: [],
    },
    implement: {
      label: 'Implement / Build',
      icon: 'plus',
      panel_a: {
        label: 'Context',
        subtitle: 'Existing code or context to build upon (optional)',
        fields: {
          description: { type: 'text', placeholder: 'Background...' },
          files: {
            type: 'file_picker_multi',
            placeholder: 'Existing files to build upon',
          },
        },
      },
      panel_b: {
        label: 'Requirements',
        subtitle: 'What to build and completion criteria',
        fields: {
          description: {
            type: 'text',
            required: true,
            placeholder: 'Describe what to build...',
          },
          spec_files: {
            type: 'file_picker_multi',
            placeholder: 'Requirement docs',
          },
          acceptance_criteria: {
            type: 'text',
            placeholder: "How to know it's done...",
          },
        },
      },
      steps: [],
    },
    improve: {
      label: 'Improve / Modify',
      icon: 'arrow-up',
      panel_a: {
        label: 'Current State',
        subtitle: 'What exists and what needs improvement',
        fields: {
          description: {
            type: 'text',
            required_group: 'a_required',
            placeholder: 'What to enhance...',
          },
          issue_number: {
            type: 'issue_picker',
            required_group: 'a_required',
            placeholder: 'Select a related GitHub issue',
          },
          files: { type: 'file_picker_multi', placeholder: 'Files to improve' },
        },
      },
      panel_b: {
        label: 'Desired Outcome',
        subtitle: 'What the improved version should look like',
        fields: {
          lenses: { type: 'lens_picker', default: [] },
          description: {
            type: 'text',
            placeholder: 'Describe the desired improvements...',
          },
          issue_number: {
            type: 'issue_picker',
            placeholder: 'Issue describing the desired state',
          },
          guideline_files: {
            type: 'file_picker_multi',
            label: 'Reference files',
            placeholder: 'Style guides...',
          },
        },
      },
      steps: [],
    },
  })),
  getFlowById: vi.fn((id) => null),
}));

vi.mock('../src/js/card-configuration.js', () => ({
  getFileTree: vi.fn(() => [
    { path: 'src/index.js' },
    { path: 'src/utils.js' },
    { path: 'README.md' },
  ]),
  setConfigCardSummary: vi.fn(),
}));

vi.mock('../src/js/github-api.js', () => ({
  fetchPRs: vi.fn(() =>
    Promise.resolve({ data: [{ number: 1, title: 'Fix bug' }], error: null })
  ),
  fetchIssues: vi.fn(() =>
    Promise.resolve({ data: [{ number: 2, title: 'Issue' }], error: null })
  ),
}));

vi.mock('../src/js/cache.js', () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

vi.mock('../src/js/components.js', () => ({
  renderShimmer: vi.fn(),
  renderError: vi.fn(),
  showNotification: vi.fn(),
  createSearchableDropdown: vi.fn((container, config) => {
    const input = document.createElement('input');
    input.className = 'dropdown-input';
    container.appendChild(input);
  }),
}));

vi.mock('../src/js/quality-meter.js', () => ({
  renderQualityMeter: vi.fn(() => ({ update: vi.fn() })),
}));

vi.mock('../src/js/file-tree.js', () => ({
  createFilePicker: vi.fn((container) => {
    const div = document.createElement('div');
    div.className = 'file-picker';
    container.appendChild(div);
  }),
}));

import { initTasksCard, getCardTasksEl } from '../src/js/card-tasks.js';
import {
  getState,
  setState,
  subscribe,
  applyFlowDefaults,
} from '../src/js/state.js';
import { getFlows } from '../src/js/flow-loader.js';

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
  it('renders flow selector buttons', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    const buttons = body.querySelectorAll('.flow-btn');
    expect(buttons.length).toBe(4);
  });

  it('renders all 4 flow labels', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    const text = body.textContent;
    expect(text).toContain('Fix');
    expect(text).toContain('Review');
    expect(text).toContain('Implement');
    expect(text).toContain('Improve');
  });

  it('does not render quality meter (moved to prompt card, 2.3)', async () => {
    initTasksCard();
    // Quality meter was moved to the prompt card; verify it is NOT called here
    const { renderQualityMeter } = await import('../src/js/quality-meter.js');
    expect(vi.isMockFunction(renderQualityMeter)).toBe(true);
    expect(renderQualityMeter).not.toHaveBeenCalled();
  });

  it('subscribes to state changes', () => {
    initTasksCard();
    expect(subscribe).toHaveBeenCalled();
  });

  it('does nothing if bd-tasks element is missing', () => {
    document.body.innerHTML = '';
    expect(() => initTasksCard()).not.toThrow();
  });
});

describe('flow button click', () => {
  it('calls applyFlowDefaults on flow button click', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    const firstBtn = body.querySelector('.flow-btn');
    firstBtn.click();
    expect(applyFlowDefaults).toHaveBeenCalled();
  });

  it('marks clicked flow button as selected', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    const buttons = body.querySelectorAll('.flow-btn');
    buttons[0].click();
    expect(buttons[0].classList.contains('item-selected')).toBe(true);
  });

  it('deselects previously selected flow button on new selection', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    const buttons = body.querySelectorAll('.flow-btn');
    buttons[0].click();
    buttons[1].click();
    expect(buttons[0].classList.contains('item-selected')).toBe(false);
    expect(buttons[1].classList.contains('item-selected')).toBe(true);
  });

  it('expands Steps and Prompt cards on flow select', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    const firstBtn = body.querySelector('.flow-btn');
    firstBtn.click();
    const stepsCard = document.getElementById('card-steps');
    const promptCard = document.getElementById('card-prompt');
    expect(stepsCard.classList.contains('card--open')).toBe(true);
    expect(promptCard.classList.contains('card--open')).toBe(true);
  });

  it('collapses Configuration card on flow select', () => {
    // Expand config card first
    const configCard = document.getElementById('card-configuration');
    configCard.classList.add('card--open');

    initTasksCard();
    const body = document.getElementById('bd-tasks');
    const firstBtn = body.querySelector('.flow-btn');
    firstBtn.click();

    expect(configCard.classList.contains('card--open')).toBe(false);
  });

  it('renders dual panels after flow is selected', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    const firstBtn = body.querySelector('.flow-btn');
    firstBtn.click();
    const panels = body.querySelector('.dual-panel');
    expect(panels).not.toBeNull();
  });
});

describe('dual-panel layout', () => {
  it('renders Panel A and Panel B', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    const firstBtn = body.querySelector('.flow-btn');
    firstBtn.click();

    const panelA = body.querySelector('.panel-a');
    const panelB = body.querySelector('.panel-b');
    expect(panelA).not.toBeNull();
    expect(panelB).not.toBeNull();
  });

  it('shows Situation label for Panel A', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    body.querySelector('.flow-btn').click();
    const panelA = body.querySelector('.panel-a');
    expect(panelA.textContent).toContain('Situation');
  });

  it('shows Target label for Panel B', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    body.querySelector('.flow-btn').click();
    const panelB = body.querySelector('.panel-b');
    expect(panelB.textContent).toContain('Target');
  });

  it('renders flow-specific subtitle in Panel A', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    body.querySelector('.flow-btn').click(); // fix flow
    const panelA = body.querySelector('.panel-a');
    expect(panelA.textContent).toContain("What's happening now");
  });
});

describe('required group validation (SCT-05)', () => {
  it('shows required group indicator when group is not satisfied', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    body.querySelector('.flow-btn').click(); // fix flow — has required group on description + issue
    // Before any input: required group unsatisfied
    const indicator = body.querySelector('.required-group-unsatisfied');
    expect(indicator).not.toBeNull();
  });
});

describe('improve scope selector (SCT-09)', () => {
  it('does not show scope selector by default for improve flow', () => {
    // State has panel_a.files = [] (empty)
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    const buttons = body.querySelectorAll('.flow-btn');
    const improveBtn = Array.from(buttons).find((b) =>
      b.textContent.includes('Improve')
    );
    improveBtn.click();

    const scopeSelector = body.querySelector('.scope-selector');
    // Scope selector hidden when < 2 files
    expect(scopeSelector?.style.display).not.toBe('flex');
  });

  it('shows scope selector when state has 2+ files in improve flow', () => {
    // Override state mock to have 2 files
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
    const body = document.getElementById('bd-tasks');
    const buttons = body.querySelectorAll('.flow-btn');
    const improveBtn = Array.from(buttons).find((b) =>
      b.textContent.includes('Improve')
    );
    improveBtn.click();

    // Trigger subscriber to simulate state update with 2 files
    const subscriberCb = subscribe.mock.calls[0][0];
    subscriberCb(getState());

    const scopeSelector = body.querySelector('.scope-selector');
    expect(scopeSelector).not.toBeNull();
  });
});

describe('DM-DEF-03: flow switch fully resets panels', () => {
  it('calls applyFlowDefaults on every flow switch', () => {
    initTasksCard();
    const body = document.getElementById('bd-tasks');
    const buttons = body.querySelectorAll('.flow-btn');

    buttons[0].click();
    buttons[1].click();
    buttons[2].click();

    expect(applyFlowDefaults).toHaveBeenCalledTimes(3);
  });
});
