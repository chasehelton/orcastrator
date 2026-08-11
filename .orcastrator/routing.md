# Routing Rules

**Default agent:** core-dev

## Rules

| Pattern | Agents | Description |
|---------|--------|-------------|
| `cli|command|ux|spinner|output|chalk|prompt|init|status` | cli-dev | CLI commands, user-facing output, and interactive prompts |
| `config|schema|charter|skill|template|scan|generate config|orcastrator\.config` | config-architect | Config DSL, agent charter generation, repo scanning, and skill registry |
| `guardrail|permission|hook|policy|safety|restrict|allow|deny` | guardrails-dev | Permission models, lifecycle hooks, and safety enforcement |
| `git|worktree|branch|pr|pull request|issue|github|linear|ENG-\d+` | git-github-dev | Git worktree management, GitHub API integrations, and Linear issue workflows |
| `coordinator|router|fan.out|lifecycle|state|history|decision|model.selector|agent runtime` | core-dev | Core runtime: coordination, routing, fan-out, and state management |
| `refactor|redesign|architect|overhaul|restructure|rethink` | core-dev, config-architect, guardrails-dev | Complex cross-cutting changes requiring multi-agent collaboration |
| `docs|documentation|readme|changelog|onboard|copilot-instructions|agent file|.md` | docs-dev | Route documentation, README updates, and agent file maintenance to docs-dev |
| `undocumented|document this|add docs|update docs|missing docs|document the` | docs-dev | Route requests to document new or existing features to docs-dev |
| `new user|getting started|onboarding|usage example|feature guide` | docs-dev | Route onboarding content and usage guide work to docs-dev |
| `joke|pun|funny|laugh|humor|humour|comedy|cheer up|make me smile|dad joke` | joke-bot | Route any explicit requests for jokes, puns, or humor to the joke-bot |
| `tell me a|give me a|got any|know any|hear the one` | joke-bot | Route casual 'tell me a joke' style prompts to the joke-bot |
