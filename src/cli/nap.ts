// orcastrator nap — compress history and prune old logs

import chalk from "chalk";
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { getOrcastratorDir } from "../config/loader.js";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncateHistory(
  filePath: string,
  keep: number,
  dryRun: boolean,
): number {
  const content = readFileSync(filePath, "utf-8");
  const originalSize = Buffer.byteLength(content, "utf-8");

  // Split into entries: lines starting with `## ` or `- ` at root level
  const lines = content.split("\n");
  const entryStarts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (/^## /.test(lines[i]) || /^- /.test(lines[i])) {
      entryStarts.push(i);
    }
  }

  if (entryStarts.length <= keep) return 0;

  // Keep only the last `keep` entries
  const cutLine = entryStarts[entryStarts.length - keep];
  const truncated = lines.slice(cutLine).join("\n");
  const newSize = Buffer.byteLength(truncated, "utf-8");
  const saved = originalSize - newSize;

  if (!dryRun) {
    writeFileSync(filePath, truncated, "utf-8");
  }

  return saved;
}

export function pruneOldLogs(
  logDir: string,
  maxAgeDays: number,
  dryRun: boolean,
): number {
  if (!existsSync(logDir)) return 0;

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let totalSaved = 0;
  let pruned = 0;

  const files = readdirSync(logDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const fullPath = join(logDir, file);
    const stat = statSync(fullPath);

    if (stat.mtimeMs < cutoff) {
      totalSaved += stat.size;
      pruned++;
      if (!dryRun) {
        unlinkSync(fullPath);
      }
    }
  }

  return totalSaved;
}

export async function napCommand(options: {
  dryRun?: boolean;
  keep?: string;
}): Promise<void> {
  const cwd = process.cwd();
  const orcastratorDir = getOrcastratorDir(cwd);

  if (!existsSync(orcastratorDir)) {
    console.log(chalk.yellow("No .orcastrator/ directory found — nothing to do."));
    return;
  }

  const keep = parseInt(options.keep ?? "20", 10);
  const dryRun = options.dryRun ?? false;

  console.log(chalk.bold(`orcastrator nap${dryRun ? " --dry-run" : ""}`));

  // 1. Truncate history files
  const agentsDir = join(orcastratorDir, "agents");
  let historyBytesSaved = 0;
  let historyFileCount = 0;

  if (existsSync(agentsDir)) {
    const agentDirs = readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const agent of agentDirs) {
      const historyPath = join(agentsDir, agent, "history.md");
      if (!existsSync(historyPath)) continue;

      const saved = truncateHistory(historyPath, keep, dryRun);
      if (saved > 0) {
        historyBytesSaved += saved;
        historyFileCount++;
      }
    }
  }

  // 2. Prune old logs
  const logDir = join(orcastratorDir, "log");
  let logFileCount = 0;

  // Count files that would be pruned for reporting
  if (existsSync(logDir)) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const files = readdirSync(logDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const stat = statSync(join(logDir, file));
      if (stat.mtimeMs < cutoff) logFileCount++;
    }
  }

  const logBytesSaved = pruneOldLogs(logDir, 30, dryRun);

  // 3. Report results
  if (dryRun) {
    if (historyFileCount > 0) {
      console.log(
        `  Would truncate ${historyFileCount} history file${historyFileCount === 1 ? "" : "s"} (${formatBytes(historyBytesSaved)})`,
      );
    }
    if (logFileCount > 0) {
      console.log(
        `  Would prune ${logFileCount} log file${logFileCount === 1 ? "" : "s"} (${formatBytes(logBytesSaved)})`,
      );
    }
  } else {
    if (historyFileCount > 0) {
      console.log(
        `  ${chalk.green("✓")} Truncated ${historyFileCount} history file${historyFileCount === 1 ? "" : "s"} (saved ${formatBytes(historyBytesSaved)})`,
      );
    }
    if (logFileCount > 0) {
      console.log(
        `  ${chalk.green("✓")} Pruned ${logFileCount} old log file${logFileCount === 1 ? "" : "s"} (saved ${formatBytes(logBytesSaved)})`,
      );
    }
  }

  const total = historyBytesSaved + logBytesSaved;

  if (total === 0) {
    console.log(chalk.dim("  Nothing to clean up."));
  } else if (dryRun) {
    console.log(`  Total: ${formatBytes(total)} would be reclaimed`);
  } else {
    console.log(`  Total: ${formatBytes(total)} reclaimed`);
  }
}
