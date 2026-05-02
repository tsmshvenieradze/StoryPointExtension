#!/usr/bin/env node
// scripts/publish-cezari.cjs — Phase 5 canonical publish-to-cezari helper.
//
// Loads .env.local for TFX_PAT, then invokes:
//   npx tfx extension publish --manifest-globs vss-extension.json
//                             --share-with cezari --no-wait-validation
//                             --token <PAT>
//
// Phase 5 model: the manifest version is committed and bumped explicitly.
// No auto-version-bump retry loop — if you hit "Version number must increase",
// edit vss-extension.json, commit the bump, and re-run.
//
// Cross-platform fix for the Phase 03-04 Windows spawnSync bug:
// shell: process.platform === "win32".
//
// Usage: npm run publish:cezari

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(REPO_ROOT, ".env.local");
const LOG_PREFIX = "[publish:cezari]";

// 1. Refuse to run if .env.local is tracked by git.
const lsFiles = spawnSync("git", ["ls-files", ".env.local"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (lsFiles.status === 0 && lsFiles.stdout.trim().length > 0) {
  console.error(`${LOG_PREFIX} ABORT: .env.local is tracked by git. Untrack and rotate the PAT.`);
  console.error(`        git rm --cached .env.local && git commit -m "chore: untrack .env.local"`);
  process.exit(2);
}

// 2. Parse .env.local into process.env.
if (!fs.existsSync(ENV_FILE)) {
  console.error(`${LOG_PREFIX} ABORT: .env.local not found at ${ENV_FILE}.`);
  console.error(`        Create it with: TFX_PAT=<your Marketplace PAT>`);
  process.exit(3);
}
for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const pat = process.env.TFX_PAT;
if (!pat) {
  console.error(`${LOG_PREFIX} ABORT: TFX_PAT missing from .env.local.`);
  process.exit(4);
}

// 3. Parse our own --public flag out of argv (NOT a tfx-cli flag).
//    Public publish: drop --share-with cezari, sanity-check the manifest
//    has "public": true, and remind the user about publisher verification.
//    Private publish (default): --share-with cezari for testing on cezari.
const ownArgs = process.argv.slice(2);
const isPublic = ownArgs.includes("--public");
const passthroughArgs = ownArgs.filter((a) => a !== "--public");

if (isPublic) {
  // Sanity-check the manifest before pushing to the public Marketplace.
  const manifestPath = path.join(REPO_ROOT, "vss-extension.json");
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (err) {
    console.error(`${LOG_PREFIX} ABORT: cannot parse vss-extension.json: ${err.message}`);
    process.exit(5);
  }
  if (manifest.public !== true) {
    console.error(`${LOG_PREFIX} ABORT: vss-extension.json has "public": ${JSON.stringify(manifest.public)}.`);
    console.error(`        Set "public": true in vss-extension.json before running publish:public.`);
    console.error(`        (Plan 05-05 owns this flip — do not run publish:public until that plan executes.)`);
    process.exit(6);
  }
  console.log(`${LOG_PREFIX} PUBLIC publish — vss-extension.json public:true confirmed.`);
  console.log(`${LOG_PREFIX} Reminder: publisher MUST be verified at marketplace.visualstudio.com/manage/publishers/...`);
  console.log(`${LOG_PREFIX} If verification is not granted, ADO will reject this publish.`);
}

const baseArgs = [
  "tfx", "extension", "publish",
  "--manifest-globs", "vss-extension.json",
  "--no-wait-validation",
  "--token", pat,
];
const targetArgs = isPublic ? [] : ["--share-with", "cezari"];
const args = [...baseArgs, ...targetArgs, ...passthroughArgs];

const target = isPublic ? "PUBLIC Marketplace" : "cezari (private)";
console.log(`${LOG_PREFIX} npx tfx extension publish → ${target} (token redacted)`);
const r = spawnSync("npx", args, {
  cwd: REPO_ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",   // ← THE FIX
});

process.exit(r.status ?? 1);
