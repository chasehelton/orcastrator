// Linear issue operations — via @linear/sdk

import { LinearClient } from "@linear/sdk";
import type { TaskContext } from "../core/types.js";

interface LinearIssue {
  /** Internal UUID */
  id: string;
  /** Human-readable identifier, e.g. "ENG-123" */
  identifier: string;
  title: string;
  description: string;
  labels: string[];
  url: string;
  /** 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low */
  priority: number;
  state: string;
  teamName: string;
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

function getClient(apiKey?: string): LinearClient {
  const key = apiKey ?? process.env.LINEAR_API_KEY;
  if (!key) {
    throw new Error(
      "Linear API key not found. Set the LINEAR_API_KEY environment variable or add `linear.apiKey` to your orcastrator config.",
    );
  }
  return new LinearClient({ apiKey: key });
}

/**
 * Resolves a Linear issue by its human-readable identifier (e.g. "ENG-123").
 *
 * Requires LINEAR_API_KEY env var or an explicit apiKey argument.
 */
export async function fetchLinearIssue(
  identifier: string,
  apiKey?: string,
): Promise<LinearIssue> {
  const client = getClient(apiKey);

  // Linear SDK exposes `issue(id)` by UUID; to look up by identifier (e.g. "ENG-123")
  // we split into team key + number and filter by both.
  const upperRef = identifier.toUpperCase();
  const dashIndex = upperRef.lastIndexOf("-");
  if (dashIndex === -1) {
    throw new Error(`"${identifier}" is not a valid Linear issue identifier (expected format: TEAM-123).`);
  }
  const teamKey = upperRef.slice(0, dashIndex);
  const issueNumber = parseInt(upperRef.slice(dashIndex + 1), 10);

  const result = await client.issues({
    filter: {
      number: { eq: issueNumber },
      team: { key: { eq: teamKey } },
    },
  });

  const node = result.nodes[0];
  if (!node) {
    throw new Error(
      `Linear issue "${identifier}" not found. Check the identifier and that your API key has access to the workspace.`,
    );
  }

  const [stateResult, labelsResult, teamResult] = await Promise.all([
    node.state,
    node.labels(),
    node.team,
  ]);

  return {
    id: node.id,
    identifier: node.identifier,
    title: node.title,
    description: node.description ?? "",
    labels: labelsResult.nodes.map((l) => l.name),
    url: node.url,
    priority: node.priority,
    state: stateResult?.name ?? "Unknown",
    teamName: teamResult?.name ?? "",
  };
}

/**
 * Converts a fetched Linear issue into the shared TaskContext used by the
 * coordinator, router, and state logger.
 */
export function linearIssueToTask(issue: LinearIssue): TaskContext {
  const priorityLabel = PRIORITY_LABELS[issue.priority] ?? "Unknown";

  const sections: string[] = [
    `## ${issue.identifier}: ${issue.title}`,
    "",
    issue.description,
  ];

  const meta: string[] = [];
  if (issue.state) meta.push(`Status: ${issue.state}`);
  if (priorityLabel !== "No priority") meta.push(`Priority: ${priorityLabel}`);
  if (issue.teamName) meta.push(`Team: ${issue.teamName}`);
  if (issue.labels.length > 0) meta.push(`Labels: ${issue.labels.join(", ")}`);

  if (meta.length > 0) {
    sections.push("", meta.join(" · "));
  }

  return {
    source: "linear",
    text: sections.filter(Boolean).join("\n"),
    linearId: issue.identifier,
    issueUrl: issue.url,
    labels: issue.labels,
  };
}

/**
 * Returns true if a string looks like a Linear issue identifier (e.g. "ENG-123").
 * Used by the CLI to auto-detect the issue provider.
 */
export function isLinearIdentifier(value: string): boolean {
  return /^[A-Za-z]+-\d+$/.test(value);
}

// ---------------------------------------------------------------------------
// List issues
// ---------------------------------------------------------------------------

export interface ListLinearIssuesOptions {
  /** Filter to a specific team key, e.g. "ENG" */
  teamKey?: string;
  /** If true, only return issues assigned to the authenticated viewer */
  assignedToMe?: boolean;
  /** Max number of issues to return (default: 25) */
  limit?: number;
  apiKey?: string;
}

export interface LinearIssueListItem {
  identifier: string;
  title: string;
  state: string;
  priority: number;
  url: string;
  assignee?: string;
}

/**
 * Lists open Linear issues, optionally filtered by team or assignment.
 */
export async function listLinearIssues(
  options: ListLinearIssuesOptions = {},
): Promise<LinearIssueListItem[]> {
  const client = getClient(options.apiKey);
  const limit = options.limit ?? 25;

  // Build filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {
    state: { type: { nin: ["completed", "cancelled"] } },
  };

  if (options.teamKey) {
    filter.team = { key: { eq: options.teamKey.toUpperCase() } };
  }

  if (options.assignedToMe) {
    const me = await client.viewer;
    filter.assignee = { id: { eq: me.id } };
  }

  const result = await client.issues({ filter, first: limit });

  return Promise.all(
    result.nodes.map(async (node) => {
      const [stateResult, assigneeResult] = await Promise.all([
        node.state,
        node.assignee,
      ]);
      return {
        identifier: node.identifier,
        title: node.title,
        state: stateResult?.name ?? "Unknown",
        priority: node.priority,
        url: node.url,
        assignee: assigneeResult?.displayName,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

/**
 * Updates the workflow state of a Linear issue by matching state name.
 * Looks up available states for the issue's team and picks the first match
 * (case-insensitive). Returns the new state name, or undefined if no match.
 */
export async function updateLinearIssueState(
  issueId: string,
  stateName: string,
  apiKey?: string,
): Promise<string | undefined> {
  const client = getClient(apiKey);

  const issue = await client.issue(issueId);
  const team = await issue.team;
  if (!team) return undefined;

  const states = await team.states();
  const target = states.nodes.find(
    (s) => s.name.toLowerCase() === stateName.toLowerCase(),
  );
  if (!target) return undefined;

  await client.updateIssue(issueId, { stateId: target.id });
  return target.name;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * Posts a comment on a Linear issue (by UUID or identifier).
 */
export async function commentOnLinearIssue(
  issueId: string,
  body: string,
  apiKey?: string,
): Promise<void> {
  const client = getClient(apiKey);
  await client.createComment({ issueId, body });
}
