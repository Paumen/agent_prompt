// @vitest-environment jsdom
/**
 * Tests for quality-meter.js
 * SCT-08: Quality meter scoring, threshold colors, per-flow weights.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateScore,
  getThresholdColor,
  getTotalWeight,
} from '../src/logic/quality-meter.js';

// --- Mock state shapes for each flow ---

function makeState(overrides = {}) {
  return {
    task: { flow_id: '' },
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
    notes: { user_text: '' },
    ...overrides,
  };
}

describe('calculateScore', () => {
  it('returns 0 when no flow is selected', () => {
    const state = makeState({ task: { flow_id: '' } });
    expect(calculateScore(state)).toBe(0);
  });

  it('returns 0 for fix flow with all fields empty', () => {
    const state = makeState({ task: { flow_id: 'fix' } });
    expect(calculateScore(state)).toBe(0);
  });

  it('scores text field filled in fix flow', () => {
    const state = makeState({
      task: { flow_id: 'fix' },
      panel_a: {
        description: 'A bug occurred',
        issue_number: null,
        pr_number: null,
        files: [],
      },
    });
    const score = calculateScore(state);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('scores issue picker in fix flow', () => {
    const empty = makeState({ task: { flow_id: 'fix' } });
    const withIssue = makeState({
      task: { flow_id: 'fix' },
      panel_a: {
        description: '',
        issue_number: 42,
        pr_number: null,
        files: [],
      },
    });
    expect(calculateScore(withIssue)).toBeGreaterThan(calculateScore(empty));
  });

  it('scores file picker in fix flow when files are selected', () => {
    const withFiles = makeState({
      task: { flow_id: 'fix' },
      panel_a: {
        description: '',
        issue_number: null,
        pr_number: null,
        files: ['src/foo.js'],
      },
    });
    expect(calculateScore(withFiles)).toBeGreaterThan(0);
  });

  it('scores PR picker in review flow (highest single weight)', () => {
    const withPR = makeState({
      task: { flow_id: 'review' },
      panel_a: { description: '', issue_number: null, pr_number: 7, files: [] },
    });
    const withFiles = makeState({
      task: { flow_id: 'review' },
      panel_a: {
        description: '',
        issue_number: null,
        pr_number: null,
        files: ['a.js'],
      },
    });
    // PR picker weight (20) > file picker weight (10)
    expect(calculateScore(withPR)).toBeGreaterThan(calculateScore(withFiles));
  });

  it('scores lenses in review flow', () => {
    const noLenses = makeState({ task: { flow_id: 'review' } });
    const withLenses = makeState({
      task: { flow_id: 'review' },
      panel_b: {
        description: '',
        issue_number: null,
        spec_files: [],
        guideline_files: [],
        acceptance_criteria: '',
        lenses: ['semantics'],
      },
    });
    expect(calculateScore(withLenses)).toBeGreaterThan(
      calculateScore(noLenses)
    );
  });

  it('scores notes when filled', () => {
    const noNotes = makeState({ task: { flow_id: 'fix' } });
    const withNotes = makeState({
      task: { flow_id: 'fix' },
      notes: { user_text: 'Important note' },
    });
    expect(calculateScore(withNotes)).toBeGreaterThan(calculateScore(noNotes));
  });

  it('returns 100 when all available fields for fix flow are filled', () => {
    const state = makeState({
      task: { flow_id: 'fix' },
      panel_a: {
        description: 'Bug found',
        issue_number: 1,
        pr_number: null,
        files: ['src/a.js'],
      },
      panel_b: {
        description: 'Expected fix',
        issue_number: null,
        spec_files: ['spec.md'],
        guideline_files: ['guide.md'],
        acceptance_criteria: '',
        lenses: [],
      },
      notes: { user_text: 'Extra notes' },
    });
    expect(calculateScore(state)).toBe(100);
  });

  it('score is always between 0 and 100', () => {
    for (const flowId of ['fix', 'review', 'implement', 'improve']) {
      const empty = makeState({ task: { flow_id: flowId } });
      expect(calculateScore(empty)).toBeGreaterThanOrEqual(0);
      expect(calculateScore(empty)).toBeLessThanOrEqual(100);
    }
  });
});

describe('getTotalWeight', () => {
  it('returns a positive number for each flow', () => {
    for (const flowId of ['fix', 'review', 'implement', 'improve']) {
      expect(getTotalWeight(flowId)).toBeGreaterThan(0);
    }
  });

  it('returns 0 for unknown flow', () => {
    expect(getTotalWeight('unknown')).toBe(0);
  });
});

describe('getThresholdColor', () => {
  it('returns red color for 0%', () => {
    const { color } = getThresholdColor(0);
    expect(color).toBeTruthy();
    expect(typeof color).toBe('string');
  });

  it('returns different colors for different score ranges', () => {
    const low = getThresholdColor(10);
    const mid = getThresholdColor(65);
    const high = getThresholdColor(95);
    // Colors should differ across thresholds
    expect(low.color).not.toBe(high.color);
    expect(mid.color).not.toBe(high.color);
  });

  it('returns the correct labels for score boundaries', () => {
    expect(getThresholdColor(0).label).toBe('Poor');
    expect(getThresholdColor(55).label).toBe('Minimal');
    expect(getThresholdColor(65).label).toBe('Basic');
    expect(getThresholdColor(75).label).toBe('Good');
    expect(getThresholdColor(85).label).toBe('Strong');
    expect(getThresholdColor(95).label).toBe('Excellent');
  });

});
