// orcastrator chat — interactive multi-turn chat with your agent team

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import { loadConfig, getOrcastratorDir } from "../config/loader.js";
import { ChatSession } from "../core/chat-session.js";

export interface ChatOptions {
  agent?: string;
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

  // Welcome banner
  const agentNames = config.agents.map((a) => a.name);
  console.log();
  console.log(chalk.bold("🐋 Orcastrator Chat"));
  console.log(
    chalk.dim(
      `Agents: ${agentNames.join(", ")}` +
        (options.agent ? `  (locked to ${chalk.cyan(options.agent)})` : ""),
    ),
  );
  console.log(
    chalk.dim("Type /help for commands, Ctrl+C or /exit to quit."),
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
      const handled = handleSlashCommand(trimmed, session, options);
      if (handled === "exit") break;
      continue;
    }

    // Send to agent(s)
    try {
      const results = await session.send(trimmed, options.agent);

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

    case "/agent": {
      const name = args[0];
      if (!name) {
        if (options.agent) {
          console.log(chalk.dim(`Locked to agent: ${chalk.cyan(options.agent)}`));
        } else {
          console.log(chalk.dim("No agent lock — messages are auto-routed."));
        }
      } else {
        options.agent = name;
        console.log(chalk.dim(`Locked to agent: ${chalk.cyan(name)}`));
      }
      return "handled";
    }

    case "/auto":
      options.agent = undefined;
      console.log(chalk.dim("Switched to auto-routing."));
      return "handled";

    case "/help":
      console.log();
      console.log(chalk.bold("Commands:"));
      console.log(`  ${chalk.cyan("/help")}          Show this help`);
      console.log(`  ${chalk.cyan("/exit")}          Exit the chat`);
      console.log(`  ${chalk.cyan("/clear")}         Clear conversation history`);
      console.log(`  ${chalk.cyan("/history")}       Show conversation history`);
      console.log(`  ${chalk.cyan("/agent <name>")} Lock to a specific agent`);
      console.log(`  ${chalk.cyan("/auto")}          Switch back to auto-routing`);
      console.log();
      return "handled";

    default:
      console.log(chalk.dim(`Unknown command: ${cmd}. Type /help for options.`));
      return "handled";
  }
}
