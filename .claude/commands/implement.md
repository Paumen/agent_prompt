Implement the REQUIREMENT or phase specified by the user (e.g. req/spec STP-01, or phase C5, or step D401).

Steps:

1. Read `@SPEC/STAGE_*` RELEVANT TO THE Phase (e.g. `@SPEC/STAGE_E` for phase E8)= and find the checklist items for indicated phase. The file also helps you understand what has already been implemented.
2. **Before writing any code**: summarize your plan and wait for the user to confirm. Ask 3 extra questions to user to make sure you are on the same page and to get direction on undersspecified requirements or items.
3. Challenge human if requirement implementation would be complex and/or alternative might be preferred, propose but let human decide.
4. Implement the feature following the conventions in CLAUDE.md.
5. Execute tests + Run `npm install` + Run `npm run build` to verify no build errors.
6. Update the checklist items in `spec/STAGE_C.md`.
7. Test if `https://paumen.github.io/agent_prompt/` updated and works as expected. If user testing is possible or required let user know.
8. Commit Changes and push.
