# Phase 4 Verification — Manual Cezari Run

**Verified:** 2026-05-02
**Org:** cezari.visualstudio.com/Cezari (Scrum process)
**VSIX version:** 0.1.18 (spike build, published to cezari with `--share-with cezari --no-wait-validation`)
**Browser:** User-controlled (DevTools console output captured verbatim below)
**Work item:** PBI #2 in Cezari project (id `141c9991-cbde-4837-afd5-b0c2e015edd8`)
**Run by:** Tsezari (cezo777@gmail.com)

## Spike Results (Plan 04-01)

Empirical resolution of the four assumptions flagged in 04-RESEARCH.md as `[ASSUMED]`. Each assumption gets a verdict, the raw evidence (verbatim console / network output), and the locked decision feeding into Plans 04-03 / 04-04 / 04-05.

### Verdict Summary

| Assumption | Hypothesis | Verdict | Action |
|---|---|---|---|
| A1 / A7 (D-01 / D-02) | `format:1` preserves `<!-- -->` sentinel through ADO storage | **STRIPPED-FALLBACK** | postComment.ts must NOT rely on HTML-comment carriers. D-02 fallback adopted (see decision below). |
| A3 (D-05 / D-07) | `formService.isReadOnly()` exists OR self-write probe is a viable eager signal | **LAZY-FALLBACK-ONLY** | `bridge.getIsReadOnly()` returns `{ isReadOnly: false, probeFailed: true }`; rely on D-07 reactive error handling. |
| A4 (D-10 / Finding 3) | SDK has a programmatic close path from a `ms.vss-web.external-content` dialog | **NO-PROGRAMMATIC-CLOSE** | D-10 redefined: modal stays open in saved state; user dismisses manually via host close affordance. |
| A5 (D-13) | api-version `7.0-preview.3` and `7.1-preview.4` differ functionally for addComment | **NO-FUNCTIONAL-DIFFERENCE** | Use `7.0-preview.3` to match existing read path in `src/ado/comments.ts` (single source of truth). |
| (Probe 4 / D-15) | `lightDismiss` on the host dialog aborts in-flight writes | **WRITES-COMPLETE-EVEN-AFTER-CLOSE** | `lightDismiss: false` during saving is required for UX clarity, not data integrity. |

### A1 / A7 — Sentinel preservation under format:1 (D-01 / D-02)

**Verdict:** STRIPPED — sentinel `<!-- ... -->` is removed by ADO storage regardless of api-version (`7.0-preview.3` / `7.1-preview.4`) or `format` parameter (`1` / omitted). Renderer never sees the comment carrier because storage never holds it.

**Probe 1 POST body (sent by spike):**

```json
{
  "text": "<!-- sp-calc:v1 {\"sp\":3,\"c\":\"Easy\",\"u\":\"Easy\",\"e\":\"Easy\",\"schemaVersion\":1} -->\nStory Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)",
  "format": 1
}
```

**Probe 1 verbatim DevTools console transcript:**

```
[sp-calc/spike] probe1 START
[sp-calc/spike] probe1 host {name: 'cezari', isHosted: true}
[sp-calc/spike] probe1 token acquired (len=1092)
[sp-calc/spike] probe1 baseUrl=https://dev.azure.com/cezari projectId=141c9991-cbde-4837-afd5-b0c2e015edd8 wid=2
[sp-calc/spike] probe1 POST 7.0-preview.3 + format=1 url=https://dev.azure.com/cezari/141c9991-cbde-4837-afd5-b0c2e015edd8/_apis/wit/workItems/2/comments?api-version=7.0-preview.3
[sp-calc/spike] probe1 7.0-preview.3 + format=1 status=200 ok=true
[sp-calc/spike] probe1 7.0-preview.3 + format=1 responseBody= {"workItemId":2,"id":448650,"version":1,"text":"\nStory Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)","createdBy":{...},"createdDate":"2026-05-02T15:31:41.89Z","format":"html","renderedText":"\nStory Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)","url":"..."}
[sp-calc/spike] probe1 POST 7.1-preview.4 + format=1 url=https://dev.azure.com/cezari/141c9991-cbde-4837-afd5-b0c2e015edd8/_apis/wit/workItems/2/comments?api-version=7.1-preview.4
[sp-calc/spike] probe1 7.1-preview.4 + format=1 status=200 ok=true
[sp-calc/spike] probe1 7.1-preview.4 + format=1 responseBody= {"workItemId":2,"id":448651,...,"text":"\nStory Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)","format":"html","renderedText":"\nStory Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)",...}
[sp-calc/spike] probe1 POST 7.0-preview.3 + NO format url=https://dev.azure.com/cezari/141c9991-cbde-4837-afd5-b0c2e015edd8/_apis/wit/workItems/2/comments?api-version=7.0-preview.3
[sp-calc/spike] probe1 7.0-preview.3 + NO format status=200 ok=true
[sp-calc/spike] probe1 7.0-preview.3 + NO format responseBody= {"workItemId":2,"id":448652,...,"text":"\nStory Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)","format":"html","renderedText":"\nStory Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)",...}
[sp-calc/spike] probe1 POST 7.1-preview.4 + NO format url=https://dev.azure.com/cezari/141c9991-cbde-4837-afd5-b0c2e015edd8/_apis/wit/workItems/2/comments?api-version=7.1-preview.4
[sp-calc/spike] probe1 7.1-preview.4 + NO format status=200 ok=true
[sp-calc/spike] probe1 7.1-preview.4 + NO format responseBody= {"workItemId":2,"id":448653,...,"text":"\nStory Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)","format":"html","renderedText":"\nStory Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)",...}
[sp-calc/spike] probe1 DONE
```

**cezari Discussion view inspection:**

| Case | Storage `text` field | Discussion view rendering | Sentinel survived? |
|---|---|---|---|
| 7.0-preview.3 + format=1 | `\nStory Points: 3 (...)` | Plain text "Story Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)" | NO — stripped |
| 7.1-preview.4 + format=1 | `\nStory Points: 3 (...)` | Plain text "Story Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)" | NO — stripped |
| 7.0-preview.3 + NO format | `\nStory Points: 3 (...)` | Plain text "Story Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)" | NO — stripped |
| 7.1-preview.4 + NO format | `\nStory Points: 3 (...)` | Plain text "Story Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)" | NO — stripped |

The leading `\n` after the stripped comment is preserved in every case, confirming ADO's storage sanitizer specifically targets `<!-- ... -->` sequences (not whitespace). Both `text` and `renderedText` in the response body lack the sentinel — this is a STORAGE strip, not a renderer strip.

**Decision (feeds into Plan 04-03 `postComment.ts`):**

- **api-version:** `7.0-preview.3` (matches existing read path in `src/ado/comments.ts` per Phase 3; no functional difference between versions per A5 — pick the one already in use to keep `comments.ts` and `postComment.ts` consuming a single api-version constant).
- **body shape:** `{ text }` only — no `format` field. ADO defaults to html and renders the plain-text body correctly. The `format` parameter in the request had zero observable effect on storage (sentinel was stripped regardless).
- **D-01 hypothesis FALSIFIED.** The audit comment cannot use HTML-comment carriers for round-trip JSON.

**D-02 fallback adopted — audit comment becomes human-readable-only:**

```text
Story Points: 3 (Complexity=Easy, Uncertainty=Easy, Effort=Easy)
```

There is no machine-parseable round-trip from comment back to inputs. Rationale:

1. The visible text already encodes the three axis levels. A future reopen-pre-fill (D-16) feature could regex-parse the most recent `Story Points: N (Complexity=X, Uncertainty=Y, Effort=Z)` line if needed.
2. An invisible `<div data-sp-calc="v1" hidden>...</div>` carrier was considered but ADO's sanitizer is aggressive enough that we cannot trust any non-text container to round-trip without empirical re-validation (out of scope for Plan 04-01).
3. The schema-versioned JSON sentinel was a "nice to have" for telemetry / reopen-pre-fill — not in the Phase 4 must-haves.

**Plan 04-03 (`postComment.ts`) implication:**

- POST payload is `{ text: "Story Points: N (Complexity=..., Uncertainty=..., Effort=...)" }` (no `format` field).
- No sentinel-building helper required. The `serialize()` helper in `src/audit/serialize.ts` already produces the human-readable line; reuse just that line, drop the `<!-- ... -->` prefix.
- Reopen-pre-fill (D-16, future plan) is now sentinel-free: it must regex-parse the most-recent `Story Points: N (Complexity=X, Uncertainty=Y, Effort=Z)` line out of `comments.ts` results, with backward compatibility for any pre-existing sentinel comments still in the wild.

### A3 — isReadOnly detection mechanism (D-05 / D-07)

**Verdict:** LAZY-FALLBACK-ONLY — no eager probe is reliable. None of the four probe candidates yielded a usable upfront read-only signal.

**Probe 2 verbatim DevTools console transcript:**

```
[sp-calc/spike] probe2 START
[sp-calc/spike] probe2 formService acquired
[sp-calc/spike] probe2 (a) calling formService.isReadOnly() if it exists...
[sp-calc/spike] probe2 (a) result type= undefined value= undefined
[sp-calc/spike] probe2 (b) getFieldValue('System.AuthorizedAs')...
[sp-calc/spike] probe2 (b) type= string value= Tsezari <cezo777@gmail.com>
[sp-calc/spike] probe2 (c) self-setFieldValue probe...
[sp-calc/spike] probe2 (c) current value type= number value= 1234
[sp-calc/spike] probe2 (c) self-setFieldValue returned= true
[sp-calc/spike] probe2 (c) post-self-write isValid= true isDirty= false
[sp-calc/spike] probe2 (c) threw: undefined undefined
[sp-calc/spike] probe2 (d) SDK.getUser()...
[sp-calc/spike] probe2 (d) user object= {
  "descriptor": "msa.ZjdjODMwODgtMDBlMi03YmRlLWFkYzAtYmI4NTU3NGJiNjAz",
  "id": "c4f16579-5e14-41a6-9fa3-87baf6e326ca",
  "name": "cezo777@gmail.com",
  "displayName": "Tsezari",
  "imageUrl": "https://cezari.visualstudio.com/_apis/GraphProfile/MemberAvatars/msa.ZjdjODMwODgtMDBlMi03YmRlLWFkYzAtYmI4NTU3NGJiNjAz"
}
[sp-calc/spike] probe2 DONE
```

**Per-candidate findings:**

- **(a) `formService.isReadOnly()`** — optional-chained call returned `undefined`. Method does NOT exist on the form service exposed to a `ms.vss-web.external-content` custom-dialog iframe. Confirms 04-RESEARCH Finding 1: `isReadOnly` lives on `IWorkItemLoadedArgs` (`onLoaded` listener), and that listener is wired by `ms.vss-work-web.work-item-form` contributions, not by custom dialogs. **FALSIFIED.**
- **(b) `getFieldValue('System.AuthorizedAs')`** — returns the user's display string `Tsezari <cezo777@gmail.com>`. Useful as identity, NOT a permission signal — every authenticated user gets a value here regardless of whether they can edit the work item.
- **(c) self-`setFieldValue` no-op** — returned `true`; post-write `isValid=true`, `isDirty=false`. Clean no-op in writable case. The trailing `formService.reset()` line entered the catch branch with `undefined name`/`undefined message`, suggesting `reset` either does not exist on this form-service handle or threw a non-Error sentinel. We cannot confirm what self-`setFieldValue` returns on a truly read-only work item without a read-only fixture, and the spike on cezari (PBI in user's own org) cannot reproduce the read-only condition. Even if it returned `false` on read-only, the post-`reset` failure means the probe has a side-effect risk we cannot eliminate.
- **(d) `SDK.getUser()`** — exposes only `descriptor / id / name / displayName / imageUrl`. **NO `subjectKind` or `licenseRights` fields.** Cannot gate writes by license tier from the SDK in this contribution context.

**A3 verdict: LAZY-FALLBACK-ONLY.** D-05 hypothesis FALSIFIED.

**Decision (feeds into Plan 04-03 `bridge.ts::getIsReadOnly`):**

```typescript
// bridge.ts::getIsReadOnly — chosen body per Probe 2 evidence:
export async function getIsReadOnly(): Promise<{ isReadOnly: boolean; probeFailed: boolean }> {
  // No reliable eager probe exists from a ms.vss-web.external-content dialog.
  // Per Plan 04-01 Probe 2 (2026-05-02): formService.isReadOnly is undefined,
  // self-setFieldValue can't be cleanly probed without dirty side-effects on
  // writable items, and SDK.getUser() lacks license-tier discriminators.
  // Default to writable + probeFailed=true; rely on D-07 reactive error handling
  // (apply.ts catches setFieldValue/save() errors and shows FieldFailBanner).
  return { isReadOnly: false, probeFailed: true };
}
```

**Implications for downstream plans:**

- **Plan 04-03 (`bridge.ts`):** Stub above is the implementation. No try/catch wrapper around any probe — the function returns the default sentinel synchronously (well, through an `async` boundary for type compatibility with the rest of `bridge.ts`). The `permission.probeFailed: true` slot is now BASELINE behavior, not exception. `CalcSpReadResult` typing should reflect this — `probeFailed` is always `true` in this implementation.
- **Plan 04-05 (`apply.ts` orchestrator):** Read-only branch (D-06) is reachable ONLY if the user clicks Apply and `setFieldValue` returns `false` OR `save()` rejects with a 403 / permission error. The apply orchestrator catches errors and shows the FieldFailBanner. This shifts the read-only UX from preemptive (modal-open-time) to reactive (apply-click-time).
- **Modal-open UX:** The CalcModal opens fully usable for every work item; the read-only message panel (D-06 / APPLY-09) appears only post-apply if the SDK rejects the write. Document as Phase 4 acknowledged limitation; eager-probe revisit deferred to Phase 5 (only if a license-tier discriminator surfaces in a future SDK release).

### A4 — Programmatic dialog close (D-10 / Finding 3)

**Verdict:** NO-PROGRAMMATIC-CLOSE — confirmed empirically + corroborated by webpack compile-time warnings on the spike build.

**Probe 3 verbatim DevTools console transcript:**

```
[sp-calc/spike] probe3 START
[sp-calc/spike] probe3 notifyDialogResult returned= undefined modal still open? — visually inspect
[sp-calc/spike] probe3 notifyDismiss returned= undefined modal still open? — visually inspect
[sp-calc/spike] probe3 closeCustomDialog returned= undefined modal still open? — visually inspect
[sp-calc/spike] probe3 DONE — verify visually that the modal is still open
```

**User-confirmed visual:** "not closed" — modal stayed open after all three close calls.

**Build-time corroboration:** webpack production build emitted three warnings — `notifyDialogResult`, `notifyDismiss`, `closeCustomDialog` are not exports from `azure-devops-extension-sdk` v4. The optional-chained calls returned `undefined` silently because the methods don't exist on the SDK module at runtime. (Warnings disappear in Task 4 once `modal-spike.tsx` is deleted.)

**A4 verdict: NO-PROGRAMMATIC-CLOSE.** From a `ms.vss-web.external-content` dialog (Phase 3 contribution shape), there is NO SDK-driven path to close the modal. **D-10 "modal closes after success" must be REDEFINED.**

**Decision (feeds into Plan 04-04 `SavedIndicator.tsx` + Plan 04-05 `CalcModal` saved-mode handler):**

- **D-10 redefinition:** Success path shows `SavedIndicator` ("Saved ✓" for 200ms) followed by **a persistent saved-state view in the modal body**; user dismisses the dialog manually via the host's close affordance (X button) or by clicking outside (lightDismiss is allowed in non-saving states per D-15). The modal stays open until the user explicitly closes it.
- **`SavedIndicator.tsx` (Plan 04-04):** Renders "Saved ✓" alone for 200ms, then transitions to a permanent "Saved ✓ — close this dialog when ready" state in the modal body (or equivalent copy aligned to UI-SPEC). Does NOT attempt any SDK close call after the 200ms timer.
- **`CalcModal` saved-mode handler (Plan 04-05):** Adds a `saved` mode to the state machine. On entry: render `SavedIndicator`; disable the Apply button (already complete); keep Cancel/Close visible so the user has an explicit dismissal affordance. No `SDK.notifyDialogResult` / `SDK.notifyDismiss` / `SDK.closeCustomDialog` calls anywhere in the codebase.

### A5 — addComment api-version selection (D-13)

**Verdict:** NO-FUNCTIONAL-DIFFERENCE — both `7.0-preview.3` and `7.1-preview.4` accepted the request, returned status 200, returned `format:"html"` in the response body, and produced identical storage and rendering.

Same Probe 1 transcript covers this. The four-cell matrix (api-version × format) shows no observable difference between api-versions on any axis — status code, response shape, storage behavior, renderer behavior.

**Decision (feeds into Plan 04-03 `postComment.ts` + future `adoFetch.ts`):**

- Use **`7.0-preview.3`** to match the existing read path in `src/ado/comments.ts` (Phase 3) — single source of truth. Constant should live in `src/ado/comments.ts` (or the future `src/ado/adoFetch.ts` per D-14) and be consumed by both readers and writers.
- D-13 confirmed: no escalation needed.

### Probe 4 — Mid-write force-close (D-15 lightDismiss caveat)

**Probe 4 verbatim DevTools console transcript:**

```
[sp-calc/spike] probe4 START
[sp-calc/spike] probe4 token acquired (len=1092)
[sp-calc/spike] probe4 POSTING comment...
[sp-calc/spike] probe4 comment status= 200
[sp-calc/spike] probe4 deferring setFieldValue by 8000ms — CLICK OUTSIDE THE DIALOG NOW to test lightDismiss mid-write
[sp-calc/toolbar] dialog closed
```

**User report (after reopening work item PBI #2):**

1. `probe4` comment exists in Discussion tab: **YES** (POST succeeded with 200 before user clicked outside).
2. Story Points field updated to `1`: **YES** (deferred `setFieldValue + save()` fired after the dialog had already closed).
3. Dialog close was forced by outside-click (lightDismiss), not voluntary: **YES**.

**Verdict:** WRITE-COMPLETES-EVEN-AFTER-CLOSE. The iframe is NOT destroyed on lightDismiss; the host hides it but the JS context continues running. The deferred 8s `setTimeout` fired, `setFieldValue + save()` executed, and the field updated to `1` *after the dialog had already closed*.

**Implication for Plan 04-05 `toolbar.tsx` + `CalcModal` state machine:**

- lightDismiss does NOT abort in-flight writes — the data lands either way. BUT the UX is poor: the user thinks they cancelled, then the SP field changes silently 8 seconds later.
- **D-15 hardening (`lightDismiss: false` during saving states) is REQUIRED for UX clarity, not data integrity.** The CalcModal state machine in Plan 04-05 must:
  - Pass `lightDismiss: false` to `openCustomDialog` in `toolbar.tsx`.
  - During `saving` mode: render `SavingOverlay` blocking close affordances (per UI-SPEC).
  - During `saved` mode: lightDismiss MAY re-enable (write is already complete) — but UX-wise we keep `lightDismiss: false` everywhere for consistency; user dismisses via explicit Close button.
- No `AbortController` plumbing required. The data is fine; the UX is what we harden.

## Manual Verification Checklist (D-17 — to be filled by Plan 04-06 in Wave 4)

*(Empty stub — Plan 04-06 fills with the 8 D-17 scenarios.)*

## Real-world Corrections (per Phase 03-04 pattern — to be filled if cezari verification surfaces back-port-able bugs)

*(Empty stub — populated during Plan 04-06 cezari verification run.)*
