# Phase 8: Cleanup & Runbooks - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 08-cleanup-and-runbooks
**Areas discussed:** OPERATIONS.md scope, Verified-commit-back / ruleset migration, SC #5 broken-PAT exercise, publish-cezari.cjs archival + organic-trigger + old publisher

---

## OPERATIONS.md scope

### Q: How comprehensive should OPERATIONS.md be?

| Option | Description | Selected |
|--------|-------------|----------|
| Comprehensive — absorb everything Phase 7 surfaced | One doc: PAT rotation + emergency-publish runbook + relaxed-ruleset state & re-tighten guide + rulesets-aware probe note + partial-failure recovery + SC #5 procedure | ✓ |
| Minimal — just DOC-01 + DOC-02 | Only PAT rotation + emergency-publish; carry-overs go elsewhere | |
| Comprehensive minus the SC #5 procedure | Everything except SC #5 (its writeup goes to a verification artifact if executed) | |

**User's choice:** Comprehensive — absorb everything Phase 7 surfaced.
**Notes:** OPERATIONS.md becomes the single durable ops doc for the whole auto-publish surface (D-1). Per Phase 6/7 D-3, this is where all the rationale lives; the workflow YAML stays comment-free.

### Q: Where does the partial-failure recovery runbook live?

| Option | Description | Selected |
|--------|-------------|----------|
| In OPERATIONS.md as a named runbook section | `## Recovery: publish OK, commit-back failed` — generalized steps; 07-VERIFICATION.md keeps the evidence | ✓ |
| Only in 07-VERIFICATION.md (already there) | Don't duplicate; maintainer reads the verification artifact | |
| Both — OPERATIONS.md links to 07-VERIFICATION.md | Short section + pointer | |

**User's choice:** In OPERATIONS.md as a named runbook section.
**Notes:** Generalizes the Phase 7 recovery into a reusable procedure (D-2). OPERATIONS.md links back to 07-VERIFICATION.md for the worked example.

---

## Verified-commit-back / ruleset migration

### Q: How should Phase 8 handle the verified-commit-back path?

| Option | Description | Selected |
|--------|-------------|----------|
| Document-only — OPERATIONS.md runbook, no implementation | Write the "if you re-tighten, do this" runbook; build nothing; repo stays as-is | |
| Implement now — GitHub App (or fine-grained PAT) for commit-back | Build the App, swap publish.yml's token, add App to ruleset bypass, re-tighten master, re-verify | ✓ |
| Fine-grained PAT (lighter), document the App path for later | RELEASE_PAT — half-solves it (PAT push is unsigned) | |

**User's choice:** Implement now — GitHub App for commit-back.
**Notes:** Expands Phase 8 well beyond the original 6 mechanical requirements (D-3).

### Q: For verified commit-back: GitHub App, or fine-grained PAT?

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub App | Personal App, contents:write + metadata:read, installed; App ID + private key as secrets; `actions/create-github-app-token@v1` mints the token; App on the ruleset bypass list bypasses ALL rules | ✓ |
| Fine-grained PAT (RELEASE_PAT) | Repo-admin PAT; bypasses PR/checks but not signed-commits unless commit-back goes via API; ties to personal account; expires | |
| GITHUB_TOKEN via the GitHub API | API-created commits are auto-signed; but GitHub Actions likely can't be added to the ruleset bypass list (confirmed not in bypass options) | |

**User's choice:** GitHub App.
**Notes:** User creates the App in the GitHub UI (Claude can't); Claude does the publish.yml changes; App-creation steps also documented in OPERATIONS.md.

### Q: After wiring verified commit-back, which master-ruleset rules get re-tightened?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-add all three (PR-required + status-checks + signed-commits) — App bypasses all | Full human protection; App on bypass list | (superseded — see below) |
| Re-add only "Require signed commits" | Lighter re-tighten | |
| Leave the ruleset relaxed — just wire the App for future use | Hedge — plumbing without re-tightening | |

**User's choice (free-text, translated from Georgian):** "Let's do it in this same plan — because there can be frequent merging on master, for releases let's have a separate branch onto which several PRs merge and then it goes to the Marketplace, and let's restore full protection on master."
**Notes:** This introduced the **release-branch model** (D-3): a dedicated `release` branch becomes the publish trigger (publish.yml: `push: [master]` → `push: [release]`); feature PRs merge to master frequently; a `master → release` promotion PR fires the publish; master gets FULL ruleset protection restored (PR + checks + signed-commits) with the release App on its bypass list. Changes the milestone-goal wording — "every PR merge to master ships" → "every promotion to release ships; master stays protected" (DOC-03 must reflect this).

### Q: How does a release get triggered in the release-branch model?

| Option | Description | Selected |
|--------|-------------|----------|
| PR from master → release, merged by you | publish.yml on `push: [release]`; you open & merge the promotion PR via Web UI; you control release cadence | ✓ |
| Manual workflow_dispatch on master (no release branch) | Keep publish.yml on master, trigger → workflow_dispatch only; manual publish-via-button | |
| release branch, promotion via fast-forward merge from CLI | `git merge --ff-only master && git push` from your machine; no promotion PR | |

**User's choice:** PR from master → release, merged by you.

### Q: After publish.yml bumps the version and the App commits it to `release`, how does master get the bump?

| Option | Description | Selected |
|--------|-------------|----------|
| App also opens a PR release → master with the bump | After the App commits to `release`, a workflow step opens a `release → master` PR; you merge via Web UI (signed) → master catches up | ✓ |
| Version lives only on release; master's version is a placeholder | master's version field never bumped; release/Marketplace/tags are the version record | |
| Promotion is a non-squash merge; back-merge release → master periodically | release always contains master's history + bump commits; periodic back-merge | |

**User's choice:** App also opens a PR release → master with the bump.
**Notes:** Keeps master == release version. One extra merge-click per release. The Web-UI merge is verified → satisfies master's signed-commits rule.

---

## SC #5 broken-PAT exercise

### Q: Actually run it in Phase 8, or document the procedure?

| Option | Description | Selected |
|--------|-------------|----------|
| Document the procedure in OPERATIONS.md — don't execute | "verifiable, not verified" satisfies ROADMAP SC #5; avoids breaking a working pipeline | |
| Execute the exercise in Phase 8 | Break TFX_PAT → workflow_dispatch → confirm untouched → restore → re-run → confirm clean; capture as a Phase 8 verification artifact | ✓ |
| Skip entirely — SC #5 stays "partial" from Phase 7 | Don't document or execute | |

**User's choice:** Execute the exercise in Phase 8.
**Notes:** Fully verifies Option B in the wild (D-4). Phase 7 only observed the recoverable-state half (commit-back failed, repo stayed clean); the publish-step-failure variant was never exercised. Will burn one or two patch versions (the restore-and-rerun ships a real patch) — planner sequences it relative to the D-3 re-verification run.

---

## publish-cezari.cjs archival + organic-trigger + old publisher

### Q: How should publish-cezari.cjs be archived (CLEAN-01)?

| Option | Description | Selected |
|--------|-------------|----------|
| Move to scripts/.archive/ as a frozen reference | `git mv`; content unchanged + an "ARCHIVED — superseded by publish.yml" header; remove the npm scripts; OPERATIONS.md emergency-publish runbook is the live hatch | ✓ |
| Move to scripts/.archive/ AND keep it runnable as a true emergency hatch | Same move + re-add an `emergency:publish` script — but keeps a second live publish path | |
| Delete it entirely; OPERATIONS.md captures the tfx invocation | Cleanest tree; loses the working code | |

**User's choice:** Move to scripts/.archive/ as a frozen reference.
**Notes:** D-5. No re-added npm script, no second live publish path — the GH Action (now release-branch-triggered) is canonical; OPERATIONS.md is the documented manual fallback. Capture the `tfx` invocation in OPERATIONS.md BEFORE the `git mv` (DOC-02).

### Q: Old publisher cleanup + organic-trigger anomaly — in Phase 8 scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Old publisher: stays deferred. Organic-trigger: folded into the release-branch re-verification | Old `TsezariMshvenieradzeExtensions` cleanup stays a deferred housekeeping item; the trigger anomaly is moot in the release-branch model and covered by the re-verification run | ✓ |
| Fold both into Phase 8 | Phase 8 task to clean up the old publisher + an explicit organic-trigger investigation task | |
| Old publisher: document-only in OPERATIONS.md. Organic-trigger: folded into re-verification | Short note about the old publisher in OPERATIONS.md; trigger folded | |

**User's choice:** Old publisher: stays deferred. Organic-trigger: folded into the release-branch re-verification.
**Notes:** D-6 / D-6b. Old publisher is orthogonal to v1.1 and doesn't block close. The "PR #5 didn't fire publish.yml" anomaly is moot in the new model (publish.yml triggers on `release`, not master); the re-verification run confirms the new trigger works.

---

## Claude's Discretion

- App name; secret names (`APP_ID` / `APP_PRIVATE_KEY` conventional); `actions/create-github-app-token` version pin.
- How the `release → master` back-merge PR is opened by a workflow step (`peter-evans/create-pull-request@v7`, `gh pr create` with the App token, or `git-auto-commit-action`'s branch feature).
- `release` branch name (`release` recommended).
- Whether the `release` branch gets its own ruleset (light) or none, and whether the App needs to be on its bypass list.
- Exact `OPERATIONS.md` section structure.
- Whether the SC #5 exercise gets its own artifact (`08-SC5-EXERCISE.md`) or a section in `08-VERIFICATION.md`; whether its restore-and-rerun doubles as the D-3 re-verification.
- The "ARCHIVED" header-comment wording for the moved `publish-cezari.cjs`.
- Whether syncing the Phase 7 `.planning/` close-out commits to master (docs PR `milestone1.1 → master`) is an early Phase 8 task or left to the user.
- Plan decomposition / whether Phase 8 should be split into 8 + 8.1.

## Deferred Ideas

- Old `TsezariMshvenieradzeExtensions` publisher cleanup (low-priority Phase 5 housekeeping carry-over).
- v1.2+ "Future Requirements": PAT-smoke cron, conventional-commits semver, CHANGELOG auto-generation, Marketplace-version reconciliation pre-flight, bundle-size trend reporting, multi-environment staged promote.
- Bump GitHub Actions to Node-24-compatible versions (Node 20 deprecation; runner forces Node 24 from 2026-06-02) — non-blocking but has a deadline; could be folded into Phase 8's publish.yml refactor or a quick task.
- APPLY-03 pre-fill production fix, Phase 5 screenshots, cross-process smoke, cross-phase integration debt — v1.0.1+ / v2 carry-overs.
