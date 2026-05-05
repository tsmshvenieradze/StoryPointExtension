# Roadmap — Milestone v1.1: Auto-Publish CI/CD

**Project:** Story Point Calculator (Azure DevOps Extension)
**Milestone:** v1.1 — Auto-Publish CI/CD
**Created:** 2026-05-05
**Granularity:** coarse (per `.planning/config.json`)
**Phase numbering:** continued from v1.0 (Phases 0–5 archived); v1.1 starts at Phase 6
**Phase naming:** `sequential` (per config) — `06-workflow-scaffold-and-gates`, `07-bump-publish-tag`, `08-cleanup-and-runbooks`

> **Goal:** Every PR-merge to master ships a new patch of `TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator` to the Visual Studio Marketplace automatically, with no manual steps. The first auto-publish ships v1.0.8.

---

## Milestones

- ✅ **v1.0 MVP** — Phases 0–5 (shipped 2026-05-04) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🟢 **v1.1 Auto-Publish CI/CD** — Phases 6–8 (this document)
- 📋 **v1.2+** — to be defined (candidate themes captured in PROJECT.md "Next Milestone Goals")

---

## Phases

- [ ] **Phase 6: Workflow Scaffold & Pre-flight Gates** — Two-workflow split (`ci.yml` PR-only + new `publish.yml`), all pre-flight gates run end-to-end on push to master, dry-run final step (no Marketplace mutation)
- [ ] **Phase 7: Bump, Publish, Tag** — `bump-version.mjs`, real `tfx extension publish` to Marketplace, `[skip ci]` commit-back, annotated tag — first green run ships v1.0.8
- [ ] **Phase 8: Cleanup & Runbooks** — Archive legacy `publish-cezari.cjs`, remove npm scripts, write `OPERATIONS.md` (PAT rotation + emergency-publish runbook), promote v1.1 capabilities to PROJECT.md "Validated"

---

## Phase Details

### Phase 6: Workflow Scaffold & Pre-flight Gates
**Goal:** End-to-end CI plumbing for auto-publish is in place — gates and triggers verified — but no Marketplace state changes yet.
**Depends on:** Nothing (this milestone's first phase)
**Requirements:** CI-01, CI-02, CI-03, CI-04, CI-05, CI-06, CI-07, CI-08, GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, GATE-06, GATE-07, FAIL-01, FAIL-02, FAIL-03
**Success Criteria** (what must be TRUE):
  1. Pushing a feature branch and opening a PR triggers `ci.yml` (gates run); the same PR push does NOT trigger `publish.yml`.
  2. Merging a PR to master triggers `publish.yml` (gates re-run on master tip) and does NOT trigger `ci.yml` (the `push: [master]` line is gone).
  3. A docs-only commit (touching only `**.md`, `.planning/**`, `.claude/**`, or `docs/**`) merged to master is filtered by `paths-ignore` and does NOT start `publish.yml`.
  4. Forcing any one gate to fail (typecheck / vitest / build / `check:size`) leaves the workflow red at the failed step, and the dry-run final step does NOT execute (gate ordering verified).
  5. The successful end-of-workflow dry-run step echoes the would-be next version (e.g. `would publish v1.0.8`) without invoking `tfx`, leaving Marketplace untouched at v1.0.7.
  6. The `TFX_PAT` repo secret is created and resolves in the workflow (`echo "${{ secrets.TFX_PAT != '' }}"` returns `true`); a `gh api repos/:owner/:repo/branches/master/protection` call confirms current branch-protection state and the result is recorded in CONTEXT for Phase 7.
**Plans:** 3 plans (Wave 1 complete; Wave 2 pending live verification)
Plans:
- [x] 06-01-PLAN.md — Drop `push: master` from ci.yml (CI-02) ✓
- [x] 06-02-PLAN.md — Scaffold publish.yml with gates, probes, and dry-run echo (CI-01, CI-03..08, GATE-01..07, FAIL-01..03) ✓
- [ ] 06-03-PLAN.md — Verification dance (negative + positive merge cases) and capture branch-protection-probe-result.md (D-1, D-1a, D-5) — pending live PR merges

### Phase 7: Bump, Publish, Tag
**Goal:** A real merge to master automatically packages a new patch `.vsix`, publishes it to the Visual Studio Marketplace, commits the version bump back to master with `[skip ci]`, and pushes an annotated tag — the first run ships v1.0.8.
**Depends on:** Phase 6
**Requirements:** BUMP-01, BUMP-02, BUMP-03, BUMP-04, BUMP-05, PUBLISH-01, PUBLISH-02, PUBLISH-03, PUBLISH-04, PUBLISH-05, TAG-01, TAG-02, TAG-03, TAG-04
**Success Criteria** (what must be TRUE):
  1. After a merge to master, the Marketplace listing for `TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator` advances to v1.0.8 (verifiable in the public listing's Versions table within the workflow runtime).
  2. Master gains exactly one new commit authored by `github-actions[bot]` with subject `chore(release): v1.0.8 [skip ci]` that updates BOTH `package.json` and `vss-extension.json` to `1.0.8` (atomic two-file diff).
  3. The bump commit does NOT re-trigger `publish.yml` — the Actions tab shows the run terminating, no second iteration appears (triple-defense: `GITHUB_TOKEN` anti-loop + `[skip ci]` + actor-guard `if: github.actor != 'github-actions[bot]'`).
  4. An annotated tag `v1.0.8` exists on origin pointing at the bump commit; if the tag step fails, the workflow stays green (Marketplace + commit are load-bearing; tag is best-effort/idempotent).
  5. Forcing the publish step to fail (e.g. revoked PAT) leaves master at v1.0.7, no bump commit, no tag, and Marketplace at v1.0.7 — re-running via `workflow_dispatch` recovers cleanly (Option B reversibility verified).
  6. The published `.vsix` is downloadable as a workflow artifact `vsix-1.0.8` for 90 days (`if-no-files-found: error` guard active), enabling post-mortem inspection without re-packaging.
**Plans:** TBD

### Phase 8: Cleanup & Runbooks
**Goal:** Legacy manual-publish path is retired, operational runbooks for the auto-publish surface exist, and PROJECT.md reflects v1.1 as Validated — milestone closeable.
**Depends on:** Phase 7 (must observe at least one green auto-publish before deleting the manual escape hatch)
**Requirements:** CLEAN-01, CLEAN-02, CLEAN-03, DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. `scripts/publish-cezari.cjs` is no longer at its original path — it has been moved to `scripts/.archive/publish-cezari.cjs` (preserved as institutional memory + grep-discoverable).
  2. `package.json` no longer contains the `publish:cezari` or `publish:public` script entries (`jq -r '.scripts | keys' package.json` shows neither key).
  3. `git grep -F 'publish:cezari'` returns 0 hits in non-archive paths (`scripts/.archive/` and `.planning/` allowed; `src/`, `package.json`, `.github/`, `README.md` clean).
  4. `.planning/OPERATIONS.md` exists and documents (a) the Marketplace-PAT-rotation procedure with concrete steps on `aex.dev.azure.com` and a 1-year cadence, and (b) the manual emergency-publish runbook capturing the exact `tfx extension publish` invocation copied from `publish-cezari.cjs` BEFORE archive.
  5. `.planning/PROJECT.md` "Validated" section names v1.1 Auto-Publish CI/CD as shipped, with a one-line summary of the workflow + secret + commit-back loop, mirroring the v1.0 entries.
**Plans:** TBD

---

## Coverage Map

Every v1.1 requirement maps to exactly one phase. No orphans. No duplicates.

| Category | Requirement IDs | Phase |
|----------|-----------------|-------|
| CI | CI-01, CI-02, CI-03, CI-04, CI-05, CI-06, CI-07, CI-08 | Phase 6 |
| GATE | GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, GATE-06, GATE-07 | Phase 6 |
| FAIL | FAIL-01, FAIL-02, FAIL-03 | Phase 6 |
| BUMP | BUMP-01, BUMP-02, BUMP-03, BUMP-04, BUMP-05 | Phase 7 |
| PUBLISH | PUBLISH-01, PUBLISH-02, PUBLISH-03, PUBLISH-04, PUBLISH-05 | Phase 7 |
| TAG | TAG-01, TAG-02, TAG-03, TAG-04 | Phase 7 |
| CLEAN | CLEAN-01, CLEAN-02, CLEAN-03 | Phase 8 |
| DOC | DOC-01, DOC-02, DOC-03 | Phase 8 |

**Coverage:** 38/38 v1.1 requirements mapped.

> **Tally discrepancy noted:** REQUIREMENTS.md states "Total v1.1 requirements: 32" but enumeration of the eight category checklists yields **38 IDs**. This roadmap mapped all 38; the REQUIREMENTS.md tally line should be corrected to 38 (a one-line edit; no coverage impact). Flagged as a stale-tally bug, not a roadmap gap.

**Phase distribution:**
- Phase 6: 18 requirements (CI 8 + GATE 7 + FAIL 3) — workflow plumbing + gates + failure-policy YAML
- Phase 7: 14 requirements (BUMP 5 + PUBLISH 5 + TAG 4) — Marketplace state mutation
- Phase 8: 6 requirements (CLEAN 3 + DOC 3) — retire legacy path + runbooks

---

## FAIL Category Phase Assignment — Rationale

`FAIL-01` (workflow fail-fast), `FAIL-02` (no Slack/Teams/Discord; only the GH default failure email), and `FAIL-03` (`workflow_dispatch` enables manual re-run) are policy decisions baked into the workflow YAML at scaffold time. They are observable from Phase 6's dry-run shape (`workflow_dispatch:` is present in `on:`; no notification step exists; `continue-on-error` is absent on every gate step). Assigning them to Phase 6 keeps the failure surface defined before any Marketplace mutation is wired in. They could also fit in Phase 7 (since their first real exercise happens against publish failures), but locking the policy at scaffold prevents drift between Phases 6 and 7.

## TAG-04 (Best-Effort) — Phase 7 Note

`TAG-04` makes the tag step `continue-on-error: true` and idempotent (skip if local or origin tag exists), so a tag-push failure leaves the workflow green. This is essential for Option B's recoverability: Marketplace + commit are load-bearing; the tag is human-audit nice-to-have. Phase 7's success criteria explicitly verify the workflow stays green when tag-push fails AND the manual recovery path is documented (forwarded to Phase 8's `OPERATIONS.md`).

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Workflow Scaffold & Pre-flight Gates | 0/3 | Planned — ready for /gsd-execute-phase 6 | — |
| 7. Bump, Publish, Tag | 0/0 | Not started — phases not yet planned | — |
| 8. Cleanup & Runbooks | 0/0 | Not started — phases not yet planned | — |

**Milestone progress:** 0/3 phases complete (0%) — phase planning pending (`/gsd-plan-phase 6` next).

---

## Cross-Phase Notes for plan-phase

These items inform `/gsd-plan-phase` when it decomposes each phase into plans:

1. **`master` branch protection state — UNKNOWN at roadmap time.** No protection is visible in commit history, but this must be verified explicitly. Phase 6's plan should include a `gh api repos/tsmshvenieradze/StoryPointExtension/branches/master/protection` task; the result determines whether Phase 7's commit-back uses default `GITHUB_TOKEN` (no protection — current assumption) or escalates to a GitHub App / `RELEASE_PAT` (protection blocks bot pushes).

2. **`tfx extension publish --help` flag re-verification.** The Phase 7 publish invocation `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation` is research-derived and HIGH-confidence on shape, MEDIUM-confidence on exact flag spelling. Phase 7's plan must run `npx tfx extension publish --help` once at execution time and reconcile against the line above before committing the workflow file.

3. **Inherited publisher.** v1.0 Phase 5 swapped from the stuck-private `TsezariMshvenieradzeExtensions` to `TsezariMshvenieradzeTfsAiReviewTask`. v1.1 inherits this publisher unchanged — no publisher work is in scope. The first auto-publish targets the same listing already at v1.0.7.

4. **Bundle-size gate is v1.0 carry-over.** `GATE-05` (`npm run check:size` ≤ 250 KB gzipped) reuses `scripts/check-bundle-size.cjs` as-is. Current bundle is 147.9 KB / 250 KB (102.1 KB headroom). Phase 6's plan can wire it verbatim from the existing `ci.yml` step — no new tooling.

5. **Phase 8 ordering safety.** Per FEATURES.md and PITFALLS.md: archive `publish-cezari.cjs` only AFTER Phase 7's first green auto-publish AND after the `tfx` invocation has been captured in `OPERATIONS.md`. The "don't delete-and-pray" rule is encoded in Phase 8's dependency on Phase 7 + DOC-02's "captured BEFORE the legacy script is archived" wording.

6. **Stale REQ tally.** REQUIREMENTS.md states "Total v1.1 requirements: 32" but enumeration yields 38. Phase 8's `DOC-03` (PROJECT.md update) is a natural moment to also fix the REQUIREMENTS.md tally line; alternatively the orchestrator can patch it directly. No coverage impact — all 38 are mapped.

---

## Out of Scope (mirrored from REQUIREMENTS.md)

Not in v1.1, not in v1.2, not on the roadmap unless requirements change:

- GitHub Releases auto-creation (Marketplace listing IS the user-facing release surface)
- Conventional-commits-driven semver (patch-only is the explicit v1.1 policy)
- Slack / Teams / email notifications beyond the GH default failure email
- Auto-retry on transient Marketplace 5xx (fail-fast is the chosen philosophy)
- Microsoft Entra / OIDC publishing (documented for Azure Pipelines, not GH Actions)
- GitHub App / `RELEASE_PAT` for commit-back (deferred until master gains branch protection)
- Marketplace screenshot regeneration (PKG-05 v1.0 carry-over — orthogonal milestone)
- Pre-fill APPLY-03 production fix (separate v1.0 carry-over milestone)
- E2E / Playwright tests (per CLAUDE.md — manual QA does UI testing)
- Codecov / coverage upload (vitest already enforces 100% threshold)

Full anti-feature list with rationale: see [REQUIREMENTS.md § Out of Scope](REQUIREMENTS.md#out-of-scope-explicit-anti-features).

---

*Created: 2026-05-05 — gsd-roadmapper. 3 phases (6, 7, 8); 38 requirements mapped 100%; coarse granularity. Next: `/gsd-plan-phase 6`.*
