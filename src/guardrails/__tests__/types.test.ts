import { describe, it, expect } from "vitest";
import { normalizeGuardrails } from "../types.js";
import {
  DEFAULT_BLOCKED_COMMANDS,
  DEFAULT_ALLOWED_WRITE_PATHS,
} from "../defaults.js";

describe("normalizeGuardrails", () => {
  it("should return undefined when input is undefined", () => {
    const result = normalizeGuardrails(undefined);
    expect(result).toBeUndefined();
  });

  it("should return full GuardrailConfig with defaults when input is true", () => {
    const result = normalizeGuardrails(true);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("blockedCommands");
    expect(result).toHaveProperty("allowedWritePaths");
    expect(result).toHaveProperty("preToolUse");
    expect(result).toHaveProperty("postToolUse");
  });

  it("should apply default blocked commands when input is true", () => {
    const result = normalizeGuardrails(true);
    expect(result?.blockedCommands).toEqual(DEFAULT_BLOCKED_COMMANDS);
  });

  it("should apply default allowed write paths when input is true", () => {
    const result = normalizeGuardrails(true);
    expect(result?.allowedWritePaths).toEqual(DEFAULT_ALLOWED_WRITE_PATHS);
  });

  it("should have empty arrays for preToolUse and postToolUse when input is true", () => {
    const result = normalizeGuardrails(true);
    expect(result?.preToolUse).toEqual([]);
    expect(result?.postToolUse).toEqual([]);
  });

  it("should use provided values and apply defaults for missing properties", () => {
    const result = normalizeGuardrails({ blockedCommands: ["custom"] });
    expect(result?.blockedCommands).toEqual(["custom"]);
    expect(result?.allowedWritePaths).toEqual(DEFAULT_ALLOWED_WRITE_PATHS);
    expect(result?.preToolUse).toEqual([]);
    expect(result?.postToolUse).toEqual([]);
  });

  it("should apply all defaults for empty object", () => {
    const result = normalizeGuardrails({});
    expect(result?.blockedCommands).toEqual(DEFAULT_BLOCKED_COMMANDS);
    expect(result?.allowedWritePaths).toEqual(DEFAULT_ALLOWED_WRITE_PATHS);
    expect(result?.preToolUse).toEqual([]);
    expect(result?.postToolUse).toEqual([]);
  });
});
