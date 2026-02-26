// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fetch globally
function mockFetch(response, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
  });
}

// Sample data
const SAMPLE_REPOS = [
  { name: 'alpha', default_branch: 'main' },
  { name: 'beta', default_branch: 'develop' },
  { name: 'gamma', default_branch: 'main' },
];

const SAMPLE_BRANCHES = [
  { name: 'main' },
  { name: 'develop' },
  { name: 'feature-x' },
];

const SAMPLE_TREE = {
  tree: [
    { path: 'src/index.js', type: 'blob' },
    { path: 'src/utils', type: 'tree' },
    { path: 'src/utils/helpers.js', type: 'blob' },
  ],
  truncated: false,
};

let cardConfig, state;

function setupHTML() {
  document.body.innerHTML = `
    <main id="app">
      <section class="card card--open" id="card-configuration">
        <button class="card-header" aria-expanded="true" aria-controls="bd-configuration">
          <span class="card-title">Configuration</span>
        </button>
        <div class="card-body" id="bd-configuration"></div>
      </section>
      <section class="card" id="card-tasks">
        <button class="card-header" aria-expanded="false" aria-controls="bd-tasks">
          <span class="card-title">Task</span>
        </button>
        <div class="card-body" id="bd-tasks"></div>
      </section>
    </main>
  `;
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  setupHTML();

  // Default: no-op fetch (prevents real API calls)
  globalThis.fetch = mockFetch([]);

  state = await import('../src/js/state.js');
  cardConfig = await import('../src/js/card-configuration.js');
});

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.restoreAllMocks();
});

// ─── Initialization ───

describe('initConfigurationCard()', () => {
  it('renders PAT input field', () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');
    expect(pat).not.toBeNull();
    expect(pat.type).toBe('password');
  });

  it('renders username input field', () => {
    cardConfig.initConfigurationCard();
    const user = document.getElementById('cfg-username');
    expect(user).not.toBeNull();
    expect(user.type).toBe('text');
  });

  it('pre-fills PAT from state', () => {
    state.setState('configuration.pat', 'tok_abc');
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');
    expect(pat.value).toBe('tok_abc');
  });

  it('pre-fills username from state', () => {
    state.setState('configuration.owner', 'alice');
    cardConfig.initConfigurationCard();
    const user = document.getElementById('cfg-username');
    expect(user.value).toBe('alice');
  });

  it('PAT field has autocomplete off', () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');
    expect(pat.getAttribute('autocomplete')).toBe('off');
  });

  it('renders show/hide toggle for PAT', () => {
    cardConfig.initConfigurationCard();
    const toggle = document.querySelector('.cfg-pat-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.textContent).toBe('Show');
  });

  it('renders clear button for PAT', () => {
    cardConfig.initConfigurationCard();
    const clear = document.querySelector('.cfg-pat-clear');
    expect(clear).not.toBeNull();
  });
});

// ─── PAT behavior (CFG-01) ───

describe('PAT field (CFG-01)', () => {
  it('show/hide toggle changes input type', () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');
    const toggle = document.querySelector('.cfg-pat-toggle');

    toggle.click();
    expect(pat.type).toBe('text');
    expect(toggle.textContent).toBe('Hide');

    toggle.click();
    expect(pat.type).toBe('password');
    expect(toggle.textContent).toBe('Show');
  });

  it('PAT input updates state', () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');
    pat.value = 'new_token_123';
    pat.dispatchEvent(new Event('input'));

    expect(state.getState().configuration.pat).toBe('new_token_123');
  });

  it('PAT is persisted to localStorage', () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');
    pat.value = 'persisted_tok';
    pat.dispatchEvent(new Event('input'));

    const stored = JSON.parse(localStorage.getItem('agent_prompt_state'));
    expect(stored.pat).toBe('persisted_tok');
  });

  it('clear button empties PAT and state', () => {
    state.setState('configuration.pat', 'tok_to_clear');
    cardConfig.initConfigurationCard();

    const clear = document.querySelector('.cfg-pat-clear');
    clear.click();

    expect(document.getElementById('cfg-pat').value).toBe('');
    expect(state.getState().configuration.pat).toBe('');
  });

  it('clear button resets repo and branch', () => {
    state.setState('configuration.pat', 'tok');
    state.setState('configuration.repo', 'my-repo');
    state.setState('configuration.branch', 'main');
    cardConfig.initConfigurationCard();

    const clear = document.querySelector('.cfg-pat-clear');
    clear.click();

    expect(state.getState().configuration.repo).toBe('');
    expect(state.getState().configuration.branch).toBe('');
  });

  it('clear resets file tree', () => {
    state.setState('configuration.pat', 'tok');
    cardConfig.initConfigurationCard();
    const clear = document.querySelector('.cfg-pat-clear');
    clear.click();
    expect(cardConfig.getFileTree()).toEqual([]);
  });
});

// ─── Auto-fetch repos (CFG-02) ───

describe('auto-fetch repos on load (CFG-02)', () => {
  it('fetches repos when PAT and username exist', async () => {
    state.setState('configuration.pat', 'tok_123');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    // Wait for async fetch
    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  it('does not fetch when PAT is empty', () => {
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does not fetch when username is empty', () => {
    state.setState('configuration.pat', 'tok_123');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('renders repo buttons after fetch', async () => {
    state.setState('configuration.pat', 'tok_123');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const buttons = document.querySelectorAll(
        '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
      );
      expect(buttons.length).toBe(3);
    });
  });

  it('shows shimmer while loading', () => {
    state.setState('configuration.pat', 'tok_123');
    state.setState('configuration.owner', 'alice');
    // Fetch that never resolves
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    cardConfig.initConfigurationCard();

    const shimmer = document.querySelector('.shimmer');
    expect(shimmer).not.toBeNull();
  });
});

// ─── Repo selection (CFG-03, CFG-04, CFG-05) ───

describe('repo selection (CFG-03)', () => {
  async function setupWithRepos() {
    state.setState('configuration.pat', 'tok_123');
    state.setState('configuration.owner', 'alice');

    // First call: repos; subsequent calls: branches or tree
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
      // Tree
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_TREE),
      });
    });

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const buttons = document.querySelectorAll(
        '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
      );
      expect(buttons.length).toBe(3);
    });
  }

  it('sets state on repo click', async () => {
    await setupWithRepos();

    const repoBtn = document.querySelector(
      '.cfg-section--repos .btn-grid-item'
    );
    repoBtn.click();

    expect(state.getState().configuration.repo).toBe('alpha');
  });

  it('highlights selected repo with item-selected class', async () => {
    await setupWithRepos();

    const repoBtn = document.querySelector(
      '.cfg-section--repos .btn-grid-item'
    );
    repoBtn.click();

    await vi.waitFor(() => {
      const selected = document.querySelector(
        '.cfg-section--repos .item-selected'
      );
      expect(selected).not.toBeNull();
      expect(selected.textContent).toBe('alpha');
    });
  });

  it('collapses repo grid after selection (VIS-03)', async () => {
    await setupWithRepos();

    const firstBtn = document.querySelector(
      '.cfg-section--repos .btn-grid-item'
    );
    firstBtn.click();

    await vi.waitFor(() => {
      const visibleRepos = document.querySelectorAll(
        '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
      );
      expect(visibleRepos.length).toBe(1);
      expect(visibleRepos[0].textContent).toBe('alpha');
    });

    // "show more" button is present
    const showMore = document.querySelector(
      '.cfg-section--repos .cfg-show-more'
    );
    expect(showMore).not.toBeNull();
  });

  it('expands Tasks card on repo select', async () => {
    await setupWithRepos();

    const repoBtn = document.querySelector(
      '.cfg-section--repos .btn-grid-item'
    );
    repoBtn.click();

    const tasksCard = document.getElementById('card-tasks');
    expect(tasksCard.classList.contains('card--open')).toBe(true);
  });

  it('collapses Configuration card on repo select', async () => {
    await setupWithRepos();

    const repoBtn = document.querySelector(
      '.cfg-section--repos .btn-grid-item'
    );
    repoBtn.click();

    const cfgCard = document.getElementById('card-configuration');
    expect(cfgCard.classList.contains('card--open')).toBe(false);
  });
});

// ─── Branch behavior (CFG-04) ───

describe('branch auto-select (CFG-04)', () => {
  it('auto-selects default branch', async () => {
    state.setState('configuration.pat', 'tok_123');
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

    // Wait for repos to load, then click first repo
    await vi.waitFor(() => {
      expect(
        document.querySelectorAll(
          '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
        ).length
      ).toBe(3);
    });

    const repoBtn = document.querySelector(
      '.cfg-section--repos .btn-grid-item'
    );
    repoBtn.click();

    await vi.waitFor(() => {
      expect(state.getState().configuration.branch).toBe('main');
    });
  });
});

// ─── Error handling (GL-04) ───

describe('error handling (GL-04)', () => {
  it('shows inline error on repo fetch failure', async () => {
    state.setState('configuration.pat', 'tok_123');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Bad credentials' }),
    });

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const error = document.querySelector('.error-inline');
      expect(error).not.toBeNull();
    });
  });

  it('error has retry button', async () => {
    state.setState('configuration.pat', 'tok_123');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Bad credentials' }),
    });

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const retryBtn = document.querySelector('.btn-retry');
      expect(retryBtn).not.toBeNull();
    });
  });
});

// ─── PAT change cache cascade ───

describe('PAT change cache cascade', () => {
  it('flushes cache on PAT change', async () => {
    const { cacheSet, cacheGet } = await import('../src/js/cache.js');
    cacheSet('repos_alice', SAMPLE_REPOS);
    expect(cacheGet('repos_alice')).not.toBeNull();

    state.setState('configuration.pat', 'old_tok');
    state.setState('configuration.owner', 'alice');

    cardConfig.initConfigurationCard();

    const pat = document.getElementById('cfg-pat');
    pat.value = 'new_tok';
    pat.dispatchEvent(new Event('input'));
    pat.dispatchEvent(new Event('change'));

    // Cache should be cleared after PAT change
    expect(cacheGet('repos_alice')).toBeNull();
  });
});

// ─── getFileTree export ───

describe('getFileTree()', () => {
  it('returns empty array initially', () => {
    cardConfig.initConfigurationCard();
    expect(cardConfig.getFileTree()).toEqual([]);
  });
});

// ─── Username change ───

describe('username change (CFG-02)', () => {
  it('updates state on username change', () => {
    state.setState('configuration.pat', 'tok_123');
    cardConfig.initConfigurationCard();

    const user = document.getElementById('cfg-username');
    user.value = 'bob';
    user.dispatchEvent(new Event('change'));

    expect(state.getState().configuration.owner).toBe('bob');
  });

  it('re-fetches repos on username change', async () => {
    state.setState('configuration.pat', 'tok_123');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    const user = document.getElementById('cfg-username');
    user.value = 'bob';
    user.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });
});

// ─── Accessibility ───

describe('accessibility', () => {
  it('repo grid has role="listbox"', async () => {
    state.setState('configuration.pat', 'tok_123');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const grid = document.querySelector('.cfg-section--repos .btn-grid');
      expect(grid).not.toBeNull();
      expect(grid.getAttribute('role')).toBe('listbox');
    });
  });

  it('repo buttons have role="option"', async () => {
    state.setState('configuration.pat', 'tok_123');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const btn = document.querySelector('.cfg-section--repos .btn-grid-item');
      expect(btn.getAttribute('role')).toBe('option');
    });
  });

  it('labels have for attributes matching input ids', () => {
    cardConfig.initConfigurationCard();
    const labels = document.querySelectorAll('.field-label');
    for (const label of labels) {
      const forAttr = label.getAttribute('for');
      if (forAttr) {
        expect(document.getElementById(forAttr)).not.toBeNull();
      }
    }
  });
});
