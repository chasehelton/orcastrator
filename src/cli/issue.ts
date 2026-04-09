// orcastrator issue <number> — work on a GitHub issue

import chalk from "chalk";
import ora from "ora";
import { loadConfig, getOrcastratorDir } from "../config/loader.js";
import { Coordinator } from "../core/coordinator.js";
import { fetchIssue, issueToTask } from "../github/issues.js";
import { matchRoute, determineStrategy } from "../core/router.js";

export interface IssueOptions {
  repo?: string;
  agent?: string;
}

export async function issueCommand(
  issueNumber: number,
  options: IssueOptions,
): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);

  // Fetch issue
  const fetchSpinner = ora("Fetching issue...").start();
  let task;
  try {
    const issue = fetchIssue(issueNumber, options.repo);
    task = issueToTask(issue);
    fetchSpinner.succeed(
      `Issue #${issueNumber}: ${chalk.bold(issue.title)}`,
    );
  } catch (err) {
    fetchSpinner.fail("Failed to fetch issue");
    console.error(
      chalk.red(err instanceof Error ? err.message : String(err)),
    );
    process.exitCode = 1;
    return;
  }

  // Show routing
  const match = options.agent
    ? { agents: [options.agent], confidence: "exact" as const }
    : matchRoute(task.text, config);
  const strategy = determineStrategy(match);

  console.log(
    chalk.dim(`Routing → ${match.agents.join(", ")} (${strategy})`),
  );

  // Execute
  const spinner = ora({
    text: `Working on issue #${issueNumber}...`,
    color: "cyan",
  }).start();

  const coordinator = new Coordinator(config, cwd);

  try {
    const result = await coordinator.handleTask(task, {
      forceAgent: options.agent,
    });

    spinner.stop();

    for (const r of result.results) {
      if (r.success && r.response) {
        console.log();
        console.log(chalk.bold.cyan(`── ${r.agentName} ──`));
        console.log(r.response);
      } else if (!r.success) {
        console.log();
        console.log(chalk.bold.red(`── ${r.agentName} (failed) ──`));
        console.log(chalk.red(r.error ?? "Unknown error"));
      }
    }

    console.log();
    console.log(
      chalk.dim(`Done in ${(result.duration / 1000).toFixed(1)}s`),
    );
  } catch (err) {
    spinner.fail("Task failed");
    console.error(
      chalk.red(err instanceof Error ? err.message : String(err)),
    );
    process.exitCode = 1;
  } finally {
    await coordinator.shutdown();
  }
}
