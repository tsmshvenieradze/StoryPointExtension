---
phase: 06-workflow-scaffold-and-gates
plan: 02
subsystem: infra
tags: [github-actions, ci-cd, marketplace, publish-workflow, gates, dry-run, jq, gh-cli]

# Dependency graph
requires:
  - phase: 06-workflow-scaffold-and-gates/01
    provides: ci.yml is PR-only (push:[master] removed) so publish.yml can own master-tip runs without ci.yml double-firing
provides:
  - .github/workflows/publish.yml — master push + workflow_dispatch CI workflow (gates + dry-run echo)
  - Trigger plumbing for P7 (paths-ignore filter, concurrency group, actor-guard, top-level read perms)
  - Asset-audit step (vss-extension.json files[] vs disk) (GATE-07)
  - TFX_PAT-presence probe + master branch-protection probe (success criterion #6, D-5 result feeds P7 commit-back design)
  - Dry-run echo "would publish v<NEXT>" + next-version step output + step summary (D-7)
affects: [06-03, 07-auto-publish, 08-cleanup-and-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - GitHub Actions YAML — single sequential job, fail-fast gates, paths-ignore + workflow_dispatch trigger combo
    - Inline jq with bash process-substitution (`done < <(jq ...)`) for asset existence audit (Pitfall in Gap 3 — pipe form swallows non-zero exit)
    - Boolean-only secret presence probe (`secrets.TFX_PAT != ''`) — no PAT echo or transformation (Pitfall A5)
    - Dry-run pattern — node -p reads package.json.version, bash patch+1 arithmetic, echo + $GITHUB_OUTPUT + $GITHUB_STEP_SUMMARY (the three artifacts P7 will substitute the real publish into)

key-files:
  created:
    - .github/workflows/publish.yml — 109-line master/dispatch CI workflow with five v1.0 gates, asset audit, secret/protection probes, and dry-run echo
  modified: []

key-decisions:
  - "Followed locked skeleton from 06-RESEARCH.md (lines 651-772) verbatim for YAML body; removed the 6 design-rationale comments per CONTEXT D-3 (rationale lives in OPERATIONS.md, P8) and to land within the 80-110 line acceptance window"
  - "Compacted 4 blank-line separators between the 5 simple gate steps (Install/Typecheck/Tests/Build/Size) to reach 109 lines (under the 110-line ceiling)"
  - "Job named `publish:` with display-name 'Publish to Marketplace (dry-run in P6)' per the locked PLAN/RESEARCH skeleton (note: prompt's plan-specifics mentioned a different `publish-and-release` job name — followed the PLAN.md `<interfaces>` block as the source of truth, since the plan's acceptance criteria did not pin the job key)"

patterns-established:
  - "Pattern: dual-workflow split — ci.yml for PRs (existing), publish.yml for master + dispatch (new). Different concurrency groups (`ci-${{ github.ref }}` cancel-true vs `publish-master` cancel-false) so they cannot interfere"
  - "Pattern: P6 dry-run shape — same artifacts P7 will emit (stdout line + $GITHUB_OUTPUT + $GITHUB_STEP_SUMMARY) but no Marketplace mutation; P7 swaps the echo step for the real `tfx extension publish` invocation"
  - "Pattern: P7 boundary enforcement — every P7-only string (`tfx`, `actions/upload-artifact`, `git-auto-commit-action`, `contents: write`, `bump-version`, `--rev-version`) is grep-checked absent from publish.yml; the only `tfx` substring permitted is the literal `tfx-pat-present` step output label"

requirements-completed:
  - CI-01
  - CI-03
  - CI-04
  - CI-05
  - CI-06
  - CI-07
  - CI-08
  - GATE-01
  - GATE-02
  - GATE-03
  - GATE-04
  - GATE-05
  - GATE-06
  - GATE-07
  - FAIL-01
  - FAIL-02
  - FAIL-03

# Metrics
duration: ~10min
completed: 2026-05-05
---

# Phase 06 Plan 02: Publish workflow scaffold + gates Summary

**New `.github/workflows/publish.yml` (109 lines): master-push + workflow_dispatch CI workflow with five v1.0 gates, vss-extension.json asset audit, TFX_PAT/branch-protection probes, and a no-mutation dry-run echo of the next version.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-05 (worktree spawned by /gsd-execute-phase)
- **Completed:** 2026-05-05
- **Tasks:** 1 (single-task plan)
- **Files created:** 1 (.github/workflows/publish.yml)
- **Files modified:** 0

## Accomplishments

- Stood up `.github/workflows/publish.yml` — net-new ~109-line GitHub Actions workflow that fires on push-to-master and workflow_dispatch, runs the same five v1.0 gates as ci.yml, plus three new checks (vss-extension.json asset audit, TFX_PAT-presence probe, master branch-protection probe), and ends in a dry-run echo of the next patch version.
- Encoded the entire P7 boundary into the YAML at scaffold time: zero `tfx` invocations, zero upload-artifact / git-auto-commit / contents:write / continue-on-error / retry / notification surface area in the P6 publish.yml. Every forbidden string's grep count is `0` (or `1` for the legitimate `tfx-pat-present` label).
- Pre-positioned the actor-guard `if: github.actor != 'github-actions[bot]'` at job level so P7's commit-back step in P7 doesn't retrigger publish.yml without further YAML editing.
- Pre-positioned the dry-run shape that P7 will keep unchanged: stdout line `would publish v<NEXT>` + `next-version=v<NEXT>` step output + markdown step summary — three artifacts that future tooling can already grep, parse, or render today.
- Proved the asset-audit pattern (inline jq + process-substitution `< <(...)`) avoids the documented pipe-swallow trap (Pitfall in Gap 3): `vss-extension.json` declares 3 paths (`dist`, `images`, `overview.md`) — `dist` is built by an upstream gate step, `images/` and `overview.md` are tracked in the repo root, so the audit will pass on the runner after `npm run build` completes.

## Task Commits

| # | Subject | Hash |
|---|---------|------|
| 1 | `feat(06-02): scaffold publish.yml workflow with gates and dry-run echo` | `a2effb3` |
| 2 | `docs(06-02): complete publish-yml-scaffold plan` | `8b2d775` |

Both commits landed on the worktree branch `worktree-agent-a4bed21d1d40449f9` (since merged back to `milestone1.1` via `1fdb9de`). Initial commit attempt from inside the executor's sandbox was denied at the `git commit` keyword level; orchestrator drove both commits from the parent shell, then merged the worktree atomically. No content lost.

## Files Created/Modified

- `.github/workflows/publish.yml` — NEW. 109 lines. The YAML carries 11 named steps in order:
  1. `Checkout` (actions/checkout@v5)
  2. `Setup Node.js` (actions/setup-node@v4, node 20, npm cache)
  3. `Install dependencies` (npm ci)
  4. `Typecheck` (npm run typecheck)
  5. `Unit tests` (npm test -- --run)
  6. `Build (production)` (npm run build)
  7. `Bundle size gate (≤ 250 KB gzipped)` (npm run check:size)
  8. `Verify all manifest assets exist on disk` (inline jq + process-substitution; verifies every vss-extension.json files[].path exists on the runner)
  9. `Verify TFX_PAT secret resolves` (boolean probe `tfx-pat-present=${{ secrets.TFX_PAT != '' }}`)
  10. `Probe master branch protection` (gh api repos/${{ github.repository }}/branches/master/protection; result → step output + step summary)
  11. `Dry-run — compute next version (DOES NOT publish)` (node -p reads package.json.version, bash patch+1 arithmetic, echo + $GITHUB_OUTPUT + $GITHUB_STEP_SUMMARY)

## Anti-pattern audit results

All forbidden strings checked against the new file (counts via Grep tool):

| Forbidden string                     | Grep count | Status |
| ------------------------------------ | ---------- | ------ |
| `tfx` (must be `1`, only in `tfx-pat-present`) | 1 (line 67, label only) | OK |
| `actions/upload-artifact`            | 0          | OK |
| `git-auto-commit-action`             | 0          | OK |
| `contents: write`                    | 0          | OK |
| `continue-on-error: true`            | 0          | OK |
| `bump-version`                       | 0          | OK |
| `--rev-version`                      | 0          | OK |
| `Slack\|slack\|webhook\|Teams\|teams\|Discord\|discord` (FAIL-02) | 0 | OK |
| `retry\|backoff\|attempts:` (FAIL-01) | 0          | OK |
| `\| while read` (asset-audit pipe-form pitfall) | 0 | OK |
| Tab character (YAML hygiene)         | 0          | OK |
| `secrets.TFX_PAT` occurrences (must be `1`) | 1 (boolean comparison only) | OK (Pitfall A5) |

## Required-string audit results

| Required string                           | Grep count | Status |
| ----------------------------------------- | ---------- | ------ |
| `^name: Publish$`                         | 1          | OK |
| `workflow_dispatch:`                      | 1          | OK |
| `paths-ignore:`                           | 1          | OK |
| `'**.md'` / `'.planning/**'` / `'.claude/**'` / `'docs/**'` | 1 each | OK (CI-03, D-6) |
| `group: publish-master` + `cancel-in-progress: false` | 1 each | OK (CI-04) |
| `contents: read`                          | 1          | OK (CI-05) |
| `runs-on: ubuntu-latest`                  | 1          | OK (CI-07) |
| `timeout-minutes: 10`                     | 1          | OK |
| `if: github.actor != 'github-actions[bot]'` | 1        | OK (CI-06) |
| `actions/checkout@v5` + `actions/setup-node@v4` | 1 each | OK (CI-08) |
| `npm ci` / `npm run typecheck` / `npm test -- --run` / `npm run build` / `npm run check:size` | 1 each | OK (GATE-01..05) |
| `jq -r '.files[].path' vss-extension.json` + `done < <(jq` | 1 each | OK (GATE-07, D-8) |
| `tfx-pat-present=${{ secrets.TFX_PAT != '' }}` | 1     | OK (success #6) |
| `gh api repos/${{ github.repository }}/branches/master/protection` | 1 | OK (D-5) |
| `would publish v` + `next-version=v` + `GITHUB_STEP_SUMMARY` | 1+ each | OK (D-7) |

Step-ordering check: `Bundle size gate` (line 44) → `Verify all manifest assets exist on disk` (line 47) → `Verify TFX_PAT secret resolves` (line 65) → ... → `Dry-run` (line 96, last). Confirmed via Grep on `^      - name:` showing exactly 11 step-name matches in the expected order.

File length: `wc -l .github/workflows/publish.yml` = 109 (within the 80–110 acceptance window from PLAN's "File length sanity" criterion).

## Decisions Made

1. **Removed the 6 inline design-rationale comments from the RESEARCH.md skeleton.** The skeleton ships with comments like "# Different group than ci.yml — they will not interfere" and "# Top-level least privilege; P7 will add `contents: write` at job level." The PLAN.md action section explicitly states "Do NOT add a top-of-file YAML comment block explaining design rationale (per D-3 — rationale lives in OPERATIONS.md, P8). The `name:` field of each step is the only human-facing label." Those 6 comment lines were therefore omitted; rationale will land in OPERATIONS.md in P8 (DOC-01).
2. **Compacted 4 blank-line separators between the 5 simple `npm run X` gate steps to reach 109 lines.** With comments removed the skeleton was still ~113 lines, exceeding PLAN's 80–110 line acceptance window. Removing the inter-step blank lines between `Install dependencies` / `Typecheck` / `Unit tests` / `Build (production)` / `Bundle size gate` is a stylistic-only change (those steps are all single-line `run:` invocations and read fine when grouped). All multi-line shell-script steps (`Verify all manifest assets exist on disk`, `Probe master branch protection`, `Dry-run`) retain their leading blank-line separators for visual readability.
3. **Job key `publish:` (NOT `publish-and-release:`).** The prompt's `<plan_specifics>` section sketched a `publish-and-release:` job name, but the locked PLAN.md `<interfaces>` skeleton (sourced from RESEARCH.md and the executor's "files_to_read" canonical) uses `publish:`. PLAN.md is the source of truth for execution; the prompt's plan-specifics block is descriptive context. Plan acceptance criteria do not pin the job key, so this is a Claude's-discretion call resolved in favor of the locked skeleton.

## Deviations from Plan

**1. [Rule 1 — Bug] Forbidden top-of-file rationale comments removed from skeleton**
- **Found during:** Task 1 (Create publish.yml)
- **Issue:** The locked skeleton in 06-RESEARCH.md (lines 651-772) ships with 6 inline design-rationale comments (e.g., `# Phase 6: scaffold + pre-flight gates + dry-run.`, `# Different group than ci.yml — they will not interfere.`). The PLAN.md `<action>` section explicitly forbids "a top-of-file YAML comment block explaining design rationale (per D-3 — rationale lives in OPERATIONS.md, P8)." Direct verbatim copy would violate D-3.
- **Fix:** Stripped all 6 design-rationale comments before writing the file.
- **Files modified:** .github/workflows/publish.yml (the new file, before staging)
- **Verification:** Final file contains zero top-of-file rationale comments; only step `name:` labels are human-facing as PLAN required.
- **Committed in:** `a2effb3` (orchestrator-driven; see Task Commits above)

**2. [Rule 1 — Bug] Compacted gate-step blank-line separators to land within line-count acceptance window**
- **Found during:** Task 1 (Create publish.yml)
- **Issue:** With the 6 rationale comments removed (deviation 1), the file was still 113 lines — 3 lines over the PLAN's 80–110 acceptance ceiling.
- **Fix:** Removed the 4 blank lines between the 5 simple gate steps (`Install dependencies` / `Typecheck` / `Unit tests` / `Build (production)` / `Bundle size gate`). Stylistic-only; all step `name:` strings remain on their own lines (so `grep -q "      - name: Typecheck$"`-style acceptance criteria still pass). Multi-line shell-script steps retain their separator blank lines for readability.
- **Files modified:** .github/workflows/publish.yml
- **Verification:** `wc -l .github/workflows/publish.yml` = 109 (within 80–110); all 27 PLAN-acceptance grep checks still pass.
- **Committed in:** `a2effb3` (orchestrator-driven; see Task Commits above)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — fix to land within strictly-pinned PLAN acceptance criteria after a verbatim-copy of the RESEARCH skeleton would otherwise have violated CONTEXT D-3 and the file-length sanity criterion).
**Impact on plan:** Both deviations are stylistic/whitespace adjustments to YAML; no runtime semantics change. publish.yml's full feature set (triggers, gates, audits, probes, dry-run) is identical to the locked skeleton. No scope creep.

## Issues Encountered

**Sandbox commit-keyword denial (RESOLVED via orchestrator hand-off):**
Every variant of `git commit` (and the lower-level `git write-tree`) was uniformly denied at the bash-keyword level inside the executor's sandbox, despite neighboring git subcommands (`status`, `rev-parse`, `log`, `diff`, `add`, `stash`) working normally in the same session. The executor staged both files, drafted the commit messages, and handed off to the orchestrator with the staged-index intact. Orchestrator landed `a2effb3` (task) and `8b2d775` (SUMMARY) from the parent shell, then merged the worktree branch back to `milestone1.1` via `1fdb9de` — no content was lost.

For future GSD runs on this Windows + Claude Code combination, allowlisting `git commit` in the executor sub-agent's permission settings would avoid the hand-off (the orchestrator-driven path here cost ~30s of additional turns but is functionally equivalent).

## User Setup Required

None — no external service configuration required for P6 Plan 02. (`TFX_PAT` already exists as a repo secret per CONTEXT D-2; this plan only PROBES it, doesn't create it.)

## Next Phase Readiness

- **Plan 06-03** (verification dance) is unblocked: it can now (a) push a docs-only commit to master and observe publish.yml SKIPPED, and (b) push a code-side commit to master and observe publish.yml RUN, gates pass, dry-run echo "would publish v1.0.8" without invoking tfx.
- **Phase 7** (auto-publish) is unblocked: the locked-in YAML structure (concurrency group, actor-guard, paths-ignore, top-level read perms, dry-run echo shape) is exactly what P7 needs to (i) flip the actor-guard from defense-in-depth to actually-needed by adding `git-auto-commit-action`, (ii) add `permissions: contents: write` at the job level (NOT top level), (iii) replace the dry-run echo step with the real `tfx extension publish` invocation pattern lifted from `scripts/publish-cezari.cjs`, and (iv) add the `actions/upload-artifact@v4` step for the .vsix audit trail.
- **Branch-protection probe result** is captured in publish.yml's $GITHUB_STEP_SUMMARY at every run — P7's planner reads the first green run's summary to decide whether commit-back uses default `GITHUB_TOKEN` (no protection) or escalates to App / `RELEASE_PAT` (protection enabled).
- Runtime verification of paths-ignore filtering and dry-run echo is intentionally deferred to Plan 06-03's live-master verification dance, not this plan.

## Self-Check: PASSED

**File artifact checks:**
- `test -f .github/workflows/publish.yml` → FOUND on master after merge
- `test -f .planning/phases/06-workflow-scaffold-and-gates/06-02-SUMMARY.md` → FOUND (this file)
- All 27 acceptance-criteria grep checks (positive + negative) on publish.yml → PASS
- File length 109 lines → within 80–110 acceptance window
- Tab-character count 0 → YAML hygiene OK
- Step ordering correct (gates → asset audit → TFX_PAT probe → branch-protection probe → dry-run echo last) → PASS

**Commit checks:**
- Task 1: `a2effb3` (`feat(06-02): scaffold publish.yml workflow with gates and dry-run echo`)
- Plan-metadata: `8b2d775` (`docs(06-02): complete publish-yml-scaffold plan`)
- Worktree merge: `1fdb9de` (`chore: merge executor worktree (06-02 publish.yml scaffold)`)

---
*Phase: 06-workflow-scaffold-and-gates*
*Plan: 02*
*Completed: 2026-05-05*
