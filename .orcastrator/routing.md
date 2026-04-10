# Routing Rules

**Default agent:** core-dev

## Rules

| Pattern | Agents | Description |
|---------|--------|-------------|
| `cli|command|ux|spinner|output|chalk|prompt|init|status` | cli-dev | CLI commands, user-facing output, and interactive prompts |
| `config|schema|charter|skill|template|scan|generate config|orcastrator\.config` | config-architect | Config DSL, agent charter generation, repo scanning, and skill registry |
| `guardrail|permission|hook|policy|safety|restrict|allow|deny` | guardrails-dev | Permission models, lifecycle hooks, and safety enforcement |
| `git|worktree|branch|pr|pull request|issue|github` | git-github-dev | Git worktree management and GitHub API integrations |
| `coordinator|router|fan.out|lifecycle|state|history|decision|model.selector|agent runtime` | core-dev | Core runtime: coordination, routing, fan-out, and state management |
| `refactor|redesign|architect|overhaul|restructure|rethink` | core-dev, config-architect, guardrails-dev | Complex cross-cutting changes requiring multi-agent collaboration |
