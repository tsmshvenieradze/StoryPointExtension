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
const beforeVersion = JSON.parse(manifestSnapshot).version;
console.log(`${LOG_PREFIX} snapshot taken (version ${beforeVersion})`);

// 4. Run tfx extension publish with --rev-version and --share-with cezari.
const args = [
  "tfx",
  "extension", "publish",
  "--manifest-globs", "vss-extension.json",
  "--share-with", "cezari",
  "--rev-version",
  "--token", pat,
  ...process.argv.slice(2),
];

console.log(`${LOG_PREFIX} npx tfx extension publish --share-with cezari --rev-version (token redacted)`);
const r = spawnSync("npx", args, {
  cwd: REPO_ROOT,
  stdio: "inherit",
  shell: true,
});

// 5. Read post-publish version (so the developer sees what was published)
//    BEFORE restoring the snapshot.
let publishedVersion = "(unknown — restore continues)";
try {
  const after = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  publishedVersion = after.version;
} catch {
  /* if tfx left the file in a bad state, just log */
}

// 6. Restore vss-extension.json from snapshot regardless of tfx exit code,
//    so a failed publish does not leave a partial mutation (D-03).
fs.writeFileSync(MANIFEST, manifestSnapshot, "utf8");
console.log(`${LOG_PREFIX} manifest restored to version ${beforeVersion} (was bumped to ${publishedVersion} during publish)`);

process.exit(r.status ?? 1);
