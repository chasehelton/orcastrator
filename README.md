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
| `orcastrator issue <number>` | Work on a GitHub issue |
| `orcastrator status` | Show agents, routing, and recent sessions |
| `orcastrator agents list` | List configured agents |

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
});
```

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
- `gh` CLI (for issue/PR commands)
- GitHub Copilot access (authenticated via `gh auth login`)

## License

MIT
