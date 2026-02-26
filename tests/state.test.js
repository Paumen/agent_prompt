// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to reset module state between tests, so we use dynamic imports
let stateModule;

/**
 * Re-import state module fresh for each test.
 * This clears the internal state singleton.
 */
async function freshImport() {
  // Clear localStorage before each fresh import
  localStorage.clear();

  // Reset module registry so state.js re-initializes
  vi.resetModules();
  stateModule = await import('../src/js/state.js');
}

describe('state.js', () => {
  beforeEach(async () => {
    await freshImport();
  });

  describe('getState()', () => {
    it('returns the default state shape with new data model', () => {
      const s = stateModule.getState();
      expect(s.version).toBe('1.0');
      expect(s.configuration).toEqual({
        owner: '',
        repo: '',
        branch: '',
        pat: '',
      });
      expect(s.task).toEqual({ flow_id: '' });
      expect(s.panel_a).toEqual({
        description: '',
        issue_number: null,
        pr_number: null,
        files: [],
      });
      expect(s.panel_b).toEqual({
        description: '',
        issue_number: null,
        spec_files: [],
        guideline_files: [],
        acceptance_criteria: '',
        lenses: [],
      });
      expect(s.steps).toEqual({ enabled_steps: [] });
      expect(s.improve_scope).toBe(null);
      expect(s.notes).toEqual({ user_text: '' });
      expect(s.output).toEqual({ destination: 'clipboard' });
    });

    it('returns a frozen snapshot', () => {
      const s = stateModule.getState();
      expect(Object.isFrozen(s)).toBe(true);
    });

    it('includes derived _prompt field', () => {
      const s = stateModule.getState();
      expect('_prompt' in s).toBe(true);
    });

    it('returns empty prompt when no owner/repo set', () => {
      const s = stateModule.getState();
      expect(s._prompt).toBe('');
    });
  });

  describe('setState() with path string', () => {
    it('sets a simple nested value', () => {
      stateModule.setState('configuration.repo', 'my-repo');
      expect(stateModule.getState().configuration.repo).toBe('my-repo');
    });

    it('sets deeply nested values', () => {
      stateModule.setState('configuration.owner', 'testuser');
      stateModule.setState('configuration.repo', 'testrepo');
      const s = stateModule.getState();
      expect(s.configuration.owner).toBe('testuser');
      expect(s.configuration.repo).toBe('testrepo');
    });

    it('triggers prompt rebuild on every call (DM-INV-02)', () => {
      stateModule.setState('configuration.owner', 'alice');
      stateModule.setState('configuration.repo', 'wonderland');
      const s = stateModule.getState();
      expect(s._prompt).toContain('alice');
      expect(s._prompt).toContain('wonderland');
    });

    it('handles panel_a.files array', () => {
      stateModule.setState('panel_a.files', ['src/main.js', 'src/util.js']);
      const s = stateModule.getState();
      expect(s.panel_a.files).toEqual(['src/main.js', 'src/util.js']);
    });

    it('sets panel_a.description', () => {
      stateModule.setState('panel_a.description', 'Bug in auth module');
      expect(stateModule.getState().panel_a.description).toBe(
        'Bug in auth module'
      );
    });

    it('sets panel_b.lenses', () => {
      stateModule.setState('panel_b.lenses', ['security', 'performance']);
      expect(stateModule.getState().panel_b.lenses).toEqual([
        'security',
        'performance',
      ]);
    });

    it('sets improve_scope', () => {
      stateModule.setState('improve_scope', 'each_file');
      expect(stateModule.getState().improve_scope).toBe('each_file');
    });
  });

  describe('setState() with updater function', () => {
    it('receives current state and applies returned updates', () => {
      stateModule.setState('configuration.owner', 'testuser');
      stateModule.setState((current) => ({
        configuration: {
          ...current.configuration,
          repo: 'new-repo',
        },
      }));
      expect(stateModule.getState().configuration.repo).toBe('new-repo');
      // Owner should be preserved
      expect(stateModule.getState().configuration.owner).toBe('testuser');
    });
  });

  describe('subscribe()', () => {
    it('fires listener after setState', () => {
      const listener = vi.fn();
      stateModule.subscribe(listener);
      stateModule.setState('configuration.repo', 'test');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('passes frozen state snapshot to listener', () => {
      let received;
      stateModule.subscribe((s) => {
        received = s;
      });
      stateModule.setState('configuration.repo', 'test');
      expect(Object.isFrozen(received)).toBe(true);
      expect(received.configuration.repo).toBe('test');
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = stateModule.subscribe(listener);
      stateModule.setState('configuration.repo', 'test1');
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      stateModule.setState('configuration.repo', 'test2');
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });

    it('supports multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      stateModule.subscribe(listener1);
      stateModule.subscribe(listener2);
      stateModule.setState('configuration.repo', 'test');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetSession()', () => {
    it('clears session data but preserves PAT and owner (APP-04)', () => {
      stateModule.setState('configuration.pat', 'ghp_secret123');
      stateModule.setState('configuration.owner', 'myuser');
      stateModule.setState('configuration.repo', 'my-repo');
      stateModule.setState('configuration.branch', 'main');
      stateModule.setState('task.flow_id', 'fix');
      stateModule.setState('notes.user_text', 'some notes');
      stateModule.setState('panel_a.files', ['a.js']);
      stateModule.setState('panel_a.description', 'bug description');
      stateModule.setState('panel_b.description', 'expected behavior');
      stateModule.setState('panel_b.lenses', ['security']);
      stateModule.setState('improve_scope', 'each_file');
      stateModule.setState('steps.enabled_steps', [
        { id: 'test', operation: 'read', object: 'file' },
      ]);

      stateModule.resetSession();

      const s = stateModule.getState();
      // Preserved
      expect(s.configuration.pat).toBe('ghp_secret123');
      expect(s.configuration.owner).toBe('myuser');
      // Cleared
      expect(s.configuration.repo).toBe('');
      expect(s.configuration.branch).toBe('');
      expect(s.task.flow_id).toBe('');
      expect(s.notes.user_text).toBe('');
      expect(s.panel_a.files).toEqual([]);
      expect(s.panel_a.description).toBe('');
      expect(s.panel_a.issue_number).toBe(null);
      expect(s.panel_a.pr_number).toBe(null);
      expect(s.panel_b.description).toBe('');
      expect(s.panel_b.issue_number).toBe(null);
      expect(s.panel_b.spec_files).toEqual([]);
      expect(s.panel_b.guideline_files).toEqual([]);
      expect(s.panel_b.acceptance_criteria).toBe('');
      expect(s.panel_b.lenses).toEqual([]);
      expect(s.improve_scope).toBe(null);
      expect(s.steps.enabled_steps).toEqual([]);
    });

    it('notifies subscribers after reset', () => {
      const listener = vi.fn();
      stateModule.subscribe(listener);
      stateModule.resetSession();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('rebuilds prompt after reset', () => {
      stateModule.setState('configuration.owner', 'user');
      stateModule.setState('configuration.repo', 'repo');
      expect(stateModule.getState()._prompt).not.toBe('');

      stateModule.resetSession();
      // After reset, no repo set, so prompt should be empty
      expect(stateModule.getState()._prompt).toBe('');
    });
  });

  describe('applyFlowDefaults() (DM-DEF-03)', () => {
    it('sets flow_id and resets panels and steps', () => {
      stateModule.setState('panel_a.description', 'some description');
      stateModule.setState('panel_b.lenses', ['security']);
      stateModule.setState('steps.enabled_steps', [
        { id: 'test', operation: 'read', object: 'file' },
      ]);
      stateModule.setState('improve_scope', 'each_file');

      stateModule.applyFlowDefaults('fix', {});

      const s = stateModule.getState();
      expect(s.task.flow_id).toBe('fix');
      expect(s.panel_a.description).toBe('');
      expect(s.panel_a.files).toEqual([]);
      expect(s.panel_b.description).toBe('');
      expect(s.panel_b.lenses).toEqual([]);
      expect(s.steps.enabled_steps).toEqual([]);
      expect(s.improve_scope).toBe(null);
    });

    it('applies flow default lenses to panel_b', () => {
      const flowDef = {
        panel_b: {
          fields: {
            lenses: { default: ['semantics', 'structure'] },
          },
        },
      };

      stateModule.applyFlowDefaults('review', flowDef);

      const s = stateModule.getState();
      expect(s.panel_b.lenses).toEqual(['semantics', 'structure']);
    });

    it('notifies subscribers', () => {
      const listener = vi.fn();
      stateModule.subscribe(listener);
      stateModule.applyFlowDefaults('fix', {});
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not carry over user overrides across flow switches', () => {
      // Set up state for fix flow
      stateModule.setState('task.flow_id', 'fix');
      stateModule.setState('panel_a.description', 'bug report');
      stateModule.setState('panel_b.spec_files', ['spec.md']);

      // Switch to review flow
      stateModule.applyFlowDefaults('review', {});

      const s = stateModule.getState();
      expect(s.task.flow_id).toBe('review');
      expect(s.panel_a.description).toBe('');
      expect(s.panel_b.spec_files).toEqual([]);
    });
  });

  describe('localStorage persistence (APP-04)', () => {
    it('persists PAT to localStorage on setState', () => {
      stateModule.setState('configuration.pat', 'ghp_token');
      const stored = JSON.parse(localStorage.getItem(stateModule.STORAGE_KEY));
      expect(stored.pat).toBe('ghp_token');
    });

    it('persists owner to localStorage on setState', () => {
      stateModule.setState('configuration.owner', 'myuser');
      const stored = JSON.parse(localStorage.getItem(stateModule.STORAGE_KEY));
      expect(stored.owner).toBe('myuser');
    });

    it('hydrates PAT and owner from localStorage on init', async () => {
      // Set up localStorage before module init
      localStorage.setItem(
        'agent_prompt_state',
        JSON.stringify({ pat: 'ghp_saved', owner: 'saveduser' })
      );

      vi.resetModules();
      const freshModule = await import('../src/js/state.js');
      const s = freshModule.getState();
      expect(s.configuration.pat).toBe('ghp_saved');
      expect(s.configuration.owner).toBe('saveduser');
    });

    it('handles corrupted localStorage gracefully', async () => {
      localStorage.setItem('agent_prompt_state', 'not valid json!!!');

      vi.resetModules();
      const freshModule = await import('../src/js/state.js');
      const s = freshModule.getState();
      // Should fall back to defaults without throwing
      expect(s.configuration.pat).toBe('');
      expect(s.configuration.owner).toBe('');
    });

    it('handles localStorage with wrong shape gracefully', async () => {
      localStorage.setItem('agent_prompt_state', JSON.stringify([1, 2, 3]));

      vi.resetModules();
      const freshModule = await import('../src/js/state.js');
      const s = freshModule.getState();
      expect(s.configuration.pat).toBe('');
      expect(s.configuration.owner).toBe('');
    });

    it('does not persist session-scoped data', () => {
      // Set a persistent key first to ensure localStorage has data
      stateModule.setState('configuration.owner', 'myuser');
      stateModule.setState('configuration.repo', 'my-repo');
      const stored = JSON.parse(localStorage.getItem(stateModule.STORAGE_KEY));
      expect(stored).not.toHaveProperty('repo');
      expect(stored.owner).toBe('myuser');
    });
  });

  describe('prototype pollution protection', () => {
    it('setByPath rejects __proto__ in path', () => {
      const before = Object.prototype.polluted;
      stateModule.setState('__proto__.polluted', true);
      expect(Object.prototype.polluted).toBeUndefined();
      expect(Object.prototype.polluted).toBe(before);
    });

    it('setByPath rejects constructor in path', () => {
      stateModule.setState('constructor.polluted', true);
      expect({}.polluted).toBeUndefined();
    });

    it('setByPath rejects prototype in path', () => {
      stateModule.setState('prototype.polluted', true);
      expect({}.polluted).toBeUndefined();
    });

    it('setByPath rejects __proto__ in nested path', () => {
      stateModule.setState('configuration.__proto__.polluted', true);
      expect(Object.prototype.polluted).toBeUndefined();
    });

    it('deepMerge skips __proto__ keys in updater', () => {
      const before = Object.prototype.polluted;
      stateModule.setState(() => {
        // Attempt to inject __proto__ via the updater function
        const malicious = JSON.parse('{"__proto__": {"polluted": true}}');
        return malicious;
      });
      expect(Object.prototype.polluted).toBeUndefined();
      expect(Object.prototype.polluted).toBe(before);
    });

    it('deepMerge skips constructor keys in updater', () => {
      stateModule.setState(() => ({
        constructor: { polluted: true },
      }));
      expect({}.polluted).toBeUndefined();
    });
  });
});
