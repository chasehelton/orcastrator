import { describe, it, expect } from "vitest";
import {
  defineAgent,
  defineRouting,
  defineOrcastrator,
  AgentConfigSchema,
  RoutingConfigSchema,
  OrcastratorConfigSchema,
} from "../builder.js";

describe("defineAgent", () => {
  it("should succeed with valid name", () => {
    const result = defineAgent({
      name: "search-agent",
      role: "Search specialist",
    });

    expect(result.name).toBe("search-agent");
    expect(result.role).toBe("Search specialist");
    expect(result.expertise).toEqual([]);
    expect(result.instructions).toBe("");
  });

  it("should reject uppercase names", () => {
    expect(() => {
      defineAgent({
        name: "SearchAgent",
        role: "Search specialist",
      });
    }).toThrow("Agent names must be lowercase alphanumeric with hyphens");
  });

  it("should reject names starting with number", () => {
    expect(() => {
      defineAgent({
        name: "1-search",
        role: "Search specialist",
      });
    }).toThrow("Agent names must be lowercase alphanumeric with hyphens");
  });

  it("should reject names with spaces", () => {
    expect(() => {
      defineAgent({
        name: "search agent",
        role: "Search specialist",
      });
    }).toThrow("Agent names must be lowercase alphanumeric with hyphens");
  });

  it("should apply default expertise=[] and instructions=''", () => {
    const result = defineAgent({
      name: "basic-agent",
      role: "Basic role",
    });

    expect(result.expertise).toEqual([]);
    expect(result.instructions).toBe("");
  });

  it("should accept custom expertise and instructions", () => {
    const result = defineAgent({
      name: "expert-agent",
      role: "Expert role",
      expertise: ["Python", "TypeScript"],
      instructions: "Be helpful",
    });

    expect(result.expertise).toEqual(["Python", "TypeScript"]);
    expect(result.instructions).toBe("Be helpful");
  });

  it("should accept optional model", () => {
    const result = defineAgent({
      name: "model-agent",
      role: "Model agent",
      model: "claude-opus-4.6",
    });

    expect(result.model).toBe("claude-opus-4.6");
  });

  it("should reject empty name", () => {
    expect(() => {
      defineAgent({
        name: "",
        role: "Empty name agent",
      });
    }).toThrow();
  });

  it("should reject empty role", () => {
    expect(() => {
      defineAgent({
        name: "no-role-agent",
        role: "",
      });
    }).toThrow();
  });

  it("should reject names with special characters", () => {
    expect(() => {
      defineAgent({
        name: "agent@domain",
        role: "Special char agent",
      });
    }).toThrow("Agent names must be lowercase alphanumeric with hyphens");
  });

  it("should reject names with underscores", () => {
    expect(() => {
      defineAgent({
        name: "agent_name",
        role: "Underscore agent",
      });
    }).toThrow("Agent names must be lowercase alphanumeric with hyphens");
  });
});

describe("defineRouting", () => {
  it("should validate successfully with string patterns", () => {
    const result = defineRouting({
      defaultAgent: "search-agent",
      rules: [
        {
          pattern: "search",
          agents: ["search-agent"],
          description: "Route search queries",
        },
      ],
    });

    expect(result.defaultAgent).toBe("search-agent");
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].pattern).toBe("search");
    expect(result.rules[0].agents).toEqual(["search-agent"]);
  });

  it("should validate successfully with regex patterns", () => {
    const pattern = /search|query/i;
    const result = defineRouting({
      defaultAgent: "search-agent",
      rules: [
        {
          pattern,
          agents: ["search-agent"],
        },
      ],
    });

    expect(result.rules[0].pattern).toEqual(pattern);
  });

  it("should apply default empty rules", () => {
    const result = defineRouting({
      defaultAgent: "default-agent",
    });

    expect(result.rules).toEqual([]);
  });

  it("should allow multiple agents per rule", () => {
    const result = defineRouting({
      defaultAgent: "agent-1",
      rules: [
        {
          pattern: "complex",
          agents: ["agent-1", "agent-2", "agent-3"],
        },
      ],
    });

    expect(result.rules[0].agents).toEqual(["agent-1", "agent-2", "agent-3"]);
  });

  it("should reject empty agents array", () => {
    expect(() => {
      defineRouting({
        defaultAgent: "search-agent",
        rules: [
          {
            pattern: "search",
            agents: [],
          },
        ],
      });
    }).toThrow();
  });

  it("should reject missing defaultAgent", () => {
    expect(() => {
      defineRouting({
        rules: [],
      } as any);
    }).toThrow();
  });
});

describe("defineOrcastrator", () => {
  it("should succeed with valid config", () => {
    const result = defineOrcastrator({
      agents: [
        {
          name: "search-agent",
          role: "Search specialist",
        },
      ],
      routing: {
        defaultAgent: "search-agent",
        rules: [],
      },
    });

    expect(result.name).toBe("orcastrator");
    expect(result.defaultModel).toBe("claude-sonnet-4.6");
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].name).toBe("search-agent");
  });

  it("should apply default name='orcastrator' and defaultModel", () => {
    const result = defineOrcastrator({
      agents: [
        {
          name: "agent-1",
          role: "Agent 1",
        },
      ],
      routing: {
        defaultAgent: "agent-1",
      },
    });

    expect(result.name).toBe("orcastrator");
    expect(result.defaultModel).toBe("claude-sonnet-4.6");
  });

  it("should accept custom name and defaultModel", () => {
    const result = defineOrcastrator({
      name: "my-orchestrator",
      defaultModel: "claude-opus-4.6",
      agents: [
        {
          name: "agent-1",
          role: "Agent 1",
        },
      ],
      routing: {
        defaultAgent: "agent-1",
      },
    });

    expect(result.name).toBe("my-orchestrator");
    expect(result.defaultModel).toBe("claude-opus-4.6");
  });

  it("should reject unknown agent in routing rules", () => {
    expect(() => {
      defineOrcastrator({
        agents: [
          {
            name: "search-agent",
            role: "Search specialist",
          },
        ],
        routing: {
          defaultAgent: "search-agent",
          rules: [
            {
              pattern: "complex",
              agents: ["unknown-agent"],
            },
          ],
        },
      });
    }).toThrow(
      'Routing rule references unknown agent "unknown-agent". Known agents: search-agent',
    );
  });

  it("should reject unknown defaultAgent", () => {
    expect(() => {
      defineOrcastrator({
        agents: [
          {
            name: "search-agent",
            role: "Search specialist",
          },
        ],
        routing: {
          defaultAgent: "unknown-agent",
          rules: [],
        },
      });
    }).toThrow('Default agent "unknown-agent" not found in agents list');
  });

  it("should parse modelTiers correctly", () => {
    const result = defineOrcastrator({
      agents: [
        {
          name: "agent-1",
          role: "Agent 1",
        },
      ],
      routing: {
        defaultAgent: "agent-1",
      },
      modelTiers: {
        fast: "claude-haiku-4.5",
        standard: "claude-sonnet-4.6",
        premium: "claude-opus-4.6",
      },
    });

    expect(result.modelTiers).toBeDefined();
    expect(result.modelTiers?.fast).toBe("claude-haiku-4.5");
    expect(result.modelTiers?.standard).toBe("claude-sonnet-4.6");
    expect(result.modelTiers?.premium).toBe("claude-opus-4.6");
  });

  it("should parse partial modelTiers", () => {
    const result = defineOrcastrator({
      agents: [
        {
          name: "agent-1",
          role: "Agent 1",
        },
      ],
      routing: {
        defaultAgent: "agent-1",
      },
      modelTiers: {
        fast: "claude-haiku-4.5",
      },
    });

    expect(result.modelTiers?.fast).toBe("claude-haiku-4.5");
    expect(result.modelTiers?.standard).toBeUndefined();
    expect(result.modelTiers?.premium).toBeUndefined();
  });

  it("should normalize guardrails with guardrails=true", () => {
    const result = defineOrcastrator({
      agents: [
        {
          name: "agent-1",
          role: "Agent 1",
        },
      ],
      routing: {
        defaultAgent: "agent-1",
      },
      guardrails: true,
    });

    expect(result.guardrails).toBeDefined();
    // guardrails should be normalized to a full config object
    expect(typeof result.guardrails).toBe("object");
  });

  it("should accept guardrails as object", () => {
    const result = defineOrcastrator({
      agents: [
        {
          name: "agent-1",
          role: "Agent 1",
        },
      ],
      routing: {
        defaultAgent: "agent-1",
      },
      guardrails: {
        blockedCommands: ["rm -rf /"],
      },
    });

    expect(result.guardrails).toBeDefined();
  });

  it("should support multiple agents with routing rules", () => {
    const result = defineOrcastrator({
      agents: [
        {
          name: "search-agent",
          role: "Search specialist",
        },
        {
          name: "analysis-agent",
          role: "Analysis specialist",
        },
      ],
      routing: {
        defaultAgent: "search-agent",
        rules: [
          {
            pattern: "analyze",
            agents: ["analysis-agent"],
          },
          {
            pattern: "search|query",
            agents: ["search-agent"],
          },
        ],
      },
    });

    expect(result.agents).toHaveLength(2);
    expect(result.routing.rules).toHaveLength(2);
  });

  it("should allow rule to reference multiple agents", () => {
    const result = defineOrcastrator({
      agents: [
        {
          name: "agent-1",
          role: "Agent 1",
        },
        {
          name: "agent-2",
          role: "Agent 2",
        },
      ],
      routing: {
        defaultAgent: "agent-1",
        rules: [
          {
            pattern: "complex",
            agents: ["agent-1", "agent-2"],
          },
        ],
      },
    });

    expect(result.routing.rules[0].agents).toEqual(["agent-1", "agent-2"]);
  });

  it("should reject when agents array is empty", () => {
    expect(() => {
      defineOrcastrator({
        agents: [],
        routing: {
          defaultAgent: "search-agent",
        },
      });
    }).toThrow();
  });

  it("should include skills in result", () => {
    const result = defineOrcastrator({
      agents: [
        {
          name: "agent-1",
          role: "Agent 1",
        },
      ],
      routing: {
        defaultAgent: "agent-1",
      },
      skills: ["skill-1", "skill-2"],
    });

    expect(result.skills).toEqual(["skill-1", "skill-2"]);
  });

  it("should apply default empty skills array", () => {
    const result = defineOrcastrator({
      agents: [
        {
          name: "agent-1",
          role: "Agent 1",
        },
      ],
      routing: {
        defaultAgent: "agent-1",
      },
    });

    expect(result.skills).toEqual([]);
  });

  it("should include linear config if provided", () => {
    const result = defineOrcastrator({
      agents: [
        {
          name: "agent-1",
          role: "Agent 1",
        },
      ],
      routing: {
        defaultAgent: "agent-1",
      },
      linear: {
        apiKey: "test-key",
        defaultTeam: "ENG",
      },
    });

    expect(result.linear).toBeDefined();
    expect(result.linear?.apiKey).toBe("test-key");
    expect(result.linear?.defaultTeam).toBe("ENG");
  });
});
