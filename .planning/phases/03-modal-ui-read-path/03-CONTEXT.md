# Phase 3: Modal UI & Read Path - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace Phase 2's "Hello" payload with the full calculator UI wired to Phase 1's pure modules, plus the FieldResolver and the SDK read path so the user can see current SP and a pre-filled selection on every modal open. Write path (setFieldValue + addComment + permission/overwrite/error handling) is Phase 4.

In scope:
- Real React modal in `src/entries/modal.tsx` rendering three labeled `azure-devops-ui` Dropdown components (Complexity, Uncertainty, Effort) with the five LEVELS options each
- Live "Calculation Details" panel showing W (2 decimals), Raw SP (2 decimals), Final SP (hero treatment), and the formula text — driven by Phase 1's `calculate()` from `src/calc/`
- `FieldResolver` module in `src/field/` that probes the current work item type's fields via `IWorkItemFormService.getFields()` (or equivalent) and returns `Microsoft.VSTS.Scheduling.StoryPoints` (Agile/Scrum/Basic) or falls back to `Microsoft.VSTS.Scheduling.Size` (CMMI), caching per `(projectId, workItemTypeName)` for the lifetime of the modal iframe
- ADO bridge wrappers in `src/ado/` for: getting current field value (APPLY-01), getting all comments via `WorkItemTrackingRestClient.getComments()` (APPLY-02), and running the AUDIT parser to find the most recent sentinel (APPLY-03)
- Pre-fill the three dropdowns from the parsed sentinel payload when one is found
- Apply button (wired-but-stubbed: computes the calc result and `console.log`s what it would write, then closes — no setFieldValue, no addComment) + Cancel button in the host dialog footer
- Full keyboard navigability (Tab, Enter, Esc) per UI-07
- Skeleton/spinner UI during the async read latency on modal open
- Light unit tests (vitest) for the FieldResolver lookup priority + cache logic (FIELD-01..03 acceptance)
- Manual verification on `cezari.visualstudio.com/Cezari` using the Phase 2 dev-publish wrapper, against User Story / Bug / Task / Feature / Epic on Agile process (and at least one CMMI-typed item if available)

Out of scope (Phase 4 owns these):
- Actual `setFieldValue` + `.save()` writes (APPLY-05)
- Actual `addComment` POSTs (APPLY-06)
- Comment-first/field-write atomicity ordering execution (APPLY-07) — the ordering is already locked in Phase 0 D-01
- Permission pre-check disabling Apply (APPLY-09)
- Overwrite confirmation panel "Current X / New Y" (APPLY-04)
- Error toasts / status-code-specific failure handling on writes (APPLY-08)
- Marketplace listing / branded icon / public publish (Phase 5)
- Bundle-size CI gate (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Modal Layout & Structure (D-01..D-08)
- **D-01:** **Stacked vertical layout.** Top-to-bottom: header → context line → optional pre-fill banner → three dropdowns → Calculation Details panel → host dialog footer with Apply/Cancel. Single column. Reads top-to-bottom, plays well with keyboard tab order. No two-column or inline layout.
- **D-02:** **Modal title:** `Calculate Story Points` — matches the toolbar entry label from Phase 2 D-07. Rendered via the host dialog title (passed to `openCustomDialog`'s `title` option). The `azure-devops-ui` Header inside the body may be omitted to save vertical space, since the host dialog chrome already shows the title.
- **D-03:** **Context line below header:** `Work item #{workItemId} · "{title}" · Current Story Points: {value}` (or `· Current Story Points: —` when null). Title comes from `IWorkItemFormService.getFieldValue("System.Title")`. Subtle, not a hero element.
- **D-04:** **Calculation Details panel — hero Final SP.** Final SP rendered as a large bold number (heading style, ~24px+). W and Raw SP shown smaller as supporting "how we got here" numbers. Formula text always visible: `W = 0.4·C + 0.4·U + 0.2·E` and `SP = round_fib(0.5 × 26^((W−1)/4))`.
- **D-05:** **Empty/initial state of calc panel:** em-dash placeholders (`—`) for W, Raw SP, Final SP until all three dropdowns are selected. Formula text visible from the start. Panel always rendered — no layout shift when the third dropdown is filled.
- **D-06:** **Modal sizing — fit content, no scrollbar.** Per user direction: "the current modal size is small, the main thing is that it doesn't scroll." Planner verifies on cezari that the full modal (header + context + banner area + 3 dropdowns + calc panel + footer) renders without a vertical scrollbar at the host's default dialog height. If the host's default isn't tall enough, pass an explicit `height` to `openCustomDialog` sized to fit. Width: keep close to Phase 2's "small" footprint.
- **D-07:** **Dropdown empty placeholder:** `Select level…` for each of the three dropdowns until the user (or pre-fill) populates them. No default selection; UI-05 says Apply is disabled until all three are chosen, and pre-selecting (e.g., Medium) would anchor users.
- **D-08:** **Apply + Cancel sit in the host dialog footer.** Use `openCustomDialog`'s footer-button API (`getDialogResult` / footer buttons) so Apply + Cancel render in the host's dialog chrome with native ADO styling. Apply is the primary action. Phase 4's overwrite-confirm panel still lives in the body.

### Level Labels & Order (D-09..D-11)
- **D-09:** **Exact engine labels** — `Very Easy / Easy / Medium / Hard / Very Hard` verbatim from `LEVELS` in `src/calc/levels.ts`. Single source of truth across UI, calc engine, and audit-comment payload. No display variants (no "1 — Very Easy" prefix, no per-dimension renaming).
- **D-10:** **Dropdown order: Very Easy first**, then Easy, Medium, Hard, Very Hard. Matches the xlsx, the LEVELS array, and reading-order intuition (low → high difficulty).
- **D-11:** **Cancel closes immediately** — no "discard your selections?" confirmation. Modal is short-lived, nothing destructive happens on Cancel (we haven't called setFieldValue yet).

### Pre-fill UX from Prior Sentinel (D-12..D-15)
- **D-12:** **Silently populate dropdowns + show provenance banner.** When `parseLatest(comments)` returns a payload with valid c/u/e levels, fill the three dropdowns from it and render an `azure-devops-ui` MessageCard at the top of the body: `Pre-filled from your last calculation on {absolute date}.` Banner is dismissable. Apply enabled immediately (all three are filled).
- **D-13:** **Date format — absolute** (`on May 1, 2026`) via `Intl.DateTimeFormat`. Locale-aware. Absolute over relative because it's auditable and avoids the "a few minutes ago" ambiguity.
- **D-14:** **Mismatch handling.** When the sentinel's `sp` differs from the current SP field value (someone edited the field directly after the prior calc), the same banner adds: `Field currently shows {currentSP} — may have been edited directly.` Informational, severity stays Info (not Warning). User can adjust selections or re-Apply as-is. Phase 4's overwrite-confirm will gate the actual write.
- **D-15:** **Bad sentinel payload → treat as no pre-fill.** If `parseLatest` returns null OR returns a payload whose `c/u/e` aren't valid `Level` strings, modal opens empty (no pre-fill, no banner). `console.warn` for debugging. AUDIT module's parser is already "never throws on user input" per AUDIT-04; this is the second-line guard at the consumer.

### FieldResolver — Probe & Cache (D-16..D-21) [⚠ FIELD-04 SCOPE REFINEMENT]
- **D-16:** **Lazy probe on modal open.** Toolbar button is always shown enabled. On click, modal opens; FieldResolver runs as part of the read path; if neither `Microsoft.VSTS.Scheduling.StoryPoints` nor `Microsoft.VSTS.Scheduling.Size` is present on the work item type, modal renders the no-field message UI (D-19) instead of the calculator. No `IWorkItemNotificationListener` integration in the toolbar entry — keeps the toolbar iframe simple and avoids PITFALLS.md Pitfall 6 lifecycle traps (state leaks across Next/Previous, double-fire of `onLoaded`).
- **D-17:** **⚠ FIELD-04 scope refinement — must update `.planning/REQUIREMENTS.md`.** REQUIREMENTS.md FIELD-04 currently reads: *"When neither field is present on the work item type, the toolbar button is rendered disabled with a tooltip explaining which field types are supported."* The user explicitly chose lazy-probe (D-16), so FIELD-04 must be re-stated as: *"When neither field is present on the work item type, the modal opens and shows a clear message explaining which work item types are supported, with a Close button. The toolbar button remains enabled."* The planner MUST include a task in the phase plan to update REQUIREMENTS.md FIELD-04 wording before Phase 3 closes — otherwise the verifier will fail Phase 3 against the literal pre-discussion FIELD-04 text.
- **D-18:** **FIELD-03 cache — in-memory, modal iframe lifetime.** Module-level `Map<string, "StoryPoints" | "Size" | null>` keyed by `${projectId}|${workItemTypeName}`. The modal iframe is fresh per dialog open in ADO's host (host opens a new iframe each time `openCustomDialog` is called for the modal contribution), so the cache is effectively per-dialog-open. Probe is fast (one SDK call); this is acceptable.
- **D-19:** **No-field modal UI — plain message + Close.** When FieldResolver returns null, render a centered `azure-devops-ui` MessageCard (severity=Info) with text: *"This work item type ({typeName}) doesn't have a Story Points field. The Story Point Calculator works on work item types that include `Microsoft.VSTS.Scheduling.StoryPoints` (Agile/Scrum/Basic processes) or `Microsoft.VSTS.Scheduling.Size` (CMMI process)."* One Close button (host footer or body — planner picks).
- **D-20:** **FieldResolver failure → default to StoryPoints + warning toast.** If `getFields()` (or equivalent SDK call) throws / rejects, assume `Microsoft.VSTS.Scheduling.StoryPoints` (the most common case) and continue rendering the calculator. Show an `azure-devops-ui` toast/MessageBar: *"Could not detect field type — assuming Microsoft.VSTS.Scheduling.StoryPoints."* If the eventual write in Phase 4 fails with "field not defined," that error path surfaces a clearer message there.
- **D-21:** **FieldResolver lives in `src/field/`** as a pure module that takes an `IWorkItemFormService` (or a thin abstraction) and returns the resolved reference name. Unit-tested with a fake form service implementing `getFields()`. Keeps the SDK boundary at the bridge layer.

### Read Path — Bridge & Loading States (D-22..D-26)
- **D-22:** **ADO bridge in `src/ado/`** — extend the existing `src/ado/types.ts` with read-path types and add bridge files (e.g., `src/ado/bridge.ts` or split into `src/ado/workItemForm.ts`, `src/ado/comments.ts`). Wraps:
  - `IWorkItemFormService.getFields()` — for FieldResolver
  - `IWorkItemFormService.getFieldValue(refName)` — for current SP (APPLY-01)
  - `IWorkItemFormService.getFieldValue("System.Title")` — for context-line title (D-03)
  - `WorkItemTrackingRestClient.getComments(projectId, workItemId)` — for APPLY-02 / APPLY-03
- **D-23:** **REST API version for `getComments`:** the `azure-devops-extension-api/WorkItemTracking` v4 client handles the version internally. Phase 4 will pin `7.0-preview.3` for `addComment` per APPLY-06; Phase 3 just consumes the read endpoint via the typed client.
- **D-24:** **Loading state — skeleton dropdowns + spinner header.** Modal layout (header, dropdowns, calc panel, footer) renders immediately. Dropdowns show a small `azure-devops-ui` Spinner or skeleton state until the read path completes. Banner area shows a Spinner while the parseLatest probe is in flight. Snappy perception; user sees structure right away.
- **D-25:** **`getComments` failure → open with no pre-fill + warning banner.** Modal opens normally with empty dropdowns; MessageCard severity=Warning at top: *"Could not load prior calculations — starting fresh."* User can still calculate from scratch. Console-log error details. No retry button (user can close + reopen).
- **D-26:** **`getFieldValue` (current SP) failure → display `—`.** Context line shows `Current Story Points: —`. Don't block. Don't add a banner. Phase 4's overwrite-confirm logic must handle "current value unknown" without crashing.

### Apply Boundary & Phase 3 Verification (D-27..D-31)
- **D-27:** **Apply is wired-but-stubbed in Phase 3.** Click handler:
  1. Reads dropdown selections (typed `Level`).
  2. Computes the result via Phase 1's `calculate({ c, u, e })`.
  3. Builds the audit payload via `serialize()` from `src/audit/`.
  4. `console.log("[sp-calc/apply] would write SP=N", { sp, comment, fieldRefName })`.
  5. Closes the dialog.

  NO `setFieldValue`, NO `addComment`, NO REST POSTs. Phase 4 swaps the console.log block for the real write path keyed off the comment-first → field-write atomicity decided in Phase 0 D-01.
- **D-28:** **Apply disabled until all three dropdowns are selected** per UI-05. After the third selection, Apply enables. (When pre-fill loads three valid levels, Apply enables on modal open.)
- **D-29:** **Phase 3 verification — manual on cezari + light unit tests.** Same dev-publish wrapper from Phase 2 (`scripts/dev-publish.cjs`). Manual checklist (lives in `03-VERIFICATION.md`):
  1. Modal opens on click for User Story, Bug, Task, Feature, Epic.
  2. Three dropdowns render with `Select level…` placeholders, populated with the five LEVELS in Very Easy → Very Hard order.
  3. Calc panel renders with em-dash placeholders + formula text from open.
  4. Selecting all three updates W, Raw SP, Final SP live (matches `calculate()` output to 2 decimals on the intermediates).
  5. With a prior sentinel comment present, dropdowns auto-fill and the provenance banner shows the absolute date.
  6. With a manually-edited SP field that diverges from the prior sentinel, banner adds the mismatch note.
  7. Apply is disabled until 3rd dropdown selected.
  8. Stub-Apply console-logs the right payload and closes the dialog.
  9. Cancel closes immediately, no confirm.
  10. Tab/Enter/Esc keyboard nav works (UI-07): Tab between dropdowns, Enter confirms a dropdown, Esc cancels, Tab to Apply + Enter triggers the stub.
  11. Modal renders with no scrollbar at the configured size (D-06).
  12. Theme toggle (light↔dark) flips modal colors as in Phase 2.
- **D-30:** **Light vitest unit tests** for FieldResolver:
  - Returns `Microsoft.VSTS.Scheduling.StoryPoints` when present.
  - Falls back to `Microsoft.VSTS.Scheduling.Size` when StoryPoints absent.
  - Returns null when both absent.
  - Caches by `(projectId, workItemTypeName)` (second call doesn't re-probe).
  - Defaults to StoryPoints when getFields throws (D-20 path).

  No vitest tests for the React modal itself (manual QA covers UI per company standard, per `.planning/PROJECT.md` Constraints).
- **D-31:** **No CMMI org probe in Phase 3.** REQUIREMENTS.md PHASE 5 D-14 already calls for a fresh CMMI trial org during Phase 5 final smoke. Phase 3 verifies FIELD-02's CMMI fallback via unit tests (D-30) and a manual cezari run on Agile work items. The CMMI live test is a Phase 5 deliverable.

### Claude's Discretion
- Exact module split inside `src/ado/` (single `bridge.ts` vs split per concern) — planner picks.
- Whether the `azure-devops-ui` `Page` from Phase 2 is reused or replaced with a flatter container — planner picks; either renders the same chrome.
- Spinner vs skeleton specifics for D-24 — planner picks; whatever `azure-devops-ui` ships native that fits the dropdown shape.
- Toast/MessageBar library choice for D-20 — planner picks from `azure-devops-ui` primitives.
- Exact MessageCard wording for the no-field UI (D-19) and the read-error banners (D-25) — planner picks; user signed off on the conceptual content.
- Whether stub-Apply (D-27) lives directly in `modal.tsx` or in a separate `applyHandler.ts` that Phase 4 will fill in — planner picks; the latter is friendlier to Phase 4's diff.
- How keyboard nav is implemented (whether `azure-devops-ui` Dropdown handles Enter natively or a custom keydown handler is needed) — planner verifies on cezari and decides.
- Modal width and height units (px vs ADO size enum) — planner picks per `openCustomDialog` API.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Locked decisions: React + azure-devops-ui, public Marketplace, Apply (not auto-write), comment-first → field-write (D-01 in PROJECT.md), FieldResolver lives in v1.
- `.planning/REQUIREMENTS.md` §UI / §FIELD / §APPLY — UI-03, UI-04, UI-05, UI-07, UI-08, FIELD-01..04, APPLY-01..03 (the 12 requirements Phase 3 covers). **⚠ FIELD-04 wording MUST be updated by the planner per D-17.**
- `.planning/ROADMAP.md` §Phase 3 — Goal and 5 success criteria.

### Research
- `.planning/research/SUMMARY.md` — Architecture highlights for read path, IWorkItemFormService, WorkItemTrackingRestClient.
- `.planning/research/ARCHITECTURE.md` — Iframe sandbox + SDK lifecycle, contribution wiring, dialog open flow. Same constraints as Phase 2.
- `.planning/research/PITFALLS.md` Pitfall 1 — Field reference name variability across processes (the entire reason FieldResolver exists). Read carefully before implementing FieldResolver.
- `.planning/research/PITFALLS.md` Pitfall 2 — Sentinel comment parsing — already mitigated by Phase 1's parser; Phase 3 just consumes `parseLatest`.
- `.planning/research/PITFALLS.md` Pitfall 6 — Toolbar lifecycle traps (state leaks, double-fire). The lazy-probe choice (D-16) avoids most of these by keeping the toolbar simple.
- `.planning/research/STACK.md` — `azure-devops-ui@2.272.0` Dropdown / MessageCard / Spinner / Surface / Page / Header components used in this phase; `azure-devops-extension-api@4.270.0` for `WorkItemTrackingRestClient` and `IWorkItemFormService`.

### Phase 0 artifacts (carry forward)
- `.planning/phases/00-bootstrap-prerequisites/00-CONTEXT.md` — Atomicity ordering D-01..D-04 (governs Phase 4, but stub-Apply D-27 must build the comment payload in the order Phase 4 will use); src/ layout D-05; module boundaries.

### Phase 1 artifacts (consumed in Phase 3)
- `src/calc/index.ts` — Public API: `LEVELS`, `Level`, `Score`, `calculate({ c, u, e })`, `weightedSum`, `rawSp`, `roundFib`, `FibonacciSp`. The modal calls `calculate()` on every dropdown change to drive the live calc panel.
- `src/audit/index.ts` — Public API: `serialize`, `parse`, `parseLatest`, `AuditPayload`, `AdoComment`. The modal calls `parseLatest(comments)` for pre-fill (APPLY-03) and `serialize(payload)` to build the stub-Apply log line (D-27); Phase 4 uses `serialize` for the real comment POST.
- `.planning/phases/01-calc-engine-audit-parser/01-01-SUMMARY.md` and `01-02-SUMMARY.md` — what was built; reference when deciding how the modal imports them.

### Phase 2 artifacts (extended in Phase 3)
- `.planning/phases/02-manifest-shell-sdk-integration/02-CONTEXT.md` — Modal config = `{ workItemId }` only (D-10); SDK lifecycle discipline (D-12); `azure-devops-ui` Surface/Page chrome (D-04); dev-publish wrapper (D-03).
- `src/entries/modal.tsx` — Phase 2's working "Hello" shell. Phase 3 replaces the `<Hello>` component with the real calculator while keeping the bootstrap (init → ready → render → notifyLoadSucceeded) intact.
- `src/entries/toolbar.tsx` — Phase 2's working toolbar action handler. Phase 3 does NOT modify this (lazy-probe D-16 keeps the toolbar untouched).
- `src/ado/types.ts` — Existing `CalcSpModalConfig`. Phase 3 extends with read-path types (e.g., `ResolvedField`, `CalcSpReadResult`).
- `scripts/dev-publish.cjs` — Phase 2 wrapper for the `tfx extension publish --share-with cezari` loop. Phase 3 reuses unchanged.

### External
- Microsoft Learn: `IWorkItemFormService` API reference — `getFields()`, `getFieldValue(refName)` (and the multi-field variant if it exists).
- Microsoft Learn: `WorkItemTrackingRestClient.getComments` — request/response shape and pagination behavior.
- Microsoft Learn: `azure-devops-ui` Dropdown — props, `onSelect` callback shape, `placeholder`.
- Microsoft Learn: `azure-devops-ui` MessageCard — severity options, dismissable behavior.
- Microsoft Learn: `IHostPageLayoutService.openCustomDialog` `IDialogOptions` — `getDialogResult` / footer button mechanics for D-08.
- `microsoft/azure-devops-extension-sample` GitHub repo — `Samples/work-item-form-page` and `Samples/work-item-comments` show the read-path patterns.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/calc/`** (Phase 1, locked) — pure calc engine. The modal imports `LEVELS`, `Level`, `calculate`, `levelToScore` from `src/calc/index.ts`. No mocking needed.
- **`src/audit/`** (Phase 1, locked) — sentinel parser/serializer. The modal imports `parseLatest` (read path) and `serialize` (stub-Apply log payload + Phase 4's real write). The `AdoComment` type already mirrors the WorkItemTracking REST client's Comment shape — Phase 3 maps the live REST response onto it at the bridge layer.
- **`src/entries/modal.tsx`** (Phase 2) — working SDK lifecycle (`init({loaded:false}) → ready → render → notifyLoadSucceeded`). Phase 3 replaces the body of the `Hello` component but preserves the bootstrap shell; the `ConfigError` component pattern for "missing workItemId" stays as-is.
- **`src/entries/toolbar.tsx`** (Phase 2) — working toolbar action that opens the dialog with `{ workItemId }` configuration. Phase 3 does not modify it.
- **`src/ado/types.ts`** — `CalcSpModalConfig` exists. Phase 3 extends this file (or splits into `src/ado/types.ts` + `src/ado/index.ts`) with read-path types.
- **`scripts/dev-publish.cjs`** — Phase 2 dev-publish wrapper. Reused for Phase 3's manual verification loop.
- **Webpack/Vite config + `vss-extension.json`** — already declares the modal HTML entry. Phase 3 doesn't touch the build config or manifest.

### Established Patterns
- **SDK lifecycle discipline** — Phase 2 D-12: every iframe entry follows `SDK.init({loaded:false}) → await SDK.ready() → register or read config → notifyLoadSucceeded`. Phase 3's modal extends the read-config branch with the read path before calling `notifyLoadSucceeded`.
- **`azure-devops-ui` Surface + Page** — Phase 2 wraps content in `Surface(SurfaceBackground.neutral) > Page > Header + body`. The host theme flows through automatically (no detection code, per Phase 2 D-13). Phase 3 keeps this wrapper.
- **`isolatedModules: true` + const enum workaround** — Phase 2 inlines string literals for SDK service IDs (e.g., `HOST_PAGE_LAYOUT_SERVICE_ID = "ms.vss-features.host-page-layout-service"`). Phase 3 follows the same pattern for `WorkItemFormService`'s service ID and any other CommonServiceIds reference.
- **`[sp-calc/...]` console-log prefix** — Phase 2 uses `[sp-calc/toolbar]` and `[sp-calc/modal]`. Phase 3's stub-Apply uses `[sp-calc/apply]` (D-27); FieldResolver uses `[sp-calc/field]`.
- **No imports of `azure-devops-extension-api`'s `CommonServiceIds` const enum at runtime** — string literal pattern from Phase 2.
- **No mocks for SDK in unit tests** — Phase 1 modules stayed SDK-free. Phase 3's FieldResolver tests use a hand-rolled fake `IWorkItemFormService` (`{ getFields: vi.fn() }`-style) at the test boundary, not a full SDK mock.

### Integration Points
- **Modal iframe → SDK** — extends Phase 2's bootstrap with `SDK.getService<IWorkItemFormService>("ms.vss-work-web.work-item-form")` to access `getFields` / `getFieldValue`, and `getClient(WorkItemTrackingRestClient)` for `getComments`.
- **Modal iframe → calc engine** — pure import from `src/calc/`. Live update on dropdown change calls `calculate({ c, u, e })`.
- **Modal iframe → audit parser** — pure import from `src/audit/`. `parseLatest(comments)` runs once after `getComments` returns.
- **`src/field/` (new)** — FieldResolver module, called from `modal.tsx` after `SDK.ready()` and before rendering the form body.
- **`src/ado/` (extended)** — bridge wrappers between the SDK / REST clients and the modal's render code. Keeps the SDK surface area at one boundary.

</code_context>

<specifics>
## Specific Ideas

- **Provenance banner copy:** `Pre-filled from your last calculation on May 1, 2026.` (absolute date via `Intl.DateTimeFormat`; locale follows the host browser).
- **Mismatch addendum:** `Field currently shows 5 — may have been edited directly.` (only when sentinel.sp ≠ getFieldValue result; same banner, severity stays Info).
- **Read-error banner:** `Could not load prior calculations — starting fresh.` (severity Warning; appears when `getComments` fails).
- **No-field message:** `This work item type ({typeName}) doesn't have a Story Points field. The Story Point Calculator works on work item types that include Microsoft.VSTS.Scheduling.StoryPoints (Agile/Scrum/Basic processes) or Microsoft.VSTS.Scheduling.Size (CMMI process).` (severity Info; one Close button).
- **FieldResolver-fail toast:** `Could not detect field type — assuming Microsoft.VSTS.Scheduling.StoryPoints.`
- **Stub-Apply log format:** `[sp-calc/apply] would write SP=3, fieldRefName=Microsoft.VSTS.Scheduling.StoryPoints, comment=<!-- sp-calc:v1 {"sp":3,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->`
- **Em-dash character:** U+2014 — same as Phase 2's "Story Point Calculator — Hello" string. Reuse for the calc panel placeholders.
- **Dropdown order in source:** iterate `LEVELS` array directly — already in `Very Easy → Very Hard` order, so no reverse step needed (D-10).
- **Hero Final SP rendering:** prefer an `azure-devops-ui` heading component (or a styled `<h1>`/`<h2>` if the library doesn't expose what's needed) over a custom font-size override, to inherit theme typography tokens.

</specifics>

<deferred>
## Deferred Ideas

- **Toolbar button disabled at form load (eager probe)** — Phase 3 chose lazy probe (D-16). If user feedback after publish shows the lazy approach is confusing (users repeatedly clicking on Task work items expecting it to work), revisit in a v1.x patch by adding a conservative `IWorkItemNotificationListener.onLoaded` probe and disabling the toolbar entry. Document this as a follow-up in PROJECT.md after Phase 5.
- **Custom field-rename support** — Out of scope per PROJECT.md. Defer to a possible v2 after user demand is confirmed.
- **Configurable level labels per dimension** — v2 SETT-04. Phase 3 stays on the fixed LEVELS strings.
- **Hot-reload dev experience** — same as Phase 2 deferred; not pursued.
- **Bundle-size CI gate** — Phase 5 PKG-03; Phase 3 stays manual.
- **Branded marketplace icon / screenshots** — Phase 5.
- **Permission pre-check disabling Apply (APPLY-09)** — Phase 4.
- **Overwrite confirmation panel "Current X / New Y" (APPLY-04)** — Phase 4.
- **Real write-path failure UX (status-code-specific toasts, RuleValidationException) (APPLY-08)** — Phase 4.

</deferred>

---

*Phase: 3-Modal UI & Read Path*
*Context gathered: 2026-05-02*
