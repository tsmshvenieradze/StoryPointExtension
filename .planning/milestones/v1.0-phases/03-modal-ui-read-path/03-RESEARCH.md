# Phase 3: Modal UI & Read Path - Research

**Researched:** 2026-05-02
**Domain:** Azure DevOps work item modal UI (React 18 + `azure-devops-ui` 2.272.0) wired to `IWorkItemFormService` + Work Item Tracking REST client; FieldResolver across Agile/Scrum/Basic/CMMI processes; sentinel-comment pre-fill via Phase 1 audit module.
**Confidence:** HIGH on SDK/API surface (verified directly against installed `node_modules` `.d.ts` files + Microsoft Learn 2026-04-03); HIGH on `azure-devops-ui` Dropdown/MessageCard/Spinner shape (verified against `node_modules` `.d.ts`); MEDIUM on `openCustomDialog` close-from-inside semantics (no documented mechanism — verified by exhausting the typed API surface and Microsoft Learn).

## Summary

Phase 3 replaces Phase 2's Hello payload with the calculator UI. The integration surface is small (one `azure-devops-ui` Dropdown × 3, one MessageCard banner, one Spinner during async load, body-rendered Apply/Cancel buttons) and the critical SDK touchpoints are well-typed in the installed packages. Phase 1's pure modules (`calculate`, `serialize`, `parseLatest`) are imported directly with no boundary work.

There are **two findings that override locked CONTEXT.md decisions** and one that requires a REQUIREMENTS.md edit; the planner must address them before plans are written:

1. **D-08 (Apply/Cancel in host dialog footer) is not feasible.** Microsoft Learn's `IDialogOptions` exposes only `title`, `configuration`, `lightDismiss`, `onClose` — no footer/button properties. `IHostPageLayoutService` has no `closeCustomDialog` method. There is no documented programmatic-close mechanism for `openCustomDialog`. Apply/Cancel must be rendered inside the modal body. Cancel becomes UX-redundant with the host's X / Esc / lightDismiss.
2. **APPLY-02 / D-22 read-path bridge cannot use the typed `WorkItemTrackingRestClient.getComments()`.** The typed client points at the LEGACY `5.0-preview.2` route (`/comments/{revision}`) returning `WorkItemComment[]` shape (no `id`, no `isDeleted`, has `revisedDate` not `createdDate`). The audit module's `parseLatest` requires `id`/`isDeleted`/`createdDate`. Phase 3's bridge MUST call the modern `7.1-preview.4` endpoint, either by subclassing `RestClientBase` and using `protected beginRequest`, or by raw `fetch` + `SDK.getAccessToken()`.
3. **D-17: REQUIREMENTS.md FIELD-04 wording needs an edit.** The phase plan must include a task to rewrite FIELD-04 to match the lazy-probe decision. Already surfaced in CONTEXT.md.

**Primary recommendation:** Plan Phase 3 as five waves: (W1) `src/field/FieldResolver.ts` pure module + unit tests; (W2) `src/ado/bridge.ts` extending `WorkItemTrackingRestClient` for modern comments + `IWorkItemFormService` wrappers; (W3) Modal UI components (Dropdown trio + Calc panel + banner) wired to Phase 1's `calculate`; (W4) Stub-Apply handler (`src/apply/stubApply.ts`) consuming Phase 1's `serialize`; (W5) REQUIREMENTS.md FIELD-04 rewrite + manual verification on cezari. No new bundling, no manifest changes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Modal Layout & Structure (D-01..D-08)
- **D-01:** Stacked vertical layout — header → context line → optional pre-fill banner → three dropdowns → Calculation Details panel → host dialog footer with Apply/Cancel. Single column. Reads top-to-bottom. No two-column or inline layout.
- **D-02:** Modal title `Calculate Story Points` — rendered via host dialog title (`openCustomDialog`'s `title` option). Body Header may be omitted to save vertical space since host chrome already shows the title.
- **D-03:** Context line below header: `Work item #{workItemId} · "{title}" · Current Story Points: {value}` (or `· Current Story Points: —` when null). Title from `IWorkItemFormService.getFieldValue("System.Title")`. Subtle, not hero.
- **D-04:** Calculation Details panel — hero Final SP. Final SP rendered as a large bold number (heading style, ~24px+). W and Raw SP shown smaller. Formula text always visible: `W = 0.4·C + 0.4·U + 0.2·E` and `SP = round_fib(0.5 × 26^((W−1)/4))`.
- **D-05:** Empty/initial state of calc panel — em-dash placeholders (`—`) for W, Raw SP, Final SP until all three dropdowns are selected. Formula text visible from start. Panel always rendered.
- **D-06:** Modal sizing — fit content, no scrollbar. Per user direction: small modal, no scroll. Planner verifies on cezari that the full modal renders without a vertical scrollbar at host's default dialog height. If host default isn't tall enough, no `IDialogOptions` height knob exists (see Override 1 below) — Phase 3 must rely on natural content sizing + `azure-devops-ui` defaults.
- **D-07:** Dropdown empty placeholder — `Select level…` for each of the three dropdowns. No default selection.
- **D-08:** ⚠ **OVERRIDE REQUIRED** — Apply + Cancel sit in the host dialog footer. **VERIFIED INFEASIBLE** in this SDK version. See Override 1 below: render Apply/Cancel inside the modal body using `azure-devops-ui` ButtonGroup. User must approve override at planning gate.

#### Level Labels & Order (D-09..D-11)
- **D-09:** Exact engine labels — `Very Easy / Easy / Medium / Hard / Very Hard` verbatim from `LEVELS` in `src/calc/levels.ts`. No display variants.
- **D-10:** Dropdown order: Very Easy first, then Easy, Medium, Hard, Very Hard.
- **D-11:** Cancel closes immediately — no "discard your selections?" confirmation.

#### Pre-fill UX from Prior Sentinel (D-12..D-15)
- **D-12:** Silently populate dropdowns + show provenance banner. When `parseLatest(comments)` returns valid payload, fill the three dropdowns and render an `azure-devops-ui` MessageCard at the top: `Pre-filled from your last calculation on {absolute date}.` Banner is dismissable. Apply enabled immediately.
- **D-13:** Date format — absolute (`on May 1, 2026`) via `Intl.DateTimeFormat`. Locale-aware.
- **D-14:** Mismatch handling — when sentinel.sp ≠ current SP, banner adds: `Field currently shows {currentSP} — may have been edited directly.` Severity stays Info (not Warning).
- **D-15:** Bad sentinel payload → treat as no pre-fill. If `parseLatest` returns null OR the payload's `c/u/e` aren't valid `Level` strings, modal opens empty (no pre-fill, no banner). `console.warn` for debugging.

#### FieldResolver — Probe & Cache (D-16..D-21) [⚠ FIELD-04 SCOPE REFINEMENT]
- **D-16:** Lazy probe on modal open. Toolbar button is always enabled. On click, modal opens; FieldResolver runs as part of the read path; if neither `Microsoft.VSTS.Scheduling.StoryPoints` nor `Microsoft.VSTS.Scheduling.Size` is present, modal renders the no-field message UI. No `IWorkItemNotificationListener` integration in toolbar entry.
- **D-17:** ⚠ **FIELD-04 scope refinement — must update `.planning/REQUIREMENTS.md`.** REQUIREMENTS.md FIELD-04 currently reads: *"...the toolbar button is rendered disabled with a tooltip..."* The user explicitly chose lazy-probe (D-16), so FIELD-04 must be re-stated as: *"When neither field is present on the work item type, the modal opens and shows a clear message explaining which work item types are supported, with a Close button. The toolbar button remains enabled."* The planner MUST include a task to update REQUIREMENTS.md FIELD-04 wording before Phase 3 closes.
- **D-18:** FIELD-03 cache — in-memory, modal iframe lifetime. Module-level `Map<string, "StoryPoints" | "Size" | null>` keyed by `${projectId}|${workItemTypeName}`. Modal iframe is fresh per dialog open in ADO's host (verified — host-managed dialog framework destroys + recreates iframe per `openCustomDialog`).
- **D-19:** No-field modal UI — plain message + Close. When FieldResolver returns null, render a centered `azure-devops-ui` MessageCard (severity=Info) explaining supported types. One Close button.
- **D-20:** FieldResolver failure → default to StoryPoints + warning toast/MessageCard. If `getFields()` throws/rejects, assume `Microsoft.VSTS.Scheduling.StoryPoints` and continue rendering. Show warning: *"Could not detect field type — assuming Microsoft.VSTS.Scheduling.StoryPoints."*
- **D-21:** FieldResolver lives in `src/field/` as a pure module that takes an `IWorkItemFormService` (or thin abstraction) and returns the resolved reference name. Unit-tested with a fake form service.

#### Read Path — Bridge & Loading States (D-22..D-26)
- **D-22:** ADO bridge in `src/ado/` — extend `src/ado/types.ts` with read-path types and add bridge files. Wraps `IWorkItemFormService.getFields()`, `IWorkItemFormService.getFieldValue(refName)`, `IWorkItemFormService.getFieldValue("System.Title")`, modern `getComments` REST endpoint.
- **D-23:** REST API version for `getComments` — the `azure-devops-extension-api/WorkItemTracking` v4 client handles the version internally. ⚠ **OVERRIDE REQUIRED** — see Override 2 below: the typed client uses LEGACY `5.0-preview.2`. Phase 3 must call modern `7.1-preview.4` via `beginRequest` subclass or raw fetch.
- **D-24:** Loading state — skeleton dropdowns + spinner header. Modal layout (header, dropdowns, calc panel, footer) renders immediately. Dropdowns show `disabled: true` + an `azure-devops-ui` Spinner overlay until the read path completes.
- **D-25:** `getComments` failure → open with no pre-fill + warning banner. Modal opens normally with empty dropdowns; MessageCard severity=Warning at top: *"Could not load prior calculations — starting fresh."* Console-log error details. No retry button.
- **D-26:** `getFieldValue` (current SP) failure → display `—`. Context line shows `Current Story Points: —`. Don't block. Don't add a banner.

#### Apply Boundary & Phase 3 Verification (D-27..D-31)
- **D-27:** Apply is wired-but-stubbed in Phase 3. Click handler reads dropdown selections → `calculate({c,u,e})` → `serialize(payload)` → `console.log("[sp-calc/apply] would write SP=N", { sp, comment, fieldRefName })` → closes the dialog (or attempts to — see Override 1). NO `setFieldValue`, NO `addComment`.
- **D-28:** Apply disabled until all three dropdowns are selected per UI-05.
- **D-29:** Phase 3 verification — manual on cezari + light unit tests. 12-step manual checklist (lives in `03-VERIFICATION.md`).
- **D-30:** Light vitest unit tests for FieldResolver (StoryPoints present, Size fallback, both absent → null, cache by key, defaults to StoryPoints when getFields throws). No vitest tests for the React modal itself.
- **D-31:** No CMMI org probe in Phase 3. CMMI live test is a Phase 5 deliverable.

### Claude's Discretion
- Exact module split inside `src/ado/` (single `bridge.ts` vs split per concern)
- Whether `azure-devops-ui` Page from Phase 2 is reused or replaced with a flatter container
- Spinner vs skeleton specifics for D-24
- Toast/MessageBar library choice for D-20 — pick from `azure-devops-ui` primitives (recommendation: MessageCard severity=Warning at top of body, since `GlobalMessagesService.addToast` is for host-level toasts and may not display reliably from a dialog iframe)
- Exact MessageCard wording for the no-field UI (D-19) and read-error banners (D-25)
- Whether stub-Apply (D-27) lives directly in `modal.tsx` or in a separate `applyHandler.ts` (recommendation: separate `src/apply/stubApply.ts` so Phase 4 swaps in the real handler with a one-file diff)
- How keyboard nav is implemented — `azure-devops-ui` Dropdown handles keyboard natively (verified against `node_modules` types)
- Modal width and height units — see Override 1; not pinnable via `IDialogOptions`

### Deferred Ideas (OUT OF SCOPE)
- Toolbar button disabled at form load (eager probe) — revisit post-Phase-5 if user feedback shows lazy approach is confusing
- Custom field-rename support — out of scope per PROJECT.md
- Configurable level labels per dimension — v2 SETT-04
- Hot-reload dev experience — not pursued
- Bundle-size CI gate — Phase 5 PKG-03
- Branded marketplace icon / screenshots — Phase 5
- Permission pre-check disabling Apply (APPLY-09) — Phase 4
- Overwrite confirmation panel "Current X / New Y" (APPLY-04) — Phase 4
- Real write-path failure UX — Phase 4
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **UI-03** | Modal renders three labeled dropdowns (Complexity, Uncertainty, Effort), each with the five level options, using `azure-devops-ui` Dropdown components | Verified Dropdown shape in §`azure-devops-ui` Component API: `IListBoxItem<T>` + `IListSelection`-based selection, `placeholder`, `ariaLabel`, `disabled`, `className`. Maps `LEVELS` (5 items) to `IListBoxItem[]` with `id: level`, `text: level`, iterating in array order = Very Easy → Very Hard (D-10). |
| **UI-04** | Modal displays a live read-only "Calculation Details" panel showing W (2 decimals), Raw SP (2 decimals), Final SP (integer/0.5), and the formula | Phase 1's `calculate({c, u, e})` returns `{ w, rawSp, sp }` — pure function, called on every dropdown change (`useState` for selection trio + `useMemo` of `calculate(...)` keyed on the trio). 2-decimal formatting via `value.toFixed(2)`. |
| **UI-05** | Apply and Cancel buttons; Apply disabled until all three dropdowns have a selection | Override 1 — buttons rendered inside body. Apply disabled state = `c === undefined \|\| u === undefined \|\| e === undefined`. `azure-devops-ui` Button supports `disabled?: boolean` and `primary?: boolean` (verified). |
| **UI-07** | Modal is fully keyboard-navigable: Tab moves between dropdowns, Enter confirms a dropdown selection, Esc cancels, Tab to Apply + Enter applies | `azure-devops-ui` Dropdown is built on FocusZone + ListBox with native keyboard handling (Tab in/out, Up/Down within callout, Enter activates, Esc dismisses callout); verified in `Components/Dropdown/Dropdown.d.ts`. Esc-to-close-dialog is host-level behavior (works automatically because `lightDismiss: true`, verified Phase 2). |
| **UI-08** | Modal applies to work items of type User Story, Bug, Task, Feature, Epic (and any other type with the resolved SP field per FIELD-02) | FieldResolver runs at modal open and decides StoryPoints vs Size vs null. Manual cezari pass exercises User Story + Bug + Task + Feature + Epic on Agile process per D-29 step 1. CMMI live test deferred to Phase 5 (D-31). |
| **FIELD-01** | FieldResolver probes the current work item type's field list via `IWorkItemFormService.getFields()` (or equivalent SDK call) at modal open | Verified API: `IWorkItemFormService.getFields(): Promise<WorkItemField[]>`. Each `WorkItemField` has `referenceName: string` (and `name`, `readOnly`, `isDeleted`, etc.). |
| **FIELD-02** | Returns `Microsoft.VSTS.Scheduling.StoryPoints` when present (Agile, Scrum, Basic); falls back to `Microsoft.VSTS.Scheduling.Size` (CMMI) when StoryPoints absent | Pure-logic priority lookup over the `WorkItemField[]` array. No SDK quirk involved. Filter on `isDeleted !== true` defensively. |
| **FIELD-03** | FieldResolver caches the resolved reference name per `(projectId, workItemTypeName)` for the lifetime of the iframe | D-18 in-memory module-level Map; key = `${projectId}|${workItemTypeName}`. `projectId` from `SDK.getWebContext().project.id`; `workItemTypeName` from `IWorkItemFormService.getFieldValue("System.WorkItemType")` (a `System.*` field always present on every WI type). |
| **FIELD-04** | (RE-WORDED per D-17) When neither field is present, modal opens and shows a clear message; toolbar button remains enabled | Phase 3 task: rewrite REQUIREMENTS.md FIELD-04 to match D-16 lazy-probe decision. D-19 specifies the message UI. |
| **APPLY-01** | On modal open, the read path fetches the current value of the resolved SP field via `IWorkItemFormService.getFieldValue()` | Verified API: `getFieldValue(refName, options?): Promise<Object>`. Result may be `undefined`/`null` for unset, or a `number` for set. Bridge wraps with `Number(value)` coercion + `Number.isFinite` guard; on error → `null` (D-26). |
| **APPLY-02** | On modal open, fetches all comments via `WorkItemTrackingRestClient.getComments()` and runs the AUDIT parser to find the most recent sentinel | ⚠ Override 2 — the typed client's `getComments` returns the LEGACY shape lacking `id`/`isDeleted`/`createdDate`. Phase 3 bridge subclasses `RestClientBase` (or extends `WorkItemTrackingRestClient`) to call modern `7.1-preview.4` endpoint via `protected beginRequest`. Returns `CommentList` with `Comment[]` matching `AdoComment` shape. |
| **APPLY-03** | When a prior sentinel comment is found, modal pre-fills the three dropdowns from its payload | `parseLatest(comments)` from Phase 1 audit module. Pre-fill seeds `useState<Level \| undefined>` for each of the three trio. D-15 catches malformed payloads (treated as no pre-fill). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render dropdowns + calc panel + buttons | Modal iframe (React app) | — | Modal iframe is the only iframe with UI; React 18 root mounted in `modal.tsx` |
| Live calc on dropdown change | Modal iframe (pure import of `src/calc/`) | — | Phase 1 `calculate()` is pure, no SDK; `useMemo` recomputes on trio change (cheap, no async) |
| Probe field list | Modal iframe → SDK `IWorkItemFormService` | — | `getFields()` requires SDK service; only available after `SDK.ready()` |
| Read current SP value | Modal iframe → SDK `IWorkItemFormService` | — | `getFieldValue(refName)` requires the live form service tied to the active work item |
| Read comments | Modal iframe → custom REST client (subclass of `WorkItemTrackingRestClient`) using `SDK.getAccessToken()` under the hood (transparent via `getClient()`) | — | Typed `getComments()` returns wrong shape; modern endpoint requires custom `beginRequest` call |
| Parse sentinel + pick most recent | Modal iframe (pure import of `src/audit/`) | — | Phase 1 `parseLatest()` is pure; takes `AdoComment[]`, returns `AuditPayload \| null` |
| Cache field resolution | Modal iframe (module-level `Map`) | — | D-18 — in-memory, iframe lifetime = dialog lifetime; no shared storage needed |
| Stub-Apply (compute + log + close) | Modal iframe (calls `calculate` + `serialize` + `console.log`) | — | Phase 3 stubs the write; Phase 4 swaps in real `setFieldValue` + `addComment` |
| Toolbar action | Toolbar iframe | Modal iframe | Already locked in Phase 2 — Phase 3 does NOT modify `src/entries/toolbar.tsx` (D-16) |

**Why this matters:** All Phase 3 logic stays in the modal iframe; the toolbar iframe is untouched (D-16). Phase 1's pure modules are the only cross-iframe-boundary imports — both are SDK-free. The bridge layer (`src/ado/`) is the single boundary for SDK + REST.

## Standard Stack

### Core (already pinned in `package.json`)

| Package | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `azure-devops-extension-sdk` | `4.2.0` | `SDK.init/ready`, `getWebContext()`, `getService<IWorkItemFormService>()`, `getAccessToken()` | Already pinned; modern SDK, ESM-native [VERIFIED: `node_modules/azure-devops-extension-sdk/SDK.d.ts`] |
| `azure-devops-extension-api` | `4.270.0` | `IWorkItemFormService`, `WorkItemTracking.WorkItemField`/`Comment`/`CommentList`, `RestClientBase`, `getClient()` | Already pinned; matches `npm view` latest as of 2026-05-02 [VERIFIED: `npm view azure-devops-extension-api version` returned `4.270.0`] |
| `azure-devops-ui` | `2.272.0` | `Dropdown`, `MessageCard`, `MessageCardSeverity`, `Spinner`, `Button`, `ButtonGroup`, `FormItem`, `Surface`, `Page`, `Header` | Already pinned; matches `npm view` latest [VERIFIED: `npm view azure-devops-ui version` returned `2.272.0`] |
| `react` / `react-dom` | `18.3.1` / `18.3.1` | Required peer of `azure-devops-ui` | Already pinned; React 19 not supported by `azure-devops-ui` 2.272 [VERIFIED: `node_modules/azure-devops-ui/package.json` peer range] |

**Version verification performed 2026-05-02:**

```bash
npm view azure-devops-ui version            → 2.272.0  (matches package.json)
npm view azure-devops-extension-api version → 4.270.0  (matches package.json)
```

No version drift. Phase 0 pins remain current.

### Supporting (no new dependencies — Phase 3 introduces zero new packages)

| Already-installed item | Purpose | When to Use |
|------------------------|---------|-------------|
| Phase 1 `src/calc/index.ts` | `calculate({c,u,e})` returning `{w, rawSp, sp}` | Called on every trio change to drive calc panel |
| Phase 1 `src/audit/index.ts` | `parseLatest(comments)` returning `AuditPayload \| null`; `serialize(payload)` returning sentinel string | Pre-fill probe + stub-Apply log line |
| Phase 1 `src/audit/types.ts` (`AdoComment`) | Structural type — `{id, text, createdDate, isDeleted?}` | Bridge maps modern REST `Comment` onto this shape |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Subclass `RestClientBase` for modern comments | Raw `fetch` + `SDK.getAccessToken()` + manual `Authorization: Bearer` header | Raw fetch is simpler (~10 lines) but loses typed-client conveniences (auth header retry, base URL resolution, correlation IDs). PITFALLS.md Anti-pattern 3 says "no hand-rolled fetch" — subclass+`beginRequest` honors that intent. **Recommend: subclass.** |
| `azure-devops-ui` MessageCard for warnings (D-20, D-25) | `GlobalMessagesService.addToast(...)` (host-level toast) | Toasts render in the host page outside the dialog; user may dismiss the dialog before seeing them; lifetime is unclear when dialog closes. **Recommend: MessageCard severity=Warning at top of body — stays scoped to the dialog and respects host theme via Phase 2's Surface/Page wrapping.** |
| `useState` per dropdown + `useMemo` of `calculate` | `useReducer` keyed to a trio object | `useState` × 3 + `useMemo` is the simpler pattern for 3 fields; reducer adds ceremony for no benefit. **Recommend: 3× `useState<Level\|undefined>` + `useMemo`.** |
| Render Apply/Cancel inside body (Override 1) | Use only the host's X button | UI-05 explicitly requires a visible "Apply" — the host's X is "cancel" only. Body buttons satisfy UI-05; the X stays as a redundant cancel affordance. **Recommend: body buttons in a footer-styled `azure-devops-ui` ButtonGroup at bottom of `Page` content.** |

**Installation:** None. Phase 3 introduces zero new packages.

## Architecture Patterns

### System Architecture Diagram

```
USER                       HOST                        TOOLBAR-ACTION             MODAL IFRAME (Phase 3)
                                                         IFRAME (Phase 2)
 │                          │                              │                          │
 │ click toolbar btn        │                              │                          │
 │─────────────────────────▶│ invoke execute()             │                          │
 │                          │─────────────────────────────▶│ openCustomDialog(        │
 │                          │                              │   id='calc-sp-modal',    │
 │                          │                              │   { workItemId } )       │
 │                          │ load modal.html ───────────────────────────────────────▶│
 │                          │                              │                          │ SDK.init({loaded:false})
 │                          │                              │                          │ await SDK.ready()
 │                          │                              │                          │
 │                          │                              │                          │ ┌─ READ PATH (parallel) ─┐
 │                          │                              │                          │ │ FieldResolver.resolve() │
 │                          │                              │                          │ │  ├ check cache          │
 │                          │                              │                          │ │  └ getFields() if miss  │
 │                          │                              │                          │ │ getFieldValue(SP refName)│
 │                          │                              │                          │ │ getFieldValue(System.Title)│
 │                          │                              │                          │ │ getCommentsModern()     │
 │                          │                              │                          │ │  └ Comment[] → AdoComment│
 │                          │                              │                          │ │ parseLatest(comments)   │
 │                          │                              │                          │ └────┬───────────────────┘
 │                          │                              │                          │      │
 │                          │                              │                          │      ▼
 │                          │                              │                          │ React render with:
 │                          │                              │                          │  ├ resolved fieldRefName
 │                          │                              │                          │  ├ currentSp value (or —)
 │                          │                              │                          │  ├ workItem title
 │                          │                              │                          │  └ pre-fill payload (or null)
 │                          │                              │                          │
 │                          │                              │                          │ notifyLoadSucceeded()
 │ see modal                │                              │                          │
 │◀──────────────────────────────────────────────────────────────────────────────────│
 │                          │                              │                          │
 │ pick C/U/E values        │                              │                          │
 │ live calc panel updates  │                              │                          │ on each change:
 │                          │                              │                          │  useMemo(() => calculate(trio))
 │                          │                              │                          │  derives {w, rawSp, sp}
 │                          │                              │                          │
 │ click Apply              │                              │                          │ stubApply():
 │─────────────────────────────────────────────────────────────────────────────────▶│  ├ calculate(trio)
 │                          │                              │                          │  ├ serialize(payload)
 │                          │                              │                          │  ├ console.log("[sp-calc/apply]…")
 │                          │                              │                          │  └ user closes via X / Esc
 │                          │                              │                          │     (no programmatic close API)
 │ click X / Esc            │                              │                          │
 │─────────────────────────▶│ host destroys iframe          │                          │
 │                          │ onClose() fires (host-side)  │                          │
 │                          │  cb runs in toolbar iframe   │                          │
 │ dialog gone              │                              │                          │
```

### Component Responsibilities (Phase 3 additions)

| File | Responsibility | Imports |
|------|----------------|---------|
| `src/field/FieldResolver.ts` (new) | Pure module: `resolve(formService, projectId, workItemTypeName)` → `"StoryPoints" \| "Size" \| null`; in-memory cache | `IWorkItemFormService` (type-only); no SDK runtime imports |
| `src/field/types.ts` (new) | `ResolvedField` union; `IFieldResolver` interface | — |
| `src/field/index.ts` (new) | Public re-exports | — |
| `src/ado/bridge.ts` (new) — or split per concern | Wraps `IWorkItemFormService` getters; subclasses `WorkItemTrackingRestClient` for modern `getCommentsModern(id, project)` returning `AdoComment[]`; coerces field values with `Number()` + `Number.isFinite` guards | `azure-devops-extension-sdk`, `azure-devops-extension-api/WorkItemTracking/*`, `azure-devops-extension-api/Common/RestClientBase`, `../audit/types` (for `AdoComment`) |
| `src/ado/types.ts` (existing — extended) | Add `ResolvedField`, `CalcSpReadResult`, `WorkItemContext` types | `../audit/types` |
| `src/ui/CalcModal.tsx` (new) | Top-level React component — orchestrates read path, holds trio state, renders three Dropdowns + calc panel + body buttons + banner | `react`, `azure-devops-ui/*`, `../calc`, `../audit`, `../ado/bridge`, `../field` |
| `src/ui/Dropdown3.tsx` (new) | One labeled Dropdown — props: `label`, `value: Level \| undefined`, `onChange(Level)`, `disabled`, `loading` | `react`, `azure-devops-ui/Dropdown`, `azure-devops-ui/List`, `../calc` |
| `src/ui/CalcPanel.tsx` (new) | Read-only panel — props: `result: CalcResult \| null` (null → em-dashes); renders W, Raw SP, hero Final SP, formula text | `react`; pure render, no logic |
| `src/ui/PreFillBanner.tsx` (new) | MessageCard severity=Info — props: `dateISO: string`, `mismatchSp: number \| null`; rendered only when payload found | `react`, `azure-devops-ui/MessageCard` |
| `src/ui/ReadErrorBanner.tsx` (new) | MessageCard severity=Warning — fixed copy ("Could not load…") | `react`, `azure-devops-ui/MessageCard` |
| `src/ui/NoFieldMessage.tsx` (new) | MessageCard severity=Info — fixed copy + Close button (in body since no host close API) | `react`, `azure-devops-ui/MessageCard`, `azure-devops-ui/Button` |
| `src/apply/stubApply.ts` (new — Claude's discretion D-27 recommendation) | `stubApply(input: ApplyInput): void` — reads selections, calls `calculate`, builds payload, calls `serialize`, console.logs. Phase 4 replaces with real handler | `../calc`, `../audit` |
| `src/entries/modal.tsx` (existing — gutted) | Replace `<Hello>` with `<CalcModal config={config} />`; keep bootstrap (init→ready→render→notifyLoadSucceeded) intact; keep `<ConfigError>` fallback | `react`, `react-dom`, `azure-devops-extension-sdk`, `../ui/CalcModal`, `../ado/types` |

### Recommended Project Structure

```
src/
├── ado/
│   ├── bridge.ts           # NEW — wrapper functions + ModernCommentsClient subclass
│   ├── types.ts            # EXTENDED — adds ResolvedField, CalcSpReadResult, WorkItemContext
│   └── index.ts            # NEW — re-exports
├── apply/
│   └── stubApply.ts        # NEW — Phase 3 stub; Phase 4 replaces
├── audit/                  # Phase 1 — UNCHANGED
├── calc/                   # Phase 1 — UNCHANGED
├── entries/
│   ├── modal.tsx           # GUTTED — replace <Hello> with <CalcModal>
│   └── toolbar.tsx         # UNCHANGED (D-16)
├── field/
│   ├── FieldResolver.ts    # NEW — pure logic + cache
│   ├── types.ts            # NEW — ResolvedField type
│   └── index.ts            # NEW — re-exports
└── ui/
    ├── CalcModal.tsx       # NEW — top-level orchestrator
    ├── CalcPanel.tsx       # NEW — read-only details panel
    ├── Dropdown3.tsx       # NEW — labeled Dropdown wrapper (3× instance)
    ├── NoFieldMessage.tsx  # NEW — D-19 surface
    ├── PreFillBanner.tsx   # NEW — D-12/D-14 surface
    └── ReadErrorBanner.tsx # NEW — D-25 surface
tests/
├── calc/                   # Phase 1 — UNCHANGED
├── audit/                  # Phase 1 — UNCHANGED
└── field/
    └── FieldResolver.test.ts  # NEW — 5 tests per D-30
```

### Pattern 1: Module-Level Cache for FieldResolver (FIELD-03)

**What:** A `Map<string, ResolvedField>` lives at module scope inside `src/field/FieldResolver.ts`. Lifetime = JS module evaluation = iframe lifetime.

**When to use:** Per-iframe caching where the cached data is cheap to recompute and the iframe is short-lived (modal dialog).

**Example:**

```typescript
// src/field/FieldResolver.ts
// Source: D-18, D-21; verified IWorkItemFormService.getFields shape against
// node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts
import type { IWorkItemFormService } from "azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices";

export type ResolvedField =
  | "Microsoft.VSTS.Scheduling.StoryPoints"
  | "Microsoft.VSTS.Scheduling.Size"
  | null;

const CACHE: Map<string, ResolvedField> = new Map();
const STORY_POINTS = "Microsoft.VSTS.Scheduling.StoryPoints";
const SIZE = "Microsoft.VSTS.Scheduling.Size";

export interface ResolveArgs {
  formService: Pick<IWorkItemFormService, "getFields">;
  projectId: string;
  workItemTypeName: string;
}

export async function resolve(args: ResolveArgs): Promise<ResolvedField> {
  const key = `${args.projectId}|${args.workItemTypeName}`;
  if (CACHE.has(key)) return CACHE.get(key)!;

  let resolved: ResolvedField;
  try {
    const fields = await args.formService.getFields();
    const refNames = new Set(
      fields.filter((f) => f.isDeleted !== true).map((f) => f.referenceName),
    );
    if (refNames.has(STORY_POINTS)) resolved = STORY_POINTS;
    else if (refNames.has(SIZE)) resolved = SIZE;
    else resolved = null;
  } catch (err) {
    console.warn("[sp-calc/field] getFields() failed; defaulting to StoryPoints", err);
    resolved = STORY_POINTS; // D-20
  }

  CACHE.set(key, resolved);
  return resolved;
}

// Only for tests — not exported from index.ts
export function _resetCacheForTests(): void {
  CACHE.clear();
}
```

### Pattern 2: Subclass `WorkItemTrackingRestClient` for Modern Comments

**What:** Extend the typed client and use `protected beginRequest` to call `7.1-preview.4` directly.

**When to use:** When the typed client's method signature is wrong or points at a deprecated route, but you want to keep the auth/CORS/correlation infrastructure of the typed client family.

**Example:**

```typescript
// src/ado/bridge.ts (excerpt)
// Source: D-22, D-23 override; verified WorkItemTrackingRestClient shape against
// node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingClient.d.ts
// and modern endpoint shape against
// https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/get-comments?view=azure-devops-rest-7.1
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import type { AdoComment } from "../audit/types";

interface ModernCommentDto {
  id: number;
  text: string;
  createdDate: string;   // ISO 8601 over the wire
  isDeleted: boolean;
  workItemId: number;
  version: number;
  // ...other fields ignored
}

interface ModernCommentList {
  comments: ModernCommentDto[];
  count: number;
  totalCount: number;
  nextPage?: string;
  continuationToken?: string;
}

class ModernCommentsClient extends WorkItemTrackingRestClient {
  /**
   * Calls the modern Get Comments endpoint:
   *   GET /_apis/wit/workItems/{id}/comments?api-version=7.1-preview.4
   * Returns the modern Comment shape with id/createdDate/isDeleted, suitable
   * for AdoComment / parseLatest. The typed client's getComments() is locked
   * at the LEGACY 5.0-preview.2 route returning WorkItemComment (no id, no
   * isDeleted) — so we override with beginRequest.
   */
  async getCommentsModern(workItemId: number, project: string): Promise<AdoComment[]> {
    const result = await this.beginRequest<ModernCommentList>({
      apiVersion: "7.1-preview.4",
      routeTemplate: "{project}/_apis/wit/workItems/{workItemId}/comments",
      routeValues: { project, workItemId },
      // includeDeleted defaults to false server-side; we filter in parseLatest anyway
    });
    return result.comments.map((c) => ({
      id: c.id,
      text: c.text,
      createdDate: c.createdDate, // already ISO 8601 string from the wire
      isDeleted: c.isDeleted,
    }));
  }
}

import { getClient } from "azure-devops-extension-api";

export async function fetchCommentsForRead(workItemId: number, projectId: string): Promise<AdoComment[]> {
  const client = getClient(ModernCommentsClient);
  return client.getCommentsModern(workItemId, projectId);
}
```

**Note:** `beginRequest` is `protected` on `RestClientBase` — TypeScript does allow access within a subclass. `getClient(ModernCommentsClient)` works because `ModernCommentsClient extends WorkItemTrackingRestClient extends RestClientBase`, and `RESOURCE_AREA_ID` (the static optional field expected by `RestClientFactory<T>`) is inherited from the parent.

### Pattern 3: `azure-devops-ui` Dropdown bound to a `Level` union

**What:** Wrap Dropdown with a typed `value`/`onChange` API, hiding the `IListSelection` mutation surface.

**Example:**

```tsx
// src/ui/Dropdown3.tsx
// Source: D-09, D-10, UI-03; verified IDropdownProps against
// node_modules/azure-devops-ui/Components/Dropdown/Dropdown.Props.d.ts
import * as React from "react";
import { Dropdown } from "azure-devops-ui/Dropdown";
import { ListSelection } from "azure-devops-ui/List";
import type { IListBoxItem } from "azure-devops-ui/ListBox";
import { LEVELS, type Level } from "../calc";

interface Dropdown3Props {
  label: string;
  ariaLabel: string;
  value: Level | undefined;
  onChange: (level: Level) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ITEMS: IListBoxItem<{ level: Level }>[] = LEVELS.map((level) => ({
  id: level,
  text: level,
  data: { level },
}));

export const Dropdown3: React.FC<Dropdown3Props> = ({
  label,
  ariaLabel,
  value,
  onChange,
  disabled,
  placeholder,
}) => {
  // Selection is a stateful object; mount-time-only per ListBox contract.
  const selection = React.useMemo(() => new ListSelection(), []);

  // Sync external value into selection imperatively (controlled-style).
  React.useEffect(() => {
    selection.clear();
    if (value !== undefined) {
      const idx = LEVELS.indexOf(value);
      if (idx >= 0) selection.select(idx);
    }
  }, [value, selection]);

  return (
    <div style={{ marginBottom: "12px" }}>
      <label
        style={{ display: "block", marginBottom: "4px", fontWeight: 600 }}
        id={`${ariaLabel}-label`}
      >
        {label}
      </label>
      <Dropdown<{ level: Level }>
        ariaLabelledBy={`${ariaLabel}-label`}
        items={ITEMS}
        selection={selection}
        placeholder={placeholder ?? "Select level…"}
        disabled={disabled}
        onSelect={(_event, item) => {
          // item.data is the typed payload we attached at construction time
          if (item?.data?.level) onChange(item.data.level);
        }}
      />
    </div>
  );
};
```

### Pattern 4: Live Calc Panel via `useMemo`

**What:** Recompute `calculate({c, u, e})` only when the trio changes; render em-dashes when any value is missing.

**Example:**

```tsx
// inside CalcModal.tsx
const [c, setC] = React.useState<Level | undefined>();
const [u, setU] = React.useState<Level | undefined>();
const [e, setE] = React.useState<Level | undefined>();

const result = React.useMemo(() => {
  if (c === undefined || u === undefined || e === undefined) return null;
  return calculate({ c, u, e });
}, [c, u, e]);

// result: null → CalcPanel renders "—" placeholders
// result: CalcResult → CalcPanel renders w/rawSp/sp formatted
```

### Anti-Patterns to Avoid

- **Anti-pattern 1: Trying to render Apply/Cancel in a host dialog footer.** Verified infeasible. `IDialogOptions` has only `title`, `configuration`, `lightDismiss`, `onClose` — no footer-button properties. Render in body. (Override 1.)
- **Anti-pattern 2: Trying to programmatically close the dialog from inside the iframe after Apply.** No `closeCustomDialog` API exists on `IHostPageLayoutService`. The user closes via X / Esc / outside-click (lightDismiss). Document the UX: Apply does its work, then user closes the dialog. (Phase 3 risk — see Common Pitfalls.)
- **Anti-pattern 3: Using the typed `WorkItemTrackingRestClient.getComments()` directly.** It calls the LEGACY `5.0-preview.2` route returning `WorkItemComment[]` with `revisedDate`/`text`/`renderedText` and NO `id`/`isDeleted`/`createdDate`. The audit module's `parseLatest` would silently fail (sort would be wrong; deleted comments would be parsed). Subclass the client and call `7.1-preview.4`. (Override 2.)
- **Anti-pattern 4: Persisting React state across modal opens.** The host destroys + recreates the modal iframe per `openCustomDialog` call (verified by Phase 2's iframe lifecycle log). Module-level caches die between dialog opens — that's why D-18's Map is "iframe lifetime ≈ dialog lifetime."
- **Anti-pattern 5: Adding a `defaultValue` to the dropdowns.** Per D-07, dropdowns start with `Select level…` placeholder. Pre-selecting Medium would anchor users.
- **Anti-pattern 6: Reading `SDK.getConfiguration()` synchronously before `await SDK.ready()`.** `getConfiguration()` returns `{}` (or stale data) until ready resolves. Phase 2's modal already does this correctly — keep the bootstrap order intact.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Three-level dropdown with keyboard support | Custom `<select>` + state | `azure-devops-ui` Dropdown + ListSelection | Native theme, focus zone, ARIA roles, callout positioning, Esc-to-dismiss [VERIFIED in `Components/Dropdown/Dropdown.Props.d.ts`] |
| Severity-typed banners | Custom div with severity color logic | `azure-devops-ui` MessageCard with `MessageCardSeverity` | Theme-aware icon + color tokens; built-in `onDismiss`; ARIA role=alert/banner [VERIFIED in `Components/MessageCard/MessageCard.Props.d.ts`] |
| Loading spinner | Custom SVG / CSS animation | `azure-devops-ui` Spinner with `SpinnerSize` | Theme-aware; matches ADO chrome animation timings [VERIFIED in `Components/Spinner/Spinner.Props.d.ts`] |
| REST auth + base URL + correlation IDs | Raw `fetch` + manual `Authorization: Bearer ${SDK.getAccessToken()}` | Subclass `WorkItemTrackingRestClient` and call `protected beginRequest` | Centralized auth refresh, retry, base-URL resolution; honors PITFALLS.md Anti-pattern 3 |
| ISO date → human label | Custom `Date` formatting | `Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(iso))` (D-13) | Locale-aware, no extra dependency |
| Sentinel comment parsing | Re-implement audit-format detection | Phase 1 `parseLatest(comments)` (already 100%-coverage tested) | Closed loop with Phase 4's eventual write |
| Calc engine | Re-implement weighted sum / Fibonacci rounding | Phase 1 `calculate({c,u,e})` (already 169 tests, 100% coverage) | Single source of truth; matches `sp_calculator.xlsx` exactly |

**Key insight:** Every concern Phase 3 has — UI primitives, calc, audit parsing, REST auth — is already solved either in `azure-devops-ui` or in Phase 1. The only place Phase 3 writes new "infrastructure" is the FieldResolver cache and the `ModernCommentsClient` subclass, both of which are <40 lines.

## Common Pitfalls

### Pitfall 1: Closing the dialog after Apply (no programmatic API)

**What goes wrong:** Phase 3 stub-Apply consoles its log line, but the dialog stays open. The CONTEXT.md description for D-27 says "Closes the dialog" as step 5 — but `IHostPageLayoutService` has no `closeCustomDialog` and the SDK has no `close()` method.

**Why it happens:** `openCustomDialog` is a one-way affordance: the host opens the dialog, the iframe runs, the host destroys the iframe when the user clicks X / Esc / outside (`lightDismiss: true`).

**How to avoid:**
1. **Best path:** Modal's Apply button does its stub-work + log, then displays a brief "Done — close this dialog" inline message and lets the user close via X / Esc. Document this in `03-VERIFICATION.md` step 8.
2. **Speculative path (verify on cezari):** Some real-world ADO extensions register a contribution object with `getResult()` / `onSubmit()` / `cancel()` methods that the **legacy** VSS dialog framework calls. The new SDK doesn't document this contract for `openCustomDialog`. **Action item for the planner:** add a 30-minute spike task to test whether `SDK.register(getContributionId(), { getResult: () => result })` triggers any host-side close behavior on cezari. If it works, use it; if not, fall back to option 1.
3. **Don't:** Use `window.close()` or try to manipulate `window.parent` — the iframe is sandboxed.

**Warning signs:**
- Apply button click logs the payload but the dialog visibly stays open
- User closes the dialog and `onClose` fires correctly in the toolbar iframe (this part already works in Phase 2)

**Phase to address:** Phase 3 — the spike task above belongs in the plan.

### Pitfall 2: Dropdown callout clipped by small dialog

**What goes wrong:** D-06 demands a small modal with no scrollbar. The `azure-devops-ui` Dropdown opens its callout downward by default. With three dropdowns stacked vertically, the third dropdown's callout (5 items × ~30px = 150px tall) may extend past the bottom edge of the iframe and be clipped or invisible.

**Why it happens:** The Dropdown callout uses an absolute-positioned div via `Callout`. The callout cannot escape the iframe document. With `portalProps`, it can escape an overflow:hidden parent, but not the iframe boundary.

**How to avoid:**
1. **Auto-flip** — `azure-devops-ui` Callout supports `anchorOrigin` / `dropdownOrigin` props that control direction. By default, the Dropdown chooses based on available space. Verify on cezari that the third dropdown's callout flips upward when there's no room below.
2. **Sized iframe** — even though `IDialogOptions` has no height knob, set the modal body's content height generously (e.g., `min-height: 380px`) so all three dropdowns + their callouts fit. The host dialog auto-fits its iframe content height in some configurations.
3. **Don't fight it** — if cezari shows clipping in practice, accept a small inner scroll on the dropdown callout (the callout itself scrolls), not on the modal body.

**Warning signs:** Dropdown 3's options are cut off at the bottom of the dialog; user has to scroll inside the callout.

**Phase to address:** Phase 3 — add a manual verification step: open all three dropdowns and confirm all 5 levels are visible.

### Pitfall 3: `getFieldValue` returns `Object` typed loosely

**What goes wrong:** `IWorkItemFormService.getFieldValue("...StoryPoints")` is typed as `Promise<Object>`. At runtime it returns `undefined` for unset fields, `number` for set numeric fields, `string` for some string-valued fields (e.g., `System.Title`). Naively trusting the value and rendering it in the context line could show `[object Object]` or undefined.

**Why it happens:** ADO's WI form supports many field types (string, integer, double, identity, datetime); the union type isn't expressed in TypeScript.

**How to avoid:** In `bridge.ts`:
```ts
async function getCurrentSpValue(formService, refName): Promise<number | null> {
  try {
    const raw = await formService.getFieldValue(refName);
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null; // D-26 — display "—" without blocking
  }
}

async function getWorkItemTitle(formService): Promise<string> {
  try {
    const raw = await formService.getFieldValue("System.Title");
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}
```

**Warning signs:** Context line shows `[object Object]` or `undefined`; manual QA on Bug type may differ from User Story.

**Phase to address:** Phase 3 — bake into `src/ado/bridge.ts`; cover with TypeScript narrowing.

### Pitfall 4: `WorkItemField.isDeleted` not filtered

**What goes wrong:** `getFields()` returns ALL fields known to the work item type, including deleted (`isDeleted: true`) ones. If the org once had a custom `Microsoft.VSTS.Scheduling.StoryPoints` field that was soft-deleted (rare but possible), FieldResolver would resolve to it and writes would fail.

**Why it happens:** ADO process customization soft-deletes fields rather than hard-deleting; the field reference name remains in the schema.

**How to avoid:** Filter `f.isDeleted !== true` before checking referenceName presence — already shown in Pattern 1 above.

**Warning signs:** None at modal-open time; surfaces only in Phase 4 when `setFieldValue` / `addComment` fails on a deleted field.

**Phase to address:** Phase 3 — bake into FieldResolver from the start (cheaper than retrofitting in Phase 4).

### Pitfall 5: `parseLatest` sort uses string comparison on `createdDate`

**What goes wrong:** Phase 1's `parseLatest` sorts comments by `b.createdDate.localeCompare(a.createdDate)`. This works correctly only because `createdDate` is ISO-8601 string (which sorts lexicographically equal to chronologically). If the bridge accidentally passes `Date` objects (e.g., the typed-client's `WorkItemComment.revisedDate` is `Date`), sort silently fails and the latest sentinel is wrong.

**Why it happens:** The modern Comments REST endpoint returns `createdDate` as ISO-8601 string over the wire. The typed `Comment` interface in `WorkItemTracking.d.ts` declares `createdDate: Date` because the client deserializes — but our bridge calls the modern endpoint via `beginRequest`, which doesn't deserialize Date objects automatically.

**How to avoid:**
- Use `beginRequest<ModernCommentList>` with the inline DTO type that declares `createdDate: string` (Pattern 2 above).
- DO NOT cast the typed `Comment` shape onto the `beginRequest` result — types disagree at runtime.
- Add a runtime sanity check in the bridge: `typeof c.createdDate === "string"` filter before mapping to `AdoComment`.

**Warning signs:** Pre-fill takes the wrong sentinel; manual test where two sentinels exist returns the older one.

**Phase to address:** Phase 3 — bake the DTO type into `bridge.ts`.

### Pitfall 6: Theme inheritance breaks for new components

**What goes wrong:** Phase 2 verified Surface + Page + Header inherit theme correctly. Phase 3 introduces Dropdown, MessageCard, Spinner, Button, ButtonGroup. If any of these are imported without their `Components/.../*.css` side-effect imports, they render with theme variables but no chrome (white box on dark theme).

**Why it happens:** `azure-devops-ui` ships per-component CSS; barrel imports (e.g., `import { Dropdown } from "azure-devops-ui/Dropdown"`) DO pull in the CSS via re-export side effects. Direct deep imports (e.g., `import { Dropdown } from "azure-devops-ui/Components/Dropdown/Dropdown"`) may bypass them.

**How to avoid:**
- Always import from the barrel paths: `from "azure-devops-ui/Dropdown"`, `from "azure-devops-ui/MessageCard"`, etc. Verified that `Dropdown.d.ts` re-exports from `Components/Dropdown/*` and the runtime CSS comes along.
- Phase 2's modal already imports `"azure-devops-ui/Core/override.css"` — keep that import; Dropdown's own `Dropdown.css` is pulled in by its component file.

**Warning signs:** Dropdown displays as plain text + native browser focus ring instead of ADO chrome; MessageCard has no background color.

**Phase to address:** Phase 3 — verify on cezari in both light and dark themes (D-29 step 12).

### Pitfall 7: SDK service ID hard-coded as string vs const enum

**What goes wrong:** Phase 2 already encountered this — `CommonServiceIds` is a `const enum` and our `isolatedModules: true` tsconfig forbids runtime use. Phase 2 worked around with a string literal `"ms.vss-features.host-page-layout-service"`. Phase 3 introduces `WorkItemFormService` (`"ms.vss-work-web.work-item-form"`) — same problem, same fix.

**How to avoid:** Use string literals, with a comment pointing at the verified source:

```typescript
// node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts
// declare enum WorkItemTrackingServiceIds { WorkItemFormService = "ms.vss-work-web.work-item-form" }
const WORK_ITEM_FORM_SERVICE_ID = "ms.vss-work-web.work-item-form";
const formService = await SDK.getService<IWorkItemFormService>(WORK_ITEM_FORM_SERVICE_ID);
```

**Phase to address:** Phase 3 — already established Phase 2 pattern; just keep using it.

## Code Examples

Verified patterns from official sources and `node_modules` `.d.ts` inspection.

### Reading Field List with Filter (FIELD-01, FIELD-02)

```typescript
// Source: IWorkItemFormService.d.ts
//   getFields(): Promise<WorkItemField[]>
//   WorkItemField has { referenceName: string; isDeleted: boolean; readOnly: boolean; ... }
// VERIFIED: node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts:73
// VERIFIED: node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTracking.d.ts:1491
const fields = await formService.getFields();
const refNames = new Set(
  fields.filter((f) => f.isDeleted !== true).map((f) => f.referenceName),
);
const resolved =
  refNames.has("Microsoft.VSTS.Scheduling.StoryPoints") ? "StoryPoints" :
  refNames.has("Microsoft.VSTS.Scheduling.Size")        ? "Size" :
  null;
```

### Reading Current SP Value (APPLY-01)

```typescript
// Source: IWorkItemFormService.d.ts:83
//   getFieldValue(fieldReferenceName: string, options?: WorkItemOptions): Promise<Object>
const raw = await formService.getFieldValue("Microsoft.VSTS.Scheduling.StoryPoints");
const num = Number(raw);
const currentSp: number | null = Number.isFinite(num) ? num : null;
```

### Reading Modern Comments (APPLY-02 — Override 2)

```typescript
// Source: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/get-comments?view=azure-devops-rest-7.1
//   GET /_apis/wit/workItems/{id}/comments?api-version=7.1-preview.4
//   Returns CommentList with comments: Comment[] having {id, text, createdDate, isDeleted, ...}
// VERIFIED: Microsoft Learn 2026-04 (web fetch confirmed shape)
class ModernCommentsClient extends WorkItemTrackingRestClient {
  async getCommentsModern(workItemId: number, project: string): Promise<AdoComment[]> {
    const list = await this.beginRequest<{ comments: ModernCommentDto[] }>({
      apiVersion: "7.1-preview.4",
      routeTemplate: "{project}/_apis/wit/workItems/{workItemId}/comments",
      routeValues: { project, workItemId },
    });
    return list.comments.map((c) => ({
      id: c.id,
      text: c.text,
      createdDate: c.createdDate, // ISO-8601 string from the wire
      isDeleted: c.isDeleted,
    }));
  }
}

const client = getClient(ModernCommentsClient);
const comments = await client.getCommentsModern(workItemId, projectId);
const payload = parseLatest(comments); // Phase 1 module — works on AdoComment[]
```

### Resolving Project ID + Work Item Type Name (FIELD-03 cache key)

```typescript
// Source: SDK.d.ts
//   getWebContext(): IWebContext { project: ContextIdentifier { id, name } }
// VERIFIED: node_modules/azure-devops-extension-sdk/SDK.d.ts:175,237
const projectId = SDK.getWebContext().project.id;

// System.WorkItemType is a built-in System.* field always present on every WI type.
const typeRaw = await formService.getFieldValue("System.WorkItemType");
const workItemTypeName = typeof typeRaw === "string" ? typeRaw : "";
```

### Pre-fill Banner with Date Format (D-12, D-13, D-14)

```typescript
// Source: D-13 — Intl.DateTimeFormat is Web Standard, no library needed.
function formatBannerDate(iso: string): string {
  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });
  return fmt.format(new Date(iso));
}

// In CalcModal:
{prefilledPayload && (
  <MessageCard
    severity={MessageCardSeverity.Info}
    onDismiss={() => setBannerDismissed(true)}
  >
    Pre-filled from your last calculation on {formatBannerDate(prefilledPayload.createdDate)}.
    {currentSp !== null && currentSp !== prefilledPayload.sp && (
      <> Field currently shows {currentSp} — may have been edited directly.</>
    )}
  </MessageCard>
)}
```

### Live Calc Panel Update (UI-04)

```tsx
// Source: src/calc/index.ts — calculate({c,u,e}): { w, rawSp, sp }
// Pure function — useMemo trivially correct.
const result = React.useMemo(() => {
  if (c === undefined || u === undefined || e === undefined) return null;
  return calculate({ c, u, e });
}, [c, u, e]);

// In CalcPanel.tsx:
<div>
  <div>W = {result ? result.w.toFixed(2) : "—"}</div>
  <div>Raw SP = {result ? result.rawSp.toFixed(2) : "—"}</div>
  <div style={{ fontSize: "28px", fontWeight: 700 }}>
    {result ? result.sp : "—"}
  </div>
  <div style={{ fontSize: "11px", opacity: 0.7 }}>
    W = 0.4·C + 0.4·U + 0.2·E; SP = round_fib(0.5 × 26^((W−1)/4))
  </div>
</div>
```

### Stub-Apply Handler (D-27)

```typescript
// src/apply/stubApply.ts — Phase 4 swaps in real handler
import { calculate, type Level } from "../calc";
import { serialize } from "../audit";
import type { ResolvedField } from "../field";

export interface StubApplyInput {
  c: Level; u: Level; e: Level;
  fieldRefName: ResolvedField; // null guarded upstream — Apply disabled when null
}

export function stubApply(input: StubApplyInput): void {
  if (input.fieldRefName === null) {
    console.warn("[sp-calc/apply] no resolved field — should be unreachable");
    return;
  }
  const result = calculate({ c: input.c, u: input.u, e: input.e });
  const payload = { sp: result.sp, c: input.c, u: input.u, e: input.e, schemaVersion: 1 as const };
  const comment = serialize(payload);
  console.log("[sp-calc/apply] would write SP=" + result.sp, {
    sp: result.sp,
    fieldRefName: input.fieldRefName,
    comment,
  });
  // No close API — user closes via X / Esc. See Pitfall 1.
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `WorkItemTrackingRestClient.getComments()` (`5.0-preview.2`) returning `WorkItemComment[]` | Modern endpoint `7.1-preview.4` returning `Comment[]` | Pre-2020 Microsoft API generation | The typed client never updated; modern endpoint must be called via `beginRequest` |
| Legacy VSS SDK dialog with `getDialogResult` registered object | New SDK `openCustomDialog` with no documented programmatic-close | SDK v4 release (~2020) | Apply/Cancel must live in body; close-on-Apply not possible without spike |
| `vss-web-extension-sdk` AMD/RequireJS | `azure-devops-extension-sdk` ESM/typed | SDK v4 release | Already adopted (Phase 0) |
| Fluent UI v8 / v9 for ADO extensions | `azure-devops-ui` 2.x | Stable (since ~2018) | Already adopted (Phase 0) |

**Deprecated/outdated:**
- The `WorkItemTrackingRestClient.getComments()` method exists but its returned shape is unsuitable for Phase 3's needs — treat as deprecated for our use case.
- The pattern of registering `{ getResult, cancel }` against a contribution ID for dialog buttons (legacy VSS) is **not documented** for the new SDK and may or may not work — Phase 3 spike task to verify.

## Assumptions Log

> Claims tagged `[ASSUMED]` need user confirmation before becoming locked decisions.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The host's "X" close button + Esc + lightDismiss are sufficient UX for Cancel; users won't be confused by a body-rendered Cancel button that "duplicates" the X. | Override 1 / Common Pitfalls #1 | UX feedback may show users prefer no Cancel button OR insist on programmatic close. Mitigation: validate on cezari with one or two reviewers before Phase 3 closes; revisit copy if needed. |
| A2 | The host modal iframe is destroyed and recreated on every `openCustomDialog` call, so D-18's module-level Map is effectively per-dialog-open. | D-18 Cache Strategy | If the iframe is reused across dialog opens (host caches), the cache would persist incorrectly across project / type changes. Mitigation: low-risk — even reused, the cache key includes projectId + typeName, so wrong-context hits are impossible; only cost is staleness on a process-customization mid-session, which is rare. |
| A3 | `Intl.DateTimeFormat` produces sensible output in all browsers ADO supports without explicit locale fallback. | Code Examples — Pre-fill Banner | Older browsers might omit `dateStyle: "long"` support. Mitigation: ADO targets evergreen Chromium/Firefox/Safari (per PROJECT.md); `dateStyle: "long"` has been universally supported since 2020. LOW risk. |
| A4 | The `azure-devops-ui` Dropdown's auto-flip behavior places the callout above the trigger when there's no room below. | Common Pitfall #2 | If the callout always opens downward and the dialog is small, the third dropdown's items are clipped. Mitigation: explicit Phase 3 verification step on cezari; if false, set `dropdownOrigin` props per Dropdown to force flip. |
| A5 | `getClient(ModernCommentsClient)` works the same as `getClient(WorkItemTrackingRestClient)` because of inheritance. | Pattern 2 | If `RESOURCE_AREA_ID` is required at the leaf class level and we shadow it incorrectly, the client may resolve to the wrong base URL. Mitigation: verify on cezari that the modern getComments call actually returns valid `Comment[]`; if it 404s on resource-area resolution, copy the static `RESOURCE_AREA_ID` from `WorkItemTrackingRestClient` onto our subclass. |
| A6 | A spike to test `SDK.register(getContributionId(), { getResult: () => result })` for programmatic-close behavior will show whether legacy dialog-content contracts still work in the new SDK. | Common Pitfall #1 | If the spike succeeds, Phase 3 gains a programmatic close; if it fails, no harm — fall back to manual close. Add 30-min spike as the first task of Wave 4. |

**If this table is empty:** Not applicable — six assumptions tagged. The planner and discuss-phase should review at planning gate; A1, A4, and A6 specifically merit user input.

## Open Questions

1. **Programmatic close after Apply.**
   - What we know: `IHostPageLayoutService` has no `closeCustomDialog`; `IDialogOptions` has no callback the modal can invoke; `SDK.notifyLoadFailed()` does not close.
   - What's unclear: Whether the legacy `SDK.register("dialog-content-id", { getResult: () => result })` pattern still works in the new SDK against `openCustomDialog` (some real-world extensions seem to use it).
   - Recommendation: Add a 30-minute spike task in the plan ("verify dialog programmatic close pattern on cezari") before deciding the final Apply UX.

2. **Modal sizing.**
   - What we know: `IDialogOptions` has no `height` / `width`. The host's default dialog size is "small" (per Phase 2 verification — fits a small Hello message).
   - What's unclear: Whether `SDK.resize(w, h)` on the iframe causes the host dialog to grow around it. The Phase 2 docstring says "Requests the parent window to resize the container" — that's the iframe inside the dialog, not the dialog itself. The dialog's outer size may be host-controlled.
   - Recommendation: First render the modal with natural content size and test on cezari. If too small, try `SDK.resize(420, 380)` from the modal entry. If host doesn't honor it, accept that the dialog renders at default size and verify no scrollbar appears.

3. **`includeDeleted` on getComments.**
   - What we know: Default is `false` server-side — deleted comments are NOT returned.
   - What's unclear: Whether a sentinel that was once deleted and then "undeleted" via the API surfaces correctly. Probably out-of-scope for v1, but worth flagging.
   - Recommendation: Don't pass `includeDeleted=true`. Keep the Phase 1 `parseLatest` `isDeleted` filter as defense in depth.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Phase 2 dev-publish wrapper (`scripts/dev-publish.cjs`) | D-29 manual cezari verification | ✓ | unchanged | — |
| `cezari.visualstudio.com/Cezari` org access | D-29 manual cezari verification | ✓ | — | — |
| Marketplace PAT in `.env.local` | dev-publish | ✓ | — | — |
| Node ≥ 20.10 (per `package.json` engines) | Phase 0 toolchain | ✓ | 20.x | — |
| Live ADO work item with prior sentinel comment for pre-fill testing | D-29 step 5 (manual) | ✗ (must be created during verification) | — | Tester manually adds a sentinel comment to a test work item via the comments UI before the verification run, OR runs stub-Apply once + reopens the modal (not possible until Apply does real writes — Phase 4). For Phase 3, tester paste-in via REST `Add Comment` once, then verifies pre-fill on next modal open. |
| Live ADO work item with manually-edited SP value differing from prior sentinel | D-29 step 6 (mismatch banner) | ✗ (must be created during verification) | — | Tester edits SP field manually after creating the prior sentinel. Quick to set up. |

**Missing dependencies with no fallback:** None — manual setup steps are tractable for the human tester.

**Missing dependencies with fallback:** Test work items with sentinels — the tester creates them manually; this is the same pattern Phase 4 will need anyway.

## Validation Architecture

> `.planning/config.json` not present in repo — treating `nyquist_validation` as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 2.1.0 (already wired) |
| Config file | `vitest.config.ts` (Phase 0) |
| Quick run command | `npm test` |
| Full suite command | `npm test` (single mode) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIELD-01 | FieldResolver calls `getFields()` and reads `referenceName` | unit | `npm test -- src/field/FieldResolver.test.ts -t "calls getFields"` | ❌ Wave 1 |
| FIELD-02 | StoryPoints first, Size fallback, both absent → null | unit | `npm test -- src/field/FieldResolver.test.ts -t "priority"` | ❌ Wave 1 |
| FIELD-03 | Cache key `${projectId}\|${workItemTypeName}`; second call doesn't re-probe | unit | `npm test -- src/field/FieldResolver.test.ts -t "cache"` | ❌ Wave 1 |
| FIELD-04 | (re-worded) — modal renders no-field message | manual (UI) | manual cezari step 1 (D-29) | — (UI manual) |
| UI-03 | Three Dropdowns render with 5 levels | manual | D-29 step 2 | — |
| UI-04 | Live calc updates W/RawSP/SP on selection change | manual | D-29 step 4 | — |
| UI-05 | Apply disabled until 3 selected | manual | D-29 step 7 | — |
| UI-07 | Tab/Enter/Esc keyboard nav | manual | D-29 step 10 | — |
| UI-08 | Works on User Story / Bug / Task / Feature / Epic | manual | D-29 step 1 (×5) | — |
| APPLY-01 | Current SP value displayed (or — on null) | manual | D-29 step 3 | — |
| APPLY-02 | Comments fetched + parseLatest run | manual | D-29 step 5 | — |
| APPLY-03 | Pre-fill from sentinel | manual | D-29 step 5 | — |
| (D-30 extra) | FieldResolver default-to-StoryPoints when getFields throws | unit | `npm test -- src/field/FieldResolver.test.ts -t "throws"` | ❌ Wave 1 |

### Sampling Rate
- **Per task commit:** `npm test -- src/field/` (FieldResolver tests only — fast)
- **Per wave merge:** `npm test` (full vitest suite — Phase 1 calc + audit + Phase 3 field)
- **Phase gate:** Full suite green, manual cezari checklist signed off (`03-VERIFICATION.md`)

### Wave 0 Gaps
- [ ] `src/field/FieldResolver.ts` — covers FIELD-01, FIELD-02, FIELD-03, D-20 path
- [ ] `src/field/types.ts` — `ResolvedField` union
- [ ] `src/field/index.ts` — public re-exports
- [ ] `tests/field/FieldResolver.test.ts` — 5 tests per D-30
- [ ] No new framework install — vitest already wired
- [ ] No new fixtures needed — fake `IWorkItemFormService` is hand-rolled per test

## Security Domain

> `security_enforcement` not explicitly disabled in repo config — applying.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `SDK.getAccessToken()` (handled by `getClient` / `RestClientBase` transparently) |
| V3 Session Management | yes | Host-managed; iframe sandbox enforces scope |
| V4 Access Control | yes | `vso.work_write` scope (Phase 0 locked); read-only operations in Phase 3 |
| V5 Input Validation | yes | Phase 1 `parseLatest` already validates sentinel payload; Phase 3 rejects malformed via D-15 |
| V6 Cryptography | no | No client-side crypto needed; auth tokens handled by SDK |
| V7 Error Handling & Logging | yes | `console.warn` for FieldResolver failures (D-20), parser failures (D-15); no PII in logs |

### Known Threat Patterns for ADO extension (Phase 3 surface)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed sentinel payload causes runtime error during parse | Tampering | Phase 1 `parse` is "never throws on user input" (AUDIT-04); `parseLatest` falls through on malformed; Phase 3 D-15 catches `c/u/e` not in valid `Level` set with second-line guard |
| Comment payload contains huge text (DoS via parser) | DoS | Phase 1 parser uses bounded sentinel regex; cap at sentinel-block scope. Phase 3 doesn't change this. |
| Comment posted by malicious actor with crafted JSON to inject `<script>` via human-readable line | XSS | Phase 3 only READS comments — no rendering of comment HTML. Pre-fill uses parsed payload's typed `Level` strings, which are validated against the `LEVELS` set. The human-readable line is never rendered as HTML. Phase 4 will need to consider this for the write side. |
| Logging field values to console exposes PII | Info Disclosure | Phase 3 logs include the work item ID, the resolved field reference name, and the sentinel comment text. The SP comment is intentionally human-readable and self-contained — no PII beyond what the user typed. Stub-Apply log is dev-only behavior and is removed in Phase 4. |
| Missing CSP / iframe sandbox | Tampering | Host-controlled; Phase 3 doesn't change iframe sandbox. |

## Sources

### Primary (HIGH confidence — verified against `node_modules` `.d.ts` or Microsoft Learn 2026-04-03)
- `node_modules/azure-devops-extension-sdk/SDK.d.ts` — `init`, `ready`, `getService`, `getWebContext`, `getAccessToken`, `IExtensionInitOptions` (verified 2026-05-02)
- `node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts` — `IWorkItemFormService.getFields`, `getFieldValue`, `setFieldValue`, all signatures (verified 2026-05-02)
- `node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTracking.d.ts` — `WorkItemField` shape (`referenceName`, `isDeleted`), legacy `WorkItemComment` shape (`revisedDate`, no `id`/`isDeleted`) (verified 2026-05-02)
- `node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingClient.d.ts` — `getComments` signature pinned at LEGACY shape; `WorkItemTrackingRestClient extends RestClientBase` (verified 2026-05-02)
- `node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingClient.js` — confirmed `getComments` calls `apiVersion: "5.0-preview.2"` against `/comments/{revision}` route (verified 2026-05-02)
- `node_modules/azure-devops-extension-api/Common/RestClientBase.d.ts` — `protected beginRequest<T>(params): Promise<T>` (verified 2026-05-02)
- `node_modules/azure-devops-extension-api/Common/Client.d.ts` — `getClient<T>(clientClass): T` (verified 2026-05-02)
- `node_modules/azure-devops-extension-api/Common/CommonServices.d.ts` — `IDialogOptions` shape (only 4 fields), `IHostPageLayoutService` methods (no `closeCustomDialog`) (verified 2026-05-02)
- `node_modules/azure-devops-extension-api/Comments/Comments.d.ts` — modern `Comment` type (with `id`/`createdDate`/`isDeleted`) — types only, no client (verified 2026-05-02)
- `node_modules/azure-devops-ui/Components/Dropdown/Dropdown.Props.d.ts` — `IDropdownProps`, `IListBoxItem`, `placeholder`, `ariaLabel`, `ariaLabelledBy`, `disabled` (verified 2026-05-02)
- `node_modules/azure-devops-ui/Components/MessageCard/MessageCard.Props.d.ts` — `IMessageCardProps`, `MessageCardSeverity` (Info/Warning/Error), `onDismiss`, `severity`, `role` (verified 2026-05-02)
- `node_modules/azure-devops-ui/Components/Spinner/Spinner.Props.d.ts` — `SpinnerSize`, `SpinnerOrientation`, `ariaLabel`, `label` (verified 2026-05-02)
- `node_modules/azure-devops-ui/Components/Button/Button.Props.d.ts` — `IButtonProps`, `primary`, `disabled`, `text`, `onClick` (verified 2026-05-02)
- [Microsoft Learn — `IDialogOptions`](https://learn.microsoft.com/en-us/javascript/api/azure-devops-extension-api/idialogoptions) (verified 2026-05-02; confirms 4 fields, no footer/buttons)
- [Microsoft Learn — `IHostPageLayoutService`](https://learn.microsoft.com/en-us/javascript/api/azure-devops-extension-api/ihostpagelayoutservice) (verified 2026-05-02; confirms no closeCustomDialog)
- [Microsoft Learn — Create modal dialogs in Azure DevOps extensions](https://learn.microsoft.com/en-us/azure/devops/extend/develop/using-host-dialog?view=azure-devops) (verified 2026-04-03 update; confirms Apply/Cancel must be in body)
- [Microsoft Learn — Comments - Get Comments REST API 7.1](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/get-comments?view=azure-devops-rest-7.1) (verified 2026-05-02 via WebFetch; confirms `7.1-preview.4` route + `Comment` shape with `id`/`createdDate`/`isDeleted`)
- `npm view azure-devops-ui version` → `2.272.0` (verified 2026-05-02)
- `npm view azure-devops-extension-api version` → `4.270.0` (verified 2026-05-02)

### Secondary (MEDIUM confidence — Microsoft sample repo + GitHub issues)
- [microsoft/azure-devops-extension-sample — `panel-content/panel-content.tsx`](https://github.com/microsoft/azure-devops-extension-sample/tree/master/src/Samples/panel-content) — confirms canonical SDK lifecycle pattern; does NOT demonstrate dialog programmatic close (negative evidence — see Pitfall 1)
- [microsoft/azure-devops-extension-sdk Issue #53](https://github.com/microsoft/azure-devops-extension-sdk/issues/53) — Dropdown callout sizing in custom controls; not directly applicable to dialogs but informs Pitfall 2
- [microsoft/azure-devops-extension-sample Issues #21, #145, #146](https://github.com/microsoft/azure-devops-extension-sample/issues/21) — multiple unanswered questions about modal close patterns confirms there's no canonical solution; informs A6

### Tertiary (LOW confidence — needs validation on cezari)
- A6: Whether `SDK.register(getContributionId(), { getResult })` enables programmatic close in the new SDK — needs spike on cezari (30 min)
- A4: `azure-devops-ui` Dropdown auto-flip behavior in small dialogs — needs visual verification on cezari

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` apply to Phase 3 — the planner MUST verify compliance:

- **Tech stack — Frontend:** React 18 + TypeScript + `azure-devops-ui`. Phase 3 honors all three; no React 19, no alternative UI library.
- **Tech stack — Org standard divergence:** GPIH org standard is Angular 19, but `azure-devops-ui` is React-only. Phase 3 stays React. Documented exception, not a violation.
- **Distribution:** Visual Studio Marketplace public listing — no infrastructure to host. Phase 3 introduces no backend dependencies.
- **Storage:** ADO Extension Data Service only (no external DB, no backend API). Phase 3 stores nothing — read-only.
- **Permissions:** Extension scopes limited to `vso.work_write` and extension data scopes. Phase 3 stays within `vso.work_write` (already covers `getFields`, `getFieldValue`, `getComments`).
- **Bundle size:** Keep `.vsix` lean. Phase 3 introduces no new packages, only ~5 small React components and ~3 small modules. Likely 5-30 KB gzipped delta. (Phase 5 gates the hard 250 KB cap.)
- **Calculation precision:** Floating-point math; final SP integer; intermediates 2 decimals displayed. Already satisfied by Phase 1's `calculate` + Phase 3's `.toFixed(2)` formatting (D-04, D-05).
- **Testing:** Manual QA does UI testing; only formula logic is unit-tested. Phase 3 unit-tests FieldResolver only (D-30); UI is manual on cezari (D-29).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against `npm view` 2026-05-02; no drift
- Architecture: HIGH for what's possible; MEDIUM for some workarounds (dialog programmatic close — A6 spike needed)
- Pitfalls: HIGH — both critical pitfalls (Override 1, Override 2) verified directly against `node_modules` `.d.ts` files and Microsoft Learn

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 — `azure-devops-ui` and `azure-devops-extension-api` are slow-moving; modern Comments REST API is stable.

---

## Overrides Required (Planner MUST address before locking plans)

### Override 1 — Apply/Cancel cannot live in host dialog footer (D-08)

**Locked decision:** D-08 says "Apply + Cancel sit in the host dialog footer. Use `openCustomDialog`'s footer-button API."

**Override:** No such API exists in `azure-devops-extension-api@4.270.0` or current Microsoft Learn docs. `IDialogOptions` has only `title`, `configuration`, `lightDismiss`, `onClose`. `IHostPageLayoutService` has no `closeCustomDialog`.

**Recommendation:** Render Apply + Cancel inside the modal body using `azure-devops-ui` `ButtonGroup` + `Button`, positioned at the bottom of the body with right-alignment (matching ADO dialog footer visual style). The host's "X" close button + Esc + lightDismiss provide the orthogonal cancel affordances. Cancel button click cannot programmatically close the dialog (no API) — it can clear the body and rely on the user's natural next-action of pressing X or Esc, OR (per A6 spike) use a registered-object close pattern if it works.

**User decision required at planning gate:** Confirm body-rendered buttons are acceptable, or block on the spike outcome.

### Override 2 — `WorkItemTrackingRestClient.getComments()` returns wrong shape (D-22, D-23)

**Locked decision:** D-22 says "ADO bridge wraps `WorkItemTrackingRestClient.getComments()`." D-23 says "the v4 client handles the version internally."

**Override:** The typed client's `getComments()` is pinned at `apiVersion: "5.0-preview.2"` against the LEGACY route `/comments/{revision}`, returning `WorkItemComment[]` with `revisedDate`/`text`/`renderedText` and NO `id`/`isDeleted`/`createdDate`. The audit module's `parseLatest` requires `id`, `isDeleted`, `createdDate`.

**Recommendation:** Subclass `WorkItemTrackingRestClient` and add a `getCommentsModern(workItemId, project)` method that uses `protected beginRequest` to call `apiVersion: "7.1-preview.4"` against the modern route `{project}/_apis/wit/workItems/{workItemId}/comments`. Returns the `Comment` shape that maps directly onto `AdoComment`. ~25 lines of code; pattern verified against `RestClientBase.d.ts`.

**User decision required at planning gate:** Confirm this is acceptable (it should be — Phase 4 will need the same pattern for `addComment` since the typed client doesn't expose modern `addComment` either; this is a reusable bridge piece).

### Override 3 — REQUIREMENTS.md FIELD-04 wording (D-17, already in CONTEXT.md)

Already surfaced in CONTEXT.md D-17. Phase 3 plan must include a one-line edit task to rewrite FIELD-04 from the disabled-toolbar wording to the lazy-probe-modal wording. Trivial; ~5 minutes.

---

*Phase 3 research complete. Three overrides flagged for planner gate review. All other CONTEXT.md decisions are technically feasible as stated.*
