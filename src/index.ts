#!/usr/bin/env node

// Orcastrator CLI — lightweight multi-agent coding runtime

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env and .env.local from cwd (like Next.js) so secrets like
// LINEAR_API_KEY work without exporting them in the shell session.
for (const file of [".env", ".env.local"]) {
  try {
    const contents = readFileSync(resolve(process.cwd(), file), "utf-8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // file doesn't exist — that's fine
  }
}

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
import { napCommand } from "./cli/nap.js";
import { exportCommand } from "./cli/export.js";
import { importCommand } from "./cli/import-config.js";
import { doctorCommand } from "./cli/doctor.js";

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
  .option("-q, --quiet", "Minimal output (spinner only)")
  .option("-v, --verbose", "Show detailed tool call information")
  .action(runCommand);

program
  .command("chat")
  .description("Start an interactive multi-turn chat session")
  .option("-a, --agent <name>", "Lock to a specific agent (bypass routing)")
  .option("-q, --quiet", "Minimal output (no activity panel)")
  .option("-v, --verbose", "Show detailed tool call information")
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
  .argument("[action]", "Action to perform (list, create)", "list")
  .argument("[description]", "Agent description (for create)")
  .action(agentsCommand);

program
  .command("nap")
  .description("Compress history and prune old logs")
  .option("--dry-run", "Show what would be cleaned without making changes")
  .option("--keep <n>", "Number of history entries to keep", "20")
  .action(napCommand);

program
  .command("doctor")
  .description("Check environment and configuration health")
  .action(doctorCommand);

program
  .command("export [output]")
  .description("Export configuration and state to a portable snapshot")
  .action(exportCommand);

program
  .command("import <file>")
  .description("Import configuration and state from a snapshot")
  .option("--merge", "Merge with existing state instead of overwriting", true)
  .action(importCommand);

program.parse();
