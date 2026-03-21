import { daysSinceLastChange, commitsSinceLastChange } from "../../git.js";
import type { DriftIssue } from "../../types.js";

const WARN_DAYS = 30;
const ERROR_DAYS = 90;
const WARN_COMMITS = 50;
const ERROR_COMMITS = 200;

/** Check how stale a scaffold file is based on git history */
export async function checkStaleness(
  filePath: string,
  source: string,
  cwd: string
): Promise<DriftIssue[]> {
  const issues: DriftIssue[] = [];

  const days = await daysSinceLastChange(filePath, cwd);
  const commits = await commitsSinceLastChange(filePath, cwd);

  if (days !== null && days >= ERROR_DAYS) {
    issues.push({
      code: "STALE_FILE",
      severity: "error",
      file: source,
      line: null,
      message: `File hasn't been updated in ${days} days (threshold: ${ERROR_DAYS}d)`,
    });
  } else if (days !== null && days >= WARN_DAYS) {
    issues.push({
      code: "STALE_FILE",
      severity: "warning",
      file: source,
      line: null,
      message: `File hasn't been updated in ${days} days (threshold: ${WARN_DAYS}d)`,
    });
  }

  if (commits !== null && commits >= ERROR_COMMITS) {
    issues.push({
      code: "STALE_FILE",
      severity: "error",
      file: source,
      line: null,
      message: `${commits} commits since file was last updated (threshold: ${ERROR_COMMITS})`,
    });
  } else if (commits !== null && commits >= WARN_COMMITS) {
    issues.push({
      code: "STALE_FILE",
      severity: "warning",
      file: source,
      line: null,
      message: `${commits} commits since file was last updated (threshold: ${WARN_COMMITS})`,
    });
  }

  return issues;
}
