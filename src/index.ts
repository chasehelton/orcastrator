#!/usr/bin/env node

// Orcastrator CLI — lightweight multi-agent coding runtime

import { Command } from "commander";
import { initCommand } from "./cli/init.js";
import { buildCommand } from "./cli/build.js";
import { runCommand } from "./cli/run.js";
import { chatCommand } from "./cli/chat.js";
import { issueCommand } from "./cli/issue.js";
import { statusCommand } from "./cli/status.js";
import { agentsCommand } from "./cli/agents.js";

const program = new Command();

program
  .name("orcastrator")
  .description("Lightweight multi-agent coding runtime built on GitHub Copilot SDK")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold a new orcastrator config and .orcastrator/ directory")
  .option("--default", "Use default agent configuration instead of Copilot-powered generation")
  .action(initCommand);

program
  .command("build")
  .description("Generate .orcastrator/ markdown files from config")
  .action(buildCommand);

program
  .command("run")
  .description("Execute an ad-hoc task with your agent team")
  .argument("<task>", "The task description")
  .option("-a, --agent <name>", "Force routing to a specific agent")
  .option("--pr", "Create a PR when done")
  .option("--dry-run", "Show routing without executing")
  .action(runCommand);

program
  .command("chat")
  .description("Start an interactive multi-turn chat session")
  .option("-a, --agent <name>", "Lock to a specific agent (bypass routing)")
  .action(chatCommand);

program
  .command("issue")
  .description("Work on a GitHub issue")
  .argument("<number>", "Issue number", parseInt)
  .option("-r, --repo <owner/repo>", "Repository (defaults to current git remote)")
  .option("-a, --agent <name>", "Force routing to a specific agent")
  .option("--pr", "Create a PR when done")
  .action(issueCommand);

program
  .command("status")
  .description("Show current orcastrator state")
  .action(statusCommand);

program
  .command("agents")
  .description("Manage your agent team")
  .argument("[action]", "Action to perform", "list")
  .action(agentsCommand);

program.parse();
