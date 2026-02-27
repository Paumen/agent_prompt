// @vitest-environment jsdom
/**
 * End-to-end tests — Phase 9
 *
 * TST-02: Full user journey (repo → flow → panel input → step adjust → prompt matches).
 * TST-01: Prompt determinism (identical prompt_input → identical output, run N times).
 * Card expand/collapse transitions, flow switch reset (DM-DEF-03), PAT clear + re-entry.
 *
 * Two representative flows tested: Fix/Debug and Review/Analyze.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Mock data ---

const SAMPLE_REPOS = [
  { name: 'my-app', default_branch: 'main' },
  { name: 'other-repo', default_branch: 'develop' },
];

const SAMPLE_BRANCHES = [{ name: 'main' }, { name: 'feature-x' }];

const SAMPLE_TREE = {
  tree: [
    { path: 'src/index.js', type: 'blob' },
    { path: 'src/utils/helpers.js', type: 'blob' },
    { path: 'README.md', type: 'blob' },
  ],
  truncated: false,
};

const SAMPLE_ISSUES = [
  { number: 42, title: 'Login form crashes on submit' },
  { number: 15, title: 'Missing validation' },
];

const SAMPLE_PRS = [
  { number: 101, title: 'Add dark mode support' },
  { number: 99, title: 'Refactor auth module' },
];

// --- HTML shell matching index.html structure ---

function setupFullHTML() {
  document.body.innerHTML = `
    <main id="app">
      <section class="card card--open" id="card-configuration">
        <button class="card-header" aria-expanded="true" aria-controls="bd-configuration">
          <span class="card-title">Configuration</span>
          <span class="card-chevron" aria-hidden="true"></span>
        </button>
        <div class="card-body" id="bd-configuration"></div>
      </section>
      <section class="card" id="card-tasks">
        <button class="card-header" aria-expanded="false" aria-controls="bd-tasks">
          <span class="card-title">Task</span>
          <span class="card-chevron" aria-hidden="true"></span>
        </button>
        <div class="card-body" id="bd-tasks"></div>
      </section>
      <section class="card" id="card-steps">
        <button class="card-header" aria-expanded="false" aria-controls="bd-steps">
          <span class="card-title">Steps</span>
          <span class="card-chevron" aria-hidden="true"></span>
        </button>
        <div class="card-body" id="bd-steps"></div>
      </section>
      <section class="card" id="card-prompt">
        <button class="card-header" aria-expanded="false" aria-controls="bd-prompt">
          <span class="card-title">Prompt</span>
          <span class="card-chevron" aria-hidden="true"></span>
        </button>
        <div class="card-body" id="bd-prompt"></div>
      </section>
    </main>
  `;
}

// --- Fetch mock that returns different data based on URL ---

function createSmartFetch() {
  return vi.fn().mockImplementation((url) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Issues endpoint
    if (urlStr.includes('/issues')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ISSUES),
      });
    }
    // PRs endpoint
    if (urlStr.includes('/pulls')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_PRS),
      });
    }
    // Tree endpoint
    if (urlStr.includes('/git/trees/')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_TREE),
      });
    }
    // Branches endpoint
    if (urlStr.includes('/branches')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_BRANCHES),
      });
    }
    // Default: repos endpoint
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_REPOS),
    });
  });
}

// --- Module references (reset per test) ---

let state, cardConfig, cardTasks, cardSteps, cardPrompt, mainModule;

async function initAllModules() {
  vi.resetModules();
  localStorage.clear();

  // Mock clipboard API
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });

  // Mock window.open for "Prompt Claude" button
  vi.spyOn(window, 'open').mockImplementation(() => null);

  globalThis.fetch = createSmartFetch();

  state = await import('../src/js/state.js');
  cardConfig = await import('../src/js/card-configuration.js');
  cardTasks = await import('../src/js/card-tasks.js');
  cardSteps = await import('../src/js/card-steps.js');
  cardPrompt = await import('../src/js/card-prompt.js');
  mainModule = await import('../src/js/main.js');
}

// --- Helper: set up credentials and select a repo + branch ---

async function setupRepoAndBranch() {
  state.setState('configuration.pat', 'ghp_test123');
  state.setState('configuration.owner', 'testuser');

  cardConfig.initConfigurationCard();

  // Wait for repos to render
  await vi.waitFor(() => {
    const buttons = document.querySelectorAll(
      '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
    );
    expect(buttons.length).toBeGreaterThan(0);
  });

  // Click first repo ("my-app")
  const repoBtn = document.querySelector(
    '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
  );
  repoBtn.click();

  // Wait for branches to load and auto-select default
  await vi.waitFor(() => {
    expect(state.getState().configuration.branch).toBe('main');
  });
}

// ============================================================
//  Test suites
// ============================================================

describe('E2E: Full User Journey', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------------
  //  TST-02: Fix / Debug journey
  // ----------------------------------------------------------
  describe('TST-02: Fix / Debug journey', () => {
    it('produces expected prompt for fixed inputs', async () => {
      // 1) Init cards
      mainModule.initCardToggles();
      cardTasks.initTasksCard();
      cardSteps.initStepsCard();
      cardPrompt.initPromptCard();

      // 2) Set up credentials, select repo + branch
      await setupRepoAndBranch();

      // 3) Select Fix / Debug flow
      const flowBtns = document.querySelectorAll('.flow-btn');
      const fixBtn = Array.from(flowBtns).find(
        (b) => b.dataset.flowId === 'fix'
      );
      expect(fixBtn).toBeTruthy();
      fixBtn.click();

      // Wait for flow to be applied
      await vi.waitFor(() => {
        expect(state.getState().task.flow_id).toBe('fix');
      });

      // Wait for issues to load (async prefetch)
      await vi.waitFor(() => {
        const dropdowns = document.querySelectorAll('.dropdown-wrapper');
        expect(dropdowns.length).toBeGreaterThan(0);
      });

      // 4) Fill Panel A: description
      const panelATextarea = document.querySelector('.panel-a .field-textarea');
      expect(panelATextarea).toBeTruthy();
      panelATextarea.value = 'Login crashes when clicking submit';
      panelATextarea.dispatchEvent(new Event('input'));

      // 5) Fill Panel B: description
      const panelBTextarea = document.querySelector('.panel-b .field-textarea');
      expect(panelBTextarea).toBeTruthy();
      panelBTextarea.value = 'Form should validate and redirect to dashboard';
      panelBTextarea.dispatchEvent(new Event('input'));

      // 6) Verify steps are generated
      await vi.waitFor(() => {
        const stepRows = document.querySelectorAll('.step-row');
        expect(stepRows.length).toBeGreaterThan(0);
      });

      // 7) Delete a step (e.g., read-claude) to test step adjustment
      const deleteBtn = document.querySelector('.step-delete');
      if (deleteBtn) {
        deleteBtn.click();
      }

      // 8) Verify prompt is generated
      const prompt = state.getState()._prompt;
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);

      // Inline snapshot check: verify key structural elements
      expect(prompt).toContain('<prompt>');
      expect(prompt).toContain('</prompt>');
      expect(prompt).toContain('<context>');
      expect(prompt).toContain('task="debug"');
      expect(prompt).toContain('Fix / Debug');
      expect(prompt).toContain('https://github.com/testuser/my-app');
      expect(prompt).toContain('main');
      expect(prompt).toContain('ghp_test123');
      expect(prompt).toContain('<todo>');
      expect(prompt).toContain('</todo>');
      expect(prompt).toContain('Login crashes when clicking submit');
      expect(prompt).toContain(
        'Form should validate and redirect to dashboard'
      );
      expect(prompt).toContain('Step 1:');
    });

    it('step deletion persists in the prompt', async () => {
      mainModule.initCardToggles();
      cardTasks.initTasksCard();
      cardSteps.initStepsCard();
      cardPrompt.initPromptCard();
      await setupRepoAndBranch();

      // Select Fix flow
      const fixBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
        (b) => b.dataset.flowId === 'fix'
      );
      fixBtn.click();

      await vi.waitFor(() => {
        expect(state.getState().task.flow_id).toBe('fix');
      });

      // Fill required field
      const textarea = document.querySelector('.panel-a .field-textarea');
      textarea.value = 'Bug description';
      textarea.dispatchEvent(new Event('input'));

      // Count steps before deletion
      await vi.waitFor(() => {
        expect(document.querySelectorAll('.step-row').length).toBeGreaterThan(
          0
        );
      });

      const stepsBefore = document.querySelectorAll('.step-row').length;
      const promptBefore = state.getState()._prompt;

      // Delete first step
      const deleteBtn = document.querySelector('.step-delete');
      deleteBtn.click();

      await vi.waitFor(() => {
        const stepsAfter = document.querySelectorAll('.step-row').length;
        expect(stepsAfter).toBeLessThan(stepsBefore);
      });

      // Prompt should have changed after step deletion
      const promptAfter = state.getState()._prompt;
      expect(promptAfter).not.toBe(promptBefore);
    });
  });

  // ----------------------------------------------------------
  //  TST-02: Review / Analyze journey
  // ----------------------------------------------------------
  describe('TST-02: Review / Analyze journey', () => {
    it('produces expected prompt with PR selection', async () => {
      mainModule.initCardToggles();
      cardTasks.initTasksCard();
      cardSteps.initStepsCard();
      cardPrompt.initPromptCard();
      await setupRepoAndBranch();

      // Select Review flow
      const reviewBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
        (b) => b.dataset.flowId === 'review'
      );
      expect(reviewBtn).toBeTruthy();
      reviewBtn.click();

      await vi.waitFor(() => {
        expect(state.getState().task.flow_id).toBe('review');
      });

      // Wait for PR dropdown to load
      await vi.waitFor(() => {
        const dropdowns = document.querySelectorAll('.dropdown-wrapper');
        expect(dropdowns.length).toBeGreaterThan(0);
      });

      // Select a PR via state (simulating dropdown click)
      state.setState('panel_a.pr_number', 101);

      // Verify prompt contains review-specific elements
      const prompt = state.getState()._prompt;
      expect(prompt).toBeTruthy();
      expect(prompt).toContain('task="review"');
      expect(prompt).toContain('Review / Analyze');
      expect(prompt).toContain('review_subject');
      expect(prompt).toContain('review_criteria');
      expect(prompt).toContain('PR #101');
    });

    it('lens toggle updates the prompt', async () => {
      mainModule.initCardToggles();
      cardTasks.initTasksCard();
      cardSteps.initStepsCard();
      cardPrompt.initPromptCard();
      await setupRepoAndBranch();

      // Select Review flow
      const reviewBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
        (b) => b.dataset.flowId === 'review'
      );
      reviewBtn.click();

      await vi.waitFor(() => {
        expect(state.getState().task.flow_id).toBe('review');
      });

      // Select a PR to populate conditional steps
      state.setState('panel_a.pr_number', 101);

      // Wait for steps to render with lenses
      await vi.waitFor(() => {
        const lensPills = document.querySelectorAll('.step-lens-pills .pill');
        expect(lensPills.length).toBeGreaterThan(0);
      });

      const promptBefore = state.getState()._prompt;

      // Toggle a lens pill via state (simulating click)
      const currentSteps = state.getState().steps.enabled_steps;
      const stepWithLenses = currentSteps.find((s) => s.lenses !== undefined);
      if (stepWithLenses) {
        const idx = currentSteps.indexOf(stepWithLenses);
        const updated = currentSteps.map((s, i) =>
          i === idx ? { ...s, lenses: [...(s.lenses || []), 'security'] } : s
        );
        state.setState('steps.enabled_steps', updated);
      }

      const promptAfter = state.getState()._prompt;

      // If a step had lenses, the prompt should reflect the change
      if (stepWithLenses) {
        expect(promptAfter).not.toBe(promptBefore);
        expect(promptAfter).toContain('security');
      }
    });
  });
});

// ============================================================
//  TST-01: Prompt Determinism
// ============================================================

describe('TST-01: Prompt determinism', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('identical prompt_input produces identical output 10 times', () => {
    const { buildPrompt } = require('../src/js/prompt-builder.js');

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
            lenses: ['error_handling'],
          },
          { id: 'run-tests', operation: 'validate', object: 'tests' },
          {
            id: 'commit-pr',
            operation: 'commit',
            object: 'changes',
            params: { open_draft_pr: true },
            pr_name: 'optional_text',
          },
        ],
        removed_step_ids: [],
      },
      improve_scope: null,
      notes: { user_text: 'Check auth module carefully' },
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

    // Verify the output is non-empty and structurally sound
    expect(results[0]).toBeTruthy();
    expect(results[0]).toContain('<prompt>');
    expect(results[0]).toContain('</prompt>');
    expect(results[0]).toContain('Login crashes on submit');
    expect(results[0]).toContain('Should redirect to dashboard');
    expect(results[0]).toContain('#42');
    expect(results[0]).toContain('@README.md');
    expect(results[0]).toContain('Check auth module carefully');
    expect(results[0]).toContain('<notes>');

    // Inline snapshot — the exact expected output for this fixed input
    expect(results[0]).toBe(
      `<prompt>
  <context>
    Please help <task="debug"> Fix / Debug </task> by executing below 'todo' steps
    for <repository> https://github.com/testuser/my-app </repository>
    on <branch> main </branch>.
    Authenticate using PAT: <PAT> ghp_test123 </PAT>.
    Please provide one sentence feedback to HUMAN (me) here (in this interface) after each step (except step 1), and proceed to next step.
  </context>
  <todo>
    Step 1: Read @claude.md
    Step 2: Read and investigate the 'undesired_behavior' and 'expected_behavior' to understand the issue:
              <undesired_behavior>
                Undesired behavior observed by user is: Login crashes on submit.
                Attempt to learn more regarding the undesired behavior by reading issue #42.
                Attempt to learn more regarding the undesired behavior by reading files @src/index.js.
              </undesired_behavior>
              <expected_behavior>
                Expected behavior after the fix: Should redirect to dashboard.
                Reference specifications: @README.md.
              </expected_behavior>
             If unclear or high ambiguity, STOP and DO NOT proceed to next steps, share your interpretation with HUMAN and ask for confirmation or clarification, and await HUMAN feedback.
    Step 3: Analyze issue — focus on [semantics]
    Step 4: Create branch
    Step 5: Edit files — focus on [error_handling]
    Step 6: Validate tests
    Step 7: Commit changes true
    Step 8: Provide concise feedback to HUMAN (me) here (in this interface) include:
              - Your understanding of the issue in one sentence.
              - The root cause you identified.
              - The action you took: create branch (incl name and link), implemented fix by editing files (incl file names), ran tests (incl which ones), verified issue is solved, committed PR (incl PR name and link)
  </todo>
</prompt>
<notes>
  Critical note: Check auth module carefully
</notes>`
    );
  });

  it('different inputs produce different outputs', () => {
    const { buildPrompt } = require('../src/js/prompt-builder.js');

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

// ============================================================
//  Card expand/collapse transitions
// ============================================================

describe('Card expand/collapse through journey', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('Config card is open on page load; others are collapsed', () => {
    const cfgCard = document.getElementById('card-configuration');
    const taskCard = document.getElementById('card-tasks');
    const stepsCard = document.getElementById('card-steps');
    const promptCard = document.getElementById('card-prompt');

    expect(cfgCard.classList.contains('card--open')).toBe(true);
    expect(taskCard.classList.contains('card--open')).toBe(false);
    expect(stepsCard.classList.contains('card--open')).toBe(false);
    expect(promptCard.classList.contains('card--open')).toBe(false);
  });

  it('Tasks card expands on repo select', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    const taskCard = document.getElementById('card-tasks');
    expect(taskCard.classList.contains('card--open')).toBe(true);
  });

  it('Steps + Prompt expand and Config collapses on flow select', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    // Select a flow
    const flowBtn = document.querySelector('.flow-btn');
    flowBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBeTruthy();
    });

    const cfgCard = document.getElementById('card-configuration');
    const stepsCard = document.getElementById('card-steps');
    const promptCard = document.getElementById('card-prompt');

    expect(cfgCard.classList.contains('card--open')).toBe(false);
    expect(stepsCard.classList.contains('card--open')).toBe(true);
    expect(promptCard.classList.contains('card--open')).toBe(true);
  });

  it('manual card toggle works via header click', () => {
    mainModule.initCardToggles();

    const stepsCard = document.getElementById('card-steps');
    const stepsHeader = stepsCard.querySelector('.card-header');

    expect(stepsCard.classList.contains('card--open')).toBe(false);

    stepsHeader.click();
    expect(stepsCard.classList.contains('card--open')).toBe(true);
    expect(stepsHeader.getAttribute('aria-expanded')).toBe('true');

    stepsHeader.click();
    expect(stepsCard.classList.contains('card--open')).toBe(false);
    expect(stepsHeader.getAttribute('aria-expanded')).toBe('false');
  });
});

// ============================================================
//  DM-DEF-03: Flow switch fully resets
// ============================================================

describe('DM-DEF-03: Flow switch resets state', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('switching flow resets panel_a, panel_b, steps, and improve_scope', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    // Select Fix flow and fill data
    const fixBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
      (b) => b.dataset.flowId === 'fix'
    );
    fixBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBe('fix');
    });

    // Fill panel A
    state.setState('panel_a.description', 'Some bug description');
    state.setState('panel_a.issue_number', 42);

    // Fill panel B
    state.setState('panel_b.description', 'Expected to work');

    // Verify data is set
    let s = state.getState();
    expect(s.panel_a.description).toBe('Some bug description');
    expect(s.panel_a.issue_number).toBe(42);
    expect(s.panel_b.description).toBe('Expected to work');

    // Delete a step so we have removed_step_ids
    const deleteBtn = document.querySelector('.step-delete');
    if (deleteBtn) deleteBtn.click();

    const removedBefore = state.getState().steps.removed_step_ids;

    // Switch to Review flow
    const reviewBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
      (b) => b.dataset.flowId === 'review'
    );
    reviewBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBe('review');
    });

    // Verify full reset (DM-DEF-03)
    s = state.getState();
    expect(s.panel_a.description).toBe('');
    expect(s.panel_a.issue_number).toBeNull();
    expect(s.panel_a.pr_number).toBeNull();
    expect(s.panel_a.files).toEqual([]);
    expect(s.panel_b.description).toBe('');
    expect(s.panel_b.spec_files).toEqual([]);
    expect(s.panel_b.guideline_files).toEqual([]);
    expect(s.improve_scope).toBeNull();
    expect(s.steps.removed_step_ids).toEqual([]);

    // Steps should be fresh for the review flow (not the fix steps)
    expect(s.steps.enabled_steps.length).toBeGreaterThan(0);
    // The first step for every flow is read-claude
    expect(s.steps.enabled_steps[0].id).toBe('read-claude');

    // Configuration should be preserved across flow switch
    expect(s.configuration.owner).toBe('testuser');
    expect(s.configuration.repo).toBe('my-app');
    expect(s.configuration.branch).toBe('main');
    expect(s.configuration.pat).toBe('ghp_test123');
  });

  it('switching back to original flow does not carry previous data', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    // Select Improve flow
    const improveBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
      (b) => b.dataset.flowId === 'improve'
    );
    improveBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBe('improve');
    });

    state.setState('panel_a.description', 'Improve something');
    state.setState('improve_scope', 'each_file');

    // Switch to Fix
    const fixBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
      (b) => b.dataset.flowId === 'fix'
    );
    fixBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBe('fix');
    });

    // Switch back to Improve
    const improveBtn2 = Array.from(document.querySelectorAll('.flow-btn')).find(
      (b) => b.dataset.flowId === 'improve'
    );
    improveBtn2.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBe('improve');
    });

    // Previous data should NOT be carried
    const s = state.getState();
    expect(s.panel_a.description).toBe('');
    expect(s.improve_scope).toBeNull();
  });
});

// ============================================================
//  PAT clear + re-entry flow
// ============================================================

describe('PAT clear + re-entry flow', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('clearing PAT removes repos and resets state', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    // Verify repos are loaded
    expect(
      document.querySelectorAll(
        '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
      ).length
    ).toBeGreaterThan(0);

    // Click clear PAT button
    const clearBtn = document.querySelector('.cfg-pat-clear');
    expect(clearBtn).toBeTruthy();
    clearBtn.click();

    // PAT field should be empty
    const patInput = document.getElementById('cfg-pat');
    expect(patInput.value).toBe('');

    // State should be reset
    const s = state.getState();
    expect(s.configuration.pat).toBe('');
    expect(s.configuration.repo).toBe('');
    expect(s.configuration.branch).toBe('');

    // File tree should be reset
    expect(cardConfig.getFileTree()).toEqual([]);

    // Repo grid should be empty
    const repoButtons = document.querySelectorAll(
      '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
    );
    expect(repoButtons.length).toBe(0);
  });

  it('re-entering PAT and username re-fetches repos', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();

    state.setState('configuration.pat', 'ghp_old_token');
    state.setState('configuration.owner', 'testuser');
    cardConfig.initConfigurationCard();

    // Wait for repos to load
    await vi.waitFor(() => {
      expect(
        document.querySelectorAll(
          '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
        ).length
      ).toBeGreaterThan(0);
    });

    // Clear PAT
    const clearBtn = document.querySelector('.cfg-pat-clear');
    clearBtn.click();

    // Repos disappear
    expect(
      document.querySelectorAll(
        '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
      ).length
    ).toBe(0);

    // Reset fetch counter
    globalThis.fetch = createSmartFetch();

    // Re-enter PAT
    const patInput = document.getElementById('cfg-pat');
    patInput.value = 'ghp_new_token';
    patInput.dispatchEvent(new Event('input'));
    patInput.dispatchEvent(new Event('change'));

    // Fetch should have been called with new token
    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    // Repos should load again
    await vi.waitFor(() => {
      expect(
        document.querySelectorAll(
          '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
        ).length
      ).toBeGreaterThan(0);
    });
  });

  it('PAT is persisted to localStorage and survives module reload', async () => {
    cardConfig.initConfigurationCard();

    const patInput = document.getElementById('cfg-pat');
    patInput.value = 'ghp_persisted';
    patInput.dispatchEvent(new Event('input'));

    // Verify localStorage
    const stored = JSON.parse(localStorage.getItem('agent_prompt_state'));
    expect(stored.pat).toBe('ghp_persisted');

    // Reset modules (simulates page reload) — but DON'T clear localStorage
    vi.resetModules();
    globalThis.fetch = createSmartFetch();
    const freshState = await import('../src/js/state.js');

    // PAT should be hydrated from localStorage
    expect(freshState.getState().configuration.pat).toBe('ghp_persisted');
  });
});

// ============================================================
//  Prompt preview + Copy + Notes
// ============================================================

describe('Prompt preview and copy', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('prompt preview updates live as state changes', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    // Before flow selection, preview shows placeholder
    const preview = document.querySelector('.prompt-output');
    expect(preview).toBeTruthy();

    // Select a flow
    const fixBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
      (b) => b.dataset.flowId === 'fix'
    );
    fixBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBe('fix');
    });

    // Preview should show the prompt
    await vi.waitFor(() => {
      expect(preview.textContent).toContain('<prompt>');
    });

    // Change panel A and verify preview updates
    state.setState('panel_a.description', 'New bug description');

    await vi.waitFor(() => {
      expect(preview.textContent).toContain('New bug description');
    });
  });

  it('notes textarea updates prompt via state', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    // Select a flow to get a prompt
    const fixBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
      (b) => b.dataset.flowId === 'fix'
    );
    fixBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().task.flow_id).toBe('fix');
    });

    // Type notes
    const notes = document.getElementById('notes-user-text');
    expect(notes).toBeTruthy();
    notes.value = 'Please be extra careful with auth';
    notes.dispatchEvent(new Event('input'));

    // Prompt should include notes
    const prompt = state.getState()._prompt;
    expect(prompt).toContain('Please be extra careful with auth');
    expect(prompt).toContain('<notes>');
  });

  it('copy button calls clipboard API', async () => {
    mainModule.initCardToggles();
    cardTasks.initTasksCard();
    cardSteps.initStepsCard();
    cardPrompt.initPromptCard();
    await setupRepoAndBranch();

    // Select flow to generate a prompt
    const fixBtn = Array.from(document.querySelectorAll('.flow-btn')).find(
      (b) => b.dataset.flowId === 'fix'
    );
    fixBtn.click();

    await vi.waitFor(() => {
      expect(state.getState()._prompt).toBeTruthy();
    });

    // Click copy button
    const copyBtn = document.querySelector('.btn-action');
    expect(copyBtn).toBeTruthy();
    copyBtn.click();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      state.getState()._prompt
    );
  });
});
