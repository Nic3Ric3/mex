import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { MexConfig } from "./types.js";

/**
 * Walk up from startDir looking for .git to find project root,
 * then look for scaffold root (.mex/ or context/ directory).
 */
export function findConfig(startDir?: string): MexConfig {
  const dir = startDir ?? process.cwd();
  const projectRoot = findProjectRoot(dir);
  if (!projectRoot) {
    throw new Error(
      `Not inside a git repository. Run mex from within a project.`
    );
  }

  const scaffoldRoot = findScaffoldRoot(projectRoot);
  if (!scaffoldRoot) {
    throw new Error(
      `No scaffold found. Expected .mex/ directory or context/ directory in ${projectRoot}`
    );
  }

  return { projectRoot, scaffoldRoot };
}

function findProjectRoot(dir: string): string | null {
  let current = resolve(dir);
  while (true) {
    if (existsSync(resolve(current, ".git"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function findScaffoldRoot(projectRoot: string): string | null {
  // Prefer .mex/ directory
  const mexDir = resolve(projectRoot, ".mex");
  if (existsSync(mexDir)) return mexDir;

  // Fall back to context/ directory (current mex layout)
  const contextDir = resolve(projectRoot, "context");
  if (existsSync(contextDir)) return projectRoot;

  return null;
}
