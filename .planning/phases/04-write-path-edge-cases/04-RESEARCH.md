---
phase: 4
slug: write-path-edge-cases
status: research-complete
researched: 2026-05-02
extends_research:
  - .planning/research/SUMMARY.md
  - .planning/research/ARCHITECTURE.md
  - .planning/research/PITFALLS.md
  - .planning/research/STACK.md
  - .planning/phases/03-modal-ui-read-path/03-RESEARCH.md
  - .planning/phases/03-modal-ui-read-path/03-VERIFICATION.md
---

# Phase 4: Write Path & Edge Cases — Research

**Researched:** 2026-05-02
**Domain:** Azure DevOps work-item-form custom dialog — write path (REST POST + form-service field write) with comment-first → field-write atomicity (Phase 0 D-01)
**Confidence:** HIGH on REST contract / form-service surface / dialog-close mechanism (verified against Microsoft Learn 2026-04 + node_modules .d.ts) — MEDIUM on the empirical sanitizer behavior (D-02 validation step is non-negotiable)

## Summary

Phase 4 turns the Phase 3 stub-Apply into a real two-leg write (REST POST `addComment` first, then `IWorkItemFormService.setFieldValue` + `.save()`), gated by a permission probe and an overwrite-confirm panel, with friendly errors on every documented failure mode. The implementation lives almost entirely in three files: a new `src/ado/adoFetch.ts` direct-fetch helper, a new `src/ado/postComment.ts` write counterpart to `comments.ts`, and a rewrite of `src/apply/stubApply.ts` (Phase 3 D-12) with the orchestrator (`src/ui/CalcModal.tsx`) gaining four new view modes. The status-code → friendly-message map and the SDK-error-class → status-discriminator map both live in a single pure module `src/apply/errorMessages.ts` and are vitest-tested per project standard (UI is manual cezari verification per `CLAUDE.md` "manual QA does UI testing per company standard; only formula logic is unit-tested").

**Three findings the planner cannot miss** — each one invalidates a CONTEXT.md decision as written and forces a rework or empirical-validation task in the plan:

1. **`IWorkItemFormService.isReadOnly()` does not exist as a method.** D-05 / D-07 assume `formService.isReadOnly(): Promise<boolean>` — verified against `node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts` (lines 55–246), there is no such method on the form-service interface. `isReadOnly` is a **property on `IWorkItemLoadedArgs`** delivered to a registered `IWorkItemNotificationListener.onLoaded(args)` callback — and that listener is registered by a contribution of type `ms.vss-work-web.work-item-form` (form-extension), not by a custom-dialog contribution. **The dialog iframe cannot directly read `isReadOnly` from the SDK surface it has access to.** The plan must either (a) thread `isReadOnly` from the toolbar action through `openCustomDialog` configuration (the toolbar handler runs in a hidden form-extension iframe but is registered as `ms.vss-web.action`, also not a form-extension — it likely cannot read `isReadOnly` either) — VERIFY EMPIRICALLY — OR (b) infer permission lazily from the actual Apply HTTP/SDK error codes (treat 403/permission-equivalent SDK rejection as the read-only signal), OR (c) probe via a `formService.getFieldValue("System.AuthorizedAs")` plus `SDK.getUser()` license check heuristic. The CONTEXT D-05 path of "form service postMessage probe" needs an architectural rethink — this is the highest-risk plan-time discovery.

2. **The `format` field is NOT documented in the `addComment` REST request body.** D-01 specifies posting `{ text: "...", format: 1 }` to preserve raw `<!-- -->` HTML comments. Verified against Microsoft Learn 2026-04 [Comments - Add Comment 7.1-preview.4](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/add-comment?view=azure-devops-rest-7.1) and [Comments - Add 7.0-preview.3](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/add?view=azure-devops-rest-7.0): both versions show the `CommentCreate` request body schema as `{ text: string }` ONLY. The `format` enum exists in the **Comment response** schema and in the SDK's `CommentFormat` enum, but is NOT a documented request input. The 7.1 endpoint name is **"Add Comment"** (not "Add"), and the canonical version is 7.1-preview.4 (not 7.0-preview.3 as CONTEXT D-13 says). Phase 03-04 already proved the read path round-trips an HTML-encoded sentinel cleanly via the entity-decode patch; sending `format: 1` may be ignored, may be stored in the Comment.format response field undocumented, or may produce an unexpected sanitizer behavior. **D-02's empirical validation MUST be the first plan task and must run before any other Phase 4 code lands** — the entire UX hinges on whether `<!-- -->` survives storage AND renderer when format=1 is sent. The fallback to invisible-div carrier is real and must be planned for.

3. **There is no programmatic close API for custom dialogs from inside the dialog iframe.** D-10 / D-15 / UI-SPEC's saving-overlay state both assume `SDK.notifyDialogResult({ closed: true, sp: N })` or similar. Verified against `node_modules/azure-devops-extension-sdk/SDK.d.ts` (the entire public surface — no `notifyDialogResult`, no `notifyDismiss`, no `removeDialog`) and against Microsoft Learn 2026-04 [Create modal dialogs](https://learn.microsoft.com/en-us/azure/devops/extend/develop/using-host-dialog?view=azure-devops): "The dialog content page can't directly communicate back to the host except through the `onClose` result." The `onClose` callback fires when the **host** closes the dialog (via X / Esc / outside-click) — the iframe cannot trigger it. The "modal closes after 200ms Saved ✓" goal in D-10 must become "modal STAYS open with a Saved ✓ indicator and an Esc-to-close hint until the user dismisses." This is a UX fact, not a workaround — the legacy `vss-web-extension-sdk` did expose a `getDialogResult/okCallback` pattern but that path is gone in the modern v4 SDK. The success ROADMAP criterion 5 ("the work item form reflects the new SP value without a full page reload") is still met because `setFieldValue + .save()` mutates the open form's in-memory state directly.

**Primary recommendation for the planner:** Sequence the plan so that the three above unknowns are de-risked by Plan 04-01 (a thin "validation spike") before locking the implementation files. Specifically: (1) post a sentinel via direct fetch to 7.1-preview.4 with and without `format: 1` and inspect both the rendered Discussion view AND the GET response body for whether `<!-- -->` survives, AND (2) probe what `IWorkItemFormService` actually exposes to a custom-dialog iframe (does `getFields()` work? — yes, Phase 03-04 proved it; does any other field/method give a permission signal? — possibly `setFieldValue` returns `Promise<false>` for read-only fields, or `save()` rejects with a structured error). Lock D-01, D-05, and D-10 only after this spike lands evidence in `04-VERIFICATION.md`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Audit comment POST (write) | API / REST (direct fetch) | — | The `WorkItemTrackingClient` in azure-devops-extension-api@4.270.0 does NOT expose `addComment`; only `getComment(s)`. Even if it did, the SDK REST client hangs in dialog iframes (Phase 03-04 Override 4 — location service unreachable). Direct fetch via `SDK.getAccessToken()` + `SDK.getHost().name` is the only path. |
| Field write (Story Points) | Form Service (SDK postMessage) | — | `IWorkItemFormService.setFieldValue + .save()` is the contract from PROJECT.md Key Decisions. REST PATCH from a dialog iframe while the form is open causes revision conflicts (PITFALLS Pitfall 4). Form service postMessage works in dialog iframes (Phase 03-04). |
| Permission probe (`isReadOnly`) | **UNRESOLVED** — see Finding 1 | API error codes (lazy fallback) | The interface assumed by D-05 does not exist. Lazy detection via the actual write's HTTP/SDK error codes is the architecturally honest fallback; the eager probe needs spike investigation. |
| Overwrite confirmation panel | Browser / Client (React) | — | Pure UI state machine in `src/ui/CalcModal.tsx`; no SDK involvement. CONTEXT D-03 / UI-SPEC §View-State Machine. |
| Status-code → friendly message map | Browser / Client (pure module) | — | `src/apply/errorMessages.ts` — pure function, vitest-testable, no SDK boundary. CONTEXT D-11. |
| SDK error class → status discriminator | Browser / Client (pure module) | — | Same module as above; the form-service `.save()` rejection's runtime shape is best determined empirically and codified as a string-matcher table. CONTEXT D-20. |
| Saving overlay (in-flight UI) | Browser / Client (React + CSS) | — | Pure component; absolutely-positioned div over body region. UI-SPEC §Saving Overlay. |
| Programmatic dialog close | **NOT POSSIBLE** — see Finding 3 | User dismissal (Esc / X / outside-click) | No close API exists in modern SDK. The closest available: invoke `lightDismiss: false` at openCustomDialog time to harden the saving window, then rely on user dismissal post-success. |
| Dialog open with `lightDismiss: false` | Toolbar action (`src/entries/toolbar.tsx`) | — | The option must be set when the host opens the dialog. Cannot be toggled at runtime by the dialog iframe. Toolbar.tsx Phase 4 amendment. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

> All twenty decisions from `.planning/phases/04-write-path-edge-cases/04-CONTEXT.md` `<decisions>` apply unchanged. Excerpted here for the planner; the canonical record is CONTEXT.md.

- **D-01:** POST `addComment` with `commentFormat: 1` (HTML) — sentinel preserved by storage, hidden by renderer. **[ASSUMED — see Finding 2 above; format is undocumented in the request body. D-02 spike validates.]**
- **D-02:** Empirical sanitizer validation in plan (30 min on cezari) before locking D-01. Fallback: invisible-div carrier `<div data-sp-calc="v1" hidden>{...JSON...}</div>`.
- **D-03:** First Apply on item with existing SP REPLACES the calculator with a confirm panel (Back / Confirm Apply, dropdowns unmounted).
- **D-04:** Trigger threshold: whenever current SP is non-null, regardless of equality with new SP.
- **D-05:** `IWorkItemFormService.isReadOnly()` probe in the read-path effect — runs in parallel with existing read probes. **[ASSUMED — see Finding 1; this method does not exist on the form service. Plan must spike alternatives.]**
- **D-06:** Read-only branch REPLACES the calculator UI; same shape as Phase 3 D-19 NoFieldMessage; severity=Info MessageCard. APPLY-09 wording rewrite required (mirror of FIELD-04 / Phase 3 D-17).
- **D-07:** Probe-fail → default writable + dismissable Warning banner ("Could not verify your permissions…").
- **D-08:** Comment POST fails → in-modal Error banner + Retry + selections preserved + NO field write attempted.
- **D-09:** Comment succeeds + field write fails → persistent Error banner + Retry runs the field write only (comment intentionally kept).
- **D-10:** Success path: 200ms "Saved ✓" indicator → modal closes via host close affordance. **[ASSUMED — see Finding 3; the modal cannot programmatically close. Realistically: 200ms Saved ✓, then a persistent Esc-to-close hint replaces the ButtonGroup, and the user dismisses. The setFieldValue + .save() write satisfies ROADMAP criterion 5 regardless of when the dialog closes.]**
- **D-11:** Status code → friendly copy map (401, 403, 404, 409, 412, 429, 5xx, else) — pure function `src/apply/errorMessages.ts`.
- **D-12:** Replace body of `src/apply/stubApply.ts` (rename to `src/apply/apply.ts` if convenient); keep `ApplyInput` shape stable.
- **D-13:** REST API version `7.0-preview.3` for `addComment`. **[CITED — works per Microsoft Learn 2026-04, but the modern endpoint name is "addComment" with version `7.1-preview.4` and is the active path; the SDK exposes `CommentFormat` enum on the 7.1 line. Phase 4 plan should choose: stick to 7.0-preview.3 per CONTEXT consistency, or upgrade to 7.1-preview.4 to match the read path's already-used `getComments` API version.]**
- **D-14:** Shared `src/ado/adoFetch.ts` helper — single source of truth for direct fetch (URL, token, JSON, errors).
- **D-15:** Block close affordances + saving overlay during in-flight writes; no AbortController. **[Partial caveat — `lightDismiss: false` set at openCustomDialog time hardens host close; mid-write force-close cannot be fully prevented per the no-programmatic-close fact in Finding 3.]**
- **D-16:** Reopen-after-Apply uses Phase 3 D-12 pre-fill behavior unchanged.
- **D-17:** Manual cezari (Scrum) checklist (8 scenarios) + light vitest tests.
- **D-18:** Vitest for `adoFetch` URL construction, `postComment` payload shape, status-code map, SDK-error → discriminator mapper.
- **D-19:** CMMI live verification deferred to Phase 5; Phase 4 unit-tests the FIELD-02 fallback path conceptually.
- **D-20:** Translate `IWorkItemFormService.save()` rejections into the same status-discriminator buckets used by D-11 (RuleValidationException → 412 bucket, etc.).

### Claude's Discretion

- Exact MessageCard wording for D-08 / D-09 banners.
- Whether `stubApply.ts` is renamed to `apply.ts` or its body simply replaced (recommend rename — file is no longer a stub; commit the rename + Phase 3 import-site update in a single commit).
- File organization inside `src/ado/` — recommend a new `postComment.ts` standalone file (mirror of `comments.ts` for the read counterpart).
- Saving-overlay rendering — translucent backdrop + spinner is the UI-SPEC contract; planner picks pointer-events vs aria-busy mechanics.
- "Saved ✓" indicator slot — replace ButtonGroup vs inline next to it. Recommend: replace ButtonGroup with the `Saved ✓` + Esc-hint slot to absorb the no-programmatic-close reality (Finding 3).
- Programmatic close mechanism — Finding 3 tells the planner this is not possible; replace D-10's "modal closes" with "Saved ✓ + Esc-to-close hint."
- Whether to surface SDK error message verbatim in D-11 generic fallback — recommend yes for triage.

### Deferred Ideas (OUT OF SCOPE)

> Verbatim from CONTEXT.md `<deferred>`:

- **CMMI live verification** — Phase 5 (Phase 0 D-14 / Phase 3 D-31 / Phase 4 D-19).
- **Custom SP field rename support** — PROJECT.md Out of Scope.
- **AbortController on in-flight fetch** — D-15 blocks close affordances; explicit abort wiring is over-engineering.
- **Bundle-size CI gate** — Phase 5 PKG-03.
- **`dev-publish.cjs` Windows retry fix** — Phase 5 cleanup per Phase 03-04 Issues Discovered.
- **"Just saved" reopen banner with session-local timestamp** — rejected for D-16.
- **Telemetry / analytics on apply errors** — Out of Scope per REQUIREMENTS.md.
- **Multi-step retry strategy (e.g., exponential backoff on 429)** — D-11 surfaces; user retries manually.
- **Marketplace listing assets, public publish** — Phase 5 (PKG-02..07).
- **Per-component theme matrix + per-key keyboard transcripts** — Phase 03-04 deferral; Phase 5 polish.
- **Auto-detect "story-point-like" custom fields by data-type heuristic** — Phase 5 stretch.

## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support |
|---|---|---|
| APPLY-04 | When current SP field has a value, Apply shows in-modal confirmation panel "Current: X / New: Y" before performing the write | UI-SPEC §View-State Machine confirms transitions; CONTEXT D-03 / D-04 lock the trigger threshold and "REPLACE the calculator" presentation; pure React state machine in CalcModal.tsx (Architectural Responsibility Map → Browser / Client tier) |
| APPLY-05 | Apply writes new SP via `IWorkItemFormService.setFieldValue()` + `.save()` | Verified against `node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts` lines 129 (`setFieldValue: Promise<boolean>`), 181 (`save(): Promise<void>`); CONTEXT D-12 / D-20; Phase 03-04 confirmed form service postMessage works in the dialog iframe |
| APPLY-06 | Apply posts audit comment via `WorkItemTrackingRestClient.addComment()` (api-version `7.0-preview.3`) | **PARTIALLY CITED** — `WorkItemTrackingRestClient` does NOT expose `addComment`; only `getComment(s)`. Direct fetch is the only path. Microsoft Learn 2026-04 confirms 7.0-preview.3 is the documented endpoint path (and 7.1-preview.4 is also valid); CONTEXT D-13 picks 7.0-preview.3. Plan must implement direct-fetch in `src/ado/postComment.ts` per CONTEXT D-14 |
| APPLY-07 | Write atomicity ordering decided in Phase 1, documented in plan, consistently applied | Phase 0 D-01 locks comment-first → field-write; PROJECT.md Key Decisions row "Apply ordering: comment-first → field-write" — already documented. Phase 4 implements per CONTEXT D-12; verifier checks that the orchestrator awaits comment success before invoking setFieldValue |
| APPLY-08 | Field-write fail → status-code-specific error toast; comment-fail after field-write → clear error toast, field write left in place | CONTEXT D-08 / D-09 / D-11 / D-20 lock the banner UX (in-modal MessageCard, not toast); status-code map pure function in `src/apply/errorMessages.ts`; all 8 D-11 buckets vitest-covered |
| APPLY-09 | Permission check before showing/enabling Apply: lacking write permission → button disabled with tooltip; modal opens read-only for inspection | **WORDING REWRITE REQUIRED** per CONTEXT D-06 — the literal current text says "Apply disabled with tooltip + calculator usable"; the user choice (replace calculator entirely with read-only message) requires APPLY-09 to be re-stated. Mirrors Phase 3 D-17's FIELD-04 rewrite. Plan must include a task to update REQUIREMENTS.md APPLY-09 BEFORE Phase 4 closes — otherwise verifier fails Phase 4 against the literal pre-discussion APPLY-09 text. **Additionally:** Finding 1 invalidates the eager `isReadOnly()` probe path that D-05 / D-06 assume — the planner must spike a working alternative |

## Standard Stack (Phase 4 additions on top of pinned Phase 0 stack)

### Core (no new packages)

> All Phase 4 functionality is built on the already-pinned stack from `package.json`. No new runtime dependencies.

| Package | Pinned Version | Why for Phase 4 | Choice / Version confidence |
|---|---|---|---|
| `azure-devops-extension-sdk` | `4.2.0` | `SDK.getAccessToken()` for direct fetch auth, `SDK.getHost()` for URL construction (Override 4 pattern from Phase 03-04). Verified in `node_modules/azure-devops-extension-sdk/SDK.d.ts`. | HIGH / HIGH (`[VERIFIED: package.json + SDK.d.ts]`) |
| `azure-devops-extension-api` | `4.270.0` | `IWorkItemFormService` types (setFieldValue, save, isDirty, isValid, getInvalidFields, setError, clearError); `CommentFormat` enum (Markdown=0, Html=1) for D-01 — note: enum exists in SDK type definitions but the `format` field is NOT documented in the REST request body per Microsoft Learn 2026-04. | HIGH / HIGH on form-service surface; MEDIUM on whether `format` body field is honored by the API (`[VERIFIED: WorkItemTrackingServices.d.ts]` for form service; `[ASSUMED]` for format-in-body behavior) |
| `azure-devops-ui` | `2.272.0` | `MessageCard` (with `buttonProps?: IButtonProps[]` for embedded Retry button per CONTEXT D-08 / D-09 — verified at `node_modules/azure-devops-ui/Components/MessageCard/MessageCard.Props.d.ts`); `Spinner` (sizes xSmall/small/medium/large per `Spinner.Props.d.ts`); `Button`, `ButtonGroup`. **No new components required.** UI-SPEC §Component inventory confirms zero new `azure-devops-ui` imports. | HIGH / HIGH (`[VERIFIED: node_modules .d.ts]`) |
| `react`, `react-dom` | `18.3.1` | State machine in CalcModal.tsx; new view modes ("confirm", "saving", "saved", "readonly", "commentFail", "fieldFail") layered onto Phase 3 modes ("loading", "calculator", "noField"). | HIGH / HIGH (`[VERIFIED]`) |

### Supporting (no new dev dependencies)

| Package | Pinned Version | Phase 4 Use | Confidence |
|---|---|---|---|
| `vitest` | `^2.1.0` | Unit tests for `adoFetch` URL construction, `postComment` payload shape, status-code map, SDK-error → discriminator mapper, FIELD-02 fallback path. Existing `vitest.config.ts` enforces 100% coverage on `src/calc/**` and `src/audit/**`; Phase 4 should ADD `src/apply/**` and `src/ado/**` glob entries (excluding the postMessage-dependent code paths) — see Validation Architecture below. | HIGH / HIGH |
| `tfx-cli` | `0.23.1` | Reused via the Phase 2 dev-publish wrapper for cezari verification. Windows-retry caveat (Phase 03-04 Issues Discovered) — fall back to `npx tfx extension publish --override` directly. | HIGH / HIGH |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Verdict |
|---|---|---|---|
| Direct fetch via `adoFetch` helper | `getClient(WorkItemTrackingRestClient).addComment(...)` from `azure-devops-extension-api` | The typed SDK client doesn't expose `addComment` AT ALL (only `getComment`/`getComments` per `WorkItemTrackingClient.d.ts` line 117–133). Even if it did, the SDK REST client hangs indefinitely in dialog iframes (Phase 03-04 Override 4 — `beginRequest` awaits a location-service promise that never resolves). | **REJECTED — direct fetch is the only path** |
| 7.0-preview.3 api-version (per CONTEXT D-13) | 7.1-preview.4 api-version (modern; matches Phase 3's `getComments`) | 7.0-preview.3 is the canonical "Add" endpoint per Microsoft Learn 2026-04. 7.1-preview.4 is the canonical "Add Comment" endpoint with the same scope (`vso.work_write`) and same `CommentCreate { text }` body schema. Both work. The Phase 03-04 read uses 7.1-preview.4. | Recommend planner pick **7.1-preview.4** to keep read+write on the same modern API line, but CONTEXT D-13 specifies 7.0-preview.3 — defer to CONTEXT unless plan-task-1 (D-02 spike) finds 7.0-preview.3 misbehaves |
| Overwrite confirm panel (D-03 layout) | `IHostPageLayoutService.openMessageDialog` (host-managed confirm dialog) | A nested host dialog from inside a custom dialog is unusual and may stack visually; UI-SPEC §View-State Machine commits to in-modal panel; mode unmounting keeps state lossless. | **REJECTED — in-modal panel per UI-SPEC** |
| In-modal MessageCard error banner (D-08, D-09) | `IGlobalMessagesService.addToast` (host-managed toast outside the dialog) | Toasts dismiss themselves; user loses the actionable Retry context. UI-SPEC commits to in-modal MessageCard with embedded Retry button (`buttonProps`). | **REJECTED — in-modal MessageCard** |
| `MessageCard buttonProps` for Retry button | Inline Button child | `IMessageCardProps.buttonProps?: IButtonProps[]` is built in (`MessageCard.Props.d.ts:15`) — preserves theme + spacing. UI-SPEC `<Button text="Retry" .../>` inside `<MessageCard>` is also legitimate (children pattern). | Both work; planner picks. Recommend `buttonProps` for consistency with the library's intended API |
| Persistent saving overlay using `Spinner size={SpinnerSize.large}` | Inline Spinner inside the Apply button only | UI-SPEC §Saving Overlay specifies BOTH (overlay over body region AND inline spinner in the swapped-label "Saving…" Apply button). Belt-and-suspenders. | **Use both per UI-SPEC** |

**No `npm install` required.** Phase 4 uses only the already-pinned stack.

**Version verification — already done:** `package.json` pins are current as of 2026-05-01 (Phase 0 closure); no re-verification needed for Phase 4.

## Architecture Patterns

### System Architecture Diagram (write path)

```
USER                  HOST              TOOLBAR-ACTION              MODAL IFRAME (CalcModal)
                                          IFRAME (hidden)
 │                     │                     │                              │
 │ click Apply         │                     │                              │
 │────────────────────────────────────────────────────────────────────────▶│
 │                     │                     │             ┌────────────────┴───────────────┐
 │                     │                     │             │  ConfirmOverwritePanel        │
 │                     │                     │             │  (if currentSp != null per     │
 │                     │                     │             │   D-04) → Confirm Apply click  │
 │                     │                     │             └────────────────┬───────────────┘
 │                     │                     │                              │
 │                     │                     │             ┌────────────────┴───────────────┐
 │                     │                     │             │  mode = "saving"               │
 │                     │                     │             │  • SavingOverlay covers body   │
 │                     │                     │             │  • Apply → "Saving…" + Spinner │
 │                     │                     │             │  • Cancel disabled             │
 │                     │                     │             └────────────────┬───────────────┘
 │                     │                     │                              │
 │                     │                     │                              │ ── LEG 1: COMMENT POST ──
 │                     │                     │                              │ adoFetch(
 │                     │                     │                              │   "POST",
 │                     │                     │                              │   "/{projectId}/_apis/wit/
 │                     │                     │                              │      workItems/{id}/comments",
 │                     │                     │                              │   "7.0-preview.3" or
 │                     │                     │                              │   "7.1-preview.4",
 │                     │                     │                              │   { text: "<!-- sp-calc:v1 ...-->\n
 │                     │                     │                              │       Story Points: 5 (...)"
 │                     │                     │                              │     [, format: 1 ?] }
 │                     │                     │                              │ )
 │                     │                     │                              │
 │  ┌─ if !ok ─────────────────────────────────────────────────────────────▼
 │  │                                                                       │ throw + map to D-11 status
 │  │                                                                       │ mode = "commentFail"
 │  │                                                                       │ (banner + Retry; Cancel)
 │  │                                                                       │ NO field write attempted
 │  └─ if ok ─────────────────────────────────────────────────────────────▶│
 │                                                                          │
 │                                                                          │ ── LEG 2: FIELD WRITE ──
 │                                                                          │ formService.setFieldValue(
 │                                                                          │   resolvedField,    // StoryPoints | Size
 │                                                                          │   sp                // calculated value
 │                                                                          │ )                   // → Promise<boolean>
 │                                                                          │ if (false): SDK rejected/validated;
 │                                                                          │   formService.getInvalidFields()
 │                                                                          │   → mode = "fieldFail"
 │                                                                          │ formService.save()  // → Promise<void>
 │                                                                          │
 │  ┌─ if save() rejects ──────────────────────────────────────────────────▼
 │  │                                                                       │ map SDK error class → D-11 bucket
 │  │                                                                       │ mode = "fieldFail"
 │  │                                                                       │ (banner + Retry-field-only;
 │  │                                                                       │  comment intentionally kept;
 │  │                                                                       │  D-09)
 │  └─ if both succeed ───────────────────────────────────────────────────▶│
 │                                                                          │ mode = "saved"
 │                                                                          │ • ButtonGroup → "Saved ✓" + Esc-hint
 │                                                                          │ • after 200ms timer: persistent state
 │                                                                          │   (NO programmatic close — Finding 3)
 │                                                                          │
 │ user presses Esc / X / outside-click                                     │
 │────────────────────────▶│                                                │
 │                         │  host fires onClose() (from openCustomDialog)  │
 │ work item form's SP    │  → toolbar.tsx onClose log                      │
 │ already shows new value │  (form already saved via setFieldValue+.save())│
 │ (no page reload needed) │                                                │
 │◀────────────────────────│                                                │
```

### Recommended Project Structure (Phase 4 deltas)

```
src/
├── ado/
│   ├── adoFetch.ts          # NEW — D-14 shared direct-fetch helper
│   ├── bridge.ts            # MODIFIED — add getIsReadOnly wrapper IF Finding 1 spike resolves
│   ├── comments.ts          # REFACTORED — consume adoFetch (5–10 line wrapper)
│   ├── postComment.ts       # NEW — addComment via adoFetch with sentinel payload (D-01, D-13)
│   ├── index.ts             # MODIFIED — export postComment + (maybe) getIsReadOnly
│   └── types.ts             # MODIFIED — extend CalcSpReadResult with optional permission slot
├── apply/
│   ├── apply.ts             # RENAMED from stubApply.ts (D-12) — real two-leg orchestration
│   └── errorMessages.ts     # NEW — D-11 status-code map + D-20 SDK error class → discriminator
├── ui/
│   ├── CalcModal.tsx        # MODIFIED — 4 new view modes: confirm, saving, saved, readonly, commentFail, fieldFail
│   ├── ConfirmOverwritePanel.tsx   # NEW — D-03
│   ├── ReadOnlyMessage.tsx  # NEW — D-06 (parallel to NoFieldMessage.tsx)
│   ├── PermissionWarnBanner.tsx    # NEW — D-07
│   ├── CommentFailBanner.tsx       # NEW — D-08
│   ├── FieldFailBanner.tsx         # NEW — D-09
│   ├── SavingOverlay.tsx    # NEW — D-15
│   └── SavedIndicator.tsx   # NEW — D-10 (replaces ButtonGroup post-success)
└── entries/
    └── toolbar.tsx          # MODIFIED — set lightDismiss: false at openCustomDialog (D-15)

tests/
├── apply/
│   ├── apply.test.ts        # NEW — orchestrator integration test with mocked adoFetch + form service
│   └── errorMessages.test.ts # NEW — status-code map (8 buckets) + SDK error → discriminator
└── ado/
    ├── adoFetch.test.ts     # NEW — URL construction, isHosted branch, projectId encoding, api-version query
    └── postComment.test.ts  # NEW — payload shape, sentinel from serialize() output

.planning/phases/04-write-path-edge-cases/
└── 04-VERIFICATION.md       # NEW — manual cezari checklist (D-17 scenarios 1–8) + Real-world Corrections
```

### Pattern 1: Direct-fetch via adoFetch helper (Override 4 codified)

**What:** All ADO REST calls from the dialog iframe go through `src/ado/adoFetch.ts`. The SDK's `getClient(...)` REST clients hang in dialog iframes (Phase 03-04 Override 4 — location-service postMessage never resolves). Direct fetch using `SDK.getAccessToken()` + `SDK.getHost().name` works.

**When to use:** Every REST call from the dialog iframe. Phase 4 has two callers (`comments.ts` for read, `postComment.ts` for write); future v2 settings reads also reuse it.

**Example — adoFetch signature and body:**
```typescript
// Source: CONTEXT D-14; Phase 03-04 Override 4 (verified empirically on cezari)
import * as SDK from "azure-devops-extension-sdk";

const LOG_PREFIX = "[sp-calc/adoFetch]";

export async function adoFetch<T>(
  method: "GET" | "POST",
  path: string,             // e.g. "/{projectId}/_apis/wit/workItems/{id}/comments" — caller URL-encodes
  apiVersion: string,       // e.g. "7.0-preview.3" or "7.1-preview.4"
  body?: unknown,
  opts?: { signal?: AbortSignal },
): Promise<T> {
  const host = SDK.getHost();
  const token = await SDK.getAccessToken();
  const baseUrl = host.isHosted
    ? `https://dev.azure.com/${host.name}`
    : `https://${host.name}.visualstudio.com`;
  const url = `${baseUrl}${path}?api-version=${encodeURIComponent(apiVersion)}`;
  console.log(`${LOG_PREFIX} ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: opts?.signal,
  });
  console.log(`${LOG_PREFIX} response`, { status: response.status, ok: response.ok });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const err = new Error(
      `${method} ${path} failed: ${response.status} ${response.statusText} ${text.slice(0, 200)}`,
    );
    // Attach status for the orchestrator's typed-error translation (D-11):
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }

  return (await response.json()) as T;
}
```
Source: CONTEXT D-14, Phase 03-04 Override 4 (verified on cezari per `[sp-calc/comments] fetch URL https://dev.azure.com/cezari/<projectId>/_apis/wit/workItems/2/comments?api-version=7.1-preview.4`).

### Pattern 2: postComment.ts thin wrapper

```typescript
// Source: CONTEXT D-01, D-13, D-14; APPLY-06.
// CommentFormat enum is a const enum upstream — with isolatedModules: true,
// use literal 1 with documenting comment (Phase 2 D-12 / Phase 3 isolatedModules workaround).
import { adoFetch } from "./adoFetch";
import { serialize, type AuditPayload } from "../audit";

interface CommentResponse {
  id: number;        // Microsoft Learn names this `commentId` in 7.0/7.1; SDK type names it `id`
  commentId?: number;
  workItemId: number;
  text: string;
  createdDate: string;
  isDeleted: boolean;
  format?: number;   // 0 = Markdown, 1 = Html (CommentFormat) — present in 7.1 response
}

export async function postComment(
  workItemId: number,
  projectId: string,
  payload: AuditPayload,
): Promise<CommentResponse> {
  const text = serialize(payload);
  const body = {
    text,
    format: 1,  /* CommentFormat.Html — see D-01; behavior empirically validated by D-02 plan task */
  };
  const path = `/${encodeURIComponent(projectId)}/_apis/wit/workItems/${workItemId}/comments`;
  return adoFetch<CommentResponse>("POST", path, "7.0-preview.3", body);
}
```
Source: CONTEXT D-01, D-13, D-14, APPLY-06; verified against Microsoft Learn 2026-04 Comments - Add (7.0-preview.3) endpoint contract.

### Pattern 3: Two-leg apply orchestration (apply.ts)

```typescript
// Source: CONTEXT D-08, D-09, D-12, D-20; APPLY-05, APPLY-06, APPLY-07, APPLY-08; Phase 0 D-01.
import type { IWorkItemFormService } from "azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices";
import { calculate, type Level } from "../calc";
import type { AuditPayload } from "../audit";
import { postComment } from "../ado/postComment";
import { mapSdkErrorToStatus, friendlyMessageForStatus } from "./errorMessages";

export type AppliableFieldRef =
  | "Microsoft.VSTS.Scheduling.StoryPoints"
  | "Microsoft.VSTS.Scheduling.Size";

export interface ApplyInput {
  c: Level;
  u: Level;
  e: Level;
  fieldRefName: AppliableFieldRef;
}

export type ApplyError = {
  leg: "comment" | "field";
  status: number | null;       // HTTP status (comment leg) or null when SDK-class-driven
  sdkErrorClass?: string;      // form-service rejection class name (field leg)
  message: string;             // friendly message for D-11 banner
};

export async function applyToWorkItem(
  input: ApplyInput,
  workItemId: number,
  projectId: string,
  formService: IWorkItemFormService,
  options?: { skipCommentLeg?: boolean }, // for D-09 Retry (field-only)
): Promise<void> {
  const calcResult = calculate({ c: input.c, u: input.u, e: input.e });
  const payload: AuditPayload = {
    sp: calcResult.sp,
    c: input.c,
    u: input.u,
    e: input.e,
    schemaVersion: 1,
  };

  // LEG 1: Comment POST (skip on D-09 Retry).
  if (!options?.skipCommentLeg) {
    try {
      await postComment(workItemId, projectId, payload);
    } catch (err) {
      const status = (err as Error & { status?: number })?.status ?? null;
      throw {
        leg: "comment",
        status,
        message: friendlyMessageForStatus(status),
      } satisfies ApplyError;
    }
  }

  // LEG 2: Field write + save.
  try {
    const ok = await formService.setFieldValue(input.fieldRefName, calcResult.sp);
    if (!ok) {
      // setFieldValue returned false — validation rejected. Map to 412-bucket per D-20.
      throw new Error("setFieldValue rejected by form rule");
    }
    await formService.save();
  } catch (err) {
    const { status, sdkErrorClass } = mapSdkErrorToStatus(err);
    throw {
      leg: "field",
      status,
      sdkErrorClass,
      message: friendlyMessageForStatus(status),
    } satisfies ApplyError;
  }
}
```
Source: synthesized from CONTEXT D-12 / D-20 / Phase 0 D-01.

### Pattern 4: errorMessages.ts pure module

```typescript
// Source: CONTEXT D-11, D-20.
export function friendlyMessageForStatus(status: number | null): string {
  switch (status) {
    case 401: return "Sign in expired. Reload the page and try again.";
    case 403: return "You don't have permission to change this item.";
    case 404: return "Work item not found — it may have been deleted.";
    case 409: return "Conflict — please reload the work item and try again.";
    case 412: return "Work item changed since the modal opened — reload and try again.";
    case 429: return "Azure DevOps is throttling requests — wait a moment and retry.";
    default:
      if (status !== null && status >= 500 && status < 600) {
        return "Azure DevOps server error — try again shortly.";
      }
      return "Could not save.";
  }
}

/**
 * Translate a save() rejection into the same status discriminators used by
 * the comment leg (HTTP-driven). Best-effort heuristic: the SDK rejects
 * with Error subclasses whose .name and .message vary by ADO host build.
 * Test cases planner must cover (vitest):
 *   - Error with name === "RuleValidationException" → 412
 *   - Error with message containing "permission" or "denied" → 403
 *   - Error with message containing "not found" or "deleted" → 404
 *   - Anything else → null (generic fallback "Could not save.")
 */
export function mapSdkErrorToStatus(
  err: unknown,
): { status: number | null; sdkErrorClass?: string } {
  if (err instanceof Error) {
    const name = err.name;
    const msg = err.message ?? "";
    if (name === "RuleValidationException") return { status: 412, sdkErrorClass: name };
    if (/permission|denied|forbidden|stakeholder|read[\s-]?only/i.test(msg)) {
      return { status: 403, sdkErrorClass: name };
    }
    if (/not found|deleted/i.test(msg)) return { status: 404, sdkErrorClass: name };
    return { status: null, sdkErrorClass: name };
  }
  return { status: null };
}
```
Source: synthesized from CONTEXT D-11, D-20; the heuristic is `[ASSUMED]` because the exact `IWorkItemFormService.save()` rejection class names are not documented at Microsoft Learn — empirical test required during Phase 4 cezari verification (force a 412 via D-17 scenario 4, log the rejection's `.name` and `.message`, then refine the regex).

### Anti-Patterns to Avoid

- **Anti-pattern 1: Programmatic dialog close attempts.** Do NOT call `SDK.notifyDialogResult`, `SDK.notifyDismiss`, `host.closeDialog`, or any similar imagined method. None exist in the modern SDK (verified). Replace D-10 "modal closes" with "Saved ✓ + persistent Esc-to-close hint."
- **Anti-pattern 2: Calling `WorkItemTrackingRestClient.addComment(...)` via `getClient`.** It doesn't exist on the typed client (verified). Even if it did, the SDK REST client hangs in the dialog iframe (Phase 03-04 Override 4).
- **Anti-pattern 3: Auto-retry on 429 with exponential backoff.** D-11 surfaces the throttle message; user retries manually. Auto-retry is deferred per CONTEXT.
- **Anti-pattern 4: Posting the comment via `formService.setFieldValue("System.History", text)`.** This is the legacy comment path, deprecated since 2018 and round-trip behavior differs from modern Comments API (no sentinel preservation guarantees). Use the REST POST per APPLY-06.
- **Anti-pattern 5: Eager `isReadOnly()` probe assuming the form-service method exists.** Per Finding 1, the method does not exist. The plan must spike alternatives or fall back to lazy detection via the actual write's error codes.
- **Anti-pattern 6: Storing apply state in module-level variables in `src/apply/apply.ts`.** Multiple Apply attempts in the same iframe lifetime are normal (D-09 Retry path). Keep state in the orchestrator (`CalcModal.tsx` `mode` state machine).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Auth token acquisition for ADO REST | Custom token cache / refresh logic | `SDK.getAccessToken()` per call (Phase 03-04 verified pattern) | The SDK handles token lifecycle and refresh; tokens are short-lived but `getAccessToken()` is idempotent and fast |
| Base URL construction for cloud vs. on-prem | Hardcoded `dev.azure.com` URLs | `SDK.getHost()` discriminator (`host.isHosted` for cloud, fallback for ADO Server) | Phase 03-04's `comments.ts` already implements this correctly; copy the pattern into `adoFetch.ts` |
| Status-code → user-message mapping | One ad-hoc map per call site | Single `errorMessages.ts` pure module, vitest-tested | Eight failure modes (D-11) used by both legs; one source of truth |
| Audit-comment payload serialization | New JSON.stringify in postComment.ts | `serialize(payload)` from `src/audit/index.ts` (Phase 1) | Already produces the canonical sentinel format; AUDIT-02 deterministic key order; round-trip with parser already proven |
| Confirm-dialog UI primitive | Custom modal-in-modal | `ConfirmOverwritePanel.tsx` (replaces calc body in same dialog) | UI-SPEC §View-State Machine commits to in-modal panel; nested host dialogs are unsupported and visually awkward |
| In-flight write progress UI | Custom loading state | `Spinner` from `azure-devops-ui` (sizes xSmall/small/medium/large per `Spinner.Props.d.ts`) + saving overlay div | Theme-aware, ARIA-correct, matches Phase 3 read-path spinner |
| Error banner with action button | Custom banner component | `MessageCard` with `buttonProps?: IButtonProps[]` (verified `MessageCard.Props.d.ts:15`) — embedded Retry button per CONTEXT D-08 / D-09 | Library-native, theme-aware, accessibility correct |
| API version constant | Stringly typed at every call site | Pass as `apiVersion` parameter to `adoFetch`; document `ADO_API_VERSIONS = { addComment: "7.0-preview.3", getComments: "7.1-preview.4" }` constants near callers | Single change point if API versions need to bump together |
| ApplyError class hierarchy | New typed Error subclass with `instanceof` checks | Plain object with `satisfies ApplyError` — discriminated by `leg` and `status` | TypeScript discriminated unions handle this without an Error subclass; serializes through console.log cleanly |
| Setting `lightDismiss: false` at runtime | Dialog-iframe SDK call to mutate options mid-flight | Set `lightDismiss: false` in `toolbar.tsx`'s `openCustomDialog` call (CONTEXT D-15) | The option is locked at dialog-open time; cannot be toggled at runtime by the dialog iframe |

**Key insight:** Almost everything in Phase 4 is composition of existing primitives (Phase 1 calc/audit pure modules, Phase 3 bridge/Dropdown3/banners/CalcPanel, `azure-devops-ui` MessageCard/Spinner/Button/ButtonGroup). The only genuine new pure-logic surface is `errorMessages.ts` and `adoFetch.ts`. Everything else is React state-machine + UI composition.

## Common Pitfalls

### Pitfall 1: Assuming `IWorkItemFormService.isReadOnly()` exists as a method (CRITICAL — Finding 1)

**What goes wrong:** CONTEXT D-05 / D-07 specify "`IWorkItemFormService.isReadOnly()` probe in the read-path effect." The implementation will fail to typecheck (no such method) OR silently typecheck with `// @ts-ignore` and reject at runtime with `TypeError: formService.isReadOnly is not a function`.
**Why it happens:** Confusion between `IWorkItemLoadedArgs.isReadOnly` (a property delivered to a notification listener that the dialog iframe cannot register) and a hypothetical form-service method.
**How to avoid:**
1. Plan task 1: empirical spike to find a working permission-detection path. Candidates to test on cezari:
   - Does `formService.getFieldValue("System.AuthorizedAs")` work and is the value useful?
   - Does `setFieldValue("Microsoft.VSTS.Scheduling.StoryPoints", currentValue)` (a no-op write) return `false` for read-only fields without triggering side effects?
   - Does `SDK.getUser()` plus a license-check heuristic suffice for Stakeholder detection?
2. Lazy fallback (always available): treat 403 from `setFieldValue + .save()` as the read-only signal; show D-11 403 copy.
3. If no eager probe is reliable: re-spec D-05 / D-06 / D-07 to "lazy detection only" — the calculator opens fully usable; Apply triggers the actual write; permission errors map to a 403 banner with the same copy as D-06.
**Warning signs:** TypeScript errors on `formService.isReadOnly`; runtime TypeError; the read-path effect rejecting silently.

### Pitfall 2: `format: 1` body field unrecognized OR sanitized differently (CRITICAL — Finding 2)

**What goes wrong:** Posting `{ text: "<!-- ...->", format: 1 }` may (a) be silently ignored by the API (default Markdown applied; sentinel HTML-encoded as Phase 03-04 already documented), (b) be honored and preserve the sentinel raw (D-01 happy path), (c) cause a 400 with "unknown field," or (d) preserve the sentinel BUT cause the renderer to display the raw `<!-- -->` markup (current Phase 03-04 behavior — exactly the visible-sentinel UX problem D-01 is meant to solve).
**Why it happens:** Microsoft Learn 2026-04 documents `CommentCreate { text: string }` with NO `format` field on either 7.0-preview.3 or 7.1-preview.4. The SDK's `CommentFormat` enum exists but Microsoft's REST docs don't mention it as a request input.
**How to avoid:**
1. **D-02 spike must be plan task 1 (before any other Phase 4 code lands).** Post a sentinel via direct fetch on cezari with `{ text, format: 1 }`, then post a second one with `{ text }` only. Inspect:
   - Network response: 200 in both cases?
   - GET response body: `text` field's value — sentinel raw, entity-encoded, or stripped?
   - Comment renderer in cezari Discussion: `<!-- -->` markup visible or hidden?
2. If `format: 1` does NOT preserve raw `<!-- -->` in the renderer: route to D-02 fallback — invisible-div carrier `<div data-sp-calc="v1" hidden>{...JSON...}</div>`. Update parser regex (Phase 1 audit/parse.ts) to match the new shape, keeping the existing sentinel-comment regex as a parallel match for backward compat with comments posted before the fallback.
3. Document the spike result in `04-VERIFICATION.md` Real-world Corrections section verbatim (per Phase 03-04 pattern).
**Warning signs:** Cezari renders `<!-- sp-calc:v1 ... -->` as visible text in the Discussion view; round-trip parse from comments returns null; PreFillBanner doesn't render after Apply.

### Pitfall 3: Programmatic close not possible — D-10 "modal closes" must change (CRITICAL — Finding 3)

**What goes wrong:** Phase 4 implementation calls `SDK.notifyDialogResult(...)` or similar; it doesn't exist; the modal stays open after success; the user is confused why "Saved ✓" sits there indefinitely.
**Why it happens:** The modern `azure-devops-extension-sdk` v4 has no programmatic close API. Microsoft Learn 2026-04 explicitly states: "The dialog content page can't directly communicate back to the host except through the `onClose` result." The `onClose` callback fires when the host closes the dialog — the iframe cannot invoke it.
**How to avoid:**
1. Re-spec D-10's "modal closes" to "Saved ✓ + persistent Esc-to-close hint."
2. Replace ButtonGroup with the `SavedIndicator` component that renders `Saved ✓` + `Press Esc to close.` (mirror Phase 3 D-19 NoFieldMessage's hint pattern).
3. The 200ms timer can be retained for visual fidelity (briefly shows the success indicator before transitioning to the persistent state) but does NOT trigger any close.
4. The work item form's SP field already shows the new value — the user dismisses the dialog at their leisure, no UX harm.
**Warning signs:** "Why doesn't the modal close after Apply?" in cezari verification (the right answer: it can't, by design of the platform).

### Pitfall 4: Forgetting to set `lightDismiss: false` at openCustomDialog time

**What goes wrong:** D-15 wants to block close affordances during the saving window. If the toolbar action opens with the default `lightDismiss: true` (verified default per `IDialogOptions.lightDismiss?: boolean` in `CommonServices.d.ts:200`), an outside click during the in-flight write closes the dialog mid-fetch; the request continues server-side; the user reopens and may see partial state.
**Why it happens:** `lightDismiss` cannot be toggled at runtime by the dialog iframe (no such API). The toolbar.tsx invocation locks it at open time.
**How to avoid:** Modify `src/entries/toolbar.tsx`'s `openCustomDialog` call from `lightDismiss: true` (current Phase 2 default) to `lightDismiss: false`. Keep `onClose` callback for dialog-closed logging.
**Warning signs:** D-17 scenario 7 (saving overlay) — outside-click dismisses the dialog mid-write; the request still completes server-side; comment-only orphans appear in cezari Discussion.

### Pitfall 5: Comment retry posts duplicate comments (per Phase 0 D-03)

**What goes wrong:** D-08 Retry re-runs the comment POST. If the Phase 03-04 entity-decode parser is correct, multiple sentinels on the same work item are handled fine (parser sorts by createdDate, takes the most recent — AUDIT-05). But if a future parser regression causes "first-found wins" instead of "most-recent wins," a retry post would not change pre-fill behavior on next reopen.
**Why it happens:** Phase 0 D-03 explicitly accepts duplicate comments on retry as an audit feature.
**How to avoid:**
1. The vitest test suite for `parseLatest` (Phase 1, AUDIT-05) already covers this: "When multiple sentinel comments exist on a work item, parser returns the most recent one (by comment `createdDate`)." Phase 4 plan must ensure no Phase 4 task touches `parseLatest` ordering.
2. Visual evidence in cezari: D-17 scenario 3 explicitly verifies that after a Comment POST failure + Retry, only ONE sentinel pre-fills; if multiple sentinels appear in cezari Discussion (intentional per D-03), the most recent wins.

### Pitfall 6: `setFieldValue` returns `Promise<boolean>`, not `Promise<void>`

**What goes wrong:** Code awaits `formService.setFieldValue(...)` and treats it as success; in fact a return value of `false` indicates the SDK rejected the write (often due to validation rules). Subsequent `.save()` then throws a less informative error.
**Why it happens:** The signature `setFieldValue(fieldReferenceName: string, value: Object): Promise<boolean>` is verified at `WorkItemTrackingServices.d.ts:129`. PITFALLS Pitfall 4 explicitly warns about this. `[VERIFIED]`.
**How to avoid:** Always check the boolean result before calling `.save()`:
```typescript
const ok = await formService.setFieldValue(input.fieldRefName, calcResult.sp);
if (!ok) {
  const invalid = await formService.getInvalidFields().catch(() => []);
  throw {
    leg: "field",
    status: 412,  // map "rule validation rejected setFieldValue" to 412 bucket
    message: invalid.length > 0
      ? `${friendlyMessageForStatus(412)} (${invalid.map(f => f.referenceName).join(", ")})`
      : friendlyMessageForStatus(412),
  } satisfies ApplyError;
}
await formService.save();
```
**Warning signs:** Field write appears to succeed in console but the form's SP cell stays unchanged; subsequent `.save()` throws "field is in invalid state"; QA reports "Apply did nothing for me."

### Pitfall 7: Saving overlay's `pointer-events: none` allows tab focus to leak

**What goes wrong:** UI-SPEC §Saving Overlay specifies `pointer-events: none` on the underlying body. CSS `pointer-events: none` blocks mouse but does NOT block keyboard tab navigation — tab still visits dropdowns/calc-panel children, allowing the user to change selections during the in-flight write. After Confirm Apply, the user could Tab → Up arrow → change Complexity → and now if Retry runs the comment POST with the SAME payload (D-08 specifies "same payload"), the on-screen dropdowns lie about what was just posted.
**Why it happens:** Visual disabling != keyboard disabling.
**How to avoid:**
1. Set `aria-busy="true"` on the body region per UI-SPEC.
2. Add `aria-hidden="true"` on the body container during `mode === "saving"` so screen readers + tab navigation skip it.
3. OR: render the Dropdown3 components with `disabled={mode === "saving"}` (additional guard — they already accept a disabled prop per Phase 3).
4. The orchestrator MUST keep the Apply payload immutable from the moment Confirm Apply is clicked — do NOT recompute from `c, u, e` state inside the apply.ts body; capture the Level trio at the moment of click and pass into `applyToWorkItem` (already correct per Pattern 3 above).
**Warning signs:** Tab key lands on a dropdown during D-17 scenario 7; D-08 Retry payload differs from initial Comment POST payload (visible in DevTools Network tab).

### Pitfall 8: Sticky pre-fill banner after Apply (D-16 + D-10 interaction)

**What goes wrong:** After successful Apply, the user reopens the modal — pre-fill banner reads "Pre-filled from your last calculation on May 2, 2026." (D-16 happy path). But if the banner's date computation falls back to `new Date().toISOString()` when `comments.filter(...).length === 0` (current `CalcModal.tsx:301-307`), and the just-posted comment is briefly missing from the GET response (eventual consistency), the banner reads "today" with no underlying sentinel.
**Why it happens:** ADO Comments storage is eventually consistent across the few seconds between POST 200 and GET reflecting the new comment.
**How to avoid:**
1. Phase 4 plan should NOT change the existing pre-fill banner logic — D-16 confirms unchanged behavior.
2. If eventual-consistency surfaces during cezari verification (D-17 scenario 1: reopen modal immediately after Apply, observe Pre-fill banner state), document as a known minor in `04-VERIFICATION.md`. The behavior is mostly invisible because the freshly-posted comment is the most recent and parseLatest still returns the correct payload.
3. No active mitigation needed — the parser-takes-most-recent invariant means a stale GET still returns the user's prior calculation, which is also correct (matches current SP since we just wrote both).
**Warning signs:** Pre-fill banner missing on rapid reopen after Apply; pre-fill data different from just-applied trio. Out-of-scope for Phase 4 plan but should be logged.

## Code Examples

### Direct-fetch URL construction (Override 4 codified)

```typescript
// Source: Phase 03-04 src/ado/comments.ts (verified empirically on cezari)
const host = SDK.getHost();
const token = await SDK.getAccessToken();
const baseUrl = host.isHosted
  ? `https://dev.azure.com/${host.name}`
  : `https://${host.name}.visualstudio.com`;
const url = `${baseUrl}/${encodeURIComponent(projectId)}/_apis/wit/workItems/${workItemId}/comments?api-version=${apiVersion}`;
const response = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ text, format: 1 /* CommentFormat.Html — D-01 */ }),
});
```
Source: `src/ado/comments.ts:55-80`, Phase 03-04 cezari console log evidence.

### IWorkItemFormService write sequence

```typescript
// Source: WorkItemTrackingServices.d.ts:129 (setFieldValue) + :181 (save) + Phase 0 D-01.
const ok = await formService.setFieldValue("Microsoft.VSTS.Scheduling.StoryPoints", 5);
if (!ok) {
  const invalid = await formService.getInvalidFields();
  console.warn("setFieldValue rejected; invalid fields:", invalid.map(f => f.referenceName));
  // → 412 bucket per D-20
  return;
}
await formService.save();  // Promise<void>; rejects on rule violations / network / save errors
```
Source: verified type signatures + PITFALLS Pitfall 4.

### Status-code map test (vitest table-driven)

```typescript
// Source: CONTEXT D-11, D-18; project standard "manual QA does UI testing; only formula logic is unit-tested."
import { describe, it, expect } from "vitest";
import { friendlyMessageForStatus } from "../../src/apply/errorMessages";

describe("friendlyMessageForStatus", () => {
  it.each([
    [401, "Sign in expired. Reload the page and try again."],
    [403, "You don't have permission to change this item."],
    [404, "Work item not found — it may have been deleted."],
    [409, "Conflict — please reload the work item and try again."],
    [412, "Work item changed since the modal opened — reload and try again."],
    [429, "Azure DevOps is throttling requests — wait a moment and retry."],
    [500, "Azure DevOps server error — try again shortly."],
    [502, "Azure DevOps server error — try again shortly."],
    [503, "Azure DevOps server error — try again shortly."],
    [418, "Could not save."],   // unknown code → generic fallback
    [null, "Could not save."],  // SDK error with no HTTP status
  ])("status %s → %s", (status, expected) => {
    expect(friendlyMessageForStatus(status)).toBe(expected);
  });
});
```
Source: synthesized from CONTEXT D-11 D-18.

### `lightDismiss: false` at openCustomDialog (Phase 4 toolbar.tsx amendment)

```typescript
// Source: src/entries/toolbar.tsx — Phase 4 amendment per CONTEXT D-15.
// Was: lightDismiss: true (Phase 2 default).
// Now: false to harden the saving window against outside-click dismiss.
layoutSvc.openCustomDialog<undefined>(fullModalId, {
  title: "Calculate Story Points",
  configuration: config,
  lightDismiss: false,    // CHANGED — D-15: block outside-click during in-flight saves
  onClose: () => {
    console.log(`${LOG_PREFIX} dialog closed`);
  },
});
```
Source: `IDialogOptions.lightDismiss?: boolean` verified at `node_modules/azure-devops-extension-api/Common/CommonServices.d.ts:200`; CONTEXT D-15.

## Runtime State Inventory

> Phase 4 is a pure-code phase (no rename, no refactor across stored data). Only relevant runtime state: the in-iframe React state machine (CalcModal.tsx mode union) which is volatile and resets on every dialog open. No external runtime state to inventory.

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | None — Phase 4 does not migrate any persisted data; the audit-comment payload format is unchanged from Phase 1 | None |
| Live service config | None — the manifest's `vso.work_write` scope and contribution shape are unchanged from Phase 0 / Phase 2 | None |
| OS-registered state | None — Phase 4 has no OS-level integration | None |
| Secrets/env vars | `.env.local` Marketplace publisher PAT (Phase 2 dev-publish) — unchanged; Phase 4 reuses for cezari verification publishes | None — verified intact in scripts/dev-publish.cjs |
| Build artifacts | `dist/toolbar.html`, `dist/modal.html`, `dist/modal.js` rebuild on every `npm run build`; no cached artifacts to invalidate | None — webpack handles |

**Verified by:** Phase 4 is a feature-add phase, not a rename/refactor/migration. The Runtime State Inventory question "after every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?" does not apply — there is no old string being changed.

## Common Pitfalls Reference (already covered above)

See `## Common Pitfalls` section for the eight Phase-4-specific pitfalls. These extend (do not replace) the foundational pitfalls in `.planning/research/PITFALLS.md` (especially Pitfalls 1, 4, 10, 12, 14 which Phase 4 actively guards against).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `getClient(WorkItemTrackingRestClient).addComment(...)` (typed SDK client) | Direct fetch via `adoFetch` helper | Phase 03-04 (Override 4, this codebase) | Phase 4 codifies via shared `adoFetch.ts`; eliminates location-service hang |
| Comments REST `7.0-preview.3` | Microsoft documents both 7.0-preview.3 and 7.1-preview.4 as current; SDK type definitions reference both | Microsoft Learn 2026-04 | Phase 4 plan picks per CONTEXT D-13 (7.0-preview.3) — both work; recommend planner verify either still valid in cezari spike |
| Hardcoded `IWorkItemFormService.isReadOnly()` assumption | **No such method exists; permission detection is empirical** | Verified 2026-05-02 against `WorkItemTrackingServices.d.ts` | Plan must spike alternatives or fall back to lazy detection |
| `SDK.notifyDialogResult` programmatic close (legacy `vss-web-extension-sdk` pattern) | **No such API in modern SDK; iframe cannot close itself** | `azure-devops-extension-sdk` v4 (current 4.2.0) | D-10 must change from "modal closes" to "Saved ✓ + Esc-hint" |
| `WorkItemTrackingClient.addCommentDirect(...)` or similar non-typed escape hatch | The typed client doesn't expose addComment AT ALL | Verified `WorkItemTrackingClient.d.ts` lines 117–133 (only `getComment` and `getComments`) | Direct fetch is mandatory |
| Custom `isReadOnly` heuristic | Can be lazy-detected via 403 from setFieldValue / save() — same status discriminator the D-11 map already handles | Phase 4 plan synthesis | Lazy fallback is architecturally clean and removes a runtime probe |

**Deprecated/outdated:**
- The legacy comment write path via `formService.setFieldValue("System.History", text)` — was deprecated in 2018 with the introduction of the modern Comments API; Phase 4 must NOT use it.
- The legacy `vss-web-extension-sdk` `getDialogResult/okCallback` pattern — only available in the AMD-based SDK; modern v4 has no equivalent.

## Assumptions Log

> Claims tagged `[ASSUMED]` in this research require empirical confirmation before becoming locked decisions. Plan task 1 (the D-02 spike) MUST resolve A1, A2, A3, A4 before subsequent plan tasks lock implementation files.

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `format: 1` body field is honored by the addComment endpoint and preserves raw `<!-- -->` HTML comments end-to-end (storage + renderer) | D-01, Pattern 2 (postComment.ts), Pitfall 2 | Visible-sentinel UX problem persists; Phase 03-04's HTML-encoding behavior continues; pre-fill works (parser already handles entity-encoded form) but D-01's UX goal is unmet → fall back to invisible-div carrier (D-02) |
| A2 | The actual `IWorkItemFormService.save()` rejection class names match the heuristic in `mapSdkErrorToStatus` (RuleValidationException → 412; "permission/denied" → 403; etc.) | Pattern 4 (errorMessages.ts), D-20, Validation Architecture | D-09 banner copy is generic ("Could not save.") instead of specific; user has less actionable information; not a blocker, just a triage degradation |
| A3 | A working `isReadOnly` detection path exists from the dialog iframe (form-service method, license heuristic, or lazy via 403) | D-05, D-06, D-07, Finding 1, Pitfall 1 | If no eager probe is reliable: the read-only branch (D-06 — REPLACE the calculator with a message) cannot be implemented at modal open. Lazy fallback works (calculator opens fully usable; Apply triggers 403 banner) but contradicts D-06 UX. APPLY-09 wording rewrite must reflect whichever path the spike validates |
| A4 | The modern dialog cannot programmatically close (Finding 3) — verified by SDK.d.ts inspection + Microsoft Learn 2026-04 quote | D-10, Pitfall 3 | The "Saved ✓ + persistent Esc-to-close hint" UX is visible to the user as a slight workflow inefficiency vs. an auto-closing dialog; ROADMAP success criterion 5 still met because setFieldValue + .save() updates the form's SP value live |
| A5 | The 7.0-preview.3 endpoint (CONTEXT D-13) is still active and not deprecated as of 2026-05-02 | D-13, APPLY-06 | If 7.0-preview.3 is removed, addComment 4xx; switch to 7.1-preview.4 (already used by Phase 03-04 read path). Low risk — Microsoft Learn 2026-04 docs both versions. |
| A6 | `vso.work_write` scope covers BOTH addComment POST AND setFieldValue + .save() | implicit in CONTEXT D-13, APPLY-06, APPLY-07 | If scopes diverged: cezari Apply fails with 401/403; planner must either add scope (forcing re-consent across installs per PITFALLS Pitfall 3) or split. Verified: Microsoft Learn 2026-04 Comments - Add 7.0-preview.3 scope row says "vso.work_write — Grants the ability to read, create, and update work items and queries… [comments and] receive notifications about work item events"; setFieldValue is on the open form and uses the SDK's session, not REST — same scope sufficiency |
| A7 | The cezari Discussion view in the work item form actually HIDES `<!-- -->` HTML comments when posted via format=1 | Pitfall 2, Validation Architecture | Visible-sentinel UX still broken despite format=1; fall back to invisible-div carrier; D-02 spike resolves |

## Open Questions

1. **Which api-version to use for addComment? 7.0-preview.3 (CONTEXT D-13) or 7.1-preview.4 (read path's already-used version)?**
   - What we know: both are documented at Microsoft Learn 2026-04; both accept `vso.work_write`; both have identical request body schemas; the read path (Phase 03-04) already uses 7.1-preview.4.
   - What's unclear: whether the `format` body field is accepted by either or only one.
   - Recommendation: D-02 spike posts to BOTH versions to compare behavior; pick the one that preserves the sentinel cleanly. Default to CONTEXT D-13 (7.0-preview.3) unless spike contradicts.

2. **What does `IWorkItemFormService.save()` actually throw on permission failure?**
   - What we know: signature is `save(): Promise<void>`; "rejected if it fails" per JSDoc; PITFALLS mentions `RuleValidationException`.
   - What's unclear: the exact `Error.name` string at runtime; whether 403/permission is wrapped as a specific class or surfaces as a plain Error with a message string.
   - Recommendation: D-17 scenario 4 (force a 412) and scenario 5 (Stakeholder license) BOTH log the rejection's `.name` and `.message` to console; refine `mapSdkErrorToStatus` regex with empirical evidence.

3. **Does `getDirtyFields` or `getInvalidFields` give actionable diagnostic info on field-write failure?**
   - What we know: both methods exist (`WorkItemTrackingServices.d.ts:195, 202`).
   - What's unclear: whether their results include the SP field's reference name when SP rejection blocks save.
   - Recommendation: log `getInvalidFields()` output in D-17 scenario 4; if useful, surface in the D-09 fail banner copy alongside the friendly message.

4. **Will the cezari work item form auto-refresh after `setFieldValue + .save()` so the user sees the new SP value, or is a manual refresh needed?**
   - What we know: PROJECT.md Key Decisions row "use IWorkItemFormService.setFieldValue() + .save() (not REST PATCH)" reasoning includes "REST PATCH while form is open causes revision conflicts and silent overwrites" — implying the form-service path is integrated.
   - What's unclear: empirical confirmation on cezari that the SP cell in the work item form re-renders without page reload (ROADMAP criterion 5).
   - Recommendation: D-17 scenario 1 explicitly verifies this — Network tab clean, SP field visible-updates without F5.

5. **What happens if the work item form is dirty (user typed in Description) when our modal calls `.save()`?**
   - What we know: PITFALLS Pitfall 4 / 15 warns that `.save()` saves ALL dirty fields, not just our SP — which is potentially surprising.
   - What's unclear: whether cezari auto-saves combined edits cleanly or shows a save-conflict dialog.
   - Recommendation: D-17 should add an optional scenario 9: open work item form, type in Description (without saving), open modal, Apply — verify both SP and Description persist together. If problematic, surface a "Form has unsaved changes" warning in confirm panel (PITFALLS Pitfall 15 mitigation). Defer to Phase 5 if behavior is acceptable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| `cezari.visualstudio.com/Cezari` (dev ADO org) | D-17 manual verification + D-02 spike | ✓ | Scrum process | None — required for cezari verification |
| `tfx-cli` (Marketplace publish) | dev-publish wrapper for cezari verification | ✓ | 0.23.1 (pinned) | Direct `npx tfx extension publish --override` per Phase 03-04 Issues Discovered |
| `node` runtime | Build / vitest | ✓ | >=20.10.0 (engines) | None |
| `npm` | Install / scripts | ✓ | >=10.0.0 (engines) | None |
| Marketplace publisher PAT | dev-publish wrapper | ✓ | `.env.local` (Phase 0) | None |
| Browser DevTools (Chrome/Edge) | D-17 scenario 7 (slow-network throttle), comment Network inspection, console logs | ✓ | n/a | None — required for verification |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `dev-publish.cjs` Windows retry path (Phase 03-04 known issue) — fall back to direct `npx tfx extension publish --override` invocation per documented workaround.

## Validation Architecture

> `nyquist_validation` is currently `false` in `.planning/config.json`, so the workflow does not auto-derive a VALIDATION.md. This section provides Dimension-8 material for the planner anyway, per project standard ("manual QA covers UI; only formula logic is unit-tested" — `CLAUDE.md`).

### Test Framework

| Property | Value |
|---|---|
| Framework | `vitest@^2.1.0` (already pinned) |
| Config file | `vitest.config.ts` (Phase 1) |
| Quick run command | `npm test -- tests/apply` (per-module subset) or `npm test -- --run --reporter=verbose <path>` |
| Full suite command | `npm test` (runs vitest with coverage thresholds enforced on `src/calc/**` + `src/audit/**`) |

**Phase 4 vitest.config.ts amendment:** Add `src/apply/**` and `src/ado/**` (excluding postMessage-dependent code paths — bridge.ts wrappers + comments.ts which is empirically verified, not unit-tested) to coverage `include`. Recommended threshold: 90% lines/branches on `src/apply/errorMessages.ts` (pure module — easily 100%); 80% on `src/ado/adoFetch.ts` (pure URL/header construction — fetch is mocked).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| APPLY-04 | Confirm panel renders when current SP is non-null | manual (UI) | `04-VERIFICATION.md` D-17 scenario 2 | ❌ Wave 0 (cezari) |
| APPLY-05 | setFieldValue + .save() writes new SP | manual (UI) + integration unit | `04-VERIFICATION.md` D-17 scenario 1; `tests/apply/apply.test.ts` mocks form service | ❌ Wave 0 |
| APPLY-06 | addComment via direct fetch (api-version per CONTEXT D-13) | unit (URL+payload) + manual (round-trip) | `tests/ado/postComment.test.ts` (URL, body shape, sentinel content); D-17 scenario 1 (network tab) | ❌ Wave 0 |
| APPLY-07 | Atomicity ordering: comment-first → field-write | unit (orchestrator order) | `tests/apply/apply.test.ts` — assert mock comment POST resolves BEFORE setFieldValue is called | ❌ Wave 0 |
| APPLY-08 | Status-code-specific error banners; comment-fail vs field-fail UX | unit (mapper) + manual (banner copy) | `tests/apply/errorMessages.test.ts` (8 D-11 buckets); D-17 scenarios 3, 4 | ❌ Wave 0 |
| APPLY-09 | Read-only branch replaces calculator UI | manual (UI) — wording rewrite first | `04-VERIFICATION.md` D-17 scenario 5 (Stakeholder license) + scenario 6 (probe-fail warning); REQUIREMENTS.md APPLY-09 rewrite per D-06 | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- <subset path>` (e.g., `npm test -- tests/apply` for an apply.ts task)
- **Per wave merge:** `npm test` (full suite + coverage thresholds — Phase 1 `src/calc/**` + `src/audit/**` 100% must remain green)
- **Phase gate:** Full suite green before `04-VERIFICATION.md` D-17 manual run begins on cezari

### Wave 0 Gaps

- [ ] `tests/apply/apply.test.ts` — orchestrator integration test (mocks `adoFetch` + `IWorkItemFormService`; covers atomicity ordering APPLY-07, both leg failure paths APPLY-08, success path APPLY-05)
- [ ] `tests/apply/errorMessages.test.ts` — 8-row table-driven test for `friendlyMessageForStatus` + 4-row table-driven test for `mapSdkErrorToStatus`
- [ ] `tests/ado/adoFetch.test.ts` — URL construction (cloud + on-prem branches), api-version query encoding, projectId encoding (verifies `encodeURIComponent`), POST body JSON.stringify, error throwing on `!response.ok` with status attached to thrown Error
- [ ] `tests/ado/postComment.test.ts` — payload shape (text content matches `serialize()` output, format=1, api-version=7.0-preview.3 per D-13 OR 7.1-preview.4 if D-02 spike picks)
- [ ] `tests/conftest.ts` — shared fixtures? Vitest setup file? Recommended: use `vi.mock("azure-devops-extension-sdk", ...)` per-test-file rather than a global mock; SDK surface is small and explicit mocking per test reads cleaner. No conftest equivalent needed.
- [ ] Framework install: NONE — vitest already pinned at `^2.1.0`.
- [ ] `vitest.config.ts` amendment: add `src/apply/**` + `src/ado/**` (with appropriate excludes for SDK-bound code) to `coverage.include`. Optional thresholds.

### Manual cezari verification (D-17 scenarios 1–8)

> Manual QA per project standard. Lives in `04-VERIFICATION.md` (created by Phase 4 plan). Mirrors Phase 3 D-29 12-item checklist pattern.

| Scenario | Validates | Estimate |
|---|---|---|
| 1 — Happy path, no current SP | APPLY-05, APPLY-06, APPLY-07, ROADMAP criterion 5 (form auto-refreshes), D-01 sentinel hidden in renderer (D-02 spike) | 5 min |
| 2 — Overwrite confirm path | APPLY-04, D-03 panel layout, D-04 trigger threshold, Back-preserves-selections | 5 min |
| 3 — Comment POST failure + Retry | APPLY-08 comment leg, D-08 banner + Retry, no field-write attempted | 8 min (force 404 by URL mangle) |
| 4 — Field-write 412 (RuleValidationException) | APPLY-08 field leg, D-09 persistent banner, Retry-field-only, D-20 SDK error class mapper | 10 min (manually edit form mid-modal) |
| 5 — Stakeholder/read-only | APPLY-09, D-06 read-only branch, REQUIREMENTS.md rewrite verification | 10 min (license-switch on cezari) |
| 6 — isReadOnly probe failure | D-07 warning banner, fallback to lazy detection | 5 min (synthetic — depends on Finding 1 spike resolution) |
| 7 — Saving overlay (slow network) | D-15 overlay, disabled buttons, lightDismiss:false hardening | 5 min (DevTools Slow 3G throttle) |
| 8 — HTML-format sentinel preservation | D-01 / D-02 — rendered Discussion view, GET response body, parser correctness on reopen | 10 min (THIS IS THE CRITICAL D-02 EVIDENCE — must run BEFORE locking sentinel format) |

**Total estimate:** ~60 min on cezari (matches Phase 03-04 verification cadence).

### Spike Plan Task (recommended Plan 04-01)

**Plan 04-01: Sentinel + permission + close-mechanism spike on cezari (BEFORE any production code).**

Tasks:
1. **D-02 sentinel spike** — post sentinel via direct fetch with `format: 1` body and without; inspect:
   - Rendered Discussion view: is `<!-- -->` visible or hidden?
   - GET response body `text` field: raw / entity-encoded / different?
   - Parser correctness: does `parseLatest` extract the payload?
2. **D-05/D-07 permission spike** — probe what's reachable from the dialog iframe:
   - Does `formService.isReadOnly` exist as a method? (Expected NO per Finding 1.)
   - Does `formService.getFieldValue("System.AuthorizedAs")` work?
   - Does a no-op `setFieldValue(currentValue)` return false on read-only fields without side effects?
   - Does `SDK.getUser()` + license heuristic suffice? Need Stakeholder cezari user.
3. **D-10 close-mechanism spike** — confirm Finding 3 empirically:
   - Does `SDK.notifyDialogResult(...)` exist? (Expected NO per node_modules .d.ts.)
   - Does any other method close the dialog? Try `SDK.notifyLoadFailed`, `SDK.resize(0,0)` (cheeky), etc.
   - Confirm "Saved ✓ + Esc-hint" is the only path.
4. **Document spike findings in `04-VERIFICATION.md` Real-world Corrections section** (per Phase 03-04 pattern).
5. **Update CONTEXT D-01, D-05, D-10 if spike contradicts.**

Plan 04-02..04-N then implement based on the spike's resolved findings.

## Security Domain

> `security_enforcement` is implicitly enabled (no explicit `false` in config.json).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | Yes (token-based) | `SDK.getAccessToken()` — short-lived bearer token from host; no PAT in code; standard ADO OAuth flow |
| V3 Session Management | No — extension has no session of its own; piggybacks on host session | n/a |
| V4 Access Control | Yes — relies on `vso.work_write` scope (Phase 0 manifest lock) | Manifest scopes; pre-flight permission detection (Pitfall 1 / D-05–D-07) |
| V5 Input Validation | Yes — Level enums + AuditPayload schema | Phase 1 already validates: parse rejects malformed JSON (AUDIT-04); Phase 4 reuses unchanged |
| V6 Cryptography | No — no crypto in extension; all wire encryption handled by HTTPS / ADO host | n/a |

### Known Threat Patterns for {React + ADO extension iframe + REST POST}

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Token leakage via console.log | Information Disclosure | The Phase 3 logs `len=${token.length}` only, not the token itself (verified `src/ado/comments.ts:61`). Phase 4 plan must NOT log the bearer token; copy the same pattern in `adoFetch.ts`. |
| Comment payload XSS via crafted Level label | Tampering | Phase 1 LEVELS const is frozen union (`"Very Easy" | "Easy" | "Medium" | "Hard" | "Very Hard"`) — cannot inject script via Level type. AUDIT-02 deterministic JSON.stringify uses default JSON.stringify, which escapes special chars. Sentinel payload is sanitized end-to-end. |
| Open redirect via `host.openNewWindow` | Spoofing | Not used in Phase 4 — extension does not navigate or open external URLs. |
| Eval/Function on comment payload during pre-fill parse | Tampering | Phase 1 parser uses `JSON.parse` only (verified AUDIT-04). Phase 4 does not change parser. |
| Storage leak via localStorage | Information Disclosure | Not used — extension does not write localStorage (verified — Phase 3 read path stores nothing locally). |
| Cross-tenant token misuse | Spoofing | `SDK.getAccessToken()` returns a host-scoped token tied to the current ADO org; cannot be used cross-tenant. |
| 429 retry storm DoS | DoS (against ADO) | D-11 surfaces friendly throttle copy; user retries manually (CONTEXT defers auto-retry). |

**No new security surface in Phase 4 beyond what Phase 0–3 already established.** The two new direct-fetch sites (postComment + already-existing comments) both use the same auth path; the field write uses the form service's own session (no separate auth). Manifest scope unchanged. Token never logged in clear text.

## Sources

### Primary (HIGH confidence)
- [Microsoft Learn — Comments - Add Comment 7.1-preview.4 (2026-04)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/add-comment?view=azure-devops-rest-7.1) — request body schema `{ text: string }` ONLY (no `format` documented); response Comment object includes `format: CommentFormat`; scope `vso.work_write`
- [Microsoft Learn — Comments - Add 7.0-preview.3 (2026-04)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/add?view=azure-devops-rest-7.0) — same body schema as 7.1; CONTEXT D-13 selection
- [Microsoft Learn — Create modal dialogs in Azure DevOps extensions (2026-04)](https://learn.microsoft.com/en-us/azure/devops/extend/develop/using-host-dialog?view=azure-devops) — quote: "The dialog content page can't directly communicate back to the host except through the `onClose` result" → Finding 3
- `node_modules/azure-devops-extension-sdk/SDK.d.ts` — exhaustive list of SDK methods; no `notifyDialogResult` / `notifyDismiss` / `removeDialog`
- `node_modules/azure-devops-extension-api/Common/CommonServices.d.ts:180-272` — `IDialogOptions { lightDismiss?: boolean = true; onClose?(result) }`, `openCustomDialog: (id, opts) => void`
- `node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts:55-320` — `IWorkItemFormService` surface (setFieldValue, save, isDirty, isValid, getInvalidFields, setError, clearError); `isReadOnly` ONLY on `IWorkItemLoadedArgs:267`, NOT on form service itself → Finding 1
- `node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingClient.d.ts:117-133` — typed REST client lacks `addComment`; only `getComment(s)`
- `node_modules/azure-devops-extension-api/Comments/Comments.d.ts:129` and `WorkItemTracking/WorkItemTracking.d.ts:240` — `enum CommentFormat { Markdown = 0, Html = 1 }` (the Phase 4 D-01 literal `1`)
- `node_modules/azure-devops-ui/Components/MessageCard/MessageCard.Props.d.ts` — `buttonProps?: IButtonProps[]` for embedded Retry; severities Info/Warning/Error
- `node_modules/azure-devops-ui/Components/Spinner/Spinner.Props.d.ts` — sizes xSmall/small/medium/large
- `.planning/phases/03-modal-ui-read-path/03-VERIFICATION.md` Override 4 — direct-fetch pattern empirically verified on cezari
- `src/ado/comments.ts:55-101` — production reference implementation of the Override 4 direct-fetch pattern Phase 4 codifies into adoFetch.ts

### Secondary (MEDIUM confidence)
- WebSearch [Microsoft developer community — IWorkItemFormService save() error semantics](https://developercommunity.visualstudio.com/t/azure-devops-extension-api-IWorkItemForm/10639654) — content blocked behind community navigation, no quotable detail; informs `[ASSUMED]` heuristic in `mapSdkErrorToStatus`
- WebSearch results suggest 7.1-preview.4 may accept `format` as URL query (`?format={format}`) — unverified; D-02 spike resolves
- `azure-devops-extension-sdk` GitHub README — confirms v4 has no `getDialogResult/okCallback` pattern (legacy SDK only)

### Tertiary (LOW confidence — flagged for D-02 spike validation)
- The hypothesis that `format: 1` in request body is honored — Microsoft Learn explicitly documents NO format field in the request schema; SDK enum exists but is documented only on the response side; D-02 spike is the only authoritative test
- The exact runtime `Error.name` and `.message` shape for `IWorkItemFormService.save()` rejections — must be empirically captured during D-17 scenarios 4 + 5

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already pinned in package.json; no new deps; verified against node_modules .d.ts
- Architecture: HIGH for verified SDK surface; the three big findings (no isReadOnly method, no programmatic close, undocumented format body field) are CITED Microsoft Learn / verified .d.ts
- Pitfalls: HIGH for the eight pitfalls (each grounded in either Phase 03-04 cezari evidence, Microsoft Learn quote, or .d.ts fact)
- Empirical sanitizer behavior (D-02): MEDIUM until spike runs — listed in Assumptions Log A1, A7
- SDK error class shape (D-20): MEDIUM until D-17 scenarios 4+5 capture rejection .name/.message — A2

**Research date:** 2026-05-02
**Valid until:** 2026-06-01 — Microsoft Learn ADO docs update on roughly quarterly cadence; the SDK pinned versions don't drift unless package.json bumps; the three architectural findings are facts about the platform, not version-gated behaviors. The D-02 sanitizer behavior is the only finding that could shift if Microsoft updates comment storage/rendering.

---

*Phase: 04-write-path-edge-cases*
*Research completed: 2026-05-02*
