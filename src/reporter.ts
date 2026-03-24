import chalk from "chalk";
import type { DriftReport, DriftIssue, Severity } from "./types.js";

const severityColor: Record<Severity, (s: string) => string> = {
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
};

const severityIcon: Record<Severity, string> = {
  error: "✗",
  warning: "⚠",
  info: "ℹ",
};

export function reportConsole(report: DriftReport): void {
  // Show score at top so it's visible before scrolling through issues
  if (report.issues.length > 0) {
    printSummary(report);
    console.log();
  }

  const grouped = groupByFile(report.issues);

  for (const [file, issues] of Object.entries(grouped)) {
    console.log(chalk.bold.underline(file));
    for (const issue of issues) {
      const color = severityColor[issue.severity];
      const icon = severityIcon[issue.severity];
      const loc = issue.line ? `:${issue.line}` : "";
      console.log(
        `  ${color(`${icon} ${issue.code}`)}${loc} ${issue.message}`
      );
    }
    console.log();
  }

  printSummary(report);
}

export function reportQuiet(report: DriftReport): void {
  const errors = report.issues.filter((i) => i.severity === "error").length;
  const warnings = report.issues.filter(
    (i) => i.severity === "warning"
  ).length;
  const parts = [];
  if (errors) parts.push(`${errors} error${errors > 1 ? "s" : ""}`);
  if (warnings) parts.push(`${warnings} warning${warnings > 1 ? "s" : ""}`);
  const detail = parts.length ? ` (${parts.join(", ")})` : "";
  const color =
    report.score >= 80
      ? chalk.green
      : report.score >= 50
        ? chalk.yellow
        : chalk.red;
  console.log(`mex: drift score ${color(`${report.score}/100`)}${detail}`);
}

export function reportJSON(report: DriftReport): void {
  console.log(JSON.stringify(report, null, 2));
}

function printSummary(report: DriftReport): void {
  const errors = report.issues.filter((i) => i.severity === "error").length;
  const warnings = report.issues.filter(
    (i) => i.severity === "warning"
  ).length;
  const infos = report.issues.filter((i) => i.severity === "info").length;
  const color =
    report.score >= 80
      ? chalk.green
      : report.score >= 50
        ? chalk.yellow
        : chalk.red;

  console.log(
    chalk.bold(
      `Drift score: ${color(`${report.score}/100`)} — ${errors} errors, ${warnings} warnings, ${infos} info`
    )
  );
  console.log(chalk.dim(`${report.filesChecked} files checked`));
}

function groupByFile(
  issues: DriftIssue[]
): Record<string, DriftIssue[]> {
  const grouped: Record<string, DriftIssue[]> = {};
  for (const issue of issues) {
    if (!grouped[issue.file]) grouped[issue.file] = [];
    grouped[issue.file].push(issue);
  }
  return grouped;
}
