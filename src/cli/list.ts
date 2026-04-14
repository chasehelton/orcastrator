// orcastrator issue list — list open issues from Linear or GitHub

import { execSync } from "node:child_process";
import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../config/loader.js";
import { listLinearIssues } from "../linear/issues.js";

export interface IssueListOptions {
  provider?: "github" | "linear";
  team?: string;
  mine?: boolean;
  repo?: string;
}

const PRIORITY_ICON: Record<number, string> = {
  0: " ",
  1: chalk.red("!"),
  2: chalk.yellow("↑"),
  3: chalk.cyan("→"),
  4: chalk.dim("↓"),
};

export async function issueListCommand(options: IssueListOptions): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);

  // Resolve provider: explicit flag > auto-detect from config (if linear key present) > github
  const provider =
    options.provider ??
    (config.linear?.apiKey || process.env["LINEAR_API_KEY"] ? "linear" : "github");

  if (provider === "linear") {
    const teamKey = options.team ?? config.linear?.defaultTeam;
    const spinner = ora("Fetching Linear issues...").start();

    try {
      const issues = await listLinearIssues({
        teamKey,
        assignedToMe: options.mine,
        apiKey: config.linear?.apiKey,
      });

      spinner.stop();

      if (issues.length === 0) {
        console.log(chalk.dim("No open issues found."));
        return;
      }

      console.log();
      for (const issue of issues) {
        const priority = PRIORITY_ICON[issue.priority] ?? " ";
        const assignee = issue.assignee ? chalk.dim(` @${issue.assignee}`) : "";
        const state = chalk.dim(`[${issue.state}]`);
        console.log(
          `${priority} ${chalk.magenta(issue.identifier.padEnd(10))} ${chalk.bold(issue.title)}${assignee} ${state}`,
        );
        console.log(`   ${chalk.dim(issue.url)}`);
      }
      console.log();
      console.log(chalk.dim(`${issues.length} issue(s) · orcastrator issue <identifier> to work on one`));
    } catch (err) {
      spinner.fail("Failed to fetch Linear issues");
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exitCode = 1;
    }
  } else {
    // GitHub — delegate to gh CLI
    const repoFlag = options.repo ? `--repo ${options.repo}` : "";
    const assigneeFlag = options.mine ? "--assignee @me" : "";
    try {
      const output = execSync(
        `gh issue list ${repoFlag} ${assigneeFlag} --json number,title,labels,url --limit 25`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      );
      const issues: Array<{ number: number; title: string; labels: Array<{ name: string }>; url: string }> =
        JSON.parse(output);

      if (issues.length === 0) {
        console.log(chalk.dim("No open issues found."));
        return;
      }

      console.log();
      for (const issue of issues) {
        const labels =
          issue.labels.length > 0
            ? chalk.dim(` [${issue.labels.map((l) => l.name).join(", ")}]`)
            : "";
        console.log(`  ${chalk.blue(`#${issue.number}`.padEnd(6))} ${chalk.bold(issue.title)}${labels}`);
        console.log(`   ${chalk.dim(issue.url)}`);
      }
      console.log();
      console.log(chalk.dim(`${issues.length} issue(s) · orcastrator issue <number> to work on one`));
    } catch (err) {
      console.error(chalk.red("Failed to list GitHub issues via gh CLI."));
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exitCode = 1;
    }
  }
}
