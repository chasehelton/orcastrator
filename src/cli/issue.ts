// orcastrator issue <ref> — work on a GitHub or Linear issue

import chalk from "chalk";
import ora from "ora";
import { loadConfig, getOrcastratorDir } from "../config/loader.js";
import { Coordinator } from "../core/coordinator.js";
import { fetchIssue, issueToTask } from "../github/issues.js";
import { fetchLinearIssue, linearIssueToTask, isLinearIdentifier, updateLinearIssueState, commentOnLinearIssue } from "../linear/issues.js";
import { matchRoute, determineStrategy } from "../core/router.js";
import {
  createWorktree,
  pruneWorktree,
  getDefaultBranch,
} from "../git/worktree.js";
import { commitAndPush, createPr } from "../github/pr.js";

export interface IssueOptions {
  repo?: string;
  agent?: string;
  pr?: boolean;
  provider?: "github" | "linear";
}

type ResolvedProvider = "github" | "linear";

function resolveProvider(ref: string, explicit?: string): ResolvedProvider {
  if (explicit === "github") return "github";
  if (explicit === "linear") return "linear";
  // Auto-detect: "ENG-123" → linear, "42" → github
  return isLinearIdentifier(ref) ? "linear" : "github";
}

export async function issueCommand(
  ref: string,
  options: IssueOptions,
): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);
  const provider = resolveProvider(ref, options.provider);

  // ── Fetch issue ────────────────────────────────────────────────────────────
  const fetchSpinner = ora("Fetching issue...").start();
  let task;

  // Track Linear issue UUID for state transitions (populated only for Linear issues)
  let linearIssueUuid: string | undefined;

  try {
    if (provider === "linear") {
      const issue = await fetchLinearIssue(
        ref,
        config.linear?.apiKey,
      );
      linearIssueUuid = issue.id;
      task = linearIssueToTask(issue);
      fetchSpinner.succeed(
        `${chalk.magenta("Linear")} ${chalk.bold(issue.identifier)}: ${chalk.bold(issue.title)}` +
        chalk.dim(` [${issue.state}]`),
      );
    } else {
      const issueNumber = parseInt(ref, 10);
      if (isNaN(issueNumber)) {
        throw new Error(
          `"${ref}" is not a valid GitHub issue number. For Linear issues use identifiers like ENG-123.`,
        );
      }
      const issue = fetchIssue(issueNumber, options.repo);
      task = issueToTask(issue);
      fetchSpinner.succeed(
        `${chalk.blue("GitHub")} issue ${chalk.bold(`#${issueNumber}`)}: ${chalk.bold(issue.title)}`,
      );
    }
  } catch (err) {
    fetchSpinner.fail("Failed to fetch issue");
    console.error(
      chalk.red(err instanceof Error ? err.message : String(err)),
    );
    process.exitCode = 1;
    return;
  }

  // ── Route ──────────────────────────────────────────────────────────────────
  const match = options.agent
    ? { agents: [options.agent], confidence: "exact" as const }
    : matchRoute(task.text, config);
  const strategy = determineStrategy(match);

  console.log(
    chalk.dim(`Routing → ${match.agents.join(", ")} (${strategy})`),
  );

  // ── Worktree ───────────────────────────────────────────────────────────────
  let worktreePath: string | undefined;
  let worktreeBranch: string | undefined;

  if (options.pr) {
    const branchSlug = provider === "linear"
      ? `linear-${ref.toLowerCase()}`
      : `issue-${ref}`;
    const baseBranch = getDefaultBranch(cwd);
    const worktree = createWorktree(cwd, branchSlug, baseBranch);
    worktreePath = worktree.path;
    worktreeBranch = worktree.branch;
    console.log(chalk.dim(`Worktree → ${worktree.branch}`));
  }

  // ── Execute ────────────────────────────────────────────────────────────────
  // Mark Linear issue as In Progress before starting work
  if (linearIssueUuid) {
    updateLinearIssueState(linearIssueUuid, "In Progress", config.linear?.apiKey).catch(() => {
      // Non-critical — warn silently
    });
  }

  const spinner = ora({
    text: `Working on ${provider === "linear" ? ref : `#${ref}`}...`,
    color: "cyan",
  }).start();

  const coordinator = new Coordinator(config, cwd);

  try {
    const result = await coordinator.handleTask(task, {
      forceAgent: options.agent,
      workingDirectory: worktreePath,
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

    // ── PR creation ────────────────────────────────────────────────────────
    if (options.pr && worktreePath && worktreeBranch) {
      const prSpinner = ora("Creating PR...").start();
      try {
        const body = result.results
          .filter((r) => r.success && r.response)
          .map((r) => `### ${r.agentName}\n\n${r.response}`)
          .join("\n\n");

        let title: string;
        let prBody: string;
        let issueNumber: number | undefined;

        if (provider === "linear") {
          title = `${ref}: ${task.text.split("\n")[0].replace(/^##\s*/, "")}`;
          prBody = [
            body || "Changes made by orcastrator agents.",
            "",
            task.issueUrl ? `Linear: ${task.issueUrl}` : "",
          ].filter(Boolean).join("\n");
        } else {
          issueNumber = parseInt(ref, 10);
          const ghIssue = fetchIssue(issueNumber, options.repo);
          title = `Fix #${issueNumber}: ${ghIssue.title}`;
          prBody = body || "Changes made by orcastrator agents.";
        }

        commitAndPush(worktreePath, `orcastrator: ${title}`);
        const prUrl = createPr({
          worktreePath,
          branch: worktreeBranch,
          title,
          body: prBody,
          issueNumber,
          repo: options.repo,
        });
        prSpinner.succeed(`PR created: ${chalk.cyan(prUrl)}`);

        // Post PR link back to Linear issue and transition to In Review
        if (linearIssueUuid) {
          const apiKey = config.linear?.apiKey;
          await Promise.allSettled([
            commentOnLinearIssue(
              linearIssueUuid,
              `PR created by orcastrator: ${prUrl}`,
              apiKey,
            ),
            updateLinearIssueState(linearIssueUuid, "In Review", apiKey),
          ]);
        }
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

