// @vitest-environment jsdom
/**
 * Tests for card-tasks.js
 *
 * Tests UI behaviors specific to tasks card:
 * - Flow button selection UI
 * - Panel rendering with labels
 * - Required group indicators
 * - Improve scope selector
 * - PR/Issue clear buttons
 *
 * Complete user journeys are tested in e2e.test.js
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setupTasksCard, cleanupDOM } from './helpers/dom-fixtures.js';
import { createMockState } from './helpers/state-factory.js';

// --- Mock dependencies ---

vi.mock('../src/core/state.js', () => ({
  getState: vi.fn(() => createMockState()),
  setState: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  applyFlowDefaults: vi.fn(),
  resetDownstream: vi.fn(),
  getValueByPath: vi.fn((obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)),
}));

vi.mock('../src/logic/flow-loader.js', () => ({
  getFlows: vi.fn(() => ({
    fix: {
      icon: 'bug',
      panel_a: {
        label: 'Situation',
        subtitle: "What's happening",
        fields: {
          description: { type: 'text', required_group: 'a_required' },
          issue_number: { type: 'issue_picker', required_group: 'a_required' },
        },
      },
      panel_b: { label: 'Target', subtitle: 'Desired outcome', fields: {} },
      steps: [],
    },
    review: {
      icon: 'codescan',
      panel_a: { label: 'Subject', subtitle: 'To review', fields: { pr_number: { type: 'pr_picker', required_group: 'a_required' } } },
      panel_b: { label: 'Criteria', subtitle: 'Standards', fields: {} },
      steps: [],
    },
    implement: { icon: 'rocket', panel_a: { label: 'Context', fields: {} }, panel_b: { label: 'Requirements', fields: {} }, steps: [] },
    improve: { icon: 'compose', panel_a: { label: 'Current', fields: {} }, panel_b: { label: 'Desired', fields: {} }, steps: [] },
  })),
  getFlowById: vi.fn(() => null),
  ALL_LENSES: [],
}));

vi.mock('../src/cards/card-configuration.js', () => ({ getFileTree: vi.fn(() => [{ path: 'src/index.js' }]) }));
vi.mock('../src/common/github-api.js', () => ({
  fetchPRs: vi.fn(() => Promise.resolve({ data: [], error: null })),
  fetchIssues: vi.fn(() => Promise.resolve({ data: [], error: null })),
}));
vi.mock('../src/common/cache.js', () => ({ cacheGet: vi.fn(() => null), cacheSet: vi.fn() }));
vi.mock('../src/common/components.js', () => ({
  renderShimmer: vi.fn(),
  renderError: vi.fn(),
  showNotification: vi.fn(),
  expandCard: vi.fn((id) => { const card = document.getElementById(id); if (card) card.open = true; }),
  collapseCard: vi.fn((id) => { const card = document.getElementById(id); if (card) card.open = false; }),
}));
vi.mock('../src/logic/quality-meter.js', () => ({ renderQualityMeter: vi.fn(() => ({ update: vi.fn() })) }));
vi.mock('../src/common/file-tree.js', () => ({ createFilePicker: vi.fn((container) => container.appendChild(document.createElement('div'))) }));

import { initTasksCard } from '../src/cards/card-tasks.js';
import { getState, subscribe, applyFlowDefaults } from '../src/core/state.js';

beforeEach(() => {
  setupTasksCard();
  vi.clearAllMocks();
  subscribe.mockReturnValue(() => {});
});

afterEach(() => {
  cleanupDOM();
});

// --- Tests ---

describe('Flow button selection', () => {
  it('renders 4 flow buttons with icons', () => {
    initTasksCard();
    const buttons = document.querySelectorAll('.btn-select[data-flow-id]');
    expect(buttons.length).toBe(4);
    expect(document.querySelectorAll('.btn-select[data-flow-id] .icon').length).toBe(4);
  });

  it('calls applyFlowDefaults and marks button selected on click', () => {
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

  it('handles missing bd-tasks element gracefully', () => {
    document.body.innerHTML = '';
    expect(() => initTasksCard()).not.toThrow();
  });
});

describe('Panel rendering', () => {
  it('renders nested card panels after flow selection', () => {
    initTasksCard();
    document.querySelector('.btn-select[data-flow-id]').click();

    const nestedCards = document.querySelectorAll('#bd-tasks .card');
    expect(nestedCards.length).toBeGreaterThanOrEqual(2);
  });

  it('renders Panel A and Panel B with labels and dot separator', () => {
    initTasksCard();
    document.querySelector('.btn-select[data-flow-id]').click();

    expect(document.body.textContent).toContain('Situation');
    expect(document.body.textContent).toContain('Target');
    expect(document.body.textContent).toContain('·');
  });
});

describe('Required group indicator (SCT-05)', () => {
  it('shows required group dot indicator', () => {
    initTasksCard();
    document.querySelector('.btn-select[data-flow-id]').click();

    expect(document.querySelector('.required-group-dot')).not.toBeNull();
  });
});

describe('Improve scope selector (SCT-09)', () => {
  it('shows scope selector when 2+ files in improve flow', () => {
    getState.mockReturnValue(createMockState({
      task: { flow_id: 'improve' },
      panel_a: { files: ['a.js', 'b.js'] },
    }));

    initTasksCard();
    document.querySelector('.btn-select[data-flow-id="improve"]').click();

    const subscriberCb = subscribe.mock.calls[0][0];
    subscriberCb(getState());

    expect(document.querySelectorAll('.btn-select[data-scope]').length).toBe(2);
  });
});

describe('PR/Issue clear buttons', () => {
  it('renders clear button when PR is selected', () => {
    getState.mockReturnValue(createMockState({
      task: { flow_id: 'review' },
      panel_a: { pr_number: 42 },
    }));

    initTasksCard();
    document.querySelector('.btn-select[data-flow-id="review"]').click();

    expect(document.querySelector('.tag .btn-icon[aria-label^="Remove"]')).not.toBeNull();
  });

  it('renders clear button when Issue is selected', () => {
    getState.mockReturnValue(createMockState({
      task: { flow_id: 'fix' },
      panel_a: { issue_number: 123 },
    }));

    initTasksCard();
    document.querySelector('.btn-select[data-flow-id="fix"]').click();

    expect(document.querySelector('.tag .btn-icon[aria-label^="Remove"]')).not.toBeNull();
  });
});
