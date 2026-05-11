# 08-SC5-EXERCISE — Release-branch re-verification + SC #5 broken-PAT controlled exercise

**Phase:** 08 — Cleanup & Runbooks · **Plan:** 08-03 (Tasks 3 + 4) · **Date:** 2026-05-11
**Repo:** `tsmshvenieradze/StoryPointExtension` · **Marketplace listing:** https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator

## Scope

This artifact records two in-the-wild verifications run back-to-back:

1. **CONTEXT D-3 re-verification** of the new release-branch publish model — a `master → release` promotion-PR merge auto-ships a patch (**v1.0.9**) end-to-end through `publish.yml` (App-token commit-back → tag → `release → master` back-merge PR).
2. **CONTEXT D-4 / ROADMAP Phase 7 SC #5 controlled exercise** — a deliberately-broken `TFX_PAT` makes `publish.yml` fail **safely** (Option B: Marketplace + `release` untouched, no orphan commit/tag/PR), then a fresh PAT + re-run recovers cleanly (**v1.0.10**).

**Approach taken:** the plan's recommended *separate-but-adjacent* path — the re-verification shipped **v1.0.9** (happy path through the new model); the SC #5 broken-PAT recovery run then shipped **v1.0.10**. Not collapsed into a single patch.

## Pre-conditions established (Plan 08-03 Tasks 1 + 2)

- **Task 1** — docs-sync PR **#9** (`milestone1.1 → master`, squash, `[skip ci]`) merged as `ba8cdeb`: master synced with the Phase 7 close-out + the Phase 8 planning docs + the Plan 08-01 workflow refactor (`publish.yml` → `push:[release]` + GitHub App token + `release → master` back-merge step; `ci.yml` `pull_request` → `[master, release]`). master `version` confirmed at **1.0.8**. No `Publish` run fired.
- **Task 2** — the user created: the long-lived **`release`** branch (off `master`); the **`story-point-release-bot`** GitHub App (Repository permissions: `Contents` = write, `Pull requests` = write, `Metadata` = read) installed on this repo only; repo secrets **`APP_ID`** + **`APP_PRIVATE_KEY`**; re-tightened master's ruleset **"Master Branch Protection"** to full protection — `pull_request` (0 approvals) + `required_status_checks` (`Build & verify`) + `required_signatures` + `required_linear_history` + non-fast-forward + no-deletion — with the `story-point-release-bot` App (Integration) on the **bypass list** alongside the repo-admin role. `release` has **no ruleset** (the recommended "light" automation lane). The stale `build` / `test` / `ci.yml` required-status contexts were pruned, leaving only `Build & verify`.

## 1. Re-verification run — v1.0.9 (CONTEXT D-3)

**Trigger:** `push` to `release` — produced by squash-merging the **`master → release` promotion PR #11** (whose diff was a no-op comment in `webpack.config.cjs`, landed on master via PR #10 first, so the promotion had a non-`paths-ignore`d diff).
**Run:** https://github.com/tsmshvenieradze/StoryPointExtension/actions/runs/25680642989 — **conclusion: success**.

> **First attempt of this run failed** at the very first step — `Mint release-bot token` — with `The permissions requested are not granted to this installation` (`create-github-app-token@v2` asked for `pull-requests: write` but the App installation lacked it). The user added `Pull requests: Read and write` to the App and re-ran. **Nothing had happened past token-minting** — fully safe. *(Recorded as a deviation; OPERATIONS.md §3 already lists `Pull requests: Read and write` as required — this run confirmed why.)*

Verified, in order, on the successful run:

| Step | Result |
|------|--------|
| `Mint release-bot token` | ✅ (App + `APP_ID`/`APP_PRIVATE_KEY` wired correctly) |
| Gates: typecheck → vitest → webpack build → `Bundle size gate (≤ 250 KB gzipped)` → asset audit → `Verify TFX_PAT secret resolves` | ✅ all passed |
| `Probe release branch protection` | ⚠ "inconclusive" warning (the rulesets-aware probe queried `release`; non-blocking, tri-state) — `release` correctly reported as NOT protected, so the App-token push goes through directly |
| `Bump version (in-memory only)` | ✅ `1.0.8 → 1.0.9` (max-wins, no commit yet — Option B) |
| `Package vsix` + `Upload .vsix artifact` | ✅ `.vsix` packaged; artifact **`vsix-1.0.9`** uploaded (90-day) |
| `Publish to Marketplace` | ✅ succeeded — Marketplace Versions table → **1.0.9** |
| `Commit version bump to release` | ✅ `c3f8d3a chore(release): v1.0.9 [skip ci]` pushed to `release`, author/committer **`story-point-release-bot[bot]`** (via the App token) |
| Re-trigger guard | ✅ no second `Publish` run — `[skip ci]` + actor-guard (`github.actor != 'github-actions[bot]' && != 'story-point-release-bot[bot]'`) held |
| `Tag release (best-effort, idempotent)` | ❌ **failed** — `fatal: empty ident name` (the bash step ran `git tag -a` without a configured committer identity; `git-auto-commit-action` sets its identity inline and doesn't persist it). `continue-on-error: true` per TAG-04 → **workflow stayed green**. |
| `Open release -> master back-merge PR` | ✅ PR **#12** (`release → master`, "chore(release): v1.0.9") opened |

**Fix applied (deviation):** added `git config user.name "story-point-release-bot[bot]"` / `git config user.email "story-point-release-bot[bot]@users.noreply.github.com"` to the `Tag release` step in `.github/workflows/publish.yml` (commit `b64cdcd` on `release`, `[skip ci]` so it did not re-trigger). The missing **`v1.0.9`** annotated tag was then created + pushed manually at `c3f8d3a` (per the workflow's own recovery hint). The `publish.yml` fix reached `master` via PR #12.

**Back-merge:** PR #12 squash-merged → master `version` → **1.0.9** (commit `e4504fd`).

**CONTEXT D-6b answered:** a `push`/merge to `release` *does* fire `publish.yml` — this run was `push`-triggered (the PR #11 merge), not `workflow_dispatch`. The Phase 7 "PR #5 didn't fire publish.yml on a merge to master" anomaly is moot in the release-branch model.

## 2. SC #5 — broken-PAT controlled exercise (CONTEXT D-4)

### 2a. Safe failure

**Setup:** the user **revoked** the Azure DevOps `TFX_PAT` (the realistic case — the GitHub secret stays present/non-empty, so the `Verify TFX_PAT secret resolves` gate still passes; `tfx extension publish` then 401s).
**Trigger:** `workflow_dispatch` on `release`.
**Run:** https://github.com/tsmshvenieradze/StoryPointExtension/actions/runs/25682108788 — **conclusion: failure**.

| Step | Result |
|------|--------|
| Mint token, all gates (incl. `Verify TFX_PAT secret resolves`) | ✅ passed |
| `Bump version (in-memory only)` | ✅ computed `1.0.10` — **in memory only**, never committed |
| `Package vsix` + `Upload .vsix artifact` | ✅ `vsix-1.0.10` uploaded (an unused artifact — harmless; the upload step is *before* publish, and nothing on any branch/tag references v1.0.10) |
| **`Publish to Marketplace`** | ❌ **failed, exit code 255** (tfx auth error — revoked PAT) ← the point of no return; never crossed |
| `Commit version bump to release` | ⏭️ **skipped** (`if: success()` — publish failed) → **no bump commit on `release`** |
| `Tag release` | ⏭️ **skipped** → **no `v1.0.10` tag** |
| `Open release -> master back-merge PR` | ⏭️ **skipped** → **no orphan PR** |

**Confirmed:** Marketplace Versions table **unchanged at 1.0.9**; `release` HEAD **unchanged** (no `chore(release): v1.0.10`); no `v1.0.10` tag on origin; no new `release → master` PR. **Option B reversibility verified** — everything upstream of `Publish to Marketplace` leaves `release`/`master`/Marketplace untouched.

### 2b. Clean recovery

**Restore:** the user minted a **fresh `TFX_PAT`** — scope **`Marketplace (Publish)`**, organizations **"All accessible organizations"**, lifespan **1 year** — updated the `TFX_PAT` repo secret, and revoked the old token. *(Publish-only scope was sufficient — the recovery run did not 401; OPERATIONS.md §1's "widen to `Manage` if it 401s" note was not needed.)*
**Trigger:** `workflow_dispatch` on `release`.
**Run:** https://github.com/tsmshvenieradze/StoryPointExtension/actions/runs/25682284821 — **conclusion: success — every step green**.

| Step | Result |
|------|--------|
| Mint token, gates, bump (`1.0.9 → 1.0.10` in memory), package, upload `vsix-1.0.10` | ✅ |
| `Publish to Marketplace` | ✅ succeeded — Marketplace Versions table → **1.0.10** |
| `Commit version bump to release` | ✅ `4bfce4d chore(release): v1.0.10 [skip ci]` on `release`, author `story-point-release-bot[bot]` |
| `Tag release (best-effort, idempotent)` | ✅ **`v1.0.10` annotated tag created + pushed** — the identity fix from §1 works (this is the step that failed on the v1.0.9 run) |
| Re-trigger guard | ✅ no second `Publish` run |
| `Open release -> master back-merge PR` | ✅ PR **#13** (`release → master`, "chore(release): v1.0.10") opened |

**Back-merge:** PR #13 had a `version` conflict (master `1.0.9` vs `release` `1.0.10`); resolved by merging `master` into `release` keeping **1.0.10** (commit `832e833` on `release`, `[skip ci]` so it did not re-trigger `publish.yml`). `[skip ci]` also suppressed the `ci.yml` PR check on PR #13, so the back-merge PR was squash-merged via the repo-owner's ruleset bypass. master `version` → **1.0.10** (commit `10e1cdc`).

**Tags on origin after the exercise:** `v1.0.8`, `v1.0.9`, `v1.0.10`.

## Disposition vs ROADMAP Phase 7 SC #5

**SC #5 is now FULLY verified in the wild — both halves:**

- **(a) post-publish commit-back failure** — observed in **Phase 7** (`07-VERIFICATION.md`): v1.0.8 published, then the bot's commit-back was rejected by master's (then-stricter) ruleset; master stayed at v1.0.7 with **no orphan commit/tag** — recovered via a hand-bump `[skip ci]` PR + manual tag.
- **(b) publish-step failure** — observed **here** (run `25682108788`): a deliberately broken `TFX_PAT` failed `Publish to Marketplace`; Marketplace + `release` stayed untouched, **no orphan bump commit, no orphan tag, no orphan PR**; a fresh PAT + re-run (`25682284821`) recovered cleanly to v1.0.10.

The Phase 7 "PR #5 merge didn't fire `publish.yml`" anomaly (CONTEXT D-6b) is **moot** in the release-branch model, and the §1 re-verification independently confirmed a `push`/merge to `release` *does* fire `publish.yml`.

## Follow-ups

1. **`publish.yml` `Tag release` git-identity fix** — applied (`b64cdcd` on `release`; reached `master` via PR #12). Already live everywhere; no further action.
2. **App `Pull requests: Read and write` permission** — added by the user; OPERATIONS.md §3 already documents it as required (this exercise confirmed why).
3. **Back-merge-PR conflict-resolution + `[skip ci]` gotcha** — a `[skip ci]` on the conflict-resolution commit also skips the back-merge PR's required `ci.yml` check, leaving it merge-blocked for non-bypass actors → merge via the owner's ruleset bypass, or temporarily relax "Require status checks". *Worth a one-line note in OPERATIONS.md §3 / §5.*
4. **`strict_required_status_checks_policy` ("Require branches to be up to date before merging")** on master adds "behind"-friction to every promotion / back-merge PR (the model keeps master/release perpetually SHA-diverged via squash merges) — recommend leaving it OFF. *(Operator's discretion.)*
5. **Node 20 action deprecation** — `create-github-app-token@v2`, `setup-node@v4`, `upload-artifact@v4`, `git-auto-commit-action@v6` still run on Node 20; runner forces Node 24 from 2026-06-02. Already tracked as a pending todo (v1.2+ candidate / quick task).
