import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEventBus, OrcaEventBus } from "../event-bus.js";

describe("OrcaEventBus", () => {
  beforeEach(() => {
    // Clear all listeners before each test
    const bus = getEventBus();
    bus.removeAllListeners();
  });

  it("getEventBus() returns an OrcaEventBus instance", () => {
    const bus = getEventBus();
    expect(bus).toBeInstanceOf(OrcaEventBus);
  });

  it("getEventBus() returns the same instance (singleton)", () => {
    const bus1 = getEventBus();
    const bus2 = getEventBus();
    expect(bus1).toBe(bus2);
  });

  it("Can subscribe and receive tier.selected events with correct payload", () => {
    const bus = getEventBus();
    const listener = vi.fn();

    bus.on("tier.selected", listener);

    const payload = { task: "myTask", tier: "advanced", reason: "high complexity" };
    bus.emit("tier.selected", payload);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it("Can subscribe and receive task.started events", () => {
    const bus = getEventBus();
    const listener = vi.fn();

    bus.on("task.started", listener);

    const payload = { task: "processData", agents: ["agent1", "agent2"] };
    bus.emit("task.started", payload);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it("Can subscribe and receive agent.spawned events", () => {
    const bus = getEventBus();
    const listener = vi.fn();

    bus.on("agent.spawned", listener);

    const payload = { agentName: "dataAgent", success: true };
    bus.emit("agent.spawned", payload);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it("Can subscribe and receive agent.completed events", () => {
    const bus = getEventBus();
    const listener = vi.fn();

    bus.on("agent.completed", listener);

    const payload = { agentName: "dataAgent", success: true, duration: 1500 };
    bus.emit("agent.completed", payload);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it("Can subscribe and receive task.completed events", () => {
    const bus = getEventBus();
    const listener = vi.fn();

    bus.on("task.completed", listener);

    const payload = { strategy: "parallel", duration: 5000, agentCount: 3 };
    bus.emit("task.completed", payload);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it("once() listener fires only once", () => {
    const bus = getEventBus();
    const listener = vi.fn();

    bus.once("tier.selected", listener);

    const payload = { task: "task1", tier: "basic", reason: "simple" };
    bus.emit("tier.selected", payload);
    bus.emit("tier.selected", payload);
    bus.emit("tier.selected", payload);

    expect(listener).toHaveBeenCalledOnce();
  });

  it("off() removes listener", () => {
    const bus = getEventBus();
    const listener = vi.fn();

    bus.on("task.started", listener);
    bus.off("task.started", listener);

    const payload = { task: "task1", agents: ["agent1"] };
    bus.emit("task.started", payload);

    expect(listener).not.toHaveBeenCalled();
  });

  it("Multiple listeners receive the same event", () => {
    const bus = getEventBus();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();

    bus.on("agent.spawned", listener1);
    bus.on("agent.spawned", listener2);
    bus.on("agent.spawned", listener3);

    const payload = { agentName: "worker", success: true };
    bus.emit("agent.spawned", payload);

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener1).toHaveBeenCalledWith(payload);
    expect(listener2).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledWith(payload);
    expect(listener3).toHaveBeenCalledOnce();
    expect(listener3).toHaveBeenCalledWith(payload);
  });
});
