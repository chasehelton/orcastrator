import { describe, it, expect, vi, beforeEach } from "vitest";
import { compileCharter, type CompileCharterOptions } from "../charter-compiler.js";
import type { AgentConfig, OrcastratorConfig } from "../../core/types.js";

vi.mock("../../config/generator.js", () => ({
  readDecisions: vi.fn(),
  readAgentHistory: vi.fn(),
}));

import { readDecisions, readAgentHistory } from "../../config/generator.js";

const mockReadDecisions = readDecisions as ReturnType<typeof vi.fn>;
const mockReadAgentHistory = readAgentHistory as ReturnType<typeof vi.fn>;

describe("compileCharter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createAgentConfig = (overrides?: Partial<AgentConfig>): AgentConfig => ({
    name: "TestAgent",
    role: "Test Specialist",
    expertise: ["testing", "validation"],
    instructions: "Perform comprehensive testing of all components.",
    ...overrides,
  });

  const createConfig = (overrides?: Partial<OrcastratorConfig>): OrcastratorConfig => ({
    agents: [
      createAgentConfig({ name: "TestAgent" }),
      createAgentConfig({ name: "BuildAgent", role: "Build Specialist", expertise: ["build", "ci"] }),
    ],
    ...overrides,
  } as OrcastratorConfig);

  describe("agent identity section", () => {
    it("includes agent identity (name, role)", () => {
      const agent = createAgentConfig();
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).toContain("# You are TestAgent");
      expect(charter).toContain("**Role:** Test Specialist");
    });

    it("includes expertise when present", () => {
      const agent = createAgentConfig({ expertise: ["testing", "validation", "qa"] });
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).toContain("**Expertise:** testing, validation, qa");
    });

    it("omits expertise line when expertise is empty", () => {
      const agent = createAgentConfig({ expertise: [] });
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).not.toContain("**Expertise:**");
    });
  });

  describe("instructions section", () => {
    it("includes instructions section when present", () => {
      const agent = createAgentConfig({
        instructions: "Test all edge cases and error scenarios.",
      });
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).toContain("## Your Instructions");
      expect(charter).toContain("Test all edge cases and error scenarios.");
    });

    it("omits instructions section when not present", () => {
      const agent = createAgentConfig({ instructions: "" });
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).not.toContain("## Your Instructions");
    });

    it("trims whitespace from instructions", () => {
      const agent = createAgentConfig({
        instructions: "  \n  Trimmed instructions\n  ",
      });
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).toContain("Trimmed instructions");
      expect(charter).not.toContain("  \n");
    });
  });

  describe("team section", () => {
    it("includes team context listing teammates", () => {
      const agent = createAgentConfig({ name: "TestAgent" });
      const config = createConfig({
        agents: [
          agent,
          createAgentConfig({ name: "BuildAgent", role: "Build Specialist", expertise: ["build"] }),
          createAgentConfig({ name: "DeployAgent", role: "Deploy Specialist", expertise: ["deploy", "infra"] }),
        ],
      });
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).toContain("## Your Team");
      expect(charter).toContain("**BuildAgent** — Build Specialist (build)");
      expect(charter).toContain("**DeployAgent** — Deploy Specialist (deploy, infra)");
      expect(charter).not.toContain("**TestAgent**"); // Agent should not list itself
    });

    it("omits team section when no other agents exist", () => {
      const agent = createAgentConfig({ name: "SoloAgent" });
      const config = createConfig({ agents: [agent] });
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).not.toContain("## Your Team");
    });

    it("shows 'general' for teammates with empty expertise", () => {
      const agent = createAgentConfig({ name: "TestAgent" });
      const config = createConfig({
        agents: [agent, createAgentConfig({ name: "GenericAgent", expertise: [] })],
      });
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).toContain("**GenericAgent** — Test Specialist (general)");
    });
  });

  describe("decisions section", () => {
    it("includes decisions when readDecisions returns content", () => {
      const agent = createAgentConfig();
      const config = createConfig();
      const decisionsContent = `# Decisions

- Use TypeScript for type safety
- Adopt vitest for testing`;
      mockReadDecisions.mockReturnValue(decisionsContent);
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).toContain("## Recent Team Decisions");
      expect(charter).toContain("- Use TypeScript for type safety");
      expect(charter).toContain("- Adopt vitest for testing");
    });

    it("omits decisions when readDecisions returns empty placeholder", () => {
      const agent = createAgentConfig();
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).not.toContain("## Recent Team Decisions");
    });

    it("omits decisions when readDecisions returns undefined", () => {
      const agent = createAgentConfig();
      const config = createConfig();
      mockReadDecisions.mockReturnValue(undefined);
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).not.toContain("## Recent Team Decisions");
    });

    it("trims whitespace from decisions", () => {
      const agent = createAgentConfig();
      const config = createConfig();
      mockReadDecisions.mockReturnValue("  \n# Decisions\n\n- Decision 1\n  ");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      const lines = charter.split("\n");
      const decisionsIndex = lines.findIndex((l) => l.includes("## Recent Team Decisions"));
      const nextLine = lines[decisionsIndex + 1];

      expect(nextLine).not.toMatch(/^\s+/); // Should not have leading whitespace
    });
  });

  describe("history section", () => {
    it("includes history when readAgentHistory returns content", () => {
      const agent = createAgentConfig({ name: "TestAgent" });
      const config = createConfig();
      const historyContent = `- Learned about the codebase structure
- Identified testing patterns`;
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(historyContent);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).toContain("## What You've Learned About This Project");
      expect(charter).toContain("- Learned about the codebase structure");
    });

    it("omits history when readAgentHistory returns undefined", () => {
      const agent = createAgentConfig();
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).not.toContain("## What You've Learned About This Project");
    });

    it("omits history when readAgentHistory returns empty history placeholder", () => {
      const agent = createAgentConfig({ name: "TestAgent" });
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(`# TestAgent — History\n\n`);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).not.toContain("## What You've Learned About This Project");
    });

    it("passes correct agent name to readAgentHistory", () => {
      const agent = createAgentConfig({ name: "SpecialAgent" });
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      compileCharter({
        agent,
        config,
        orcastratorDir: "/test/dir",
      });

      expect(mockReadAgentHistory).toHaveBeenCalledWith("/test/dir", "SpecialAgent");
    });
  });

  describe("task context section", () => {
    it("includes task context when provided", () => {
      const agent = createAgentConfig();
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);
      const taskContext = "Implement new API endpoint for user authentication";

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
        taskContext,
      });

      expect(charter).toContain("## Current Task Context");
      expect(charter).toContain("Implement new API endpoint for user authentication");
    });

    it("omits task context when not provided", () => {
      const agent = createAgentConfig();
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      expect(charter).not.toContain("## Current Task Context");
    });

    it("omits task context when empty string", () => {
      const agent = createAgentConfig();
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
        taskContext: "",
      });

      expect(charter).not.toContain("## Current Task Context");
    });
  });

  describe("full charter assembly", () => {
    it("assembles full charter with all sections", () => {
      const agent = createAgentConfig({
        name: "TestAgent",
        role: "Quality Engineer",
        expertise: ["testing", "automation"],
        instructions: "Write comprehensive tests for all features.",
      });
      const config = createConfig({
        agents: [
          agent,
          createAgentConfig({ name: "DevAgent", role: "Developer", expertise: ["development"] }),
        ],
      });
      const decisionsContent = `# Decisions

- Use TypeScript
- Test everything`;
      const historyContent = `- Set up vitest
- Created test utilities`;
      const taskContext = "Add authentication module";

      mockReadDecisions.mockReturnValue(decisionsContent);
      mockReadAgentHistory.mockReturnValue(historyContent);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
        taskContext,
      });

      // Verify all sections are present
      expect(charter).toContain("# You are TestAgent");
      expect(charter).toContain("**Role:** Quality Engineer");
      expect(charter).toContain("**Expertise:** testing, automation");
      expect(charter).toContain("## Your Instructions");
      expect(charter).toContain("Write comprehensive tests for all features.");
      expect(charter).toContain("## Your Team");
      expect(charter).toContain("**DevAgent** — Developer (development)");
      expect(charter).toContain("## Recent Team Decisions");
      expect(charter).toContain("- Use TypeScript");
      expect(charter).toContain("## What You've Learned About This Project");
      expect(charter).toContain("- Set up vitest");
      expect(charter).toContain("## Current Task Context");
      expect(charter).toContain("Add authentication module");

      // Verify sections appear in correct order
      const lines = charter.split("\n");
      const identityIndex = lines.findIndex((l) => l.includes("# You are"));
      const instructionsIndex = lines.findIndex((l) => l.includes("## Your Instructions"));
      const teamIndex = lines.findIndex((l) => l.includes("## Your Team"));
      const decisionsIndex = lines.findIndex((l) => l.includes("## Recent Team Decisions"));
      const historyIndex = lines.findIndex((l) => l.includes("## What You've Learned"));
      const taskIndex = lines.findIndex((l) => l.includes("## Current Task Context"));

      expect(identityIndex).toBeLessThan(instructionsIndex);
      expect(instructionsIndex).toBeLessThan(teamIndex);
      expect(teamIndex).toBeLessThan(decisionsIndex);
      expect(decisionsIndex).toBeLessThan(historyIndex);
      expect(historyIndex).toBeLessThan(taskIndex);
    });

    it("assembles minimal charter with only required sections", () => {
      const agent = createAgentConfig({
        name: "MinimalAgent",
        instructions: "",
      });
      const config = createConfig({ agents: [agent] });
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
      });

      // Should only have identity section
      expect(charter).toContain("# You are MinimalAgent");
      expect(charter).not.toContain("## Your Instructions");
      expect(charter).not.toContain("## Your Team");
      expect(charter).not.toContain("## Recent Team Decisions");
      expect(charter).not.toContain("## What You've Learned");
      expect(charter).not.toContain("## Current Task Context");
    });
  });

  describe("section formatting", () => {
    it("adds blank lines between sections", () => {
      const agent = createAgentConfig({ instructions: "Do the work" });
      const config = createConfig({
        agents: [agent, createAgentConfig({ name: "OtherAgent" })],
      });
      mockReadDecisions.mockReturnValue("# Decisions\n- Something");
      mockReadAgentHistory.mockReturnValue("# Agent — History\n- Learned");

      const charter = compileCharter({
        agent,
        config,
        orcastratorDir: "/test",
        taskContext: "Task here",
      });

      // Verify sections are separated by blank lines
      const sections = charter.split("\n\n");
      expect(sections.length).toBeGreaterThan(1);
      // Each section should not be empty
      sections.forEach((section) => {
        expect(section.trim()).not.toBe("");
      });
    });
  });

  describe("mocked function calls", () => {
    it("calls readDecisions with correct orcastrator directory", () => {
      const agent = createAgentConfig();
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      compileCharter({
        agent,
        config,
        orcastratorDir: "/path/to/orcastrator",
      });

      expect(mockReadDecisions).toHaveBeenCalledWith("/path/to/orcastrator");
    });

    it("calls readAgentHistory with correct parameters", () => {
      const agent = createAgentConfig({ name: "MyAgent" });
      const config = createConfig();
      mockReadDecisions.mockReturnValue("# Decisions");
      mockReadAgentHistory.mockReturnValue(undefined);

      compileCharter({
        agent,
        config,
        orcastratorDir: "/path/to/orcastrator",
      });

      expect(mockReadAgentHistory).toHaveBeenCalledWith("/path/to/orcastrator", "MyAgent");
    });
  });
});
