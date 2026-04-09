// Skill registry — discover and manage skills

import type { Skill, SkillContext } from "./types.js";

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      throw new Error(`Skill "${skill.name}" is already registered`);
    }
    this.skills.set(skill.name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  list(): Skill[] {
    return [...this.skills.values()];
  }

  async setupAll(context: SkillContext): Promise<void> {
    for (const skill of this.skills.values()) {
      await skill.setup(context);
    }
  }

  async teardownAll(): Promise<void> {
    for (const skill of this.skills.values()) {
      await skill.teardown?.();
    }
  }
}
