// Repo scanner — gathers context about the current repository for Copilot-powered init

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname, basename, relative } from "node:path";

export interface RepoContext {
  projectName: string;
  fileTree: string[];
  extensionCounts: Record<string, number>;
  languages: string[];
  configFiles: ConfigFileInfo[];
  readmeExcerpt: string | null;
  frameworkHints: string[];
}

export interface ConfigFileInfo {
  path: string;
  content: string;
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vercel",
  ".cache",
  "coverage",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  "target",
  "vendor",
  ".orcastrator",
  ".orcastrator-worktrees",
]);

const CONFIG_FILES = new Set([
  "package.json",
  "tsconfig.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "composer.json",
  "Makefile",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".eslintrc.json",
  ".prettierrc",
  "vitest.config.ts",
  "jest.config.ts",
  "jest.config.js",
  "tailwind.config.ts",
  "tailwind.config.js",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "vite.config.ts",
  "vite.config.js",
  "astro.config.mjs",
  "nuxt.config.ts",
  "angular.json",
  "remix.config.js",
  "svelte.config.js",
  "turbo.json",
  "lerna.json",
  "nx.json",
]);

const EXT_TO_LANGUAGE: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript (React)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (React)",
  ".py": "Python",
  ".rs": "Rust",
  ".go": "Go",
  ".java": "Java",
  ".kt": "Kotlin",
  ".rb": "Ruby",
  ".cs": "C#",
  ".cpp": "C++",
  ".c": "C",
  ".swift": "Swift",
  ".php": "PHP",
  ".dart": "Dart",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".hs": "Haskell",
  ".scala": "Scala",
  ".vue": "Vue",
  ".svelte": "Svelte",
};

const MAX_DEPTH = 4;
const MAX_FILES = 500;
const MAX_CONFIG_SIZE = 2000;
const MAX_README_LINES = 100;
const MAX_CONTEXT_CHARS = 4000;

export function scanRepo(cwd: string): RepoContext {
  const projectName = basename(cwd);
  const fileTree: string[] = [];
  const extensionCounts: Record<string, number> = {};
  const configFiles: ConfigFileInfo[] = [];

  walkDir(cwd, cwd, 0, fileTree, extensionCounts, configFiles);

  const languages = deriveLanguages(extensionCounts);
  const readmeExcerpt = readReadme(cwd);
  const frameworkHints = detectFrameworks(configFiles);

  return {
    projectName,
    fileTree,
    extensionCounts,
    languages,
    configFiles,
    readmeExcerpt,
    frameworkHints,
  };
}

function walkDir(
  root: string,
  dir: string,
  depth: number,
  fileTree: string[],
  extensionCounts: Record<string, number>,
  configFiles: ConfigFileInfo[],
): void {
  if (depth > MAX_DEPTH || fileTree.length >= MAX_FILES) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (fileTree.length >= MAX_FILES) break;
    if (entry.startsWith(".") && entry !== ".github") continue;

    const fullPath = join(dir, entry);
    const relPath = relative(root, fullPath);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      fileTree.push(relPath + "/");
      walkDir(root, fullPath, depth + 1, fileTree, extensionCounts, configFiles);
    } else {
      fileTree.push(relPath);
      const ext = extname(entry).toLowerCase();
      if (ext) {
        extensionCounts[ext] = (extensionCounts[ext] ?? 0) + 1;
      }

      if (CONFIG_FILES.has(entry)) {
        try {
          const raw = readFileSync(fullPath, "utf-8");
          configFiles.push({
            path: relPath,
            content: raw.slice(0, MAX_CONFIG_SIZE),
          });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }
}

function deriveLanguages(extensionCounts: Record<string, number>): string[] {
  const seen = new Set<string>();
  const result: [string, number][] = [];

  for (const [ext, count] of Object.entries(extensionCounts)) {
    const lang = EXT_TO_LANGUAGE[ext];
    if (lang && !seen.has(lang)) {
      seen.add(lang);
      result.push([lang, count]);
    }
  }

  return result
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
}

function readReadme(cwd: string): string | null {
  const names = ["README.md", "readme.md", "README.MD", "Readme.md"];
  for (const name of names) {
    const p = join(cwd, name);
    if (existsSync(p)) {
      try {
        const lines = readFileSync(p, "utf-8").split("\n");
        return lines.slice(0, MAX_README_LINES).join("\n");
      } catch {
        return null;
      }
    }
  }
  return null;
}

function detectFrameworks(configFiles: ConfigFileInfo[]): string[] {
  const hints: string[] = [];
  for (const cf of configFiles) {
    const name = basename(cf.path);
    if (name === "package.json") {
      try {
        const pkg = JSON.parse(cf.content);
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };
        const depNames = Object.keys(allDeps);
        const checks: [string, string][] = [
          ["next", "Next.js"],
          ["react", "React"],
          ["vue", "Vue"],
          ["@angular/core", "Angular"],
          ["svelte", "Svelte"],
          ["astro", "Astro"],
          ["express", "Express"],
          ["fastify", "Fastify"],
          ["hono", "Hono"],
          ["@nestjs/core", "NestJS"],
          ["nuxt", "Nuxt"],
          ["remix", "Remix"],
          ["tailwindcss", "Tailwind CSS"],
          ["prisma", "Prisma"],
          ["drizzle-orm", "Drizzle ORM"],
          ["vitest", "Vitest"],
          ["jest", "Jest"],
          ["playwright", "Playwright"],
          ["cypress", "Cypress"],
          ["electron", "Electron"],
          ["react-native", "React Native"],
          ["expo", "Expo"],
          ["three", "Three.js"],
        ];
        for (const [dep, label] of checks) {
          if (depNames.includes(dep)) hints.push(label);
        }
      } catch {
        // Invalid JSON, skip
      }
    }
    if (name === "Cargo.toml" && cf.content.includes("actix")) hints.push("Actix Web");
    if (name === "Cargo.toml" && cf.content.includes("axum")) hints.push("Axum");
    if (name === "Cargo.toml" && cf.content.includes("tokio")) hints.push("Tokio");
    if (name === "go.mod" && cf.content.includes("gin-gonic")) hints.push("Gin");
    if (name === "go.mod" && cf.content.includes("gofiber")) hints.push("Fiber");
    if (name === "pyproject.toml" && cf.content.includes("django")) hints.push("Django");
    if (name === "pyproject.toml" && cf.content.includes("fastapi")) hints.push("FastAPI");
    if (name === "pyproject.toml" && cf.content.includes("flask")) hints.push("Flask");
    if (name === "Gemfile" && cf.content.includes("rails")) hints.push("Ruby on Rails");
    if (name.startsWith("docker-compose")) hints.push("Docker Compose");
    if (name === "Dockerfile") hints.push("Docker");
    if (name === "turbo.json") hints.push("Turborepo");
    if (name === "nx.json") hints.push("Nx");
    if (name === "lerna.json") hints.push("Lerna");
  }

  return [...new Set(hints)];
}

export function summarizeContext(ctx: RepoContext): string {
  const parts: string[] = [];

  parts.push(`Project: ${ctx.projectName}`);

  if (ctx.languages.length > 0) {
    parts.push(`Languages: ${ctx.languages.join(", ")}`);
  }

  if (ctx.frameworkHints.length > 0) {
    parts.push(`Frameworks/Tools: ${ctx.frameworkHints.join(", ")}`);
  }

  if (ctx.readmeExcerpt) {
    const firstParagraph = ctx.readmeExcerpt
      .split("\n\n")
      .find((p) => p.trim() && !p.startsWith("#"));
    if (firstParagraph) {
      parts.push(`Description: ${firstParagraph.trim().slice(0, 200)}`);
    }
  }

  return parts.join("\n");
}

export function contextToPromptPayload(ctx: RepoContext): string {
  const sections: string[] = [];

  sections.push(`## Project: ${ctx.projectName}`);

  if (ctx.languages.length > 0) {
    sections.push(`## Languages\n${ctx.languages.join(", ")}`);
  }

  if (ctx.frameworkHints.length > 0) {
    sections.push(`## Frameworks & Tools\n${ctx.frameworkHints.join(", ")}`);
  }

  const topExts = Object.entries(ctx.extensionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([ext, count]) => `${ext}: ${count}`)
    .join(", ");
  if (topExts) {
    sections.push(`## File Extensions\n${topExts}`);
  }

  const treeSlice = ctx.fileTree.slice(0, 80).join("\n");
  if (treeSlice) {
    sections.push(`## File Tree (partial)\n${treeSlice}`);
  }

  for (const cf of ctx.configFiles.slice(0, 5)) {
    sections.push(`## ${cf.path}\n\`\`\`\n${cf.content}\n\`\`\``);
  }

  if (ctx.readmeExcerpt) {
    sections.push(`## README (excerpt)\n${ctx.readmeExcerpt}`);
  }

  let payload = sections.join("\n\n");
  if (payload.length > MAX_CONTEXT_CHARS) {
    payload = payload.slice(0, MAX_CONTEXT_CHARS) + "\n...(truncated)";
  }

  return payload;
}
