/**
 * Tests for step-generator.js
 * STP-01, STP-02: Step auto-generation, conditional inclusion, reconciliation.
 */

import { describe, it, expect } from 'vitest';
import {
  generateSteps,
  reconcileSteps,
  isSourceFilled,
} from '../src/js/step-generator.js';

// --- Test data ---

const EMPTY_PANEL_A = {
  description: '',
  issue_number: null,
  pr_number: null,
  files: [],
};

const EMPTY_PANEL_B = {
  description: '',
  issue_number: null,
  spec_files: [],
  guideline_files: [],
  acceptance_criteria: '',
  lenses: [],
};

const FIX_FLOW = {
  label: 'Fix / Debug',
  steps: [
    {
      id: 'read-claude',
      operation: 'read',
      object: 'file',
      params: { file: 'claude.md' },
    },
    {
      id: 'read-location',
      operation: 'read',
      object: 'files',
      source: 'panel_a.files',
    },
    {
      id: 'read-issue',
      operation: 'read',
      object: 'issue',
      source: 'panel_a.issue_number',
    },
    {
      id: 'read-specs',
      operation: 'read',
      object: 'files',
      source: 'panel_b.spec_files',
    },
    {
      id: 'read-guidelines',
      operation: 'read',
      object: 'files',
      source: 'panel_b.guideline_files',
    },
    { id: 'identify-cause', operation: 'analyze', object: 'issue', lenses: [] },
    {
      id: 'create-branch',
      operation: 'create',
      object: 'branch',
      branch_name: 'optional_text',
    },
    { id: 'implement-fix', operation: 'edit', object: 'files', lenses: [] },
    { id: 'run-tests', operation: 'validate', object: 'tests' },
    {
      id: 'commit-pr',
      operation: 'commit',
      object: 'changes',
      params: { open_draft_pr: true },
      pr_name: 'optional_text',
    },
  ],
};

const REVIEW_FLOW = {
  label: 'Review / Analyze',
  steps: [
    {
      id: 'read-claude',
      operation: 'read',
      object: 'file',
      params: { file: 'claude.md' },
    },
    {
      id: 'read-specs',
      operation: 'read',
      object: 'files',
      source: 'panel_b.spec_files',
    },
    {
      id: 'read-guidelines',
      operation: 'read',
      object: 'files',
      source: 'panel_b.guideline_files',
    },
    {
      id: 'review-pr',
      operation: 'analyze',
      object: 'pull_request',
      source: 'panel_a.pr_number',
      lenses: ['semantics', 'structure'],
    },
    {
      id: 'review-files',
      operation: 'analyze',
      object: 'files',
      source: 'panel_a.files',
      lenses: [],
    },
    {
      id: 'provide-feedback-pr',
      operation: 'create',
      object: 'review_feedback',
      source: 'panel_a.pr_number',
      output: ['here', 'pr_comment'],
    },
    {
      id: 'provide-feedback-files',
      operation: 'create',
      object: 'review_feedback',
      source: 'panel_a.files',
      output: ['here', 'pr_comment'],
    },
  ],
};

// --- isSourceFilled tests ---

describe('isSourceFilled', () => {
  it('returns true when source is null/undefined', () => {
    expect(isSourceFilled(null, EMPTY_PANEL_A, EMPTY_PANEL_B)).toBe(true);
    expect(isSourceFilled(undefined, EMPTY_PANEL_A, EMPTY_PANEL_B)).toBe(true);
  });

  it('returns false for empty string field', () => {
    expect(
      isSourceFilled('panel_a.description', EMPTY_PANEL_A, EMPTY_PANEL_B)
    ).toBe(false);
  });

  it('returns true for filled string field', () => {
    const panelA = { ...EMPTY_PANEL_A, description: 'bug description' };
    expect(isSourceFilled('panel_a.description', panelA, EMPTY_PANEL_B)).toBe(
      true
    );
  });

  it('returns false for null number field', () => {
    expect(
      isSourceFilled('panel_a.issue_number', EMPTY_PANEL_A, EMPTY_PANEL_B)
    ).toBe(false);
  });

  it('returns true for filled number field', () => {
    const panelA = { ...EMPTY_PANEL_A, issue_number: 42 };
    expect(isSourceFilled('panel_a.issue_number', panelA, EMPTY_PANEL_B)).toBe(
      true
    );
  });

  it('returns false for empty array field', () => {
    expect(isSourceFilled('panel_a.files', EMPTY_PANEL_A, EMPTY_PANEL_B)).toBe(
      false
    );
  });

  it('returns true for non-empty array field', () => {
    const panelA = { ...EMPTY_PANEL_A, files: ['src/main.js'] };
    expect(isSourceFilled('panel_a.files', panelA, EMPTY_PANEL_B)).toBe(true);
  });

  it('reads panel_b fields correctly', () => {
    const panelB = { ...EMPTY_PANEL_B, spec_files: ['spec.md'] };
    expect(isSourceFilled('panel_b.spec_files', EMPTY_PANEL_A, panelB)).toBe(
      true
    );
  });

  it('returns false for whitespace-only string', () => {
    const panelA = { ...EMPTY_PANEL_A, description: '   ' };
    expect(isSourceFilled('panel_a.description', panelA, EMPTY_PANEL_B)).toBe(
      false
    );
  });
});

// --- generateSteps tests ---

describe('generateSteps', () => {
  it('returns empty array for null/undefined flowDef', () => {
    expect(generateSteps(null, EMPTY_PANEL_A, EMPTY_PANEL_B)).toEqual([]);
    expect(generateSteps(undefined, EMPTY_PANEL_A, EMPTY_PANEL_B)).toEqual([]);
  });

  it('returns empty array for flowDef without steps', () => {
    expect(generateSteps({}, EMPTY_PANEL_A, EMPTY_PANEL_B)).toEqual([]);
  });

  it('includes non-conditional steps with empty panels', () => {
    const steps = generateSteps(FIX_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain('read-claude');
    expect(ids).toContain('identify-cause');
    expect(ids).toContain('create-branch');
    expect(ids).toContain('implement-fix');
    expect(ids).toContain('run-tests');
    expect(ids).toContain('commit-pr');
  });

  it('excludes conditional steps when source fields are empty', () => {
    const steps = generateSteps(FIX_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const ids = steps.map((s) => s.id);
    expect(ids).not.toContain('read-location');
    expect(ids).not.toContain('read-issue');
    expect(ids).not.toContain('read-specs');
    expect(ids).not.toContain('read-guidelines');
  });

  it('includes conditional step when its source field is filled', () => {
    const panelA = { ...EMPTY_PANEL_A, issue_number: 42 };
    const steps = generateSteps(FIX_FLOW, panelA, EMPTY_PANEL_B);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain('read-issue');
  });

  it('includes multiple conditional steps when multiple fields are filled', () => {
    const panelA = {
      ...EMPTY_PANEL_A,
      issue_number: 42,
      files: ['src/app.js'],
    };
    const panelB = { ...EMPTY_PANEL_B, spec_files: ['spec.md'] };
    const steps = generateSteps(FIX_FLOW, panelA, panelB);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain('read-issue');
    expect(ids).toContain('read-location');
    expect(ids).toContain('read-specs');
  });

  it('preserves step order from flow definition', () => {
    const panelA = { ...EMPTY_PANEL_A, issue_number: 1, files: ['a.js'] };
    const panelB = { ...EMPTY_PANEL_B, spec_files: ['s.md'] };
    const steps = generateSteps(FIX_FLOW, panelA, panelB);
    const ids = steps.map((s) => s.id);

    // read-claude should come before read-location, which should come before read-issue
    expect(ids.indexOf('read-claude')).toBeLessThan(
      ids.indexOf('read-location')
    );
    expect(ids.indexOf('read-location')).toBeLessThan(
      ids.indexOf('read-issue')
    );
    expect(ids.indexOf('read-issue')).toBeLessThan(ids.indexOf('read-specs'));
  });

  it('copies lenses array (not reference)', () => {
    const steps = generateSteps(FIX_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const identifyCause = steps.find((s) => s.id === 'identify-cause');
    expect(identifyCause.lenses).toEqual([]);
    // Mutating the copy should not affect original
    identifyCause.lenses.push('security');
    const originalStep = FIX_FLOW.steps.find((s) => s.id === 'identify-cause');
    expect(originalStep.lenses).toEqual([]);
  });

  it('copies params object', () => {
    const steps = generateSteps(FIX_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const readClaude = steps.find((s) => s.id === 'read-claude');
    expect(readClaude.params).toEqual({ file: 'claude.md' });
  });

  it('copies branch_name and pr_name from step definitions', () => {
    const steps = generateSteps(FIX_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const createBranch = steps.find((s) => s.id === 'create-branch');
    expect(createBranch.branch_name).toBe('optional_text');
    const commitPr = steps.find((s) => s.id === 'commit-pr');
    expect(commitPr.pr_name).toBe('optional_text');
  });

  it('copies output array for feedback steps', () => {
    const panelA = { ...EMPTY_PANEL_A, pr_number: 5 };
    const steps = generateSteps(REVIEW_FLOW, panelA, EMPTY_PANEL_B);
    const feedbackPr = steps.find((s) => s.id === 'provide-feedback-pr');
    expect(feedbackPr.output).toEqual(['here', 'pr_comment']);
  });

  it('does not add locked flag to any step', () => {
    const steps = generateSteps(FIX_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    for (const step of steps) {
      expect(step.locked).toBeUndefined();
    }
  });

  it('handles review flow conditional steps (pr_number)', () => {
    // No PR selected — review-pr and provide-feedback-pr should be excluded
    const stepsEmpty = generateSteps(REVIEW_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const idsEmpty = stepsEmpty.map((s) => s.id);
    expect(idsEmpty).not.toContain('review-pr');
    expect(idsEmpty).not.toContain('provide-feedback-pr');

    // PR selected — should be included
    const panelA = { ...EMPTY_PANEL_A, pr_number: 5 };
    const stepsFilled = generateSteps(REVIEW_FLOW, panelA, EMPTY_PANEL_B);
    const idsFilled = stepsFilled.map((s) => s.id);
    expect(idsFilled).toContain('review-pr');
    expect(idsFilled).toContain('provide-feedback-pr');
  });
});

// --- reconcileSteps tests ---

describe('reconcileSteps', () => {
  it('returns all generated steps when no current steps or removedIds', () => {
    const generated = [
      { id: 'read-claude', operation: 'read', object: 'file' },
      { id: 'create-branch', operation: 'create', object: 'branch' },
    ];
    const result = reconcileSteps(generated, [], []);
    expect(result).toEqual(generated);
  });

  it('filters out steps in removedIds', () => {
    const generated = [
      { id: 'read-claude', operation: 'read', object: 'file' },
      { id: 'create-branch', operation: 'create', object: 'branch' },
      { id: 'run-tests', operation: 'validate', object: 'tests' },
    ];
    const result = reconcileSteps(generated, [], ['create-branch']);
    expect(result.map((s) => s.id)).toEqual(['read-claude', 'run-tests']);
  });

  it('preserves user lens modifications from current steps', () => {
    const generated = [
      { id: 'analyze', operation: 'analyze', object: 'issue', lenses: [] },
    ];
    const current = [
      {
        id: 'analyze',
        operation: 'analyze',
        object: 'issue',
        lenses: ['security', 'performance'],
      },
    ];
    const result = reconcileSteps(generated, current, []);
    expect(result[0].lenses).toEqual(['security', 'performance']);
  });

  it('preserves user name_provided from current steps', () => {
    const generated = [
      {
        id: 'create-branch',
        operation: 'create',
        object: 'branch',
        branch_name: 'optional_text',
      },
    ];
    const current = [
      {
        id: 'create-branch',
        operation: 'create',
        object: 'branch',
        branch_name: 'optional_text',
        name_provided: 'feat/new-feature',
      },
    ];
    const result = reconcileSteps(generated, current, []);
    expect(result[0].name_provided).toBe('feat/new-feature');
  });

  it('preserves user output_selected from current steps', () => {
    const generated = [
      {
        id: 'provide-feedback-pr',
        operation: 'create',
        object: 'review_feedback',
        output: ['here', 'pr_comment'],
      },
    ];
    const current = [
      {
        id: 'provide-feedback-pr',
        operation: 'create',
        object: 'review_feedback',
        output: ['here', 'pr_comment'],
        output_selected: 'pr_comment',
      },
    ];
    const result = reconcileSteps(generated, current, []);
    expect(result[0].output_selected).toBe('pr_comment');
  });

  it('adds new steps that were not in current', () => {
    const generated = [
      { id: 'read-claude', operation: 'read', object: 'file' },
      {
        id: 'read-issue',
        operation: 'read',
        object: 'issue',
        source: 'panel_a.issue_number',
      },
    ];
    const current = [{ id: 'read-claude', operation: 'read', object: 'file' }];
    const result = reconcileSteps(generated, current, []);
    expect(result.length).toBe(2);
    expect(result[1].id).toBe('read-issue');
  });

  it('handles null currentSteps gracefully', () => {
    const generated = [{ id: 'step-1', operation: 'read', object: 'file' }];
    const result = reconcileSteps(generated, null, null);
    expect(result.length).toBe(1);
  });

  it('does not include generated steps that are in removedIds even when they are new', () => {
    const generated = [
      { id: 'read-issue', operation: 'read', object: 'issue' },
    ];
    const result = reconcileSteps(generated, [], ['read-issue']);
    expect(result.length).toBe(0);
  });
});
