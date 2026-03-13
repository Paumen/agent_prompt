// @vitest-environment jsdom
/**
 * Tests for card-tasks.js (data-only module)
 *
 * Tests the prefetch + cache exports used by card-steps.js.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockState } from "./helpers/state-factory.js";

// --- Mock dependencies ---

vi.mock("../src/core/state.js", () => ({
  getState: vi.fn(() => createMockState()),
}));

vi.mock("../src/common/github-api.js", () => ({
  fetchPRs: vi.fn(() => Promise.resolve({ data: [], error: null })),
  fetchIssues: vi.fn(() => Promise.resolve({ data: [], error: null })),
}));

vi.mock("../src/common/cache.js", () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

vi.mock("../src/logic/flow-loader.js", () => ({
  getFlowById: vi.fn(() => null),
}));

import {
  getCachedIssues,
  getCachedPRs,
  prefetchForFlow,
} from "../src/cards/card-tasks.js";
import { getState } from "../src/core/state.js";
import { fetchPRs, fetchIssues } from "../src/common/github-api.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCachedIssues / getCachedPRs", () => {
  it("returns empty array when nothing cached", () => {
    expect(getCachedIssues()).toEqual([]);
    expect(getCachedPRs()).toEqual([]);
  });
});

describe("prefetchForFlow", () => {
  it("fetches PRs when flow has pr_picker field", async () => {
    getState.mockReturnValue(
      createMockState({
        configuration: { owner: "user", repo: "repo", pat: "ghp_test" },
      }),
    );

    const flowDef = {
      panel_a: { fields: { pr_number: { type: "pr_picker" } } },
      panel_b: { fields: {} },
      steps: [],
    };

    prefetchForFlow(flowDef);
    expect(fetchPRs).toHaveBeenCalled();
  });

  it("fetches issues when flow has issue_picker field", async () => {
    getState.mockReturnValue(
      createMockState({
        configuration: { owner: "user", repo: "repo", pat: "ghp_test" },
      }),
    );

    const flowDef = {
      panel_a: { fields: { issue_number: { type: "issue_picker" } } },
      panel_b: { fields: {} },
      steps: [],
    };

    prefetchForFlow(flowDef);
    expect(fetchIssues).toHaveBeenCalled();
  });

  it("does not fetch when flow has no picker fields", () => {
    const flowDef = {
      panel_a: { fields: { description: { type: "text" } } },
      panel_b: { fields: {} },
      steps: [],
    };

    prefetchForFlow(flowDef);
    expect(fetchPRs).not.toHaveBeenCalled();
    expect(fetchIssues).not.toHaveBeenCalled();
  });
});
