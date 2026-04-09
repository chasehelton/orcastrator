// Decision logging — append decisions to decisions.md

import { appendState } from "./backend.js";
import type { DecisionEntry } from "../core/types.js";

export function appendDecision(
  orcastratorDir: string,
  entry: DecisionEntry,
): void {
  const block = [
    "",
    "---",
    "",
    `**${entry.timestamp}** — ${entry.agent}`,
    "",
    entry.decision,
    ...(entry.context ? ["", `> Context: ${entry.context}`] : []),
    "",
  ].join("\n");

  appendState(orcastratorDir, "decisions.md", block);
}
