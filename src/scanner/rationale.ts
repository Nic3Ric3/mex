import { globSync } from "glob";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RationaleComment, RationaleKind } from "../types.js";

const RATIONALE_PATTERNS: Array<{ prefix: RegExp; kind: RationaleKind }> = [
  { prefix: /\/\/\s*NOTE:/i, kind: "NOTE" },
  { prefix: /\/\/\s*TODO:/i, kind: "TODO" },
  { prefix: /\/\/\s*HACK:/i, kind: "HACK" },
  { prefix: /\/\/\s*IMPORTANT:/i, kind: "IMPORTANT" },
  { prefix: /\/\/\s*FIXME:/i, kind: "FIXME" },
  { prefix: /\/\/\s*WHY:/i, kind: "WHY" },
  { prefix: /\/\/\s*REASON:/i, kind: "REASON" },
  { prefix: /\/\/\s*DECISION:/i, kind: "DECISION" },
  // Block comment variants: /* NOTE: ... */ or * NOTE: (inside JSDoc)
  { prefix: /\/\*\s*NOTE:/i, kind: "NOTE" },
  { prefix: /\/\*\s*HACK:/i, kind: "HACK" },
  { prefix: /\/\*\s*IMPORTANT:/i, kind: "IMPORTANT" },
  { prefix: /\/\*\s*WHY:/i, kind: "WHY" },
  { prefix: /\/\*\s*DECISION:/i, kind: "DECISION" },
  { prefix: /^\s*\*\s*NOTE:/i, kind: "NOTE" },
  { prefix: /^\s*\*\s*HACK:/i, kind: "HACK" },
  { prefix: /^\s*\*\s*IMPORTANT:/i, kind: "IMPORTANT" },
  { prefix: /^\s*\*\s*WHY:/i, kind: "WHY" },
  { prefix: /^\s*\*\s*DECISION:/i, kind: "DECISION" },
];

/** Extract the comment text after the prefix tag */
function extractCommentText(line: string, kind: RationaleKind): string {
  // Find the KIND: part and take everything after it
  const re = new RegExp(`${kind}:\\s*`, "i");
  const match = line.match(re);
  if (!match) return line.trim();

  const idx = line.indexOf(match[0]) + match[0].length;
  let text = line.slice(idx).replace(/\*\/\s*$/, "").trim();
  if (text.length > 200) text = text.slice(0, 200);
  return text;
}

/** Scan all JS/TS files for rationale comments */
export function scanRationale(projectRoot: string): RationaleComment[] {
  const files = globSync("**/*.{ts,tsx,js,jsx}", {
    cwd: projectRoot,
    ignore: [
      "node_modules/**",
      "**/node_modules/**",
      "dist/**",
      "build/**",
      ".git/**",
      ".mex/**",
      ".next/**",
      ".nuxt/**",
      ".cache/**",
      ".turbo/**",
      ".vercel/**",
      ".output/**",
      "coverage/**",
      "__pycache__/**",
      ".venv/**",
      "venv/**",
      "vendor/**",
      "**/*.d.ts",
      "**/*.test.*",
      "**/*.spec.*",
      "test/**",
      "tests/**",
      "__tests__/**",
    ],
    absolute: false,
    maxDepth: 10,
  });

  const results: RationaleComment[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(resolve(projectRoot, file), "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      for (const { prefix, kind } of RATIONALE_PATTERNS) {
        if (prefix.test(line)) {
          const comment = extractCommentText(line, kind);
          if (comment) {
            results.push({ file, line: i + 1, comment, kind });
          }
          break; // one match per line
        }
      }
    }
  }

  return results;
}
