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
    // Button uses SVG icon instead of text; verify it exists and has aria-label
    expect(toggle.getAttribute('aria-label')).toBeTruthy();
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

    toggle.click();
    expect(pat.type).toBe('password');
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
      // Phase 11: buttons contain icon SVG + text span; use toContain for text match
      expect(selected.textContent).toContain('alpha');
    });
  });

  it('collapses repo grid to first N repos after selection (VIS-03)', async () => {
    // Phase 11: collapsed shows multiple repos (a row), not just selected
    await setupWithRepos();

    const firstBtn = document.querySelector(
      '.cfg-section--repos .btn-grid-item'
    );
    firstBtn.click();

    await vi.waitFor(() => {
      // Should show MORE than just 1 repo (first N = REPO_DISPLAY_LIMIT rows)
      const visibleRepos = document.querySelectorAll(
        '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
      );
      // With 3 sample repos and REPO_DISPLAY_LIMIT=4, all 3 fit → no More button needed
      // But the selected item should always be visible
      const selectedRepo = document.querySelector(
        '.cfg-section--repos .item-selected'
      );
      expect(selectedRepo).not.toBeNull();
      expect(visibleRepos.length).toBeGreaterThan(0);
    });
  });

  it('shows "More" button when repos exceed display limit', async () => {
    // Create a dataset with more repos than REPO_DISPLAY_LIMIT (4)
    const manyRepos = [
      { name: 'repo-a', default_branch: 'main' },
      { name: 'repo-b', default_branch: 'main' },
      { name: 'repo-c', default_branch: 'main' },
      { name: 'repo-d', default_branch: 'main' },
      { name: 'repo-e', default_branch: 'main' },
    ];

    state.setState('configuration.pat', 'tok_123');
    state.setState('configuration.owner', 'alice');

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(manyRepos),
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
        document.querySelectorAll(
          '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
        ).length
      ).toBe(5); // all 5 visible initially (not collapsed yet)
    });

    // Select a repo → auto-collapse
    const repoBtn = document.querySelector(
      '.cfg-section--repos .btn-grid-item'
    );
    repoBtn.click();

    await vi.waitFor(() => {
      // Should show first 4 (REPO_DISPLAY_LIMIT) repos + selected if beyond
      const visibleRepos = document.querySelectorAll(
        '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
      );
      expect(visibleRepos.length).toBeLessThanOrEqual(5);
      expect(visibleRepos.length).toBeGreaterThan(1);
      // "More" button present since 5 > 4
      const moreBtn = document.querySelector(
        '.cfg-section--repos .cfg-show-more'
      );
      expect(moreBtn).not.toBeNull();
    });
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

  it('hides credentials row on repo select (1.5 — card stays open)', async () => {
    await setupWithRepos();

    const repoBtn = document.querySelector(
      '.cfg-section--repos .btn-grid-item'
    );
    repoBtn.click();

    // Card stays open; only the credentials row is hidden
    const cfgCard = document.getElementById('card-configuration');
    expect(cfgCard.classList.contains('card--open')).toBe(true);
    const credentials = document.querySelector('.credentials-row');
    expect(credentials.classList.contains('cfg-credentials--hidden')).toBe(
      true
    );
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

// ─── Phase 11: Show More / collapsed display (VIS-03) ───

describe('Phase 11 — branch display limit (UAT 1.7)', () => {
  async function setupWithManyBranches() {
    const manyBranches = [
      { name: 'main' },
      { name: 'develop' },
      { name: 'feature-a' },
      { name: 'feature-b' },
      { name: 'feature-c' },
    ];

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
          json: () => Promise.resolve(manyBranches),
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
        document.querySelectorAll(
          '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
        ).length
      ).toBe(3);
    });

    // Click first repo to trigger branch load
    const repoBtn = document.querySelector(
      '.cfg-section--repos .btn-grid-item'
    );
    repoBtn.click();

    await vi.waitFor(() => {
      const branchBtns = document.querySelectorAll(
        '.cfg-section--branches .btn-grid-item:not(.cfg-show-more)'
      );
      expect(branchBtns.length).toBeGreaterThan(0);
    });

    return manyBranches;
  }

  it('shows at most 3 branches by default (BRANCH_DISPLAY_LIMIT=3)', async () => {
    await setupWithManyBranches();

    const visibleBranches = document.querySelectorAll(
      '.cfg-section--branches .btn-grid-item:not(.cfg-show-more)'
    );
    // 5 branches total, limit 3: shows 3 or 4 (if selected branch is beyond limit)
    expect(visibleBranches.length).toBeLessThanOrEqual(4);
    expect(visibleBranches.length).toBeGreaterThanOrEqual(3);
  });

  it('shows "More" button when branches exceed limit', async () => {
    await setupWithManyBranches();

    const moreBtn = document.querySelector(
      '.cfg-section--branches .cfg-show-more'
    );
    expect(moreBtn).not.toBeNull();
  });

  it('expanding branch grid shows all branches', async () => {
    await setupWithManyBranches();

    const moreBtn = document.querySelector(
      '.cfg-section--branches .cfg-show-more'
    );
    moreBtn.click();

    const allBranches = document.querySelectorAll(
      '.cfg-section--branches .btn-grid-item:not(.cfg-show-more)'
    );
    expect(allBranches.length).toBe(5);
  });

  it('selected branch visible even if beyond display limit', async () => {
    await setupWithManyBranches();

    // Click a branch that's beyond position 3 (feature-b = index 3)
    // First expand so we can click it
    const moreBtn = document.querySelector(
      '.cfg-section--branches .cfg-show-more'
    );
    moreBtn.click();

    await vi.waitFor(() => {
      const allBranches = document.querySelectorAll(
        '.cfg-section--branches .btn-grid-item:not(.cfg-show-more)'
      );
      expect(allBranches.length).toBe(5);
    });

    // Find and click the 5th branch (feature-c, index 4)
    const branchBtns = document.querySelectorAll(
      '.cfg-section--branches .btn-grid-item:not(.cfg-show-more)'
    );
    branchBtns[4].click(); // click feature-c

    // Now grid should be collapsed, but feature-c should still be visible
    await vi.waitFor(() => {
      const selected = document.querySelector(
        '.cfg-section--branches .item-selected'
      );
      expect(selected).not.toBeNull();
      expect(selected.textContent).toContain('feature-c');
    });
  });
});

// ─── Phase 11: Eye / Clear visibility (UAT 1.3) ───

describe('Phase 11 — eye/clear button visibility (UAT 1.3)', () => {
  it('eye and clear buttons start hidden when PAT is empty', () => {
    cardConfig.initConfigurationCard();
    const eyeBtn = document.querySelector('.js-eye-btn');
    const clearBtn = document.querySelector('.js-clear-btn');
    expect(eyeBtn).not.toBeNull();
    expect(clearBtn).not.toBeNull();
    // Buttons should have hidden attribute when no value
    expect(eyeBtn.hasAttribute('hidden')).toBe(true);
    expect(clearBtn.hasAttribute('hidden')).toBe(true);
  });

  it('eye and clear buttons appear when PAT has a value', () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');
    pat.value = 'tok_123';
    pat.dispatchEvent(new Event('input'));

    const eyeBtn = document.querySelector('.js-eye-btn');
    const clearBtn = document.querySelector('.js-clear-btn');
    expect(eyeBtn.hasAttribute('hidden')).toBe(false);
    expect(clearBtn.hasAttribute('hidden')).toBe(false);
  });

  it('eye/clear buttons hidden again after PAT is cleared', () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');

    pat.value = 'tok_123';
    pat.dispatchEvent(new Event('input'));
    pat.value = '';
    pat.dispatchEvent(new Event('input'));

    const eyeBtn = document.querySelector('.js-eye-btn');
    expect(eyeBtn.hasAttribute('hidden')).toBe(true);
  });

  it('eye toggle adds .is-shown class when revealing PAT', () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');
    pat.value = 'tok_123';
    pat.dispatchEvent(new Event('input'));

    const eyeBtn = document.querySelector('.js-eye-btn');
    eyeBtn.click();

    expect(pat.type).toBe('text');
    expect(eyeBtn.classList.contains('is-shown')).toBe(true);
  });

  it('eye toggle removes .is-shown class when hiding PAT', () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById('cfg-pat');
    pat.value = 'tok_123';
    pat.dispatchEvent(new Event('input'));

    const eyeBtn = document.querySelector('.js-eye-btn');
    eyeBtn.click(); // show
    eyeBtn.click(); // hide

    expect(pat.type).toBe('password');
    expect(eyeBtn.classList.contains('is-shown')).toBe(false);
  });
});

// ─── Phase 11: Username clear button ───

describe('Phase 11 — username clear button', () => {
  it('renders username clear button', () => {
    cardConfig.initConfigurationCard();
    const clearBtn = document.querySelector('.js-user-clear-btn');
    expect(clearBtn).not.toBeNull();
  });

  it('username clear starts hidden when field is empty', () => {
    cardConfig.initConfigurationCard();
    const clearBtn = document.querySelector('.js-user-clear-btn');
    expect(clearBtn.hasAttribute('hidden')).toBe(true);
  });

  it('username clear appears when username has a value', () => {
    state.setState('configuration.owner', 'alice');
    cardConfig.initConfigurationCard();
    const user = document.getElementById('cfg-username');
    user.value = 'alice';
    user.dispatchEvent(new Event('input'));

    const clearBtn = document.querySelector('.js-user-clear-btn');
    expect(clearBtn.hasAttribute('hidden')).toBe(false);
  });

  it('username clear button clears owner state and repos list', async () => {
    state.setState('configuration.pat', 'tok_123');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      expect(
        document.querySelectorAll(
          '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
        ).length
      ).toBe(3);
    });

    const clearBtn = document.querySelector('.js-user-clear-btn');
    clearBtn.click();

    expect(state.getState().configuration.owner).toBe('');
    expect(document.getElementById('cfg-username').value).toBe('');
    // Repos section should be empty
    const repoBtns = document.querySelectorAll(
      '.cfg-section--repos .btn-grid-item'
    );
    expect(repoBtns.length).toBe(0);
  });
});

// ─── Phase 11: Repo/branch icons on buttons ───

describe('Phase 11 — icon per repo/branch button', () => {
  it('repo buttons contain an SVG icon', async () => {
    state.setState('configuration.pat', 'tok_123');
    state.setState('configuration.owner', 'alice');
    globalThis.fetch = mockFetch(SAMPLE_REPOS);

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const repoBtn = document.querySelector(
        '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
      );
      expect(repoBtn).not.toBeNull();
      expect(repoBtn.querySelector('svg')).not.toBeNull();
    });
  });

  async function setupReposAndBranches() {
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

    await vi.waitFor(() => {
      expect(
        document.querySelectorAll(
          '.cfg-section--repos .btn-grid-item:not(.cfg-show-more)'
        ).length
      ).toBe(3);
    });

    document.querySelector('.cfg-section--repos .btn-grid-item').click();

    await vi.waitFor(() => {
      expect(
        document.querySelectorAll(
          '.cfg-section--branches .btn-grid-item:not(.cfg-show-more)'
        ).length
      ).toBeGreaterThan(0);
    });
  }

  it('branch buttons contain an SVG icon', async () => {
    await setupReposAndBranches();

    const branchBtn = document.querySelector(
      '.cfg-section--branches .btn-grid-item:not(.cfg-show-more)'
    );
    expect(branchBtn).not.toBeNull();
    expect(branchBtn.querySelector('svg')).not.toBeNull();
  });
});
