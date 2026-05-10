#!/usr/bin/env node
// scripts/bump-version.mjs — Phase 7 BUMP-01..05 in-memory patch-bump for the
// publish workflow.
//
// Reads package.json + vss-extension.json, picks the higher of the two as the
// "current" version (D-1 max-wins drift policy), increments the patch, and
// writes the same new value to both files atomically (BUMP-01, BUMP-02). Emits
// `next-version=v<X.Y.Z>` AND `next-version-bare=<X.Y.Z>` to $GITHUB_OUTPUT
// (D-4) so downstream steps can consume either flavor. When the two input
// versions disagreed, surfaces a `::warning::Drift reconciled: ...` annotation
// to stderr and a `## Drift reconciled` block to $GITHUB_STEP_SUMMARY (D-2)
// without failing the workflow. Always appends a `## Bump` block to the step
// summary on success (D-8). Does NOT git-commit — Option B requires the bump
// to stay in-memory until the publish step succeeds (BUMP-04).
//
// Usage:
//   node scripts/bump-version.mjs
//
// Usage in CI: invoked by .github/workflows/publish.yml as `node scripts/bump-version.mjs`
// after the branch-protection probe and before the tfx-create step.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PKG_PATH = path.join(REPO_ROOT, "package.json");
const MANIFEST_PATH = path.join(REPO_ROOT, "vss-extension.json");
const LOG_PREFIX = "[bump-version]";

function readJson(p) {
  let raw;
  try {
    raw = readFileSync(p, "utf8");
  } catch (err) {
    console.error(`${LOG_PREFIX} ABORT: cannot read ${p}: ${err.message}`);
    process.exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`${LOG_PREFIX} ABORT: malformed JSON in ${p}: ${err.message}`);
    process.exit(3);
  }
}

function semverMax(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i] ? a : b;
  return a;
}

const pkg = readJson(PKG_PATH);
const manifest = readJson(MANIFEST_PATH);

const pkg_orig = pkg.version;
const manifest_orig = manifest.version;

const drifted = pkg_orig !== manifest_orig;
const current = drifted ? semverMax(pkg_orig, manifest_orig) : pkg_orig;

const [maj, min, pat] = current.split(".").map(Number);
const next = `${maj}.${min}.${pat + 1}`;

pkg.version = next;
manifest.version = next;

writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

const ghOutput = process.env.GITHUB_OUTPUT;
if (!ghOutput) {
  console.error(`${LOG_PREFIX} ABORT: GITHUB_OUTPUT env var unset.`);
  process.exit(4);
}
appendFileSync(ghOutput, `next-version=v${next}\n`);
appendFileSync(ghOutput, `next-version-bare=${next}\n`);

const ghSummary = process.env.GITHUB_STEP_SUMMARY;

if (drifted) {
  // D-2: NO LOG_PREFIX on this line — GitHub Actions parses `::warning::...`
  // as a structured annotation and a leading `[bump-version]` would corrupt it.
  console.error(`::warning::Drift reconciled: pkg=${pkg_orig}, manifest=${manifest_orig} → bumped to ${next}`);
  if (ghSummary) {
    appendFileSync(
      ghSummary,
      `## Drift reconciled\n` +
        `- \`package.json\`: ${pkg_orig}\n` +
        `- \`vss-extension.json\`: ${manifest_orig}\n` +
        `- Bumped both to: \`${next}\`\n`,
    );
  }
}

if (ghSummary) {
  appendFileSync(ghSummary, `## Bump\nBumped to \`v${next}\` (from \`${current}\`)\n`);
}

console.log(`${LOG_PREFIX} Bumped to v${next} (from ${current})`);
