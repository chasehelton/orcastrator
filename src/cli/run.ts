// orcastrator run "<task>" — execute an ad-hoc task

import chalk from "chalk";
import ora from "ora";
import { loadConfig, getOrcastratorDir } from "../config/loader.js";
import { Coordinator } from "../core/coordinator.js";
import { matchRoute, determineStrategy } from "../core/router.js";
import type { TaskContext } from "../core/types.js";
import {
  createWorktree,
  pruneWorktree,
  getDefaultBranch,
  taskSlug,
} from "../git/worktree.js";
import { commitAndPush, createPr } from "../github/pr.js";

export interface RunOptions {
  agent?: string;
  pr?: boolean;
  dryRun?: boolean;
}

export async function runCommand(
  taskText: string,
  options: RunOptions,
): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);

  const task: TaskContext = {
    source: "cli",
    text: taskText,
  };

  // Dry run — show routing without executing
  if (options.dryRun) {
    const match = options.agent
      ? { agents: [options.agent], confidence: "exact" as const }
      : matchRoute(taskText, config);
    const strategy = determineStrategy(match);

    console.log(chalk.bold("Dry run:"));
    console.log(`  Strategy: ${chalk.cyan(strategy)}`);
    console.log(`  Agents: ${match.agents.map((a) => chalk.green(a)).join(", ")}`);
    console.log(`  Confidence: ${chalk.dim(match.confidence)}`);
    if (match.matchedRule) {
      console.log(`  Matched rule: ${chalk.dim(match.matchedRule)}`);
    }
    return;
  }

  // Show routing decision
  const match = options.agent
    ? { agents: [options.agent], confidence: "exact" as const }
    : matchRoute(taskText, config);
  const strategy = determineStrategy(match);

  console.log(
    chalk.dim(`Routing → ${match.agents.join(", ")} (${strategy})`),
  );

  // Set up worktree when --pr is requested
  let worktreePath: string | undefined;
  let worktreeBranch: string | undefined;

  if (options.pr) {
    const slug = taskSlug(taskText);
    const baseBranch = getDefaultBranch(cwd);
    const worktree = createWorktree(cwd, slug, baseBranch);
    worktreePath = worktree.path;
    worktreeBranch = worktree.branch;
    console.log(chalk.dim(`Worktree → ${worktree.branch}`));
  }

  // Execute
  const spinner = ora({
    text: `Working with ${match.agents.join(", ")}...`,
    color: "cyan",
  }).start();

  const coordinator = new Coordinator(config, cwd);

  try {
    const result = await coordinator.handleTask(task, {
      forceAgent: options.agent,
      workingDirectory: worktreePath,
    });

    spinner.stop();

    // Display results
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

    // Create PR if requested
    if (options.pr && worktreePath && worktreeBranch) {
      const prSpinner = ora("Creating PR...").start();
      try {
        const title = taskText.length > 72 ? `${taskText.slice(0, 69)}...` : taskText;
        const body = result.results
          .filter((r) => r.success && r.response)
          .map((r) => `### ${r.agentName}\n\n${r.response}`)
          .join("\n\n");

        commitAndPush(worktreePath, `orcastrator: ${title}`);
        const prUrl = createPr({
          worktreePath,
          branch: worktreeBranch,
          title,
          body: body || "Changes made by orcastrator agents.",
        });
        prSpinner.succeed(`PR created: ${chalk.cyan(prUrl)}`);
      } catch (err) {
        prSpinner.fail("Failed to create PR");
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      } finally {
        pruneWorktree(cwd, worktreePath);
      }
    }

    console.log();
    console.log(chalk.dim(`Done in ${(result.duration / 1000).toFixed(1)}s`));
  } catch (err) {
    spinner.fail("Task failed");
    if (worktreePath) pruneWorktree(cwd, worktreePath);
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
  } finally {
    await coordinator.shutdown();
  }
}
