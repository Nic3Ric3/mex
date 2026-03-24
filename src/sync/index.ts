import chalk from "chalk";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { MexConfig, SyncTarget, DriftIssue } from "../types.js";
import { runDriftCheck } from "../drift/index.js";
import { buildSyncBrief } from "./brief-builder.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function startSpinner(msg: string): () => void {
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write(
      `\r  ${chalk.blue(SPINNER_FRAMES[i])} ${msg}`
    );
    i = (i + 1) % SPINNER_FRAMES.length;
  }, 80);
  return () => {
    clearInterval(id);
    process.stdout.write("\r\x1b[2K"); // clear line
  };
}

function askUser(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function runClaude(brief: string, cwd: string): Promise<{ ok: boolean }> {
  return new Promise((resolve) => {
    const child = spawn("claude", ["-p", brief], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 300_000,
    });

    child.on("close", (code) => {
      resolve({ ok: code === 0 || code === null });
    });

    child.on("error", () => {
      resolve({ ok: false });
    });
  });
}

/** Run targeted sync: detect → brief → AI → verify → ask → loop */
export async function runSync(
  config: MexConfig,
  opts: { dryRun?: boolean; includeWarnings?: boolean }
): Promise<void> {
  let cycle = 0;

  while (true) {
    cycle++;

    // Step 1: Run drift check
    if (cycle === 1) {
      console.log(chalk.bold("Running drift check..."));
    } else {
      console.log(chalk.bold("\nRe-checking for remaining drift..."));
    }

    const report = await runDriftCheck(config);

    if (report.issues.length === 0) {
      console.log(chalk.green("✓ No drift detected. Everything is in sync."));
      return;
    }

    console.log(
      chalk.yellow(
        `Found ${report.issues.length} issues (score: ${report.score}/100)`
      )
    );

    // Step 2: Group issues by file
    const relevantIssues = opts.includeWarnings
      ? report.issues
      : report.issues.filter((i) => {
          const fileHasError = report.issues.some(
            (other) => other.file === i.file && other.severity === "error"
          );
          return fileHasError;
        });

    if (relevantIssues.length === 0) {
      console.log(
        chalk.green(
          "No errors found. Only warnings remain (use --warnings to include them)."
        )
      );
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

    // Dry run — show prompts and exit
    if (opts.dryRun) {
      console.log(
        chalk.dim("\n--dry-run: showing prompts without executing\n")
      );
      for (const target of targets) {
        const brief = await buildSyncBrief(target, config.projectRoot);
        console.log(chalk.bold.underline(`\n── ${target.file} ──`));
        console.log(brief);
        console.log();
      }
      return;
    }

    // Step 3: Fix each file with claude -p and spinner
    console.log();
    let allOk = true;

    for (const target of targets) {
      const brief = await buildSyncBrief(target, config.projectRoot);
      const stopSpinner = startSpinner(`Fixing ${target.file}...`);

      const result = await runClaude(brief, config.projectRoot);
      stopSpinner();

      if (result.ok) {
        console.log(chalk.green(`  ✓ ${target.file}`));
      } else {
        console.log(chalk.red(`  ✗ ${target.file} — claude failed`));
        allOk = false;
      }
    }

    if (!allOk) {
      // If claude wasn't available, fall back to printing prompts
      console.log(
        chalk.yellow(
          "\nCould not run claude CLI. Here are the prompts to paste manually:\n"
        )
      );
      for (const target of targets) {
        const brief = await buildSyncBrief(target, config.projectRoot);
        console.log(chalk.bold.underline(`\n── ${target.file} ──`));
        console.log(brief);
        console.log();
      }
      return;
    }

    // Step 4: Verify
    const postReport = await runDriftCheck(config);
    const scoreDelta = postReport.score - report.score;
    const deltaStr =
      scoreDelta > 0
        ? chalk.green(`+${scoreDelta}`)
        : scoreDelta === 0
          ? chalk.yellow("+0")
          : chalk.red(`${scoreDelta}`);

    console.log(
      chalk.bold(
        `\nDrift score: ${report.score} → ${postReport.score}/100 (${deltaStr})`
      )
    );

    // Step 5: Check if we should continue
    const remainingErrors = postReport.issues.filter(
      (i) => i.severity === "error"
    ).length;
    const remainingWarnings = postReport.issues.filter(
      (i) => i.severity === "warning"
    ).length;

    if (remainingErrors === 0 && !opts.includeWarnings) {
      if (remainingWarnings > 0) {
        console.log(
          chalk.dim(
            `${remainingWarnings} warning(s) remain (use --warnings to include them).`
          )
        );
      } else {
        console.log(chalk.green("✓ All issues resolved."));
      }
      return;
    }

    if (postReport.score === 100) {
      console.log(chalk.green("✓ Perfect score. All issues resolved."));
      return;
    }

    // Ask user whether to continue
    const remaining = opts.includeWarnings
      ? remainingErrors + remainingWarnings
      : remainingErrors;

    const answer = await askUser(
      `\n${remaining} issue(s) remain. Run another cycle? [Y/n] `
    );

    if (answer.toLowerCase() === "n") {
      console.log(chalk.dim("Stopped. Run mex sync again anytime."));
      return;
    }

    // Loop continues
  }
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
