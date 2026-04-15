// Model selector — 3-layer model resolution with optional tier

import type { AgentConfig, OrcastratorConfig } from "../core/types.js";
import type { ModelTierSuggestion } from "../core/response-tiers.js";

export function resolveModel(
  agent: AgentConfig,
  config: OrcastratorConfig,
  modelTier?: ModelTierSuggestion,
): string {
  // Layer 1: Agent-level override always wins
  if (agent.model) return agent.model;

  // Layer 2: Tier-based mapping (if configured and tier provided)
  if (modelTier && modelTier !== "none" && config.modelTiers) {
    const tierModel = config.modelTiers[modelTier === "fast" ? "fast" : modelTier === "premium" ? "premium" : "standard"];
    if (tierModel) return tierModel;
  }

  // Layer 3: Config default
  return config.defaultModel;
}
