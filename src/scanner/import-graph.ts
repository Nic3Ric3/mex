import { globSync } from "glob";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative, extname } from "node:path";
import type { ImportGraph, ImportEdge } from "../types.js";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const RESOLUTION_ORDER = [".ts", ".tsx", ".js", ".jsx"];
const INDEX_RESOLUTION = [
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
];

// Matches: import ... from './path'  |  export ... from './path'
const STATIC_IMPORT_RE =
  /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;

// Matches: import('./path')
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

// Matches: require('./path')
const REQUIRE_RE = /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

/** Collect all JS/TS source files in the project */
function collectSourceFiles(projectRoot: string): string[] {
  return globSync("**/*.{ts,tsx,js,jsx}", {
    cwd: projectRoot,
    ignore: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".git/**",
      ".mex/**",
      "**/*.d.ts",
    ],
    absolute: false,
  });
}

/** Try to resolve a relative import specifier to an actual project file */
function resolveImport(
  specifier: string,
  importerAbsolute: string,
  projectRoot: string
): string | null {
  const importerDir = dirname(importerAbsolute);
  const base = resolve(importerDir, specifier);

  // If specifier already has an extension, try it directly
  if (extname(specifier)) {
    if (existsSync(base)) return relative(projectRoot, base);
    // TypeScript ESM convention: imports use .js but actual files are .ts
    const ext = extname(specifier);
    const TS_REMAP: Record<string, string[]> = {
      ".js": [".ts", ".tsx"],
      ".jsx": [".tsx"],
    };
    const remaps = TS_REMAP[ext];
    if (remaps) {
      const withoutExt = base.slice(0, -ext.length);
      for (const remap of remaps) {
        const candidate = withoutExt + remap;
        if (existsSync(candidate)) return relative(projectRoot, candidate);
      }
    }
    return null;
  }

  // Try extension fallback
  for (const ext of RESOLUTION_ORDER) {
    const candidate = base + ext;
    if (existsSync(candidate)) return relative(projectRoot, candidate);
  }

  // Try as directory with index file
  for (const idx of INDEX_RESOLUTION) {
    const candidate = base + idx;
    if (existsSync(candidate)) return relative(projectRoot, candidate);
  }

  return null;
}

/** Extract all relative import specifiers from file content */
function extractImportSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  const regexes = [STATIC_IMPORT_RE, DYNAMIC_IMPORT_RE, REQUIRE_RE];

  for (const re of regexes) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      const spec = match[1];
      // Only relative imports (starts with . or ..)
      if (spec.startsWith(".")) {
        specifiers.push(spec);
      }
    }
  }

  return specifiers;
}

/** Scan the project and build an import graph */
export function scanImportGraph(projectRoot: string): ImportGraph | null {
  const files = collectSourceFiles(projectRoot);
  if (files.length === 0) return null;

  const edges: ImportEdge[] = [];
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  // Initialize all files with zero degrees
  for (const file of files) {
    inDegree.set(file, 0);
    outDegree.set(file, 0);
  }

  // Parse imports and build edges
  for (const file of files) {
    const absolutePath = resolve(projectRoot, file);
    let content: string;
    try {
      content = readFileSync(absolutePath, "utf-8");
    } catch {
      continue;
    }

    const specifiers = extractImportSpecifiers(content);
    const seen = new Set<string>();

    for (const spec of specifiers) {
      const resolved = resolveImport(spec, absolutePath, projectRoot);
      if (!resolved || resolved === file || seen.has(resolved)) continue;
      seen.add(resolved);

      // Only add edge if target is a known project file
      if (inDegree.has(resolved)) {
        edges.push({ from: file, to: resolved, kind: "EXTRACTED" });
        inDegree.set(resolved, (inDegree.get(resolved) ?? 0) + 1);
        outDegree.set(file, (outDegree.get(file) ?? 0) + 1);
      }
    }
  }

  // God nodes: top files by in-degree, minimum 2
  const godNodes = [...inDegree.entries()]
    .filter(([, deg]) => deg >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file]) => file);

  // Leaf nodes: not imported by anything, but imports at least one file
  const leafNodes = [...inDegree.entries()]
    .filter(([file, deg]) => deg === 0 && (outDegree.get(file) ?? 0) > 0)
    .map(([file]) => file);

  return { godNodes, leafNodes, edges };
}
