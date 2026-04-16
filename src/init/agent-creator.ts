// agent-creator.ts — Copilot-powered single-agent generation and config rewrite

import { extractJSON } from "./json-extractor.js";
import type { OrcastratorConfig, AgentConfig, RoutingRule } from "../core/types.js";
import type { GeneratedAgent, GeneratedRoutingRule } from "./prompt-builder.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NewAgentResult {
  agent: GeneratedAgent;
  routingRules: GeneratedRoutingRule[];
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildAgentCreatePrompt(
  description: string,
  config: OrcastratorConfig,
): string {
  const existingTeam = config.agents
    .map((a) => `- **${a.name}** (${a.role}): ${a.expertise.join(", ")}`)
    .join("\n");

  const existingRoutes = config.routing.rules
    .map((r) => {
      const pat =
        r.pattern instanceof RegExp ? r.pattern.source : String(r.pattern);
      return `- \`/${pat}/\` → ${(r.agents as string[]).join(", ")}`;
    })
    .join("\n");

  const RESPONSE_SCHEMA = `{
  "name": "string (lowercase kebab-case, e.g. 'backend-dev')",
  "role": "string (short title, e.g. 'Backend Engineer')",
  "expertise": ["string[]"],
  "model": "string | null (model override, or null to use team default '${config.defaultModel}')",
  "instructions": "string (2-3 sentences — specific to this agent's role and style)",
  "routingRules": [
    {
      "pattern": "string (regex alternation without delimiters, e.g. 'api|endpoint|rest')",
      "agents": ["string[] — must include the new agent's name"],
      "description": "string"
    }
  ]
}`;

  const takenNames = config.agents.map((a) => `"${a.name}"`).join(", ");

  return `You are configuring a new agent for an existing multi-agent coding team. Based on the user's description, generate a single agent definition and matching routing rules.

## Existing Team

${existingTeam || "(no agents yet)"}

## Existing Routing Rules

${existingRoutes || "(none)"}

## Team Default Model

${config.defaultModel}

## User's Description

"${description}"

## Task

Generate a single agent that:
1. **Complements the existing team** — fills a clear gap, avoids overlapping with existing agents
2. **Matches the description precisely** — expertise and instructions should reflect exactly what the user asked for
3. **Comes with 1-3 routing rules** that route relevant tasks to this new agent (patterns should not conflict with existing routes where possible)
4. **Uses a valid name** — lowercase kebab-case (e.g. "data-engineer", not "DataEngineer" or "data_engineer")
5. **Sets a model override only if genuinely warranted** — use null to inherit the team default

## Constraints

- The new agent's name must NOT be any of these existing names: ${takenNames}
- Routing patterns are lowercase regex alternation strings (e.g. "migrate|seed|query")
- Instructions should be opinionated and specific to this project/role, not generic boilerplate
- Keep expertise list focused (3-7 items)

## Response Format

Respond with ONLY a JSON code block. No explanation outside the code block.

\`\`\`json
${RESPONSE_SCHEMA}
\`\`\``;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

export function parseNewAgentResponse(raw: string): NewAgentResult {
  const parsed = extractJSON(raw);

  if (!parsed.name || typeof parsed.name !== "string") {
    throw new Error("Generated agent is missing a name.");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(parsed.name)) {
    throw new Error(
      `Invalid agent name "${parsed.name}". Must be lowercase alphanumeric with hyphens.`,
    );
  }
  if (!parsed.role || typeof parsed.role !== "string") {
    throw new Error("Generated agent is missing a role.");
  }

  const agent: GeneratedAgent = {
    name: parsed.name,
    role: parsed.role,
    expertise: Array.isArray(parsed.expertise)
      ? (parsed.expertise as string[])
      : [],
    model:
      typeof parsed.model === "string" && parsed.model.length > 0
        ? parsed.model
        : null,
    instructions:
      typeof parsed.instructions === "string" ? parsed.instructions : "",
  };

  const routingRules: GeneratedRoutingRule[] = [];
  if (Array.isArray(parsed.routingRules)) {
    for (const r of parsed.routingRules as Record<string, unknown>[]) {
      if (r.pattern && r.agents) {
        routingRules.push({
          pattern: String(r.pattern),
          agents: Array.isArray(r.agents)
            ? (r.agents as string[])
            : [agent.name],
          description:
            typeof r.description === "string" ? r.description : "",
        });
      }
    }
  }

  // If Copilot didn't generate routing rules, create a sensible default
  if (routingRules.length === 0) {
    const slug = agent.name.replace(/-/g, "|");
    routingRules.push({
      pattern: slug,
      agents: [agent.name],
      description: `Tasks routed to ${agent.name}`,
    });
  }

  return { agent, routingRules };
}

// ---------------------------------------------------------------------------
// Full config source rewriter
// ---------------------------------------------------------------------------

function escapeTemplate(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function indentContinuation(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? line : pad + line))
    .join("\n");
}

function serializeAgent(agent: AgentConfig | GeneratedAgent): string {
  const expertise = agent.expertise.map((e) => `"${e}"`).join(", ");
  const modelLine =
    agent.model && agent.model !== null
      ? `\n      model: "${agent.model}",`
      : "";
  const instructions = escapeTemplate(agent.instructions.trim());

  return `    defineAgent({
      name: "${agent.name}",
      role: "${agent.role}",
      expertise: [${expertise}],${modelLine}
      instructions: \`${indentContinuation(instructions, 8)}\`,
    })`;
}

function serializeRoutingRule(rule: RoutingRule | GeneratedRoutingRule): string {
  let patternStr: string;

  if (rule.pattern instanceof RegExp) {
    // Preserve the original regex literal
    patternStr = `/${rule.pattern.source}/`;
  } else {
    // String pattern — emit as regex literal (consistent with existing style)
    patternStr = `/${String(rule.pattern)}/`;
  }

  const agents = (rule.agents as string[]).map((a) => `"${a}"`).join(", ");
  const desc = rule.description
    ? `, description: "${escapeTemplate(rule.description)}"`
    : "";

  return `      { pattern: ${patternStr}, agents: [${agents}]${desc} }`;
}

/**
 * Generates a complete updated orcastrator.config.ts source, preserving all
 * existing fields (skills, linear, modelTiers, guardrails) while inserting
 * the new agent and its routing rules.
 */
export function generateUpdatedConfigSource(
  config: OrcastratorConfig,
  newAgent: GeneratedAgent,
  newRules: GeneratedRoutingRule[],
): string {
  const allAgents = [...config.agents, newAgent];
  const allRules = [
    ...config.routing.rules,
    ...newRules,
  ];

  const agentEntries = allAgents.map(serializeAgent).join(",\n");
  const ruleEntries = allRules.map(serializeRoutingRule).join(",\n");

  // --- Optional sections ---

  const skillsStr =
    config.skills && config.skills.length > 0
      ? `[${config.skills.map((s) => `"${s}"`).join(", ")}]`
      : "[]";

  let optionalSections = "";

  if (config.linear) {
    const parts: string[] = [];
    if (config.linear.apiKey) parts.push(`    apiKey: "${config.linear.apiKey}"`);
    if (config.linear.defaultTeam)
      parts.push(`    defaultTeam: "${config.linear.defaultTeam}"`);
    if (parts.length > 0) {
      optionalSections += `\n  linear: {\n${parts.join(",\n")},\n  },`;
    }
  }

  if (config.modelTiers) {
    const parts: string[] = [];
    if (config.modelTiers.fast) parts.push(`    fast: "${config.modelTiers.fast}"`);
    if (config.modelTiers.standard)
      parts.push(`    standard: "${config.modelTiers.standard}"`);
    if (config.modelTiers.premium)
      parts.push(`    premium: "${config.modelTiers.premium}"`);
    if (parts.length > 0) {
      optionalSections += `\n  modelTiers: {\n${parts.join(",\n")},\n  },`;
    }
  }

  // Guardrails: runtime hooks are not serializable — preserve as `true` if set,
  // which re-applies the same safe defaults on next load.
  if (config.guardrails !== undefined) {
    optionalSections += `\n  guardrails: true,`;
  }

  return `import { defineOrcastrator, defineAgent, defineRouting } from "@chasehelton/orcastrator";

export default defineOrcastrator({
  name: "${config.name}",
  defaultModel: "${config.defaultModel}",

  agents: [
${agentEntries},
  ],

  routing: defineRouting({
    rules: [
${ruleEntries},
    ],
    defaultAgent: "${config.routing.defaultAgent}",
  }),

  skills: ${skillsStr},${optionalSections}
});
`;
}
