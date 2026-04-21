import { daysSinceLastChange, commitsSinceLastChange } from "../../git.js";
import type { DriftIssue, Severity } from "../../types.js";

const WARN_DAYS = 30;
const ERROR_DAYS = 90;
const WARN_COMMITS = 50;
const ERROR_COMMITS = 200;

type StaleSignal = { severity: Severity; message: string };

function daysSignal(days: number): StaleSignal | null {
  if (days >= ERROR_DAYS) {
    return {
      severity: "error",
      message: `File hasn't been updated in ${days} days (threshold: ${ERROR_DAYS}d)`,
    };
  }
  if (days >= WARN_DAYS) {
    return {
      severity: "warning",
      message: `File hasn't been updated in ${days} days (threshold: ${WARN_DAYS}d)`,
    };
  }
  return null;
}

function commitsSignal(commits: number): StaleSignal | null {
  if (commits >= ERROR_COMMITS) {
    return {
      severity: "error",
      message: `${commits} commits since file was last updated (threshold: ${ERROR_COMMITS})`,
    };
  }
  if (commits >= WARN_COMMITS) {
    return {
      severity: "warning",
      message: `${commits} commits since file was last updated (threshold: ${WARN_COMMITS})`,
    };
  }
  return null;
}

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

/**
 * Check how stale a scaffold file is based on git history.
 *
 * When both the day threshold and the commit threshold are exceeded, this
 * returns a single combined issue at the higher of the two severities —
 * two STALE_FILE issues on the same file are the same underlying condition
 * and should cost the score once, not twice.
 */
export async function checkStaleness(
  filePath: string,
  source: string,
  cwd: string
): Promise<DriftIssue[]> {
  const days = await daysSinceLastChange(filePath, cwd);
  const commits = await commitsSinceLastChange(filePath, cwd);

  const signals: StaleSignal[] = [];
  if (days !== null) {
    const s = daysSignal(days);
    if (s) signals.push(s);
  }
  if (commits !== null) {
    const s = commitsSignal(commits);
    if (s) signals.push(s);
  }

  if (signals.length === 0) return [];

  const severity = signals.reduce<Severity>(
    (acc, s) => (SEVERITY_RANK[s.severity] > SEVERITY_RANK[acc] ? s.severity : acc),
    signals[0].severity
  );
  const message = signals.map((s) => s.message).join("; ");

  return [
    {
      code: "STALE_FILE",
      severity,
      file: source,
      line: null,
      message,
    },
  ];
}
