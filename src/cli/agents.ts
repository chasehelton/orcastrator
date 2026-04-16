// orcastrator agents — manage agents

import chalk from "chalk";
import ora from "ora";
import { createInterface } from "node:readline";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, getConfigPath, getOrcastratorDir } from "../config/loader.js";
import {
  buildAgentCreatePrompt,
  parseNewAgentResponse,
  generateUpdatedConfigSource,
} from "../init/agent-creator.js";
import {
  getClient,
  createSession,
  sendMessage,
  closeSession,
  stopClient,
} from "../client/copilot.js";
import { buildCommand } from "./build.js";

export async function agentsCommand(
  action: string,
  description?: string,
): Promise<void> {
  const cwd = process.cwd();

  switch (action) {
    case "list":
      await listAgents(cwd);
      break;
    case "create":
      await createAgent(cwd, description);
      break;
    default:
      console.log(chalk.yellow(`Unknown action: ${action}`));
      console.log(chalk.dim("Available actions: list, create"));
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

// ---------------------------------------------------------------------------
// agents create
// ---------------------------------------------------------------------------

function promptForInput(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createAgent(cwd: string, description?: string): Promise<void> {
  // 1. Get description — from arg or interactive prompt
  let desc = description?.trim();
  if (!desc) {
    desc = await promptForInput(
      chalk.cyan("Describe the agent you want to create:\n> "),
    );
    if (!desc) {
      console.log(chalk.yellow("No description provided. Aborting."));
      return;
    }
  }

  // 2. Load existing config
  const config = await loadConfig(cwd);
  const configPath = getConfigPath(cwd);
  if (!configPath) {
    console.log(
      chalk.red("No orcastrator config found. Run `orcastrator init` first."),
    );
    return;
  }

  // 3. Call Copilot to generate agent
  const spinner = ora("Generating agent via Copilot...").start();

  try {
    const prompt = buildAgentCreatePrompt(desc, config);

    const session = await createSession({
      model: "claude-sonnet-4.6",
      systemMessage:
        "You are a configuration generator. Respond only with valid JSON.",
      agentName: "orcastrator-agent-creator",
    });

    let result;
    try {
      const response = await sendMessage(session, prompt, 120_000);
      result = parseNewAgentResponse(response);
      spinner.succeed("Agent generated");
    } finally {
      await closeSession(session);
    }

    // 4. Display for confirmation
    const { agent, routingRules } = result;
    console.log();
    console.log(chalk.bold("Generated agent:"));
    const modelTag = agent.model
      ? chalk.dim(` (${agent.model})`)
      : chalk.dim(` (default: ${config.defaultModel})`);
    console.log(`  ${chalk.bold.cyan(agent.name)} — ${agent.role}${modelTag}`);
    console.log(`  ${chalk.dim("Expertise:")} ${agent.expertise.join(", ")}`);
    console.log(`  ${chalk.dim("Instructions:")} ${agent.instructions}`);
    console.log();
    console.log(chalk.bold("Routing rules:"));
    for (const rule of routingRules) {
      const agents = rule.agents.join(", ");
      const desc = rule.description ? chalk.dim(` — ${rule.description}`) : "";
      console.log(`  /${rule.pattern}/ → [${agents}]${desc}`);
    }
    console.log();

    // 5. Confirmation
    const answer = await promptForInput(
      chalk.cyan("Add this agent to your config? [Y/n] "),
    );
    if (answer && answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log(chalk.yellow("Aborted."));
      return;
    }

    // 6. Rewrite config
    const updatedSource = generateUpdatedConfigSource(
      config,
      agent,
      routingRules,
    );
    writeFileSync(configPath, updatedSource);
    console.log(
      chalk.green("✓"),
      `Added ${chalk.bold(agent.name)} to`,
      chalk.bold("orcastrator.config.ts"),
    );

    // 7. Auto-run build
    console.log();
    await buildCommand();
  } catch (error) {
    spinner.fail("Agent creation failed");
    const message = error instanceof Error ? error.message : String(error);
    console.log(chalk.red(`  ${message}`));
  } finally {
    await stopClient();
  }
}
