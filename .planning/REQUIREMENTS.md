# Requirements — Milestone v1.1: Auto-Publish CI/CD

**Goal:** Every PR merge to master ships a new patch version of the Marketplace extension automatically via GitHub Actions + tfx-cli, with no manual steps.

**Phases:** 3 (continued numbering: Phase 6 → 7 → 8)
**Source of synthesis:** `.planning/research/SUMMARY.md` (commit `63e97b0`)

---

## v1.1 Requirements

### CI — CI Workflow Plumbing

- [ ] **CI-01**: `.github/workflows/publish.yml` triggers on `push: [master]` and `workflow_dispatch`
- [ ] **CI-02**: `.github/workflows/ci.yml` drops `push: [master]` from triggers (PR-only after migration)
- [ ] **CI-03**: `paths-ignore` on publish.yml excludes docs-only commits (`**.md`, `.planning/**`, `.claude/**`, `docs/**`)
- [ ] **CI-04**: Concurrency `group: publish-master, cancel-in-progress: false` (queue, never cancel mid-publish)
- [ ] **CI-05**: Top-level `permissions: contents: read`; publish job upgrades to `contents: write`
- [ ] **CI-06**: Actor-guard `if: github.actor != 'github-actions[bot]'` on publish job (defense-in-depth against re-trigger)
- [ ] **CI-07**: Runner is `ubuntu-latest` (matches existing `ci.yml`; sidesteps Windows `tfx-cli` quirks)
- [ ] **CI-08**: Pinned action versions: `actions/checkout@v5`, `actions/setup-node@v4` (Node 20 + cache npm), `actions/upload-artifact@v4`, `stefanzweifel/git-auto-commit-action@v6`

### GATE — Pre-flight Gates

- [ ] **GATE-01**: `npm ci` step uses npm cache from setup-node
- [ ] **GATE-02**: Typecheck step (`npm run typecheck`)
- [ ] **GATE-03**: Unit test step (`npm test -- --run`); no retries
- [ ] **GATE-04**: Build step (`npm run build` — webpack production)
- [ ] **GATE-05**: Bundle-size gate (`npm run check:size`); ≤ 250 KB gzipped (carry-over from v1.0 PKG-06)
- [ ] **GATE-06**: Any gate failure stops the workflow before bump (no Marketplace mutation)
- [ ] **GATE-07**: Pre-publish asset audit step — verify all `vss-extension.json` `files[]` paths exist on disk before `tfx extension create`

### BUMP — Version Bump

- [ ] **BUMP-01**: `scripts/bump-version.mjs` (ESM) writes `package.json` + `vss-extension.json` atomically with the next patch version
- [ ] **BUMP-02**: Bumps patch only — no minor / major auto-detection (conventional-commits parsing is out of scope for v1.1)
- [ ] **BUMP-03**: Bump runs after gates pass, before `tfx extension create`
- [ ] **BUMP-04**: Bump is in-memory only (workspace files modified, NO git commit yet) — Option B reversibility
- [ ] **BUMP-05**: Vitest unit test for `bump-version.mjs` happy-path (atomic two-file write)

### PUBLISH — Marketplace Publish

- [ ] **PUBLISH-01**: `npx tfx extension create --manifest-globs vss-extension.json --output-path dist/` produces the `.vsix`
- [ ] **PUBLISH-02**: `actions/upload-artifact@v4` uploads the `.vsix` (90-day retention, `if-no-files-found: error`)
- [ ] **PUBLISH-03**: `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation`
- [ ] **PUBLISH-04**: `TFX_PAT` repo secret (scope: `Marketplace (publish)` only; org: "All accessible organizations"; lifespan: 1 year max)
- [ ] **PUBLISH-05**: Publish failure aborts the workflow before commit-back and tag (Option B leaves master at the prior version)

### TAG — Commit-back & Release Tag

- [ ] **TAG-01**: Bump commit pushed to master via `stefanzweifel/git-auto-commit-action@v6` with message `chore(release): vX.Y.Z [skip ci]`
- [ ] **TAG-02**: Commit uses default `GITHUB_TOKEN` (no PAT or GitHub App while master is unprotected)
- [ ] **TAG-03**: Annotated git tag `vX.Y.Z` pushed after publish + commit succeed
- [ ] **TAG-04**: Tag step is best-effort (`continue-on-error: true`); idempotent (skip if tag exists locally or on origin); workflow stays green on tag failure

### FAIL — Failure Handling

- [ ] **FAIL-01**: Workflow fails fast on any step error (no auto-retry, no exponential backoff)
- [ ] **FAIL-02**: GitHub default failure email is the only notification (no Slack / Teams / Discord)
- [ ] **FAIL-03**: `workflow_dispatch` enables manual re-run from the Actions UI

### CLEAN — Legacy Cleanup

- [ ] **CLEAN-01**: After Phase 7's first green auto-publish, archive `scripts/publish-cezari.cjs` to `scripts/.archive/publish-cezari.cjs`
- [ ] **CLEAN-02**: Remove `publish:cezari` and `publish:public` npm scripts from `package.json`
- [ ] **CLEAN-03**: `git grep -F 'publish:cezari'` returns 0 hits outside `scripts/.archive/` and `.planning/`

### DOC — Documentation

- [ ] **DOC-01**: `.planning/OPERATIONS.md` documents the PAT rotation procedure (1-year cadence + step-by-step on aex.dev.azure.com)
- [x] **DOC-02**: `.planning/OPERATIONS.md` documents the manual emergency-publish runbook (the exact `tfx` invocation captured BEFORE the legacy script is archived)
- [ ] **DOC-03**: `.planning/PROJECT.md` "Validated" section updated post-milestone (v1.1 capabilities promoted from Active to Validated)

**Total v1.1 requirements: 38** (8 CI + 7 GATE + 5 BUMP + 5 PUBLISH + 4 TAG + 3 FAIL + 3 CLEAN + 3 DOC) — corrected from earlier "32" tally on 2026-05-05 by gsd-roadmapper during traceability fill.

---

## Future Requirements (deferred to v1.2+)

Picked from SUMMARY's "Differentiators" column. Not blockers; revisit when v1.1 has shipped a few releases.

- **PAT-smoke cron** — weekly workflow that authenticates against Marketplace without publishing, alerts on PAT expiry before the first red merge
- **Branch-protection-aware push** — if/when master gets protection rules, switch commit-back to GitHub App or `RELEASE_PAT` with bypass list
- **Marketplace-version reconciliation** — pre-flight step that compares manifest version to Marketplace's current version and aborts on drift (catches manual `publish:cezari` runs that bypassed CI)
- **Conventional-commits-driven semver** — parse `feat:` / `fix:` / `BREAKING:` from PR title to bump minor / major instead of patch-only
- **CHANGELOG.md auto-generation** — pair with conventional-commits
- **Bundle size trend reporting on PRs** — historical view rather than a hard gate
- **Multi-environment staged promote** — first to private (`--share-with cezari`) then to public after manual approval

## Out of Scope (explicit anti-features)

Not in v1.1, not in v1.2, not on the roadmap unless requirements change. Each excluded with a reason so future contributors don't "improve" the milestone into adding them.

- **GitHub Releases auto-creation** — Marketplace listing IS the user-facing release surface; GitHub releases would duplicate without adding value for end users (Marketplace customers don't read GitHub).
- **Auto-merge of Dependabot PRs into the publish flow** — every dependency bump shipping is a recipe for breakage; PRs should still be human-reviewed.
- **Codecov / coverage upload** — `vitest` already enforces 100% coverage on `src/calc/**` and `src/audit/**` via threshold; uploading a duplicate report adds no signal.
- **ESLint / Prettier addition** — separate concern from auto-publish; no v1.0 deferral asked for it.
- **E2E / Playwright tests against a live ADO org** — out-of-scope per CLAUDE.md ("Manual QA does UI testing per company standard").
- **Rollback automation** — Marketplace doesn't support un-publish; the only rollback is publishing a higher version with the previous code, which is just a normal release.
- **Slack / Teams / email notifications beyond the GH default failure email** — user explicitly chose "Fail the run; manual retry" with no notification surface during questioning.
- **Auto-retry on transient Marketplace 5xx** — user explicitly chose "Fail the run; manual retry" — no auto-retry.
- **Pinning runner OS to a SHA** — `ubuntu-latest` rolls 24.04 → 25.04 over time; pinning adds maintenance for marginal stability gain on a 5-min job.
- **`tfx --rev-version`** — only mutates `vss-extension.json`, not `package.json`; defeats single-source-of-truth on version. Replaced by `bump-version.mjs`.
- **Microsoft Entra / OIDC publishing** — documented for Azure Pipelines, NOT GitHub Actions; revisit when global-PAT decommission deadline (2026-12-01) approaches.
- **GitHub App / `RELEASE_PAT` for commit-back** — not needed while master is unprotected; would add a second secret to rotate. Deferred until branch protection is added.
- **Marketplace screenshot regeneration (PKG-05 carry-over from v1.0)** — orthogonal milestone; not part of CI/CD.
- **Pre-fill APPLY-03 production fix (v1.0 carry-over)** — separate code-fix milestone, not infrastructure.

---

## Traceability

Filled by gsd-roadmapper on 2026-05-05 after producing `.planning/ROADMAP.md`. Every v1.1 requirement maps to exactly one phase. Coverage: 38/38.

| REQ-ID | Phase | Status |
|--------|-------|--------|
| CI-01 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| CI-02 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| CI-03 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| CI-04 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| CI-05 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| CI-06 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| CI-07 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| CI-08 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| GATE-01 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| GATE-02 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| GATE-03 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| GATE-04 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| GATE-05 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| GATE-06 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| GATE-07 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| FAIL-01 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| FAIL-02 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| FAIL-03 | Phase 6 — Workflow Scaffold & Pre-flight Gates | Pending |
| BUMP-01 | Phase 7 — Bump, Publish, Tag | Pending |
| BUMP-02 | Phase 7 — Bump, Publish, Tag | Pending |
| BUMP-03 | Phase 7 — Bump, Publish, Tag | Pending |
| BUMP-04 | Phase 7 — Bump, Publish, Tag | Pending |
| BUMP-05 | Phase 7 — Bump, Publish, Tag | Pending |
| PUBLISH-01 | Phase 7 — Bump, Publish, Tag | Pending |
| PUBLISH-02 | Phase 7 — Bump, Publish, Tag | Pending |
| PUBLISH-03 | Phase 7 — Bump, Publish, Tag | Pending |
| PUBLISH-04 | Phase 7 — Bump, Publish, Tag | Pending |
| PUBLISH-05 | Phase 7 — Bump, Publish, Tag | Pending |
| TAG-01 | Phase 7 — Bump, Publish, Tag | Pending |
| TAG-02 | Phase 7 — Bump, Publish, Tag | Pending |
| TAG-03 | Phase 7 — Bump, Publish, Tag | Pending |
| TAG-04 | Phase 7 — Bump, Publish, Tag | Pending |
| CLEAN-01 | Phase 8 — Cleanup & Runbooks | Pending |
| CLEAN-02 | Phase 8 — Cleanup & Runbooks | Pending |
| CLEAN-03 | Phase 8 — Cleanup & Runbooks | Pending |
| DOC-01 | Phase 8 — Cleanup & Runbooks | Pending |
| DOC-02 | Phase 8 — Cleanup & Runbooks | Complete |
| DOC-03 | Phase 8 — Cleanup & Runbooks | Pending |

**Coverage:** 38/38 mapped. No orphans. No duplicates.

**Phase distribution:** Phase 6 = 18 reqs (CI 8 + GATE 7 + FAIL 3); Phase 7 = 14 reqs (BUMP 5 + PUBLISH 5 + TAG 4); Phase 8 = 6 reqs (CLEAN 3 + DOC 3).

---

*Created: 2026-05-05 — `/gsd-new-milestone` v1.1 questioning + research synthesis. 38 requirements across 8 categories.*
*Traceability filled: 2026-05-05 — gsd-roadmapper after `.planning/ROADMAP.md` written.*
