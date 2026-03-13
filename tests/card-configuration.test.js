// @vitest-environment jsdom
/**
 * Tests for card-configuration.js
 *
 * Tests UI behaviors specific to configuration card:
 * - PAT show/hide toggle
 * - Clear button behaviors
 * - Error handling with retry
 * - Button visibility states
 *
 * Integration flows (repo selection → prompt generation) are tested in e2e.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupConfigurationCard, cleanupDOM } from "./helpers/dom-fixtures.js";

// --- Mock helpers ---

const mockFetch = (response, ok = true, status = 200) =>
  vi
    .fn()
    .mockResolvedValue({ ok, status, json: () => Promise.resolve(response) });

const SAMPLE_REPOS = [
  { name: "alpha", default_branch: "main" },
  { name: "beta", default_branch: "develop" },
  { name: "gamma", default_branch: "main" },
];

const SAMPLE_BRANCHES = [{ name: "main" }, { name: "develop" }];

let cardConfig, state;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  setupConfigurationCard();
  globalThis.fetch = mockFetch([]);

  // Mock flow-loader (YAML import not available in vitest)
  vi.doMock("../src/logic/flow-loader.js", () => ({
    getFlows: () => ({
      fix: {
        label: "Debug",
        icon: "bug",
        panel_a: {
          label: "Current State",
          fields: { description: { type: "text" } },
        },
        panel_b: {
          label: "Expected Outcome",
          fields: { description: { type: "text" } },
        },
        steps: [],
      },
      review: {
        label: "Review",
        icon: "code-review",
        panel_a: { label: "PR Context", fields: {} },
        panel_b: { label: "Review Focus", fields: {} },
        steps: [],
      },
      implement: {
        label: "Implement",
        icon: "plus",
        panel_a: { label: "Requirements", fields: {} },
        panel_b: { label: "Constraints", fields: {} },
        steps: [],
      },
      improve: {
        label: "Refactor",
        icon: "sync",
        panel_a: { label: "Current Code", fields: {} },
        panel_b: { label: "Goal", fields: {} },
        steps: [],
      },
    }),
    getFlowById: vi.fn(() => null),
  }));

  state = await import("../src/core/state.js");
  cardConfig = await import("../src/cards/card-configuration.js");
});

afterEach(() => {
  cleanupDOM();
  localStorage.clear();
  vi.restoreAllMocks();
});

// --- Tests ---

describe("PAT field UI (CFG-01)", () => {
  it("show/hide toggle changes input type", () => {
    cardConfig.initConfigurationCard();
    const pat = document.getElementById("cfg-pat");
    const toggle = document.querySelector('[aria-label="Show token"]');

    pat.value = "tok";
    pat.dispatchEvent(new Event("input"));

    toggle.click();
    expect(pat.type).toBe("text");

    toggle.click();
    expect(pat.type).toBe("password");
  });

  it("eye and clear buttons hidden when PAT empty, shown when filled", () => {
    cardConfig.initConfigurationCard();
    const eyeBtn = document.querySelector('[aria-label="Show token"]');
    const clearBtn = document.querySelector('[aria-label="Clear token"]');

    expect(eyeBtn.hasAttribute("hidden")).toBe(true);
    expect(clearBtn.hasAttribute("hidden")).toBe(true);

    const pat = document.getElementById("cfg-pat");
    pat.value = "tok_123";
    pat.dispatchEvent(new Event("input"));

    expect(eyeBtn.hasAttribute("hidden")).toBe(false);
    expect(clearBtn.hasAttribute("hidden")).toBe(false);
  });

  it("clear button resets PAT, repo, branch, and file tree", () => {
    state.setState("configuration.pat", "tok");
    state.setState("configuration.repo", "my-repo");
    state.setState("configuration.branch", "main");
    cardConfig.initConfigurationCard();

    document.querySelector('[aria-label="Clear token"]').click();

    expect(document.getElementById("cfg-pat").value).toBe("");
    expect(state.getState().configuration.pat).toBe("");
    expect(state.getState().configuration.repo).toBe("");
    expect(state.getState().configuration.branch).toBe("");
    expect(cardConfig.getFileTree()).toEqual([]);
  });

  it("username clear button clears owner, repo, branch state", async () => {
    state.setState("configuration.pat", "tok");
    state.setState("configuration.owner", "alice");
    state.setState("configuration.repo", "my-repo");
    state.setState("configuration.branch", "main");
    globalThis.fetch = mockFetch(SAMPLE_REPOS);
    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      expect(document.querySelector(".field-picker")).not.toBeNull();
    });

    document.querySelector('[aria-label="Clear username"]').click();

    expect(state.getState().configuration.owner).toBe("");
    expect(state.getState().configuration.repo).toBe("");
    expect(state.getState().configuration.branch).toBe("");
  });
});

describe("Error handling (GL-04)", () => {
  it("shows inline error on fetch failure with retry button", async () => {
    state.setState("configuration.pat", "tok");
    state.setState("configuration.owner", "alice");
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: "Bad credentials" }),
    });

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      expect(document.querySelector(".error-inline")).not.toBeNull();
      expect(document.querySelector(".btn-retry")).not.toBeNull();
    });
  });
});

describe("Branch auto-select (CFG-04)", () => {
  it("auto-selects default branch on repo selection", async () => {
    state.setState("configuration.pat", "tok");
    state.setState("configuration.owner", "alice");

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(callCount === 1 ? SAMPLE_REPOS : SAMPLE_BRANCHES),
      });
    });

    cardConfig.initConfigurationCard();

    await vi.waitFor(() => {
      const searchInput = document.querySelector(".field-picker .input-field");
      expect(searchInput).not.toBeNull();
      searchInput.dispatchEvent(new Event("focus"));
      expect(
        document.querySelectorAll(".field-picker .field-picker-item").length,
      ).toBe(3);
    });

    document.querySelector(".field-picker .field-picker-item").click();

    await vi.waitFor(() => {
      expect(state.getState().configuration.branch).toBe("main");
    });
  });
});
