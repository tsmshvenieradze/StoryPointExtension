---
quick_id: 260504-cl1
type: execute
status: complete
mode: sequential
autonomous: false
ship_version: "1.0.5"
prior_version: "1.0.3"
phase_unlock: "Phase 4 D-10 NO-PROGRAMMATIC-CLOSE — spike-as-ship reversal (v1.0.4 falsified the closeDialog hypothesis on openCustomDialog instances; v1.0.5 swaps the open-side primitive to addDialog)"
files_modified:
  - src/ado/bridge.ts
  - src/ado/index.ts
  - src/ui/CalcModal.tsx
  - src/entries/modal.tsx
  - src/entries/toolbar.tsx
  - vss-extension.json
  - package.json
commits:
  - hash: 4fc9086
    task: 1
    message: "feat(260504-cl1): add closeProgrammatically helper at SDK boundary"
  - hash: 76116ce
    task: 2
    message: "feat(260504-cl1): wire programmatic close into handleCancel + post-Saved auto-close"
  - hash: e503dad
    task: 3
    message: "feat(260504-cl1): add iframe Escape keydown listener with saving guard"
  - hash: 7b4d00e
    task: 4
    message: "chore(260504-cl1): bump 1.0.3 -> 1.0.4"
  - hash: 1c7cf4f
    task: 5
    message: "feat(260504-cl1): swap dialog open from openCustomDialog to addDialog"
  - hash: a1e60d4
    task: 6
    message: "chore(260504-cl1): bump 1.0.4 -> 1.0.5"
gates:
  typecheck: pass
  vitest: "398/398 pass"
  build: pass
  check_size: "147.2 KB gzipped (budget 250 KB; headroom 102.8 KB)"
publish:
  performed_by_executor: false
  next_step: "User runs `npm run publish:cezari` for private smoke; on success runs `npm run publish:public`."
---

# Quick Task 260504-cl1 — Programmatic Close Spike Summary

## One-liner

Reversed Phase 4 D-10 NO-PROGRAMMATIC-CLOSE LOCK by wiring `IGlobalMessagesService.closeDialog()` (the candidate Plan 04-01 Probe 3 missed) into Cancel, post-Saved auto-close, and iframe Escape — all behind try/catch + diagnostic logs so worst case is identical to v1.0.3.

## What shipped

### Task 1 — `closeProgrammatically()` helper (commit `4fc9086`)
- `src/ado/bridge.ts`: added `GLOBAL_MESSAGES_SERVICE_ID` constant (`ms.vss-tfs-web.tfs-global-messages-service`, verified at `node_modules/azure-devops-extension-api/Common/CommonServices.d.ts:12`), local `IGlobalMessagesService` interface (only `closeDialog: () => void` — avoids const-enum cross-import), and exported `closeProgrammatically(): Promise<boolean>` helper. Try/catch + `[sp-calc/bridge]` log on every code path; returns `true` on no-throw (assumed-closed), `false` on throw or missing method.
- `src/ado/index.ts`: re-exported `closeProgrammatically` so callers stay on the public bridge API.

### Task 2 — wire Cancel + post-Saved auto-close (commit `76116ce`)
- `src/ui/CalcModal.tsx`:
  - `handleCancel` is now async; awaits `closeProgrammatically()`. On `false` it falls back to the D-10 carry-forward log so DevTools shows why the modal stayed open.
  - New `useEffect` keyed on `mode`: when `mode === "saved"`, schedules a 600ms `setTimeout` calling `closeProgrammatically()`. 200ms is `SavedIndicator`'s ✓ flash; the extra 400ms is breathing room so the user perceives "saved" before the modal disappears. Cleanup clears the timeout on mode change / unmount.
  - Replaced the Plan 04-01 spike A4 NO-PROGRAMMATIC-CLOSE doc-comment block with the 260504-cl1 reversal note.
  - Added `closeProgrammatically` to the existing `from "../ado"` import block.

### Task 3 — iframe Escape keydown listener (commit `e503dad`)
- `src/entries/modal.tsx`:
  - Added `closeProgrammatically` import from `../ado`.
  - Inside `bootstrap()`, after `notifyLoadSucceeded` + the `ResizeObserver` hookup, registered a `window.addEventListener("keydown", escListener)` that fires on `Escape`. Listener early-returns when `document.body.dataset.spcSaving === "true"` (Pitfall 7 immutability — Esc must not abort an in-flight write); logs `[sp-calc/modal] Escape ignored — saving in flight` in that case. Otherwise logs `[sp-calc/modal] Escape pressed → closeProgrammatically` and calls the helper.
  - No `removeEventListener` — the iframe is destroyed when the host closes the dialog, tearing down all listeners; explicit cleanup is unnecessary.
- `src/ui/CalcModal.tsx`: added a second `useEffect` keyed on `mode` that mirrors `mode === "saving"` to `document.body.dataset.spcSaving = "true"` and `delete`s it otherwise. Cleanup also deletes on unmount so the flag never leaks across modal lifetimes. This is the cross-component handshake the iframe Esc listener reads.

### Task 4 — version bump (commit `7b4d00e`)
- `vss-extension.json`: `"version": "1.0.3"` → `"1.0.4"`.
- `package.json`: `"version": "1.0.3"` → `"1.0.4"`.
- Pipeline gates (run after edits, before commit):
  - `npm run typecheck` — pass
  - `npm test` — 398/398 pass
  - `npm run build` — pass (modal.js 635 KiB raw / 143.1 KiB gzipped, toolbar.js 8.2 KiB raw / 3.2 KiB gzipped)
  - `npm run check:size` — 147.2 KB gzipped vs 250 KB budget; 102.8 KB headroom

## Cezari verification checklist

The user runs the following AFTER `npm run publish:cezari` installs v1.0.4 to the cezari org:

1. **Open** any work item on cezari → click **Calculate Story Points**.
2. **Cancel test:** click **Cancel** — modal should close. If it doesn't, open DevTools → Console; expected log `[sp-calc/bridge] closeProgrammatically: closeDialog() invoked`. If you see `closeProgrammatically failed` instead, the spike falsified the hypothesis — modal stays open as in v1.0.3.
3. **Esc test:** open modal again, press **Escape** — modal should close. Expected log `[sp-calc/modal] Escape pressed → closeProgrammatically`.
4. **Auto-close test:** select a trio, click **Apply**, watch — Saved ✓ flashes for 200ms, then ~400ms later modal closes. Verify the field updated and the audit comment posted on the work item.
5. **Mid-save Esc safety:** select a trio, click **Apply**, IMMEDIATELY press **Escape** during the saving overlay — modal should NOT close (data integrity guard). Expected log `[sp-calc/modal] Escape ignored — saving in flight`.
6. **Outside-click regression:** open modal, click outside — should still close (host's `lightDismiss=true`). No code path touched here; this is a regression check.

If steps 2–4 PASS → ship 1.0.4 public via `npm run publish:public`.
If steps 2–4 FAIL → spike returned false; capture the DevTools console log; we file a follow-up plan to try the proxy-callback-via-configuration approach (XDM.js `__proxyFunctionId` pattern).

## Deviations from Plan

### `[Rule 3 — Blocking issue]` Cross-agent contamination from parallel uk5 agent

A parallel quick task (260504-uk5, also running on master) staged `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` AND repeatedly used a wildcard `git add` (or `git add -A`-equivalent) that swept up my Task 2 + Task 3 source-file edits into THEIR commits and amends. Sequence observed:

- After Task 1 commit `4fc9086`, uk5 committed `a3c51c2` then `0e5d9ec` — the latter accidentally bundled my Task 2 edits to `src/ui/CalcModal.tsx` (37 insertions / 7 deletions) under their `docs(05-05)` commit message.
- uk5 then amended `0e5d9ec` → `2fbee98`, which DROPPED `src/ui/CalcModal.tsx` from the commit but left my edits in the working tree (uncommitted, technically "lost" from history).
- I re-staged + re-edited CalcModal.tsx and committed Task 2 cleanly as `76116ce`.
- uk5 then committed `c7cc743` (later amended to `0996b14`) which AGAIN bundled my Task 3 edits (`src/entries/modal.tsx` 27 insertions, `src/ui/CalcModal.tsx` 15 insertions — exactly the spcSaving useEffect block) under their `docs:` commit message.
- uk5 amended away those file changes, leaving them in the working tree once more.
- I committed Task 3 cleanly as `e503dad` and Task 4 as `7b4d00e`.

**Net effect:** All four planned commits exist with the correct messages and content (`4fc9086`, `76116ce`, `e503dad`, `7b4d00e`). Final state is correct; HEAD blobs match what the plan specified. The deviation is purely procedural (extra commit churn from a parallel agent) and does NOT affect the shipped code.

**Mitigation:** Throughout, I held strictly to explicit `git add <file>` with named paths only — never `git add -A` / `git add .`. After each `git reset HEAD`, I verified `git diff --cached --stat` listed only my files before committing.

## Files modified (final state)

| File | Lines added | Lines removed | Final commit |
|------|-------------|---------------|--------------|
| `src/ado/bridge.ts` | +37 | 0 | `4fc9086` |
| `src/ado/index.ts` | +1 | 0 | `4fc9086` |
| `src/ui/CalcModal.tsx` | +30 | -7 (Task 2 portion) +15 -0 (Task 3 portion) | `76116ce`, `e503dad` |
| `src/entries/modal.tsx` | +27 | 0 | `e503dad` |
| `vss-extension.json` | +1 | -1 | `7b4d00e` |
| `package.json` | +1 | -1 | `7b4d00e` |

## What this plan did NOT do

- **Did NOT publish.** Per plan constraint and `<commit_strategy>`, no `npm run publish:cezari` or `npm run publish:public` was executed. Hand-off to user is the cezari verification checklist above.
- **Did NOT update `.planning/STATE.md`, `ROADMAP.md`, or `REQUIREMENTS.md`** — quick task does not unlock a numbered REQUIREMENTS row (D-10 was a Phase 4 LOCKED decision, not a numbered REQ); the parallel uk5 task owns those files this session.
- **Did NOT touch tests.** Spike is on the SDK boundary (`SDK.getService` call); no formula logic changed. Existing 398/398 vitest suite is the regression canary.

## Self-Check: PASSED

- `4fc9086` — present in `git log`. Files: `src/ado/bridge.ts`, `src/ado/index.ts`. Verified.
- `76116ce` — present in `git log`. File: `src/ui/CalcModal.tsx` (Task 2 portion: handleCancel + post-Saved auto-close + import + doc-comment). Verified.
- `e503dad` — present in `git log`. Files: `src/entries/modal.tsx`, `src/ui/CalcModal.tsx` (Task 3 portion: spcSaving useEffect). Verified.
- `7b4d00e` — present in `git log`. Files: `vss-extension.json`, `package.json`. Verified.
- `vss-extension.json` contains `"version": "1.0.4"` — found.
- `package.json` contains `"version": "1.0.4"` — found.
- `src/ado/bridge.ts` contains `closeProgrammatically` (4 occurrences) — found.
- `src/ado/index.ts` contains `closeProgrammatically` (1 occurrence) — found.
- `src/ui/CalcModal.tsx` contains `closeProgrammatically` (6 occurrences) — found.
- `src/ui/CalcModal.tsx` contains `spcSaving` (4 occurrences) — found.
- `src/entries/modal.tsx` contains `addEventListener.*keydown` (1 occurrence) — found.
- `src/entries/modal.tsx` contains `spcSaving` (1 occurrence) — found.
- Final pipeline at HEAD `7b4d00e`: typecheck pass, 398/398 tests pass — verified.

## v1.0.5 follow-up — addDialog swap (Tasks 5–6, commits `1c7cf4f` + `a1e60d4`)

### v1.0.4 cezari verdict: FALSIFIED

User published v1.0.4 to public Marketplace and re-tested on cezari (2026-05-04). DevTools console transcript:

```
[sp-calc/apply] postComment ok commentId=448806
[sp-calc/apply] setFieldValue start refName=Microsoft.VSTS.Scheduling.StoryPoints value=0.5
[sp-calc/apply] no-op apply: form not dirty after setFieldValue (same value); skipping save()
[sp-calc/modal] apply sequence ok
[sp-calc/bridge] closeProgrammatically: closeDialog() invoked   ← post-Saved auto-close (modal stayed open)

[sp-calc/modal] Escape pressed → closeProgrammatically
[sp-calc/bridge] closeProgrammatically: closeDialog() invoked   ← Esc keydown (modal stayed open)
[sp-calc/modal] Escape pressed → closeProgrammatically
[sp-calc/bridge] closeProgrammatically: closeDialog() invoked   ← Esc keydown (modal stayed open)
```

`closeProgrammatically` returns `true` on every call (no throw, `closeDialog` is a function on the resolved service handle), but the dialog does not close. **Conclusion:** `IGlobalMessagesService.closeDialog()` only manages the dialog stack populated by `IGlobalMessagesService.addDialog()` — it is a silent no-op for `IHostPageLayoutService.openCustomDialog` instances. Phase 4 D-10 NO-PROGRAMMATIC-CLOSE was correct on the openCustomDialog code path; v1.0.4's "untested candidate" hypothesis is now empirically falsified.

### v1.0.5 fix: swap the open-side primitive

`IGlobalMessagesService.addDialog({ contributionId, contributionConfiguration, title, onDismiss })` is the matching open-side primitive for `closeDialog()`. Same XDM service, same dialog stack — calling `closeDialog()` on a dialog opened via `addDialog` should actually close it. We keep all three close-surface wires (Cancel, post-Saved 600ms timer, Esc keydown) unchanged; only `src/entries/toolbar.tsx` swaps API.

### Task 5 — `toolbar.tsx` openCustomDialog → addDialog (commit `1c7cf4f`)

- Dropped `IHostPageLayoutService` import + `HOST_PAGE_LAYOUT_SERVICE_ID` constant.
- Added local `IGlobalMessagesService` + `IGlobalDialog` interfaces (mirrors `bridge.ts` pattern; isolatedModules-safe; only the methods we actually call: `addDialog`, `closeDialog`).
- Replaced `layoutSvc.openCustomDialog<undefined>(fullModalId, { title, configuration: config, onClose })` with `messagesSvc.addDialog({ contributionId: fullModalId, contributionConfiguration: config, title, onDismiss })`.
- Updated header comment block to capture v1.0.4 → v1.0.5 reasoning, the trade (CornerDialog/CustomDialog renderer vs external-content renderer; visual chrome may differ), and the rollback path (v1.0.6 reverts to openCustomDialog and accepts the documented close limitation).

### Task 6 — version bump 1.0.4 → 1.0.5 (commit `a1e60d4`)

- `vss-extension.json`: `"version": "1.0.4"` → `"1.0.5"`.
- `package.json`: `"version": "1.0.4"` → `"1.0.5"`.
- Pipeline gates (run after edits, before commit):
  - `npm run typecheck` — pass
  - `npm test` — 398/398 pass
  - `npm run build` — pass (modal.js 635 KiB raw / 143.1 KiB gzipped, toolbar.js 8.2 KiB raw / 3.3 KiB gzipped)
  - `npm run check:size` — 147.2 KB gzipped vs 250 KB budget; 102.8 KB headroom (no measurable bundle delta)

### v1.0.5 cezari verification checklist

The extension is `"public": true` since v1.0.0 — the legacy `publish:cezari` flow now errors with `Public extensions can't be shared` (TFX `--share-with` is invalid for public extensions). User publishes via:

```
npm run publish:public
```

Then on cezari, after Marketplace propagation (~1-5 min) + hard-refresh (`Ctrl+Shift+R`) of the work item form:

1. **Open** any work item → click **Calculate Story Points**. The dialog should render with theme-correct chrome. Note any visual delta from v1.0.4 (centering, sizing, header style) — addDialog uses a different host renderer so chrome MAY differ.
2. **Cancel test:** click **Cancel** — modal should close. Expected DevTools console:
   - `[sp-calc/modal] cancel clicked → closeProgrammatically`
   - `[sp-calc/bridge] closeProgrammatically: closeDialog() invoked`
   - `[sp-calc/toolbar] dialog dismissed` (the new `onDismiss` callback fires when host tears down the dialog)
3. **Esc test:** open modal again, press **Escape** — modal should close. Expected:
   - `[sp-calc/modal] Escape pressed → closeProgrammatically`
   - `[sp-calc/bridge] closeProgrammatically: closeDialog() invoked`
   - `[sp-calc/toolbar] dialog dismissed`
4. **Auto-close test:** select a trio, click **Apply**, watch — Saved ✓ flashes for 200ms, then ~400ms later modal closes. Verify field updated and audit comment posted. Same expected log sequence as above.
5. **Mid-save Esc safety:** select a trio, click **Apply**, IMMEDIATELY press **Escape** during the saving overlay — modal must NOT close. Expected `[sp-calc/modal] Escape ignored — saving in flight`. Field write must complete server-side regardless.
6. **Outside-click regression:** open modal, click outside — should still close (host's `lightDismiss=true` carries through to addDialog). Expected `[sp-calc/toolbar] dialog dismissed` only (no `closeProgrammatically` log — host dismissed without our route).
7. **Visual regression sanity:** if the dialog renders narrower/wider/off-center vs v1.0.4 to a degree that hurts UX, capture a screenshot and we file a v1.0.6 to either accept the change with CSS adjustments or revert toolbar.tsx to openCustomDialog and re-document the close limitation in the listing.

If steps 2–4 PASS visually and the close logs are clean → spike succeeded; v1.0.5 ships as a real programmatic-close release.

If steps 2–4 STILL FAIL (closeDialog still no-op even after addDialog open) → fundamental mismatch between contribution-type rendering paths; revert toolbar.tsx, file v1.0.6 to remove the misleading wires + fix the lying "Press Esc..." hint, and accept the limitation in the listing description.

### Self-Check: PASSED (v1.0.5 swap)

- `1c7cf4f` — present in `git log`. File: `src/entries/toolbar.tsx` (50 insertions / 28 deletions; net rewrite of the open-side path + new local interfaces + new header doc). Verified.
- `a1e60d4` — present in `git log`. Files: `vss-extension.json`, `package.json`. Verified.
- `vss-extension.json` contains `"version": "1.0.5"` — found.
- `package.json` contains `"version": "1.0.5"` — found.
- `src/entries/toolbar.tsx` contains `addDialog` (3 occurrences: comment, interface, call) — found.
- `src/entries/toolbar.tsx` contains `openCustomDialog` (0 occurrences) — verified swap is complete.
- `src/entries/toolbar.tsx` contains `IGlobalMessagesService` (2 occurrences: interface, generic on getService) — found.
- Final pipeline at HEAD `a1e60d4`: typecheck pass, 398/398 tests pass, build clean, size 147.2 KB gzipped — verified.
