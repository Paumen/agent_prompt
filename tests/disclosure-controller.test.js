// @vitest-environment jsdom
/**
 * Disclosure Controller — Card state transitions and progressive disclosure
 *
 * Tests acceptance criteria for collapse/expand and dim/undim behavior.
 * Uses the REAL rendering pipeline (card-configuration.js, card-tasks.js,
 * disclosure-controller.js) — no mocked flow-loader, no hand-crafted panel DOM.
 *
 * Organized by AC group: Configuration (AC 1.x), Progression (AC 2.x), Focus (AC 3.x).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupFullHTML, cleanupDOM } from './helpers/dom-fixtures.js';

// --- Mock GitHub API responses ---

const SAMPLE_REPOS = [
  { name: 'my-app', default_branch: 'main' },
  { name: 'other-repo', default_branch: 'develop' },
];
const SAMPLE_BRANCHES = [{ name: 'main' }, { name: 'feature-x' }];
const SAMPLE_ISSUES = [{ number: 42, title: 'Login bug' }];
const SAMPLE_PRS = [{ number: 101, title: 'Dark mode PR' }];
const SAMPLE_TREE = {
  tree: [{ path: 'src/index.js', type: 'blob' }],
  truncated: false,
};

function createSmartFetch() {
  return vi.fn().mockImplementation((url) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.includes('/issues'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_ISSUES),
      });
    if (u.includes('/pulls'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_PRS),
      });
    if (u.includes('/git/trees/'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_TREE),
      });
    if (u.includes('/branches'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_BRANCHES),
      });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_REPOS),
    });
  });
}

// --- Module references (real, not mocked) ---

let state, cardConfig, cardTasks, cardSteps, cardPrompt, disclosureCtrl;

async function initAllModules() {
  vi.resetModules();
  localStorage.clear();

  // Stub RAF to fire as microtask — ensures applyCardStates() runs after
  // synchronous code (e.g. renderDualPanels) but before the next await.
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    queueMicrotask(cb);
    return 1;
  });
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
  disclosureCtrl = await import('../src/logic/disclosure-controller.js');
}

/**
 * Set credentials, init config card, wait for repos to load,
 * select first repo (triggers branch auto-select).
 */
async function setupRepoAndBranch() {
  state.setState('configuration.pat', 'ghp_test123');
  state.setState('configuration.owner', 'testuser');
  cardConfig.initConfigurationCard();

  await vi.waitFor(() => {
    const searchInput = document.querySelector('.field-picker .input-field');
    expect(searchInput).not.toBeNull();
    searchInput.dispatchEvent(new Event('focus'));
    expect(
      document.querySelectorAll('.field-picker .field-picker-item').length
    ).toBeGreaterThan(0);
  });

  // Click the first repo
  document.querySelector('.field-picker .field-picker-item').click();

  // Wait for branch auto-select
  await vi.waitFor(() => {
    expect(state.getState().configuration.branch).toBe('main');
  });
}

/** Init all cards + disclosure controller (the real pipeline) */
function initCards() {
  cardTasks.initTasksCard();
  cardSteps.initStepsCard();
  cardPrompt.initPromptCard();
  disclosureCtrl.initDisclosureController();
}

/** Select a flow by clicking its button in the Task card */
async function clickFlow(flowId) {
  const btn = document.querySelector(`.btn-select[data-flow-id="${flowId}"]`);
  expect(btn).not.toBeNull();
  btn.click();
  await vi.waitFor(() => expect(state.getState().task.flow_id).toBe(flowId));
}

/** Helper: get data-card-state from element by ID */
function cardState(id) {
  return document.getElementById(id)?.dataset?.cardState;
}

/** Helper: get data-card-state from a panel by data-panel name */
function panelState(panelName) {
  return document.querySelector(`[data-panel="${panelName}"]`)?.dataset
    ?.cardState;
}

/** Helper: check if a <details> element is open */
function isOpen(id) {
  return document.getElementById(id)?.open ?? false;
}



/** Helper: simulate user interaction with a card */
function interactWithCard(cardId) {
  const el = document.getElementById(cardId);
  if (el) {
    el.open = true;
    el.dispatchEvent(new Event('toggle'));
    el.dispatchEvent(new Event('pointerenter'));
  }
}

/** Helper: flush microtasks so RAF-stubbed applyCardStates fires */
async function flushStates() {
  await Promise.resolve();
  await Promise.resolve();
}

/** Helper: simulate user interaction with a panel */
function interactWithPanel(panelName) {
  const el = document.querySelector(`[data-panel="${panelName}"]`);
  if (el) {
    el.open = true;
    el.dispatchEvent(new Event('toggle'));
    el.dispatchEvent(new Event('pointerenter'));
  }
}

// ─── AC 1: Configuration Card & Credential Validation ─────────────────────

describe('AC 1 — Configuration Card & Credential Validation', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    cleanupDOM();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('AC 1.1: Repo and Branch pickers are visible but inactive/disabled when credentials are empty', () => {
    cardConfig.initConfigurationCard();
    initCards();

    // Config card body should have 4 child sections (username, PAT, repo picker, branch picker)
    const body = document.getElementById('bd-configuration');
    expect(body.children.length).toBeGreaterThanOrEqual(4);

    // Repo and Branch picker containers must exist and be visible (not hidden)
    const pickers = body.querySelectorAll('.field-picker');
    expect(pickers.length).toBeGreaterThanOrEqual(2);

    for (const picker of pickers) {
      // Each picker must have visible content (placeholder, disabled input, etc.)
      // NOT be an empty div
      expect(picker.children.length).toBeGreaterThan(0);
    }
  });

  it('AC 1.1: Repo and Branch pickers are disabled when credentials are empty', () => {
    cardConfig.initConfigurationCard();
    initCards();

    const body = document.getElementById('bd-configuration');
    const pickers = body.querySelectorAll('.field-picker');

    // Pickers should contain elements with disabled attribute or data-state="disabled"
    for (const picker of pickers) {
      const hasDisabled =
        picker.querySelector('[disabled]') ||
        picker.querySelector('[data-state="disabled"]') ||
        picker.hasAttribute('aria-disabled');
      expect(hasDisabled).toBeTruthy();
    }
  });

  it('AC 1.2: Warning appears when interacting with disabled Repo picker', () => {
    cardConfig.initConfigurationCard();
    initCards();

    const body = document.getElementById('bd-configuration');
    const repoPicker = body.querySelectorAll('.field-picker')[0];

    // Click on the disabled repo picker
    repoPicker.click();

    // A warning tooltip or message should appear
    const warning =
      document.querySelector('.guard-tooltip--visible') ||
      repoPicker.querySelector('[role="alert"]') ||
      repoPicker.querySelector('.guard-hint') ||
      document.querySelector('[role="status"]');
    expect(warning).not.toBeNull();
  });

  it('AC 1.3: After repo selection, all four fields (Username, PAT, Repo, Branch) remain visible', async () => {
    initCards();
    await setupRepoAndBranch();

    const body = document.getElementById('bd-configuration');

    // Username input must NOT be hidden
    const usernameInput = body.querySelector('#cfg-username');
    expect(usernameInput).not.toBeNull();
    const usernameSection = usernameInput.closest('.field-picker-search');
    expect(usernameSection?.hidden).not.toBe(true);

    // PAT input must NOT be hidden
    const patInput = body.querySelector('#cfg-pat');
    expect(patInput).not.toBeNull();
    const patSection = patInput.closest('.field-picker-search');
    expect(patSection?.hidden).not.toBe(true);
  });

  it('AC 1.3: Config card remains fully expanded and undimmed after repo selection', async () => {
    initCards();
    await setupRepoAndBranch();

    expect(isOpen('card-configuration')).toBe(true);
    expect(cardState('card-configuration')).toBe('active');
  });
});

// ─── AC 2: Card Progression & Hierarchy ────────────────────────────────────

describe('AC 2 — Card Progression & Hierarchy', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    cleanupDOM();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('AC 2.1: Task card opens upon repo selection', async () => {
    initCards();
    await setupRepoAndBranch();

    expect(isOpen('card-tasks')).toBe(true);
    expect(cardState('card-tasks')).toBe('active');
  });

  

  it('AC 2.2: When flow is selected, Config card becomes complete and collapses', async () => {
    initCards();
    await setupRepoAndBranch();
    await clickFlow('fix');

    expect(cardState('card-configuration')).toBe('complete');
    expect(isOpen('card-configuration')).toBe(false);
  });

  it('AC 2.2: When flow is selected, Situation panel opens active/undimmed', async () => {
    initCards();
    await setupRepoAndBranch();
    await clickFlow('fix');

    expect(panelState('situation')).toBe('active');
    expect(isPanelOpen('situation')).toBe(true);
  });

  it('AC 2.2: When flow is selected, Target panel opens in dimmed state', async () => {
    initCards();
    await setupRepoAndBranch();
    await clickFlow('fix');

    expect(panelState('target')).toBe('skippable');
    expect(isPanelOpen('target')).toBe(true);
  });

  

    



  
  

// ─── AC 3: Interaction & Focus Management ──────────────────────────────────

describe('AC 3 — Interaction & Focus Management', () => {
  beforeEach(async () => {
    setupFullHTML();
    await initAllModules();
  });

  afterEach(() => {
    cleanupDOM();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  
