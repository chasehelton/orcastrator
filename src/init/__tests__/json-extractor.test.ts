import { describe, it, expect } from "vitest";
import { extractJSON } from "../json-extractor.js";

describe("extractJSON", () => {
  it("extracts from a fenced json code block", () => {
    const raw = '```json\n{"name": "test"}\n```';
    expect(extractJSON(raw)).toEqual({ name: "test" });
  });

  it("extracts from a fenced code block without language tag", () => {
    const raw = '```\n{"name": "test"}\n```';
    expect(extractJSON(raw)).toEqual({ name: "test" });
  });

  it("extracts JSON when surrounded by conversational text", () => {
    const raw =
      'Here is the config:\n{"name": "docs-agent", "role": "Documentation Engineer"}\nLet me know if you need changes.';
    expect(extractJSON(raw)).toEqual({
      name: "docs-agent",
      role: "Documentation Engineer",
    });
  });

  it("parses raw JSON string directly", () => {
    const raw = '{"name": "plain"}';
    expect(extractJSON(raw)).toEqual({ name: "plain" });
  });

  it("handles code block with extra whitespace", () => {
    const raw = '```json\n  \n  {"name": "spaced"}  \n  \n```';
    expect(extractJSON(raw)).toEqual({ name: "spaced" });
  });

  it("falls back to brace matching when code block has invalid JSON", () => {
    const raw = '```json\nnot json\n```\nBut here: {"name": "fallback"}';
    expect(extractJSON(raw)).toEqual({ name: "fallback" });
  });

  it("throws on completely non-JSON input", () => {
    expect(() => extractJSON("This is just plain text")).toThrow(
      "Failed to parse Copilot response as JSON",
    );
  });
});
