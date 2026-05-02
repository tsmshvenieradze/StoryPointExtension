#!/usr/bin/env node
// scripts/check-bundle-size.cjs — Phase 5 PKG-03 bundle-size gate.
//
// Reads every dist/*.{html,js,css} file, gzip-sizes it, sums the total, and
// fails (exit 1) if the sum exceeds the budget. Skips fonts (.woff/.woff2)
// and webpack license files (*.LICENSE.txt) — fonts are large and Marketplace
// caches them separately; license files are pure metadata.
//
// Usage:
//   npm run build && npm run check:size
//
// Usage in CI: same — runs after the build step.

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const REPO_ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(REPO_ROOT, "dist");
const BUDGET_KB = 250;
const BUDGET_BYTES = BUDGET_KB * 1024;
const COUNTED_EXT = new Set([".html", ".js", ".css"]);

function fmtKb(bytes) {
  return (bytes / 1024).toFixed(1).padStart(7) + " KB";
}

if (!fs.existsSync(DIST_DIR)) {
  console.error(`[check:size] ABORT: ${DIST_DIR} does not exist. Run 'npm run build' first.`);
  process.exit(2);
}

const entries = fs
  .readdirSync(DIST_DIR)
  .filter((f) => COUNTED_EXT.has(path.extname(f)))
  .filter((f) => !f.endsWith(".LICENSE.txt"));

if (entries.length === 0) {
  console.error(`[check:size] ABORT: no countable files in ${DIST_DIR} (looked for ${[...COUNTED_EXT].join(", ")})`);
  process.exit(2);
}

console.log("Bundle size report:");
console.log(`  ${"file".padEnd(24)} ${"raw".padStart(12)} ${"gzipped".padStart(12)}`);
console.log(`  ${"-".repeat(24)} ${"-".repeat(12)} ${"-".repeat(12)}`);

let totalRaw = 0;
let totalGz = 0;
for (const f of entries.sort()) {
  const buf = fs.readFileSync(path.join(DIST_DIR, f));
  const gz = zlib.gzipSync(buf);
  totalRaw += buf.length;
  totalGz += gz.length;
  console.log(`  ${f.padEnd(24)} ${fmtKb(buf.length)} ${fmtKb(gz.length)}`);
}

console.log(`  ${"-".repeat(24)} ${"-".repeat(12)} ${"-".repeat(12)}`);
console.log(`  ${"TOTAL".padEnd(24)} ${fmtKb(totalRaw)} ${fmtKb(totalGz)}`);
console.log(`  Budget: ${BUDGET_KB} KB gzipped`);

if (totalGz > BUDGET_BYTES) {
  const overBy = totalGz - BUDGET_BYTES;
  console.error("");
  console.error(`[check:size] FAIL: total gzipped size ${fmtKb(totalGz).trim()} exceeds budget ${BUDGET_KB} KB by ${fmtKb(overBy).trim()}`);
  console.error(`[check:size] Reduce bundle: tree-shake azure-devops-ui, lazy-load modal-only deps, or split the modal entry.`);
  process.exit(1);
}

const headroom = BUDGET_BYTES - totalGz;
console.log(`  Headroom:                     ${fmtKb(headroom)}  ✓`);
