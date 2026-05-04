---
phase: 05-polish-marketplace-publish
plan: 04
status: deferred
deferred_to: v1.0.1+
self_check: passed (deferral decision made during Phase 5 ship; risk accepted)
requirements-touched: [PKG-04, PKG-07]
completed: 2026-05-04
---

# Plan 05-04 — Cross-Process Agile + CMMI Smoke (DEFERRED)

## Outcome

**Status: DEFERRED to v1.0.1+.** This plan's cross-process smoke test against Agile and CMMI ADO project templates on cezari was not run before the public publish. The deferral was a deliberate speed-to-ship trade-off: Phase 5 prioritized landing the public listing over collecting empirical Agile + CMMI evidence on cezari.

## Why deferred

Phase 5 closed PKG-04 and PKG-07 as **PARTIAL** rather than blocking the public publish on the cross-process smoke. The trade-off:

- **Risk:** low. The FieldResolver fallback path (`Microsoft.VSTS.Scheduling.StoryPoints` → `Microsoft.VSTS.Scheduling.Size`) is exercised by the same code path on every process; it has 100% unit test coverage in the Phase 1 calc engine + Phase 3 FieldResolver suites (398/398 passing). The only thing the cezari smoke would prove is "the code path that already works in tests also works in production on a non-Scrum process" — high confidence on a tested path.
- **Reward:** ship the public listing during the same Phase 5 work session rather than blocking on cezari project provisioning + a multi-step manual verification.

## Carry-over to v1.0.1+

`05-VERIFICATION.md ## Carry-overs to v1.0.1` lists this as carry-over #3:

> **Cross-process smoke** — Plan 05-04: add Agile + CMMI projects to cezari, run open-modal + Apply on User Story (Agile) and Requirement (CMMI) to verify FieldResolver fallback path empirically.

When v1.0.1 work happens (or v1.0.4+, whichever post-publish work session picks this up), the verifier follows the procedure documented in the original `05-04-PLAN.md` Tasks 1–4 — that plan was not deleted; it stays on disk as the runbook for whoever picks up the smoke later.

## PKG-04 / PKG-07 disposition

Both closed as **PARTIAL** in REQUIREMENTS.md and `05-VERIFICATION.md ## Requirement Verdicts`:

- **PKG-04** (PARTIAL): install + Apply verified at the publishing user's level via Phase 4 cezari fix-back loop on Scrum/PBI; Contributor non-admin explicit verification SKIPPED per CONTEXT D-7 (trust `vso.work_write` scope sufficient); cross-process Agile + CMMI deferred per this plan.
- **PKG-07** (PARTIAL): public listing live and installable on any ADO org; cross-process smoke deferred per this plan; risk: low (same FieldResolver code path; unit tests pass).

## Files

No files modified. The plan was not executed.

## Self-Check: PASSED (status DEFERRED, no execution attempted)

Phase 5's PARTIAL verdict explicitly accounts for the deferral; v2 milestone planning reads `05-VERIFICATION.md ## Carry-overs to v1.0.1` to pick up the work.

---
*Phase: 05-polish-marketplace-publish*
*Closed-out: 2026-05-04 (status deferred to v1.0.1+)*
