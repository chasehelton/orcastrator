// GitHub issue fetching — via gh CLI

import { execSync } from "node:child_process";
import type { TaskContext } from "../core/types.js";

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  url: string;
}

export function fetchIssue(issueNumber: number, repo?: string): GitHubIssue {
  const repoFlag = repo ? `--repo ${repo}` : "";
  const result = execSync(
    `gh issue view ${issueNumber} ${repoFlag} --json number,title,body,labels,url`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  );

  const data = JSON.parse(result);
  return {
    number: data.number,
    title: data.title,
    body: data.body ?? "",
    labels: (data.labels ?? []).map((l: { name: string }) => l.name),
    url: data.url,
  };
}

export function issueToTask(issue: GitHubIssue): TaskContext {
  const text = [
    `## Issue #${issue.number}: ${issue.title}`,
    "",
    issue.body,
    "",
    issue.labels.length > 0
      ? `Labels: ${issue.labels.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    source: "issue",
    text,
    issueNumber: issue.number,
    issueUrl: issue.url,
    labels: issue.labels,
  };
}
