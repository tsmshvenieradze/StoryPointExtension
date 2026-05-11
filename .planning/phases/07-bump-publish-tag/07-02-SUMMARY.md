---
phase: 07-bump-publish-tag
plan: 02
subsystem: infra
tags: [verification, marketplace, ci-cd, ruleset, recovery, evidence-artifact]

# Dependency graph
requires:
  - phase: 07-bump-publish-tag/01
    provides: scripts/bump-version.mjs + publish.yml real publish chain + 2 vitest cases (BUMP-01..05, PUBLISH-01..05, TAG-01..04)
provides:
  - .planning/phases/07-bump-publish-tag/07-VERIFICATION.md — per-SC evidence for the first Marketplace auto-publish (v1.0.7 → v1.0.8) + the master-ruleset finding + the recovery log
affects: [08-cleanup-and-runbooks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - workflow_dispatch as the recovery trigger when an organic push event fails to fire (CONTEXT D-6 / Option B)
    - Recovery-PR-with-[skip ci] to land an out-of-band version bump on master without re-firing publish.yml
    - Manual annotated tag push (git tag -a + git push origin) when the workflow's tag step never ran

key-files:
  created:
    - .planning/phases/07-bump-publish-tag/07-VERIFICATION.md — ~200-line durable evidence artifact mirroring branch-protection-probe-result.md shape; per-SC evidence with verbatim command output; critical finding (Phase 6 probe gap — rulesets not checked); recovery log
  modified: []

key-decisions:
  - "First publish shipped via workflow_dispatch, not the organic PR #5 merge — the merge to master did not fire publish.yml (cause undiagnosed; no run queued, no skip recorded). Pragmatic call: manual dispatch achieves the same end state and is the documented recovery path (CONTEXT D-6 + the workflow's workflow_dispatch trigger)."
  - "Recovery PR #7 (hand-bump to v1.0.8 + [skip ci]) chosen over re-running publish.yml — Marketplace was already at v1.0.8, so a re-run would have bumped to v1.0.9 and shipped v1.0.9, leapfrogging v1.0.8 on master entirely. The recovery PR keeps master == Marketplace == v1.0.8."
  - "Master ruleset relaxed (removed 'Require signed commits' + 'Require a pull request before merging') rather than wiring a GitHub App for verified commit-back — App setup is substantial new work scoped for Phase 8 (DOC-02 'branch-protection migration paths'). Relaxing the ruleset restores fully-automatic Phase 7 on the next cycle."
  - "SC #5 recorded as 'partially verified in the wild + publish-fail variant deferred' — the run failed at commit-back (after publish), not at publish, so the 'Marketplace stays at v1.0.7' variant wasn't exercised. The recoverable-state half of Option B (no orphan commit/tag after a post-publish failure) WAS observed."

patterns-established:
  - "Pattern: when a GitHub push event mysteriously doesn't fire a workflow, use the workflow's workflow_dispatch trigger as the recovery path — functionally equivalent for publish purposes."
  - "Pattern: to land an out-of-band version bump on master after a commit-back failure, open a recovery PR with [skip ci] in the squash commit message — prevents publish.yml from re-firing and re-publishing an already-published version (which the Marketplace would reject)."
  - "Pattern: verification artifacts record findings, not just confirmations — the Phase 6 probe gap (legacy branch-protection checked, rulesets not) is captured in 07-VERIFICATION.md so future probes query /repos/.../rules/branches/{branch} too."

requirements-completed: []  # 07-02 is verification-only; the 14 requirements were delivered by 07-01 and verified (with caveats) here

# Metrics
duration: ~90min (including diagnosis of the failed run + recovery + ruleset back-and-forth)
completed: 2026-05-11
---

# Phase 07 Plan 02: First-auto-publish verification + recovery Summary

**The first Marketplace auto-publish (v1.0.7 → v1.0.8) shipped via `workflow_dispatch` run #25641329824 after the organic PR-merge trigger did not fire; the workflow's commit-back step was blocked by an undiscovered master ruleset (require-PR + require-signed-commits + 2 status checks); recovered via PR #7 (`chore(release): v1.0.8 [skip ci]`) + a manual annotated tag + a ruleset relaxation. SC #1/#2/#3/#4/#6 PASS; SC #5 partially verified in the wild with the publish-fail variant deferred. Critical finding: Phase 6's branch-protection probe checked legacy branch protection but not rulesets — captured in 07-VERIFICATION.md.**

## Pre-merge checks (D-6)

**Check 1 — `npx tfx extension publish --help` flag re-verify.** Not run as a standalone local command. Satisfied empirically by the `workflow_dispatch` run: `publish.yml`'s `Publish to Marketplace` step invoked `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation` and the step succeeded — proving all four flags (`--auth-type pat`, `--token`, `--no-prompt`, `--no-wait-validation`) plus `--vsix` are current in `tfx-cli@0.23.1`. Closes the long-standing STATE.md TODO and research's MEDIUM-confidence flag-spelling note. No YAML changes were needed.

**Check 2 — local PAT smoke.** Not run as a standalone `node scripts/publish-cezari.cjs` invocation. Satisfied empirically by the run: the `Verify TFX_PAT secret resolves` step passed AND the `Publish to Marketplace` step authenticated and published v1.0.8 successfully — proving `TFX_PAT` is valid with Marketplace publish permission. The side effect (the run actually published v1.0.8) was the intent — this WAS the first publish.

## The run

| | Value |
|---|---|
| Workflow run | Publish #6 — https://github.com/tsmshvenieradze/StoryPointExtension/actions/runs/25641329824 |
| Event | `workflow_dispatch` (manual, `tsmshvenieradze`) — the PR #5 merge to master did NOT fire `publish.yml` (no run queued, no skip recorded; cause undiagnosed without GitHub-internal data) |
| Run duration | ~35s (job failed at step 16 of 18, `Commit version bump`) |
| Gates 1–10 | ✓ all passed (checkout, setup-node, npm ci, typecheck, 400 tests, build, check:size, asset audit, TFX_PAT probe, branch-protection probe = `unknown` as designed) |
| Bump (step 11) | ✓ `bump-version.mjs` ran — v1.0.7 → v1.0.8, no drift |
| Package vsix (step 12) | ✓ `tfx extension create` |
| Upload artifact (step 13) | ✓ `vsix-1.0.8` uploaded, 90-day retention |
| Publish to Marketplace (step 14) | ✓ `tfx extension publish` — **v1.0.8 live on Marketplace** |
| Commit version bump (step 15) | ✗ **FAILED** — `git-auto-commit-action@v6` created commit `754defa` in-runner; `git push` to master rejected: `GH013: Repository rule violations found for refs/heads/master` (require-PR + require-signed-commits + 2 status checks) |
| Surface commit-back (step 16) | — skipped |
| Tag release (step 17) | — skipped (commit-back failed first; `continue-on-error: true` never exercised) |
| Surface tag failure (step 18) | — skipped (gated on `steps.tag.outcome == 'failure'`, never set) |
| Tag step state | N/A — the workflow's tag step never ran; tag `v1.0.8` was created manually post-recovery |

## Recovery (2026-05-11)

1. Diagnosed: Marketplace at v1.0.8 (publish succeeded), master at v1.0.7 (commit-back rejected by master ruleset). Root cause: 06-03's `branch-protection-probe-result.md` checked the legacy branch-protection API, not rulesets — a master ruleset was in place and invisible to the probe.
2. Repo admin removed "Require signed commits" + "Require a pull request before merging" from the master ruleset (the `github-actions[bot]` actor can't be added to a ruleset bypass list — that list takes roles/teams/Apps, not the built-in Actions bot).
3. Recovery PR #7 (`chore(release): v1.0.8 [skip ci]` — hand-bump `package.json` + `vss-extension.json` to `1.0.8`) opened off `origin/master`, CI green, squash-merged → commit `eba84b3` on master. `[skip ci]` in the squash message prevented `publish.yml` re-firing (a re-run would have bumped to v1.0.9 and re-published, leapfrogging v1.0.8 on master).
4. Annotated tag `v1.0.8` pushed pointing at `eba84b3`: `git tag -a v1.0.8 eba84b3 -m "Release v1.0.8" && git push origin v1.0.8`.

End state: Marketplace **v1.0.8** · master HEAD **`eba84b3`** (both manifests at v1.0.8) · tag **`v1.0.8`** annotated → `eba84b3` · artifact **`vsix-1.0.8`** (90-day retention).

## Per-SC summary

| SC | Result | Evidence anchor (full detail in 07-VERIFICATION.md) |
|----|--------|------|
| #1 — Marketplace at v1.0.8 | ✓ PASS | `extensionquery` API → `latest version: 1.0.8`, `lastUpdated: 2026-05-10T22:25:13Z` (matches run #25641329824's publish step); run summary `## Publish` block |
| #2 — Bump commit on master | ✓ PASS (via recovery PR) | commit `eba84b3` on master, subject `chore(release): v1.0.8 [skip ci] (#7)`, atomic 2-file diff (`package.json` + `vss-extension.json`). Authored by `tsmshvenieradze` (PR #7) not `github-actions[bot]` — the workflow's bump commit `754defa` was rejected by the ruleset. Substance achieved; bot-authorship pending the next cycle now the ruleset is relaxed |
| #3 — No re-trigger | ✓ PASS | only ONE `Publish` run for the cycle (#6); PR #7's squash commit carried `[skip ci]` → `publish.yml` did not re-fire; triple anti-loop (actor-guard + `[skip ci]` + GITHUB_TOKEN) all active |
| #4 — Tag v1.0.8 exists | ✓ PASS | `git ls-remote --tags origin v1.0.8` → annotated tag `daae7be7…` → `eba84b3` (the bump commit). Created manually; the workflow's tag step never ran |
| #5 — Option B reversibility | ~ PARTIAL | post-publish commit-back failure left master at v1.0.7 with no orphan commit/tag (recoverable-state half of Option B verified in the wild); the "force publish to fail → Marketplace stays at v1.0.7" variant NOT exercised — deferred to a controlled broken-PAT exercise (Phase 8 / v1.2+) |
| #6 — Artifact downloadable | ✓ PASS | `vsix-1.0.8`, `retention-days: 90`, `if-no-files-found: error` guard active; `gh run view 25641329824` → `ARTIFACTS: vsix-1.0.8` |

## Durable evidence artifact

`.planning/phases/07-bump-publish-tag/07-VERIFICATION.md` — ~200 lines, mirrors `branch-protection-probe-result.md` shape: header with metadata → `## Result` → `## Per-SC evidence` (verbatim command output per criterion) → `## Critical finding — master ruleset (Phase 6 verification gap)` → `## Pre-merge checks (D-6)` → `## Cross-references` (all 13 CONTEXT decisions D-1..D-13) → `## Recovery log`.

## Follow-up items (for Phase 8 / future)

- **Phase 6 probe gap:** future branch-protection probes must also query `GET /repos/.../rules/branches/{branch}` (rulesets), not just `GET /repos/.../branches/{branch}/protection` (legacy). Note in `branch-protection-probe-result.md` or the Phase 8 OPERATIONS.md.
- **Verified-signature commit-back:** if the master ruleset is re-tightened (re-add "Require signed commits"), the bot's `git push` will fail again. Options: a GitHub App that commits via the API (GitHub auto-signs API commits → verified) added to the ruleset bypass list, OR keep the ruleset relaxed for master. Scoped for Phase 8 DOC-02 ("branch-protection migration paths").
- **SC #5 publish-fail variant:** a controlled exercise — revoke/break `TFX_PAT`, `workflow_dispatch` → confirm Marketplace + master both untouched → restore PAT → re-run → confirm clean recovery. Phase 8 / v1.2+ candidate.
- **Organic-trigger investigation:** the PR #5 merge to master did not fire `publish.yml` (no run, no skip). The trigger config (`on: push: branches: [master]` minus `paths-ignore`) is unchanged and the squash diff included non-ignored files. Likely a transient GitHub anomaly; the next code-touching merge will confirm whether organic triggering works.

## Self-Check: PASSED

- Marketplace at v1.0.8 → confirmed via `extensionquery` API
- Master HEAD `eba84b3` with `package.json` + `vss-extension.json` at `1.0.8` → confirmed via `git show origin/master:...`
- Tag `v1.0.8` annotated, dereferences to `eba84b3` → confirmed via `git ls-remote --tags origin`
- Artifact `vsix-1.0.8` exists with 90-day retention → confirmed via `gh run view 25641329824`
- `07-VERIFICATION.md` written with per-SC evidence, critical finding, and recovery log → confirmed (file exists, ~200 lines)
- No source/code files modified by 07-02 (only the verification artifact + this summary + STATE/ROADMAP close-out)

---

*Phase: 07-bump-publish-tag*
*Plan: 02*
*Completed: 2026-05-11*
*Phase 7 complete — 14 requirements delivered (07-01) + verified with caveats (07-02). v1.0.8 live on Marketplace. SC #1/#2/#3/#4/#6 PASS; SC #5 partially verified + publish-fail variant deferred. Critical finding: Phase 6's branch-protection probe didn't check rulesets — recorded. Next: `/gsd-plan-phase 8` for Cleanup & Runbooks (which now also owns the ruleset/verified-commit-back decision).*
