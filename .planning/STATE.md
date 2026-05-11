---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: executing
stopped_at: "Phase 7 complete — v1.0.8 live on Marketplace (via workflow_dispatch run #25641329824 after the organic merge trigger didn't fire); commit-back blocked by an undiscovered master ruleset, recovered via PR #7 + manual tag + ruleset relaxation. SC #1/#2/#3/#4/#6 PASS; SC #5 partially verified + publish-fail variant deferred. Next: /gsd-plan-phase 8."
last_updated: "2026-05-11T08:30:00.000Z"
last_activity: 2026-05-11 -- Phase 07 complete (07-01 implementation + 07-02 verification); first Marketplace auto-publish v1.0.8 shipped + recovered from a ruleset-blocked commit-back
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-05)

**Core value:** A team member can produce a justified, reproducible Story Points value for any work item in under 30 seconds, without leaving the work item form.
**Current focus:** v1.1 milestone — Auto-Publish CI/CD. Phases 6 + 7 complete; v1.0.8 live on Marketplace. Next: Phase 8 (Cleanup & Runbooks) — and Phase 8 now also owns the ruleset / verified-commit-back decision surfaced in Phase 7.

## Current Position

Phase: 7 — Bump, Publish, Tag ✓ COMPLETE (2/2 plans, 2026-05-11)
Plan: 2 of 2 complete (07-01 ✓ implementation, 07-02 ✓ verification)
Status: Phase 7 done — v1.0.8 live on Marketplace; master HEAD `eba84b3` at v1.0.8; annotated tag `v1.0.8`; artifact `vsix-1.0.8` (90-day retention). Ready for `/gsd-plan-phase 8`.
Last activity: 2026-05-11 -- Phase 07 complete; first Marketplace auto-publish v1.0.8 (via workflow_dispatch + recovery PR)

Listing URL: https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator

Progress: [███████░░░] 67% (2 of 3 phases complete in v1.1; Phases 6 + 7 closed)

### Phase 7 outcome (read before Phase 8 planning)

- **v1.0.8 shipped via `workflow_dispatch`, NOT the organic PR-merge trigger.** The PR #5 merge to master (`eb696c6`) did not fire `publish.yml` — no run queued, no skip recorded; cause undiagnosed. The workflow was then triggered manually. The organic trigger config (`on: push: branches: [master]` minus `paths-ignore`) is unchanged; the next code-touching merge will confirm whether organic triggering works.
- **Commit-back was blocked by a master ruleset.** 06-03's `branch-protection-probe-result.md` checked the **legacy** branch-protection API (`branches/master/protection`) and found "NOT PROTECTED" — it did **not** check **rulesets** (`/rules/branches/master`). A master ruleset (require-PR + require-signed-commits + 2 status checks) rejected the bot's `git push` (`GH013`). `github-actions[bot]` cannot be added to a ruleset bypass list. **Resolution applied:** the repo admin removed "Require signed commits" + "Require a pull request before merging" from the master ruleset, so the bot's `permissions: contents: write` should suffice for commit-back + tag push on the next cycle.
- **Recovery:** PR #7 (`chore(release): v1.0.8 [skip ci]` — hand-bump both manifests) squash-merged to land commit `eba84b3` on master (`[skip ci]` prevented `publish.yml` re-firing); annotated tag `v1.0.8` pushed manually pointing at `eba84b3`.
- **SC tally:** #1 (Marketplace v1.0.8) ✓ · #2 (bump commit on master, atomic 2-file, `[skip ci]` — via recovery PR, not bot) ✓ · #3 (no re-trigger) ✓ · #4 (annotated tag) ✓ · #6 (artifact `vsix-1.0.8`, 90-day) ✓ · #5 (Option B) PARTIAL — post-publish commit-back failure left master at v1.0.7 with no orphan commit/tag (verified in the wild); the "force publish to fail → Marketplace stays at v1.0.7" variant deferred.
- **Phase 8 inherits:** (a) the ruleset / verified-commit-back decision (a GitHub App that commits via the API → auto-signed → verified, added to a ruleset bypass list — if the ruleset is ever re-tightened); (b) the probe-gap note (future probes must also query `/rules/branches/{branch}`); (c) the SC #5 broken-PAT controlled exercise; (d) the organic-trigger investigation.
- **Full evidence:** `.planning/phases/07-bump-publish-tag/07-VERIFICATION.md` (per-SC evidence, critical finding, recovery log) + `07-02-SUMMARY.md`.

## Performance Metrics

**Velocity (cumulative across milestones):**

- Total plans completed: 19 (v1.0 Phase 0..5 fully closed)
- Phases shipped: 6 (v1.0 Phase 0 through Phase 5)
- Total execution time: ~4 days calendar (v1.0: 2026-05-01 → 2026-05-04)

**v1.1 milestone (in progress):**

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 6. Workflow Scaffold & Pre-flight Gates | 3/3 | Complete ✓ | 2026-05-07 |
| 7. Bump, Publish, Tag | 2/2 | Complete ✓ (v1.0.8 live; SC #1-4,6 PASS, SC #5 partial) | 2026-05-11 |
| 8. Cleanup & Runbooks | 0/0 | Not started — phases not yet planned | — |

**v1.0 milestone (closed):**

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 0. Bootstrap & Prerequisites | 1/1 | Complete | 2026-05-01 |
| 1. Calc Engine & Audit Parser | 2/2 | Complete | 2026-05-01 |
| 2. Manifest Shell & SDK Integration | 1/1 | Complete | 2026-05-02 |
| 3. Modal UI & Read Path | 4/4 | Complete (PARTIAL PASS) | 2026-05-02 |
| 4. Write Path & Edge Cases | 6/6 | Complete (PARTIAL PASS) | 2026-05-02 |
| 5. Polish & Marketplace Publish | 5/5 | Complete (PARTIAL PASS) | 2026-05-04 |

**Recent Trend:**

- v1.0 milestone closed 2026-05-04. v1.0 carry-overs (screenshots, cross-process smoke, APPLY-03 wire-format fix) are explicitly OUT OF SCOPE for v1.1.
- v1.1 bootstrapped 2026-05-05: questioning → research (4 sub-agents) → REQUIREMENTS.md (38 reqs across 8 categories) → ROADMAP.md (3 phases mapping all 38).
- Phase 6 closed 2026-05-07 (workflow scaffold + gates + dry-run echo; verified live via PR #3/#4).
- Phase 7 closed 2026-05-11: `scripts/bump-version.mjs` (ESM, max-wins bump) + 2 vitest cases + `publish.yml` swapped from dry-run to the real publish chain. **First Marketplace auto-publish v1.0.8 shipped** (via `workflow_dispatch` run #25641329824 — the organic merge trigger didn't fire). Commit-back was blocked by an undiscovered master ruleset; recovered via PR #7 + manual tag + ruleset relaxation.
- Bundle: 148.4 KB / 250 KB gzipped (CI run on the v1.0.8 publish). 400/400 vitest pass.

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. v1.1 milestone-scope decisions are forming inside research artifacts at `.planning/research/{SUMMARY,STACK,FEATURES,ARCHITECTURE,PITFALLS}.md`; phase-level CONTEXT.md files will distill them per phase during plan-phase.

Already-locked v1.1 decisions (from research synthesis):

- **Two-workflow split:** existing `ci.yml` becomes PR-only (drop `push: [master]`); new `publish.yml` triggers on `push: [master]` + `workflow_dispatch`. Defense-in-depth: a PR run physically cannot reach the publish step.
- **Single sequential job in publish.yml** (~13 steps): checkout → setup-node → npm ci → typecheck → test → build → check:size → bump (in-memory) → tfx create → upload-artifact → publish → commit-back → tag.
- **Option B state-flow:** bump in-memory, publish FIRST, commit + tag LAST. Marketplace less reliable than git push → put the unreliable side first; failure of publish leaves master untouched (self-healing).
- **Auth model:** Marketplace PAT scope `Marketplace (publish)` only, "All accessible orgs", 1-year lifespan, stored as repo secret `TFX_PAT` (matches existing `publish-cezari.cjs` env var name). Commit-back uses default `GITHUB_TOKEN` + `permissions: contents: write` (no PAT/App while master is unprotected).
- **Loop-guard triple defense:** `GITHUB_TOKEN` anti-loop guarantee + `[skip ci]` token in commit message + actor-guard `if: github.actor != 'github-actions[bot]'` on the publish job.
- **Concurrency:** `group: publish-master, cancel-in-progress: false` (queue, never cancel mid-publish).
- **Bump tooling:** `scripts/bump-version.mjs` (ESM, ~30 lines, atomic two-file write of `package.json` + `vss-extension.json`). Reject `tfx --rev-version` (manifest-only) and `release-please` / `semantic-release` / `changesets` (assume conventional-commits which v1.1 does not adopt).
- **Runner:** `ubuntu-latest` (matches existing CI; sidesteps Windows `tfx-cli spawnSync({shell})` quirks burned in `publish-cezari.cjs`).

### Pending Todos

| Item | Where | When |
|------|-------|------|
| ~~Re-verify `tfx extension publish --help` flag spelling~~ | — | DONE — verified by the green publish step in run #25641329824 (`--vsix --auth-type pat --token --no-prompt --no-wait-validation` all current in tfx-cli@0.23.1) |
| Bump `actions/{setup-node,upload-artifact,checkout},stefanzweifel/git-auto-commit-action` to Node-24-compatible versions (Node 20 deprecation; runner forces Node 24 from 2026-06-02) | publish.yml + ci.yml | v1.2+ candidate or quick task — non-blocking but has a deadline |
| Decide verified-commit-back strategy if the master ruleset is re-tightened (GitHub App that commits via API → auto-signed → verified, added to ruleset bypass list) | Phase 8 (DOC-02) | When/if "Require signed commits" is re-enabled on master |
| Future branch-protection probes must also query `GET /repos/.../rules/branches/{branch}` (rulesets), not just `branches/{branch}/protection` (legacy) | Phase 8 OPERATIONS.md / probe artifact note | Phase 8 |
| SC #5 publish-fail variant: controlled exercise — break `TFX_PAT`, `workflow_dispatch`, confirm Marketplace + master untouched, restore, re-run, confirm clean recovery | Phase 8 or v1.2+ | Post-Phase-7 |
| Investigate why the PR #5 merge to master did not fire `publish.yml` (no run, no skip) | — | Next code-touching merge will reveal whether organic triggering works; investigate if it recurs |

### Blockers/Concerns

- **Organic publish trigger reliability — UNCONFIRMED.** The PR #5 merge to master did not fire `publish.yml`. v1.0.8 shipped via manual `workflow_dispatch` instead. Not blocking (the workflow itself is fine and `workflow_dispatch` is a documented fallback), but the auto-on-merge promise is not yet demonstrated. First clean confirmation will come on the next code-touching merge to master.
- **Master ruleset relaxed for the bot.** "Require signed commits" + "Require a pull request before merging" were removed from the master ruleset so the bot's commit-back works. Re-tightening requires the verified-commit-back follow-up (see Pending Todos). Single-maintainer repo — acceptable interim state.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260504-cl1 | Programmatic close spike + wire (Cancel + post-Saved auto-close + Esc keydown); 1.0.3 → 1.0.4 | 2026-05-04 | 7b4d00e | [260504-cl1-programmatic-close-spike](./quick/260504-cl1-programmatic-close-spike/) |
| 260504-uk5 | Close out Phase 5: 3 SUMMARYs (05-01 MOOT, 05-04 DEFERRED, 05-05 PASS), commit 05-VERIFICATION.md, REQUIREMENTS PKG-02..07 [x], STATE rewrite, ROADMAP Phase 5 [x] | 2026-05-04 | 0996b14 | [260504-uk5-close-out-phase-5-write-summarys-for-05-](./quick/260504-uk5-close-out-phase-5-write-summarys-for-05-/) |

## Deferred Items

v1.0.1+ items (carried from v1.0 close — explicitly OUT OF SCOPE for v1.1):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Listing | Light + dark screenshots in `screenshots[]` | Open (Plan 05-03 carry-over) | 2026-05-02 |
| Verification | Cross-process Agile + CMMI smoke on cezari | Open (Plan 05-04 deferred) | 2026-05-02 |
| Housekeeping | Unpublish stuck private extension on `TsezariMshvenieradzeExtensions` publisher | Open (low priority) | 2026-05-02 |
| Code | APPLY-03 wire-format mismatch (parse.ts widening or `serialize` strip) | Open (separate code-fix milestone) | Phase 4 (revisited 2026-05-04) |
| Code | closeProgrammatically defense-in-depth + shared SAVING_DATASET_KEY constant | Open (cross-phase integration) | 2026-05-04 |
| Code | Strip dead `PermissionWarnBanner` if no probe lands | Open (cross-phase integration) | 2026-05-04 |

v1.2+ items (deferred from v1.1 — explicit anti-features for this milestone):

| Item | Reason | Source |
|------|--------|--------|
| Conventional-commits semver | Patch-only is v1.1 explicit policy | REQUIREMENTS.md / Future |
| CHANGELOG.md auto-generation | Pair with conventional-commits | REQUIREMENTS.md / Future |
| PAT-smoke cron (weekly) | First-pass v1.1 ships without it | REQUIREMENTS.md / Future |
| Branch-protection-aware push (App / RELEASE_PAT) | Not needed while master unprotected | REQUIREMENTS.md / Future |
| Marketplace-version reconciliation pre-flight | Not needed in fail-fast policy | REQUIREMENTS.md / Future |
| Bundle size trend on PRs | Hard gate already covers regression | REQUIREMENTS.md / Future |
| Multi-environment staged promote (private → public) | Single maintainer; manual smoke acceptable | REQUIREMENTS.md / Future |

## Session Continuity

Last session: 2026-05-11T08:30:00.000Z
Stopped at: Phase 7 complete — v1.0.8 live on Marketplace (via `workflow_dispatch` run #25641329824); master HEAD `eba84b3` at v1.0.8; annotated tag `v1.0.8`; artifact `vsix-1.0.8`. Commit-back was blocked by an undiscovered master ruleset; recovered via PR #7 + manual tag + ruleset relaxation. SC #1/#2/#3/#4/#6 PASS; SC #5 partial.
Resume file: `.planning/phases/07-bump-publish-tag/07-VERIFICATION.md` (per-SC evidence + critical finding + recovery log) + `07-02-SUMMARY.md`.
Next workflow: `/gsd-plan-phase 8` to decompose Phase 8 (Cleanup & Runbooks). Phase 8 now also owns: the verified-commit-back decision (GitHub App if the master ruleset is re-tightened), the probe-gap note (future probes must check rulesets too), the SC #5 broken-PAT controlled exercise, and the organic-trigger investigation. Note for Phase 8 planning: the `branch-protection-probe-result.md` conclusion ("NOT PROTECTED") was correct for *legacy* protection but a master *ruleset* exists (now relaxed) — don't treat the probe artifact as the full picture.
