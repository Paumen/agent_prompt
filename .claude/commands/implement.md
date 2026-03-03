Implement the REQUIREMENT or phase specified by the user (e.g. STP-01, or phase C5).

Steps:

1. Read `@SPEC/STAGE_*` RELEVANT TO THE PHASE and find the  checklist items for indicated phase. The file also helps you understand what has already been implemented.
2. Read `spec/spec_concept.md` to understand overall requirements.
3. **Before writing any code**: summarize your plan and wait for the user to confirm. Ask 3 extra questions to  user to make sure you are on the same page and to get direction on undersspecified requirements or items.
4. Challenge human if requirement implementation would be complex and/or alternative might be preferred, propose but let human decide.
5. Implement the feature following the conventions in CLAUDE.md.
6. Execute tests + Run `npm run build` to verify no build errors.`.
7. Update the checklist items in `spec/STAGE_C.md`.
8. If any new key product or Architecture decisions are made log in the Decisions Log section of `spec/spec_concept.md`.
9. Test if `https://paumen.github.io/agent_prompt/` updated and works as expected. If user testing is possible or required let user know.
10. Commit Changes and push. 
