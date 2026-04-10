// Config writer — generates orcastrator.config.ts from Copilot's response

import type { GeneratedConfig } from "./prompt-builder.js";

function escapeTemplateString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? line : pad + line))
    .join("\n");
}

export function generateConfigSource(config: GeneratedConfig): string {
  const agentEntries = config.agents.map((agent) => {
    const expertiseStr = agent.expertise.map((e) => `"${e}"`).join(", ");
    const modelLine = agent.model ? `\n      model: "${agent.model}",` : "";
    const instructions = escapeTemplateString(agent.instructions.trim());

    return `    defineAgent({
      name: "${agent.name}",
      role: "${agent.role}",
      expertise: [${expertiseStr}],${modelLine}
      instructions: \`${indent(instructions, 8)}\`,
    })`;
  });

  const ruleEntries = config.routing.rules.map((rule) => {
    const agentsStr = rule.agents.map((a) => `"${a}"`).join(", ");
    const descPart = rule.description ? `, description: "${escapeTemplateString(rule.description)}"` : "";
    return `      { pattern: /${rule.pattern}/, agents: [${agentsStr}]${descPart} }`;
  });

  return `import { defineOrcastrator, defineAgent, defineRouting } from "@chasehelton/orcastrator";

export default defineOrcastrator({
  name: "${config.projectName}",
  defaultModel: "${config.defaultModel}",

  agents: [
${agentEntries.join(",\n")},
  ],

  routing: defineRouting({
    rules: [
${ruleEntries.join(",\n")},
    ],
    defaultAgent: "${config.routing.defaultAgent}",
  }),

  skills: [],
});
`;
}
