// Parallel fan-out — spawns multiple agents concurrently

import type { AgentConfig, OrcastratorConfig, SpawnResult } from "./types.js";
import { AgentLifecycleManager } from "../agents/lifecycle.js";
import type { GuardrailsOverride } from "../client/copilot.js";
import type { ModelTierSuggestion } from "./response-tiers.js";
import type { SkillFile } from "../skills/loader.js";

export interface FanOutOptions {
  agents: AgentConfig[];
  config: OrcastratorConfig;
  orcastratorDir: string;
  task: string;
  lifecycle: AgentLifecycleManager;
  workingDirectory?: string;
  guardrailsOverride?: GuardrailsOverride;
  modelTier?: ModelTierSuggestion;
  skills?: SkillFile[];
}

export async function fanOut(options: FanOutOptions): Promise<SpawnResult[]> {
  const { agents, config, orcastratorDir, task, lifecycle, workingDirectory, guardrailsOverride, modelTier, skills } =
    options;

  // Spawn all agents in parallel
  const spawnPromises = agents.map((agent) =>
    lifecycle.spawnAgent(agent, config, orcastratorDir, task, workingDirectory, guardrailsOverride, modelTier, skills),
  );

  const spawnResults = await Promise.allSettled(spawnPromises);

  const results: SpawnResult[] = spawnResults.map((settled, i) => {
    if (settled.status === "fulfilled") {
      return settled.value;
    }
    return {
      agentName: agents[i].name,
      success: false,
      error:
        settled.reason instanceof Error
          ? settled.reason.message
          : String(settled.reason),
    };
  });

  // Send task to all successfully spawned agents, collect responses
  const taskPromises = results
    .filter((r) => r.success)
    .map(async (r) => {
      try {
        const response = await lifecycle.sendTask(r.agentName, task);
        r.response = response;
      } catch (err) {
        r.error = err instanceof Error ? err.message : String(err);
        r.success = false;
      }
      return r;
    });

  await Promise.allSettled(taskPromises);
  return results;
}
