import { defineOrcastrator, defineAgent, defineRouting } from "@chasehelton/orcastrator";

export default defineOrcastrator({
  name: "orcastrator",
  defaultModel: "claude-sonnet-4.6",

  agents: [
    defineAgent({
      name: "core-dev",
      role: "Core Runtime Engineer",
      expertise: ["TypeScript", "multi-agent orchestration", "CLI tooling", "Node.js ESM", "GitHub Copilot SDK", "async coordination", "Promise.allSettled fan-out patterns"],
      instructions: `You are the primary engineer for the orcastrator runtime. You work across src/core/, src/agents/, src/client/, and src/state/ to implement and maintain the coordination engine, routing logic, lifecycle management, and state backends. Always use strict TypeScript with NodeNext module resolution, follow the existing ESM import conventions, and ensure all changes are compatible with Node >=22.`,
    }),
    defineAgent({
      name: "cli-dev",
      role: "CLI & UX Engineer",
      expertise: ["TypeScript", "commander.js", "ora spinners", "chalk", "CLI UX", "argument parsing", "interactive prompts"],
      instructions: `You own the src/cli/ layer and src/index.ts entrypoint. Implement and refine CLI commands (init, build, run, issue, status, agents) using commander.js, ora for spinners, and chalk for output styling. Keep commands thin — delegate business logic to core modules and surface clear, actionable error messages to the user.`,
    }),
    defineAgent({
      name: "config-architect",
      role: "Config & Init Architect",
      expertise: ["TypeScript", "Zod schema design", "config DSL authoring", "repo scanning", "code generation", "GitHub Copilot SDK", "prompt engineering"],
      model: "claude-opus-4.6",
      instructions: `You are responsible for src/config/, src/init/, and src/skills/ — the systems that scan repos, generate agent charters, and produce orcastrator.config.ts files. Design expressive, type-safe config schemas with Zod, craft effective Copilot prompts in prompt-builder.ts for repo analysis, and ensure generated configs are idiomatic and immediately useful to new users.`,
    }),
    defineAgent({
      name: "guardrails-dev",
      role: "Guardrails & Safety Engineer",
      expertise: ["TypeScript", "permission modelling", "hook systems", "policy enforcement", "zod validation", "security boundaries"],
      instructions: `You own src/guardrails/ — defaults, hooks, permission-handler, and types. Design and enforce safety policies, permission gates, and lifecycle hooks that prevent agents from taking destructive actions. Keep guardrail logic decoupled from core so it can be composed and overridden without modifying runtime internals.`,
    }),
    defineAgent({
      name: "git-github-dev",
      role: "Git & GitHub Integration Engineer",
      expertise: ["TypeScript", "git worktrees", "GitHub REST API", "pull requests", "issue tracking", "branch management"],
      instructions: `You own src/git/ and src/github/, covering worktree isolation, PR creation, and issue-driven workflows. Implement robust worktree lifecycle management so parallel agents operate in isolated branches, and ensure GitHub integrations in pr.ts and issues.ts handle API errors gracefully and produce clean, well-described pull requests.`,
    }),
  ],

  routing: defineRouting({
    rules: [
      { pattern: /cli|command|ux|spinner|output|chalk|prompt|init|status/, agents: ["cli-dev"], description: "CLI commands, user-facing output, and interactive prompts" },
      { pattern: /config|schema|charter|skill|template|scan|generate config|orcastrator\.config/, agents: ["config-architect"], description: "Config DSL, agent charter generation, repo scanning, and skill registry" },
      { pattern: /guardrail|permission|hook|policy|safety|restrict|allow|deny/, agents: ["guardrails-dev"], description: "Permission models, lifecycle hooks, and safety enforcement" },
      { pattern: /git|worktree|branch|pr|pull request|issue|github/, agents: ["git-github-dev"], description: "Git worktree management and GitHub API integrations" },
      { pattern: /coordinator|router|fan.out|lifecycle|state|history|decision|model.selector|agent runtime/, agents: ["core-dev"], description: "Core runtime: coordination, routing, fan-out, and state management" },
      { pattern: /refactor|redesign|architect|overhaul|restructure|rethink/, agents: ["core-dev", "config-architect", "guardrails-dev"], description: "Complex cross-cutting changes requiring multi-agent collaboration" },
    ],
    defaultAgent: "core-dev",
  }),

  skills: [],
});
