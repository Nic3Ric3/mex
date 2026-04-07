// ── Shared Types ──

// ── Config ──

export interface MexConfig {
  /** Absolute path to project root (where .git lives) */
  projectRoot: string;
  /** Absolute path to scaffold root (.mex/ directory) */
  scaffoldRoot: string;
}

// ── Claims (extracted from markdown) ──

export type ClaimKind = "path" | "command" | "dependency" | "version";

export interface Claim {
  kind: ClaimKind;
  value: string;
  /** Source file (relative to project root) */
  source: string;
  /** Line number in source file */
  line: number;
  /** Section heading the claim was found under */
  section: string | null;
  /** If true, this claim is negated (e.g. "does NOT use X") */
  negated: boolean;
}

// ── Drift ──

export type Severity = "error" | "warning" | "info";

export type IssueCode =
  | "STALE_FILE"
  | "MISSING_PATH"
  | "DEAD_COMMAND"
  | "DEPENDENCY_MISSING"
  | "VERSION_MISMATCH"
  | "CROSS_FILE_CONFLICT"
  | "DEAD_EDGE"
  | "INDEX_MISSING_ENTRY"
  | "INDEX_ORPHAN_ENTRY"
  | "UNDOCUMENTED_SCRIPT";

export interface DriftIssue {
  code: IssueCode;
  severity: Severity;
  file: string;
  line: number | null;
  message: string;
  /** The claim that triggered this issue, if any */
  claim?: Claim;
}

export interface DriftReport {
  score: number;
  issues: DriftIssue[];
  filesChecked: number;
  timestamp: string;
}

// ── Frontmatter ──

export interface ScaffoldFrontmatter {
  name?: string;
  description?: string;
  edges?: FrontmatterEdge[];
  last_updated?: string;
  [key: string]: unknown;
}

export interface FrontmatterEdge {
  target: string;
  condition?: string;
}

// ── Import Graph ──

export interface ImportEdge {
  from: string;
  to: string;
  kind: "EXTRACTED";
}

export interface ImportGraph {
  godNodes: string[];
  leafNodes: string[];
  edges: ImportEdge[];
}

// ── Rationale ──

export type RationaleKind =
  | "NOTE"
  | "TODO"
  | "HACK"
  | "IMPORTANT"
  | "FIXME"
  | "WHY"
  | "REASON"
  | "DECISION";

export interface RationaleComment {
  file: string;
  line: number;
  comment: string;
  kind: RationaleKind;
}

// ── Scanner ──

export interface ManifestInfo {
  type: "package.json" | "pyproject.toml" | "go.mod" | "Cargo.toml";
  name: string | null;
  version: string | null;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}

export interface EntryPoint {
  path: string;
  type: "main" | "binary" | "test" | "config";
}

export interface FolderCategory {
  name: string;
  path: string;
  fileCount: number;
  category: "routes" | "models" | "services" | "tests" | "config" | "utils" | "views" | "other";
}

export interface ToolingInfo {
  testRunner: string | null;
  buildTool: string | null;
  linter: string | null;
  formatter: string | null;
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | null;
}

export interface ScannerBrief {
  manifest: ManifestInfo | null;
  entryPoints: EntryPoint[];
  folderTree: FolderCategory[];
  tooling: ToolingInfo;
  readme: string | null;
  importGraph: ImportGraph | null;
  rationale: RationaleComment[];
  timestamp: string;
}

// ── Sync ──

export interface SyncTarget {
  file: string;
  issues: DriftIssue[];
  gitDiff: string | null;
}

export interface SyncResult {
  file: string;
  action: "updated" | "skipped" | "failed";
  reason?: string;
}
