# 🐋 Orcastrator

Lightweight CLI-first multi-agent coding runtime built on [GitHub Copilot SDK](https://github.com/github/copilot-sdk).

Inspired by [bradygaster/squad](https://github.com/bradygaster/squad), stripped down to the essentials.

## Quick Start

```bash
# Initialize in your project (analyzes repo via Copilot to generate tailored agents)
npx orcastrator init

# Or use the default template without Copilot
npx orcastrator init --default

# Customize your agents
vim orcastrator.config.ts

# Generate agent charters
npx orcastrator build

# Run an ad-hoc task
npx orcastrator run "build the login page"

# Work on a GitHub issue
npx orcastrator issue 42

# Work on a Linear issue (auto-detected from identifier format)
npx orcastrator issue ENG-123

# List open issues (auto-detects provider from config)
npx orcastrator list
```

## How It Works

1. **Define agents** — `orcastrator init` scans your repo and uses Copilot to generate a tailored agent team in `orcastrator.config.ts`
2. **Build charters** — config generates markdown files in `.orcastrator/` that become system prompts
3. **Route tasks** — pattern matching routes your task to the right agent(s)
4. **Fan out** — multi-agent tasks run in parallel via `Promise.allSettled`
5. **Learn** — decisions and history are logged to `.orcastrator/` and committed to git

## CLI Commands

| Command | Description |
|---------|-------------|
| `orcastrator init` | Scaffold config with Copilot-powered agent generation |
| `orcastrator init --default` | Scaffold config with default agent template |
| `orcastrator build` | Generate markdown from config |
| `orcastrator run "<task>"` | Execute an ad-hoc task |
| `orcastrator issue <number>` | Work on a GitHub issue (e.g. `42`) |
| `orcastrator issue <identifier>` | Work on a Linear issue (e.g. `ENG-123`) |
| `orcastrator list` | List open issues (Linear or GitHub) |
| `orcastrator list --provider linear --team ENG` | List open Linear issues for a team |
| `orcastrator list --mine` | List issues assigned to you |
| `orcastrator doctor` | Check environment and config health |
| `orcastrator nap` | Compress history and prune old logs |
| `orcastrator nap --dry-run` | Preview what `nap` would clean |
| `orcastrator nap --keep <n>` | Keep last N history entries (default: 20) |
| `orcastrator export [file]` | Export config + state to a JSON snapshot |
| `orcastrator import <file>` | Import config + state from a snapshot |
| `orcastrator import <file> --no-merge` | Overwrite instead of merging |
| `orcastrator status` | Show agents, routing, and recent sessions |
| `orcastrator agents list` | List configured agents |

The issue provider is **auto-detected**: identifiers like `ENG-123` route to Linear; plain numbers like `42` route to GitHub. Use `--provider` to override.

## Config

```typescript
import { defineOrcastrator, defineAgent, defineRouting } from "orcastrator";

export default defineOrcastrator({
  name: "my-project",
  defaultModel: "claude-sonnet-4.6",

  agents: [
    defineAgent({
      name: "architect",
      role: "System Architect",
      expertise: ["system design", "API design"],
      model: "claude-opus-4.6",
      instructions: "You design clean, scalable systems.",
    }),
    defineAgent({
      name: "builder",
      role: "Implementation Engineer",
      expertise: ["TypeScript", "React", "Next.js"],
      instructions: "You write production-quality code with tests.",
    }),
  ],

  routing: defineRouting({
    rules: [
      { pattern: /design|architect/, agents: ["architect"] },
      { pattern: /build|implement|fix/, agents: ["builder"] },
    ],
    defaultAgent: "builder",
  }),

  // Optional: tiered model selection
  modelTiers: {
    fast: "claude-haiku-4.5",       // lightweight tasks
    standard: "claude-sonnet-4.6",  // default (falls back to defaultModel)
    premium: "claude-opus-4.6",     // complex multi-agent tasks
  },

  // Optional: enable skills loaded from .orcastrator/skills/
  skills: ["code-review", "testing"],

  // Optional: configure Linear integration
  linear: {
    defaultTeam: "ENG",  // Used by `orcastrator list` when no --team flag is given
  },
});
```

### Linear setup

1. Generate a personal API key at [linear.app/settings/account/security](https://linear.app/settings/account/security)
2. Set it as an environment variable: `export LINEAR_API_KEY=lin_api_...`
3. Optionally add `linear: { defaultTeam: "ENG" }` to your config for `orcastrator list` filtering

When working on a Linear issue, orcastrator will automatically:
- Mark the issue **In Progress** when work starts
- Post a PR comment and mark the issue **In Review** when a PR is created (`--pr` flag)

## Skills

Skills are markdown-based plugins loaded from `.orcastrator/skills/`. Each skill is a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: code-review
domain: quality
triggers:
  - review
  - lint
---

You are a code review specialist...
```

Skills are matched against task text via their `triggers` regex patterns and injected into agent charters automatically. Enable skills in your config with the `skills` array.

## Event Bus

Orcastrator emits typed events during task execution for observability and tooling:

| Event | Payload |
|-------|---------|
| `tier.selected` | `{ tier, model, reason }` |
| `task.started` | `{ task }` |
| `agent.spawned` | `{ agent, model }` |
| `agent.completed` | `{ agent, duration }` |
| `task.completed` | `{ task, agents, duration }` |

## Architecture

```
User (CLI)
    │
    ▼
┌──────────────────────────────────┐
│           Coordinator            │
│  Route → Spawn → Execute → Log  │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│    Agent Lifecycle Manager       │
│  Charter compile → Session       │
│  create → Send task → Collect    │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│      GitHub Copilot SDK          │
└──────────────────────────────────┘
```

## Requirements

- Node.js ≥ 22.0.0
- `gh` CLI (for GitHub issue/PR commands)
- GitHub Copilot access (authenticated via `gh auth login`)
- `LINEAR_API_KEY` env var (for Linear issue workflows)

## License

MIT
