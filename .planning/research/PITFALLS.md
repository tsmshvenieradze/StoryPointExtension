# Pitfalls Research — v1.1 Auto-Publish CI/CD

**Domain:** GitHub Actions auto-publish for an Azure DevOps Marketplace extension (already public on Marketplace at v1.0.7)
**Researched:** 2026-05-05
**Confidence:** HIGH on flow & primitives (Microsoft Learn + GitHub Docs verified); MEDIUM on `tfx-cli` flag-by-flag behavior (`microsoft/tfs-cli` source-of-truth doc verified, but task-version compatibility for `PublishAzureDevOpsExtension@5` is MEDIUM); MEDIUM on listing-asset preservation behavior across re-publish (no contradicting evidence in current Marketplace docs).
**Stack scope:** GitHub Actions + `tfx-cli` ≥0.21 + Visual Studio Marketplace + GitHub repo (master branch, no protection rules currently configured) + existing publisher `TsezariMshvenieradzeTfsAiReviewTask` + existing public listing `story-point-calculator` at v1.0.7.

---

## Critical Pitfalls

### Pitfall 1: CI re-trigger loop from auto-bump commit

**What goes wrong:**
The publish workflow runs on `push: branches: [master]`. After a successful publish, the workflow commits the bumped `package.json` + `vss-extension.json` back to `master`. That commit is itself a push to `master` → workflow re-triggers → bumps again → publishes v1.0.9 → commits → loops forever (or until rate-limited / PAT-quota-exhausted / Marketplace blocks for spam).

**Symptom:**
GitHub Actions tab shows back-to-back runs every ~2 minutes. Marketplace receives 5–10 redundant patch versions in an hour. Rate limiting kicks in (HTTP 429 from `dev.azure.com` or Marketplace) and the loop breaks itself, but only after polluting the version history.

**Why it happens:**
The default `GITHUB_TOKEN` actually does NOT trigger downstream workflows when used to push — this is a deliberate guard ([GitHub Docs](https://docs.github.com/en/actions/concepts/security/github_token)). The loop emerges when developers reach for a Personal Access Token (PAT) "because GITHUB_TOKEN doesn't have the right perms" without realizing the PAT path bypasses the loop guard. Loops also occur when `actions/checkout` is configured with `persist-credentials: false` and a PAT is provided to the commit step.

**Prevention (defense-in-depth — use ALL THREE):**

1. **Use `GITHUB_TOKEN` for the commit-back, NOT a PAT.** With the default token, GitHub's loop-guard fires:
   ```yaml
   permissions:
     contents: write   # required for commit-back
   ```
   The Marketplace PAT lives only in the publish step (env var), never in the checkout/commit step.

2. **`[skip ci]` in the bump commit message** as belt-and-suspenders ([GitHub Changelog 2021-02-08](https://github.blog/changelog/2021-02-08-github-actions-skip-pull-request-and-push-workflows-with-skip-ci/)). Even if someone later swaps `GITHUB_TOKEN` → PAT, the message tag still suppresses the trigger:
   ```bash
   git commit -m "chore(release): bump to v${NEW_VERSION} [skip ci]"
   ```

3. **Actor guard at the workflow top** as third backstop:
   ```yaml
   jobs:
     publish:
       if: github.actor != 'github-actions[bot]'
   ```
   This stops the workflow even if both prior layers fail (e.g., the `[skip ci]` token gets accidentally lower-cased to `[skip Ci]`, which does not match — the matcher is case-sensitive on the literal token).

**Detection:**
- Workflow lints: a CI smoke step that greps the workflow file for `secrets.MARKETPLACE_PAT` and FAILS the workflow if the same token is referenced anywhere except inside the publish step.
- Post-publish check: a step that runs `gh run list --limit 5 --workflow=publish.yml --json conclusion,createdAt` and FAILS if the previous successful run was less than 5 minutes ago (signal of a loop catching itself in the next iteration).
- Marketplace version history: any version delta > 1 within the same calendar day where there's no corresponding PR is a loop signal. Manual smoke during first dry-run.

**Phase to address:**
Earliest phase that adds the auto-bump (likely Phase 2: "Version bump + commit-back"). Each of the three guards is a separate REQ; do NOT collapse to a single guard.

**v1.0 integration note:**
The existing `publish:cezari` npm script (carry-over from v1.0) does NOT auto-commit and does NOT re-trigger anything. The risk lands the moment commit-back is introduced. Any deletion of `publish:cezari` (per milestone goal) is safe AS LONG AS the auto-publish workflow ships first and is verified green; do not delete the manual escape hatch before the automated path is validated.

---

### Pitfall 2: Version drift — Marketplace vs manifest vs git tag get out of sync

**What goes wrong:**
Three independent state stores hold "current version":
- `vss-extension.json` `"version"` field (source of truth in repo)
- Marketplace listing's `Versions` table (source of truth on Marketplace)
- Git tags `v1.0.N` (source of truth in version-control history)

A manual publish via the legacy `publish:cezari` script (or via the Marketplace UI's "Edit" → upload-vsix flow) bumps Marketplace to v1.0.10 without touching `vss-extension.json` or pushing a tag. Next master merge: CI reads `vss-extension.json` (still v1.0.7), runs `tfx extension publish --rev-version` → tries to publish v1.0.8 → Marketplace responds:
> `Failed Request: Internal Server Error(500) — Version number must increase each time an extension is published. Current version: 1.0.10  Updated version: 1.0.8`
([Microsoft Learn — command-line publish, "Potential errors"](https://learn.microsoft.com/en-us/azure/devops/extend/publish/command-line?view=azure-devops)).

**Symptom:**
Workflow fails on the publish step with HTTP 500 + "Version number must increase". This is the _good_ failure mode — the bad mode is when CI is configured with `--override` JSON that hard-codes the version and the publish silently bumps Marketplace by an unexpected delta (e.g., manifest at 1.0.7, override forces 1.1.0 because someone copy-pasted, Marketplace accepts because 1.1.0 > 1.0.10, and now `package.json` is permanently behind reality).

**Prevention:**
1. **Single source of truth: `vss-extension.json`.** Do not use `--override "{\"version\": ...}"`. Use `--rev-version` (auto-increments the manifest in place) and commit the result back.
2. **Pre-flight reconciliation step** that queries Marketplace BEFORE publishing:
   ```yaml
   - name: Verify manifest version is ahead of Marketplace
     run: |
       MANIFEST_VERSION=$(jq -r '.version' vss-extension.json)
       MARKET_VERSION=$(curl -s -H "Authorization: Bearer $MARKETPLACE_PAT" \
         "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${PUBLISHER}/extensions/${EXT_ID}?api-version=7.1-preview.1" \
         | jq -r '.versions[0].version')
       if [ "$(printf '%s\n%s' "$MARKET_VERSION" "$MANIFEST_VERSION" | sort -V | head -1)" != "$MARKET_VERSION" ] || [ "$MARKET_VERSION" = "$MANIFEST_VERSION" ]; then
         echo "DRIFT: manifest=$MANIFEST_VERSION, marketplace=$MARKET_VERSION. Reconcile before publishing."
         exit 1
       fi
   ```
   This makes drift fail loud, immediately, with the actionable diagnosis.
3. **Lock the publish path.** Once the GH Action ships, REMOVE `publish:cezari` (the milestone already plans this) AND add a contributing-doc note "Manual publishing is forbidden; the workflow is the only release surface." Document the emergency-bypass procedure (run the workflow manually via `workflow_dispatch`) so contributors don't reach for the legacy script under stress.

**Recovery (when drift has already happened):**
1. Pull the actual current Marketplace version: `curl ... /publishers/{pub}/extensions/{ext}?api-version=7.1-preview.1 | jq '.versions[0].version'`
2. Edit `vss-extension.json` `"version"` to one patch higher than Marketplace's current version (e.g., Marketplace at 1.0.10 → set manifest to 1.0.11, NOT 1.0.8).
3. Edit `package.json` `"version"` to match.
4. Commit `chore(release): reconcile manifest with Marketplace v1.0.11 [skip ci]`.
5. Push tag `v1.0.10` retroactively for the missing version (`git tag v1.0.10 <sha-of-manual-publish-commit>` if findable; else just skip — tags are nice-to-have, not load-bearing).
6. Re-run the publish workflow.

**Detection:**
- Pre-flight reconciliation step (above) — primary detector.
- Weekly cron workflow (`schedule: cron: '0 9 * * 1'`) that runs the same Marketplace-vs-manifest comparison and opens an issue on mismatch. Cheap insurance against forgotten manual publishes.

**Phase to address:**
Phase that introduces the publish call. Reconciliation step is the canonical REQ.

---

### Pitfall 3: Concurrent merges race the version bump

**What goes wrong:**
PR-A and PR-B merge to master 30 seconds apart. Workflow A starts, reads `vss-extension.json` v1.0.7, bumps to v1.0.8, calls `tfx extension publish --rev-version`. Before A finishes, Workflow B starts, ALSO reads v1.0.7, bumps to v1.0.8, tries to publish.

Three failure modes possible:
- **B's publish call to Marketplace fails** with "Version number must increase" because A already published v1.0.8. B's commit-back step still runs and pushes a v1.0.8 manifest that's now stale. Result: manifest claims v1.0.8 but B's content is missing from Marketplace.
- **B's commit-back races A's commit-back** — both push `vss-extension.json` v1.0.8 to master. The second push is a non-fast-forward and is rejected. B's workflow fails on the push step but has already succeeded the publish step; manifest in repo doesn't match published content for B.
- **Both publish succeed** in different orders (race on Marketplace API): one of them gets v1.0.8 (the faster one) and the other gets a 500 error. PR-B's content silently never reaches Marketplace.

**Symptom:**
Sporadic publish failures correlated with high merge velocity. Repo log shows two version-bump commits with the same target version (one rejected). Marketplace shows a version that isn't reproducible from any single commit (because B's source code is at HEAD but Marketplace's v1.0.8 was built from A's code).

**Prevention:**
**`concurrency` group at workflow top with `cancel-in-progress: false`** ([GitHub Docs — Control concurrency](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs)):
```yaml
concurrency:
  group: marketplace-publish
  cancel-in-progress: false   # do NOT kill in-flight publishes
```
Behavior: when PR-B's workflow fires while PR-A is mid-publish, B is queued (not started, not cancelled). Once A completes, B starts AFTER A's commit-back has already landed on master. B's `actions/checkout` now picks up v1.0.8 manifest and bumps to v1.0.9. No race.

**Important caveat:** GitHub Actions concurrency has a "two-slot" limitation — at most ONE running and ONE pending workflow per group ([GH Discussion #41518](https://github.com/orgs/community/discussions/41518)). If a third merge lands while one is running and one is queued, the queued (older) one is CANCELLED in favor of the new one. For a low-traffic repo this is fine; if traffic ever spikes, mitigate by either (a) accepting that some PRs ship as a combined patch, or (b) using a cron'd publish job that batches merges.

**Detection:**
- Smoke test the concurrency guard during first dry-run by manually triggering the workflow twice within seconds via `workflow_dispatch` and verifying the second run shows status "Pending" then "Success" (not "Failure").
- Post-publish step: re-pull the published manifest from the `.vsix` URL and diff against the git HEAD's `vss-extension.json`. Any non-trivial diff (beyond version field) is a race signal.

**Phase to address:**
Same phase as the publish workflow itself. Concurrency block is mandatory; it is one line of YAML and prevents an entire failure-mode class.

---

### Pitfall 4: Marketplace PAT silently expires

**What goes wrong:**
Marketplace PATs are created with a maximum lifespan capped by org policy (typically 30 / 90 / 180 / 365 days, with admins able to set lower) ([Microsoft Learn — Manage PATs with policies](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/manage-pats-with-policies-for-administrators?view=azure-devops)). On expiry, every master merge fails on the publish step with `401 Unauthorized` or `Marketplace.PublisherUnauthorized`. Even worse: `tfx-cli` has historically returned `401` even when the PAT is **valid but lacks the right scope** ([microsoft/azure-devops-extension-tasks#163](https://github.com/microsoft/azure-devops-extension-tasks/issues/163)), so the failure mode is ambiguous on first read.

Additional context: GitHub-stored PATs have NO server-side expiration callback. There is no warning on day 7-before-expiry. The first signal is a failed deploy.

**Symptom:**
Sudden 100% publish failure rate the day the PAT expires. Logs show:
```
TF400813: The user '00000000-0000-0000-0000-000000000000' is not authorized to access this resource.
```
or
```
401 (Unauthorized). Check that your personal access token is correct and hasn't expired.
```

**Prevention (combine all three for a small repo):**

1. **Set a calendar reminder 7 days before PAT expiry.** Document the renewal procedure in `README.md` or `CONTRIBUTING.md` with a single command-line PAT-creation walkthrough. Low-tech, works.

2. **Cron'd PAT smoke-test workflow** (weekly, distinct from the publish workflow):
   ```yaml
   on:
     schedule:
       - cron: '0 9 * * 1'   # Mondays 9 AM UTC
     workflow_dispatch:
   jobs:
     pat-smoke:
       runs-on: ubuntu-latest
       steps:
         - run: |
             curl -fsS -H "Authorization: Bearer ${{ secrets.MARKETPLACE_PAT }}" \
               "https://marketplace.visualstudio.com/_apis/gallery/publishers/${PUBLISHER}?api-version=7.1-preview.1" \
               || (echo "PAT validation failed — rotate before next merge" && exit 1)
   ```
   Failure opens an issue automatically (use `actions/github-script` to call `issues.create`).

3. **Document an emergency manual publish path.** Even with the legacy `publish:cezari` script removed (per milestone goal), the runbook MUST list "How to publish from a developer's machine using `tfx extension publish` directly" — because when the CI PAT expires, you'll want to push the next patch manually while you wait for the rotated secret to propagate.

**Long-term mitigation (out of scope for v1.1, candidate for v1.2):**
Microsoft Entra workload-identity tokens (OIDC) replace PATs and don't expire on a fixed schedule ([Jesse Houwing — Workload Identity for Marketplace publishing](https://jessehouwing.net/publish-azure-devops-extensions-using-workload-identity-oidc/)). This is a strict upgrade but adds Azure subscription dependencies and a service-principal setup that's overkill for a 30-second-utility extension. Defer.

**Note on global-PAT deprecation:**
Microsoft is phasing out global PATs (creation blocked 2026-03-15; full deprecation 2026-12-01) ([Azure DevOps Blog — Retirement of Global PATs](https://devblogs.microsoft.com/devops/retirement-of-global-personal-access-tokens-in-azure-devops/)). Marketplace publishing now works with org-scoped PATs that have Marketplace (publish) scope ([Azure DevOps Blog — Publishing extensions issue resolved](https://devblogs.microsoft.com/devops/publishing-extensions-to-marketplace-issue-resolved/)). This DOES NOT affect this project today, but if the PAT-creation step in the runbook says "All accessible organizations", update it to "Specific organization → your dev org" before 2026-12-01.

**Detection:**
Cron smoke test (above). Manual: log into Azure DevOps, Profile → Personal access tokens, sort by Expiry. Anything within 14 days = act now.

**Phase to address:**
Phase that wires the PAT secret. The smoke-test workflow is a separate small REQ in the same phase or the cleanup phase.

---

### Pitfall 5: `tfx-cli` flag-confusion footguns

**What goes wrong:**
Five concrete `tfx-cli` traps, all confirmed against [microsoft/tfs-cli/docs/extensions.md](https://github.com/microsoft/tfs-cli/blob/master/docs/extensions.md) and [Microsoft Learn](https://learn.microsoft.com/en-us/azure/devops/extend/publish/command-line?view=azure-devops):

| Footgun | What goes wrong | Correct usage |
|---|---|---|
| **`--rev-version` writes the manifest in place** | If you call `tfx extension publish --rev-version` from CI but DO NOT commit the result back, the next CI run reads the same v1.0.7 manifest and tries to publish v1.0.8 again → "Version number must increase". | Always pair `--rev-version` with a commit-back step in the same workflow (or use `--override "{\"version\":\"$NEW\"}"` AND bump the manifest in a prior step yourself — but per Pitfall 2, prefer the manifest-as-source-of-truth pattern). |
| **`--override "{ ... }"` JSON is shell-fragile** | The JSON gets eaten by quoting. Bash, PowerShell, and YAML each escape differently; the most common bug is `--override "{\"version\":\"$NEW\"}"` becoming literally `{"version":"$NEW"}` because `bash -c` was wrapped wrong. | If you must use `--override`, write the JSON to a temp file and pass via `--overrides-file ./tmp-override.json`. Less fragile. |
| **`--share-with` takes ORG names, not booleans** | `--share-with private` will try to share with an organization literally named "private" and fail. To make an extension private, you set `"public": false` in `vss-extension.json` — there is no CLI flag for "make private". | Either keep `"public": true` in the manifest (this project's case — already public) and never pass `--share-with`, OR keep manifest `"public": false` and pass `--share-with myorg.visualstudio.com`. Don't mix. |
| **`--no-prompt` is required for non-interactive CI** | Without it, `tfx-cli` prompts for "Personal access token:" interactively and the CI hangs until timeout (10 minutes default). Easy to miss because local dev runs work fine. | Pass `--no-prompt` AND `--auth-type pat` AND `--token "$MARKETPLACE_PAT"` together. All three are needed for clean non-interactive auth. |
| **`--manifest-globs` defaults to `vss-extension.json`** | If your manifest is renamed or you have multiple manifests (e.g., a dev and a prod one), the default glob silently picks the wrong file or no file. | This project has exactly one manifest at the repo root with the default name. Do not use `--manifest-globs` unless you split manifests. If you do split, pin the path: `--manifest-globs ./vss-extension.json`. |

**Two more subtle ones from the GitHub issue tracker:**

- **PAT prefix `bearer ` should NOT be added** for `tfx`. `--token "Bearer abc..."` fails; `--token "abc..."` works. The `Bearer` prefix is only for direct curl calls to the REST API.
- **`tfx-cli` caches a token in `~/.taskkey`** ([microsoft/tfs-cli#455](https://github.com/microsoft/tfs-cli/issues/455)). On a CI runner this is harmless (fresh runner each run), but if a developer runs `tfx extension publish` locally during testing, the cached token can mask PAT-rotation bugs. Document `--no-prompt --token` always-explicit.

**Symptom:**
- Hung CI run → forgot `--no-prompt`.
- Wrong version published → `--override` shell quoting ate the variable.
- "Cannot publish — no manifest found" → wrong `--manifest-globs` path.
- Extension goes private after a publish → accidentally cleared `"public": true` via `--override "{\"public\":false}"` because someone tested a private flow on staging and copy-pasted.

**Prevention:**
Lock the publish command to a single, reviewed shell line:
```yaml
- name: Publish to Marketplace
  env:
    MARKETPLACE_PAT: ${{ secrets.MARKETPLACE_PAT }}
  run: |
    npx tfx-cli extension publish \
      --auth-type pat \
      --token "$MARKETPLACE_PAT" \
      --no-prompt \
      --manifest-globs ./vss-extension.json \
      --rev-version
```
Treat changes to this command as a high-review PR (CODEOWNERS pin the workflow file).

**Detection:**
- Dry-run with `--no-publish` (some forks support it; the official `tfx` does not — workaround: pre-flight call to `tfx extension show --publisher ... --extension-id ...` to validate auth without publishing).
- Smoke: a separate workflow that runs the same publish command on every PR with `--share-with cezari-temp-staging` (a private staging org) so any flag bug surfaces in PR review, not on master.

**Phase to address:**
Phase that writes the publish step. Pre-existing v1.0 carry-over: the legacy `publish:cezari` script in `package.json` already encodes a working invocation — read its exact form before designing the YAML to avoid regressing on a flag combination that's already been validated against the live publisher.

---

### Pitfall 6: Marketplace listing-asset regression after re-publish

**What goes wrong:**
A re-publish with `tfx extension publish` uploads the `.vsix` and replaces the listing with the manifest's contents. If `vss-extension.json` `files[]` array has drifted (e.g., someone removed `"path": "images"` to trim the package), the re-published listing shows a broken icon link. Same for `screenshots[]` — if the manifest doesn't list them, they are NOT auto-preserved from the prior version. Same for `content.details.path` (overview.md) — if the file is missing from the build output or `files[]`, the listing's "Overview" tab renders empty.

**Specific to this project (per `vss-extension.json` v1.0.7):**
Currently shipping:
- `images/icon.png` (referenced by `"icons": { "default": "images/icon.png" }`)
- `overview.md` (referenced by `"content.details.path"`)
- `dist/` (the bundled JS/HTML)

NOT currently shipping:
- `screenshots[]` — already a documented v1.0 carry-over (PKG-05). When v1.1 ships, the missing screenshots stay missing — re-publish does NOT silently restore them from the prior listing.

**Symptom:**
First post-CI publish renders a listing where the icon is a broken-image placeholder, the overview is empty, or the screenshots are gone. Discovered by the FIRST user trying to install — too late.

**Prevention:**

1. **Pre-publish manifest-asset audit** as a CI step:
   ```yaml
   - name: Verify listing assets exist on disk
     run: |
       jq -r '
         (.icons.default // empty),
         (.content.details.path // empty),
         (.files[]?.path // empty),
         (.screenshots[]?.path // empty)
       ' vss-extension.json | while read asset; do
         [ -e "$asset" ] || (echo "MISSING ASSET: $asset" && exit 1)
       done
   ```
   Fails the build if `vss-extension.json` references a file that doesn't exist in the build output.

2. **Snapshot the prior listing's assets** in a dry-run-on-PR job:
   ```yaml
   - name: Diff manifest assets vs published
     run: |
       PUBLISHED_ICON=$(curl -s ".../publishers/${PUB}/extensions/${EXT}?api-version=7.1-preview.1" | jq -r '.versions[0].assetUri + "/Microsoft.VisualStudio.Services.Icons.Default"')
       # head -c bytes, sha256, compare to local — fail if delta and PR doesn't say "intentional listing change"
   ```
   Heavyweight; defer to a phase that has time. The cheap version is a manual checklist item in the runbook: "after first auto-publish, verify the listing page renders icon + overview + screenshots correctly."

3. **Lock `files[]`** in `vss-extension.json` as a pinned, reviewed list. Add a unit-style check: `jq '.files | length' vss-extension.json` should equal a known constant (currently 3). Any change requires explicit PR review.

**Detection:**
- Visual smoke: open the Marketplace listing page after first auto-publish. Icon, screenshots, overview — all rendered? Yes/no.
- Programmatic: `curl` the listing's asset URIs and assert HTTP 200 + non-zero content length.

**Phase to address:**
Phase that does the publish step. Asset-audit step is a small REQ in the pre-flight gate.

**v1.0 integration:**
The listing currently has icon + overview + 0 screenshots (PKG-05 deferred). v1.1 publish should NOT regress this — the "0 screenshots" state is the baseline to preserve, not to fix in this milestone.

---

### Pitfall 7: `GITHUB_TOKEN` push doesn't trigger downstream workflows (interaction with `[skip ci]`)

**What goes wrong:**
Two interacting facts:
1. `GITHUB_TOKEN` push commits do NOT trigger any subsequent workflows ([GitHub Docs — Triggering a workflow](https://docs.github.com/actions/using-workflows/triggering-a-workflow), [community discussion #25702](https://github.com/orgs/community/discussions/25702)).
2. `[skip ci]` is a separate, additive guard.

The interaction surprise: developers add `[skip ci]` "to be safe", then later try to set up a downstream workflow (e.g., a "deploy docs after release-tag" workflow that triggers on tag push). The tag push from `GITHUB_TOKEN` doesn't trigger the downstream workflow at all — and they spend hours debugging `[skip ci]` thinking it's the cause, when really it's the GITHUB_TOKEN guard.

The same trap in reverse: developers expect the bump-commit to NOT re-trigger because they've used a PAT (which DOES trigger downstream), but they forgot to add `[skip ci]` → loop.

**Symptom for this project:**
The milestone says "Push a git tag (vX.Y.Z) on each successful publish." If the tag is pushed via `GITHUB_TOKEN`, NO workflow triggered by `on: push: tags:` will fire. If a future "Generate release notes" workflow is added that listens on tag push, it'll silently never run. Discovered weeks after introduction, when the absence of release notes is finally noticed.

**Prevention:**
1. **Tag pushes from CI: choose tokens deliberately.**
   - If no downstream workflow exists today and none is planned for v1.1: use `GITHUB_TOKEN`. Tag pushes will not trigger anything; that's fine because nothing's listening.
   - If a downstream tag-listener is planned: use either (a) a fine-scoped PAT with `repo` scope, or (b) a GitHub App token. Document the choice in the workflow YAML comment.
2. **Document the `GITHUB_TOKEN` no-trigger rule** in a top-of-file YAML comment so the next developer doesn't have to debug it from scratch:
   ```yaml
   # NOTE: All git pushes in this workflow use GITHUB_TOKEN. By design, these
   # pushes do NOT trigger downstream workflows. If you add a workflow that
   # listens on `push: tags:` or `push: branches: master`, it will NOT fire
   # from this workflow. To enable downstream triggering, swap GITHUB_TOKEN
   # for a PAT with repo scope (be aware: re-introduces loop risk).
   ```

**Detection:**
The first time you add a downstream workflow, smoke-test by manually pushing a tag from your developer machine — if it triggers, the downstream wiring works. Then test the auto-publish path. If the auto-tag doesn't trigger but the manual tag does, you've hit the GITHUB_TOKEN guard exactly.

**Phase to address:**
Phase that introduces the tag-push step. Not a runtime pitfall — a documentation pitfall.

---

### Pitfall 8: Bundle-bloat gate bypassed by misconfigured DAG

**What goes wrong:**
v1.0 already has a bundle-size gate at 250 KB gzipped (current 147.9 KB). In CI, this is implemented as a Webpack post-build step or a `bundlesize` check. In the new auto-publish workflow, the natural structure is:

```
job: build → job: test → job: publish
```

Easy mistake: place the bundle-size check in the `build` job, BUT have the `publish` job declare `needs: [test]` (forgetting to also `needs: [build]`), causing GitHub Actions to skip the build job's outcome in dependency resolution under some matrix strategies. Or: the bundle gate is `continue-on-error: true` to "prevent CI failures during cleanup" and never gets reverted.

Result: a 400 KB bundle ships to Marketplace because the gate ran but its failure didn't propagate.

**Symptom:**
Marketplace listing renders but the modal takes 4 seconds to load instead of <1s. Discovered when a user files an issue or when manual smoke after publish notices the regression.

**Prevention:**
1. **Single linear job chain for publish:**
   ```yaml
   jobs:
     gate:    # combines typecheck + test + bundle-size
       ...
       outputs:
         bundle-size: ${{ steps.bundle.outputs.size }}
     publish:
       needs: [gate]
       if: needs.gate.outputs.bundle-size != '' && needs.gate.outputs.bundle-size <= 256000
       ...
   ```
   The `if:` on `publish` re-asserts the bundle constraint as a hard gate at the DAG level, not just as a step inside `gate`.
2. **`continue-on-error: false` everywhere in pre-publish gates.** Audit the workflow file for the string `continue-on-error` — if it appears anywhere in a gate step, fail PR review.
3. **Bundle size is a constraint asserted in two places:** the webpack config (build-time hard fail) AND the workflow YAML (DAG-level hard fail). Belt and suspenders.

**Detection:**
- After every publish, the workflow's last step downloads the published `.vsix` from Marketplace, extracts the bundle, and asserts size ≤ ceiling. If the published artifact exceeds, the workflow fails AFTER publishing (not preventive but loud — opens an issue automatically).
- Manual: check Marketplace download size column quarterly.

**Phase to address:**
Phase that adds the publish step (likely Phase 3 or 4 in v1.1). The size-gate REQ already exists from v1.0 (PKG carry-over); v1.1 just needs to honor it in the new workflow.

---

### Pitfall 9: Test flakiness blocks publishes and tempts retry-band-aid

**What goes wrong:**
v1.0 has 398/398 unit tests passing — green today. v1.1 introduces an auto-publish gate where `npm test` failure blocks the merge from shipping. Over time, tests drift toward flakiness (timer leakage, mock hoisting, snapshot drift — see [Mergify — Vitest flaky patterns](https://mergify.com/flaky-tests/vitest/)). One flaky test means one PR's merge fails to publish, gets re-run "to flush the flake", succeeds → develops habit of "just re-run". Habit metastasizes into "let's add `retry: 3` to the vitest config to stop blocking the publish pipeline" — and now the test suite has lost its signal-to-noise ratio.

**Symptom:**
Publish workflow shows yellow runs every other day. Flaky test is identified but not fixed because "re-run usually works". Then a real bug ships because the failing test was a real signal.

**Prevention (project's existing 100%-coverage gate is the right starting point):**

1. **Hard rule: `vitest run` (no retries) is the only test invocation in the publish pipeline.** Document this as a REQ. If a test is flaky, fix the test or quarantine it (`describe.skip` with a tracked issue + 7-day max), do NOT add `retry`.

2. **No `continue-on-error` on the test step.** Audit the YAML.

3. **Quarantine procedure:** when a test is flaky, the procedure is (a) skip it explicitly with a comment `// FLAKY-2026-05-15: timer leakage from neighbor test, see issue #N`, (b) add an automated reminder via cron or follow-up issue, (c) fix within 7 days or the skip becomes a removal. Quarantine NEVER becomes the default.

4. **Manual override path:** `workflow_dispatch` with an `inputs.skip-tests: false` (defaulting false) — so when the publish ABSOLUTELY must ship and a test is flaking AND the dev confirms manually, there's a documented bypass. Required for the "Marketplace breaks, fix is one-line, tests are unrelated and flaky" scenario.

**Pure-logic test scope helps here:** v1.0's test scope is calc + audit (pure functions, no DOM, no SDK, no network). Pure-function tests have very few flakiness vectors (mostly snapshot drift, which doesn't apply to numeric assertions). Existing 100%-coverage gate keeps this small. The pitfall is bigger when E2E/UI tests are added; v1.0 has explicitly scoped UI tests as out-of-scope, so this is currently low-risk — but the workflow YAML language ("require tests to pass") needs to be airtight before any future UI-test introduction.

**Detection:**
- CI metric: percentage of `publish.yml` runs that succeed on first try over rolling 30 days. If <95%, investigate.
- Issue-template: "publish failed, tests flaked" must be a recognized failure mode that prompts a quarantine PR, not a re-run.

**Phase to address:**
Phase that wires the test gate. Quarantine procedure is a CONTRIBUTING.md REQ, not a YAML REQ.

---

### Pitfall 10: Over-broad `permissions:` granted to GITHUB_TOKEN

**What goes wrong:**
Default `permissions: read-all` (or no `permissions:` block at all, defaulting to the repo-level setting which is often `write-all`) means every step in the workflow has write access to issues, PRs, packages, deployments, attestations, security events, and more. If a malicious dependency in `npm ci` exfiltrates `$GITHUB_TOKEN`, the blast radius is repo-wide, not just "can write a commit".

**Symptom:**
Quiet — most users never notice. Discovered during a security audit, or after a compromised dependency exfiltrates and the attacker creates a release / pushes a tag with malware. By then, downstream installs have happened.

**Prevention:**
**Top-level minimal `permissions:` block, then job-level expansion only where needed:**
```yaml
permissions:
  contents: read   # default for all jobs

jobs:
  gate:
    runs-on: ubuntu-latest
    steps: ...
    # gate inherits contents:read only — sufficient for checkout + test
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write   # for commit-back of bumped manifest + push tag
    needs: [gate]
    steps: ...
```
([GitHub Docs — Secure use](https://docs.github.com/en/actions/reference/security/secure-use), [GitHub Changelog — control GITHUB_TOKEN permissions](https://github.blog/changelog/2021-04-20-github-actions-control-permissions-for-github_token/))

If the workflow doesn't need PR/issue write — and this one doesn't — leave them at default `none`. The Marketplace PAT is its own secret with its own scope; the GitHub `contents: write` perm is purely for the auto-bump commit and tag push.

**Detection:**
- Lint: `actionlint` or `step-security/harden-runner` flags missing or over-broad `permissions:` blocks.
- Manual: PR review checklist for any new workflow file: "permissions block present and minimal?".

**Phase to address:**
Phase that introduces the workflow file. One YAML edit; no excuse for skipping.

---

### Pitfall 11: Failed publish AFTER a successful version-bump commit

**What goes wrong:**
Workflow ordering A:
1. Bump `vss-extension.json` v1.0.7 → v1.0.8.
2. Commit-back to master.
3. Call `tfx extension publish` → **fails** (PAT expired, Marketplace 5xx, network blip).

Result: repo HEAD says v1.0.8, Marketplace still on v1.0.7. Next merge re-runs the workflow: `actions/checkout` reads v1.0.8 manifest, `--rev-version` bumps to v1.0.9, publishes v1.0.9 to Marketplace. **v1.0.8 is lost forever** — never published, never recoverable from Marketplace's history.

**Symptom:**
Marketplace history skips a version. Easy to miss because patches are sequential-looking. Detection lag = forever, unless someone diffs the tag list against the Marketplace version list.

**Prevention:**

**Reverse the order: publish first, commit-back second, tag third.**
```yaml
- name: Publish (auto-bumps manifest in place)
  run: npx tfx-cli extension publish --rev-version --no-prompt --auth-type pat --token "$MARKETPLACE_PAT"
  # On failure: workflow stops here. Manifest in repo is UNCHANGED. Next run starts from same v1.0.7. Safe.

- name: Read new version from manifest
  id: version
  run: echo "v=$(jq -r '.version' vss-extension.json)" >> "$GITHUB_OUTPUT"

- name: Commit bumped manifest
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
    git add vss-extension.json package.json
    git commit -m "chore(release): bump to ${{ steps.version.outputs.v }} [skip ci]"
    git push

- name: Tag release
  run: |
    git tag "${{ steps.version.outputs.v }}"
    git push origin "${{ steps.version.outputs.v }}"
```
Why this works: `tfx --rev-version` only writes the manifest on the local filesystem — the change is uncommitted at that point. If publish fails, the runner is destroyed, the manifest change is gone, the repo is unchanged. Next run is a clean retry.

**Caveat:** if `tfx --rev-version` writes the file BEFORE attempting the network call to Marketplace (it does, per inspection of [microsoft/tfs-cli source](https://github.com/microsoft/tfs-cli/blob/master/docs/extensions.md)), and the upload subsequently fails — the local file still has v1.0.8, but is uncommitted. Confirmed safe pattern.

**Recovery (if order was wrong and v1.0.8 is lost):**
1. Don't try to "retroactively publish" v1.0.8. Just accept the gap.
2. Update CHANGELOG.md to note the missing version (e.g., "v1.0.8 was bumped in repo but failed to publish; v1.0.9 contains the v1.0.8 changeset plus...").
3. If the gap is unacceptable, manually publish v1.0.8 from a developer machine using `tfx extension publish --override "{\"version\":\"1.0.8\"}"` — but this re-introduces drift (Pitfall 2). Generally not worth it.

**Detection:**
- Post-publish step: re-fetch the Marketplace listing and assert published version equals manifest version. If not, fail the workflow (loud, even though too late).
- Weekly cron: diff `git tag --list` against Marketplace versions. Mismatch opens an issue.

**Phase to address:**
Phase that wires the publish + commit-back + tag sequence. Step ORDER is a hard REQ.

---

### Pitfall 12: Branch protection on master breaks bot push

**What goes wrong:**
Today, `master` has NO branch protection. v1.1 introduces the auto-bump. Six months from now, an admin enables "Require pull request before merging" on `master` (or "Require status checks", or "Restrict who can push"). The bot's direct push from the workflow now fails:
```
remote: error: GH006: Protected branch update failed for refs/heads/master.
remote: error: Required status check "build" is expected.
```
([GitHub community #25305 — Allowing github-actions[bot] to push to protected branch](https://github.com/orgs/community/discussions/25305))

**Symptom:**
Auto-publish workflow fails on the commit-back step, after publish succeeded. Manifest in repo lags Marketplace by one version (Pitfall 11 inverted, with the same recovery pain).

**Prevention (proactive — assume protection will arrive):**
1. **Document the workflow's bypass requirements.** When branch protection is enabled, the admin must EITHER:
   - Add the bot as an allowed bypass actor in the protection rule (GitHub Rulesets feature, available since 2023).
   - Use a GitHub App token instead of `GITHUB_TOKEN`, with the App in the rule's bypass list ([Medium — Letting GitHub Actions push to protected branches](https://medium.com/ninjaneers/letting-github-actions-push-to-protected-branches-a-how-to-57096876850d)).
2. **PR-based bump as fallback:** If neither bypass option is available, the bot opens a PR (`peter-evans/create-pull-request`) with the bumped manifest, and a human (or auto-merge bot) merges it. The publish then fires from the PR-merge commit. Adds latency but works under any protection rule.
3. **For v1.1, since there's no protection today:** ship the simplest direct-push pattern, but ADD a top-of-file YAML comment documenting the migration path:
   ```yaml
   # If branch protection is enabled on master, this workflow's commit-back
   # step will fail. Migration paths:
   #  (a) Add GitHub Actions bot to the protection rule's bypass list.
   #  (b) Switch to peter-evans/create-pull-request and let auto-merge
   #      handle the bump PR.
   #  (c) Use a dedicated GitHub App token (highest-permission, lowest-friction).
   ```

**Detection:**
First time branch protection is enabled, the next merge breaks. Loud. Make sure the runbook flags this as a known interaction.

**Phase to address:**
Phase that wires the commit-back. Documentation REQ; no code change for v1.1 (since no protection exists).

---

### Pitfall 13: Removing the legacy `publish:cezari` script breaks unwritten runbooks

**What goes wrong:**
The milestone explicitly plans to remove the v1.0 `publish:cezari` npm script once the GH Action becomes canonical. But:
- The script may be referenced in `.planning/phases/05-marketplace-ship/` plans (now archived), in commit messages, in the v1.0 audit doc, in any Slack/email runbook the dev keeps in their head.
- Some of the script's flags or environment expectations may encode hard-won knowledge (e.g., "use this exact `--share-with` arg or the publisher swap from `TsezariMshvenieradzeExtensions` to `TsezariMshvenieradzeTfsAiReviewTask` re-stuck-private the listing"). Deleting the script deletes that institutional memory.

**Symptom:**
Six weeks after deletion, an emergency hotfix is needed. Marketplace PAT has expired, the GH Action can't publish, and no one remembers the manual command. The dev tries to reconstruct from memory and ends up republishing under the wrong publisher or with `--share-with` on a public listing.

**Prevention:**

1. **Before deleting, capture the script's content in a Markdown runbook.** `.planning/runbooks/manual-publish.md`:
   ```markdown
   # Manual Publish (Emergency Path)
   When the auto-publish workflow is unavailable (PAT expired, GH outage,
   urgent hotfix), publish manually with:

   ```bash
   npx tfx-cli extension publish \
     --auth-type pat \
     --token "$MARKETPLACE_PAT" \
     --no-prompt \
     --manifest-globs ./vss-extension.json \
     --rev-version
   ```
   Requires:
   - PAT with Marketplace (publish) scope
   - Publisher: TsezariMshvenieradzeTfsAiReviewTask
   - You must be an admin of that publisher in Marketplace (https://marketplace.visualstudio.com/manage)
   ```

2. **Defer the deletion to the LAST plan of the milestone**, after the GH Action has been live and successful for at least one publish cycle. Don't delete-and-pray.

3. **Grep the repo for `publish:cezari` references before deletion.** Any docs, READMEs, or in-code comments that mention it must be updated to point to the runbook.

**Detection:**
- `git grep -F "publish:cezari"` after deletion — should return 0 hits including docs and `.planning/`.
- The runbook is tested by manually invoking it once before deletion, to confirm it actually works in 2026 (not just from training data).

**Phase to address:**
Cleanup phase, last plan of the milestone. Soft delete (rename script to `publish:cezari:legacy` for one cycle) if extra caution is warranted.

---

### Pitfall 14: Tag push and Marketplace publish atomicity

**What goes wrong:**
The milestone says "Push a git tag (vX.Y.Z) on each successful publish." Two failure modes:

- **Order: publish → commit → tag.** Publish succeeds, commit succeeds, tag push fails (network blip, tag-name collision, branch-protection on tag refs). Result: Marketplace has v1.0.8 published, repo has the manifest commit, but tag `v1.0.8` is missing. Next merge: workflow runs, manifest is at v1.0.8, `--rev-version` bumps to v1.0.9, publishes v1.0.9, tags `v1.0.9`. v1.0.8 has no tag, ever.

- **Order: tag → publish.** Tag pushed first (e.g., to trigger a release-notes workflow as the publish gate), publish then fails. Result: tag `v1.0.8` exists in git but Marketplace is on v1.0.7. Next merge: `--rev-version` bumps to v1.0.8 (manifest was committed), tries to push tag `v1.0.8` → "tag already exists" fatal ([release-it#573](https://github.com/release-it/release-it/issues/573), [semantic-release#3994](https://github.com/semantic-release/semantic-release/issues/3994)). Workflow fails on tag step; manual `git tag -d v1.0.8 && git push --delete origin v1.0.8` required to recover.

**Symptom:**
Mismatched git tag list vs Marketplace version list. Manual reconciliation needed. Worst case: workflow stuck failing on tag-already-exists, blocking all further publishes.

**Prevention:**

1. **Canonical order: publish → commit-back → tag, with tag as best-effort.**
   ```yaml
   - name: Publish to Marketplace
     run: npx tfx-cli extension publish ...   # if fails: stop. Repo unchanged.

   - name: Commit bumped manifest
     run: git push origin master              # if fails: Marketplace ahead, repo behind. Manual reconcile.

   - name: Tag release (best-effort)
     continue-on-error: true                  # tag missing is not as bad as Marketplace missing
     run: git tag $V && git push origin $V
   ```
   Justification: Marketplace is the source of truth for "what's shipped". Repo manifest version is the source of truth for "what we'll ship next". Git tag is a NICE-TO-HAVE pointer for human audit. Optimize the ordering to minimize harm at each failure step.

2. **Idempotent tag push** to handle the case where a previous run left a tag:
   ```bash
   if git rev-parse "$V" >/dev/null 2>&1; then
     echo "Tag $V already exists locally — skipping"
   elif git ls-remote --tags origin "$V" | grep -q "$V"; then
     echo "Tag $V already exists on origin — skipping"
   else
     git tag "$V" && git push origin "$V"
   fi
   ```

3. **Reconcile-on-startup step:** On every workflow run, before doing anything, verify (manifest version, git tag list, Marketplace version list) are mutually consistent. If not, fail fast with a diagnostic, don't try to plow through.

**Detection:**
- Cron job (weekly): diff `git tag --list 'v*'` against Marketplace `versions[]`. Surface mismatches as issues.
- Post-publish smoke: `git ls-remote --tags origin "v$VERSION"` returns 1 line.

**Phase to address:**
Phase that wires the tag-push step. The ordering decision is a hard REQ; the idempotency check is a smaller REQ in the same phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Hard-code version with `--override "{\"version\":\"$X\"}"` instead of `--rev-version` | More control over version string (e.g., `1.0.8-rc.1` for prereleases) | Splits the source of truth — manifest and override can drift; Pitfall 2 (drift) becomes much more likely. | Never for stable patches. Acceptable for one-off prerelease publishing if documented. |
| Skip the concurrency block | One less line of YAML | Pitfall 3 (concurrent merges race) becomes a question of "when" not "if". | Never — concurrency is a free guard. |
| Use a PAT for commit-back instead of `GITHUB_TOKEN` | Permits triggering downstream workflows | Re-opens loop risk (Pitfall 1); requires extra PAT-rotation discipline (Pitfall 4). | Only when a downstream workflow MUST trigger AND a GitHub App is unavailable. |
| `continue-on-error: true` on a flaky test | Unblocks publish | Erodes test signal (Pitfall 9). Becomes "how we handle failures" by accretion. | Never for the test step. Acceptable only on best-effort steps (e.g., post-publish smoke that just files an issue). |
| Skip the asset-audit step | Faster CI | Pitfall 6 — broken-icon publishes happen silently. | If the asset list never changes; OK for v1.1 if the manifest is locked. Add the audit before any future asset addition. |
| Run unit tests with `--retry 1` | Fewer flaky failures | Hides a flaky test → real bug ships → harder to debug. | Never — fix the test or quarantine, do not retry. |
| Auto-bump minor instead of patch | Distinguishes "feature" releases | `--rev-version` only bumps patch; minor bumps need `--override` (Pitfall 5 fragility). Adds complexity for no Marketplace-side benefit (Marketplace doesn't surface minor-vs-patch). | Defer minor/major bumps to manual `workflow_dispatch` triggers, not auto. |
| Skip pre-flight Marketplace-version reconciliation | Faster CI by ~3 seconds | Pitfall 2 (drift) is undetectable until it bites. | Never for a public-listing extension. |
| Single-job workflow (build+test+publish in one) | Simpler YAML | Loses concurrency between gate (CPU-bound) and publish (network-bound); harder to skip publish on PR vs run on merge. | Acceptable for v1.1 first iteration; refactor as soon as it gets noisy. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| **GitHub Actions → Marketplace via tfx-cli** | Forget `--no-prompt` → CI hangs 10 min waiting for stdin | `--no-prompt --auth-type pat --token "$MARKETPLACE_PAT"`, all three together |
| **Marketplace publisher account** | PAT created under `cezari@...` identity, but publisher membership is under `tsmshvenieradze@...` → `tfx` reports "extension not found" even though the listing exists | Verify the PAT-creating identity is a member of the publisher group in `https://marketplace.visualstudio.com/manage/publishers/{publisher}`. The publisher swap from `TsezariMshvenieradzeExtensions` to `TsezariMshvenieradzeTfsAiReviewTask` (per project history) is exactly this trap. |
| **GitHub Secrets → workflow YAML** | Reference `${{ secrets.MARKETPLACE_PAT }}` in a `run:` block where the runner echoes the command line (e.g., `set -x`) → secret leaks to logs. GH Actions auto-redacts known secrets, BUT only for direct matches; manipulated secrets (URL-encoded, base64) bypass redaction. | Always pass via `env:` not via inline `${{ }}` interpolation in `run:` shell strings. Never `echo` the secret. Never log it. |
| **`actions/checkout` and commit-back** | Default `actions/checkout` uses `GITHUB_TOKEN` for fetch but credentials don't persist by default for push | Use `actions/checkout@v4` with default `persist-credentials: true` (the default since v3) and don't override. Check this before debugging "permission denied" on push. |
| **`tfx-cli` and Node.js version** | Latest `tfx-cli` requires Node 18+; older runners may default to 16 | Pin `actions/setup-node@v4` with `node-version: '20'` (matches the project's likely dev environment) |
| **Marketplace API and rate limits** | High-frequency PAT validation (Pitfall 4 cron smoke) → throttled | Run cron at 1× per week, not per day. 7-day cadence is the sweet spot for "catch expiry 7 days early without hammering API". |
| **Existing v1.0 `publish:cezari` script** | Deleting before the GH Action is verified live | Keep both for at least one publish cycle, then delete. Capture the working command in a runbook BEFORE delete. |

## Performance Traps

Auto-publish is a low-traffic CI path (≤ a few merges per day). Performance is rarely the constraint. Two traps anyway:

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| **Webpack production build cold-cache on every run** | Build time 90+ sec on a 4-core runner | `actions/cache` keyed on `package-lock.json` hash — cache `node_modules` AND webpack's filesystem cache (`.cache/webpack`) | Once you cross ~5 merges/day, cold builds add up; not a v1.1 concern. |
| **`tfx extension publish` upload over slow runner network** | Sporadic 5-min uploads (vs typical 30 sec) | None within our control — Marketplace endpoint is in Azure, GH runners are in AWS, occasional latency. Set workflow `timeout-minutes: 10` so a stuck run fails loud. | Once per few hundred runs; insurance is the timeout. |

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Storing Marketplace PAT in repo (`.env`, `secrets.json`) | Repo compromise → publisher takeover → malicious extension shipped to all installs of `story-point-calculator` (today: 0; tomorrow: many) | Always `secrets.MARKETPLACE_PAT` from GH repo settings; never in source. Smoke: `git grep -F 'azdo.dev'` and similar PAT-prefix searches in pre-commit hook. |
| `permissions: write-all` (or default-write at repo settings level) | Compromised dependency exfiltrates `GITHUB_TOKEN` → repo-wide write → release tampering, malicious releases | Top-level `permissions: contents: read`, expand per-job (Pitfall 10). Set repo Settings → Actions → Workflow permissions to "Read repository contents and packages permissions" as default. |
| Using a long-lived (1+ year) PAT instead of rotating | Compromised PAT remains active across releases | Pin org policy to 90-day max PAT lifespan (Pitfall 4). Cron'd smoke test catches expiry. |
| `pull_request_target` instead of `pull_request` for any PR-validation workflow | `pull_request_target` runs in the trunk's context with secrets — fork PR can exfiltrate | Use `pull_request` (no secrets) for any contributor-facing validation. The publish workflow runs on `push` to master, so this is moot for v1.1 — but flag for future PR-gating workflows. |
| Echo PAT in logs accidentally | PAT leaked to public Actions log (if repo is public, anyone can read it) | Pass via `env:`, never via inline expansion. Add `secret-detection` Action as defense-in-depth ([GitHub Advanced Security or `gitleaks-action`](https://github.com/gitleaks/gitleaks-action)). |
| Trust unpinned third-party Actions (`uses: foo/bar@main`) | Maintainer compromise → arbitrary code in CI with `GITHUB_TOKEN` | Pin all `uses:` to commit SHA, not branch or version tag. Renovate/Dependabot keeps SHAs current. |

## UX Pitfalls

Auto-publish has minimal user-facing UX (the listing itself is the UX). Two:

| Pitfall | User Impact | Better Approach |
|---|---|---|
| Listing version updates faster than user-facing changelog | User sees "v1.0.20 — released 2 hours ago" but the listing's "What's New" section says "v1.0.7" | Add a CHANGELOG.md update step in the workflow, OR update overview.md with version-aware content via `overrides-file` injection. Defer to v1.2 — accept stale changelog for v1.1. |
| Bundle bloat → modal load lag | "Calculate SP" button → modal takes 3+ seconds (vs current ~500ms with 147 KB bundle) | Bundle gate (Pitfall 8) keeps this in check. |

## "Looks Done But Isn't" Checklist

After v1.1 ships and the first auto-publish completes, manually verify:

- [ ] **Marketplace listing renders correctly:** Open `https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator`. Icon visible, overview text present, version reflects the new patch.
- [ ] **`vss-extension.json` and `package.json` agree on version:** `git diff HEAD~1 vss-extension.json` shows version bumped; same for `package.json`.
- [ ] **Git tag `v1.0.N` exists on origin:** `git ls-remote --tags origin "v1.0.*" | tail -1` matches manifest version.
- [ ] **Workflow run shows green on every step (no `continue-on-error` masking failures):** Check Actions → completed run, expand each job, verify no yellow ⚠ or skipped-due-to-failure steps.
- [ ] **The next push to master does NOT loop:** After the auto-bump commit, watch the Actions tab for 2 minutes. Should be quiet.
- [ ] **Marketplace PAT smoke workflow exists and ran successfully at least once:** Find it in Actions list; verify last run is green.
- [ ] **`publish:cezari` legacy npm script removal hasn't orphaned any docs:** `git grep -F 'publish:cezari' .` returns no hits (or only in `.planning/milestones/v1.0-*` archive files, which is OK).
- [ ] **Workflow concurrency block is present:** `grep -A2 'concurrency:' .github/workflows/*.yml` shows `cancel-in-progress: false`.
- [ ] **`permissions:` block at workflow top is `contents: read`, not write-all:** `grep -A3 'permissions:' .github/workflows/*.yml`.
- [ ] **`[skip ci]` token is in the auto-bump commit message:** `git log -1 --format=%B HEAD` after a bump should contain the literal string `[skip ci]`.
- [ ] **First user (or you) installs the new version into a test ADO org:** Open a work item, click "Calculate SP", verify the modal still works end-to-end. The publish pipeline is irrelevant if the shipped artifact is broken.
- [ ] **Bundle size is still ≤250 KB gzipped on the published `.vsix`:** Download from Marketplace, unzip, run `gzip-size dist/*.js`, verify.
- [ ] **The runbook for manual emergency publish exists and was tested once:** `.planning/runbooks/manual-publish.md` is in the repo and the listed command was run successfully at least once.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| Pitfall 1 (CI loop) | LOW (if caught fast) | Disable workflow (Settings → Actions → Disable workflow). Remove the offending PAT. Re-enable. Audit log of accidental publishes; accept the version churn (Marketplace doesn't let you delete versions, only mark deprecated). |
| Pitfall 2 (version drift) | LOW–MEDIUM | Pull current Marketplace version. Bump manifest to one above. Commit `chore(release): reconcile [skip ci]`. Re-run workflow. Skipped tags can be retroactively created from any commit SHA. |
| Pitfall 3 (concurrent race) | MEDIUM | Manually identify which PR's content reached Marketplace. Cherry-pick the loser's commits if they're missing. Force-publish a v1.0.N+1 with both PRs' changes. Update changelog noting the conflation. |
| Pitfall 4 (PAT expired) | LOW | Rotate PAT (5 min). Update GH secret. Re-run failed workflow. |
| Pitfall 5 (`tfx` flag bug) | LOW (if pre-publish) | Fix the workflow YAML, re-run. (HIGH if a malformed publish made it through and shipped wrong version/scope — see Pitfall 11 recovery.) |
| Pitfall 6 (asset regression) | LOW–MEDIUM | Fix `vss-extension.json` `files[]` or asset paths. Bump version. Re-publish. The previous version with broken assets stays in Marketplace history but is superseded. |
| Pitfall 7 (GITHUB_TOKEN no-trigger) | LOW (documentation only) | If a downstream workflow doesn't fire, swap to PAT or GitHub App token. |
| Pitfall 8 (bundle bloat shipped) | MEDIUM | Investigate the regression (likely a new dep or unused tree-shake breakage). Fix and re-publish a smaller version. The bloated version stays in history. |
| Pitfall 9 (flaky test) | MEDIUM | Identify the flake (timer leakage, mock state, snapshot drift). Fix or quarantine. Resist `retry: N`. |
| Pitfall 10 (over-broad permissions) | LOW (preventive) | Add minimal `permissions:` block. Audit recent runs for any PAT/secret exfiltration via GitHub Audit log. If a compromise occurred: rotate ALL tokens, force-push trusted history, audit the listing for tampering. |
| Pitfall 11 (publish OK, commit failed) / (publish failed, commit OK) | MEDIUM | Reverse-order pattern (Pitfall 11 prevention) makes "publish failed, commit OK" impossible. "Publish OK, commit failed" requires manual `git push` of the bumped manifest. |
| Pitfall 12 (branch protection) | MEDIUM | Add bot to bypass list, OR switch to PR-based bump pattern. |
| Pitfall 13 (orphaned references to legacy script) | LOW | `git grep` and update each reference. Keep runbook in lockstep. |
| Pitfall 14 (tag-publish atomicity) | LOW | Idempotent tag-push prevents most cases. Manual `git tag -d` + `git push --delete origin tagname` recovers stuck "tag already exists". |

## Pitfall-to-Phase Mapping

Suggested phase ordering (the roadmapper will use this):

| Pitfall | Prevention Phase (suggested) | Verification |
|---|---|---|
| 1 — CI loop | Phase 2 (Version bump + commit-back) | Smoke: trigger workflow twice manually, verify second run does not run a third time |
| 2 — Version drift | Phase 3 (Publish step) | Pre-flight reconciliation step; manually drift the manifest and confirm pre-flight fails |
| 3 — Concurrent race | Phase 1 (Workflow scaffold) — concurrency block is part of initial workflow | Manual `workflow_dispatch` trigger × 2 in quick succession; verify second run queues |
| 4 — PAT expiry | Phase 3 (Publish step) + dedicated cron workflow | Smoke workflow exists; PAT rotation runbook documented |
| 5 — `tfx` flag traps | Phase 3 (Publish step) | Code review on the publish step's exact command line; CODEOWNERS pin the YAML |
| 6 — Listing-asset regression | Phase 1 or 2 (build / pre-flight gates) | Asset-audit step in pre-flight; manual visual check of listing after first publish |
| 7 — GITHUB_TOKEN no-trigger | Phase 4 (Tag push) | Documentation in YAML comment; first downstream-workflow addition (out of v1.1 scope) tests this |
| 8 — Bundle bloat | Phase 1 (Workflow scaffold) — re-use v1.0 bundle gate | DAG `if:` check on publish job; smoke against shipped `.vsix` |
| 9 — Test flakiness | Phase 1 (Workflow scaffold) | `vitest run` with no retries; quarantine procedure in CONTRIBUTING.md |
| 10 — Over-broad permissions | Phase 1 (Workflow scaffold) | Lint with `actionlint`; PR review checklist |
| 11 — Failed publish post-bump | Phase 3 (Publish step) — order is publish → commit → tag | Inject a fake publish failure in dry-run; verify repo state unchanged |
| 12 — Branch protection | Phase 5 (Cleanup / docs) — documentation only | Top-of-file YAML comment; runbook entry |
| 13 — Legacy script removal | Phase 5 (Cleanup) — last plan | `git grep` returns 0 hits in non-archive paths; runbook tested once |
| 14 — Tag atomicity | Phase 4 (Tag push) | Idempotent tag-push step; weekly cron diff of tags vs Marketplace versions |

## Sources

**Primary (authoritative):**
- [Microsoft Learn — Publish an Azure DevOps Extension From the Command Line](https://learn.microsoft.com/en-us/azure/devops/extend/publish/command-line?view=azure-devops) — `tfx extension publish` flags, error codes, version-must-increase rule
- [Microsoft Learn — Package and publish extensions overview](https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview?view=azure-devops) — Publisher / sharing / public flag semantics
- [Microsoft Learn — Extension Manifest Reference](https://learn.microsoft.com/en-us/azure/devops/extend/develop/manifest?view=azure-devops) — `public`, `galleryFlags`, `files[]`, asset references
- [microsoft/tfs-cli — extensions.md](https://github.com/microsoft/tfs-cli/blob/master/docs/extensions.md) — `--rev-version`, `--share-with`, `--no-prompt`, `--manifest-globs`, `--token`, `--auth-type` reference
- [GitHub Docs — GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token) — recursive-trigger guard
- [GitHub Docs — Triggering a workflow](https://docs.github.com/actions/using-workflows/triggering-a-workflow) — `GITHUB_TOKEN` push does NOT trigger downstream
- [GitHub Docs — Skipping workflow runs](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/skipping-workflow-runs) — `[skip ci]` exact tokens
- [GitHub Docs — Control concurrency](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs) — `concurrency:` group, `cancel-in-progress`
- [GitHub Docs — Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use) — `permissions:` block
- [GitHub Changelog — Skip [skip ci] support](https://github.blog/changelog/2021-02-08-github-actions-skip-pull-request-and-push-workflows-with-skip-ci/)
- [GitHub Changelog — Control GITHUB_TOKEN permissions](https://github.blog/changelog/2021-04-20-github-actions-control-permissions-for-github_token/)

**Secondary (community / discussions):**
- [GitHub Discussion #25702 — Push from Action does not trigger subsequent action](https://github.com/orgs/community/discussions/25702)
- [GitHub Discussion #26970 — Workflow infinite loop](https://github.com/orgs/community/discussions/26970)
- [GitHub Discussion #41518 — Concurrency cancels previously pending workflows](https://github.com/orgs/community/discussions/41518)
- [GitHub Discussion #25305 — Allowing github-actions[bot] to push to protected branch](https://github.com/orgs/community/discussions/25305)
- [microsoft/azure-devops-extension-tasks#163 — 401 even when PAT is valid](https://github.com/microsoft/azure-devops-extension-tasks/issues/163)
- [microsoft/tfs-cli#455 — `tfx` not using cached PAT](https://github.com/microsoft/tfs-cli/issues/455)
- [Azure DevOps Blog — Publishing extensions to Marketplace issue resolved](https://devblogs.microsoft.com/devops/publishing-extensions-to-marketplace-issue-resolved/) — PATs with Marketplace (publish) scope
- [Azure DevOps Blog — Retirement of Global Personal Access Tokens](https://devblogs.microsoft.com/devops/retirement-of-global-personal-access-tokens-in-azure-devops/) — 2026-12-01 deprecation
- [Microsoft Learn — Manage PATs with policies](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/manage-pats-with-policies-for-administrators?view=azure-devops) — PAT lifespan policies

**Test-flakiness sources:**
- [Vitest — retry config](https://vitest.dev/config/retry)
- [Mergify — Vitest flaky patterns](https://mergify.com/flaky-tests/vitest/)
- [Trunk.io — Avoid and detect flaky tests in Vitest](https://trunk.io/blog/how-to-avoid-and-detect-flaky-tests-in-vitest)

**Tag drift sources:**
- [semantic-release#3994 — fatal: tag already exists](https://github.com/semantic-release/semantic-release/issues/3994)
- [release-it#573 — fatal: tag already exists](https://github.com/release-it/release-it/issues/573)
- [semantic-release#2381 — Revert next version Git tag if publishing fails](https://github.com/semantic-release/semantic-release/issues/2381)

**Workload identity (deferred mitigation reference):**
- [Jesse Houwing — Publish Azure DevOps Extensions using Workload Identity OIDC](https://jessehouwing.net/publish-azure-devops-extensions-using-workload-identity-oidc/)

**Branch protection bot pattern:**
- [Medium — Letting GitHub Actions Push to Protected Branches](https://medium.com/ninjaneers/letting-github-actions-push-to-protected-branches-a-how-to-57096876850d)

---
*Pitfalls research for: GitHub Actions auto-publish for Azure DevOps Marketplace extension — v1.1 milestone, atop existing public listing at v1.0.7*
*Researched: 2026-05-05*
