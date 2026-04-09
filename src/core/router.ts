// Pattern-based router — matches task text to agents via routing rules

import type {
  OrcastratorConfig,
  RoutingMatch,
  RoutingRule,
} from "../core/types.js";

export function matchRoute(
  taskText: string,
  config: OrcastratorConfig,
): RoutingMatch {
  const lower = taskText.toLowerCase();

  for (const rule of config.routing.rules) {
    const pattern =
      rule.pattern instanceof RegExp
        ? rule.pattern
        : new RegExp(String(rule.pattern), "i");

    if (pattern.test(lower)) {
      return {
        agents: rule.agents,
        confidence: "pattern",
        matchedRule: pattern.source,
      };
    }
  }

  // No pattern matched — fall back to default agent
  return {
    agents: [config.routing.defaultAgent],
    confidence: "default",
  };
}

export function determineStrategy(
  match: RoutingMatch,
): "single" | "multi" | "fallback" {
  if (match.agents.length === 0) return "fallback";
  if (match.agents.length === 1) return "single";
  return "multi";
}
