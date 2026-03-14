// @vitest-environment jsdom
/**
 * Tests for card-steps.js
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



vi.mock('../src/logic/step-generator.js', () => ({
  generateSteps: vi.fn(() => []),
  reconcileSteps: vi.fn((generated) => generated),
}));

vi.mock('../src/cards/card-configuration.js', () => ({
  getFileTree: vi.fn(() => []),
  renderFlowSelector: vi.fn(),
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
    expect(rows[1].children[0].textContent).toContain('Context: @claude.md');
    expect(rows[2].children[0].textContent).toContain('Analyze');
    expect(rows[3].children[0].textContent).toBe('Implement');
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
              id: 'read',
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

  it('calls setState on input change', () => {
    initStepsCard();
    const input = document.querySelector(
      '[data-step-id="commit"] input.input-field'
    );
    input.value = 'fix/bug-123';
    input.dispatchEvent(new Event('input'));
    expect(setState).toHaveBeenCalled();
  });
});

  it('calls setState on click', () => {
    initStepsCard();
    document.querySelectorAll('.btn-pill[role="checkbox"]')[1].click();
    expect(setState).toHaveBeenCalled();
  });
});
