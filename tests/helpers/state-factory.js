/**
 * Centralized mock state factory for tests.
 * Improves maintenance stability by providing a single source of truth
 * for state shape. If the state model evolves, only this file needs updating.
 */

/**
 * Create a mock state object with sensible defaults.
 * All fields can be overridden via the overrides parameter.
 *
 * @param {object} overrides - Partial state to merge with defaults
 * @returns {object} Complete mock state object
 */
export function createMockState(overrides = {}) {
  return {
    version: '1.0',
    configuration: {
      owner: '',
      repo: '',
      branch: '',
      pat: '',
      include_repo: true,
      include_pat: true,
    },
    task: {
      flow_id: '',
    },
    panel_a: {
      description: '',
      issue_number: null,
      pr_number: null,
      files: [],
    },
    panel_b: {
      description: '',
      issue_number: null,
      spec_files: [],
      guideline_files: [],
      acceptance_criteria: '',
      lenses: [],
    },
    steps: {
      enabled_steps: [],
      removed_step_ids: [],
    },
    improve_scope: null,
    notes: {
      user_text: '',
    },
    output: {
      destination: 'clipboard',
    },
    _prompt: '',
    ...overrides,
  };
}

/**
 * Create a fully configured state for testing.
 * Includes valid configuration and a selected flow.
 *
 * @param {object} options - Configuration options
 * @param {string} options.flowId - Flow ID to set (default: 'fix')
 * @param {string} options.owner - Repository owner (default: 'testuser')
 * @param {string} options.repo - Repository name (default: 'testrepo')
 * @param {string} options.branch - Branch name (default: 'main')
 * @param {string} options.pat - Personal access token (default: 'ghp_test')
 * @returns {object} Configured mock state
 */
export function createConfiguredState(options = {}) {
  const {
    flowId = 'fix',
    owner = 'testuser',
    repo = 'testrepo',
    branch = 'main',
    pat = 'ghp_test',
  } = options;

  return createMockState({
    configuration: { owner, repo, branch, pat },
    task: { flow_id: flowId },
  });
}

/**
 * Create mock steps for testing.
 *
 * @param {number} count - Number of steps to generate
 * @returns {array} Array of mock step objects
 */
export function createMockSteps(count = 2) {
  const steps = [
    {
      id: 'read-claude',
      operation: 'read',
      object: 'file',
      params: { file: 'claude.md' },
    },
    {
      id: 'identify-cause',
      operation: 'analyze',
      object: 'issue',
      lenses: ['semantics'],
    },
    {
      id: 'create-branch',
      operation: 'create',
      object: 'branch',
      branch_name: 'optional_text',
    },
    {
      id: 'commit-pr',
      operation: 'commit',
      object: 'changes',
      params: { open_draft_pr: true },
      pr_name: 'optional_text',
    },
  ];

  return steps.slice(0, count);
}

/**
 * Common panel_a configurations for different flows.
 */
export const PANEL_A_PRESETS = {
  fix: {
    description: 'Login crashes when clicking submit',
    issue_number: 42,
    files: ['src/auth.js'],
  },
  review: {
    description: 'Review authentication code',
    pr_number: 101,
    files: ['src/auth.js'],
  },
  implement: {
    description: 'Existing authentication module',
    files: ['src/auth.js'],
  },
  improve: {
    description: 'Slow performance in data processing',
    files: ['src/data.js', 'src/utils.js'],
  },
};

/**
 * Common panel_b configurations for different flows.
 */
export const PANEL_B_PRESETS = {
  fix: {
    description: 'Should redirect to dashboard',
    spec_files: ['spec/auth.md'],
    guideline_files: [],
  },
  review: {
    lenses: ['security', 'performance'],
    spec_files: ['spec/auth.md'],
  },
  implement: {
    description: 'Add OAuth2 authentication',
    acceptance_criteria: 'Users can login with Google',
    spec_files: ['spec/oauth.md'],
  },
  improve: {
    description: 'Optimize data processing',
    lenses: ['performance'],
  },
};
