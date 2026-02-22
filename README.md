# Agent Prompt

Prompt generator web app for AI-powered GitHub automation.

**Live app**: [https://paumen.github.io/agent_prompt/](https://paumen.github.io/agent_prompt/)

## Status

Repository setup complete. Implementation phase starting.

## What This App Does

Generates structured prompts for AI agents to perform code review, analysis, and automation tasks on GitHub repositories. Users select a flow (e.g. Review PR, Fix PR, Create from spec), configure scope and options, and the app produces a ready-to-use prompt.

## Repository Structure

| Path                    | Purpose                               |
| ----------------------- | ------------------------------------- |
| `spec/spec_concept.md`  | Product specification (authoritative) |
| `src/`                  | Application source code               |
| `src/config/flows.yaml` | Flow/task/step definitions            |
| `tests/`                | Automated tests                       |
| `.github/workflows/`    | CI pipeline + GitHub Pages deployment |
| `CLAUDE.md`             | Claude Code project instructions      |

## Development

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # Check code quality
npm test          # Run tests
```

Requires Node.js 20+. See `CLAUDE.md` for full conventions and workflow.
