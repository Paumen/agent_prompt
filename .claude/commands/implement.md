Implement the requirement specified by the user (e.g. SPEC-ENG-01).

Steps:

1. Read `spec_concept.md` and find the specified requirement.
3. Read `src/config/flows.yaml` for any relevant flow/task/step configuration.
4. **Before writing any code**: summarize your implementation plan and wait for the user to confirm.
5. Challange human if requirement implementation would be complex and/or alternative might be preferred, propose but let human decide.
6. Implement the feature following the conventions in CLAUDE.md.
7. Write tests for the implemented feature.
8. Run `npm run build` to verify no build errors.
9. Update the Implementation Status table at the bottom of `spec_concept.md` (change status from `pending` to `implemented`).
10. Log any significant technical decisions in the Decisions Log section of `spec_concept.md`.
11. Create a PR using the PR template, referencing the requirement ID.
