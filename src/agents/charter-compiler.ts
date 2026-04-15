// Charter compiler — assembles the full system prompt for an agent session

import type { AgentConfig, OrcastratorConfig } from "../core/types.js";
import { readDecisions, readAgentHistory } from "../config/generator.js";
import type { SkillFile } from "../skills/loader.js";

export interface CompileCharterOptions {
  agent: AgentConfig;
  config: OrcastratorConfig;
  orcastratorDir: string;
  taskContext?: string;
  skills?: SkillFile[];
}

export function compileCharter(options: CompileCharterOptions): string {
  const { agent, config, orcastratorDir, taskContext, skills } = options;

  const sections: string[] = [];

  // Identity
  sections.push(`# You are ${agent.name}`);
  sections.push(`**Role:** ${agent.role}`);

  if (agent.expertise.length > 0) {
    sections.push(
      `**Expertise:** ${agent.expertise.join(", ")}`,
    );
  }

  sections.push("");

  // Instructions
  if (agent.instructions) {
    sections.push("## Your Instructions");
    sections.push(agent.instructions.trim());
    sections.push("");
  }

  // Team context
  const teammates = config.agents.filter((a) => a.name !== agent.name);
  if (teammates.length > 0) {
    sections.push("## Your Team");
    for (const mate of teammates) {
      sections.push(
        `- **${mate.name}** — ${mate.role} (${mate.expertise.join(", ") || "general"})`,
      );
    }
    sections.push("");
  }

  // Relevant skills
  if (skills && skills.length > 0) {
    sections.push("## Relevant Skills");
    for (const skill of skills) {
      sections.push(`### ${skill.meta.name} (${skill.meta.domain})`);
      sections.push(skill.body);
      sections.push("");
    }
  }

  // Recent decisions
  const decisions = readDecisions(orcastratorDir);
  if (decisions && decisions.trim() !== "# Decisions") {
    sections.push("## Recent Team Decisions");
    sections.push(decisions.trim());
    sections.push("");
  }

  // Agent's own history
  const history = readAgentHistory(orcastratorDir, agent.name);
  if (history && !history.startsWith(`# ${agent.name} — History\n\n`?.trimEnd())) {
    sections.push("## What You've Learned About This Project");
    sections.push(history.trim());
    sections.push("");
  }

  // Task context
  if (taskContext) {
    sections.push("## Current Task Context");
    sections.push(taskContext);
    sections.push("");
  }

  return sections.join("\n");
}
