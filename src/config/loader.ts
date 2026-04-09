// Config loader — dynamically imports orcastrator.config.ts from the project

import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { OrcastratorConfigSchema } from "./builder.js";
import type { OrcastratorConfig } from "../core/types.js";

const CONFIG_FILENAMES = [
  "orcastrator.config.ts",
  "orcastrator.config.js",
  "orcastrator.config.mjs",
];

export async function loadConfig(
  cwd?: string,
): Promise<OrcastratorConfig> {
  const dir = cwd ?? process.cwd();

  let configPath: string | null = null;
  for (const name of CONFIG_FILENAMES) {
    const candidate = resolve(dir, name);
    if (existsSync(candidate)) {
      configPath = candidate;
      break;
    }
  }

  if (!configPath) {
    throw new Error(
      `No orcastrator config found in ${dir}. Run \`orcastrator init\` to create one.`,
    );
  }

  const configUrl = pathToFileURL(configPath).href;

  // For TypeScript configs, use Node's built-in --experimental-strip-types
  // or assume tsx/ts-node is registered in the loader chain
  const mod = await import(configUrl);
  const rawConfig = mod.default ?? mod;

  return OrcastratorConfigSchema.parse(rawConfig);
}

export function getConfigPath(cwd?: string): string | null {
  const dir = cwd ?? process.cwd();
  for (const name of CONFIG_FILENAMES) {
    const candidate = resolve(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function getOrcastratorDir(cwd?: string): string {
  return join(cwd ?? process.cwd(), ".orcastrator");
}
