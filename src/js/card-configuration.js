/**
 * Card 1: Configuration
 *
 * PAT input, username, repo grid, branch grid.
 * Wired to state, GitHub API, and cache.
 *
 * Req IDs: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, APP-04
 */

import { getState, setState } from "./state.js";
import { fetchRepos, fetchBranches, fetchTree } from "./github-api.js";
import { cacheGet, cacheSet, cacheClear } from "./cache.js";
import { renderShimmer, renderError, showNotification } from "./components.js";

// --- Module-level UI data ---
let fileTree = [];

/** @returns {Array} current file tree data */
export function getFileTree() {
  return fileTree;
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
  elCardBody;

// Track collapsed state for repo/branch grids (VIS-03)
let reposCollapsed = false;
let branchesCollapsed = false;

// --- Card expand/collapse helpers ---

function expandCard(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.add("card--open");
  card.querySelector(".card-header")?.setAttribute("aria-expanded", "true");
}

function collapseCard(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.remove("card--open");
  card.querySelector(".card-header")?.setAttribute("aria-expanded", "false");
}

// --- Render static UI shell ---

function renderShell(container) {
  container.innerHTML = "";

  // PAT section
  const patGroup = document.createElement("div");
  patGroup.className = "cfg-field-group";

  const patLabel = document.createElement("label");
  patLabel.className = "field-label";
  patLabel.textContent = "Token";
  patLabel.setAttribute("for", "cfg-pat");

  const patRow = document.createElement("div");
  patRow.className = "cfg-pat-row";

  elPatInput = document.createElement("input");
  elPatInput.type = "password";
  elPatInput.id = "cfg-pat";
  elPatInput.className = "input-field";
  elPatInput.placeholder = "GitHub personal access token";
  elPatInput.setAttribute("autocomplete", "off");

  elPatToggle = document.createElement("button");
  elPatToggle.className = "btn-icon cfg-pat-toggle";
  elPatToggle.type = "button";
  elPatToggle.setAttribute("aria-label", "Show token");
  elPatToggle.textContent = "Show";

  elPatClear = document.createElement("button");
  elPatClear.className = "btn-icon cfg-pat-clear";
  elPatClear.type = "button";
  elPatClear.setAttribute("aria-label", "Clear token");
  elPatClear.textContent = "Clear";

  patRow.appendChild(elPatInput);
  patRow.appendChild(elPatToggle);
  patRow.appendChild(elPatClear);
  patGroup.appendChild(patLabel);
  patGroup.appendChild(patRow);

  // Username section
  const userGroup = document.createElement("div");
  userGroup.className = "cfg-field-group";

  const userLabel = document.createElement("label");
  userLabel.className = "field-label";
  userLabel.textContent = "Username";
  userLabel.setAttribute("for", "cfg-username");

  elUsername = document.createElement("input");
  elUsername.type = "text";
  elUsername.id = "cfg-username";
  elUsername.className = "input-field";
  elUsername.placeholder = "GitHub username";
  elUsername.setAttribute("autocomplete", "off");

  userGroup.appendChild(userLabel);
  userGroup.appendChild(elUsername);

  // Repo section
  elRepoSection = document.createElement("div");
  elRepoSection.className = "cfg-section cfg-section--repos";

  // Branch section
  elBranchSection = document.createElement("div");
  elBranchSection.className = "cfg-section cfg-section--branches";

  container.appendChild(patGroup);
  container.appendChild(userGroup);
  container.appendChild(elRepoSection);
  container.appendChild(elBranchSection);
}

// --- Event handlers ---

function onPatInput() {
  const pat = elPatInput.value.trim();
  setState("configuration.pat", pat);
}

function onPatChange() {
  const pat = elPatInput.value.trim();
  if (!pat) return;
  // PAT changed — flush cache and re-fetch
  cacheClear();
  const owner = getState().configuration.owner;
  if (owner) loadRepos(owner, pat, false);
}

function onPatToggle() {
  const isPassword = elPatInput.type === "password";
  elPatInput.type = isPassword ? "text" : "password";
  elPatToggle.textContent = isPassword ? "Hide" : "Show";
  elPatToggle.setAttribute(
    "aria-label",
    isPassword ? "Hide token" : "Show token",
  );
}

function onPatClear() {
  elPatInput.value = "";
  elPatInput.type = "password";
  elPatToggle.textContent = "Show";
  cacheClear();
  setState(s => {
    s.configuration.pat = "";
    s.configuration.repo = "";
    s.configuration.branch = "";
    return s;
  });
  fileTree = [];
  renderRepoSection([]);
  renderBranchSection([]);
}

function onUsernameChange() {
  const owner = elUsername.value.trim();
  setState("configuration.owner", owner);
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
  elRepoSection.innerHTML = "";
  if (!repos || repos.length === 0) return;

  const label = document.createElement("div");
  label.className = "cfg-section-label";
  label.textContent = "Repositories";
  elRepoSection.appendChild(label);

  elRepoGrid = document.createElement("div");
  elRepoGrid.className = "btn-grid";
  elRepoGrid.setAttribute("role", "listbox");
  elRepoGrid.setAttribute("aria-label", "Repositories");

  renderRepoButtons(repos, selectedRepo);
  elRepoSection.appendChild(elRepoGrid);
}

function renderRepoButtons(repos, selectedRepo) {
  if (!elRepoGrid) return;
  elRepoGrid.innerHTML = "";
  reposCollapsed = !!selectedRepo;

  const visibleRepos =
    selectedRepo && reposCollapsed
      ? repos.filter((r) => r.name === selectedRepo)
      : repos;

  for (const repo of visibleRepos) {
    const btn = document.createElement("button");
    btn.className = "btn-grid-item";
    btn.type = "button";
    btn.textContent = repo.name;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(repo.name === selectedRepo));
    if (repo.name === selectedRepo) btn.classList.add("item-selected");

    btn.addEventListener("click", () => onRepoSelect(repo, repos));
    elRepoGrid.appendChild(btn);
  }

  // "Show more" / "Change" button when collapsed
  if (selectedRepo && repos.length > 1) {
    const moreBtn = document.createElement("button");
    moreBtn.className = "btn-grid-item cfg-show-more";
    moreBtn.type = "button";
    moreBtn.textContent = reposCollapsed ? `+${repos.length - 1} more` : "Less";
    moreBtn.addEventListener("click", () => {
      reposCollapsed = !reposCollapsed;
      renderRepoButtons(repos, selectedRepo);
    });
    elRepoGrid.appendChild(moreBtn);
  }
}

function onRepoSelect(repo, allRepos) {
  const state = getState();
  const { owner, pat } = state.configuration;

  setState(s => {
    s.configuration.repo = repo.name;
    s.configuration.branch = "";
    return s;
  });
  fileTree = [];

  // Re-render repos collapsed (VIS-03)
  renderRepoButtons(allRepos, repo.name);
  renderBranchSection([]);

  // Fetch branches + file tree (CFG-05)
  loadBranches(owner, repo.name, pat, repo.default_branch);

  // Expand Tasks card, collapse Config (UJ table)
  expandCard("card-tasks");
  collapseCard("card-configuration");
}

// --- Branch grid rendering ---

function renderBranchSection(branches, selectedBranch) {
  elBranchSection.innerHTML = "";
  if (!branches || branches.length === 0) return;

  const label = document.createElement("div");
  label.className = "cfg-section-label";
  label.textContent = "Branches";
  elBranchSection.appendChild(label);

  elBranchGrid = document.createElement("div");
  elBranchGrid.className = "btn-grid";
  elBranchGrid.setAttribute("role", "listbox");
  elBranchGrid.setAttribute("aria-label", "Branches");

  renderBranchButtons(branches, selectedBranch);
  elBranchSection.appendChild(elBranchGrid);
}

function renderBranchButtons(branches, selectedBranch) {
  if (!elBranchGrid) return;
  elBranchGrid.innerHTML = "";
  branchesCollapsed = !!selectedBranch;

  const visibleBranches =
    selectedBranch && branchesCollapsed
      ? branches.filter((b) => b.name === selectedBranch)
      : branches;

  for (const branch of visibleBranches) {
    const btn = document.createElement("button");
    btn.className = "btn-grid-item";
    btn.type = "button";
    btn.textContent = branch.name;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(branch.name === selectedBranch));
    if (branch.name === selectedBranch) btn.classList.add("item-selected");

    btn.addEventListener("click", () => onBranchSelect(branch, branches));
    elBranchGrid.appendChild(btn);
  }

  if (selectedBranch && branches.length > 1) {
    const moreBtn = document.createElement("button");
    moreBtn.className = "btn-grid-item cfg-show-more";
    moreBtn.type = "button";
    moreBtn.textContent = branchesCollapsed
      ? `+${branches.length - 1} more`
      : "Less";
    moreBtn.addEventListener("click", () => {
      branchesCollapsed = !branchesCollapsed;
      renderBranchButtons(branches, selectedBranch);
    });
    elBranchGrid.appendChild(moreBtn);
  }
}

function onBranchSelect(branch, allBranches) {
  setState("configuration.branch", branch.name);
  renderBranchButtons(allBranches, branch.name);

  // Reload file tree on branch change (UJ table)
  const state = getState();
  const { owner, repo, pat } = state.configuration;
  if (owner && repo && pat) {
    loadTreeInBackground(owner, repo, branch.name, pat);
  }
}

// --- Data loading with cache + background refresh (GL-05) ---

async function loadRepos(owner, pat, isBackground = false) {
  const cacheKey = `repos_${owner}`;

  // Show cached data immediately if available
  const cached = cacheGet(cacheKey);
  if (cached && !isBackground) {
    renderRepoSection(cached, getState().configuration.repo);
    // Background refresh
    loadRepos(owner, pat, true);
    return;
  }

  // Show shimmer only on initial load (not background)
  if (!isBackground) {
    elRepoSection.innerHTML = "";
    const label = document.createElement("div");
    label.className = "cfg-section-label";
    label.textContent = "Repositories";
    elRepoSection.appendChild(label);
    const shimmerContainer = document.createElement("div");
    elRepoSection.appendChild(shimmerContainer);
    renderShimmer(shimmerContainer, "Loading repositories\u2026", 3);
  }

  const result = await fetchRepos(owner, pat);

  if (result.error) {
    if (!isBackground) {
      elRepoSection.innerHTML = "";
      renderError(elRepoSection, result.error, () =>
        loadRepos(owner, pat, false),
      );
    }
    return;
  }

  cacheSet(cacheKey, result.data);

  if (isBackground && cached) {
    // Check if data actually changed
    const changed =
      JSON.stringify(result.data.map((r) => r.name)) !==
      JSON.stringify(cached.map((r) => r.name));
    if (changed) {
      renderRepoSection(result.data, getState().configuration.repo);
      showNotification(elRepoSection, "Updated", "success");
    }
    return;
  }

  renderRepoSection(result.data, getState().configuration.repo);

  if (result.warning) {
    showNotification(elRepoSection, result.warning, "info");
  }
}

async function loadBranches(owner, repo, pat, defaultBranch) {
  const cacheKey = `branches_${owner}_${repo}`;

  // Show cached data immediately
  const cached = cacheGet(cacheKey);
  if (cached) {
    const autoSelected = defaultBranch || cached[0]?.name || "";
    setState("configuration.branch", autoSelected);
    renderBranchSection(cached, autoSelected);
    // Load file tree for auto-selected branch
    loadTreeInBackground(owner, repo, autoSelected, pat);
    // Background refresh branches
    loadBranchesBackground(owner, repo, pat, cacheKey, cached);
    return;
  }

  // Shimmer
  elBranchSection.innerHTML = "";
  const label = document.createElement("div");
  label.className = "cfg-section-label";
  label.textContent = "Branches";
  elBranchSection.appendChild(label);
  const shimmerContainer = document.createElement("div");
  elBranchSection.appendChild(shimmerContainer);
  renderShimmer(shimmerContainer, "Loading branches\u2026", 2);

  const result = await fetchBranches(owner, repo, pat);

  if (result.error) {
    elBranchSection.innerHTML = "";
    renderError(elBranchSection, result.error, () =>
      loadBranches(owner, repo, pat, defaultBranch),
    );
    return;
  }

  cacheSet(cacheKey, result.data);

  // Auto-select default branch (CFG-04)
  const match = result.data.find((b) => b.name === defaultBranch);
  const autoSelected = match ? match.name : result.data[0]?.name || "";
  setState("configuration.branch", autoSelected);
  renderBranchSection(result.data, autoSelected);

  // Load file tree in background (CFG-05)
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
    const selected = getState().configuration.branch;
    renderBranchSection(result.data, selected);
    showNotification(elBranchSection, "Updated", "success");
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
  elCardBody = document.getElementById("bd-configuration");
  if (!elCardBody) return;

  renderShell(elCardBody);

  // Pre-fill from state
  const state = getState();
  elPatInput.value = state.configuration.pat;
  elUsername.value = state.configuration.owner;

  // Wire events
  elPatInput.addEventListener("input", onPatInput);
  elPatInput.addEventListener("change", onPatChange);
  elPatToggle.addEventListener("click", onPatToggle);
  elPatClear.addEventListener("click", onPatClear);
  elUsername.addEventListener("change", onUsernameChange);

  // Auto-fetch repos on page load if credentials exist (CFG-02)
  if (state.configuration.pat && state.configuration.owner) {
    loadRepos(state.configuration.owner, state.configuration.pat, false);
  }
}
