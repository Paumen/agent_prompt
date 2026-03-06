// @vitest-environment jsdom
/**
 * End-to-end tests — Core user journeys
 *
 * Focused tests for: prompt generation, determinism, flow switch reset
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

// --- Setup helpers ---

function setupFullHTML() {
  document.body.innerHTML = `
    <main id="app">
      <section class="card card--open" id="card-configuration">
        <button class="card-header" aria-expanded="true">
          <span class="card-title">Configuration</span>
        </button>
        <div class="card-body" id="bd-configuration"></div>
      </section>
      <section class="card" id="card-tasks">
        <button class="card-header" aria-expanded="false">
          <span class="card-title">Task</span>
        </button>
        <div class="card-body" id="bd-tasks"></div>
      </section>
      <section class="card" id="card-steps">
        <button class="card-header" aria-expanded="false">
          <span class="card-title">Steps</span>
        </button>
        <div class="card-body" id="bd-steps"></div>
      </section>
      <section class="card" id="card-prompt">
        <button class="card-header" aria-expanded="false">
          <span class="card-title">Prompt</span>
        </button>
        <div class="card-body" id="bd-prompt"></div>
      </section>
    </main>
  `;
}

function createSmartFetch() {
  return vi.fn().mockImplementation((url) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/issues')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ISSUES),
      });
    }
    if (urlStr.includes('/pulls')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_PRS),
      });
    }
    if (urlStr.includes('/git/trees/')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_TREE),
      });
    }
    if (urlStr.includes('/branches')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_BRANCHES),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_REPOS),
    });
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
    const items = document.querySelectorAll('.field-picker .field-picker-item');
    expect(items.length).toBeGreaterThan(0);
  });

  const repoItem = document.querySelector('.field-picker .field-picker-item');
  repoItem.click();

  await vi.waitFor(() => {
    expect(state.getState().configuration.branch).toBe('main');
  });
}

// ============================================================
//  Test suites
// ============================================================

describe('E2E: Fix Flow Journey', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('produces valid prompt for Fix flow with issue', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    // Select Fix flow
    const fixBtn = Array.from(
      document.querySelectorAll('.btn-select[data-flow-id]')
    ).find((b) => b.dataset.flowId === 'fix');
    fixBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBe('fix');
    });

    // Fill panel A
    const textarea = document.querySelector(
      '#bd-tasks .card .input-field--textarea'
    );
    textarea.value = 'Login crashes when clicking submit';
    textarea.dispatchEvent(new Event('input'));

    // Verify prompt structure
    const prompt = state.getState()._prompt;
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('<prompt>');
    expect(prompt).toContain('</prompt>');
    expect(prompt).toContain('task="debug"');
    expect(prompt).toContain('Fix / Debug');
    expect(prompt).toContain('https://github.com/testuser/my-app');
    expect(prompt).toContain('Login crashes when clicking submit');
    expect(prompt).toContain('<todo>');
    expect(prompt).toContain('Step 1:');
  });

  it('step deletion updates prompt', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    const fixBtn = Array.from(
      document.querySelectorAll('.btn-select[data-flow-id]')
    ).find((b) => b.dataset.flowId === 'fix');
    fixBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBe('fix');
    });

    const textarea = document.querySelector(
      '#bd-tasks .card .input-field--textarea'
    );
    textarea.value = 'Bug description';
    textarea.dispatchEvent(new Event('input'));

    await vi.waitFor(() => {
      expect(document.querySelectorAll('.output-field').length).toBeGreaterThan(
        0
      );
    });

    const promptBefore = state.getState()._prompt;
    const deleteBtn = document.querySelector(
      '.btn-icon[aria-label^="Remove step"]'
    );
    deleteBtn.click();

    await vi.waitFor(() => {
      expect(state.getState()._prompt).not.toBe(promptBefore);
    });
  });
});

describe('TST-01: Prompt Determinism', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('identical inputs produce identical prompts (10 runs)', async () => {
    const { buildPrompt } = await import('../src/core/prompt-builder.js');

    const fixedState = {
      version: '1.0',
      configuration: {
        owner: 'testuser',
        repo: 'my-app',
        branch: 'main',
        pat: 'ghp_test123',
      },
      task: { flow_id: 'fix' },
      panel_a: {
        description: 'Login crashes on submit',
        issue_number: 42,
        pr_number: null,
        files: ['src/index.js'],
      },
      panel_b: {
        description: 'Should redirect to dashboard',
        issue_number: null,
        spec_files: ['README.md'],
        guideline_files: [],
        acceptance_criteria: '',
        lenses: [],
      },
      steps: {
        enabled_steps: [
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
        ],
        removed_step_ids: [],
      },
      improve_scope: null,
      notes: { user_text: '' },
      output: { destination: 'clipboard' },
    };

    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(buildPrompt(structuredClone(fixedState)));
    }

    // All 10 runs must produce identical output
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBe(results[0]);
    }

    // Verify basic structure
    expect(results[0]).toContain('<prompt>');
    expect(results[0]).toContain('</prompt>');
    expect(results[0]).toContain('Login crashes on submit');
  });

  it('different inputs produce different outputs', async () => {
    const { buildPrompt } = await import('../src/core/prompt-builder.js');

    const state1 = {
      configuration: {
        owner: 'alice',
        repo: 'foo',
        branch: 'main',
        pat: 'tok1',
      },
      task: { flow_id: 'fix' },
      panel_a: {
        description: 'Bug A',
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
      steps: { enabled_steps: [], removed_step_ids: [] },
      improve_scope: null,
      notes: { user_text: '' },
      output: { destination: 'clipboard' },
    };

    const state2 = structuredClone(state1);
    state2.panel_a.description = 'Bug B';

    expect(buildPrompt(state1)).not.toBe(buildPrompt(state2));
  });
});

describe('DM-DEF-03: Flow Switch Reset', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('switching flow resets panel_a, panel_b, steps', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    // Select Fix flow and fill data
    const fixBtn = Array.from(
      document.querySelectorAll('.btn-select[data-flow-id]')
    ).find((b) => b.dataset.flowId === 'fix');
    fixBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBe('fix');
    });

    state.setState('panel_a.description', 'Some bug description');
    state.setState('panel_a.issue_number', 42);
    state.setState('panel_b.description', 'Expected to work');

    // Verify data is set
    let s = state.getState();
    expect(s.panel_a.description).toBe('Some bug description');
    expect(s.panel_a.issue_number).toBe(42);

    // Switch to Review flow
    const reviewBtn = Array.from(
      document.querySelectorAll('.btn-select[data-flow-id]')
    ).find((b) => b.dataset.flowId === 'review');
    reviewBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBe('review');
    });

    // Verify full reset
    s = state.getState();
    expect(s.panel_a.description).toBe('');
    expect(s.panel_a.issue_number).toBeNull();
    expect(s.panel_a.pr_number).toBeNull();
    expect(s.panel_b.description).toBe('');
    expect(s.steps.removed_step_ids).toEqual([]);

    // Configuration should be preserved
    expect(s.configuration.owner).toBe('testuser');
    expect(s.configuration.repo).toBe('my-app');
  });
});
