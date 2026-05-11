---
phase: 04-write-path-edge-cases
plan: 03
status: complete
completed: 2026-05-02
self_check: passed
---

# Plan 04-03 — ADO Write-Path Glue (adoFetch / postComment / getIsReadOnly)

## Outcome

Codified the Phase 03-04 Override 4 direct-fetch pattern into a single shared helper, added the write counterpart to the existing read path, refactored the read path onto the helper, extended the bridge with the spike-validated read-only probe, and exposed the new public surface through the `src/ado` barrel. All four tasks land per-plan; spike-derived deviations are documented inline.

## Tasks

| Task | Status | Commits |
|------|--------|---------|
| 1. `src/ado/adoFetch.ts` + tests | ✓ | `d48115f` |
| 2. `src/ado/postComment.ts` + tests | ✓ | `23487bd`, `e923d61` (test null-check) |
| 3. Refactor `src/ado/comments.ts` onto adoFetch | ✓ | `5b9d210` |
| 4. `getIsReadOnly` + `permission` slot + barrel | ✓ | `c6ca580` |

## Spike-Derived Implementation Choices

These deviations from the original plan text are driven by Plan 04-01's empirical findings (recorded in `04-VERIFICATION.md` `## Spike Results`):

| Spike Verdict | Plan-Time Hypothesis | Implementation Decision |
|---|---|---|
| **A1 STRIPPED-FALLBACK** | `format:1` preserves `<!--` sentinel | postComment payload is `{ text }` only — plain human-readable line, no `<!--` sentinel, no `format` field. `serialize()` is **NOT** called by postComment; the human text is built inline via a private `humanText(payload)` helper. `src/audit/serialize.ts` and `src/audit/parse.ts` are **untouched** (the recorded D-02 fallback chose plain-text-only over invisible-div carrier). |
| **A3 LAZY-FALLBACK-ONLY** | A working `isReadOnly` probe exists | `bridge.getIsReadOnly(_formService)` unconditionally returns `{ isReadOnly: false, probeFailed: true }`. The unused parameter (prefixed `_`) is retained so a future spike-validated probe can be inserted without churning callers. The apply orchestrator (Plan 04-05) handles read-only reactively via 403/412 errors mapped through `friendlyMessageForStatus`. |
| **A5 NO-FUNCTIONAL-DIFFERENCE** | api-version choice debated | Both 7.0-preview.3 and 7.1-preview.4 return `format:"html"` and accept `format:1`. We use `7.0-preview.3` for postComment (matches CONTEXT D-13). `comments.ts` keeps `7.1-preview.4` (modern read endpoint Phase 03-04 verified). |

## Files Created / Modified

### Created
- `src/ado/adoFetch.ts` — 83 lines. Generic `adoFetch<T>(method, path, apiVersion, body?, opts?)` direct-fetch helper with `.status`-attached errors.
- `src/ado/postComment.ts` — 60 lines. `postComment(workItemId, projectId, payload)` write-path wrapper.
- `tests/ado/adoFetch.test.ts` — 207 lines. 10 vitest assertions covering URL construction (host name, isHosted true/false, projectId encoding, api-version), header shape (Authorization Bearer, Content-Type only on POST), error shape (`.status` attached, body slice ≤ 200), and ok-response casting.
- `tests/ado/postComment.test.ts` — 102 lines. 9 vitest assertions covering api-version (`7.0-preview.3`), body shape (`{ text }` only — no `format`, no `<!--` sentinel), projectId encoding, error propagation with `.status` intact, and Level-corner text-format invariants.

### Modified
- `src/ado/comments.ts` — 101 → 51 lines. Removed inline direct-fetch boilerplate (host discriminator, token acquisition, URL construction, error handling) — now consumes `adoFetch<ModernCommentList>("GET", path, "7.1-preview.4")`. Behavior preserved exactly: same signature, same api-version, same Pitfall 5 createdDate filter, same `AdoComment[]` shape. SDK is no longer imported directly.
- `src/ado/bridge.ts` — added `getIsReadOnly(_formService)` wrapper at end of file. Existing wrappers untouched.
- `src/ado/types.ts` — extended `CalcSpReadResult` with optional `permission?: { isReadOnly: boolean; probeFailed: boolean }` slot.
- `src/ado/index.ts` — re-exports `postComment`, `getIsReadOnly`, and `CommentResponse` type. `adoFetch` remains file-private (callers go through wrappers).

## Test Counts

- Before plan: 362 vitest assertions (Phase 3 baseline)
- After plan: 381 vitest assertions (+10 adoFetch, +9 postComment)
- Coverage: full suite 381/381 green; pre-existing 100% coverage on `src/calc/**` + `src/audit/**` unbroken.

## Verification Gates Passed

- `npm run typecheck` — exit 0
- `npm run build` — webpack production succeeds (toolbar.{html,js} + modal.{html,js} only; spike artifacts already cleaned in Plan 04-01 Task 4)
- `npm test -- --run` — 381/381 pass

## Process Deviation — Sandbox Block

Both worktree agents (04-03 and the parallel 04-04) hit a `Permission to use Bash has been denied` sandbox gate on every form of `git add` and `git commit --no-verify` (read-only `git status`/`log`/`diff`/`rev-parse` and `npm run typecheck`/`test` worked fine throughout). The agents wrote files and verified them on disk, then returned a checkpoint asking the orchestrator to commit. The orchestrator (running with normal git permissions) committed the work atomically per the plan's task structure.

This deviation does **not** affect the plan's behavior contract — file contents, test counts, and acceptance-criteria greps are identical to what an unblocked agent would have produced. It only changes who ran `git add`/`git commit`.

## Key-Link Verification

| Link | From | To | Status |
|------|------|-----|--------|
| postComment imports adoFetch | `src/ado/postComment.ts` | `src/ado/adoFetch.ts` | ✓ `import { adoFetch } from "./adoFetch"` |
| comments imports adoFetch (refactored) | `src/ado/comments.ts` | `src/ado/adoFetch.ts` | ✓ `adoFetch<ModernCommentList>("GET", ...)` |
| postComment imports AuditPayload | `src/ado/postComment.ts` | `src/audit` | ✓ `import type { AuditPayload } from "../audit"` |
| index re-exports postComment | `src/ado/index.ts` | `src/ado/postComment.ts` | ✓ `export { postComment } from "./postComment"` |
| index does NOT re-export adoFetch | `src/ado/index.ts` | `src/ado/adoFetch.ts` | ✓ (file-private — verified by `grep -E "from ['\"]\\./adoFetch['\"]" src/ado/index.ts` returns 0 matches) |

## Downstream Plan Implications

- **Plan 04-04 (UI components — already complete in this wave):** SavedIndicator persistent-after-200ms behavior already reflects A4 verdict (NO-PROGRAMMATIC-CLOSE). No additional changes needed from Plan 04-03.
- **Plan 04-05 (apply orchestrator + CalcModal state machine):**
  - `applyToWorkItem(input, workItemId, projectId, formService)` calls `postComment(workItemId, projectId, payload)` as Leg 1; the human-readable comment text is the only payload format.
  - The 4th parallel-read leg in CalcModal calls `getIsReadOnly(formService)` and stores the result in `CalcSpReadResult.permission`. Since the spike verdict makes `probeFailed: true` baseline, the D-07 PermissionWarnBanner condition becomes "always show on every modal open" UNLESS we choose to suppress it on baseline-probe-failure. **Plan 04-05 should suppress the banner when `probeFailed: true && isReadOnly: false`** to avoid spurious warnings; surface it only when a future probe-validated `isReadOnly: true` lands.
  - `lightDismiss: false` on `openCustomDialog` (toolbar.tsx) is required per Probe 4 finding (writes complete even after lightDismiss — UX surprise).

## Self-Check: PASSED

- All 4 tasks executed.
- Each commit is atomic, scoped to the matching task.
- Spike A1/A3/A5 verdicts honored verbatim; deviations documented inline in code comments and in this SUMMARY.
- typecheck + build + 381 tests green.
- No modifications to STATE.md / ROADMAP.md (orchestrator owns those).
