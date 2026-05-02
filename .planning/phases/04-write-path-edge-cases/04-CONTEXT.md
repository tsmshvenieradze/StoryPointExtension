# Phase 4: Write Path & Edge Cases - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Make Apply actually mutate the work item. Replace the Phase 3 `stubApply` body with the real comment-first → field-write sequence locked in Phase 0 D-01, gated by permission and overwrite checks, with friendly errors on every documented failure mode and a clean post-success exit.

In scope:
- Real `addComment` POST via direct fetch using the Phase 03-04 Override 4 pattern (no `getClient(WorkItemTrackingRestClient)` — it hangs in dialog iframes), with `commentFormat: 1` (HTML) so the sentinel is preserved by storage and hidden by renderer
- Shared `src/ado/adoFetch.ts` helper that consolidates the direct-fetch pattern (URL construction, token, JSON encode/decode, error throwing)
- `IWorkItemFormService.setFieldValue(refName, value)` + `.save()` write of the resolved Story Points field
- `IWorkItemFormService.isReadOnly()` probe in the read-path effect; read-only result REPLACES the calculator with a read-only message UI
- Overwrite confirmation panel (replaces calculator UI) when current SP is non-null: "Current X / New Y" + Back / Confirm Apply
- Error handling for both legs of the write: in-modal error banners with Retry; status-code-specific copy for 401/403/404/409/412/429/5xx + generic fallback
- Saving-state overlay that blocks dropdown re-edits + disables Cancel while writes are in flight
- Post-success: 200ms inline "Saved ✓" indicator → modal closes → form's SP field reflects the new value
- Phase 4 verification: cezari Scrum manual checklist (8 scenarios) + light vitest unit tests for `adoFetch`/`postComment` and the status-code map
- REQUIREMENTS.md APPLY-09 wording update (mirror of Phase 3 D-17's FIELD-04 rewrite) so the verifier doesn't fail Phase 4 against the literal "modal still opens read-only for inspection" text

Out of scope (Phase 5 owns these):
- CMMI live verification (Phase 0 D-14, Phase 5 deliverable)
- Custom SP field rename support (PROJECT.md Out of Scope)
- Bundle-size CI gate (PKG-03)
- `dev-publish.cjs` Windows retry fix (Phase 5 cleanup per 03-04-SUMMARY)
- Marketplace listing assets, public publish flag, cross-org E2E (PKG-02..07)
- Custom field auto-detection heuristic (Phase 5 stretch per 03-VERIFICATION.md §Custom SP field on Scrum)

</domain>

<decisions>
## Implementation Decisions

### Visible-sentinel UX (D-01..D-02)
- **D-01:** **POST `addComment` with `commentFormat: 1` (HTML).** Payload: `{ text: "<!-- sp-calc:v1 {...} -->\nStory Points: N (Complexity=..., Uncertainty=..., Effort=...)", format: 1 /* CommentFormat.Html */ }`. The HTML format causes ADO to preserve real `<!-- -->` HTML comments (the renderer hides them) instead of HTML-encoding the markup as visible text. Parser already handles raw-form sentinels (Phase 1 + 03-04 entity-decode patch) so the read path works untouched. The sentinel format itself is unchanged from AUDIT-01.
- **D-02:** **Empirical sanitizer validation in plan (30 min on cezari).** Before locking D-01 in code, the plan must include a verification step: post a sentinel via HTML format and confirm (a) the rendered Discussion view does NOT show the `<!-- -->` markup, (b) the `getComments` round-trip returns the comment with the sentinel intact (raw or entity-encoded — parser handles both). If ADO's sanitizer strips HTML comments, fall back to the **invisible-div carrier**: `<div data-sp-calc="v1" hidden>{...JSON...}</div>` plus serializer + parser updates. This fallback is documented but not implemented unless validation fails.

### Overwrite confirmation (D-03..D-04) — APPLY-04
- **D-03:** **First Apply click on an item with existing SP REPLACES the calculator with a confirm panel.** Layout: header unchanged ("Calculate Story Points"), context line unchanged, body shows centered "Confirm overwrite" panel:
  ```
  Confirm overwrite

  Current Story Points:  3
  New Story Points:      5

  [ Back ]      [ Confirm Apply ]
  ```
  Back returns to the calculator with all three dropdown selections preserved. Confirm Apply triggers the write sequence (D-15 saving state). The dropdowns and calc panel are unmounted while the confirm panel is shown — not just hidden — to keep the body height stable for D-15's overlay logic.
- **D-04:** **Trigger threshold: whenever current SP is non-null, regardless of whether new SP equals current SP.** Predictable and matches APPLY-04 literal. If `currentSp === null` (or undefined or NaN per bridge.ts coercion), Apply skips the confirm step and goes directly to the write sequence. Re-applying the exact same SP value still requires confirm — accepted UX cost; the parser-takes-most-recent invariant means a fresh comment per Apply is correct (Phase 0 D-03).

### Permission detection (D-05..D-07) — APPLY-09
- **D-05:** **`IWorkItemFormService.isReadOnly()` probe in the read-path effect.** Runs in parallel with the existing read-path probes (`getFieldValue`, `getFields`, `getComments`). Result lands in `readResult.permission = { isReadOnly: boolean, probeFailed: boolean }`. The probe is cheap (one postMessage call to the form service, the same surface that worked in 03-04) and covers Stakeholder license, area-path lock, closed-state, and rule-locked items.
- **D-06:** **Read-only branch REPLACES the calculator UI** (same shape as Phase 3 D-19 NoFieldMessage). When `isReadOnly === true`: hide dropdowns, calc panel, banners, and Apply/Cancel; show a centered MessageCard severity=Info with text *"You don't have permission to change this work item. The Story Point Calculator is read-only here."* + a Close hint matching Phase 3 D-19's pattern. Context line still renders so the user can see Current SP. **⚠ APPLY-09 SCOPE REFINEMENT — must update REQUIREMENTS.md.** REQUIREMENTS.md APPLY-09 currently reads: *"Permission check before showing/enabling Apply: when the user lacks write permission on the work item, the Apply button is disabled with a tooltip; modal still opens read-only for inspection."* Per the user choice (replace calculator entirely, not "Apply disabled with tooltip + calculator usable"), APPLY-09 must be re-stated as: *"When the user lacks write permission on the work item (isReadOnly=true), the modal opens and replaces the calculator UI with a clear message explaining the work item is read-only. The toolbar button remains enabled. The current Story Points value is still shown via the context line for inspection."* Planner MUST include a task to rewrite REQUIREMENTS.md APPLY-09 before Phase 4 closes — otherwise the verifier will fail Phase 4 against the literal pre-discussion APPLY-09 text. (Mirrors Phase 3 D-17 FIELD-04 rewrite.)
- **D-07:** **Probe-fail → default writable + Warning banner.** If `isReadOnly()` throws / rejects / times out, treat as writable (don't block legitimate users on transient SDK failures) and surface an `azure-devops-ui` MessageCard severity=Warning at the top of the body: *"Could not verify your permissions — Apply may fail if this work item is read-only."* The actual write's error path (D-08, D-09) takes over with a precise message if the optimistic assumption was wrong. Mirrors Phase 3 D-20 (FieldResolver-fail → default to StoryPoints + warning toast).

### Error & success UX (D-08..D-11) — APPLY-08, ROADMAP success criterion 5
- **D-08:** **Comment POST fails (network, 4xx, sanitizer rejection) → in-modal error banner + Retry button + selections preserved + NO field write attempted.** Banner is a MessageCard severity=Error pinned to the top of the (still-open) calculator body (or confirm panel if the failure happened post-confirm — the banner overlays whatever body state is current). Copy: `${friendlyMessage} (HTTP ${status})` per D-11 map. Retry button re-runs the comment POST with the SAME payload (same `serialize` output → same sentinel content; new createdDate from the POST). Cancel button re-enables. Calculator selections (and confirm-panel state, if applicable) stay exactly as the user left them. Aligned with Phase 0 D-04.
- **D-09:** **Comment succeeds + field write fails → persistent error banner + Retry runs the field write only + comment intentionally kept.** Banner severity=Error: *"Audit comment recorded. The Story Points field could not be updated. ${friendlyMessage} (HTTP ${status} or SDK error class)"* + Retry button. Retry attempts only the `setFieldValue` + `.save()` call — does NOT re-post the comment (multiple comments on retry IS acceptable per Phase 0 D-03, but for the partial-success path specifically the comment is already in the audit log; re-posting only happens on Comment POST failures). Worst case: user closes the modal after several field-write retries fail → audit comment remains as provenance → next reopen pre-fills from it (D-16) → user retries on the work item form directly or via reopening this modal. Aligned with Phase 0 D-04.
- **D-10:** **Success path: 200ms "Saved ✓" inline indicator → modal closes via host close affordance.** When both writes succeed: replace the saving overlay with a small inline "Saved ✓" indicator (next to where Apply was) for 200ms, then call the host's close mechanism. The work item form's SP field re-renders via the SDK's setFieldValue boundary (no manual form refresh required). Roadmap success criterion 5 ("the work item form reflects the new SP value without a full page reload") is satisfied by `IWorkItemFormService.setFieldValue` + `.save()` per Phase 0 PROJECT.md Key Decisions. Note: the modal cannot programmatically close per Phase 3 Override 1; "close the modal" here means trigger the host's lightDismiss or rely on the success indicator + a 200ms timeout, then prompt the user to dismiss. Planner verifies the available close mechanism on cezari and picks the cleanest available (e.g., calling `SDK.notifyDialogResult` with a result that the host treats as confirmed-and-close, or instructing the user via the inline indicator to press Esc).
- **D-11:** **Status code map (specific copy + generic fallback).** Final user-visible message format: `${friendlyMessage} (HTTP ${status})` (status code always shown for triage):
  - **401** — *"Sign in expired. Reload the page and try again."*
  - **403** — *"You don't have permission to change this item."* (also reachable via post-confirm if isReadOnly was stale)
  - **404** — *"Work item not found — it may have been deleted."*
  - **409** — *"Conflict — please reload the work item and try again."*
  - **412 (RuleValidationException)** — *"Work item changed since the modal opened — reload and try again."*
  - **429** — *"Azure DevOps is throttling requests — wait a moment and retry."*
  - **5xx** — *"Azure DevOps server error — try again shortly."*
  - **else (no specific match)** — *"Could not save."*

  The status-code mapper lives in `src/apply/errorMessages.ts` (or similar) as a pure function. Vitest tests cover all listed codes + an unknown code (e.g., 418) to verify the generic fallback. The same map is used by both the comment POST error (HTTP-status driven) and the field write error (SDK error class driven; the SDK's `RuleValidationException`, `WorkItemUpdateException`, etc. are translated into the same status discriminators — see D-19).

### Apply seam, REST, and shared util (D-12..D-14)
- **D-12:** **Replace the body of `src/apply/stubApply.ts`; rename to `src/apply/apply.ts` if convenient.** The existing `ApplyInput` shape (`{ c, u, e, fieldRefName }`) stays stable per Phase 3 D-27. New body sequence: serialize payload → adoFetch POST comment (HTML format) → if comment ok: setFieldValue + .save() → emit success → on either failure, throw a typed error the orchestrator can map to D-08/D-09 banners. The orchestrator (`src/ui/CalcModal.tsx`) drives the saving overlay (D-15) by awaiting an apply-promise that resolves on success or rejects with the typed error.
- **D-13:** **REST API version: `7.0-preview.3` for `addComment` per APPLY-06.** Different from `getComments`'s `7.1-preview.4` (Phase 3 03-04 finding) — the read uses the modern endpoint while the write API doc pins `7.0-preview.3`. The `adoFetch` helper takes a path and api-version; the caller composes the URL.
- **D-14:** **Shared `src/ado/adoFetch.ts` helper.** Single source of truth for the direct-fetch pattern. Signature (suggested):
  ```ts
  async function adoFetch<T>(
    method: "GET" | "POST",
    path: string,             // "/{projectId}/_apis/wit/workItems/{id}/comments"
    apiVersion: string,       // "7.0-preview.3"
    body?: unknown,
    opts?: { signal?: AbortSignal }
  ): Promise<T>
  ```
  Internally: `SDK.getHost()` → `host.isHosted ? https://dev.azure.com/{name} : https://{name}.visualstudio.com` (matches Override 4 in `comments.ts`); `SDK.getAccessToken()`; build URL with `?api-version=${apiVersion}`; JSON-encode body; throw on `!response.ok` with `Error(\`${method} ${path} failed: ${status} ${statusText} ${body.slice(0,200)}\`)`; cast on success. `comments.ts` and the new `postComment.ts` both consume it. Future v2 REST calls reuse it.

### Mid-write semantics (D-15)
- **D-15:** **Block close affordances + show "Saving…" overlay while either fetch is in flight.**
  - Apply button (or Confirm Apply in confirm-panel state): swap label to `Saving…`, render with a small spinner, disabled. The Cancel/Back button: disabled.
  - Body: a translucent overlay (~30% opacity neutral background) covers the dropdowns / confirm panel / banners. Pointer-events disabled inside.
  - Host close affordances (X / Esc / outside-click): planner attempts to set `lightDismiss: false` in the original `openCustomDialog` options for the in-flight window. If the host doesn't expose runtime toggling of lightDismiss, document as a known Phase 4 limitation: a force-close mid-write orphans the in-flight fetch (the request still completes; UI state is lost). The user reopens; the comment-side write either left a sentinel (recoverable via pre-fill) or didn't (clean state). This is acceptable because (a) the saving window is sub-second on the happy path, (b) Phase 0 D-03 makes "extra comment on retry" benign, and (c) the field-side write is idempotent (writing the same SP value twice is a no-op for the user's intent).
  - **No explicit AbortController** wired through. Aborting mid-flight does not improve the safety story given comment-first → field-write keeps the partial-success path recoverable.

### Post-success pre-fill (D-16)
- **D-16:** **Reopen after successful Apply uses Phase 3 D-12 behavior unchanged.** The just-posted sentinel is the most-recent comment (parser sorts by createdDate, so the new comment wins). The trio pre-fills, banner reads `Pre-filled from your last calculation on May 2, 2026.` The mismatch addendum (Phase 3 D-14) is suppressed because `sentinel.sp === currentSp` (we just wrote both). Zero new logic; the audit comment's dual purpose works exactly as designed across Apply cycles.

### Verification (D-17..D-19)
- **D-17:** **Manual cezari (Scrum) checklist + light vitest tests.** Manual checklist lives in `04-VERIFICATION.md` and is executed via the Phase 2 dev-publish wrapper (with the documented Windows-retry caveat — direct `npx tfx extension publish` invocation per 03-04). Scenarios:
  1. **Happy path, no current SP** — open modal on a PBI with empty SP; calc; Apply; observe in Network tab: `addComment` POST succeeds first, then `setFieldValue` + `.save()` writes the field; modal auto-closes; SP field on the form shows the new value; reopening the modal pre-fills from the just-written sentinel; rendered comment view shows ONLY the human-readable line (sentinel hidden by HTML format, D-01) — D-02 empirical validation lands here.
  2. **Overwrite confirm path** — open modal on a PBI with existing SP=3; pick a trio that yields SP=5; click Apply; confirm panel renders with "Current 3 / New 5"; click Back → calculator re-renders with selections preserved; click Apply again → confirm panel; click Confirm Apply → write sequence proceeds.
  3. **Comment POST failure** — temporarily mangle the URL in `postComment.ts` to force a 404 (or run with network offline); observe in-modal error banner with the D-11 status copy + Retry button; click Retry with the URL fixed → recovers; verify NO field write occurred when the comment failed.
  4. **Field-write 412** — open modal; immediately edit the SP field on the form to a different value (this dirties the form/version); click Apply through to Confirm; observe persistent banner per D-09; comment is in the audit log; Retry attempts the field write only.
  5. **Stakeholder/read-only** — change the cezari user license to Stakeholder (or use a Reader-only user on a public-area work item); reopen the work item; click toolbar; observe the read-only branch (calculator hidden, message visible) per D-06.
  6. **isReadOnly probe failure** — temporarily make `isReadOnly()` reject (e.g., throw inside a wrapper used in dev builds) and confirm the warning banner from D-07 appears + calculator stays usable + Apply still attempts the write.
  7. **Saving overlay** — slow-network throttle in DevTools; click Apply; observe the saving overlay + disabled buttons; verify the user cannot interact with dropdowns mid-flight.
  8. **HTML-format sentinel preservation** (D-02) — inspect the just-posted comment in (a) the rendered Discussion view (no `<!-- -->` visible), (b) the GET response body via the Network tab (sentinel intact, raw or entity-encoded), (c) parser correctness on next reopen (pre-fill works).
- **D-18:** **Light vitest unit tests** for the pure pieces:
  - `adoFetch` URL construction — host name, isHosted branch, projectId encoding, api-version query param.
  - `postComment` payload shape — HTML format flag, sentinel content matches `serialize()` output.
  - Status-code map (D-11) — table-driven test of all 7 listed codes + unknown 418 + classes of 5xx (500, 502, 503).
  - SDK error → status-discriminator mapper (D-19) — `RuleValidationException` → 412, `WorkItemUpdateException` → 412 or 409 per planner research, generic Error → "no specific status".
  - No vitest tests for the React confirm panel or saving overlay — manual QA covers UI per project standard.
- **D-19:** **CMMI live verification deferred to Phase 5** per Phase 0 D-14 / Phase 3 D-31. Phase 4 verifies the FIELD-02 fallback path conceptually (FieldResolver returns `Microsoft.VSTS.Scheduling.Size` → setFieldValue uses that ref name) via unit tests; the live CMMI org test happens once at Phase 5 final smoke.

### SDK error class translation (D-20)
- **D-20:** **Translate `IWorkItemFormService.save()` rejections into the same status-discriminator buckets used by D-11.** The SDK's form service does not throw HTTP errors — it throws SDK error classes (`RuleValidationException`, `WorkItemUpdateException`, generic `Error`). Phase 4 plan must research the exact class names and map them to the D-11 buckets. Suggested initial mapping:
  - `RuleValidationException` → treat as 412 ("Work item changed since the modal opened…")
  - `Permission denied` / 403-equivalent SDK errors → 403 copy
  - Anything else → generic fallback ("Could not save.") with the SDK error message appended for triage
  This keeps the user-visible error UX uniform across the comment leg (HTTP-driven) and the field leg (SDK-class-driven).

### Claude's Discretion
- Exact MessageCard wording for D-08 / D-09 banners (within the friendliness/precision template established by Phase 3 banners and D-11 map).
- Whether `stubApply.ts` is renamed to `apply.ts` or its contents simply replaced (rename is cleaner since the function is no longer a stub; keeping the filename avoids an import-site churn).
- File organization inside `src/ado/` (`postComment.ts` standalone vs. extending an existing bridge file). Prefer a new file for cohesion with `comments.ts` (read counterpart).
- Saving overlay style — translucent backdrop vs. spinner-only inline replacement; whichever `azure-devops-ui` primitive renders cleanest at the modal's small width.
- Whether the success "Saved ✓" indicator is a banner, an inline label next to the Apply button, or a brief replacement of the ButtonGroup. Aim for minimal layout shift in the 200ms window.
- Exact mechanism to programmatically close the host dialog (D-10) — `SDK.notifyDialogResult` with a host-recognized close result, or an instruction line to press Esc. Verify on cezari.
- Whether to surface the SDK error message verbatim in the D-11 generic fallback (e.g., `"Could not save. SDK said: ${err.message} (HTTP n/a)"`) — leaning yes for triage.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Key Decisions table (atomicity row "comment-first → field-write", "always post a new comment per Apply", `IWorkItemFormService.setFieldValue() + .save()` choice over REST PATCH, sentinel format).
- `.planning/REQUIREMENTS.md` §APPLY — APPLY-04..09 (Phase 4's six requirements). **⚠ APPLY-09 wording MUST be updated by the planner per D-06**, mirror of Phase 3 D-17 FIELD-04 rewrite.
- `.planning/ROADMAP.md` §Phase 4 — Goal and 5 success criteria.

### Phase 0 artifacts (atomicity foundation)
- `.planning/phases/00-bootstrap-prerequisites/00-CONTEXT.md` §Atomicity Ordering — D-01 (comment-first → field-write), D-02 (rationale), D-03 (always post a new comment per Apply, no de-dup), D-04 (failure modes — comment-fails-no-field-write; comment-succeeds-field-fails-comment-kept-toast). These four decisions ARE the atomicity contract; Phase 4 implements them. D-14 (CMMI org is Phase 5).

### Phase 3 artifacts (read path that Phase 4 extends)
- `.planning/phases/03-modal-ui-read-path/03-CONTEXT.md` — D-22 (ADO bridge in src/ado/), D-23 (REST API version note), D-26 (current-SP read returns null on failure → drives D-04 trigger threshold), D-27 (stub-Apply seam, input shape stable), D-29 (verification pattern Phase 4 mirrors), D-31 (CMMI deferred).
- `.planning/phases/03-modal-ui-read-path/03-VERIFICATION.md` §Real-world Corrections — Override 4 (direct-fetch only, no SDK REST client), §Issues Discovered (visible-sentinel inventory, dev-publish.cjs Windows retry, Custom SP field on Scrum).
- `.planning/phases/03-modal-ui-read-path/03-04-SUMMARY.md` §Next Phase Readiness — three Phase 4 follow-ups (direct-fetch for `addComment`, visible-sentinel UX decision, atomicity ordering reference).
- `.planning/phases/03-modal-ui-read-path/03-UI-SPEC.md` — UI design contract; banner stack ordering, MessageCard severities, Surface/Page chrome that Phase 4 keeps.

### Research
- `.planning/research/SUMMARY.md` §Architecture — `IWorkItemFormService` + `WorkItemTrackingRestClient` patterns; iframe sandbox constraints.
- `.planning/research/ARCHITECTURE.md` — SDK init lifecycle, postMessage surface, location-service vs. form-service surface (relevant to direct-fetch pattern).
- `.planning/research/PITFALLS.md` — Pitfall on `setFieldValue` returning Promise<unknown> at runtime (defensive coercion in bridge.ts already does this); pitfall on `addComment` sanitizer behavior (D-02 validates empirically); pitfall on RuleValidationException class shape (D-20 maps it).
- `.planning/research/STACK.md` — `azure-devops-ui@2.272.0` MessageCard, ButtonGroup, Button, Spinner usage; `azure-devops-extension-api@4.270.0` form service surface.

### Phase 1 artifacts (consumed unchanged)
- `src/calc/index.ts` — `calculate({ c, u, e })` for confirm panel "New SP" computation.
- `src/audit/index.ts` — `serialize(payload)` for the comment text; `parseLatest(comments)` already in CalcModal for D-16.
- `src/audit/parse.ts` — HTML-entity decode (Phase 03-04 fix-back) — guarantees parser robustness across both raw `<!-- -->` (D-01 success path) and entity-encoded round-trips (defensive layer).

### Phase 3 source files (Phase 4 modifies)
- `src/apply/stubApply.ts` — replace body per D-12; consider rename to `src/apply/apply.ts`.
- `src/ado/comments.ts` — refactor to consume the new `src/ado/adoFetch.ts` helper (D-14); behavior unchanged.
- `src/ado/bridge.ts` — extend with `isReadOnly` wrapper (`async function getIsReadOnly(formService): Promise<boolean>` returning `true`/`false`/throwing for D-07).
- `src/ui/CalcModal.tsx` — orchestrator. Add states for: confirm panel (D-03), read-only branch (D-06), saving overlay (D-15), error banners with Retry (D-08, D-09), success indicator (D-10). The existing read-path effect adds the isReadOnly probe to the parallel reads (D-05).
- `src/entries/modal.tsx` — likely no changes; the SDK lifecycle bootstrap from Phase 2 stays.

### New files Phase 4 creates
- `src/ado/adoFetch.ts` — shared direct-fetch helper (D-14).
- `src/ado/postComment.ts` — addComment via adoFetch with `commentFormat: 1` (D-01, D-13).
- `src/apply/errorMessages.ts` — pure status-code → user-message mapper (D-11) and SDK-error → status-discriminator mapper (D-20).
- `src/ui/ConfirmOverwritePanel.tsx` — confirm-panel component (D-03).
- `src/ui/ReadOnlyMessage.tsx` — read-only branch component (D-06), shape parallel to `NoFieldMessage.tsx`.
- `src/ui/SavingOverlay.tsx` (or inline in CalcModal) — saving-state overlay (D-15).
- `.planning/phases/04-write-path-edge-cases/04-VERIFICATION.md` — manual cezari checklist (D-17 scenarios 1–8) + Real-world Corrections section (per Phase 3 03-04 pattern).

### External (verified Microsoft Learn 2026-04 per architecture research)
- Microsoft Learn: `WorkItemTrackingRestClient.addComment` — request body shape (`text`, `format` enum), response shape, api-version `7.0-preview.3`. Confirm `format: 1` corresponds to `CommentFormat.Html` and that this preserves real `<!-- -->` HTML comments through the storage layer.
- Microsoft Learn: `IWorkItemFormService` — `isReadOnly()`, `setFieldValue(refName, value)`, `.save()`. Confirm runtime semantics (return values, error classes thrown on failure, behavior when work item is dirty).
- Microsoft Learn: `IDialogOptions` — `lightDismiss` toggle behavior, programmatic close mechanisms (`SDK.notifyDialogResult` or equivalent). The `microsoft/azure-devops-extension-sample` repo has dialog-close examples.
- Microsoft Learn: ADO REST API common error codes — 401, 403, 404, 409, 412 (RuleValidationException semantics), 429 throttling, 5xx server errors. Validate the D-11 copy against the documented reasons.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/calc/`, `src/audit/`, `src/field/`** (Phase 1, 3) — pure modules. Phase 4 imports `serialize` (for the addComment payload) and re-uses `calculate` indirectly via the existing CalcModal `useMemo`. No changes needed.
- **`src/ado/comments.ts`** (Phase 03-04) — Override 4 direct-fetch pattern. Phase 4 refactors this file to consume the new `adoFetch` helper while preserving behavior; the URL/method change for `addComment` is a sibling file (`postComment.ts`).
- **`src/ado/bridge.ts`** (Phase 3) — form-service helpers (`getCurrentSpValue`, `getWorkItemTitle`, `getWorkItemTypeName`, `getProjectId`). Phase 4 adds `getIsReadOnly` here.
- **`src/ui/CalcModal.tsx`** (Phase 3) — orchestrator with banner stack, read-path effect, ButtonGroup, dropdown row. Phase 4 extends without rewrite: add three view states (calculator | confirm | read-only), add saving overlay, add error banner variants with Retry.
- **`src/ui/NoFieldMessage.tsx`** (Phase 3) — shape parallel to the new `ReadOnlyMessage.tsx`.
- **`src/ui/PreFillBanner.tsx`** (Phase 3) — D-16 reuses unchanged.
- **`src/apply/stubApply.ts`** (Phase 3) — Phase 4 replaces the body; input contract `ApplyInput { c, u, e, fieldRefName }` stays stable.
- **`scripts/dev-publish.cjs`** — Phase 4 verification reuses the wrapper (with documented Windows-retry caveat — fall back to `npx tfx extension publish --override` per 03-04 Issues Discovered).

### Established Patterns
- **Direct-fetch pattern (Override 4)** — `SDK.getHost() + SDK.getAccessToken() + fetch()` is the only working REST surface from a custom-dialog iframe. Phase 4 hardens this into `src/ado/adoFetch.ts` (D-14).
- **SDK lifecycle discipline** — `SDK.init({loaded:false}) → SDK.ready() → register/read config → notifyLoadSucceeded`. Already correct in `entries/modal.tsx` from Phase 2; Phase 4 doesn't touch the bootstrap.
- **Pure modules + SDK boundary at src/ado/** — calc and audit have zero SDK imports. Phase 4 keeps the boundary clean: `src/apply/apply.ts` orchestrates pure serialize → adoFetch (SDK-aware) → setFieldValue (SDK-aware), but the pure pieces stay pure.
- **`[sp-calc/...]` console-log prefix** — Phase 4 uses `[sp-calc/apply]` for the write sequence and `[sp-calc/postComment]` for the addComment helper.
- **String-literal service IDs** (Phase 2 D-12 / Phase 3 isolatedModules workaround) — already in `bridge.ts`; Phase 4 reuses for any new service ID it needs.
- **Defensive coercion at the SDK boundary** — `bridge.ts` Number-coerces field values, type-guards string returns. Phase 4's `getIsReadOnly` wrapper follows the same pattern (rejects non-boolean returns, swallows-and-flags rejections).
- **Banner stack ordering** — Phase 3 established: resolver-fail → read-error → pre-fill. Phase 4 inserts: resolver-fail → read-error → permission-warn (D-07) → pre-fill, plus the post-Apply error banners replace any of the above when Apply fails.
- **Manual verification + light unit tests** (Phase 3-04 pattern) — D-17 mirrors this exactly.

### Integration Points
- **`src/apply/apply.ts` ↔ orchestrator** — orchestrator awaits `await applyToWorkItem(input)` and translates resolves/rejects into the success / D-08 / D-09 banners. The apply function takes `(input: ApplyInput, formService: IWorkItemFormService)` and returns `Promise<void>` (success) or rejects with a typed error containing `{ leg: "comment" | "field", status: number | null, sdkErrorClass?: string, message: string }`.
- **`src/ado/adoFetch.ts` ↔ `comments.ts` + `postComment.ts`** — both consume the shared helper; `comments.ts` becomes a 5–10 line wrapper around `adoFetch("GET", ...)`.
- **Read-path effect ↔ isReadOnly** — extend the existing `Promise.all` of parallel reads in `CalcModal.tsx` to include `getIsReadOnly(formService)`. Result lands in `readResult.permission`. The render path checks `readResult.permission?.isReadOnly` BEFORE the no-field check (D-06 short-circuits to ReadOnlyMessage).
- **Confirm panel ↔ overwrite trigger** — calc-modal state machine: `mode: "calculator" | "confirm" | "saving" | "saved" | "readonly" | "noField"`. Apply click in `calculator` mode with `currentSp != null` → `mode = "confirm"`. Confirm Apply click → `mode = "saving"`. Success → `mode = "saved"` (200ms) → close. Failure → stay in `mode` and show error banner with Retry. Back in confirm → `mode = "calculator"`.

</code_context>

<specifics>
## Specific Ideas

- **HTML-format POST shape** (D-01):
  ```
  POST {baseUrl}/{projectId}/_apis/wit/workItems/{id}/comments?api-version=7.0-preview.3
  Authorization: Bearer {token}
  Content-Type: application/json

  { "text": "<!-- sp-calc:v1 {\"sp\":5,\"c\":\"Hard\",\"u\":\"Medium\",\"e\":\"Easy\",\"schemaVersion\":1} -->\nStory Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)",
    "format": 1 }
  ```
- **Confirm panel copy** (D-03):
  ```
  Confirm overwrite

  Current Story Points:  3
  New Story Points:      5

  [ Back ]      [ Confirm Apply ]
  ```
- **Read-only branch copy** (D-06): *"You don't have permission to change this work item. The Story Point Calculator is read-only here."* (severity=Info MessageCard, parallel shape to NoFieldMessage)
- **Probe-fail warning copy** (D-07): *"Could not verify your permissions — Apply may fail if this work item is read-only."* (severity=Warning MessageCard, dismissable)
- **Comment-fail banner copy** (D-08): *"Could not save audit comment. ${friendlyMessage} (HTTP ${status})"* + Retry button
- **Field-fail banner copy** (D-09): *"Audit comment recorded. The Story Points field could not be updated. ${friendlyMessage} (${HTTP status} or SDK error class)"* + Retry button (field-only retry)
- **Success indicator** (D-10): inline `Saved ✓` (U+2713) for 200ms, replacing the ButtonGroup or appearing next to it
- **Status code map** (D-11): see D-11 above; the message mapper is a pure function in `src/apply/errorMessages.ts`
- **Saving overlay** (D-15): translucent overlay (~30% opacity neutral background) covering the body region (dropdowns + calc panel OR confirm panel); Apply button replaced with `[ Saving… ]` (spinner + disabled); Cancel/Back disabled
- **adoFetch error format** (D-14): `Error: ${method} ${path} failed: ${status} ${statusText} ${body.slice(0,200)}` — predictable for the orchestrator's typed-error translation
- **Phase 4 verification dev-publish loop**: continue the manifest version walk from Phase 03-04's last 0.1.16 — Phase 4 starts at 0.1.17 or 0.2.0 (planner picks; minor bump signals scope graduation from read-only to write)
- **CommentFormat enum source**: `azure-devops-extension-api/WorkItemTracking` exports `CommentFormat` as a `const enum`; with `isolatedModules: true` use the literal `1` and pin the meaning in a comment (`/* CommentFormat.Html */`) — same workaround Phase 2 used for service IDs

</specifics>

<deferred>
## Deferred Ideas

- **CMMI live verification** — Phase 5 (Phase 0 D-14 / Phase 3 D-31 / Phase 4 D-19). Phase 4 covers FIELD-02 fallback path via unit tests; live CMMI org is Phase 5 final smoke.
- **Custom SP field rename support** — PROJECT.md Out of Scope. Real-world Scrum installs may delete inherited `Microsoft.VSTS.Scheduling.StoryPoints`; either documented as known limitation in Phase 5 listing or addressed via settings UI in v2.
- **AbortController on in-flight fetch** — D-15 blocks close affordances during the saving window; explicit abort wiring is over-engineering since the user can't trigger close mid-write under D-15. Revisit if the lightDismiss runtime toggle proves impossible and we need orphan-fetch handling.
- **Bundle-size CI gate** — Phase 5 PKG-03.
- **`dev-publish.cjs` Windows retry fix** — Phase 5 cleanup per Phase 03-04 Issues Discovered. Phase 4 uses `npx tfx extension publish --override` directly per the existing workaround.
- **"Just saved" reopen banner with session-local timestamp** — rejected for D-16 (per-iframe-lifetime state is fragile across dialog reopens). Standard pre-fill banner is sufficient.
- **Telemetry / analytics on apply errors** — Out of Scope per REQUIREMENTS.md ("Telemetry on calc errors"). Errors surface to the user only.
- **Multi-step retry strategy** (e.g., exponential backoff on 429) — D-11 surfaces the throttle message; user retries manually. Auto-retry adds complexity without proportional UX benefit for a 30-second utility.
- **Marketplace listing assets, public publish** — Phase 5 (PKG-02..07).
- **Per-component theme matrix + per-key keyboard transcripts** — Phase 03-04 deferral; Phase 5 polish.
- **Auto-detect "story-point-like" custom fields by data-type heuristic** — Phase 5 stretch per 03-VERIFICATION.md §Custom SP field on Scrum.

</deferred>

---

*Phase: 04-write-path-edge-cases*
*Context gathered: 2026-05-02*
