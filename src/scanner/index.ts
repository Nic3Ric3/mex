import type { MexConfig, ScannerBrief } from "../types.js";
import { scanManifest } from "./manifest.js";
import { scanEntryPoints } from "./entry-points.js";
import { scanFolderTree } from "./folder-tree.js";
import { scanTooling } from "./tooling.js";
import { scanReadme } from "./readme.js";
import { scanImportGraph } from "./import-graph.js";
import { scanRationale } from "./rationale.js";

/** Run pre-analysis scan and return brief or prompt */
export async function runScan(
  config: MexConfig,
  opts: { jsonOnly?: boolean; log?: (msg: string) => void }
): Promise<ScannerBrief | string> {
  const brief = buildBrief(config.projectRoot, opts.log);

  if (opts.jsonOnly) return brief;

  return buildPrompt(brief);
}

/** Build the scanner brief from codebase analysis */
function buildBrief(projectRoot: string, log?: (msg: string) => void): ScannerBrief {
  const step = log || (() => {});
  step("Reading manifest...");
  const manifest = scanManifest(projectRoot);
  step("Detecting entry points...");
  const entryPoints = scanEntryPoints(projectRoot);
  step("Scanning folder tree...");
  const folderTree = scanFolderTree(projectRoot);
  step("Detecting tooling...");
  const tooling = scanTooling(projectRoot);
  step("Reading README...");
  const readme = scanReadme(projectRoot);
  step("Building import graph...");
  const importGraph = scanImportGraph(projectRoot);
  step("Extracting rationale comments...");
  const rationale = scanRationale(projectRoot);
  return {
    manifest,
    entryPoints,
    folderTree,
    tooling,
    readme,
    importGraph,
    rationale,
    timestamp: new Date().toISOString(),
  };
}

/** Build AI prompt with embedded brief */
function buildPrompt(brief: ScannerBrief): string {
  const briefJson = JSON.stringify(brief, null, 2);

  return `Here is a pre-analyzed brief of the codebase — do NOT explore the filesystem yourself, reason from this brief:

<brief>
${briefJson}
</brief>

Using this brief, populate the mex scaffold files. The brief includes:
- **Import graph**: file-to-file dependency edges, god nodes (most-imported files), and leaf nodes. Use this to understand architecture without reading files.
- **Rationale comments**: NOTE/HACK/IMPORTANT/WHY/DECISION comments extracted from source. Use these for context/decisions.md and context/conventions.md.

Focus on:
1. context/architecture.md — use the import graph edges and god nodes to map system components and data flow
2. context/stack.md — technologies, versions, key libraries from the manifest
3. context/conventions.md — patterns visible in import graph structure + rationale comments
4. context/decisions.md — seed with rationale comments (HACK, WHY, DECISION, IMPORTANT)
5. context/setup.md — how to set up and run the project
6. ROUTER.md — update the "Current Project State" section

For each file, use the information from the brief rather than exploring the filesystem.
Be precise about versions, paths, and dependencies — they come directly from the manifest.`;
}
