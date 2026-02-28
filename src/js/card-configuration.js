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

// --- SVG icon constants (Octicons, inline) ---

// Key icon (for PAT field — Phase 11)
const ICON_KEY = `<svg class="icon icon--sm" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M10.5 0a5.499 5.499 0 1 1-1.288 10.851l-.552.552a.749.749 0 0 1-.53.22H7.75a.75.75 0 0 1-.75-.75V9.999a.748.748 0 0 1 .22-.53l3.83-3.832A5.5 5.5 0 0 1 10.5 0Zm-3.5 9.25v1h1l2.897-2.897a.748.748 0 0 1 .604-.195 4 4 0 1 0-3.409-3.409.748.748 0 0 1-.195.604L4 7.25v1h1a.75.75 0 0 1 .75.75v1h1a.75.75 0 0 1 .75.75ZM10.5 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>`;

// GitHub mark icon (for username field — Phase 11)
const ICON_GITHUB = `<svg class="icon icon--sm" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>`;

// Eye (show password)
const ICON_EYE = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true" style="display:block"><path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.175 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.125-.967 1.955-2.095 2.366-2.717a.12.12 0 0 0 0-.136c-.411-.622-1.241-1.75-2.366-2.717C10.825 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.125.967-1.955 2.095-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z"/></svg>`;

// Eye with diagonal slash (hide password)
const ICON_EYE_CLOSED = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true" style="display:block"><path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.175 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.125-.967 1.955-2.095 2.366-2.717a.12.12 0 0 0 0-.136c-.411-.622-1.241-1.75-2.366-2.717C10.825 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.125.967-1.955 2.095-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z"/><path d="M1 0L3 2L15 14.5L13 12.5Z"/></svg>`;

const ICON_X = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true" style="display:block"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>`;

// Repo icon for section headings and buttons (with icon class — Phase 11)
const ICON_REPO = `<svg class="icon icon--sm" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z"/></svg>`;

// Branch icon for section headings and buttons (with icon class — Phase 11)
const ICON_BRANCH = `<svg class="icon icon--sm" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>`;

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

  // Left icon: key (Phase 11)
  const patIcon = document.createElement('span');
  patIcon.className = 'input-row-icon';
  patIcon.innerHTML = ICON_KEY;
  patRow.appendChild(patIcon);

  elPatInput = document.createElement('input');
  elPatInput.type = 'password';
  elPatInput.id = 'cfg-pat';
  elPatInput.className = 'input-field';
  elPatInput.placeholder = 'GitHub personal access token';
  elPatInput.setAttribute('autocomplete', 'off');
  patRow.appendChild(elPatInput);

  // Eye toggle (Phase 11: class-based, two pre-rendered spans, starts hidden)
  elPatToggle = document.createElement('button');
  elPatToggle.className = 'btn-icon cfg-pat-toggle js-eye-btn';
  elPatToggle.type = 'button';
  elPatToggle.setAttribute('aria-label', 'Show token');
  elPatToggle.hidden = true;
  elPatToggle.innerHTML = `<span class="icon-eye-on">${ICON_EYE}</span><span class="icon-eye-off">${ICON_EYE_CLOSED}</span>`;
  patRow.appendChild(elPatToggle);

  // Clear button (starts hidden)
  elPatClear = document.createElement('button');
  elPatClear.className = 'btn-icon cfg-pat-clear js-clear-btn';
  elPatClear.type = 'button';
  elPatClear.setAttribute('aria-label', 'Clear token');
  elPatClear.hidden = true;
  elPatClear.innerHTML = ICON_X;
  patRow.appendChild(elPatClear);

  patCol.appendChild(patRow);

  // --- Username column (Phase 11: flat .input-row layout) ---
  const userCol = document.createElement('div');
  userCol.className = 'cfg-user-col';

  const userRow = document.createElement('div');
  userRow.className = 'input-row';

  // Left icon: GitHub mark (Phase 11)
  const userIcon = document.createElement('span');
  userIcon.className = 'input-row-icon';
  userIcon.innerHTML = ICON_GITHUB;
  userRow.appendChild(userIcon);

  elUsername = document.createElement('input');
  elUsername.type = 'text';
  elUsername.id = 'cfg-username';
  elUsername.className = 'input-field';
  elUsername.placeholder = 'GitHub username';
  elUsername.setAttribute('autocomplete', 'off');
  userRow.appendChild(elUsername);

  // Username clear button (Phase 11, starts hidden)
  elUserClear = document.createElement('button');
  elUserClear.className = 'btn-icon js-user-clear-btn';
  elUserClear.type = 'button';
  elUserClear.setAttribute('aria-label', 'Clear username');
  elUserClear.hidden = true;
  elUserClear.innerHTML = ICON_X;
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
  label.innerHTML = `${ICON_REPO} Repositories`;
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
    // Phase 11: prepend repo octicon SVG
    btn.innerHTML = `${ICON_REPO}<span>${repo.name}</span>`;

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
  label.innerHTML = `${ICON_BRANCH} Branches`;
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
    // Phase 11: prepend branch octicon SVG
    btn.innerHTML = `${ICON_BRANCH}<span>${branch.name}</span>`;

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
    label.innerHTML = `${ICON_REPO} Repositories`;
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
  label.innerHTML = `${ICON_BRANCH} Branches`;
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
