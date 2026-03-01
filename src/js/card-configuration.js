/**
 * Card 1: Configuration
 *
 * PAT input, username, repo grid, branch grid.
 * Wired to state, GitHub API, and cache.
 *
 * Req IDs: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, APP-04
 * Phase 11: input-row layout, eye/clear buttons, icons per button, display limits
 */

import { getState, setState } from './state.js';
import { fetchRepos, fetchBranches, fetchTree } from './github-api.js';
import { cacheGet, cacheSet, cacheClear } from './cache.js';
import {
  renderShimmer,
  renderError,
  showNotification,
  isInteracting,
} from './components.js';

// --- GL-05: Defer re-render until user is not mid-interaction ---

function deferIfInteracting(fn, maxRetries = 5) {
  if (!isInteracting()) {
    fn();
    return;
  }
  if (maxRetries <= 0) return;
  setTimeout(() => deferIfInteracting(fn, maxRetries - 1), 2000);
}

import { icon } from './icons.js';

// --- Display limits (Phase 11) ---

// Max repos visible in the collapsed state (approx. one row)
const REPO_DISPLAY_LIMIT = 4;

// Max branches visible in the collapsed state (Phase 11: 3)
const BRANCH_DISPLAY_LIMIT = 3;

// --- Module-level UI data ---
let fileTree = [];

/** @returns {Array} current file tree data */
export function getFileTree() {
  return fileTree;
}

/** Update the configuration card title (called by card-tasks on flow select) */
export function setConfigCardSummary(text) {
  const titleEl = document.querySelector('#card-configuration .card-title');
  if (!titleEl) return;
  titleEl.textContent = text || 'Configuration';
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
// Phase 11: branches start collapsed (show first 3 by default)
let branchesCollapsed = true;

// --- Card expand/collapse helpers ---

function expandCard(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.add('card--open');
  card.querySelector('.card-header')?.setAttribute('aria-expanded', 'true');
}

function collapseCard(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.remove('card--open');
  card.querySelector('.card-header')?.setAttribute('aria-expanded', 'false');
}

// --- Render static UI shell ---

function renderShell(container) {
  container.innerHTML = '';

  // Credentials row: PAT + Username side by side
  elCredentials = document.createElement('div');
  elCredentials.className = 'credentials-row';

  // --- PAT column (Phase 11: flat .input-row layout) ---
  const patCol = document.createElement('div');
  patCol.className = 'cfg-pat-col';

  const patRow = document.createElement('div');
  patRow.className = 'input-row';

  // Left icon: key
  patRow.appendChild(icon('key', 'icon-btn'));

  elPatInput = document.createElement('input');
  elPatInput.type = 'password';
  elPatInput.id = 'cfg-pat';
  elPatInput.className = 'input-field';
  elPatInput.placeholder = 'GitHub personal access token';
  elPatInput.setAttribute('autocomplete', 'off');
  patRow.appendChild(elPatInput);

  // Eye toggle (class-based, two pre-rendered spans, starts hidden)
  elPatToggle = document.createElement('button');
  elPatToggle.className = 'btn-icon cfg-pat-toggle js-eye-btn';
  elPatToggle.type = 'button';
  elPatToggle.setAttribute('aria-label', 'Show token');
  elPatToggle.hidden = true;
  const eyeOn = document.createElement('span');
  eyeOn.className = 'icon-eye-on';
  eyeOn.appendChild(icon('eye', 'icon-btn'));
  const eyeOff = document.createElement('span');
  eyeOff.className = 'icon-eye-off';
  eyeOff.appendChild(icon('eye-closed', 'icon-btn'));
  elPatToggle.appendChild(eyeOn);
  elPatToggle.appendChild(eyeOff);
  patRow.appendChild(elPatToggle);

  // Clear button (starts hidden)
  elPatClear = document.createElement('button');
  elPatClear.className = 'btn-icon cfg-pat-clear js-clear-btn';
  elPatClear.type = 'button';
  elPatClear.setAttribute('aria-label', 'Clear token');
  elPatClear.hidden = true;
  elPatClear.appendChild(icon('x', 'icon-remove'));
  patRow.appendChild(elPatClear);

  patCol.appendChild(patRow);

  // --- Username column (Phase 11: flat .input-row layout) ---
  const userCol = document.createElement('div');
  userCol.className = 'cfg-user-col';

  const userRow = document.createElement('div');
  userRow.className = 'input-row';

  // Left icon: GitHub mark
  userRow.appendChild(icon('mark-github', 'icon-btn'));

  elUsername = document.createElement('input');
  elUsername.type = 'text';
  elUsername.id = 'cfg-username';
  elUsername.className = 'input-field';
  elUsername.placeholder = 'GitHub username';
  elUsername.setAttribute('autocomplete', 'off');
  userRow.appendChild(elUsername);

  // Username clear button (starts hidden)
  elUserClear = document.createElement('button');
  elUserClear.className = 'btn-icon js-user-clear-btn';
  elUserClear.type = 'button';
  elUserClear.setAttribute('aria-label', 'Clear username');
  elUserClear.hidden = true;
  elUserClear.appendChild(icon('x', 'icon-remove'));
  userRow.appendChild(elUserClear);

  userCol.appendChild(userRow);

  elCredentials.appendChild(patCol);
  elCredentials.appendChild(userCol);

  // Repo section
  elRepoSection = document.createElement('div');
  elRepoSection.className = 'cfg-section cfg-section--repos';

  // Branch section
  elBranchSection = document.createElement('div');
  elBranchSection.className = 'cfg-section cfg-section--branches';

  container.appendChild(elCredentials);
  container.appendChild(elRepoSection);
  container.appendChild(elBranchSection);
}

// --- Event handlers ---

function onPatInput() {
  const pat = elPatInput.value.trim();
  setState('configuration.pat', pat);
  // Phase 11: show/hide eye and clear buttons based on value
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
  // Phase 11: toggle .is-shown class for CSS-driven icon swap
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
  elCredentials?.classList.remove('cfg-credentials--hidden');
  reposCollapsed = false;
  branchesCollapsed = true;
  renderRepoSection([]);
  renderBranchSection([]);
  setConfigCardSummary('');
}

function onUsernameInput() {
  const owner = elUsername.value.trim();
  // Phase 11: show/hide username clear button based on value
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
  elCredentials?.classList.remove('cfg-credentials--hidden');
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

  const label = document.createElement('div');
  label.className = 'cfg-section-label';
  label.textContent = 'Repositories';
  elRepoSection.appendChild(label);

  elRepoGrid = document.createElement('div');
  elRepoGrid.className = 'btn-grid';
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
    // Expanded OR fits within limit: show all
    visibleRepos = repos;
  } else {
    // Collapsed: show first REPO_DISPLAY_LIMIT repos,
    // and always include the selected repo even if it's beyond the limit (Phase 11)
    const firstN = repos.slice(0, REPO_DISPLAY_LIMIT);
    if (selectedRepo && !firstN.find((r) => r.name === selectedRepo)) {
      const selectedR = repos.find((r) => r.name === selectedRepo);
      visibleRepos = selectedR ? [...firstN, selectedR] : firstN;
    } else {
      visibleRepos = firstN;
    }
  }

  for (const repo of visibleRepos) {
    const btn = document.createElement('button');
    btn.className = 'btn-grid-item';
    btn.type = 'button';
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', String(repo.name === selectedRepo));
    if (repo.name === selectedRepo) btn.classList.add('item-selected');
    btn.appendChild(icon('repo', 'icon-btn'));
    const nameSpan = document.createElement('span');
    nameSpan.textContent = repo.name;
    btn.appendChild(nameSpan);

    btn.addEventListener('click', () => onRepoSelect(repo, repos));
    elRepoGrid.appendChild(btn);
  }

  // "More" / "Less" button when repos exceed display limit (only shown when a repo is selected)
  const hiddenCount = repos.length - REPO_DISPLAY_LIMIT;
  if (hiddenCount > 0 && selectedRepo) {
    const moreBtn = document.createElement('button');
    moreBtn.className = 'btn-grid-item cfg-show-more';
    moreBtn.type = 'button';
    moreBtn.textContent = reposCollapsed ? `+${hiddenCount} more` : 'Less';
    moreBtn.addEventListener('click', () => {
      reposCollapsed = !reposCollapsed;
      renderRepoButtons(repos, selectedRepo);
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

  // Hide credentials after repo is selected
  elCredentials?.classList.add('cfg-credentials--hidden');

  // Expand Tasks card; Config card stays open (full collapse happens on flow select)
  expandCard('card-tasks');

  // Fetch branches + file tree (CFG-05)
  loadBranches(owner, repo.name, pat, repo.default_branch);
}

// --- Branch grid rendering ---

function renderBranchSection(branches, selectedBranch) {
  elBranchSection.innerHTML = '';
  if (!branches || branches.length === 0) return;

  const label = document.createElement('div');
  label.className = 'cfg-section-label';
  label.textContent = 'Branches';
  elBranchSection.appendChild(label);

  elBranchGrid = document.createElement('div');
  elBranchGrid.className = 'btn-grid';
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
    // Expanded OR fits within limit: show all
    visibleBranches = branches;
  } else {
    // Collapsed: show first BRANCH_DISPLAY_LIMIT branches.
    // Always include selected branch even if beyond limit (Phase 11).
    const firstN = branches.slice(0, BRANCH_DISPLAY_LIMIT);
    if (selectedBranch && !firstN.find((b) => b.name === selectedBranch)) {
      const selectedB = branches.find((b) => b.name === selectedBranch);
      visibleBranches = selectedB ? [...firstN, selectedB] : firstN;
    } else {
      visibleBranches = firstN;
    }
  }

  for (const branch of visibleBranches) {
    const btn = document.createElement('button');
    btn.className = 'btn-grid-item';
    btn.type = 'button';
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', String(branch.name === selectedBranch));
    if (branch.name === selectedBranch) btn.classList.add('item-selected');
    btn.appendChild(icon('git-branch', 'icon-btn'));
    const nameSpan = document.createElement('span');
    nameSpan.textContent = branch.name;
    btn.appendChild(nameSpan);

    btn.addEventListener('click', () => onBranchSelect(branch, branches));
    elBranchGrid.appendChild(btn);
  }

  const hiddenCount = Math.max(0, branches.length - BRANCH_DISPLAY_LIMIT);
  if (hiddenCount > 0) {
    const moreBtn = document.createElement('button');
    moreBtn.className = 'btn-grid-item cfg-show-more';
    moreBtn.type = 'button';
    moreBtn.textContent = branchesCollapsed ? `+${hiddenCount} more` : 'Less';
    moreBtn.addEventListener('click', () => {
      branchesCollapsed = !branchesCollapsed;
      renderBranchButtons(branches, selectedBranch);
    });
    elBranchGrid.appendChild(moreBtn);
  }
}

function onBranchSelect(branch, allBranches) {
  setState('configuration.branch', branch.name);
  // Phase 11: keep branchesCollapsed as-is (no auto-collapse per branch selection)
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
    const label = document.createElement('div');
    label.className = 'cfg-section-label';
    label.textContent = 'Repositories';
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
    // Phase 11: branchesCollapsed stays true (initial value) — no auto-set here
    renderBranchSection(cached, autoSelected);
    loadTreeInBackground(owner, repo, autoSelected, pat);
    loadBranchesBackground(owner, repo, pat, cacheKey, cached);
    return;
  }

  elBranchSection.innerHTML = '';
  const label = document.createElement('div');
  label.className = 'cfg-section-label';
  label.textContent = 'Branches';
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
  // Phase 11: branchesCollapsed stays true (set as initial value) — no auto-set here
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

  // Phase 11: show eye/clear if PAT already has a value
  if (savedPat) {
    elPatToggle.hidden = false;
    elPatClear.hidden = false;
  }
  // Phase 11: show username clear if owner already has a value
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
      elCredentials?.classList.remove('cfg-credentials--hidden');
      setConfigCardSummary('');
    }
  });

  // Auto-fetch repos on page load if credentials exist (CFG-02)
  if (state.configuration.pat && state.configuration.owner) {
    loadRepos(state.configuration.owner, state.configuration.pat, false);
  }
}
