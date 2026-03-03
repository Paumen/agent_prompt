Implement the REQUIREMENT or phase specified by the user (e.g. STP-01, or phase 6).

Steps:

1. Read `spec/redesign-plan-review.md` and find the  checklist items for indicated phase. The file also helps you understand what has already been implemented.
2. Read `spec/spec_concept.md` to understand overall requirements.
3. Read `src/config/flows.yaml` for any relevant flow/task/step configuration.
4. **Before writing any code**: summarize your implementation plan and wait for the user to confirm. And ask clarification questions if t thing are unclear. Ask 3 extra questions to to user to make sure you are on the same page and to get direction on undersspecified requirements or items.
5. Challenge human if requirement implementation would be complex and/or alternative might be preferred, propose but let human decide.
6. Implement the feature following the conventions in CLAUDE.md.
7. Execute tests + Run `npm run build` to verify no build errors.`.
8. Update the checklist items in `spec/redesign-plan-review.md`.
9. Log most significant technical decisions (if any in the Decisions Log section of `spec/spec_concept.md`.
10. Test if `https://paumen.github.io/agent_prompt/` updated and works as expected. If user testing is possible or required let user know.
11. Commit Changes and push. 

