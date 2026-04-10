// orcastrator init — scaffold a new project config (Copilot-powered by default)

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { getConfigPath, getOrcastratorDir } from "../config/loader.js";
import { scanRepo, summarizeContext } from "../init/repo-scanner.js";
import { buildInitPrompt, parseGeneratedConfig } from "../init/prompt-builder.js";
import { generateConfigSource } from "../init/config-writer.js";
import {
  getClient,
  createSession,
  sendMessage,
  closeSession,
  stopClient,
} from "../client/copilot.js";

const DEFAULT_CONFIG = `import { defineOrcastrator, defineAgent, defineRouting } from "@chasehelton/orcastrator";

export default defineOrcastrator({
  name: "my-project",
  defaultModel: "claude-sonnet-4.6",

  agents: [
    defineAgent({
      name: "architect",
      role: "System Architect",
      expertise: ["system design", "API design", "TypeScript"],
      model: "claude-opus-4.6",
      instructions: \`You design clean, scalable systems. You prefer simplicity.
        You write TypeScript exclusively. You favor composition over inheritance.\`,
    }),
    defineAgent({
      name: "builder",
      role: "Implementation Engineer",
      expertise: ["TypeScript", "React", "Next.js", "Node.js", "testing"],
      instructions: \`You write production-quality TypeScript code with tests.
        You follow existing patterns in the codebase. You keep PRs focused.\`,
    }),
    defineAgent({
      name: "reviewer",
      role: "Code Reviewer",
      expertise: ["code quality", "security", "performance"],
      instructions: \`You review code for bugs, security issues, and clarity.
        You only flag things that matter. You never comment on style.\`,
    }),
  ],

  routing: defineRouting({
    rules: [
      { pattern: /design|architect|schema|plan/, agents: ["architect"], description: "Architecture tasks" },
      { pattern: /build|implement|create|add|fix/, agents: ["builder"], description: "Implementation tasks" },
      { pattern: /review|audit|check/, agents: ["reviewer"], description: "Code review tasks" },
      { pattern: /refactor|redesign/, agents: ["architect", "builder"], description: "Multi-agent refactoring" },
    ],
    defaultAgent: "builder",
  }),

  skills: [],
});
`;

export interface InitOptions {
  default?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const existingConfig = getConfigPath(cwd);

  if (existingConfig) {
    console.log(
      chalk.yellow(`Config already exists at ${existingConfig}`),
    );
    console.log(chalk.dim("Run `orcastrator build` to regenerate markdown files."));
    return;
  }

  let configSource: string;

  if (options.default) {
    configSource = DEFAULT_CONFIG;
    console.log(chalk.dim("Using default agent configuration."));
  } else {
    configSource = await generateSmartConfig(cwd);
  }

  // Write config file
  const configPath = join(cwd, "orcastrator.config.ts");
  writeFileSync(configPath, configSource);
  console.log(chalk.green("✓"), "Created", chalk.bold("orcastrator.config.ts"));

  // Create .orcastrator directory
  const orcastratorDir = getOrcastratorDir(cwd);
  mkdirSync(join(orcastratorDir, "agents"), { recursive: true });
  mkdirSync(join(orcastratorDir, "log"), { recursive: true });
  writeFileSync(join(orcastratorDir, "decisions.md"), "# Decisions\n\n");
  console.log(chalk.green("✓"), "Created", chalk.bold(".orcastrator/"), "directory");

  console.log();
  console.log(chalk.dim("Next steps:"));
  console.log(chalk.dim("  1. Review orcastrator.config.ts and tweak if needed"));
  console.log(chalk.dim("  2. Run `orcastrator build` to generate agent charters"));
  console.log(chalk.dim('  3. Run `orcastrator run "your task"` to start working'));
}

async function generateSmartConfig(cwd: string): Promise<string> {
  // 1. Scan the repo
  const scanSpinner = ora("Scanning repository...").start();
  const repoContext = scanRepo(cwd);
  scanSpinner.succeed("Repository scanned");

  // 2. Display what was detected
  console.log();
  console.log(chalk.bold("Detected:"));
  const summary = summarizeContext(repoContext);
  for (const line of summary.split("\n")) {
    console.log(chalk.cyan("  " + line));
  }
  console.log();

  // 3. Call Copilot SDK to generate agents
  const genSpinner = ora("Generating agent team via Copilot...").start();

  try {
    const prompt = buildInitPrompt(repoContext);

    const session = await createSession({
      model: "claude-sonnet-4.6",
      systemMessage: "You are a configuration generator. Respond only with valid JSON.",
      agentName: "orcastrator-init",
    });

    try {
      const response = await sendMessage(session, prompt, 120_000);
      const generated = parseGeneratedConfig(response);
      const configSource = generateConfigSource(generated);

      genSpinner.succeed("Agent team generated");

      // 4. Display generated agents
      console.log();
      console.log(chalk.bold("Generated agents:"));
      for (const agent of generated.agents) {
        const modelTag = agent.model ? chalk.dim(` (${agent.model})`) : "";
        console.log(
          `  ${chalk.green("•")} ${chalk.bold(agent.name)} — ${agent.role}${modelTag}`,
        );
        console.log(
          `    ${chalk.dim(agent.expertise.join(", "))}`,
        );
      }
      console.log();

      return configSource;
    } finally {
      await closeSession(session);
    }
  } catch (error) {
    genSpinner.fail("Agent generation failed");

    const message = error instanceof Error ? error.message : String(error);
    console.log(chalk.yellow(`  ${message}`));
    console.log(chalk.yellow("  Falling back to default configuration."));
    console.log();

    return DEFAULT_CONFIG;
  } finally {
    await stopClient();
  }
}
