import { writeFileSync, readFileSync, existsSync, chmodSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import type { MexConfig } from "./types.js";

const HOOK_MARKER = "# mex-drift-check";

const HOOK_CONTENT = `#!/bin/sh
${HOOK_MARKER}
# Auto-installed by mex watch — runs drift check after each commit
npx mex check --quiet || true
`;

export async function manageHook(
  config: MexConfig,
  opts: { uninstall?: boolean }
): Promise<void> {
  const hookPath = resolve(config.projectRoot, ".git", "hooks", "post-commit");

  if (opts.uninstall) {
    uninstallHook(hookPath);
    return;
  }

  installHook(hookPath);
}

function installHook(hookPath: string): void {
  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf-8");
    if (existing.includes(HOOK_MARKER)) {
      console.log(chalk.yellow("mex post-commit hook is already installed."));
      return;
    }

    // Append to existing hook
    const updated = existing.trimEnd() + "\n\n" + HOOK_CONTENT;
    writeFileSync(hookPath, updated);
    chmodSync(hookPath, 0o755);
    console.log(
      chalk.green("Added mex drift check to existing post-commit hook.")
    );
    return;
  }

  writeFileSync(hookPath, HOOK_CONTENT);
  chmodSync(hookPath, 0o755);
  console.log(chalk.green("Installed mex post-commit hook."));
}

function uninstallHook(hookPath: string): void {
  if (!existsSync(hookPath)) {
    console.log(chalk.yellow("No post-commit hook found."));
    return;
  }

  const content = readFileSync(hookPath, "utf-8");
  if (!content.includes(HOOK_MARKER)) {
    console.log(
      chalk.yellow("post-commit hook exists but was not installed by mex.")
    );
    return;
  }

  // Remove mex section
  const lines = content.split("\n");
  const filtered: string[] = [];
  let inMexBlock = false;

  for (const line of lines) {
    if (line.includes(HOOK_MARKER)) {
      inMexBlock = true;
      continue;
    }
    if (inMexBlock && line.startsWith("npx mex")) {
      inMexBlock = false;
      continue;
    }
    if (inMexBlock && line.startsWith("#")) {
      continue;
    }
    inMexBlock = false;
    filtered.push(line);
  }

  const remaining = filtered.join("\n").trim();
  if (remaining === "#!/bin/sh" || remaining === "") {
    // Only shebang left — remove the file
    unlinkSync(hookPath);
    console.log(chalk.green("Removed mex post-commit hook."));
  } else {
    writeFileSync(hookPath, remaining + "\n");
    chmodSync(hookPath, 0o755);
    console.log(
      chalk.green("Removed mex section from post-commit hook.")
    );
  }
}
