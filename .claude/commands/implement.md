Implement the REQUIREMENT or phase specified by the user (e.g. req/spec STP-01, or phase C5, or step D401).

Steps:

1. Read `@SPEC/STAGE_*` RELEVANT TO THE Phase (e.g. `@SPEC/STAGE_E` for phase E8)= and find the checklist items for indicated phase. The file also helps you understand what has already been implemented. Trust that anything marked/checked as done is indeed done. No need to explore full code base to verify.
2. **Before writing any code**:

- summarize your next steps consicely, no need to repeat what's already in the plan/spec file, and wait for the PO/user to confirm. Minimize extreme e technical jargon.
- Ask 3-4 extra questions to user to make sure you are on the same page and to get direction on undersspecified requirements or items.
- If requirement/implementation would be complex, overengineered and/or alternative might be preferable, challenge PO/user, propose but let human decide.

3. Implement the feature

- following the conventions in `CLAUDE.md`.
- For css edit, style, or significant layout/architecture changes follow `@.claude/workflows/css-guide.md`

4. Execute relevant checks and tests

- Run relevant auto fixes: Stylelint --fix, prettier
- Run relevant linters: stylelint, prettier, eslint.
- Update test suite if relevant
- Execute tests
- Run `npm install` + Run `npm run build` to verify no build errors.

5. Update the checklist items in `spec/STAGE_*.md`.
6. Test if `https://paumen.github.io/agent_prompt/` updated and works as expected + give user consice checklist in plain English to test UI (if relevant changes.
7. Commit Changes and push.
