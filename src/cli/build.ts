// orcastrator build — generate .orcastrator/ markdown from config

import chalk from "chalk";
import { loadConfig, getOrcastratorDir } from "../config/loader.js";
import { generateOrcastratorDir } from "../config/generator.js";

export async function buildCommand(): Promise<void> {
  const cwd = process.cwd();

  console.log(chalk.dim("Loading config..."));
  const config = await loadConfig(cwd);

  const orcastratorDir = getOrcastratorDir(cwd);
  generateOrcastratorDir(config, orcastratorDir);

  console.log(chalk.green("✓"), `Built ${chalk.bold(".orcastrator/")} for team "${config.name}"`);
  console.log(chalk.dim(`  ${config.agents.length} agents configured:`));

  for (const agent of config.agents) {
    const model = agent.model ?? config.defaultModel;
    console.log(
      chalk.dim(`  • ${chalk.white(agent.name)} — ${agent.role} (${model})`),
    );
  }

  console.log(
    chalk.dim(`  ${config.routing.rules.length} routing rules active`),
  );
}
