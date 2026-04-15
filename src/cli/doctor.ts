// orcastrator doctor — check environment and configuration health

import chalk from "chalk";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getConfigPath, getOrcastratorDir, loadConfig } from "../config/loader.js";

interface CheckResult {
  label: string;
  status: "pass" | "fail" | "warn";
}

export async function doctorCommand(): Promise<void> {
  const cwd = process.cwd();
  const results: CheckResult[] = [];

  console.log(chalk.bold("orcastrator doctor"));

  // 1. Node version
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split(".")[0], 10);
  if (major >= 22) {
    results.push({ label: `Node.js v${nodeVersion} (>= 22 required)`, status: "pass" });
  } else {
    results.push({ label: `Node.js v${nodeVersion} (>= 22 required)`, status: "fail" });
  }

  // 2. GitHub token
  if (process.env.GITHUB_TOKEN) {
    results.push({ label: "GitHub token configured", status: "pass" });
  } else {
    let ghAuth = false;
    try {
      execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
      ghAuth = true;
    } catch {
      // gh not installed or not authenticated
    }
    if (ghAuth) {
      results.push({ label: "GitHub token configured (via gh CLI)", status: "pass" });
    } else {
      results.push({ label: "GitHub token not found (set GITHUB_TOKEN or run 'gh auth login')", status: "fail" });
    }
  }

  // 3. Config file
  const configPath = getConfigPath(cwd);
  if (configPath) {
    try {
      await loadConfig(cwd);
      results.push({ label: "Config file found and valid", status: "pass" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ label: `Config file found but invalid: ${msg}`, status: "fail" });
    }
  } else {
    results.push({ label: "Config file not found (expected orcastrator.config.ts)", status: "fail" });
  }

  // 4. State directory
  const orcastratorDir = getOrcastratorDir(cwd);
  if (existsSync(orcastratorDir)) {
    const missing: string[] = [];
    if (!existsSync(join(orcastratorDir, "decisions.md"))) missing.push("decisions.md");
    if (!existsSync(join(orcastratorDir, "routing.md"))) missing.push("routing.md");
    if (!existsSync(join(orcastratorDir, "agents"))) missing.push("agents/");

    if (missing.length === 0) {
      results.push({ label: "State directory structure valid", status: "pass" });
    } else {
      results.push({ label: `State directory incomplete: missing ${missing.join(", ")} (run 'orcastrator build')`, status: "fail" });
    }
  } else {
    results.push({ label: "State directory missing (run 'orcastrator init')", status: "fail" });
  }

  // 5. Linear API key (optional)
  if (process.env.LINEAR_API_KEY) {
    results.push({ label: "Linear API key configured", status: "pass" });
  } else {
    results.push({ label: "Linear API key not set (optional)", status: "warn" });
  }

  // Print results
  let hasFailure = false;
  for (const r of results) {
    const icon =
      r.status === "pass" ? chalk.green("✓") :
      r.status === "fail" ? chalk.red("✗") :
      chalk.yellow("⚠");
    if (r.status === "fail") hasFailure = true;
    console.log(`  ${icon} ${r.label}`);
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}
