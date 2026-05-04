---
phase: 05-polish-marketplace-publish
plan: 05
status: passed
verdict: PARTIAL PASS (shipped public; carry-overs to v1.0.1)
self_check: passed
requirements-touched: [PKG-02, PKG-03, PKG-04, PKG-05, PKG-06, PKG-07]
completed: 2026-05-02 (v1.0.0 publish), continued through 2026-05-04 (v1.0.3 fix-back)
versions-shipped: [1.0.0, 1.0.1, 1.0.2, 1.0.3]
listing-url: https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator
publisher-actually-used: TsezariMshvenieradzeTfsAiReviewTask
publisher-originally-planned: TsezariMshvenieradzeExtensions (abandoned — see Plan 05-01 SUMMARY)
---

# Plan 05-05 — Public Publish v1.0.0 (PASSED + carry-overs through v1.0.3)

## Outcome

**Status: PASSED.** The Story Point Calculator extension is live and publicly installable on Visual Studio Marketplace at version **1.0.3** (latest), under publisher `TsezariMshvenieradzeTfsAiReviewTask`. v1.0.0 was the gating public publish; three subsequent patch releases (v1.0.1 / v1.0.2 / v1.0.3) addressed carry-overs and one post-publish UI fix.

Listing URL: https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator
`tfx extension isvalid` returns `Valid`.

Phase 5 verdict: **PARTIAL PASS** (per `05-VERIFICATION.md ## Verdict`) — shipped public; three closing items deferred to v1.0.1+ (screenshots, cross-process smoke, old-publisher cleanup; the icon carry-over was closed by v1.0.1 itself).

## Ship Sequence (4 commits / 4 published versions)

| Version | Commit | Date | What shipped |
|---|---|---|---|
| **v1.0.0** | `bfeb1ce` | 2026-05-02 | Public publish via publisher swap (`TsezariMshvenieradzeExtensions` → `TsezariMshvenieradzeTfsAiReviewTask`); manifest version 0.2.x → 1.0.0; `public: false → true`; tfx validation `Valid`; first public-Marketplace listing live. |
| **v1.0.1** | `6592590` | 2026-05-03 | Calculator-themed icon — replaces the 143-byte transparent placeholder `images/icon.png` shipped with v1.0.0. Closes carry-over #2 from `05-VERIFICATION.md`. |
| **v1.0.2** | `06f1ed0` | 2026-05-03 | UI fix: drop `bolt-page-grey` background from modal Surfaces (post-publish visual issue noticed on the live listing — modal background didn't inherit theme cleanly with that class applied). Not a carry-over — a real-world bug surfaced by the public install. |
| **v1.0.3** | `311e90d` | 2026-05-04 | Add `links.privacypolicy` to `vss-extension.json` to satisfy Marketplace Top Publisher Privacy gate. Marketplace flagged the listing as missing privacy policy URL post-1.0.0; this commit adds the field. |

## Plan-vs-Reality Deviations

The 05-05-PLAN.md as authored assumed:
- Publisher: `TsezariMshvenieradzeExtensions` (the Phase 0–4 private-publish publisher).
- Single ship moment at v1.0.0 with cross-process smoke (Plan 05-04) as a precondition.
- Version walk: 0.2.x → 1.0.0 in one commit; package.json sync 0.1.0 → 1.0.0 in the same commit.

Reality at execution:
- **Publisher swap.** `TsezariMshvenieradzeExtensions` returned `error: The extension already exists` on every public publish attempt — its server-side state was stuck in private. Switched to the user's existing `TsezariMshvenieradzeTfsAiReviewTask` publisher (already verified via prior public extensions); publish succeeded immediately. Plan 05-01 (verification gate on the original publisher) became MOOT — see `05-01-SUMMARY.md`.
- **Plan 05-04 deferred, not run.** Cross-process Agile + CMMI smoke skipped to ship faster. PKG-04 / PKG-07 closed as PARTIAL with explicit deviation in `05-VERIFICATION.md ## Requirement Verdicts`.
- **Three patch releases.** v1.0.0 was correct on the wire-format; v1.0.1 (icon) was a known carry-over closed quickly post-publish; v1.0.2 (modal bg) and v1.0.3 (privacy URL) were real-world fixes surfaced by the live listing. Each shipped atomically with its own commit; manifest version walked to track.

## Bundle Footprint (1.0.x)

From `05-VERIFICATION.md`: 146.8 KB / 250 KB gzipped budget — 103.2 KB headroom (41% of budget free). Bundle gate (`scripts/check-bundle-size.cjs` + `.github/workflows/ci.yml`) PASSING on every push. CI green throughout the v1.0.x series.

## Requirement Verdicts (verbatim from 05-VERIFICATION.md ## Requirement Verdicts)

| Req | Verdict | Evidence |
|---|---|---|
| **PKG-02** | PASS | tfx packaged a valid `.vsix` with both webpack entries; validation `Valid`. |
| **PKG-03** | PASS | `scripts/check-bundle-size.cjs` enforces 250 KB gzipped gate; CI runs it on every push + PR. |
| **PKG-04** | PARTIAL | Installable on cezari (Phase 4 + Phase 5 fix-back loop); Contributor non-admin explicit test SKIPPED per CONTEXT D-7. |
| **PKG-05** | PARTIAL | Description, repo link, support link, license, formula, privacy, known limitations all present in `marketplace/overview.md`. **Screenshots removed** for v1.0.0 to unblock; carried over to v1.0.1+. Icon: placeholder shipped with v1.0.0; replaced in v1.0.1. |
| **PKG-06** | MOOT (effective PASS) | Publisher actually used (`TsezariMshvenieradzeTfsAiReviewTask`) was already verified via prior public extensions. Original publisher (`TsezariMshvenieradzeExtensions`) referenced in Plan 05-01 is now unused. |
| **PKG-07** | PARTIAL | Public publish succeeded; installable on any ADO org. Cross-process Agile + CMMI smoke (Plan 05-04) DEFERRED to v1.0.1+. |

## Carry-overs to v1.0.1+ (from 05-VERIFICATION.md ## Carry-overs)

Tracked carry-overs at 1.0.0 ship time:

1. **Screenshots** — capture light + dark via DevTools "Capture node screenshot" on cezari, pad to 1366×768, save to `images/screenshots/`, restore the `screenshots[]` array in the manifest. **Status: still open.**
2. **Icon** — replace 143-byte placeholder `images/icon.png` with a hand-designed 128×128 PNG. **Status: CLOSED in v1.0.1 (`6592590`).**
3. **Cross-process smoke** — Plan 05-04: add Agile + CMMI projects to cezari, run open-modal + Apply on User Story (Agile) and Requirement (CMMI). **Status: still open.**
4. **Old publisher cleanup** — optional housekeeping: unpublish / delete the stuck private extension on the original `TsezariMshvenieradzeExtensions` publisher. **Status: still open (low-priority housekeeping).**

Post-1.0.0 issues that became their own ship commits (NOT pre-1.0.0 carry-overs):

5. **Modal background regression** — `bolt-page-grey` class breaking theme inheritance on modal Surfaces. **Status: CLOSED in v1.0.2 (`06f1ed0`).**
6. **Marketplace Top Publisher Privacy gate** — listing flagged missing `links.privacypolicy`. **Status: CLOSED in v1.0.3 (`311e90d`).**

## Files Modified Across the v1.0.x Series

Aggregated:
- `vss-extension.json` — version walks 0.2.x → 1.0.0 → 1.0.1 → 1.0.2 → 1.0.3; `public: true`; publisher swap to `TsezariMshvenieradzeTfsAiReviewTask`; `links.privacypolicy` added in v1.0.3; `screenshots[]` removed for v1.0.0 (carry-over #1).
- `package.json` — version sync 0.1.0 → 1.0.0 → ... → 1.0.3.
- `images/icon.png` — replaced in v1.0.1 (`6592590`) with calculator-themed icon.
- Modal Surface CSS — modified in v1.0.2 (`06f1ed0`) to drop `bolt-page-grey`.

Source code logic: unchanged from Phase 4. The v1.0.x series is publish-and-polish only.

## Self-Check: PASSED (verdict PARTIAL PASS — shipped public)

- Public Marketplace listing is live and installable.
- All four shipped versions tracked in git history (`bfeb1ce`, `6592590`, `06f1ed0`, `311e90d`).
- PKG-02..07 closed in REQUIREMENTS.md (PARTIAL footnotes for PKG-04 / PKG-05 / PKG-07 explicit per `05-VERIFICATION.md ## Requirement Verdicts`).
- Carry-overs documented; v1.0.x patch releases closed two of them (icon, modal bg) and one new one (privacy URL).

---
*Phase: 05-polish-marketplace-publish*
*Plan executed: 2026-05-02 through 2026-05-04 (across v1.0.0 → v1.0.3)*
*Closed-out: 2026-05-04*
