/**
 * GitHub REST API module.
 *
 * All functions return { data, error, warning? } — never throw.
 * Enforces APP-03 limits: <15 repos, <300 files.
 */

const API_BASE = "https://api.github.com";
const MAX_REPOS = 15;
const MAX_FILES = 300;

function headers(pat) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
  };
}

async function apiFetch(url, pat) {
  try {
    const res = await fetch(url, { headers: headers(pat) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body.message || `HTTP ${res.status}`;
      return { data: null, error: `GitHub API error (${res.status}): ${msg}` };
    }
    const data = await res.json();
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: `Network error: ${err.message || "Failed to fetch"}`,
    };
  }
}

/**
 * List repositories for a user.
 * Enforces APP-03: max 15 repos returned.
 */
export async function fetchRepos(owner, pat) {
  const result = await apiFetch(
    `${API_BASE}/users/${owner}/repos?per_page=100&sort=updated`,
    pat,
  );
  if (result.error) return result;

  if (result.data.length > MAX_REPOS) {
    return {
      data: result.data.slice(0, MAX_REPOS),
      error: null,
      warning: `Showing first ${MAX_REPOS} of ${result.data.length} repositories.`,
    };
  }
  return result;
}

/**
 * List branches for a repository.
 */
export async function fetchBranches(owner, repo, pat) {
  return apiFetch(
    `${API_BASE}/repos/${owner}/${repo}/branches?per_page=100`,
    pat,
  );
}

/**
 * Fetch recursive file tree for a branch.
 * Filters to blobs (files) only, enforces APP-03: max 300 files.
 */
export async function fetchTree(owner, repo, branch, pat) {
  const result = await apiFetch(
    `${API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    pat,
  );
  if (result.error) return result;

  const blobs = (result.data.tree || []).filter((e) => e.type === "blob");
  const truncatedByGitHub = result.data.truncated;

  let warning;
  let files = blobs;

  if (blobs.length > MAX_FILES) {
    files = blobs.slice(0, MAX_FILES);
    warning = `Repository has ${blobs.length} files. Showing first ${MAX_FILES}.`;
  } else if (truncatedByGitHub) {
    warning = "File tree was truncated by GitHub. Some files may be missing.";
  }

  return { data: files, error: null, ...(warning && { warning }) };
}

/**
 * List open pull requests for a repository.
 * Returns [{ number, title }].
 */
export async function fetchPRs(owner, repo, pat) {
  const result = await apiFetch(
    `${API_BASE}/repos/${owner}/${repo}/pulls?state=open&per_page=100`,
    pat,
  );
  if (result.error) return result;

  return {
    data: result.data.map(({ number, title }) => ({ number, title })),
    error: null,
  };
}

/**
 * List open issues for a repository (excluding PRs).
 * GitHub's issues endpoint returns PRs too — filter them out.
 * Returns [{ number, title }].
 */
export async function fetchIssues(owner, repo, pat) {
  const result = await apiFetch(
    `${API_BASE}/repos/${owner}/${repo}/issues?state=open&per_page=100`,
    pat,
  );
  if (result.error) return result;

  return {
    data: result.data
      .filter((issue) => !issue.pull_request)
      .map(({ number, title }) => ({ number, title })),
    error: null,
  };
}
