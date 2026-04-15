import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEventBus } from "../../core/event-bus.js";
import { attachEventRelay } from "../event-relay.js";

// Minimal mock for CopilotSession.on(eventType, handler)
function createMockSession() {
  const handlers = new Map<string, Array<(event: unknown) => void>>();

  return {
    on: vi.fn((eventType: string, handler: (event: unknown) => void) => {
      if (!handlers.has(eventType)) handlers.set(eventType, []);
      handlers.get(eventType)!.push(handler);
      // Return unsubscribe
      return () => {
        const arr = handlers.get(eventType);
        if (arr) {
          const idx = arr.indexOf(handler);
          if (idx >= 0) arr.splice(idx, 1);
        }
      };
    }),
    _emit(eventType: string, event: unknown) {
      for (const h of handlers.get(eventType) ?? []) h(event);
    },
    _handlerCount(eventType: string) {
      return handlers.get(eventType)?.length ?? 0;
    },
  };
}

describe("attachEventRelay", () => {
  beforeEach(() => {
    getEventBus().removeAllListeners();
  });

  it("relays assistant.intent → agent.intent on the bus", () => {
    const session = createMockSession();
    const bus = getEventBus();
    const listener = vi.fn();
    bus.on("agent.intent", listener);

    attachEventRelay(session as never, "test-agent");

    session._emit("assistant.intent", {
      data: { intent: "Exploring codebase" },
    });

    expect(listener).toHaveBeenCalledWith({
      agentName: "test-agent",
      intent: "Exploring codebase",
    });
  });

  it("relays tool.execution_start → agent.tool.start", () => {
    const session = createMockSession();
    const bus = getEventBus();
    const listener = vi.fn();
    bus.on("agent.tool.start", listener);

    attachEventRelay(session as never, "dev");

    session._emit("tool.execution_start", {
      data: {
        toolCallId: "tc-1",
        toolName: "bash",
        arguments: { command: "npm test" },
      },
    });

    expect(listener).toHaveBeenCalledWith({
      agentName: "dev",
      toolCallId: "tc-1",
      toolName: "bash",
      args: '{"command":"npm test"}',
    });
  });

  it("relays tool.execution_complete with toolName from tracked start event", () => {
    const session = createMockSession();
    const bus = getEventBus();
    const listener = vi.fn();
    bus.on("agent.tool.complete", listener);

    attachEventRelay(session as never, "dev");

    // Start event to populate tracking
    session._emit("tool.execution_start", {
      data: { toolCallId: "tc-2", toolName: "edit", arguments: {} },
    });

    session._emit("tool.execution_complete", {
      data: {
        toolCallId: "tc-2",
        success: true,
        result: { content: "File updated successfully" },
      },
    });

    expect(listener).toHaveBeenCalledWith({
      agentName: "dev",
      toolCallId: "tc-2",
      toolName: "edit",
      success: true,
      snippet: "File updated successfully",
    });
  });

  it("uses 'unknown' for toolName when no start event precedes complete", () => {
    const session = createMockSession();
    const bus = getEventBus();
    const listener = vi.fn();
    bus.on("agent.tool.complete", listener);

    attachEventRelay(session as never, "dev");

    session._emit("tool.execution_complete", {
      data: { toolCallId: "tc-orphan", success: false },
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: "unknown" }),
    );
  });

  it("relays assistant.turn_start and turn_end", () => {
    const session = createMockSession();
    const bus = getEventBus();
    const startListener = vi.fn();
    const endListener = vi.fn();
    bus.on("agent.turn.start", startListener);
    bus.on("agent.turn.end", endListener);

    attachEventRelay(session as never, "planner");

    session._emit("assistant.turn_start", { data: { turnId: "1" } });
    session._emit("assistant.turn_end", { data: { turnId: "1" } });

    expect(startListener).toHaveBeenCalledWith({ agentName: "planner", turnId: "1" });
    expect(endListener).toHaveBeenCalledWith({ agentName: "planner", turnId: "1" });
  });

  it("relays subagent.started → agent.subagent.started", () => {
    const session = createMockSession();
    const bus = getEventBus();
    const listener = vi.fn();
    bus.on("agent.subagent.started", listener);

    attachEventRelay(session as never, "orchestrator");

    session._emit("subagent.started", {
      data: {
        toolCallId: "tc-sub",
        agentName: "code-review",
        agentDisplayName: "Code Reviewer",
        agentDescription: "Reviews code changes",
      },
    });

    expect(listener).toHaveBeenCalledWith({
      agentName: "orchestrator",
      subagentName: "Code Reviewer",
      description: "Reviews code changes",
    });
  });

  it("unsubscribe removes all SDK session listeners", () => {
    const session = createMockSession();
    const bus = getEventBus();
    const listener = vi.fn();
    bus.on("agent.intent", listener);

    const unsub = attachEventRelay(session as never, "test");

    // Fire once — should reach bus
    session._emit("assistant.intent", { data: { intent: "working" } });
    expect(listener).toHaveBeenCalledOnce();

    // Unsub and fire again — should NOT reach bus
    unsub();
    session._emit("assistant.intent", { data: { intent: "still working" } });
    expect(listener).toHaveBeenCalledOnce(); // still 1, not 2
  });

  it("relays tool.execution_progress → agent.tool.progress", () => {
    const session = createMockSession();
    const bus = getEventBus();
    const listener = vi.fn();
    bus.on("agent.tool.progress", listener);

    attachEventRelay(session as never, "dev");

    session._emit("tool.execution_progress", {
      data: { toolCallId: "tc-3", progressMessage: "Compiling..." },
    });

    expect(listener).toHaveBeenCalledWith({
      agentName: "dev",
      toolCallId: "tc-3",
      message: "Compiling...",
    });
  });

  it("truncates tool arguments to 120 characters", () => {
    const session = createMockSession();
    const bus = getEventBus();
    const listener = vi.fn();
    bus.on("agent.tool.start", listener);

    attachEventRelay(session as never, "dev");

    const longArgs = { content: "x".repeat(200) };
    session._emit("tool.execution_start", {
      data: { toolCallId: "tc-long", toolName: "edit", arguments: longArgs },
    });

    const emitted = listener.mock.calls[0][0];
    expect(emitted.args!.length).toBeLessThanOrEqual(120);
  });
});
