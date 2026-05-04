---
quick_id: 260504-cl1
type: execute
status: complete
mode: sequential
autonomous: false
ship_version: "1.0.7"
prior_version: "1.0.3"
phase_unlock: "Phase 4 D-10 NO-PROGRAMMATIC-CLOSE — spike-as-ship reversal (v1.0.4 falsified the closeDialog hypothesis on openCustomDialog instances; v1.0.5 swaps the open-side primitive to addDialog)"
files_modified:
  - src/ado/bridge.ts
  - src/ado/index.ts
  - src/ui/CalcModal.tsx
  - src/entries/modal.tsx
  - src/entries/toolbar.tsx
  - src/template.html
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
  - hash: 58811b1
    task: 7
    message: "fix(260504-cl1): restore 24px side gutter inside iframe for addDialog renderer"
  - hash: 61987eb
    task: 8
    message: "chore(260504-cl1): bump 1.0.5 -> 1.0.6"
  - hash: fd799b0
    task: 9
    message: "fix(260504-cl1): add !important to body padding so it survives override.css"
  - hash: 86d2356
    task: 10
    message: "chore(260504-cl1): bump 1.0.6 -> 1.0.7"
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

## v1.0.6 follow-up — restore 24px side gutter (Tasks 7–8, commits `58811b1` + `61987eb`)

### v1.0.5 cezari verdict: programmatic close PASSED, visual regression FOUND

User shipped v1.0.5 to public Marketplace and re-tested on cezari (2026-05-04). All three close surfaces now work end-to-end:

- Cancel button → modal closes
- Esc keydown → modal closes
- Post-Saved 600ms timer → modal closes (after the SavedIndicator ✓ flash)

But the user reported one visual issue: **"works but no padding from sides"** — content sits flush against both vertical edges of the dialog frame. v1.0.0..v1.0.4 had a horizontal gutter that v1.0.5 lost.

### Root cause

`IHostPageLayoutService.openCustomDialog` wraps the iframe in a `.dialog-content` host chrome that adds the standard ADO horizontal gutter outside the iframe. `IGlobalMessagesService.addDialog` (the CornerDialog / CustomDialog renderer) does not — the iframe is mounted edge-to-edge inside the dialog. Net effect in v1.0.5: iframe content aligns with dialog edges, no whitespace on either side.

### v1.0.6 fix: move the gutter inside the iframe

`src/template.html` already sets `html, body, #root { padding: 0 }` for the v1.0.0 width-collapse fix. v1.0.6 layers a body-only override:

```css
body { padding: 0 24px; }
```

24px matches the standard ADO horizontal inset used by `.page-content` and similar azure-devops-ui chrome rules. With `box-sizing: border-box` (already present), the iframe's host-allocated width is preserved — only the content area shrinks by the inset. `ResizeObserver` on `document.body` continues to feed the correct height back to `SDK.resize`. Vertical padding stays 0 because the host already renders the title strip above us and includes bottom whitespace in the dialog frame.

### Task 7 — `template.html` body padding (commit `58811b1`)

- Added `body { padding: 0 24px }` after the existing `html, body, #root { padding: 0 }` rule.
- Inline comment captures the v1.0.0..v1.0.4 vs v1.0.5 vs v1.0.6 reasoning so the next maintainer doesn't accidentally remove the inset thinking it's redundant with the now-stale v1.0.0 width-collapse comment above it.
- HTML asset grew from 0.7 KB to 1.4 KB (raw / 0.7 KB gzipped) — entirely the new comment block; the actual CSS rule is one line.

### Task 8 — version bump 1.0.5 → 1.0.6 (commit `61987eb`)

- `vss-extension.json`: `"version": "1.0.5"` → `"1.0.6"`.
- `package.json`: `"version": "1.0.5"` → `"1.0.6"`.
- Pipeline gates (run after edits, before commit):
  - `npm run typecheck` — pass
  - `npm test` — 398/398 pass
  - `npm run build` — pass
  - `npm run check:size` — 147.9 KB gzipped (budget 250 KB; 102.1 KB headroom; +0.7 KB from the comment block, immaterial)

### v1.0.6 cezari verification checklist

```
npm run publish:public
```

Then on cezari (after Marketplace propagation + `Ctrl+Shift+R`):

1. **Open** any work item → click **Calculate Story Points**. Confirm the modal now has visible whitespace on both sides between content and dialog frame (~24px each side). Compare with v1.0.5 if a screenshot was captured.
2. **Re-verify the v1.0.5 close surfaces are still functional** (regression check):
   - Cancel → closes
   - Esc → closes
   - Post-Saved 600ms timer → closes
   - Mid-save Esc → does NOT close (`Escape ignored — saving in flight`)
   - Outside-click → still closes
3. **Width sanity:** the dropdown bodies and CalcPanel should still feel comfortable, not cramped, after losing 48px of horizontal real estate. If they do feel cramped on narrower viewports (which the iframe doesn't control), we can adjust to 16px or scale to viewport width in v1.0.7.

If steps 1–2 PASS → v1.0.6 ships clean; quick-task `260504-cl1` resolves with both functional + visual goals met.

### Self-Check: PASSED (v1.0.6 padding fix)

- `58811b1` — present in `git log`. File: `src/template.html` (12 insertions; one CSS rule + 11-line comment block). Verified.
- `61987eb` — present in `git log`. Files: `vss-extension.json`, `package.json` (1 insertion / 1 deletion each). Verified.
- `vss-extension.json` contains `"version": "1.0.6"` — found.
- `package.json` contains `"version": "1.0.6"` — found.
- `src/template.html` contains `body {` rule with `padding: 0 24px` — found.
- Final pipeline at HEAD `61987eb`: typecheck pass, 398/398 tests pass, build clean, size 147.9 KB gzipped — verified.

## v1.0.7 follow-up — `!important` on body padding (Tasks 9–10, commits `fd799b0` + `86d2356`)

### v1.0.6 cezari verdict: rule loaded, cascade LOST

User uninstalled v1.0.5, reinstalled v1.0.6, hard-refreshed the work item form. Pasted the rendered DOM from DevTools — confirmed v1.0.6 chrome (the 24px body padding rule was present in the iframe's `<style>` block in `<head>`) but content was STILL flush against dialog edges. Computed styles on `<body>` showed `padding-left: 0px` / `padding-right: 0px` — the rule was loaded but not winning the cascade.

### Root cause: cascade order vs. specificity tie

`azure-devops-ui/Core/override.css` line 28 declares:

```css
body {
  display: flex;
  ...
  padding: 0;
  margin: 0;
}
```

`modal.tsx` imports `override.css`. Webpack's `style-loader` injects it at runtime as a `<style>` tag appended to `<head>` — AFTER the inline `<style>` block from `template.html` is already parsed. Both selectors are `body` (specificity 0,0,0,1; tied). When specificity ties, **later-loaded wins**. Override.css wins; my `padding: 0 24px` is shadowed.

The DOM dump diagnostic was decisive — without it, both "v1.0.6 didn't propagate" and "Surface escapes body via absolute positioning" were equally likely hypotheses.

### v1.0.7 fix: `!important` on the padding rule

`!important` outranks a non-`!important` rule of equal selector weight regardless of source order. `override.css`'s `body { padding: 0 }` has no `!important`, so a `!important` on my `body { padding: 0 24px }` wins.

```css
body { padding: 0 24px !important; }
```

One-character diff (the `!important` declaration). The expanded inline comment in `template.html` captures the cascade-tie reasoning so the next maintainer doesn't strip the `!important` thinking it's CSS sloppiness.

Alternative considered: a React-rendered `position: relative` inline-padded wrapper in `modal.tsx` (inline `style` props win over any non-`!important` CSS rule). Equally bulletproof but moves the styling concern from CSS into the entry-point JSX. Rejected for v1.0.7 — `!important` is the smaller, more local change. If a future ADO SDK update lands a `!important` body-padding rule we'll fall back to the React wrapper.

### Task 9 — `template.html` `!important` (commit `fd799b0`)

- `body { padding: 0 24px }` → `body { padding: 0 24px !important }`.
- Expanded comment block to document the cascade-tie root cause (override.css line 28, style-loader load order, specificity tie behavior) so the priority-bump isn't accidentally stripped as "lazy CSS".

### Task 10 — version bump 1.0.6 → 1.0.7 (commit `86d2356`)

- `vss-extension.json`: `"version": "1.0.6"` → `"1.0.7"`.
- `package.json`: `"version": "1.0.6"` → `"1.0.7"`.
- Pipeline gates:
  - `npm run typecheck` — pass
  - `npm test` — 398/398 pass
  - `npm run build` — pass
  - `npm run check:size` — 148.4 KB gzipped (budget 250 KB; 101.6 KB headroom; +0.5 KB from expanded comment block, immaterial)

### v1.0.7 cezari verification checklist

```
npm run publish:public
```

After Marketplace propagation + the usual uninstall+reinstall+hard refresh ritual:

1. **Open** any work item → click **Calculate Story Points**. Side gutter should now be visible (~24px each side between content and dialog edge).
2. **Confirm via DevTools:** select `<body>` in Elements tab, check Computed → `padding-left: 24px` and `padding-right: 24px`. The rule should now show with the !important indicator.
3. **Re-verify v1.0.5 close surfaces (regression check):**
   - Cancel → closes
   - Esc → closes
   - Post-Saved 600ms timer → closes
   - Mid-save Esc → does NOT close (`Escape ignored — saving in flight`)
   - Outside-click → still closes
4. **Visual sanity** — dropdowns and CalcPanel should feel comfortable, not cramped, after the 48px horizontal inset.

### v1.0.7 cezari verdict: PASS (2026-05-04)

User reported "done" after publishing v1.0.7 to public Marketplace and re-testing on cezari. Side gutter visible; close surfaces (Cancel / Esc / post-Saved auto-close) still functional; no regressions reported. Quick task `260504-cl1` RESOLVED — both functional goal (programmatic close on three surfaces) and visual goal (24px side gutter restored) met.

Net journey across the 4-version arc:
- v1.0.4 (`7b4d00e`) — closeProgrammatically helper + Cancel/post-Saved/Esc wires shipped. **Falsified** in cezari verification: `closeDialog()` is a silent no-op for `openCustomDialog` instances.
- v1.0.5 (`a1e60d4`) — toolbar swapped from `openCustomDialog` to `addDialog`. **Close surfaces PASSED**; visual regression discovered (no side gutter from the addDialog renderer).
- v1.0.6 (`61987eb`) — body padding rule added in `template.html`. **Failed cascade**: `azure-devops-ui/Core/override.css` line 28 won the tie via later source order from style-loader injection.
- v1.0.7 (`86d2356`) — `!important` on the body padding rule. **PASS** on both axes.

### Self-Check: PASSED (v1.0.7 cascade fix)

- `fd799b0` — present in `git log`. File: `src/template.html` (10 insertions / 2 deletions; one CSS character + comment expansion). Verified.
- `86d2356` — present in `git log`. Files: `vss-extension.json`, `package.json` (1 insertion / 1 deletion each). Verified.
- `vss-extension.json` contains `"version": "1.0.7"` — found.
- `package.json` contains `"version": "1.0.7"` — found.
- `src/template.html` contains `body { padding: 0 24px !important; }` — found.
- Final pipeline at HEAD `86d2356`: typecheck pass, 398/398 tests pass, build clean, size 148.4 KB gzipped — verified.
