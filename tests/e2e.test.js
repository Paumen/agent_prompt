// @vitest-environment jsdom
/**
 * End-to-end tests — Core user journeys and integration
 *
 * Tests the complete flow from configuration to prompt generation.
 * Card-specific UI behaviors are tested in card-*.test.js files.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupFullHTML, cleanupDOM } from './helpers/dom-fixtures.js';
import { createMockState, createMockSteps, createConfiguredState } from './helpers/state-factory.js';

// --- Mock data ---

const SAMPLE_REPOS = [
  { name: 'my-app', default_branch: 'main' },
  { name: 'other-repo', default_branch: 'develop' },
];

const SAMPLE_BRANCHES = [{ name: 'main' }, { name: 'feature-x' }];
const SAMPLE_ISSUES = [{ number: 42, title: 'Login form crashes on submit' }];
const SAMPLE_PRS = [{ number: 101, title: 'Add dark mode support' }];
const SAMPLE_TREE = {
  tree: [
    { path: 'src/index.js', type: 'blob' },
    { path: 'README.md', type: 'blob' },
  ],
  truncated: false,
};

function createSmartFetch() {
  return vi.fn().mockImplementation((url) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/issues')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(SAMPLE_ISSUES) });
    }
    if (urlStr.includes('/pulls')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(SAMPLE_PRS) });
    }
    if (urlStr.includes('/git/trees/')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(SAMPLE_TREE) });
    }
    if (urlStr.includes('/branches')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(SAMPLE_BRANCHES) });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(SAMPLE_REPOS) });
  });
}

let state, cardConfig, cardTasks, cardSteps, cardPrompt, mainModule;

async function initAllModules() {
  vi.resetModules();
  localStorage.clear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
  vi.spyOn(window, 'open').mockImplementation(() => null);
  globalThis.fetch = createSmartFetch();

  state = await import('../src/core/state.js');
  cardConfig = await import('../src/cards/card-configuration.js');
  cardTasks = await import('../src/cards/card-tasks.js');
  cardSteps = await import('../src/cards/card-steps.js');
  cardPrompt = await import('../src/cards/card-prompt.js');
  mainModule = await import('../src/common/main.js');
}

async function setupRepoAndBranch() {
  state.setState('configuration.pat', 'ghp_test123');
  state.setState('configuration.owner', 'testuser');
  cardConfig.initConfigurationCard();

  await vi.waitFor(() => {
    const searchInput = document.querySelector('.field-picker .input-field');
    expect(searchInput).not.toBeNull();
    searchInput.dispatchEvent(new Event('focus'));
    expect(document.querySelectorAll('.field-picker .field-picker-item').length).toBeGreaterThan(0);
  });

  document.querySelector('.field-picker .field-picker-item').click();

  await vi.waitFor(() => {
    expect(state.getState().configuration.branch).toBe('main');
  });
}

// --- Tests ---

describe('E2E: Complete User Journey', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    cleanupDOM();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('produces valid prompt for Fix flow with issue', async () => {
    mainModule.initChevrons();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    // Select Fix flow
    document.querySelector('.btn-select[data-flow-id="fix"]').click();
    await vi.waitFor(() => expect(state.getState().task.flow_id).toBe('fix'));

    // Fill description
    const textarea = document.querySelector('#bd-tasks .card .input-field--textarea');
    textarea.value = 'Login crashes when clicking submit';
    textarea.dispatchEvent(new Event('input'));

    // Verify prompt structure
    const prompt = state.getState()._prompt;
    expect(prompt).toContain('<prompt>');
    expect(prompt).toContain('</prompt>');
    expect(prompt).toContain('task="debug"');
    expect(prompt).toContain('https://github.com/testuser/my-app');
    expect(prompt).toContain('Login crashes when clicking submit');
    expect(prompt).toContain('<todo>');
    expect(prompt).toContain('Step 1:');
  });

  it('step deletion updates prompt', async () => {
    mainModule.initChevrons();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    document.querySelector('.btn-select[data-flow-id="fix"]').click();
    await vi.waitFor(() => expect(state.getState().task.flow_id).toBe('fix'));

    const textarea = document.querySelector('#bd-tasks .card .input-field--textarea');
    textarea.value = 'Bug description';
    textarea.dispatchEvent(new Event('input'));

    await vi.waitFor(() => {
      expect(document.querySelectorAll('.output-field').length).toBeGreaterThan(0);
    });

    const promptBefore = state.getState()._prompt;
    document.querySelector('.btn-icon[aria-label^="Remove step"]').click();

    await vi.waitFor(() => {
      expect(state.getState()._prompt).not.toBe(promptBefore);
    });
  });
});

describe('E2E: Flow Switch Reset (DM-DEF-03)', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    cleanupDOM();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('switching flow resets panel_a, panel_b, steps but preserves config', async () => {
    mainModule.initChevrons();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    // Select Fix flow and fill data
    document.querySelector('.btn-select[data-flow-id="fix"]').click();
    await vi.waitFor(() => expect(state.getState().task.flow_id).toBe('fix'));

    state.setState('panel_a.description', 'Some bug description');
    state.setState('panel_a.issue_number', 42);
    state.setState('panel_b.description', 'Expected to work');

    // Switch to Review flow
    document.querySelector('.btn-select[data-flow-id="review"]').click();
    await vi.waitFor(() => expect(state.getState().task.flow_id).toBe('review'));

    // Verify reset
    const s = state.getState();
    expect(s.panel_a.description).toBe('');
    expect(s.panel_a.issue_number).toBeNull();
    expect(s.panel_b.description).toBe('');
    expect(s.steps.removed_step_ids).toEqual([]);

    // Configuration preserved
    expect(s.configuration.owner).toBe('testuser');
    expect(s.configuration.repo).toBe('my-app');
  });
});

describe('E2E: Prompt Determinism (TST-01)', () => {
  it('identical inputs produce identical prompts', async () => {
    const { buildPrompt } = await import('../src/core/prompt-builder.js');

    const fixedState = createMockState({
      configuration: { owner: 'testuser', repo: 'my-app', branch: 'main', pat: 'ghp_test123' },
      task: { flow_id: 'fix' },
      panel_a: { description: 'Login crashes', issue_number: 42, pr_number: null, files: ['src/index.js'] },
      steps: { enabled_steps: createMockSteps(2), removed_step_ids: [] },
    });

    const results = Array.from({ length: 10 }, () => buildPrompt(structuredClone(fixedState)));

    // All runs must produce identical output
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBe(results[0]);
    }
    expect(results[0]).toContain('<prompt>');
    expect(results[0]).toContain('Login crashes');
  });

  it('different inputs produce different outputs', async () => {
    const { buildPrompt } = await import('../src/core/prompt-builder.js');

    const state1 = createConfiguredState({ flowId: 'fix' });
    state1.panel_a.description = 'Bug A';

    const state2 = structuredClone(state1);
    state2.panel_a.description = 'Bug B';

    expect(buildPrompt(state1)).not.toBe(buildPrompt(state2));
  });
});
