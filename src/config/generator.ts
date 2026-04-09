// Config generator — generates .orcastrator/ markdown files from config

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrcastratorConfig, AgentConfig } from "../core/types.js";

export function generateOrcastratorDir(
  config: OrcastratorConfig,
  outputDir: string,
): void {
  // Create directory structure
  mkdirSync(join(outputDir, "agents"), { recursive: true });
  mkdirSync(join(outputDir, "log"), { recursive: true });

  // Generate team.md
  writeFileSync(join(outputDir, "team.md"), generateTeamMd(config));

  // Generate routing.md
  writeFileSync(join(outputDir, "routing.md"), generateRoutingMd(config));

  // Initialize decisions.md (preserve existing)
  const decisionsPath = join(outputDir, "decisions.md");
  if (!existsSync(decisionsPath)) {
    writeFileSync(decisionsPath, "# Decisions\n\n");
  }

  // Generate agent directories
  for (const agent of config.agents) {
    const agentDir = join(outputDir, "agents", agent.name);
    mkdirSync(agentDir, { recursive: true });

    // Always regenerate charter (it's derived from config)
    writeFileSync(
      join(agentDir, "charter.md"),
      generateCharterMd(agent, config),
    );

    // Preserve existing history
    const historyPath = join(agentDir, "history.md");
    if (!existsSync(historyPath)) {
      writeFileSync(historyPath, `# ${agent.name} — History\n\n`);
    }
  }
}

function generateTeamMd(config: OrcastratorConfig): string {
  const lines = [
    `# ${config.name}`,
    "",
    "## Team Roster",
    "",
    "| Agent | Role | Expertise | Model |",
    "|-------|------|-----------|-------|",
  ];

  for (const agent of config.agents) {
    const expertise = agent.expertise.join(", ") || "—";
    const model = agent.model ?? config.defaultModel;
    lines.push(`| ${agent.name} | ${agent.role} | ${expertise} | ${model} |`);
  }

  lines.push("");
  return lines.join("\n");
}

function generateRoutingMd(config: OrcastratorConfig): string {
  const lines = [
    "# Routing Rules",
    "",
    `**Default agent:** ${config.routing.defaultAgent}`,
    "",
    "## Rules",
    "",
    "| Pattern | Agents | Description |",
    "|---------|--------|-------------|",
  ];

  for (const rule of config.routing.rules) {
    const pattern =
      rule.pattern instanceof RegExp
        ? rule.pattern.source
        : String(rule.pattern);
    const agents = rule.agents.join(", ");
    const desc = rule.description ?? "—";
    lines.push(`| \`${pattern}\` | ${agents} | ${desc} |`);
  }

  lines.push("");
  return lines.join("\n");
}

function generateCharterMd(
  agent: AgentConfig,
  config: OrcastratorConfig,
): string {
  const model = agent.model ?? config.defaultModel;

  const lines = [
    `# ${agent.name}`,
    "",
    `**Role:** ${agent.role}`,
    "",
    "## Model",
    "",
    `**Preferred:** ${model}`,
    "",
  ];

  if (agent.expertise.length > 0) {
    lines.push("## Expertise", "");
    for (const skill of agent.expertise) {
      lines.push(`- ${skill}`);
    }
    lines.push("");
  }

  if (agent.instructions) {
    lines.push("## Instructions", "", agent.instructions.trim(), "");
  }

  // Team context section (filled at compile time)
  lines.push("## Team Context", "", "*Injected at runtime by charter compiler*", "");

  return lines.join("\n");
}

export function readDecisions(outputDir: string, limit = 20): string {
  const decisionsPath = join(outputDir, "decisions.md");
  if (!existsSync(decisionsPath)) return "";

  const content = readFileSync(decisionsPath, "utf-8");
  const entries = content.split("\n---\n").slice(-limit);
  return entries.join("\n---\n");
}

export function readAgentHistory(
  outputDir: string,
  agentName: string,
  limit = 10,
): string {
  const historyPath = join(outputDir, "agents", agentName, "history.md");
  if (!existsSync(historyPath)) return "";

  const content = readFileSync(historyPath, "utf-8");
  const entries = content.split("\n---\n").slice(-limit);
  return entries.join("\n---\n");
}
