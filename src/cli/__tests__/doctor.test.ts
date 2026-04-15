import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { doctorCommand } from "../doctor.js";

// Mock dependencies
vi.mock("node:child_process");
vi.mock("node:fs");
vi.mock("../../config/loader.js");

// Import mocked modules
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { getConfigPath, getOrcastratorDir, loadConfig } from "../../config/loader.js";

describe("doctorCommand", () => {
  let originalVersions: NodeJS.ProcessVersions;
  let originalEnv: NodeJS.ProcessEnv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitCodeBefore: number | string | null | undefined;

  beforeEach(() => {
    // Store originals
    originalVersions = process.versions;
    originalEnv = process.env;
    exitCodeBefore = process.exitCode;

    // Reset mocks
    vi.clearAllMocks();

    // Spy on console.log
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Reset process.exitCode
    process.exitCode = undefined;
  });

  afterEach(() => {
    logSpy.mockRestore();
    // Restore process state
    process.exitCode = exitCodeBefore;
  });

  it("reports pass for Node >= 22", async () => {
    // Mock Node version 22
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "22.0.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: "token" },
      configurable: true,
    });

    vi.mocked(getConfigPath).mockReturnValue("/path/to/config");
    vi.mocked(loadConfig).mockResolvedValue({} as never);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === orcastratorDir) return true;
      if (path === `${orcastratorDir}/decisions.md`) return true;
      if (path === `${orcastratorDir}/routing.md`) return true;
      if (path === `${orcastratorDir}/agents`) return true;
      return false;
    });

    await doctorCommand();

    const logs = logSpy.mock.calls.map((call: any) => call[0]).join("\n");
    expect(logs).toContain("Node.js v22.0.0 (>= 22 required)");
    expect(logs).toContain("✓");
    expect(process.exitCode).toBeUndefined();
  });

  it("reports fail for Node < 22", async () => {
    // Mock Node version 20
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "20.10.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: "token" },
      configurable: true,
    });

    vi.mocked(getConfigPath).mockReturnValue("/path/to/config");
    vi.mocked(loadConfig).mockResolvedValue({} as never);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === orcastratorDir) return true;
      if (path === `${orcastratorDir}/decisions.md`) return true;
      if (path === `${orcastratorDir}/routing.md`) return true;
      if (path === `${orcastratorDir}/agents`) return true;
      return false;
    });

    await doctorCommand();

    const logs = logSpy.mock.calls.map((call: any) => call[0]).join("\n");
    expect(logs).toContain("Node.js v20.10.0 (>= 22 required)");
    expect(logs).toContain("✗");
    expect(process.exitCode).toBe(1);
  });

  it("reports pass when GITHUB_TOKEN is set", async () => {
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "22.0.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: "my-secret-token" },
      configurable: true,
    });

    vi.mocked(getConfigPath).mockReturnValue("/path/to/config");
    vi.mocked(loadConfig).mockResolvedValue({} as never);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === orcastratorDir) return true;
      if (path === `${orcastratorDir}/decisions.md`) return true;
      if (path === `${orcastratorDir}/routing.md`) return true;
      if (path === `${orcastratorDir}/agents`) return true;
      return false;
    });

    await doctorCommand();

    const logs = logSpy.mock.calls.map((call: any) => call[0]).join("\n");
    expect(logs).toContain("GitHub token configured");
    expect(logs).not.toContain("via gh CLI");
  });

  it("reports pass when gh auth succeeds (fallback)", async () => {
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "22.0.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: undefined },
      configurable: true,
    });

    vi.mocked(execFileSync).mockImplementation(() => {
      return "";
    });

    vi.mocked(getConfigPath).mockReturnValue("/path/to/config");
    vi.mocked(loadConfig).mockResolvedValue({} as never);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === orcastratorDir) return true;
      if (path === `${orcastratorDir}/decisions.md`) return true;
      if (path === `${orcastratorDir}/routing.md`) return true;
      if (path === `${orcastratorDir}/agents`) return true;
      return false;
    });

    await doctorCommand();

    const logs = logSpy.mock.calls.map((call: any) => call[0]).join("\n");
    expect(logs).toContain("GitHub token configured (via gh CLI)");
    expect(process.exitCode).toBeUndefined();
  });

  it("reports fail when neither GITHUB_TOKEN nor gh auth available", async () => {
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "22.0.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: undefined },
      configurable: true,
    });

    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("gh not found");
    });

    vi.mocked(getConfigPath).mockReturnValue("/path/to/config");
    vi.mocked(loadConfig).mockResolvedValue({} as never);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === orcastratorDir) return true;
      if (path === `${orcastratorDir}/decisions.md`) return true;
      if (path === `${orcastratorDir}/routing.md`) return true;
      if (path === `${orcastratorDir}/agents`) return true;
      return false;
    });

    await doctorCommand();

    const logs = logSpy.mock.calls.map((call: any) => call[0]).join("\n");
    expect(logs).toContain("GitHub token not found");
    expect(process.exitCode).toBe(1);
  });

  it("reports pass when config file exists", async () => {
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "22.0.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: "token" },
      configurable: true,
    });

    vi.mocked(getConfigPath).mockReturnValue("/path/to/orcastrator.config.ts");
    vi.mocked(loadConfig).mockResolvedValue({} as never);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === orcastratorDir) return true;
      if (path === `${orcastratorDir}/decisions.md`) return true;
      if (path === `${orcastratorDir}/routing.md`) return true;
      if (path === `${orcastratorDir}/agents`) return true;
      return false;
    });

    await doctorCommand();

    const logs = logSpy.mock.calls.map((call: any) => call[0]).join("\n");
    expect(logs).toContain("Config file found and valid");
  });

  it("reports fail when config file missing", async () => {
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "22.0.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: "token" },
      configurable: true,
    });

    vi.mocked(getConfigPath).mockReturnValue(null);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === orcastratorDir) return true;
      if (path === `${orcastratorDir}/decisions.md`) return true;
      if (path === `${orcastratorDir}/routing.md`) return true;
      if (path === `${orcastratorDir}/agents`) return true;
      return false;
    });

    await doctorCommand();

    const logs = logSpy.mock.calls.map((call: any) => call[0]).join("\n");
    expect(logs).toContain("Config file not found");
    expect(process.exitCode).toBe(1);
  });

  it("reports warning (not failure) when LINEAR_API_KEY missing", async () => {
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "22.0.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: "token", LINEAR_API_KEY: undefined },
      configurable: true,
    });

    vi.mocked(getConfigPath).mockReturnValue("/path/to/config");
    vi.mocked(loadConfig).mockResolvedValue({} as never);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === orcastratorDir) return true;
      if (path === `${orcastratorDir}/decisions.md`) return true;
      if (path === `${orcastratorDir}/routing.md`) return true;
      if (path === `${orcastratorDir}/agents`) return true;
      return false;
    });

    await doctorCommand();

    const logs = logSpy.mock.calls.map((call: any) => call[0]).join("\n");
    expect(logs).toContain("Linear API key not set (optional)");
    expect(logs).toContain("⚠");
    // Warning should not cause exitCode = 1
    expect(process.exitCode).toBeUndefined();
  });

  it("sets process.exitCode = 1 on required check failure", async () => {
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "18.0.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: "token" },
      configurable: true,
    });

    vi.mocked(getConfigPath).mockReturnValue("/path/to/config");
    vi.mocked(loadConfig).mockResolvedValue({} as never);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === orcastratorDir) return true;
      if (path === `${orcastratorDir}/decisions.md`) return true;
      if (path === `${orcastratorDir}/routing.md`) return true;
      if (path === `${orcastratorDir}/agents`) return true;
      return false;
    });

    await doctorCommand();

    expect(process.exitCode).toBe(1);
  });

  it("reports pass for state directory structure valid", async () => {
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "22.0.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: "token" },
      configurable: true,
    });

    vi.mocked(getConfigPath).mockReturnValue("/path/to/config");
    vi.mocked(loadConfig).mockResolvedValue({} as never);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === orcastratorDir) return true;
      if (path === `${orcastratorDir}/decisions.md`) return true;
      if (path === `${orcastratorDir}/routing.md`) return true;
      if (path === `${orcastratorDir}/agents`) return true;
      return false;
    });

    await doctorCommand();

    const logs = logSpy.mock.calls.map((call: any) => call[0]).join("\n");
    expect(logs).toContain("State directory structure valid");
  });

  it("reports fail when state directory missing", async () => {
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "22.0.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: "token" },
      configurable: true,
    });

    vi.mocked(getConfigPath).mockReturnValue("/path/to/config");
    vi.mocked(loadConfig).mockResolvedValue({} as never);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockReturnValue(false);

    await doctorCommand();

    const logs = logSpy.mock.calls.map((call: any) => call[0]).join("\n");
    expect(logs).toContain("State directory missing");
    expect(process.exitCode).toBe(1);
  });

  it("reports fail when state directory incomplete", async () => {
    Object.defineProperty(process, "versions", {
      value: { ...originalVersions, node: "22.0.0" },
      configurable: true,
    });
    Object.defineProperty(process, "env", {
      value: { ...originalEnv, GITHUB_TOKEN: "token" },
      configurable: true,
    });

    vi.mocked(getConfigPath).mockReturnValue("/path/to/config");
    vi.mocked(loadConfig).mockResolvedValue({} as never);

    const orcastratorDir = "/path/.orcastrator";
    vi.mocked(getOrcastratorDir).mockReturnValue(orcastratorDir);
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === orcastratorDir) return true;
      if (path === `${orcastratorDir}/decisions.md`) return true;
      // routing.md missing
      return false;
    });

    await doctorCommand();

    const logs = logSpy.mock.calls.map((call: any) => call[0]).join("\n");
    expect(logs).toContain("State directory incomplete");
    expect(logs).toContain("routing.md");
    expect(process.exitCode).toBe(1);
  });
});
