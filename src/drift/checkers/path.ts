import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Claim, DriftIssue } from "../../types.js";

/** Check that all claimed paths exist on disk */
export function checkPaths(
  claims: Claim[],
  projectRoot: string
): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const pathClaims = claims.filter(
    (c) => c.kind === "path" && !c.negated
  );

  for (const claim of pathClaims) {
    if (pathExists(claim.value, projectRoot)) continue;

    issues.push({
      code: "MISSING_PATH",
      severity: "error",
      file: claim.source,
      line: claim.line,
      message: `Referenced path does not exist: ${claim.value}`,
      claim,
    });
  }

  return issues;
}

function pathExists(value: string, projectRoot: string): boolean {
  // Direct resolution
  if (existsSync(resolve(projectRoot, value))) return true;

  // If path starts with .mex/, also check without that prefix
  // (handles the case where this repo IS the scaffold, not deployed inside .mex/)
  if (value.startsWith(".mex/")) {
    const withoutPrefix = value.slice(".mex/".length);
    if (existsSync(resolve(projectRoot, withoutPrefix))) return true;
  }

  return false;
}
