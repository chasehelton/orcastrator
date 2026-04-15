import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getEventBus } from "../../core/event-bus.js";

// Mock log-update before importing the renderer
vi.mock("log-update", () => {
  const fn = Object.assign(vi.fn(), {
    done: vi.fn(),
    clear: vi.fn(),
  });
  return { default: fn };
});

import { ActivityRenderer } from "../activity-renderer.js";

describe("ActivityRenderer", () => {
  beforeEach(() => {
    getEventBus().removeAllListeners();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks agent state from bus events", () => {
    const renderer = new ActivityRenderer({ verbosity: "normal", clearBehavior: "clear" });
    const bus = getEventBus();

    renderer.start();

    bus.emit("agent.spawned", { agentName: "backend", success: true });
    bus.emit("agent.intent", { agentName: "backend", intent: "Reading files" });
    bus.emit("agent.turn.start", { agentName: "backend", turnId: "1" });
    bus.emit("agent.tool.start", {
      agentName: "backend",
      toolCallId: "tc-1",
      toolName: "grep",
      args: '{"pattern":"TODO"}',
    });

    const states = renderer.getAgentStates();
    const backend = states.get("backend");

    expect(backend).toBeDefined();
    expect(backend!.intent).toBe("Reading files");
    expect(backend!.currentTool).toBe("grep");
    expect(backend!.turnCount).toBe(1);
    expect(backend!.toolCallCount).toBe(1);

    renderer.stop();
  });

  it("clears currentTool on tool.complete", () => {
    const renderer = new ActivityRenderer({ verbosity: "normal", clearBehavior: "clear" });
    const bus = getEventBus();

    renderer.start();

    bus.emit("agent.tool.start", {
      agentName: "dev",
      toolCallId: "tc-1",
      toolName: "bash",
    });

    expect(renderer.getAgentStates().get("dev")?.currentTool).toBe("bash");

    bus.emit("agent.tool.complete", {
      agentName: "dev",
      toolCallId: "tc-1",
      toolName: "bash",
      success: true,
    });

    expect(renderer.getAgentStates().get("dev")?.currentTool).toBe("");

    renderer.stop();
  });

  it("tracks multiple agents independently", () => {
    const renderer = new ActivityRenderer({ verbosity: "normal", clearBehavior: "clear" });
    const bus = getEventBus();

    renderer.start();

    bus.emit("agent.spawned", { agentName: "frontend", success: true });
    bus.emit("agent.spawned", { agentName: "backend", success: true });
    bus.emit("agent.intent", { agentName: "frontend", intent: "Styling" });
    bus.emit("agent.intent", { agentName: "backend", intent: "API work" });

    const states = renderer.getAgentStates();
    expect(states.size).toBe(2);
    expect(states.get("frontend")?.intent).toBe("Styling");
    expect(states.get("backend")?.intent).toBe("API work");

    renderer.stop();
  });

  it("getOutput() returns non-empty string when agents are active", () => {
    const renderer = new ActivityRenderer({ verbosity: "normal", clearBehavior: "clear" });
    const bus = getEventBus();

    renderer.start();

    bus.emit("agent.spawned", { agentName: "dev", success: true });
    bus.emit("agent.tool.start", {
      agentName: "dev",
      toolCallId: "tc-1",
      toolName: "edit",
    });

    const output = renderer.getOutput();
    expect(output).toContain("dev");
    expect(output).toContain("edit");

    renderer.stop();
  });

  it("quiet mode does not subscribe to events", () => {
    const renderer = new ActivityRenderer({ verbosity: "quiet", clearBehavior: "clear" });
    const bus = getEventBus();

    renderer.start();

    bus.emit("agent.spawned", { agentName: "dev", success: true });
    expect(renderer.getAgentStates().size).toBe(0);

    renderer.stop();
  });

  it("verbose mode includes tool args in output", () => {
    const renderer = new ActivityRenderer({ verbosity: "verbose", clearBehavior: "clear" });
    const bus = getEventBus();

    renderer.start();

    bus.emit("agent.tool.start", {
      agentName: "dev",
      toolCallId: "tc-1",
      toolName: "bash",
      args: '{"command":"npm test"}',
    });

    const output = renderer.getOutput();
    expect(output).toContain("npm test");

    renderer.stop();
  });

  it("stop() clears agents state", () => {
    const renderer = new ActivityRenderer({ verbosity: "normal", clearBehavior: "clear" });
    const bus = getEventBus();

    renderer.start();

    bus.emit("agent.spawned", { agentName: "dev", success: true });
    expect(renderer.getAgentStates().size).toBe(1);

    renderer.stop();
    expect(renderer.getAgentStates().size).toBe(0);
  });

  it("increments tool call count for each new tool start", () => {
    const renderer = new ActivityRenderer({ verbosity: "normal", clearBehavior: "clear" });
    const bus = getEventBus();

    renderer.start();

    for (let i = 0; i < 5; i++) {
      bus.emit("agent.tool.start", {
        agentName: "dev",
        toolCallId: `tc-${i}`,
        toolName: "view",
      });
    }

    expect(renderer.getAgentStates().get("dev")?.toolCallCount).toBe(5);

    renderer.stop();
  });

  it("shows subagent activity", () => {
    const renderer = new ActivityRenderer({ verbosity: "normal", clearBehavior: "clear" });
    const bus = getEventBus();

    renderer.start();

    bus.emit("agent.subagent.started", {
      agentName: "main",
      subagentName: "reviewer",
      description: "Code review",
    });

    const output = renderer.getOutput();
    expect(output).toContain("subagent:reviewer");

    renderer.stop();
  });
});
