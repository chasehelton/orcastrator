// Agent history tracking — append learnings to agent history.md

import { appendState } from "./backend.js";
import type { HistoryEntry } from "../core/types.js";

export function appendHistory(
  orcastratorDir: string,
  agentName: string,
  entry: HistoryEntry,
): void {
  const block = [
    "",
    "---",
    "",
    `**${entry.timestamp}**`,
    "",
    `**Task:** ${entry.task}`,
    "",
    `**Outcome:** ${entry.outcome}`,
    "",
  ].join("\n");

  appendState(orcastratorDir, `agents/${agentName}/history.md`, block);
}
