import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findConfig } from "../src/config.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "mex-config-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("findConfig", () => {
  it("throws when not in a git repo", () => {
    expect(() => findConfig(tmpDir)).toThrow("Not inside a git repository");
  });

  it("throws when no scaffold found", () => {
    mkdirSync(join(tmpDir, ".git"));
    expect(() => findConfig(tmpDir)).toThrow("No scaffold found");
  });

  it("finds scaffold with context/ directory", () => {
    mkdirSync(join(tmpDir, ".git"));
    mkdirSync(join(tmpDir, "context"));
    const config = findConfig(tmpDir);
    expect(config.projectRoot).toBe(tmpDir);
    expect(config.scaffoldRoot).toBe(tmpDir);
  });

  it("prefers .mex/ over context/", () => {
    mkdirSync(join(tmpDir, ".git"));
    mkdirSync(join(tmpDir, ".mex"));
    mkdirSync(join(tmpDir, "context"));
    const config = findConfig(tmpDir);
    expect(config.scaffoldRoot).toBe(join(tmpDir, ".mex"));
  });
});
