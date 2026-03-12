import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../src/core/prompt-builder.js';
import { createMockState } from './helpers/state-factory.js';

// Helper: create a state with valid owner/repo for prompt generation
function baseState(overrides = {}) {
  return createMockState({
    configuration: {
      owner: 'alice',
      repo: 'wonderland',
      branch: 'main',
      pat: '',
    },
    ...overrides,
  });
}

describe('prompt-builder.js', () => {
  describe('empty/minimal state', () => {
    it('returns empty string for null/undefined/missing owner or repo', () => {
      expect(buildPrompt(null)).toBe('');
      expect(buildPrompt(undefined)).toBe('');
      expect(
        buildPrompt(
          baseState({
            configuration: { owner: '', repo: '', branch: '', pat: '' },
          })
        )
      ).toBe('');
      expect(
        buildPrompt(
          baseState({
            configuration: { owner: 'user', repo: '', branch: '', pat: '' },
          })
        )
      ).toBe('');
    });
  });

  describe('basic prompt generation', () => {
    it('generates valid prompt with owner, repo, branch, optional PAT', () => {
      const result = buildPrompt(baseState());
      expect(result).toContain('<prompt>');
      expect(result).toContain('</prompt>');
      expect(result).toContain('alice/wonderland');
      expect(result).toContain('<branch> main </branch>');
      expect(result).not.toContain('<PAT>');

      const withPat = buildPrompt(
        baseState({
          configuration: {
            owner: 'alice',
            repo: 'wonderland',
            branch: 'main',
            pat: 'ghp_test',
          },
        })
      );
      expect(withPat).toContain('<PAT> ghp_test </PAT>');
    });
  });

  describe('fix flow', () => {
    it('generates fix-specific prompt with undesired/expected behavior', () => {
      const result = buildPrompt(
        baseState({
          task: { flow_id: 'fix' },
          panel_a: {
            description: 'Login fails',
            issue_number: 42,
            pr_number: null,
            files: ['src/auth.js'],
          },
          panel_b: {
            description: 'Should work',
            issue_number: null,
            spec_files: ['spec.md'],
            guideline_files: [],
            acceptance_criteria: '',
            lenses: [],
          },
        })
      );

      expect(result).toContain('<task="debug">');
      expect(result).toContain('<undesired_behavior>');
      expect(result).toContain('Login fails');
      expect(result).toContain('issue #42');
      expect(result).toContain('@src/auth.js');
      expect(result).toContain('<expected_behavior>');
      expect(result).toContain('Should work');
      expect(result).toContain('@spec.md');
    });
  });

  describe('review flow', () => {
    it('generates review-specific prompt with subject/criteria', () => {
      const result = buildPrompt(
        baseState({
          task: { flow_id: 'review' },
          panel_a: {
            description: 'Check auth',
            issue_number: null,
            pr_number: 15,
            files: ['src/auth.js'],
          },
          panel_b: {
            description: '',
            issue_number: null,
            spec_files: [],
            guideline_files: [],
            acceptance_criteria: '',
            lenses: ['security'],
          },
        })
      );

      expect(result).toContain('<task="review">');
      expect(result).toContain('<review_subject>');
      expect(result).toContain('PR #15');
      expect(result).toContain('Focus on: [security]');
    });
  });

  describe('implement flow', () => {
    it('generates implement-specific prompt with context/requirements', () => {
      const result = buildPrompt(
        baseState({
          task: { flow_id: 'implement' },
          panel_a: {
            description: 'Existing code',
            issue_number: null,
            pr_number: null,
            files: ['src/auth.js'],
          },
          panel_b: {
            description: 'Add OAuth',
            issue_number: null,
            spec_files: ['spec.md'],
            guideline_files: [],
            acceptance_criteria: 'Users can login',
            lenses: [],
          },
        })
      );

      expect(result).toContain('<task="implement">');
      expect(result).toContain('<existing_context>');
      expect(result).toContain('<requirements>');
      expect(result).toContain('Add OAuth');
      expect(result).toContain('Users can login');
    });
  });

  describe('improve flow', () => {
    it('generates improve-specific prompt with current/desired state and scope', () => {
      const result = buildPrompt(
        baseState({
          task: { flow_id: 'improve' },
          panel_a: {
            description: 'Slow',
            issue_number: null,
            pr_number: null,
            files: ['src/data.js'],
          },
          panel_b: {
            description: 'Fast',
            issue_number: null,
            spec_files: [],
            guideline_files: [],
            acceptance_criteria: '',
            lenses: ['performance'],
          },
          improve_scope: 'each_file',
        })
      );

      expect(result).toContain('<task="improve">');
      expect(result).toContain('<current_state>');
      expect(result).toContain('<desired_outcome>');
      expect(result).toContain('Apply improvements to each file independently');

      const noScope = buildPrompt(baseState({ task: { flow_id: 'improve' } }));
      expect(noScope).not.toContain('<scope>');
    });
  });

  describe('enabled steps', () => {
    it('renders steps with operation, object, lenses, and params', () => {
      const result = buildPrompt(
        baseState({
          steps: {
            enabled_steps: [
              {
                id: 'context',
                operation: 'read',
                object: 'file',
                params: { file: 'claude.md' },
              },
              {
                id: 'analyze',
                operation: 'analyze',
                object: 'code',
                lenses: ['security', 'performance'],
              },
              {
                id: 'commit',
                operation: 'commit',
                object: 'changes',
                branch_name: 'optional_text',
                name_provided: 'feat/x',
              },
            ],
          },
        })
      );

      expect(result).toContain('Step 1: Read @claude.md');
      expect(result).toContain(
        'Analyze code — focus on [security, performance]'
      );
      expect(result).toContain('Create branch');
    });

    it('consolidates read step into single line with all sources', () => {
      const result = buildPrompt(
        baseState({
          steps: {
            enabled_steps: [
              {
                id: 'read',
                operation: 'read',
                object: 'files',
                params: { files: ['a.js', 'b.js'] },
              },
            ],
          },
        })
      );
      expect(result).toContain('Read @a.js, @b.js');
    });

    it('includes issues and PR in single read line', () => {
      const result = buildPrompt(
        baseState({
          steps: {
            enabled_steps: [
              {
                id: 'read',
                operation: 'read',
                object: 'files',
                params: { files: ['a.js'], issues: [42], pr_number: 5 },
              },
            ],
          },
        })
      );
      expect(result).toContain('Read @a.js, issue #42, PR #5');
    });
  });

  describe('determinism', () => {
    it('produces identical output for identical input', () => {
      const state = baseState({
        task: { flow_id: 'fix' },
        panel_a: {
          description: 'Bug',
          issue_number: 5,
          pr_number: null,
          files: ['src/auth.js'],
        },
      });

      expect(buildPrompt(state)).toBe(buildPrompt(state));
      expect(buildPrompt(state)).toBe(buildPrompt(state));
    });
  });

  describe('XML escaping', () => {
    it('escapes special characters in all text fields', () => {
      const result = buildPrompt(
        baseState({
          configuration: {
            owner: 'user<script>',
            repo: 'repo&name',
            branch: 'feat>test',
            pat: '',
          },
          steps: {
            enabled_steps: [
              {
                id: 't',
                operation: 'read<>',
                object: 'file&name',
                lenses: ['<evil>'],
              },
            ],
          },
        })
      );

      expect(result).toContain('user&lt;script&gt;');
      expect(result).toContain('repo&amp;name');
      expect(result).toContain('&lt;evil&gt;');
      expect(result).not.toContain('<script>');
    });
  });

  describe('task ID mapping', () => {
    it('uses correct task attribute for each flow', () => {
      expect(buildPrompt(baseState({ task: { flow_id: 'fix' } }))).toContain(
        '<task="debug">'
      );
      expect(buildPrompt(baseState({ task: { flow_id: 'review' } }))).toContain(
        '<task="review">'
      );
      expect(
        buildPrompt(baseState({ task: { flow_id: 'implement' } }))
      ).toContain('<task="implement">');
      expect(
        buildPrompt(baseState({ task: { flow_id: 'improve' } }))
      ).toContain('<task="improve">');
    });
  });

  describe('output modes', () => {
    it('generates correct feedback instruction for each output mode', () => {
      const modes = [
        { outputs_selected: ['here'], expected: 'here (in this interface)' },
        { outputs_selected: ['pr_comment'], expected: 'PR comment' },
        {
          outputs_selected: ['pr_inline_comments'],
          expected: 'PR inline comments',
        },
        {
          outputs_selected: ['issue_comment'],
          expected: 'GitHub issue comment',
        },
        { outputs_selected: ['report_file'], expected: 'report file' },
      ];

      for (const { outputs_selected, expected } of modes) {
        const result = buildPrompt(
          baseState({
            task: { flow_id: 'review' },
            steps: {
              enabled_steps: [
                {
                  id: 'report',
                  operation: 'create',
                  object: 'review_feedback',
                  output: ['here', 'pr_comment'],
                  outputs_selected,
                },
              ],
            },
          })
        );
        expect(result).toContain(expected);
      }
    });

    it('combines multiple output modes', () => {
      const result = buildPrompt(
        baseState({
          task: { flow_id: 'review' },
          steps: {
            enabled_steps: [
              {
                id: 'report',
                operation: 'create',
                object: 'review_feedback',
                output: ['here', 'pr_comment'],
                outputs_selected: ['here', 'pr_comment'],
              },
            ],
          },
        })
      );
      expect(result).toContain('here (in this interface) AND as a PR comment');
    });
  });

  describe('context step', () => {
    it('renders context step as Read @claude.md, omits when removed', () => {
      const withContext = buildPrompt(
        baseState({
          steps: {
            enabled_steps: [
              {
                id: 'context',
                operation: 'read',
                object: 'file',
                params: { file: 'claude.md' },
              },
            ],
          },
        })
      );
      expect(withContext).toContain('Step 1: Read @claude.md');

      const withoutContext = buildPrompt(
        baseState({
          task: { flow_id: 'fix' },
          panel_a: {
            description: 'Bug',
            issue_number: null,
            pr_number: null,
            files: [],
          },
          steps: {
            enabled_steps: [
              { id: 'analyze', operation: 'analyze', object: 'issue' },
            ],
          },
        })
      );
      expect(withoutContext).not.toContain('claude.md');
    });
  });

  describe('commit step', () => {
    it('generates commit step with branch and PR instructions', () => {
      const result = buildPrompt(
        baseState({
          task: { flow_id: 'fix' },
          steps: {
            enabled_steps: [
              {
                id: 'commit',
                operation: 'commit',
                object: 'changes',
                params: { open_draft_pr: true },
                branch_name: 'optional_text',
                pr_name: 'optional_text',
              },
            ],
          },
        })
      );
      expect(result).toContain('Create branch');
      expect(result).toContain('commit changes');
      expect(result).toContain('draft PR');
    });
  });
});
