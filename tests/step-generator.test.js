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
      id: 'context',
      operation: 'read',
      object: 'file',
      params: { file: 'claude.md' },
    },
    {
      id: 'read',
      operation: 'read',
      object: 'files',
      sources: ['panel_a.files', 'panel_a.issue_number', 'panel_b.spec_files'],
    },
    { id: 'analyze', operation: 'analyze', object: 'issue', lenses: [] },
    { id: 'plan', operation: 'create', object: 'plan' },
    { id: 'implement', operation: 'edit', object: 'files' },
    { id: 'test', operation: 'validate', object: 'tests' },
    {
      id: 'commit',
      operation: 'commit',
      object: 'changes',
      params: { open_draft_pr: true },
      branch_name: 'optional_text',
      pr_name: 'optional_text',
    },
  ],
};

const REVIEW_FLOW = {
  label: 'Review',
  steps: [
    {
      id: 'context',
      operation: 'read',
      object: 'file',
      params: { file: 'claude.md' },
    },
    {
      id: 'read',
      operation: 'read',
      object: 'files',
      sources: ['panel_a.pr_number', 'panel_a.files', 'panel_b.spec_files'],
    },
    {
      id: 'analyze',
      operation: 'analyze',
      object: 'code',
      lenses: ['semantics', 'structure'],
    },
    {
      id: 'report',
      operation: 'create',
      object: 'review_feedback',
      output: [
        'here',
        'pr_comment',
        'pr_inline_comments',
        'issue_comment',
        'report_file',
      ],
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

  it('generates all generic steps for fix flow', () => {
    const steps = generateSteps(FIX_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const ids = steps.map((s) => s.id);

    expect(ids).toEqual([
      'context',
      'read',
      'analyze',
      'plan',
      'implement',
      'test',
      'commit',
    ]);
  });

  it('generates subset of steps for review flow', () => {
    const steps = generateSteps(REVIEW_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const ids = steps.map((s) => s.id);

    expect(ids).toEqual(['context', 'read', 'analyze', 'report']);
  });

  it('populates read step with sources, file picker, and issue picker', () => {
    const steps = generateSteps(FIX_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const readStep = steps.find((s) => s.id === 'read');

    expect(readStep.sources).toEqual([
      'panel_a.files',
      'panel_a.issue_number',
      'panel_b.spec_files',
    ]);
    expect(readStep.has_file_picker).toBe(true);
    expect(readStep.has_issue_picker).toBe(true);
    expect(readStep.params.files).toEqual([]);
    expect(readStep.params.issues).toEqual([]);
  });

  it('aggregates files and issues from panel data into read step', () => {
    const panelA = {
      ...EMPTY_PANEL_A,
      issue_number: 42,
      files: ['a.js', 'b.js'],
    };
    const panelB = { ...EMPTY_PANEL_B, spec_files: ['spec.md'] };
    const steps = generateSteps(FIX_FLOW, panelA, panelB);
    const readStep = steps.find((s) => s.id === 'read');

    expect(readStep.params.files).toContain('a.js');
    expect(readStep.params.files).toContain('b.js');
    expect(readStep.params.files).toContain('spec.md');
    expect(readStep.params.issues).toEqual([42]);
  });

  it('populates PR number in review flow read step', () => {
    const panelA = { ...EMPTY_PANEL_A, pr_number: 5 };
    const steps = generateSteps(REVIEW_FLOW, panelA, EMPTY_PANEL_B);
    const readStep = steps.find((s) => s.id === 'read');

    expect(readStep.params.pr_number).toBe(5);
    expect(readStep.has_file_picker).toBe(true);
  });

  it('copies step properties (lenses, params, branch_name, pr_name, output)', () => {
    const steps = generateSteps(FIX_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);

    const analyze = steps.find((s) => s.id === 'analyze');
    expect(analyze.lenses).toEqual([]);
    // Verify immutability — mutating result doesn't affect source
    analyze.lenses.push('security');
    expect(FIX_FLOW.steps.find((s) => s.id === 'analyze').lenses).toEqual([]);

    const commit = steps.find((s) => s.id === 'commit');
    expect(commit.branch_name).toBe('optional_text');
    expect(commit.pr_name).toBe('optional_text');
  });

  it('preserves output modes on report step', () => {
    const steps = generateSteps(REVIEW_FLOW, EMPTY_PANEL_A, EMPTY_PANEL_B);
    const report = steps.find((s) => s.id === 'report');
    expect(report.output).toEqual([
      'here',
      'pr_comment',
      'pr_inline_comments',
      'issue_comment',
      'report_file',
    ]);
  });

  it('handles conditional non-picker sources (spec_files only appear when filled)', () => {
    // A flow with only a non-picker source should not appear when empty
    const conditionalFlow = {
      label: 'Test',
      steps: [
        {
          id: 'read',
          operation: 'read',
          object: 'files',
          sources: ['panel_b.spec_files'],
        },
      ],
    };

    // Empty spec_files → step still skipped (no picker source)
    const empty = generateSteps(conditionalFlow, EMPTY_PANEL_A, EMPTY_PANEL_B);
    expect(empty).toEqual([]);

    // Filled spec_files → step appears
    const filled = generateSteps(conditionalFlow, EMPTY_PANEL_A, {
      ...EMPTY_PANEL_B,
      spec_files: ['spec.md'],
    });
    expect(filled.length).toBe(1);
    expect(filled[0].params.files).toContain('spec.md');
  });
});

describe('reconcileSteps', () => {
  it('filters removedIds, preserves user modifications, adds new steps', () => {
    const generated = [
      { id: 'context', operation: 'read', object: 'file' },
      {
        id: 'commit',
        operation: 'commit',
        object: 'changes',
        branch_name: 'optional_text',
      },
      { id: 'analyze', operation: 'analyze', object: 'issue', lenses: [] },
    ];
    const current = [
      { id: 'context', operation: 'read', object: 'file' },
      {
        id: 'commit',
        operation: 'commit',
        object: 'changes',
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
    expect(result.map((s) => s.id)).toEqual(['context', 'commit']);
    expect(result.find((s) => s.id === 'commit').name_provided).toBe('feat/x');
  });

  it('preserves outputs_selected and migrates legacy output_selected', () => {
    const generated = [
      {
        id: 'report',
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
