import { describe, it, expect } from "vitest";
import { resolveModel } from "../model-selector.js";
import type { AgentConfig, OrcastratorConfig } from "../../core/types.js";
import type { ModelTierSuggestion } from "../../core/response-tiers.js";

// Helper function to create a minimal AgentConfig
function createAgent(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    name: "test-agent",
    role: "test",
    expertise: [],
    instructions: "Test instructions",
    ...overrides,
  };
}

// Helper function to create a minimal OrcastratorConfig
function createConfig(overrides?: Partial<OrcastratorConfig>): OrcastratorConfig {
  return {
    defaultModel: "default-model",
    ...overrides,
  } as OrcastratorConfig;
}

describe("resolveModel", () => {
  it("returns agent model when explicitly set", () => {
    const agent = createAgent({ model: "agent-model" });
    const config = createConfig({ defaultModel: "default-model" });

    const result = resolveModel(agent, config, "premium");

    expect(result).toBe("agent-model");
  });

  it("returns config defaultModel when agent has no model and no tier provided", () => {
    const agent = createAgent();
    const config = createConfig({ defaultModel: "default-model" });

    const result = resolveModel(agent, config);

    expect(result).toBe("default-model");
  });

  it("returns fast model when tier is fast and modelTiers configured", () => {
    const agent = createAgent();
    const config = createConfig({
      defaultModel: "default-model",
      modelTiers: {
        fast: "fast-model",
        standard: "standard-model",
        premium: "premium-model",
      },
    });

    const result = resolveModel(agent, config, "fast");

    expect(result).toBe("fast-model");
  });

  it("returns standard model when tier is standard and modelTiers configured", () => {
    const agent = createAgent();
    const config = createConfig({
      defaultModel: "default-model",
      modelTiers: {
        fast: "fast-model",
        standard: "standard-model",
        premium: "premium-model",
      },
    });

    const result = resolveModel(agent, config, "standard");

    expect(result).toBe("standard-model");
  });

  it("returns premium model when tier is premium and modelTiers configured", () => {
    const agent = createAgent();
    const config = createConfig({
      defaultModel: "default-model",
      modelTiers: {
        fast: "fast-model",
        standard: "standard-model",
        premium: "premium-model",
      },
    });

    const result = resolveModel(agent, config, "premium");

    expect(result).toBe("premium-model");
  });

  it("returns defaultModel when tier is fast but modelTiers not configured", () => {
    const agent = createAgent();
    const config = createConfig({
      defaultModel: "default-model",
      // no modelTiers
    });

    const result = resolveModel(agent, config, "fast");

    expect(result).toBe("default-model");
  });

  it("returns defaultModel when tier is none", () => {
    const agent = createAgent();
    const config = createConfig({
      defaultModel: "default-model",
      modelTiers: {
        fast: "fast-model",
        standard: "standard-model",
        premium: "premium-model",
      },
    });

    const result = resolveModel(agent, config, "none");

    expect(result).toBe("default-model");
  });

  it("returns agent model when agent has model and tier is premium", () => {
    const agent = createAgent({ model: "agent-model" });
    const config = createConfig({
      defaultModel: "default-model",
      modelTiers: {
        fast: "fast-model",
        standard: "standard-model",
        premium: "premium-model",
      },
    });

    const result = resolveModel(agent, config, "premium");

    expect(result).toBe("agent-model");
  });

  it("handles partial modelTiers configuration (missing tier)", () => {
    const agent = createAgent();
    const config = createConfig({
      defaultModel: "default-model",
      modelTiers: {
        fast: "fast-model",
        // standard and premium not defined
      },
    });

    const result = resolveModel(agent, config, "standard");

    expect(result).toBe("default-model");
  });
});
