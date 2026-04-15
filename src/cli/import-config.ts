// orcastrator import — import configuration and state from a portable JSON snapshot

import chalk from "chalk";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { getConfigPath, getOrcastratorDir } from "../config/loader.js";

interface ExportSnapshot {
  version: number;
  exportedAt: string;
  config: string | null;
  state: Record<string, string>;
}

export async function importCommand(
  inputPath: string,
  options: { merge?: boolean },
): Promise<void> {
  const cwd = process.cwd();
  const merge = options.merge ?? true;

  // Read and parse snapshot
  if (!existsSync(inputPath)) {
    console.error(chalk.red("✗"), `File not found: ${inputPath}`);
    process.exitCode = 1;
    return;
  }

  let snapshot: ExportSnapshot;
  try {
    const raw = readFileSync(inputPath, "utf-8");
    snapshot = JSON.parse(raw) as ExportSnapshot;
  } catch {
    console.error(chalk.red("✗"), "Failed to parse snapshot file.");
    process.exitCode = 1;
    return;
  }

  // Validate version
  if (snapshot.version !== 1) {
    console.error(
      chalk.red("✗"),
      `Unsupported snapshot version: ${snapshot.version}`,
    );
    process.exitCode = 1;
    return;
  }

  const orcastratorDir = getOrcastratorDir(cwd);

  // Restore state files
  let imported = 0;
  let skipped = 0;
  for (const [relPath, content] of Object.entries(snapshot.state)) {
    const dest = join(orcastratorDir, relPath);

    if (merge && existsSync(dest)) {
      skipped++;
      continue;
    }

    const parentDir = dirname(dest);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    writeFileSync(dest, content, "utf-8");
    imported++;
  }

  console.log(chalk.green("✓"), `Imported ${imported} state files`);
  if (skipped > 0) {
    console.log(
      chalk.dim(`  ${skipped} existing files skipped (merge mode)`),
    );
  }

  // Restore config if no existing config
  if (snapshot.config) {
    const existingConfig = getConfigPath(cwd);
    if (existingConfig) {
      console.log(
        chalk.yellow("⚠"),
        "Config file already exists, skipped (use --force to overwrite)",
      );
    } else {
      const configDest = join(cwd, "orcastrator.config.ts");
      writeFileSync(configDest, snapshot.config, "utf-8");
      console.log(chalk.green("✓"), "Restored orcastrator.config.ts");
    }
  }
}
