// Model selector — simple 2-layer model resolution

import type { AgentConfig, OrcastratorConfig } from "../core/types.js";

export function resolveModel(
  agent: AgentConfig,
  config: OrcastratorConfig,
): string {
  // Layer 1: Agent-level override
  if (agent.model) return agent.model;

  // Layer 2: Config default
  return config.defaultModel;
}
