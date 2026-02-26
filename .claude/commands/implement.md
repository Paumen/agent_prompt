Implement the REQUIREMENT or phase specified by the user (e.g. STP-01, or phase 6).

Steps:

1. Read `spec/implementation-plan.md` and find the specified requirements and checklist items for incated phase. The file also helps you understand what has already been implemented.
2. Read `spec/spec_concept.md` and find the exact details per requirement.
3. Read `src/config/flows.yaml` for any relevant flow/task/step configuration.
4. **Before writing any code**: summarize your implementation plan and wait for the user to confirm. And ask clarification questions if t thing are unclear. Ask 3 extra questions to to user to make sure you are on the same page and to get direction on undersspecified requirements or items.
5. Challenge human if requirement implementation would be complex and/or alternative might be preferred, propose but let human decide.
6.  Write tests for the implemented feature. 
7. Set the requirement status to `In progress` in the Implementation Status table.
8. Implement the feature following the conventions in CLAUDE.md.
9. Execute tests written at Step 7 + Run `npm run build` to verify no build errors.
10. Update the the requirement status table in the Implementation Status table in `spec/spec_concept.md`.
11. Update the checklist items in `spec/implementation-plan.md`.
12. Log most significant technical decisions (if any in the Decisions Log section of `spec/spec_concept.md`.
13. Create a PR using the PR template, referencing the requirement IDs.

Note: Only the PO can move a requirement to `🏁 Approved` (after UAT review).
