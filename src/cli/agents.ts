// orcastrator agents — manage agents

import chalk from "chalk";
import { loadConfig, getOrcastratorDir } from "../config/loader.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export async function agentsCommand(
  action: string,
): Promise<void> {
  const cwd = process.cwd();

  switch (action) {
    case "list":
      await listAgents(cwd);
      break;
    default:
      console.log(chalk.yellow(`Unknown action: ${action}`));
      console.log(chalk.dim("Available actions: list"));
      break;
  }
}

async function listAgents(cwd: string): Promise<void> {
  const config = await loadConfig(cwd);
  const orcastratorDir = getOrcastratorDir(cwd);

  console.log(chalk.bold(`Team: ${config.name}`));
  console.log();

  for (const agent of config.agents) {
    const model = agent.model ?? config.defaultModel;
    const charterPath = join(orcastratorDir, "agents", agent.name, "charter.md");
    const hasCharter = existsSync(charterPath);

    console.log(chalk.bold.cyan(agent.name));
    console.log(`  Role:      ${agent.role}`);
    console.log(`  Model:     ${model}`);
    if (agent.expertise.length > 0) {
      console.log(`  Expertise: ${agent.expertise.join(", ")}`);
    }
    console.log(`  Charter:   ${hasCharter ? chalk.green("✓ built") : chalk.yellow("✗ run build")}`);
    console.log();
  }
}
