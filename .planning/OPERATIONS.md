# Operations Runbook — Story Point Calculator auto-publish

This is the single durable operations doc for the v1.1 auto-publish CI/CD surface
(GitHub Actions -> Visual Studio Marketplace). Per the Phase 6/7 D-3 convention, all
the "why" lives here — the workflow YAML stays comment-free.

> Section 2 was captured first (Plan 08-01) because `scripts/publish-cezari.cjs` is
> archived in Plan 08-04 and DOC-02 requires the canonical `tfx` invocation captured
> BEFORE that move. Sections 1, 3, 4, 5, 6 were added in Plan 08-02.

## 1. Marketplace PAT rotation (1-year cadence)

The `TFX_PAT` repo secret authenticates `tfx extension publish` against the Visual
Studio Marketplace. Azure DevOps caps PAT lifespan at 1 year. Rotate proactively —
set a calendar reminder for ~11 months after the last rotation. (The current `TFX_PAT`
last worked on the v1.0.8 publish, run #25641329824.)

1. Sign in to https://dev.azure.com/ with the Microsoft account that owns the
   Marketplace publisher `TsezariMshvenieradzeTfsAiReviewTask`. (The Marketplace
   publisher-management surface is reachable via https://aex.dev.azure.com/ — but the
   PAT itself is created in Azure DevOps user settings, not on aex.dev.azure.com.)
2. User settings (top-right avatar) -> Personal access tokens -> + New Token.
3. Name: e.g. `marketplace-publish-2027`. Organization: **All accessible organizations**
   (NOT a single org — tfx-cli's publish API operates outside org context; a single-org
   PAT 401s). Expiration: **Custom defined -> 1 year** (the maximum).
4. Scopes: **Custom defined** -> scroll to **Marketplace** -> check **Publish** (the
   minimal scope `tfx extension publish` needs; do NOT add Manage or Acquire).
   NOTE: some Microsoft docs say `Marketplace (Manage)`. The current `TFX_PAT` works with
   whatever scope it has (it published v1.0.8 green). If a rotated `Publish`-only PAT
   401s on the publish step, widen to `Manage` — and record in this doc which scope
   worked.
5. Create -> copy the token (shown once).
6. GitHub repo -> Settings -> Secrets and variables -> Actions -> `TFX_PAT` -> Update
   secret -> paste the new value.
7. Back in Azure DevOps PAT settings -> revoke the OLD token.
8. Verify: trigger `publish.yml` via `workflow_dispatch` on the `release` branch (or wait
   for the next `master -> release` promotion) and confirm the publish step authenticates.

> Which scope the current `TFX_PAT` actually carries is not re-verified here — it
> published v1.0.8 green, so it works. Record the working scope above the next time you
> rotate.

## 2. Manual emergency-publish runbook (DOC-02)

Use this when `publish.yml` is down or you must publish a `.vsix` from a maintainer
machine. This is the CURRENT public-publish form (verified green by `publish.yml` run
#25641329824) — NOT the older `--share-with cezari` private-share form that the archived
`scripts/.archive/publish-cezari.cjs` shows (that variant is for re-sharing privately to
the `cezari` test org only).

### One-time local setup

1. Create `.env.local` in the repo root (it is gitignored — `git ls-files .env.local`
   must print nothing):

   ```
   TFX_PAT=<your Marketplace PAT — see section 1 for how to mint one>
   ```

2. `npm ci` (so `tfx-cli@0.23.1` from devDependencies is available via `npx`).

### Package + publish

```bash
# 1. Build the production bundle (same gate the workflow runs)
npm run build

# 2. Package the .vsix
npx tfx extension create --manifest-globs vss-extension.json --output-path dist/

# 3. Publish to the public Marketplace listing
#    (export TFX_PAT from .env.local first, e.g.  export $(grep TFX_PAT .env.local) )
npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation
```

The published listing:
https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator

After a manual publish, hand-bump `package.json` + `vss-extension.json` to the published
version and land it on `master` via a normal PR (see section 5, the partial-failure
recovery runbook, for the exact steps) so the workflow's max-wins bump stays consistent.

## 3. Release-branch model & ruleset configuration

### The model

Feature PRs target **`master`** (fully protected). When ready to ship, a maintainer opens
a **`master -> release` promotion PR**; `ci.yml` runs on it (its `pull_request` trigger
covers `[master, release]`); merging that PR via the GitHub Web UI pushes to `release`,
which fires **`publish.yml`** (minus its `paths-ignore` list). The workflow then:

1. mints a GitHub App installation token (`actions/create-github-app-token@v2`) as its
   FIRST step, before checkout — so checkout's persisted git credential is the App token;
2. runs all the Phase 6 gates (typecheck -> vitest -> webpack build -> `check:size`) and
   the asset audit + `TFX_PAT`-presence + branch-protection probe;
3. runs `scripts/bump-version.mjs` in-memory (no commit yet — Option B: bump, then publish
   FIRST, commit LAST);
4. packages the `.vsix` (`npx tfx extension create --manifest-globs vss-extension.json
   --output-path dist/`), uploads it as the `vsix-X.Y.Z` artifact (90-day, `if-no-files-found: error`);
5. publishes to the Marketplace (`npx tfx extension publish --vsix dist/*.vsix --auth-type
   pat --token "$TFX_PAT" --no-prompt --no-wait-validation`) — **this is the point of no
   return; everything above it leaves `release` untouched**;
6. commits `chore(release): vX.Y.Z [skip ci]` to `release` via the App token
   (`stefanzweifel/git-auto-commit-action@v6`, inheriting the App credential from the
   checkout step — v6 has no `token` input);
7. pushes the annotated tag `vX.Y.Z` (best-effort, idempotent — a tag-push failure leaves
   the workflow green);
8. opens a **`release -> master` back-merge PR** (`gh pr create --base master --head
   release`, `GH_TOKEN` = the App token; guarded so a re-run doesn't open a duplicate).

The maintainer then **merges the `release -> master` PR via the Web UI** — the merge
commit carries a verified signature, which satisfies master's "Require signed commits"
rule — and `master` catches up to `release`'s version.

### Why a `release` branch

`master` gets frequent feature-PR merges; publishing a new Marketplace patch on every one
is too noisy. Batch several merges into one release by promoting `master -> release` when
ready (CONTEXT D-3 rationale). The "automatic" promise is preserved at the promotion
boundary: a `master -> release` PR merge auto-ships a patch.

### GitHub App creation (the user does this in the GitHub UI — Claude can't)

1. GitHub -> Settings (your account, top-right avatar) -> Developer settings -> GitHub
   Apps -> **New GitHub App**.
2. Name: `story-point-release-bot`. Homepage URL: the repo URL is fine. Under **Webhook**,
   **uncheck "Active"** (no webhook needed).
3. **Repository permissions:** `Contents` = **Read and write**; `Pull requests` = **Read
   and write**; `Metadata` = Read-only (auto-selected). Nothing else.
4. "Where can this GitHub App be installed?" -> **Only on this account**.
5. **Create** the App. On the App's page: note the **App ID** (a number); click
   **Generate a private key** -> downloads a `.pem` file.
6. **Install App** -> install on the `tsmshvenieradze/StoryPointExtension` repository
   ("Only select repositories" -> pick it).
7. GitHub repo -> Settings -> Secrets and variables -> Actions -> **New repository
   secret**: `APP_ID` = the App ID number; `APP_PRIVATE_KEY` = the entire contents of the
   `.pem` file (including the `-----BEGIN ...-----` / `-----END ...-----` lines). Delete
   the `.pem` file locally afterward.

`publish.yml` references `secrets.APP_ID` + `secrets.APP_PRIVATE_KEY`; the App's slug
`story-point-release-bot[bot]` is used as the commit author/committer and is included in
the workflow's actor-guard.

### `release` branch creation (user — UI or CLI)

```bash
git checkout master && git pull && git checkout -b release && git push -u origin release
```

(or use the GitHub branch UI). `release` is long-lived; never delete it.

### master ruleset configuration (user — GitHub UI)

Repo -> Settings -> Rules -> Rulesets -> the existing master ruleset (or create one)
targeting `master`. Re-enable:

- **Require a pull request before merging**
- **Require status checks to pass** — add the `ci.yml` checks (the `Build & verify` job
  produces 2 status contexts, as observed during Phase 7)
- **Require signed commits**

Under **Bypass list**: add the `story-point-release-bot` GitHub App, mode **"Always
allow"**. The design's master path is human-merge (the verified-signature merge commit
satisfies all three rules natively), so the App bypass on master is belt-and-suspenders
for any future App-driven push to master — but add it so a `gh pr merge` via the App token
would also work.

### `release` ruleset configuration (user — GitHub UI)

Keep it **LIGHT** — recommended: a ruleset on `release` with only **"Require linear
history"** (or no ruleset at all). Do **NOT** add "Require signed commits" or "Require a
pull request before merging" to `release` **UNLESS** you also add the
`story-point-release-bot` App to `release`'s bypass list — because `publish.yml` pushes the
bump commit + the tag DIRECTLY to `release` with the App token, and an
unsigned/PR-required rule there would block it (the `GH013` trap Phase 7 hit on master).
Recommendation: light is simpler — `release` is the automation lane, not the
human-protected lane.

### How to re-tighten / relax

To relax temporarily (e.g. an emergency): edit the master ruleset and toggle the offending
rule off; **remember to re-enable it afterward**. The bypass-list App entry should normally
stay. Restoring full master protection (PR + status-checks + signed-commits) is the
post-Phase-7 closing action — Phase 7 recovery had relaxed signed-commits + require-PR; this
model puts them back with the App on the bypass list.

### One user-asserted, not-doc-verified item (RESEARCH A1/Q1)

The claim "a GitHub App on a ruleset's bypass list bypasses ALL rules in that ruleset,
including signed-commits" is **asserted by the user, not unambiguously stated in GitHub's
docs**. The current design does **not** rely on the App pushing directly to a
signed-commits-protected branch — `master` is human-merged; `release` is kept light. If a
future change wants the App to push directly to a signed-commits-protected branch, **verify
empirically first** (one test push).

## 4. Rulesets-aware branch-protection probe (Phase 6 correction)

The Phase 6 probe — [`.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md`](phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md)
— checked **only** `GET /repos/{owner}/{repo}/branches/{branch}/protection` (the **legacy**
branch-protection API) and concluded "NOT PROTECTED". That was correct for *legacy* branch
protection but **missed the repository ruleset on `master`**, which then rejected the
Phase 7 commit-back bot push with `GH013` (see
[`.planning/phases/07-bump-publish-tag/07-VERIFICATION.md`](phases/07-bump-publish-tag/07-VERIFICATION.md)).

**The correction:** any future branch-protection probe MUST query **BOTH** endpoints —
`GET /repos/{owner}/{repo}/branches/{branch}/protection` (legacy) AND
`GET /repos/{owner}/{repo}/rules/branches/{branch}` (rulesets). The `publish.yml` probe step
is informational only (it can't get admin scope from `GITHUB_TOKEN`); this OPERATIONS.md
note is the durable source-of-truth correction. (Per Phase 6/7 D-3, the workflow YAML stays
comment-free — the probe-step rationale that used to live in `publish.yml` lives here now.)

Copy-pasteable `gh` snippet:

```bash
gh api repos/tsmshvenieradze/StoryPointExtension/branches/master/protection || echo "(legacy branch protection: none or no scope)"
gh api repos/tsmshvenieradze/StoryPointExtension/rules/branches/master   # <- the one Phase 6 missed
gh api repos/tsmshvenieradze/StoryPointExtension/rules/branches/release
```
