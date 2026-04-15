// EventRelay — bridges Copilot SDK session events to the OrcaEventBus

import type { CopilotSession } from "@github/copilot-sdk";
import { bus } from "../core/event-bus.js";

/**
 * Attach an event relay that translates SDK session events into OrcaEventBus
 * events. Returns an unsubscribe function that removes all listeners.
 */
export function attachEventRelay(
  session: CopilotSession,
  agentName: string,
): () => void {
  const unsubs: Array<() => void> = [];

  // Track toolCallId → toolName so we can enrich completion events
  const activeTools = new Map<string, string>();

  unsubs.push(
    session.on("assistant.intent", (event) => {
      bus.emit("agent.intent", {
        agentName,
        intent: event.data.intent,
      });
    }),
  );

  unsubs.push(
    session.on("assistant.turn_start", (event) => {
      bus.emit("agent.turn.start", {
        agentName,
        turnId: event.data.turnId,
      });
    }),
  );

  unsubs.push(
    session.on("assistant.turn_end", (event) => {
      bus.emit("agent.turn.end", {
        agentName,
        turnId: event.data.turnId,
      });
    }),
  );

  unsubs.push(
    session.on("tool.execution_start", (event) => {
      activeTools.set(event.data.toolCallId, event.data.toolName);

      const args = event.data.arguments
        ? JSON.stringify(event.data.arguments).slice(0, 120)
        : undefined;

      bus.emit("agent.tool.start", {
        agentName,
        toolCallId: event.data.toolCallId,
        toolName: event.data.toolName,
        args,
      });
    }),
  );

  unsubs.push(
    session.on("tool.execution_progress", (event) => {
      bus.emit("agent.tool.progress", {
        agentName,
        toolCallId: event.data.toolCallId,
        message: event.data.progressMessage,
      });
    }),
  );

  unsubs.push(
    session.on("tool.execution_complete", (event) => {
      const toolName = activeTools.get(event.data.toolCallId) ?? "unknown";
      activeTools.delete(event.data.toolCallId);

      const snippet = event.data.result?.content
        ? String(event.data.result.content).slice(0, 80)
        : undefined;

      bus.emit("agent.tool.complete", {
        agentName,
        toolCallId: event.data.toolCallId,
        toolName,
        success: event.data.success,
        snippet,
      });
    }),
  );

  unsubs.push(
    session.on("subagent.started", (event) => {
      bus.emit("agent.subagent.started", {
        agentName,
        subagentName: event.data.agentDisplayName || event.data.agentName,
        description: event.data.agentDescription,
      });
    }),
  );

  return () => {
    for (const unsub of unsubs) unsub();
    activeTools.clear();
  };
}
