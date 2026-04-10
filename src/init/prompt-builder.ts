// Prompt builder — constructs the LLM prompt for agent generation

import type { RepoContext } from "./repo-scanner.js";
import { contextToPromptPayload } from "./repo-scanner.js";

const RESPONSE_SCHEMA = `{
  "projectName": "string (kebab-case, e.g. 'my-project')",
  "defaultModel": "string (e.g. 'claude-sonnet-4.6')",
  "agents": [
    {
      "name": "string (lowercase kebab-case, e.g. 'backend-dev')",
      "role": "string (short title, e.g. 'Backend Engineer')",
      "expertise": ["string[]"],
      "model": "string | null (override model, or null for default)",
      "instructions": "string (2-3 sentences describing this agent's approach)"
    }
  ],
  "routing": {
    "rules": [
      {
        "pattern": "string (regex pattern without delimiters, e.g. 'build|implement|fix')",
        "agents": ["string[] (agent names)"],
        "description": "string (short description of this rule)"
      }
    ],
    "defaultAgent": "string (name of the fallback agent)"
  }
}`;

export function buildInitPrompt(ctx: RepoContext): string {
  const repoPayload = contextToPromptPayload(ctx);

  return `You are an expert at configuring multi-agent coding teams. Analyze the following repository and generate a tailored agent configuration.

## Repository Context

${repoPayload}

## Task

Generate a JSON configuration for an agent team that is tailored to THIS specific project. Consider:

1. **What languages and frameworks** the project uses — agents should have matching expertise
2. **Project structure** — monorepo vs single app, frontend vs backend vs fullstack
3. **Testing setup** — if tests exist, include a testing-aware agent
4. **Existing patterns** — agents should be instructed to follow the project's conventions

## Rules

- Generate 2-5 agents. Don't over-engineer — only create agents the project actually needs.
- Every agent name must be lowercase kebab-case (e.g. "frontend-dev", not "FrontendDev").
- Agent instructions should be specific to this project, not generic boilerplate.
- Routing patterns should be lowercase regex alternatives (e.g. "design|architect|schema").
- The default agent should be the most general-purpose one.
- Use "claude-sonnet-4.6" as the defaultModel. Only set agent-level model overrides if an agent benefits from a different model (e.g. an architect might use "claude-opus-4.6").
- Include a routing rule that assigns multi-agent collaboration for complex tasks like "refactor" or "redesign".

## Response Format

Respond with ONLY a JSON code block. No explanation, no markdown outside the code block.

\`\`\`json
${RESPONSE_SCHEMA}
\`\`\``;
}

export interface GeneratedConfig {
  projectName: string;
  defaultModel: string;
  agents: GeneratedAgent[];
  routing: GeneratedRouting;
}

export interface GeneratedAgent {
  name: string;
  role: string;
  expertise: string[];
  model: string | null;
  instructions: string;
}

export interface GeneratedRouting {
  rules: GeneratedRoutingRule[];
  defaultAgent: string;
}

export interface GeneratedRoutingRule {
  pattern: string;
  agents: string[];
  description: string;
}

export function parseGeneratedConfig(raw: string): GeneratedConfig {
  const jsonMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to parse Copilot response as JSON. The model did not return valid JSON.");
  }

  const config = parsed as GeneratedConfig;

  if (!config.agents || !Array.isArray(config.agents) || config.agents.length === 0) {
    throw new Error("Generated config has no agents.");
  }

  if (!config.routing || !config.routing.defaultAgent) {
    throw new Error("Generated config is missing routing configuration.");
  }

  const agentNames = new Set(config.agents.map((a) => a.name));

  if (!agentNames.has(config.routing.defaultAgent)) {
    throw new Error(
      `Default agent "${config.routing.defaultAgent}" not found in agents: ${[...agentNames].join(", ")}`,
    );
  }

  for (const rule of config.routing.rules) {
    for (const agent of rule.agents) {
      if (!agentNames.has(agent)) {
        throw new Error(
          `Routing rule references unknown agent "${agent}". Known: ${[...agentNames].join(", ")}`,
        );
      }
    }
  }

  for (const agent of config.agents) {
    if (!/^[a-z][a-z0-9-]*$/.test(agent.name)) {
      throw new Error(
        `Invalid agent name "${agent.name}". Must be lowercase alphanumeric with hyphens.`,
      );
    }
  }

  return {
    projectName: config.projectName || "my-project",
    defaultModel: config.defaultModel || "claude-sonnet-4.6",
    agents: config.agents,
    routing: config.routing,
  };
}
