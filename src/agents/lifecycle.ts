// Agent lifecycle manager — spawn, track, and destroy agent sessions

import type { CopilotSession } from "@github/copilot-sdk";
import type {
  AgentConfig,
  AgentHandle,
  AgentStatus,
  GuardrailConfig,
  OrcastratorConfig,
  SpawnResult,
} from "../core/types.js";
import type { ModelTierSuggestion } from "../core/response-tiers.js";
import { compileCharter } from "./charter-compiler.js";
import { resolveModel } from "./model-selector.js";
import { attachEventRelay } from "./event-relay.js";
import * as copilot from "../client/copilot.js";
import type { GuardrailsOverride } from "../client/copilot.js";
import type { SkillFile } from "../skills/loader.js";

interface ManagedAgent {
  handle: AgentHandle;
  session: CopilotSession;
  config: AgentConfig;
  detachRelay: () => void;
}

export class AgentLifecycleManager {
  private agents = new Map<string, ManagedAgent>();

  async spawnAgent(
    agentConfig: AgentConfig,
    orcastratorConfig: OrcastratorConfig,
    orcastratorDir: string,
    taskContext?: string,
    workingDirectory?: string,
    guardrailsOverride?: GuardrailsOverride,
    modelTier?: ModelTierSuggestion,
    skills?: SkillFile[],
  ): Promise<SpawnResult> {
    const name = agentConfig.name;

    try {
      // Update status
      const handle: AgentHandle = {
        name,
        role: agentConfig.role,
        status: "spawning",
        sessionId: "",
        createdAt: new Date(),
      };

      // Compile charter
      const systemMessage = compileCharter({
        agent: agentConfig,
        config: orcastratorConfig,
        orcastratorDir,
        taskContext,
        skills,
      });

      // Resolve model
      const model = resolveModel(agentConfig, orcastratorConfig, modelTier);

      // Create session
      const session = await copilot.createSession({
        model,
        systemMessage,
        agentName: name,
        workingDirectory,
      }, guardrailsOverride);

      handle.sessionId = session.sessionId;
      handle.status = "active";

      const detachRelay = attachEventRelay(session, name);

      this.agents.set(name, { handle, session, config: agentConfig, detachRelay });

      return {
        agentName: name,
        success: true,
        sessionId: session.sessionId,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        agentName: name,
        success: false,
        error,
      };
    }
  }

  async sendTask(agentName: string, prompt: string, timeoutMs?: number): Promise<string> {
    const managed = this.agents.get(agentName);
    if (!managed) {
      throw new Error(`Agent "${agentName}" not found or not spawned`);
    }

    managed.handle.status = "active";
    const response = await copilot.sendMessage(managed.session, prompt, timeoutMs);
    managed.handle.status = "idle";

    return response;
  }

  async destroyAgent(agentName: string): Promise<void> {
    const managed = this.agents.get(agentName);
    if (!managed) return;

    managed.detachRelay();
    managed.handle.status = "destroyed";
    await copilot.closeSession(managed.session);
    this.agents.delete(agentName);
  }

  async shutdown(): Promise<void> {
    const destroys = [...this.agents.keys()].map((name) =>
      this.destroyAgent(name),
    );
    await Promise.all(destroys);
    await copilot.stopClient();
  }

  getAgent(name: string): AgentHandle | undefined {
    return this.agents.get(name)?.handle;
  }

  getActiveAgents(): AgentHandle[] {
    return [...this.agents.values()]
      .filter((a) => a.handle.status !== "destroyed")
      .map((a) => a.handle);
  }
}
