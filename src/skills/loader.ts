// Skill file loader — reads SKILL.md files from .orcastrator/skills/

import fs from "node:fs";
import path from "node:path";

export interface SkillMeta {
  name: string;
  domain: string;
  triggers: string[];
}

export interface SkillFile {
  meta: SkillMeta;
  body: string;
  path: string;
}

export function parseSkillFrontmatter(content: string): {
  meta: SkillMeta;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid SKILL.md: missing YAML frontmatter");
  }

  const [, yaml, body] = match;
  const meta: SkillMeta = { name: "", domain: "", triggers: [] };

  const lines = yaml.split("\n");
  let parsingTriggers = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // YAML list item under triggers
    if (parsingTriggers && trimmed.startsWith("- ")) {
      meta.triggers.push(trimmed.slice(2).trim());
      continue;
    }

    parsingTriggers = false;

    const kvMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (!kvMatch) continue;

    const [, key, value] = kvMatch;
    switch (key) {
      case "name":
        meta.name = value.trim();
        break;
      case "domain":
        meta.domain = value.trim();
        break;
      case "triggers":
        parsingTriggers = true;
        // Handle inline list: triggers: [a, b]
        if (value.trim()) {
          const inline = value.trim().replace(/^\[|\]$/g, "");
          meta.triggers = inline.split(",").map((s) => s.trim());
        }
        break;
    }
  }

  return { meta, body: body.trim() };
}

export function loadSkillFiles(orcastratorDir: string): SkillFile[] {
  const skillsDir = path.join(orcastratorDir, "skills");

  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skills: SkillFile[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;

    try {
      const content = fs.readFileSync(skillPath, "utf-8");
      const { meta, body } = parseSkillFrontmatter(content);
      skills.push({ meta, body, path: skillPath });
    } catch {
      // Skip malformed SKILL.md files
    }
  }

  return skills;
}

export function matchSkills(task: string, skills: SkillFile[]): SkillFile[] {
  const lower = task.toLowerCase();
  return skills.filter((skill) =>
    skill.meta.triggers.some((trigger) => {
      const pattern = new RegExp(`\\b${escapeRegex(trigger.toLowerCase())}\\b`);
      return pattern.test(lower);
    }),
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
