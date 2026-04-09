// Permission handler — replaces `approveAll` when guardrails are enabled

import { matchesGlob } from "node:path";
import type { PermissionHandler, PermissionRequest, PermissionRequestResult } from "@github/copilot-sdk";
import type { GuardrailConfig } from "./types.js";

type DeniedResult = Extract<PermissionRequestResult, { kind: "denied-by-permission-request-hook" }>;

function denied(message: string): DeniedResult {
  return { kind: "denied-by-permission-request-hook", message };
}

function isBlockedCommand(command: string, blocklist: string[]): string | undefined {
  const lower = command.toLowerCase();
  return blocklist.find((pattern) => lower.includes(pattern.toLowerCase()));
}

function isAllowedWritePath(filePath: string, allowedPaths: string[]): boolean {
  if (allowedPaths.length === 0) return false;
  return allowedPaths.some((pattern) => matchesGlob(filePath, pattern));
}

export function createPermissionHandler(
  config: GuardrailConfig,
): PermissionHandler {
  return (request: PermissionRequest): PermissionRequestResult => {
    // Check shell commands against blocklist
    if (request.kind === "shell") {
      const command = String(request.command ?? "");
      if (command) {
        const match = isBlockedCommand(command, config.blockedCommands);
        if (match) {
          return denied(`Blocked command pattern: "${match}"`);
        }
      }
    }

    // Check file writes against allowed paths
    if (request.kind === "write") {
      const filePath = String(request.path ?? request.filePath ?? "");
      if (filePath && config.allowedWritePaths.length > 0) {
        if (!config.allowedWritePaths.includes("**") && !isAllowedWritePath(filePath, config.allowedWritePaths)) {
          return denied(`Write to "${filePath}" is outside allowed paths: [${config.allowedWritePaths.join(", ")}]`);
        }
      }
    }

    return { kind: "approved" };
  };
}
