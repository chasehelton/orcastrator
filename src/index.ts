#!/usr/bin/env node

// Orcastrator CLI — lightweight multi-agent coding runtime

import { Command } from "commander";
import { createRequire } from "module";
import { initCommand } from "./cli/init.js";
import { buildCommand } from "./cli/build.js";
import { runCommand } from "./cli/run.js";
import { chatCommand } from "./cli/chat.js";
import { issueCommand } from "./cli/issue.js";
import { issueListCommand } from "./cli/list.js";
import { statusCommand } from "./cli/status.js";
import { agentsCommand } from "./cli/agents.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command();

program
  .name("orcastrator")
  .description("Lightweight multi-agent coding runtime built on GitHub Copilot SDK")
  .version(version);

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
  .description("Work on a GitHub or Linear issue")
  .argument("<ref>", "GitHub issue number (e.g. 42) or Linear identifier (e.g. ENG-123)")
  .option("-r, --repo <owner/repo>", "GitHub repository (defaults to current git remote)")
  .option("-a, --agent <name>", "Force routing to a specific agent")
  .option("-p, --provider <github|linear>", "Issue provider (auto-detected from ref format by default)")
  .option("--pr", "Create a PR when done")
  .action(issueCommand);

program
  .command("list")
  .description("List open issues from Linear or GitHub")
  .option("-p, --provider <github|linear>", "Issue provider (auto-detected from config by default)")
  .option("-t, --team <key>", "Linear team key to filter by (e.g. ENG)")
  .option("--mine", "Only show issues assigned to you")
  .option("-r, --repo <owner/repo>", "GitHub repository (for GitHub issues)")
  .action(issueListCommand);

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
