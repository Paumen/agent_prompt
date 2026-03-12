/**
 * Task data service — prefetch and cache GitHub PRs/issues for flows.
 *
 * Stripped from the former Card 2 (Task) UI module.
 * Steps card imports getCachedIssues/getCachedPRs from here.
 */

import { getState } from '../core/state.js';
import { fetchPRs, fetchIssues } from '../common/github-api.js';
import { cacheGet, cacheSet } from '../common/cache.js';

// --- Module-level cache state ---

let cachedPRs = null;
let cachedIssues = null;

// --- Public exports ---

/** @returns {Array} cached issues list (empty if not yet loaded) */
export function getCachedIssues() {
  return cachedIssues || [];
}

/** @returns {Array} cached PRs list (empty if not yet loaded) */
export function getCachedPRs() {
  return cachedPRs || [];
}

/** Prefetch PRs and issues needed by the given flow definition. */
export function prefetchForFlow(flowDef) {
  if (requiresPRs(flowDef)) prefetchPRs();
  if (requiresIssues(flowDef)) prefetchIssues();
}

// --- GitHub data fetching ---

function requiresPRs(flowDef) {
  if (hasFieldOfType(flowDef, 'pr_picker')) return true;
  return hasStepSource(flowDef, '.pr_number');
}

function requiresIssues(flowDef) {
  if (hasFieldOfType(flowDef, 'issue_picker')) return true;
  return hasStepSource(flowDef, '.issue_number');
}

function hasStepSource(flowDef, suffix) {
  return (
    flowDef.steps?.some((s) => {
      if (s.source?.endsWith(suffix)) return true;
      if (Array.isArray(s.sources))
        return s.sources.some((src) => src.endsWith(suffix));
      return false;
    }) ?? false
  );
}

function hasFieldOfType(flowDef, type) {
  for (const panel of [flowDef.panel_a, flowDef.panel_b]) {
    if (!panel?.fields) continue;
    for (const fieldDef of Object.values(panel.fields)) {
      if (fieldDef.type === type) return true;
    }
  }
  return false;
}

async function prefetchPRs() {
  const { owner, repo, pat } = getState().configuration;
  if (!owner || !repo || !pat) return;

  const cacheKey = `prs_${owner}_${repo}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    cachedPRs = cached;
    return;
  }

  const result = await fetchPRs(owner, repo, pat);

  if (!result.error) {
    cachedPRs = result.data;
    cacheSet(cacheKey, result.data);
  } else {
    cachedPRs = [];
  }
}

async function prefetchIssues() {
  const { owner, repo, pat } = getState().configuration;
  if (!owner || !repo || !pat) return;

  const cacheKey = `issues_${owner}_${repo}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    cachedIssues = cached;
    return;
  }

  const result = await fetchIssues(owner, repo, pat);

  if (!result.error) {
    cachedIssues = result.data;
    cacheSet(cacheKey, result.data);
  } else {
    cachedIssues = [];
  }
}
