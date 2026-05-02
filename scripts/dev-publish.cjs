// scripts/dev-publish.cjs — Phase 2 dev-publish helper.
// Loads .env.local (gitignored — D-17), invokes tfx-cli with --rev-version
// and --token $TFX_PAT, then restores vss-extension.json from snapshot so
// the on-disk version mutation does not pollute git (RESEARCH §Pitfall 6 Strategy 1).
//
// Usage: npm run dev:publish
// Prerequisites:
//   - .env.local exists at repo root with TFX_PAT=<your Marketplace PAT>
//   - .env.local is NOT tracked by git (script aborts loudly if it is)
//   - npm run build has been run (or this script will fail in tfx package step)
//
// Note (research correction): tfx-cli does NOT honor any token-via-env-var
// pattern; only the --token CLI flag works. We pass the PAT via --token
// after parsing .env.local.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(REPO_ROOT, ".env.local");
const MANIFEST = path.join(REPO_ROOT, "vss-extension.json");
const LOG_PREFIX = "[dev-publish]";

// 1. Refuse to run if .env.local is tracked by git (RESEARCH §Pitfall 11).
const lsFiles = spawnSync("git", ["ls-files", ".env.local"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
if (lsFiles.status === 0 && lsFiles.stdout.trim().length > 0) {
  console.error(`${LOG_PREFIX} ABORT: .env.local is tracked by git. Untrack and rotate the PAT immediately.`);
  console.error(`        git rm --cached .env.local && git commit -m "chore: untrack .env.local"`);
  process.exit(2);
}

// 2. Parse .env.local into process.env (without dotenv to avoid the dep).
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2];
    }
  }
} else {
  console.error(`${LOG_PREFIX} ABORT: .env.local not found at ${ENV_FILE}.`);
  console.error(`        Create it with: TFX_PAT=<your Marketplace PAT>`);
  console.error(`        See README.md "Dev Publish" section for details.`);
  process.exit(3);
}

const pat = process.env.TFX_PAT;
if (!pat) {
  console.error(`${LOG_PREFIX} ABORT: TFX_PAT missing from .env.local.`);
  process.exit(4);
}

// 3. Snapshot vss-extension.json BEFORE tfx mutates it.
const manifestSnapshot = fs.readFileSync(MANIFEST, "utf8");
const snapshotJson = JSON.parse(manifestSnapshot);
const beforeVersion = snapshotJson.version;
console.log(`${LOG_PREFIX} snapshot taken (version ${beforeVersion})`);

function bumpPatch(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`Cannot parse version ${version}`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

// 4. Run tfx extension publish, retrying on version-conflict by bumping the
//    patch and trying again. Marketplace registers every version on validation
//    attempt (even failed validations), so --rev-version's "snapshot+1" can
//    collide on retries; we retry up to MAX_ATTEMPTS times.
const MAX_ATTEMPTS = 8;
let attemptVersion = bumpPatch(beforeVersion);
let publishedVersion = "(unknown)";
let exitCode = 1;
let lastStdout = "";

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  // Write the candidate version to the manifest in-memory copy on disk.
  const candidateJson = { ...snapshotJson, version: attemptVersion };
  fs.writeFileSync(MANIFEST, JSON.stringify(candidateJson, null, 2), "utf8");

  const args = [
    "tfx",
    "extension", "publish",
    "--manifest-globs", "vss-extension.json",
    "--share-with", "cezari",
    "--token", pat,
    ...process.argv.slice(2),
  ];

  console.log(`${LOG_PREFIX} attempt ${attempt}/${MAX_ATTEMPTS}: publishing version ${attemptVersion} (token redacted)`);
  const r = spawnSync("npx", args, {
    cwd: REPO_ROOT,
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
    encoding: "utf8",
  });

  // Mirror tfx output to the user.
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  lastStdout = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;

  if (r.status === 0) {
    publishedVersion = attemptVersion;
    exitCode = 0;
    break;
  }

  // Version-collision detection. tfx prints "Version number must increase
  // each time an extension is published. ... Current version: X.Y.Z".
  const collision = /Version number must increase[\s\S]*?Current version:\s*(\d+\.\d+\.\d+)/i.exec(lastStdout);
  if (!collision) {
    // Different failure (auth, validation, network, etc.). Don't retry.
    exitCode = r.status ?? 1;
    break;
  }

  const marketplaceVersion = collision[1];
  attemptVersion = bumpPatch(marketplaceVersion);
  console.log(`${LOG_PREFIX} version ${candidateJson.version} already on Marketplace (current: ${marketplaceVersion}); retrying with ${attemptVersion}`);
}

// 5. Restore vss-extension.json from snapshot regardless of outcome, so the
//    on-disk version mutation does not pollute git (D-03).
fs.writeFileSync(MANIFEST, manifestSnapshot, "utf8");

if (exitCode === 0) {
  console.log(`${LOG_PREFIX} published version ${publishedVersion}; manifest restored to ${beforeVersion}`);
} else {
  console.error(`${LOG_PREFIX} publish failed; manifest restored to ${beforeVersion}`);
}

process.exit(exitCode);
