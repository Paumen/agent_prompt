// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let api;

function mockFetch(response, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
  });
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
}

beforeEach(async () => {
  vi.resetModules();
  api = await import('../src/js/github-api.js');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── fetchRepos ───

describe('fetchRepos()', () => {
  it('returns repos on success', async () => {
    const repos = [
      { name: 'repo-a', default_branch: 'main' },
      { name: 'repo-b', default_branch: 'develop' },
    ];
    globalThis.fetch = mockFetch(repos);

    const result = await api.fetchRepos('alice', 'tok_123');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(repos);
  });

  it('sends Authorization header with PAT', async () => {
    globalThis.fetch = mockFetch([]);
    await api.fetchRepos('alice', 'tok_123');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/alice/repos'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer tok_123',
        }),
      })
    );
  });

  it('enforces 15 repo limit (APP-03)', async () => {
    const repos = Array.from({ length: 20 }, (_, i) => ({
      name: `repo-${i}`,
      default_branch: 'main',
    }));
    globalThis.fetch = mockFetch(repos);

    const result = await api.fetchRepos('alice', 'tok_123');
    expect(result.data).toHaveLength(15);
    expect(result.warning).toContain('15');
  });

  it('returns exactly 15 repos when exactly 15 exist', async () => {
    const repos = Array.from({ length: 15 }, (_, i) => ({
      name: `repo-${i}`,
      default_branch: 'main',
    }));
    globalThis.fetch = mockFetch(repos);

    const result = await api.fetchRepos('alice', 'tok_123');
    expect(result.data).toHaveLength(15);
    expect(result.warning).toBeUndefined();
  });

  it('returns error on 401 unauthorized', async () => {
    globalThis.fetch = mockFetch({ message: 'Bad credentials' }, false, 401);

    const result = await api.fetchRepos('alice', 'bad_token');
    expect(result.data).toBeNull();
    expect(result.error).toContain('401');
  });

  it('returns error on 403 forbidden', async () => {
    globalThis.fetch = mockFetch({ message: 'Forbidden' }, false, 403);

    const result = await api.fetchRepos('alice', 'tok_123');
    expect(result.data).toBeNull();
    expect(result.error).toContain('403');
  });

  it('returns error on 404 not found', async () => {
    globalThis.fetch = mockFetch({ message: 'Not Found' }, false, 404);

    const result = await api.fetchRepos('nobody', 'tok_123');
    expect(result.data).toBeNull();
    expect(result.error).toContain('404');
  });

  it('returns error on network failure', async () => {
    globalThis.fetch = mockFetchNetworkError();

    const result = await api.fetchRepos('alice', 'tok_123');
    expect(result.data).toBeNull();
    expect(result.error).toContain('fetch');
  });

  it('never throws', async () => {
    globalThis.fetch = mockFetchNetworkError();
    await expect(api.fetchRepos('alice', 'tok_123')).resolves.toBeDefined();
  });
});

// ─── fetchBranches ───

describe('fetchBranches()', () => {
  it('returns branches on success', async () => {
    const branches = [{ name: 'main' }, { name: 'develop' }];
    globalThis.fetch = mockFetch(branches);

    const result = await api.fetchBranches('alice', 'repo-a', 'tok_123');
    expect(result.data).toEqual(branches);
    expect(result.error).toBeNull();
  });

  it('calls correct API endpoint', async () => {
    globalThis.fetch = mockFetch([]);
    await api.fetchBranches('alice', 'repo-a', 'tok_123');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/repos/alice/repo-a/branches'),
      expect.any(Object)
    );
  });

  it('returns error on HTTP failure', async () => {
    globalThis.fetch = mockFetch({ message: 'Not Found' }, false, 404);

    const result = await api.fetchBranches('alice', 'repo-a', 'tok_123');
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('returns error on network failure', async () => {
    globalThis.fetch = mockFetchNetworkError();

    const result = await api.fetchBranches('alice', 'repo-a', 'tok_123');
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ─── fetchTree ───

describe('fetchTree()', () => {
  it('returns file tree on success', async () => {
    const tree = {
      sha: 'abc123',
      tree: [
        { path: 'src/main.js', type: 'blob' },
        { path: 'src/utils', type: 'tree' },
        { path: 'README.md', type: 'blob' },
      ],
      truncated: false,
    };
    globalThis.fetch = mockFetch(tree);

    const result = await api.fetchTree('alice', 'repo-a', 'main', 'tok_123');
    expect(result.error).toBeNull();
    // Should filter to blobs only (files, not directories)
    expect(result.data).toEqual([
      { path: 'src/main.js', type: 'blob' },
      { path: 'README.md', type: 'blob' },
    ]);
  });

  it('enforces 300 file limit (APP-03)', async () => {
    const files = Array.from({ length: 350 }, (_, i) => ({
      path: `file-${i}.js`,
      type: 'blob',
    }));
    globalThis.fetch = mockFetch({
      sha: 'abc',
      tree: files,
      truncated: false,
    });

    const result = await api.fetchTree('alice', 'repo-a', 'main', 'tok_123');
    expect(result.data).toHaveLength(300);
    expect(result.warning).toContain('300');
  });

  it('warns when GitHub API returns truncated tree', async () => {
    const files = Array.from({ length: 100 }, (_, i) => ({
      path: `file-${i}.js`,
      type: 'blob',
    }));
    globalThis.fetch = mockFetch({
      sha: 'abc',
      tree: files,
      truncated: true,
    });

    const result = await api.fetchTree('alice', 'repo-a', 'main', 'tok_123');
    expect(result.warning).toBeTruthy();
  });

  it('calls correct API endpoint with recursive parameter', async () => {
    globalThis.fetch = mockFetch({ sha: 'abc', tree: [], truncated: false });
    await api.fetchTree('alice', 'repo-a', 'main', 'tok_123');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/repos/alice/repo-a/git/trees/main?recursive=1'),
      expect.any(Object)
    );
  });

  it('returns error on HTTP failure', async () => {
    globalThis.fetch = mockFetch({ message: 'Not Found' }, false, 404);

    const result = await api.fetchTree('alice', 'repo-a', 'main', 'tok_123');
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ─── fetchPRs ───

describe('fetchPRs()', () => {
  it('returns open PRs on success', async () => {
    const prs = [
      { number: 42, title: 'Fix login bug' },
      { number: 43, title: 'Add dark mode' },
    ];
    globalThis.fetch = mockFetch(prs);

    const result = await api.fetchPRs('alice', 'repo-a', 'tok_123');
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      { number: 42, title: 'Fix login bug' },
      { number: 43, title: 'Add dark mode' },
    ]);
  });

  it('calls correct API endpoint for open PRs', async () => {
    globalThis.fetch = mockFetch([]);
    await api.fetchPRs('alice', 'repo-a', 'tok_123');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/repos/alice/repo-a/pulls?state=open'),
      expect.any(Object)
    );
  });

  it('returns error on HTTP failure', async () => {
    globalThis.fetch = mockFetch({ message: 'Not Found' }, false, 404);

    const result = await api.fetchPRs('alice', 'repo-a', 'tok_123');
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ─── fetchIssues ───

describe('fetchIssues()', () => {
  it('returns open issues on success, filtering out PRs', async () => {
    const issues = [
      { number: 10, title: 'Bug report' },
      { number: 11, title: 'Feature request', pull_request: { url: '...' } },
      { number: 12, title: 'Another bug' },
    ];
    globalThis.fetch = mockFetch(issues);

    const result = await api.fetchIssues('alice', 'repo-a', 'tok_123');
    expect(result.error).toBeNull();
    // Issue #11 has pull_request field — should be filtered out
    expect(result.data).toEqual([
      { number: 10, title: 'Bug report' },
      { number: 12, title: 'Another bug' },
    ]);
  });

  it('calls correct API endpoint for open issues', async () => {
    globalThis.fetch = mockFetch([]);
    await api.fetchIssues('alice', 'repo-a', 'tok_123');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/repos/alice/repo-a/issues?state=open'),
      expect.any(Object)
    );
  });

  it('returns error on HTTP failure', async () => {
    globalThis.fetch = mockFetch({ message: 'Forbidden' }, false, 403);

    const result = await api.fetchIssues('alice', 'repo-a', 'tok_123');
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('returns error on network failure', async () => {
    globalThis.fetch = mockFetchNetworkError();

    const result = await api.fetchIssues('alice', 'repo-a', 'tok_123');
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
