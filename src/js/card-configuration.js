/**
 * Card 1: Configuration
 *
 * PAT input, username, repo grid, branch grid.
 * Wired to state, GitHub API, and cache.
 *
 * Req IDs: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, APP-04
 */

import { getState, setState } from './state.js';
import { fetchRepos, fetchBranches, fetchTree } from './github-api.js';
import { cacheGet, cacheSet, cacheClear } from './cache.js';
import {
  renderShimmer,
  renderError,
  showNotification,
  isInteracting,
  expandCard,
} from './components.js';
import { icon } from './icons.js';
import { createButton, createInputField } from './ui.js';

// --- GL-05: Defer re-render until user is not mid-interaction ---

function deferIfInteracting(fn, maxRetries = 5) {
  if (!isInteracting()) {
    fn();
    return;
  }
  if (maxRetries <= 0) return;
  setTimeout(() => deferIfInteracting(fn, maxRetries - 1), 2000);
}

// --- Display limits ---

// Max repos visible in the collapsed state (approx. one row)
const REPO_DISPLAY_LIMIT = 4;

// Max branches visible in the collapsed state
const BRANCH_DISPLAY_LIMIT = 3;

// --- Module-level UI data ---
let fileTree = [];

/** @returns {Array} current file tree data */
export function getFileTree() {
  return fileTree;
}

/** Update the configuration card title (called by card-tasks on flow select) */
export function setConfigCardSummary(text) {
  const titleEl = document.querySelector(
    '#card-configuration .card-header > :first-child'
  );
  if (!titleEl) return;

  if (!text) {
    titleEl.textContent = 'Configuration';
    return;
  }

  // Show icons for owner / repo : branch
  titleEl.textContent = '';
  const state = getState();
  const { owner, repo, branch } = state.configuration;

  if (owner) {
    titleEl.appendChild(icon('mark-github', 'icon-btn'));
    const ownerSpan = document.createElement('span');
    ownerSpan.textContent = ` ${owner}`;
    titleEl.appendChild(ownerSpan);
  }

  if (repo) {
    const sep = document.createTextNode(' / ');
    titleEl.appendChild(sep);
    titleEl.appendChild(icon('repo', 'icon-btn'));
    const repoSpan = document.createElement('span');
    repoSpan.textContent = ` ${repo}`;
    titleEl.appendChild(repoSpan);
  }

  if (branch) {
    const sep = document.createTextNode(' : ');
    titleEl.appendChild(sep);
    titleEl.appendChild(icon('git-branch', 'icon-btn'));
    const branchSpan = document.createElement('span');
    branchSpan.textContent = ` ${branch}`;
    titleEl.appendChild(branchSpan);
  }
}

// --- DOM references (set during init) ---
let elPatInput,
  elPatToggle,
  elPatClear,
  elUsername,
  elUserClear,
  elRepoSection,
  elRepoGrid,
  elBranchSection,
  elBranchGrid,
  elCardBody,
  elCredentials;

// Track collapsed state for repo/branch grids (VIS-03)
// NOTE: do NOT reset these inside the render functions — only set explicitly.
let reposCollapsed = false;
// Branches start collapsed (show first 3 by default)
let branchesCollapsed = true;

// --- Render static UI shell ---

function renderShell(container) {
  container.innerHTML = '';

  // Credentials row: PAT + Username side by side
  elCredentials = document.createElement('div');
  elCredentials.className = 'wrapper';

  // --- PAT ---
  const patWrapper = createInputField({
    type: 'password',
    id: 'cfg-pat',
    iconName: 'key',
    placeholder: 'GitHub personal access token',
  });
  elPatInput = patWrapper._inputEl;

  // Eye toggle (dual-icon CSS swap via .js-eye-btn)
  elPatToggle = createButton('icon', { ariaLabel: 'Show token' });
  elPatToggle.classList.add('js-eye-btn');
  elPatToggle.hidden = true;
  const eyeOn = document.createElement('span');
  eyeOn.className = 'icon-eye-on';
  eyeOn.appendChild(icon('eye', 'icon-btn'));
  const eyeOff = document.createElement('span');
  eyeOff.className = 'icon-eye-off';
  eyeOff.appendChild(icon('eye-closed', 'icon-btn'));
  elPatToggle.appendChild(eyeOn);
  elPatToggle.appendChild(eyeOff);
  patWrapper.appendChild(elPatToggle);

  // Clear button (starts hidden)
  elPatClear = createButton('icon', {
    iconName: 'x',
    iconClass: 'icon-remove',
    ariaLabel: 'Clear token',
  });
  elPatClear.hidden = true;
  patWrapper.appendChild(elPatClear);

  // --- Username ---
  const userWrapper = createInputField({
    iconName: 'mark-github',
    id: 'cfg-username',
    placeholder: 'GitHub username',
  });
  elUsername = userWrapper._inputEl;

  // Username clear button (starts hidden)
  elUserClear = createButton('icon', {
    iconName: 'x',
    iconClass: 'icon-remove',
    ariaLabel: 'Clear username',
  });
  elUserClear.hidden = true;
  userWrapper.appendChild(elUserClear);

  elCredentials.appendChild(patWrapper);
  elCredentials.appendChild(userWrapper);

  // Repo section
  elRepoSection = document.createElement('div');

  // Branch section
  elBranchSection = document.createElement('div');

  container.appendChild(elCredentials);
  container.appendChild(elRepoSection);
  container.appendChild(elBranchSection);
}

// --- Event handlers ---

function onPatInput() {
  const pat = elPatInput.value.trim();
  setState('configuration.pat', pat);
  const hasValue = pat.length > 0;
  elPatToggle.hidden = !hasValue;
  elPatClear.hidden = !hasValue;
}

function onPatChange() {
  const pat = elPatInput.value.trim();
  if (!pat) return;
  cacheClear();
  const owner = getState().configuration.owner;
  if (owner) loadRepos(owner, pat, false);
}

function onPatToggle() {
  const isPassword = elPatInput.type === 'password';
  elPatInput.type = isPassword ? 'text' : 'password';
  elPatToggle.classList.toggle('is-shown', isPassword);
  elPatToggle.setAttribute(
    'aria-label',
    isPassword ? 'Hide token' : 'Show token'
  );
}

function onPatClear() {
  elPatInput.value = '';
  elPatInput.type = 'password';
  elPatToggle.classList.remove('is-shown');
  elPatToggle.hidden = true;
  elPatClear.hidden = true;
  cacheClear();
  setState((s) => {
    s.configuration.pat = '';
    s.configuration.repo = '';
    s.configuration.branch = '';
    return s;
  });
  fileTree = [];
  // Show credentials again when clearing
  if (elCredentials) elCredentials.hidden = false;
  reposCollapsed = false;
  branchesCollapsed = true;
  renderRepoSection([]);
  renderBranchSection([]);
  setConfigCardSummary('');
}

function onUsernameInput() {
  const owner = elUsername.value.trim();
  elUserClear.hidden = owner.length === 0;
}

function onUsernameChange() {
  const owner = elUsername.value.trim();
  setState('configuration.owner', owner);
  const pat = getState().configuration.pat;
  if (pat && owner) {
    cacheClear();
    loadRepos(owner, pat, false);
  } else {
    renderRepoSection([]);
    renderBranchSection([]);
  }
}

function onUserClear() {
  elUsername.value = '';
  elUserClear.hidden = true;
  cacheClear();
  setState((s) => {
    s.configuration.owner = '';
    s.configuration.repo = '';
    s.configuration.branch = '';
    return s;
  });
  fileTree = [];
  if (elCredentials) elCredentials.hidden = false;
  reposCollapsed = false;
  branchesCollapsed = true;
  renderRepoSection([]);
  renderBranchSection([]);
  setConfigCardSummary('');
}

// --- Repo grid rendering ---

function renderRepoSection(repos, selectedRepo) {
  elRepoSection.innerHTML = '';
  if (!repos || repos.length === 0) return;

  elRepoSection.className = 'input';

  const label = document.createElement('label');
  label.textContent = 'Repos';
  elRepoSection.appendChild(label);

  elRepoGrid = document.createElement('div');
  elRepoGrid.className = 'wrapper';
  elRepoGrid.setAttribute('role', 'listbox');
  elRepoGrid.setAttribute('aria-label', 'Repositories');

  renderRepoButtons(repos, selectedRepo);
  elRepoSection.appendChild(elRepoGrid);
}

function renderRepoButtons(repos, selectedRepo) {
  if (!elRepoGrid) return;
  elRepoGrid.innerHTML = '';
  // NOTE: do NOT reset reposCollapsed here — only set explicitly.

  let visibleRepos;
  if (!reposCollapsed || repos.length <= REPO_DISPLAY_LIMIT) {
    visibleRepos = repos;
  } else {
    const firstN = repos.slice(0, REPO_DISPLAY_LIMIT);
    if (selectedRepo && !firstN.find((r) => r.name === selectedRepo)) {
      const selectedR = repos.find((r) => r.name === selectedRepo);
      visibleRepos = selectedR ? [...firstN, selectedR] : firstN;
    } else {
      visibleRepos = firstN;
    }
  }

  for (const repo of visibleRepos) {
    const btn = createButton('select', {
      label: repo.name,
      iconName: 'repo',
      selected: repo.name === selectedRepo,
      onClick: () => onRepoSelect(repo, repos),
    });
    btn.setAttribute('role', 'option');
    elRepoGrid.appendChild(btn);
  }

  // "More" / "https://paumen.github.io/agent_prompt/" button when repos exceed display limit
  const hiddenCount = repos.length - REPO_DISPLAY_LIMIT;
  if (hiddenCount > 0 && selectedRepo) {
    const moreBtn = createButton('icon', {
      label: reposCollapsed ? `+${hiddenCount} more` : 'Less',
      onClick: () => {
        reposCollapsed = !reposCollapsed;
        renderRepoButtons(repos, selectedRepo);
      },
    });
    elRepoGrid.appendChild(moreBtn);
  }
}

function onRepoSelect(repo, allRepos) {
  const state = getState();
  const { owner, pat } = state.configuration;

  setState((s) => {
    s.configuration.repo = repo.name;
    s.configuration.branch = '';
    return s;
  });
  fileTree = [];

  renderRepoButtons(allRepos, repo.name);
  renderBranchSection([]);

  if (elCredentials) elCredentials.hidden = true;

  // Expand Tasks card; Config card stays open (full collapse happens on flow select)
  expandCard('card-tasks');

  // Fetch branches + file tree (CFG-05)
  loadBranches(owner, repo.name, pat, repo.default_branch);
}

// --- Branch grid rendering ---

function renderBranchSection(branches, selectedBranch) {
  elBranchSection.innerHTML = '';
  if (!branches || branches.length === 0) return;

  elBranchSection.className = 'input';

  const label = document.createElement('label');
  label.textContent = 'Branch';
  elBranchSection.appendChild(label);

  elBranchGrid = document.createElement('div');
  elBranchGrid.className = 'wrapper';
  elBranchGrid.setAttribute('role', 'listbox');
  elBranchGrid.setAttribute('aria-label', 'Branches');

  renderBranchButtons(branches, selectedBranch);
  elBranchSection.appendChild(elBranchGrid);
}

function renderBranchButtons(branches, selectedBranch) {
  if (!elBranchGrid) return;
  elBranchGrid.innerHTML = '';
  // NOTE: do NOT reset branchesCollapsed here — only set explicitly.

  let visibleBranches;
  if (!branchesCollapsed || branches.length <= BRANCH_DISPLAY_LIMIT) {
    visibleBranches = branches;
  } else {
    const firstN = branches.slice(0, BRANCH_DISPLAY_LIMIT);
    if (selectedBranch && !firstN.find((b) => b.name === selectedBranch)) {
      const selectedB = branches.find((b) => b.name === selectedBranch);
      visibleBranches = selectedB ? [...firstN, selectedB] : firstN;
    } else {
      visibleBranches = firstN;
    }
  }

  for (const branch of visibleBranches) {
    const btn = createButton('select', {
      label: branch.name,
      iconName: 'git-branch',
      selected: branch.name === selectedBranch,
      onClick: () => onBranchSelect(branch, branches),
    });
    btn.setAttribute('role', 'option');
    elBranchGrid.appendChild(btn);
  }

  const hiddenCount = Math.max(0, branches.length - BRANCH_DISPLAY_LIMIT);
  if (hiddenCount > 0) {
    const moreBtn = createButton('action', {
      label: branchesCollapsed ? `+${hiddenCount} more` : 'Less',
      onClick: () => {
        branchesCollapsed = !branchesCollapsed;
        renderBranchButtons(branches, selectedBranch);
      },
    });
    elBranchGrid.appendChild(moreBtn);
  }
}

function onBranchSelect(branch, allBranches) {
  setState('configuration.branch', branch.name);
  renderBranchButtons(allBranches, branch.name);

  const state = getState();
  const { owner, repo, pat } = state.configuration;
  if (owner && repo && pat) {
    loadTreeInBackground(owner, repo, branch.name, pat);
  }
}

// --- Data loading with cache + background refresh (GL-05) ---

async function loadRepos(owner, pat, isBackground = false) {
  const cacheKey = `repos_${owner}`;

  const cached = cacheGet(cacheKey);
  if (cached && !isBackground) {
    renderRepoSection(cached, getState().configuration.repo);
    loadRepos(owner, pat, true);
    return;
  }

  if (!isBackground) {
    elRepoSection.innerHTML = '';
    elRepoSection.className = 'input';
    const label = document.createElement('label');
    label.textContent = 'Repos';
    elRepoSection.appendChild(label);
    const shimmerContainer = document.createElement('div');
    elRepoSection.appendChild(shimmerContainer);
    renderShimmer(shimmerContainer, 'Loading repositories\u2026', 3);
  }

  const result = await fetchRepos(owner, pat);

  if (result.error) {
    if (!isBackground) {
      elRepoSection.innerHTML = '';
      renderError(elRepoSection, result.error, () =>
        loadRepos(owner, pat, false)
      );
    }
    return;
  }

  cacheSet(cacheKey, result.data);

  if (isBackground && cached) {
    const changed =
      JSON.stringify(result.data.map((r) => r.name)) !==
      JSON.stringify(cached.map((r) => r.name));
    if (changed) {
      deferIfInteracting(() => {
        renderRepoSection(result.data, getState().configuration.repo);
        showNotification(elRepoSection, 'Updated', 'success');
      });
    }
    return;
  }

  renderRepoSection(result.data, getState().configuration.repo);

  if (result.warning) {
    showNotification(elRepoSection, result.warning, 'info');
  }
}

async function loadBranches(owner, repo, pat, defaultBranch) {
  const cacheKey = `branches_${owner}_${repo}`;

  const cached = cacheGet(cacheKey);
  if (cached) {
    const autoSelected = defaultBranch || cached[0]?.name || '';
    setState('configuration.branch', autoSelected);
    renderBranchSection(cached, autoSelected);
    loadTreeInBackground(owner, repo, autoSelected, pat);
    loadBranchesBackground(owner, repo, pat, cacheKey, cached);
    return;
  }

  elBranchSection.innerHTML = '';
  elBranchSection.className = 'input';
  const label = document.createElement('label');
  label.textContent = 'Branch';
  elBranchSection.appendChild(label);
  const shimmerContainer = document.createElement('div');
  elBranchSection.appendChild(shimmerContainer);
  renderShimmer(shimmerContainer, 'Loading branches\u2026', 2);

  const result = await fetchBranches(owner, repo, pat);

  if (result.error) {
    elBranchSection.innerHTML = '';
    renderError(elBranchSection, result.error, () =>
      loadBranches(owner, repo, pat, defaultBranch)
    );
    return;
  }

  cacheSet(cacheKey, result.data);

  const match = result.data.find((b) => b.name === defaultBranch);
  const autoSelected = match ? match.name : result.data[0]?.name || '';
  setState('configuration.branch', autoSelected);
  renderBranchSection(result.data, autoSelected);

  if (autoSelected) {
    loadTreeInBackground(owner, repo, autoSelected, pat);
  }
}

async function loadBranchesBackground(owner, repo, pat, cacheKey, cached) {
  const result = await fetchBranches(owner, repo, pat);
  if (result.error) return;
  cacheSet(cacheKey, result.data);
  const changed =
    JSON.stringify(result.data.map((b) => b.name)) !==
    JSON.stringify(cached.map((b) => b.name));
  if (changed) {
    deferIfInteracting(() => {
      const selected = getState().configuration.branch;
      renderBranchSection(result.data, selected);
      showNotification(elBranchSection, 'Updated', 'success');
    });
  }
}

async function loadTreeInBackground(owner, repo, branch, pat) {
  const cacheKey = `tree_${owner}_${repo}_${branch}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    fileTree = cached;
  }

  const result = await fetchTree(owner, repo, branch, pat);
  if (result.error) {
    if (!cached) fileTree = [];
    return;
  }

  fileTree = result.data;
  cacheSet(cacheKey, result.data);
}

// --- Initialization ---

export function initConfigurationCard() {
  elCardBody = document.getElementById('bd-configuration');
  if (!elCardBody) return;

  renderShell(elCardBody);

  const state = getState();
  const savedPat = state.configuration.pat;
  const savedOwner = state.configuration.owner;

  elPatInput.value = savedPat;
  elUsername.value = savedOwner;

  if (savedPat) {
    elPatToggle.hidden = false;
    elPatClear.hidden = false;
  }
  if (savedOwner) {
    elUserClear.hidden = false;
  }

  // Wire events
  elPatInput.addEventListener('input', onPatInput);
  elPatInput.addEventListener('change', onPatChange);
  elPatToggle.addEventListener('click', onPatToggle);
  elPatClear.addEventListener('click', onPatClear);
  elUsername.addEventListener('input', onUsernameInput);
  elUsername.addEventListener('change', onUsernameChange);
  elUserClear.addEventListener('click', onUserClear);

  // When config card is re-opened by user click, show credentials again
  const cfgCard = document.getElementById('card-configuration');
  cfgCard?.querySelector('.card-header')?.addEventListener('click', () => {
    const willBeOpen = !cfgCard.classList.contains('card--open');
    if (willBeOpen) {
      if (elCredentials) elCredentials.hidden = false;
      setConfigCardSummary('');
    }
  });

  // Auto-fetch repos on page load if credentials exist (CFG-02)
  if (state.configuration.pat && state.configuration.owner) {
    loadRepos(state.configuration.owner, state.configuration.pat, false);
  }
}
