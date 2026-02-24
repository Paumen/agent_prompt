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
    it('returns the default state shape', () => {
      const s = stateModule.getState();
      expect(s.configuration).toEqual({
        owner: '',
        repo: '',
        branch: '',
        pat: '',
      });
      expect(s.context).toEqual({ selected_files: [] });
      expect(s.task).toEqual({ flow_id: '' });
      expect(s.steps).toEqual({ enabled_steps: [] });
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

    it('handles array values', () => {
      stateModule.setState('context.selected_files', [
        'src/main.js',
        'src/util.js',
      ]);
      const s = stateModule.getState();
      expect(s.context.selected_files).toEqual(['src/main.js', 'src/util.js']);
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
      stateModule.setState('task.flow_id', 'review-pr');
      stateModule.setState('notes.user_text', 'some notes');
      stateModule.setState('context.selected_files', ['a.js']);
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
      expect(s.context.selected_files).toEqual([]);
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
      // (owner is preserved but repo is cleared)
      expect(stateModule.getState()._prompt).toBe('');
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
});
