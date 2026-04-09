// Guardrail configuration types and Zod schema

import { z } from "zod";
import {
  DEFAULT_BLOCKED_COMMANDS,
  DEFAULT_ALLOWED_WRITE_PATHS,
} from "./defaults.js";

// ---------------------------------------------------------------------------
// Custom hook types (user-defined)
// ---------------------------------------------------------------------------

export interface PreToolUseHookContext {
  toolName: string;
  toolArgs: unknown;
  cwd: string;
}

export type PreToolUseHookResult = {
  decision: "allow" | "deny";
  reason?: string;
  modifiedArgs?: unknown;
};

export type CustomPreToolUseHook = (
  ctx: PreToolUseHookContext,
) => PreToolUseHookResult | Promise<PreToolUseHookResult>;

export interface PostToolUseHookContext {
  toolName: string;
  toolArgs: unknown;
  toolResult: unknown;
  cwd: string;
}

export type PostToolUseHookResult = {
  modifiedResult?: unknown;
};

export type CustomPostToolUseHook = (
  ctx: PostToolUseHookContext,
) => PostToolUseHookResult | void | Promise<PostToolUseHookResult | void>;

// ---------------------------------------------------------------------------
// Guardrail config
// ---------------------------------------------------------------------------

export interface GuardrailConfig {
  blockedCommands: string[];
  allowedWritePaths: string[];
  preToolUse: CustomPreToolUseHook[];
  postToolUse: CustomPostToolUseHook[];
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const GuardrailConfigSchema = z.object({
  blockedCommands: z.array(z.string()).default(DEFAULT_BLOCKED_COMMANDS),
  allowedWritePaths: z.array(z.string()).default(DEFAULT_ALLOWED_WRITE_PATHS),
  // Custom hooks are runtime-only — not serializable via zod
  preToolUse: z.array(z.any()).default([]),
  postToolUse: z.array(z.any()).default([]),
});

/**
 * Accepts `true` (enable all defaults) or an object to customize.
 * When absent from the parent config, guardrails are disabled.
 */
export const GuardrailInputSchema = z.union([
  z.literal(true),
  GuardrailConfigSchema.partial(),
]);

export type GuardrailInput = z.input<typeof GuardrailInputSchema>;

/**
 * Normalize the user-facing input into a full GuardrailConfig.
 */
export function normalizeGuardrails(
  input: GuardrailInput | undefined,
): GuardrailConfig | undefined {
  if (input === undefined) return undefined;

  if (input === true) {
    return GuardrailConfigSchema.parse({});
  }

  return GuardrailConfigSchema.parse(input);
}
