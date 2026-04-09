// orcastrator status — show current state

import chalk from "chalk";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getConfigPath, getOrcastratorDir } from "../config/loader.js";
import { loadConfig } from "../config/loader.js";

export async function statusCommand(): Promise<void> {
  const cwd = process.cwd();
  const configPath = getConfigPath(cwd);
  const orcastratorDir = getOrcastratorDir(cwd);

  if (!configPath) {
    console.log(chalk.yellow("No orcastrator config found in this directory."));
    console.log(chalk.dim("Run `orcastrator init` to get started."));
    return;
  }

  console.log(chalk.bold("Orcastrator Status"));
  console.log(chalk.dim("─".repeat(40)));

  // Load config
  try {
    const config = await loadConfig(cwd);
    console.log(`Team: ${chalk.cyan(config.name)}`);
    console.log(`Model: ${chalk.dim(config.defaultModel)}`);
    console.log();

    // Agents
    console.log(chalk.bold("Agents:"));
    for (const agent of config.agents) {
      const model = agent.model ?? config.defaultModel;
      const hasHistory = existsSync(
        join(orcastratorDir, "agents", agent.name, "history.md"),
      );
      const historyBadge = hasHistory ? chalk.dim(" [has history]") : "";
      console.log(
        `  ${chalk.green("●")} ${chalk.bold(agent.name)} — ${agent.role} (${chalk.dim(model)})${historyBadge}`,
      );
    }

    console.log();

    // Routing
    console.log(chalk.bold("Routing:"));
    console.log(`  ${config.routing.rules.length} rules, default → ${chalk.cyan(config.routing.defaultAgent)}`);
    console.log();

    // Recent logs
    const logDir = join(orcastratorDir, "log");
    if (existsSync(logDir)) {
      const logFiles = readdirSync(logDir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse()
        .slice(0, 5);

      if (logFiles.length > 0) {
        console.log(chalk.bold("Recent Sessions:"));
        for (const file of logFiles) {
          try {
            const log = JSON.parse(
              readFileSync(join(logDir, file), "utf-8"),
            );
            const succeeded = log.results?.filter(
              (r: { success: boolean }) => r.success,
            ).length ?? 0;
            const total = log.results?.length ?? 0;
            const duration = ((log.duration ?? 0) / 1000).toFixed(1);
            console.log(
              `  ${chalk.dim(log.timestamp)} — ${log.agents?.join(", ")} — ${succeeded}/${total} ok — ${duration}s`,
            );
          } catch {
            // Skip malformed logs
          }
        }
      } else {
        console.log(chalk.dim("No sessions recorded yet."));
      }
    }
  } catch (err) {
    console.error(
      chalk.red(err instanceof Error ? err.message : String(err)),
    );
    process.exitCode = 1;
  }
}
