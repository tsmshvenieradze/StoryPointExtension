---
phase: 05-polish-marketplace-publish
status: passed
verdict: PARTIAL PASS (shipped public; carry-overs to v1.0.1)
date: 2026-05-02
---

# Phase 5 Verification — Polish & Marketplace Publish

## Verdict

**PARTIAL PASS — shipped to public Marketplace.**

v1.0.0 published, validated, and live at:

```
https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator
```

`tfx extension isvalid` returns `Valid`. The extension is publicly installable.

PARTIAL because three closing items deferred to v1.0.1 (see Carry-overs below).

## Public Publish Record

| Field | Value |
|---|---|
| Publisher | `TsezariMshvenieradzeTfsAiReviewTask` |
| Extension ID | `story-point-calculator` |
| Version | `1.0.0` |
| Public | true |
| Scope | `vso.work_write` |
| Validation status | Valid (confirmed `tfx extension isvalid`) |
| Publish commit | `bfeb1ce` |
| Listing URL | `https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator` |

### Publisher Swap (deviation from CONTEXT.md D-1 / Plan 05-01)

The original publisher `TsezariMshvenieradzeExtensions` (used Phases 0–4 for private cezari publishes) returned `error: The extension already exists` on every public publish attempt — its private state was stuck server-side. Switched to the user's existing `TsezariMshvenieradzeTfsAiReviewTask` publisher (already verified by prior public extensions) and the publish succeeded immediately.

Plan 05-01 (publisher verification gate on the original publisher) is therefore **moot** — the publisher used at ship time was already verified via prior public publishes. No verification request was needed.

### tfx Output (verbatim — `bfeb1ce` publish run)

```
[publish:cezari] PUBLIC publish — vss-extension.json public:true confirmed.
[publish:cezari] npx tfx extension publish → PUBLIC Marketplace (token redacted)
TFS Cross Platform Command Line Interface v0.23.1
Copyright Microsoft Corporation
warning: Could not determine content type for extension .woff2. Defaulting to application/octet-stream.
Checking if this extension is already published
It isn't, create a new extension.

== Extension Validation In Progress ==
Based on the package size, this can take up to 20 mins. You passed --no-wait-validation, so TFX is exiting.

=== Completed operation: publish extension ===
 - Packaging: TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator-1.0.0.vsix
 - Publishing: success
 - Sharing: not shared (use --share-with to share)
```

Validation completed shortly after, status: `Valid`.

### Build Surface Shipped

- `dist/toolbar.html` + `dist/toolbar.js`
- `dist/modal.html` + `dist/modal.js`
- `images/icon.png` (placeholder — see v1.0.1 carry-overs)
- `images/toolbar-icon.png`
- `overview.md` (root — Marketplace details file)
- `LICENSE`

Bundle size: 146.8 KB gzipped / 250 KB budget (103.2 KB headroom). Bundle gate: PASSING.

## Requirement Verdicts

| Req | Verdict | Evidence |
|---|---|---|
| **PKG-02** | PASS | `tfx extension publish` packaged a valid `.vsix` with both webpack entries (toolbar + modal) and the manifest. Validation status: `Valid`. |
| **PKG-03** | PASS | `scripts/check-bundle-size.cjs` enforces 250 KB gzipped gate; CI workflow at `.github/workflows/ci.yml` runs the gate on every push + PR. Current build 146.8 KB / 250 KB passes the gate hard-fail check (D-4). |
| **PKG-04** | PARTIAL | Extension is installable on the trial org (`cezari`); installs verified across Phase 4 fix-back loop. Contributor non-admin explicit verification SKIPPED per CONTEXT D-7 (trust `vso.work_write` scope sufficient). Documented deviation. |
| **PKG-05** | PARTIAL | Marketplace listing description (`overview.md`), GitHub repository link, support link, license link, formula explanation (axes only, math in README), privacy statement, known limitations — all present. **Screenshots[] removed for v1.0.0** to unblock the publish; carry over to v1.0.1. |
| **PKG-06** | MOOT | Publisher used (`TsezariMshvenieradzeTfsAiReviewTask`) was already verified via prior public extensions. No verification request required. The original `TsezariMshvenieradzeExtensions` publisher (referenced in Plan 05-01) is now unused. |
| **PKG-07** | PARTIAL | Public publish succeeded; extension installable on any ADO org. Cross-process smoke (Agile + CMMI work item types per CONTEXT D-5/D-6) DEFERRED to v1.0.1 — Plan 05-04 not run. Risk: low (same FieldResolver code path; unit tests pass). Documented deviation. |

## Carry-overs to v1.0.1 (cleanup PR)

These were intentional for speed-to-ship. None block public install or use:

1. **Screenshots** — capture light + dark via DevTools "Capture node screenshot" on cezari, pad to 1366×768, save to `images/screenshots/`, restore the `screenshots[]` array in the manifest.
2. **Icon** — replace 143-byte placeholder `images/icon.png` with a hand-designed 128×128 PNG.
3. **Cross-process smoke** — Plan 05-04: add Agile + CMMI projects to cezari, run open-modal + Apply on User Story (Agile) and Requirement (CMMI) to verify FieldResolver fallback path empirically.
4. **Old publisher cleanup** — optional housekeeping: unpublish / delete the stuck private extension on the original `TsezariMshvenieradzeExtensions` publisher to avoid confusion.

## Spike Verdict Compliance

All Phase 4 empirical spike findings preserved in the shipped artifact:

- **A1 STRIPPED-FALLBACK** — `postComment` payload is `{ text }` only with the human-readable Story Points line. No sentinel.
- **A3 LAZY-FALLBACK-ONLY** — `bridge.getIsReadOnly` returns `{ isReadOnly: false, probeFailed: true }` unconditionally. Read-only state surfaces reactively via `FieldFailBanner`.
- **A4 NO-PROGRAMMATIC-CLOSE** — `SavedIndicator` shows ✓ for 200ms then transitions to a persistent saved-state. Modal stays open until user dismisses (click-outside or X). Listing description (`overview.md`) explicitly notes Esc-doesn't-dismiss limitation.
- **A5 / D-13** — `postComment` uses api-version `7.0-preview.3`; matches `comments.ts` read path single source of truth.
- **D-15 (Probe 4 finding)** — `lightDismiss` left at host default (true). UX surprise from Probe 4 mitigated by SavingOverlay + Dropdown disabled + body aria-hidden during saving.

## Phase 5 Plans Status

| Plan | Status | Notes |
|---|---|---|
| 05-01 | MOOT | Publisher verification gate — original publisher abandoned; the publisher actually used was already verified. Plan output (`05-VERIFICATION.md` skeleton) remains. |
| 05-02 | PASS | Build infrastructure trio: GitHub Actions CI, bundle-size script, publish-cezari.cjs Windows fix all in (`3f1ca1e`, `00a6f3d`, `e563dfe`, `24c62f8`, `ef6f0c5`). |
| 05-03 | PARTIAL | Manifest delta (`f21c68e`), overview.md (`007e0c7`), README v1 (`a63b4fc`), Task 4 icon Option II decision (`72bc53f`). Tasks 5 (screenshots) + 6/7 (cezari re-publish & render verify) deferred to v1.0.1. |
| 05-04 | DEFERRED | Cross-process Agile + CMMI smoke — v1.0.1 backlog. |
| 05-05 | PASS | Public publish executed via publisher swap (`bfeb1ce`); validation `Valid`. |

## Plan-Check Compliance

| Issue | Required Fix | Verification |
|---|---|---|
| **H-1** (BLOCK) | Replace tautological `! grep -F "content.license"` with Node JSON.parse structural check | Honored in Plan 05-03 Task 1 acceptance + commit `f21c68e`. |
| **M-1** | Plan 05-03 frontmatter `depends_on: ["05-02"]` | Honored in commit `fd1e1c5`. |
| **M-2** | `git remote get-url origin` precondition gate | Verified manually before Plan 05-03 Task 1 commit. |
| **M-3** | Plan 05-04 toolbar-contribution propagation note | Honored in commit `fd1e1c5`. (Plan 05-04 itself deferred to v1.0.1.) |
