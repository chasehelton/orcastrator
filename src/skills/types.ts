// Skill types — extensibility contract for future plugins

export interface SkillTool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute(input: unknown): Promise<unknown>;
}

export interface SkillContext {
  workingDirectory: string;
  orcastratorDir: string;
}

export interface Skill {
  name: string;
  description: string;
  tools: SkillTool[];
  setup(context: SkillContext): Promise<void>;
  teardown?(): Promise<void>;
}
