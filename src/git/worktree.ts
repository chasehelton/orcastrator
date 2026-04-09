// Git worktree isolation — create/cleanup worktrees per task

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export interface Worktree {
  path: string;
  branch: string;
}

export function createWorktree(
  repoPath: string,
  slug: string,
  baseBranch = "main",
): Worktree {
  const branch = `orcastrator/${slug}`;
  const worktreePath = resolve(repoPath, "..", `.orcastrator-worktrees`, slug);

  // Create the branch from base
  try {
    execSync(`git -C "${repoPath}" branch "${branch}" "${baseBranch}"`, {
      stdio: "pipe",
    });
  } catch {
    // Branch may already exist
  }

  // Create the worktree
  execSync(
    `git -C "${repoPath}" worktree add "${worktreePath}" "${branch}"`,
    { stdio: "pipe" },
  );

  return { path: worktreePath, branch };
}

export function removeWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string,
): void {
  try {
    execSync(`git -C "${repoPath}" worktree remove "${worktreePath}" --force`, {
      stdio: "pipe",
    });
  } catch {
    // Worktree may already be removed
  }

  try {
    execSync(`git -C "${repoPath}" branch -D "${branch}"`, {
      stdio: "pipe",
    });
  } catch {
    // Branch may already be deleted or merged
  }
}

export function getDefaultBranch(repoPath: string): string {
  try {
    const result = execSync(
      `git -C "${repoPath}" symbolic-ref refs/remotes/origin/HEAD`,
      { stdio: "pipe", encoding: "utf-8" },
    );
    return result.trim().replace("refs/remotes/origin/", "");
  } catch {
    return "main";
  }
}
