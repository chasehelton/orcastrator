// Pre/Post tool-use hook factories — defense-in-depth guardrails via SDK SessionHooks

import type { ToolResultObject } from "@github/copilot-sdk";
import type { GuardrailConfig } from "./types.js";

// ---------------------------------------------------------------------------
// SDK-compatible hook types (not publicly exported by @github/copilot-sdk)
// ---------------------------------------------------------------------------

interface BaseHookInput {
  timestamp: number;
  cwd: string;
}

interface PreToolUseHookInput extends BaseHookInput {
  toolName: string;
  toolArgs: unknown;
}

interface PreToolUseHookOutput {
  permissionDecision?: "allow" | "deny" | "ask";
  permissionDecisionReason?: string;
  modifiedArgs?: unknown;
  additionalContext?: string;
  suppressOutput?: boolean;
}

interface PostToolUseHookInput extends BaseHookInput {
  toolName: string;
  toolArgs: unknown;
  toolResult: ToolResultObject;
}

interface PostToolUseHookOutput {
  modifiedResult?: ToolResultObject;
  additionalContext?: string;
  suppressOutput?: boolean;
}

type PreToolUseHandler = (
  input: PreToolUseHookInput,
  invocation: { sessionId: string },
) => Promise<PreToolUseHookOutput | void> | PreToolUseHookOutput | void;

type PostToolUseHandler = (
  input: PostToolUseHookInput,
  invocation: { sessionId: string },
) => Promise<PostToolUseHookOutput | void> | PostToolUseHookOutput | void;

export interface SessionHooks {
  onPreToolUse?: PreToolUseHandler;
  onPostToolUse?: PostToolUseHandler;
}

/**
 * Creates a PreToolUseHandler that:
 * 1. Checks shell commands against the blocklist (defense-in-depth with permission handler)
 * 2. Runs any user-provided custom pre-tool hooks
 */
export function createPreToolUseHook(
  config: GuardrailConfig,
): PreToolUseHandler {
  return async (
    input: PreToolUseHookInput,
  ): Promise<PreToolUseHookOutput | void> => {
    // Defense-in-depth: check shell-like tools at the hook level too
    if (input.toolName === "bash" || input.toolName === "shell") {
      const args = input.toolArgs as Record<string, unknown> | undefined;
      const command = String(args?.command ?? args?.cmd ?? "");
      if (command) {
        const lower = command.toLowerCase();
        for (const blocked of config.blockedCommands) {
          if (lower.includes(blocked.toLowerCase())) {
            return {
              permissionDecision: "deny",
              permissionDecisionReason: `Blocked command pattern: "${blocked}"`,
            };
          }
        }
      }
    }

    // Run custom user-provided pre hooks
    for (const hook of config.preToolUse) {
      const result = await hook({
        toolName: input.toolName,
        toolArgs: input.toolArgs,
        cwd: input.cwd,
      });

      if (result.decision === "deny") {
        return {
          permissionDecision: "deny",
          permissionDecisionReason: result.reason ?? "Denied by custom pre-tool hook",
        };
      }

      if (result.modifiedArgs !== undefined) {
        return {
          permissionDecision: "allow",
          modifiedArgs: result.modifiedArgs,
        };
      }
    }

    // No objection — let it through
    return undefined;
  };
}

/**
 * Creates a PostToolUseHandler that runs user-provided custom post-tool hooks.
 */
export function createPostToolUseHook(
  config: GuardrailConfig,
): PostToolUseHandler {
  return async (
    input: PostToolUseHookInput,
  ): Promise<PostToolUseHookOutput | void> => {
    let currentResult = input.toolResult;

    for (const hook of config.postToolUse) {
      const hookResult = await hook({
        toolName: input.toolName,
        toolArgs: input.toolArgs,
        toolResult: currentResult,
        cwd: input.cwd,
      });

      if (hookResult?.modifiedResult !== undefined) {
        currentResult = hookResult.modifiedResult as typeof currentResult;
      }
    }

    if (currentResult !== input.toolResult) {
      return { modifiedResult: currentResult };
    }

    return undefined;
  };
}

/**
 * Build the SessionHooks object from guardrail config.
 */
export function buildSessionHooks(config: GuardrailConfig): SessionHooks {
  return {
    onPreToolUse: createPreToolUseHook(config),
    onPostToolUse: createPostToolUseHook(config),
  };
}
