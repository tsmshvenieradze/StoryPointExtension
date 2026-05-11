---
phase: 03-modal-ui-read-path
plan: 04
subsystem: ui
tags: [manual-verification, cezari, scrum, marketplace, sdk-resize, html-entities, location-service, dropdown, override-4, override-5, override-6, override-7]

# Dependency graph
requires:
  - phase: 02-manifest-shell-sdk-integration
    provides: dev-publish wrapper (used directly), SDK lifecycle pattern, openCustomDialog wiring
  - phase: 03-modal-ui-read-path/03-01
    provides: ModernCommentsClient (replaced with direct fetch), bridge layer types
  - phase: 03-modal-ui-read-path/03-02
    provides: FieldResolver (verified in live org)
  - phase: 03-modal-ui-read-path/03-03
    provides: full CalcModal UI (verified end-to-end on real ADO)
provides:
  - Empirical verification record for Phase 3 read path on cezari (Scrum)
  - Six real-world bug fixes back-ported into earlier-phase code (atomic commits)
  - Phase 4/5 follow-up inventory derived from cezari findings
affects: [04-write-path, 05-marketplace-publish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct fetch (no SDK REST client) for ADO REST calls from a custom-dialog iframe — Override 4"
    - "SDK.resize + ResizeObserver lifecycle for ms.vss-web.external-content dialogs — Override 5"
    - "Document html/body 100% width CSS in template.html — Override 6"
    - "ListSelection { selectOnFocus: false } for Dropdown auto-close — Override 7"
    - "HTML-entity decode pre-match in audit parser for ADO storage round-trip"

key-files:
  created:
    - .planning/phases/03-modal-ui-read-path/03-VERIFICATION.md
    - .planning/phases/03-modal-ui-read-path/03-04-SUMMARY.md
  modified:
    - src/audit/parse.ts (HTML entity decoder added)
    - src/entries/modal.tsx (SDK.resize lifecycle added)
    - src/template.html (full-width document CSS added)
    - src/ado/comments.ts (rewritten as direct fetch)
    - src/ui/Dropdown3.tsx (selectOnFocus:false + sync guard)
    - src/ui/CalcModal.tsx (diagnostic logging across read path)
    - vss-extension.json (version walk 0.1.1 → 0.1.16)

key-decisions:
  - "Phase 3 verdict: PARTIAL PASS — read path works end-to-end on a real Scrum org; checks 1/10/12 PARTIAL by attestation/coverage; architectural risks they cover are validated independently"
  - "Custom SP fields on customer Scrum installs are an unaddressed v1 limitation — Phase 5 owns either a settings UI for ref-name override or a heuristic detector"
  - "Phase 4 must use the direct-fetch pattern for addComment, not the SDK REST client (Override 4 applies to write path too)"
  - "Visible-sentinel UX (literal `<!-- ... -->` showing in rendered comments) is a Phase 4 concern, not a Phase 3 bug — three options for Phase 4 to evaluate (accept / post-as-HTML / different invisible carrier)"
  - "ROADMAP/03-CONTEXT D-31 incorrectly assumed cezari runs Agile; cezari runs Scrum. Phase 5 should formally cover both processes per its existing requirement"

patterns-established:
  - "Override 4: SDK REST client unusable in dialog iframe — use SDK.getAccessToken() + manual URL construction + direct fetch"
  - "Override 5: external-content dialogs need explicit SDK.resize lifecycle, not host content-fit"
  - "Override 6: html/body/#root must be 100% width or scrollWidth collapses content"
  - "Override 7: ListSelection({ selectOnFocus: false }) is required for Dropdown auto-close"
  - "Fix-back commit labeling: `fix(03-04): patch <plan-id> regression — <reason>` per plan §100"

requirements-completed: [UI-03, UI-04, UI-05, UI-07, UI-08, FIELD-01, FIELD-02, FIELD-03, FIELD-04, APPLY-01, APPLY-02, APPLY-03]

# Metrics
duration: ~3h (interactive verification + fix loop)
completed: 2026-05-02
---

# Phase 3 Plan 04: Manual Cezari Verification Summary

**Read path empirically verified on a real ADO Scrum org; six earlier-phase bugs surfaced and back-ported via atomic fix-back commits**

## Performance

- **Duration:** ~3 hours (interactive — verification interleaved with bug fixes)
- **Started:** 2026-05-02 (afternoon, cezari verification kicked off after build/dev-publish)
- **Completed:** 2026-05-02
- **Tasks:** 2 (Task 1: build/dev-publish; Task 2: 12-item D-29 manual checklist)
- **Files modified:** 7 source files + 2 planning artifacts

## Accomplishments

- 12 D-29 D-29 verification checks exercised on cezari; 9 PASS, 3 PARTIAL (single work-item type, attestation-only on keyboard nav and theme matrix)
- Six real-world bugs surfaced and fixed inline:
  - Phase 1 audit parser missing HTML-entity decode (parser returned null on every real comment)
  - Phase 2 dialog sizing assumed host auto-fit; live host renders 480×246 by default and ignores inner `min-height`
  - Phase 2 template lacks 100% width CSS, collapsing content to natural width
  - Phase 3-01 comments REST hangs in dialog iframe (location-service unreachable)
  - Phase 3-03 dropdown won't close on select (ListSelection.selectOnFocus default true)
  - Manifest version walked 0.1.1 → 0.1.16 across the live publish loop
- Empirical proof that the read path produces the correct context line, pre-fill, mismatch banner, calc panel, and stub-Apply payload on a real ADO API surface
- Phase 4/5 follow-up inventory captured (custom SP field on customer Scrum installs, visible-sentinel UX, dev-publish Windows retry, cross-process coverage)

## Task Commits

Each fix was committed atomically per the plan's labeling rule at [03-04-PLAN.md:100](.planning/phases/03-modal-ui-read-path/03-04-PLAN.md#L100):

1. **fix-back to Plan 01-02 — audit parser HTML-entity decode** — `a3d3685` (fix)
2. **fix-back to Plan 02-01 — dialog SDK.resize lifecycle + body 100% width** — `58ba80a` (fix)
3. **fix-back to Plan 03-01 — comments REST direct fetch (Override 4)** — `65c6475` (fix)
4. **fix-back to Plan 03-03 — Dropdown selectOnFocus:false (Override 7)** — `8d96bae` (fix)
5. **Diagnostic logging across read path** — `27056c8` (chore)
6. **Manifest version bump to 0.1.16** — `2a5f2ea` (chore)

The SUMMARY commit (this file + 03-VERIFICATION.md + STATE.md/ROADMAP.md updates) will land as the closing commit on this plan.

## Files Created/Modified

- `.planning/phases/03-modal-ui-read-path/03-VERIFICATION.md` — full 12-item D-29 record + Real-world Corrections section + Phase 3 verdict
- `.planning/phases/03-modal-ui-read-path/03-04-SUMMARY.md` — this file
- `src/audit/parse.ts` — `decodeAdoEntities()` helper added; `parse()` now decodes before regex match
- `src/entries/modal.tsx` — `SDK.resize(window.innerWidth, body.scrollHeight)` on bootstrap completion + `ResizeObserver` on `document.body` for layout-changing events
- `src/template.html` — `<style>html, body, #root { width:100%; height:100%; margin:0; padding:0; box-sizing:border-box }</style>`
- `src/ado/comments.ts` — `ModernCommentsClient` subclass removed; `fetchCommentsForRead` now uses `SDK.getHost().name + SDK.getAccessToken() + fetch()` with manual URL construction
- `src/ui/Dropdown3.tsx` — `new ListSelection({ selectOnFocus: false })` plus equality guard in the value→selection sync useEffect
- `src/ui/CalcModal.tsx` — per-step `console.log` breadcrumbs across the read path (form service, projectId, type name, getFields probe, resolved field, parallel reads, comment dump, parseLatest result)
- `vss-extension.json` — `0.1.1` → `0.1.16` walking each Marketplace publish

## Decisions Made

- **Direct fetch for ADO REST from dialog iframe.** The SDK's REST client (`getClient(ClientClass) → beginRequest → _rootPath → location-service`) hangs indefinitely in a custom-dialog iframe context. Form services postMessage and `getAccessToken` work; only the location service is unreachable. We bypass the SDK REST client entirely and construct URLs from `SDK.getHost().name`. Phase 4 should adopt the same pattern for `addComment` (likely a shared util).
- **Width strategy: echo `window.innerWidth`.** Using a hardcoded 480 was narrower than the host's intended dialog width on a real screen; using `SDK.resize()` with no args collapsed width to `scrollWidth` (the natural width of the rendered content). Reading `window.innerWidth` and echoing it preserves the host's allocation while still letting us auto-fit height.
- **Keep diagnostic logs.** The per-step `[sp-calc/...]` logs were instrumental in pinpointing each bug. They stay in the codebase for Phase 4 write-path debugging and ongoing verification evidence. Cleanup deferred to Phase 5 polish.
- **PARTIAL PASS rather than full PASS.** Three checks (1, 10, 12) were not formally exercised across all dimensions. The architectural risks they cover are validated by Phase 2 (toolbar/dialog wiring) and unit tests (FieldResolver per-process behavior); cross-type/keyboard/theme coverage formalization deferred to Phase 5.
- **Visible-sentinel UX is Phase 4's call.** The HTML-comment sentinel survives ADO's storage round-trip but appears as literal `<!-- ... -->` text in the rendered comment. Three options inventoried for Phase 4: accept, post-as-HTML, different invisible carrier.

## Deviations from Plan

The plan's checklist assumed the cezari org runs **Agile** (per D-31). cezari actually runs **Scrum** (Product Backlog Item is the primary backlog type, not User Story). This caused Check 1 to be partially exercised; the modal-open flow was confirmed for one PBI. SDK lifecycle and toolbar contribution are type-agnostic per Phase 2 verification, so cross-type risk is low.

The plan's Task 1 expected `npm run dev:publish` to handle Marketplace re-publishing. The wrapper aborts on Windows because spawnSync fails to capture stdout/stderr (already documented in [03-VERIFICATION.md](.planning/phases/03-modal-ui-read-path/03-VERIFICATION.md) Issues Discovered → wrapper retry). All 12+ Marketplace publishes during this run used direct `npx tfx extension publish --override` invocations.

Six bug fixes were applied during execution per the plan's authorization at [03-04-PLAN.md:100](.planning/phases/03-modal-ui-read-path/03-04-PLAN.md#L100) — these are real Phase 1/2/3 defects that only manifest on the live ADO host, exactly the type of finding 03-04 is designed to surface. Each is committed atomically with a `fix(03-04): patch <plan-id> regression — <reason>` label.

## Issues Encountered

All issues were resolved inline via the atomic fix-back commits enumerated above. See [03-VERIFICATION.md](.planning/phases/03-modal-ui-read-path/03-VERIFICATION.md) Real-world Corrections section for per-finding detail (origin file, symptom, fix, phase implication).

The single non-resolved item is the Dropdown's `aria-hidden="true"` on the wrapper while focus is held by a descendant — a library-level issue in `azure-devops-ui` that would require a fork to fix. Browser refuses to apply the aria-hidden (a11y safety net) and logs a warning. Non-blocking for v1.

## User Setup Required

None — no external service configuration required for this plan beyond what Phase 0 / Phase 2 already established (Marketplace publisher, `.env.local` PAT).

## Next Phase Readiness

Phase 4 (Write Path & Edge Cases) can begin. Pre-loaded follow-ups for Phase 4's plan to inherit:

1. **Direct-fetch for `addComment`** — Phase 4 must NOT use `WorkItemTrackingRestClient.addComment(...)` via `getClient`; it will hang for the same reason as the read path. Use `SDK.getAccessToken() + SDK.getHost().name + fetch()`. Consider extracting a shared `adoFetch` util in `src/ado/`.
2. **Visible-sentinel UX decision** — pick one of: (a) accept the visible sentinel in rendered comment text, (b) post in HTML format so the API preserves real `<!-- -->` HTML comments, (c) move JSON to a different invisible carrier (e.g. `<div hidden>`). Test ADO's sanitizer behavior empirically before locking choice.
3. **Atomicity ordering** — Phase 0's atomicity decision applies; Phase 4's plan should reference it from PROJECT.md Key Decisions.

For Phase 5 (Polish & Marketplace Publish):

4. **Cross-process coverage** — exercise Check 1 across all Scrum types (PBI, Bug, Task, Feature, Epic) AND on a separate Agile org (User Story replaces PBI). Currently cezari covers Scrum/PBI only.
5. **Custom SP field handling** — real-world Scrum installs may delete the inherited `Microsoft.VSTS.Scheduling.StoryPoints` field in favor of a custom field. Either document as a known limitation or add a settings UI for custom ref-name override.
6. **Per-component theme matrix + per-key keyboard transcripts** — formalize what was attested in this run.
7. **Fix `dev-publish.cjs` Windows retry bug** — already inventoried in 03-VERIFICATION.md; cleanup before Phase 5 publish.

---
*Phase: 03-modal-ui-read-path*
*Plan: 04*
*Completed: 2026-05-02*
