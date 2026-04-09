// Session log — write session records to .orcastrator/log/

import { writeState } from "./backend.js";
import type { SessionLog } from "../core/types.js";

export function appendSessionLog(
  orcastratorDir: string,
  log: SessionLog,
): void {
  const filename = `${log.timestamp.replace(/[:.]/g, "-")}_${log.id.slice(0, 8)}.json`;
  writeState(orcastratorDir, `log/${filename}`, JSON.stringify(log, null, 2));
}
