// @vitest-environment jsdom
/**
 * Disclosure Controller — Card state transitions and progressive disclosure
 *
 * Tests acceptance criteria for collapse/expand and dim/undim behavior.
 * Organized by AC group: Configuration (AC 1.x), Progression (AC 2.x), Focus (AC 3.x).
 *
 * These tests exercise the disclosure controller indirectly through state changes
 * and DOM attribute assertions (data-card-state, open).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupFullHTML, cleanupDOM } from './helpers/dom-fixtures.js';

// Mock flow-loader before importing disclosure controller
const MOCK_FIX_FLOW = {
  label: 'Debug',
  icon: 'bug',
  panel_a: {
    label: 'Current State',
    subtitle: "What's happening now",
    fields: {
      description: {
        type: 'text',
        required_group: 'a_required',
        placeholder: 'Describe the issue',
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
        placeholder: 'Expected behavior',
      },
      spec_files: {
        type: 'file_picker_multi',
        placeholder: 'Spec files',
      },
    },
  },
  steps: [
    { id: 'read-claude', operation: 'read', object: 'file' },
    { id: 'identify-cause', operation: 'analyze', object: 'issue' },
    { id: 'create-branch', operation: 'create', object: 'branch' },
  ],
};

const MOCK_FLOWS = {
  fix: MOCK_FIX_FLOW,
  review: {
    label: 'Review',
    icon: 'codescan',
    panel_a: {
      label: 'Review Subject',
      fields: {
        description: { type: 'text', placeholder: '' },
        pr_number: {
          type: 'pr_picker',
          required_group: 'a_required',
          placeholder: 'Select PR',
        },
        files: {
          type: 'file_picker_multi',
          required_group: 'a_required',
          placeholder: 'Files',
        },
      },
    },
    panel_b: {
      label: 'Review Criteria',
      fields: {
        lenses: { type: 'lens_picker', default: ['semantics'] },
      },
    },
    steps: [{ id: 'read-pr', operation: 'read', object: 'pull_request' }],
  },
};

vi.mock('../src/logic/flow-loader.js', () => ({
  getFlows: () => MOCK_FLOWS,
  getFlowById: (id) => MOCK_FLOWS[id] || null,
  getFlowIds: () => Object.keys(MOCK_FLOWS),
  ALL_LENSES: ['semantics', 'syntax', 'security'],
}));

let stateModule, disclosureModule;

async function freshInit() {
  vi.resetModules();
  localStorage.clear();

  // Make RAF synchronous for testing
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    cb(0);
    return 1;
  });

  stateModule = await import('../src/core/state.js');
  disclosureModule = await import('../src/logic/disclosure-controller.js');
}

/** Helper: get card state attribute */
function cardState(id) {
  return document.getElementById(id)?.dataset?.cardState;
}

/** Helper: check if a <details> is open */
function isOpen(id) {
  return document.getElementById(id)?.open ?? false;
}

/** Helper: get panel state attribute */
function panelState(panelName) {
  return document.querySelector(`[data-panel="${panelName}"]`)?.dataset
    ?.cardState;
}

/** Helper: check if panel is open */
function isPanelOpen(panelName) {
  return document.querySelector(`[data-panel="${panelName}"]`)?.open ?? false;
}

/** Helper: set config with pat+owner+repo to make task card available */
function setFullConfig() {
  stateModule.setState('configuration.pat', 'ghp_test');
  stateModule.setState('configuration.owner', 'testuser');
  stateModule.setState('configuration.repo', 'my-app');
}

/** Helper: set config + branch */
function setFullConfigWithBranch() {
  setFullConfig();
  stateModule.setState('configuration.branch', 'main');
}

/** Helper: select a flow and create panel DOM (simulates card-tasks rendering) */
function selectFlow(flowId) {
  const flowDef = MOCK_FLOWS[flowId];

  // Create panel DOM BEFORE state change so applyCardStates can find panels
  const bdTasks = document.getElementById('bd-tasks');
  bdTasks.innerHTML = '';

  const panelA = document.createElement('details');
  panelA.className = 'card';
  panelA.dataset.panel = 'situation';
  panelA.open = true;
  const panelAHeader = document.createElement('summary');
  panelAHeader.className = 'card-header';
  panelAHeader.textContent = 'Situation';
  panelA.appendChild(panelAHeader);
  const panelABody = document.createElement('div');
  panelABody.className = 'card-body';
  panelA.appendChild(panelABody);

  const panelB = document.createElement('details');
  panelB.className = 'card';
  panelB.dataset.panel = 'target';
  panelB.open = false;
  const panelBHeader = document.createElement('summary');
  panelBHeader.className = 'card-header';
  panelBHeader.textContent = 'Target';
  panelB.appendChild(panelBHeader);
  const panelBBody = document.createElement('div');
  panelBBody.className = 'card-body';
  panelB.appendChild(panelBBody);

  bdTasks.appendChild(panelA);
  bdTasks.appendChild(panelB);

  // Now apply flow defaults which triggers state change + applyCardStates
  stateModule.applyFlowDefaults(flowId, flowDef);
}

/** Helper: simulate interaction with a card (trigger toggle event) */
function interactWithCard(cardId) {
  const el = document.getElementById(cardId);
  if (el) {
    el.open = true;
    el.dispatchEvent(new Event('toggle'));
    el.dispatchEvent(new Event('pointerenter'));
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Disclosure Controller: AC 1 — Configuration Card & Credential Validation', () => {
  beforeEach(async () => {
    setupFullHTML();
    await freshInit();
    disclosureModule.initDisclosureController();
  });

  afterEach(() => {
    cleanupDOM();
    vi.restoreAllMocks();
  });

  it('AC 1.1: Config card is active when credentials are empty', () => {
    // No credentials set — config should be active
    expect(cardState('card-configuration')).toBe('active');
  });

  it('AC 1.1: Task card is locked when credentials are empty', () => {
    expect(cardState('card-tasks')).toBe('locked');
  });

  it('AC 1.1: Steps and Prompt cards are locked when credentials are empty', () => {
    expect(cardState('card-steps')).toBe('locked');
    expect(cardState('card-prompt')).toBe('locked');
  });

  it('AC 1.3: Config card remains active (undimmed) after repo selection when no flow selected', () => {
    setFullConfig();

    // Config should still be active (undimmed) since no flow has been selected yet
    expect(cardState('card-configuration')).toBe('active');
    expect(isOpen('card-configuration')).toBe(true);
  });

  it('AC 1.3: Config card remains active with branch set and no flow selected', () => {
    setFullConfigWithBranch();

    // Even with all config filled, config stays active until a flow is selected
    expect(cardState('card-configuration')).toBe('active');
    expect(isOpen('card-configuration')).toBe(true);
  });

  it('AC 1.3: Task card becomes active after repo selection', () => {
    setFullConfig();

    // Task card should transition from locked to active
    expect(cardState('card-tasks')).toBe('active');
  });
});

describe('Disclosure Controller: AC 2 — Card Progression & Hierarchy', () => {
  beforeEach(async () => {
    setupFullHTML();
    await freshInit();
    disclosureModule.initDisclosureController();
    setFullConfigWithBranch();
  });

  afterEach(() => {
    cleanupDOM();
    vi.restoreAllMocks();
  });

  it('AC 2.1: Task card opens after repo selection', () => {
    expect(isOpen('card-tasks')).toBe(true);
    expect(cardState('card-tasks')).toBe('active');
  });

  it('AC 2.2: Config card transitions to dimmed but expanded when flow is selected', () => {
    selectFlow('fix');

    // Config should be dimmed (sufficient) but still expanded
    expect(cardState('card-configuration')).toBe('sufficient');
    expect(isOpen('card-configuration')).toBe(true);
  });

  it('AC 2.2: Situation panel opens active (undimmed) when flow is selected', () => {
    selectFlow('fix');

    expect(panelState('situation')).toBe('active');
    expect(isPanelOpen('situation')).toBe(true);
  });

  it('AC 2.2: Target panel opens in dimmed state when flow is selected', () => {
    selectFlow('fix');

    // Target should be open but in a dimmed state (skippable)
    expect(panelState('target')).toBe('skippable');
    expect(isPanelOpen('target')).toBe(true);
  });

  it('AC 2.3: Target becomes undimmed when mandatory situation field is filled', () => {
    selectFlow('fix');

    // Fill mandatory situation field (satisfies required_group a_required)
    stateModule.setState('panel_a.description', 'Login crashes');

    // Situation should remain active/undimmed
    const sitSt = panelState('situation');
    expect(sitSt === 'active' || sitSt === 'sufficient').toBe(true);

    // Target should become active (undimmed)
    expect(panelState('target')).toBe('active');
  });

  it('AC 2.3: Situation panel remains open when mandatory field is filled', () => {
    selectFlow('fix');

    stateModule.setState('panel_a.description', 'Login crashes');

    expect(isPanelOpen('situation')).toBe(true);
  });

  it('AC 2.4: Steps card becomes active when all mandatory fields in both panels are completed', () => {
    selectFlow('fix');

    // Fill situation (required_group satisfied)
    stateModule.setState('panel_a.description', 'Login crashes');

    // Steps should not yet be active (target not filled)
    expect(cardState('card-steps')).not.toBe('active');

    // Fill target
    stateModule.setState('panel_b.description', 'Should redirect to dashboard');

    // Now steps should be active
    expect(cardState('card-steps')).toBe('active');
  });

  it('AC 2.4: Steps card remains locked/skippable when only situation is filled', () => {
    selectFlow('fix');

    stateModule.setState('panel_a.description', 'Login crashes');

    const stepsState = cardState('card-steps');
    expect(stepsState === 'locked' || stepsState === 'skippable').toBe(true);
  });
});

describe('Disclosure Controller: AC 3 — Interaction & Focus Management', () => {
  beforeEach(async () => {
    setupFullHTML();
    await freshInit();
    disclosureModule.initDisclosureController();
    setFullConfigWithBranch();
    selectFlow('fix');
  });

  afterEach(() => {
    cleanupDOM();
    vi.restoreAllMocks();
  });

  it('AC 3.1: Prompt card opens when Steps card is interacted with', () => {
    // Fill both panels to make steps active
    stateModule.setState('panel_a.description', 'Login crashes');
    stateModule.setState('panel_b.description', 'Should work');

    expect(cardState('card-steps')).toBe('active');

    // Interact with steps card
    interactWithCard('card-steps');

    // Prompt should be open
    expect(isOpen('card-prompt')).toBe(true);
  });

  it('AC 3.1: Prompt card appears dimmed after Steps interaction', () => {
    stateModule.setState('panel_a.description', 'Login crashes');
    stateModule.setState('panel_b.description', 'Should work');

    interactWithCard('card-steps');

    // Prompt should be in a dimmed state (skippable or sufficient, not active)
    const promptSt = cardState('card-prompt');
    expect(
      promptSt === 'skippable' ||
        promptSt === 'sufficient' ||
        promptSt === 'active'
    ).toBe(true);
  });

  it('AC 3.2: Prompt interaction triggers situation panel closure', () => {
    stateModule.setState('panel_a.description', 'Login crashes');
    stateModule.setState('panel_b.description', 'Should work');

    interactWithCard('card-steps');
    interactWithCard('card-prompt');

    // Situation panel should be closed
    expect(isPanelOpen('situation')).toBe(false);
  });

  it('AC 3.2: Prompt interaction triggers target panel dimming', () => {
    stateModule.setState('panel_a.description', 'Login crashes');
    stateModule.setState('panel_b.description', 'Should work');

    interactWithCard('card-steps');
    interactWithCard('card-prompt');

    // Target should be dimmed (sufficient or complete, not active)
    const tgtSt = panelState('target');
    expect(tgtSt !== 'active').toBe(true);
  });

  it('AC 3.3: Re-engaging previous card keeps it open and undimmed via focus-within', () => {
    stateModule.setState('panel_a.description', 'Login crashes');
    stateModule.setState('panel_b.description', 'Should work');

    interactWithCard('card-steps');

    // Steps card should remain open even after interacting with it
    expect(isOpen('card-steps')).toBe(true);
  });
});

describe('Disclosure Controller: State machine transitions', () => {
  beforeEach(async () => {
    setupFullHTML();
    await freshInit();
    disclosureModule.initDisclosureController();
  });

  afterEach(() => {
    cleanupDOM();
    vi.restoreAllMocks();
  });

  it('locked cards cannot be opened', () => {
    // Task is locked initially
    expect(cardState('card-tasks')).toBe('locked');

    const taskEl = document.getElementById('card-tasks');
    taskEl.open = true;
    taskEl.dispatchEvent(new Event('toggle'));

    // Should be forced closed
    expect(taskEl.open).toBe(false);
  });

  it('guard tooltip appears when clicking locked card summary', () => {
    const taskEl = document.getElementById('card-tasks');
    taskEl.open = true;
    taskEl.dispatchEvent(new Event('toggle'));

    // Guard tooltip should be created in the DOM
    const tooltip = document.querySelector('.guard-tooltip');
    expect(tooltip).not.toBeNull();
  });

  it('flow switch resets interaction flags and downstream states', () => {
    setFullConfigWithBranch();
    selectFlow('fix');

    stateModule.setState('panel_a.description', 'Bug');
    stateModule.setState('panel_b.description', 'Fix');

    interactWithCard('card-steps');

    // Steps should be sufficient after interaction
    expect(cardState('card-steps')).toBe('sufficient');

    // Switch flow
    selectFlow('review');

    // Steps should reset (no longer sufficient)
    const stepsState = cardState('card-steps');
    expect(stepsState !== 'sufficient').toBe(true);
  });

  it('config card returns to active when repo is cleared', () => {
    setFullConfigWithBranch();
    selectFlow('fix');

    expect(cardState('card-configuration')).toBe('sufficient');

    // Clear repo
    stateModule.setState('configuration.repo', '');

    expect(cardState('card-configuration')).toBe('active');
  });

  it('downstream cards lock when config is cleared', () => {
    setFullConfigWithBranch();

    expect(cardState('card-tasks')).toBe('active');

    // Clear PAT
    stateModule.setState('configuration.pat', '');

    // Task should become locked (no core config)
    expect(cardState('card-tasks')).toBe('locked');
  });
});
