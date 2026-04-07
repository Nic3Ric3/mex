import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanManifest } from "../src/scanner/manifest.js";
import { scanEntryPoints } from "../src/scanner/entry-points.js";
import { scanFolderTree } from "../src/scanner/folder-tree.js";
import { scanTooling } from "../src/scanner/tooling.js";
import { scanReadme } from "../src/scanner/readme.js";
import { scanImportGraph } from "../src/scanner/import-graph.js";
import { scanRationale } from "../src/scanner/rationale.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "mex-scan-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("scanManifest", () => {
  it("parses package.json", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({
        name: "my-app",
        version: "1.0.0",
        dependencies: { express: "^4.18.0" },
        devDependencies: { vitest: "^3.0.0" },
        scripts: { build: "tsc", test: "vitest" },
      })
    );
    const result = scanManifest(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("package.json");
    expect(result!.name).toBe("my-app");
    expect(result!.dependencies).toHaveProperty("express");
    expect(result!.scripts).toHaveProperty("build");
  });

  it("returns null when no manifest exists", () => {
    expect(scanManifest(tmpDir)).toBeNull();
  });
});

describe("scanEntryPoints", () => {
  it("finds src/index.ts as main entry", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(join(tmpDir, "src/index.ts"), "");
    const entries = scanEntryPoints(tmpDir);
    expect(entries.some((e) => e.path === "src/index.ts" && e.type === "main")).toBe(true);
  });

  it("finds config files", () => {
    writeFileSync(join(tmpDir, "tsconfig.json"), "{}");
    const entries = scanEntryPoints(tmpDir);
    expect(entries.some((e) => e.path === "tsconfig.json" && e.type === "config")).toBe(true);
  });

  it("returns empty for empty project", () => {
    expect(scanEntryPoints(tmpDir)).toEqual([]);
  });
});

describe("scanFolderTree", () => {
  it("categorizes known directory names", () => {
    mkdirSync(join(tmpDir, "routes"));
    mkdirSync(join(tmpDir, "models"));
    mkdirSync(join(tmpDir, "tests"));
    mkdirSync(join(tmpDir, "utils"));

    const tree = scanFolderTree(tmpDir);
    const names = tree.map((t) => t.category);
    expect(names).toContain("routes");
    expect(names).toContain("models");
    expect(names).toContain("tests");
    expect(names).toContain("utils");
  });

  it("ignores node_modules and .git", () => {
    mkdirSync(join(tmpDir, "node_modules"));
    mkdirSync(join(tmpDir, ".git"));
    mkdirSync(join(tmpDir, "src"));

    const tree = scanFolderTree(tmpDir);
    const names = tree.map((t) => t.name);
    expect(names).not.toContain("node_modules");
    expect(names).not.toContain(".git");
    expect(names).toContain("src");
  });
});

describe("scanTooling", () => {
  it("detects vitest", () => {
    writeFileSync(join(tmpDir, "vitest.config.ts"), "");
    const tooling = scanTooling(tmpDir);
    expect(tooling.testRunner).toBe("vitest");
  });

  it("detects eslint", () => {
    writeFileSync(join(tmpDir, "eslint.config.js"), "");
    const tooling = scanTooling(tmpDir);
    expect(tooling.linter).toBe("eslint");
  });

  it("detects package manager from lock files", () => {
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");
    const tooling = scanTooling(tmpDir);
    expect(tooling.packageManager).toBe("pnpm");
  });

  it("returns nulls for empty project", () => {
    const tooling = scanTooling(tmpDir);
    expect(tooling.testRunner).toBeNull();
    expect(tooling.buildTool).toBeNull();
    expect(tooling.linter).toBeNull();
    expect(tooling.packageManager).toBeNull();
  });
});

describe("scanReadme", () => {
  it("reads README.md content", () => {
    writeFileSync(join(tmpDir, "README.md"), "# My Project\n\nHello world");
    const result = scanReadme(tmpDir);
    expect(result).toContain("# My Project");
  });

  it("truncates long READMEs", () => {
    writeFileSync(join(tmpDir, "README.md"), "x".repeat(5000));
    const result = scanReadme(tmpDir);
    expect(result!.length).toBeLessThan(5000);
    expect(result).toContain("(truncated)");
  });

  it("returns null when no README exists", () => {
    expect(scanReadme(tmpDir)).toBeNull();
  });
});

describe("scanImportGraph", () => {
  it("resolves relative imports between files", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/index.ts"),
      `import { foo } from './utils';\nimport { bar } from './helpers';`
    );
    writeFileSync(join(tmpDir, "src/utils.ts"), "export const foo = 1;");
    writeFileSync(join(tmpDir, "src/helpers.ts"), "export const bar = 2;");

    const graph = scanImportGraph(tmpDir);
    expect(graph).not.toBeNull();
    expect(graph!.edges).toContainEqual({
      from: "src/index.ts",
      to: "src/utils.ts",
      kind: "EXTRACTED",
    });
    expect(graph!.edges).toContainEqual({
      from: "src/index.ts",
      to: "src/helpers.ts",
      kind: "EXTRACTED",
    });
  });

  it("skips bare specifiers (node_modules imports)", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/app.ts"),
      `import express from 'express';\nimport { foo } from './foo';`
    );
    writeFileSync(join(tmpDir, "src/foo.ts"), "export const foo = 1;");

    const graph = scanImportGraph(tmpDir);
    expect(graph).not.toBeNull();
    expect(graph!.edges.length).toBe(1);
    expect(graph!.edges[0].to).toBe("src/foo.ts");
  });

  it("resolves extensionless imports with fallback", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/main.ts"),
      `import { x } from './lib';`
    );
    writeFileSync(join(tmpDir, "src/lib.tsx"), "export const x = 1;");

    const graph = scanImportGraph(tmpDir);
    expect(graph).not.toBeNull();
    expect(graph!.edges[0].to).toBe("src/lib.tsx");
  });

  it("resolves directory imports to index file", () => {
    mkdirSync(join(tmpDir, "src/utils"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/main.ts"),
      `import { x } from './utils';`
    );
    writeFileSync(join(tmpDir, "src/utils/index.ts"), "export const x = 1;");

    const graph = scanImportGraph(tmpDir);
    expect(graph).not.toBeNull();
    expect(graph!.edges[0].to).toBe("src/utils/index.ts");
  });

  it("identifies god nodes (imported by 2+ files)", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(join(tmpDir, "src/types.ts"), "export type Foo = string;");
    writeFileSync(join(tmpDir, "src/a.ts"), `import { Foo } from './types';`);
    writeFileSync(join(tmpDir, "src/b.ts"), `import { Foo } from './types';`);
    writeFileSync(join(tmpDir, "src/c.ts"), `import { Foo } from './types';`);

    const graph = scanImportGraph(tmpDir);
    expect(graph).not.toBeNull();
    expect(graph!.godNodes).toContain("src/types.ts");
  });

  it("identifies leaf nodes (import others but not imported)", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(join(tmpDir, "src/lib.ts"), "export const x = 1;");
    writeFileSync(join(tmpDir, "src/cli.ts"), `import { x } from './lib';`);

    const graph = scanImportGraph(tmpDir);
    expect(graph).not.toBeNull();
    expect(graph!.leafNodes).toContain("src/cli.ts");
    expect(graph!.leafNodes).not.toContain("src/lib.ts");
  });

  it("drops unresolvable imports silently", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/app.ts"),
      `import { x } from './nonexistent';`
    );

    const graph = scanImportGraph(tmpDir);
    expect(graph).not.toBeNull();
    expect(graph!.edges.length).toBe(0);
  });

  it("returns null for empty project", () => {
    expect(scanImportGraph(tmpDir)).toBeNull();
  });

  it("resolves .js imports to .ts files (TypeScript ESM convention)", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/index.ts"),
      `import { foo } from './utils.js';`
    );
    writeFileSync(join(tmpDir, "src/utils.ts"), "export const foo = 1;");

    const graph = scanImportGraph(tmpDir);
    expect(graph).not.toBeNull();
    expect(graph!.edges[0].to).toBe("src/utils.ts");
  });

  it("handles require() syntax", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/main.js"),
      `const utils = require('./utils');`
    );
    writeFileSync(join(tmpDir, "src/utils.js"), "module.exports = {};");

    const graph = scanImportGraph(tmpDir);
    expect(graph).not.toBeNull();
    expect(graph!.edges[0].to).toBe("src/utils.js");
  });

  it("handles re-exports", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/index.ts"),
      `export { foo } from './foo';`
    );
    writeFileSync(join(tmpDir, "src/foo.ts"), "export const foo = 1;");

    const graph = scanImportGraph(tmpDir);
    expect(graph).not.toBeNull();
    expect(graph!.edges[0].to).toBe("src/foo.ts");
  });
});

describe("scanRationale", () => {
  it("extracts // NOTE: comments", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/app.ts"),
      `const x = 1;\n// NOTE: This is important for performance`
    );

    const results = scanRationale(tmpDir);
    expect(results.length).toBe(1);
    expect(results[0].kind).toBe("NOTE");
    expect(results[0].comment).toBe("This is important for performance");
    expect(results[0].file).toBe("src/app.ts");
    expect(results[0].line).toBe(2);
  });

  it("extracts multiple rationale kinds", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/app.ts"),
      [
        "// HACK: workaround for bug #123",
        "const x = 1;",
        "// TODO: refactor this later",
        "// IMPORTANT: do not change without tests",
      ].join("\n")
    );

    const results = scanRationale(tmpDir);
    expect(results.length).toBe(3);
    expect(results.map((r) => r.kind)).toContain("HACK");
    expect(results.map((r) => r.kind)).toContain("TODO");
    expect(results.map((r) => r.kind)).toContain("IMPORTANT");
  });

  it("caps comment text at 200 chars", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/app.ts"),
      `// NOTE: ${"x".repeat(300)}`
    );

    const results = scanRationale(tmpDir);
    expect(results.length).toBe(1);
    expect(results[0].comment.length).toBeLessThanOrEqual(200);
  });

  it("returns empty array for project with no rationale comments", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(join(tmpDir, "src/app.ts"), "const x = 1;");

    const results = scanRationale(tmpDir);
    expect(results).toEqual([]);
  });

  it("handles block comment variants", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src/app.ts"),
      `/* IMPORTANT: do not remove this */`
    );

    const results = scanRationale(tmpDir);
    expect(results.length).toBe(1);
    expect(results[0].kind).toBe("IMPORTANT");
    expect(results[0].comment).toBe("do not remove this");
  });

  it("returns empty for empty project", () => {
    expect(scanRationale(tmpDir)).toEqual([]);
  });
});
