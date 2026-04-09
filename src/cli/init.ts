// orcastrator init — scaffold a new project config

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { getConfigPath, getOrcastratorDir } from "../config/loader.js";

const DEFAULT_CONFIG = `import { defineOrcastrator, defineAgent, defineRouting } from "orcastrator";

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

export async function initCommand(): Promise<void> {
  const cwd = process.cwd();
  const existingConfig = getConfigPath(cwd);

  if (existingConfig) {
    console.log(
      chalk.yellow(`Config already exists at ${existingConfig}`),
    );
    console.log(chalk.dim("Run `orcastrator build` to regenerate markdown files."));
    return;
  }

  // Write config file
  const configPath = join(cwd, "orcastrator.config.ts");
  writeFileSync(configPath, DEFAULT_CONFIG);
  console.log(chalk.green("✓"), "Created", chalk.bold("orcastrator.config.ts"));

  // Create .orcastrator directory
  const orcastratorDir = getOrcastratorDir(cwd);
  mkdirSync(join(orcastratorDir, "agents"), { recursive: true });
  mkdirSync(join(orcastratorDir, "log"), { recursive: true });
  writeFileSync(join(orcastratorDir, "decisions.md"), "# Decisions\n\n");
  console.log(chalk.green("✓"), "Created", chalk.bold(".orcastrator/"), "directory");

  console.log();
  console.log(chalk.dim("Next steps:"));
  console.log(chalk.dim("  1. Edit orcastrator.config.ts to customize your agents"));
  console.log(chalk.dim("  2. Run `orcastrator build` to generate agent charters"));
  console.log(chalk.dim('  3. Run `orcastrator run "your task"` to start working'));
}
