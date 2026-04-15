// orcastrator export — export configuration and state to a portable JSON snapshot

import chalk from "chalk";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { getConfigPath, getOrcastratorDir } from "../config/loader.js";

/** Recursively read all text files under `dir`, skipping `log/`. */
function readDirRecursive(
  dir: string,
  base: string = "",
): Map<string, string> {
  const result = new Map<string, string>();
  if (!existsSync(dir)) return result;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip log directory — logs are ephemeral
      if (entry.name === "log") continue;
      for (const [k, v] of readDirRecursive(full, rel)) {
        result.set(k, v);
      }
    } else if (entry.isFile()) {
      // Skip binary files by attempting a text read
      try {
        const content = readFileSync(full, "utf-8");
        // Simple binary check: look for null bytes
        if (!content.includes("\0")) {
          result.set(rel, content);
        }
      } catch {
        // Skip unreadable files
      }
    }
  }
  return result;
}

export async function exportCommand(outputPath?: string): Promise<void> {
  const cwd = process.cwd();
  const dest = outputPath ?? "orcastrator-export.json";

  const orcastratorDir = getOrcastratorDir(cwd);
  const configPath = getConfigPath(cwd);

  // Read state files
  const stateFiles = readDirRecursive(orcastratorDir);

  // Read config
  let config: string | null = null;
  if (configPath && existsSync(configPath)) {
    config = readFileSync(configPath, "utf-8");
  }

  const snapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    config,
    state: Object.fromEntries(stateFiles),
  };

  const json = JSON.stringify(snapshot, null, 2);

  // Ensure parent directory exists
  const parentDir = dirname(dest);
  if (parentDir && parentDir !== "." && !existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  writeFileSync(dest, json, "utf-8");

  const fileCount = stateFiles.size + (config ? 1 : 0);
  const sizeKB = (Buffer.byteLength(json, "utf-8") / 1024).toFixed(1);

  console.log(
    chalk.green("✓"),
    `Exported to ${chalk.bold(dest)} (${fileCount} files, ${sizeKB} KB)`,
  );
}
