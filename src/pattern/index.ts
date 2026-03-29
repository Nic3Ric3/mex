import { join } from "node:path";
import { existsSync, writeFileSync, appendFileSync } from "node:fs";
import chalk from "chalk";
import type { MexConfig } from "../types.js";

export async function runPatternAdd(config: MexConfig, name: string) {
  const patternsDir = join(config.scaffoldRoot, "patterns");
  const patternPath = join(patternsDir, `${name}.md`);
  const indexPath = join(patternsDir, "INDEX.md");

  if (existsSync(patternPath)) {
    throw new Error(`Pattern '${name}' already exists at ${patternPath}`);
  }

  const today = new Date().toISOString().split("T")[0];

  const template = `---
name: ${name}
description: [one line — what this pattern covers and when to use it]
triggers:
  - "[keyword that should trigger loading this file]"
edges:
  - target: "context/conventions.md"
    condition: "when verifying this task"
last_updated: ${today}
---

# ${name}

## Context
[What to load or know before starting this task type]

## Steps
[The workflow — what to do, in what order]

## Gotchas
[The things that go wrong. What to watch out for.]

## Verify
[Checklist to run after completing this task type]

## Debug
[What to check when this task type breaks]

## Update Scaffold
- [ ] Update \`ROUTER.md\` "Current Project State" if what's working/not built has changed
- [ ] Update any \`context/\` files that are now out of date
- [ ] If this is a new task type without a pattern, create one in \`patterns/\` and add to \`INDEX.md\`
`;

  writeFileSync(patternPath, template, "utf8");

  if (existsSync(indexPath)) {
    const entry = `| [${name}.md](${name}.md) | [description] |\n`;
    appendFileSync(indexPath, entry, "utf8");
  }

  console.log(chalk.green(`✓ Created pattern ${name}.md`));
  console.log(chalk.dim(`  Added entry to patterns/INDEX.md`));
}
