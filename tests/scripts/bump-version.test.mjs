// tests/scripts/bump-version.test.mjs — BUMP-05, D-3
//
// Subprocess-invokes scripts/bump-version.mjs from a per-test temp repo with
// fixture package.json + vss-extension.json files and temp $GITHUB_OUTPUT +
// $GITHUB_STEP_SUMMARY targets. Two cases per CONTEXT D-3:
//   1. happy path — both files at 1.0.7 → both at 1.0.8, $GITHUB_OUTPUT lines
//      written, no drift annotation in stderr, no `## Drift reconciled` block.
//   2. drift     — pkg=1.0.7, manifest=1.0.6 → both end at 1.0.8 (max+1),
//      drift annotation in stderr, `## Drift reconciled` block in summary.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  cpSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const REAL_SCRIPT = path.join(REPO_ROOT, "scripts", "bump-version.mjs");

describe("bump-version.mjs (BUMP-05, D-3)", () => {
  let tempDir;
  let outputPath;
  let summaryPath;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "bump-test-"));
    mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
    cpSync(REAL_SCRIPT, path.join(tempDir, "scripts", "bump-version.mjs"));
    outputPath = path.join(tempDir, "gh-output.txt");
    summaryPath = path.join(tempDir, "gh-summary.md");
    writeFileSync(outputPath, "");
    writeFileSync(summaryPath, "");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function setupRepo({ pkg, manifest }) {
    writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "fixture", version: pkg }, null, 2) + "\n",
    );
    writeFileSync(
      path.join(tempDir, "vss-extension.json"),
      JSON.stringify({ version: manifest }, null, 2) + "\n",
    );
  }

  function runBump() {
    return spawnSync("node", ["scripts/bump-version.mjs"], {
      cwd: tempDir,
      env: {
        ...process.env,
        GITHUB_OUTPUT: outputPath,
        GITHUB_STEP_SUMMARY: summaryPath,
      },
      encoding: "utf8",
      shell: process.platform === "win32",
    });
  }

  function readPkg() {
    return JSON.parse(readFileSync(path.join(tempDir, "package.json"), "utf8"));
  }

  function readManifest() {
    return JSON.parse(readFileSync(path.join(tempDir, "vss-extension.json"), "utf8"));
  }

  it("happy path: both at 1.0.7 → both at 1.0.8 + GITHUB_OUTPUT lines + no drift annotation", () => {
    setupRepo({ pkg: "1.0.7", manifest: "1.0.7" });
    const r = runBump();
    expect(r.status).toBe(0);
    expect(readPkg().version).toBe("1.0.8");
    expect(readManifest().version).toBe("1.0.8");
    const out = readFileSync(outputPath, "utf8");
    expect(out).toContain("next-version=v1.0.8");
    expect(out).toContain("next-version-bare=1.0.8");
    expect(r.stderr).not.toContain("::warning::");
    const summary = readFileSync(summaryPath, "utf8");
    expect(summary).not.toContain("## Drift reconciled");
    expect(summary).toContain("## Bump");
  });

  it("drift: pkg=1.0.7, manifest=1.0.6 → both at 1.0.8 (max+1) + drift annotation", () => {
    setupRepo({ pkg: "1.0.7", manifest: "1.0.6" });
    const r = runBump();
    expect(r.status).toBe(0);
    expect(readPkg().version).toBe("1.0.8");
    expect(readManifest().version).toBe("1.0.8");
    const out = readFileSync(outputPath, "utf8");
    expect(out).toContain("next-version=v1.0.8");
    expect(out).toContain("next-version-bare=1.0.8");
    expect(r.stderr).toContain("::warning::Drift reconciled");
    const summary = readFileSync(summaryPath, "utf8");
    expect(summary).toContain("## Drift reconciled");
    expect(summary).toContain("## Bump");
  });
});
