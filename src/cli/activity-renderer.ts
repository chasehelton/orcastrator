// ActivityRenderer — live terminal activity panel for agent work visibility

import logUpdate from "log-update";
import chalk from "chalk";
import { bus } from "../core/event-bus.js";

export type Verbosity = "quiet" | "normal" | "verbose";
export type ClearBehavior = "persist" | "clear";

interface AgentState {
  name: string;
  intent: string;
  currentTool: string;
  currentToolArgs: string;
  turnCount: number;
  toolCallCount: number;
  startedAt: number;
  lastUpdate: number;
}

export class ActivityRenderer {
  private agents = new Map<string, AgentState>();
  private verbosity: Verbosity;
  private clearBehavior: ClearBehavior;
  private unsubs: Array<() => void> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(options?: { verbosity?: Verbosity; clearBehavior?: ClearBehavior }) {
    this.verbosity = options?.verbosity ?? "normal";
    this.clearBehavior = options?.clearBehavior ?? "persist";
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    if (this.verbosity === "quiet") return;

    this.subscribe();

    // Refresh display at 200ms intervals for elapsed time updates
    this.timer = setInterval(() => {
      if (this.agents.size > 0) this.render();
    }, 200);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];

    if (this.verbosity === "quiet") return;

    if (this.clearBehavior === "persist" && this.agents.size > 0) {
      // Render final summary and persist it
      logUpdate(this.buildSummary());
      logUpdate.done();
    } else {
      logUpdate.clear();
    }

    this.agents.clear();
  }

  /** Visible for testing — returns current render output without writing to terminal. */
  getOutput(): string {
    return this.buildDisplay();
  }

  /** Visible for testing — returns the current state map. */
  getAgentStates(): ReadonlyMap<string, Readonly<AgentState>> {
    return this.agents;
  }

  private subscribe(): void {
    this.unsubs.push(
      listenBus("agent.intent", ({ agentName, intent }) => {
        this.ensureAgent(agentName).intent = intent;
        this.render();
      }),
    );

    this.unsubs.push(
      listenBus("agent.turn.start", ({ agentName }) => {
        this.ensureAgent(agentName).turnCount++;
        this.render();
      }),
    );

    this.unsubs.push(
      listenBus("agent.tool.start", ({ agentName, toolName, args }) => {
        const state = this.ensureAgent(agentName);
        state.currentTool = toolName;
        state.currentToolArgs = args ?? "";
        state.toolCallCount++;
        state.lastUpdate = Date.now();
        this.render();
      }),
    );

    this.unsubs.push(
      listenBus("agent.tool.progress", ({ agentName, message }) => {
        const state = this.ensureAgent(agentName);
        state.currentToolArgs = message;
        state.lastUpdate = Date.now();
        this.render();
      }),
    );

    this.unsubs.push(
      listenBus("agent.tool.complete", ({ agentName }) => {
        const state = this.ensureAgent(agentName);
        state.currentTool = "";
        state.currentToolArgs = "";
        state.lastUpdate = Date.now();
        this.render();
      }),
    );

    this.unsubs.push(
      listenBus("agent.subagent.started", ({ agentName, subagentName }) => {
        const state = this.ensureAgent(agentName);
        state.currentTool = `subagent:${subagentName}`;
        state.lastUpdate = Date.now();
        this.render();
      }),
    );

    // Also track spawned agents
    this.unsubs.push(
      listenBus("agent.spawned", ({ agentName, success }) => {
        if (success) {
          this.ensureAgent(agentName);
          this.render();
        }
      }),
    );
  }

  private ensureAgent(name: string): AgentState {
    let state = this.agents.get(name);
    if (!state) {
      state = {
        name,
        intent: "",
        currentTool: "",
        currentToolArgs: "",
        turnCount: 0,
        toolCallCount: 0,
        startedAt: Date.now(),
        lastUpdate: Date.now(),
      };
      this.agents.set(name, state);
    }
    return state;
  }

  private render(): void {
    if (!this.running || this.verbosity === "quiet") return;
    logUpdate(this.buildDisplay());
  }

  private buildDisplay(): string {
    if (this.agents.size === 0) return "";

    const lines: string[] = [];
    const agents = [...this.agents.values()];

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const elapsed = formatElapsed(Date.now() - a.startedAt);
      const isFirst = i === 0;
      const isLast = i === agents.length - 1;

      // Top border or separator
      if (isFirst) {
        lines.push(chalk.dim(`  ┌ ${chalk.cyan.bold(a.name)} ${"─".repeat(Math.max(1, 38 - a.name.length))}`));
      } else {
        lines.push(chalk.dim(`  ├ ${chalk.cyan.bold(a.name)} ${"─".repeat(Math.max(1, 38 - a.name.length))}`));
      }

      // Current activity line
      if (a.currentTool) {
        const icon = toolIcon(a.currentTool);
        lines.push(chalk.dim("  │ ") + `${icon} ${chalk.white(a.currentTool)}`);

        if (this.verbosity === "verbose" && a.currentToolArgs) {
          const truncated = a.currentToolArgs.length > 80
            ? `${a.currentToolArgs.slice(0, 77)}...`
            : a.currentToolArgs;
          lines.push(chalk.dim(`  │   ${truncated}`));
        }
      } else if (a.intent) {
        lines.push(chalk.dim("  │ ") + `💭 ${chalk.white(a.intent)}`);
      } else {
        lines.push(chalk.dim("  │ ") + chalk.dim("⏳ Thinking..."));
      }

      // Stats line
      const stats = [
        `Turn ${a.turnCount || 1}`,
        `${a.toolCallCount} tool call${a.toolCallCount !== 1 ? "s" : ""}`,
        elapsed,
      ].join(chalk.dim(" · "));
      lines.push(chalk.dim(`  │    ${stats}`));

      // Bottom border
      if (isLast) {
        lines.push(chalk.dim("  └" + "─".repeat(42)));
      }
    }

    return lines.join("\n");
  }

  private buildSummary(): string {
    const lines: string[] = [];
    const agents = [...this.agents.values()];

    for (const a of agents) {
      const elapsed = formatElapsed(Date.now() - a.startedAt);
      const turns = a.turnCount || 1;
      const tools = a.toolCallCount;
      lines.push(
        chalk.dim("  ") +
        chalk.cyan(a.name) +
        chalk.dim(` · ${turns} turn${turns !== 1 ? "s" : ""} · ${tools} tool call${tools !== 1 ? "s" : ""} · ${elapsed}`),
      );
    }

    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function listenBus<K extends keyof import("../core/event-bus.js").OrcaEvents>(
  event: K,
  handler: (payload: import("../core/event-bus.js").OrcaEvents[K]) => void,
): () => void {
  bus.on(event, handler);
  return () => bus.off(event, handler);
}

function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m${remainSecs}s`;
}

function toolIcon(toolName: string): string {
  if (toolName.startsWith("subagent:")) return "🤖";
  switch (toolName) {
    case "bash":
    case "shell":
      return "⚙️";
    case "edit":
    case "create":
      return "✏️";
    case "view":
    case "read":
      return "👁️";
    case "grep":
    case "glob":
    case "search":
      return "🔍";
    default:
      return "⚡";
  }
}
