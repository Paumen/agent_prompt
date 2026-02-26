import { describe, it, expect } from "vitest";
import { buildPrompt } from "../src/js/prompt-builder.js";

// Helper: minimal valid state
function baseState(overrides = {}) {
  return {
    configuration: {
      owner: "alice",
      repo: "wonderland",
      branch: "main",
      pat: "",
    },
    task: { flow_id: "" },
    panel_a: {
      description: "",
      issue_number: null,
      pr_number: null,
      files: [],
    },
    panel_b: {
      description: "",
      issue_number: null,
      spec_files: [],
      guideline_files: [],
      acceptance_criteria: "",
      lenses: [],
    },
    steps: { enabled_steps: [] },
    improve_scope: null,
    notes: { user_text: "" },
    ...overrides,
  };
}

describe("prompt-builder.js", () => {
  describe("empty/minimal state", () => {
    it("returns empty string for null input", () => {
      expect(buildPrompt(null)).toBe("");
    });

    it("returns empty string for undefined input", () => {
      expect(buildPrompt(undefined)).toBe("");
    });

    it("returns empty string when no owner or repo", () => {
      const state = baseState({
        configuration: { owner: "", repo: "", branch: "", pat: "" },
      });
      expect(buildPrompt(state)).toBe("");
    });

    it("returns empty string when owner is set but repo is missing", () => {
      const state = baseState({
        configuration: { owner: "user", repo: "", branch: "", pat: "" },
      });
      expect(buildPrompt(state)).toBe("");
    });
  });

  describe("basic prompt generation", () => {
    it("generates a valid prompt with owner and repo", () => {
      const result = buildPrompt(baseState());

      expect(result).toContain("<prompt>");
      expect(result).toContain("</prompt>");
      expect(result).toContain("<context>");
      expect(result).toContain("</context>");
      expect(result).toContain("<todo>");
      expect(result).toContain("</todo>");
      expect(result).toContain("alice/wonderland");
      expect(result).toContain("main");
    });

    it("includes PAT when provided", () => {
      const state = baseState({
        configuration: {
          owner: "alice",
          repo: "wonderland",
          branch: "main",
          pat: "ghp_test123",
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("<PAT> ghp_test123 </PAT>");
    });

    it("omits PAT line when no PAT", () => {
      const result = buildPrompt(baseState());
      expect(result).not.toContain("<PAT>");
    });

    it("defaults branch to main when empty", () => {
      const state = baseState({
        configuration: {
          owner: "alice",
          repo: "wonderland",
          branch: "",
          pat: "",
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("<branch> main </branch>");
    });

    it("includes feedback instruction in context", () => {
      const result = buildPrompt(baseState());
      expect(result).toContain("Please provide one sentence feedback to HUMAN");
    });
  });

  describe("read-claude step (STP-04)", () => {
    it("renders read-claude as Step 1 when present in enabled_steps", () => {
      const state = baseState({
        steps: {
          enabled_steps: [
            {
              id: "read-claude",
              operation: "read",
              object: "file",
              params: { file: "claude.md" },
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("Step 1: Read @claude.md");
      // Should NOT render as "Read file @claude.md" (formatStep output)
      expect(result).not.toContain("Read file @claude.md");
    });

    it("omits read-claude when user removes it from enabled_steps", () => {
      const state = baseState({
        task: { flow_id: "fix" },
        panel_a: {
          description: "Bug",
          issue_number: null,
          pr_number: null,
          files: [],
        },
        steps: {
          enabled_steps: [
            { id: "create-branch", operation: "create", object: "branch" },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).not.toContain("Read @claude.md");
      // Task step becomes Step 1, create-branch becomes Step 2
      expect(result).toContain("Step 1:");
      expect(result).toContain("Step 2: Create branch");
    });
  });

  describe("fix flow (OUT-02)", () => {
    it("generates fix-specific prompt with undesired/expected behavior", () => {
      const state = baseState({
        task: { flow_id: "fix" },
        panel_a: {
          description: "Login fails with 500 error",
          issue_number: 42,
          pr_number: null,
          files: ["src/auth.js"],
        },
        panel_b: {
          description: "Login should succeed with valid credentials",
          issue_number: null,
          spec_files: ["spec/auth-spec.md"],
          guideline_files: ["docs/coding-standards.md"],
          acceptance_criteria: "",
          lenses: [],
        },
      });
      const result = buildPrompt(state);

      expect(result).toContain('<task="debug">');
      expect(result).toContain("Fix / Debug");
      expect(result).toContain("<undesired_behavior>");
      expect(result).toContain("Login fails with 500 error");
      expect(result).toContain("issue #42");
      expect(result).toContain("@src/auth.js");
      expect(result).toContain("</undesired_behavior>");
      expect(result).toContain("<expected_behavior>");
      expect(result).toContain("Login should succeed with valid credentials");
      expect(result).toContain("@spec/auth-spec.md");
      expect(result).toContain("@docs/coding-standards.md");
      expect(result).toContain("</expected_behavior>");
      expect(result).toContain("STOP and DO NOT proceed");
    });

    it("generates fix feedback step", () => {
      const state = baseState({ task: { flow_id: "fix" } });
      const result = buildPrompt(state);
      expect(result).toContain("root cause you identified");
      expect(result).toContain("committed PR");
    });

    it("omits empty panel_a fields in fix flow", () => {
      const state = baseState({ task: { flow_id: "fix" } });
      const result = buildPrompt(state);
      // Should still have the XML tags but not the conditional content
      expect(result).toContain("<undesired_behavior>");
      expect(result).not.toContain("Undesired behavior observed");
      expect(result).not.toContain("reading issue");
    });
  });

  describe("review flow (OUT-02)", () => {
    it("generates review-specific prompt with subject/criteria", () => {
      const state = baseState({
        task: { flow_id: "review" },
        panel_a: {
          description: "Check auth refactoring",
          issue_number: null,
          pr_number: 15,
          files: ["src/auth.js", "src/middleware.js"],
        },
        panel_b: {
          description: "",
          issue_number: null,
          spec_files: ["spec/security.md"],
          guideline_files: ["docs/style.md"],
          acceptance_criteria: "",
          lenses: ["security", "performance"],
        },
      });
      const result = buildPrompt(state);

      expect(result).toContain('<task="review">');
      expect(result).toContain("Review / Analyze");
      expect(result).toContain("<review_subject>");
      expect(result).toContain("Review PR #15");
      expect(result).toContain("@src/auth.js");
      expect(result).toContain("Check auth refactoring");
      expect(result).toContain("</review_subject>");
      expect(result).toContain("<review_criteria>");
      expect(result).toContain("Focus on: [security, performance]");
      expect(result).toContain("@spec/security.md");
      expect(result).toContain("@docs/style.md");
      expect(result).toContain("</review_criteria>");
    });

    it("generates review feedback step", () => {
      const state = baseState({ task: { flow_id: "review" } });
      const result = buildPrompt(state);
      expect(result).toContain("Summary of what you reviewed");
      expect(result).toContain("issues found by severity");
    });
  });

  describe("implement flow (OUT-02)", () => {
    it("generates implement-specific prompt with context/requirements", () => {
      const state = baseState({
        task: { flow_id: "implement" },
        panel_a: {
          description: "Existing auth module needs extension",
          issue_number: null,
          pr_number: null,
          files: ["src/auth.js"],
        },
        panel_b: {
          description: "Add OAuth2 support with Google provider",
          issue_number: null,
          spec_files: ["spec/oauth-spec.md"],
          guideline_files: [],
          acceptance_criteria: "Users can log in with Google OAuth",
          lenses: [],
        },
      });
      const result = buildPrompt(state);

      expect(result).toContain('<task="implement">');
      expect(result).toContain("Implement / Build");
      expect(result).toContain("<existing_context>");
      expect(result).toContain("Existing auth module needs extension");
      expect(result).toContain("@src/auth.js");
      expect(result).toContain("</existing_context>");
      expect(result).toContain("<requirements>");
      expect(result).toContain("Add OAuth2 support with Google provider");
      expect(result).toContain("@spec/oauth-spec.md");
      expect(result).toContain("Users can log in with Google OAuth");
      expect(result).toContain("</requirements>");
    });

    it("generates implement feedback step", () => {
      const state = baseState({ task: { flow_id: "implement" } });
      const result = buildPrompt(state);
      expect(result).toContain("Summary of what you implemented");
      expect(result).toContain("PR link");
    });
  });

  describe("improve flow (OUT-02)", () => {
    it("generates improve-specific prompt with current/desired state", () => {
      const state = baseState({
        task: { flow_id: "improve" },
        panel_a: {
          description: "Performance is slow on large datasets",
          issue_number: 10,
          pr_number: null,
          files: ["src/data-loader.js", "src/renderer.js"],
        },
        panel_b: {
          description: "Should handle 10k records smoothly",
          issue_number: 20,
          spec_files: [],
          guideline_files: ["docs/perf-guide.md"],
          acceptance_criteria: "",
          lenses: ["performance", "structure"],
        },
        improve_scope: "across_files",
      });
      const result = buildPrompt(state);

      expect(result).toContain('<task="improve">');
      expect(result).toContain("Improve / Modify");
      expect(result).toContain("<current_state>");
      expect(result).toContain("Performance is slow on large datasets");
      expect(result).toContain("#10");
      expect(result).toContain("@src/data-loader.js");
      expect(result).toContain("</current_state>");
      expect(result).toContain("<desired_outcome>");
      expect(result).toContain("Should handle 10k records smoothly");
      expect(result).toContain("#20");
      expect(result).toContain("@docs/perf-guide.md");
      expect(result).toContain("Focus on: [performance, structure]");
      expect(result).toContain("</desired_outcome>");
      expect(result).toContain(
        "<scope>Apply improvements across all files as a unified change",
      );
    });

    it("includes each_file scope instruction", () => {
      const state = baseState({
        task: { flow_id: "improve" },
        improve_scope: "each_file",
      });
      const result = buildPrompt(state);
      expect(result).toContain(
        "<scope>Apply improvements to each file independently.</scope>",
      );
    });

    it("omits scope when null", () => {
      const state = baseState({
        task: { flow_id: "improve" },
        improve_scope: null,
      });
      const result = buildPrompt(state);
      expect(result).not.toContain("<scope>");
    });

    it("generates improve feedback step", () => {
      const state = baseState({ task: { flow_id: "improve" } });
      const result = buildPrompt(state);
      expect(result).toContain("Summary of improvements made");
      expect(result).toContain("desired outcome");
    });
  });

  describe("enabled steps", () => {
    it("renders steps with operation and object", () => {
      const state = baseState({
        steps: {
          enabled_steps: [
            { id: "create-branch", operation: "create", object: "branch" },
            { id: "commit", operation: "commit", object: "changes" },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("Create branch");
      expect(result).toContain("Commit changes");
    });

    it("renders step with lenses (STP-03)", () => {
      const state = baseState({
        steps: {
          enabled_steps: [
            {
              id: "review",
              operation: "review",
              object: "code",
              lenses: ["security", "performance"],
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain(
        "Review code — focus on [security, performance]",
      );
    });

    it("renders step with params", () => {
      const state = baseState({
        steps: {
          enabled_steps: [
            {
              id: "read-spec",
              operation: "read",
              object: "file",
              params: { file: "spec/spec.md" },
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("Read file @spec/spec.md");
    });

    it("correctly numbers steps with read-claude + task step + enabled_steps", () => {
      const state = baseState({
        task: { flow_id: "fix" },
        panel_a: {
          description: "Bug",
          issue_number: null,
          pr_number: null,
          files: [],
        },
        steps: {
          enabled_steps: [
            {
              id: "read-claude",
              operation: "read",
              object: "file",
              params: { file: "claude.md" },
            },
            { id: "create-branch", operation: "create", object: "branch" },
          ],
        },
      });
      const result = buildPrompt(state);
      // Step 1: Read @claude.md (from enabled_steps)
      // Step 2: Fix task step (understanding — inserted after read-claude)
      // Step 3: Create branch
      expect(result).toContain("Step 1: Read @claude.md");
      expect(result).toContain("Step 3: Create branch");
    });
  });

  describe("notes section (OUT-06)", () => {
    it("includes notes section when user_text is present", () => {
      const state = baseState({
        notes: { user_text: "Please be careful with auth changes." },
      });
      const result = buildPrompt(state);
      expect(result).toContain("<notes>");
      expect(result).toContain("Critical note:");
      expect(result).toContain("Please be careful with auth changes.");
      expect(result).toContain("</notes>");
    });

    it("omits notes section when user_text is empty", () => {
      const result = buildPrompt(baseState());
      expect(result).not.toContain("<notes>");
    });

    it("omits notes section when user_text is only whitespace", () => {
      const state = baseState({ notes: { user_text: "   " } });
      const result = buildPrompt(state);
      expect(result).not.toContain("<notes>");
    });
  });

  describe("determinism (DM-INV-03, TST-01)", () => {
    it("produces identical output for identical input", () => {
      const state = baseState({
        configuration: {
          owner: "alice",
          repo: "wonderland",
          branch: "main",
          pat: "ghp_secret",
        },
        task: { flow_id: "fix" },
        panel_a: {
          description: "Login broken",
          issue_number: 5,
          pr_number: null,
          files: ["src/auth.js"],
        },
        panel_b: {
          description: "Login should work",
          issue_number: null,
          spec_files: [],
          guideline_files: [],
          acceptance_criteria: "",
          lenses: [],
        },
        steps: {
          enabled_steps: [
            {
              id: "identify",
              operation: "analyze",
              object: "issue",
              lenses: ["error_handling"],
            },
            { id: "commit", operation: "commit", object: "changes" },
          ],
        },
        notes: { user_text: "Focus on security" },
      });

      const result1 = buildPrompt(state);
      const result2 = buildPrompt(state);
      const result3 = buildPrompt(state);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it("snapshot: fix flow full state produces expected structure", () => {
      const state = baseState({
        configuration: {
          owner: "alice",
          repo: "wonderland",
          branch: "feat/auth",
          pat: "ghp_test",
        },
        task: { flow_id: "fix" },
        panel_a: {
          description: "Login fails",
          issue_number: 42,
          pr_number: null,
          files: ["src/auth.js"],
        },
        panel_b: {
          description: "Login should succeed",
          issue_number: null,
          spec_files: [],
          guideline_files: [],
          acceptance_criteria: "",
          lenses: [],
        },
        steps: {
          enabled_steps: [
            {
              id: "read-claude",
              operation: "read",
              object: "file",
              params: { file: "claude.md" },
            },
            {
              id: "identify",
              operation: "analyze",
              object: "issue",
              lenses: ["error_handling"],
            },
            { id: "create-branch", operation: "create", object: "branch" },
            { id: "commit", operation: "commit", object: "changes" },
          ],
        },
        notes: { user_text: "Handle edge cases carefully" },
      });

      const result = buildPrompt(state);

      // Verify structure
      expect(result).toContain("<prompt>");
      expect(result).toContain('<task="debug">');
      expect(result).toContain("<undesired_behavior>");
      expect(result).toContain("Login fails");
      expect(result).toContain("issue #42");
      expect(result).toContain("@src/auth.js");
      expect(result).toContain("<expected_behavior>");
      expect(result).toContain("Login should succeed");
      expect(result).toContain("Step 1: Read @claude.md");
      expect(result).toContain("Analyze issue — focus on [error_handling]");
      expect(result).toContain("Create branch");
      expect(result).toContain("Commit changes");
      expect(result).toContain("Critical note: Handle edge cases carefully");
      expect(result).toContain("</prompt>");
    });
  });

  describe("XML escaping", () => {
    it("escapes special characters in owner/repo/branch", () => {
      const state = baseState({
        configuration: {
          owner: "user<script>",
          repo: "repo&name",
          branch: "feat>test",
          pat: "",
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("user&lt;script&gt;");
      expect(result).toContain("repo&amp;name");
      expect(result).toContain("feat&gt;test");
      expect(result).not.toContain("<script>");
    });

    it("escapes special characters in panel_a file paths", () => {
      const state = baseState({
        task: { flow_id: "fix" },
        panel_a: {
          description: "",
          issue_number: null,
          pr_number: null,
          files: ["src/<malicious>.js", "a&b.ts"],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("@src/&lt;malicious&gt;.js");
      expect(result).toContain("@a&amp;b.ts");
    });

    it("escapes special characters in notes", () => {
      const state = baseState({
        notes: {
          user_text: 'Check <script>alert("xss")</script> & more',
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("&lt;script&gt;");
      expect(result).toContain("&amp; more");
      expect(result).not.toContain("<script>alert");
    });

    it("escapes special characters in step operation and object", () => {
      const state = baseState({
        steps: {
          enabled_steps: [
            {
              id: "test",
              operation: "read<inject>",
              object: "file&name",
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("Read&lt;inject&gt;");
      expect(result).toContain("file&amp;name");
    });

    it("escapes special characters in step params", () => {
      const state = baseState({
        steps: {
          enabled_steps: [
            {
              id: "test",
              operation: "read",
              object: "file",
              params: { file: "<evil>.js", other: "a&b" },
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("@&lt;evil&gt;.js");
      expect(result).toContain("a&amp;b");
    });

    it("escapes special characters in lenses", () => {
      const state = baseState({
        steps: {
          enabled_steps: [
            {
              id: "test",
              operation: "review",
              object: "code",
              lenses: ["<script>", "a&b"],
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("&lt;script&gt;");
      expect(result).toContain("a&amp;b");
      expect(result).not.toContain("<script>");
    });

    it("escapes special characters in panel descriptions", () => {
      const state = baseState({
        task: { flow_id: "fix" },
        panel_a: {
          description: "Error: <div> not rendered & broken",
          issue_number: null,
          pr_number: null,
          files: [],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("&lt;div&gt; not rendered &amp; broken");
    });
  });

  describe("task ID mapping (fix → debug)", () => {
    it('uses task="debug" for fix flow', () => {
      const state = baseState({ task: { flow_id: "fix" } });
      const result = buildPrompt(state);
      expect(result).toContain('<task="debug">');
      expect(result).not.toContain('<task="fix">');
    });

    it('uses task="review" for review flow', () => {
      const state = baseState({ task: { flow_id: "review" } });
      const result = buildPrompt(state);
      expect(result).toContain('<task="review">');
    });

    it('uses task="implement" for implement flow', () => {
      const state = baseState({ task: { flow_id: "implement" } });
      const result = buildPrompt(state);
      expect(result).toContain('<task="implement">');
    });

    it('uses task="improve" for improve flow', () => {
      const state = baseState({ task: { flow_id: "improve" } });
      const result = buildPrompt(state);
      expect(result).toContain('<task="improve">');
    });
  });

  describe("read-claude step rendering from enabled_steps", () => {
    it("renders read-claude from enabled_steps and inserts task step after it", () => {
      const state = baseState({
        task: { flow_id: "fix" },
        panel_a: {
          description: "Bug found",
          issue_number: null,
          pr_number: null,
          files: [],
        },
        steps: {
          enabled_steps: [
            {
              id: "read-claude",
              operation: "read",
              object: "file",
              params: { file: "claude.md" },
            },
            { id: "create-branch", operation: "create", object: "branch" },
          ],
        },
      });
      const result = buildPrompt(state);
      // Step 1: Read @claude.md (from enabled_steps)
      // Step 2: understanding step (inserted after read-claude)
      // Step 3: Create branch
      expect(result).toContain("Step 1: Read @claude.md");
      expect(result).toContain("Step 2:");
      expect(result).toContain("<undesired_behavior>");
      expect(result).toContain("Step 3: Create branch");
      expect(result).not.toContain("Read file @claude.md");
    });

    it("generates prompt without read-claude when user removes it", () => {
      const state = baseState({
        task: { flow_id: "review" },
        panel_a: {
          description: "Check code",
          issue_number: null,
          pr_number: 5,
          files: [],
        },
        steps: {
          enabled_steps: [
            {
              id: "review-pr",
              operation: "analyze",
              object: "pull_request",
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).not.toContain("Read @claude.md");
      // Task step is Step 1, review-pr is Step 2
      expect(result).toContain("Step 1:");
      expect(result).toContain("<review_subject>");
      expect(result).toContain("Step 2: Analyze pull_request");
    });
  });

  describe("step name_provided field", () => {
    it("includes name_provided in step output when user provides a name", () => {
      const state = baseState({
        steps: {
          enabled_steps: [
            {
              id: "create-branch",
              operation: "create",
              object: "branch",
              name_provided: "feat/my-feature",
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("Create branch — name it feat/my-feature");
    });

    it("omits name when name_provided is not set (default — let LLM decide)", () => {
      const state = baseState({
        steps: {
          enabled_steps: [
            {
              id: "create-branch",
              operation: "create",
              object: "branch",
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("Create branch");
      expect(result).not.toContain("name it");
    });

    it("omits name when name_provided is empty string", () => {
      const state = baseState({
        steps: {
          enabled_steps: [
            {
              id: "commit-pr",
              operation: "commit",
              object: "changes",
              name_provided: "",
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("Commit changes");
      expect(result).not.toContain("name it");
    });
  });

  describe("review output modes", () => {
    it("generates pr_comment feedback for review flow", () => {
      const state = baseState({
        task: { flow_id: "review" },
        steps: {
          enabled_steps: [
            {
              id: "provide-feedback-pr",
              operation: "create",
              object: "review_feedback",
              output: "pr_comment",
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("Provide feedback as a PR comment");
      expect(result).toContain("link to PR comment");
    });

    it("generates pr_inline_comments feedback for review flow", () => {
      const state = baseState({
        task: { flow_id: "review" },
        steps: {
          enabled_steps: [
            {
              id: "provide-feedback-pr",
              operation: "create",
              object: "review_feedback",
              output: "pr_inline_comments",
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("PR inline comments at relevant line numbers");
    });

    it("generates issue_comment feedback for review flow", () => {
      const state = baseState({
        task: { flow_id: "review" },
        steps: {
          enabled_steps: [
            {
              id: "provide-feedback-pr",
              operation: "create",
              object: "review_feedback",
              output: "issue_comment",
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("feedback as a GitHub issue comment");
      expect(result).toContain("link to issue comment");
    });

    it("generates report_file feedback for review flow", () => {
      const state = baseState({
        task: { flow_id: "review" },
        steps: {
          enabled_steps: [
            {
              id: "provide-feedback-pr",
              operation: "create",
              object: "review_feedback",
              output: "report_file",
            },
          ],
        },
      });
      const result = buildPrompt(state);
      expect(result).toContain("analysis report file in the repository");
      expect(result).toContain("Commit the report file");
    });

    it('generates default "here" feedback for review flow with no output mode', () => {
      const state = baseState({ task: { flow_id: "review" } });
      const result = buildPrompt(state);
      expect(result).toContain(
        "Provide concise feedback to HUMAN (me) here (in this interface)",
      );
    });
  });
});
