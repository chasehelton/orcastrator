import { describe, it, expect } from "vitest";
import {
  getTier,
  selectResponseTier,
  type TierName,
  type ResponseTier,
} from "../response-tiers.js";
import type { OrcastratorConfig } from "../../core/types.js";

// Minimal config object for testing
const minimalConfig = {} as any;

describe("response-tiers", () => {
  describe("getTier", () => {
    it("returns correct tier definition for 'direct'", () => {
      const tier = getTier("direct");
      expect(tier).toBeDefined();
      expect(tier.tier).toBe("direct");
      expect(typeof tier.maxAgents).toBe("number");
      expect(typeof tier.timeout).toBe("number");
      expect(["none", "fast", "standard", "premium"]).toContain(
        tier.modelTier
      );
    });

    it("returns correct tier definition for 'lightweight'", () => {
      const tier = getTier("lightweight");
      expect(tier).toBeDefined();
      expect(tier.tier).toBe("lightweight");
      expect(typeof tier.maxAgents).toBe("number");
      expect(typeof tier.timeout).toBe("number");
    });

    it("returns correct tier definition for 'standard'", () => {
      const tier = getTier("standard");
      expect(tier).toBeDefined();
      expect(tier.tier).toBe("standard");
      expect(typeof tier.maxAgents).toBe("number");
      expect(typeof tier.timeout).toBe("number");
    });

    it("returns correct tier definition for 'full'", () => {
      const tier = getTier("full");
      expect(tier).toBeDefined();
      expect(tier.tier).toBe("full");
      expect(typeof tier.maxAgents).toBe("number");
      expect(typeof tier.timeout).toBe("number");
    });

    it("returns a copy, not the same reference", () => {
      const tier1 = getTier("standard");
      const tier2 = getTier("standard");
      expect(tier1).toEqual(tier2);
      expect(tier1).not.toBe(tier2);
    });
  });

  describe("selectResponseTier - direct tier", () => {
    it("selects direct tier for 'hello'", () => {
      const tier = selectResponseTier("hello", minimalConfig);
      expect(tier.tier).toBe("direct");
    });

    it("selects direct tier for 'hi there'", () => {
      const tier = selectResponseTier("hi there", minimalConfig);
      expect(tier.tier).toBe("direct");
    });

    it("selects direct tier for 'thanks'", () => {
      const tier = selectResponseTier("thanks", minimalConfig);
      expect(tier.tier).toBe("direct");
    });

    it("selects direct tier for 'hey'", () => {
      const tier = selectResponseTier("hey", minimalConfig);
      expect(tier.tier).toBe("direct");
    });

    it("selects direct tier for 'ok'", () => {
      const tier = selectResponseTier("ok", minimalConfig);
      expect(tier.tier).toBe("direct");
    });

    it("does NOT select direct tier for long greeting (>30 chars)", () => {
      const longGreeting =
        "hello there, how are you today friend?"; // > 30 chars
      const tier = selectResponseTier(longGreeting, minimalConfig);
      expect(tier.tier).not.toBe("direct");
    });
  });

  describe("selectResponseTier - full tier", () => {
    it("selects full tier for 'Refactor the entire codebase'", () => {
      const tier = selectResponseTier(
        "Refactor the entire codebase",
        minimalConfig
      );
      expect(tier.tier).toBe("full");
    });

    it("selects full tier for 'Implement a new feature module'", () => {
      const tier = selectResponseTier(
        "Implement a new feature module",
        minimalConfig
      );
      expect(tier.tier).toBe("full");
    });

    it("selects full tier for 'Build a new authentication service'", () => {
      const tier = selectResponseTier(
        "Build a new authentication service",
        minimalConfig
      );
      expect(tier.tier).toBe("full");
    });

    it("selects full tier for 'multi-agent coordination'", () => {
      const tier = selectResponseTier(
        "multi-agent coordination",
        minimalConfig
      );
      expect(tier.tier).toBe("full");
    });

    it("selects full tier for 'full security audit'", () => {
      const tier = selectResponseTier("full security audit", minimalConfig);
      expect(tier.tier).toBe("full");
    });

    it("selects full tier for 'Redesign the entire system'", () => {
      const tier = selectResponseTier(
        "Redesign the entire system",
        minimalConfig
      );
      expect(tier.tier).toBe("full");
    });

    it("selects full tier for 'Migrate the whole codebase'", () => {
      const tier = selectResponseTier(
        "Migrate the whole codebase",
        minimalConfig
      );
      expect(tier.tier).toBe("full");
    });

    it("selects full tier for 'Rewrite all services'", () => {
      const tier = selectResponseTier("Rewrite all services", minimalConfig);
      expect(tier.tier).toBe("full");
    });

    it("selects full tier for 'full review'", () => {
      const tier = selectResponseTier("full review", minimalConfig);
      expect(tier.tier).toBe("full");
    });

    it("selects full tier for 'full analysis'", () => {
      const tier = selectResponseTier("full analysis", minimalConfig);
      expect(tier.tier).toBe("full");
    });
  });

  describe("selectResponseTier - lightweight tier", () => {
    it("selects lightweight tier for 'list all files'", () => {
      const tier = selectResponseTier("list all files", minimalConfig);
      expect(tier.tier).toBe("lightweight");
    });

    it("selects lightweight tier for 'show status'", () => {
      const tier = selectResponseTier("show status", minimalConfig);
      expect(tier.tier).toBe("lightweight");
    });

    it("selects lightweight tier for 'rename the config file'", () => {
      const tier = selectResponseTier(
        "rename the config file",
        minimalConfig
      );
      expect(tier.tier).toBe("lightweight");
    });

    it("selects lightweight tier for 'display current info'", () => {
      const tier = selectResponseTier("display current info", minimalConfig);
      expect(tier.tier).toBe("lightweight");
    });

    it("selects lightweight tier for 'get the status'", () => {
      const tier = selectResponseTier("get the status", minimalConfig);
      expect(tier.tier).toBe("lightweight");
    });

    it("selects lightweight tier for 'find that file'", () => {
      const tier = selectResponseTier("find that file", minimalConfig);
      expect(tier.tier).toBe("lightweight");
    });

    it("selects lightweight tier for 'search the logs'", () => {
      const tier = selectResponseTier("search the logs", minimalConfig);
      expect(tier.tier).toBe("lightweight");
    });

    it("selects lightweight tier for 'delete this item'", () => {
      const tier = selectResponseTier("delete this item", minimalConfig);
      expect(tier.tier).toBe("lightweight");
    });

    it("selects lightweight tier for 'check the config'", () => {
      const tier = selectResponseTier("check the config", minimalConfig);
      expect(tier.tier).toBe("lightweight");
    });

    it("selects lightweight tier for 'move the file'", () => {
      const tier = selectResponseTier("move the file", minimalConfig);
      expect(tier.tier).toBe("lightweight");
    });
  });

  describe("selectResponseTier - standard tier (default)", () => {
    it("selects standard tier for 'Write unit tests for the router module'", () => {
      const tier = selectResponseTier(
        "Write unit tests for the router module",
        minimalConfig
      );
      expect(tier.tier).toBe("standard");
    });

    it("selects standard tier for 'Fix the bug in coordinator'", () => {
      const tier = selectResponseTier(
        "Fix the bug in coordinator",
        minimalConfig
      );
      expect(tier.tier).toBe("standard");
    });

    it("selects standard tier for generic text", () => {
      const tier = selectResponseTier(
        "Please help me with something",
        minimalConfig
      );
      expect(tier.tier).toBe("standard");
    });

    it("selects standard tier for empty string", () => {
      const tier = selectResponseTier("", minimalConfig);
      expect(tier.tier).toBe("standard");
    });
  });

  describe("selectResponseTier - return values", () => {
    it("returns valid ResponseTier objects", () => {
      const tier = selectResponseTier("hello", minimalConfig);
      expect(tier).toHaveProperty("tier");
      expect(tier).toHaveProperty("modelTier");
      expect(tier).toHaveProperty("maxAgents");
      expect(tier).toHaveProperty("timeout");
    });

    it("returns tier with valid tier name", () => {
      const validTierNames: TierName[] = [
        "direct",
        "lightweight",
        "standard",
        "full",
      ];
      const tier = selectResponseTier("random task", minimalConfig);
      expect(validTierNames).toContain(tier.tier);
    });

    it("returns tier with valid modelTier suggestion", () => {
      const validModelTiers = ["none", "fast", "standard", "premium"];
      const tier = selectResponseTier("random task", minimalConfig);
      expect(validModelTiers).toContain(tier.modelTier);
    });
  });
});
