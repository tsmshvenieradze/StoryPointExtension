---
phase: 05-polish-marketplace-publish
verdict: FLAG
plans_reviewed: 5
date: 2026-05-02
---

# Phase 5 Plan Check

## Overall Verdict

**FLAG — execute with awareness; one BLOCK-grade item is fixable in <5 min before kicking off Wave 1.**

The five plans are coherent, goal-aligned, and honor every CONTEXT.md locked decision. Goal-backwards coverage of Phase 5's 4 ROADMAP success criteria and the 6 PKG requirements is complete. Spike verdicts (A1 STRIPPED-FALLBACK, A3 LAZY-FALLBACK-ONLY, A4 NO-PROGRAMMATIC-CLOSE, Probe-4 lightDismiss host-default) are correctly preserved across the cross-process smoke and the 1.0.0 re-verification. Wave dependencies are valid; no intra-Wave-1 file overlap that would prevent parallel execution.

One BLOCK-grade item (a Plan 05-03 grep negation that creates a false-positive coverage claim), three MEDIUM-grade flags (intra-Wave-1 sequencing, an unverified GitHub-remote assumption, a UX-polish gap on cezari project provisioning), and a handful of LOW-grade polish items.

After applying the High and Medium fixes, plans become PASS-ready for execution.

## Per-Plan Verdicts

| Plan | Verdict | Reason |
|------|---------|--------|
| 05-01 | PASS | Tight, deterministic. Human-action checkpoint with structured prompts; greppable acceptance; spike-agnostic. PKG-06 covered. |
| 05-02 | PASS | Three artifacts cohesively scoped to one wave. Verbatim source links to RESEARCH §Pattern 1/2/6. PKG-02/PKG-03 met. Bundle baseline 146.8 KB / 250 KB respected — no code-splitting work planned (correct; informational guard-rail only). |
| 05-03 | FLAG | Manifest delta correct; overview.md and README.md content matches D-1/D-9/D-10/D-11; screenshots checkpoint structured. Two findings: (a) Task 1 acceptance criterion uses `! grep -F "content.license"` which cannot meaningfully assert what it intends because dotted JSON paths never appear literally in valid JSON; (b) Task 6 invokes `npm run publish:cezari` which Plan 05-02 must finish first — the `<interfaces>` block flags this but the wave structure has no `depends_on` between 05-02 and 05-03. |
| 05-04 | PASS | Cross-process smoke matches RESEARCH §Code Examples verbatim. Console-transcript expectations match `src/apply/apply.ts:113/138/189` exactly (verified). Spike A1/A3/A4 invariants re-asserted in production. PKG-04/PKG-07 PARTIAL declarations cite D-7/D-5 deviations explicitly. Fix-back loop mirrors Phase 4 Plan 04-06 pattern. |
| 05-05 | FLAG | Public flip + version walk + cross-cutting docs close. Two ROADMAP-edit `old_string` mismatches that will fail the Edit tool unless fixed: Step E targets `0/TBD` but actual ROADMAP shows `0/5`; Step D's "replace empty Plans subsection" wording is wrong because the Plans subsection is already populated by the planner. STATE.md math is correct (5+1=6 phases; 14+5=19 plans; 100%). |

## Goal-Backwards Coverage

### ROADMAP Phase 5 Success Criteria

| ROADMAP Success Criterion | Plan(s) | Coverage |
|---------------------------|---------|----------|
| SC#1 (250KB CI gate via tfx-cli with toolbar.html + modal.html) | 05-02 | full — `.github/workflows/ci.yml` + `scripts/check-bundle-size.cjs`; existing webpack two-entry config produces both bundles per RESEARCH PKG-02 row; deliberate-failure smoke baked into Task 1 |
| SC#2 (description, privacy, formula, 128×128 icon, light + dark screenshots) | 05-03 | full — overview.md (description + privacy + formula in plain English per D-11) + screenshots Task 5 + icon Task 4 (Option I or II with explicit decision) |
| SC#3 (private install + Contributor flow on fresh trial org) | 05-04 | partial — D-7 LOCKED skip on Contributor explicit test; D-5 LOCKED substitution (cezari multi-process for "fresh trial org"); plans correctly mark PARTIAL with declared deviations citing both D-IDs |
| SC#4 (public:true + Agile + CMMI on 2 orgs) | 05-04 + 05-05 | partial — `public:true` flip in 05-05 Task 2; Agile + CMMI process coverage in 05-04; D-5 LOCKED single-org coverage (cezari runs all 3 processes) makes the "two different ADO organizations" wording PARTIAL with declared deviation; plans mark PARTIAL with D-5 citation |

All 4 success criteria are addressed; PARTIAL verdicts on SC#3/SC#4 are CONTEXT.md-locked deviations, not plan defects. Verifier accepts PARTIAL per CONTEXT.md.

### PKG Requirements

| Requirement | Plan | Status |
|-------------|------|--------|
| PKG-02 (vsix via tfx-cli with both webpack entries) | 05-02 | covered (existing webpack two-entry config + new ci.yml `npm run build` step + Plan 05-05 Task 3 `npm run publish:public` exercises tfx) |
| PKG-03 (≤250 KB gzipped; CI hard-fails above) | 05-02 | covered (`scripts/check-bundle-size.cjs` exit-1 above 250 KB; CI workflow runs it) |
| PKG-04 (installable + Contributor flow) | 05-04 | covered (PARTIAL per D-7 — declared deviation captured in 05-VERIFICATION.md ## Cross-Process Smoke) |
| PKG-05 (description, screenshots, formula, privacy, 128×128 icon) | 05-03 | covered (overview.md + screenshots Task 5 + icon Task 4 + manifest screenshots[] entry) |
| PKG-06 (publisher verified before first public publish) | 05-01 + 05-05 Task 1 | covered (gate populated Wave 1; re-checked live at Wave 3 start per RESEARCH §Pitfall 2) |
| PKG-07 (public listing + 2 orgs Agile + CMMI) | 05-04 + 05-05 | covered (PARTIAL per D-5 — process coverage met, single-org coverage; declared deviation captured) |

All 6 PKG requirements have plan tasks with greppable acceptance criteria and human-verify checkpoints where Claude cannot inspect the surface (publisher portal, cezari browser session, Marketplace public listing).

## Findings

### High (BLOCK-worthy, fix before execution)

**H-1. Plan 05-03 Task 1 acceptance criterion: false-positive `content.license` grep.**

The criterion reads (paraphrased): `! grep -F "content.license" vss-extension.json` — the negation must hold.

The intent is to assert that the manifest does NOT have a `content.license` block (per RESEARCH §Pitfall 7 — declaring `content.license.path` without adding LICENSE to `files[]` produces a broken VSIX). But:

- `grep -F "content.license"` searches for the LITERAL substring `content.license` anywhere in the file.
- JSON syntax never produces the dotted form — `content` and `license` are separate keys nested via braces. The substring `content.license` will never appear in valid manifest JSON regardless of whether the bug exists.
- So the negation passes vacuously. The "fail-safe" is not a fail-safe; it is a no-op.

**Risk:** A future planner reads the criterion as confirmation that the manifest is safe from Pitfall 7 and skips manual review. If `content.license` IS later added (e.g., by an automated tool), the grep still passes vacuously, and the VSIX ships with a broken License tab.

**Fix:** Replace with a positive structural check using Node JSON.parse, or weaken to advisory wording so future readers understand it requires manual confirmation. Suggested replacement: a Node one-liner that parses the manifest and exits non-zero if `m.content && m.content.license` is truthy.

**Severity: BLOCK** because the criterion gives a false sense of regression coverage on a documented Pitfall. Fix in <60 seconds before Plan 05-03 executes.

### Medium (FLAG)

**M-1. Plan 05-03 ↔ Plan 05-02 sequencing inside Wave 1 not declared.**

Plan 05-03 Task 6 invokes `npm run publish:cezari`, which is a script Plan 05-02 creates at `scripts/publish-cezari.cjs`. Plan 05-03's `<interfaces>` block correctly flags this:

> *"In execution order, Plan 05-02 must complete BEFORE Task 6 of this plan runs; the wave structure assumes parallel completion of Wave 1 plans before Wave 2 starts, but within Wave 1 the publish-script-using task (Task 6 of 05-03) sequentially depends on Plan 05-02's deliverables. The orchestrator must enforce this..."*

But Plan 05-03's frontmatter is `depends_on: []`. A parallel orchestrator naively running both plans concurrently will race Plan 05-03 Task 6 against Plan 05-02 Task 3 — `npm run publish:cezari` ENOENTs because the script file does not exist yet.

**Recommendation (any of):**
- (a) Add `depends_on: ["05-02"]` to Plan 05-03's frontmatter — wave number stays 1 if the orchestrator allows intra-wave dependencies (Plan 05-04 already uses this pattern with `depends_on: [05-01, 05-02, 05-03]` and wave: 2).
- (b) Split Plan 05-03 Tasks 5–7 into a sub-plan that depends on 05-02.
- (c) Document explicitly in the orchestrator contract that Wave 1 plans serialize when one consumes another's artifacts.

**Severity: MEDIUM** — failure mode is loud (ENOENT) and recovery is trivial (re-run after 05-02 finishes); not silent corruption. But the dependency declaration mismatch is a real plan defect that would trip a parallel-execution orchestrator.

**M-2. Plan 05-03 Task 1: GitHub-remote URL assumption is unverified at execution time.**

RESEARCH §Assumptions Log A8 marks the GitHub URL as ASSUMED. Plan 05-03 Task 1 hardcodes the URL into `vss-extension.json` `repository.uri`, `links.{getstarted,support,license}`, and the listing's "Repository" link. If the actual git remote is different (private fork, different owner, different repo name), all four manifest URLs 404 in the public listing. Task 7 visual confirmation will surface this AFTER the listing-asset commit and a private re-publish — adding a fix-back round.

**Recommendation:** Add a 1-step precondition gate to Task 1 acceptance: `git remote get-url origin | grep -F "github.com/tsmshvenieradze/StoryPointExtension"` — exits 0 if the assumption holds; fails fast if the remote diverges.

**M-3. Plan 05-04 Task 1 — toolbar contribution propagation note missing.**

Task 1 step 5 says: *"Verify by opening the new project's Boards → New User Story (or Requirement for CMMI) → ... menu → confirm 'Calculate Story Points' appears in the work item toolbar."*

ADO extensions installed at the org level via `--share-with` are available across all projects in that org by default — no per-project activation. **However**, when adding a NEW project after the install, the toolbar contribution may not appear immediately on the first work-item-form load (caching). RESEARCH §Code Examples does not call this out either. User-experience risk: the user reports "toolbar button missing on Agile-Test" and starts trying to fix the manifest when the actual fix is "wait 1–2 minutes and reload."

**Recommendation:** Add to Task 1 step 5 — "If the toolbar button is not visible on the first form load, hard-refresh (Ctrl+Shift+R) and wait 30–60 seconds — extension contributions can take a moment to propagate to newly-created projects' work-item form caches."

### Low (advisory)

**L-1. Plan 05-05 Task 6 Step E — ROADMAP Progress table `old_string` mismatch.**

Plan 05-05 Step E proposes `old: | 5. Polish & Marketplace Publish | 0/TBD | Not started | - |`. But ROADMAP.md line 166 currently shows `| 5. Polish & Marketplace Publish | 0/5 | Not started | - |`. The Edit tool will fail with "old_string not found" until fixed.

**Recommendation:** Update Step E `old_string` to `| 5. Polish & Marketplace Publish | 0/5 | Not started | - |`.

**L-2. Plan 05-05 Task 6 Step D — ROADMAP Plans block edit instructions misaligned with current state.**

Step D says: *"Replace `**Plans**: TBD` (or whatever current state, line ~139) with `**Plans**: 5 plans` and replace the (currently empty) Plans subsection at the end of Phase 5 details with: ..."*

Verified against ROADMAP.md:
- Line 139: already shows `**Plans**: 5 plans` (so the proposed replacement is a no-op).
- Lines 142–152: the Plans subsection is already populated with `[ ]` checkboxes for all 5 Phase 5 plans (not "currently empty").

The actual edit needed is just five `[ ] → [x]` flips, one per plan.

**Recommendation:** Rewrite Step D as five exact-match edits: `- [ ] 05-0X-PLAN.md` → `- [x] 05-0X-PLAN.md` for X in {1,2,3,4,5}. Same outcome; cleaner instruction; matches actual ROADMAP state.

**L-3. Plan 05-04 Task 4 — `src/field/fieldResolver.ts` path typo.**

Task 4 read_first list says `src/field/fieldResolver.ts (FIELD-02)` in the body but earlier in the same Task 4 `<files>` block lists `src/ado/fieldResolver.ts (FIELD-02)`. Actual location is `src/field/`. Cosmetic typo; user/Claude would correct on the fly if a fix-back is needed.

**Recommendation:** Fix typo in Plan 05-04 Task 4 — change `src/ado/fieldResolver.ts (FIELD-02)` to `src/field/fieldResolver.ts (FIELD-02)`.

**L-4. Plan 05-02 Tasks 1 + 3 — package.json edit choreography.**

Task 1 inserts `check:size` into the scripts block while keeping `dev:publish`; Task 3 then deletes `dev:publish` and adds `publish:cezari` + `publish:public`. The two-step Edit choreography works but is slightly more fragile than a single Write of the final scripts block.

**Recommendation:** Optional refactor — Task 1 just writes the final scripts block once and Task 3 only creates files (does not re-edit package.json). Same outcome; cleaner. No correctness impact.

**L-5. Plan 05-04 Task 4 acceptance — conditional language slightly looser than verify.**

Acceptance text is "If fix-backs were applied: each fix-back commit exists ..." but the auto-verify command runs unconditionally. The verify (full gate chain plus section-existence grep) is a sound proxy regardless of whether fix-backs landed. No correctness defect; just a documentation tightness opportunity.

## Spike Verdict Compliance

| Spike | Verdict | Plan(s) that re-confirm | Compliance |
|-------|---------|--------------------------|------------|
| A1 STRIPPED-FALLBACK | Comment is plain text only; no `<!-- -->` sentinel | 05-04 Task 2 step 8 ("no `<!-- -->` markup visible — corroborates Phase 4 spike A1 STRIPPED-FALLBACK"); 05-04 Task 3 cross-process invariants table | re-asserts in production on Agile + CMMI; does NOT expect different behavior — CORRECT |
| A3 LAZY-FALLBACK-ONLY | No eager probe; `bridge.getIsReadOnly` returns `{ isReadOnly: false, probeFailed: true }`; FieldFailBanner only on actual rejection | 05-04 `<interfaces>` Spike-locked invariants block: "Calculator opens fully usable on both new projects (the user is org admin on cezari; no read-only path exercised — that's the spike-locked design)." | does NOT plan an eager-probe revisit — CORRECT |
| A4 NO-PROGRAMMATIC-CLOSE | Modal stays open in saved state; user dismisses manually | 05-03 marketplace/overview.md Known limitations bullet 1 ("Esc key does not dismiss the modal — click outside or use the title-bar X to close") + Plan 05-05 ## Phase 5 Verdict carries-forward bullet 1 | surfaces as a public Known Limitation per D-10; does NOT plan a programmatic close investigation in v1 — CORRECT |
| Probe-4 lightDismiss host-default | `lightDismiss` host default (true; restored by Phase 4 fix-back `d616330`); SavingOverlay handles in-modal interaction guard during saving | No Phase 5 plan touches `src/entries/toolbar.tsx`'s `openCustomDialog` options; the host-default-true behavior carries forward unchanged | does NOT re-litigate the lightDismiss decision — CORRECT |

All four spike verdicts are correctly preserved. Plan 05-04's smoke does NOT expect different behavior on the 1.0.0 build (Plan 05-05 Task 4 re-verification); it expects the same console-transcript shape proven in Phase 4 + Plan 05-04. This is right because the 1.0.0 build is byte-identical to the 0.2.x build except for the `version` and `public` fields in `vss-extension.json`.

## Recommendations

### Must-fix before Plan 05-03 executes (5 minutes)

1. **H-1:** Replace Plan 05-03 Task 1 acceptance line `! grep -F "content.license" vss-extension.json` with a positive structured assertion via Node JSON.parse, or weaken to advisory wording. Current grep is vacuously satisfied by all valid JSON.
2. **M-1:** Add `depends_on: ["05-02"]` to Plan 05-03's frontmatter (or document in the orchestrator contract that Wave 1 plans serialize when one consumes another's artifacts). Without this, parallel orchestration of Wave 1 will race Plan 05-03 Task 6 against Plan 05-02 Task 3.
3. **M-2:** Add a 1-line `git remote get-url origin | grep -F "github.com/tsmshvenieradze/StoryPointExtension"` precondition gate to Plan 05-03 Task 1 — fail fast if the GitHub URL hard-coded in the manifest does not match the actual remote. RESEARCH A8 marks this ASSUMED.

### Should-fix during execution (no block)

4. **M-3:** Plan 05-04 Task 1 step 5 — add hard-refresh + 30–60s wait note for newly-provisioned ADO projects' toolbar contribution propagation.
5. **L-1:** Plan 05-05 Task 6 Step E — update `old_string` from `0/TBD` to `0/5` to match the actual current ROADMAP state. Without this fix the Edit tool fails.
6. **L-2:** Plan 05-05 Task 6 Step D — rewrite as five exact-match `[ ] → [x]` flips per plan rather than the "replace empty Plans subsection" wording (the subsection is already populated).
7. **L-3:** Plan 05-04 Task 4 — fix `src/ado/fieldResolver.ts` typo to `src/field/fieldResolver.ts` in the read_first list.

### Optional polish (no impact on goal achievement)

8. **L-4:** Plan 05-02 Tasks 1 + 3 — consider consolidating package.json edits into a single Write of the final scripts block instead of the two-step Edit choreography. Same outcome; cleaner Edit.
9. **L-5:** Plan 05-04 Task 4 acceptance — the conditional language "If fix-backs were applied: ..." is slightly looser than the auto-verify command. Optional tightening to make the conditional explicit in the verify pipeline.

### Confidence statement

The plans are RIGHT in goal direction. PKG-02..07 are all addressed; spike verdicts (A1/A3/A4/Probe-4) are honored verbatim; CONTEXT.md decisions D-1..D-11 are LOCKED and implemented (no scope reduction, no scope creep, no deferred ideas pulled in). The only BLOCK-grade item is a single grep negation that creates a false-positive coverage claim — fixable in 60 seconds. The MEDIUM-grade items are real but small (one cross-plan dependency declaration, one precondition assertion, one user-experience polish on cezari project provisioning). The LOW-grade items are mostly Edit-tool `old_string` mismatches against the live ROADMAP that would be caught at execute-time but cleaner to patch now.

**Recommendation:** Apply H-1, M-1, M-2 patches (and ideally L-1, L-2 to make Plan 05-05 land cleanly). Then execute Wave 1 (05-01 + 05-02 first; 05-03 immediately after 05-02 completes per M-1). The five plans, with the patches, will deliver Phase 5's 4 ROADMAP success criteria and the 6 PKG requirements at PARTIAL-PASS verdict (PARTIAL on PKG-04/PKG-07 per CONTEXT D-5/D-7 declared deviations).
