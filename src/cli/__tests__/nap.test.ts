import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatBytes,
  truncateHistory,
  pruneOldLogs,
  napCommand,
} from "../nap.js";

// Mock modules
vi.mock("node:fs");
vi.mock("node:path");
vi.mock("../../config/loader.js");
vi.mock("chalk", () => ({
  default: {
    yellow: (s: string) => s,
    bold: (s: string) => s,
    green: () => "✓",
    dim: (s: string) => s,
  },
}));

import * as fs from "node:fs";
import * as path from "node:path";
import * as loader from "../../config/loader.js";

describe("nap command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("formatBytes", () => {
    it("formats bytes correctly", () => {
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(1023)).toBe("1023 B");
    });

    it("converts to KB for values >= 1024", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(2048)).toBe("2.0 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
    });

    it("converts to MB for values >= 1MB", () => {
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
      expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
    });

    it("handles edge cases", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(1)).toBe("1 B");
    });
  });

  describe("truncateHistory", () => {
    beforeEach(() => {
      vi.mocked(fs.readFileSync).mockClear();
      vi.mocked(fs.writeFileSync).mockClear();
    });

    it("returns 0 bytes saved when history has fewer entries than keep", () => {
      const content = "## Entry 1\nSome content\n## Entry 2\nMore content\n";
      vi.mocked(fs.readFileSync).mockReturnValue(content);

      const saved = truncateHistory("/path/to/history.md", 5, false);

      expect(saved).toBe(0);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("truncates history and returns bytes saved", () => {
      const content =
        "## Entry 1\nOld content A\n## Entry 2\nOld content B\n## Entry 3\nNew content\n";
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const saved = truncateHistory("/path/to/history.md", 1, false);

      expect(saved).toBeGreaterThan(0);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "/path/to/history.md",
        expect.stringContaining("Entry 3"),
        "utf-8"
      );
    });

    it("truncates history with dash entries", () => {
      const content = "- Item 1\nDetails\n- Item 2\nDetails\n- Item 3\nDetails\n";
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const saved = truncateHistory("/path/to/history.md", 1, false);

      expect(saved).toBeGreaterThan(0);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("does not modify file with dry-run enabled", () => {
      const content =
        "## Entry 1\nOld\n## Entry 2\nOld\n## Entry 3\nNew\n";
      vi.mocked(fs.readFileSync).mockReturnValue(content);

      const saved = truncateHistory("/path/to/history.md", 1, true);

      expect(saved).toBeGreaterThan(0);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("handles empty history file", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("");

      const saved = truncateHistory("/path/to/history.md", 5, false);

      expect(saved).toBe(0);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("handles history file with no entry markers", () => {
      const content = "Just some plain text\nwith no entries\n";
      vi.mocked(fs.readFileSync).mockReturnValue(content);

      const saved = truncateHistory("/path/to/history.md", 5, false);

      expect(saved).toBe(0);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe("pruneOldLogs", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockClear();
      vi.mocked(fs.readdirSync).mockClear();
      vi.mocked(fs.statSync).mockClear();
      vi.mocked(fs.unlinkSync).mockClear();
      vi.mocked(path.join).mockImplementation((...args) => args.join("/"));
    });

    it("returns 0 when log directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const saved = pruneOldLogs("/nonexistent", 30, false);

      expect(saved).toBe(0);
      expect(fs.readdirSync).not.toHaveBeenCalled();
    });

    it("removes files older than maxAgeDays", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["old.json", "new.json"] as any);

      const now = Date.now();
      const oldTime = now - 40 * 24 * 60 * 60 * 1000; // 40 days ago
      const newTime = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      vi.mocked(fs.statSync).mockImplementation((filePath) => {
        if (typeof filePath === "string" && filePath.includes("old.json")) {
          return { mtimeMs: oldTime, size: 1024 } as any;
        }
        return { mtimeMs: newTime, size: 2048 } as any;
      });

      const saved = pruneOldLogs("/log", 30, false);

      expect(saved).toBe(1024);
      expect(fs.unlinkSync).toHaveBeenCalledWith("/log/old.json");
      expect(fs.unlinkSync).not.toHaveBeenCalledWith("/log/new.json");
    });

    it("does not delete files with dry-run enabled", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["old.json"] as any);

      const now = Date.now();
      const oldTime = now - 40 * 24 * 60 * 60 * 1000;

      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: oldTime,
        size: 2048,
      } as any);

      const saved = pruneOldLogs("/log", 30, true);

      expect(saved).toBe(2048);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it("only prunes .json files", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "old.json",
        "old.txt",
        "old.log",
      ] as any);

      const now = Date.now();
      const oldTime = now - 40 * 24 * 60 * 60 * 1000;

      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: oldTime,
        size: 1024,
      } as any);

      const saved = pruneOldLogs("/log", 30, false);

      expect(saved).toBe(1024);
      expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
      expect(fs.unlinkSync).toHaveBeenCalledWith("/log/old.json");
    });

    it("handles empty log directory", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const saved = pruneOldLogs("/log", 30, false);

      expect(saved).toBe(0);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it("handles directory with only recent files", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["recent1.json", "recent2.json"] as any);

      const now = Date.now();
      const recentTime = now - 5 * 24 * 60 * 60 * 1000;

      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: recentTime,
        size: 1024,
      } as any);

      const saved = pruneOldLogs("/log", 30, false);

      expect(saved).toBe(0);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe("napCommand", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(path.join).mockImplementation((...args) => args.join("/"));
    });

    afterEach(() => {
      vi.mocked(console.log).mockRestore();
    });

    it("handles missing .orcastrator directory gracefully", async () => {
      vi.mocked(loader.getOrcastratorDir).mockReturnValue(
        "/home/.orcastrator"
      );
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await napCommand({});

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("No .orcastrator/")
      );
    });

    it("reports nothing to clean up when no files to process", async () => {
      vi.mocked(loader.getOrcastratorDir).mockReturnValue(
        "/home/.orcastrator"
      );

      let callCount = 0;
      vi.mocked(fs.existsSync).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return true; // orcastratorDir exists
        return false; // agentsDir and logDir don't exist
      });

      vi.mocked(fs.readdirSync).mockReturnValue([]);

      await napCommand({});

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Nothing to clean up")
      );
    });

    it("shows dry-run message in header when dry-run is enabled", async () => {
      vi.mocked(loader.getOrcastratorDir).mockReturnValue(
        "/home/.orcastrator"
      );

      let callCount = 0;
      vi.mocked(fs.existsSync).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return true;
        return false;
      });

      vi.mocked(fs.readdirSync).mockReturnValue([]);

      await napCommand({ dryRun: true });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("--dry-run")
      );
    });

    it("processes multiple agents history files", async () => {
      vi.mocked(loader.getOrcastratorDir).mockReturnValue(
        "/home/.orcastrator"
      );

      let existsCallCount = 0;
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        // First call: orcastratorDir
        // Second call: agentsDir
        // Third+ calls: history files and logDir
        existsCallCount++;
        if (existsCallCount <= 2) return true;
        if (typeof filePath === "string" && filePath.includes("history.md")) {
          return true;
        }
        return false;
      });

      vi.mocked(fs.readdirSync).mockImplementation((dirPath) => {
        if (typeof dirPath === "string" && dirPath.includes("agents")) {
          return [
            { name: "agent1", isDirectory: () => true },
            { name: "agent2", isDirectory: () => true },
          ] as any;
        }
        return [];
      });

      vi.mocked(fs.readFileSync).mockReturnValue(
        "## Entry 1\nOld\n## Entry 2\nOld\n## Entry 3\nNew\n"
      );
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      await napCommand({ keep: "1" });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Truncated")
      );
    });

    it("accepts keep parameter as string and parses it", async () => {
      vi.mocked(loader.getOrcastratorDir).mockReturnValue(
        "/home/.orcastrator"
      );

      let existsCallCount = 0;
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        existsCallCount++;
        if (existsCallCount <= 2) return true;
        if (typeof filePath === "string" && filePath.includes("history.md")) {
          return true;
        }
        return false;
      });

      vi.mocked(fs.readdirSync).mockImplementation((dirPath) => {
        if (typeof dirPath === "string" && dirPath.includes("agents")) {
          return [{ name: "agent1", isDirectory: () => true }] as any;
        }
        return [];
      });

      const historyContent = Array(15)
        .fill(null)
        .map((_, i) => `## Entry ${i + 1}\nContent\n`)
        .join("");

      vi.mocked(fs.readFileSync).mockReturnValue(historyContent);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      await napCommand({ keep: "5" });

      expect(console.log).toHaveBeenCalled();
    });

    it("defaults to keep=20 when not specified", async () => {
      vi.mocked(loader.getOrcastratorDir).mockReturnValue(
        "/home/.orcastrator"
      );

      let existsCallCount = 0;
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        existsCallCount++;
        if (existsCallCount <= 2) return true;
        return false;
      });

      vi.mocked(fs.readdirSync).mockReturnValue([]);

      await napCommand({});

      expect(console.log).toHaveBeenCalled();
    });

    it("displays total bytes saved", async () => {
      vi.mocked(loader.getOrcastratorDir).mockReturnValue(
        "/home/.orcastrator"
      );

      let existsCallCount = 0;
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        existsCallCount++;
        if (existsCallCount <= 2) return true;
        if (typeof filePath === "string" && filePath.includes("history.md")) {
          return true;
        }
        if (typeof filePath === "string" && filePath.includes("log")) {
          return true;
        }
        return false;
      });

      vi.mocked(fs.readdirSync).mockImplementation((dirPath) => {
        if (typeof dirPath === "string" && dirPath.includes("agents")) {
          return [{ name: "agent1", isDirectory: () => true }] as any;
        }
        if (typeof dirPath === "string" && dirPath.includes("log")) {
          return ["old.json"];
        }
        return [];
      });

      const now = Date.now();
      const oldTime = now - 40 * 24 * 60 * 60 * 1000;

      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: oldTime,
        size: 2048,
      } as any);

      vi.mocked(fs.readFileSync).mockReturnValue(
        "## Entry 1\nOld\n## Entry 2\nNew\n"
      );
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      await napCommand({});

      const consoleCalls = vi.mocked(console.log).mock.calls;
      const hasTotal = consoleCalls.some((call) =>
        call[0]?.toString().includes("Total")
      );
      expect(hasTotal).toBe(true);
    });
  });
});
