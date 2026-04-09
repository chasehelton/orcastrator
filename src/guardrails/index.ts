// Guardrails public API — build guardrails from config

import type { PermissionHandler } from "@github/copilot-sdk";
import type { GuardrailConfig } from "./types.js";
import type { SessionHooks } from "./hooks.js";
import { createPermissionHandler } from "./permission-handler.js";
import { buildSessionHooks } from "./hooks.js";

export { normalizeGuardrails } from "./types.js";
export type { GuardrailConfig, GuardrailInput } from "./types.js";
export { GuardrailConfigSchema, GuardrailInputSchema } from "./types.js";
export type { SessionHooks } from "./hooks.js";

export interface BuiltGuardrails {
  permissionHandler: PermissionHandler;
  hooks: SessionHooks;
}

/**
 * Build the permission handler and session hooks from a GuardrailConfig.
 * Pass the result into `createSession` to enforce guardrails at runtime.
 */
export function buildGuardrails(config: GuardrailConfig): BuiltGuardrails {
  return {
    permissionHandler: createPermissionHandler(config),
    hooks: buildSessionHooks(config),
  };
}
