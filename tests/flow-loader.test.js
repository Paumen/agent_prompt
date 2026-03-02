import { describe, it, expect } from 'vitest';
import { getFlows, getFlowById, getFlowIds } from '../src/js/flow-loader.js';
import { validateFlows } from '../config/flow-schema.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const flowsPath = resolve(import.meta.dirname, '../src/config/flows.yaml');
const rawYaml = readFileSync(flowsPath, 'utf-8');
const parsedFlows = yaml.load(rawYaml);

describe('flow-loader.js', () => {
  it('returns all 4 flows with correct structure', () => {
    const flows = getFlows();
    expect(flows).toHaveProperty('fix');
    expect(flows).toHaveProperty('review');
    expect(flows).toHaveProperty('implement');
    expect(flows).toHaveProperty('improve');
  });

  it('getFlowById returns flow or null for unknown', () => {
    expect(getFlowById('fix').label).toBe('Fix / Debug');
    expect(getFlowById('review').label).toBe('Review / Analyze');
    expect(getFlowById('implement').label).toBe('Implement / Build');
    expect(getFlowById('improve').label).toBe('Improve / Modify');
    expect(getFlowById('nonexistent')).toBe(null);
    expect(getFlowById('')).toBe(null);
  });

  it('getFlowIds returns all flow IDs', () => {
    const ids = getFlowIds();
    expect(ids).toContain('fix');
    expect(ids).toContain('review');
    expect(ids).toContain('implement');
    expect(ids).toContain('improve');
  });

  it('each flow has required structure (panels, steps, fields)', () => {
    const flows = getFlows();
    for (const [id, flow] of Object.entries(flows)) {
      // Panels
      expect(flow.panel_a, `${id} panel_a`).toBeDefined();
      expect(flow.panel_a.label).toBeTruthy();
      expect(flow.panel_a.fields).toBeDefined();
      expect(flow.panel_b, `${id} panel_b`).toBeDefined();
      expect(flow.panel_b.label).toBeTruthy();
      expect(flow.panel_b.fields).toBeDefined();

      // Steps
      expect(Array.isArray(flow.steps)).toBe(true);
      expect(flow.steps.length).toBeGreaterThan(0);
      for (const step of flow.steps) {
        expect(step.id).toBeTruthy();
        expect(step.operation).toBeTruthy();
        expect(step.object).toBeTruthy();
      }
    }
  });

  it('flow-specific fields exist', () => {
    expect(getFlowById('fix').panel_a.fields).toHaveProperty('issue_number');
    expect(getFlowById('review').panel_a.fields).toHaveProperty('pr_number');
    expect(getFlowById('implement').panel_b.fields).toHaveProperty(
      'acceptance_criteria'
    );
    expect(getFlowById('improve').panel_b.fields).toHaveProperty('lenses');
    expect(getFlowById('improve').multi_file.scope_selector).toBeDefined();
  });
});

describe('flow-schema validation', () => {
  it('current flows.yaml passes validation', () => {
    const result = validateFlows(parsedFlows);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects null/missing flows/empty flows', () => {
    expect(validateFlows(null).valid).toBe(false);
    expect(validateFlows({ notflows: {} }).valid).toBe(false);
    expect(validateFlows({ flows: {} }).valid).toBe(false);
  });

  it('rejects flow missing required fields', () => {
    const result = validateFlows({
      flows: {
        test: {
          icon: 'bug',
          panel_a: { label: 'A', subtitle: 'SA', fields: {} },
          panel_b: { label: 'B', subtitle: 'SB', fields: {} },
          steps: [{ id: 's1', operation: 'read', object: 'file' }],
        },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing "label"'))).toBe(true);
  });

  it('rejects invalid icon/operation/field type', () => {
    const base = {
      label: 'Test',
      panel_a: { label: 'A', subtitle: 'SA', fields: {} },
      panel_b: { label: 'B', subtitle: 'SB', fields: {} },
      steps: [{ id: 's1', operation: 'read', object: 'file' }],
    };

    expect(
      validateFlows({ flows: { t: { ...base, icon: 'bad' } } }).valid
    ).toBe(false);
    expect(
      validateFlows({
        flows: {
          t: {
            ...base,
            icon: 'bug',
            steps: [{ id: 's1', operation: 'fly', object: 'x' }],
          },
        },
      }).valid
    ).toBe(false);
    expect(
      validateFlows({
        flows: {
          t: {
            ...base,
            icon: 'bug',
            panel_a: {
              label: 'A',
              subtitle: 'S',
              fields: { f: { type: 'bad' } },
            },
          },
        },
      }).valid
    ).toBe(false);
  });
});
