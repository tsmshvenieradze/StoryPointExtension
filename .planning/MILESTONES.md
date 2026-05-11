# Milestones — Story Point Calculator (Azure DevOps Extension)

Living record of shipped milestones. Each entry summarizes what shipped, key accomplishments, and known carry-overs.

---

## v1.1 Auto-Publish CI/CD — ✅ SHIPPED 2026-05-11

**Listing:** [TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator](https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator)
**Latest version:** v1.0.10 (first release via the automated pipeline: v1.0.8 → v1.0.9 → v1.0.10)
**Phases:** 3 (Phase 6 through Phase 8) — continued numbering from v1.0
**Plans:** 10
**Timeline:** ~7 calendar days with a mid-week gap (2026-05-05 bootstrap → 2026-05-07 Phase 6 → 2026-05-11 Phases 7–8)
**Coverage:** 38/38 v1.1 requirements satisfied (CI-01 + TAG-02 satisfied via the deliberate Phase-8 architecture evolution to the release-branch model)
**Tests:** 400/400 passing (+2 `bump-version.mjs` cases; 100% coverage gates maintained)
**Bundle:** 148.4 KB / 250 KB gzipped

### Delivered

A fully automated release pipeline for the extension: a maintainer merges a `master → release` promotion PR, the push to the long-lived `release` branch runs `publish.yml`, and a new patch version is packaged and published to the Visual Studio Marketplace with zero manual steps — while `master` stays fully protected (require-PR + `Build & verify` status check + signed commits + linear history, with the `story-point-release-bot` GitHub App on the ruleset bypass list). There is no automatic publish on a plain `master` merge.

### Key Accomplishments

1. **Two-workflow split** (Phase 6) — `ci.yml` converted to PR-only on `[master, release]`; new `.github/workflows/publish.yml` carries five pre-flight gates (`npm ci` → typecheck → `vitest run` → webpack prod build → bundle ≤ 250 KB gzipped) + a `vss-extension.json` asset audit + `TFX_PAT`-presence + a rulesets-aware branch-protection probe. Defense-in-depth: a PR run physically cannot reach the publish step. Live-verified on real `master` via positive + negative merge cases.
2. **`scripts/bump-version.mjs`** (Phase 7) — ESM, atomic in-memory two-file patch bump of `package.json` + `vss-extension.json`, max-wins drift handling; 2 vitest cases in the 400/400 suite. Rejected `tfx --rev-version` (manifest-only) and `release-please`/`semantic-release`/`changesets` (assume conventional-commits, which v1.1 deliberately does not adopt).
3. **First Marketplace auto-publish v1.0.7 → v1.0.8** (Phase 7) — packaged via `tfx extension create` (+ 90-day `vsix-1.0.8` artifact) and published via `tfx extension publish` using the `TFX_PAT` repo secret. Shipped via `workflow_dispatch` after the organic merge trigger didn't fire; commit-back was blocked by an undiscovered `master` ruleset (`GH013` — Phase 6's probe checked legacy branch protection, not rulesets); recovered via a hand-bump PR + manual tag + ruleset relaxation.
4. **Release-branch promotion re-architecture + GitHub App verified commit-back** (Phase 8) — `publish.yml` moved from "publish on push to `master`" to triggering on push to a long-lived `release` branch; `master` re-tightened to full protection; the `story-point-release-bot` GitHub App (on the ruleset bypass list) mints an installation token as step 1 and commits `chore(release): vX.Y.Z [skip ci]` back to `release` after a successful publish; an annotated tag (best-effort, idempotent) and a `release → master` back-merge PR close the loop. Loop-guard triple defense: token anti-loop + `[skip ci]` token + actor-guard. Re-verified end-to-end shipping **v1.0.9**.
5. **SC #5 / Option B reversibility verified in the wild** (Phase 8) — a deliberate broken-`TFX_PAT` `workflow_dispatch` run failed safely at the publish step (Marketplace + `release` untouched, no orphan bump commit / tag / back-merge PR); a restored-PAT re-run recovered cleanly shipping **v1.0.10**. Evidence: `milestones/v1.1-phases/08-cleanup-and-runbooks/08-SC5-EXERCISE.md`.
6. **`.planning/OPERATIONS.md`** (Phase 8, DOC-01/DOC-02) — single 6-section durable ops doc: Marketplace PAT rotation (1-year cadence, `aex.dev.azure.com`, scope caveats) · manual emergency-publish runbook (the exact `tfx` invocations, captured before the legacy script was archived) · release-branch model + ruleset config + GitHub App creation steps · rulesets-aware branch-protection probe correction for the Phase 6 gap · partial-failure recovery runbook · SC #5 / Option B controlled-exercise procedure.
7. **Legacy cleanup** (Phase 8, CLEAN-01..03) — `publish-cezari.cjs` → `scripts/.archive/` with an ARCHIVED header naming its successor; `publish:cezari` / `publish:public` npm scripts removed; `git grep` clean outside the archive. The GH Action is now the canonical publish path.

### Known Carry-Overs (v1.2+)

- **Node-20 action deprecation — deadline 2026-06-02.** `create-github-app-token@v2`, `setup-node@v4`, `upload-artifact@v4`, `git-auto-commit-action@v6` run on Node 20; GitHub forces Node 24 from 2026-06-02. → schedule a v1.2 quick task before the deadline.
- **OPERATIONS.md §3/§5 D-4 gotcha** — a `[skip ci]` on a back-merge-PR conflict-resolution commit also skips that PR's required `ci.yml` check, forcing an owner-bypass merge. One-line doc follow-up.
- **`strict_required_status_checks_policy: true` on the `master` ruleset (D-5)** — adds promotion/back-merge friction; operator's discretion to relax.
- **`07-VERIFICATION.md` stale text** — records SC #5 as "partially verified + variant deferred"; superseded by Phase 8's in-the-wild closure, but the original artifact wasn't back-updated.
- **Phase 6 has no `06-VERIFICATION.md`** — process-record gap (Phase 6 was live-verified via the trigger dance); requirements functionally covered downstream.
- Plus all v1.0.1+ carry-overs (screenshots, cross-process smoke, APPLY-03 wire-format fix, cross-phase integration debt) — were OUT OF SCOPE for v1.1, still open for v1.2+. See STATE.md "Deferred Items".

### Audit Verdict

**`passed` — closeable.** All 38 requirements satisfied (CI-01 + TAG-02 via the documented Phase-8 architecture evolution); 3/3 phases complete and verified (Phase 6 live-verified, Phase 7 `07-VERIFICATION.md`, Phase 8 `08-VERIFICATION.md` PASS 9/9); cross-phase integration clean; the auto-publish E2E flow proven in the wild three times over (v1.0.8 first auto-publish, v1.0.9 release-branch re-verification, v1.0.10 SC #5 broken-PAT recovery); no critical blockers. Tech debt minor and already-tracked.

### Archive Files

- [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) — full phase breakdown, plans, success criteria, decisions
- [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) — frozen v1.1 requirements, all 38 checked off, traceability table
- [milestones/v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md) — per-requirement 3-source cross-reference, ROADMAP SC disposition, cross-phase integration report, tech-debt aggregation
- [milestones/v1.1-phases/](milestones/v1.1-phases/) — Phase 6/7/8 raw execution artifacts (plans, summaries, context, verification, SC #5 exercise)

### Git Tag

`v1.1` (created at milestone close commit on master)

---

## v1.0 MVP — ✅ SHIPPED 2026-05-04

**Listing:** [TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator](https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator)
**Latest version:** v1.0.7
**Phases:** 6 (Phase 0 through Phase 5)
**Plans:** 19
**Quick tasks:** 2 (`260504-uk5` Phase 5 close-out; `260504-cl1` programmatic close v1.0.4..v1.0.7)
**Timeline:** 4 calendar days (2026-05-01 → 2026-05-04)
**Coverage:** 40/40 v1 requirements satisfied (3 PARTIAL deferrals + 1 satisfied-with-caveat)
**Bundle:** 147.9 KB / 250 KB gzipped (102.1 KB headroom)
**Tests:** 398/398 passing (100% coverage gates on `src/calc/**` and `src/audit/**`)

### Delivered

A public Visual Studio Marketplace Azure DevOps extension that lets a team member produce a justified, reproducible Story Points value for any work item in under 30 seconds without leaving the work item form. Click the toolbar button → answer 3 questions (Complexity / Uncertainty / Effort) → SP appears in the field with an audit comment explaining how it was derived.

### Key Accomplishments

1. **Pure-TS calc + audit modules** with 100% coverage gates and zero ADO/React dependencies (Phase 1) — formula matches `sp_calculator.xlsx` exactly across all 7 Fibonacci buckets and threshold boundaries; 125-case round-trip property test.
2. **Full React calculator UI** wired to FieldResolver (`Microsoft.VSTS.Scheduling.StoryPoints` → `Microsoft.VSTS.Scheduling.Size` fallback for CMMI) and the SDK read path (current SP, comments, theme inheritance) (Phase 3).
3. **Two-leg Apply orchestrator** — comment-first → field-write per Phase 0 D-01 atomicity decision; 9-mode CalcModal state machine; 9 banners and overlays for the full edge-case matrix (Phase 4).
4. **Public Marketplace publish** under `TsezariMshvenieradzeTfsAiReviewTask` (publisher swap from stuck-private `TsezariMshvenieradzeExtensions`); CI bundle size gate at 250 KB; post-publish patch sequence v1.0.1..v1.0.7 (Phase 5 + Quick task 260504-cl1).
5. **Programmatic close on three surfaces** (Cancel button, post-Saved 600ms auto-close, iframe Esc keydown listener) shipped in v1.0.5 by swapping `openCustomDialog` → `addDialog` — reversed Phase 4 D-10 NO-PROGRAMMATIC-CLOSE via Quick task `260504-cl1` empirical evidence.

### Known Carry-Overs (v1.0.1+ / v1.1+)

3 PARTIAL satisfactions (Phase 5 deferrals): **PKG-04** Contributor non-admin smoke skipped per CONTEXT D-7 (trusted scope); **PKG-05** light + dark screenshots[] omitted from v1.0.0 manifest to unblock publish; **PKG-07** cross-process Agile + CMMI smoke deferred (FieldResolver code path 100% unit-tested but production smoke not run).

1 satisfied-with-caveat: **APPLY-03** pre-fill flow is structurally dead in production — `postComment.ts` writes plain-text humanText (D-02 STRIPPED-FALLBACK), but `parse.ts` SENTINEL_RX still requires the `<!-- sp-calc:v1 ... -->` HTML-comment sentinel. parseLatest never returns non-null for v1-authored comments. Either widen parser or strip orphaned `serialize` re-export. Tracked for v1.1+.

15 tech-debt items captured in [.planning/milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) (4 Phase 3 + 3 Phase 4 + 4 Phase 5 + 4 cross-phase integration).

### Audit Verdict

**`tech_debt`** — All 40 v1 requirements nominally satisfied; no unsatisfied or orphaned. No critical gaps; no anti-patterns of substance; no placeholder/TODO code in shipped paths. Three Phase 5 PARTIAL satisfactions are documented v1.0.1+ deferrals. APPLY-03 caveat is conditional-precondition wording (does not trigger FAIL gate). 15 tech-debt items rolled forward to v1.1+ planning.

### Archive Files

- [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) — full phase breakdown, plans, decisions, deferrals
- [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) — frozen v1 requirements with checkbox state at close
- [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) — per-requirement status, per-phase summary, integration findings, tech debt aggregation
- [quick/260504-cl1-programmatic-close-spike/260504-cl1-SUMMARY.md](quick/260504-cl1-programmatic-close-spike/260504-cl1-SUMMARY.md) — v1.0.4..v1.0.7 close-fix arc

### Git Tag

`v1.0` (created at milestone close commit on master)
