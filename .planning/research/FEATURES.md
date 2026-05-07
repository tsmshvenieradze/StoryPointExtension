# Feature Research — v1.1 Auto-Publish CI/CD

**Domain:** GitHub Actions → Visual Studio Marketplace auto-publish for an Azure DevOps extension
**Researched:** 2026-05-05
**Confidence:** HIGH (the patterns here are well-trodden; only the bump+commit-back loop has real design freedom)
**Downstream consumer:** `gsd-roadmapper` for v1.1 phase decomposition

## Framing

The user flow is fixed and small:

```
PR merged to master
    │
    ▼
CI runs pre-flight gates (typecheck, vitest, webpack build, bundle ≤ 250 KB gzipped)
    │
    ▼
Auto-bump patch in package.json + vss-extension.json
    │
    ▼
Commit back to master with [skip ci] guard
    │
    ▼
tfx package + tfx publish to publisher TsezariMshvenieradzeTfsAiReviewTask
    │
    ▼
Push v1.0.N git tag
    │
    ▼
Done (fail-fast on errors; manual re-run; no notification surface)
```

Existing v1.0 invariants this milestone INHERITS (not re-research):
- Bundle gate already at 250 KB gzipped via `scripts/check-bundle-size.cjs` and `npm run check:size`
- Pinned dependencies (SDK 4.2.0, API 4.270.0, UI 2.272.0, tfx-cli 0.23.1) — `npm ci` is the install command
- `npm run typecheck` (`tsc --noEmit`), `npm test` (vitest run), `npm run build` (webpack production), `npm run package` (tfx extension create) are all working scripts
- Marketplace publisher `TsezariMshvenieradzeTfsAiReviewTask` is verified, public, and currently shipping v1.0.7

This research enumerates ONLY the new capabilities needed to wire those invariants up to a GitHub Actions workflow that runs on push to master.

## Feature Landscape

### Table Stakes — Must Be in the First Auto-Publish Milestone

These are the minimum-viable set. Every one is required for the user flow to function. Removing any one breaks the loop.

#### 1. Trigger & Concurrency

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Workflow trigger: `push` to `master`** | The user flow is "PR merged → ship". Use `on: push: branches: [master]`, NOT `on: pull_request` (a PR run can't push back to master). | LOW | One-line YAML. |
| **Path filter to skip non-code commits** | `paths-ignore: ['**.md', '.planning/**', '.claude/**', 'docs/**']`. Avoids burning CI minutes (and worse, publishing a new patch) when only a README or planning doc changes. | LOW | Tradeoff: a code change bundled with a doc change still publishes — that's correct. Path-ignore only fires when the commit touches *only* ignored files. |
| **Concurrency group with sequential queue** | `concurrency: { group: publish-master, cancel-in-progress: false }`. Two PRs merged 30s apart MUST publish in order, not race the manifest commit-back. With `cancel-in-progress: false`, run B waits for run A to finish. **Known GitHub limitation:** if run A is in-progress and runs B, C, D queue, only the latest queued run survives — B and C are cancelled by D. For "small first auto-publish" this is acceptable: we accept losing intermediate publishes if 3+ PRs merge faster than CI runs (~5 min). Document this as a known limitation, not a bug. | LOW | Critical correctness control. Without this, two near-simultaneous merges can both compute "next patch = N+1" and one will fail with version-conflict. |
| **Manual `workflow_dispatch` trigger** | Lets you re-run the workflow from the Actions tab without making a no-op commit. Required for "fail-fast → fix root cause → re-run" without trash commits. | LOW | Single line under `on:`. |

**Dependencies on v1.0:** None. This is a new file (`.github/workflows/publish.yml`).

---

#### 2. Pre-flight Gates

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Sequential gates in one job** (typecheck → test → build → bundle gate) | All four gates run on the same checkout, share `node_modules` from one `npm ci`, and share the `dist/` from one `webpack` build. Splitting into 4 parallel jobs would force 4× `npm ci` (~30–60s each on a clean runner) and 2× webpack builds (since the bundle gate needs `dist/`). For a project with a 5–10 minute end-to-end target, 4 sequential steps in 1 job beats 4 parallel jobs in 4 runners. | LOW | **Recommended order:** `npm ci` → `npm run typecheck` → `npm test` → `npm run build` → `npm run check:size`. Fail-fast: any non-zero exit aborts the workflow. |
| **Node version pin via `actions/setup-node@v4`** | `engines.node = ">=20.10.0"` in `package.json`. Pin to Node 20 LTS on the runner. Without explicit setup-node, you inherit whatever the GitHub-hosted runner ships, which drifts. | LOW | One step. |
| **`npm ci` cache via `actions/setup-node` `cache: npm`** | Cuts cold-install from ~45s to ~10s on warm cache. Free with setup-node. | LOW | Single line. |
| **Bundle gate runs the existing v1.0 script** | `scripts/check-bundle-size.cjs` already exists and exits non-zero above 250 KB gzipped. Don't reinvent. | LOW | Reuses v1.0 work. |

**Dependencies on v1.0:** Reuses `package.json` scripts (`typecheck`, `test`, `build`, `check:size`) and `scripts/check-bundle-size.cjs` as-is.

**Why one job, not parallel jobs:** The user explicitly said "small first auto-publish". Parallel jobs are an optimization for sub-3-minute feedback loops on large repos, not a correctness feature. With ~398 unit tests and a ~5s webpack build, sequential is fine and saves runner minutes.

---

#### 3. Version Bump

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Bump patch in BOTH `package.json` and `vss-extension.json`** | The two files duplicate the version number (currently both `1.0.7`). Marketplace truth lives in `vss-extension.json`; npm/dev tooling reads `package.json`. They must move together or `npm version` and `tfx --rev-version` will desync. | MEDIUM | Implementation: a small bump script (`scripts/bump-patch.cjs`) that reads `package.json.version`, increments patch, writes both files. ~30 lines. **Do NOT use `tfx --rev-version`** in this flow — it auto-bumps `vss-extension.json` only and is timed AT publish, not before commit-back. Decoupling bump-then-commit-back from publish gives us a clean rollback if publish fails (the bump commit is already on master either way; the next run uses the new floor). |
| **Bump source = manifest version, not git tags or Marketplace API** | Both alternatives are more complex without payoff. (a) Git-tag truth: requires every commit-back to also push a tag before publish, creating an ordering trap (tag-without-publish if publish fails). (b) Marketplace-API truth: requires a separate authenticated GET to `https://marketplace.visualstudio.com/_apis/gallery/publishers/.../extensions/.../` per run, adds a new failure mode (Marketplace 5xx during read), and the manifest version ≥ marketplace version is already enforced by `tfx publish` itself (it returns "Version number must increase"). | LOW | The manifest is the single source of truth. CI reads `vss-extension.json.version`, increments patch, writes back. |
| **Commit-back uses `[skip ci]` in commit message** | GitHub Actions natively recognizes `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]` in the commit subject or body and skips push/PR workflows. This is the most-supported and lowest-friction loop guard. | LOW | Commit message: `chore(release): v1.0.N [skip ci]`. |
| **Defense-in-depth: workflow-level guard against bot-author** | Even with `[skip ci]`, add `if: github.actor != 'github-actions[bot]'` (or whatever committer name is configured) at the job level. Belt-and-suspenders: if someone copy-pastes the commit message without the marker, or GitHub changes parsing, the actor check still fires. | LOW | One conditional. |
| **Use `GITHUB_TOKEN` for the commit-back, NOT a PAT** | `GITHUB_TOKEN` cannot trigger downstream `push` or `pull_request` workflows by design (this is an explicit GitHub anti-loop guarantee). A PAT can. Using `GITHUB_TOKEN` makes `[skip ci]` and the actor guard belt-and-third-suspenders, not the only defense. | LOW | Default in `actions/checkout@v4`. Only override if you hit a permission you actually need. |
| **Workflow permissions: `contents: write`** | Required for `GITHUB_TOKEN` to push the bump commit and the tag back to master. Default for `GITHUB_TOKEN` is read-only as of 2023. | LOW | `permissions: { contents: write }` at workflow root. |

**Dependencies on v1.0:** Modifies `package.json` and `vss-extension.json` (both touched in v1.0). Requires a new `scripts/bump-patch.cjs` (small).

**Why NOT `tfx --rev-version`:** It only edits `vss-extension.json`, not `package.json`. It runs at publish time, so if publish fails AFTER the rev, you have a manifest with an unpublished version number that you then need to either commit (orphan version) or revert. Keeping bump as a separate, idempotent step before publish is cleaner. Our existing `scripts/publish-cezari.cjs` already explicitly notes "No auto-version-bump retry loop — if you hit Version number must increase, edit vss-extension.json, commit the bump, and re-run" — same philosophy: explicit, single-purpose steps.

**Concurrency model — answering the "two PRs merge back-to-back" question:** With `concurrency: { group: publish-master, cancel-in-progress: false }`:
- PR A merges → run A starts, reads version 1.0.7, computes 1.0.8, gates pass, commits `1.0.8` + `[skip ci]`, publishes, tags.
- PR B merges 30s later → run B is queued (run A has the lock).
- Run A finishes → run B starts. Run B's checkout is ALWAYS at the latest master tip BECAUSE GitHub Actions checks out at workflow start, not at trigger time. Run B reads version 1.0.8 (run A's commit), computes 1.0.9, ships 1.0.9.
- The `[skip ci]` commit from run A does NOT trigger run B (skip-ci suppresses it); run B was triggered by the original PR B merge push and is still in queue.

This is correct behavior. The only concurrency hazard is if 3+ PRs merge in <5 minutes: GitHub queues only one pending run, so PRs C, D, E… get folded into the latest queued run. With `cancel-in-progress: false`, the latest queued run still picks up the latest master tip including all merged PRs — so all CODE ships, just under one version bump. Document this as expected.

---

#### 4. Publish

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **`tfx extension publish` invocation** | Microsoft's only `.vsix` packager and publisher. We already use `tfx-cli@0.23.1` locally. | LOW | Args: `tfx extension publish --manifest-globs vss-extension.json --no-wait-validation --token $TFX_PAT`. The `--no-wait-validation` is what `scripts/publish-cezari.cjs` already uses — fail-fast philosophy. **Do NOT pass `--rev-version`** (we already bumped). **Do NOT pass `--share-with`** (this is a public publish, not a private share to `cezari`). |
| **PAT stored as GitHub Actions secret `MARKETPLACE_PAT`** | Marketplace publish requires a PAT with `vso.gallery_publish` scope (Marketplace user PAT, NOT an Azure DevOps org PAT — different surface). Store as encrypted secret. | LOW | One-time setup: PAT generated at `https://aex.dev.azure.com/me?mkt=en-US` → `User settings` → `Personal access tokens` → scope `Marketplace: Publish`. Document the rotation procedure separately (see PITFALLS.md). |
| **Use `tfx-cli` from `npm ci`-installed `node_modules/.bin`** | We already pin `tfx-cli@0.23.1` in `devDependencies`. Don't `npm install -g tfx-cli` in the workflow (drifts from local). Don't use the `microsoft/tfs-cli` GitHub Action wrapper (extra moving piece, less control). | LOW | Use `npx tfx ...` — same as `scripts/publish-cezari.cjs`. |
| **Fail-fast: no retry, no auto-rollback** | If publish fails (PAT expired, Marketplace 5xx, manifest validation), the workflow exits non-zero. The bump commit is already on master at that point. Next manual re-run via `workflow_dispatch` will use the bumped version, find Marketplace at version 1.0.7 (still), and either succeed or fail cleanly. **Counter-argument and rebuttal:** "What if publish failed because the PAT is bad? Won't every retry fail too?" — Yes, and that's correct: human notices the red status badge, rotates the PAT, re-runs. No retry loop hides the failure. Aligns with the v1.0 publish script's stated philosophy. | LOW | No retry block. |

**Dependencies on v1.0:** Reuses `tfx-cli@0.23.1`, the `vss-extension.json` manifest, and the `--no-wait-validation` ergonomic from `scripts/publish-cezari.cjs`.

**Note on `tfx extension create` vs combined `publish`:** `tfx extension publish` internally packages then publishes; you don't need a separate `create` step in CI. The local `npm run package` script exists for offline testing and `.vsix` artifacts; CI can skip it.

---

#### 5. Tag

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Push annotated git tag `vX.Y.Z` AFTER successful publish** | "After" is the critical word. Tag-before-publish creates an orphan tag if publish fails (`v1.0.8` tag exists on master, but Marketplace is still at v1.0.7). Tag-after means: tag's existence implies "this version is on Marketplace". | LOW | Sequence: bump → commit → publish → tag → push tag. Use annotated (`git tag -a v1.0.8 -m "Release v1.0.8"`), not lightweight. Annotated tags carry message + tagger + date and are the convention for releases. |
| **Tag points at the `[skip ci]` bump commit** | The bump commit is the canonical "this is version 1.0.8" commit. Tag the bump commit (which is HEAD on master at this point in the workflow). | LOW | Default `git tag` behavior. |

**Dependencies on v1.0:** None. Adds first programmatic git tag.

**What if publish succeeds but tag-push fails?** Network blip on the tag push step. The Marketplace has 1.0.8, the bump commit is on master, but no tag. Two options:
- **Option A (recommended):** Workflow exits non-zero. Operator manually tags via `git tag -a v1.0.8 <commit-sha> && git push origin v1.0.8` and moves on. Failure is loud but recoverable.
- Option B: Wrap tag-push in a retry. Adds complexity, not worth it for "small first auto-publish".

Recommend A. Document in operations runbook.

---

#### 6. Cleanup of Legacy Publish Path

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Remove `publish:cezari` and `publish:public` npm scripts** | Once the GH Action is the canonical publish path, leaving the local scripts in `package.json` invites accidental dual-publish (someone runs `npm run publish:public` locally, ships v1.0.X manually, GH Action then ships v1.0.X+1 over it). Remove both `publish:cezari` and `publish:public` scripts. Keep `npm run package` (it's the offline-test path). | LOW | One-line edit in `package.json`. Optionally archive `scripts/publish-cezari.cjs` to `scripts/.archive/` or delete outright (git history preserves it). |
| **Delete `.env.local` (manual PAT) from local dev convention** | The `.env.local` file is no longer needed once GH Action holds the PAT. Document the deprecation in CHANGELOG or PROJECT.md so future devs don't recreate it. The `.env.local` was already gitignored, so no code change required — just convention hygiene. | LOW | Doc-only. |

**Dependencies on v1.0:** Touches `package.json` (the same file the bump script edits — sequence carefully so the cleanup commit doesn't conflict with a bump commit). Recommend doing the cleanup in the SAME commit as the workflow file lands, BEFORE the first auto-publish runs.

---

### Differentiators — Defer to v1.2 (not v1.1)

These are valuable but the user said "small". Each one adds at least one new failure mode, secret, or dependency. None unlock the core flow.

| Feature | Value Proposition | Complexity | Why Defer |
|---------|-------------------|------------|-----------|
| **Conventional-commit-driven bump (semver: feat/fix/breaking)** | `feat:` → minor, `fix:` → patch, `BREAKING CHANGE:` → major. More semantically meaningful version numbers than blind patch-bump. | MEDIUM | The user EXPLICITLY chose blind patch-bump in PROJECT.md ("auto-bump patch"). Conventional commits also require commit-message linting in PRs to be reliable, which is a separate culture lift. Defer until commit hygiene is in place. |
| **CHANGELOG.md auto-generation** | Markdown file aggregating commits per release. Useful for users browsing the Marketplace listing. | MEDIUM | Tools like `auto-changelog` or `release-please` work, but they imply conventional commits AND a coordinating dance with the bump step. The Marketplace listing already shows version + publish date; an external CHANGELOG is a nice-to-have, not required for v1.1. |
| **Slack / email / Teams notification on success or failure** | Operator sees "publish failed" without checking the Actions tab. | LOW | The user explicitly said "no notification surface". GitHub already emails the repo owner on workflow failures by default — that's enough for v1.1. |
| **Marketplace listing assets sync (overview.md, screenshots)** | Edits to `overview.md` or `images/` should re-publish the listing without a code change. | LOW | Currently the manifest's `files: [...]` declaration includes `overview.md` and `images/`, so a change to either WILL be packaged on next publish. The defer is about TRIGGERING a publish on docs-only commits — but our `paths-ignore` filter explicitly excludes `**.md` to avoid burning CI on doc churn. Let docs accumulate and ride the next code commit. v1.2 could add a manual `workflow_dispatch` input "republish docs only" if needed. |
| **Multi-environment gating (private → public publish)** | Stage 1: publish to a private share (`--share-with cezari`) for smoke testing; Stage 2: gated promote to public. | MEDIUM | The v1.0 manual flow had this (`publish:cezari` private vs `publish:public` public). Auto-promotion adds a manual approval gate (GitHub Environments with required reviewers) and doubles the publish step. For a single-maintainer extension with 398 unit tests + bundle gate already protecting master, the marginal safety of a pre-prod stage is low. **Counter-argument:** "What if a bad publish reaches users?" — Rebuttal: the v1.0 manual path doesn't have this gate either, and `--no-wait-validation` skips Marketplace's own validation, so the existing safety posture is "ship to public, watch for crash reports". v1.1 maintains parity. v1.2 can layer this in. |
| **Rollback workflow** | Manual `workflow_dispatch` to un-publish or roll back to a previous version. | HIGH | Marketplace doesn't support "un-publish" — once a version is up, only newer versions can supersede it. The "rollback" UX is "publish v1.0.N+1 with v1.0.N-1's code". This is a multi-step manual operation, not a workflow. Document the procedure as a runbook entry; don't automate. |
| **Auto-retry on transient Marketplace 5xx** | Retry publish 1–2 times before failing. | MEDIUM | Adds complexity, masks real failures (PAT expired returns 401 not 5xx, but a 503 retry could mask a backend incident). Fail-fast is the chosen philosophy. v1.2 could add a single-retry-with-jitter if real-world data shows >0.5% transient failure rate. |
| **Marketplace category / tags edits gating** | Workflow that lets PRs change `categories` / `tags` in the manifest without a code change. | LOW | Already covered: any change to `vss-extension.json` triggers the workflow because it's not in `paths-ignore`. No new feature needed. |
| **Bundle size trend reporting** | Comment on PR with bundle size delta vs master. | LOW | Tools like `compressed-size-action` exist. Genuinely useful for catching size regressions in PRs. But this is a PR-time CHECK feature, not a publish feature — belongs in a separate `pr.yml` workflow that v1.2+ can add. |

---

### Anti-Features — Explicitly Out of Scope, Document in REQUIREMENTS.md

These features SOUND useful but are wrong for this extension. Documenting them as anti-features prevents scope creep AND catches the question "did you forget?".

| Feature | Why Requested | Why NOT in v1.1 (or any version of this extension) | Alternative |
|---------|---------------|----------------------------------------------------|-------------|
| **GitHub Releases auto-creation** | "Tag implies release". GitHub Releases are nice for users browsing the repo. | The Marketplace listing IS the user-facing release surface for an ADO extension. A duplicate GitHub Release is busywork that drifts (release notes in two places). The v1.0 milestone has already established that releases are tracked in `.planning/MILESTONES.md`. | If a release surface for repo-watchers is wanted later, generate it FROM the git tag in v1.2+, don't make it a publish-time gate. |
| **Auto-merge of Dependabot PRs into the publish flow** | "Security updates ship without human review". | Single-maintainer extension; the maintainer reviews every PR. Auto-merging Dependabot would let a transitive-dep change ship to Marketplace without a human eyeballing it. The 398 unit tests + bundle gate are safety nets, not a substitute for a human glance. | Dependabot PRs go through the normal PR flow → human merges → auto-publish ships. |
| **Codecov / coverage upload** | "We have 100% coverage on calc + audit, show it off". | Coverage already gates locally and in CI via `vitest`'s built-in threshold. An external Codecov badge adds a third-party dependency, a token, a webhook surface, and the v1.0 milestone audit didn't flag missing coverage reporting as a gap. Pure busywork. | The 100% gate already fails the build below threshold. That IS the report. |
| **Lint step (eslint / prettier)** | "Standard JS workflows have a lint step". | The v1.0 milestone shipped without ESLint or Prettier. Adding them in v1.1 is a SEPARATE concern (formatting/correctness rules) that has nothing to do with auto-publish. | If lint debt is real, do it in a v1.2 quality milestone, not here. |
| **End-to-end / Playwright tests against a live ADO org** | "Test the modal in a real ADO instance before publishing". | Out of scope per CLAUDE.md ("Manual QA does UI testing per company standard; only formula logic is unit-tested"). E2E against ADO requires test orgs, identity provisioning, fixtures — a multi-week investment for an extension whose UI surface is one modal. | Cezari's manual QA pass after each publish is the safety net. |
| **Bundle visualizer / source-map upload** | "Help diagnose bundle size regressions". | Bundle size already gated at 250 KB; current 147.9 KB; 102.1 KB headroom. Source-map upload to Sentry-style services implies a runtime error tracking setup that doesn't exist. | If a regression hits the gate, run `webpack-bundle-analyzer` locally. |
| **Auto-bump major or minor based on commits** | "Some commits are features, some are fixes". | Conflicts with the chosen "patch-only" model. Major/minor bumps in this extension are roadmap-driven (a milestone closes, manually edit version to 1.1.0 or 2.0.0). Auto-major-bump on a stray `BREAKING CHANGE:` footer would surprise users. | Manual edit of `version` field at milestone-close time. v1.0 → v1.1 was already a manual step (planned, not yet done). |
| **Pinning runner OS to a SHA** | "Reproducible builds". | `ubuntu-latest` is fine for a node/webpack/tfx flow. Pinning runner SHAs is overhead that pays off only for compliance-bound projects (FedRAMP-style). Not us. | Use `runs-on: ubuntu-latest`. |
| **Renovate config** | "Renovate is more powerful than Dependabot". | The v1.0 milestone hasn't enabled Dependabot yet. Adding Renovate skips a step. Use the simplest tool that works. | Optionally enable Dependabot via `.github/dependabot.yml` in a future quality milestone. |
| **Marketplace screenshot regeneration** | "Light + dark screenshots are still missing per v1.0 carry-over PKG-05." | This is a v1.0.1+ carry-over (manual screenshot capture) not a CI/CD problem. Once screenshots exist as files in `images/`, the existing manifest will publish them automatically. | Capture screenshots manually, commit, next auto-publish ships them. |
| **Pre-fill APPLY-03 fix** | Listed in PROJECT.md "Next Milestone Goals". | This is a v1.0 carry-over feature fix, not auto-publish CI/CD. Different milestone. | Track separately; do not entangle with v1.1 scope. |

---

## Feature Dependencies

```
[Trigger & concurrency block]
    └── enables ──> [Pre-flight gates]
                          └── enables ──> [Bump]
                                              └── enables ──> [Commit-back with [skip ci]]
                                                                    └── enables ──> [Publish]
                                                                                        └── enables ──> [Tag]

[Cleanup of legacy publish:cezari script] ──> independent of pipeline; do BEFORE first auto-publish

[v1.0 invariants]:
   ├── package.json scripts (typecheck/test/build/check:size) ────> consumed by Pre-flight gates
   ├── tfx-cli@0.23.1 dev-dep                                  ────> consumed by Publish
   ├── vss-extension.json manifest                              ────> consumed by Bump + Publish
   └── 250 KB bundle gate (scripts/check-bundle-size.cjs)       ────> consumed by Pre-flight gates
```

### Dependency Notes

- **Bump must precede commit-back must precede publish must precede tag.** This is a strict linear chain inside one workflow. No parallelism.
- **Pre-flight gates must precede bump.** A failed pre-flight aborts BEFORE we mutate `package.json` / `vss-extension.json`. This means a failed test never produces a version bump commit on master — failure leaves master clean.
- **Cleanup of legacy `publish:cezari` is independent and should land FIRST.** Doing it in the same PR/commit as the workflow file landing prevents a confused "two publish paths" window. Recommend: PR 1 = workflow file + `package.json` cleanup; first run of the workflow ships the patch that removes the script.
- **v1.0 invariants are unchanged.** The auto-publish workflow is a new layer on top of v1.0's existing gates and tooling — it doesn't modify any v1.0 production code path.

---

## MVP Definition

### v1.1 MUST SHIP (table stakes; ALL of these or the user flow is broken)

- [ ] `.github/workflows/publish.yml` workflow file
- [ ] Workflow triggers: `push` to `master` + `workflow_dispatch`
- [ ] Path-ignore filter for `**.md`, `.planning/**`, `.claude/**`
- [ ] Concurrency group `publish-master` with `cancel-in-progress: false`
- [ ] Single-job sequential gates: `npm ci` → `typecheck` → `test` → `build` → `check:size`
- [ ] `actions/setup-node@v4` with Node 20 + npm cache
- [ ] `scripts/bump-patch.cjs` that increments patch in BOTH `package.json` and `vss-extension.json`
- [ ] Commit-back with message `chore(release): v1.0.N [skip ci]` using `GITHUB_TOKEN`
- [ ] Workflow `permissions: { contents: write }`
- [ ] Defense-in-depth `if: github.actor != 'github-actions[bot]'` job-level guard
- [ ] `tfx extension publish` invocation using `MARKETPLACE_PAT` secret + `--no-wait-validation`
- [ ] Annotated tag `vX.Y.Z` pushed AFTER successful publish
- [ ] `package.json` cleanup: remove `publish:cezari` and `publish:public` scripts
- [ ] Operations runbook section in `PROJECT.md` or a new `OPERATIONS.md`: PAT rotation, manual rollback procedure, what to do when publish fails

### v1.2 ADD AFTER VALIDATION (differentiators; defer until v1.1 has shipped 5+ patches successfully)

- [ ] Conventional-commit-driven semver (or stay on patch-only — make this an explicit decision)
- [ ] CHANGELOG.md auto-generation
- [ ] Bundle size trend reporting on PRs
- [ ] PR-time CI workflow (`pr.yml`) running same gates on every PR (not just master push)
- [ ] Multi-environment gating (private → public stage)

### Future Consideration (v2+; only if real-world signal demands them)

- [ ] Slack / Teams notifications (only if email-on-failure proves insufficient)
- [ ] Marketplace category / tags PR workflow (only if listing metadata churns)
- [ ] Auto-retry on transient 5xx (only if data shows >0.5% transient failure rate)
- [ ] Rollback automation (almost certainly never — Marketplace doesn't support un-publish)

---

## Failure Modes — Comprehensive Surface (Inform PITFALLS.md)

Each row maps to a "what does the operator see and do" runbook entry.

| Failure | Where it surfaces | What to do |
|---------|-------------------|------------|
| **Type error in TypeScript** | `npm run typecheck` step exits non-zero | Fix in PR; this should never reach master because PR review catches it (or v1.2's PR-time workflow does). |
| **Test failure** | `npm test` step exits non-zero | Same as above. |
| **Webpack build failure** | `npm run build` step exits non-zero | Same as above. |
| **Bundle exceeds 250 KB gzipped** | `npm run check:size` exits non-zero | Investigate: dependency added unintentionally? webpack tree-shaking broken? Run `webpack-bundle-analyzer` locally. Fix in a follow-up PR. |
| **Bump script crashes (malformed JSON in manifest)** | `node scripts/bump-patch.cjs` exits non-zero, no commit happens | Inspect, fix manifest, re-run via `workflow_dispatch`. |
| **`git push` of bump commit fails (branch protection denies bot)** | Push step exits non-zero, bump is local to the runner only | Configure branch protection to allow `github-actions[bot]` to push, or use a GitHub App token. Document the exact protection rules in OPERATIONS.md. |
| **Marketplace PAT expired or invalid** | `tfx extension publish` exits with 401/403 | Rotate PAT at aex.dev.azure.com → User settings → Personal access tokens. Update `MARKETPLACE_PAT` secret in repo settings. Re-run via `workflow_dispatch`. |
| **Marketplace 5xx (transient)** | `tfx extension publish` exits non-zero | Re-run via `workflow_dispatch`. If persistent, check Marketplace status. |
| **Manifest validation failure** (malformed `vss-extension.json` schema) | `tfx extension publish` validation step fails before upload | Fix manifest syntax in a follow-up PR. The bump commit on master with the broken manifest is a poison pill — next run will also fail until manifest is fixed. |
| **Version conflict** ("Version number must increase") | `tfx extension publish` exits non-zero | Should not happen with correct bump logic. If it does, manually edit `vss-extension.json` to a higher version, commit with `[skip ci]`, re-run. Investigate why bump script produced a stale version (concurrency bug?). |
| **Publish succeeds but tag-push fails** | Tag step exits non-zero, but Marketplace already has the new version | Manually push the tag: `git tag -a v1.0.N <bump-commit-sha> -m "Release v1.0.N" && git push origin v1.0.N`. Document in OPERATIONS.md. |
| **Two PRs merged in <30s, second sees stale version** | Should not happen with `concurrency: { cancel-in-progress: false }`. If it does, investigate concurrency config. | First-aid: manually bump `vss-extension.json` past the conflict, commit `[skip ci]`, re-run. |
| **3+ PRs merged faster than CI runs (~5 min)** | GitHub queues only the latest pending run; intermediate runs cancelled | Expected behavior. All CODE ships in the latest run; only intermediate VERSIONS are skipped. Communicate to team: "patches roll up under load". |

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| `[skip ci]` is natively recognized by GitHub Actions | [GitHub Changelog 2021-02-08](https://github.blog/changelog/2021-02-08-github-actions-skip-pull-request-and-push-workflows-with-skip-ci/) — official feature announcement | HIGH |
| `GITHUB_TOKEN` cannot trigger downstream workflows | [GitHub Docs — Triggering workflows from a workflow](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow) | HIGH |
| Concurrency: `cancel-in-progress: false` queues at most one pending run; later runs cancel earlier pending | [GitHub Community Discussion #63136](https://github.com/orgs/community/discussions/63136), [GitHub Docs — Concurrency](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs) | HIGH |
| `tfx --rev-version` only updates manifest, not `package.json` | [Microsoft tfs-cli Issue #255](https://github.com/Microsoft/tfs-cli/issues/255) (post-fix), [tfs-cli docs/extensions.md](https://github.com/microsoft/tfs-cli/blob/master/docs/extensions.md) | HIGH |
| `tfx-cli` package itself | [npm tfx-cli](https://www.npmjs.com/package/tfx-cli) | HIGH |
| Marketplace publish PAT scope is `vso.gallery_publish` | [Microsoft Learn — Publish from CLI](https://learn.microsoft.com/en-us/azure/devops/extend/publish/command-line?view=azure-devops) | HIGH |
| `paths-ignore` only suppresses runs when ALL paths in commit match | [GitHub Docs — Workflow syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions) | HIGH |
| v1.0 invariants (bundle gate, scripts, dependencies, manifest version) | Local repo (`package.json`, `vss-extension.json`, `scripts/check-bundle-size.cjs`, `scripts/publish-cezari.cjs`, `.planning/PROJECT.md`, `.planning/MILESTONES.md`) | HIGH |
| Branch protection + bot-author push patterns | [Avoid workflow loops on protected branch — Shounak Mulay](https://blog.shounakmulay.dev/avoid-workflow-loops-on-github-actions-when-committing-to-a-protected-branch), [Letting GitHub Actions Push to Protected Branches — Medium](https://medium.com/ninjaneers/letting-github-actions-push-to-protected-branches-a-how-to-57096876850d) | MEDIUM |

---

## Summary for Roadmapper

**Recommended phase decomposition (3 phases):**

1. **Phase 1: Foundation** — workflow file skeleton, pre-flight gates, dry-run mode (skip publish step). Verify gates work on a test PR. Land as a non-publishing workflow first.
2. **Phase 2: Bump + Publish + Tag** — add bump script, commit-back with `[skip ci]`, `tfx publish`, tag push. First end-to-end publish ships v1.0.8.
3. **Phase 3: Cleanup & Documentation** — remove `publish:cezari` / `publish:public` npm scripts, write OPERATIONS.md with PAT rotation + manual rollback runbook.

Phases 1 and 2 must be sequential (can't test publish without gates passing). Phase 3 can land in parallel with Phase 2 in the same PR if desired.

**Single biggest risk to flag for the roadmapper:** the `MARKETPLACE_PAT` secret setup is a one-time human action (generate PAT in Marketplace UI, paste into GitHub repo secrets) that gates everything else. Surface it as a phase 1 prerequisite, not a phase 2 surprise.

---

*Feature research for: GitHub Actions auto-publish to Visual Studio Marketplace*
*Researched: 2026-05-05 (v1.1 milestone bootstrap)*
