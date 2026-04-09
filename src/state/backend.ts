// State backend — filesystem read/write for .orcastrator/

import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join, dirname } from "node:path";

export function readState(
  orcastratorDir: string,
  relativePath: string,
): string | null {
  const fullPath = join(orcastratorDir, relativePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, "utf-8");
}

export function writeState(
  orcastratorDir: string,
  relativePath: string,
  content: string,
): void {
  const fullPath = join(orcastratorDir, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

export function appendState(
  orcastratorDir: string,
  relativePath: string,
  content: string,
): void {
  const fullPath = join(orcastratorDir, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  appendFileSync(fullPath, content, "utf-8");
}

export function stateExists(
  orcastratorDir: string,
  relativePath: string,
): boolean {
  return existsSync(join(orcastratorDir, relativePath));
}

export function listState(
  orcastratorDir: string,
  relativeDir: string,
): string[] {
  const fullPath = join(orcastratorDir, relativeDir);
  if (!existsSync(fullPath)) return [];
  return readdirSync(fullPath);
}
