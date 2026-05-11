# Phase 8: Cleanup & Runbooks — Research

**Researched:** 2026-05-11
**Domain:** GitHub Actions CI/CD architecture refactor (release-branch promotion model + GitHub App verified commit-back + repository rulesets) + operational documentation
**Confidence:** HIGH on the project state and the existing publish chain; HIGH on the create-github-app-token / peter-evans / git-auto-commit-action mechanics; MEDIUM-HIGH on ruleset bypass-list semantics (GitHub docs are sparse on exact rule-by-rule coverage — see Open Questions Q1); MEDIUM on the exact `aex.dev.azure.com` PAT UI labels (Marketplace publish vs Manage scope discrepancy — see Open Questions Q2)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-1: `OPERATIONS.md` is COMPREHENSIVE — one durable ops doc.** Six sections: (1) Marketplace PAT rotation (DOC-01, 1-year cadence, step-by-step on `aex.dev.azure.com`, scope `Marketplace (publish)` only, "All accessible orgs", 1-year lifespan, update `TFX_PAT` secret, revoke old); (2) Manual emergency-publish runbook (DOC-02, exact `tfx extension publish` invocation captured from `publish-cezari.cjs` BEFORE archive — canonical reviewed flag set `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation`; plus `tfx extension create --manifest-globs vss-extension.json --output-path dist/` for packaging; plus `.env.local`/`TFX_PAT` local setup); (3) Release-branch model + ruleset configuration (how `release` → publish works, how master's ruleset is configured, how to re-tighten/relax, what the `release` branch's ruleset is); (4) Rulesets-aware branch-protection probe note (records the Phase 6 probe gap — `06-03`'s `branch-protection-probe-result.md` checked `GET /repos/.../branches/{branch}/protection` legacy only; future probes MUST also query `GET /repos/.../rules/branches/{branch}`); (5) Partial-failure recovery runbook (`## Recovery: publish OK, commit-back failed` — generalizes the Phase 7 recovery: hand-bump both manifests to the published version, recovery PR with `[skip ci]`, squash-merge via Web UI, push annotated tag manually; links `07-VERIFICATION.md`); (6) SC #5 / Option B reversibility — controlled exercise procedure. Rationale that didn't go into the workflow YAML lives HERE (Phase 6/7 D-3 carry-over).
- **D-2: The partial-failure recovery runbook lives in `OPERATIONS.md` as a named section** (`## Recovery: publish OK, commit-back failed`), generalizing the Phase 7 recovery. `07-VERIFICATION.md` keeps evidence-of-what-happened; `OPERATIONS.md` keeps how-to-recover.
- **D-3: GitHub App for verified commit-back + a dedicated `release` branch as the publish trigger; restore FULL ruleset protection on master.**
  - **GitHub App:** create a personal GitHub App (e.g. `story-point-release-bot`), permissions `contents: write` + `metadata: read`, install on the repo, store App ID + private key as repo secrets (conventional `APP_ID` / `APP_PRIVATE_KEY` — planner's call). In `publish.yml` mint an installation token via `actions/create-github-app-token@v1` and pass it to `git-auto-commit-action` (commit-back) and the tag-push step. A GitHub App on a ruleset's bypass list bypasses ALL rules in that ruleset (PR-required, status-checks, signed-commits) — so the App pushes cleanly while humans keep full protection. (User creates the App in the UI — Claude can't. Claude does the `publish.yml` changes. Document App-creation steps in `OPERATIONS.md`.)
  - **`release` branch:** new long-lived `release` branch. `publish.yml`'s trigger changes from `push: [master]` to `push: [release]` (keep `workflow_dispatch`). Rationale: master gets frequent feature-PR merges; publishing on every one is too noisy — batch several PRs into one release by promoting `master → release` when ready.
  - **Release flow:** PR `master → release` → `ci.yml` runs → user merges via Web UI → push to `release` fires `publish.yml` → bump (`bump-version.mjs` reads/writes on the `release` checkout) → `tfx extension create` → upload-artifact → `tfx extension publish` → App commits `chore(release): vX.Y.Z [skip ci]` to `release` → tag → a workflow step opens a PR `release → master` carrying the bump → user merges it via Web UI (verified signature → satisfies master's signed-commits rule) → master catches up. (`paths-ignore` still applies on the `release` trigger; `[skip ci]` still on the bot's commit; the `release → master` PR merge is a Web-UI verified commit so it's fine on master.)
  - **master ruleset:** restore FULL protection — re-add "Require a pull request before merging" + "Require status checks to pass (2 checks)" + "Require signed commits". Add the release App to master's bypass list.
  - **`release` branch protection:** minimal or none (planner's call — maybe "require linear history" or nothing) — the App needs to push the bump commit + tag here directly; either keep `release`'s ruleset light or put the App on its bypass list too.
  - **`ci.yml`:** extend the `pull_request` trigger to also target `release`.
  - **Re-verification run:** after App + release-branch wiring is in place and master is re-tightened, a real promotion (`master → release` PR → merge) must fire `publish.yml` and ship the next patch (v1.0.9) end-to-end through the new model. Subsumes the "organic trigger didn't fire on PR #5" investigation.
  - Rejected: document-only; fine-grained PAT (RELEASE_PAT, unsigned push); `GITHUB_TOKEN` via the API (github-actions[bot] can't be added to the bypass list); leave the ruleset relaxed and only pre-wire the App.
- **D-4: EXECUTE the SC #5 broken-PAT controlled exercise in Phase 8 (not document-only).** Procedure: revoke/break `TFX_PAT` → trigger `publish.yml` via `workflow_dispatch` on `release` → confirm publish step fails AND Marketplace stays at the prior version AND `release` stays at the prior version (no orphan bump commit, no orphan tag) → restore a valid `TFX_PAT` → re-run → confirm clean publish + commit-back + tag. Capture failure-then-recovery as a Phase 8 verification artifact (planner's call on filename — likely `08-SC5-EXERCISE.md` or a section in the Phase 8 VERIFICATION.md). This fully verifies ROADMAP Phase 7 SC #5 in the wild. Sequencing: plan it AFTER the re-verification run (D-3), OR accept that the exercise's restore-and-rerun IS the re-verification — planner's call. Burns one or two real patch versions.
- **D-5: Archive `publish-cezari.cjs` as a frozen reference.** `git mv scripts/publish-cezari.cjs scripts/.archive/publish-cezari.cjs` — content unchanged except an added header comment (`// ARCHIVED — superseded by .github/workflows/publish.yml. Kept for reference only; the canonical emergency-publish tfx invocation is documented in .planning/OPERATIONS.md.`) (CLEAN-01). Remove `publish:cezari` + `publish:public` from `package.json` `scripts` (CLEAN-02). `git grep -F 'publish:cezari'` returns 0 hits outside `scripts/.archive/` and `.planning/` (CLEAN-03). The emergency-publish runbook in `OPERATIONS.md` (tfx invocation captured BEFORE the move) is the live escape hatch — NOT a re-added npm script and NOT a still-runnable second publish path. Rejected: keep `publish-cezari.cjs` runnable; delete it entirely.
- **D-6: Old `TsezariMshvenieradzeExtensions` publisher cleanup stays DEFERRED.** Low-priority Phase 5 housekeeping; orthogonal to v1.1; doesn't block milestone close.
- **D-6b: The "PR #5 merge didn't fire `publish.yml`" anomaly gets NO separate investigation task** — moot in the release-branch model; the D-3 re-verification confirms the new trigger works.
- **DOC-03 milestone-goal wording change:** PROJECT.md currently says "Every PR merge to master ships a new patch version automatically." The shipped model after Phase 8 is "Every promotion (PR `master → release`) ships a new patch version automatically; master stays fully protected." DOC-03's PROJECT.md "Validated" update MUST reflect this actual model.

### Claude's Discretion

- App name; secret names (`APP_ID` / `APP_PRIVATE_KEY` conventional but not mandatory); exact `actions/create-github-app-token` version pin (`@v1` major-pin matches the project's `@v<major>` convention).
- How the `release → master` back-merge PR is opened — `peter-evans/create-pull-request@v7`, `gh pr create` with the App token, or `git-auto-commit-action`'s branch feature. Planner picks; document the choice.
- `release` branch name (`release` recommended; `production` / `stable` alternatives).
- Whether `release` gets its own ruleset (light — e.g. linear history) or none, and whether the App needs to be on its bypass list.
- Exact `OPERATIONS.md` section structure and ordering.
- Whether the SC #5 exercise gets its own artifact (`08-SC5-EXERCISE.md`) or a section in `08-VERIFICATION.md`; whether the exercise's restore-and-rerun doubles as the D-3 re-verification.
- The "ARCHIVED" header-comment exact wording.
- Whether to first sync the Phase 7 `.planning/` close-out commits to master (docs PR `milestone1.1 → master`) as an early Phase 8 task or leave it to the user.
- Plan decomposition / whether Phase 8 should be split into 8 + 8.1.

### Deferred Ideas (OUT OF SCOPE)

- Old `TsezariMshvenieradzeExtensions` publisher cleanup (Phase 5 carry-over; stuck-private extension; orthogonal to v1.1).
- v1.2+ items (REQUIREMENTS.md "Future Requirements" — remain deferred): PAT-smoke cron (weekly auth-only check), conventional-commits-driven semver, `CHANGELOG.md` auto-generation, Marketplace-version reconciliation pre-flight, bundle-size trend reporting on PRs, multi-environment staged promote (private → public).
- `actions/setup-node` / `upload-artifact` / `checkout` / `git-auto-commit-action` bump to Node-24-compatible versions — Node 20 deprecation (runner forces Node 24 from 2026-06-02). Non-blocking but has a deadline. Could be a quick task or folded into Phase 8's `publish.yml` refactor if convenient (planner's call) but NOT a Phase 8 requirement.
- APPLY-03 pre-fill production fix, Phase 5 screenshots, cross-process smoke, cross-phase integration debt — v1.0.1+ / v2 carry-overs, explicitly out of v1.1 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLEAN-01 | After Phase 7's first green auto-publish, archive `scripts/publish-cezari.cjs` to `scripts/.archive/publish-cezari.cjs` | `git mv` preserves history (Don't Hand-Roll #2). The `.archive/` dir doesn't exist yet — `git mv` creates it. Add the header comment per D-5. Phase 7's first green publish (v1.0.8) is done — gate satisfied. ORDER: capture the tfx invocation into `OPERATIONS.md` BEFORE the `git mv` (DOC-02 wording is load-bearing). |
| CLEAN-02 | Remove `publish:cezari` and `publish:public` npm scripts from `package.json` | Two keys to delete from `package.json` `scripts` (lines 23-24 in the current `milestone1.1` checkout): `"publish:cezari": "node scripts/publish-cezari.cjs"` and `"publish:public": "node scripts/publish-cezari.cjs --public"`. Note the `package` script (`tfx extension create ...`) STAYS — it's used independently. |
| CLEAN-03 | `git grep -F 'publish:cezari'` returns 0 hits outside `scripts/.archive/` and `.planning/` | Verification step. Current hits: `package.json` (2), `scripts/publish-cezari.cjs` header comment + usage line, `.planning/**` (many — allowed). After CLEAN-01+02: hits only in `scripts/.archive/publish-cezari.cjs` (allowed) and `.planning/**` (allowed). Check `README.md`, `.github/`, `src/` are clean. |
| DOC-01 | `.planning/OPERATIONS.md` documents the PAT rotation procedure (1-year cadence + step-by-step on `aex.dev.azure.com`) | See "PAT Rotation Procedure (DOC-01 content)" below. The existing `TFX_PAT` works (v1.0.8 published green) — the rotation runbook should mirror whatever scope the current PAT has (research says `Marketplace (publish)`; some docs say `Marketplace (Manage)` — see Open Questions Q2). `aex.dev.azure.com` = the alias for the Marketplace publisher-management surface; the PAT itself is created at `dev.azure.com/<org>/_usersSettings/tokens`. |
| DOC-02 | `.planning/OPERATIONS.md` documents the manual emergency-publish runbook (the exact `tfx` invocation captured BEFORE the legacy script is archived) | The canonical reviewed invocation is the one in `publish.yml`'s `Publish to Marketplace` step (verified green by run #25641329824): `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation`. Packaging: `npx tfx extension create --manifest-globs vss-extension.json --output-path dist/`. NOTE the divergence: `publish-cezari.cjs` uses `--manifest-globs vss-extension.json --share-with cezari --no-wait-validation --token <PAT>` (no `--vsix`, no `--auth-type pat`, no `--no-prompt`) — that's the OLD private-share form. The OPERATIONS.md emergency runbook should document the CURRENT public-publish form (the one in `publish.yml`), not blindly copy the cezari-private form. Capture happens BEFORE `git mv`. |
| DOC-03 | `.planning/PROJECT.md` "Validated" section updated post-milestone (v1.1 capabilities promoted from Active to Validated) | Add a `✓` entry under "### Validated" mirroring the v1.0 entries' shape; replace the "### Active" v1.1 placeholder. The entry MUST reflect the release-branch model: "Every promotion (PR `master → release`) ships a new patch automatically; master stays fully protected (PR + status-checks + signed-commits, release App on bypass list)" — NOT the original "every PR merge to master ships" wording. Also a candidate moment to fix the REQUIREMENTS.md "32 → 38" tally (Cross-Phase Note #6). |
</phase_requirements>

---

## Summary

Phase 8 is a CI/CD **architecture refactor** plus **ops documentation** — no application code changes. The core move: stop triggering Marketplace publishes on every `push: master` (which forces a choice between "fully automatic" and "master fully protected"), and instead introduce a long-lived `release` branch as the publish trigger. Feature PRs land on master (which gets its FULL ruleset back: PR-required + 2 status checks + signed commits); when ready to ship, a maintainer opens a `master → release` promotion PR; merging it fires `publish.yml`, which bumps the version, publishes the `.vsix`, commits the bump back to `release` via a **GitHub App installation token** (auto-bypasses `release`'s rules), tags the release, and opens a `release → master` back-merge PR that the maintainer merges through the Web UI (verified-signature commit → satisfies master's signed-commits rule). The GitHub App, added to master's ruleset bypass list, is what reconciles "automated commit-back" with "humans keep full protection."

The cleanup half is small and mechanical: capture the canonical `tfx extension publish` invocation into `OPERATIONS.md` FIRST, then `git mv scripts/publish-cezari.cjs scripts/.archive/`, remove the two `publish:*` npm scripts, verify `git grep` is clean. `OPERATIONS.md` becomes the single comprehensive ops doc (PAT rotation, emergency-publish runbook, release-branch model, ruleset config, rulesets-aware probe note, partial-failure recovery, SC #5 procedure). DOC-03 promotes v1.1 to "Validated" in `PROJECT.md` with the corrected milestone wording.

Two real-world exercises burn one or two patch versions: (1) the **re-verification run** — ship v1.0.9 end-to-end through the new model to prove the `push: release` trigger works (this also subsumes the "PR #5 didn't fire publish.yml" investigation, which is moot now); (2) the **SC #5 broken-PAT exercise** — deliberately revoke `TFX_PAT`, dispatch `publish.yml` on `release`, confirm safe failure (Marketplace + `release` untouched, no orphan commit/tag), restore the PAT, re-run, confirm clean recovery. The planner may collapse these into one (the SC #5 restore-and-rerun IS a clean re-verification) or run them separately.

**Primary recommendation:** Build the release-branch + GitHub App wiring FIRST (App token → git-auto-commit-action + tag push + `release → master` back-merge PR step via `peter-evans/create-pull-request@v7` with the App token), THEN re-tighten master's ruleset and add the App to its bypass list, THEN run the re-verification + SC #5 exercise, THEN do the cleanup (capture-then-`git mv` ordering is load-bearing), THEN write `OPERATIONS.md` and update `PROJECT.md`. Pin `actions/create-github-app-token@v1` (project's `@v<major>` convention; v3 is current upstream — see Open Questions Q3 on whether to pin v1 or v2/v3) and `peter-evans/create-pull-request@v7`.

---

## Architectural Responsibility Map

This is a CI/CD + docs phase; "tiers" here are the automation surfaces, not application tiers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Publish trigger | `release` branch push event | `workflow_dispatch` (manual fallback / recovery) | The whole point of the refactor: batch master merges into one release; `workflow_dispatch` stays as the documented recovery path (proven in Phase 7) |
| Version bump | `bump-version.mjs` on the `release` checkout | — | Unchanged from Phase 7; already does max-wins bump + `$GITHUB_OUTPUT` + `$GITHUB_STEP_SUMMARY`; just runs on a different branch's checkout |
| Marketplace publish | `tfx extension publish` step in `publish.yml`, auth via `TFX_PAT` secret | Manual `npx tfx extension publish` from a maintainer machine (OPERATIONS.md runbook) | The GH Action is the canonical path; the documented manual fallback replaces the deleted npm scripts |
| Commit-back to `release` | `git-auto-commit-action@v6` using a GitHub App installation token (minted by `create-github-app-token`) | — | App token → App is on `release`'s bypass list (or `release` has light/no protection) → push succeeds; commit carries `[skip ci]` |
| Tag push | `git tag -a` + `git push` step using the App token | manual `git tag -a … && git push origin v…` (OPERATIONS.md) | Best-effort, idempotent (Phase 7 TAG-04); App token so it works against any `release` protection |
| `release → master` back-merge | a workflow step running `peter-evans/create-pull-request@v7` (or `gh pr create`) with the App token | manual PR open via Web UI | Default `GITHUB_TOKEN` can't open a PR that triggers downstream `ci.yml`; App token can. The PR is *merged by a human* via the Web UI → produces a verified-signature merge commit → satisfies master's signed-commits rule natively (the App doesn't need to *push* to master) |
| master protection | Repository ruleset on `master` (PR-required + 2 status checks + signed-commits) with the release App on the bypass list | — | Restores the protection that was relaxed in Phase 7 recovery; bypass-list App keeps automation possible without weakening human protections. User configures rulesets in the GitHub UI — Claude can't |
| Ops knowledge | `.planning/OPERATIONS.md` (comprehensive) | `07-VERIFICATION.md` (evidence-of-event); workflow YAML stays comment-free (Phase 6/7 D-3) | Single durable file a future maintainer opens to learn the whole auto-publish surface |
| Milestone status | `.planning/PROJECT.md` "Validated" section (DOC-03) | `ROADMAP.md` / `STATE.md` close-out | Mirrors v1.0 entries; corrected milestone wording |

---

## Standard Stack

### Core (new for Phase 8)

| Action / Tool | Recommended pin | Purpose | Why standard |
|---------------|-----------------|---------|--------------|
| `actions/create-github-app-token` | `@v1` (project `@v<major>` convention) — but see Open Questions Q3: v3.1.1 is current upstream (Apr 2026); v1 still works but is old. Planner should weigh "match the repo convention" vs "use a maintained major". `@v2` is a reasonable middle ground. | Mint a short-lived (1-hour) GitHub App installation access token in the workflow; pass it to `actions/checkout` (via `token:`), `git-auto-commit-action` (via `token:`), the tag-push step (via `GH_TOKEN`/git remote), and the back-merge PR step (via `token:`) | This is GitHub's *official* App-token action (`actions/` org), the canonical replacement for `tibdex/github-app-token`. Inputs: `app-id` (or `client-id`), `private-key` (required); `owner`, `repositories`, `enterprise`, `permission-<name>`, `skip-token-revoke`, `github-api-url` (all optional). If `owner`/`repositories` are empty it scopes to the current repo. Token permissions are capped by what the App was installed with — so the App must be installed with `contents: write` (+ `pull-requests: write` if the back-merge PR is opened with the App token). [VERIFIED: github.com/actions/create-github-app-token README] |
| `peter-evans/create-pull-request` | `@v7` (v8.1.1 is current upstream — see Open Questions Q3; the project's `@v<major>` convention + research's earlier `@v7` reference make `@v7` the safe choice, but `@v8` is the maintained line) | Open the `release → master` back-merge PR from a workflow step. Key inputs: `token` (defaults to `GITHUB_TOKEN` — MUST be overridden with the App token so the PR triggers `ci.yml` and is mergeable), `base` (`master`), `branch` (the head branch the action creates/updates — but here the change is *already on `release`*; see Pitfall "back-merge PR design" below — you may not need this action at all if you `gh pr create --base master --head release`), `title`, `body`, `commit-message`. Requires `contents: write` + `pull-requests: write` permissions on the token. [VERIFIED: github.com/peter-evans/create-pull-request README] | Most widely used "open a PR from CI" action; well-documented token requirements. **Alternative — and arguably simpler here:** `gh pr create --base master --head release --title … --body …` with `GH_TOKEN: ${{ steps.app-token.outputs.token }}`, because the back-merge change is already a branch (`release`), not a working-tree diff. `peter-evans/create-pull-request` shines when CI *generates* a diff to commit+PR; here CI just needs a PR between two existing branches. Planner picks; document the choice (D-3 / Claude's Discretion). |

### Carried forward (unchanged from Phase 6/7 — do not re-pin)

| Action / Tool | Current pin | Notes |
|---------------|-------------|-------|
| `actions/checkout` | `@v5` | `fetch-depth: 0` (tag visibility). **Phase 8 change:** add `token: ${{ steps.app-token.outputs.token }}` so subsequent `git push` (commit-back, tag) uses the App token, not the default `GITHUB_TOKEN`. The App-token step must run BEFORE checkout (or checkout twice / re-configure the remote). [CITED: github.com/orgs/community/discussions/136531 — "generate the app token before checkout, pass it to checkout explicitly"] |
| `actions/setup-node` | `@v4` | `node-version: 20`, `cache: 'npm'`. Node-20-deprecation bump deferred (out of scope; deadline 2026-06-02). |
| `actions/upload-artifact` | `@v4` | `vsix-<bare-version>`, 90-day retention, `if-no-files-found: error`. |
| `stefanzweifel/git-auto-commit-action` | `@v6` | Accepts a custom `token:` input — pass the App token. Honors `[skip ci]` in `commit_message` (the message already contains it). Won't push if the working tree is clean (idempotent). [VERIFIED: research/STACK.md — git-auto-commit-action v6 token + clean-tree-skip behavior; CITED: github.com/stefanzweifel/git-auto-commit-action README — `token` input] |
| `tfx-cli` | `0.23.1` (devDep) | `tfx extension create` + `tfx extension publish`; flags verified green by run #25641329824. No bump. |
| Node.js (CI runner) | `20.x` | matches `engines.node: >=20.10.0`. |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| `actions/create-github-app-token` | `tibdex/github-app-token@v2` | Older community action; `actions/create-github-app-token` is the official successor. Use the official one. |
| GitHub App for verified commit-back | Fine-grained `RELEASE_PAT` | A PAT `git push` produces an *unsigned* commit → master's "Require signed commits" rule would still block it unless the PAT-owner is on the bypass list AND the rule treats bypass as covering signed-commits. Also ties release automation to one human's account; PATs expire (90-day default; max ~1yr). The App auto-signs *API* commits (verified), and an App on the bypass list bypasses all rules anyway. App wins. (User-rejected — D-3.) |
| GitHub App | Default `GITHUB_TOKEN` + add `github-actions[bot]` to the bypass list | `github-actions[bot]` (the built-in Actions identity) **cannot be added to a ruleset bypass list** — the bypass list accepts repository roles, teams, and GitHub Apps, not the built-in Actions bot. (User-rejected — D-3; CONTEXT asserts this; web research is consistent — the bypass-list "GitHub Apps" entry refers to *installed* Apps, and multiple community threads confirm the integrated Actions token can't bypass rulesets/branch-protection. [CITED: github.com/orgs/community/discussions/13836; github.com/orgs/community/discussions/136531]) |
| `release` branch model | Keep `push: master` trigger + leave master unprotected | The user explicitly wants master fully protected AND automatic publishing — the release-branch promotion is the reconciliation. (User-locked — D-3.) |
| `peter-evans/create-pull-request@v7` for the back-merge | `gh pr create --base master --head release` with the App token | `gh pr create` is simpler when the change is already a branch (it is — `release`). `peter-evans/create-pull-request` is better when CI generates a diff. Either works; `gh pr create` is fewer moving parts. Planner's call (D-3 / Discretion). |
| `git mv` for the archive | `cp` + `rm` + `git add` | Loses rename detection in `git log --follow`. Use `git mv`. |

**Installation:** No new npm dependencies. The two new items are GitHub Actions (referenced by `uses:` in `publish.yml`), not packages. The GitHub App is created in the GitHub UI (user action) with two repo secrets added (`APP_ID` + `APP_PRIVATE_KEY` — names are Discretion).

**Version verification:** `actions/create-github-app-token` — latest is `v3.1.1` (2026-04-11); `v1` and `v2` still resolve. `peter-evans/create-pull-request` — latest is `v8.1.1`; `v7` still resolves. `git-auto-commit-action` — `v6.0.1` (Jun 2025) is the v6 line; `v7.1.0` (Dec 2025) is current but bumps to Node 24. `actions/checkout@v5`, `actions/setup-node@v4`, `actions/upload-artifact@v4` — all current per research/STACK.md (verified live 2026-05-04). [VERIFIED: WebFetch github.com/actions/create-github-app-token, github.com/peter-evans/create-pull-request, 2026-05-11; CITED: research/STACK.md for the rest]

---

## Architecture Patterns

### System Architecture Diagram — the new release-branch publish model

```
 Feature work
      │  (PRs targeting master)
      ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  master  — FULL ruleset: require-PR + 2 status checks + signed-commits│
 │            bypass list: [ story-point-release-bot (GitHub App) ]      │
 └─────────────────────────────────────────────────────────────────────┘
      │  maintainer opens "promotion PR"  (base: release, head: master)
      ▼
   ci.yml runs on the promotion PR  (pull_request: branches:[master, release])
      │  maintainer merges via Web UI
      ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  release  — light/no ruleset (or App on its bypass list)             │
 └─────────────────────────────────────────────────────────────────────┘
      │  push to release  (minus paths-ignore)
      ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  publish.yml  (on: push: branches:[release] + workflow_dispatch)    │
 │  concurrency: { group: publish-release, cancel-in-progress: false } │
 │  permissions(job): contents: write                                  │
 │   1  create-github-app-token@v1  → ${{ steps.app-token.outputs.token }}
 │   2  actions/checkout@v5  (fetch-depth: 0, token: <app-token>)      │
 │   3  setup-node@v4 ; npm ci                                         │
 │   4  typecheck → test → build → check:size  (gates; any fail aborts)│
 │   5  asset audit (jq vss-extension.json files[])                    │
 │   6  TFX_PAT presence check ; rulesets-aware protection probe       │
 │   7  node scripts/bump-version.mjs   ← in-memory, NO commit (Opt B) │
 │   8  npx tfx extension create --manifest-globs vss-extension.json --output-path dist/
 │   9  upload-artifact@v4  (vsix-<bare>, 90d, if-no-files-found:error)│
 │  10  npx tfx extension publish --vsix dist/*.vsix --auth-type pat \  │
 │        --token "$TFX_PAT" --no-prompt --no-wait-validation          │
 │      ◄═══ POINT OF NO RETURN. Above this line: release untouched.   │
 │  11  git-auto-commit-action@v6  (token:<app-token>,                 │
 │        commit_message:"chore(release): vX.Y.Z [skip ci]")  → release│
 │  12  git tag -a vX.Y.Z + git push  (token:<app-token>, best-effort, │
 │        idempotent)                                                  │
 │  13  open back-merge PR  (gh pr create --base master --head release  │
 │        --title "chore(release): vX.Y.Z" ; GH_TOKEN:<app-token>)     │
 └─────────────────────────────────────────────────────────────────────┘
      │  maintainer merges the release→master PR via Web UI
      ▼  (Web-UI merge commit = verified signature → satisfies master's rule)
   master catches up to release's version

 Triple anti-loop, still active: [skip ci] in the bot commit message
   + actor-guard `if: github.actor != 'github-actions[bot]'` (now also won't
   fire on the App's pushes — the App's actor slug is the app-slug[bot], not
   github-actions[bot]; CHECK: the actor-guard must also exclude the App's
   bot identity, or the App's commit-back push to `release` could re-trigger
   publish.yml — except `[skip ci]` suppresses it. Belt-and-suspenders: add
   `&& github.actor != '<app-slug>[bot]'` to the guard, or rely on [skip ci].)
   + GITHUB_TOKEN anti-loop is moot here (we're using an App token, which
   DOES re-trigger — so [skip ci] is now load-bearing, not belt-and-suspenders.)
```

### Pattern 1: Mint App token first, pass it everywhere a default-`GITHUB_TOKEN` would silently be used

**What:** The `create-github-app-token` step must run BEFORE `actions/checkout`, and its output token must be explicitly threaded into: `checkout`'s `token:` input, `git-auto-commit-action`'s `token:` input, the tag-push step's git remote auth (`git push https://x-access-token:${TOKEN}@github.com/...` or via `GH_TOKEN` + `gh` / a configured credential helper), and the back-merge PR step's `token:` / `GH_TOKEN`.
**When to use:** Whenever a workflow needs to push to a protected branch via a bypass-listed App, or open a PR that triggers downstream workflows.
**Why it matters:** `actions/checkout` persists credentials by default (`persist-credentials: true`) — but persists the *default `GITHUB_TOKEN`* unless you override `token:`. So a later `git push` uses `GITHUB_TOKEN` (which is NOT on the bypass list, can't push to protected `release` if `release` is protected, and doesn't trigger downstream workflows). [CITED: github.com/orgs/community/discussions/136531]
**Source:** [VERIFIED: github.com/actions/create-github-app-token README example — `git config user.name "${{ steps.app-token.outputs.app-slug }}[bot]"` + `GH_TOKEN: ${{ steps.app-token.outputs.token }}`]

```yaml
- name: Mint release-bot token
  id: app-token
  uses: actions/create-github-app-token@v1   # see Open Questions Q3 on the pin
  with:
    app-id: ${{ secrets.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    permission-contents: write
    permission-pull-requests: write     # only if the back-merge PR uses this token

- name: Checkout
  uses: actions/checkout@v5
  with:
    fetch-depth: 0
    token: ${{ steps.app-token.outputs.token }}     # ← so git push uses the App token

# ...gates, bump, package, publish...

- name: Commit version bump to release
  uses: stefanzweifel/git-auto-commit-action@v6
  with:
    token: ${{ steps.app-token.outputs.token }}     # ← App token, not GITHUB_TOKEN
    commit_message: "chore(release): ${{ steps.bump.outputs.next-version }} [skip ci]"
    commit_user_name: "${{ steps.app-token.outputs.app-slug }}[bot]"
    commit_user_email: "${{ steps.app-token.outputs.app-slug }}[bot]@users.noreply.github.com"
    file_pattern: "package.json vss-extension.json"

- name: Open release → master back-merge PR
  env:
    GH_TOKEN: ${{ steps.app-token.outputs.token }}
  run: |
    gh pr create --base master --head release \
      --title "chore(release): ${{ steps.bump.outputs.next-version }}" \
      --body "Automated back-merge of the version bump. Merge via the Web UI (verified signature)." \
      || echo "PR may already exist (release ahead of master) — skipping"
```

### Pattern 2: The back-merge PR is between two existing branches — don't over-engineer it

**What:** The version-bump commit is *already on `release`* after step 11. The back-merge just needs a PR with `base: master, head: release`. `gh pr create --base master --head release` does exactly this with one line. `peter-evans/create-pull-request` is designed for the *different* case where CI has uncommitted changes it wants to commit-to-a-new-branch-and-PR — using it here means you'd point `branch:` at... `release`?, which is awkward. Recommendation: use `gh pr create` unless there's a concrete reason to prefer the action.
**When to use:** Promoting one long-lived branch's commits to another.
**Anti-pattern:** Using `git-auto-commit-action`'s `branch:` feature for the back-merge — that creates a *new* branch, not a PR; you'd still need a PR-open step. Two steps where one suffices.
**Idempotency:** `gh pr create` errors if a PR for that head→base already exists. Guard with `|| true` or check `gh pr list --base master --head release --json number` first.

### Pattern 3: `paths-ignore` interaction with the new `push: [release]` trigger

**What:** `publish.yml` currently has `paths-ignore: ['**.md', '.planning/**', '.claude/**', 'docs/**']` under `push:`. This stays — but now it filters pushes to `release`. A `master → release` promotion PR merge that touches ONLY ignored files would NOT fire `publish.yml`. That's almost always desirable (a docs-only promotion shouldn't ship a patch). But: if a maintainer wants to ship a docs-only change to the listing's `overview.md`... `overview.md` is NOT in `paths-ignore` (only `docs/**` is), so it fires. Verify the `paths-ignore` list still matches intent under the release-branch model.
**When to use:** Always re-examine `paths-ignore` when changing a workflow's trigger branch.
**Note:** The bot's `chore(release): vX.Y.Z [skip ci]` commit to `release` touches `package.json` + `vss-extension.json` — NOT in `paths-ignore` — so `[skip ci]` (not `paths-ignore`) is what stops the re-trigger. With an App token (which DOES re-trigger, unlike `GITHUB_TOKEN`), `[skip ci]` is now strictly load-bearing.

### Pattern 4: Ordering — capture before archive, wire before re-tighten, verify before cleanup

**What:** Phase 8 has hard ordering dependencies:
1. **Capture the `tfx` invocation into `OPERATIONS.md` BEFORE `git mv scripts/publish-cezari.cjs`** (DOC-02's "captured BEFORE the legacy script is archived" — the knowledge must survive the move; though the canonical invocation actually lives in `publish.yml`, not `publish-cezari.cjs` — see DOC-02 row).
2. **Wire the GitHub App + release-branch flow into `publish.yml` BEFORE re-tightening master's ruleset.** If you re-tighten master first, the next `release → master` back-merge would need the App on the bypass list already configured — and the user does the ruleset config in the UI. Sequence: (a) Claude changes `publish.yml`/`ci.yml`, (b) user creates the App + adds secrets + configures rulesets (master full + App on bypass; release light/none), (c) re-verification run.
3. **Run the re-verification + SC #5 exercise BEFORE the cleanup** — or at least before declaring the milestone done. The cleanup (archiving `publish-cezari.cjs`) removes the manual escape hatch's *npm-script* form; OPERATIONS.md's runbook is the replacement. Don't delete-and-pray.
**Why:** Each step has a "you can't undo this cheaply" or "the next step depends on this being live" property.

### Anti-Patterns to Avoid

- **Adding `github-actions[bot]` to the ruleset bypass list** — it doesn't work; the bypass list takes Apps/teams/roles, not the built-in Actions identity. This is the trap Phase 7 hit.
- **Re-tightening master's "Require signed commits" while still pushing the bump via a plain `git push` (PAT or `GITHUB_TOKEN`)** — that push is unsigned → blocked. Either the App is on the bypass list (bypasses signed-commits too) OR the commit goes via the GitHub Contents API (auto-signed → verified). The chosen design uses App-on-bypass for `release` and human-Web-UI-merge for `master` — so master never receives a bot push at all.
- **Pinning `actions/create-github-app-token@v1` blindly** — v1 still works but is 2 major versions behind; check whether the App-token output names changed (`token`, `app-slug` have been stable). Project convention is `@v<major>`; pick a major that's maintained.
- **Forgetting `permission-pull-requests: write` on the App token if the back-merge PR uses it** — `create-github-app-token` only grants what you ask for AND what the App was installed with. If the App was installed with only `contents: write`, the token can't open a PR. Install the App with `contents: write` + `pull-requests: write` (and `metadata: read`, which is implicit).
- **Leaving the actor-guard as only `if: github.actor != 'github-actions[bot]'`** — the App's commit-back push to `release` has actor `<app-slug>[bot]`, not `github-actions[bot]`. `[skip ci]` suppresses the re-trigger, but for defense-in-depth add the App's bot identity to the guard too (or accept `[skip ci]` as the sole guard, documented).
- **Re-adding a `publish:cezari` npm script "for emergencies"** — explicitly rejected (D-5). The OPERATIONS.md runbook is the escape hatch; a second live publish path defeats CLEAN's intent.
- **Putting rationale/comments in the workflow YAML** — Phase 6/7 D-3: all the "why" lives in `OPERATIONS.md`; YAML step `name:` fields must be self-explanatory.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Minting a GitHub App installation token in CI | A custom JWT-signing + `POST /app/installations/{id}/access_tokens` shell script | `actions/create-github-app-token@v1` | Handles JWT signing (RS256 from the private key), installation lookup, token request, scoping (`owner`/`repositories`/`permission-*`), and auto-revoke at job end. The official action; ~5 lines. |
| Opening a PR from a workflow step | `curl POST /repos/{o}/{r}/pulls` with hand-built JSON | `gh pr create --base … --head …` (with the App token) OR `peter-evans/create-pull-request@v7` | `gh` is preinstalled on `ubuntu-latest`; handles auth, JSON, error reporting. `peter-evans` adds diff-commit-and-PR for the diff-generating case. |
| Moving a file while keeping git history | `cp` + `rm` + `git add` | `git mv scripts/publish-cezari.cjs scripts/.archive/publish-cezari.cjs` | Preserves rename detection (`git log --follow`); creates `scripts/.archive/` automatically. |
| Verified-signature bot commits | GPG key generation + `git config user.signingkey` + `commit_options: -S` | A GitHub App committing via the Contents API (auto-signed by GitHub) — OR, here, route master commits through a human Web-UI merge (also verified) | GitHub auto-signs API commits made with an installation token; no key management. (The chosen design sidesteps this for `release` by putting the App on the bypass list, and for `master` by never bot-pushing to it.) |
| Detecting branch-protection / ruleset state in a probe | Parsing the legacy `branches/{b}/protection` 404 body only | Query BOTH `GET /repos/{o}/{r}/branches/{b}/protection` (legacy) AND `GET /repos/{o}/{r}/rules/branches/{b}` (rulesets) | The Phase 7 outage root cause: the Phase 6 probe checked only legacy protection and missed the master ruleset. OPERATIONS.md §4 documents this; the `publish.yml` probe step (if kept) should be upgraded — though per D-9 it's informational, not gating; the *durable* artifact is the OPERATIONS.md note. |

**Key insight:** The only genuinely new mechanism in this phase — a GitHub App installation token — has an official, ~5-line action. Everything else is the existing Phase 7 publish chain re-pointed at a different branch plus two small additive steps (back-merge PR open, App-token mint). The "hard" parts are *configuration in the GitHub UI* (creating the App, setting up rulesets) which Claude can't do — so the plan must clearly hand those off to the user with precise instructions, and `OPERATIONS.md` must document them durably.

---

## Runtime State Inventory

> This phase includes a rename-adjacent change (archiving a file + removing npm scripts) and a config-state change (rulesets, branch creation, secrets). State inventory below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** No databases, no datastores hold the renamed/moved string as a key. `publish-cezari.cjs`'s path appears only in: `package.json` `scripts` (code edit — CLEAN-02), the file's own header comments (moves with the file — CLEAN-01), and `.planning/**` (allowed to keep historical refs). | Code edit only (CLEAN-01/02). No data migration. |
| Live service config | **GitHub repository rulesets** — currently RELAXED on `master` (Phase 7 recovery removed "Require signed commits" + "Require a pull request before merging"; "Require status checks (2 checks)" status unclear — verify). This config lives in the GitHub UI, NOT in git. **New `release` branch** must be created (it doesn't exist yet). **GitHub App** must be created + installed (UI). **Marketplace publisher** config (`aex.dev.azure.com`) is unchanged — only the PAT-rotation *procedure* is being documented, not changed. | User actions (UI): (a) create `release` branch off `master`; (b) create + install the GitHub App with `contents: write` + `pull-requests: write`; (c) re-tighten master's ruleset to full protection + add the App to its bypass list; (d) configure `release`'s ruleset (light/none or App on bypass). Claude documents all of this in OPERATIONS.md. |
| OS-registered state | **None.** No Task Scheduler / pm2 / launchd / systemd registrations reference this project's publish path. | None — verified by absence (this is a GitHub-Actions-only CI surface; no self-hosted runners, no cron jobs registered outside GitHub). |
| Secrets / env vars | **`TFX_PAT`** repo secret — UNCHANGED in Phase 8 (the PAT rotation runbook documents *how* to rotate it on a 1-year cadence, but Phase 8 doesn't rotate it; the SC #5 exercise *temporarily* revokes-and-restores it). **New secrets:** `APP_ID` + `APP_PRIVATE_KEY` (or whatever names — Discretion) for the GitHub App. **`.env.local`** (gitignored, local-only) — referenced by the archived `publish-cezari.cjs`; the OPERATIONS.md emergency runbook documents the `.env.local` / `TFX_PAT` local setup for manual publishing. | User adds `APP_ID` + `APP_PRIVATE_KEY` repo secrets. `TFX_PAT` untouched (except the SC #5 exercise's revoke-then-restore). |
| Build artifacts | **None stale.** Archiving `publish-cezari.cjs` doesn't invalidate any built artifact (it's a `.cjs` script run directly via `node`, not a built/installed package). No egg-info, no compiled binaries, no `dist/` entry. The `dist/` dir holds the webpack bundle + the `.vsix` — neither references `publish-cezari.cjs`. | None. |

**The canonical question — "after every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?":** Nothing in a *data* sense. The state that matters is GitHub UI config (rulesets, the new App, the new `release` branch, the two new secrets) — none of which is in git, and all of which is the user's to configure. The plan must make these hand-offs explicit and OPERATIONS.md must document them so they're reconstructable.

---

## Common Pitfalls

### Pitfall 1: App token expires mid-workflow (1-hour limit)

**What goes wrong:** `create-github-app-token` mints a token valid for 1 hour. If `publish.yml` runs long (it shouldn't — Phase 7's run was ~35s, job `timeout-minutes: 10`), the token could expire before the commit-back/tag/PR steps.
**Why it happens:** Long `npm ci`, slow `tfx publish` (Marketplace 5xx + the workflow doesn't retry, so it fails fast anyway), or a manual `workflow_dispatch` left queued.
**How to avoid:** Mint the token EARLY (step 1, before checkout) so the full hour is available; keep `timeout-minutes: 10` on the job. Realistically a non-issue for a ~1-2 min job, but worth a one-line note in OPERATIONS.md. If it ever bites: re-run the workflow (a fresh token is minted each run).
**Warning signs:** A `401`/`403` on the `git push` or `gh pr create` step despite the App being correctly configured, late in a long run.

### Pitfall 2: The actor-guard doesn't cover the App's bot identity → back-merge loop risk

**What goes wrong:** `publish.yml`'s job-level `if: github.actor != 'github-actions[bot]'` was the Phase 7 anti-loop guard. With an App token, the bot's commit-back push to `release` has actor `<app-slug>[bot]` — which is NOT `github-actions[bot]`, so the guard doesn't fire. The push to `release` would re-trigger `publish.yml`... except the commit message contains `[skip ci]`, which suppresses it. If `[skip ci]` is ever dropped/typo'd (`[skip Ci]` — case-sensitive!), you get a publish loop (v1.0.9 → v1.0.10 → ... every ~2 min until rate-limited).
**Why it happens:** The triple-defense was designed for `GITHUB_TOKEN` (which has a *built-in* anti-loop guarantee). An App token does NOT have that guarantee — App-token pushes DO trigger workflows. So `[skip ci]` goes from "belt-and-suspenders" to "load-bearing."
**How to avoid:** (a) Keep `[skip ci]` exactly as `[skip ci]` (lowercase, the canonical GitHub token) in the `commit_message` — it's the primary guard now. (b) Add `&& github.actor != '<app-slug>[bot]'` to the job-level `if:` for defense-in-depth. (c) Optionally keep the `paths-ignore` — but the bump commit touches `package.json`/`vss-extension.json` which aren't ignored, so `paths-ignore` doesn't help here.
**Warning signs:** Back-to-back `Publish` runs on `release`; Marketplace gaining multiple patch versions in an hour with no corresponding promotion PR.

### Pitfall 3: The back-merge PR creates a loop with `ci.yml` (or never gets merged)

**What goes wrong:** The `release → master` back-merge PR is opened by the App token → triggers `ci.yml` (good — that's why we use the App token, not `GITHUB_TOKEN`). But: (a) if `ci.yml` is misconfigured to also run on `push: release`, you get extra runs; (b) the PR sits open forever if no human merges it (master drifts behind `release`); (c) if a *second* promotion happens before the first back-merge PR is merged, `release` is now 2 bumps ahead and the open PR auto-updates — fine, but the maintainer should merge promptly.
**Why it happens:** Forgetting that the back-merge is a human-in-the-loop step (by design — the human merge produces the verified-signature commit master's rule requires).
**How to avoid:** `ci.yml` triggers ONLY on `pull_request: branches: [master, release]` (the Phase 8 change is adding `release` to that list — NOT adding a `push:` trigger). Document in OPERATIONS.md: "after a publish, merge the open `release → master` PR via the Web UI." Optionally a `workflow_dispatch` reminder or just rely on the maintainer.
**Warning signs:** `master`'s `version` field lagging `release`'s by more than one patch; an old open `chore(release): vX.Y.Z` PR.

### Pitfall 4: `release` branch protection blocks the App's direct push (bump commit + tag)

**What goes wrong:** If `release` gets a ruleset with "Require signed commits" or "Require a pull request before merging" and the App is NOT on `release`'s bypass list, the `git-auto-commit-action` push (unsigned, direct) fails — the same `GH013` Phase 7 hit on `master`.
**Why it happens:** Applying master's protection model to `release` without remembering `release` is where automation pushes directly.
**How to avoid:** Either (a) `release` gets NO ruleset / a light one (e.g. "require linear history" only — that doesn't block bot pushes), OR (b) `release` gets a ruleset AND the App is on `release`'s bypass list too. CONTEXT D-3 / Discretion: planner picks; document it. Recommendation: keep `release` light (it's the automation lane, not the human-protected lane).
**Warning signs:** `GH013: Repository rule violations found for refs/heads/release` in the commit-back or tag step.

### Pitfall 5: SC #5 exercise burns more patch versions than expected / leaves the repo in a weird state

**What goes wrong:** The SC #5 exercise: revoke `TFX_PAT` → `workflow_dispatch` on `release` → publish step fails (good, Marketplace untouched, no orphan commit/tag — Option B) → restore `TFX_PAT` → re-run → clean publish ships a real patch. So the exercise ships *one* real version (the re-run). But if you also did a separate re-verification run, that's *two* versions (v1.0.9 from re-verification, v1.0.10 from the SC #5 re-run). Plus: if the failed run somehow DID leave a partial state (it shouldn't, per Option B — bump is in-memory only), you'd need the partial-failure recovery runbook.
**Why it happens:** Treating "re-verification" and "SC #5 exercise" as fully separate when the SC #5 restore-and-rerun is itself a clean end-to-end run.
**How to avoid:** Planner's call (D-4): EITHER (a) collapse them — the SC #5 restore-and-rerun IS the re-verification (one real patch shipped, v1.0.9), OR (b) run them separately (v1.0.9 re-verification, then v1.0.10 SC #5 — two patches, more thorough). Document which in the verification artifact. Sequence the SC #5 exercise AFTER the App + release-branch wiring is live so the re-run exercises the new model.
**Warning signs:** N/A — this is a planning-choice pitfall, not a runtime one.

### Pitfall 6: Capturing the wrong `tfx` invocation into OPERATIONS.md (the cezari-private form vs the public-publish form)

**What goes wrong:** `publish-cezari.cjs` builds `npx tfx extension publish --manifest-globs vss-extension.json --no-wait-validation --token <PAT> --share-with cezari` (private-share, no `--vsix`, no `--auth-type pat`, no `--no-prompt`). The CURRENT canonical public-publish invocation (verified green in `publish.yml` run #25641329824) is `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation`. DOC-02 says "captured from `publish-cezari.cjs`" — but blindly copying the cezari form would document the OLD private-share path, not the production path.
**Why it happens:** Reading DOC-02's "captured from publish-cezari.cjs" literally instead of "the canonical emergency-publish invocation."
**How to avoid:** The OPERATIONS.md emergency runbook documents the CURRENT public-publish form (the one in `publish.yml`), plus the `tfx extension create --manifest-globs vss-extension.json --output-path dist/` packaging step, plus the `.env.local`/`TFX_PAT` local setup. Optionally note "the archived `publish-cezari.cjs` shows the older `--share-with cezari` private-share variant if you ever need to re-share privately." Capture this BEFORE `git mv` per DOC-02's load-bearing "BEFORE" wording.
**Warning signs:** A maintainer following the runbook publishes privately to `cezari` instead of to the public listing.

### Pitfall 7: `git grep -F 'publish:cezari'` still finds hits after cleanup (CLEAN-03 fails)

**What goes wrong:** After CLEAN-01 (`git mv` → `scripts/.archive/publish-cezari.cjs`) + CLEAN-02 (remove the two npm scripts), `git grep -F 'publish:cezari'` should return 0 hits OUTSIDE `scripts/.archive/` and `.planning/`. But: the moved file's header comment says `// Usage: npm run publish:cezari` — that's a hit, but it's IN `scripts/.archive/` so it's allowed. CLAUDE.md (the project instructions file) — check it doesn't reference `publish:cezari` (it doesn't, per the version read here). `README.md` — check. `.github/` workflows — check (`publish.yml` references `publish-cezari.cjs` only in a CONTEXT-doc sense, not in YAML; verify the actual YAML is clean).
**Why it happens:** Not enumerating all the places the string could live before declaring CLEAN-03 satisfied.
**How to avoid:** Run `git grep -nF 'publish:cezari'` and `git grep -nF 'publish-cezari'` (both forms!) and confirm every hit is in `scripts/.archive/` or `.planning/`. The verification command in the success criteria is `git grep -F 'publish:cezari'` — but also sanity-check `publish-cezari` (the filename) and `publish:public` (the other removed script — though that's not in CLEAN-03's literal text, it should also be gone from `package.json`).
**Warning signs:** CLEAN-03's `git grep` returns a hit in `package.json`, `README.md`, `.github/`, or `src/`.

### Pitfall 8: The `bump-version.mjs` max-wins logic interacts oddly with the release-branch model

**What goes wrong:** `bump-version.mjs` reads `package.json` + `vss-extension.json` on the *current checkout* and bumps `max(pkg, manifest) + 1`. In the release-branch model it runs on the `release` checkout. If `release` is behind `master` (e.g. a hotfix went to master but the promotion PR hasn't merged), or if the bot's previous bump commit to `release` hasn't been back-merged to master, the two branches' `version` fields can diverge. The bump always operates on `release`'s files, so it's self-consistent there — but the back-merge PR is what keeps `master` in sync. If a maintainer manually bumps `master`'s version (they shouldn't), the next promotion PR could merge a *lower* version onto `release`... and `bump-version.mjs`'s max-wins would still pick the right number (it reads both files *on `release`*). The real hazard: if `master`'s `version` is somehow *ahead* of `release`'s (manual edit), a promotion PR brings that ahead-version onto `release`, and the bump correctly continues from there. Net: max-wins is robust; the documentation just needs to say "never hand-edit `version` in either branch — let the workflow own it; reconcile via the partial-failure runbook if it drifts."
**Why it happens:** Two long-lived branches each carrying a `version` field.
**How to avoid:** OPERATIONS.md: "the workflow owns the `version` field on `release`; `master` receives it via the back-merge PR; never hand-edit it except per the recovery runbook." The `bump-version.mjs` `::warning::Drift reconciled` annotation (D-2 from Phase 7) surfaces any divergence in the run summary.
**Warning signs:** A `## Drift reconciled` block in the workflow run summary; `master` and `release` `version` fields more than one patch apart.

---

## Code Examples

### Minting + threading the App token (the new bits in `publish.yml`)

```yaml
# Source: github.com/actions/create-github-app-token README + community.github.com/discussions/136531
permissions:
  contents: read              # top-level baseline (gates run read-only)

jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    if: github.actor != 'github-actions[bot]'   # consider also: && github.actor != '<app-slug>[bot]'
    permissions:
      contents: write           # commit-back + tag push
      pull-requests: write      # only if the back-merge PR uses GITHUB_TOKEN — but we use the App token, so this can stay 'read' or be omitted; harmless to include
    steps:
      - name: Mint release-bot token
        id: app-token
        uses: actions/create-github-app-token@v1     # see Open Questions Q3
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          permission-contents: write
          permission-pull-requests: write

      - name: Checkout
        uses: actions/checkout@v5
        with:
          fetch-depth: 0
          token: ${{ steps.app-token.outputs.token }}

      # ... setup-node@v4, npm ci, typecheck, test, build, check:size,
      #     asset audit, TFX_PAT presence, (upgraded) rulesets-aware probe ...

      - name: Bump version (in-memory only)
        id: bump
        run: node scripts/bump-version.mjs

      - name: Package vsix
        run: npx tfx extension create --manifest-globs vss-extension.json --output-path dist/

      - name: Upload .vsix artifact
        uses: actions/upload-artifact@v4
        with:
          name: vsix-${{ steps.bump.outputs.next-version-bare }}
          path: dist/*.vsix
          retention-days: 90
          if-no-files-found: error

      - name: Publish to Marketplace
        env:
          TFX_PAT: ${{ secrets.TFX_PAT }}
        run: npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation
      # ◄═══ POINT OF NO RETURN

      - name: Commit version bump to release
        uses: stefanzweifel/git-auto-commit-action@v6
        with:
          token: ${{ steps.app-token.outputs.token }}
          commit_message: "chore(release): ${{ steps.bump.outputs.next-version }} [skip ci]"
          commit_user_name: "${{ steps.app-token.outputs.app-slug }}[bot]"
          commit_user_email: "${{ steps.app-token.outputs.app-slug }}[bot]@users.noreply.github.com"
          file_pattern: "package.json vss-extension.json"

      - name: Tag release (best-effort, idempotent)
        continue-on-error: true
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          V="${{ steps.bump.outputs.next-version }}"
          git rev-parse "$V" >/dev/null 2>&1 && { echo "tag exists locally — skip"; exit 0; }
          git ls-remote --tags origin "$V" | grep -q "$V" && { echo "tag exists on origin — skip"; exit 0; }
          git tag -a "$V" -m "Release $V"
          git push origin "$V"

      - name: Open release → master back-merge PR
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          V="${{ steps.bump.outputs.next-version }}"
          gh pr list --base master --head release --state open --json number --jq 'length' | grep -q '^0$' || { echo "back-merge PR already open — skip"; exit 0; }
          gh pr create --base master --head release --title "chore(release): $V" --body "Automated back-merge of the version bump. Merge via the Web UI for a verified-signature commit (satisfies master's signed-commits rule)."
```

### The `ci.yml` change (extend `pull_request` to `release`)

```yaml
# Source: existing ci.yml — Phase 8 change is just adding 'release' to the branches list
on:
  pull_request:
    branches: [master, release]     # was: [master]
```

### The cleanup (CLEAN-01/02/03) — order matters

```bash
# 1. (FIRST) capture the canonical tfx invocation into .planning/OPERATIONS.md  ← DOC-02
#    (the public-publish form from publish.yml, NOT the cezari-private form)

# 2. CLEAN-01: archive the legacy script (preserves git history)
git mv scripts/publish-cezari.cjs scripts/.archive/publish-cezari.cjs
# then add the header comment to the moved file:
#   // ARCHIVED — superseded by .github/workflows/publish.yml. Kept for reference only;
#   // the canonical emergency-publish tfx invocation is documented in .planning/OPERATIONS.md.

# 3. CLEAN-02: remove the two npm scripts from package.json "scripts":
#    delete  "publish:cezari": "node scripts/publish-cezari.cjs"
#    delete  "publish:public": "node scripts/publish-cezari.cjs --public"
#    (KEEP  "package": "tfx extension create --manifest-globs vss-extension.json --output-path dist/")

# 4. CLEAN-03: verify
git grep -nF 'publish:cezari'      # expect: hits ONLY in scripts/.archive/ and .planning/
git grep -nF 'publish-cezari'      # (also check the filename form) — same expectation
git grep -nF 'publish:public'      # expect: 0 hits in package.json; .planning/ allowed
```

### PAT Rotation Procedure (DOC-01 content — for OPERATIONS.md)

```
## Marketplace PAT rotation (1-year cadence)

The TFX_PAT repo secret authenticates `tfx extension publish`. Azure DevOps caps PAT
lifespan at 1 year. Rotate proactively (~11 months in; set a calendar reminder).

1. Sign in to https://dev.azure.com/ with the Microsoft account that owns the
   Marketplace publisher `TsezariMshvenieradzeTfsAiReviewTask`.
   (The Marketplace publisher-management surface is reachable via
   https://aex.dev.azure.com/ — but the PAT itself is created in Azure DevOps user settings.)
2. User settings (top-right avatar) → Personal access tokens → + New Token.
3. Name: e.g. "marketplace-publish-2027". Organization: **All accessible organizations**
   (NOT a single org — tfx-cli's publish API operates outside org context; a single-org PAT
   401s). Expiration: **Custom defined → 1 year** (the max).
4. Scopes: **Custom defined** → scroll to **Marketplace** → check **Publish** (the minimal
   scope tfx-cli needs to publish; do NOT add Manage or Acquire).
   [NOTE: some Microsoft docs say "Marketplace (Manage)" — the current TFX_PAT works with
   whatever scope it has (v1.0.8 published green). If a rotated "Publish"-only PAT 401s on
   publish, widen to "Manage". Track which scope worked.]
5. Create → copy the token (shown once).
6. GitHub repo → Settings → Secrets and variables → Actions → TFX_PAT → Update secret →
   paste the new value.
7. Back in Azure DevOps PAT settings → revoke the OLD token.
8. Verify: trigger publish.yml via workflow_dispatch on `release` (or wait for the next
   promotion) and confirm the publish step authenticates.
```

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| `publish.yml` triggers on `push: [master]`; master unprotected so `GITHUB_TOKEN` commit-back works | `publish.yml` triggers on `push: [release]`; master FULLY protected; commit-back to `release` via a GitHub App token; back-merge PR `release → master` merged by a human (verified-signature commit) | Phase 8 (this phase) | The "automatic" promise moves to the promotion boundary: a `master → release` PR merge auto-ships a patch. Master gains real protection. |
| Manual emergency publish = `npm run publish:cezari` | Manual emergency publish = `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation` (documented in `OPERATIONS.md`); npm scripts removed | Phase 8 (CLEAN-01/02 + DOC-02) | One canonical publish path (the GH Action). The escape hatch is a runbook, not a second live script. |
| `tibdex/github-app-token` for App tokens | `actions/create-github-app-token` (official) | ~2023 (action published); Phase 8 adopts it | Official, maintained, ~5-line usage. v3.1.1 current (Apr 2026); v1/v2 still resolve. |
| Branch protection via the legacy `branches/{b}/protection` API | Repository **rulesets** (`/repos/{o}/{r}/rulesets`, `/rules/branches/{b}`) — GitHub's newer, separate mechanism; bypass lists accept Apps/teams/roles | Rulesets GA'd ~2023; Phase 7 discovered the project's master ruleset the hard way | Probes MUST check BOTH legacy protection AND rulesets. OPERATIONS.md §4 documents this. |
| GitHub Actions runners on Node 20 | Node 24 (forced default from **2026-06-02**; Node 20 removed from runners **2026-09-16**) | Announced 2025-09-19 | `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4` (and `git-auto-commit-action` if it declares `node20`) emit deprecation warnings; will be auto-forced to Node 24. **Out of scope for Phase 8** per CONTEXT (planner's call to fold in; not a requirement). [VERIFIED: github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners] |

**Deprecated/outdated:**
- `npm run publish:cezari` / `publish:public` — removed in Phase 8.
- The Phase 6 branch-protection probe's "legacy-only" check — superseded by the rulesets-aware approach (documented, not necessarily re-coded in `publish.yml` — D-9 makes the probe informational).
- The `publish-cezari.cjs` `--share-with cezari` private-share form — archived; the public-publish form (in `publish.yml`) is canonical.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A GitHub App on a repository ruleset's bypass list bypasses **ALL** rules in that ruleset — including "Require a pull request before merging", "Require status checks to pass", AND "Require signed commits" — when set to "Always allow". | Standard Stack / Architecture / CONTEXT D-3 | If a bypass-listed App does NOT bypass "Require signed commits" specifically (i.e. bypass covers PR/status-checks but the unsigned-commit rule still blocks), then the App's plain `git push` to a signed-commits-protected branch fails. **Mitigation already in the design:** `release` is kept light/unprotected (no signed-commits rule there), and `master` never receives a bot push (the back-merge PR is human-merged). So even if A1 is wrong, the chosen design still works — A1 only matters if someone later puts a signed-commits rule on `release`. CONTEXT D-3 asserts A1 as fact; GitHub docs don't explicitly enumerate it (Open Questions Q1). **The discuss-phase / planner should confirm with the user** before relying on "App-on-master-bypass lets the App push directly to master" — but the current design doesn't rely on that. |
| A2 | The `TFX_PAT` rotation procedure uses scope `Marketplace (publish)` (per research/STACK.md citing Microsoft Learn). | DOC-01 / PAT Rotation Procedure | Some Microsoft docs say `Marketplace (Manage)`. The CURRENT `TFX_PAT` works (v1.0.8 published green) but its exact scope isn't recorded. If a rotated "Publish"-only PAT 401s, the runbook needs "widen to Manage." Risk: low (the runbook flags this); a rotated PAT failing would be caught at the next publish. [VERIFIED: research/STACK.md HIGH-confidence; CONFLICTING: a vsixcookbook/community result says "Manage"] |
| A3 | `actions/create-github-app-token`'s output names (`token`, `app-slug`) are stable across major versions v1/v2/v3, so pinning `@v1` (project convention) still gives `steps.app-token.outputs.token` and `steps.app-token.outputs.app-slug`. | Standard Stack / Code Examples | If v1's output names differ from v3's, the example YAML breaks. Mitigation: the planner should `cat` the action's `action.yml` for the pinned major before finalizing — or just pin a maintained major (`@v2`/`@v3`). The `token` output has been stable since v1; `app-slug` was added later (v1.x) — verify it exists in the pinned version, or derive the bot identity differently. [ASSUMED — based on training knowledge of the action; not verified version-by-version this session] |
| A4 | The `release` branch doesn't exist yet and must be created off `master` as a Phase 8 prerequisite (user action). | Runtime State Inventory | If `release` already exists with stale content, creating "off master" would need a force-update or a different approach. Risk: low (CONTEXT describes it as "a new long-lived `release` branch"). [ASSUMED — CONTEXT says "a new long-lived release branch"; not verified against the live repo's branch list this session] |
| A5 | `publish.yml`'s concurrency group should change from `publish-master` to `publish-release` (or similar) to match the new trigger branch. | Architecture Diagram | If left as `publish-master`, it still works (it's just a label) but is misleading. Cosmetic. [ASSUMED — reasonable but a Discretion-level call] |
| A6 | The existing `package.json` on the `milestone1.1` branch (read here) shows `version: "1.0.7"`; master HEAD `eba84b3` is at `1.0.8` (per STATE/07-VERIFICATION). The next published version will be `1.0.9` (re-verification) and possibly `1.0.10` (SC #5 re-run). | Pitfall 5 / requirement support | If the `milestone1.1` branch needs the v1.0.8 recovery commit synced first (the "docs PR `milestone1.1 → master`" mentioned in CONTEXT/Discretion), the version base could differ. The planner should check the actual `version` on whichever branch Phase 8 work happens on. [VERIFIED for the milestone1.1 checkout read here; the master-vs-milestone1.1 sync state is a known open item — CONTEXT Discretion] |

**If this table is empty:** It is not. A1 and A2 are the load-bearing ones; the design is built to survive A1 being wrong (because it doesn't rely on the App pushing directly to a signed-commits-protected master). A3 is a 30-second check for the planner. The rest are cosmetic/low-risk.

---

## Open Questions (RESOLVED)

> All five questions below were consumed by the Phase 8 plans — each carries a `— RESOLVED:` note citing the plan/task that implemented its recommendation. Retained for traceability.

1. **Does a GitHub App on a ruleset's bypass list (mode "Always allow") bypass the "Require signed commits" rule specifically?** — RESOLVED: design keeps `release` light and master human-merged, so it never depends on this; the A1 "user-asserted, not doc-verified" caveat is documented in Plan 08-02 Task 2 (OPERATIONS.md §3) and re-stated in Plan 08-03 Task 2's read-first.
   - What we know: GitHub docs say the bypass list accepts "Repository admins... the maintain or write role... Teams... GitHub Apps... Dependabot" and that bypass lets the actor "bypass the rules in the ruleset." Community threads are mixed on edge cases (one reports status-checks still "failing" but the actor can merge anyway). CONTEXT D-3 asserts "a GitHub App on a ruleset's bypass list bypasses ALL rules in that ruleset (PR-required, status-checks, signed-commits)."
   - What's unclear: GitHub's docs don't enumerate "bypass covers rule X, Y, Z" — they say "bypass the rules" generically. Empirically, an Always-allow App bypass does appear to cover signed-commits (organizations use it for exactly that). But it's not a quoted, unambiguous doc statement.
   - Recommendation: The chosen design DOESN'T depend on this (release stays light; master is human-merged). So treat A1 as "asserted by the user, design is robust to it being wrong." If a future change wants the App to push *directly to a signed-commits-protected branch*, verify empirically first (one test push). The planner/discuss-phase should note this in the plan as a "user-asserted, not doc-verified" item.

2. **Is the Marketplace PAT scope `Marketplace (publish)` or `Marketplace (Manage)`?** — RESOLVED: `Marketplace (publish)` documented as the minimal scope with the "widen to Manage if a rotated Publish-only PAT 401s" fallback note in Plan 08-02 Task 1 (OPERATIONS.md §1); Plan 08-03 Task 4 (SC #5 restore step) records which scope the freshly-minted PAT actually used.
   - What we know: research/STACK.md (HIGH confidence, citing Microsoft Learn "Publish from the command line") says `Marketplace (publish)`. The existing `TFX_PAT` works. A community/vsixcookbook source says `Marketplace (Manage)`.
   - What's unclear: which scope the *current* `TFX_PAT` actually has (not recorded), and whether "Publish" alone is sufficient for `tfx extension publish` (research says yes; some say you need "Manage").
   - Recommendation: Document `Marketplace (publish)` as the minimal scope (per research), with a flagged note: "if a rotated Publish-only PAT 401s, widen to Manage." Low risk — caught at the next publish. The SC #5 exercise (revoke-restore) is a natural moment to confirm the scope when the PAT is recreated.

3. **What major version of `actions/create-github-app-token` and `peter-evans/create-pull-request` to pin?**
   - What we know: project convention is `@v<major>` (e.g. `checkout@v5`, `setup-node@v4`). `create-github-app-token` is at v3.1.1 (Apr 2026); v1/v2 still resolve. `peter-evans/create-pull-request` is at v8.1.1; v7 still resolves. CONTEXT says `@v1` for create-github-app-token "matches the project's `@v<major>` convention" but that's a non-sequitur — `@v1` matches the *style* but not the *recency*.
   - What's unclear: whether v1's output names match v3's (the YAML examples assume `outputs.token` + `outputs.app-slug`).
   - Recommendation: Pin a *maintained* major — `actions/create-github-app-token@v2` (or `@v3`) and `peter-evans/create-pull-request@v7` (research's earlier reference) or `@v8`. Verify `outputs.token` / `outputs.app-slug` exist in the pinned major (30-second `action.yml` check). The `@v<major>` *style* is preserved either way. Don't pin `@v1` of create-github-app-token just because CONTEXT mentioned it — CONTEXT explicitly leaves it to "planner's call."

4. **Collapse the re-verification run and the SC #5 exercise, or run them separately?** — RESOLVED: planned "separate but adjacent" — Plan 08-03 Task 3 ships v1.0.9 (re-verification), Task 4 ships v1.0.10 (SC #5 restore-and-rerun); collapsing remains acceptable at execution time per D-4 and is recorded in 08-SC5-EXERCISE.md.
   - What we know: D-4 leaves this to the planner. Collapsing = one real patch shipped (v1.0.9, via the SC #5 restore-and-rerun). Separate = two patches (v1.0.9 re-verification, v1.0.10 SC #5).
   - Recommendation: Lean toward *separate but adjacent*: run the re-verification (v1.0.9) first to confirm the happy path through the new model, THEN the SC #5 exercise (revoke → fail → restore → re-run ships v1.0.10). Two patches is cheap; the separation gives a clean "the new model works" data point before deliberately breaking it. But collapsing is acceptable per D-4 — document whichever in the verification artifact.

5. **Sync the Phase 7 `.planning/` close-out to master first (docs PR `milestone1.1 → master`)?**
   - What we know: CONTEXT Discretion lists this as optional. `milestone1.1` has commit `9fcd418` (Phase 7 close-out: 07-VERIFICATION, 07-02-SUMMARY, STATE/ROADMAP updates) not yet on master. A docs-only PR `milestone1.1 → master` would sync them (paths-ignored — won't fire `publish.yml`). Also note: this checkout's `package.json` shows `1.0.7` (not `1.0.8`) — the v1.0.8 recovery commit `eba84b3` is on master but the recovery hand-bump may not be on `milestone1.1`. The planner should check what branch Phase 8 work happens on and reconcile versions.
   - Recommendation: Do the docs-sync PR as an early Phase 8 housekeeping task (or note it explicitly as a user pre-step). It also de-confuses the `version`-field state before the re-verification run. But it's not blocking — leave it to the planner / user.

---

## Environment Availability

> This phase depends on GitHub (Actions, rulesets, App support), the Visual Studio Marketplace, and `tfx-cli` — all already proven in Phases 6/7. No new external tooling.

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| GitHub Actions (`ubuntu-latest` runner) | `publish.yml` / `ci.yml` | ✓ | Ubuntu 24.04, runner v2.327.1+ | — |
| GitHub repository rulesets | Re-tightening master's protection (user, UI) | ✓ | GA | Legacy branch protection (worse — the Phase 7 trap; rulesets are the right mechanism) |
| GitHub App support | Verified commit-back (user creates the App, UI) | ✓ | — | Fine-grained PAT (`RELEASE_PAT`) — user-rejected (D-3); unsigned-push problem |
| `actions/create-github-app-token` action | Minting the App token in `publish.yml` | ✓ (Marketplace action) | v3.1.1 (v1/v2 resolve) | `tibdex/github-app-token@v2` (older) |
| `peter-evans/create-pull-request` action OR `gh` CLI | Opening the back-merge PR | ✓ (`gh` preinstalled on `ubuntu-latest`; `peter-evans` is a Marketplace action) | `gh` (preinstalled); `peter-evans/create-pull-request@v8.1.1` (v7 resolves) | Each is the other's fallback |
| `tfx-cli` | `tfx extension create` / `publish` (re-verification + SC #5 runs) | ✓ (devDep) | `0.23.1` | — (no real alternative; Microsoft's only `.vsix` packager) |
| Visual Studio Marketplace (publish API) | The re-verification + SC #5 publish runs | ✓ | API `7.x` | — |
| `git` (with `mv`) | CLEAN-01 archive | ✓ (preinstalled everywhere) | — | — |
| `jq` | Asset audit step (existing); CLEAN-03 sanity checks | ✓ (preinstalled on `ubuntu-latest`; available locally) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — everything is available; the `peter-evans/create-pull-request` vs `gh pr create` choice is a preference, not a fallback.

**User actions required (Claude can't do these — UI only):**
1. Create the `release` branch off `master`.
2. Create + install the GitHub App (permissions `contents: write` + `pull-requests: write` + `metadata: read`); add `APP_ID` + `APP_PRIVATE_KEY` repo secrets.
3. Re-tighten master's ruleset: re-add "Require a pull request before merging" + "Require status checks to pass (2 checks: the two `ci.yml` checks)" + "Require signed commits"; add the release App to master's bypass list (mode: "Always allow" recommended, so an App-driven push would work — though the design's master path is human-merge anyway).
4. Configure `release`'s ruleset: keep it light (e.g. "Require linear history" only) OR none — do NOT add "Require signed commits" or "Require a pull request" to `release` unless the App is also on `release`'s bypass list.
5. (SC #5 exercise) Temporarily revoke `TFX_PAT`, then restore a fresh one.
6. Merge the `master → release` promotion PR(s) and the `release → master` back-merge PR(s) via the Web UI during the re-verification + SC #5 runs.

All of these are documented in `OPERATIONS.md` (D-1 §3 + the App-creation steps) so they're reconstructable.

---

## Security Domain

> `security_enforcement` is not present in `.planning/config.json` (treated as enabled). This phase has **no application code changes** — the security surface is the CI/CD automation and secrets handling. ASVS categories below are mostly N/A; the relevant controls are secret management and least-privilege workflow permissions.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | The CI auth surface: `TFX_PAT` (Marketplace publish), `APP_ID`/`APP_PRIVATE_KEY` (GitHub App). Controls: 1-year PAT lifespan + documented rotation (DOC-01); App private key stored as a repo secret (encrypted at rest by GitHub); App token is short-lived (1 hour) and auto-revoked at job end. |
| V3 Session Management | no | No user sessions in a CI/CD + docs phase. |
| V4 Access Control | partial | Workflow `permissions:` least-privilege: top-level `contents: read`; publish job upgrades to `contents: write` (+ `pull-requests: write` only if needed). The App is installed with the minimum permissions (`contents: write` + `pull-requests: write` + `metadata: read`). Master's ruleset (PR + status-checks + signed-commits) IS the access-control mechanism for the protected branch; the App's bypass-list entry is a deliberate, audited exception. |
| V5 Input Validation | no | No user input. (The asset-audit `jq` step validates the manifest, but that's a build-integrity check, not input validation.) |
| V6 Cryptography | partial | Commit-signature verification: GitHub auto-signs commits made via the Contents API with an installation token (verified badge) — the design uses this implicitly (and the human Web-UI merge to master is also a verified commit). The App private key is the one secret that, if leaked, lets an attacker push to `release` bypassing rules — treat it like the `TFX_PAT`: never echo, never `set -x`, GitHub auto-redacts. Never hand-roll signing. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Leaked `TFX_PAT` → attacker publishes a malicious `.vsix` to the public Marketplace listing | Tampering / Elevation | Minimal scope (`Marketplace (publish)` only — can't read code/work items); 1-year lifespan + rotation; never echoed (GitHub auto-redacts); the SC #5 exercise proves a revoked PAT fails safe. |
| Leaked App private key → attacker pushes to `release` (bypassing its rules) | Tampering | Stored as an encrypted repo secret; App scoped to `contents: write` + `pull-requests: write` on this one repo only (`owner`/`repositories` default to the current repo); token is 1-hour + auto-revoked. If suspected leaked: regenerate the App's private key in the App settings, update `APP_PRIVATE_KEY`. |
| CI re-trigger loop (App-token push to `release` re-fires `publish.yml`) → Marketplace version spam | Denial of Service (self-inflicted) | `[skip ci]` in the bot commit message (now load-bearing — App tokens don't have `GITHUB_TOKEN`'s anti-loop guarantee) + actor-guard `if: github.actor != ...` (extend to the App's bot slug) + concurrency `cancel-in-progress: false`. |
| Malicious PR merged to `release` → auto-publishes to Marketplace | Tampering / Elevation | `release` is reached only via a human-merged `master → release` promotion PR; master itself is PR-protected + status-checks + signed-commits; the publish job re-runs all gates (typecheck/test/build/size/asset-audit) before any Marketplace mutation. |
| Stale `release → master` back-merge PR never merged → master drifts behind, future promotions confused | Repudiation / integrity drift | Documented runbook ("merge the back-merge PR promptly"); `bump-version.mjs` max-wins + `## Drift reconciled` annotation surfaces divergence; the partial-failure recovery runbook handles the worst case. |
| Workflow YAML tampered to weaken gates / change the publish token | Tampering | (Optional, not in scope) CODEOWNERS-pin `publish.yml` so changes need review — research/PITFALLS.md #5/#7 suggest this; not a Phase 8 requirement but worth a one-line OPERATIONS.md note. |

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md is mostly about the *application* tech stack (React 18, `azure-devops-ui`, webpack, vitest, `tfx-cli`) — none of which changes in Phase 8 (no app code). The directives relevant to this phase:

- **GSD Workflow Enforcement** — "Before using Edit, Write, or other file-changing tools, start work through a GSD command." Phase 8 work happens via `/gsd-execute-phase`. (This research file is being written by the researcher agent, which is part of the GSD flow.)
- **Testing: "Manual QA does UI testing per company standard; only formula logic is unit-tested."** — Phase 8 has no formula logic and no UI; `nyquist_validation: false` in config (Validation Architecture section omitted). The "tests" for this phase are the re-verification run + the SC #5 exercise (live behavior verification, not unit tests). The existing 400/400 vitest suite still runs as a gate in `publish.yml` — unchanged.
- **`tfx-cli` pinned at `0.23.1`** — unchanged; no bump in scope.
- **Bundle ≤ 250 KB gzipped** — unchanged; the `check:size` gate still runs in `publish.yml`. Current 148.4 KB.
- **No org-specific assumptions in code** — N/A (no code changes); but note `OPERATIONS.md` will reference the specific publisher name `TsezariMshvenieradzeTfsAiReviewTask` and the repo `tsmshvenieradze/StoryPointExtension` — that's fine for an internal ops doc (it's `.planning/`, not shipped).
- **Conventions / Architecture sections of CLAUDE.md are still "not yet established"** — no constraints to honor there.

No CLAUDE.md directive conflicts with anything in this research or in CONTEXT.md's locked decisions.

---

## Sources

### Primary (HIGH confidence)
- `github.com/actions/create-github-app-token` (README + Marketplace listing) — inputs (`app-id`/`client-id`, `private-key`, `owner`, `repositories`, `enterprise`, `permission-<name>`, `skip-token-revoke`, `github-api-url`), outputs (`token`, `app-slug`), 1-hour token expiry, permissions capped by installation, usage example — fetched 2026-05-11
- `github.com/peter-evans/create-pull-request` (README) — `token` input (default `GITHUB_TOKEN`; MUST override to trigger downstream workflows), `contents: write` + `pull-requests: write` requirement, key inputs (`base`, `branch`, `title`, `body`, `commit-message`), v8 current — fetched 2026-05-11
- `github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners` — Node 24 forced default 2026-06-02, Node 20 removed 2026-09-16, affected actions — fetched 2026-05-11
- `.planning/research/STACK.md` (commit `fbc728a`) — action pins (`checkout@v5`, `setup-node@v4`, `upload-artifact@v4`, `git-auto-commit-action@v6`), `tfx-cli@0.23.1`, `TFX_PAT` scope `Marketplace (publish)`, "all accessible orgs", 1-year lifespan, `GITHUB_TOKEN` anti-loop, `[skip ci]` semantics, the "if branch protection lands → GitHub App / RELEASE_PAT" escalation playbook
- `.planning/research/SUMMARY.md` — Option B state-flow, loop-guard triple-defense, the GitHub-App-for-commit-back escalation note
- `.planning/research/PITFALLS.md` — Pitfall 1 (re-trigger loop), 2 (version drift), 3 (concurrent merges), 5 (tfx flag traps — verified green by run #25641329824), 7 (`GITHUB_TOKEN` no-trigger + `[skip ci]`), 11 (Option B), 14 (idempotent tag)
- `.planning/phases/07-bump-publish-tag/07-VERIFICATION.md` — the v1.0.8 publish run #25641329824, the `GH013` ruleset rejection, the recovery log, the "Phase 6 probe checked legacy not rulesets" critical finding
- `.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md` — the probe artifact whose legacy-only check missed the master ruleset
- `.github/workflows/publish.yml`, `.github/workflows/ci.yml`, `scripts/publish-cezari.cjs`, `scripts/bump-version.mjs`, `package.json`, `vss-extension.json` — read directly (the live code being modified / referenced)

### Secondary (MEDIUM confidence)
- `docs.github.com/.../managing-rulesets/creating-rulesets-for-a-repository` + `.../about-rulesets` — bypass list eligibility ("Repository admins, org owners, enterprise owners; the maintain/write role; teams excluding secret teams; GitHub Apps; Dependabot"), bypass modes ("Always allow" vs "For pull requests only") — fetched 2026-05-11; **does NOT explicitly enumerate which rules a bypass-listed App bypasses** (Open Questions Q1)
- `github.com/orgs/community/discussions/136531` ("Why can't my github app bypass branch protection") — the "mint the token before checkout, pass it to checkout's `token:` explicitly" gotcha; legacy-vs-rulesets bypass nuance
- `github.com/orgs/community/discussions/13836`, `#43460`, `#86534` — confirm the integrated `github-actions[bot]` can't be added to a ruleset bypass list; mixed reports on bypass-vs-status-checks edge cases
- `github.com/stefanzweifel/git-auto-commit-action` README — `token` input, `[skip ci]` handling, clean-tree-skip (cross-referenced with research/STACK.md)
- Microsoft Learn "Publish from the command line" (via research/STACK.md citation) — `Marketplace (publish)` scope, "All accessible organizations"
- vsixcookbook / community results — say `Marketplace (Manage)` scope (CONFLICTS with the above — Open Questions Q2)

### Tertiary (LOW confidence — flagged)
- The exact `aex.dev.azure.com` PAT-creation UI labels — the PAT is actually created at `dev.azure.com/<org>/_usersSettings/tokens`; `aex.dev.azure.com` is the Marketplace publisher-management alias. The runbook should say "sign in to dev.azure.com → User settings → Personal access tokens" with the Marketplace publisher account. (MEDIUM — the flow is well-established but the precise menu wording may have shifted.)

---

## Metadata

**Confidence breakdown:**
- Project state / existing publish chain: HIGH — read all the live files + the Phase 7 verification artifact + research artifacts.
- New action mechanics (`create-github-app-token`, `peter-evans/create-pull-request`, `git-auto-commit-action` token input): HIGH — fetched the READMEs; cross-checked with community gotchas.
- Ruleset bypass-list rule-by-rule coverage (A1): MEDIUM-HIGH — GitHub docs confirm Apps can be on the bypass list and that bypass "bypasses the rules," but don't enumerate per-rule; CONTEXT D-3 asserts full coverage; the chosen design is robust to A1 being wrong.
- Marketplace PAT scope (A2): MEDIUM — research says `Marketplace (publish)`; a conflicting source says `Manage`; the live PAT works with whatever it has.
- Cleanup mechanics (CLEAN-01/02/03): HIGH — straightforward `git mv` + `package.json` edit + `git grep`; the gotchas (capture-before-archive, check both string forms) are documented.
- Node 24 deprecation timeline: HIGH — fetched the GitHub changelog; out of scope per CONTEXT regardless.

**Research date:** 2026-05-11
**Valid until:** ~2026-06-11 for the GitHub Actions / ruleset mechanics (stable but the create-github-app-token major could roll; the Node 24 deadline is 2026-06-02 — re-check if Phase 8 slips past then). The cleanup mechanics and the project state don't expire.
