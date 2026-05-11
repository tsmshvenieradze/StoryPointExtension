# Phase 7: Bump, Publish, Tag — Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 5 (3 created, 2 modified, 1 evidence artifact)
**Analogs found:** 5 / 5 (3 strong, 1 partial, 1 pattern-only — no first-party `.mjs` exists; closest analog is a `.cjs` Node-stdlib script)

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `scripts/bump-version.mjs` (NEW) | utility script (CI-driven, ESM, Node 20+) | file-I/O (read 2 JSON files → max-merge → write both → emit `$GITHUB_OUTPUT` + `$GITHUB_STEP_SUMMARY`) | `scripts/check-bundle-size.cjs` (filesystem-reading Node-stdlib script wired into CI via npm-script) | partial (same role + npm/CI invocation contract; differs on module system `.cjs` → `.mjs` and on output channel — `.cjs` writes only stdout/exit-code, `.mjs` must additionally write to `$GITHUB_OUTPUT` + `$GITHUB_STEP_SUMMARY` for which there is **no first-party analog**) |
| `scripts/bump-version.test.mjs` (NEW) | unit test (vitest, Node-only) | file-I/O via temp dirs + env-var-injection | `tests/audit/parse.test.ts` (vitest `describe` + `it.each` shape; pure-function assertion style) | strong on test shape (vitest API + describe/it.each); partial on subject (`parse.test.ts` tests an in-memory pure function; `bump-version.test.mjs` tests a script that reads/writes the filesystem and `$GITHUB_OUTPUT`/`$GITHUB_STEP_SUMMARY` — temp-dir + env-var injection has **no first-party analog**) |
| `.github/workflows/publish.yml` (MODIFIED) | CI workflow — single sequential job; replace dry-run echo with bump → tfx create → upload-artifact → tfx publish → commit-back → tag tail | event-driven (push/dispatch → gates → bump → package → publish → commit → tag) | itself (Phase 6 scaffold lines 1-108 carry over verbatim; only lines 110-123 swap out) + `scripts/publish-cezari.cjs` for `tfx extension publish` flag set | strong (header + gates + asset audit + TFX_PAT verify + branch-protection probe stay byte-identical; 5 net-new steps replace the 14-line dry-run echo) |
| `.planning/phases/07-bump-publish-tag/07-VERIFICATION.md` (NEW) | evidence artifact (markdown) | document-only (human-captured per-SC evidence) | `.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md` | exact (per CONTEXT D-7 explicit instruction: "mirrors Phase 6's `branch-protection-probe-result.md` durability posture") |
| `package.json` + `vss-extension.json` (MODIFIED at run time, not in PR diff) | manifest version field (1.0.7 → 1.0.8) | rewritten by `bump-version.mjs` on the runner; committed back via `git-auto-commit-action@v6` | n/a — both files are touched by Phase 7's *script*, not by Phase 7's PR | n/a (no Phase 7 PR diff on `version` field; the bump happens at run time) |

## Pattern Assignments

### `scripts/bump-version.mjs` (NEW — utility, file-I/O)

**Analog:** `scripts/check-bundle-size.cjs` (closest in role + invocation contract; Node-stdlib filesystem-reading script wired into CI via npm-script). Both run on `ubuntu-latest`, both use `node:fs` + `node:path`, both fail-loud on bad state via `process.exit(<non-zero>)`, both emit human-readable progress to stdout, both have a strict "no external deps" posture.

**Module system divergence:** `bump-version.mjs` is the project's first ESM script. The Node 20 runtime is fully ESM-capable (`engines.node: ">=20.10.0"` in `package.json`); just substitute `import` for `require` and `import.meta.url` for `__dirname`. Per CONTEXT line 145 + research/STACK.md "Why `scripts/bump-version.mjs` (ESM) — NOT `bump-patch.cjs`": "ESM aligns with Node 20+ defaults and `engines.node: >=20.10.0`."

**File-header / shebang pattern** (`check-bundle-size.cjs` lines 1-13):

```javascript
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
```

**Apply to `bump-version.mjs`** — same comment shape (one-line description; one-paragraph behavior summary; explicit "Usage" + "Usage in CI" sections). Cite Phase 7 BUMP-01..05 + D-1/D-2/D-4 in the header. Keep the leading shebang for direct-invocation discoverability even though CI calls it via `node scripts/bump-version.mjs`.

**Imports pattern** — translate `check-bundle-size.cjs` lines 14-16 from CJS to ESM:

```javascript
// CJS (existing scripts):
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

// ESM (new — bump-version.mjs):
import { readFileSync, writeFileSync } from "node:fs";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
```

**Notes:**
- `node:` protocol prefix is the existing convention (preserves a 1:1 visual match with the other scripts).
- No external dependencies — same posture as the four existing `scripts/*.cjs` files.
- `appendFileSync` is the chosen primitive for `$GITHUB_OUTPUT` and `$GITHUB_STEP_SUMMARY` writes (both files are append-only contracts on GitHub-hosted runners).

**Repo-root resolution pattern** (`check-bundle-size.cjs` lines 18-19):

```javascript
const REPO_ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(REPO_ROOT, "dist");
```

**ESM equivalent for `bump-version.mjs`:**

```javascript
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PKG_PATH = path.join(REPO_ROOT, "package.json");
const MANIFEST_PATH = path.join(REPO_ROOT, "vss-extension.json");
```

**Existence/precondition guard pattern** (`check-bundle-size.cjs` lines 28-31):

```javascript
if (!fs.existsSync(DIST_DIR)) {
  console.error(`[check:size] ABORT: ${DIST_DIR} does not exist. Run 'npm run build' first.`);
  process.exit(2);
}
```

**Apply to `bump-version.mjs`:** match the `[bump-version] ABORT: <reason>` log-prefix convention (see "Log-prefix convention" below) and use a unique exit code per failure class (e.g., `2` = missing input file, `3` = malformed JSON, `4` = `$GITHUB_OUTPUT` env var unset). The two D-3 vitest tests (happy + drift) do NOT exercise these abort paths — they exist as belt-and-suspenders only.

**Log-prefix convention** — every existing `scripts/*.cjs` file uses a bracketed prefix on every console line:
- `check-bundle-size.cjs` → `[check:size]`
- `publish-cezari.cjs` → `[publish:cezari]` (line 24: `const LOG_PREFIX = "[publish:cezari]";`)

**Apply:** `bump-version.mjs` should declare `const LOG_PREFIX = "[bump-version]";` at the top and use `${LOG_PREFIX}` on every stdout/stderr line. Drift `::warning::` lines are an exception — those go to stderr WITHOUT the bracket prefix because GitHub Actions parses `::warning::` as a structured annotation and the prefix would show up in the annotation text.

**`process.env`-based config pattern** (`publish-cezari.cjs` lines 49-53):

```javascript
const pat = process.env.TFX_PAT;
if (!pat) {
  console.error(`${LOG_PREFIX} ABORT: TFX_PAT missing from .env.local.`);
  process.exit(4);
}
```

**Apply to `bump-version.mjs`:** read `process.env.GITHUB_OUTPUT` and `process.env.GITHUB_STEP_SUMMARY`. If `GITHUB_OUTPUT` is unset, abort with exit code 4 — the script is GitHub-Actions-only by design. The vitest tests pass a temp file path via the env var (per CONTEXT D-3) so the script reads/writes the same file the test inspects afterward.

**Core file-mutation pattern** — no direct first-party analog (`generate-icon.cjs` writes binary PNG; `check-bundle-size.cjs` is read-only). The closest precedent for **atomic two-file JSON read/edit/write** is the workflow-itself prior art at research/STACK.md Section B (lines 81-100 of STACK.md):

```
1. Read current package.json.version → compute new patch → write back.
2. Inline Node fs script: read package.json.version, set vss-extension.json.version
   to the same string, write with JSON.stringify(..., null, 2) + '\n'.
```

**Canonical `bump-version.mjs` core (composed from D-1 + D-2 + D-4 + STACK.md prescription, NO first-party copy):**

```javascript
const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

// D-1: max-wins. Pick the higher of the two as the "current" version.
const drifted = pkg.version !== manifest.version;
const current = drifted ? semverMax(pkg.version, manifest.version) : pkg.version;

// Compute next patch. Format is X.Y.Z; split on ".", increment Z.
const [maj, min, pat] = current.split(".").map(Number);
const next = `${maj}.${min}.${pat + 1}`;

pkg.version = next;
manifest.version = next;

// Preserve 2-space indent + trailing newline (existing files use both).
writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

// D-4: emit next-version=v<X.Y.Z> to $GITHUB_OUTPUT.
const ghOutput = process.env.GITHUB_OUTPUT;
if (!ghOutput) { console.error(`${LOG_PREFIX} ABORT: GITHUB_OUTPUT env var unset.`); process.exit(4); }
appendFileSync(ghOutput, `next-version=v${next}\n`);

// D-2: drift surfacing. Stderr ::warning:: + step-summary block, audit-only.
if (drifted) {
  console.error(`::warning::Drift reconciled: pkg=${pkg_orig}, manifest=${manifest_orig} → bumped to ${next}`);
  const ghSummary = process.env.GITHUB_STEP_SUMMARY;
  if (ghSummary) {
    appendFileSync(ghSummary,
      `## Drift reconciled\n\n` +
      `- \`package.json\`: ${pkg_orig}\n` +
      `- \`vss-extension.json\`: ${manifest_orig}\n` +
      `- Bumped both to: \`${next}\`\n`);
  }
}

console.log(`${LOG_PREFIX} Bumped to v${next} (from ${current})`);
```

**`semverMax` helper** — no first-party analog; project has zero `semver` ops anywhere. Use a 5-line inline comparator. The `X.Y.Z` shape is locked by REQUIREMENTS.md (Fibonacci patch-only), so a string-split + numeric-tuple comparator is sufficient — DO NOT pull in the `semver` npm package.

```javascript
function semverMax(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i] ? a : b;
  return a; // equal
}
```

**Indentation + trailing newline preservation** (existing `package.json` and `vss-extension.json` both use **2-space indent + trailing `\n`**):

- `JSON.stringify(obj, null, 2) + "\n"` is the canonical output. Verified by reading `package.json` (2-space indent, ends `}\n` per the read above) and `vss-extension.json` (same shape).
- Do NOT use `JSON.stringify(obj)` (no whitespace) or `JSON.stringify(obj, null, 4)` (would trash both files' diff history).

---

### `scripts/bump-version.test.mjs` (NEW — vitest, Node-only)

**Analog:** `tests/audit/parse.test.ts` (vitest API; `describe` + `it.each` shape; pure-function assertion style). Choosing `parse.test.ts` over `calcEngine.test.ts` because parse-test exercises **input-determinism on a fixture-table** which matches the bump-version test shape (each fixture = one branch through the script).

**Vitest imports + describe/it pattern** (`parse.test.ts` lines 1-9):

```typescript
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/audit/parse';

const VALID_PAYLOAD = { sp: 5, c: 'Hard', u: 'Medium', e: 'Easy', schemaVersion: 1 };

describe('parse: edge cases (D-23, AUDIT-03, AUDIT-04, AUDIT-06)', () => {
  it.each([
    { name: 'plain sentinel + human line', body: '...', expected: VALID_PAYLOAD },
    { name: 'malformed JSON inside sentinel returns null (D-12)', body: '...', expected: null },
    ...
  ])('$name', ({ body, expected }) => {
    expect(parse(body)).toEqual(expected);
  });
});
```

**Apply to `bump-version.test.mjs`** — but with two adjustments because the subject-under-test has filesystem and env-var side effects (NO first-party analog for either):

1. **Use Node's child-process API to invoke `bump-version.mjs` as a subprocess** rather than `import`-ing it (the script runs top-level code on import; subprocess gives clean teardown). Match `scripts/publish-cezari.cjs` lines 18-31 for the `spawnSync` pattern (already proven cross-platform via `shell: process.platform === "win32"`):

```javascript
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const r = spawnSync("node", ["scripts/bump-version.mjs"], {
  cwd: tempRepoDir,
  env: { ...process.env, GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: summaryPath },
  encoding: "utf8",
  shell: process.platform === "win32",
});
```

2. **Per-test temp-dir scaffolding** — no analog in the existing test suite (which is pure in-memory). Pattern:
   - `beforeEach`: create a temp dir via `mkdtempSync(path.join(tmpdir(), "bump-test-"))`, copy in fixture `package.json` + `vss-extension.json`, allocate temp `GITHUB_OUTPUT` + `GITHUB_STEP_SUMMARY` paths.
   - `afterEach`: `rmSync(tempDir, { recursive: true, force: true })`.

**Two D-3 tests verbatim** — write each as a separate `it(...)` block (NOT `it.each`) so the assertion list per case is asymmetric (drift case adds two extra assertions on stderr + step-summary content):

```javascript
describe('bump-version.mjs (BUMP-05, D-3)', () => {
  it('happy path: both files at 1.0.7 → both end at 1.0.8 + GITHUB_OUTPUT line', () => {
    setupRepo({ pkg: "1.0.7", manifest: "1.0.7" });
    const r = runBump();
    expect(r.status).toBe(0);
    expect(readPkg().version).toBe("1.0.8");
    expect(readManifest().version).toBe("1.0.8");
    expect(readFileSync(outputPath, "utf8")).toContain("next-version=v1.0.8");
    expect(r.stderr).not.toContain("::warning::"); // no drift annotation
  });

  it('drift: pkg=1.0.7, manifest=1.0.6 → both end at 1.0.8 (max+1) + drift annotation', () => {
    setupRepo({ pkg: "1.0.7", manifest: "1.0.6" });
    const r = runBump();
    expect(r.status).toBe(0);
    expect(readPkg().version).toBe("1.0.8");
    expect(readManifest().version).toBe("1.0.8");
    expect(r.stderr).toContain("::warning::Drift reconciled");
    expect(readFileSync(summaryPath, "utf8")).toContain("## Drift reconciled");
  });
});
```

**vitest config caveat — IMPORTANT for the planner:**

`vitest.config.ts` line 8 currently reads:
```typescript
include: ['tests/**/*.test.ts'],
```

So a file at `scripts/bump-version.test.mjs` will **NOT be picked up** by `npm test` as currently configured. Per CONTEXT line 111 + 159:

> "Exact filename for the bump script's vitest test ... Confirm via `vitest.config.ts`."
> "The new `bump-version.test.mjs` is a `scripts/**` test, NOT subject to the 100%-coverage threshold (per existing vitest config). Confirm at planning time."

**Two viable options for the planner:**

| Option | What changes | Trade-off |
|--------|--------------|-----------|
| **A. Place test at `tests/scripts/bump-version.test.mjs`** | No vitest config change; matches existing `tests/**/*.test.*` glob | Minor inconsistency: test file uses `.mjs` while every existing test uses `.ts`. Vitest handles `.mjs` natively; no `tsconfig` interaction needed. Best balance of "no config drift" vs "co-locate tests with subject". |
| **B. Place test at `scripts/bump-version.test.mjs` + extend vitest include glob** | Add `'scripts/**/*.test.mjs'` to `vitest.config.ts` `include:` array | Co-locates the test next to the subject (mirrors how `webpack` projects co-locate `*.test.*`). One extra line of config drift; coverage thresholds still don't apply (the existing thresholds are scoped to `src/calc/**` and `src/audit/**`). |

Recommend **Option A** for minimum config drift (per CONTEXT line 111 — the test file's location is Claude's discretion; matching the existing glob is the lowest-risk choice). The planner's call.

---

### `.github/workflows/publish.yml` (MODIFIED)

**Analog:** itself (the Phase 6 scaffold). The header (lines 1-26), gates (lines 27-45), asset audit (lines 47-63), TFX_PAT verify (lines 65-67), and branch-protection probe (lines 69-108) all carry over **byte-identical** to Phase 7. Only lines 110-123 (the dry-run echo) get replaced.

**Job-level surgical edits:**

```yaml
# Line 22 (current):
    name: Publish to Marketplace (dry-run in P6)
# After Phase 7:
    name: Publish to Marketplace
```

**Job-level new permissions block** (insert between `if:` line 25 and `steps:` line 26, per CONTEXT D-12 + Claude's-Discretion line 134):

```yaml
    permissions:
      contents: write   # bump-back commit + tag push (NOT PROTECTED per 06-03 probe artifact)
```

The top-level `permissions: contents: read` (lines 17-18) stays as the principle-of-least-privilege baseline; the job-level `contents: write` upgrade is scoped to the publish job only.

**Net-new step 1 — Bump version (D-1, D-2, D-4, D-8):**

No first-party analog for this step shape. Pattern is canonical (read step output via `${{ steps.<id>.outputs.<key> }}`):

```yaml
      - name: Bump version (in-memory only)
        id: bump
        run: node scripts/bump-version.mjs
```

Notes:
- `id: bump` is the handle every downstream step uses via `${{ steps.bump.outputs.next-version }}` (output written to `$GITHUB_OUTPUT` by `bump-version.mjs` per D-4).
- The script writes its OWN `$GITHUB_STEP_SUMMARY` block (`## Bump` per D-8 + `## Drift reconciled` per D-2 when applicable). The YAML step does NOT add a separate summary write — the script owns it.
- **Position:** AFTER Phase 6's `Probe master branch protection` (line 108) and BEFORE the new tfx-create step. Matches research/SUMMARY.md architecture-flow line 76 ("step 8").

**Net-new step 2 — Package vsix (D-8 step-summary line):**

**Analog:** `scripts/publish-cezari.cjs` lines 84-91 (the canonical reviewed shape for `tfx extension` invocations) + research/STACK.md "Two-step pattern" + ARCHITECTURE.md §5 (the `tfx extension create` glob convention). Reuse the same `npx tfx` invocation form (NOT `npx tfx-cli` — the binary name in `node_modules/.bin/` is `tfx`, verified against `publish-cezari.cjs` line 85 which uses `"tfx"` as the executable name in `spawnSync`).

```yaml
      - name: Package vsix
        run: |
          npx tfx extension create --manifest-globs vss-extension.json --output-path dist/
          VSIX=$(ls dist/*.vsix | head -1)
          SIZE_KB=$(du -k "$VSIX" | cut -f1)
          {
            echo "## Package"
            echo "Created \`$(basename "$VSIX")\` (${SIZE_KB} KB)"
          } >> "$GITHUB_STEP_SUMMARY"
```

Notes:
- `--manifest-globs vss-extension.json --output-path dist/` matches `package` script in `package.json` line 21 (`"package": "tfx extension create --manifest-globs vss-extension.json --output-path dist/"`). Reuse the **exact same flags** for parity with the local `npm run package` workflow.
- `npx tfx ...` (NOT `npx tfx-cli ...`) per `publish-cezari.cjs` line 85 + the npm script at `package.json` line 21.
- Step-summary block is per CONTEXT D-8: "`## Package` — `Created vsix-1.0.8.vsix (XX KB)`. (Size is nice-to-have; planner's call.)"
- Per CONTEXT Claude's-Discretion line 130 ("Whether `tfx extension create` writes to `dist/` ... Stick with `dist/*.vsix` glob unless `tfx-cli` 0.23.1's --help reveals a better-named flag"), keep the `dist/*.vsix` glob unless the local --help re-verify (D-6) reveals a different shape. STATE.md TODO line: re-verify `tfx extension create --help` flag spelling at execution time.

**Net-new step 3 — Upload artifact (CONTEXT line 116 + ROADMAP SC #6):**

No first-party analog. Pattern from research/ARCHITECTURE.md lines 124-132 (canonical):

```yaml
      - name: Upload .vsix artifact
        uses: actions/upload-artifact@v4
        with:
          name: vsix-${{ steps.bump.outputs.next-version }}
          path: dist/*.vsix
          retention-days: 90
          if-no-files-found: error
```

**Critical artifact-name nuance** (CONTEXT line 131-132):

> "Whether `actions/upload-artifact@v4` uses `name: vsix-${{ steps.bump.outputs.next-version }}` (i.e., `vsix-v1.0.8`) or strips the `v` prefix to match ROADMAP SC #6's `vsix-1.0.8` example. Match SC #6 (`vsix-1.0.8`, no `v` prefix in the artifact name) — tag has `v` prefix per TAG-03; artifact does not per SC #6."

Since `bump-version.mjs` emits `next-version=v1.0.8` (with the `v` prefix per D-4), the workflow needs to **strip the `v`** for the artifact name. Two options:

```yaml
# Option A — inline strip via expression substring:
name: vsix-${{ steps.bump.outputs.next-version }}      # produces vsix-v1.0.8 — WRONG per SC #6

# Option B — emit a second output WITHOUT the v prefix:
# (in bump-version.mjs, also write `next-version-bare=1.0.8\n` alongside `next-version=v1.0.8\n`)
name: vsix-${{ steps.bump.outputs.next-version-bare }}  # produces vsix-1.0.8 — CORRECT per SC #6
```

Recommend **Option B** — `bump-version.mjs` writes BOTH `next-version=v1.0.8` (used by the tag step per TAG-03) AND `next-version-bare=1.0.8` (used by the artifact step per SC #6). One bump-script change covers both downstream needs. Planner's final call.

**Net-new step 4 — Publish to Marketplace (D-6, D-8, Pitfall 5):**

**Analog:** `scripts/publish-cezari.cjs` lines 84-99 — canonical reviewed `tfx extension publish` invocation. The local script uses `--share-with cezari --no-wait-validation --token <PAT>`; the workflow drops `--share-with cezari` (publishing to public Marketplace, not private cezari org) and adds `--auth-type pat --no-prompt` (Pitfall 5: required for non-interactive CI per research/PITFALLS.md line 205-206).

```yaml
      - name: Publish to Marketplace
        env:
          TFX_PAT: ${{ secrets.TFX_PAT }}
        run: |
          set -euo pipefail
          npx tfx extension publish \
            --vsix dist/*.vsix \
            --auth-type pat \
            --token "$TFX_PAT" \
            --no-prompt \
            --no-wait-validation
          {
            echo "## Publish"
            echo "Published \`v${{ steps.bump.outputs.next-version-bare }}\` to Marketplace"
            echo "https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator"
          } >> "$GITHUB_STEP_SUMMARY"
```

Notes (per Pitfall 5 + research/PITFALLS.md line 220-232):
- All four flags (`--auth-type pat`, `--token "$TFX_PAT"`, `--no-prompt`, `--no-wait-validation`) are **required**. Dropping any one breaks: hung CI (no `--no-prompt`), interactive auth fail (no `--auth-type pat`), token-not-supplied (no `--token`), 10-minute waits on Marketplace validation (no `--no-wait-validation`).
- `TFX_PAT` is passed via `env:` block, NOT inline — research/PITFALLS.md line 653 ("Always pass via `env:` not via inline `${{ }}` interpolation in `run:` shell strings. Never `echo` the secret.").
- `--token "$TFX_PAT"` (with quotes) per `publish-cezari.cjs` line 88; do NOT add `Bearer ` prefix (Pitfall 5 trap line 210: "PAT prefix `bearer ` should NOT be added").
- **THIS IS THE POINT OF NO RETURN.** Per research/SUMMARY.md line 82: "Above this line: master untouched." If this step fails, the runner is destroyed, manifest changes are lost, master is still at v1.0.7.
- Step-summary block per D-8: `## Publish` block + listing URL.

**Net-new step 5 — Commit version bump (D-12, D-8, Pitfall 1, Pitfall 11):**

**Analog:** No first-party usage of `git-auto-commit-action@v6` exists. Pattern from research/STACK.md lines 167-178 + research/PITFALLS.md lines 472-477 + CONTEXT D-12 + CONTEXT Claude's-Discretion line 117:

```yaml
      - name: Commit version bump
        id: commit
        uses: stefanzweifel/git-auto-commit-action@v6
        with:
          commit_message: "chore(release): ${{ steps.bump.outputs.next-version }} [skip ci]"
          commit_user_name: "github-actions[bot]"
          commit_user_email: "41898282+github-actions[bot]@users.noreply.github.com"
          commit_author: "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>"
          file_pattern: "package.json vss-extension.json"
      - name: Surface commit-back result
        run: |
          {
            echo "## Commit-back"
            echo "Committed bump as \`${{ steps.commit.outputs.commit_hash }}\` ([skip ci])"
          } >> "$GITHUB_STEP_SUMMARY"
```

Notes:
- The bot identity (`github-actions[bot]` + `41898282+github-actions[bot]@users.noreply.github.com`) is the canonical value per research/STACK.md line 174-176 + research/PITFALLS.md line 473-474. **Do not customize** — using the canonical identity is what gives the commit GitHub's verified-signature badge automatically (research/SUMMARY.md note at "Bot identity for commits").
- `[skip ci]` in the commit message per CONTEXT specifics line 204: "The `git-auto-commit-action@v6` `commit_message` input must contain `[skip ci]`; do not add a separate 'skip if commit message contains [skip ci]' guard."
- `file_pattern: "package.json vss-extension.json"` — the two files that `bump-version.mjs` mutates. (Do NOT include `package-lock.json` — it has no version field that the bump script touches.)
- **DO NOT use the action's built-in tagging** per CONTEXT Claude's-Discretion line 117: "Do NOT use the action's built-in tagging — TAG-03/04 are best-effort with idempotency, which a separate `git tag` step handles more cleanly."
- The action exposes `outputs.commit_hash` per its README; reference via `${{ steps.commit.outputs.commit_hash }}` in the summary write.
- Step-summary `## Commit-back` block is a SEPARATE step after the action (the action itself does not write to `$GITHUB_STEP_SUMMARY`); using a tiny dedicated `run:` block keeps the contract clear.

**Net-new step 6 — Tag release (D-10, TAG-03, TAG-04, Pitfall 14):**

**Analog:** No first-party tag-push pattern in the repo. Pattern from research/PITFALLS.md lines 611-620 (the canonical idempotent tag step) + CONTEXT D-10 (three explicit summary states):

```yaml
      - name: Tag release (best-effort, idempotent)
        continue-on-error: true
        run: |
          set -euo pipefail
          V="${{ steps.bump.outputs.next-version }}"
          if git rev-parse "$V" >/dev/null 2>&1; then
            echo "Tag $V already exists locally — skipping"
            echo "Tag \`$V\` already exists — idempotent skip per TAG-04" >> "$GITHUB_STEP_SUMMARY"
            exit 0
          elif git ls-remote --tags origin "$V" | grep -q "$V"; then
            echo "Tag $V already exists on origin — skipping"
            echo "Tag \`$V\` already exists — idempotent skip per TAG-04" >> "$GITHUB_STEP_SUMMARY"
            exit 0
          fi
          git tag -a "$V" -m "Release $V"
          git push origin "$V"
          {
            echo "## Tag"
            echo "🏷️ Tagged \`$V\` (annotated, pushed to origin)"
          } >> "$GITHUB_STEP_SUMMARY"
      - name: Surface tag failure (workflow stays green per TAG-04)
        if: failure() && steps.<previous-step-id>.outcome == 'failure'  # planner: replace with actual id
        run: |
          {
            echo "## Tag"
            echo "⚠️ Tag step failed (workflow stays green per TAG-04 best-effort)."
            echo "Recovery: \`git tag -a v${{ steps.bump.outputs.next-version-bare }} -m 'Release v${{ steps.bump.outputs.next-version-bare }}' && git push origin v${{ steps.bump.outputs.next-version-bare }}\`"
          } >> "$GITHUB_STEP_SUMMARY"
```

Notes:
- `continue-on-error: true` per TAG-04 + CONTEXT Established-Patterns line 178 ("Best-effort tag step — `continue-on-error: true` only on the tag step (not on any other step in publish.yml)"). This is the ONLY `continue-on-error: true` in the entire workflow.
- Three explicit summary states per CONTEXT D-10 (Created / Skipped / Failed). The Created and Skipped states are written from inside the tag step. The Failed state needs a SEPARATE follow-up step gated on `if: failure()` because once `continue-on-error: true` swallows the error, the step's summary write doesn't run. The follow-up step's `id` reference + `outcome` check is per GitHub Actions docs.
- `git tag -a "$V"` + `-m "Release $V"` produces an **annotated** tag per TAG-03 (annotated tags carry a date + tagger; lightweight tags do not).
- **`fetch-depth: 0`** on `actions/checkout@v5` (already set in line 28 — VERIFY) is required for `git ls-remote --tags` and `git rev-parse` to see existing tags. If the Phase 6 checkout step does NOT have `fetch-depth: 0`, the planner must add it (research/STACK.md line 56: "`fetch-depth: 0` (so `git tag` can see prior tags and reject duplicates cleanly)"). Phase 6's current YAML at line 27-28 reads:
  ```yaml
        - name: Checkout
          uses: actions/checkout@v5
  ```
  No `fetch-depth: 0`! Planner must add `with: { fetch-depth: 0 }` in Phase 7.

**Step ordering — final shape of the modified `publish.yml` job body (lines 26-end):**

| # | Step | Source / status |
|---|------|-----------------|
| 1 | Checkout | EXISTS (Phase 6 line 27-28) — **add `fetch-depth: 0`** |
| 2 | Setup Node.js | EXISTS (line 30-34) — verbatim |
| 3 | Install dependencies | EXISTS (line 36-37) — verbatim |
| 4 | Typecheck | EXISTS (line 38-39) — verbatim |
| 5 | Unit tests | EXISTS (line 40-41) — verbatim |
| 6 | Build (production) | EXISTS (line 42-43) — verbatim |
| 7 | Bundle size gate | EXISTS (line 44-45) — verbatim |
| 8 | Verify all manifest assets exist on disk | EXISTS (line 47-63) — verbatim |
| 9 | Verify TFX_PAT secret resolves | EXISTS (line 65-67) — verbatim |
| 10 | Probe master branch protection | EXISTS (line 69-108) — verbatim per D-9 |
| ~~11~~ | ~~Dry-run — compute next version~~ | **DELETED** (Phase 6 lines 110-123) |
| 11 | Bump version (in-memory only) | NEW |
| 12 | Package vsix | NEW |
| 13 | Upload .vsix artifact | NEW |
| 14 | Publish to Marketplace | NEW (POINT OF NO RETURN) |
| 15 | Commit version bump | NEW |
| 16 | Surface commit-back result | NEW |
| 17 | Tag release (best-effort, idempotent) | NEW |
| 18 | Surface tag failure | NEW (gated on `if: failure()`) |

---

### `.planning/phases/07-bump-publish-tag/07-VERIFICATION.md` (NEW — evidence artifact)

**Analog:** `.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md` (CONTEXT D-7 explicit instruction: "mirrors Phase 6's `branch-protection-probe-result.md` durability posture: human-captured durable evidence, not auto-generated"). Match quality: **exact**.

**Header pattern** (`branch-protection-probe-result.md` lines 1-9):

```markdown
# Master branch-protection probe result

**Probed:** 2026-05-07
**Repo:** tsmshvenieradze/StoryPointExtension
**Endpoint (intended):** `GET /repos/tsmshvenieradze/StoryPointExtension/branches/master/protection`
**Sources:**
1. **Workflow probe** (best-effort, GITHUB_TOKEN-scoped) — `Probe master branch protection` step in `Publish #1` (commit `db633d5`, branch `master`).
2. **Developer probe** (authoritative, admin-scoped) — local `gh api ...` invocation by the repo admin (gh v2.92.0, web-auth flow), cross-verified against direct admin inspection of `Settings → Branches` via the GitHub UI. Both surfaces agreed.
```

**Apply to `07-VERIFICATION.md`:** parallel header — `# Phase 7 verification — first auto-publish (v1.0.7 → v1.0.8)`, `**Verified:** <date>`, `**Repo:** tsmshvenieradze/StoryPointExtension`, `**Workflow run:** <Publish #N URL>`, `**Triggered by:** PR #<N> merge commit <SHA>`.

**Result section pattern** (`branch-protection-probe-result.md` lines 11-15):

```markdown
## Result

**State:** NOT PROTECTED

`master` has no branch protection rule and no branch ruleset that targets it. ...
```

**Apply:** add a `## Result` block with one-line PASS/FAIL state, then a **per-SC evidence section** mirroring the explicit ROADMAP SC list (CONTEXT D-7: "Triple-check captured in `07-VERIFICATION.md`"):

```markdown
## Result

**State:** ALL 6 SUCCESS CRITERIA PASS

## Per-SC evidence

### SC #1 — Marketplace at v1.0.8
- Public listing URL: `https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator`
- Versions table screenshot or text capture: ...
- Raw API response: `curl -s "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/TsezariMshvenieradzeTfsAiReviewTask/extensions/story-point-calculator?api-version=7.1-preview.1" | jq '.versions[0].version'` → `"1.0.8"`

### SC #2 — Bump commit on master
- `git log master --grep 'chore(release)' -n 1`:
  ```
  commit <SHA>
  Author: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>
  Date:   <date>

      chore(release): v1.0.8 [skip ci]
  ```
- Files changed: `package.json` and `vss-extension.json` (atomic two-file diff per SC #2).

### SC #3 — No re-trigger
- Actions tab screenshot or text: only ONE `Publish` run after the merge; no second iteration.
- Triple-defense: `GITHUB_TOKEN` anti-loop + `[skip ci]` token in commit + actor-guard `if: github.actor != 'github-actions[bot]'`.

### SC #4 — Tag v1.0.8 exists
- `git ls-remote --tags origin v1.0.8`: `<SHA>\trefs/tags/v1.0.8`
- The SHA matches the bump commit from SC #2.

### SC #5 — Option B reversibility (verified or deferred)
- Either: deliberately broken-PAT recovery exercise (re-run with revoked PAT, confirm master untouched + Marketplace untouched + clean recovery via `workflow_dispatch`).
- Or: deferred per CONTEXT deferred-section line 220 ("Option B's reversibility is research-locked + ROADMAP SC #5 requires it to be verifiable, not necessarily verified ahead of first run").

### SC #6 — Artifact downloadable
- Workflow artifact name: `vsix-1.0.8` (no `v` prefix per SC #6).
- Retention: 90 days. `if-no-files-found: error` guard active.
- Direct download URL: ...

## Cross-references

- CONTEXT.md decisions: D-5 (first-run-organic), D-6 (pre-merge local checks), D-7 (this artifact's shape), D-10 (tag step three states).
- ROADMAP.md Phase 7 row: 6 success criteria.
```

The structure deliberately mirrors `branch-protection-probe-result.md` lines 30-44 (the per-implication + raw-evidence + cross-reference layout). Per CONTEXT specifics line 200-202: "Triple-check verification artifact (D-7) mirrors Phase 6's `branch-protection-probe-result.md` shape. Per-SC evidence rows + raw API response + cross-references. Lightweight summaries are explicitly rejected — the evidence-per-SC format is what the user pattern is."

## Shared Patterns

### `$GITHUB_STEP_SUMMARY` write convention (apply to ALL load-bearing publish.yml steps per D-8)

**Source:** `.github/workflows/publish.yml` lines 105-108 (probe step) + lines 119-123 (existing dry-run echo, which Phase 7 deletes).

```bash
{
  echo "## <Section title>"
  echo "<one or two human-readable lines, with backticks for values>"
} >> "$GITHUB_STEP_SUMMARY"
```

**Conventions extracted from existing usage:**
- Heredoc-into-redirect pattern (`{ ... } >> "$GITHUB_STEP_SUMMARY"`) — preserves multi-line writes as a single append, avoids interleaving with parallel writes.
- `## <Title>` H2 header per section (probe step uses `## Branch protection probe`; dry-run uses `## Dry-run result`). Phase 7 sections per D-8: `## Bump`, `## Drift reconciled` (conditional), `## Package`, `## Publish`, `## Commit-back`, `## Tag`.
- Backticks around variable values (`\`v${NEXT}\`` per current line 121-122).
- Quote `"$GITHUB_STEP_SUMMARY"` (env-var expansion in shell, double-quoted to handle paths-with-spaces though GitHub-hosted runners never have spaces in their paths).

**Apply per CONTEXT D-8** to: bump step (`## Bump`), drift case (`## Drift reconciled`), package step (`## Package`), publish step (`## Publish`), commit-back step (`## Commit-back`), tag step three states per D-10. Upload-artifact step does NOT need a summary write (default action output is sufficient per D-8 line 75).

### `$GITHUB_OUTPUT` write convention

**Source:** `.github/workflows/publish.yml` lines 102 (probe step `protected=...`) + line 118 (dry-run `next-version=v...`).

```bash
echo "<key>=<value>" >> "$GITHUB_OUTPUT"
```

**Conventions extracted:**
- Single `key=value` per line (no JSON, no multi-line values). Step output expressions reference via `${{ steps.<id>.outputs.<key> }}`.
- Output `id:` MUST be set on the producing step (line 70 `id: protection`, line 111 `id: dryrun`). Phase 7 needs `id: bump` on the bump step.
- Quote `"$GITHUB_OUTPUT"` for the same reason as `$GITHUB_STEP_SUMMARY` above.

**Apply** to `bump-version.mjs` (writes `next-version=v1.0.8` and `next-version-bare=1.0.8`) and any future computed-output step.

### Step `name:` convention (apply to all NEW publish.yml steps)

**Source:** `.github/workflows/ci.yml` + `.github/workflows/publish.yml` lines 27-44 (5 existing gate-step names).

Existing step names use **sentence-case noun phrase, parenthesized context for non-obvious gates**:
- `Checkout`, `Setup Node.js`, `Install dependencies`, `Typecheck`, `Unit tests`
- `Build (production)`, `Bundle size gate (≤ 250 KB gzipped)`
- `Verify all manifest assets exist on disk`, `Verify TFX_PAT secret resolves`, `Probe master branch protection`
- (deleted P6) `Dry-run — compute next version (DOES NOT publish)`

**Apply to net-new steps** (per CONTEXT Claude's-Discretion line 121 — planner picks names that read well):
- `Bump version (in-memory only)` — parenthetical clarifies Option B (no commit yet).
- `Package vsix`
- `Upload .vsix artifact`
- `Publish to Marketplace`
- `Commit version bump`
- `Tag release (best-effort, idempotent)` — parenthetical signals continue-on-error semantics.

DO NOT use comment blocks for rationale (per Phase 6 D-3, carried into Phase 7 CONTEXT line 122-123: "Whether to inline-document the `[skip ci]` mechanism in the workflow YAML — DON'T. Per Phase 6 D-3, rationale belongs in OPERATIONS.md (Phase 8 DOC-02). Step `name:` fields must be self-explanatory; no comment blocks.").

### Action-version pinning convention

**Source:** Phase 6 publish.yml + 06-PATTERNS.md (lines 184-186) + CONTEXT D-12.

Use major-only pins (`@v4`, `@v5`, `@v6`). New pins required by Phase 7:

| Action | Pin | Source |
|--------|-----|--------|
| `actions/upload-artifact@v4` | `@v4` | CI-08 + CONTEXT D-12 + already-locked by Phase 6 |
| `stefanzweifel/git-auto-commit-action@v6` | `@v6` | CI-08 + CONTEXT D-12 + research/STACK.md |

Existing pins (already in place — verify, do not change): `actions/checkout@v5`, `actions/setup-node@v4`.

### Bot identity convention

**Source:** research/PITFALLS.md lines 473-474 + research/STACK.md lines 174-176 + CONTEXT Claude's-Discretion line 117.

```yaml
commit_user_name: "github-actions[bot]"
commit_user_email: "41898282+github-actions[bot]@users.noreply.github.com"
commit_author: "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>"
```

**The user-id `41898282`** is GitHub's documented identity for the `github-actions[bot]` actor — using it gives the commit a verified-signature badge automatically. Do not customize.

### `set -euo pipefail` for multi-line shell

**Source:** `.github/workflows/publish.yml` line 49 (asset-audit step).

```bash
- name: <step name>
  run: |
    set -euo pipefail
    <commands>
```

**Apply** to every NEW multi-line `run:` block in Phase 7 (package vsix, publish, tag steps). Single-line `run:` blocks (e.g., `run: node scripts/bump-version.mjs`) do not need it.

### Log-prefix convention for `scripts/*.{cjs,mjs}`

**Source:** `scripts/check-bundle-size.cjs` (`[check:size]`) + `scripts/publish-cezari.cjs` line 24 (`const LOG_PREFIX = "[publish:cezari]";`).

```javascript
const LOG_PREFIX = "[<script-name>]";
console.log(`${LOG_PREFIX} <message>`);
console.error(`${LOG_PREFIX} ABORT: <reason>`);
```

**Apply** to `bump-version.mjs`: `const LOG_PREFIX = "[bump-version]";`. Note: `::warning::` annotations are an exception — those go to stderr WITHOUT the prefix because GitHub Actions parses the `::warning::<message>` line as a structured annotation; a leading `[bump-version]` would corrupt it.

## No Analog Found

| File / Pattern | Reason | Mitigation |
|----------------|--------|------------|
| First-party ESM `.mjs` script | Project has zero first-party `.mjs` files; all four `scripts/*.cjs` use CommonJS | Translation pattern given above (`require` → `import`, `__dirname` via `import.meta.url`). Node 20+ supports both natively. |
| Vitest test that subprocess-invokes a Node script | All existing vitest tests are pure in-memory (`tests/**/*.test.ts`); none use `child_process.spawnSync` against a script | Subprocess pattern given above; reuse `shell: process.platform === "win32"` from `publish-cezari.cjs` line 30 for cross-platform parity. |
| Vitest test in a non-`tests/**/*.test.ts` location | `vitest.config.ts` line 8 only includes `tests/**/*.test.ts` | Two options for the planner: (A) place at `tests/scripts/bump-version.test.mjs` (no config change, recommended); (B) extend vitest `include:` glob. |
| `git-auto-commit-action@v6` usage | First commit-back action in the project | Canonical config block from research/STACK.md lines 167-178 + CONTEXT Claude's-Discretion line 117 (bot identity). |
| `actions/upload-artifact@v4` usage | First artifact upload in the project | Canonical block from research/ARCHITECTURE.md lines 124-132. |
| `tfx extension publish` in CI | First CI invocation; only prior usage is local-only via `scripts/publish-cezari.cjs` | Use `publish-cezari.cjs` line 84-91 invocation as the seed; add `--auth-type pat` and `--no-prompt` per Pitfall 5 + research/PITFALLS.md line 220-232. |
| Idempotent `git tag` push | First tag-push step in the project | Canonical from research/PITFALLS.md lines 611-620 (the local-and-remote existence check). |
| Three-state step-summary write driven by `if: failure()` follow-up | First conditional-summary pattern in the project | Per-D-10 split: success/skip states written from inside the tag step; failure state written from a follow-up step gated on `if: failure() && steps.<id>.outcome == 'failure'`. |
| `## Drift reconciled` block emitted from a Node script (NOT a YAML step) | All existing `$GITHUB_STEP_SUMMARY` writes are from inline shell in YAML | The bump script writes the block via `appendFileSync(process.env.GITHUB_STEP_SUMMARY, ...)`. Same target file, same `## Header` convention. Tested by D-3 vitest drift case. |

## Conventions Worth Preserving

1. **2-space JSON indent + trailing `\n`** — both `package.json` and `vss-extension.json` already follow this; `bump-version.mjs` MUST use `JSON.stringify(obj, null, 2) + "\n"` to avoid trashing the diff.
2. **Bracket-prefixed log lines** for `scripts/*.{cjs,mjs}` — every existing script uses `[script-name]` log prefix; bump-version.mjs adopts `[bump-version]`.
3. **`@v<major>` action pins** (NOT SHA-pinned, NOT minor-pinned) — matches existing convention; Phase 7 adds `@v4` (upload-artifact) and `@v6` (git-auto-commit-action).
4. **Sentence-case step `name:` strings** with parenthesized context for non-obvious gates — copy from existing publish.yml/ci.yml.
5. **`set -euo pipefail` for any multi-line `run:` block** — asset-audit step at line 49 already establishes the pattern; Phase 7 NEW multi-line steps follow it.
6. **Step-summary `## <Title>` H2 headers** — matches probe + dry-run conventions; new sections are `## Bump`, `## Drift reconciled`, `## Package`, `## Publish`, `## Commit-back`, `## Tag`.
7. **No comment blocks in workflow YAML for rationale** — per Phase 6 D-3 carried forward in CONTEXT line 122-123. Step names must be self-explanatory; rationale lives in OPERATIONS.md (Phase 8).
8. **Per-SC evidence in verification artifacts** (NOT lightweight prose summaries) — explicit user pattern per CONTEXT specifics line 200-202.

## Metadata

**Analog search scope:** `.github/workflows/`, `scripts/`, `tests/`, repo-root manifests (`package.json`, `vss-extension.json`, `vitest.config.ts`), `.planning/phases/06-workflow-scaffold-and-gates/`, `.planning/research/`.

**Files scanned:** 12 (publish.yml, ci.yml, check-bundle-size.cjs, publish-cezari.cjs, generate-icon.cjs, generate-toolbar-icon.cjs, generate-placeholder-icon.cjs, package.json, vss-extension.json, vitest.config.ts, calcEngine.test.ts, parse.test.ts).

**Strong analogs:** 3 — `tests/audit/parse.test.ts` (vitest shape), `.github/workflows/publish.yml` itself (P6 scaffold), `branch-protection-probe-result.md` (P6 verification artifact).

**Partial analogs:** 1 — `scripts/check-bundle-size.cjs` (role + invocation contract for `bump-version.mjs`; differs on module system + output channel).

**Pattern-only (no first-party code):** 1 — `git-auto-commit-action@v6` + `actions/upload-artifact@v4` + idempotent `git tag` + ESM `.mjs` shape — all canonicalized from research/STACK.md, research/PITFALLS.md, research/ARCHITECTURE.md.

**Pattern extraction date:** 2026-05-08.
