import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../src/js/prompt-builder.js';

describe('prompt-builder.js', () => {
  describe('empty/minimal state', () => {
    it('returns empty string for null input', () => {
      expect(buildPrompt(null)).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(buildPrompt(undefined)).toBe('');
    });

    it('returns empty string when no owner or repo', () => {
      const state = {
        configuration: { owner: '', repo: '', branch: '', pat: '' },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: '' },
      };
      expect(buildPrompt(state)).toBe('');
    });

    it('returns empty string when owner is set but repo is missing', () => {
      const state = {
        configuration: { owner: 'user', repo: '', branch: '', pat: '' },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: '' },
      };
      expect(buildPrompt(state)).toBe('');
    });
  });

  describe('basic prompt generation', () => {
    it('generates a valid prompt with owner and repo', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);

      expect(result).toContain('<prompt>');
      expect(result).toContain('</prompt>');
      expect(result).toContain('<context>');
      expect(result).toContain('</context>');
      expect(result).toContain('<todo>');
      expect(result).toContain('</todo>');
      expect(result).toContain('alice/wonderland');
      expect(result).toContain('main');
    });

    it('includes PAT when provided', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: 'ghp_test123',
        },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).toContain('<PAT> ghp_test123 </PAT>');
    });

    it('omits PAT line when no PAT', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).not.toContain('<PAT>');
    });

    it('defaults branch to main when empty', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: '',
          pat: '',
        },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).toContain('<branch> main </branch>');
    });
  });

  describe('step 1: always read claude.md', () => {
    it('always includes Step 1: Read: @claude.md', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).toContain('Step 1: Read: @claude.md');
    });
  });

  describe('selected files (OUT-04: @ prefix)', () => {
    it('includes selected files as step 2 with @ prefix', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: ['src/utils/auth.js', 'src/main.js'] },
        steps: { enabled_steps: [] },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).toContain(
        'Step 2: Read: @src/utils/auth.js, @src/main.js'
      );
    });

    it('skips file step when no files selected', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).not.toContain('Step 2');
    });
  });

  describe('enabled steps', () => {
    it('renders steps with operation and object', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: [] },
        steps: {
          enabled_steps: [
            { id: 'create-branch', operation: 'create', object: 'branch' },
            { id: 'commit', operation: 'commit', object: 'changes' },
          ],
        },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).toContain('Step 2: Create branch');
      expect(result).toContain('Step 3: Commit changes');
    });

    it('renders step with lenses (STP-03)', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: [] },
        steps: {
          enabled_steps: [
            {
              id: 'review',
              operation: 'review',
              object: 'code',
              lenses: ['security', 'performance'],
            },
          ],
        },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).toContain(
        'Step 2: Review code — focus on [security, performance]'
      );
    });

    it('renders step with params', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: [] },
        steps: {
          enabled_steps: [
            {
              id: 'read-spec',
              operation: 'read',
              object: 'file',
              params: { file: 'spec/spec.md' },
            },
          ],
        },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).toContain('Step 2: Read file @spec/spec.md');
    });

    it('correctly numbers steps with files + enabled_steps', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: ['README.md'] },
        steps: {
          enabled_steps: [
            { id: 'create-branch', operation: 'create', object: 'branch' },
          ],
        },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).toContain('Step 1: Read: @claude.md');
      expect(result).toContain('Step 2: Read: @README.md');
      expect(result).toContain('Step 3: Create branch');
    });
  });

  describe('notes section (OUT-06)', () => {
    it('includes notes section when user_text is present', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: 'Please be careful with auth changes.' },
      };
      const result = buildPrompt(state);
      expect(result).toContain('<notes>');
      expect(result).toContain('Please be careful with auth changes.');
      expect(result).toContain('</notes>');
    });

    it('omits notes section when user_text is empty', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).not.toContain('<notes>');
    });

    it('omits notes section when user_text is only whitespace', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: '',
        },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: '   ' },
      };
      const result = buildPrompt(state);
      expect(result).not.toContain('<notes>');
    });
  });

  describe('determinism (DM-INV-03, TST-01)', () => {
    it('produces identical output for identical input', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'main',
          pat: 'ghp_secret',
        },
        context: { selected_files: ['src/auth.js'] },
        steps: {
          enabled_steps: [
            {
              id: 'review',
              operation: 'review',
              object: 'code',
              lenses: ['security', 'performance'],
            },
            { id: 'commit', operation: 'commit', object: 'changes' },
          ],
        },
        notes: { user_text: 'Focus on security' },
      };

      const result1 = buildPrompt(state);
      const result2 = buildPrompt(state);
      const result3 = buildPrompt(state);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('snapshot: full state produces expected output', () => {
      const state = {
        configuration: {
          owner: 'alice',
          repo: 'wonderland',
          branch: 'feat/auth',
          pat: 'ghp_test',
        },
        context: { selected_files: ['src/auth.js', 'src/utils.js'] },
        steps: {
          enabled_steps: [
            { id: 'create-branch', operation: 'create', object: 'branch' },
            {
              id: 'edit-files',
              operation: 'edit',
              object: 'files',
              lenses: ['semantics', 'syntax'],
            },
            { id: 'commit', operation: 'commit', object: 'changes' },
            { id: 'open-pr', operation: 'open', object: 'pr' },
          ],
        },
        notes: { user_text: 'Handle edge cases carefully' },
      };

      const result = buildPrompt(state);

      expect(result).toMatchInlineSnapshot(`
        "<prompt>
          <context>
            Execute the following TODO steps for <repository> https://github.com/alice/wonderland </repository> on <branch> feat/auth </branch>.
            Authenticate using PAT: <PAT> ghp_test </PAT>.
          </context>
          <todo>
            Step 1: Read: @claude.md
            Step 2: Read: @src/auth.js, @src/utils.js
            Step 3: Create branch
            Step 4: Edit files — focus on [semantics, syntax]
            Step 5: Commit changes
            Step 6: Open pr
          </todo>
        </prompt>
        <notes>
          Handle edge cases carefully
        </notes>"
      `);
    });
  });

  describe('XML escaping', () => {
    it('escapes special characters in owner/repo/branch', () => {
      const state = {
        configuration: {
          owner: 'user<script>',
          repo: 'repo&name',
          branch: 'feat>test',
          pat: '',
        },
        context: { selected_files: [] },
        steps: { enabled_steps: [] },
        notes: { user_text: '' },
      };
      const result = buildPrompt(state);
      expect(result).toContain('user&lt;script&gt;');
      expect(result).toContain('repo&amp;name');
      expect(result).toContain('feat&gt;test');
      expect(result).not.toContain('<script>');
    });
  });
});
