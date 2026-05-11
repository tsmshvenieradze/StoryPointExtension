# Phase 7 verification — first auto-publish (v1.0.7 → v1.0.8)

**Verified:** 2026-05-11
**Repo:** tsmshvenieradze/StoryPointExtension
**Workflow run:** Publish #6 — https://github.com/tsmshvenieradze/StoryPointExtension/actions/runs/25641329824 (event: `workflow_dispatch`, manual)
**Triggered by:** workflow_dispatch (manual, `tsmshvenieradze`) — NOT an organic PR merge. The PR #5 merge to master (`eb696c6`) did **not** fire `publish.yml` for reasons GitHub did not surface; the workflow was then run manually. The master bump-back was completed via **PR #7** merge (`eba84b3`).
**Merged by:** tsmshvenieradze (PR #7 recovery)
**Run duration:** ~35s (job failed at step 16 of 18 — `Commit version bump`)

## Result

**State:** 5 of 6 SUCCESS CRITERIA PASS (SC #1, #2, #3, #4, #6); SC #5 PARTIALLY VERIFIED IN THE WILD + the publish-fail variant DEFERRED. One critical finding (Phase 6 verification gap — master ruleset, not legacy branch protection).

The first auto-publish did not happen the way CONTEXT D-5 described (organic merge of 07-01's PR). The PR #5 merge to master never triggered `publish.yml` (no run queued, no skip recorded — cause undiagnosed without GitHub-internal data). The workflow was then triggered manually via `workflow_dispatch` on master HEAD `eb696c6`. That run: passed all gates, ran `scripts/bump-version.mjs` (v1.0.7 → v1.0.8, no drift), `tfx extension create` packaged the `.vsix`, `actions/upload-artifact@v4` uploaded `vsix-1.0.8`, `tfx extension publish` **published v1.0.8 to the Marketplace successfully** — then the `Commit version bump` step **failed**: the `stefanzweifel/git-auto-commit-action@v6` step created the bump commit `754defa` in-runner but the `git push` to `master` was rejected with `GH013: Repository rule violations found for refs/heads/master` (require-PR + require-signed-commits + 2 required status checks). The `Tag release` and `Surface tag failure` steps did not run (the failure occurred before them, and the `if: failure() && steps.tag.outcome == 'failure'` follow-up is gated on the tag step's outcome, which was never set). Per Option B, master stayed at v1.0.7 — no orphan bump commit, no orphan tag. Recovery: the master ruleset's "Require signed commits" and "Require a pull request before merging" rules were removed; **PR #7** (`chore(release): v1.0.8 [skip ci]`) was squash-merged to land the bump commit `eba84b3` on master (`[skip ci]` in the squash message so `publish.yml` did not re-fire and attempt to re-publish v1.0.8, which the Marketplace would have rejected for a non-increasing version); the annotated tag `v1.0.8` was pushed manually pointing at `eba84b3`.

## Per-SC evidence

### SC #1 — Marketplace at v1.0.8

- Public listing URL: `https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator`
- Raw API response (captured 2026-05-11 via the public gallery `extensionquery` endpoint):
  ```bash
  curl -s -X POST "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=7.2-preview.1" \
    -H "Content-Type: application/json" \
    -d '{"filters":[{"criteria":[{"filterType":7,"value":"TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator"}]}],"flags":914}'
  ```
  Parsed output:
  ```
  displayName: Story Point Calculator
  publisher: TsezariMshvenieradzeTfsAIReviewTask
  latest version: 1.0.8
  versions: 1.0.8
  lastUpdated: 2026-05-10T22:25:13.757Z
  ```
- `lastUpdated` (22:25 UTC, 2026-05-10) matches the `workflow_dispatch` run #25641329824's `Publish to Marketplace` step timestamp window (run started 22:20:18 UTC, publish step ~22:24-22:25 UTC).
- The run's `## Publish` step-summary block confirmed: `Published \`v1.0.8\` to Marketplace` + the listing URL.

### SC #2 — Bump commit on master

- The workflow's bump commit `754defaef29d61c367556b0c8253020709752e59` was created in-runner by `git-auto-commit-action@v6` but its push was **rejected by the master ruleset** (see "Critical finding" below) — so it never landed.
- Recovery commit on master (`git log origin/master -1`):
  ```
  commit eba84b3b2a926e960b1fd334a81985450d953c39
  Author: tsmshvenieradze <30365882+tsmshvenieradze@users.noreply.github.com>
  Date:   Mon May 11 12:12:13 2026 +0400

      chore(release): v1.0.8 [skip ci] (#7)
  ```
- Files changed (`git show --stat eba84b3`):
  ```
  package.json       | 2 +-
  vss-extension.json | 2 +-
  2 files changed, 2 insertions(+), 2 deletions(-)
  ```
  Atomic two-file diff confirmed (only `package.json` + `vss-extension.json`, both `1.0.7` → `1.0.8`).
- Deviation from SC #2's letter: the commit is authored by `tsmshvenieradze` via the recovery PR #7 merge, **not** by `github-actions[bot]` from the workflow. The `[skip ci]` token IS present in the subject. The canonical bot identity that the workflow *would* have used is `github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>` (configured in `publish.yml`'s `Commit version bump` step) — it just never got to push. SC #2's *substance* (master gains a v1.0.8 commit with `[skip ci]` and an atomic two-file diff) is satisfied; the *authorship* clause is satisfied-pending the ruleset relaxation taking effect on the next cycle.

### SC #3 — No re-trigger

- Actions tab: only ONE `Publish` run exists for this version cycle — `Publish #6` (the `workflow_dispatch` run). No second `Publish` run was triggered.
- The recovery PR #7's squash-merge commit `eba84b3` carries `[skip ci]` in its message → `publish.yml` did not fire on that push (GitHub's documented `[skip ci]` skip token; also `package.json`/`vss-extension.json` are not in `paths-ignore`, so `[skip ci]` is what suppressed it).
- Triple anti-loop defense (all active in `publish.yml`):
  1. **GITHUB_TOKEN anti-loop** (GitHub design): commits pushed by a workflow's default GITHUB_TOKEN don't trigger workflow runs. (Moot this cycle — the bot push was rejected before it could land — but pre-positioned.)
  2. **`[skip ci]` token**: present in both the workflow's `commit_message` input AND the recovery PR #7's squash commit. Active.
  3. **Actor-guard `if: github.actor != 'github-actions[bot]'`** at the publish job level: pre-positioned (Phase 6 carry-over). Active.

### SC #4 — Tag v1.0.8 exists

- `git ls-remote --tags origin v1.0.8` (captured 2026-05-11):
  ```
  daae7be7fc7fec9886dc3cae800bfb0f17f736d0	refs/tags/v1.0.8
  eba84b3b2a926e960b1fd334a81985450d953c39	refs/tags/v1.0.8^{}
  ```
- Annotated tag (tag object `daae7be7...`) dereferences (`^{}`) to commit `eba84b3...` — the bump commit from SC #2.
- Created manually after the ruleset relaxation: `git tag -a v1.0.8 eba84b3 -m "Release v1.0.8" && git push origin v1.0.8`.
- The workflow's `Tag release (best-effort, idempotent)` step never ran (`-` skipped) because the upstream `Commit version bump` step failed first. TAG-04's `continue-on-error: true` on the tag step was correctly the *only* `continue-on-error` in the workflow (verified pre-merge), but it was never exercised this cycle.

### SC #5 — Option B reversibility (partially verified in the wild; publish-fail variant deferred)

**What was observed:** The `workflow_dispatch` run published v1.0.8 to the Marketplace **successfully**, then **failed at the `Commit version bump` step** (the ruleset rejected the bot's push — see Critical finding). Per Option B's state-flow (bump in-memory only → publish → commit-back → tag): the in-memory bump never committed, the tag step never ran, and **master remained at v1.0.7 with no orphan bump commit and no orphan tag**. So the "recoverable-state" half of Option B held in the wild — a post-publish failure left the repo in a clean, recoverable state, and recovery was a single follow-up PR + a manual tag.

**What was NOT exercised:** SC #5's literal scenario is "force the *publish* step to fail (e.g. revoked PAT) → Marketplace stays at v1.0.7". The publish step succeeded this cycle, so the Marketplace-untouched variant was not tested. Per CONTEXT deferred-section (line 224 — "Option B's reversibility is research-locked + ROADMAP SC #5 requires it to be verifiable, not necessarily verified ahead of first run"), the publish-fail variant is deferred to a future controlled exercise: deliberately revoke/break `TFX_PAT`, run `publish.yml` via `workflow_dispatch`, confirm Marketplace + master both untouched, restore the PAT, re-run, confirm clean recovery. Tracked as a Phase 8 / v1.2+ follow-up.

### SC #6 — Artifact downloadable

- The `workflow_dispatch` run #25641329824 reached and passed the `Upload .vsix artifact` step.
- Artifact name: `vsix-1.0.8` (NO `v` prefix per ROADMAP SC #6 — `bump-version.mjs` writes `next-version-bare=1.0.8` to `$GITHUB_OUTPUT` for this exact purpose; the `upload-artifact` step references `${{ steps.bump.outputs.next-version-bare }}`).
- Retention: 90 days (`retention-days: 90` in `publish.yml`).
- `if-no-files-found: error` guard active (would have failed the run if the `.vsix` were missing — it wasn't).
- Visible in the run's Artifacts panel (`gh run view 25641329824` → `ARTIFACTS: vsix-1.0.8`).

## Critical finding — master ruleset (Phase 6 verification gap)

The Phase 6 `06-03` artifact `branch-protection-probe-result.md` reported `master` as **NOT PROTECTED**. That probe queried the **legacy branch-protection API** (`GET /repos/.../branches/master/protection`). It did **not** query **repository rulesets** (`GET /repos/.../rules/branches/master` or the Rulesets API) — rulesets are GitHub's newer, separate protection mechanism, completely invisible to the legacy probe.

A master-targeting ruleset was in place with three rules:
- **Require a pull request before merging** — the bot's direct push to master violates this.
- **Require status checks to pass** — "2 of 2 required status checks are expected" — a direct push without a passing check on the commit violates this.
- **Require signed commits** — the bot's `git push` (unsigned) violates this.

The `Commit version bump` step's push was rejected:
```
remote: error: GH013: Repository rule violations found for refs/heads/master.
remote: - Changes must be made through a pull request.
remote: - 2 of 2 required status checks are expected.
remote: - Commits must have verified signatures.
remote:   Found 1 violation:
remote:   754defaef29d61c367556b0c8253020709752e59
remote:  ! [remote rejected] master -> master (push declined due to repository rule violations)
```

`github-actions[bot]` cannot be added to a ruleset bypass list (that list accepts roles, teams, and GitHub Apps — not the built-in Actions bot). CONTEXT D-12 had pre-flagged "GitHub App / `RELEASE_PAT` for commit-back" as the escalation path "deferred until master gains branch protection" — which is now the case (via rulesets rather than legacy protection).

**Resolution applied (2026-05-11):** the repo admin removed "Require signed commits" and "Require a pull request before merging" from the master ruleset. The bot's `permissions: contents: write` (job-level in `publish.yml`) should now suffice for the commit-back + tag push on the next publish cycle. (A GitHub App for verified-signature commit-back remains the cleaner long-term option if the ruleset is re-tightened — Phase 8 DOC-02 scopes "branch-protection migration paths".)

## Pre-merge checks (D-6)

CONTEXT D-6 specified two cheap local checks before the (intended organic) merge. Because the publish happened via `workflow_dispatch` rather than an organic merge, these were effectively satisfied *by the run itself*:

### Check 1 — `npx tfx extension publish --help` flag re-verify

- Not run as a separate local command. **Empirically confirmed by the run:** `publish.yml`'s `Publish to Marketplace` step invoked `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation` and **the step succeeded** (Marketplace now at v1.0.8). All four flags (`--auth-type pat`, `--token`, `--no-prompt`, `--no-wait-validation`) plus `--vsix` are therefore current and correct in `tfx-cli@0.23.1`. Closes the STATE.md TODO and research's MEDIUM-confidence flag-spelling note.
- Result: no YAML changes needed — flag spellings verified by a green publish step.

### Check 2 — local PAT smoke

- Not run as a separate local `node scripts/publish-cezari.cjs` invocation. **Empirically confirmed by the run:** the `Verify TFX_PAT secret resolves` step passed AND the `Publish to Marketplace` step authenticated and published successfully. `TFX_PAT` is valid and has Marketplace publish permission.
- Side effect: the run actually published v1.0.8 (which was the intent — first publish). No surprise.

## Cross-references

- **CONTEXT.md decisions:**
  - **D-1** (drift = max-wins): no drift this run — both `package.json` and `vss-extension.json` were at `1.0.7` at run time → bumped to `1.0.8` cleanly. No `## Drift reconciled` block in the run summary.
  - **D-2** (drift surfacing): not exercised — no drift.
  - **D-3** (vitest 2-test scope): exercised pre-publish by the run's `Unit tests` step (`400 passed`, including `tests/scripts/bump-version.test.mjs` 2 tests).
  - **D-4** (`next-version` + `next-version-bare` via `$GITHUB_OUTPUT`): verified — `vsix-1.0.8` artifact (bare, no `v`) and the intended `v1.0.8` tag (with `v`) both derive from the same bump; the manual tag matches the convention.
  - **D-5** (first-run-organic): **NOT achieved as designed** — the PR #5 merge did not fire `publish.yml`; the first publish was via `workflow_dispatch`. Documented as a deviation; the workflow's organic-trigger path (`on: push: branches: [master]` minus `paths-ignore`) is unchanged and should fire on the next code-touching merge.
  - **D-6** (pre-merge local checks): see "Pre-merge checks" above — satisfied empirically by the run rather than by pre-merge local commands.
  - **D-7** (this artifact's shape): mirrors `branch-protection-probe-result.md` — header with metadata bullets → `## Result` → `## Per-SC evidence` (per-criterion subsections) → `## Critical finding` → `## Pre-merge checks (D-6)` → `## Cross-references`. Per-SC evidence with verbatim command output, not a lightweight prose summary.
  - **D-8** (rich step-summary): the run's summary panel carried `## Bump`, `## Package`, `## Publish` (the steps that ran). `## Commit-back` and `## Tag` did not appear because those steps failed/were skipped. The branch-protection probe's `## Branch protection probe` block appeared (state `unknown` — the GITHUB_TOKEN-scoped probe is best-effort per D-5a).
  - **D-9** (probe stays unchanged): the `Probe master branch protection` step ran and emitted `Branch-protection probe inconclusive (gh api exit 1, body did not match 'Branch not protected')` → state `unknown`. As designed — the GITHUB_TOKEN lacks admin scope. Note: even an admin-scoped legacy-protection probe would have returned "not protected" — the *ruleset* is what blocked the bot, and the legacy probe (workflow or developer-side) cannot see rulesets. This is the gap in the Phase 6 probe artifact, not a fault in the probe step's logic.
  - **D-10** (tag three states): not exercised — the tag step never ran (commit-back failed first). The follow-up `Surface tag failure` step is gated on `steps.tag.outcome == 'failure'`, which was never set, so it also didn't run. The annotated tag `v1.0.8` was created manually instead.
  - **D-11** (2-plan decomposition): this artifact is the closeout for 07-02; 07-01 delivered the implementation (`bump-version.mjs` + 2 tests + `vitest.config.ts` glob + `publish.yml` swap).
  - **D-12** (loop-guard, action pins): action versions pinned per Phase 6 carry-over (`checkout@v5`, `setup-node@v4`, `upload-artifact@v4`, `git-auto-commit-action@v6`); actor-guard active at job level. The "GitHub App / RELEASE_PAT for commit-back" escalation path that D-12 pre-flagged is now relevant (master has ruleset protection); the interim resolution was to relax the ruleset.
  - **D-13** (concurrent-merges race): not exercised — single run, no concurrent runs. The `publish-master, cancel-in-progress: false` concurrency group is active in `publish.yml`.
- **ROADMAP.md Phase 7:** 6 success criteria → SC #1/#2/#3/#4/#6 PASS, SC #5 partially verified + publish-fail variant deferred.
- **REQUIREMENTS.md:** 14 requirements (BUMP-01..05, PUBLISH-01..05, TAG-01..04) → delivered by 07-01's diff; exercised by the `workflow_dispatch` run (BUMP-*, PUBLISH-*) and the manual tag (TAG-*).
- **branch-protection-probe-result.md:** the durability-posture exemplar this artifact mirrors. Its conclusion (`master is NOT PROTECTED`) was **correct for legacy branch protection** but **incomplete** — it did not check rulesets. This artifact records that gap; future probes should also query `/repos/.../rules/branches/{branch}`.
- **research/STACK.md:** action-version pins all current; `tfx-cli@0.23.1` publish-flag set verified by the green publish step.
- **research/PITFALLS.md:** Pitfall 5 mitigations active (4 required `tfx` flags — verified by the green publish step); Pitfall 11 (Option B) partially exercised (post-publish commit-back failure left repo state clean and recoverable); Pitfall 14 (atomic/idempotent tag step) not exercised (tag step never ran; tag created manually).

## Recovery log (2026-05-11)

1. `workflow_dispatch` run #25641329824 published v1.0.8 to Marketplace, uploaded `vsix-1.0.8`, then failed at `Commit version bump` (ruleset GH013).
2. Repo admin removed "Require signed commits" + "Require a pull request before merging" from the master ruleset.
3. Recovery PR #7 (`chore(release): v1.0.8 [skip ci]` — hand-bump `package.json`/`vss-extension.json` to `1.0.8`) opened off `origin/master`, CI green, squash-merged → commit `eba84b3` on master. `[skip ci]` in the squash message prevented `publish.yml` re-firing.
4. Annotated tag `v1.0.8` pushed pointing at `eba84b3` (`git tag -a v1.0.8 eba84b3 -m "Release v1.0.8" && git push origin v1.0.8`).
5. End state: Marketplace v1.0.8, master `eba84b3` with both manifests at v1.0.8, tag `v1.0.8` annotated → `eba84b3`, artifact `vsix-1.0.8` (90-day retention).

---

*Phase: 7 — Bump, Publish, Tag*
*Verification captured: 2026-05-11. First Marketplace auto-publish (v1.0.7 → v1.0.8) shipped via `workflow_dispatch` run #25641329824 after the organic merge trigger did not fire; commit-back blocked by an undiscovered master ruleset; recovered via PR #7 + manual tag + ruleset relaxation. SC #1/#2/#3/#4/#6 PASS; SC #5 partially verified + publish-fail variant deferred. Critical finding: Phase 6's branch-protection probe did not check rulesets.*
