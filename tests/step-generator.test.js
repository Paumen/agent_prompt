/**
 * Tests for step-generator.js
 * STP-01, STP-02: Step auto-generation, conditional inclusion, reconciliation.
 */

import { describe, it, expect } from 'vitest';
import {
  generateSteps,
  reconcileSteps,
  isSourceFilled,
} from '../src/logic/step-generator.js';

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
    { id: 'identify-cause', operation: 'analyze', object: 'issue', lenses: [] },
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
  ],
};

const REVIEW_FLOW = {
  label: 'Review',
  steps: [
    {
      id: 'read-claude',
      operation: 'read',
      object: 'file',
      params: { file: 'claude.md' },
    },
    {
      id: 'review-pr',
      operation: 'analyze',
      object: 'pull_request',
      source: 'panel_a.pr_number',
      lenses: ['semantics'],
    },
    {
      id: 'provide-feedback',
      operation: 'create',
      object: 'review_feedback',
      source: 'panel_a.pr_number',
      output: ['here', 'pr_comment'],
    },
  ],
};

const REVIEW_FLOW_MULTI = {
  label: 'Review',
  steps: [
    {
      id: 'read-claude',
      operation: 'read',
      object: 'file',
      params: { file: 'claude.md' },
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

describe('isSourceFilled', () => {
  it('returns true for null/undefined source, false for empty fields, true for filled fields', () => {
    expect(isSourceFilled(null, EMPTY_PANEL_A, EMPTY_PANEL_B)).toBe(true);
    expect(isSourceFilled(undefined, EMPTY_PANEL_A, EMPTY_PANEL_B)).toBe(true);

    // Empty fields
    expect(
      isSourceFilled('panel_a.description', EMPTY_PANEL_A, EMPTY_PANEL_B)
    ).toBe(false);
    expect(
      isSourceFilled('panel_a.issue_number', EMPTY_PANEL_A, EMPTY_PANEL_B)
    ).toBe(false);
    expect(isSourceFilled('panel_a.files', EMPTY_PANEL_A, EMPTY_PANEL_B)).toBe(
      false
    );
    expect(
      isSourceFilled(
        'panel_a.description',
        { ...EMPTY_PANEL_A, description: '   ' },
        EMPTY_PANEL_B
      )
    ).toBe(false);

    // Filled fields
    expect(
      isSourceFilled(
        'panel_a.description',
        { ...EMPTY_PANEL_A, description: 'bug' },
        EMPTY_PANEL_B
      )
    ).toBe(true);
    expect(
      isSourceFilled(
        'panel_a.issue_number',
        { ...EMPTY_PANEL_A, issue_number: 42 },
        EMPTY_PANEL_B
      )
    ).toBe(true);
    expect(
      isSourceFilled(
        'panel_a.files',
        { ...EMPTY_PANEL_A, files: ['a.js'] },
        EMPTY_PANEL_B
      )
    ).toBe(true);
    expect(
      isSourceFilled('panel_b.spec_files', EMPTY_PANEL_A, {
        ...EMPTY_PANEL_B,
        spec_files: ['s.md'],
      })
    ).toBe(true);
  });
});

describe('generateSteps', () => {
  it('returns empty for null/undefined/empty flowDef', () => {
    expect(generateSteps(null, EMPTY_PANEL_A, EMPTY_PANEL_B)).toEqual([]);
    expect(generateSteps(undefined, EMPTY_PANEL_A, EMPTY_PANEL_B)).toEqual([]);
    expect(generateSteps({}, EMPTY_PANEL_A, EMPTY_PANEL_B)).toEqual([]);
  });

  it('includes non-conditional steps; picker steps always included; others excluded when empty', () => {
    const steps = generateSteps(FIX_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const ids = steps.map((s) => s.id);

    expect(ids).toContain('read-claude');
    expect(ids).toContain('identify-cause');
    expect(ids).toContain('create-branch');
    // Steps with dedicated pickers always appear regardless of panel state
    expect(ids).toContain('read-location'); // .files source — has file picker
    expect(ids).toContain('read-issue'); // .issue_number source — has issue picker
    // Steps without pickers (e.g. spec_files source) still require panel input
    expect(ids).not.toContain('read-specs');
  });

  it('includes conditional steps when their source fields are filled', () => {
    const panelA = { ...EMPTY_PANEL_A, issue_number: 42, files: ['app.js'] };
    const panelB = { ...EMPTY_PANEL_B, spec_files: ['spec.md'] };
    const steps = generateSteps(FIX_FLOW, panelA, panelB);
    const ids = steps.map((s) => s.id);

    expect(ids).toContain('read-issue');
    expect(ids).toContain('read-location');
    expect(ids).toContain('read-specs');

    // Verify order preserved
    expect(ids.indexOf('read-claude')).toBeLessThan(
      ids.indexOf('read-location')
    );
    expect(ids.indexOf('read-location')).toBeLessThan(
      ids.indexOf('read-issue')
    );
  });

  it('copies step properties (lenses, params, branch_name, pr_name, output)', () => {
    const steps = generateSteps(FIX_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);

    const identifyCause = steps.find((s) => s.id === 'identify-cause');
    expect(identifyCause.lenses).toEqual([]);
    identifyCause.lenses.push('security');
    expect(
      FIX_FLOW.steps.find((s) => s.id === 'identify-cause').lenses
    ).toEqual([]);

    expect(steps.find((s) => s.id === 'read-claude').params).toEqual({
      file: 'claude.md',
    });
    expect(steps.find((s) => s.id === 'create-branch').branch_name).toBe(
      'optional_text'
    );
    expect(steps.find((s) => s.id === 'commit-pr').pr_name).toBe(
      'optional_text'
    );
  });

  it('populates params.files from panel file arrays', () => {
    const panelA = { ...EMPTY_PANEL_A, files: ['a.js', 'b.js'] };
    const panelB = { ...EMPTY_PANEL_B, spec_files: ['spec.md'] };
    const steps = generateSteps(FIX_FLOW, panelA, panelB);

    expect(steps.find((s) => s.id === 'read-location').params.files).toEqual([
      'a.js',
      'b.js',
    ]);
    expect(steps.find((s) => s.id === 'read-specs').params.files).toEqual([
      'spec.md',
    ]);
    expect(
      steps.find((s) => s.id === 'read-issue')?.params?.files
    ).toBeUndefined();
  });

  it('merges consecutive analyze steps into one with sources array and unioned lenses', () => {
    const steps = generateSteps(REVIEW_FLOW_MULTI, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const ids = steps.map((s) => s.id);

    // Merged into one step using first step's id
    expect(ids).toContain('review-pr');
    expect(ids).not.toContain('review-files');

    const merged = steps.find((s) => s.id === 'review-pr');
    expect(merged.sources).toEqual(['panel_a.pr_number', 'panel_a.files']);
    expect(merged._mergedIds).toEqual(['review-pr', 'review-files']);
    // Union of lenses: semantics + structure from first, [] from second
    expect(merged.lenses).toEqual(['semantics', 'structure']);
    // params from both: pr_number (null) and files ([])
    expect(merged.params).toMatchObject({ pr_number: null, files: [] });
  });

  it('merges consecutive review_feedback steps into one with sources array', () => {
    const steps = generateSteps(REVIEW_FLOW_MULTI, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const ids = steps.map((s) => s.id);

    expect(ids).toContain('provide-feedback-pr');
    expect(ids).not.toContain('provide-feedback-files');

    const merged = steps.find((s) => s.id === 'provide-feedback-pr');
    expect(merged.sources).toEqual(['panel_a.pr_number', 'panel_a.files']);
    expect(merged._mergedIds).toEqual(['provide-feedback-pr', 'provide-feedback-files']);
    // Union of output (same in both, so deduped)
    expect(merged.output).toEqual(['here', 'pr_comment']);
  });

  it('does not merge a single analyze step', () => {
    const steps = generateSteps(REVIEW_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const analyzedStep = steps.find((s) => s.id === 'review-pr');

    expect(analyzedStep.sources).toBeUndefined();
    expect(analyzedStep._mergedIds).toBeUndefined();
    expect(analyzedStep.source).toBe('panel_a.pr_number');
  });

  it('handles review flow PR steps — always included, seeded from panel', () => {
    // PR steps have a dedicated picker so they always appear
    const empty = generateSteps(REVIEW_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const emptyIds = empty.map((s) => s.id);
    expect(emptyIds).toContain('review-pr');
    expect(empty.find((s) => s.id === 'review-pr').params.pr_number).toBeNull();

    // When panel has a PR, params.pr_number is seeded from it
    const filled = generateSteps(
      REVIEW_FLOW,
      { ...EMPTY_PANEL_A, pr_number: 5 },
      EMPTY_PANEL_B
    );
    const ids = filled.map((s) => s.id);
    expect(ids).toContain('review-pr');
    expect(ids).toContain('provide-feedback');
    expect(filled.find((s) => s.id === 'review-pr').params.pr_number).toBe(5);
    expect(filled.find((s) => s.id === 'provide-feedback').output).toEqual([
      'here',
      'pr_comment',
    ]);
  });
});

describe('reconcileSteps', () => {
  it('filters removedIds, preserves user modifications, adds new steps', () => {
    const generated = [
      { id: 'read-claude', operation: 'read', object: 'file' },
      {
        id: 'create-branch',
        operation: 'create',
        object: 'branch',
        branch_name: 'optional_text',
      },
      { id: 'analyze', operation: 'analyze', object: 'issue', lenses: [] },
    ];
    const current = [
      { id: 'read-claude', operation: 'read', object: 'file' },
      {
        id: 'create-branch',
        operation: 'create',
        object: 'branch',
        branch_name: 'optional_text',
        name_provided: 'feat/x',
      },
      {
        id: 'analyze',
        operation: 'analyze',
        object: 'issue',
        lenses: ['security'],
      },
    ];

    const result = reconcileSteps(generated, current, ['analyze']);

    expect(result.length).toBe(2);
    expect(result.map((s) => s.id)).toEqual(['read-claude', 'create-branch']);
    expect(result.find((s) => s.id === 'create-branch').name_provided).toBe(
      'feat/x'
    );
  });

  it('preserves outputs_selected and migrates legacy output_selected', () => {
    const generated = [
      {
        id: 'feedback',
        operation: 'create',
        object: 'review_feedback',
        output: ['here', 'pr_comment'],
      },
    ];

    const withArray = reconcileSteps(
      generated,
      [{ ...generated[0], outputs_selected: ['here', 'pr_comment'] }],
      []
    );
    expect(withArray[0].outputs_selected).toEqual(['here', 'pr_comment']);

    const withString = reconcileSteps(
      generated,
      [{ ...generated[0], output_selected: 'pr_comment' }],
      []
    );
    expect(withString[0].outputs_selected).toEqual(['pr_comment']);
  });

  it('handles null currentSteps and adds new steps not in current', () => {
    const generated = [{ id: 'new-step', operation: 'read', object: 'file' }];
    expect(reconcileSteps(generated, null, null)).toEqual(generated);

    const current = [{ id: 'old-step', operation: 'read', object: 'file' }];
    const result = reconcileSteps([...generated, ...current], current, []);
    expect(result.length).toBe(2);
  });
});
