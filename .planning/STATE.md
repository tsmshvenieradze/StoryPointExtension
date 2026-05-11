---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Auto-Publish CI/CD
status: milestone_complete
stopped_at: "v1.1 Auto-Publish CI/CD milestone closed 2026-05-11 (`/gsd-complete-milestone v1.1`). 3 phases (6, 7, 8), 10 plans, 38/38 requirements satisfied. Archived: milestones/v1.1-ROADMAP.md, milestones/v1.1-REQUIREMENTS.md, milestones/v1.1-MILESTONE-AUDIT.md, milestones/v1.1-phases/{06,07,08}. v1.0 phase artifacts retroactively moved to milestones/v1.0-phases/. ROADMAP.md reorganized to milestone-grouped form; PROJECT.md Current State + Key Decisions updated; RETROSPECTIVE.md created (v1.0 + v1.1 sections + cross-milestone trends); REQUIREMENTS.md removed (fresh one comes with the next milestone). Git tag v1.1 created. Marketplace at v1.0.10. NEXT: `/gsd-new-milestone` to scope v1.2+ (questioning → research → requirements → roadmap)."
last_updated: "2026-05-11T17:30:00.000Z"
last_activity: 2026-05-11 — Completed quick task 260511-xu5 (publish.yml: merged-PR-only trigger)
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 10
  completed_plans: 10
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11 after v1.1 milestone close)

**Core value:** A team member can produce a justified, reproducible Story Points value for any work item in under 30 seconds, without leaving the work item form.
**Current focus:** Between milestones — v1.1 Auto-Publish CI/CD shipped & archived. Next: `/gsd-new-milestone` to scope v1.2+.

## Current Position

No active milestone. v1.0 MVP (Phases 0–5, shipped 2026-05-04) and v1.1 Auto-Publish CI/CD (Phases 6–8, shipped 2026-05-11) are both closed and archived under `.planning/milestones/`.

Listing URL: https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator — at v1.0.10 (released via the automated `publish.yml` pipeline)

Shipped to date: 2 milestones, 9 phases, 29 plans, 3 quick tasks. 400/400 vitest pass; bundle 148.4 KB / 250 KB gzipped.

## Performance Metrics

**Velocity (cumulative across milestones):**

- Total plans completed: 29 (v1.0: 19 across Phases 0–5; v1.1: 10 across Phases 6–8)
- Phases shipped: 9 (Phase 0 through Phase 8)
- Calendar: v1.0 ~4 days (2026-05-01 → 2026-05-04); v1.1 ~7 days with a mid-week gap (2026-05-05 → 2026-05-11)

| Milestone | Phases | Plans | Shipped | Notes |
|-----------|--------|-------|---------|-------|
| v1.0 MVP | 0–5 (6) | 19 | 2026-05-04 | Public Marketplace ship v1.0.0 → patch sequence to v1.0.7; 40/40 v1 reqs (3 PARTIAL deferrals + 1 satisfied-with-caveat) |
| v1.1 Auto-Publish CI/CD | 6–8 (3) | 10 | 2026-05-11 | 38/38 reqs; first auto-publish v1.0.8 → re-verification v1.0.9 → SC #5 recovery v1.0.10; Phase 7 prod failure → Phase 8 release-branch re-architecture |

## Accumulated Context

### Decisions

Full decision log lives in `PROJECT.md` Key Decisions table (v1.0 + v1.1 decisions, with outcomes). v1.1 highlights: two-workflow split, release-branch promotion model + `story-point-release-bot` GitHub App verified commit-back, Option B state-flow, `scripts/bump-version.mjs`, `ubuntu-latest` runner. Per-milestone detail in `milestones/v1.1-ROADMAP.md`, `milestones/v1.1-MILESTONE-AUDIT.md`, and `RETROSPECTIVE.md`.

### Carry-forward Todos (for v1.2+ scoping)

| Item | Where | When |
|------|-------|------|
| Bump Node-20 actions (`create-github-app-token@v2`, `setup-node@v4`, `upload-artifact@v4`, `git-auto-commit-action@v6`) to Node-24-compatible versions | `publish.yml` + `ci.yml` | **Deadline 2026-06-02** — GitHub forces Node 24. Quick task or first v1.2 item; non-blocking but dated. |
| OPERATIONS.md §3/§5: document the D-4 gotcha — a `[skip ci]` on a back-merge-PR conflict-resolution commit also skips that PR's required `ci.yml` check, forcing an owner-bypass merge | OPERATIONS.md | v1.2 doc follow-up (one line) |
| `master` ruleset has `strict_required_status_checks_policy: true` — adds promotion/back-merge friction; operator's discretion to relax (D-5) | repo settings | Operator's call |
| Pre-fill APPLY-03 production fix — widen `src/audit/parse.ts` to accept the plain-text line postComment writes, or strip the orphaned `serialize` re-export and document as a v1 known-limitation | `src/audit/` | v1.2+ candidate |
| Investigate why a plain `master` merge did not fire `publish.yml` in Phase 7 (moot under the release-branch model, but note if it recurs) | — | If it recurs |

### Blockers/Concerns

None active. (v1.1 closed clean; tech-debt items above are tracked, not blocking.)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260504-cl1 | Programmatic close spike + wire (Cancel + post-Saved auto-close + Esc keydown); 1.0.3 → 1.0.4 | 2026-05-04 | 7b4d00e | [260504-cl1-programmatic-close-spike](./quick/260504-cl1-programmatic-close-spike/) |
| 260504-uk5 | Close out Phase 5: 3 SUMMARYs (05-01 MOOT, 05-04 DEFERRED, 05-05 PASS), commit 05-VERIFICATION.md, REQUIREMENTS PKG-02..07 [x], STATE rewrite, ROADMAP Phase 5 [x] | 2026-05-04 | 0996b14 | [260504-uk5-close-out-phase-5-write-summarys-for-05-](./quick/260504-uk5-close-out-phase-5-write-summarys-for-05-/) |
| 260511-xu5 | `publish.yml`: trigger only on merged PRs into `release` (`pull_request: closed` + `merged==true`) + `workflow_dispatch`; checkout `ref: release` | 2026-05-11 | c940bb8 | [260511-xu5-release-merge-only-publish-trigger](./quick/260511-xu5-release-merge-only-publish-trigger/) |

## Deferred Items

v1.0.1+ items (carried from v1.0 close — were OUT OF SCOPE for v1.1; revisit when scoping v1.2+):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Listing | Light + dark screenshots in `screenshots[]` | Open (Plan 05-03 carry-over) | 2026-05-02 |
| Verification | Cross-process Agile + CMMI smoke on cezari | Open (Plan 05-04 deferred) | 2026-05-02 |
| Verification | Contributor (non-admin) explicit Apply-flow smoke | Open (Phase 5 D-7 deviation) | 2026-05-02 |
| Housekeeping | Unpublish stuck private extension on `TsezariMshvenieradzeExtensions` publisher | Open (low priority) | 2026-05-02 |
| Code | APPLY-03 wire-format mismatch (parse.ts widening or `serialize` strip) | Open (separate code-fix milestone) | Phase 4 (revisited 2026-05-04) |
| Code | `closeProgrammatically` defense-in-depth + shared `SAVING_DATASET_KEY` constant | Open (cross-phase integration) | 2026-05-04 |
| Code | Strip dead `PermissionWarnBanner` if no probe lands | Open (cross-phase integration) | 2026-05-04 |

v1.2+ items (deferred from v1.1 — were explicit anti-features for that milestone):

| Item | Reason it was out | Source |
|------|-------------------|--------|
| Conventional-commits semver | Patch-only was v1.1 explicit policy | v1.1 REQUIREMENTS / Future |
| CHANGELOG.md auto-generation | Pair with conventional-commits | v1.1 REQUIREMENTS / Future |
| PAT-smoke cron (weekly expiry alert) | First-pass v1.1 shipped without it | v1.1 REQUIREMENTS / Future |
| Marketplace-version reconciliation pre-flight | Not needed under fail-fast policy | v1.1 REQUIREMENTS / Future |
| Bundle size trend reporting on PRs | Hard gate already covers regression | v1.1 REQUIREMENTS / Future |
| Multi-environment staged promote (private → public) | Single maintainer; manual smoke acceptable | v1.1 REQUIREMENTS / Future |
| GitHub Releases auto-creation | Marketplace listing IS the user-facing release surface | v1.1 REQUIREMENTS / Out of Scope |

## Session Continuity

Last session: 2026-05-11 — `/gsd-complete-milestone v1.1`.
Stopped at: v1.1 milestone closed and archived. See `stopped_at` in frontmatter for the full close-out manifest.
Resume file: None
Next workflow: `/clear`, then `/gsd-new-milestone` — questioning → research → requirements → roadmap for v1.2+. (Continuous phase numbering: v1.2 starts at Phase 9.)
