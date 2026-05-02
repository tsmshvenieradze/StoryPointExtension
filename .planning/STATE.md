---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 4 closed; Phase 5 (Polish & Marketplace Publish) ready
last_updated: "2026-05-02T20:55:00.000Z"
last_activity: 2026-05-02
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 14
  completed_plans: 14
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** A team member can produce a justified, reproducible Story Points value for any work item in under 30 seconds, without leaving the work item form.
**Current focus:** Phase 4 closed; Phase 5 (Polish & Marketplace Publish) ready

## Current Position

Phase: 05 (polish-marketplace-publish) — NOT STARTED
Plan: 0 of TBD (next: `/gsd-discuss-phase 5`)
Status: Phase 4 complete; Phase 5 ready to plan
Last activity: 2026-05-02

Progress: [████████░░] 83% (14 of 14 phase-1..4 plans complete; 5 of 6 phases complete; Phase 5 plans TBD)

## Performance Metrics

**Velocity:**

- Total plans completed: 14 (Phase 0..4 fully closed)
- Average duration: —
- Total execution time: ~4 days (calendar) across 14 plans

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 0 | 1 | - | - |
| 1 | 2 | - | - |
| 2 | 1 | - | - |
| 3 | 4 | - | - |
| 4 | 6/6 | - | - |

**Recent Trend:**

- Last 5 plans: 04-02 (errorMessages + APPLY-09 rewrite), 04-01 (cezari empirical spike: D-01/D-05/D-10 falsified/redefined), 04-03 (adoFetch + postComment + bridge.getIsReadOnly), 04-04 (7 leaf components), 04-05 (apply.ts two-leg orchestrator + 9-mode CalcModal + lightDismiss=false), 04-06 (cezari D-17 verification + 3 fix-backs + Phase 4 close)
- Trend: spike-evidence-first pattern shifted Phase 4 implementation from training-data assumptions to verified facts before any production file is written. Plan 04-06 surfaced 2 real-world bugs (no-op save + plain-object SDK rejection) and 1 UX dismissal regression — all back-ported atomically per Phase 03-04 fix-back pattern. Phase 4 closed via 6 plans (1 spike + 1 pure module + 1 ADO surface + 1 UI components + 1 orchestrator + 1 manual verify); 3 real-world corrections back-ported.

*Updated after each plan completion*
| Phase 04 P05 | 14m | 3 tasks | 8 files |
| Phase 04 P06 | 3h55m | 5 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Pre-Phase 0: React + TypeScript + `azure-devops-ui` is the only viable UI stack (justified divergence from GPIH Angular standard — `azure-devops-ui` is React-only)
- Pre-Phase 0: Manifest scope locked at `vso.work_write` only — adding scopes post-publish forces re-consent across every install
- Pre-Phase 0: FieldResolver promoted to v1 (was v2) — CMMI uses `Microsoft.VSTS.Scheduling.Size`, not `StoryPoints`; without it v1 breaks on first CMMI customer
- Pre-Phase 0: Sentinel HTML-comment + JSON payload + `schemaVersion` audit format — survives ADO renderer and is round-trip parseable (verified 03-04 with HTML-entity decode)
- Phase 03-04: Override 4 — SDK REST client unusable in dialog iframe; use direct fetch with `SDK.getAccessToken() + SDK.getHost().name`. Phase 4 must follow this pattern for `addComment`.
- Phase 03-04: Override 5 — `ms.vss-web.external-content` dialogs need explicit `SDK.resize` lifecycle, not host content-fit
- Phase 03-04: Override 6 — `html, body, #root { width: 100%; height: 100% }` required in template.html
- Phase 03-04: Override 7 — `ListSelection({ selectOnFocus: false })` required for Dropdown auto-close
- Phase 04 D-01: ~~addComment posts with `commentFormat: 1`~~ — **FALSIFIED 2026-05-02 by Plan 04-01 cezari spike.** ADO storage strips HTML-comment sentinel regardless of api-version (7.0-preview.3 / 7.1-preview.4) or format param (1 / omitted). See 04-VERIFICATION.md ## Spike Results A1.
- Phase 04 D-02 (fallback adopted): audit comment becomes human-readable-only ("Story Points: N (Complexity=X, Uncertainty=Y, Effort=Z)"). No machine-parseable round-trip; reopen-pre-fill (D-16) deferred.
- Phase 04 D-05/D-07: ~~eager isReadOnly probe~~ — **FALSIFIED 2026-05-02 by Plan 04-01 cezari spike.** No reliable eager probe exists. bridge.getIsReadOnly returns { isReadOnly: false, probeFailed: true } unconditionally; D-07 reactive error handling via apply.ts catch is the only read-only signal.
- Phase 04 D-06: Read-only branch REPLACES the calculator with a message panel. REQUIREMENTS.md APPLY-09 rewritten 2026-05-02 in Plan 04-02.
- Phase 04 D-10 (redefined 2026-05-02): no programmatic close from ms.vss-web.external-content dialog. SavedIndicator shows 200ms "Saved ✓" then a persistent saved-state view; user dismisses manually via host close affordance.
- Phase 04 D-13: api-version `7.0-preview.3` confirmed (functionally identical to 7.1-preview.4; matches Phase 3 read path single source of truth).
- Phase 04 D-14: New shared `src/ado/adoFetch.ts` helper consolidates direct-fetch pattern; `comments.ts` refactors to consume it; `postComment.ts` is the new caller (Plan 04-03).
- Phase 04 D-15: Block close affordances + saving overlay during in-flight writes; no AbortController plumbing. **Probe 4 (2026-05-02) confirmed lightDismiss does NOT abort in-flight writes — `lightDismiss:false` is required for UX clarity, not data integrity.**
- [Phase ?]: Phase 04 Plan 05: applyToWorkItem two-leg orchestrator landed; comment-first → field-write atomicity proven via vitest mock-call-order assertion (Phase 0 D-01 contract honored at the language level)
- [Phase ?]: Phase 04 Plan 05: CalcModal extended to 9-mode state machine (loading/calculator/confirm/saving/saved/readonly/noField/commentFail/fieldFail) with 4-leg parallel read path; banner stack ordering enforced via 4 BANNER-STACK-N structural markers
- [Phase ?]: Phase 04 Plan 05: PermissionWarnBanner SUPPRESSED on the spike-A3 baseline path (probeFailed=true && isReadOnly=false) — slot reserved structurally for future probe-validated failure modes
- [Phase ?]: Phase 04 Plan 05: toolbar.tsx lightDismiss=false (D-15) + manifest 0.2.0; Phase 4 implementation surface complete and Plan 04-06 cezari publish unblocked
- Phase 04 Plan 06: cezari D-17 verification — 5 PASS / 0 FAIL / 3 PARTIAL/DEFERRED (offline, Stakeholder, slow-3G); Phase 4 verdict PARTIAL PASS with 4 known limitations carried into Phase 5 polish queue
- Phase 04 Plan 06 Fix-back 1 (`d616330`): drop lightDismiss=false in `src/entries/toolbar.tsx`; revert to host-default true. Plan 04-01 Probe 4 evidence supports the trade — iframe survives lightDismiss; SavingOverlay handles in-modal interaction guard
- Phase 04 Plan 06 Fix-back 3 (`4ca2f69`): structured diagnostic dump on unclassified setFieldValue/save rejection (`rawError`, `errType`, `errIsError`, `errName`, `errMessage`) — bridge to Fix-back 4
- Phase 04 Plan 06 Fix-back 4 (`c536926`): two real-world bug fixes — (a) no-op same-value save handled by `isDirty()` probe + skip `.save()` when clean; (b) plain-object SDK rejections classified by widening `mapSdkErrorToStatus` to handle `{name, message}` shape (ADO rejects with prototype !== Error). +5 vitest cases (398/398 total)
- Phase 04 known limitations (carried into Phase 5 polish queue): (1) Esc dismissal does not work from iframe — SDK v4 has no programmatic close; workaround is outside-click + X button; (2) reopen-pre-fill from sentinel comment permanently deferred per spike A1 STRIPPED-FALLBACK; pre-fill from current-SP via Phase 3 read path remains operational; (3) eager read-only probe is unreliable per spike A3 LAZY-FALLBACK-ONLY; reactive read-only via FieldFailBanner is the production baseline; (4) network-failure scenarios (3, 5, 7) deferred — orchestrator code paths unit-test-covered (398/398)
- Phase 04 closed 2026-05-02 — APPLY-04..09 all met; ROADMAP Phase 4 row Complete; Plan 04-06 SUMMARY captures the 4-stage fix-back loop and Phase 5 readiness checklist

### Pending Todos

None.

### Blockers/Concerns

- Phase 4: Sentinel-preservation hypothesis (D-01) FALSIFIED on cezari 2026-05-02. D-02 fallback (human-readable-only audit comment) adopted as Phase 4 baseline. No machine-parseable round-trip; reopen-pre-fill (D-16) is deferred and would parse human-readable text if ever implemented.
- Phase 4: Read-only UX is reactive only — no eager probe is reliable from the ms.vss-web.external-content dialog (D-05/D-07 confirmed by spike). Apply orchestrator catches setFieldValue/save() rejections and shows the FieldFailBanner. Document as Phase 4 acknowledged limitation; eager-probe revisit deferred to Phase 5.
- Phase 4: Use direct-fetch pattern for `addComment` — do NOT use the SDK REST client (it hangs in dialog iframe per 03-04 Override 4). Will be centralized in `src/ado/adoFetch.ts` per D-14 (Plan 04-03).
- Phase 5: Custom SP fields on customer Scrum installs — real customers may delete inherited `Microsoft.VSTS.Scheduling.StoryPoints` field. Phase 5 should add a settings UI for ref-name override OR document as known limitation.
- Phase 5: Cross-process coverage — cezari run verified Scrum/PBI only. Phase 5 must extend Check 1 across all Scrum types AND a separate Agile org.
- Phase 5: `dev-publish.cjs` retry broken on Windows — fix before final publish (see Phase 03-04 Issues Discovered).

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-02T20:55:00.000Z
Stopped at: Phase 4 closed; Phase 5 (Polish & Marketplace Publish) ready
Resume file: .planning/ROADMAP.md (Phase 5 needs `/gsd-discuss-phase 5` to plan; CMMI verification + listing assets + bundle gate per PKG-02..07)
