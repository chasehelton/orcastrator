// Multi-turn chat session — persistent agent sessions with conversation history
//
// Unlike Coordinator (which spawns fresh sessions per task), ChatSession keeps
// AgentLifecycleManager sessions alive across turns, building an in-process
// history that's prepended to each outgoing prompt so agents always have
// full conversation context.

import type { OrcastratorConfig, AgentConfig } from "./types.js";
import { AgentLifecycleManager } from "../agents/lifecycle.js";
import { matchRoute } from "./router.js";
import { selectResponseTier } from "./response-tiers.js";
import { getOrcastratorDir } from "../config/loader.js";
import { buildGuardrails, type GuardrailConfig } from "../guardrails/index.js";
import type { GuardrailsOverride } from "../client/copilot.js";
import { bus } from "./event-bus.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  agentName: string;
}

export interface ChatTurnResult {
  agentName: string;
  response: string;
  duration: number;
  error?: string;
}

// Max turns to keep in history (20 = 10 full back-and-forth exchanges).
// Older turns are dropped to keep prompts from growing unbounded.
const MAX_HISTORY_TURNS = 20;

// ---------------------------------------------------------------------------
// ChatSession
// ---------------------------------------------------------------------------

export class ChatSession {
  private config: OrcastratorConfig;
  private lifecycle: AgentLifecycleManager;
  private orcastratorDir: string;
  private guardrailsOverride: GuardrailsOverride | undefined;

  /** Full conversation history across all agents in this session. */
  private history: ChatTurn[] = [];

  /** Tracks which agent names have already had a session spawned. */
  private spawnedAgents = new Set<string>();

  constructor(config: OrcastratorConfig, cwd: string) {
    this.config = config;
    this.orcastratorDir = getOrcastratorDir(cwd);
    this.lifecycle = new AgentLifecycleManager();

    const guardrailConfig = config.guardrails as GuardrailConfig | undefined;
    this.guardrailsOverride = guardrailConfig
      ? buildGuardrails(guardrailConfig)
      : undefined;
  }

  // ── Session management ────────────────────────────────────────────────────

  /**
   * Lazily spawn an agent session the first time it's needed.
   * Subsequent calls for the same agent are no-ops (session stays alive).
   */
  private async ensureSpawned(agentConfig: AgentConfig): Promise<boolean> {
    if (this.spawnedAgents.has(agentConfig.name)) return true;

    const result = await this.lifecycle.spawnAgent(
      agentConfig,
      this.config,
      this.orcastratorDir,
      /* taskContext */ undefined,
      /* workingDirectory */ undefined,
      this.guardrailsOverride,
    );

    if (result.success) {
      this.spawnedAgents.add(agentConfig.name);
      return true;
    }
    return false;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Send a user message and collect responses from the routed agent(s).
   *
   * @param userMessage - The raw message typed by the user.
   * @param forceAgent  - If set, bypass routing and send to this agent only.
   */
  async send(
    userMessage: string,
    forceAgent?: string,
  ): Promise<ChatTurnResult[]> {
    const start = Date.now();

    // Select response tier
    const tier = selectResponseTier(userMessage, this.config);
    bus.emit("tier.selected", {
      task: userMessage,
      tier: tier.tier,
      reason: `matched tier: ${tier.tier}`,
    });

    // Direct tier — respond inline without spawning
    if (tier.tier === "direct" && !forceAgent) {
      const response =
        "👋 I'm the orcastrator coordinator. Use a specific task description to route to the right agent.";
      this.history.push(
        { role: "user", content: userMessage, agentName: "coordinator" },
        { role: "assistant", content: response, agentName: "coordinator" },
      );
      return [
        {
          agentName: "coordinator",
          response,
          duration: Date.now() - start,
        },
      ];
    }

    // Route
    const match = forceAgent
      ? { agents: [forceAgent], confidence: "exact" as const }
      : matchRoute(userMessage, this.config);

    const agentNames = match.agents;

    bus.emit("task.started", { task: userMessage, agents: agentNames });

    // Resolve agent configs, falling back to the default agent if nothing matched
    let agentConfigs = match.agents
      .map((name) => this.config.agents.find((a) => a.name === name))
      .filter((a): a is AgentConfig => a != null);

    if (agentConfigs.length === 0) {
      const fallback = this.config.agents.find(
        (a) => a.name === this.config.routing.defaultAgent,
      );
      if (fallback) {
        agentConfigs = [fallback];
      } else {
        throw new Error("No agents available to handle this message.");
      }
    }

    // Build the context-enriched prompt once (shared by all agents this turn)
    const prompt = this.buildPrompt(userMessage);

    // Ensure all target agents are spawned (lazy, parallel)
    const spawnFlags = await Promise.all(
      agentConfigs.map((a) => this.ensureSpawned(a)),
    );

    const results: ChatTurnResult[] = [];

    await Promise.allSettled(
      agentConfigs.map(async (agentConfig, i) => {
        if (!spawnFlags[i]) {
          results.push({
            agentName: agentConfig.name,
            response: "",
            duration: Date.now() - start,
            error: `Failed to spawn agent "${agentConfig.name}"`,
          });
          return;
        }

        try {
          const response = await this.lifecycle.sendTask(
            agentConfig.name,
            prompt,
          );

          // Record both sides of this exchange in the shared history
          this.history.push({
            role: "user",
            content: userMessage,
            agentName: agentConfig.name,
          });
          this.history.push({
            role: "assistant",
            content: response,
            agentName: agentConfig.name,
          });

          // Trim to keep history window bounded
          if (this.history.length > MAX_HISTORY_TURNS) {
            this.history = this.history.slice(-MAX_HISTORY_TURNS);
          }

          results.push({
            agentName: agentConfig.name,
            response,
            duration: Date.now() - start,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({
            agentName: agentConfig.name,
            response: "",
            duration: Date.now() - start,
            error: message,
          });
        }
      }),
    );

    bus.emit("task.completed", {
      strategy: "multi",
      duration: Date.now() - start,
      agentCount: agentConfigs.length,
    });

    return results;
  }

  /**
   * Clear the conversation history without destroying agent sessions.
   * The agents stay warm — only the context window is wiped.
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Return a snapshot of the current conversation history.
   */
  getHistory(): ChatTurn[] {
    return [...this.history];
  }

  /**
   * How many turns are currently in the history buffer.
   */
  get historyLength(): number {
    return this.history.length;
  }

  /**
   * Destroy all agent sessions and clean up the Copilot client.
   * After calling this the instance must not be used again.
   */
  async shutdown(): Promise<void> {
    await this.lifecycle.shutdown();
    this.spawnedAgents.clear();
    this.history = [];
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Build a prompt string that includes the conversation history so the agent
   * has full context for multi-turn dialogue.
   */
  private buildPrompt(userMessage: string): string {
    if (this.history.length === 0) {
      return userMessage;
    }

    const lines: string[] = [
      "--- Conversation history (earlier turns, for context) ---",
      "",
    ];

    for (const turn of this.history) {
      if (turn.role === "user") {
        lines.push(`[User]: ${turn.content}`);
      } else {
        lines.push(`[${turn.agentName}]: ${turn.content}`);
      }
    }

    lines.push("");
    lines.push("--- Current message ---");
    lines.push("");
    lines.push(`[User]: ${userMessage}`);
    lines.push("");
    lines.push(
      "Respond to the current user message. Use the history above only for context; do not re-summarise it.",
    );

    return lines.join("\n");
  }
}
