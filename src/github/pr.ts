// PR creation — create branches and PRs via gh CLI

import { execSync } from "node:child_process";

export interface CreatePrOptions {
  worktreePath: string;
  branch: string;
  title: string;
  body: string;
  issueNumber?: number;
  repo?: string;
}

export function commitAndPush(
  worktreePath: string,
  message: string,
): void {
  execSync(`git -C "${worktreePath}" add -A`, { stdio: "pipe" });

  // Check if there are changes to commit
  try {
    execSync(`git -C "${worktreePath}" diff --cached --quiet`, {
      stdio: "pipe",
    });
    // No changes — skip commit
    return;
  } catch {
    // There are changes — proceed with commit
  }

  execSync(
    `git -C "${worktreePath}" commit -m "${message.replace(/"/g, '\\"')}"`,
    { stdio: "pipe" },
  );
  execSync(`git -C "${worktreePath}" push -u origin HEAD`, { stdio: "pipe" });
}

export function createPr(options: CreatePrOptions): string {
  const { worktreePath, title, body, issueNumber, repo } = options;

  const repoFlag = repo ? `--repo ${repo}` : "";
  const issueFlag = issueNumber ? `--body "${body}\n\nCloses #${issueNumber}"` : `--body "${body}"`;

  const result = execSync(
    `gh pr create --title "${title.replace(/"/g, '\\"')}" ${issueFlag} ${repoFlag} --head ${options.branch}`,
    { encoding: "utf-8", cwd: worktreePath, stdio: ["pipe", "pipe", "pipe"] },
  );

  return result.trim();
}

export function commentOnIssue(
  issueNumber: number,
  comment: string,
  repo?: string,
): void {
  const repoFlag = repo ? `--repo ${repo}` : "";
  execSync(
    `gh issue comment ${issueNumber} ${repoFlag} --body "${comment.replace(/"/g, '\\"')}"`,
    { stdio: "pipe" },
  );
}
