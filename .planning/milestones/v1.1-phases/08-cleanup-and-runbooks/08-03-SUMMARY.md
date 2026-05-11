---
phase: 08-cleanup-and-runbooks
plan: 03
subsystem: infra
tags: [release-branch, github-app, rulesets, marketplace-publish, sc5-exercise, reverification, ci-cd, option-b]

requires:
  - phase: 08-cleanup-and-runbooks
    provides: "publish.yml refactored to the release-branch model + GitHub App token + release->master back-merge step; ci.yml pull_request -> [master, release] (Plan 08-01); OPERATIONS.md sections 1/3/4/5/6 — the App-creation / ruleset-config / SC #5 procedures this plan executes (Plan 08-02)"
  - phase: 07-bump-publish-tag
    provides: "07-VERIFICATION.md — the v1.0.8 publish, the master-ruleset GH013 finding, the recovery log; the SC #5 + rulesets-aware-probe carry-overs"
provides:
  - "The release-branch publish model is verified in the wild: a master->release promotion-PR merge (PR #11) fired publish.yml and shipped v1.0.9 end-to-end (App-token commit-back to release, tag, release->master back-merge PR #12 merged)"
  - "ROADMAP Phase 7 SC #5 fully verified: the broken-PAT run (25682108788) failed SAFELY at Publish to Marketplace — no bump commit, no tag, no back-merge PR, Marketplace stayed at 1.0.9 (Option B); the restored-PAT re-run (25682284821) recovered cleanly to v1.0.10"
  - "master ends FULLY protected (PR + Build & verify status check + signed commits + linear history) with the story-point-release-bot App on the bypass list — the Phase 7 interim ruleset relaxation is closed"
  - ".planning/phases/08-cleanup-and-runbooks/08-SC5-EXERCISE.md — the evidence artifact (run URLs, versions, commit SHAs, PR numbers, the safe-failure / clean-recovery confirmations)"
  - "publish.yml Tag release step fixed (explicit git identity) — annotated tags now create cleanly; tags v1.0.8 / v1.0.9 / v1.0.10 on origin"
  - "master version advanced 1.0.8 -> 1.0.9 -> 1.0.10; Marketplace listing at 1.0.10"
affects: [08-04-legacy-cleanup, 08-05-project-md-promotion]

tech-stack:
  added: []
  patterns:
    - "Release-branch promotion flow: feature PRs -> master (fully protected); master->release promotion PR merge -> push to release -> publish.yml (App-token mint as step 1, gates, in-memory bump, package, upload-artifact, publish, App commit-back to release, tag, release->master back-merge PR); operator squash-merges the back-merge PR"
    - "Back-merge / promotion PRs onto master are squash-merged (linear-history rule); the GitHub-signed squash commit satisfies the signed-commits rule"

key-files:
  created:
    - ".planning/phases/08-cleanup-and-runbooks/08-SC5-EXERCISE.md"
    - ".planning/phases/08-cleanup-and-runbooks/08-03-SUMMARY.md"
  modified:
    - ".github/workflows/publish.yml (Tag release step — added git config user.name/user.email; committed on the release branch as b64cdcd [skip ci], reached master via PR #12)"

key-decisions:
  - "Approach: separate-but-adjacent (the plan's recommended path) — the re-verification shipped v1.0.9 (happy path through the new model); the SC #5 broken-PAT recovery run then shipped v1.0.10. Not collapsed into one patch."
  - "Task 1 done as a squash-merge PR #9 with [skip ci] in the title — the legacy publish.yml still on master at the time triggered on push:[master] and the PR touched workflow files (not paths-ignored), so [skip ci] suppressed an off-script publish on the merge."
  - "Task 3 needed a non-paths-ignored diff between master and release — added a no-op comment to webpack.config.cjs via PR #10 to master first, then the master->release promotion PR #11 carried it."
  - "Tag-step git-identity bug fixed on the release branch directly with [skip ci] (no re-trigger) rather than via a PR-to-master chain; the fix reached master via the v1.0.9 back-merge PR #12. The missing v1.0.9 tag was then created manually at c3f8d3a (the published commit)."
  - "PR #13 version conflict (master 1.0.9 vs release 1.0.10) resolved by merging master into release keeping 1.0.10, committed on release with [skip ci]; that [skip ci] also skipped the back-merge PR's ci.yml check, so PR #13 was squash-merged via the repo-owner's ruleset bypass."
  - "PAT scope for the SC #5 restore: Marketplace (Publish) only — sufficient (the recovery run did not 401); OPERATIONS.md §1's 'widen to Manage' fallback not needed."

patterns-established:
  - "Evidence-of-event artifact 08-SC5-EXERCISE.md mirrors 07-VERIFICATION.md depth (run URLs, conclusions, per-step tables, version numbers, commit SHAs, PR numbers) and cross-links the Marketplace listing + 07-VERIFICATION.md"

requirements-completed: []  # DOC-03's documentation deliverable ships in Plan 08-05; this plan produced its live-evidence dependency (the D-3 re-verification + D-4 SC #5 exercise)

deviations:
  - "App installation initially lacked Pull requests: Read and write -> create-github-app-token@v2's first attempt of run 25680642989 failed at 'Mint release-bot token' ('permissions requested are not granted to this installation'). The user added the permission and re-ran; nothing had run past token-minting. (OPERATIONS.md §3 already lists the permission as required.)"
  - "publish.yml Tag release step ran 'git tag -a' with no committer identity -> 'fatal: empty ident name' on the v1.0.9 run; continue-on-error per TAG-04 kept the workflow green. Fixed: git config user.name/user.email added to that step (b64cdcd, [skip ci]); v1.0.9 tag created manually. Verified working on the v1.0.10 recovery run."
  - "Plan 08-03 expected Task 3's promotion-PR merge to be the publish trigger AND verify the push-to-release trigger fires (D-6b) — both held: run 25680642989 was push-triggered by the PR #11 merge. A workflow_dispatch fallback was not needed for the re-verification (it was used, as designed, for the SC #5 exercise runs)."
  - "Self-check / orchestration note: this SUMMARY + 08-SC5-EXERCISE.md were authored by the execute-phase orchestrator inline (Task 5 is an auto task; Tasks 1-4 were human-action/human-verify checkpoints driven interactively), not by a spawned executor subagent — STATE.md / ROADMAP.md updates for plan 08-03 are made by the orchestrator after this plan."

self_check: PASSED
---

# Plan 08-03 Summary — User-action handoff + release-branch re-verification + SC #5 broken-PAT exercise

## Outcome

The new release-branch publish model is **verified end-to-end in the wild**, and **ROADMAP Phase 7 SC #5 is fully verified** (both halves: Phase 7's post-publish commit-back failure left the repo clean; Phase 8's deliberate publish-step failure left Marketplace + `release` untouched, then a clean restore-and-rerun). master ends fully protected with the `story-point-release-bot` App on the bypass list — the Phase 7 interim relaxation is closed.

## What happened (the 5 tasks)

1. **Task 1 — docs sync to master.** PR **#9** (`milestone1.1 → master`, squash, `[skip ci]`, merged `ba8cdeb`): master synced with the Phase 7 close-out + Phase 8 planning docs + the Plan 08-01 workflow refactor. master `version` confirmed at **1.0.8**. No `Publish` run fired. *(A `milestone1.1`/`master` divergence — master had the 2 extra commits `eb696c6` + `eba84b3` — was resolved by merging `origin/master` into `milestone1.1` first; `package.json`/`vss-extension.json` auto-merged to 1.0.8.)*

2. **Task 2 — release branch + GitHub App + secrets + rulesets (user, GitHub UI).** Created: long-lived **`release`** branch; **`story-point-release-bot`** GitHub App (Contents = write, Pull requests = write, Metadata = read; installed on this repo only); repo secrets **`APP_ID`** + **`APP_PRIVATE_KEY`**; re-tightened master's ruleset **"Master Branch Protection"** (PR + `Build & verify` status check + signed commits + linear history) with the App on the **bypass list**; pruned the stale `build`/`test`/`ci.yml` required-status contexts. `release` left with **no ruleset** (the recommended light automation lane).

3. **Task 3 — re-verification run → v1.0.9.** `master → release` promotion PR **#11** (diff: a no-op `webpack.config.cjs` comment, landed on master via PR **#10** first) squash-merged → `push` to `release` → `publish.yml` run https://github.com/tsmshvenieradze/StoryPointExtension/actions/runs/25680642989 (after a fixed App-permissions retry) shipped **v1.0.9**: App-token mint ✓, gates ✓, in-memory bump ✓, `vsix-1.0.9` artifact ✓, **published ✓**, App commit-back `c3f8d3a chore(release): v1.0.9 [skip ci]` to `release` ✓, no re-trigger ✓, **tag step failed** (`empty ident name` — fixed, see Deviations) → workflow green per TAG-04, back-merge PR **#12** opened. PR #12 squash-merged → master `version` → **1.0.9**. *(CONTEXT D-6b answered: the run was `push`-triggered by the PR #11 merge — a push/merge to `release` fires `publish.yml`.)*

4. **Task 4 — SC #5 broken-PAT exercise.**
   - **Safe failure** — `TFX_PAT` revoked → `workflow_dispatch` on `release` → run https://github.com/tsmshvenieradze/StoryPointExtension/actions/runs/25682108788 **failed at `Publish to Marketplace` (exit 255)**; `Commit version bump to release` / `Tag release` / `Open release -> master back-merge PR` all **skipped**. Marketplace stayed at **1.0.9**, `release` unchanged, no `v1.0.10` tag, no orphan PR. **Option B reversibility verified.**
   - **Clean recovery** — fresh `TFX_PAT` (scope `Marketplace (Publish)`, "All accessible organizations", 1 year) → `workflow_dispatch` on `release` → run https://github.com/tsmshvenieradze/StoryPointExtension/actions/runs/25682284821 **all green**: published **v1.0.10**, `4bfce4d chore(release): v1.0.10 [skip ci]` on `release`, **tag `v1.0.10` created** (identity fix works), back-merge PR **#13** opened. PR #13 (version conflict resolved → kept 1.0.10) squash-merged via owner bypass → master `version` → **1.0.10**.

5. **Task 5 — evidence artifact.** Wrote `.planning/phases/08-cleanup-and-runbooks/08-SC5-EXERCISE.md` (run URLs, conclusions, per-step tables, versions, commit SHAs, PR numbers, the safe-failure / clean-recovery confirmations, the Phase 7 SC #5 disposition, the D-6b note, and the follow-ups) and this SUMMARY.

## State at completion

- master HEAD `10e1cdc` — `package.json` / `vss-extension.json` `version` = **1.0.10**; fully protected ruleset with the App on bypass.
- `release` HEAD `832e833` — `version` = **1.0.10**; no ruleset.
- Tags on origin: `v1.0.8`, `v1.0.9`, `v1.0.10`.
- Marketplace listing: **1.0.10** (https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator).
- `.github/workflows/publish.yml`: release-branch model, with the `Tag release` git-identity fix (on both `master` and `release`).
- Open PRs: none.

## Verification (plan must_haves)

- ✅ Phase 7 close-out synced to master (PR #9); a docs/workflow PR did not fire `publish.yml`.
- ✅ User created the release branch, the App (`contents:write` + `pull-requests:write` + `metadata:read`), the `APP_ID`/`APP_PRIVATE_KEY` secrets, re-tightened master's ruleset with the App on bypass, kept `release` light.
- ✅ A real `master → release` promotion-PR merge fired `publish.yml` and shipped v1.0.9 end-to-end (bump → `tfx create` → upload-artifact → `tfx publish` → App commit-back to `release` → tag (after the fix) → back-merge PR → merged).
- ✅ SC #5 broken-PAT exercise executed: publish step failed AND Marketplace + `release` stayed untouched (no orphan commit/tag/PR) → fresh PAT → re-run → clean publish + commit-back + tag + back-merge PR.
- ✅ `08-SC5-EXERCISE.md` captures it all with run URLs, version numbers, and the safe-failure / clean-recovery evidence (≥ 40 lines; contains `marketplace.visualstudio.com`, `1.0.9`, `workflow_dispatch` / push-to-release, `SC #5`).
