import chalk from "chalk";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import type { MexConfig, SyncTarget, DriftIssue } from "../types.js";
import { runDriftCheck } from "../drift/index.js";
import { buildSyncBrief } from "./brief-builder.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

class Spinner {
  private id: ReturnType<typeof setInterval> | null = null;
  private i = 0;

  start(msg: string) {
    this.stop();
    this.i = 0;
    this.id = setInterval(() => {
      process.stdout.write(
        `\r  ${chalk.blue(SPINNER_FRAMES[this.i])} ${msg}`
      );
      this.i = (this.i + 1) % SPINNER_FRAMES.length;
    }, 80);
  }

  update(msg: string) {
    // Just update the message — the interval keeps spinning
    if (this.id) {
      this.stop();
      this.start(msg);
    }
  }

  stop() {
    if (this.id) {
      clearInterval(this.id);
      this.id = null;
      process.stdout.write("\r\x1b[2K");
    }
  }
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

function runClaudeBackground(
  brief: string,
  cwd: string
): Promise<{ ok: boolean }> {
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

function runClaudeInteractive(brief: string, cwd: string): boolean {
  const result = spawnSync("claude", [brief], {
    cwd,
    stdio: "inherit",
    timeout: 300_000,
  });
  return result.status === 0 || result.status === null;
}

type SyncMode = "auto" | "interactive" | "prompts";

/** Run targeted sync: detect → brief → AI → verify → ask → loop */
export async function runSync(
  config: MexConfig,
  opts: { dryRun?: boolean; includeWarnings?: boolean }
): Promise<void> {
  let cycle = 0;
  let mode: SyncMode | null = null;

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
      const errors = target.issues.filter(
        (i) => i.severity === "error"
      ).length;
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

    // Ask user for mode (only on first cycle)
    if (mode === null) {
      console.log(chalk.bold("\nHow should Claude fix these?"));
      console.log();
      console.log("  1) Auto — Claude fixes in background (default)");
      console.log("  2) Interactive — watch Claude work in real-time");
      console.log("  3) Show prompts — I'll paste manually");
      console.log("  4) Exit");
      console.log();

      const choice = await askUser("Choice [1-4] (default: 1): ");
      const picked = choice || "1";

      switch (picked) {
        case "1":
          mode = "auto";
          break;
        case "2":
          mode = "interactive";
          break;
        case "3":
          mode = "prompts";
          break;
        case "4":
          console.log(chalk.dim("Exiting. Run mex sync again anytime."));
          return;
        default:
          console.log(chalk.dim("Exiting."));
          return;
      }
    }

    // Show prompts mode — print and exit
    if (mode === "prompts") {
      for (const target of targets) {
        const brief = await buildSyncBrief(target, config.projectRoot);
        console.log(chalk.bold.underline(`\n── ${target.file} ──`));
        console.log(brief);
        console.log();
      }
      return;
    }

    // Step 3: Fix each file
    console.log();
    let allOk = true;
    const spinner = new Spinner();

    for (let j = 0; j < targets.length; j++) {
      const target = targets[j];
      const fileLabel = `[${j + 1}/${targets.length}] ${target.file}`;

      if (mode === "auto") {
        // Build brief with spinner
        spinner.start(`${fileLabel} — building prompt...`);
        const brief = await buildSyncBrief(target, config.projectRoot);

        // Send to claude with spinner
        spinner.update(`${fileLabel} — Claude is fixing...`);
        const result = await runClaudeBackground(brief, config.projectRoot);
        spinner.stop();

        if (result.ok) {
          console.log(chalk.green(`  ✓ ${target.file}`));
        } else {
          console.log(chalk.red(`  ✗ ${target.file} — Claude failed`));
          allOk = false;
        }
      } else {
        // Interactive mode
        console.log(chalk.bold(`\n── ${fileLabel} ──\n`));
        const brief = await buildSyncBrief(target, config.projectRoot);
        const ok = runClaudeInteractive(brief, config.projectRoot);
        if (!ok) {
          console.log(chalk.red(`  ✗ ${target.file} — Claude failed`));
          allOk = false;
        }
      }
    }

    if (!allOk) {
      console.log(
        chalk.yellow(
          "\nSome files could not be fixed. Run mex sync again or fix manually."
        )
      );
      return;
    }

    // Step 4: Verify
    if (mode === "auto") {
      spinner.start("Verifying fixes...");
    }
    const postReport = await runDriftCheck(config);
    if (mode === "auto") {
      spinner.stop();
    }

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
