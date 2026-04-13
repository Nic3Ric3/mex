import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { MexConfig, AiTool } from "./types.js";

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

  const mexDir = resolve(projectRoot, ".mex");
  if (existsSync(mexDir) && !existsSync(resolve(mexDir, "ROUTER.md"))) {
    throw new Error("Scaffold directory exists but looks incomplete. Run: mex setup");
  }

  const scaffoldRoot = findScaffoldRoot(projectRoot);
  if (!scaffoldRoot) {
    if (!gitRoot) {
      throw new Error("No git repository found. Initialize one first: git init");
    }

    throw new Error(
      "No .mex/ scaffold found. Run: mex setup"
    );
  }

  const aiTools = loadAiTools(scaffoldRoot);
  return { projectRoot, scaffoldRoot, aiTools };
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

// ── AI Tool persistence ──

const CONFIG_FILE = "config.json";

interface MexPersistedConfig {
  aiTools?: AiTool[];
}

function loadAiTools(scaffoldRoot: string): AiTool[] {
  const configPath = resolve(scaffoldRoot, CONFIG_FILE);
  if (!existsSync(configPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8")) as MexPersistedConfig;
    return Array.isArray(raw.aiTools) ? raw.aiTools : [];
  } catch {
    return [];
  }
}

export function saveAiTools(scaffoldRoot: string, tools: AiTool[]): void {
  const configPath = resolve(scaffoldRoot, CONFIG_FILE);
  let existing: MexPersistedConfig = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, "utf-8")) as MexPersistedConfig;
    } catch { /* start fresh */ }
  }
  existing.aiTools = tools;
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(existing, null, 2) + "\n");
}

function findScaffoldRoot(projectRoot: string): string | null {
  // Prefer .mex/ directory
  const mexDir = resolve(projectRoot, ".mex");
  if (existsSync(mexDir)) {
    return mexDir;
  }

  // Fall back to context/ directory (current mex layout)
  const contextDir = resolve(projectRoot, "context");
  if (existsSync(contextDir)) return projectRoot;

  return null;
}
