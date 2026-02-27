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

// --- SVG icon constants (Octicons, inline) ---

const ICON_EYE = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.175 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.125-.967 1.955-2.095 2.366-2.717a.12.12 0 0 0 0-.136c-.411-.622-1.241-1.75-2.366-2.717C10.825 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.125.967-1.955 2.095-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z"/></svg>`;

// Eye with diagonal slash — reuses the open-eye outline + adds a filled slash band
const ICON_EYE_CLOSED = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.175 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.125-.967 1.955-2.095 2.366-2.717a.12.12 0 0 0 0-.136c-.411-.622-1.241-1.75-2.366-2.717C10.825 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.125.967-1.955 2.095-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z"/><path d="M1 0L3 2L15 14.5L13 12.5Z"/></svg>`;

const ICON_X = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>`;

// Lock icon — properly centered in the 16×16 viewbox (replaces off-center key icon)
const ICON_LOCK = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm8.25 3.5h-8.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25ZM10.5 4a2.5 2.5 0 0 0-5 0v2h5Z"/></svg>`;

const ICON_PERSON = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>`;

const ICON_REPO = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z"/></svg>`;

const ICON_BRANCH = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>`;

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
  elRepoSection,
  elRepoGrid,
  elBranchSection,
  elBranchGrid,
  elCardBody,
  elCredentials;

// Track collapsed state for repo/branch grids (VIS-03)
// NOTE: do NOT reset these inside the render functions — only set explicitly.
let reposCollapsed = false;
let branchesCollapsed = false;

// Max branches visible before "+more" (1.7)
const BRANCH_DISPLAY_LIMIT = 4;

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

  // Credentials row: PAT + Username side by side (1.1)
  elCredentials = document.createElement('div');
  elCredentials.className = 'credentials-row';

  // --- PAT column ---
  const patCol = document.createElement('div');
  patCol.className = 'cfg-pat-col';

  const patIconWrap = document.createElement('div');
  patIconWrap.className = 'input-icon-wrap';

  const patIconPrefix = document.createElement('span');
  patIconPrefix.className = 'input-icon-prefix';
  patIconPrefix.innerHTML = ICON_LOCK;

  elPatInput = document.createElement('input');
  elPatInput.type = 'password';
  elPatInput.id = 'cfg-pat';
  elPatInput.className = 'input-field';
  elPatInput.placeholder = 'GitHub personal access token';
  elPatInput.setAttribute('autocomplete', 'off');

  patIconWrap.appendChild(patIconPrefix);
  patIconWrap.appendChild(elPatInput);

  const patRow = document.createElement('div');
  patRow.className = 'cfg-pat-row';
  patRow.appendChild(patIconWrap);

  // Show/hide toggle with SVG (1.2)
  elPatToggle = document.createElement('button');
  elPatToggle.className = 'btn-icon cfg-pat-toggle';
  elPatToggle.type = 'button';
  elPatToggle.setAttribute('aria-label', 'Show token');
  elPatToggle.innerHTML = ICON_EYE;

  // Clear with SVG (1.2)
  elPatClear = document.createElement('button');
  elPatClear.className = 'btn-icon cfg-pat-clear';
  elPatClear.type = 'button';
  elPatClear.setAttribute('aria-label', 'Clear token');
  elPatClear.innerHTML = ICON_X;

  patRow.appendChild(elPatToggle);
  patRow.appendChild(elPatClear);
  patCol.appendChild(patRow);

  // --- Username column ---
  const userCol = document.createElement('div');
  userCol.className = 'cfg-user-col';

  const userIconWrap = document.createElement('div');
  userIconWrap.className = 'input-icon-wrap';

  const userIconPrefix = document.createElement('span');
  userIconPrefix.className = 'input-icon-prefix';
  userIconPrefix.innerHTML = ICON_PERSON;

  elUsername = document.createElement('input');
  elUsername.type = 'text';
  elUsername.id = 'cfg-username';
  elUsername.className = 'input-field';
  elUsername.placeholder = 'GitHub username';
  elUsername.setAttribute('autocomplete', 'off');

  userIconWrap.appendChild(userIconPrefix);
  userIconWrap.appendChild(elUsername);
  userCol.appendChild(userIconWrap);

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
  elPatToggle.innerHTML = isPassword ? ICON_EYE_CLOSED : ICON_EYE;
  elPatToggle.setAttribute(
    'aria-label',
    isPassword ? 'Hide token' : 'Show token'
  );
}

function onPatClear() {
  elPatInput.value = '';
  elPatInput.type = 'password';
  elPatToggle.innerHTML = ICON_EYE;
  cacheClear();
  setState((s) => {
    s.configuration.pat = '';
    s.configuration.repo = '';
    s.configuration.branch = '';
    return s;
  });
  fileTree = [];
  // Show credentials again when clearing (1.5)
  elCredentials?.classList.remove('cfg-credentials--hidden');
  reposCollapsed = false;
  branchesCollapsed = false;
  renderRepoSection([]);
  renderBranchSection([]);
  setConfigCardSummary('');
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

// --- Repo grid rendering ---

function renderRepoSection(repos, selectedRepo) {
  elRepoSection.innerHTML = '';
  if (!repos || repos.length === 0) return;

  const label = document.createElement('div');
  label.className = 'cfg-section-label';
  label.innerHTML = `<span class="field-label-icon">${ICON_REPO}</span> Repositories`;
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
  // NOTE: do NOT reset reposCollapsed here — it is set by onRepoSelect or the toggle button

  const visibleRepos =
    selectedRepo && reposCollapsed
      ? repos.filter((r) => r.name === selectedRepo)
      : repos;

  for (const repo of visibleRepos) {
    const btn = document.createElement('button');
    btn.className = 'btn-grid-item';
    btn.type = 'button';
    btn.textContent = repo.name;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', String(repo.name === selectedRepo));
    if (repo.name === selectedRepo) btn.classList.add('item-selected');

    btn.addEventListener('click', () => onRepoSelect(repo, repos));
    elRepoGrid.appendChild(btn);
  }

  // "Show more" / "Change" button when collapsed
  if (selectedRepo && repos.length > 1) {
    const moreBtn = document.createElement('button');
    moreBtn.className = 'btn-grid-item cfg-show-more';
    moreBtn.type = 'button';
    moreBtn.textContent = reposCollapsed ? `+${repos.length - 1} more` : 'Less';
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

  // Collapse repos to selected item (VIS-03) — set flag BEFORE render
  reposCollapsed = true;
  renderRepoButtons(allRepos, repo.name);
  renderBranchSection([]);

  // Hide credentials after repo is selected (1.5)
  elCredentials?.classList.add('cfg-credentials--hidden');

  // Expand Tasks card; do NOT collapse Config (per 1.5 — full collapse happens on flow select)
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
  label.innerHTML = `<span class="field-label-icon">${ICON_BRANCH}</span> Branches`;
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
  // NOTE: do NOT reset branchesCollapsed here — it is set by onBranchSelect or the toggle

  // When branch is selected: show only selected (collapsed) or all (expanded).
  // When no branch selected: show first BRANCH_DISPLAY_LIMIT branches.
  let visibleBranches;
  if (selectedBranch && branchesCollapsed) {
    visibleBranches = branches.filter((b) => b.name === selectedBranch);
  } else if (!selectedBranch && branches.length > BRANCH_DISPLAY_LIMIT) {
    // Initial display limit (1.7)
    visibleBranches = branches.slice(0, BRANCH_DISPLAY_LIMIT);
  } else {
    visibleBranches = branches;
  }

  for (const branch of visibleBranches) {
    const btn = document.createElement('button');
    btn.className = 'btn-grid-item';
    btn.type = 'button';
    btn.textContent = branch.name;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', String(branch.name === selectedBranch));
    if (branch.name === selectedBranch) btn.classList.add('item-selected');

    btn.addEventListener('click', () => onBranchSelect(branch, branches));
    elBranchGrid.appendChild(btn);
  }

  const hiddenCount = selectedBranch
    ? branches.length - 1
    : branches.length - BRANCH_DISPLAY_LIMIT;

  if (hiddenCount > 0) {
    const moreBtn = document.createElement('button');
    moreBtn.className = 'btn-grid-item cfg-show-more';
    moreBtn.type = 'button';

    if (selectedBranch) {
      moreBtn.textContent = branchesCollapsed ? `+${hiddenCount} more` : 'Less';
    } else {
      moreBtn.textContent = `+${hiddenCount} more`;
    }

    moreBtn.addEventListener('click', () => {
      if (selectedBranch) {
        branchesCollapsed = !branchesCollapsed;
      }
      renderBranchButtons(branches, selectedBranch);
    });
    elBranchGrid.appendChild(moreBtn);
  }
}

function onBranchSelect(branch, allBranches) {
  setState('configuration.branch', branch.name);
  // Collapse to selected — set flag BEFORE render
  branchesCollapsed = true;
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
    label.innerHTML = `<span class="field-label-icon">${ICON_REPO}</span> Repositories`;
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
    branchesCollapsed = !!autoSelected;
    renderBranchSection(cached, autoSelected);
    loadTreeInBackground(owner, repo, autoSelected, pat);
    loadBranchesBackground(owner, repo, pat, cacheKey, cached);
    return;
  }

  elBranchSection.innerHTML = '';
  const label = document.createElement('div');
  label.className = 'cfg-section-label';
  label.innerHTML = `<span class="field-label-icon">${ICON_BRANCH}</span> Branches`;
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
  branchesCollapsed = !!autoSelected;
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
  elPatInput.value = state.configuration.pat;
  elUsername.value = state.configuration.owner;

  // Wire events
  elPatInput.addEventListener('input', onPatInput);
  elPatInput.addEventListener('change', onPatChange);
  elPatToggle.addEventListener('click', onPatToggle);
  elPatClear.addEventListener('click', onPatClear);
  elUsername.addEventListener('change', onUsernameChange);

  // When config card is re-opened by user click, show credentials again (1.5)
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
