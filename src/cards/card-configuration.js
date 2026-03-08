/**
 * Card 1: Configuration
 *
 * PAT input, username, repo grid, branch grid.
 * Wired to state, GitHub API, and cache.
 *
 * Req IDs: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, APP-04
 */

import { getState, setState, resetDownstream } from '../core/state.js';
import { fetchRepos, fetchBranches, fetchTree } from '../common/github-api.js';
import { cacheGet, cacheSet, cacheClear } from '../common/cache.js';
import {
  renderShimmer,
  renderError,
  showNotification,
  isInteracting,
  expandCard,
} from '../common/components.js';
import { icon } from '../common/icons.js';
import {
  createButton,
  createInputField,
  createPicker,
  createTag,
} from '../common/ui.js';

// --- GL-05: Defer re-render until user is not mid-interaction ---

function deferIfInteracting(fn, maxRetries = 5) {
  if (!isInteracting()) {
    fn();
    return;
  }
  if (maxRetries <= 0) return;
  setTimeout(() => deferIfInteracting(fn, maxRetries - 1), 2000);
}

// --- Module-level UI data ---
let fileTree = [];

/** @returns {Array} current file tree data */
export function getFileTree() {
  return fileTree;
}

/** Update the configuration card .card-meta with current owner/repo/branch (D203) */
export function updateConfigCardMeta() {
  const metaEl = document.querySelector('#card-configuration .card-meta');
  if (!metaEl) return;

  metaEl.textContent = '';
  const state = getState();
  const { owner, repo, branch } = state.configuration;

  if (owner) {
    metaEl.appendChild(icon('mark-github', 'icon-btn'));
    const ownerSpan = document.createElement('span');
    ownerSpan.textContent = owner;
    metaEl.appendChild(ownerSpan);
  }

  if (repo) {
    metaEl.appendChild(icon('repo', 'icon-btn'));
    const repoSpan = document.createElement('span');
    repoSpan.textContent = repo;
    metaEl.appendChild(repoSpan);
  }

  if (branch) {
    metaEl.appendChild(icon('git-branch', 'icon-btn'));
    const branchSpan = document.createElement('span');
    branchSpan.className = 'truncate-start';
    branchSpan.textContent = branch;
    branchSpan.title = branch;
    metaEl.appendChild(branchSpan);
  }
}

// --- DOM references (set during init) ---
let elPatInput,
  elPatToggle,
  elPatClear,
  elUsername,
  elUserClear,
  elRepoSection,
  elBranchSection,
  elCardBody,
  elPatSection,
  elUserSection;

// --- Render static UI shell ---

function renderShell(container) {
  container.innerHTML = '';

  // --- Username (top-left) ---
  elUserSection = createInputField({
    iconName: 'mark-github',
    id: 'cfg-username',
    placeholder: 'GitHub username',
  });
  elUsername = elUserSection._inputEl;

  elUserClear = createButton('icon', {
    iconName: 'x',
    iconClass: 'icon-remove',
    ariaLabel: 'Clear username',
  });
  elUserClear.hidden = true;
  elUserSection.appendChild(elUserClear);

  // --- PAT (top-right) ---
  elPatSection = createInputField({
    type: 'password',
    id: 'cfg-pat',
    iconName: 'key',
    placeholder: 'GitHub personal access token',
  });
  elPatInput = elPatSection._inputEl;

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
  elPatSection.appendChild(elPatToggle);

  elPatClear = createButton('icon', {
    iconName: 'x',
    iconClass: 'icon-remove',
    ariaLabel: 'Clear token',
  });
  elPatClear.hidden = true;
  elPatSection.appendChild(elPatClear);

  // --- Repo (bottom-left) ---
  elRepoSection = document.createElement('div');
  elRepoSection.className = 'field-picker';

  // --- Branch (bottom-right) ---
  elBranchSection = document.createElement('div');
  elBranchSection.className = 'field-picker';

  // Order: username (top-left), PAT (top-right), repo (bottom-left), branch (bottom-right)
  container.appendChild(elUserSection);
  container.appendChild(elPatSection);
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
  resetDownstream('pat');
  // Show credentials again when clearing
  if (elPatSection) elPatSection.hidden = elUserSection.hidden = false;
  renderRepoSection([]);
  renderBranchSection([]);
  updateConfigCardMeta();
  // D502: Return focus to PAT input
  elPatInput.focus();
}

function onUsernameInput() {
  const owner = elUsername.value.trim();
  elUserClear.hidden = owner.length === 0;
}

function onUsernameChange() {
  const owner = elUsername.value.trim();
  setState('configuration.owner', owner);
  updateConfigCardMeta();
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
  resetDownstream('owner');
  if (elPatSection) elPatSection.hidden = elUserSection.hidden = false;
  renderRepoSection([]);
  renderBranchSection([]);
  updateConfigCardMeta();
  // D502: Return focus to username input
  elUsername.focus();
}

// --- Repo picker rendering ---

function renderRepoSection(repos, selectedRepo) {
  elRepoSection.innerHTML = '';
  if (!repos || repos.length === 0) return;

  if (selectedRepo) {
    renderRepoSelection(elRepoSection, selectedRepo, repos);
  } else {
    renderRepoDropdown(elRepoSection, repos);
  }
}

function renderRepoDropdown(pickerWrapper, repos) {
  pickerWrapper.innerHTML = '';

  const pickerItems = repos.map((r) => ({
    value: r.name,
    label: r.name,
    _repoData: r,
  }));

  const picker = createPicker({
    items: pickerItems,
    placeholder: 'Search repositories…',
    searchIconName: 'repo',
    onSelect: (item) => {
      const repo = repos.find((r) => r.name === item.value);
      if (repo) onRepoSelect(repo, repos);
    },
  });

  pickerWrapper.appendChild(picker);
}

function renderRepoSelection(pickerWrapper, selectedRepo, repos) {
  pickerWrapper.innerHTML = '';

  const tag = createTag({
    label: selectedRepo,
    iconName: 'repo',
    onRemove: () => {
      setState((s) => {
        s.configuration.repo = '';
        s.configuration.branch = '';
        return s;
      });
      fileTree = [];
      resetDownstream('repo');
      renderBranchSection([]);
      renderRepoDropdown(pickerWrapper, repos);
      if (elPatSection) elPatSection.hidden = elUserSection.hidden = false;
      updateConfigCardMeta();
      // D502: Focus repo search input for easy re-selection
      pickerWrapper.querySelector('input')?.focus();
    },
  });

  pickerWrapper.appendChild(tag);
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

  // Re-render repo section with selection tag
  renderRepoSection(allRepos, repo.name);
  renderBranchSection([]);
  updateConfigCardMeta();

  if (elPatSection) elPatSection.hidden = elUserSection.hidden = true;

  // Expand Tasks card; Config card stays open (full collapse happens on flow select)
  expandCard('card-tasks');

  // Fetch branches + file tree (CFG-05)
  loadBranches(owner, repo.name, pat, repo.default_branch);
}

// --- Branch picker rendering ---

function renderBranchSection(branches, selectedBranch) {
  elBranchSection.innerHTML = '';
  if (!branches || branches.length === 0) return;

  if (selectedBranch) {
    renderBranchSelection(elBranchSection, selectedBranch, branches);
  } else {
    renderBranchDropdown(elBranchSection, branches);
  }
}

function renderBranchDropdown(pickerWrapper, branches) {
  pickerWrapper.innerHTML = '';

  const pickerItems = branches.map((b) => ({
    value: b.name,
    label: b.name,
  }));

  const picker = createPicker({
    items: pickerItems,
    placeholder: 'Search branches…',
    searchIconName: 'git-branch',
    onSelect: (item) => {
      const branch = branches.find((b) => b.name === item.value);
      if (branch) onBranchSelect(branch, branches);
    },
  });

  pickerWrapper.appendChild(picker);
}

function renderBranchSelection(pickerWrapper, selectedBranch, branches) {
  pickerWrapper.innerHTML = '';

  const tag = createTag({
    label: selectedBranch,
    iconName: 'git-branch',
    onRemove: () => {
      setState('configuration.branch', '');
      fileTree = [];
      resetDownstream('branch');
      renderBranchDropdown(pickerWrapper, branches);
      updateConfigCardMeta();
      // D502: Focus branch search input for easy re-selection
      pickerWrapper.querySelector('input')?.focus();
    },
  });

  pickerWrapper.appendChild(tag);
}

function onBranchSelect(branch, allBranches) {
  setState('configuration.branch', branch.name);
  renderBranchSection(allBranches, branch.name);
  updateConfigCardMeta();

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
    renderShimmer(elRepoSection, 'Loading repositories\u2026', 3);
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
    updateConfigCardMeta();
    loadTreeInBackground(owner, repo, autoSelected, pat);
    loadBranchesBackground(owner, repo, pat, cacheKey, cached);
    return;
  }

  elBranchSection.innerHTML = '';
  renderShimmer(elBranchSection, 'Loading branches\u2026', 2);

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
  updateConfigCardMeta();

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

  // When config card is re-opened, show credentials again (D111: toggle listener)
  const cfgCard = document.getElementById('card-configuration');
  cfgCard?.addEventListener('toggle', () => {
    if (cfgCard.open) {
      if (elPatSection) elPatSection.hidden = elUserSection.hidden = false;
    }
  });

  // Update card-meta with restored state (D203)
  updateConfigCardMeta();

  // Auto-fetch repos on page load if credentials exist (CFG-02)
  if (state.configuration.pat && state.configuration.owner) {
    loadRepos(state.configuration.owner, state.configuration.pat, false);
  }
}
