// json-extractor.ts — Robust JSON extraction from LLM responses

/**
 * Attempts to extract a JSON object from an LLM response using multiple
 * strategies, in order of reliability:
 *
 * 1. Fenced code block (```json ... ``` or ``` ... ```)
 * 2. First top-level `{ ... }` substring (greedy brace matching)
 * 3. Raw string as-is
 */
export function extractJSON(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();

  // Strategy 1: fenced code block
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as Record<string, unknown>;
    } catch {
      // Code block content wasn't valid JSON — fall through
    }
  }

  // Strategy 2: find the outermost { ... } in the string
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      // Not valid JSON — fall through
    }
  }

  // Strategy 3: try the raw string directly
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error(
      "Failed to parse Copilot response as JSON. The model did not return valid JSON.",
    );
  }
}
