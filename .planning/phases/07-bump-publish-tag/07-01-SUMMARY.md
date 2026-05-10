---
phase: 07-bump-publish-tag
plan: 01
subsystem: infra
tags: [github-actions, ci-cd, marketplace, publish-workflow, bump-script, esm, vitest, tfx-cli]

# Dependency graph
requires:
  - phase: 06-workflow-scaffold-and-gates/03
    provides: branch-protection-probe-result.md (NOT PROTECTED) → default GITHUB_TOKEN + permissions: contents: write at job level is sufficient; no App / RELEASE_PAT needed
provides:
  - scripts/bump-version.mjs — in-memory max-wins patch bump for the publish workflow (BUMP-01..05)
  - tests/scripts/bump-version.test.mjs — 2 vitest cases (happy path + drift) per D-3
  - vitest.config.ts include glob extended to pick up tests/**/*.test.mjs
  - .github/workflows/publish.yml — dry-run echo replaced with the 8-step real publish chain (PUBLISH-01..05, TAG-01..04)
affects: [07-02, 08-cleanup-and-runbooks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - First-party ESM (.mjs) script — Node 20+ default; no first-party analog before this commit (all four prior scripts/*.cjs use CommonJS)
    - Subprocess-invoked vitest test for a script with filesystem + env-var side effects — temp-dir scaffolding via mkdtempSync, env injected via spawnSync env: option, cross-platform shell flag (process.platform === "win32") matches publish-cezari.cjs precedent
    - GitHub Actions step-summary fan-out — every load-bearing step appends a `## <Section>` block to $GITHUB_STEP_SUMMARY (D-8)
    - actions/upload-artifact@v4 with bare version (no `v` prefix) per ROADMAP SC #6 — bump script emits both next-version (with v) and next-version-bare (without v) so each downstream step picks the correct flavor
    - stefanzweifel/git-auto-commit-action@v6 with canonical bot identity (41898282+github-actions[bot]) and `[skip ci]` token in commit message — triple anti-loop defense
    - Idempotent annotated git tag step with continue-on-error: true and three explicit step-summary states (Created / Skipped / Failed via if: failure() follow-up)

key-files:
  created:
    - scripts/bump-version.mjs — 102 lines. ESM, max-wins drift policy (D-1), in-memory two-file write (BUMP-04), $GITHUB_OUTPUT emits next-version + next-version-bare (D-4), $GITHUB_STEP_SUMMARY ## Bump always + ## Drift reconciled when applicable (D-2, D-8). Belt-and-suspenders aborts: exit 2 (read fail), exit 3 (malformed JSON), exit 4 (GITHUB_OUTPUT unset).
    - tests/scripts/bump-version.test.mjs — 95 lines. Two `it(...)` cases (NOT it.each). Per-test mkdtempSync, cpSync of the real script into the temp dir, fixture pkg.json + vss-extension.json, temp $GITHUB_OUTPUT + $GITHUB_STEP_SUMMARY paths injected via spawnSync env. afterEach rmSync. Cross-platform shell flag.
  modified:
    - vitest.config.ts — single-line change: include array extended from ['tests/**/*.test.ts'] to ['tests/**/*.test.ts', 'tests/**/*.test.mjs']. Coverage thresholds for src/calc/** and src/audit/** unaffected (the new test is in tests/scripts/, NOT subject to those thresholds).
    - .github/workflows/publish.yml — 4 surgical edits: (1) job name `Publish to Marketplace (dry-run in P6)` → `Publish to Marketplace`; (2) Checkout step gains `with: { fetch-depth: 0 }`; (3) job-level `permissions: contents: write` block inserted between actor-guard and steps:; (4) the 14-line `Dry-run — compute next version` step (lines 110-123) replaced with 8 new steps totaling ~91 net new lines.

key-decisions:
  - "Test file placed at tests/scripts/bump-version.test.mjs (Option B from 07-PATTERNS.md) — extends the vitest include glob with `tests/**/*.test.mjs` rather than placing the test under scripts/. Rationale: the plan explicitly pins this location in `<files>` and the acceptance criteria, and matches the existing tests/ tree convention."
  - "Wrapped the file-read in a try/catch helper (readJson) so the exit-2 (missing) and exit-3 (malformed) belt-and-suspenders aborts have a single source of truth — keeps the main control flow linear."
  - "Drift `::warning::` line is a literal `console.error(\"::warning::...\")` with NO LOG_PREFIX prepended (per D-2 + 07-PATTERNS.md line 95). Every other stdout/stderr line uses `${LOG_PREFIX}` — the drift line is the explicit single exception."
  - "ghSummary writes structured as: drift-block-then-bump-block when drifted, bump-block-only otherwise — matches CONTEXT D-2 + D-8 ordering. Both writes are guarded by `if (ghSummary)` so the script doesn't crash when run outside CI (e.g., during the local D-6 smoke check)."

patterns-established:
  - "Pattern: ESM scripts in scripts/ — bump-version.mjs is the first .mjs in the project. Pattern: shebang `#!/usr/bin/env node` + named imports from `node:fs` + `import.meta.url`-derived `__dirname` + `path.resolve(__dirname, '..')` for repo-root + bracketed LOG_PREFIX on every console line except `::warning::` annotations."
  - "Pattern: subprocess-invoked vitest for scripts with side effects — mkdtempSync for isolation, cpSync to copy the script under test into the sandbox, spawnSync with env override and `shell: process.platform === 'win32'`. Cleaner than re-importing the script (which would run top-level code on import)."
  - "Pattern: $GITHUB_STEP_SUMMARY fan-out — bump (## Bump + optional ## Drift reconciled), package (## Package), publish (## Publish), commit-back (## Commit-back), tag (## Tag with three states). Upload-artifact uses default action output. One run = one readable summary panel."
  - "Pattern: idempotent annotated tag with three-state surfacing — local check via `git rev-parse $V`, remote check via `git ls-remote --tags origin $V`, both with explicit ## Tag summary lines; failed state surfaced by a separate step gated on `if: failure() && steps.tag.outcome == 'failure'` because continue-on-error swallows the in-step summary write."

requirements-completed:
  - BUMP-01
  - BUMP-02
  - BUMP-03
  - BUMP-04
  - BUMP-05
  - PUBLISH-01
  - PUBLISH-02
  - PUBLISH-03
  - PUBLISH-04
  - PUBLISH-05
  - TAG-01
  - TAG-02
  - TAG-03
  - TAG-04

# Metrics
duration: ~25min
completed: 2026-05-11
---

# Phase 07 Plan 01: Bump script + publish.yml swap Summary

**Atomic implementation — one PR delivers `scripts/bump-version.mjs` (ESM, in-memory max-wins patch bump), two vitest cases, the vitest-config glob extension, and the `.github/workflows/publish.yml` swap from dry-run echo to the real bump → tfx create → upload-artifact → tfx publish → commit-back → tag chain. The merge of THIS PR IS the first organic auto-publish per D-5.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-05-11
- **Tasks:** 2 (Task 1: bump script + tests + vitest config; Task 2: publish.yml swap)
- **Files created:** 2 (`scripts/bump-version.mjs`, `tests/scripts/bump-version.test.mjs`)
- **Files modified:** 2 (`vitest.config.ts`, `.github/workflows/publish.yml`)
- **Vitest:** 400/400 passing (398 prior + 2 new)
- **Typecheck:** clean (`tsc --noEmit` exits 0)

## Accomplishments

- Added `scripts/bump-version.mjs` — the first first-party ESM script in the project. Reads `package.json` and `vss-extension.json`, picks `max(pkg, manifest)` as "current" (D-1 max-wins), increments the patch, writes both files (`JSON.stringify(obj, null, 2) + "\n"`), and emits `next-version=v<X.Y.Z>` + `next-version-bare=<X.Y.Z>` to `$GITHUB_OUTPUT` (D-4). Drift surfacing: `::warning::Drift reconciled: ...` to stderr (no LOG_PREFIX — would corrupt the GitHub annotation parser per D-2 / 07-PATTERNS.md line 95) and `## Drift reconciled` block to `$GITHUB_STEP_SUMMARY`. `## Bump` block always written on success (D-8). No git, no shell-out, no external deps (BUMP-04, in-memory only).
- Added `tests/scripts/bump-version.test.mjs` — two vitest cases per D-3. Each test scaffolds a unique temp directory, copies `scripts/bump-version.mjs` into it, writes minimal fixture `package.json` + `vss-extension.json`, runs the script via `spawnSync` with `GITHUB_OUTPUT` + `GITHUB_STEP_SUMMARY` injected via env, and asserts on the script's exit status, the rewritten file contents, the captured output file, the captured summary file, and stderr. Cross-platform shell flag (`shell: process.platform === "win32"`) per the `publish-cezari.cjs` precedent. `afterEach` `rmSync` keeps the temp tree clean.
- Extended `vitest.config.ts` `include` glob from `['tests/**/*.test.ts']` to `['tests/**/*.test.ts', 'tests/**/*.test.mjs']` so the new test is picked up by `npm test`. Coverage thresholds for `src/calc/**` and `src/audit/**` are scoped by include and unaffected by this addition.
- Replaced the 14-line `Dry-run — compute next version` step in `.github/workflows/publish.yml` with the 8-step real publish chain (Bump → Package → Upload → Publish → Commit → Surface commit-back → Tag → Surface tag failure). Added `with: { fetch-depth: 0 }` on the Checkout step so the tag step can `git ls-remote/rev-parse` prior tags. Inserted a job-level `permissions: contents: write` block (top-level remains `contents: read` — POLP). Stripped `(dry-run in P6)` from the job name.
- Triple anti-loop defense intact: actor-guard `if: github.actor != 'github-actions[bot]'` at job level (carry-over) + `[skip ci]` token in the bump-back commit message (`commit_message: "chore(release): ${{ steps.bump.outputs.next-version }} [skip ci]"`) + default `GITHUB_TOKEN` (which by GitHub design does not re-trigger workflows).
- Branch-protection probe (Phase 6 carry-over) preserved verbatim per D-9. No control-flow gating on its output — it remains a future-protection canary that surfaces probe state in run summaries.

## Task Commits

| # | Subject | Hash |
|---|---------|------|
| 1 | `feat(07-01): add bump-version.mjs ESM script + 2 vitest cases (BUMP-01..05)` | `c5bbe47` |
| 2 | `feat(07-01): swap publish.yml dry-run for real publish chain (PUBLISH-01..05, TAG-01..04)` | `1e829c9` |

Both commits land on `milestone1.1`; the third docs commit (this SUMMARY) follows.

## Files Created / Modified

### `scripts/bump-version.mjs` (NEW, 102 lines)

11 named imports from `node:fs` (`readFileSync`, `writeFileSync`, `appendFileSync`) + `node:url` (`fileURLToPath`) + `node:path` (default). One helper (`readJson`) wraps read + parse with exit-2 / exit-3 belts-and-suspenders. One inline `semverMax(a, b)` helper (5 lines, no `semver` npm dep). Main flow: read both files → capture originals → detect drift → compute next via `parseInt`-tuple split → mutate both pkg + manifest → write both files → require `GITHUB_OUTPUT` (exit 4 if unset) → append both `next-version=v<X.Y.Z>` and `next-version-bare=<X.Y.Z>` lines → if drifted, emit warning + drift block → always emit `## Bump` block when summary file is set → final stdout `[bump-version] Bumped to v<X.Y.Z> (from <current>)`.

### `tests/scripts/bump-version.test.mjs` (NEW, 95 lines)

`describe('bump-version.mjs (BUMP-05, D-3)', () => { ... })` with closure-scoped `tempDir`, `outputPath`, `summaryPath` and three helpers: `setupRepo({pkg, manifest})`, `runBump()`, `readPkg()` / `readManifest()`. `beforeEach` does `mkdtempSync` + creates `scripts/` subdir + `cpSync` of the real script + touches `gh-output.txt` and `gh-summary.md`. Two `it(...)` cases:
- happy path: `setupRepo({pkg: '1.0.7', manifest: '1.0.7'})` → both end at 1.0.8, both `next-version=v1.0.8` and `next-version-bare=1.0.8` in output file, `r.stderr` does NOT contain `::warning::`, summary contains `## Bump` and does NOT contain `## Drift reconciled`.
- drift: `setupRepo({pkg: '1.0.7', manifest: '1.0.6'})` → both end at 1.0.8 (max+1), `r.stderr` contains `::warning::Drift reconciled`, summary contains both `## Drift reconciled` AND `## Bump`.

### `vitest.config.ts` (MODIFIED, 1 line)

Line 8: `include: ['tests/**/*.test.ts'],` → `include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],`. No other change.

### `.github/workflows/publish.yml` (MODIFIED, 4 surgical edits)

Lines 1-25 (header / on / paths-ignore / concurrency / top-level permissions: read) carry over byte-identical from Phase 6.

| # | Edit | Diff lines |
|---|------|-----------|
| 1 | Job name `Publish to Marketplace (dry-run in P6)` → `Publish to Marketplace` | -1 / +1 |
| 2 | Checkout step gains `with: { fetch-depth: 0 }` (2 new lines) | 0 / +2 |
| 3 | Job-level `permissions: contents: write` block inserted before `steps:` | 0 / +2 |
| 4 | 14-line `Dry-run — compute next version` step replaced with 8 new steps | -14 / +91 |

Net: 1 modification + 11 new lines preceding the dry-run zone, plus 91 new lines replacing 14. Step count in the publish job: 18 (10 carry-over from Phase 6 + 8 new).

#### Eight new steps (in order)

1. **Bump version (in-memory only)** — `id: bump`, `run: node scripts/bump-version.mjs`. Single-line, no `set -euo pipefail` needed.
2. **Package vsix** — `npx tfx extension create --manifest-globs vss-extension.json --output-path dist/`, then `du -k` for the size figure, then `## Package` summary block. `set -euo pipefail`.
3. **Upload .vsix artifact** — `actions/upload-artifact@v4`, `name: vsix-${{ steps.bump.outputs.next-version-bare }}` (NO `v` prefix per ROADMAP SC #6), `path: dist/*.vsix`, `retention-days: 90`, `if-no-files-found: error`. No summary write (default action output sufficient per D-8).
4. **Publish to Marketplace** — `env: TFX_PAT: ${{ secrets.TFX_PAT }}` block (NOT inline interpolation per Pitfall 5 / D-12); `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation`; `## Publish` summary block + listing URL. `set -euo pipefail`. **THIS IS THE POINT OF NO RETURN.**
5. **Commit version bump** — `id: commit`, `stefanzweifel/git-auto-commit-action@v6`, `commit_message: "chore(release): ${{ steps.bump.outputs.next-version }} [skip ci]"`, canonical bot identity (`41898282+github-actions[bot]@users.noreply.github.com`), `file_pattern: "package.json vss-extension.json"`. NO built-in tagging (D-12 / Claude's-Discretion line 117).
6. **Surface commit-back result** — single `## Commit-back` block referencing `${{ steps.commit.outputs.commit_hash }}`.
7. **Tag release (best-effort, idempotent)** — `id: tag`, `continue-on-error: true` (the ONLY step in the workflow with this), `set -euo pipefail`. Local check (`git rev-parse $V`) → remote check (`git ls-remote --tags origin $V | grep -q "$V"`) → `git tag -a "$V" -m "Release $V"` + `git push origin "$V"` → `## Tag` summary with one of three states (`🏷️ Tagged …`, `Tag … already exists — idempotent skip per TAG-04`).
8. **Surface tag failure** — gated on `if: failure() && steps.tag.outcome == 'failure'`; writes the failed-state `## Tag` summary line + recovery hint.

## Anti-pattern audit results

All forbidden strings checked against the modified file:

| Forbidden string | Grep count | Status |
| --- | --- | --- |
| `Dry-run — compute next version` | 0 | OK (deleted) |
| `would publish v` | 0 | OK (deleted) |
| `(dry-run in P6)` | 0 | OK (deleted) |

Bump script anti-pattern audit:

| Forbidden string in `scripts/bump-version.mjs` | Grep count | Status |
| --- | --- | --- |
| `require(` | 0 | OK (ESM only) |
| `child_process` / `spawn` / `exec` | 0 | OK (in-memory; no shell-out) |
| `git ` | 0 | OK (BUMP-04: no git from the script) |
| `console.error.*\[bump-version\].*::warning::Drift reconciled` (single line co-occurrence) | 0 | OK (D-2 — bracketed prefix and `::warning::` annotation never share a line) |

## Required-string audit results (publish.yml)

All required-string grep checks from PLAN.md acceptance criteria pass — confirmed via the inline node verifier in Task 2's `<verify>` block (script printed `publish.yml structure OK`). Highlights:

| Required string | Grep count | Status |
| --- | --- | --- |
| `^    name: Publish to Marketplace$` | 1 | OK (no dry-run suffix) |
| `fetch-depth: 0` | 1 | OK |
| `^    permissions:$` (job-level block) | >= 1 | OK |
| `contents: write` | 1 | OK (job-level only) |
| `contents: read` | 1 | OK (top-level baseline preserved) |
| `id: bump` / `id: commit` / `id: tag` | 1 each | OK |
| `node scripts/bump-version.mjs` | 1 | OK |
| `actions/upload-artifact@v4` | 1 | OK |
| `vsix-${{ steps.bump.outputs.next-version-bare }}` | 1 | OK |
| `retention-days: 90` | 1 | OK |
| `if-no-files-found: error` | 1 | OK |
| `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation` | 1 | OK |
| `TFX_PAT: ${{ secrets.TFX_PAT }}` (in env: block, not inline) | 1 | OK |
| `stefanzweifel/git-auto-commit-action@v6` | 1 | OK |
| `41898282+github-actions[bot]@users.noreply.github.com` | >= 1 | OK |
| `[skip ci]` | 1 | OK (in commit_message) |
| `continue-on-error: true` | EXACTLY 1 | OK (only on the tag step) |
| `git tag -a` / `git push origin` / `git ls-remote --tags origin` / `git rev-parse` | 1 each | OK |
| `if: failure() && steps.tag.outcome == 'failure'` | 1 | OK |
| `## Package` / `## Publish` / `## Commit-back` | 1 each | OK |
| `## Tag` | >= 2 | OK (idempotent skip path + Tagged path; failed-state path is in the follow-up step) |
| `workflow_dispatch:` / `paths-ignore:` / `concurrency:` | 1 each | OK (P6 carry-over) |
| `if: github.actor != 'github-actions[bot]'` | 1 | OK (CI-06 actor-guard preserved) |
| `Probe master branch protection` | 1 | OK (D-9) |

`## Bump` lives in `scripts/bump-version.mjs` (the script writes it via `appendFileSync($GITHUB_STEP_SUMMARY, ...)`), NOT in publish.yml — this is intentional per the plan's explicit note in the Step-summary section (Task 2 acceptance criteria).

## Decisions Made

1. **Test file location: `tests/scripts/bump-version.test.mjs` (Option B from 07-PATTERNS.md).** The plan's `<files>` block and acceptance criteria pin this path. To make it pickup-able by `npm test`, extended `vitest.config.ts`'s `include` glob with `tests/**/*.test.mjs`. Lower-risk than co-locating under `scripts/` (which would require an additional `'scripts/**/*.test.mjs'` glob entry and could pull future scripts/* utility files into the coverage scope).
2. **Single literal split-import line: `import { readFileSync, writeFileSync, appendFileSync } from "node:fs";`.** The acceptance criteria pin this exact line via grep. Combining `fileURLToPath` with `path` in separate import statements (`import { fileURLToPath } from "node:url"; import path from "node:path";`) keeps the named-vs-default distinction clean and matches the `node:` protocol convention used in every existing `scripts/*.cjs`.
3. **`readJson` helper for both pkg + manifest.** Wraps the read + parse + exit-2 / exit-3 belts-and-suspenders into a single function. Two main-flow lines (`const pkg = readJson(PKG_PATH); const manifest = readJson(MANIFEST_PATH);`) instead of duplicated try/catch blocks. Linear control flow.
4. **`pkg_orig` / `manifest_orig` captured via simple variable assignment, not `structuredClone`.** The originals are only used as primitive strings (logged in the drift annotation + summary block), so cloning is unnecessary; the simple capture is the lightest pattern.
5. **`## Bump` block written AFTER the `## Drift reconciled` block when both apply.** Mirrors the natural reading order in the run summary panel: drift (the unusual case) before the standard bump summary. CONTEXT D-2 says "either is fine" — picked the order that surfaces the unusual signal first.
6. **Cross-platform `shell: process.platform === "win32"` flag in the test's `spawnSync`.** Mirrors the precedent in `scripts/publish-cezari.cjs:30`. The user's local machine is Windows; CI is Ubuntu — the flag protects both. Vitest already runs cleanly on Windows in this repo.
7. **`mkdirSync(path.join(tempDir, "scripts"), { recursive: true })` before `cpSync`.** `cpSync` won't auto-create the parent directory for a file copy; explicit `mkdirSync` keeps the test setup deterministic.
8. **No `tagging_message` configured on `git-auto-commit-action@v6`.** The action's built-in tagging is explicitly avoided (CONTEXT Claude's-Discretion line 117 — the separate `git tag -a` step gives finer control over idempotency and three-state surfacing).

## Deviations from Plan

**None.** Both tasks landed verbatim per the canonical templates in `07-PATTERNS.md` (with the helper extraction in decision 3 above being the only meaningful prose-to-code interpolation; the YAML for `publish.yml` was the exact code block from PLAN.md Task 2 `<action>` step 4).

## Issues Encountered

**None.** Two minor surface notes for awareness, not actual issues:
- **Git CRLF line-ending warnings** for the two new files (`scripts/bump-version.mjs`, `tests/scripts/bump-version.test.mjs`) on the Windows working tree — `git add` reported `LF will be replaced by CRLF the next time Git touches it`. This is normal Windows + Git autocrlf behavior; the committed objects retain LF endings. Vitest and node both handle either ending transparently.
- **`(node:43224) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities`** is emitted by Node 20+ when the test's `spawnSync` runs with `shell: true`. This is the documented cross-platform compatibility pattern (CONTEXT 07-PATTERNS.md line 214) — args are repo-internal constants (`["scripts/bump-version.mjs"]`), no user-supplied input is shelled out, and the warning is informational. The deprecation is on the API surface, not on this usage. Suppressing it would require dropping the cross-platform support.

## User Setup Required

**None for this plan.** Plan 07-02 owns the pre-merge user actions (D-6 local checks: `npx tfx extension publish --help` flag re-verify + `node scripts/publish-cezari.cjs` PAT smoke).

## Next Phase Readiness

- **Plan 07-02** (verification observation, blocking checkpoints) is unblocked. Its three tasks are sequenced: (1) pre-merge D-6 local checks (BEFORE merging this PR); (2) watch the merge run go green; (3) write `07-VERIFICATION.md` capturing per-SC evidence for ROADMAP's 6 success criteria. The actual first-organic publish (v1.0.7 → v1.0.8) happens during step 2 — i.e., the merge of THIS plan's PR fires `publish.yml` on master and ships v1.0.8. No code lives in 07-02; only verification artifacts.
- **Phase 8** (cleanup + runbooks) remains gated on Phase 7 closure. The archival of `scripts/publish-cezari.cjs` (CLEAN-01..03) and the writing of `OPERATIONS.md` (DOC-01, DOC-02) deliberately wait until after the first green auto-publish.

## Self-Check: PASSED

**File artifact checks:**
- `test -f scripts/bump-version.mjs` → PASS
- `test -f tests/scripts/bump-version.test.mjs` → PASS
- `grep -q "tests/\\*\\*/\\*.test.mjs" vitest.config.ts` → PASS
- All 26 acceptance-criteria grep checks (positive + negative) on `scripts/bump-version.mjs` → PASS
- All 13+ acceptance-criteria grep checks on `tests/scripts/bump-version.test.mjs` → PASS
- All ~40 acceptance-criteria grep checks (positive + negative) on `.github/workflows/publish.yml` → PASS (verified by Task 2's inline node verifier exiting 0)

**Behavioral checks:**
- `npx vitest run tests/scripts/bump-version.test.mjs` → 2 passed ✓
- `npm test` → 400/400 passed ✓
- `npm run typecheck` → exits 0 ✓

**Commit checks:**
- Task 1: `c5bbe47` (`feat(07-01): add bump-version.mjs ESM script + 2 vitest cases (BUMP-01..05)`)
- Task 2: `1e829c9` (`feat(07-01): swap publish.yml dry-run for real publish chain (PUBLISH-01..05, TAG-01..04)`)

**Plan-output check:** PR diff scope strictly limited to the four files declared in `files_modified` — `scripts/bump-version.mjs` (new), `tests/scripts/bump-version.test.mjs` (new), `vitest.config.ts` (1-line glob extension), `.github/workflows/publish.yml` (4 surgical edits). No change to `package.json`, `vss-extension.json`, `ci.yml`, or `scripts/publish-cezari.cjs` (the latter's archival is Phase 8). The 1.0.7 → 1.0.8 version bump in `package.json` and `vss-extension.json` happens at run time when the merged workflow fires `bump-version.mjs` on master — NOT in this PR diff (BUMP-04 / Option B).

---

*Phase: 07-bump-publish-tag*
*Plan: 01*
*Completed: 2026-05-11*
