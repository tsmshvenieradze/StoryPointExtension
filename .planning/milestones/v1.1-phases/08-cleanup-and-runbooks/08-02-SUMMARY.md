---
phase: 08-cleanup-and-runbooks
plan: 02
subsystem: infra
tags: [operations-runbook, marketplace-pat, github-app, rulesets, release-branch, ci-cd, documentation]

requires:
  - phase: 08-cleanup-and-runbooks
    provides: ".planning/OPERATIONS.md created (H1 + intro + section 2 — the DOC-02 manual emergency-publish runbook); publish.yml refactored to the release-branch model + GitHub App token (Plan 08-01)"
  - phase: 07-bump-publish-tag
    provides: "07-VERIFICATION.md — the v1.0.8 publish + master-ruleset finding + recovery log; the rulesets-aware-probe and SC #5 carry-overs"
provides:
  - ".planning/OPERATIONS.md is now the complete 6-section comprehensive auto-publish ops doc (CONTEXT D-1): 1 PAT rotation, 2 emergency-publish runbook (from Plan 01), 3 release-branch model + ruleset config + GitHub App creation steps, 4 rulesets-aware branch-protection probe correction, 5 'Recovery: publish OK, commit-back failed', 6 SC #5 / Option B reversibility controlled exercise"
  - "DOC-01 satisfied — the Marketplace PAT rotation procedure (1-year cadence, aex.dev.azure.com note, 'All accessible organizations', Marketplace (Publish) scope + the Publish-vs-Manage caveat, update TFX_PAT secret, revoke old)"
  - "The Phase 6 probe-gap correction documented as durable source-of-truth (probe BOTH /branches/{b}/protection legacy AND /rules/branches/{b} rulesets)"
  - "The release-branch model + all user-action handoffs (GitHub App creation, release branch creation, master/release ruleset configuration, PAT revoke/restore) documented so they're reconstructable"
affects: [08-03-user-handoff-and-reverification, 08-04-legacy-cleanup, 08-05-project-md-promotion]

tech-stack:
  added: []
  patterns:
    - "OPERATIONS.md is the single durable ops doc — all the 'why' the workflow YAML deliberately omits (Phase 6/7 D-3) lives here; section 4 explicitly captures the probe-step rationale that was removed from publish.yml in Plan 08-01"
    - "Threat-aware docs: secret names (TFX_PAT / APP_ID / APP_PRIVATE_KEY) referenced only by name; PAT-rotation + App-creation steps say 'copy the token / paste into the secret / delete the .pem locally' — no credential values embedded (T-08-07 mitigation)"

key-files:
  created: []
  modified: [".planning/OPERATIONS.md"]

key-decisions:
  - "Section heading text matches CONTEXT discretion exactly: '## 1. Marketplace PAT rotation (1-year cadence)', '## 2. Manual emergency-publish runbook (DOC-02)' (kept verbatim from Plan 01), '## 3. Release-branch model & ruleset configuration', '## 4. Rulesets-aware branch-protection probe (Phase 6 correction)', '## 5. Recovery: publish OK, commit-back failed' (the D-2 mandated phrase, with the '5.' prefix), '## 6. SC #5 / Option B reversibility — controlled exercise'"
  - "App name / secret names / pins / branch / back-merge mechanism documented to match Plan 01's chosen design exactly: App story-point-release-bot (slug story-point-release-bot[bot]), secrets APP_ID + APP_PRIVATE_KEY, actions/create-github-app-token@v2, branch release, back-merge via gh pr create --base master --head release"
  - "release ruleset documented as 'keep it LIGHT — recommended: only Require linear history (or nothing); do NOT add Require signed commits / Require a pull request unless the App is also on release's bypass list' — because publish.yml pushes the bump commit + tag directly to release with the App token (the GH013 trap)"
  - "PAT scope documented as Marketplace (Publish) minimal, with the flagged RESEARCH A2/Q2 caveat: some Microsoft docs say Marketplace (Manage); if a rotated Publish-only PAT 401s, widen to Manage and record which scope worked"
  - "The A1/Q1 'a GitHub App on a ruleset bypass list bypasses ALL rules including signed-commits' claim flagged in section 3 as user-asserted, not doc-verified — and noted that the current design does not depend on it (master is human-merged, release is kept light)"
  - "Plan 01's intro placeholder note in OPERATIONS.md (which listed sections 1/3/4/5/6 as 'added in Plan 08-02') was updated to past tense now that they're present — minor housekeeping, not a deviation"

patterns-established:
  - "OPERATIONS.md cross-links to evidence-of-event artifacts via relative markdown links: section 4 -> 06 branch-protection-probe-result.md + 07-VERIFICATION.md; section 5 -> 07-VERIFICATION.md (the worked recovery example)"

requirements-completed: [DOC-01]

duration: ~4min
completed: 2026-05-11
---

# Phase 8 Plan 02: OPERATIONS.md — complete the comprehensive auto-publish ops doc Summary

**`.planning/OPERATIONS.md` is now the single 6-section durable operations doc: Marketplace PAT rotation (DOC-01), the manual emergency-publish runbook (DOC-02, from Plan 01), the release-branch model + ruleset configuration + GitHub App creation steps, the rulesets-aware branch-protection probe correction for the Phase 6 gap, the `## Recovery: publish OK, commit-back failed` partial-failure runbook linking 07-VERIFICATION.md, and the SC #5 / Option B reversibility controlled-exercise procedure.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-11T12:16:00Z
- **Completed:** 2026-05-11T12:20:00Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Added `## 1. Marketplace PAT rotation (1-year cadence)` ABOVE the existing Plan-01 `## 2.` section — the DOC-01 procedure: sign in via dev.azure.com (with the aex.dev.azure.com publisher-management note), + New Token, "All accessible organizations", Custom defined -> 1 year, Marketplace -> Publish scope (+ the Publish-vs-Manage caveat), copy the token, update the `TFX_PAT` repo secret, revoke the old token, verify via `workflow_dispatch` on `release`.
- Added `## 3. Release-branch model & ruleset configuration` — the master -> release promotion model end-to-end (App token first, gates, Option B in-memory bump, package, upload-artifact, publish = point of no return, App-token commit-back to `release`, best-effort tag, `gh pr create` back-merge PR, human Web-UI merge of the back-merge PR); why a `release` branch (batch noisy master merges); the GitHub App creation steps (Developer settings -> GitHub Apps -> New GitHub App; Contents+Pull requests read-write; install on the repo; `APP_ID` / `APP_PRIVATE_KEY` secrets; delete the `.pem`); `release` branch creation; master ruleset re-tighten (PR + status checks + signed commits + App on bypass); `release` ruleset "keep it light" guidance; how to re-tighten/relax; the A1/Q1 "user-asserted, not doc-verified" caveat.
- Added `## 4. Rulesets-aware branch-protection probe (Phase 6 correction)` — the Phase 6 probe checked only the legacy `/branches/{b}/protection` endpoint and missed the master ruleset (-> `GH013` in Phase 7); the correction: probe BOTH legacy and `/rules/branches/{b}` (rulesets); a copy-pasteable `gh api` snippet querying both for `master` and `release`; cross-links to the Phase 6 probe artifact and 07-VERIFICATION.md.
- Added `## 5. Recovery: publish OK, commit-back failed` (the D-2 mandated heading text) — when it happens (commit-back rejected or tag-push failed; note that a publish-step failure leaves nothing to recover, per Option B); the recovery procedure (confirm published version, hand-edit BOTH `package.json` + `vss-extension.json` `version`, commit `chore(release): vX.Y.Z [skip ci]`, open + Web-UI-merge a recovery PR, push the annotated tag manually, open a `release -> master` PR if the branches diverged); the worked Phase 7 example link; "never hand-edit `version` outside this runbook".
- Added `## 6. SC #5 / Option B reversibility — controlled exercise` — purpose (prove a failed publish leaves Marketplace + `release` untouched, no orphan commit/tag, and re-running recovers cleanly); the procedure (revoke `TFX_PAT` -> `workflow_dispatch` on `release` -> confirm safe failure -> mint a fresh PAT per section 1 -> re-run -> confirm clean recovery + Web-UI-merge the back-merge PR); the cost note (the re-run ships a real patch; can double as a re-verification); evidence goes to `08-SC5-EXERCISE.md` (Plan 08-03 produces it).
- Section 2 (the DOC-02 emergency-publish runbook from Plan 01) and its `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation` line are intact and unchanged in substance.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add OPERATIONS.md section 1 — Marketplace PAT rotation (DOC-01)** — `48c005b` (docs)
2. **Task 2: Add OPERATIONS.md sections 3 + 4 — release-branch model, ruleset config, GitHub App steps, rulesets-aware probe note** — `8ed0ced` (docs)
3. **Task 3: Add OPERATIONS.md sections 5 + 6 — partial-failure recovery runbook (D-2) and SC #5 / Option B controlled-exercise procedure** — `d449f9a` (docs)

**Plan metadata:** _(this commit — docs: complete plan)_

## Files Created/Modified
- `.planning/OPERATIONS.md` — inserted section 1 (PAT rotation) above the existing section 2; appended sections 3 (release-branch model + ruleset config + GitHub App creation steps), 4 (rulesets-aware branch-protection probe correction), 5 (`Recovery: publish OK, commit-back failed`), 6 (SC #5 / Option B controlled exercise); updated the intro placeholder note to past tense. Final state: 6 `##` sections in order; section 2's DOC-02 capture untouched; no credential-looking strings; cross-links to the Phase 6 probe artifact + 07-VERIFICATION.md.

## Decisions Made
- Followed the plan's `<discretion_decisions>` block verbatim for section headings, the App/secret/pin/branch/back-merge names (matching Plan 01's chosen design), the `release`-ruleset "keep it light" guidance, the PAT-scope wording with the Publish-vs-Manage caveat, and the A1/Q1 user-asserted flag.
- Updated Plan 01's intro placeholder note in OPERATIONS.md from "Sections 1, 3, 4, 5, 6 are added in Plan 08-02" to past tense — minor housekeeping consistent with the file now being complete; not a content change to any section.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Git emits `LF will be replaced by CRLF` warnings on each commit (Windows working copy; the repo's existing `.planning/` files are committed with LF). Cosmetic — `git add` normalizes; no functional impact.

## User Setup Required
None for this plan — it is docs-only. The user-action handoffs that OPERATIONS.md *documents* (create the GitHub App, add `APP_ID` / `APP_PRIVATE_KEY` secrets, create the `release` branch, re-tighten the master ruleset, configure the `release` ruleset, the SC #5 PAT revoke/restore) are executed in **Plan 08-03**, not here.

## Next Phase Readiness
- Plan 08-03 has the durable how-to for every user action it needs to walk the user through: GitHub App creation, `release` branch creation, the two repo secrets, master + `release` ruleset configuration, the re-verification run, and the SC #5 broken-PAT exercise — all documented in OPERATIONS.md §1/§3/§6.
- Plan 08-04 (legacy cleanup) can proceed — DOC-02's "tfx invocation captured BEFORE the archive" requirement was already satisfied in Plan 08-01 and is untouched here.
- Plan 08-05 (DOC-03 PROJECT.md promotion) can reference OPERATIONS.md as the single ops doc the "Validated" entry points to; the corrected release-branch-model wording ("every promotion to release ships a patch; master stays fully protected") is consistent with OPERATIONS.md §3.

## Self-Check: PASSED

- Files: `.planning/OPERATIONS.md` (present, 6 `##` sections in order), `.planning/phases/08-cleanup-and-runbooks/08-02-SUMMARY.md` (this file) — present.
- Commits: `48c005b` (Task 1), `8ed0ced` (Task 2), `d449f9a` (Task 3) — all in git history (`git log --oneline`).
- Verification gates: `SEC1_OK`, `SEC34_OK`, `SEC56_OK` all passed; `grep -c '^## '` = 6; section 2's DOC-02 `npx tfx extension publish ...` line intact; no `-----BEGIN PRIVATE KEY-----` material.

---
*Phase: 08-cleanup-and-runbooks*
*Completed: 2026-05-11*
