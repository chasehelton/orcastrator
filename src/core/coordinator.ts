// Coordinator — the main orchestration pipeline

import type {
  OrcastratorConfig,
  TaskContext,
  SpawnResult,
  SessionLog,
} from "./types.js";
import { matchRoute, determineStrategy } from "./router.js";
import { fanOut } from "./fan-out.js";
import { selectResponseTier } from "./response-tiers.js";
import { AgentLifecycleManager } from "../agents/lifecycle.js";
import { getOrcastratorDir } from "../config/loader.js";
import { appendSessionLog } from "../state/log.js";
import { randomUUID } from "node:crypto";
import { buildGuardrails, type GuardrailConfig } from "../guardrails/index.js";
import type { GuardrailsOverride } from "../client/copilot.js";

export interface CoordinatorResult {
  strategy: "single" | "multi" | "fallback";
  matchedAgents: string[];
  results: SpawnResult[];
  duration: number;
}

export class Coordinator {
  private config: OrcastratorConfig;
  private lifecycle: AgentLifecycleManager;
  private orcastratorDir: string;
  private guardrailsOverride: GuardrailsOverride | undefined;

  constructor(config: OrcastratorConfig, cwd?: string) {
    this.config = config;
    this.lifecycle = new AgentLifecycleManager();
    this.orcastratorDir = getOrcastratorDir(cwd);

    // Build guardrails if configured
    const guardrailConfig = config.guardrails as GuardrailConfig | undefined;
    this.guardrailsOverride = guardrailConfig
      ? buildGuardrails(guardrailConfig)
      : undefined;
  }

  async handleTask(
    task: TaskContext,
    options?: { forceAgent?: string; workingDirectory?: string },
  ): Promise<CoordinatorResult> {
    const start = Date.now();

    // Select response tier
    const tier = selectResponseTier(task.text, this.config);

    // Direct tier — skip agent spawning entirely
    if (tier.tier === "direct") {
      const duration = Date.now() - start;
      return {
        strategy: "single",
        matchedAgents: [],
        results: [
          {
            agentName: "coordinator",
            success: true,
            response:
              "👋 I'm the orcastrator coordinator. Use a specific task description to route to the right agent.",
          },
        ],
        duration,
      };
    }

    // Route
    let agentNames: string[];
    let strategy: "single" | "multi" | "fallback";

    if (options?.forceAgent) {
      agentNames = [options.forceAgent];
      strategy = "single";
    } else {
      const match = matchRoute(task.text, this.config);
      strategy = determineStrategy(match);
      agentNames = match.agents;
    }

    // Resolve agent configs
    const agentConfigs = agentNames
      .map((name) => this.config.agents.find((a) => a.name === name))
      .filter((a): a is NonNullable<typeof a> => a != null);

    if (agentConfigs.length === 0) {
      // Fallback to default agent
      const defaultAgent = this.config.agents.find(
        (a) => a.name === this.config.routing.defaultAgent,
      );
      if (defaultAgent) {
        agentConfigs.push(defaultAgent);
        strategy = "fallback";
      } else {
        throw new Error("No agents available to handle this task");
      }
    }

    // Fan out
    const results = await fanOut({
      agents: agentConfigs,
      config: this.config,
      orcastratorDir: this.orcastratorDir,
      task: task.text,
      lifecycle: this.lifecycle,
      workingDirectory: options?.workingDirectory,
      guardrailsOverride: this.guardrailsOverride,
      modelTier: tier.modelTier,
    });

    const duration = Date.now() - start;

    // Log the session
    const log: SessionLog = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      task,
      agents: agentNames,
      strategy,
      results,
      duration,
    };

    try {
      appendSessionLog(this.orcastratorDir, log);
    } catch {
      // Don't fail the task if logging fails
    }

    return { strategy, matchedAgents: agentNames, results, duration };
  }

  async shutdown(): Promise<void> {
    await this.lifecycle.shutdown();
  }
}
