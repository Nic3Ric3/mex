import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { MexConfig } from "./types.js";

/**
 * Walk up from startDir looking for .git to find project root,
 * then look for scaffold root (.mex/ or context/ directory).
 */
export function findConfig(startDir?: string): MexConfig {
  const dir = startDir ?? process.cwd();

  if (dir.split(/[\\/]/).includes(".mex")) {
    throw new Error(
      "You're inside the .mex/ directory. Run mex commands from your project root instead."
    );
  }

  // Try git root first, fall back to cwd if no git repo
  const gitRoot = findProjectRoot(dir);
  const projectRoot = gitRoot ?? dir;

  const scaffoldRoot = findScaffoldRoot(projectRoot);
  if (!scaffoldRoot) {
    if (!gitRoot) {
      throw new Error("No git repository found. Initialize one first: git init");
    }

    const mexDir = resolve(projectRoot, ".mex");
    if (existsSync(mexDir)) {
      throw new Error("Scaffold directory exists but looks incomplete. Run: bash .mex/setup.sh");
    }

    throw new Error(
      "No .mex/ scaffold found. Run: git clone https://github.com/theDakshJaitly/mex.git .mex && bash .mex/setup.sh"
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
  // Check if .mex exists and has the required setup file to consider it complete
  if (existsSync(mexDir) && existsSync(resolve(mexDir, "setup.sh"))) {
    return mexDir;
  }

  // Fall back to context/ directory (current mex layout)
  const contextDir = resolve(projectRoot, "context");
  if (existsSync(contextDir)) return projectRoot;

  return null;
}
