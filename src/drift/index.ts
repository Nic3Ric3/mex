import { readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { globSync } from "glob";
import type { MexConfig, DriftReport, DriftIssue, Claim } from "../types.js";
import { extractClaims } from "./claims.js";
import { parseFrontmatter } from "./frontmatter.js";
import { computeScore } from "./scoring.js";
import { checkPaths } from "./checkers/path.js";
import { checkEdges } from "./checkers/edges.js";
import { checkIndexSync } from "./checkers/index-sync.js";
import { checkStaleness } from "./checkers/staleness.js";
import { checkCommands } from "./checkers/command.js";
import { checkDependencies } from "./checkers/dependency.js";
import { checkCrossFile } from "./checkers/cross-file.js";

/** Run full drift detection across all scaffold files */
export async function runDriftCheck(config: MexConfig): Promise<DriftReport> {
  const { projectRoot, scaffoldRoot } = config;

  // Find all markdown files in scaffold
  const scaffoldFiles = findScaffoldFiles(projectRoot, scaffoldRoot);
  const allClaims: Claim[] = [];
  const allIssues: DriftIssue[] = [];

  // Extract claims from all files
  for (const filePath of scaffoldFiles) {
    const source = relative(projectRoot, filePath);
    const claims = extractClaims(filePath, source);
    allClaims.push(...claims);
  }

  // Run checkers that work on individual files
  for (const filePath of scaffoldFiles) {
    const source = relative(projectRoot, filePath);

    // Frontmatter edge check
    const frontmatter = parseFrontmatter(filePath);
    allIssues.push(
      ...checkEdges(frontmatter, filePath, source, projectRoot)
    );

    // Staleness check
    const stalenessIssues = await checkStaleness(source, source, projectRoot);
    allIssues.push(...stalenessIssues);
  }

  // Run checkers that work on claims
  allIssues.push(...checkPaths(allClaims, projectRoot));
  allIssues.push(...checkCommands(allClaims, projectRoot));
  allIssues.push(...checkDependencies(allClaims, projectRoot));
  allIssues.push(...checkCrossFile(allClaims));

  // Run structural checkers
  allIssues.push(...checkIndexSync(projectRoot));

  const score = computeScore(allIssues);

  return {
    score,
    issues: allIssues,
    filesChecked: scaffoldFiles.length,
    timestamp: new Date().toISOString(),
  };
}

/** Find all markdown files that are part of the scaffold */
function findScaffoldFiles(
  projectRoot: string,
  scaffoldRoot: string
): string[] {
  const patterns = [
    "context/*.md",
    "patterns/*.md",
    "ROUTER.md",
    "AGENTS.md",
    "CLAUDE.md",
    "SETUP.md",
    "SYNC.md",
  ];

  // If scaffold root is .mex/, search inside it
  if (scaffoldRoot !== projectRoot) {
    patterns.push(".mex/**/*.md");
  }

  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = globSync(pattern, { cwd: projectRoot, absolute: true });
    files.push(...matches);
  }

  // Deduplicate
  return [...new Set(files)];
}
