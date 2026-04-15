import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseSkillFrontmatter,
  matchSkills,
  loadSkillFiles,
  type SkillFile,
} from "../loader.js";

vi.mock("node:fs");
vi.mock("node:path", async () => {
  const actual = await vi.importActual<typeof import("node:path")>(
    "node:path"
  );
  return actual;
});

describe("parseSkillFrontmatter", () => {
  it("parses valid frontmatter with name, domain, triggers", () => {
    const content = `---
name: Generate Documentation
domain: code-generation
triggers: [docs, documentation, generate]
---

This is the body content.`;

    const { meta, body } = parseSkillFrontmatter(content);

    expect(meta.name).toBe("Generate Documentation");
    expect(meta.domain).toBe("code-generation");
    expect(meta.triggers).toEqual(["docs", "documentation", "generate"]);
    expect(body).toBe("This is the body content.");
  });

  it("handles triggers as YAML list (- item format)", () => {
    const content = `---
name: Test Skill
domain: testing
triggers:
  - unit test
  - integration test
  - e2e
---

Body text here.`;

    const { meta, body } = parseSkillFrontmatter(content);

    expect(meta.name).toBe("Test Skill");
    expect(meta.domain).toBe("testing");
    expect(meta.triggers).toEqual(["unit test", "integration test", "e2e"]);
    expect(body).toBe("Body text here.");
  });

  it("returns empty triggers for missing triggers field", () => {
    const content = `---
name: No Triggers Skill
domain: misc
---

Content without triggers.`;

    const { meta, body } = parseSkillFrontmatter(content);

    expect(meta.name).toBe("No Triggers Skill");
    expect(meta.domain).toBe("misc");
    expect(meta.triggers).toEqual([]);
    expect(body).toBe("Content without triggers.");
  });

  it("handles missing frontmatter delimiters gracefully", () => {
    const content = `name: Missing Delimiters
domain: test

Body without proper frontmatter`;

    expect(() => parseSkillFrontmatter(content)).toThrow(
      "Invalid SKILL.md: missing YAML frontmatter"
    );
  });

  it("extracts body content after frontmatter", () => {
    const bodyContent = `This is a multi-line body.
It contains multiple paragraphs.

And can have blank lines.`;

    const content = `---
name: Body Test
domain: test
triggers: []
---

${bodyContent}`;

    const { body } = parseSkillFrontmatter(content);

    expect(body).toBe(bodyContent);
  });

  it("handles Windows line endings (CRLF)", () => {
    const content = `---\r\nname: Windows Test\r\ndomain: test\r\ntriggers: []\r\n---\r\nWindows body content`;

    const { meta, body } = parseSkillFrontmatter(content);

    expect(meta.name).toBe("Windows Test");
    expect(body).toBe("Windows body content");
  });

  it("handles inline trigger list with spaces", () => {
    const content = `---
name: Inline Triggers
domain: test
triggers: [trigger one, trigger two, trigger three]
---

Body`;

    const { meta } = parseSkillFrontmatter(content);

    expect(meta.triggers).toEqual(["trigger one", "trigger two", "trigger three"]);
  });

  it("trims whitespace from frontmatter values", () => {
    const content = `---
name:    Spaced Name   
domain:   spaced-domain  
triggers: []
---

Body`;

    const { meta } = parseSkillFrontmatter(content);

    expect(meta.name).toBe("Spaced Name");
    expect(meta.domain).toBe("spaced-domain");
  });
});

describe("matchSkills", () => {
  const createSkill = (name: string, triggers: string[]): SkillFile => ({
    meta: { name, domain: "test", triggers },
    body: "Test body",
    path: `/path/to/${name}`,
  });

  it("matches skills whose triggers appear in task text (case insensitive)", () => {
    const skills = [
      createSkill("Skill A", ["auth", "authentication"]),
      createSkill("Skill B", ["database", "sql"]),
      createSkill("Skill C", ["api", "rest"]),
    ];

    const matches = matchSkills("I need help with AUTHENTICATION", skills);

    expect(matches).toHaveLength(1);
    expect(matches[0].meta.name).toBe("Skill A");
  });

  it("returns empty array when no triggers match", () => {
    const skills = [
      createSkill("Skill A", ["auth"]),
      createSkill("Skill B", ["database"]),
    ];

    const matches = matchSkills("I need help with networking", skills);

    expect(matches).toHaveLength(0);
  });

  it("uses word boundary matching (not substring)", () => {
    const skills = [createSkill("Skill A", ["test"])];

    // Should NOT match "test" within "protest"
    const noMatch = matchSkills("Can you protest this?", skills);
    expect(noMatch).toHaveLength(0);

    // Should match whole word "test"
    const match = matchSkills("Can you run a test?", skills);
    expect(match).toHaveLength(1);
  });

  it("returns multiple matching skills", () => {
    const skills = [
      createSkill("Skill A", ["auth", "security"]),
      createSkill("Skill B", ["auth", "tokens"]),
      createSkill("Skill C", ["logging"]),
    ];

    const matches = matchSkills("I need auth and security help", skills);

    expect(matches).toHaveLength(2);
    expect(matches.map((s) => s.meta.name)).toEqual(["Skill A", "Skill B"]);
  });

  it("handles multiple triggers in a single skill", () => {
    const skills = [
      createSkill("Multi Trigger", ["trigger1", "trigger2", "trigger3"]),
    ];

    const match1 = matchSkills("Use trigger1", skills);
    const match2 = matchSkills("Use trigger2", skills);
    const match3 = matchSkills("Use trigger3", skills);

    expect(match1).toHaveLength(1);
    expect(match2).toHaveLength(1);
    expect(match3).toHaveLength(1);
  });

  it("handles special regex characters in triggers", () => {
    const skills = [createSkill("Regex Skill", ["python", "javascript"])];

    const match1 = matchSkills("I want to learn python", skills);
    const match2 = matchSkills("I want to learn javascript", skills);

    expect(match1).toHaveLength(1);
    expect(match2).toHaveLength(1);
  });

  it("preserves skill data when matching", () => {
    const skill = createSkill("Full Skill", ["test"]);
    const matches = matchSkills("This is a test", [skill]);

    expect(matches[0]).toEqual(skill);
  });
});

describe("loadSkillFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when skills directory doesn't exist", async () => {
    const { default: fs } = await import("node:fs");
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const skills = loadSkillFiles("/some/orcastrator/dir");

    expect(skills).toEqual([]);
  });

  it("loads SKILL.md files from subdirectories", async () => {
    const { default: fs } = await import("node:fs");

    const mockMeta1 = {
      name: "Skill 1",
      domain: "domain1",
      triggers: ["trigger1"],
    };
    const mockMeta2 = {
      name: "Skill 2",
      domain: "domain2",
      triggers: ["trigger2"],
    };

    // Mock fs.existsSync to return true for skills dir and SKILL.md files
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      const str = p.toString();
      return (
        str.endsWith("skills") ||
        str.endsWith("SKILL.md")
      );
    });

    // Mock fs.readdirSync to return two skill directories
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "skill-1", isDirectory: () => true },
      { name: "skill-2", isDirectory: () => true },
    ] as any);

    // Mock fs.readFileSync to return different content for each skill
    let callCount = 0;
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      const meta = callCount === 0 ? mockMeta1 : mockMeta2;
      callCount++;
      return `---
name: ${meta.name}
domain: ${meta.domain}
triggers: [${meta.triggers.join(", ")}]
---

Body content for ${meta.name}`;
    });

    const skills = loadSkillFiles("/orcastrator");

    expect(skills).toHaveLength(2);
    expect(skills[0].meta.name).toBe("Skill 1");
    expect(skills[1].meta.name).toBe("Skill 2");
    expect(skills[0].body).toContain("Body content for Skill 1");
    expect(skills[1].body).toContain("Body content for Skill 2");
  });

  it("skips directories without SKILL.md", async () => {
    const { default: fs } = await import("node:fs");

    let firstCall = true;
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      const str = p.toString();
      // First call is checking if skills dir exists
      if (firstCall && str.endsWith("skills")) {
        firstCall = false;
        return true;
      }
      // Check individual SKILL.md files
      if (str.endsWith("skill-with-file/SKILL.md")) {
        return true;
      }
      if (str.endsWith("skill-no-file/SKILL.md")) {
        return false;
      }
      return false;
    });

    // Return one directory with SKILL.md and one without
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "skill-with-file", isDirectory: () => true },
      { name: "skill-no-file", isDirectory: () => true },
    ] as any);

    vi.mocked(fs.readFileSync).mockReturnValue(`---
name: Test Skill
domain: test
triggers: []
---

Body`);

    const skills = loadSkillFiles("/orcastrator");

    expect(skills).toHaveLength(1);
    expect(skills[0].meta.name).toBe("Test Skill");
  });

  it("skips non-directory entries", async () => {
    const { default: fs } = await import("node:fs");

    vi.mocked(fs.existsSync).mockReturnValue(true);

    // Return mixed entries: directories and files
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "skill-dir", isDirectory: () => true },
      { name: "readme.txt", isDirectory: () => false },
      { name: ".gitkeep", isDirectory: () => false },
    ] as any);

    vi.mocked(fs.readFileSync).mockReturnValue(`---
name: Valid Skill
domain: test
triggers: []
---

Body`);

    const skills = loadSkillFiles("/orcastrator");

    // Should only load the directory, not files
    expect(skills).toHaveLength(1);
  });

  it("skips malformed SKILL.md files", async () => {
    const { default: fs } = await import("node:fs");

    vi.mocked(fs.existsSync).mockReturnValue(true);

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "good-skill", isDirectory: () => true },
      { name: "bad-skill", isDirectory: () => true },
    ] as any);

    // First call returns valid SKILL.md, second returns malformed
    let callCount = 0;
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      if (callCount === 0) {
        callCount++;
        return `---
name: Good Skill
domain: test
triggers: []
---

Body`;
      }
      // Return invalid frontmatter
      return `No frontmatter here`;
    });

    const skills = loadSkillFiles("/orcastrator");

    // Should only load the valid one, skipping the malformed one
    expect(skills).toHaveLength(1);
    expect(skills[0].meta.name).toBe("Good Skill");
  });

  it("includes file paths in loaded skills", async () => {
    const { default: fs } = await import("node:fs");

    vi.mocked(fs.existsSync).mockReturnValue(true);

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "test-skill", isDirectory: () => true },
    ] as any);

    vi.mocked(fs.readFileSync).mockReturnValue(`---
name: Path Test
domain: test
triggers: []
---

Body`);

    const skills = loadSkillFiles("/orcastrator");

    expect(skills[0].path).toContain("SKILL.md");
    expect(skills[0].path).toContain("test-skill");
  });
});
