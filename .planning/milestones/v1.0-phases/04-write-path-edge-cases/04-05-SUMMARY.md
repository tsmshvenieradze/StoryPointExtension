---
phase: 04-write-path-edge-cases
plan: 05
subsystem: ui-orchestrator + apply-orchestrator
tags: [apply, state-machine, atomicity, retry, accessibility]
requires:
  - 04-01-SUMMARY (spike verdicts A1/A3/A4/A5/Probe4)
  - 04-02-SUMMARY (errorMessages.ts: friendlyMessageForStatus, mapSdkErrorToStatus)
  - 04-03-SUMMARY (postComment, getIsReadOnly, adoFetch)
  - 04-04-SUMMARY (7 leaf components: ConfirmOverwritePanel, ReadOnlyMessage, PermissionWarnBanner, CommentFailBanner, FieldFailBanner, SavingOverlay, SavedIndicator)
provides:
  - applyToWorkItem orchestrator (Phase 0 D-01 atomicity contract)
  - 9-mode CalcModal state machine
  - retry handlers honoring D-08/D-09 atomicity rules
  - Pitfall 7 a11y mitigations during saving
  - lightDismiss-false hardening for in-flight write window
affects:
  - src/ui/CalcModal.tsx (orchestrator extension)
  - src/entries/toolbar.tsx (D-15 hardening)
  - tests/apply/apply.test.ts (atomicity proof)
tech-stack:
  added: []
  patterns:
    - vitest mock-call-order assertion (vi.fn().mock.invocationCallOrder) — atomicity at language level
    - structural BANNER-STACK-N markers — load-bearing assertion replacing manual visual review
    - useRef for SDK service handle caching — survives re-renders without churning the SDK boundary
    - mode-driven render branches — single state-machine var drives every render decision
key-files:
  created:
    - src/apply/apply.ts
    - tests/apply/apply.test.ts
    - .planning/phases/04-write-path-edge-cases/04-05-SUMMARY.md
  modified:
    - src/apply/index.ts
    - src/ui/CalcModal.tsx
    - src/entries/toolbar.tsx
    - vss-extension.json
  deleted:
    - src/apply/stubApply.ts
decisions:
  - applyToWorkItem signature is (input, workItemId, projectId, formService, options?) — orchestrator owns the SDK boundary, apply.ts stays pure of SDK init/lifecycle concerns
  - ApplyError is a plain object (not Error subclass) — JSON-safe, easy to discriminate via `leg`, no proto-chain pitfalls when rejected through async boundaries
  - PermissionWarnBanner is SUPPRESSED on the spike-A3 baseline path (probeFailed=true && isReadOnly=false) — slot reserved structurally so a future probe-validated failure mode lights it up automatically
  - Body container uses position:relative + aria-hidden=true during saving — Pitfall 7's 3-pronged mitigation (Dropdown disabled + a11y guard + overlay pointer-events) is layered, not single-point
  - Manifest version bump 0.1.20 → 0.2.0 — minor signals graduation from read-only (Phase 3) to write (Phase 4)
metrics:
  started: "2026-05-02T16:10:33Z"
  completed: "2026-05-02T16:24:38Z"
  duration: "14m"
  tasks: 3
  files_created: 3
  files_modified: 4
  files_deleted: 1
  commits: 3
  tests_added: 13
  tests_total: 394
---

# Phase 04 Plan 05: Apply Orchestrator Convergence — Summary

The two-leg `applyToWorkItem` orchestrator and the 9-mode CalcModal state machine are wired end-to-end. The Phase 0 D-01 atomicity contract (comment-first → field-write) is locked at the language level via a vitest mock-call-order assertion. The Phase 4 implementation surface is complete; Plan 04-06 can publish 0.2.0 to cezari and run the D-17 manual checklist.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Replace stubApply with applyToWorkItem two-leg orchestrator (TDD) | `6c7ec9b` | src/apply/apply.ts (new), src/apply/stubApply.ts (deleted), src/apply/index.ts, src/ui/CalcModal.tsx, tests/apply/apply.test.ts (new) |
| 2 | Extend CalcModal with 9-mode state machine + 4-leg read path + retry handlers | `c144245` | src/ui/CalcModal.tsx |
| 3 | Toolbar lightDismiss=false (D-15) + manifest 0.2.0 | `9483c83` | src/entries/toolbar.tsx, vss-extension.json |

## applyToWorkItem Orchestration Shape

```
applyToWorkItem(input, workItemId, projectId, formService, options?)
  ↓
  calculate({c,u,e}) → AuditPayload { sp, c, u, e, schemaVersion: 1 }
  ↓
  IF !options.skipCommentLeg:
    [LEG 1] postComment(workItemId, projectId, payload)        ← Phase 0 D-01 ordering
    err? → throw ApplyError { leg: "comment", status, message }
  ↓
  [LEG 2] formService.setFieldValue(refName, sp)                ← Pitfall 6 boolean check
    ok === false? → throw ApplyError { leg: "field", status: 412, ... }
    formService.save()
    err? → mapSdkErrorToStatus(err) → throw ApplyError { leg: "field", status, sdkErrorClass, message }
  ↓
  resolves Promise<void>
```

**Atomicity proof** (tests/apply/apply.test.ts test 1):
```typescript
const postOrder = vi.mocked(postComment).mock.invocationCallOrder[0];
const setOrder  = fs.setFieldValue.mock.invocationCallOrder[0];
expect(postOrder!).toBeLessThan(setOrder!);
```

## CalcModal Mode Machine (9 modes)

| Mode | Trigger entered from | Body render | Banner stack | ButtonGroup |
|------|----------------------|-------------|--------------|-------------|
| `loading` | initial mount | Spinner + "Loading…" context line | hidden until readResult lands | `[Cancel] [Apply disabled]` |
| `calculator` | read-path ok + permission ok + resolvedField non-null | Dropdowns + CalcPanel | full stack (1 → 4) | `[Cancel] [Apply]` |
| `confirm` | Apply click + currentSp != null | ConfirmOverwritePanel | resolver/read-error/permission ONLY (pre-fill hidden) | (panel owns its own) |
| `saving` | Apply (no prior SP) / Confirm Apply / Retry | calculator body, dimmed, behind SavingOverlay | full stack | `[Cancel disabled] [Saving… disabled]` |
| `saved` | both legs succeeded | calculator body + dropdowns disabled | full stack | SavedIndicator (200ms ✓ → persistent hint) |
| `readonly` | permission.isReadOnly === true | ReadOnlyMessage replaces calculator | hidden | hidden |
| `noField` | resolvedField === null | NoFieldMessage replaces calculator | hidden | hidden |
| `commentFail` | LEG 1 rejection | calculator body (selections preserved) + CommentFailBanner pinned above | full stack + error banner | `[Cancel]` only (Retry inside banner) |
| `fieldFail` | LEG 2 rejection (post-LEG-1 success) | calculator body + FieldFailBanner pinned above | full stack + error banner | `[Cancel]` only (Retry inside banner) |

**Read-path 4th leg** (Plan 04-05 addition): `Promise.all([titleP, spP, commentsP, permissionP])` — `permissionP = getIsReadOnly(formService)` lands in `readResult.permission`. The readonly branch (D-06) short-circuits AFTER the noField branch (D-19) per UI-SPEC line 89.

## Spike A4 Propagation (No-Programmatic-Close)

Per Plan 04-01 Probe 3 verdict and the SavedIndicator implementation (Plan 04-04): **no SDK close call is attempted from saved mode.**

- `<SavedIndicator />` is the saved-mode bottom-row replacement.
- Internal 200ms `setTimeout` flips a `showHint` state from `false` to `true`.
- Optional `onAfterTimer` prop is intentionally NOT wired by Plan 04-05's CalcModal — there is no orchestrator-level work to do post-timer (no SDK close, no metric we're capturing today).
- User dismisses via host close affordance (X / Esc / outside-click — but `lightDismiss: false` forces explicit X / Esc per D-15).

## D-15 lightDismiss Hardening (Probe 4 propagation)

Plan 04-01 Probe 4 confirmed lightDismiss does NOT abort in-flight writes (iframe survives the dismiss; deferred `setFieldValue + save()` continues). However, the UX surprise of an SP field changing silently after a perceived "cancel" is unacceptable. Defense in depth:

1. `toolbar.tsx`: `openCustomDialog(...)` now passes `lightDismiss: false`.
2. CalcModal saving mode: `<SavingOverlay />` covers the body region (mouse guard via `pointer-events: auto`).
3. CalcModal saving mode: body container has `aria-hidden="true"` + `aria-busy="true"` (a11y guard).
4. Dropdown3 components receive `disabled={mode === "saving"}` (keyboard guard).

## Pitfall 7 Mitigation Inventory

RESEARCH §Pitfall 7 line 581-584 — the 4-pronged immutability guard during the saving window:

| Mitigation | Where applied | Source |
|------------|---------------|--------|
| Dropdown3 `disabled` when mode === "saving" | CalcModal.tsx body render | UI-SPEC §Accessibility Contract |
| Body container `aria-hidden="true"` during saving | CalcModal.tsx outer body div | UI-SPEC line 686 |
| SavingOverlay `pointer-events: auto` covering body | SavingOverlay.tsx (Plan 04-04) | UI-SPEC §Saving overlay |
| `runApplySequence` reads c/u/e at function entry | CalcModal.tsx handler | RESEARCH Pitfall 7 line 583 |

The captured-at-entry pattern means even if a tab leak somehow lets the user change a dropdown during saving, the in-flight call carries the original trio.

## Tests

| Suite | Count | Notes |
|-------|------:|-------|
| `tests/apply/apply.test.ts` (new) | 13 | atomicity (invocationCallOrder), success path, comment failure (HTTP status + null), field false return (Pitfall 6), .save() rejection (403 + 412 via mapSdkErrorToStatus), typed-error shape, skipCommentLeg=true bypass |
| Full suite (vitest) | **394 passed** | 381 prior + 13 new; unit suites still 100% green |

The atomicity test uses `vi.fn().mock.invocationCallOrder` to assert `postComment[0] < setFieldValue[0]` — the language-level proof of Phase 0 D-01.

## Deviations from Plan

**None — plan executed exactly as written, with three minor refinements:**

1. **Task 1 transitional handler**: the plan said the CalcModal stubApply import would be updated in Task 2. To avoid a half-broken file between Task 1 and Task 2 commits, Task 1 swapped the import to the new symbols and replaced the handleApply body with a brief transitional logger that types the input as `ApplyInput`. This kept the build at green between commits without changing the Task 2 surface. (Not a Rule 1/2/3 deviation — just a sequencing detail.)

2. **PermissionWarnBanner suppression hardcoded to `false`**: per Plan 04-05 spike_overrides line 12-14 ("CalcModal must SUPPRESS the PermissionWarnBanner when probeFailed:true && isReadOnly:false"), I gated the banner with a literal `false` AND with the structural condition. The literal `false` makes the suppression unmistakable on inspection; the structural condition stays so a future contributor can flip the literal back to enable the banner without re-deriving the predicate. (Documented inline.)

3. **Manifest descriptor comment update in toolbar.tsx**: in addition to the `lightDismiss: false` change, the surrounding descriptive comment was updated to match (it referenced the old `lightDismiss:true default`). Cosmetic.

## Authentication Gates

None — this plan has no external network or auth dependencies (all cezari testing happens in Plan 04-06).

## Files Created / Modified / Deleted

**Created:**
- `src/apply/apply.ts` — two-leg orchestrator with ApplyError typed-error class
- `tests/apply/apply.test.ts` — 13 tests (atomicity + retry + typed-error shape)
- `.planning/phases/04-write-path-edge-cases/04-05-SUMMARY.md` — this file

**Modified:**
- `src/apply/index.ts` — barrel updated; no more stubApply re-export; ApplyError exported
- `src/ui/CalcModal.tsx` — 9-mode state machine, 4-leg read path, banner stack with structural markers, retry handlers, Pitfall 7 a11y mitigations
- `src/entries/toolbar.tsx` — `lightDismiss: false` (D-15)
- `vss-extension.json` — version 0.1.20 → 0.2.0

**Deleted:**
- `src/apply/stubApply.ts` — Phase 3 stub no longer needed (D-12)

## Ready for Cezari Verification

- [x] Phase 4 implementation surface compiles (typecheck green)
- [x] Phase 4 implementation surface tests green (394 / 394)
- [x] Production build emits `dist/modal.{html,js}` + `dist/toolbar.{html,js}`
- [x] Manifest version bumped to `0.2.0` for Plan 04-06's first cezari publish
- [x] All 6 Phase 4 requirements implemented (APPLY-04 through APPLY-09)
- [x] Atomicity contract proven at the language level (vitest mock-call-order)
- [x] Plan 04-06 can publish the resulting VSIX to cezari and run the D-17 manual checklist (scenarios 1–8)

## Self-Check: PASSED

- File `src/apply/apply.ts` exists: FOUND
- File `src/apply/stubApply.ts` removed: FOUND (deleted)
- File `tests/apply/apply.test.ts` exists: FOUND
- File `.planning/phases/04-write-path-edge-cases/04-05-SUMMARY.md` exists: FOUND (this file)
- Commit `6c7ec9b` exists: FOUND (Task 1)
- Commit `c144245` exists: FOUND (Task 2)
- Commit `9483c83` exists: FOUND (Task 3)
- BANNER-STACK-N markers in src/ui/CalcModal.tsx: 4 hits in correct order (RESOLVER → READ-ERROR → PERMISSION → PREFILL)
- `lightDismiss: false` in src/entries/toolbar.tsx: FOUND
- Manifest version 0.2.0: FOUND
- Test count: 394 (full suite green)
