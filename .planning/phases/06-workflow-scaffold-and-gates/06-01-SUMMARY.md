---
phase: 06-workflow-scaffold-and-gates
plan: 01
subsystem: infra
tags: [github-actions, ci, workflow, yaml]

# Dependency graph
requires:
  - phase: 05-ci-foundation
    provides: ".github/workflows/ci.yml with push+pull_request triggers on master"
provides:
  - "ci.yml fires on pull-requests to master only — no longer on master pushes"
  - "Trigger-side half of the two-workflow split (publish.yml will own master-push surface in 06-02)"
affects: [06-02-publish-yml-scaffold, 06-03-verification-dance, 07-auto-publish, 08-cleanup-and-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-workflow split: ci.yml owns PR surface, publish.yml will own push surface (defense-in-depth)"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "Honored CONTEXT D-4: ci.yml stays at @v4 pins (no upgrade to checkout@v5)"
  - "Honored CONTEXT D-3: no inline YAML comment explaining the change (rationale lives in OPERATIONS.md, P8)"
  - "Surgical 2-line YAML deletion only — concurrency, runner, timeout, and step list left byte-identical"

patterns-established:
  - "Single-trigger workflows: each workflow owns exactly one trigger surface (PR or push), never both"

requirements-completed: [CI-02]

# Metrics
duration: 4min
completed: 2026-05-05
---

# Phase 6 Plan 1: Drop push trigger from ci.yml Summary

**ci.yml now fires on pull_request to master only — push trigger removed in preparation for the 06-02 publish.yml split.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-05T13:55:00Z
- **Completed:** 2026-05-05T13:58:49Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Removed `push: branches: [master]` from `.github/workflows/ci.yml` `on:` block (2 lines deleted, 0 added)
- Preserved every other ci.yml line byte-for-byte: `name: CI`, concurrency block, `runs-on: ubuntu-latest`, `timeout-minutes: 10`, all 7 step `name:` strings, and both `@v4` action pins (`actions/checkout@v4`, `actions/setup-node@v4`)
- Satisfied CI-02 — the trigger-side half of the two-workflow split that publish.yml (Plan 06-02) will complete

## Task Commits

1. **Task 1: Remove `push: branches: [master]` from ci.yml `on:` block (CI-02)** — `8319dcd` (chore)

## Files Created/Modified

- `.github/workflows/ci.yml` — `on:` block trimmed from 5 lines (push + pull_request, both with master) to 3 lines (pull_request only). Diff: 2 deletions, 0 additions.

## Verification Results

Acceptance criteria (all green via the plan's automated `<verify>` command and grep checks against the worktree file):

| Check | Expected | Result |
|-------|----------|--------|
| `grep -c "^  push:" ci.yml` | 0 | 0 (no matches) |
| `grep -c "branches: \[master\]" ci.yml` | 1 | 1 (only the pull_request branch line) |
| `grep -q "pull_request:" ci.yml` | match | line 4: `  pull_request:` |
| `grep -q "actions/checkout@v4" ci.yml` | match | line 19: `uses: actions/checkout@v4` (pin unchanged per D-4) |
| `grep -q "actions/setup-node@v4" ci.yml` | match | line 22: `uses: actions/setup-node@v4` (pin unchanged) |
| `grep -q "cache: 'npm'" ci.yml` | match | line 25 |
| `grep -q "npm run check:size" ci.yml` | match | line 40 |
| `- name:` lines | 7 (Checkout + Setup Node.js + 5 gates) | 7 (Checkout, Setup Node.js, Install dependencies, Typecheck, Unit tests, Build (production), Bundle size gate (≤ 250 KB gzipped)) |
| `git diff .github/workflows/ci.yml` | 2 deletions, 0 additions | exactly 2 deletions, 0 additions |

Plan's combined `<verify>` shell expression returned `OK`.

YAML structural validity was verified by visual inspection of the modified file (Read tool) — both `js-yaml` and Python's `yaml` library are absent from this environment, but indentation and key/colon usage are unchanged from the previously valid file in all preserved lines, and only two lines were removed in a known-valid section. GitHub Actions will surface any structural error on the next PR run.

## Runtime Verification (Deferred)

Per the plan's `<verification>` block: live confirmation that ci.yml does NOT fire on master pushes is intentionally deferred to Plan 06-03's verification dance. The negative-case force-merge there (README.md whitespace edit pushed to master) and the positive-case companion test will produce the runtime evidence simultaneously, avoiding duplicate force-merges in P6.

## Decisions Made

- None beyond the plan. Followed CONTEXT D-3 (no inline comment) and D-4 (no pin bump) verbatim.

## Deviations from Plan

None — plan executed exactly as written. The edit was a surgical 2-line YAML deletion with no scope expansion, no Rule 1/2/3 auto-fixes, and no architectural questions raised.

## Issues Encountered

None during the planned work. (One self-inflicted process detour at executor startup: an early `cd` Bash command moved into the main repo path rather than the worktree path, and the first Edit therefore landed in the main repo. The change was reverted in the main repo with a file-scoped `git checkout -- .github/workflows/ci.yml` and re-applied inside the worktree before any commit. No commit was ever made on a non-worktree branch; the pre-commit HEAD assertion confirmed `worktree-agent-a3c792d9d09f7cab7` before staging.)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **06-02 (publish.yml scaffold):** unblocked. ci.yml's push surface is now empty, so publish.yml can claim `on: push: branches: [master]` without overlap.
- **06-03 (verification dance):** unblocked. Negative-case run will simultaneously prove ci.yml stays silent on master pushes (CI-02 runtime verification) and that publish.yml's `paths-ignore` filter works.
- **No blockers, no concerns.**

## Self-Check: PASSED

- `.github/workflows/ci.yml` exists and contains the post-edit content (verified via Read).
- Commit `8319dcd` exists in `git log` for the worktree branch (`chore(06-01): drop push trigger from ci.yml (CI-02)`).
- SUMMARY.md path resolves under the worktree at `.planning/phases/06-workflow-scaffold-and-gates/06-01-SUMMARY.md`.

---
*Phase: 06-workflow-scaffold-and-gates*
*Plan: 01*
*Completed: 2026-05-05*
