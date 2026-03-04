// @vitest-environment jsdom
/**
 * Tests for card-configuration.js
 * CFG-01..05: PAT, repo selection, branch auto-select, file tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Mock helpers ---

function mockFetch(response, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
  });
}

const SAMPLE_REPOS = [
  { name: 'alpha', default_branch: 'main' },
  { name: 'beta', default_branch: 'develop' },
  { name: 'gamma', default_branch: 'main' },
];

const SAMPLE_BRANCHES = [{ name: 'main' }, { name: 'develop' }];

const SAMPLE_TREE = {
  tree: [{ path: 'src/index.js', type: 'blob' }],
  truncated: false,
};

let cardConfig, state;

function setupHTML() {
  document.body.innerHTML = `
    <main id="app">
      <section class="card card--open" id="card-configuration">
        <button class="card-header" aria-expanded="true"></button>
        <div class="card-body" id="bd-configuration"></div>
      </section>
      <section class="card" id="card-tasks">
        <button class="card-header" aria-expanded="false"></button>
        <div class="card-body" id="bd-tasks"></div>
      </section>
    </main>
  `;
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  setupHTML();
  globalThis.fetch = mockFetch([]);
  state = await import('../src/core/state.js');
  cardConfig = await import('../src/cards/card-configuration.js');
});

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.restoreAllMocks();
});

// --- Tests ---

describe('initConfigurationCard()', () => {
  it('renders PAT and username inputs', () => {
    cardConfig.initConfigurationCard();
    expect(document.getElementById('cfg-pat')).not.toBeNull();
    expect(document.getElementById('cfg-username')).not.toBeNull();
  });

  it('pre-fills from state', () => {
    state.setState('configuration.pat', 'tok_abc');
    state.setState('configuration.owner', 'alice');
    cardConfig.initConfigurationCard();
    expect(document.getElementById('cfg-pat').value).toBe('tok_abc');
    expect(document.getElementById('cfg-username').value).toBe('alice');
  });

  it('renders show/hide toggle and clear button for PAT', () => {
    cardConfig.initConfigurationCard();
    expect(document.querySelector('.js-eye-btn')).not.toBeNull();
    expect(document.querySelector('[aria-label="Clear token"]')).not.toBeNull();
  });
});

describe('PAT field (CFG-01)', () => {
  it('show/hide toggle changes input type', () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');
    const toggle = document.querySelector('.js-eye-btn');

    pat.value = 'tok';
    pat.dispatchEvent(new Event('input'));

    toggle.click();
    expect(pat.type).toBe('text');

    toggle.click();
    expect(pat.type).toBe('password');
  });

  it('PAT input updates state and persists to localStorage', () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');
    pat.value = 'new_token';
    pat.dispatchEvent(new Event('input'));

    expect(state.getState().configuration.pat).toBe('new_token');
    const stored = JSON.parse(localStorage.getItem('agent_prompt_state'));
    expect(stored.pat).toBe('new_token');
  });

  it('clear button resets PAT, repo, branch, and file tree', () => {
    state.setState('configuration.pat', 'tok');
    state.setState('configuration.repo', 'my-repo');
    state.setState('configuration.branch', 'main');
    cardConfig.initConfigurationCard();

    document.querySelector('[aria-label="Clear token"]').click();

    expect(document.getElementById('cfg-pat').value).toBe('');
    expect(state.getState().configuration.pat).toBe('');
    expect(state.getState().configuration.repo).toBe('');
    expect(state.getState().configuration.branch).toBe('');
    expect(cardConfig.getFileTree()).toEqual([]);
  });
});

describe('auto-fetch repos (CFG-02)', () => {
  it('fetches repos when PAT and username exist', async () => {
    state.setState('configuration.pat', 'tok');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  it('does not fetch when PAT or username is empty', async () => {
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);
    cardConfig.initConfigurationCard();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does not fetch when PAT is set but username is empty', async () => {
    state.setState('configuration.pat', 'tok');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);
    cardConfig.initConfigurationCard();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('renders repo buttons after fetch', async () => {
    state.setState('configuration.pat', 'tok');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const buttons = document.querySelectorAll(
        '[aria-label="Repositories"] .btn-select'
      );
      expect(buttons.length).toBe(3);
    });
  });
});

describe('repo selection (CFG-03)', () => {
  async function setupWithRepos() {
    state.setState('configuration.pat', 'tok');
    state.setState('configuration.owner', 'alice');

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_REPOS),
        });
      }
      if (callCount === 2) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_BRANCHES),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_TREE),
      });
    });

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      expect(
        document.querySelectorAll('[aria-label="Repositories"] .btn-select')
          .length
      ).toBe(3);
    });
  }

  it('sets state and highlights selected repo', async () => {
    await setupWithRepos();

    const repoBtn = document.querySelector(
      '[aria-label="Repositories"] .btn-select'
    );
    repoBtn.click();

    expect(state.getState().configuration.repo).toBe('alpha');
    await vi.waitFor(() => {
      expect(document.querySelector('.btn-select--selected')).not.toBeNull();
    });
  });

  it('expands Tasks card and hides credentials on repo select', async () => {
    await setupWithRepos();

    document.querySelector('[aria-label="Repositories"] .btn-select').click();

    expect(
      document.getElementById('card-tasks').classList.contains('card--open')
    ).toBe(true);
    // Credentials div gets hidden attribute
    const credDiv = document.getElementById('bd-configuration').children[0];
    expect(credDiv.hidden).toBe(true);
  });
});

describe('branch auto-select (CFG-04)', () => {
  it('auto-selects default branch on repo selection', async () => {
    state.setState('configuration.pat', 'tok');
    state.setState('configuration.owner', 'alice');

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_REPOS),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_BRANCHES),
      });
    });

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      expect(
        document.querySelectorAll('[aria-label="Repositories"] .btn-select')
          .length
      ).toBe(3);
    });

    document.querySelector('[aria-label="Repositories"] .btn-select').click();

    await vi.waitFor(() => {
      expect(state.getState().configuration.branch).toBe('main');
    });
  });
});

describe('error handling (GL-04)', () => {
  it('shows inline error on fetch failure with retry button', async () => {
    state.setState('configuration.pat', 'tok');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Bad credentials' }),
    });

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      expect(document.querySelector('.error-inline')).not.toBeNull();
      expect(document.querySelector('.btn-retry')).not.toBeNull();
    });
  });
});

describe('accessibility', () => {
  it('repo grid has role="listbox" and buttons have role="option"', async () => {
    state.setState('configuration.pat', 'tok');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const grid = document.querySelector('[aria-label="Repositories"]');
      expect(grid.getAttribute('role')).toBe('listbox');
      expect(
        document
          .querySelector('[aria-label="Repositories"] .btn-select')
          .getAttribute('role')
      ).toBe('option');
    });
  });
});

describe('eye/clear button visibility', () => {
  it('eye and clear buttons hidden when PAT is empty, shown when PAT has value', () => {
    cardConfig.initConfigurationCard();

    const eyeBtn = document.querySelector('.js-eye-btn');
    const clearBtn = document.querySelector('[aria-label="Clear token"]');

    expect(eyeBtn.hasAttribute('hidden')).toBe(true);
    expect(clearBtn.hasAttribute('hidden')).toBe(true);

    const pat = document.getElementById('cfg-pat');
    pat.value = 'tok_123';
    pat.dispatchEvent(new Event('input'));

    expect(eyeBtn.hasAttribute('hidden')).toBe(false);
    expect(clearBtn.hasAttribute('hidden')).toBe(false);
  });
});

describe('username clear button', () => {
  it('clears owner, repo, branch state', async () => {
    state.setState('configuration.pat', 'tok');
    state.setState('configuration.owner', 'alice');
    state.setState('configuration.repo', 'my-repo');
    state.setState('configuration.branch', 'main');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      expect(
        document.querySelectorAll('[aria-label="Repositories"] .btn-select')
          .length
      ).toBe(3);
    });

    document.querySelector('[aria-label="Clear username"]').click();

    expect(state.getState().configuration.owner).toBe('');
    expect(state.getState().configuration.repo).toBe('');
    expect(state.getState().configuration.branch).toBe('');
  });
});

describe('icons on repo/branch buttons', () => {
  it('repo buttons contain SVG icon', async () => {
    state.setState('configuration.pat', 'tok');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const btn = document.querySelector(
        '[aria-label="Repositories"] .btn-select'
      );
      expect(btn.querySelector('svg')).not.toBeNull();
    });
  });
});
