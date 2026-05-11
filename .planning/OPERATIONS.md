# Operations Runbook — Story Point Calculator auto-publish

This is the single durable operations doc for the v1.1 auto-publish CI/CD surface
(GitHub Actions -> Visual Studio Marketplace). Per the Phase 6/7 D-3 convention, all
the "why" lives here — the workflow YAML stays comment-free.

> Sections 1, 3, 4, 5, 6 are added in Plan 08-02. Section 2 (below) is captured here
> first (Plan 08-01) because `scripts/publish-cezari.cjs` is archived in Plan 08-04 and
> DOC-02 requires the canonical `tfx` invocation captured BEFORE that move.

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
