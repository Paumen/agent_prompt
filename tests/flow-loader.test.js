import { describe, it, expect } from 'vitest';
import { getFlows, getFlowById, getFlowIds } from '../src/js/flow-loader.js';
import { validateFlows } from '../config/flow-schema.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

// Load flows.yaml directly for schema validation tests
const flowsPath = resolve(import.meta.dirname, '../src/config/flows.yaml');
const rawYaml = readFileSync(flowsPath, 'utf-8');
const parsedFlows = yaml.load(rawYaml);

describe('flow-loader.js', () => {
  describe('getFlows()', () => {
    it('returns an object with flow definitions', () => {
      const flows = getFlows();
      expect(flows).toBeDefined();
      expect(typeof flows).toBe('object');
    });

    it('contains all 4 expected flows', () => {
      const flows = getFlows();
      expect(flows).toHaveProperty('fix');
      expect(flows).toHaveProperty('review');
      expect(flows).toHaveProperty('implement');
      expect(flows).toHaveProperty('improve');
    });
  });

  describe('getFlowById()', () => {
    it('returns the fix flow', () => {
      const flow = getFlowById('fix');
      expect(flow).toBeDefined();
      expect(flow.label).toBe('Fix / Debug');
      expect(flow.icon).toBe('bug');
    });

    it('returns the review flow', () => {
      const flow = getFlowById('review');
      expect(flow).toBeDefined();
      expect(flow.label).toBe('Review / Analyze');
      expect(flow.icon).toBe('codescan');
    });

    it('returns the implement flow', () => {
      const flow = getFlowById('implement');
      expect(flow).toBeDefined();
      expect(flow.label).toBe('Implement / Build');
      expect(flow.icon).toBe('rocket');
    });

    it('returns the improve flow', () => {
      const flow = getFlowById('improve');
      expect(flow).toBeDefined();
      expect(flow.label).toBe('Improve / Modify');
      expect(flow.icon).toBe('compose');
    });

    it('returns null for unknown flow ID', () => {
      expect(getFlowById('nonexistent')).toBe(null);
    });

    it('returns null for empty string', () => {
      expect(getFlowById('')).toBe(null);
    });
  });

  describe('getFlowIds()', () => {
    it('returns array of flow IDs', () => {
      const ids = getFlowIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toContain('fix');
      expect(ids).toContain('review');
      expect(ids).toContain('implement');
      expect(ids).toContain('improve');
    });
  });

  describe('flow structure', () => {
    it('each flow has panel_a with label, subtitle, and fields', () => {
      const flows = getFlows();
      for (const [id, flow] of Object.entries(flows)) {
        expect(flow.panel_a, `${id} panel_a`).toBeDefined();
        expect(flow.panel_a.label, `${id} panel_a.label`).toBeTruthy();
        expect(flow.panel_a.subtitle, `${id} panel_a.subtitle`).toBeTruthy();
        expect(flow.panel_a.fields, `${id} panel_a.fields`).toBeDefined();
      }
    });

    it('each flow has panel_b with label, subtitle, and fields', () => {
      const flows = getFlows();
      for (const [id, flow] of Object.entries(flows)) {
        expect(flow.panel_b, `${id} panel_b`).toBeDefined();
        expect(flow.panel_b.label, `${id} panel_b.label`).toBeTruthy();
        expect(flow.panel_b.subtitle, `${id} panel_b.subtitle`).toBeTruthy();
        expect(flow.panel_b.fields, `${id} panel_b.fields`).toBeDefined();
      }
    });

    it('each flow has a steps array with at least one step', () => {
      const flows = getFlows();
      for (const [id, flow] of Object.entries(flows)) {
        expect(Array.isArray(flow.steps), `${id} steps`).toBe(true);
        expect(flow.steps.length, `${id} steps.length`).toBeGreaterThan(0);
      }
    });

    it('each step has id, operation, and object', () => {
      const flows = getFlows();
      for (const [flowId, flow] of Object.entries(flows)) {
        for (const step of flow.steps) {
          expect(step.id, `${flowId} step.id`).toBeTruthy();
          expect(
            step.operation,
            `${flowId}/${step.id} step.operation`
          ).toBeTruthy();
          expect(step.object, `${flowId}/${step.id} step.object`).toBeTruthy();
        }
      }
    });

    it('fix flow has issue_number field in panel_a', () => {
      const flow = getFlowById('fix');
      expect(flow.panel_a.fields).toHaveProperty('issue_number');
    });

    it('review flow has pr_number field in panel_a', () => {
      const flow = getFlowById('review');
      expect(flow.panel_a.fields).toHaveProperty('pr_number');
    });

    it('implement flow has acceptance_criteria in panel_b', () => {
      const flow = getFlowById('implement');
      expect(flow.panel_b.fields).toHaveProperty('acceptance_criteria');
    });

    it('improve flow has lenses in panel_b', () => {
      const flow = getFlowById('improve');
      expect(flow.panel_b.fields).toHaveProperty('lenses');
    });

    it('improve flow has multi_file scope selector', () => {
      const flow = getFlowById('improve');
      expect(flow.multi_file).toBeDefined();
      expect(flow.multi_file.scope_selector).toBeDefined();
      expect(flow.multi_file.scope_selector.options).toHaveProperty(
        'each_file'
      );
      expect(flow.multi_file.scope_selector.options).toHaveProperty(
        'across_files'
      );
    });

    it('conditional steps have source fields', () => {
      const flows = getFlows();
      for (const [_flowId, flow] of Object.entries(flows)) {
        const conditionalSteps = flow.steps.filter((s) => s.source);
        for (const step of conditionalSteps) {
          expect(typeof step.source).toBe('string');
          // Source should reference a panel field path
          expect(step.source).toMatch(/^panel_[ab]\./);
        }
      }
    });
  });
});

describe('flow-schema.js (TST-03)', () => {
  describe('validates actual flows.yaml', () => {
    it('current flows.yaml passes schema validation', () => {
      const result = validateFlows(parsedFlows);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('rejects invalid flow structures', () => {
    it('rejects null input', () => {
      const result = validateFlows(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects missing flows key', () => {
      const result = validateFlows({ notflows: {} });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'flows.yaml: missing "flows" key at root'
      );
    });

    it('rejects empty flows object', () => {
      const result = validateFlows({ flows: {} });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'flows.yaml: "flows" must contain at least one flow'
      );
    });

    it('rejects flow missing label', () => {
      const result = validateFlows({
        flows: {
          test: {
            icon: 'bug',
            panel_a: {
              label: 'A',
              subtitle: 'Sub A',
              fields: {},
            },
            panel_b: {
              label: 'B',
              subtitle: 'Sub B',
              fields: {},
            },
            steps: [{ id: 's1', operation: 'read', object: 'file' }],
          },
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('missing "label"'))).toBe(
        true
      );
    });

    it('rejects flow with invalid icon', () => {
      const result = validateFlows({
        flows: {
          test: {
            label: 'Test',
            icon: 'invalid-icon',
            panel_a: {
              label: 'A',
              subtitle: 'Sub A',
              fields: {},
            },
            panel_b: {
              label: 'B',
              subtitle: 'Sub B',
              fields: {},
            },
            steps: [{ id: 's1', operation: 'read', object: 'file' }],
          },
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('invalid icon'))).toBe(true);
    });

    it('rejects flow missing panel_a', () => {
      const result = validateFlows({
        flows: {
          test: {
            label: 'Test',
            icon: 'bug',
            panel_b: {
              label: 'B',
              subtitle: 'Sub B',
              fields: {},
            },
            steps: [{ id: 's1', operation: 'read', object: 'file' }],
          },
        },
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('missing or invalid "panel_a"'))
      ).toBe(true);
    });

    it('rejects panel missing label', () => {
      const result = validateFlows({
        flows: {
          test: {
            label: 'Test',
            icon: 'bug',
            panel_a: {
              subtitle: 'Sub A',
              fields: {},
            },
            panel_b: {
              label: 'B',
              subtitle: 'Sub B',
              fields: {},
            },
            steps: [{ id: 's1', operation: 'read', object: 'file' }],
          },
        },
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) => e.includes('panel_a') && e.includes('missing "label"')
        )
      ).toBe(true);
    });

    it('rejects field with invalid type', () => {
      const result = validateFlows({
        flows: {
          test: {
            label: 'Test',
            icon: 'bug',
            panel_a: {
              label: 'A',
              subtitle: 'Sub A',
              fields: {
                bad_field: { type: 'invalid_type' },
              },
            },
            panel_b: {
              label: 'B',
              subtitle: 'Sub B',
              fields: {},
            },
            steps: [{ id: 's1', operation: 'read', object: 'file' }],
          },
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('invalid type'))).toBe(true);
    });

    it('rejects step with invalid operation', () => {
      const result = validateFlows({
        flows: {
          test: {
            label: 'Test',
            icon: 'bug',
            panel_a: {
              label: 'A',
              subtitle: 'Sub A',
              fields: {},
            },
            panel_b: {
              label: 'B',
              subtitle: 'Sub B',
              fields: {},
            },
            steps: [{ id: 's1', operation: 'fly_to_moon', object: 'file' }],
          },
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('invalid operation'))).toBe(
        true
      );
    });

    it('rejects step missing id', () => {
      const result = validateFlows({
        flows: {
          test: {
            label: 'Test',
            icon: 'bug',
            panel_a: {
              label: 'A',
              subtitle: 'Sub A',
              fields: {},
            },
            panel_b: {
              label: 'B',
              subtitle: 'Sub B',
              fields: {},
            },
            steps: [{ operation: 'read', object: 'file' }],
          },
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('missing "id"'))).toBe(true);
    });

    it('rejects empty steps array', () => {
      const result = validateFlows({
        flows: {
          test: {
            label: 'Test',
            icon: 'bug',
            panel_a: {
              label: 'A',
              subtitle: 'Sub A',
              fields: {},
            },
            panel_b: {
              label: 'B',
              subtitle: 'Sub B',
              fields: {},
            },
            steps: [],
          },
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('must not be empty'))).toBe(
        true
      );
    });

    it('reports multiple validation errors at once', () => {
      const result = validateFlows({
        flows: {
          bad: {
            // Missing label, icon
            panel_a: { fields: {} }, // Missing label, subtitle
            panel_b: { fields: {} }, // Missing label, subtitle
            steps: [{ operation: 'read' }], // Missing id, object
          },
        },
      });
      expect(result.valid).toBe(false);
      // Should catch multiple issues
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });
});
