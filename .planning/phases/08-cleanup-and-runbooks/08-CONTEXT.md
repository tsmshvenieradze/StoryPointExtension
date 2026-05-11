# Phase 8: Cleanup & Runbooks — Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 8` — 4 areas discussed, 6 decisions captured

<domain>
## Phase Boundary

**Goal (from ROADMAP):** Legacy manual-publish path is retired, operational runbooks for the auto-publish surface exist, and PROJECT.md reflects v1.1 as Validated — milestone closeable.

**Original requirements:** CLEAN-01, CLEAN-02, CLEAN-03 (archive `publish-cezari.cjs` + remove its npm scripts + verify no stray refs), DOC-01, DOC-02, DOC-03 (`OPERATIONS.md` PAT rotation + emergency-publish runbook; `PROJECT.md` "Validated" promotion).

**Scope EXPANSION (decided in this discussion — see D-3 / D-4):** Phase 8 now also delivers a **workflow architecture refactor** (a dedicated `release` branch becomes the publish trigger; master keeps full ruleset protection), a **GitHub App for verified commit-back**, **ruleset reconfiguration** (re-tighten master, add the App to its bypass list, set up the release branch), a **re-verification publish run** (ships the next patch end-to-end through the new model), and the **SC #5 broken-PAT controlled exercise**. This is a substantially larger phase than the original 6 mechanical requirements — the planner should expect ~4–6 plans and may propose a sub-phase split (e.g. 8 + 8.1) if it doesn't fit cleanly.

**Why the expansion is in scope, not scope-creep:** Phase 7 published v1.0.8 but its commit-back step was blocked by a master ruleset that 06-03's probe didn't detect (it checked legacy branch protection, not rulesets). To unblock, the master ruleset was relaxed. Phase 8's DOC-02 already scoped "branch-protection migration paths" — reconciling auto-publish with master protection is the natural Phase 8 work, not a new capability. The release-branch model is the user's chosen reconciliation.

**Milestone-goal wording change (for DOC-03):** PROJECT.md currently says "Every PR merge to master ships a new patch version automatically." The shipped model after Phase 8 is **"Every promotion (PR `master → release`) ships a new patch version automatically; master stays fully protected."** DOC-03's PROJECT.md "Validated" update MUST reflect this actual model, not the original wording.

**State at phase start (post-Phase-7):**
- v1.0.8 live on Marketplace (publisher `TsezariMshvenieradzeTfsAiReviewTask`). master HEAD `eba84b3` at v1.0.8. Annotated tag `v1.0.8`. Artifact `vsix-1.0.8` (90-day retention).
- `publish.yml` currently triggers on `push: [master]` (minus `paths-ignore`) + `workflow_dispatch`; the publish chain (bump → tfx create → upload-artifact → tfx publish → commit-back → tag) is real and works (verified by the v1.0.8 publish run #25641329824 — except commit-back was ruleset-blocked and recovered manually).
- master ruleset is **currently relaxed** — "Require signed commits" and "Require a pull request before merging" were removed in Phase 7 recovery so the bot's `git push` works. (`github-actions[bot]` cannot be added to a ruleset bypass list — that list takes roles/teams/Apps, not the built-in Actions bot.)
- `scripts/publish-cezari.cjs` still exists at its original path; `publish:cezari` + `publish:public` npm scripts still in `package.json`.
- 400/400 vitest pass; bundle 148.4 KB / 250 KB gzipped.
- `.planning/` updates from Phase 7 close-out (07-VERIFICATION.md, 07-02-SUMMARY.md, updated STATE/ROADMAP — commit `9fcd418`) are on `milestone1.1` but not yet on master; a docs-only PR `milestone1.1 → master` would sync them (paths-ignored, won't fire publish.yml).
</domain>

<decisions>
## Implementation Decisions

### OPERATIONS.md (DOC-01, DOC-02 + Phase 7 carry-overs)

- **D-1: `OPERATIONS.md` is COMPREHENSIVE — one durable ops doc covering the whole auto-publish surface.** Sections:
  1. **Marketplace PAT rotation** (DOC-01) — 1-year cadence; step-by-step on `aex.dev.azure.com` (create new PAT with scope `Marketplace (publish)` only, "All accessible orgs", 1-year lifespan; update the `TFX_PAT` repo secret; revoke the old one). Mirrors the auth model from research + Phase 7 CONTEXT.
  2. **Manual emergency-publish runbook** (DOC-02) — the exact `tfx extension publish` invocation, **captured from `scripts/publish-cezari.cjs` BEFORE it is archived** (the canonical reviewed flag set: `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation`; plus `tfx extension create --manifest-globs vss-extension.json --output-path dist/` for packaging). Includes the `.env.local` / `TFX_PAT` setup so a maintainer can publish from their machine if the workflow is down.
  3. **Release-branch model + ruleset configuration** — how `release` → publish works (D-3), how master's ruleset is configured (full protection + the release App on the bypass list), how to re-tighten or relax rules, what the `release` branch's ruleset (if any) is.
  4. **Rulesets-aware branch-protection probe note** — records the Phase 6 probe gap: `06-03`'s `branch-protection-probe-result.md` checked `GET /repos/.../branches/{branch}/protection` (legacy) only; future probes MUST also query `GET /repos/.../rules/branches/{branch}` (rulesets). This is the documented correction.
  5. **Partial-failure recovery runbook** (D-2) — `## Recovery: publish OK, commit-back failed` — the generalized procedure derived from the Phase 7 recovery: hand-bump `package.json` + `vss-extension.json` to the published version, open a recovery PR with `[skip ci]` in the commit message, squash-merge via the Web UI (verified signature), push the annotated tag manually. Links to `07-VERIFICATION.md` for the worked example.
  6. **SC #5 / Option B reversibility — controlled exercise procedure** — break/revoke `TFX_PAT` → trigger `publish.yml` via `workflow_dispatch` on `release` → confirm Marketplace + `release` both untouched, no orphan commit/tag → restore the PAT → re-run → confirm clean recovery.
  - Rejected: minimal `OPERATIONS.md` (just DOC-01/02) — would scatter the operational knowledge across STATE.md/ROADMAP.md.
  - Per Phase 6/7 D-3: rationale that didn't go into the workflow YAML lives HERE. `OPERATIONS.md` is the home for all the "why".

- **D-2: The partial-failure recovery runbook lives in `OPERATIONS.md` as a named section (`## Recovery: publish OK, commit-back failed`), generalizing the Phase 7 recovery.** `07-VERIFICATION.md` keeps the evidence-of-what-happened; `OPERATIONS.md` keeps the how-to-recover. (Not "only in 07-VERIFICATION.md" — that file is buried in `.planning/phases/07-*` and isn't an obvious place to look for ops procedures.)

### Verified commit-back + release-branch model (D-3) — the architecture refactor

- **D-3: GitHub App for verified commit-back + a dedicated `release` branch as the publish trigger; restore FULL ruleset protection on master.**
  - **GitHub App:** create a personal GitHub App (e.g. `story-point-release-bot`), permissions `contents: write` + `metadata: read`, install it on the repo, store the App ID + private key as repo secrets (conventional names `APP_ID` / `APP_PRIVATE_KEY` — planner's call). In `publish.yml`, mint an installation access token via `actions/create-github-app-token@v1` and pass that token to `git-auto-commit-action` (commit-back) and to the tag-push step. A GitHub App added to a ruleset's **bypass list bypasses ALL rules in that ruleset** (PR-required, status-checks, signed-commits) — so the App pushes cleanly while humans keep full protection.
    - (The user creates the App in the GitHub UI — Claude can't. Claude does the `publish.yml` changes. Document the App-creation steps in `OPERATIONS.md` too.)
  - **`release` branch:** a new long-lived `release` branch. `publish.yml`'s trigger changes from `push: [master]` to `push: [release]` (keep `workflow_dispatch`). Rationale (user): master gets frequent feature-PR merges; triggering a Marketplace publish on every one is too noisy — batch several PRs into one release by promoting `master → release` when ready.
  - **Release flow:** open a PR `master → release` → `ci.yml` runs → user merges via the Web UI → the push to `release` fires `publish.yml` → bump (`bump-version.mjs` reads/writes on the `release` checkout) → `tfx extension create` → upload-artifact → `tfx extension publish` → the App commits `chore(release): vX.Y.Z [skip ci]` to `release` → tag → **a workflow step opens a PR `release → master` carrying the bump** → user merges it via the Web UI (verified signature → satisfies master's signed-commits rule) → master catches up. (`paths-ignore` still applies on the `release` trigger; `[skip ci]` still on the bot's commit; the `release → master` PR merge is a Web-UI verified commit so it's fine on master.)
  - **master ruleset:** restore FULL protection — re-add "Require a pull request before merging" + "Require status checks to pass (2 checks)" + "Require signed commits". Add the release App to master's **bypass list** (so the App's `release → master` PR-step or any App-driven push works; the human-merge path satisfies all three rules natively anyway).
  - **`release` branch protection:** minimal or none (planner's call — maybe just "require linear history" or nothing) — the App needs to push the bump commit + tag here directly; either keep `release`'s ruleset light or put the App on its bypass list too.
  - **`ci.yml`:** extend the `pull_request` trigger to also target the `release` branch (so the `master → release` promotion PR runs CI).
  - **Re-verification run:** after the App + release-branch wiring is in place and master is re-tightened, a real promotion (`master → release` PR → merge) must fire `publish.yml` and ship the next patch (v1.0.9) **end-to-end through the new model** — bump → publish → App commit-back to `release` → tag → `release → master` PR opened → merged. This re-verification ALSO subsumes the "organic trigger didn't fire on PR #5" investigation (the old master-push trigger is gone; the question becomes "does a push to `release` fire publish.yml?" — the re-verification answers it; if it doesn't fire, that's a real bug to fix then).
  - Rejected: document-only (no implementation) — user wants it built now. Rejected: fine-grained PAT (RELEASE_PAT) — a PAT git push is unsigned, so "Require signed commits" would still block it unless that rule stays off or the commit-back goes via the API; also ties release automation to the user's personal account and PATs expire. Rejected: `GITHUB_TOKEN` via the GitHub API — GitHub Actions / `github-actions[bot]` likely can't be added to the ruleset bypass list (confirmed: not in the bypass options), so PR-required + status-checks would still block. Rejected: leave the ruleset relaxed and only pre-wire the App — defeats the point of doing the work in Phase 8.

### SC #5 broken-PAT exercise (D-4)

- **D-4: EXECUTE the SC #5 broken-PAT controlled exercise in Phase 8 (not document-only).** Procedure: revoke/break `TFX_PAT` → trigger `publish.yml` via `workflow_dispatch` on `release` → confirm the publish step fails AND Marketplace stays at the prior version AND `release` stays at the prior version (no orphan bump commit, no orphan tag) → restore a valid `TFX_PAT` → re-run → confirm a clean publish + commit-back + tag. Capture the failure-then-recovery as a Phase 8 verification artifact (planner's call on filename — likely `08-SC5-EXERCISE.md` or a section in the Phase 8 VERIFICATION.md; this is evidence-of-event, distinct from the `OPERATIONS.md` procedure doc which is the how-to). This fully verifies ROADMAP Phase 7 SC #5 in the wild (Phase 7 only observed the recoverable-state half — a post-publish commit-back failure left the repo clean; the publish-step-failure variant was never exercised).
  - Sequencing note: this exercise will itself burn one or two patch versions (the re-run after restoring the PAT ships a real patch). Plan it AFTER the re-verification run (D-3) so the exercise's clean re-run doubles as confidence the new model is stable, or accept that the exercise's restore-and-rerun IS the re-verification — planner's call.

### Cleanup mechanics (CLEAN-01..03)

- **D-5: Archive `publish-cezari.cjs` as a frozen reference.** `git mv scripts/publish-cezari.cjs scripts/.archive/publish-cezari.cjs` — content unchanged except an added header comment: `// ARCHIVED — superseded by .github/workflows/publish.yml. Kept for reference only; the canonical emergency-publish tfx invocation is documented in .planning/OPERATIONS.md.` (CLEAN-01). Remove `publish:cezari` + `publish:public` from `package.json` `scripts` (CLEAN-02). `git grep -F 'publish:cezari'` returns 0 hits outside `scripts/.archive/` and `.planning/` (CLEAN-03). The emergency-publish runbook in `OPERATIONS.md` (with the `tfx` invocation captured BEFORE the move, per DOC-02) is the live escape hatch — NOT a re-added npm script and NOT a still-runnable second publish path (the whole point of CLEAN is "the GH Action is the canonical publish path").
  - Rejected: keep `publish-cezari.cjs` runnable as a true emergency hatch — keeps a second publish path alive, contradicts CLEAN's intent. Rejected: delete it entirely — loses the working code (cross-platform `spawnSync` shell fix, `.env.local` parsing, `--public` handling); `.archive/` preserves it git-restorably.

### Loose ends (D-6)

- **D-6: Old `TsezariMshvenieradzeExtensions` publisher cleanup stays DEFERRED.** It's a low-priority Phase 5 housekeeping carry-over (a stuck-private extension from the original 2026-05-02 publish attempt), orthogonal to v1.1's auto-publish surface, and doesn't block milestone close. Stays in the deferred list. (Not folded into Phase 8; not even document-only — it's genuinely peripheral.)
- **D-6b: The "PR #5 merge didn't fire `publish.yml`" anomaly gets NO separate investigation task** — it's moot in the release-branch model (publish.yml won't trigger on master pushes anymore) and the re-verification run (D-3) confirms the new trigger works.

### Claude's Discretion

For the researcher / planner to decide:
- App name; secret names (`APP_ID` / `APP_PRIVATE_KEY` are conventional but not mandatory); the exact `actions/create-github-app-token` version pin (`@v1` major-pin matches the project's `@v<major>` convention).
- How the `release → master` back-merge PR is opened by a workflow step — `peter-evans/create-pull-request@v7`, `gh pr create` with the App token, or `git-auto-commit-action`'s branch feature. Planner picks; document the choice.
- `release` branch name (`release` recommended; `production` / `stable` are alternatives).
- Whether the `release` branch gets its own ruleset (light — e.g. linear history) or none, and whether the App needs to be on its bypass list.
- Exact `OPERATIONS.md` section structure and ordering.
- Whether the SC #5 exercise gets its own artifact (`08-SC5-EXERCISE.md`) or a section in `08-VERIFICATION.md`; and whether the exercise's restore-and-rerun doubles as the D-3 re-verification.
- The "ARCHIVED" header-comment exact wording for the moved `publish-cezari.cjs`.
- Whether to first sync the Phase 7 `.planning/` close-out commits to master (docs PR `milestone1.1 → master`) as an early Phase 8 task or leave it to the user.
- Plan decomposition / whether Phase 8 should be split into 8 + 8.1 (it's a big phase now).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project + milestone scope
- [.planning/ROADMAP.md](../../ROADMAP.md) — Phase 8 row (CLEAN-01..03, DOC-01..03) + the expanded Phase 8 scope note + the Phase 7 outcome block / carried-forward items.
- [.planning/REQUIREMENTS.md](../../REQUIREMENTS.md) — CLEAN-01, CLEAN-02, CLEAN-03, DOC-01, DOC-02, DOC-03 verbatim; the v1.2+ "Future Requirements" list (PAT-smoke cron, conventional-commits semver, etc. — stay deferred).
- [.planning/PROJECT.md](../../PROJECT.md) — v1.1 milestone description (DOC-03 updates the "Validated" section + the milestone-goal wording to the release-branch model); Key Decisions table; "Next Milestone Goals (post-v1.1)" backlog.
- [.planning/STATE.md](../../STATE.md) — Phase 7 outcome block (the four carry-overs: verified-commit-back / rulesets-aware probe / SC #5 exercise / organic-trigger); Pending Todos; Blockers/Concerns (relaxed-ruleset interim state).

### Phase 7 outputs Phase 8 consumes
- [.planning/phases/07-bump-publish-tag/07-VERIFICATION.md](../07-bump-publish-tag/07-VERIFICATION.md) — **AUTHORITATIVE record of the v1.0.8 publish + the master-ruleset finding + the recovery log.** The `OPERATIONS.md` partial-failure recovery section (D-2) generalizes from here and links back to it. The rulesets-aware-probe note (D-1 §4) corrects the Phase 6 probe gap recorded here.
- [.planning/phases/07-bump-publish-tag/07-02-SUMMARY.md](../07-bump-publish-tag/07-02-SUMMARY.md) — the Phase 7 closeout summary; the follow-up-items section maps 1:1 to Phase 8's D-1/D-3/D-4.
- [.planning/phases/07-bump-publish-tag/07-CONTEXT.md](../07-bump-publish-tag/07-CONTEXT.md) — D-3 (rationale lives in OPERATIONS.md, not YAML comments — carry-over from Phase 6 D-3), D-12 (the GitHub App / RELEASE_PAT escalation path was pre-flagged here).
- [.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md](../06-workflow-scaffold-and-gates/branch-protection-probe-result.md) — the probe artifact whose conclusion ("NOT PROTECTED") was correct for legacy branch protection but missed the master ruleset; `OPERATIONS.md` §4 documents the correction.
- [.planning/phases/06-workflow-scaffold-and-gates/06-CONTEXT.md](../06-workflow-scaffold-and-gates/06-CONTEXT.md) — D-3 (rationale in OPERATIONS.md, no comment blocks in YAML).

### Live code being modified
- [.github/workflows/publish.yml](../../../.github/workflows/publish.yml) — refactored: trigger `push: [master]` → `push: [release]`; add `actions/create-github-app-token@v1` step + pass the App token to `git-auto-commit-action` and the tag-push step; add a `release → master` back-merge PR step. (Currently has the Phase 7 real publish chain: 18 steps, header + 10 P6 gates/probes + bump → package → upload → publish → commit → surface → tag → surface-tag-failure.)
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — extend `pull_request` trigger to also target `release`.
- [scripts/publish-cezari.cjs](../../../scripts/publish-cezari.cjs) — the file being archived (CLEAN-01); its `tfx extension publish` invocation (lines ~84–99) is captured into `OPERATIONS.md` (DOC-02) BEFORE the `git mv`.
- [package.json](../../../package.json) — `publish:cezari` + `publish:public` scripts to remove (CLEAN-02); `version` field currently `1.0.8` on master HEAD `eba84b3` (the bump script reads/writes it on the `release` checkout going forward).
- [scripts/bump-version.mjs](../../../scripts/bump-version.mjs) — unchanged in Phase 8 (it already does the in-memory max-wins bump + `$GITHUB_OUTPUT` + `$GITHUB_STEP_SUMMARY`); runs on the `release` checkout in the new model.
- [vss-extension.json](../../../vss-extension.json) — `version` currently `1.0.8`; bumped in lockstep with `package.json` by `bump-version.mjs`.

### Research (locked decisions inherited)
- [.planning/research/SUMMARY.md](../../research/SUMMARY.md) — architecture flow, Option B rationale, loop-guard, the GitHub-App-for-commit-back escalation note.
- [.planning/research/STACK.md](../../research/STACK.md) — action version pins (`checkout@v5`, `setup-node@v4`, `upload-artifact@v4`, `git-auto-commit-action@v6`; Phase 8 adds `create-github-app-token@v1` and possibly `peter-evans/create-pull-request@v7`); tfx-cli@0.23.1; PAT scope.
- [.planning/research/PITFALLS.md](../../research/PITFALLS.md) — Pitfall 5 (required tfx flags — verified by the v1.0.8 publish step), Pitfall 11 (Option B / failed publish AFTER bump), Pitfall 14 (idempotent tag step), Pitfall 3 (concurrent merges — the release-branch model partly mitigates this by batching).

### External docs (for the researcher)
- GitHub Docs — `actions/create-github-app-token` action (token minting in workflows).
- GitHub Docs — Repository rulesets, bypass lists, and how a GitHub App on the bypass list interacts with all rules in the ruleset.
- GitHub Docs — `peter-evans/create-pull-request` (if the planner picks it for the `release → master` back-merge step).
- Visual Studio Marketplace — PAT creation on `aex.dev.azure.com` (for the DOC-01 rotation runbook).

If any other doc/spec/ADR surfaces during research or planning, add it here with a full relative path.
</canonical_refs>

<specifics>
## Specific Ideas

- **The release-branch model is the user's deliberate reconciliation of "auto-publish" with "master needs full protection".** Plans must NOT keep `publish.yml` triggering on `push: [master]` — the trigger moves to `push: [release]`. The "automatic" promise is preserved at the promotion boundary: a `master → release` PR merge auto-ships a patch.
- **master gets FULL ruleset protection back** (PR-required + status-checks + signed-commits). The release GitHub App on master's bypass list is what makes the automated `release → master` back-merge possible without weakening human protections.
- **OPERATIONS.md is the single durable ops doc** — comprehensive, not minimal. A future maintainer opens one file and knows: how to rotate the PAT, how to emergency-publish manually, how the release-branch model works, how to re-tighten/relax rulesets, how to recover from a publish-OK-commit-back-failed split, and how to run the Option B reversibility exercise. Per Phase 6/7 D-3, this is where all the "why" lives — the workflow YAML stays comment-free.
- **The SC #5 exercise gets EXECUTED, not just documented** — break the PAT, watch publish.yml fail safely, restore, re-run, capture the evidence. This is the user's call to fully verify Option B in the wild rather than leave it "verifiable, not verified".
- **`publish-cezari.cjs` is archived as a frozen reference, not kept runnable** — no re-added npm script, no second live publish path. The GH Action (now release-branch-triggered) is the canonical publish path; the emergency-publish runbook in `OPERATIONS.md` is the documented manual fallback.
- **Capture the `tfx` invocation in OPERATIONS.md BEFORE the `git mv`** — DOC-02's "captured BEFORE the legacy script is archived" wording is load-bearing; the knowledge must survive the archival even though the file moves.
- **DOC-03's PROJECT.md update must reflect the ACTUAL shipped model** — "every promotion to release ships a patch; master stays protected" — not the original "every PR merge to master ships" wording.
</specifics>

<deferred>
## Deferred Ideas

- **Old `TsezariMshvenieradzeExtensions` publisher cleanup** — low-priority housekeeping (Phase 5 carry-over); a stuck-private extension from the original 2026-05-02 publish attempt; orthogonal to v1.1; not in Phase 8.
- **v1.2+ items (from REQUIREMENTS.md "Future Requirements" — remain deferred):** PAT-smoke cron (weekly auth-only check), conventional-commits-driven semver (minor/major bumps from PR titles), `CHANGELOG.md` auto-generation, Marketplace-version reconciliation pre-flight, bundle-size trend reporting on PRs, multi-environment staged promote (private → public).
- **`actions/setup-node` / `upload-artifact` / `checkout` / `git-auto-commit-action` bump to Node-24-compatible versions** — Node 20 deprecation; runner forces Node 24 from 2026-06-02. Non-blocking but has a deadline. Could be a quick task or folded into Phase 8's `publish.yml` refactor if convenient (planner's call) but not a Phase 8 requirement.
- **APPLY-03 pre-fill production fix, Phase 5 screenshots, cross-process smoke, cross-phase integration debt** — v1.0.1+ / v2 carry-overs, explicitly out of v1.1 scope.
</deferred>

---

*Phase: 08-cleanup-and-runbooks*
*Context gathered: 2026-05-11 — `/gsd-discuss-phase 8`. 6 decisions (D-1..D-6) across 4 discussed areas. Original scope: CLEAN-01..03 + DOC-01..03 (6 reqs). Expanded scope (user-chosen): release-branch model + GitHub App for verified commit-back + ruleset reconfiguration + re-verification publish run + SC #5 broken-PAT exercise. Milestone-goal wording changes (DOC-03): "every PR merge to master ships" → "every promotion to release ships; master stays protected". Next: `/gsd-plan-phase 8` — expect a large phase (~4–6 plans); planner may propose an 8 / 8.1 split.*
