import chalk from "chalk";
import { execSync } from "node:child_process";
import type { MexConfig, SyncTarget, DriftIssue } from "../types.js";
import { runDriftCheck } from "../drift/index.js";
import { buildSyncBrief } from "./brief-builder.js";
import { verifySync } from "./verifier.js";

/** Run targeted sync: detect → brief → AI → verify */
export async function runSync(
  config: MexConfig,
  opts: { dryRun?: boolean; includeWarnings?: boolean }
): Promise<void> {
  // Step 1: Run drift check
  console.log(chalk.bold("Running drift check..."));
  const report = await runDriftCheck(config);

  if (report.issues.length === 0) {
    console.log(chalk.green("No drift detected. Everything is in sync."));
    return;
  }

  console.log(
    chalk.yellow(
      `Found ${report.issues.length} issues across ${report.filesChecked} files (score: ${report.score}/100)`
    )
  );

  // Step 2: Group issues by file to create sync targets
  // By default, only sync files with at least one error (skip warning-only files)
  const relevantIssues = opts.includeWarnings
    ? report.issues
    : report.issues.filter((i) => {
        // Keep all issues from files that have at least one error
        const fileHasError = report.issues.some(
          (other) => other.file === i.file && other.severity === "error"
        );
        return fileHasError;
      });

  if (relevantIssues.length === 0) {
    console.log(chalk.green("No errors found. Only warnings remain (use --warnings to include them)."));
    return;
  }

  const targets = groupIntoTargets(relevantIssues);

  console.log(
    chalk.bold(`\n${targets.length} file(s) need attention:\n`)
  );

  for (const target of targets) {
    const errors = target.issues.filter((i) => i.severity === "error").length;
    const warnings = target.issues.filter(
      (i) => i.severity === "warning"
    ).length;
    console.log(
      `  ${target.file} — ${errors} errors, ${warnings} warnings`
    );
  }

  if (opts.dryRun) {
    console.log(chalk.dim("\n--dry-run: showing prompts without executing\n"));
    for (const target of targets) {
      const brief = await buildSyncBrief(target, config.projectRoot);
      console.log(chalk.bold.underline(`\n── ${target.file} ──`));
      console.log(brief);
      console.log();
    }
    return;
  }

  // Step 3: Build and execute prompts via claude CLI
  console.log(chalk.bold("\nBuilding targeted prompts...\n"));

  for (const target of targets) {
    const brief = await buildSyncBrief(target, config.projectRoot);

    console.log(chalk.bold(`Syncing ${target.file}...`));

    try {
      // Try to use claude CLI
      execSync(`echo ${JSON.stringify(brief)} | claude --print`, {
        cwd: config.projectRoot,
        stdio: "inherit",
        timeout: 120_000,
      });
    } catch {
      // Fall back to printing the prompt
      console.log(
        chalk.yellow(
          `Could not run claude CLI. Here's the prompt to paste manually:`
        )
      );
      console.log(brief);
    }
  }

  // Step 4: Verify
  console.log(chalk.bold("\nVerifying fixes..."));
  const verification = await verifySync(config);
  console.log(
    chalk.bold(
      `Post-sync drift score: ${verification.report.score}/100`
    )
  );
}

function groupIntoTargets(issues: DriftIssue[]): SyncTarget[] {
  const byFile = new Map<string, DriftIssue[]>();
  for (const issue of issues) {
    if (!byFile.has(issue.file)) byFile.set(issue.file, []);
    byFile.get(issue.file)!.push(issue);
  }

  return Array.from(byFile.entries()).map(([file, issues]) => ({
    file,
    issues,
    gitDiff: null,
  }));
}
