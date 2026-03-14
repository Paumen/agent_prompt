// @vitest-environment jsdom
/**
 * Tests for card-configuration.js
 * Integration flows (repo selection → prompt generation) are tested in e2e.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupConfigurationCard, cleanupDOM } from './helpers/dom-fixtures.js';

// --- Mock helpers ---

const mockFetch = (response, ok = true, status = 200) =>
  vi
    .fn()
    .mockResolvedValue({ ok, status, json: () => Promise.resolve(response) });

const SAMPLE_REPOS = [
  { name: 'alpha', default_branch: 'main' },
  { name: 'beta', default_branch: 'develop' },
  { name: 'gamma', default_branch: 'main' },
];

const SAMPLE_BRANCHES = [{ name: 'main' }, { name: 'develop' }];

let cardConfig, state;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  setupConfigurationCard();
  globalThis.fetch = mockFetch([]);

  // Mock flow-loader (YAML import not available in vitest)
  vi.doMock('../src/logic/flow-loader.js', () => ({
    getFlows: () => ({
      fix: {
        label: 'Debug',
        icon: 'bug',
        panel_a: {
          label: 'Current State',
          fields: { description: { type: 'text' } },
        },
        panel_b: {
          label: 'Expected Outcome',
          fields: { description: { type: 'text' } },
        },
        steps: [],
      },
      review: {
        label: 'Review',
        icon: 'code-review',
        panel_a: { label: 'PR Context', fields: {} },
        panel_b: { label: 'Review Focus', fields: {} },
        steps: [],
      },
      implement: {
        label: 'Implement',
        icon: 'plus',
        panel_a: { label: 'Requirements', fields: {} },
        panel_b: { label: 'Constraints', fields: {} },
        steps: [],
      },
      improve: {
        label: 'Refactor',
        icon: 'sync',
        panel_a: { label: 'Current Code', fields: {} },
        panel_b: { label: 'Goal', fields: {} },
        steps: [],
      },
    }),
    getFlowById: vi.fn(() => null),
  }));

  state = await import('../src/core/state.js');
  cardConfig = await import('../src/cards/card-configuration.js');
});

afterEach(() => {
  cleanupDOM();
  localStorage.clear();
  vi.restoreAllMocks();
});

// --- Tests ---

describe('Branch auto-select (CFG-04)', () => {
  it('auto-selects default branch on repo selection', async () => {
    state.setState('configuration.pat', 'tok');
    state.setState('configuration.owner', 'alice');

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(callCount === 1 ? SAMPLE_REPOS : SAMPLE_BRANCHES),
      });
    });

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const searchInput = document.querySelector('.field-picker .input-field');
      expect(searchInput).not.toBeNull();
      searchInput.dispatchEvent(new Event('focus'));
      expect(
        document.querySelectorAll('.field-picker .field-picker-item').length
      ).toBe(3);
    });

    document.querySelector('.field-picker .field-picker-item').click();

    await vi.waitFor(() => {
      expect(state.getState().configuration.branch).toBe('main');
    });
  });
});
