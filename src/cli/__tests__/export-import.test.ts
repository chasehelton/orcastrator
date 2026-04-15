import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs before importing commands
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock the config loader
vi.mock("../../config/loader.js");

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { exportCommand } from "../export.js";
import { importCommand } from "../import-config.js";
import * as loader from "../../config/loader.js";

describe("Export/Import Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log");
    vi.spyOn(console, "error");
    vi.spyOn(process, "cwd").mockReturnValue("/home/user");
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("exportCommand", () => {
    it("reads files from .orcastrator/ recursively", async () => {
      const mockOrcastratorDir = "/home/user/.orcastrator";
      const mockConfigPath = "/home/user/orcastrator.config.ts";

      vi.mocked(loader.getOrcastratorDir).mockReturnValue(mockOrcastratorDir);
      vi.mocked(loader.getConfigPath).mockReturnValue(mockConfigPath);

      const mockDirents = [
        { name: "state", isDirectory: () => true, isFile: () => false },
        { name: "log", isDirectory: () => true, isFile: () => false },
      ];

      const stateFiles = [
        { name: "tasks.json", isDirectory: () => false, isFile: () => true },
      ];

      vi.mocked(existsSync).mockImplementation((path) => {
        if (path === mockOrcastratorDir) return true;
        if (path === mockConfigPath) return true;
        return false;
      });

      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === mockOrcastratorDir) return mockDirents as any;
        if (String(path).includes("state")) return stateFiles as any;
        return [];
      });

      vi.mocked(readFileSync).mockImplementation((path) => {
        if (String(path).includes("tasks.json")) return '{"tasks":[]}';
        if (path === mockConfigPath)
          return "export default { apiKey: 'test' }";
        return "";
      });

      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(mkdirSync).mockImplementation(() => "");

      await exportCommand("test-export.json");

      expect(writeFileSync).toHaveBeenCalled();
      const writeCall = vi.mocked(writeFileSync).mock.calls[0];
      const exportedJson = JSON.parse(writeCall[1] as string);

      expect(exportedJson.state).toBeDefined();
    });

    it("includes config file content in export", async () => {
      const mockOrcastratorDir = "/home/user/.orcastrator";
      const mockConfigPath = "/home/user/orcastrator.config.ts";
      const mockConfigContent = "export default { apiKey: 'test' }";

      vi.mocked(loader.getOrcastratorDir).mockReturnValue(mockOrcastratorDir);
      vi.mocked(loader.getConfigPath).mockReturnValue(mockConfigPath);

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readdirSync).mockReturnValue([]);
      vi.mocked(readFileSync).mockReturnValue(mockConfigContent);
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(mkdirSync).mockImplementation(() => "");

      let configCheckCount = 0;
      vi.mocked(existsSync).mockImplementation((path) => {
        if (path === mockConfigPath) {
          configCheckCount++;
          return configCheckCount > 0;
        }
        return false;
      });

      await exportCommand("test-export.json");

      const writeCall = vi.mocked(writeFileSync).mock.calls[0];
      const exportedJson = JSON.parse(writeCall[1] as string);

      expect(exportedJson.config).toBe(mockConfigContent);
    });

    it("skips log/ directory during recursion", async () => {
      const mockOrcastratorDir = "/home/user/.orcastrator";

      vi.mocked(loader.getOrcastratorDir).mockReturnValue(mockOrcastratorDir);
      vi.mocked(loader.getConfigPath).mockReturnValue(null);

      const mockDirents = [
        { name: "state", isDirectory: () => true, isFile: () => false },
        { name: "log", isDirectory: () => true, isFile: () => false },
      ];

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === mockOrcastratorDir) return mockDirents as any;
        return [];
      });
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(mkdirSync).mockImplementation(() => "");

      await exportCommand("test-export.json");

      const writeCall = vi.mocked(writeFileSync).mock.calls[0];
      const exportedJson = JSON.parse(writeCall[1] as string);

      expect(Object.keys(exportedJson.state).some((k) => k.startsWith("log/")))
        .toBe(false);
    });

    it("writes valid JSON with version, exportedAt, config, and state fields", async () => {
      const mockOrcastratorDir = "/home/user/.orcastrator";

      vi.mocked(loader.getOrcastratorDir).mockReturnValue(mockOrcastratorDir);
      vi.mocked(loader.getConfigPath).mockReturnValue(null);

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readdirSync).mockReturnValue([]);
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(mkdirSync).mockImplementation(() => "");

      await exportCommand("test-export.json");

      const writeCall = vi.mocked(writeFileSync).mock.calls[0];
      const exportedJson = JSON.parse(writeCall[1] as string);

      expect(exportedJson).toHaveProperty("version");
      expect(exportedJson).toHaveProperty("exportedAt");
      expect(exportedJson).toHaveProperty("config");
      expect(exportedJson).toHaveProperty("state");

      expect(exportedJson.version).toBe(1);
      expect(typeof exportedJson.exportedAt).toBe("string");
      expect(exportedJson.config).toBeNull();
      expect(typeof exportedJson.state).toBe("object");
    });

    it("handles missing .orcastrator/ gracefully", async () => {
      const mockOrcastratorDir = "/home/user/.orcastrator";

      vi.mocked(loader.getOrcastratorDir).mockReturnValue(mockOrcastratorDir);
      vi.mocked(loader.getConfigPath).mockReturnValue(null);

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readdirSync).mockReturnValue([]);
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(mkdirSync).mockImplementation(() => "");

      await exportCommand("test-export.json");

      const writeCall = vi.mocked(writeFileSync).mock.calls[0];
      const exportedJson = JSON.parse(writeCall[1] as string);

      expect(exportedJson.state).toEqual({});
      expect(exportedJson.version).toBe(1);
    });

    it("uses default filename when no output path provided", async () => {
      const mockOrcastratorDir = "/home/user/.orcastrator";

      vi.mocked(loader.getOrcastratorDir).mockReturnValue(mockOrcastratorDir);
      vi.mocked(loader.getConfigPath).mockReturnValue(null);

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readdirSync).mockReturnValue([]);
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(mkdirSync).mockImplementation(() => "");

      await exportCommand();

      expect(writeFileSync).toHaveBeenCalled();
      const writeCall = vi.mocked(writeFileSync).mock.calls[0];
      expect(writeCall[0]).toBe("orcastrator-export.json");
    });

    it("creates parent directories if needed", async () => {
      const mockOrcastratorDir = "/home/user/.orcastrator";

      vi.mocked(loader.getOrcastratorDir).mockReturnValue(mockOrcastratorDir);
      vi.mocked(loader.getConfigPath).mockReturnValue(null);

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readdirSync).mockReturnValue([]);
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(mkdirSync).mockImplementation(() => "");

      await exportCommand("exports/nested/test-export.json");

      expect(mkdirSync).toHaveBeenCalledWith("exports/nested", {
        recursive: true,
      });
    });
  });

  describe("importCommand", () => {
    it("validates export version field", async () => {
      const inputPath = "/home/user/export.json";
      const mockSnapshot = {
        version: 2,
        exportedAt: new Date().toISOString(),
        config: null,
        state: {},
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockSnapshot));

      await importCommand(inputPath, {});

      expect(console.error).toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it("handles invalid/corrupt JSON input", async () => {
      const inputPath = "/home/user/export.json";

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("{ invalid json");

      await importCommand(inputPath, {});

      expect(console.error).toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it("handles missing input file", async () => {
      const inputPath = "/home/user/nonexistent.json";

      vi.mocked(existsSync).mockReturnValue(false);

      await importCommand(inputPath, {});

      expect(console.error).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("File not found")
      );
      expect(process.exitCode).toBe(1);
    });

    it("skips config restore when config already exists", async () => {
      const inputPath = "/home/user/export.json";
      const mockOrcastratorDir = "/home/user/.orcastrator";
      const mockConfigPath = "/home/user/orcastrator.config.ts";
      const mockSnapshot = {
        version: 1,
        exportedAt: new Date().toISOString(),
        config: "export default { apiKey: 'test' }",
        state: {},
      };

      vi.mocked(loader.getOrcastratorDir).mockReturnValue(mockOrcastratorDir);
      vi.mocked(loader.getConfigPath).mockReturnValue(mockConfigPath);
      
      vi.mocked(existsSync).mockImplementation((path) => path === inputPath);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockSnapshot));
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(mkdirSync).mockImplementation(() => {});

      await importCommand(inputPath, {});

      expect(console.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("already exists")
      );
    });

    it("creates directories as needed for state files", async () => {
      const inputPath = "/home/user/export.json";
      const mockOrcastratorDir = "/home/user/.orcastrator";
      const mockSnapshot = {
        version: 1,
        exportedAt: new Date().toISOString(),
        config: null,
        state: {
          "subdir/nested/file.json": '{"data":{}}',
        },
      };

      vi.mocked(loader.getOrcastratorDir).mockReturnValue(mockOrcastratorDir);
      vi.mocked(loader.getConfigPath).mockReturnValue(null);
      
      vi.mocked(existsSync).mockImplementation((path) => path === inputPath);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockSnapshot));
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(mkdirSync).mockImplementation(() => {});

      await importCommand(inputPath, {});

      expect(mkdirSync).toHaveBeenCalledWith(
        "/home/user/.orcastrator/subdir/nested",
        { recursive: true }
      );
    });

    it("respects merge mode - skips existing files", async () => {
      const inputPath = "/home/user/export.json";
      const mockOrcastratorDir = "/home/user/.orcastrator";
      const mockSnapshot = {
        version: 1,
        exportedAt: new Date().toISOString(),
        config: null,
        state: {
          "state/tasks.json": '{"tasks":[]}',
          "state/cache.json": '{"cache":{}}',
        },
      };

      vi.mocked(loader.getOrcastratorDir).mockReturnValue(mockOrcastratorDir);
      vi.mocked(loader.getConfigPath).mockReturnValue(null);

      let existsCount = 0;
      vi.mocked(existsSync).mockImplementation((path) => {
        if (path === inputPath) return true;
        if (path?.toString().includes("tasks.json")) {
          existsCount++;
          return existsCount === 1; // Exists on first check
        }
        return false;
      });

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockSnapshot));
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(mkdirSync).mockImplementation(() => {});

      await importCommand(inputPath, { merge: true });

      // Check that console.log was called with a message containing "skipped"
      const logCalls = vi.mocked(console.log).mock.calls;
      const hasSkippedMessage = logCalls.some((call) =>
        call.some((arg) => typeof arg === "string" && arg.includes("skipped"))
      );
      expect(hasSkippedMessage).toBe(true);
    });

    it("restores config when none already exists", async () => {
      const inputPath = "/home/user/export.json";
      const mockOrcastratorDir = "/home/user/.orcastrator";
      const mockConfigContent = "export default { apiKey: 'test' }";
      const mockSnapshot = {
        version: 1,
        exportedAt: new Date().toISOString(),
        config: mockConfigContent,
        state: {},
      };

      vi.mocked(loader.getOrcastratorDir).mockReturnValue(mockOrcastratorDir);
      vi.mocked(loader.getConfigPath).mockReturnValue(null);
      
      vi.mocked(existsSync).mockImplementation((path) => path === inputPath);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockSnapshot));
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.mocked(mkdirSync).mockImplementation(() => {});

      await importCommand(inputPath, {});

      expect(console.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("orcastrator.config.ts")
      );
    });
  });
});
