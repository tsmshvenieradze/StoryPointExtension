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
