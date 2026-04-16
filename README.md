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
| `orcastrator run "<task>" -v` | Execute with verbose activity panel |
| `orcastrator run "<task>" -q` | Execute with minimal output (spinner only) |
| `orcastrator run "<task>" -a <name>` | Force routing to a specific agent |
| `orcastrator run "<task>" --pr` | Execute and open a PR with results when done |
| `orcastrator run "<task>" --dry-run` | Preview routing decision without executing |
| `orcastrator chat` | Start an interactive multi-turn chat session |
| `orcastrator chat -v` | Chat with verbose activity panel |
| `orcastrator chat -a <name>` | Lock chat to a specific agent (bypass routing) |
| `orcastrator issue <number>` | Work on a GitHub issue (e.g. `42`) |
| `orcastrator issue <identifier>` | Work on a Linear issue (e.g. `ENG-123`) |
| `orcastrator issue <ref> -a <name>` | Force a specific agent to handle the issue |
| `orcastrator issue <ref> -r <owner/repo>` | Specify GitHub repo (defaults to git remote) |
| `orcastrator issue <ref> -p <github\|linear>` | Override provider auto-detection |
| `orcastrator issue <ref> --pr` | Open a PR on completion |
| `orcastrator list` | List open issues (Linear or GitHub) |
| `orcastrator list --provider linear --team ENG` | List open Linear issues for a team |
| `orcastrator list --mine` | List issues assigned to you |
| `orcastrator list -r <owner/repo>` | List GitHub issues for a specific repo |
| `orcastrator doctor` | Check environment and config health |
| `orcastrator nap` | Compress history and prune old logs |
| `orcastrator nap --dry-run` | Preview what `nap` would clean |
| `orcastrator nap --keep <n>` | Keep last N history entries (default: 20) |
| `orcastrator export [file]` | Export config + state to a JSON snapshot |
| `orcastrator import <file>` | Import config + state from a snapshot |
| `orcastrator import <file> --no-merge` | Overwrite instead of merging |
| `orcastrator status` | Show agents, routing, and recent sessions |
| `orcastrator agents list` | List configured agents with model and charter status |
| `orcastrator agents create "<description>"` | Generate a new agent via Copilot and add it to config |

The issue provider is **auto-detected**: identifiers like `ENG-123` route to Linear; plain numbers like `42` route to GitHub. Use `--provider` to override.

### agents list

`orcastrator agents list` prints each configured agent with its resolved model, expertise, and whether the charter file has been built:

```
Team: my-project

backend-dev
  Role:      Backend Engineer
  Model:     claude-sonnet-4.6
  Expertise: TypeScript, Node.js, databases
  Charter:   ✓ built

frontend-dev
  Role:      Frontend Engineer
  Model:     claude-haiku-4.5
  Expertise: React, CSS, accessibility
  Charter:   ✗ run build
```

### agents create

`orcastrator agents create` uses Copilot to generate a new agent definition from a plain-English description, then interactively adds it to your config:

```bash
# Prompted interactively if no description is given
npx orcastrator agents create "a database migration specialist"

# Or provide it inline
npx orcastrator agents create "an accessibility reviewer who audits HTML and ARIA"
```

Orcastrator calls Copilot with your existing team as context, generates a `defineAgent(...)` block and matching routing rules, shows a preview, asks for confirmation, rewrites `orcastrator.config.ts`, and auto-runs `orcastrator build` — all in one step.

**Resilient JSON parsing:** If Copilot returns prose or markdown instead of raw JSON, `agents create` automatically retries with a stricter follow-up prompt before surfacing an error. No manual retries needed.

**Non-destructive config rewrite:** `generateUpdatedConfigSource()` reconstructs `orcastrator.config.ts` from the in-memory config object, preserving all optional sections — `skills`, `linear`, `modelTiers`, and `guardrails` — exactly as they were. Runtime hook functions (e.g. `preToolUse`) are serialized as `guardrails: true` since closures can't round-trip through source generation.

**ESM cache bypass:** After writing the new config file, `agents create` runs `orcastrator build` against the updated in-memory config object — never re-imports the config file from disk, which would serve a stale cached module.

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

  // Optional: enable guardrails (true = all defaults, or customize)
  guardrails: {
    blockedCommands: ["rm -rf /", "git push --force"],  // deny-list (merged with defaults)
    allowedWritePaths: ["src/**", "tests/**"],           // glob paths agents may write to
    preToolUse: [                                         // custom hook — runs before every tool call
      async ({ toolName, toolArgs, cwd }) => {
        if (toolName === "write_file" && /* dangerous path check */ false) {
          return { decision: "deny", reason: "protected path" };
        }
        return { decision: "allow" };
      },
    ],
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

## Guardrails

Guardrails are opt-in safety policies that run before and after every agent tool call. Enable them in config with `guardrails: true` (all defaults) or a config object:

```typescript
guardrails: {
  // Shell commands that are always denied — merged with the built-in deny list
  blockedCommands: ["my-dangerous-script"],

  // Glob patterns for paths agents are allowed to write to (default: "**")
  allowedWritePaths: ["src/**", "tests/**", "docs/**"],

  // Hook called before every tool execution — return "deny" to block
  preToolUse: [
    async ({ toolName, toolArgs, cwd }) => {
      return { decision: "allow" };  // or { decision: "deny", reason: "..." }
    },
  ],

  // Hook called after every tool execution — can modify the result
  postToolUse: [
    async ({ toolName, toolResult, cwd }) => {
      return {};  // or { modifiedResult: ... }
    },
  ],
}
```

**Built-in blocked commands** (always active when guardrails are enabled):
`rm -rf /`, `rm -rf ~`, `git push --force`, `chmod 777`, `chmod -R 777`, fork bombs, disk-wipe patterns, and similar destructive operations.

`guardrails: true` applies all defaults without customization. Omitting `guardrails` entirely disables the system.

## Response Tiers

Orcastrator automatically classifies task complexity before routing to avoid over-spending on simple requests:

| Tier | Trigger | Model tier | Max agents | Timeout |
|------|---------|-----------|-----------|---------|
| `direct` | Short greetings / `hi`, `help`, `status` | none (inline reply) | 0 | — |
| `lightweight` | `list`, `show`, `find`, `rename`, `check` keywords | `fast` | 1 | 30s |
| `standard` | Default — any task not matched above | `standard` | 1 | 120s |
| `full` | `refactor entire`, `implement feature`, `security audit`, `multi-agent` | `premium` | 5 | 300s |

Tier selection maps to `modelTiers` in your config. The `tier.selected` event is emitted on every task so you can observe decisions in the activity panel or event bus subscribers.

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
| `tier.selected` | `{ task, tier, reason }` |
| `task.started` | `{ task, agents }` |
| `agent.spawned` | `{ agentName, success }` |
| `agent.completed` | `{ agentName, success, duration? }` |
| `task.completed` | `{ strategy, duration, agentCount }` |
| `agent.intent` | `{ agentName, intent }` |
| `agent.turn.start` | `{ agentName, turnId }` |
| `agent.turn.end` | `{ agentName, turnId }` |
| `agent.tool.start` | `{ agentName, toolCallId, toolName, args? }` |
| `agent.tool.progress` | `{ agentName, toolCallId, message }` |
| `agent.tool.complete` | `{ agentName, toolCallId, toolName, success, snippet? }` |
| `agent.subagent.started` | `{ agentName, subagentName, description }` |

The `agent.*` events are relayed from Copilot SDK session events via the **EventRelay** (`src/agents/event-relay.ts`), which auto-attaches to every agent session in `AgentLifecycleManager.spawnAgent()` and is cleanly detached when `destroyAgent()` is called. These events power the live activity panel in the CLI.

Subscribe to any event from your own code via `getEventBus()`:

```typescript
import { getEventBus } from "orcastrator/event-bus";

getEventBus().on("agent.tool.start", ({ agentName, toolName }) => {
  console.log(`[${agentName}] started tool: ${toolName}`);
});
```

## Activity Panel

When agents are working, the CLI displays a live activity panel showing what each agent is doing in real-time:

```
  ┌ backend-dev ──────────────────────────
  │ ⚡ Reading src/api/routes.ts
  │    Turn 3 · 2 tool calls · 12s
  └──────────────────────────────────────
```

Multi-agent tasks show stacked panels:

```
  ┌ backend-dev ──────────────────────────
  │ ✏️ Editing src/api/routes.ts
  │    Turn 5 · 8 tool calls · 24s
  ├ frontend-dev ─────────────────────────
  │ 🔍 Searching for component usage
  │    Turn 2 · 3 tool calls · 18s
  └──────────────────────────────────────
```

### Verbosity levels

| Flag | Behavior |
|------|----------|
| (default) | Activity panel with intent, tool names, turn count, timing |
| `-v, --verbose` | Panel + truncated tool arguments |
| `-q, --quiet` | Spinner only (for CI or piping) |

In `run` mode the panel persists as a summary after completion. In `chat` mode it clears when the response arrives.

## Chat Slash Commands

Inside `orcastrator chat`, type a `/command` at the prompt to control the session without sending a message to an agent:

| Command | Description |
|---------|-------------|
| `/help` | Print the slash command reference |
| `/exit` | Exit the chat session cleanly |
| `/quit`, `/q` | Aliases for `/exit` |
| `/clear` | Wipe conversation history (agent sessions stay warm) |
| `/history` | Print the full conversation history for this session |
| `/status` | Show routing mode, turn count, and active agents |
| `/agent <name>` | Lock all subsequent messages to a specific agent |
| `/switch <name>` | Alias for `/agent` |
| `/auto` | Return to automatic routing (cancels any agent lock) |

History is capped at 20 turns (10 full exchanges) and trimmed automatically — older context is dropped to keep prompts from growing unbounded. Agent sessions stay alive across turns so models don't lose in-process state when the history window rolls.

## Orca Animation

When you start `orcastrator chat`, the terminal plays a multi-phase underwater animation before the REPL prompt appears:

| Phase | Description |
|-------|-------------|
| 1 — Bubbles rise | `◦ ° ○` bubble characters fill the frame from nothing, bottom to top |
| 2 — Waves crash | Three cyan wave rows (`﹏⊹˖·`) roll in from the top, pushing bubbles down |
| 3 — Underwater drift | Waves scroll and bubbles drift for ~1 second |
| 4 — Settle | Frame collapses row-by-row as the dive completes |
| 5 — Title reveal | Pixel-art `ORCASTRATOR` logo fades in line-by-line (skipped on narrow terminals) |

The animation is **terminal-width-responsive**: bubble positions are computed as fractional offsets of the actual column count so the layout never wraps or clips. The pixel-art title requires at least 67 columns; on narrower terminals Phase 5 is silently skipped.

## Orca Tamagotchi

`src/cli/orca-tamagotchi.ts` provides a reusable orca character renderer used for CLI welcome screens and status displays.

```typescript
import { renderOrcaCharacter, renderOrcaGreeting } from "./orca-tamagotchi.js";

// Render the ASCII orca in a given mood (returns string[])
const lines = renderOrcaCharacter("excited");

// Render a full greeting block (orca + title + hint line)
console.log(renderOrcaGreeting("my-project"));
```

**Available moods:**

| Mood | Eye | Mouth | When used |
|------|-----|-------|-----------|
| `happy` | `◉` | `‿‿` | Default / idle |
| `excited` | `★` | `▽▽` | Task started |
| `working` | `◈` | `──` | Agent is executing |
| `thinking` | `◉` | `··` | Routing / planning |
| `sleeping` | `–` | `___` | Nap / history compression |

`renderOrcaCharacter(mood)` returns raw lines (~20 visible chars each) with no surrounding decoration — callers are responsible for margins or box-drawing. `renderOrcaGreeting(name?)` composes the character with a bold title and a `/help` hint line.



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
│  create → Attach relay → Send    │
└──────────┬───────────────────────┘
           │         │
           ▼         ▼
┌─────────────┐  ┌─────────────────┐
│ Copilot SDK │  │  Event Relay    │
│             │──│  SDK events →   │
│             │  │  OrcaEventBus   │
└─────────────┘  └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ActivityRenderer  │
                 │ Live TUI panel  │
                 └─────────────────┘
```

## `.orcastrator/` Directory

Orcastrator keeps all runtime state in `.orcastrator/` at your project root. This directory is committed to git so agent decisions and history travel with your repo.

| Path | Description |
|------|-------------|
| `decisions.md` | Shared team decisions injected into every agent's system prompt |
| `routing.md` | Human-readable routing rules (generated by `orcastrator build`) |
| `agents/<name>/charter.md` | Per-agent charter / system prompt (generated by `orcastrator build`) |
| `agents/<name>/history.md` | Per-agent learning log — updated after every task |
| `skills/<name>/SKILL.md` | Markdown-based skill plugins with YAML frontmatter |
| `log/` | Session logs written as JSON after every task |

The `decisions.md` file is the best place to record project-wide conventions you want every agent to know (e.g. "always use Zod for validation", "never commit API keys"). Edit it directly — it's injected verbatim.

## Development

```bash
npm run build       # tsc → compiles src/ to dist/
npm run dev         # tsc --watch (recompile on save)
npm run typecheck   # tsc --noEmit (type-check without emitting)
npm run test        # vitest run (single pass)
npm run test:watch  # vitest (watch mode)
```

## Requirements

- Node.js ≥ 22.0.0
- `gh` CLI (for GitHub issue/PR commands)
- GitHub Copilot access (authenticated via `gh auth login`)
- `LINEAR_API_KEY` env var (for Linear issue workflows)

## License

MIT
