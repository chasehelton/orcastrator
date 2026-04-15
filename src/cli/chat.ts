// orcastrator chat — interactive multi-turn chat with your agent team

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import { ChatSession } from "../core/chat-session.js";
import type { OrcastratorConfig } from "../core/types.js";
import { ActivityRenderer, type Verbosity } from "./activity-renderer.js";
import { playOrcaAnimation } from "./orca-animation.js";

export interface ChatOptions {
  agent?: string;
  quiet?: boolean;
  verbose?: boolean;
}

export async function chatCommand(options: ChatOptions): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);

  const session = new ChatSession(config, cwd);

  const rl = readline.createInterface({ input, output });

  // Graceful shutdown on Ctrl+C
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(chalk.dim("\nShutting down…"));
    rl.close();
    await session.shutdown();
  };

  rl.on("close", () => {
    if (!shuttingDown) {
      shutdown();
    }
  });

  // Welcome banner — animated orca rises from waves, then shows greeting
  const agentNames = config.agents.map((a) => a.name);
  console.log();
  await playOrcaAnimation();
  console.log();
  console.log(
    chalk.dim(
      `  Agents: ${agentNames.join(", ")}` +
        (options.agent ? `  (locked to ${chalk.cyan(options.agent)})` : ""),
    ),
  );
  console.log();

  // REPL loop
  while (!shuttingDown) {
    let userInput: string;
    try {
      userInput = await rl.question(chalk.green("❯ "));
    } catch {
      // readline closed (e.g. Ctrl+D)
      break;
    }

    const trimmed = userInput.trim();
    if (!trimmed) continue;

    // Slash commands
    if (trimmed.startsWith("/")) {
      const handled = handleSlashCommand(trimmed, session, options, config);
      if (handled === "exit") break;
      continue;
    }

    // Send to agent(s)
    try {
      const verbosity: Verbosity = options.quiet ? "quiet" : options.verbose ? "verbose" : "normal";
      const renderer = new ActivityRenderer({ verbosity, clearBehavior: "clear" });
      renderer.start();

      const results = await session.send(trimmed, options.agent);

      renderer.stop();

      for (const r of results) {
        if (r.error) {
          console.log();
          console.log(chalk.bold.red(`── ${r.agentName} (error) ──`));
          console.log(chalk.red(r.error));
        } else {
          console.log();
          console.log(chalk.bold.cyan(`── ${r.agentName} ──`));
          console.log(r.response);
        }
      }
      console.log();
    } catch (err) {
      console.log(
        chalk.red(err instanceof Error ? err.message : String(err)),
      );
      console.log();
    }
  }

  await shutdown();
}

// ---------------------------------------------------------------------------
// Slash commands
// ---------------------------------------------------------------------------

function handleSlashCommand(
  input: string,
  session: ChatSession,
  options: ChatOptions,
  config: OrcastratorConfig,
): "exit" | "handled" {
  const [cmd, ...args] = input.split(/\s+/);

  switch (cmd) {
    case "/exit":
    case "/quit":
    case "/q":
      return "exit";

    case "/clear":
      session.clearHistory();
      console.log(chalk.dim("History cleared."));
      return "handled";

    case "/history": {
      const history = session.getHistory();
      if (history.length === 0) {
        console.log(chalk.dim("No conversation history yet."));
      } else {
        for (const turn of history) {
          if (turn.role === "user") {
            console.log(chalk.green(`[You]: ${turn.content}`));
          } else {
            console.log(chalk.cyan(`[${turn.agentName}]: ${turn.content}`));
          }
        }
      }
      return "handled";
    }

    case "/agent":
    case "/switch": {
      const name = args[0];
      if (!name) {
        if (options.agent) {
          console.log(chalk.dim(`Locked to agent: ${chalk.cyan(options.agent)}`));
        } else {
          console.log(chalk.dim("No agent lock — messages are auto-routed."));
        }
      } else {
        const exists = config.agents.some((a) => a.name === name);
        if (!exists) {
          const available = config.agents.map((a) => chalk.cyan(a.name)).join(", ");
          console.log(chalk.yellow(`Unknown agent "${name}". Available: ${available}`));
        } else {
          options.agent = name;
          console.log(chalk.dim(`Locked to agent: ${chalk.cyan(name)}`));
        }
      }
      return "handled";
    }

    case "/auto":
      options.agent = undefined;
      console.log(chalk.dim("Switched to auto-routing."));
      return "handled";

    case "/status": {
      const history = session.getHistory();
      const respondedAgents = [
        ...new Set(
          history
            .filter((t) => t.role === "assistant" && t.agentName !== "coordinator")
            .map((t) => t.agentName),
        ),
      ];
      console.log();
      console.log(chalk.bold("Session status:"));
      console.log(
        `  Routing   ${
          options.agent
            ? chalk.cyan(options.agent) + chalk.dim(" (locked)")
            : chalk.dim("auto")
        }`,
      );
      console.log(
        `  History   ${session.historyLength} turn${session.historyLength !== 1 ? "s" : ""}`,
      );
      console.log(
        `  Agents    ${config.agents.map((a) => chalk.cyan(a.name)).join(", ")}`,
      );
      if (respondedAgents.length > 0) {
        console.log(
          `  Active    ${respondedAgents.map((a) => chalk.green(a)).join(", ")}`,
        );
      }
      console.log();
      return "handled";
    }

    case "/help":
      console.log();
      console.log(chalk.bold("Commands:"));
      console.log(`  ${chalk.cyan("/help")}              Show this help`);
      console.log(`  ${chalk.cyan("/exit")}              Exit the chat`);
      console.log(`  ${chalk.cyan("/clear")}             Clear conversation history`);
      console.log(`  ${chalk.cyan("/history")}           Show conversation history`);
      console.log(`  ${chalk.cyan("/status")}            Show session status and active agents`);
      console.log(`  ${chalk.cyan("/agent <name>")}     Lock to a specific agent`);
      console.log(`  ${chalk.cyan("/switch <name>")}    Alias for /agent`);
      console.log(`  ${chalk.cyan("/auto")}              Switch back to auto-routing`);
      console.log();
      return "handled";

    default:
      console.log(chalk.dim(`Unknown command: ${cmd}. Type /help for options.`));
      return "handled";
  }
}
