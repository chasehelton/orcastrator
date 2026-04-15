import { describe, it, expect } from "vitest";
import { matchRoute, determineStrategy } from "../router.js";
import type { OrcastratorConfig } from "../types.js";

/**
 * Helper function to create a minimal valid config for testing
 */
function makeConfig(overrides?: Partial<OrcastratorConfig>): OrcastratorConfig {
  return {
    name: "test-config",
    defaultModel: "gpt-4",
    agents: [
      {
        name: "default-agent",
        role: "general",
        expertise: ["general"],
        instructions: "Default agent",
      },
      {
        name: "code-agent",
        role: "developer",
        expertise: ["coding", "debugging"],
        instructions: "Code specialist agent",
      },
      {
        name: "docs-agent",
        role: "writer",
        expertise: ["documentation"],
        instructions: "Documentation specialist agent",
      },
    ],
    routing: {
      rules: [],
      defaultAgent: "default-agent",
    },
    skills: [],
    ...overrides,
  };
}

describe("matchRoute", () => {
  it("should match pattern and return correct agents with pattern confidence", () => {
    const config = makeConfig({
      routing: {
        rules: [
          {
            pattern: "debug|fix|error",
            agents: ["code-agent"],
            description: "Code debugging",
          },
        ],
        defaultAgent: "default-agent",
      },
    });

    const result = matchRoute("Please debug this code", config);

    expect(result.agents).toEqual(["code-agent"]);
    expect(result.confidence).toBe("pattern");
  });

  it("should return matchedRule with pattern source", () => {
    const patternSource = "bug|issue|crash";
    const config = makeConfig({
      routing: {
        rules: [
          {
            pattern: patternSource,
            agents: ["code-agent"],
          },
        ],
        defaultAgent: "default-agent",
      },
    });

    const result = matchRoute("Fix this bug", config);

    expect(result.matchedRule).toBe(patternSource);
  });

  it("should return default agent and confidence when no pattern matches", () => {
    const config = makeConfig({
      routing: {
        rules: [
          {
            pattern: "code|debug|error",
            agents: ["code-agent"],
          },
        ],
        defaultAgent: "default-agent",
      },
    });

    const result = matchRoute("What is the meaning of life?", config);

    expect(result.agents).toEqual(["default-agent"]);
    expect(result.confidence).toBe("default");
  });

  it("should be case insensitive", () => {
    const config = makeConfig({
      routing: {
        rules: [
          {
            pattern: "documentation|guide|manual",
            agents: ["docs-agent"],
          },
        ],
        defaultAgent: "default-agent",
      },
    });

    const result1 = matchRoute("Write DOCUMENTATION for the API", config);
    const result2 = matchRoute("write documentation for the api", config);
    const result3 = matchRoute("WRITE DOCUMENTATION FOR THE API", config);

    expect(result1.agents).toEqual(["docs-agent"]);
    expect(result2.agents).toEqual(["docs-agent"]);
    expect(result3.agents).toEqual(["docs-agent"]);
  });

  it("should work with RegExp patterns", () => {
    const config = makeConfig({
      routing: {
        rules: [
          {
            pattern: /^test.*suite/i,
            agents: ["code-agent"],
          },
        ],
        defaultAgent: "default-agent",
      },
    });

    const result = matchRoute("Test the entire test suite", config);

    expect(result.agents).toEqual(["code-agent"]);
    expect(result.confidence).toBe("pattern");
  });

  it("should convert string patterns to RegExp", () => {
    const config = makeConfig({
      routing: {
        rules: [
          {
            pattern: "analyze|inspect|review",
            agents: ["code-agent"],
          },
        ],
        defaultAgent: "default-agent",
      },
    });

    const result = matchRoute("Please analyze this function", config);

    expect(result.agents).toEqual(["code-agent"]);
    expect(result.confidence).toBe("pattern");
  });

  it("should return first matching rule when multiple rules match", () => {
    const config = makeConfig({
      routing: {
        rules: [
          {
            pattern: "code|debug",
            agents: ["code-agent"],
            description: "First rule",
          },
          {
            pattern: "debug|review",
            agents: ["docs-agent"],
            description: "Second rule",
          },
        ],
        defaultAgent: "default-agent",
      },
    });

    const result = matchRoute("Debug this function", config);

    expect(result.agents).toEqual(["code-agent"]);
    expect(result.matchedRule).toBe("code|debug");
  });

  it("should handle multiple agents in a single rule", () => {
    const config = makeConfig({
      routing: {
        rules: [
          {
            pattern: "refactor|optimize",
            agents: ["code-agent", "docs-agent"],
          },
        ],
        defaultAgent: "default-agent",
      },
    });

    const result = matchRoute("Refactor this code", config);

    expect(result.agents).toEqual(["code-agent", "docs-agent"]);
    expect(result.confidence).toBe("pattern");
  });

  it("should not return matchedRule for default matches", () => {
    const config = makeConfig({
      routing: {
        rules: [
          {
            pattern: "specific|pattern",
            agents: ["code-agent"],
          },
        ],
        defaultAgent: "default-agent",
      },
    });

    const result = matchRoute("Random unmatched query", config);

    expect(result.matchedRule).toBeUndefined();
  });
});

describe("determineStrategy", () => {
  it("should return fallback strategy when agents array is empty", () => {
    const match = {
      agents: [],
      confidence: "default" as const,
    };

    const strategy = determineStrategy(match);

    expect(strategy).toBe("fallback");
  });

  it("should return single strategy when exactly one agent is present", () => {
    const match = {
      agents: ["code-agent"],
      confidence: "pattern" as const,
    };

    const strategy = determineStrategy(match);

    expect(strategy).toBe("single");
  });

  it("should return multi strategy when two agents are present", () => {
    const match = {
      agents: ["code-agent", "docs-agent"],
      confidence: "pattern" as const,
    };

    const strategy = determineStrategy(match);

    expect(strategy).toBe("multi");
  });

  it("should return multi strategy when more than two agents are present", () => {
    const match = {
      agents: ["code-agent", "docs-agent", "default-agent"],
      confidence: "pattern" as const,
    };

    const strategy = determineStrategy(match);

    expect(strategy).toBe("multi");
  });
});

describe("Router integration scenarios", () => {
  it("should handle complete routing workflow from pattern match to strategy", () => {
    const config = makeConfig({
      routing: {
        rules: [
          {
            pattern: "refactor|optimize|performance",
            agents: ["code-agent", "docs-agent"],
          },
        ],
        defaultAgent: "default-agent",
      },
    });

    const match = matchRoute("Refactor this for better performance", config);
    const strategy = determineStrategy(match);

    expect(match.agents).toEqual(["code-agent", "docs-agent"]);
    expect(match.confidence).toBe("pattern");
    expect(strategy).toBe("multi");
  });

  it("should handle default routing workflow", () => {
    const config = makeConfig({
      routing: {
        rules: [],
        defaultAgent: "default-agent",
      },
    });

    const match = matchRoute("What is the weather?", config);
    const strategy = determineStrategy(match);

    expect(match.agents).toEqual(["default-agent"]);
    expect(match.confidence).toBe("default");
    expect(strategy).toBe("single");
  });

  it("should handle edge case with empty rules and empty default agents", () => {
    const config = makeConfig({
      routing: {
        rules: [],
        defaultAgent: "default-agent",
      },
    });

    const match = matchRoute("Test query", config);
    const strategy = determineStrategy(match);

    expect(strategy).toBe("single");
    expect(match.confidence).toBe("default");
  });
});
