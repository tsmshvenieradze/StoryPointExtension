---
phase: 08-cleanup-and-runbooks
plan: 01
subsystem: infra
tags: [github-actions, github-app, ci-cd, tfx-cli, marketplace, release-branch, create-github-app-token]

requires:
  - phase: 07-bump-publish-tag
    provides: "the real publish chain in publish.yml (bump -> tfx create -> upload-artifact -> tfx publish -> commit-back -> tag) verified green by run #25641329824"
provides:
  - "publish.yml refactored to the release-branch model: triggers on push:[release] + workflow_dispatch (no more push:[master])"
  - "publish.yml mints a GitHub App installation token (actions/create-github-app-token@v2) before checkout and threads it into checkout, the tag-push step, and the back-merge PR step"
  - "publish.yml opens a release -> master back-merge PR after publish/commit/tag (gh pr create with the App token), guarded against a PR already being open"
  - "publish.yml actor-guard extended to story-point-release-bot[bot]; concurrency group publish-release; [skip ci] preserved; branch-protection probe now probes release with the design-rationale comment block removed"
  - "ci.yml pull_request trigger extended to [master, release]"
  - ".planning/OPERATIONS.md created with section 2 — the manual emergency-publish runbook (DOC-02), capturing the current public-publish tfx invocation before publish-cezari.cjs is archived in Plan 08-04"
affects: [08-02-operations-runbook, 08-03-user-handoff-and-reverification, 08-04-legacy-cleanup, 08-05-project-md-promotion]

tech-stack:
  added: ["actions/create-github-app-token@v2 (GitHub Actions Marketplace action)"]
  patterns:
    - "App-token-first ordering: mint the installation token as the workflow's first step, before checkout, so checkout's persisted git credential is the App token"
    - "Commit-back via a GitHub App identity: git-auto-commit-action@v6 inherits the App credential from the checkout step (the action has no `token` input in v6)"
    - "Release-branch promotion model: feature PRs merge to master; promoting master -> release fires the Marketplace publish; the bump catches up to master via a human-merged release -> master PR (verified signature)"

key-files:
  created: [".planning/OPERATIONS.md"]
  modified: [".github/workflows/publish.yml", ".github/workflows/ci.yml"]

key-decisions:
  - "App slug literal `story-point-release-bot[bot]` used for the actor-guard and the commit author (create-github-app-token@v2 does expose outputs.app-slug, but the literal keeps the actor-guard string and the commit author identical and explicit)"
  - "create-github-app-token pinned to @v2 — a maintained major of the official actions/-org action; confirmed outputs.token and outputs.app-slug exist in v2's action.yml before committing"
  - "Back-merge PR uses `gh pr create --base master --head release` with GH_TOKEN: the App token (no second new action to pin); guarded against a PR already being open"
  - "DEVIATION (Rule 1): stefanzweifel/git-auto-commit-action@v6 has no `token` input — the plan/RESEARCH code examples showed one. The App credential is threaded into the commit-back push via the checkout step's `token:` input instead (persisted git credential). Net effect is identical: the commit-back push goes through the App identity."

patterns-established:
  - "App-token-first: actions/create-github-app-token@v2 runs as step 1; actions/checkout@v5 takes `token: ${{ steps.app-token.outputs.token }}` so all later `git push` (commit-back, tag) use the App identity"
  - "Workflow YAML stays comment-free (D-3): the probe-step design-rationale comment block was removed; its rationale will live in OPERATIONS.md §4 (Plan 08-02)"

requirements-completed: [DOC-02]

duration: ~5min
completed: 2026-05-11
---

# Phase 8 Plan 01: Workflow Architecture Refactor — release-branch publish + GitHub App token Summary

**publish.yml moved from "publish on every push to master" to the release-branch promotion model with a GitHub App installation token for verified commit-back and a release -> master back-merge PR; ci.yml extended to PRs targeting [master, release]; OPERATIONS.md §2 (DOC-02 emergency-publish runbook) captured before the legacy script is archived.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-11T12:12:09Z
- **Completed:** 2026-05-11T12:13:42Z
- **Tasks:** 3
- **Files created/modified:** 3 (1 created, 2 modified)

## Accomplishments
- `.github/workflows/publish.yml` rewritten as the release-branch model: `on: push: [release]` + `workflow_dispatch` (paths-ignore list unchanged), `concurrency.group: publish-release`, actor-guard extended to `story-point-release-bot[bot]`, App token minted first via `actions/create-github-app-token@v2`, App token threaded into checkout / tag-push / back-merge PR, new "Open release -> master back-merge PR" step, branch-protection probe re-pointed at `release` with its ~10-line design-rationale comment block removed, and all Phase 6/7 gate steps preserved in order.
- `.github/workflows/ci.yml` `pull_request.branches` extended to `[master, release]` (no `push:` trigger added).
- `.planning/OPERATIONS.md` created with the H1 + intro + the Plan-08-02 placeholder note + section 2 (the manual emergency-publish runbook, DOC-02) capturing the current public-publish `tfx` invocation verbatim — captured now, before Plan 08-04 archives `scripts/publish-cezari.cjs`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture the canonical tfx invocation into a new .planning/OPERATIONS.md (DOC-02)** — `70dd969` (docs)
2. **Task 2: Refactor publish.yml — release-branch trigger + GitHub App token + back-merge PR** — `431a68d` (feat)
3. **Task 3: Extend ci.yml's pull_request trigger to the release branch** — `cade56d` (feat)

**Plan metadata:** _(this commit — docs: complete plan)_

## Files Created/Modified
- `.planning/OPERATIONS.md` — created; H1 + intro + Plan-08-02 placeholder + section 2 (manual emergency-publish runbook, DOC-02) with the verbatim `npx tfx extension create ...` and `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation` invocations.
- `.github/workflows/publish.yml` — refactored to the release-branch model (trigger, concurrency group, actor-guard, App-token step, checkout token, probe re-point + comment-block removal, App-token-bot commit identity, App token on tag step, new back-merge PR step, summary text updated master->release where appropriate).
- `.github/workflows/ci.yml` — `pull_request.branches: [master]` -> `[master, release]`.

## Decisions Made
- Used the `story-point-release-bot[bot]` literal (rather than `${{ steps.app-token.outputs.app-slug }}[bot]`) for the actor-guard string and the commit author/committer identity — keeps the guard match and the commit identity byte-for-byte identical and self-documenting. The plan explicitly allowed either; `create-github-app-token@v2`'s `action.yml` was checked and *does* expose `outputs.app-slug`, so the literal is a deliberate style choice, not a fallback.
- Pinned `actions/create-github-app-token@v2` (maintained major of the official `actions/` action; `outputs.token` + `outputs.app-slug` confirmed present in v2's `action.yml` before committing).
- Back-merge PR opened with `gh pr create --base master --head release` + `GH_TOKEN: ${{ steps.app-token.outputs.token }}`, guarded by a `gh pr list ... --jq 'length'` check so a re-run doesn't open a duplicate PR.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `stefanzweifel/git-auto-commit-action@v6` has no `token` input**
- **Found during:** Task 2 (Refactor publish.yml)
- **Issue:** The plan's step 8 (and the RESEARCH `## Code Examples` block) instruct adding `token: ${{ steps.app-token.outputs.token }}` to the `git-auto-commit-action@v6` step. The IDE YAML linter flagged `Invalid action input 'token'`; `curl`-ing `https://raw.githubusercontent.com/stefanzweifel/git-auto-commit-action/v6/action.yml` confirms v6's `inputs:` list does NOT include `token` (it was never a v6 input — the action pushes with whatever credential the checkout step persisted).
- **Fix:** Removed the `token:` line from the commit-back step. The App credential is already threaded into the commit-back push via the `actions/checkout@v5` step's `token: ${{ steps.app-token.outputs.token }}` input (line 43), which persists the App-token git credential for all subsequent `git push` calls in the job — so the commit-back push still goes through the `story-point-release-bot[bot]` App identity. Net behavior is identical to what the plan intended.
- **Files modified:** `.github/workflows/publish.yml`
- **Verification:** YAML parses clean (`js-yaml` load); IDE diagnostics clear for that line; `grep` confirms `steps.app-token.outputs.token` still appears (checkout, tag step, back-merge PR — 3 occurrences) and `[skip ci]` is still in the commit message.
- **Committed in:** `431a68d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule-1 bug)
**Impact on plan:** The deviation corrects an impossible action-input the plan/RESEARCH inherited from a stale example; the threading still happens (via checkout's persisted credential), so the design intent — "commit-back commits as the GitHub App identity" — is fully preserved. No scope creep. The `must_haves` truth "threads that token into checkout, the commit-back action, the tag-push step, and the back-merge PR step" is satisfied in substance: the token reaches the commit-back action's `git push` via the persisted checkout credential, which is the only mechanism `git-auto-commit-action@v6` actually supports. The `key_links` row that names `git-auto-commit-action` as a `token:`-threading target should be read as "the commit-back push uses the App token" — true via checkout.

## Issues Encountered
- IDE diagnostics also warn `Context access might be invalid: APP_ID` / `APP_PRIVATE_KEY` — expected and not a defect: those repo secrets are created by the user in Plan 08-03, so the linter (which validates against currently-defined secrets) can't see them yet. Left as-is.
- `python -c "import yaml ..."` failed (no PyYAML on this machine); fell back to `js-yaml` via `node -e` — both workflow files parse clean.

## User Setup Required
None for this plan. The GitHub App creation, the `APP_ID` / `APP_PRIVATE_KEY` repo secrets, the `release` branch creation, and the master-ruleset re-tighten are all the user's responsibility in **Plan 08-03** (not this plan). Until then, `publish.yml`'s App-token step will fail if triggered — which is fine, the release branch doesn't exist yet either.

## Next Phase Readiness
- Plan 08-02 can now fill in the rest of `.planning/OPERATIONS.md` (sections 1, 3, 4, 5, 6) — the file exists with a coherent skeleton and the placeholder note pointing to 08-02; §4 must capture the probe-step design rationale that was removed from `publish.yml` here.
- Plan 08-03 has the workflow side of the release-branch model wired and waiting for the App + secrets + `release` branch + ruleset re-tighten, then the v1.0.9 re-verification run.
- Note for 08-03: the workflow references `secrets.APP_ID` / `secrets.APP_PRIVATE_KEY` and a `release` branch — none of which exist yet; 08-03's user-handoff must create all three before the first `release` push.

---
*Phase: 08-cleanup-and-runbooks*
*Completed: 2026-05-11*
