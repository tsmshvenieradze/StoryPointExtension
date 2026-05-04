# Architecture Research — v1.1 Auto-Publish CI/CD

> Reconstructed from gsd-project-researcher transcript (the agent received a system reminder that suppressed its file write; findings restored verbatim from its return message). Confidence: HIGH for structural decisions, MEDIUM for specific GitHub Actions task flag names.

## Critical Discovery (read first)

`.github/workflows/ci.yml` **already exists** at the repo. It runs `npm ci → typecheck → test → build → check:size` on `push: [master]` AND `pull_request: [master]`, with `concurrency: ci-${{ github.ref }}, cancel-in-progress: true`.

Implication: v1.1 is **extending an existing CI surface**, not greenfield. The "single workflow vs multiple workflows" question has a near-mandatory answer — **two workflows**, because PR runs must NOT publish.

## 1. Workflow file structure — TWO workflows

| File | Trigger | Purpose | Status |
|------|---------|---------|--------|
| `.github/workflows/ci.yml` | `pull_request: [master]` only (REMOVE `push: [master]` from existing trigger) | PR pre-flight gates. No publish, no bump, no tag. | EXISTS — modify |
| `.github/workflows/publish.yml` | `push: [master]` (with `[skip ci]` guard) + `workflow_dispatch` | Re-runs the same gates, then bumps + packages + publishes + tags | NEW |

**Rationale:**
- Defense in depth — a `pull_request` event physically cannot trigger publish.yml because it doesn't include that trigger. No `if:` typo can leak.
- Manual re-run via `workflow_dispatch` is scoped to publish.yml only.
- The two YAMLs share only ~6 lines of setup; duplication cost is low. **Composite action / `workflow_call` reuse is rejected as overkill** for a small milestone.

## 2. Job graph — single job, sequential steps

```
publish-and-release (job)
  └─ steps (sequential, fail-fast):
      1. checkout       (actions/checkout@v4 with fetch-depth: 0)
      2. setup-node     (actions/setup-node@v4, node 20, cache npm)
      3. install        (npm ci)
      4. typecheck      (npm run typecheck)
      5. test           (npm test -- --run)
      6. build          (npm run build)
      7. check:size     (npm run check:size)
      8. compute-version  (read package.json.version → patch+1; export NEXT_VERSION)
      9. bump-files     (write package.json + vss-extension.json with NEXT_VERSION)
     10. package-vsix   (npx tfx extension create --output-path dist/)
     11. upload-artifact (actions/upload-artifact@v4, retention 90d)
     12. publish-vsix   (npx tfx extension publish --vsix dist/*.vsix --token "$TFX_PAT" --no-wait-validation)
     13. commit-and-tag (commit "[skip ci] chore(release): vX.Y.Z" → tag → push origin master --tags)
```

**Why single job, not parallel jobs:**
- Steps 8–13 are a dependency chain.
- Steps 4–7 *could* parallelize, but full sequence runs in <2 min; job-startup overhead (~20s/job) eats savings.
- Single job keeps `dist/` on the same runner — no artifact upload/download between jobs.

**`[skip ci]` guard (FIRST step):**

```yaml
- name: Skip if release commit
  id: skip
  run: |
    msg=$(git log -1 --pretty=%B)
    if echo "$msg" | grep -qE '\[skip ci\]'; then
      echo "skip=true" >> $GITHUB_OUTPUT
    fi
- name: Exit cleanly
  if: steps.skip.outputs.skip == 'true'
  run: exit 0
```

GitHub Actions DOES natively honor `[skip ci]` since 2021 (per Features research), but defense-in-depth still wants the guard step in case `GITHUB_TOKEN` is replaced by a PAT later.

## 3. State flow — Option B (bump in-memory, publish first, commit+tag last)

| Scenario | Option A (commit bump → publish → tag) | Option B (bump in-memory → publish → commit+tag) |
|----------|-----------------|-----------------|
| Publish succeeds | clean | clean |
| Publish fails | master at v1.0.8 already pushed; Marketplace at v1.0.7 — manual reconciliation | Nothing committed; nothing tagged; Marketplace at v1.0.7 — **self-healing** on re-run |
| Push-back fails after publish | Tag failed → operator re-pushes manually; recoverable | Commit didn't happen → master at v1.0.7 in git, Marketplace at v1.0.8 — operator runs `git tag v1.0.8 HEAD; git commit --allow-empty; git push --tags` |

**Option B's failure window is ~5–10× smaller** because GitHub push reliability >> Marketplace publish reliability.

**Concrete state-flow:**

```
Step 8  (compute):    CURRENT=package.json.version → NEXT="1.0.8" → export.
Step 9  (bump):       jq/sed-write package.json + vss-extension.json with NEXT.
                      ✗ NO commit yet. Files dirty in runner workspace only.
Step 10 (package):    tfx extension create — produces .vsix labeled v1.0.8.
Step 11 (upload):     upload .vsix as workflow artifact.
Step 12 (publish):    POINT OF NO RETURN. If success, v1.0.8 in Marketplace. If failure, master still at v1.0.7, re-runnable.
Step 13 (commit+tag): NOW commit + tag + push.
```

**Bump implementation:** `scripts/bump-version.mjs` (NEW, ESM, ~30 lines, atomic write of both files). `npm version patch` is rejected because it auto-commits/auto-tags and doesn't touch `vss-extension.json`.

**Rejected: derive version from git tags.** Adds complexity, requires `fetch-depth: 0`, source-of-truth question becomes "tag or manifest?". Stick with package.json as canonical.

## 4. Permissions model

**publish.yml workflow permissions block:**
```yaml
permissions:
  contents: write    # for the bump-back commit + tag push
```

That's the complete list. Do NOT add `actions: read`, `pull-requests: write`, `packages: write`, or `id-token: write`.

**ci.yml** (after stripping `push: [master]`) needs no `permissions:` block — read-only.

**Marketplace PAT — three secrets:**

| Secret name | Source | Used for | Scope |
|-------------|--------|----------|-------|
| `TFX_PAT` | New Marketplace PAT (stored as repo secret) | `tfx extension publish --token` | Marketplace → Manage |
| `secrets.GITHUB_TOKEN` | Auto-provisioned | `git push` of bump commit + tag | `contents: write` |
| `RELEASE_PAT` (only if branch protection blocks GITHUB_TOKEN) | New GitHub PAT, `repo` scope | Override branch protection | Repo |

**Branch protection caveat:** if master is protected, `GITHUB_TOKEN` push-back is rejected. Current commit history shows master is NOT protected today. **Phase 6 should include a one-line verification step** ("are there branch protection rules on master?").

## 5. Build artifact location

Two-step pattern (recommended over one-step `tfx extension publish --manifest-globs`):

```bash
npx tfx extension create --manifest-globs vss-extension.json --output-path dist/
npx tfx extension publish --vsix dist/<pub>.<id>-<ver>.vsix --token "$TFX_PAT" --no-wait-validation
```

The two-step pattern gives a tangible artifact between create and publish for traceability.

**Workflow artifact upload — YES:**
```yaml
- uses: actions/upload-artifact@v4
  with:
    name: vsix-${{ env.NEXT_VERSION }}
    path: dist/*.vsix
    retention-days: 90
    if-no-files-found: error
```

Marketplace doesn't expose a "download what you uploaded" endpoint. Artifact lets operators inspect the published .vsix post-mortem.

## 6. Integration points with existing config

**NEW files:**
- `.github/workflows/publish.yml`
- `scripts/bump-version.mjs`

**MODIFIED files:**
- `.github/workflows/ci.yml` — remove `push: [master]` from `on:` (PR-only)
- `package.json` — REMOVE `publish:cezari` and `publish:public`; auto-mutated by CI on `version` field
- `vss-extension.json` — auto-mutated by CI on `version` field

**DELETE:**
- `scripts/publish-cezari.cjs`

**UNCHANGED:**
- `vitest.config.ts`, `webpack.config.cjs`, `tsconfig.json`, `.gitignore`, `.npmrc`, `LICENSE`, `overview.md`, `README.md`, `src/**`, `tests/**`

## 7. Concurrency

**publish.yml:**
```yaml
concurrency:
  group: publish-master
  cancel-in-progress: false
```

**Why `cancel-in-progress: false`:** publish is non-idempotent state-mutating side effect. Cancelling mid-flight could leave Marketplace at v1.0.8 with master not yet at v1.0.8.

**Why fixed group `publish-master`:** only master triggers publish; ref dimension adds nothing; fixed group enforces strict serialization.

**ci.yml** keeps existing `concurrency: ci-${{ github.ref }}, cancel-in-progress: true` — PR cancel-on-force-push is correct.

## 8. Suggested phase split — 3 phases

**Phase 6: Workflow scaffolding + pre-flight gate split** (low risk, no Marketplace touch)
- Modify `.github/workflows/ci.yml` to remove `push: [master]` (PR-only).
- Create `.github/workflows/publish.yml` with steps 1–7 only (pre-flight gates) + stub final step echoing the would-be NEXT_VERSION. NO bump, NO publish, NO tag.
- Verify: feature branch → ci.yml on PR; merge → publish.yml runs and reports "would publish v1.0.8" but doesn't.
- Exit criteria: end-to-end plumbing works; secrets resolve; PAT secret exists in repo settings; no Marketplace state changed.

**Phase 7: Bump + publish + tag** (Marketplace state mutation)
- Add `scripts/bump-version.mjs`.
- Add steps 8–13 to publish.yml.
- Verify: real merge → v1.0.8 in Marketplace → "[skip ci] chore(release): v1.0.8" commit on master → tag v1.0.8 → guard prevents re-run.

**Phase 8: Cleanup** (low risk, pure removal)
- Delete `scripts/publish-cezari.cjs`.
- Remove `publish:cezari` and `publish:public` from package.json.
- Update PROJECT.md "Validated" with v1.1 milestone summary.

## Confidence

| Area | Confidence |
|------|------------|
| Two-workflow split | HIGH |
| Single-job sequential steps | HIGH |
| Option B (bump in-memory) | HIGH |
| `permissions: contents: write` only | HIGH |
| `[skip ci]` guard | HIGH |
| Concurrency `cancel-in-progress: false` | HIGH |
| `tfx extension create` two-step pattern | MEDIUM (verify CLI flag names at execution) |
| 3-phase split | HIGH |

## Open Questions

1. Is master branch-protected? (Determines RELEASE_PAT need.)
2. Should first publish.yml run be private `--share-with cezari` smoke or straight to public? Recommendation: skip private smoke; Phase 7 first publish IS the smoke (cost of failure low under Option B).
3. Existing `*.vsix` at repo root is uncommitted; `.gitignore` rule already covers `*.vsix`. No change needed.

## Sources

- [tfx-cli extension commands](https://github.com/microsoft/tfs-cli/blob/master/docs/extensions.md)
- [Microsoft Learn: Publish from CLI](https://learn.microsoft.com/en-us/azure/devops/extend/publish/command-line)
- [microsoft/azure-devops-extension-tasks](https://github.com/microsoft/azure-devops-extension-tasks)
- [Commitizen GitHub Actions tutorial](https://commitizen-tools.github.io/commitizen/tutorials/github_actions/)
- [tfs-cli #455 — PAT handling](https://github.com/microsoft/tfs-cli/issues/455)
