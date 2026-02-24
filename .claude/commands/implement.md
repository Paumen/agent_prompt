Implement the requirement specified by the user (e.g. SPEC-ENG-01).

Steps:

1. Read `spec/spec_concept.md` and find the specified requirement.
2. If you need more context about task schemas, lenses, or flow configurations, search the brainstorm file (`spec/spec_and_framework_and_schemas_trade-offs.md`) for the relevant section only — do NOT read the entire file.
3. Read `src/config/flows.yaml` for any relevant flow/task/step configuration.
4. **Before writing any code**: summarize your implementation plan and wait for the user to confirm.
5. Challenge human if requirement implementation would be complex and/or alternative might be preferred, propose but let human decide.
6. Set the requirement status to `In progress` in the Implementation Status table.
7. Implement the feature following the conventions in CLAUDE.md.
8. Write tests for the implemented feature. Update the relevant test columns (Unit / SIT) in the status table as tests pass (`◻` → `✅`, or `❌` if failing).
9. Run `npm run build` to verify no build errors.
10. Set the requirement status to `Testing` in the Implementation Status table.
11. Log any significant technical decisions in the Decisions Log section of `spec/spec_concept.md`.
12. Create a PR using the PR template, referencing the requirement ID.

Note: Only the PO can move a requirement to `🏁 Approved` (after UAT review).
