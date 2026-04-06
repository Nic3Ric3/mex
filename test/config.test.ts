import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  it("throws when you run it from inside the .mex/ folder", () => {
    const mexPath = join(tmpDir, ".mex");
    mkdirSync(mexPath);
    expect(() => findConfig(mexPath)).toThrow("You're inside the .mex/ directory");
  });

  it("throws when no git repository is found", () => {
    expect(() => findConfig(tmpDir)).toThrow("No git repository found");
  });

  it("throws when scaffold directory exists but looks incomplete", () => {
    mkdirSync(join(tmpDir, ".git"));
    mkdirSync(join(tmpDir, ".mex"));
    expect(() => findConfig(tmpDir)).toThrow("Scaffold directory exists but looks incomplete");
  });

  it("throws when no .mex/ scaffold found at all", () => {
    mkdirSync(join(tmpDir, ".git"));
    expect(() => findConfig(tmpDir)).toThrow("No .mex/ scaffold found. Run: git clone");
  });

  it("works without .git if a complete scaffold exists", () => {
    const mexPath = join(tmpDir, ".mex");
    mkdirSync(mexPath);
    writeFileSync(join(mexPath, "setup.sh"), "");
    
    const config = findConfig(tmpDir);
    expect(config.projectRoot).toBe(tmpDir);
    expect(config.scaffoldRoot).toBe(mexPath);
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
    const mexPath = join(tmpDir, ".mex");
    mkdirSync(mexPath);
    writeFileSync(join(mexPath, "setup.sh"), "");
    mkdirSync(join(tmpDir, "context"));
    const config = findConfig(tmpDir);
    expect(config.scaffoldRoot).toBe(mexPath);
  });
});
