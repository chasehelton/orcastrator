// Config builder API — source of truth for Orcastrator configuration

import { z } from "zod";
import {
  GuardrailInputSchema,
  normalizeGuardrails,
} from "../guardrails/index.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const AgentConfigSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      "Agent names must be lowercase alphanumeric with hyphens",
    ),
  role: z.string().min(1),
  expertise: z.array(z.string()).default([]),
  model: z.string().optional(),
  instructions: z.string().default(""),
});

export const RoutingRuleSchema = z.object({
  pattern: z.union([z.string(), z.instanceof(RegExp)]),
  agents: z.array(z.string()).min(1),
  description: z.string().optional(),
});

export const RoutingConfigSchema = z.object({
  rules: z.array(RoutingRuleSchema).default([]),
  defaultAgent: z.string(),
});

export const LinearConfigSchema = z.object({
  /**
   * Linear personal API key. Defaults to the LINEAR_API_KEY environment
   * variable — prefer the env var so secrets stay out of committed configs.
   */
  apiKey: z.string().optional(),
  /**
   * Default team key (e.g. "ENG") used when listing issues without an
   * explicit identifier. Optional — the SDK can still fetch issues by
   * full identifier (e.g. "ENG-123") without this set.
   */
  defaultTeam: z.string().optional(),
});

export const OrcastratorConfigSchema = z.object({
  name: z.string().default("orcastrator"),
  defaultModel: z.string().default("claude-sonnet-4.6"),
  agents: z.array(AgentConfigSchema).min(1),
  routing: RoutingConfigSchema,
  skills: z.array(z.string()).default([]),
  guardrails: GuardrailInputSchema.optional(),
  linear: LinearConfigSchema.optional(),
});

// ---------------------------------------------------------------------------
// Builder functions
// ---------------------------------------------------------------------------

export type AgentInput = z.input<typeof AgentConfigSchema>;
export type RoutingRuleInput = z.input<typeof RoutingRuleSchema>;
export type RoutingInput = z.input<typeof RoutingConfigSchema>;
export type LinearInput = z.input<typeof LinearConfigSchema>;
export type OrcastratorInput = z.input<typeof OrcastratorConfigSchema>;

export function defineAgent(config: AgentInput) {
  return AgentConfigSchema.parse(config);
}

export function defineRouting(config: RoutingInput) {
  return RoutingConfigSchema.parse(config);
}

export function defineOrcastrator(config: OrcastratorInput) {
  const parsed = OrcastratorConfigSchema.parse(config);

  // Validate that routing references valid agent names
  const agentNames = new Set(parsed.agents.map((a) => a.name));

  if (!agentNames.has(parsed.routing.defaultAgent)) {
    throw new Error(
      `Default agent "${parsed.routing.defaultAgent}" not found in agents list`,
    );
  }

  for (const rule of parsed.routing.rules) {
    for (const agent of rule.agents) {
      if (!agentNames.has(agent)) {
        throw new Error(
          `Routing rule references unknown agent "${agent}". Known agents: ${[...agentNames].join(", ")}`,
        );
      }
    }
  }

  // Normalize guardrails (true → defaults, object → merged with defaults)
  const guardrails = normalizeGuardrails(parsed.guardrails);

  return { ...parsed, guardrails };
}
