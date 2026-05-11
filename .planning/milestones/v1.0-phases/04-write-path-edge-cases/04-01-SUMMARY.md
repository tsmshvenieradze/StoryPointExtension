---
phase: 04-write-path-edge-cases
plan: 01
subsystem: verification
tags: [spike, empirical, ado-rest, format-1, isReadOnly, lightDismiss, api-version, cezari-verification, vsix-publish]

# Dependency graph
requires:
  - phase: 03-modal-ui-read-path
    provides: src/ado/comments.ts direct-fetch pattern (Override 4) reused by spike Probe 1 + Probe 4 POST bodies; src/entries/modal.tsx SDK lifecycle (Override 5) mirrored by modal-spike.tsx bootstrap
provides:
  - "04-VERIFICATION.md ## Spike Results section: verbatim transcripts + per-assumption verdicts (A1, A3, A4, A5, Probe 4) — empirical evidence for D-01/D-02/D-05/D-07/D-10/D-13/D-15"
  - "D-02 fallback adopted as Phase 4 baseline: audit comment becomes human-readable-only (no HTML-comment sentinel); postComment.ts payload is { text } only, no format field"
  - "bridge.getIsReadOnly contract locked: returns { isReadOnly: false, probeFailed: true } unconditionally; D-07 reactive error handling via apply.ts catch is the only read-only signal"
  - "D-10 redefinition: modal stays open after success; user dismisses manually via host close affordance — SavedIndicator + persistent saved-state view in modal body"
  - "D-13 confirmed: api-version 7.0-preview.3 is the single source of truth (matches Phase 3 read path)"
affects:
  - 04-03 postComment.ts (consumes D-02 fallback decision: { text } payload, no format field, no sentinel-building helper)
  - 04-03 bridge.ts (consumes A3 LAZY-FALLBACK-ONLY verdict: getIsReadOnly returns probeFailed:true unconditionally)
  - 04-04 SavedIndicator.tsx (consumes A4 NO-PROGRAMMATIC-CLOSE verdict: 200ms Saved ✓ then persistent saved-state, no SDK close call)
  - 04-05 CalcModal saved-mode handler (consumes A4 + Probe 4 verdicts: lightDismiss:false everywhere; user dismisses manually)
  - 04-05 toolbar.tsx (openCustomDialog options: lightDismiss:false defense-in-depth)
  - "Future Plan (post-04 / D-16 reopen-pre-fill): if reopen-pre-fill is built, must regex-parse the human-readable Story Points line — sentinel JSON round-trip is no longer available"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spike-then-revert pattern: throwaway src/entries/modal-spike.tsx + temporary webpack entry + manifest URI swap, all reverted in a paired chore() commit after empirical evidence is captured in 04-VERIFICATION.md"
    - "VSIX private-share publish via direct npx tfx (PAT from .env.local) — used both for spike (0.1.18) and cleanup (0.1.20 after --rev-version auto-bump)"
    - "Verification document structure: ## Spike Results with verdict-summary table + per-assumption sections (verbatim transcripts + per-candidate findings + downstream-plan decisions); mirrors 03-VERIFICATION.md ## Real-world Corrections format"

key-files:
  created:
    - .planning/phases/04-write-path-edge-cases/04-VERIFICATION.md (## Spike Results: 226 lines — A1/A3/A4/A5/Probe 4 verdicts, verbatim console transcripts, downstream-plan decisions)
  modified:
    - vss-extension.json (version walk 0.1.16 -> 0.1.18 [spike] -> 0.1.19 [revert] -> 0.1.20 [tfx --rev-version on cleanup publish]; properties.uri swapped to dist/modal-spike.html for spike then back to dist/modal.html for cleanup)
    - webpack.config.cjs (modal-spike entry added then removed; final state matches pre-Plan-04-01 — toolbar + modal only)
  deleted:
    - src/entries/modal-spike.tsx (throwaway spike file; existed for ~24 hours of forensic-evidence capture)

key-decisions:
  - "D-01 FALSIFIED: ADO storage strips HTML-comment sentinel regardless of api-version (7.0-preview.3 / 7.1-preview.4) and format param (1 / omitted). Audit comment cannot use HTML-comment carriers."
  - "D-02 fallback adopted: audit comment is human-readable-only ('Story Points: N (Complexity=X, Uncertainty=Y, Effort=Z)'). No machine-parseable round-trip. Reopen-pre-fill (D-16, deferred) becomes regex-against-human-text if ever built."
  - "D-05 FALSIFIED: no eager isReadOnly probe is reliable. formService.isReadOnly is undefined; SDK.getUser lacks license-tier discriminators; self-setFieldValue can't be cleanly probed without dirty side-effects."
  - "D-07 LAZY-FALLBACK-ONLY: bridge.getIsReadOnly returns { isReadOnly: false, probeFailed: true } unconditionally. Read-only branch is reached reactively when apply.ts catches setFieldValue/save() rejections, not preemptively at modal-open."
  - "D-10 REDEFINED: no programmatic close from ms.vss-web.external-content dialog (notifyDialogResult / notifyDismiss / closeCustomDialog all undefined on SDK v4). SavedIndicator shows 200ms Saved ✓ then persistent saved-state view; user dismisses manually."
  - "D-13 CONFIRMED: 7.0-preview.3 and 7.1-preview.4 functionally identical for addComment. Use 7.0-preview.3 to match Phase 3 read path (single source of truth in src/ado/comments.ts / future src/ado/adoFetch.ts per D-14)."
  - "Probe 4 / D-15: lightDismiss does NOT abort in-flight writes (deferred setFieldValue + save() completed server-side after dialog closed). lightDismiss:false during saving is required for UX clarity, not data integrity. No AbortController plumbing needed."

patterns-established:
  - "Spike-evidence-first: when [ASSUMED] decisions exist on SDK semantics, ship a throwaway probe build to a private-shared cezari org BEFORE any production implementation file is written. Capture verbatim transcripts in {phase}-VERIFICATION.md so downstream plans grep for empirical evidence, not training-data assumptions."
  - "Defense-in-depth UX hardening even when data is safe: Probe 4 proved writes complete after lightDismiss, so lightDismiss:false is a UX-only requirement (not a data-integrity one) — but we still mandate it because the silent-late-write UX is unacceptable."
  - "Single api-version constant convention: when read path and write path both touch comments REST, share one constant (7.0-preview.3) consumed by both src/ado/comments.ts and src/ado/postComment.ts."

requirements-completed: []  # Plan 04-01 declares APPLY-06 / APPLY-09 in its frontmatter but DECIDES them empirically (api-version, read-only UX shape) rather than IMPLEMENTING them. APPLY-06 implementation lands in Plan 04-03 (postComment.ts); APPLY-09 implementation lands in Plan 04-05 (CalcModal read-only branch). Marking complete in those plans, not this one.

# Metrics
duration: 24h-spike-cycle (calendar; ~30min Claude active across 3 sessions)
completed: 2026-05-02
---

# Phase 4 Plan 1: Empirical Spike — Cezari Probe Resolution Summary

**4 [ASSUMED] decisions resolved with cezari empirical evidence: D-01 FALSIFIED (sentinel stripped), D-05 FALSIFIED (no eager isReadOnly probe), D-10 REDEFINED (no programmatic close), D-13 CONFIRMED (api-versions equivalent) — downstream plans 04-03/04-04/04-05 now implement against verified facts, not training-data guesses.**

## Performance

- **Duration:** ~24h calendar (spike build → user runs probes → record + revert); ~30min total Claude active across 3 sessions (spike build, results capture, revert)
- **Started:** 2026-05-02 (Plan 04-01 began with prior commits 9cf6409 + 76a4f9b)
- **Completed:** 2026-05-02T15:45:49Z (this continuation: Task 3 + Task 4)
- **Tasks:** 4 (Task 1 = human-action checkpoint on cezari; Tasks 2/3/4 = atomic Claude commits)
- **Files modified:** 3 (vss-extension.json, webpack.config.cjs, src/entries/modal-spike.tsx); 1 created (04-VERIFICATION.md); 1 deleted (modal-spike.tsx)

## Accomplishments

- All four [ASSUMED] decisions empirically resolved on cezari before any Phase 4 implementation file was written — front-loading discovery the same way Phase 03-04 cezari verification surfaced 6 real-world bugs.
- D-02 fallback adopted: audit comment becomes human-readable-only. This simplifies postComment.ts (no sentinel-building helper) at the cost of losing reopen-pre-fill round-trip — a "nice to have" not on the Phase 4 must-have list.
- bridge.getIsReadOnly contract locked: probeFailed:true is BASELINE behavior. Read-only UX shifts from preemptive (modal-open-time) to reactive (apply-click-time post-403).
- D-10 redefined: SavedIndicator now shows 200ms Saved ✓ then persistent saved-state view; user dismisses via host close affordance. Plans 04-04 and 04-05 must implement this shape.
- Probe 4 surfaced a UX risk no documentation flagged: lightDismiss does NOT abort in-flight writes (the iframe keeps running JS after the host hides it). lightDismiss:false during saving is mandatory for UX clarity.
- Repo restored to clean post-spike state: no spike file, webpack restored, manifest URI restored, version walked appropriately. Cezari has the cleanup VSIX 0.1.20.

## Task Commits

Each task was committed atomically:

1. **Task 2: Build & publish spike VSIX** — `9cf6409` (`feat(04-01): add spike modal — 4 probes for D-01/D-05/D-10/D-13 resolution`) + `76a4f9b` (`chore(04-01): bump manifest to 0.1.18 (spike VSIX published to cezari)`)
2. **Task 1: Human-action checkpoint** — no Claude commit (user ran probes on cezari PBI #2; verbatim console transcripts pasted back into chat)
3. **Task 3: Write spike outcomes into 04-VERIFICATION.md** — `62bcc55` (`docs(04-01): record spike results — D-01/D-05/D-10 empirical findings`)
4. **Task 4: Revert spike scaffolding** — `ad66888` (`chore(04-01): revert spike scaffolding (modal-spike.tsx, manifest URI)`)

**Plan metadata commit:** TBD (final commit captures this SUMMARY + STATE/ROADMAP updates).

## Files Created/Modified

- `.planning/phases/04-write-path-edge-cases/04-VERIFICATION.md` — Created. ## Spike Results section with verbatim DevTools console transcripts for all four probes, verdict-summary table, per-assumption findings (A1/A3/A4/A5 + Probe 4), and explicit downstream-plan decisions. Stub sections for ## Manual Verification Checklist (Plan 04-06) and ## Real-world Corrections preserved.
- `vss-extension.json` — Version walked through 0.1.16 → 0.1.17/0.1.18 (Task 2 spike publish) → 0.1.19 (Task 4 revert + bump) → 0.1.20 (tfx --rev-version auto-bump on cleanup publish). properties.uri swapped to dist/modal-spike.html during spike, back to dist/modal.html for cleanup.
- `webpack.config.cjs` — Temporarily added `baseConfig('modal-spike', mode)` entry (Task 2); removed in Task 4. Final state matches pre-Plan-04-01: toolbar + modal only.
- `src/entries/modal-spike.tsx` — Created in Task 2 with 4 probes (probe1=format:1 sentinel preservation matrix; probe2=isReadOnly mechanisms; probe3=programmatic close attempts; probe4=mid-write force-close); deleted in Task 4 after evidence captured. Lifecycle pattern (`SDK.init({loaded:false}) → ready() → notifyLoadSucceeded()`) mirrored from `src/entries/modal.tsx` Override 5.

## Decisions Made

See key-decisions in frontmatter (7 decisions). Highlights:

- **D-02 fallback (audit comment human-readable-only):** the spike empirically falsified D-01's sentinel-preservation hypothesis. Trade-off accepted: simpler postComment.ts at the cost of losing machine-parseable round-trip from comment back to inputs. Reopen-pre-fill (D-16) is deferred and would parse human-readable text if ever implemented.
- **bridge.getIsReadOnly LAZY-FALLBACK-ONLY:** the spike falsified all four probe candidates. Read-only UX is reactive (apply-click-time) per D-07. CalcSpReadResult typing reflects probeFailed:true as baseline.
- **D-10 redefinition:** modal stays open in saved state. The user explicitly closes via host affordance. SavedIndicator post-200ms swap to a persistent saved-state view (not a self-close attempt) is the new design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale spike artifacts in dist/ after Task 4 build**

- **Found during:** Task 4 (post-build verification)
- **Issue:** `npm run build` after webpack-config revert succeeded but `dist/modal-spike.html` and `dist/modal-spike.js` remained from the prior spike build because `webpack.config.cjs` has `clean: false`. Acceptance criterion was `test ! -f dist/modal-spike.html`.
- **Fix:** `rm dist/modal-spike.html dist/modal-spike.js` after the build. `dist/` now contains only toolbar.{html,js} + modal.{html,js}.
- **Files modified:** dist/modal-spike.html (deleted), dist/modal-spike.js (deleted) — both untracked build artifacts, not in any commit.
- **Verification:** `ls dist/ | grep -E "\.(html|js)$"` returns 4 files (no spike).
- **Committed in:** N/A — `dist/` is build output, never tracked. Task 4 commit (`ad66888`) covers the source-side revert.

**2. [Rule 3 - Blocking] Manifest version auto-bumped beyond plan-stated 0.1.19**

- **Found during:** Task 4 (cleanup VSIX publish via `npx tfx ... --rev-version`)
- **Issue:** Plan stated bump 0.1.18 → 0.1.19 before publish. The `--rev-version` flag (used by both Task 2 and Task 4 publish wrappers per Phase 3 pattern) auto-incremented the on-disk manifest from 0.1.19 to 0.1.20 during the cleanup publish.
- **Fix:** None needed — the plan explicitly anticipated this: "If publish succeeds the version may auto-increment to 0.1.20 (`--rev-version`) — record the actual published version in the SUMMARY." Auto-bump is the documented outcome.
- **Files modified:** vss-extension.json `"version": "0.1.20"` (auto-edited by tfx)
- **Verification:** Cezari Manage Extensions page shows 0.1.20 (validation pending — `--no-wait-validation` was used). On-disk file matches.
- **Committed in:** `ad66888` (Task 4 commit; manifest at 0.1.20 in the committed tree).

---

**Total deviations:** 2 auto-fixed (both Rule 3 — Blocking, both anticipated by plan)
**Impact on plan:** No scope change. Both deviations are mechanical artifacts of the spike-then-revert workflow on Windows / tfx-cli interactions; the plan explicitly anticipated the version auto-bump.

## Issues Encountered

- **Probe 2 (c) self-setFieldValue side-effect uncertainty:** The post-write `formService.reset()` call entered the catch branch with `undefined name`/`undefined message`. We could not confirm whether `reset` is missing or threw a non-Error sentinel. This means we cannot reliably use self-setFieldValue as a probe even if we wanted to (the cleanup step is unreliable). Reinforces the LAZY-FALLBACK-ONLY verdict.
- **Webpack compile-time warnings on spike build:** `notifyDialogResult`, `notifyDismiss`, `closeCustomDialog` are not exports from `azure-devops-extension-sdk` v4. The optional-chained calls returned undefined silently because the methods don't exist. Warnings cleared once `modal-spike.tsx` was deleted in Task 4.

## Self-Check

- **Files claimed to exist:**
  - `.planning/phases/04-write-path-edge-cases/04-VERIFICATION.md` — FOUND
  - `vss-extension.json` (modified, version 0.1.20) — FOUND
  - `webpack.config.cjs` (modified, no modal-spike entry) — FOUND
  - `src/entries/modal-spike.tsx` — DELETED (claimed deleted; verified absent)
- **Commits claimed to exist:**
  - `9cf6409` (Task 2 feat) — FOUND in master
  - `76a4f9b` (Task 2 manifest bump) — FOUND in master
  - `62bcc55` (Task 3 spike results) — FOUND in master
  - `ad66888` (Task 4 revert) — FOUND in master

## Self-Check: PASSED

## Threat Flags

None — Plan 04-01 introduced no new network endpoints, auth paths, file access patterns, or schema changes beyond those already documented in the plan's `<threat_model>`. Spike code reused the existing `src/ado/comments.ts` direct-fetch pattern; threat model already covers the trust boundary.

## Next Phase Readiness

- **Plan 04-03 (postComment.ts + bridge.ts):** ready to implement. Decisions locked: payload `{ text }` only / api-version `7.0-preview.3` / `getIsReadOnly` returns `{ isReadOnly: false, probeFailed: true }` unconditionally.
- **Plan 04-04 (SavedIndicator):** ready to implement. 200ms Saved ✓ then persistent saved-state view (no SDK close call).
- **Plan 04-05 (CalcModal state machine + toolbar.tsx):** ready to implement. saved mode added to state machine; `lightDismiss:false` in `openCustomDialog` options; reactive read-only handling on apply-click 403.
- **Plan 04-06 (cezari verification):** stub sections preserved in 04-VERIFICATION.md (`## Manual Verification Checklist` + `## Real-world Corrections`) for Wave 4.
- **No blockers** for downstream Phase 4 work. Note: 04-02 SUMMARY (errorMessages pure module + APPLY-09 rewrite) was already produced in a parallel/preceding context; this plan does not affect it.

---
*Phase: 04-write-path-edge-cases*
*Plan: 01*
*Completed: 2026-05-02*
