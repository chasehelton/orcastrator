import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentConfig, OrcastratorConfig, SpawnResult } from "../types.js";
import type { GuardrailsOverride } from "../../client/copilot.js";
import type { ModelTierSuggestion } from "../response-tiers.js";
import { fanOut, type FanOutOptions } from "../fan-out.js";

function createAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    name: "test-agent",
    role: "researcher",
    expertise: ["analysis", "investigation"],
    instructions: "Test instructions",
    ...overrides,
  };
}

function createOrcastratorConfig(overrides?: Partial<OrcastratorConfig>): OrcastratorConfig {
  return {
    description: "Test config",
    capabilities: ["spawn", "task"],
    ...overrides,
  } as OrcastratorConfig;
}

function createMockLifecycle() {
  return {
    spawnAgent: vi.fn(),
    sendTask: vi.fn(),
    shutdown: vi.fn(),
  } as any;
}

function createFanOutOptions(overrides?: Partial<FanOutOptions>): FanOutOptions {
  return {
    agents: [createAgentConfig()],
    config: createOrcastratorConfig(),
    orcastratorDir: "/test/orcastrator",
    task: "Test task",
    lifecycle: createMockLifecycle(),
    ...overrides,
  };
}

describe("fanOut", () => {
  it("should successfully spawn and send task to single agent", async () => {
    const lifecycle = createMockLifecycle();

    lifecycle.spawnAgent.mockResolvedValue({
      agentName: "test-agent",
      success: true,
      sessionId: "session-123",
    });
    lifecycle.sendTask.mockResolvedValue("Task response");

    const options = createFanOutOptions({ lifecycle });
    const results = await fanOut(options);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      agentName: "test-agent",
      success: true,
      sessionId: "session-123",
      response: "Task response",
    });

    expect(lifecycle.spawnAgent).toHaveBeenCalledWith(
      options.agents[0],
      options.config,
      options.orcastratorDir,
      options.task,
      options.workingDirectory,
      options.guardrailsOverride,
      options.modelTier,
      options.skills,
    );
    expect(lifecycle.sendTask).toHaveBeenCalledWith("test-agent", options.task);
  });

  it("should handle failed agent spawn", async () => {
    const lifecycle = createMockLifecycle();
    lifecycle.spawnAgent.mockResolvedValue({
      agentName: "test-agent",
      success: false,
      error: "Failed to spawn agent",
    });

    const results = await fanOut(createFanOutOptions({ lifecycle }));

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      agentName: "test-agent",
      success: false,
      error: "Failed to spawn agent",
    });
    expect(lifecycle.sendTask).not.toHaveBeenCalled();
  });

  it("should handle spawn success but task returning undefined", async () => {
    const lifecycle = createMockLifecycle();
    lifecycle.spawnAgent.mockResolvedValue({
      agentName: "test-agent",
      success: true,
      sessionId: "session-123",
    });
    lifecycle.sendTask.mockResolvedValue(undefined);

    const results = await fanOut(createFanOutOptions({ lifecycle }));

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].response).toBeUndefined();
  });

  it("should handle exception during spawn", async () => {
    const lifecycle = createMockLifecycle();
    lifecycle.spawnAgent.mockRejectedValue(new Error("Network error"));

    const results = await fanOut(createFanOutOptions({ lifecycle }));

    expect(results).toHaveLength(1);
    expect(results[0].agentName).toBe("test-agent");
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("Network error");
  });

  it("should handle exception during task send", async () => {
    const lifecycle = createMockLifecycle();
    lifecycle.spawnAgent.mockResolvedValue({
      agentName: "test-agent",
      success: true,
      sessionId: "session-123",
    });
    lifecycle.sendTask.mockRejectedValue(new Error("Task failed"));

    const results = await fanOut(createFanOutOptions({ lifecycle }));

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      agentName: "test-agent",
      success: false,
      error: expect.stringContaining("Task failed"),
    });
  });

  it("should spawn and task multiple agents successfully", async () => {
    const lifecycle = createMockLifecycle();
    lifecycle.spawnAgent
      .mockResolvedValueOnce({ agentName: "agent-1", success: true, sessionId: "session-1" })
      .mockResolvedValueOnce({ agentName: "agent-2", success: true, sessionId: "session-2" });
    lifecycle.sendTask
      .mockResolvedValueOnce("Response from agent 1")
      .mockResolvedValueOnce("Response from agent 2");

    const agents = [
      createAgentConfig({ name: "agent-1" }),
      createAgentConfig({ name: "agent-2" }),
    ];

    const results = await fanOut(createFanOutOptions({ agents, lifecycle }));

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      agentName: "agent-1", success: true, sessionId: "session-1", response: "Response from agent 1",
    });
    expect(results[1]).toEqual({
      agentName: "agent-2", success: true, sessionId: "session-2", response: "Response from agent 2",
    });
  });

  it("should isolate failures via Promise.allSettled", async () => {
    const lifecycle = createMockLifecycle();
    lifecycle.spawnAgent
      .mockRejectedValueOnce(new Error("Agent 1 spawn failed"))
      .mockResolvedValueOnce({ agentName: "agent-2", success: true, sessionId: "session-2" });
    lifecycle.sendTask.mockResolvedValueOnce("Response from agent 2");

    const agents = [
      createAgentConfig({ name: "agent-1" }),
      createAgentConfig({ name: "agent-2" }),
    ];

    const results = await fanOut(createFanOutOptions({ agents, lifecycle }));

    expect(results).toHaveLength(2);
    expect(results[0].agentName).toBe("agent-1");
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("Agent 1 spawn failed");
    expect(results[1]).toEqual({
      agentName: "agent-2", success: true, sessionId: "session-2", response: "Response from agent 2",
    });
  });

  it("should return empty array for empty agents", async () => {
    const lifecycle = createMockLifecycle();
    const results = await fanOut(createFanOutOptions({ agents: [], lifecycle }));

    expect(results).toHaveLength(0);
    expect(lifecycle.spawnAgent).not.toHaveBeenCalled();
    expect(lifecycle.sendTask).not.toHaveBeenCalled();
  });

  it("should pass guardrails override and model tier to spawn", async () => {
    const lifecycle = createMockLifecycle();
    lifecycle.spawnAgent.mockResolvedValue({ agentName: "test-agent", success: true, sessionId: "s-1" });
    lifecycle.sendTask.mockResolvedValue("Response");

    const guardrailsOverride = { permissionHandler: vi.fn(), hooks: {} } as any;
    const modelTier: ModelTierSuggestion = "premium";

    await fanOut(createFanOutOptions({ lifecycle, guardrailsOverride, modelTier }));

    expect(lifecycle.spawnAgent).toHaveBeenCalledWith(
      expect.any(Object), expect.any(Object), expect.any(String), expect.any(String),
      undefined, guardrailsOverride, modelTier, undefined,
    );
  });

  it("should pass working directory to spawn", async () => {
    const lifecycle = createMockLifecycle();
    lifecycle.spawnAgent.mockResolvedValue({ agentName: "test-agent", success: true, sessionId: "s-1" });
    lifecycle.sendTask.mockResolvedValue("Response");

    await fanOut(createFanOutOptions({ lifecycle, workingDirectory: "/custom/dir" }));

    expect(lifecycle.spawnAgent).toHaveBeenCalledWith(
      expect.any(Object), expect.any(Object), expect.any(String), expect.any(String),
      "/custom/dir", undefined, undefined, undefined,
    );
  });

  it("should handle mixed spawn failures and successes", async () => {
    const lifecycle = createMockLifecycle();
    lifecycle.spawnAgent
      .mockResolvedValueOnce({ agentName: "agent-1", success: true, sessionId: "session-1" })
      .mockResolvedValueOnce({ agentName: "agent-2", success: false, error: "Spawn failed" })
      .mockResolvedValueOnce({ agentName: "agent-3", success: true, sessionId: "session-3" });
    lifecycle.sendTask
      .mockResolvedValueOnce("Response 1")
      .mockResolvedValueOnce("Response 3");

    const agents = [
      createAgentConfig({ name: "agent-1" }),
      createAgentConfig({ name: "agent-2" }),
      createAgentConfig({ name: "agent-3" }),
    ];

    const results = await fanOut(createFanOutOptions({ agents, lifecycle }));

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ agentName: "agent-1", success: true, sessionId: "session-1", response: "Response 1" });
    expect(results[1]).toEqual({ agentName: "agent-2", success: false, error: "Spawn failed" });
    expect(results[2]).toEqual({ agentName: "agent-3", success: true, sessionId: "session-3", response: "Response 3" });
  });
});
