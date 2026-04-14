// Core type definitions for Orcastrator

import type { z } from "zod";
import type {
  AgentConfigSchema,
  RoutingRuleSchema,
  RoutingConfigSchema,
  OrcastratorConfigSchema,
} from "../config/builder.js";
import type { GuardrailConfig } from "../guardrails/index.js";

export type { GuardrailConfig } from "../guardrails/index.js";

// ---------------------------------------------------------------------------
// Config types (inferred from zod schemas)
// ---------------------------------------------------------------------------

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type RoutingRule = z.infer<typeof RoutingRuleSchema>;
export type RoutingConfig = z.infer<typeof RoutingConfigSchema>;
export type OrcastratorConfig = z.infer<typeof OrcastratorConfigSchema>;

// ---------------------------------------------------------------------------
// Runtime types
// ---------------------------------------------------------------------------

export type AgentStatus =
  | "spawning"
  | "active"
  | "idle"
  | "error"
  | "destroyed";

export interface AgentHandle {
  name: string;
  role: string;
  status: AgentStatus;
  sessionId: string;
  createdAt: Date;
}

export interface TaskContext {
  source: "cli" | "issue" | "linear";
  text: string;
  /** GitHub issue number */
  issueNumber?: number;
  /** URL to the issue (GitHub or Linear) */
  issueUrl?: string;
  labels?: string[];
  repo?: string;
  /** Linear issue identifier, e.g. "ENG-123" */
  linearId?: string;
}

export interface RoutingMatch {
  agents: string[];
  confidence: "exact" | "pattern" | "default";
  matchedRule?: string;
}

export type SpawnStrategy = "single" | "multi" | "fallback";

export interface SpawnResult {
  agentName: string;
  success: boolean;
  sessionId?: string;
  response?: string;
  error?: string;
}

export interface SessionConfig {
  model: string;
  systemMessage: string;
  agentName: string;
  workingDirectory?: string;
}

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

export interface DecisionEntry {
  timestamp: string;
  agent: string;
  decision: string;
  context?: string;
}

export interface HistoryEntry {
  timestamp: string;
  task: string;
  outcome: string;
}

export interface SessionLog {
  id: string;
  timestamp: string;
  task: TaskContext;
  agents: string[];
  strategy: SpawnStrategy;
  results: SpawnResult[];
  duration: number;
}

// ---------------------------------------------------------------------------
// Skill types
// ---------------------------------------------------------------------------

export interface SkillTool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute(input: unknown): Promise<unknown>;
}

export interface SkillContext {
  config: OrcastratorConfig;
  workingDirectory: string;
}

export interface Skill {
  name: string;
  description: string;
  tools: SkillTool[];
  setup(context: SkillContext): Promise<void>;
  teardown?(): Promise<void>;
}
