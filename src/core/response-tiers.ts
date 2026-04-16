// Response tiers — classify task complexity and select model tier accordingly

import type { OrcastratorConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TierName = "direct" | "lightweight" | "standard" | "full";

export type ModelTierSuggestion = "none" | "fast" | "standard" | "premium";

export interface ResponseTier {
  /** Tier identifier */
  tier: TierName;
  /** Suggested model tier */
  modelTier: ModelTierSuggestion;
  /** Maximum agents to spawn */
  maxAgents: number;
  /** Per-agent timeout in seconds */
  timeout: number;
}

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

const TIERS: Record<TierName, ResponseTier> = {
  direct: { tier: "direct", modelTier: "none", maxAgents: 0, timeout: 0 },
  lightweight: {
    tier: "lightweight",
    modelTier: "fast",
    maxAgents: 1,
    timeout: 60,
  },
  standard: {
    tier: "standard",
    modelTier: "standard",
    maxAgents: 1,
    timeout: 300,
  },
  full: { tier: "full", modelTier: "premium", maxAgents: 5, timeout: 600 },
};

export function getTier(name: TierName): ResponseTier {
  return { ...TIERS[name] };
}

// ---------------------------------------------------------------------------
// Keyword patterns
// ---------------------------------------------------------------------------

const DIRECT_PATTERNS = [
  /^(hi|hello|hey|thanks|thank you|ok|okay)\b/i,
  /^(help|usage|how do I use)\b/i,
  /^what('s| is) (your|the) (name|version|status)\b/i,
];

const LIGHTWEIGHT_PATTERNS = [
  /\b(list|show|display|get|find|search|where is)\b/i,
  /\b(status|info|check)\b/i,
  /\b(rename|move|delete|remove)\s+\w+/i,
];

const FULL_PATTERNS = [
  /\b(refactor|redesign|migrate|rewrite)\b.*\b(entire|all|whole|system|codebase)\b/i,
  /\b(implement|build|create)\b.*\b(feature|module|system|service)\b/i,
  /\bmulti[- ]?(agent|step|file)\b/i,
  /\b(security audit|pen\s?test|vulnerability scan)\b/i,
  /\bfull\s+(review|analysis|sweep)\b/i,
];

// ---------------------------------------------------------------------------
// Selection logic
// ---------------------------------------------------------------------------

/**
 * Select the appropriate response tier for a task based on keyword analysis.
 *
 * Priority order:
 *  1. Full-tier patterns (most impactful — checked first)
 *  2. Direct-tier patterns (greetings, trivial questions)
 *  3. Lightweight patterns (simple lookups)
 *  4. Default → standard
 */
export function selectResponseTier(
  taskText: string,
  _config: OrcastratorConfig,
): ResponseTier {
  const trimmed = taskText.trim();

  // Full patterns (complex multi-agent work)
  if (FULL_PATTERNS.some((p) => p.test(trimmed))) {
    return getTier("full");
  }

  // Short, simple messages
  if (trimmed.length < 30 && DIRECT_PATTERNS.some((p) => p.test(trimmed))) {
    return getTier("direct");
  }

  // Simple lookups
  if (LIGHTWEIGHT_PATTERNS.some((p) => p.test(trimmed))) {
    return getTier("lightweight");
  }

  return getTier("standard");
}
