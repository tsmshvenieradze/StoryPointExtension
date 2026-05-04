# Stack Research — v1.1 Auto-Publish CI/CD

**Project:** Story Point Calculator (Azure DevOps Extension)
**Milestone:** v1.1 — GitHub Actions auto-publish to Visual Studio Marketplace
**Researched:** 2026-05-04
**Overall confidence:** HIGH (versions verified live against npm registry and GitHub releases API on the research date)

---

## Verification Gap (Read First)

Two independent confidence dimensions for every package/action below:

- **Choice** — how sure I am we should use this package/action at all for this milestone
- **Version** — how sure I am the pinned floor is current as of 2026-05-04 (today)

All major-version pins below were verified live via:
- `npm view <pkg> version` and `npm view <pkg> time --json` against the public npm registry
- `https://api.github.com/repos/<owner>/<action>/releases?per_page=8` (GitHub Releases API)

so Version confidence is HIGH for the floors stated. SemVer minor/patch above the floor is expected to be safe per each action's compat policy.

**Cross-cutting decision (binds the rest of this doc):**
- We are NOT introducing Microsoft Entra-backed publishing (workload identity / OIDC) in v1.1 — that path requires a federated service connection and is documented for Azure Pipelines, not GH Actions. v1.1 uses a **Marketplace-scoped PAT**. Microsoft confirmed (2025–2026 blog posts) that the publishing service accepts any PAT with the `Marketplace (publish)` scope even after the *global* PAT retirement (Mar 15 → Dec 1, 2026), so this path is forward-compatible. We track Entra/OIDC as a v1.2+ candidate, not a v1.1 blocker.

---

## Recommended Stack

### A. GitHub Actions Runner & Core Actions

| Component | Version (floor) | Purpose | Choice / Version confidence |
|-----------|-----------------|---------|------|
| `ubuntu-latest` runner | (Ubuntu 24.04 as of May 2026) | Hosted runner for the publish workflow | HIGH / HIGH |
| `actions/checkout` | `v5` (`v5.0.1`) | Clone repo with credentials persisted for commit-back; supports `fetch-depth: 0` for tag visibility | HIGH / HIGH |
| `actions/setup-node` | `v4` (`v4.4.0`+) — explicitly **not** v6 in this milestone | Install Node + npm cache | HIGH / HIGH |
| `actions/cache` | (transitive — provided by `setup-node` `cache: 'npm'`) | npm dependency cache; do not add a separate `actions/cache` step | HIGH / HIGH |
| `stefanzweifel/git-auto-commit-action` | `v6` (current `v6.0.1`, June 2025) — pin major, allow minor/patch | Commit version-bump back to `master` with `[skip ci]` token in the message | HIGH / MEDIUM |

#### Why ubuntu-latest (not windows-latest)

| Criterion | ubuntu-latest | windows-latest | Verdict |
|-----------|---------------|----------------|---------|
| **tfx-cli OS coverage** | First-class (`tfx-cli` has no native Windows-only deps; `winreg` is a transitive dep but is no-op on non-Windows) | First-class but slower bootstrapping; the existing local `publish-cezari.cjs` had to add `shell: process.platform === "win32"` to work around `spawnSync` on Windows | **ubuntu-latest** |
| **CI minute cost** | 1× per minute (multiplier on private repos) | 2× per minute on private repos | **ubuntu-latest** |
| **Existing CI (`.github/workflows/ci.yml`)** | Already runs `ubuntu-latest` for typecheck/test/build/bundle-gate | — | **Same image** keeps caching consistent |
| **`azure-devops-ui` SCSS pipeline** | Confirmed working in current CI | — | **ubuntu-latest** |
| **`tfx extension publish` quirks** | None reported in 2025–2026 issues against `tfx-cli` 0.21+ | An old `0.13.0`-era issue (`#427` — `tfx not found after install`) was a Windows PATH problem; `0.23.1` ships with shebang-correct bin entries | **ubuntu-latest** (sidesteps the `spawnSync({shell})` workaround entirely) |

This repo's `scripts/publish-cezari.cjs` already had to special-case `shell: process.platform === "win32"` for `spawnSync("npx", …)`. Running publish on Linux removes that whole class of bug from the CI surface.

#### Why `actions/checkout@v5` (not v6)

- `v5.0.0` (Aug 2025) bumped the action runtime to **Node 24** and requires runner **v2.327.1+**. GitHub-hosted `ubuntu-latest` runners are well past that floor as of May 2026.
- `v6.0.0` (Nov 2025) added a `persist-credentials` separation refactor and `v6-beta`-line work; it is stable but newer. We do not need any v6-only feature in v1.1, and `git-auto-commit-action@v7` was released **after** `checkout@v5` and is documented to work with `v4`/`v5`. Pinning **v5** gives us the minimal blast radius.
- Concrete need for the Story Point Extension: `fetch-depth: 0` (so `git tag` can see prior tags and reject duplicates cleanly) and `persist-credentials: true` (default; required so `git-auto-commit-action` can push back via `GITHUB_TOKEN`).

#### Why `actions/setup-node@v4` (not v5/v6)

- `v6.0.0` (Oct 2025) introduced a **breaking change**: it limits automatic caching to npm only and changed the default behavior around `cache:` config. v6 is fine for our shape (we use `cache: 'npm'` already), **but** the breaking-change note in v6 release notes adds risk for a milestone whose only deliverable is "ship a publish workflow." We pick stability over recency.
- `v4` is still receiving security backports and works with current Node 20/22 LTS.
- Existing `.github/workflows/ci.yml` already pins `actions/setup-node@v4` with `node-version: 20` and `cache: 'npm'`. **Reuse the exact same line.** No drift between CI and Publish workflow keeps the npm cache hits maximal (cache key derives from `package-lock.json` + `runner.os` + `node-version`, so identical across both workflows means cache-warm fast paths).

If a v1.2+ milestone wants to bump to `setup-node@v6`, do it in CI first, then propagate to Publish.

#### Why `git-auto-commit-action@v6` for commit-back

- Microsoft's `microsoft/azure-devops-extension-sample` repo does **not** ship a publish workflow we can copy — extension authors roll their own. The community-standard pattern for "auto-bump a JSON field, commit back, push tag" is one of:
  1. Raw `git config user.email` + `git commit -am` + `git push` shell — works with `GITHUB_TOKEN`, requires manual auth fiddling.
  2. `stefanzweifel/git-auto-commit-action` — wraps (1) with sensible defaults: bot identity, commit-message templating, `commit_options`, optional tagging.
  3. `EndBug/add-and-commit` — same shape as (2), slightly less popular, similar maintenance velocity.

- We pick (2) because:
  - `v7.1.0` (Dec 2025) is current; `v6.0.1` (Jun 2025) is the last stable v6 — both maintained. We pin **v6** rather than v7 because v7 bumped its action runtime to Node 24 and tightened its `actions/checkout` dep to v5 — fine for us, but pin-to-v7 narrows our checkout flexibility. v6 still receives backports.
  - Native `[skip ci]` support: just include the literal string in `commit_message`; GitHub's runner respects it for `push:`/`pull_request:` triggers (changelog 2021-02-08), so the version-bump commit will not retrigger the workflow.
  - It will not push if the working tree is clean — idempotent, so a re-run of the publish workflow that hits the npm cache and produces no diff won't create empty commits.

If we end up wanting to drop the dependency: a 5-line shell block (`git config`, `git add`, `git commit -m "chore: bump … [skip ci]"`, `git push`) covers 100% of our use case. Documented as a fallback below.

### B. Version-Bump Tooling

| Tool | Source | Purpose | Choice / Version confidence |
|------|--------|---------|------|
| `npm version patch --no-git-tag-version --allow-same-version` | Built into `npm` ≥ 6 | Bump `package.json` patch; do **not** create a git tag (we tag separately, after publish succeeds) | HIGH / HIGH |
| Inline Node script (~15 lines, in workflow `run:` block) | Stdlib `fs` + `JSON.parse`/`JSON.stringify` | Read the new patch from `package.json`, write it into `vss-extension.json`, preserving 2-space indent + trailing newline | HIGH / HIGH |
| `tfx extension publish` (without `--rev-version`) | `tfx-cli@^0.23.1` (already in devDependencies) | Publish a `.vsix` whose manifest version was bumped *before* the publish call, so the rev is committed in source control before it hits Marketplace | HIGH / HIGH |

#### Why "manual sync" not `--rev-version`

`tfx extension publish --rev-version` exists and increments the patch in `vss-extension.json` automatically. We do **not** use it because:
1. `--rev-version` only updates `vss-extension.json`, not `package.json`. We'd still need a sync step. Pre-bumping both files manually keeps a single source of truth (the Node script) and makes the commit-back diff unambiguous.
2. `--rev-version` runs on the CI runner and writes to the runner's filesystem; the next bump would race against the source-of-truth in `master` if the workflow runs concurrently or if the commit-back fails after the Marketplace POST succeeded. Pre-bump → commit → publish is a more atomic ordering: if commit-back fails, we abort *before* the Marketplace mutation. (Mirrors v1's CONTEXT.md D-01 "atomicity ordering" reasoning at the milestone-tooling layer.)
3. `--rev-version` was the source of microsoft/tfs-cli issue #262 ("yields a new extension version without revving the tasks") — it's an opinionated helper aimed at extensions with build-tasks, which we don't have, but it suggests the flag is not the canonical path for fine-grained control.

Concretely, the workflow does this in order:
1. Read current `package.json` version → compute new patch → write back. Use `npm version patch --no-git-tag-version --allow-same-version`. (`--allow-same-version` is a defensive flag; a re-run with a now-stale lockfile shouldn't error out the workflow before the diff guard.)
2. Inline Node `fs` script: read `package.json.version`, set `vss-extension.json.version` to the same string, write with `JSON.stringify(..., null, 2) + '\n'`.
3. `git-auto-commit-action` commits both files with message `chore(release): vX.Y.Z [skip ci]`.
4. `tfx extension publish --manifest-globs vss-extension.json --auth-type pat --token $TFX_PAT --no-wait-validation` (no `--rev-version`).
5. On publish success → `git tag vX.Y.Z && git push origin vX.Y.Z`.

#### Why **not** dedicated bump tooling (release-please, semantic-release, phips28/gh-action-bump-version, changesets)

| Tool | Why not |
|------|---------|
| `googleapis/release-please-action` | Driven by Conventional Commits + a release-PR workflow; opinionated about CHANGELOG.md generation; overkill for a single-package extension where bump policy is "every merge to master = patch." Adds two PRs and a bot to the workflow surface. |
| `semantic-release` | Same shape: commit-message-driven version inference. We've explicitly chosen "every push = patch" not "infer from commit type" — the milestone scope is "automate what we already do manually," not "introduce a new bump policy." |
| `phips28/gh-action-bump-version` | Parses commit messages for `#major`/`#minor` keywords. Same objection: introduces a policy decision the milestone hasn't scoped. |
| `changesets/changesets` | Designed for monorepos with multiple packages and humans deciding bump scope per change. Single-package + automated patch makes this 10× the moving parts we need. |

A 4-line `run:` block does the same job. Stay simple.

### C. Marketplace Publishing

| Component | Version (floor) | Purpose | Choice / Version confidence |
|-----------|-----------------|---------|------|
| `tfx-cli` | `0.23.1` (current latest, published 2026-01-07) — keep current pin | `tfx extension publish` to Marketplace | HIGH / HIGH |
| Node.js (CI) | `20.x` (matches existing CI; matches `tfx-cli` engines `>=20.0.0`) | Runtime for `tfx-cli` and webpack | HIGH / HIGH |
| Marketplace PAT | Personal Access Token with `Marketplace (publish)` scope, organization "All accessible organizations" | Auth credential for `tfx extension publish` | HIGH / HIGH |
| Storage | GitHub Repository Secret named `TFX_PAT` (or `MARKETPLACE_PAT`) | Token at rest | HIGH / HIGH |

#### tfx-cli install pattern in CI

The repo already has `tfx-cli@0.23.1` in `devDependencies` (locked via `package-lock.json`). The CI workflow runs `npm ci` to install all devDeps, then can invoke `tfx` via `npx tfx ...` (resolves to `node_modules/.bin/tfx`).

| Pattern | Pros | Cons | Verdict |
|---------|------|------|---------|
| **Local devDep (current) + `npx tfx`** | Version pinned in `package-lock.json`; reproducible; same as the local `scripts/publish-cezari.cjs` shape; no extra install step in CI; cached automatically by `setup-node@v4 cache: 'npm'` | Slightly more nodes_modules disk in CI | **Use this** |
| `npm install -g tfx-cli` in workflow | Familiar pattern from MS Learn docs | Bypasses the lockfile; floats to `latest`; one extra step; not cached by `setup-node` | Don't |
| `npx --yes tfx-cli@0.23.1` | Pins per-call; no devDep | Re-resolves on every run unless cached; npx cold-start adds 5–15 s; bypasses the lockfile we already maintain | Don't |
| Microsoft `TfxInstaller@5` task | Standard for Azure Pipelines | **Azure Pipelines task — not a GH Action**, doesn't apply | N/A |

The existing pattern (`tfx-cli` as a devDep, invoked through `npx tfx` after `npm ci`) is already the one used by `scripts/publish-cezari.cjs`. The publish workflow should reuse it verbatim. **No new tooling.**

#### Marketplace PAT — scopes, storage, passing

**Scope:** `Marketplace (publish)` only. Do **not** add `Marketplace (manage)` or `Marketplace (acquire)`. The publish API endpoint accepts the publish-only scope and rejects anything broader-than-needed.

**Organization:** "All accessible organizations" is required by tfx-cli per Microsoft Learn — selecting a single organization causes a 401 even with a valid PAT, because the Marketplace publishing API operates outside any organization context.

**Lifetime:** Set to the maximum allowed (1 year). Document the expiry in `.planning/REQUIREMENTS.md` so v1.x renews it before expiry. (Microsoft is retiring **global** PATs Dec 1, 2026 — but `Marketplace (publish)` PATs are explicitly carved out per the Jul 2025 "Issue with extension publishing" blog: any PAT with that scope continues to work post-retirement.)

**Storage:** GitHub repository secret. Settings → Secrets and variables → Actions → New repository secret. Name: `TFX_PAT` (matches the existing local-script env var, so the WTF surface for a developer reading both is zero). **Repository secret, not environment secret** — environment secrets add a manual approval gate which we explicitly don't want for "every push to master ships."

**Passing to tfx:** Two equivalent options:

| Option | Form | Verdict |
|--------|------|---------|
| `--token "$TFX_PAT"` CLI arg | `tfx extension publish ... --auth-type pat --token "${{ secrets.TFX_PAT }}"` | **Use this.** Matches `scripts/publish-cezari.cjs` exactly. GitHub Actions auto-redacts secret values from logs. |
| `AZURE_DEVOPS_EXT_PAT` env var | `env: { AZURE_DEVOPS_EXT_PAT: ${{ secrets.TFX_PAT }} }` | Don't — that env var is for the **Azure CLI** (`az devops ...`), not `tfx-cli`. tfx-cli reads `TFX_*` env vars but the documented `--token` flag is the canonical input. Mixing the two is a footgun. |

`--auth-type pat` is required because `tfx-cli` defaults to interactive auth otherwise; the existing local script already passes it.

### D. Commit-Back / Tag Push — GitHub-side Token

**The crux:** We need to push two things back to `master`: (a) the version-bump commit, (b) the `vX.Y.Z` git tag. Two separate questions: which token, and does it trigger our own CI?

| Operation | Token needed | GH-side scope | Triggers CI on `push: branches: [master]`? |
|-----------|--------------|---------------|--------------------------------------------|
| Commit-back of version bump | `GITHUB_TOKEN` works | `permissions: contents: write` at job level | **No** — pushes by `GITHUB_TOKEN` are deliberately suppressed from re-triggering workflows on the same repo (GitHub's documented anti-loop guard). The `[skip ci]` token in the message is **belt-and-suspenders**, not strictly needed when using `GITHUB_TOKEN`, but cheap insurance and visible in `git log` for humans. |
| Push `vX.Y.Z` tag | `GITHUB_TOKEN` works | Same `contents: write` (write includes tags) | **No** — same anti-loop guard. We don't have a `push: tags:` trigger anywhere, so this is moot, but worth noting if a future "release on tag" workflow is added. |
| If branch protection blocks bot pushes to `master` | A PAT or a GitHub App installation token with the bot in an "allowed actors to bypass" list, **or** the workflow-as-actor needs to be in the bypass list | App > more capability; PAT > simpler but tied to a human | Use App if available; PAT if not. |

**Recommended pattern (no branch protection on `master` blocking bot pushes — current state):**

```yaml
permissions:
  contents: write   # required for commit-back + tag push

# ...later in steps:
- uses: stefanzweifel/git-auto-commit-action@v6
  with:
    commit_message: "chore(release): v${{ env.NEW_VERSION }} [skip ci]"
    commit_user_name: "github-actions[bot]"
    commit_user_email: "41898282+github-actions[bot]@users.noreply.github.com"
    commit_author: "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>"
    file_pattern: "package.json package-lock.json vss-extension.json"
```

The user/email above is GitHub's documented identity for the `github-actions[bot]` actor — using it makes the commit show up as the bot in the GitHub UI, attributable, with a verified GPG signature provided by GitHub's auto-signing. (Don't use a custom email or you lose the verified-signature badge.)

**If branch protection ever lands on `master` blocking direct pushes:**
1. **Preferred:** create a GitHub App with `contents: write`, install it on this repo, store its app ID + private key as secrets, exchange for an installation token in the workflow (`tibdex/github-app-token@v2` or the official `actions/create-github-app-token@v2`), pass that token as the GITHUB_TOKEN equivalent. Add the App to the protection-rule bypass list.
2. **Fallback:** create a PAT (`contents: write` repo scope), store as `RELEASE_PAT`, pass as the action's `token:` input. Add the PAT-owning user to the protection-rule bypass list. Lower-effort, but PATs are tied to one human and the workflow loses the bypass when that human leaves.

We do **not** need this in v1.1 (no branch protection on `master` is documented in current state). Track as a v1.2 contingency.

### E. Bundle Size Gate Reuse

The existing `npm run check:size` (in `scripts/check-bundle-size.cjs`) runs after `npm run build` and asserts ≤ 250 KB gzipped. The publish workflow MUST run this gate **before** the Marketplace POST. No new tooling — copy the step verbatim from `.github/workflows/ci.yml`.

### F. Workflow-Level Concurrency

```yaml
concurrency:
  group: publish-${{ github.ref }}
  cancel-in-progress: false   # do NOT cancel an in-flight publish
```

Note `cancel-in-progress: false` — different from CI's `true`. If two pushes land 10 seconds apart, we want the first publish to finish (otherwise we'd publish v1.0.8 and abort v1.0.9, leaving an orphaned bump commit). The second run queues, sees the bump commit from the first via `[skip ci]`, and either no-ops or runs cleanly.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Runner | `ubuntu-latest` | `windows-latest` | 2× CI minutes on private repos; Windows-only `spawnSync({shell})` quirks already burned us once in `publish-cezari.cjs`; `tfx-cli` is fully supported on Linux |
| `actions/checkout` major | `v5` | `v4` | Old; runner Node 20 (vs v5's Node 24); no security backports prioritized |
| `actions/checkout` major | `v5` | `v6` | Stable but newer; no v6-only feature needed; risk surface for a single-purpose milestone |
| `actions/setup-node` major | `v4` | `v6` | v6 has a documented breaking change in cache defaults; CI already runs `v4`, drift = lower cache hits |
| Commit-back action | `git-auto-commit-action@v6` | `EndBug/add-and-commit@v9` | Equivalent feature set; less battle-tested in our exact shape; smaller community |
| Commit-back action | `git-auto-commit-action@v6` | Inline `git commit + git push` shell | Works fine, but redoes the action's identity-config + clean-tree-skip logic in 15 lines of workflow YAML for marginal control. Pick the action; document the shell fallback. |
| Bump tool | `npm version patch` + 15-line Node sync script | `googleapis/release-please-action` | Adds a release-PR workflow; introduces CHANGELOG generation we don't have a policy for; mismatched to "every merge ships" semantics |
| Bump tool | `npm version patch` | `phips28/gh-action-bump-version` | Drives bumps from commit-message keywords (`#major`, `#minor`); we want strict patch-on-merge, not a per-commit policy |
| Bump tool | `npm version patch` | `semantic-release` | Conventional-commits-driven; introduces a new bump policy the milestone hasn't scoped |
| tfx install | Local devDep + `npx tfx` | `npm install -g tfx-cli` | Bypasses lockfile; not cached by `setup-node` |
| tfx install | Local devDep + `npx tfx` | `npx --yes tfx-cli@0.23.1` | Re-resolves per call; cold-start cost; bypasses lockfile |
| tfx install | Local devDep + `npx tfx` | Microsoft `TfxInstaller@5` | Azure Pipelines task — not GH Actions; doesn't apply |
| Auth | Marketplace PAT in GH secret | Microsoft Entra workload identity / OIDC | Available for Azure Pipelines (federated service connection); GH Actions OIDC → Marketplace path is not documented as supported by tfx-cli; defer to v1.2+ |
| Auth | `--token` CLI arg | `AZURE_DEVOPS_EXT_PAT` env | That env var is for `az devops`, not `tfx-cli` |
| Tag push | Same job, after publish | Separate "release" workflow on tag | We don't act on tags; one workflow keeps the success-condition single |
| Token for commit-back | `GITHUB_TOKEN` + `permissions: contents: write` | PAT in `RELEASE_PAT` secret | PAT-owner attribution, harder to rotate, not needed without branch protection |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `actions/cache` as a separate step | `setup-node@v4` with `cache: 'npm'` already does this and is the documented path; double-caching can produce stale-cache bugs | Trust `setup-node`'s cache |
| `--rev-version` flag on `tfx extension publish` | Bumps `vss-extension.json` only, not `package.json`; runs after the publish flow has started, so commit-back-failure can't abort the Marketplace mutation | Pre-bump both files in the workflow before the publish step |
| `release-please-action` / `semantic-release` / `changesets` | Single package + "every merge = patch" policy makes these 10× the moving parts; they assume Conventional Commits or release-PR review gates we don't have | 4-line `run:` block: `npm version patch --no-git-tag-version` + Node sync script |
| `EndBug/add-and-commit`, `phips28/gh-action-bump-version` | Either the same shape as our pick (`git-auto-commit-action`) or driven by a commit-message bump policy we haven't scoped | `stefanzweifel/git-auto-commit-action@v6` (or inline shell) |
| `windows-latest` runner | 2× minute cost; `tfx-cli` Windows-`spawnSync({shell})` quirk already worked around once | `ubuntu-latest` |
| Slack / Teams / email notifications | Out-of-scope per milestone goals ("no notification surface") | GitHub's built-in workflow-failure email to the repo owner is sufficient |
| Auto-retry on publish failure | Out-of-scope per milestone goals ("fail-fast on errors with manual re-run") | The workflow fails red; humans re-run from the GH Actions UI |
| Microsoft Entra / OIDC publishing path | Documented for Azure Pipelines (federated service connection); GH Actions story is undocumented for `tfx extension publish`; would extend the v1.1 milestone scope significantly | Marketplace PAT in GH secret. Track Entra/OIDC for v1.2+ |
| `actions/checkout@v6` | No v6-only feature needed; pinning v5 narrows risk surface | `actions/checkout@v5` |
| `actions/setup-node@v6` | Breaking change in cache defaults; CI already on v4 (cache-key drift) | `actions/setup-node@v4` |
| GitHub App installation tokens / `RELEASE_PAT` | Not needed — `master` has no branch protection blocking bot pushes today | `GITHUB_TOKEN` + `permissions: contents: write` |

---

## Installation Notes

### What changes in the repo

**No new npm dependencies.** Everything required is already in `devDependencies`:
- `tfx-cli@0.23.1` ✓
- `webpack@^5.97.0` ✓
- `vitest@^2.1.0` ✓

**One new file:** `.github/workflows/publish.yml` (created in the milestone, not by this research).

**One file modified:** `package.json` — remove the `publish:cezari` script per milestone goals (`scripts/publish-cezari.cjs` itself can either be deleted or kept as a local-fallback for emergencies; that's a milestone decision, not a stack decision).

**One repo secret added** (manual, by repo owner):
1. https://github.com/tsmshvenieradze/StoryPointExtension/settings/secrets/actions → New repository secret
2. Name: `TFX_PAT`
3. Value: PAT created at https://dev.azure.com/<your-org>/_usersSettings/tokens with scope = `Marketplace (publish)` and org = "All accessible organizations"

### What changes on Azure DevOps side

Just the PAT creation. No publisher work needed (publisher `TsezariMshvenieradzeTfsAiReviewTask` is already verified and the listing is live).

### Validation gates (existing CI, reused before publish)

| Gate | Command | Source |
|------|---------|--------|
| Typecheck | `npm run typecheck` | Existing CI |
| Unit tests + 100% coverage on `src/calc/` + `src/audit/` | `npm test -- --run` | Existing CI |
| Production build | `npm run build` | Existing CI |
| Bundle size ≤ 250 KB gzipped | `npm run check:size` | Existing CI; `scripts/check-bundle-size.cjs` |

The publish workflow runs all four before any version bump or publish step. If any fails, no commit-back, no tag, no Marketplace POST.

---

## Version Compatibility

| Combination | Notes |
|-------------|-------|
| `tfx-cli@0.23.1` + Node 20.x | OK — `tfx-cli` engines `>=20.0.0`; existing CI runs Node 20 |
| `tfx-cli@0.23.1` + Node 22.x | OK in practice — npm registry shows no engines constraint above 20; but unverified for our use, so keep CI on Node 20 to match local dev (`engines.node: >=20.10.0` in `package.json`) |
| `actions/checkout@v5` + `actions/setup-node@v4` | Verified compatible (existing CI uses both shapes) |
| `actions/checkout@v5` + `git-auto-commit-action@v6` | Verified — `git-auto-commit-action@v7.0.0` release notes call out checkout v5 as compatible; v6 is older and worked with checkout v4/v5 |
| `git-auto-commit-action@v6` runtime | Node 20 internally — fine on any current GH-hosted runner |
| GitHub-hosted `ubuntu-latest` (May 2026) | Ubuntu 24.04 + Node preinstalled (overridden by `setup-node`); runner v2.327.1+ (well past `checkout@v5`'s floor) |

---

## Security Notes

- **PAT exposure in logs:** GitHub Actions auto-redacts secret values from job logs. The `--token "${{ secrets.TFX_PAT }}"` form is safe. Do not `echo` the secret. Do not `set -x` in the publish step.
- **PAT scope minimization:** `Marketplace (publish)` only. No `Marketplace (manage)`. No work-tracking scopes. The PAT cannot read code, work items, or repo data.
- **PAT rotation:** Set 1-year expiry. Document the rotation procedure in `.planning/REQUIREMENTS.md`. A v1.x patch milestone (whichever comes ~10 months out) should rotate proactively.
- **Bot identity for commits:** Use the `github-actions[bot]` identity (`41898282+github-actions[bot]@users.noreply.github.com`). Commits made by this identity get GitHub's verified-signature badge automatically — provenance + tamper evidence with zero crypto setup on our side.
- **`[skip ci]` token in commit message:** Belt-and-suspenders against an infinite CI loop. `GITHUB_TOKEN`-driven pushes already don't re-trigger workflows in the same repo, but a future migration to a PAT or App token would re-enable triggering. The `[skip ci]` token defends both today and future.
- **`master` branch protection:** Currently absent. If added, see Section D fallback (App or PAT, plus bypass list). Note explicitly in v1.1 REQUIREMENTS that adding branch protection requires re-evaluating the publish-token strategy.

---

## Sources & Confidence

| Claim | Source | Confidence |
|-------|--------|------------|
| `tfx-cli` latest is 0.23.1 (2026-01-07) | `npm view tfx-cli time --json` (live, 2026-05-04) | HIGH |
| `tfx-cli` engines `node >=20.0.0` | `npm view tfx-cli engines` (live) | HIGH |
| `actions/checkout` latest is v6.0.0 (Nov 2025); v5.0.0 (Aug 2025) is the "Node 24 / runner v2.327.1" line | GitHub Releases API live response | HIGH |
| `actions/setup-node` latest is v6.4.0 (Apr 2026); v6.0.0 (Oct 2025) introduced cache-default breaking change | GitHub Releases API live + v6.0.0 release notes | HIGH |
| `actions/cache` latest is v5.0.5 (Apr 2026) | GitHub Releases API live | HIGH |
| `stefanzweifel/git-auto-commit-action` v7.1.0 (Dec 2025); v6.0.1 stable (Jun 2025) | GitHub Releases API live + v7.0.0 changelog | HIGH |
| Marketplace PAT must use scope `Marketplace (publish)` and org "All accessible organizations" | Microsoft Learn — [Publish from the command line](https://learn.microsoft.com/en-us/azure/devops/extend/publish/command-line?view=azure-devops) | HIGH |
| Marketplace publishing accepts non-global PATs with `Marketplace (publish)` scope (post-July 2025) | Azure DevOps Blog — [Issue with extension publishing (resolved)](https://devblogs.microsoft.com/devops/publishing-extensions-to-marketplace-issue-resolved/) | HIGH |
| Global PAT retirement Mar 15 → Dec 1, 2026 | Azure DevOps Blog — [Retirement of Global Personal Access Tokens](https://devblogs.microsoft.com/devops/retirement-of-global-personal-access-tokens-in-azure-devops/) | HIGH |
| `GITHUB_TOKEN`-driven pushes do not re-trigger workflows on the same repo | GitHub Docs — [Authenticating with GITHUB_TOKEN](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) | HIGH |
| `[skip ci]` token suppresses `push:`/`pull_request:` triggers | GitHub Changelog — [2021-02-08 skip ci](https://github.blog/changelog/2021-02-08-github-actions-skip-pull-request-and-push-workflows-with-skip-ci/) | HIGH |
| `github-actions[bot]` user ID `41898282` for verified-signature commits | GitHub Docs (community-canonical pattern) | HIGH |
| `tfx --rev-version` only updates `vss-extension.json`, not package.json; not aware of build-tasks (microsoft/tfs-cli #262) | microsoft/tfs-cli docs + issue #262 | HIGH |
| `--auth-type pat --token <PAT>` is the canonical CLI form | Microsoft Learn (publish from CLI) + existing `scripts/publish-cezari.cjs` | HIGH |
| `AZURE_DEVOPS_EXT_PAT` is for the Azure CLI (`az devops`), not tfx-cli | Azure CLI docs (cross-checked); tfx-cli doesn't read this env | MEDIUM (negative claim — search returned no tfx-cli source treating it as primary; existing in-repo script also uses `--token` not env) |
| Publish runner `ubuntu-latest` over `windows-latest` (cost + tfx-cli OS quirks) | GitHub Actions billing docs + repo's existing `scripts/publish-cezari.cjs` Windows-only `shell` workaround | HIGH |

---

*Stack research for: GitHub Actions auto-publish workflow for an Azure DevOps Marketplace extension*
*Researched: 2026-05-04*
*Verified: live npm registry + live GitHub Releases API on the research date*
