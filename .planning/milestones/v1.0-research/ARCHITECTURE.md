# Architecture Patterns

**Domain:** Azure DevOps work item web extension (marketplace-distributed)
**Researched:** 2026-05-01
**Confidence:** HIGH (Microsoft Learn + extension-sdk/api JS reference, all verified)

---

## TL;DR — what's actually moving

An ADO extension is a static bundle. The host loads each contribution's `uri` into its **own sandboxed iframe** at the moment the host needs it. Iframes don't share memory. Cross-iframe coordination happens through the **VSS handshake** (postMessage under the hood), exposed via `azure-devops-extension-sdk`.

For Story Point Calculator we have **four iframes that don't talk to each other directly** — they coordinate only via host services:

1. **Toolbar-action iframe** (hidden, no UI) — registered against the work item form toolbar; runs only to hand off `execute()` to the host.
2. **Modal/dialog iframe** — opened by the host on demand via `HostPageLayoutService.openCustomDialog`; this is the React calculator UI.
3. **Org settings hub iframe** (v2) — loaded when user navigates to Organization Settings → our hub.
4. **Project settings hub iframe** (v2) — loaded when user navigates to Project Settings → our hub.

Each iframe runs `SDK.init()` independently. Each is its own React root, its own bundle entry point.

---

## Verified facts (correcting common assumptions in the brief)

The orchestrator's brief used several contribution IDs that **do not exist** in current Microsoft documentation. Corrected mapping:

| Brief said | Actual ID (verified Microsoft Learn 2026) |
|---|---|
| `ms.vss-work-web.work-item-form-toolbar-button` | **No such contribution.** The form toolbar accepts `ms.vss-web.action` contributions targeting `ms.vss-work-web.work-item-toolbar-menu` |
| `ms.vss-admin-web.collection-admin-hub` (org settings target) | **`ms.vss-web.collection-admin-hub-group`** |
| `ms.vss-admin-web.project-admin-hub` (project settings target) | **`ms.vss-web.project-admin-hub-group`** |
| Extension Data Service "Default" / "User" | Two scope **types**: `Default` (project-collection-shared) and `User` (per-user). Does **not** include a project-level scope out of the box — see Pitfalls. |
| `IExtensionDataService.getValue/setValue` directly | Service is obtained via `getService(CommonServiceIds.ExtensionDataService)` then **`.getExtensionDataManager(extensionId, accessToken)`**, then `.getValue()/.setValue()`. Two-step, both async. |

Sources: [Extensibility points — Reference targets](https://learn.microsoft.com/en-us/azure/devops/extend/reference/targets/overview), [Extend the work item form](https://learn.microsoft.com/en-us/azure/devops/extend/develop/add-workitem-extension), [Data and Setting Storage](https://learn.microsoft.com/en-us/azure/devops/extend/develop/data-storage).

---

## Components & boundaries

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Azure DevOps host page                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Work item form  (host iframe)                                    │ │
│  │  ┌────────────────┐                                              │ │
│  │  │ Toolbar button │ ←—— "Calculate Story Points"                 │ │
│  │  └────────────────┘                                              │ │
│  │       click                                                      │ │
│  │         │                                                        │ │
│  │         v       ┌──────────────────────────────┐                 │ │
│  │   ┌──────────┐  │  Hidden toolbar-action iframe │                 │ │
│  │   │ host SDK │←─┤  (uri: toolbar.html)          │                 │ │
│  │   │  bridge  │  │  registers .execute()         │                 │ │
│  │   └──────────┘  └──────────────────────────────┘                 │ │
│  │         │            │ calls                                     │ │
│  │         │            ▼                                           │ │
│  │         │     HostPageLayoutService.openCustomDialog(...)        │ │
│  │         │                                                        │ │
│  │         ▼                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────┐   │ │
│  │  │ Modal iframe (uri: modal.html)                            │   │ │
│  │  │ ┌─────────────────────────────────────────────────────┐  │   │ │
│  │  │ │ React app: 3 dropdowns + Apply button               │  │   │ │
│  │  │ │ ┌──────────────┐  ┌──────────────────────────────┐  │  │   │ │
│  │  │ │ │ Calc engine  │  │ ADO bridge                   │  │  │   │ │
│  │  │ │ │ (pure func)  │  │ - IWorkItemFormService       │  │  │   │ │
│  │  │ │ │              │  │ - REST client (comments API) │  │  │   │ │
│  │  │ │ └──────────────┘  └──────────────────────────────┘  │  │   │ │
│  │  │ └─────────────────────────────────────────────────────┘  │   │ │
│  │  └──────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Org Settings hub iframe (v2, separate route)                         │
│  Project Settings hub iframe (v2, separate route)                     │
│      └─ both call ExtensionDataService for read/write                 │
└──────────────────────────────────────────────────────────────────────┘
```

| Component | Responsibility | Bundle entry | Talks to |
|---|---|---|---|
| **Calc engine** | Pure functions: level→score, weighted sum, raw SP, Fibonacci rounding. Zero ADO dependency. | shared module | (nothing — imported by callers) |
| **Toolbar action** | Register `execute()` callback against contribution ID; on click, open the modal via `HostPageLayoutService`. No own UI. | `toolbar.html` + `toolbar.tsx` | Host SDK only |
| **Modal (React app)** | All user-facing UI: dropdowns, intermediate values, warning, Apply. Owns ephemeral state. | `modal.html` + `modal.tsx` | Calc engine, ADO bridge |
| **ADO bridge** | Wraps `IWorkItemFormService` (field write) and REST client (comment add). Single place to mock for unit tests of higher layers. | shared module | Host SDK, REST API |
| **Settings hubs** (v2) | Render org-level / project-level config UI; load + save via Extension Data Service. Mirror UI; differ only in scope passed to the data manager. | `org-settings.html`, `project-settings.html` | Extension Data Service |
| **Audit-comment parser** | Parse `SP=5 (C=Hard, U=Medium, E=Easy)` → restore dropdown selections on modal open. | shared module | (nothing) |
| **Extension manifest** (`vss-extension.json`) | Wires contributions: 1 toolbar-menu action, 1 dialog, 2 hubs (v2). Declares scopes. | root file | (build-time only) |

**Build order implication: calc engine has zero ADO deps and is the source of truth that must match `sp_calculator.xlsx`. Build it first, fully unit-tested, before ever wiring the iframe shell.** The audit-comment parser is also pure — build alongside.

---

## SDK lifecycle (every iframe)

The SDK does a postMessage handshake with the host. Any code that runs before the handshake completes silently fails to access services.

```typescript
import * as SDK from "azure-devops-extension-sdk";

// 1. Kick off handshake. Default options send loaded:true automatically
//    once init resolves — host removes its loading spinner immediately.
SDK.init({
  loaded: false,           // we'll explicitly notify when React has rendered
  applyTheme: true         // host pushes theme variables to our DOM
});

// 2. Wait for handshake to finish before touching anything.
await SDK.ready();

// 3. Register handler against the contribution ID for THIS iframe.
SDK.register(SDK.getContributionId(), {
  execute: async (actionContext) => {
    // for toolbar action, actionContext is the work item context
    await openCalculator(actionContext);
  }
});

// 4. Tell host the loading spinner can come down.
SDK.notifyLoadSucceeded();
```

**Race conditions and silent failures:**

- **Calling `SDK.getService(...)` before `SDK.ready()` resolves** — the promise hangs forever. No error, no rejection. Always `await SDK.ready()` first.
- **Forgetting `SDK.register(...)`** when `loaded:true` is set — host invokes a non-existent handler; no observable error in the console but the toolbar button does nothing on click.
- **Registering with the wrong instance ID** — must match `SDK.getContributionId()` (i.e. the contribution's full ID). Mismatch = silent failure.
- **`notifyLoadSucceeded()` never called** with `loaded:false` — host shows spinner forever. Symptom: dialog appears blank with permanent ADO loading indicator.
- **`SDK.init()` called twice** in the same document — undefined behavior, has caused stuck handshakes in the wild.

**Recommended pattern:** wrap init in a single async bootstrap function called once at module top level; render React only after `await SDK.ready()` resolves; call `notifyLoadSucceeded()` in React's `useEffect(() => {}, [])` of the root component.

---

## Manifest contributions (verified IDs)

```json
{
  "manifestVersion": 1,
  "id": "story-point-calculator",
  "publisher": "<publisher-id>",
  "version": "1.0.0",
  "targets": [{ "id": "Microsoft.VisualStudio.Services" }],
  "scopes": ["vso.work_write"],
  "contributions": [
    {
      "id": "calc-sp-action",
      "type": "ms.vss-web.action",
      "description": "Toolbar action that opens the Story Point calculator modal.",
      "targets": ["ms.vss-work-web.work-item-toolbar-menu"],
      "properties": {
        "text": "Calculate Story Points",
        "title": "Open the Story Point calculator",
        "toolbarText": "Calculate SP",
        "icon": "images/sp-icon.png",
        "uri": "dist/toolbar.html",
        "registeredObjectId": "calc-sp-action"
      }
    },
    {
      "id": "calc-sp-modal",
      "type": "ms.vss-web.external-content",
      "description": "Modal contents loaded into a host-managed dialog.",
      "properties": {
        "uri": "dist/modal.html"
      }
    },

    /* v2 only — settings hubs */
    {
      "id": "calc-sp-org-settings",
      "type": "ms.vss-web.hub",
      "targets": ["ms.vss-web.collection-admin-hub-group"],
      "properties": {
        "name": "Story Point Calculator",
        "order": 100,
        "uri": "dist/org-settings.html",
        "iconName": "Calculator"
      }
    },
    {
      "id": "calc-sp-project-settings",
      "type": "ms.vss-web.hub",
      "targets": ["ms.vss-web.project-admin-hub-group"],
      "properties": {
        "name": "Story Point Calculator",
        "order": 100,
        "uri": "dist/project-settings.html",
        "iconName": "Calculator"
      }
    }
  ]
}
```

Notes on each:

- **`ms.vss-web.action`** is the only verified contribution type for action items on the work item toolbar. Properties match the [Extend the work item form](https://learn.microsoft.com/en-us/azure/devops/extend/develop/add-workitem-extension) docs.
- **`ms.vss-work-web.work-item-toolbar-menu`** is the verified target for the form toolbar. Older docs/blog posts reference `ms.vss-work-web.work-item-form-menu` — **do not use, deprecated/Old Boards only**.
- **Modal as `external-content`** — needed because dialog content must be a registered iframe contribution, not a free-floating URL. The `openCustomDialog` API takes the contribution ID, not a raw URI.
- **Hub group IDs use `ms.vss-web.*`**, not `ms.vss-admin-web.*`. The `ms.vss-admin-web.*` IDs target *menus on overview pages*, not the settings nav itself.

---

## Data flow: open-modal-and-Apply (v1 critical path)

```
USER                  HOST              TOOLBAR-ACTION         MODAL IFRAME
                                          IFRAME (hidden)
 │                     │                     │                     │
 │ click toolbar btn   │                     │                     │
 │────────────────────▶│                     │                     │
 │                     │ load toolbar.html   │                     │
 │                     │────────────────────▶│                     │
 │                     │                     │ SDK.init/ready      │
 │                     │                     │ register('execute') │
 │                     │◀────────────────────│                     │
 │                     │ invoke execute()    │                     │
 │                     │────────────────────▶│                     │
 │                     │                     │ getService(         │
 │                     │                     │   HostPageLayout)   │
 │                     │                     │ .openCustomDialog(  │
 │                     │                     │   'calc-sp-modal',  │
 │                     │                     │   options)          │
 │                     │◀────────────────────│                     │
 │                     │                     │                     │
 │                     │ load modal.html ─────────────────────────▶│
 │                     │                     │                     │ SDK.init
 │                     │                     │                     │ SDK.ready
 │                     │                     │                     │ getService(
 │                     │                     │                     │   WorkItemForm)
 │                     │                     │                     │ .getId()
 │                     │                     │                     │ .getFieldValues(
 │                     │                     │                     │   [SP, History])
 │                     │◀──────────────────────────────────────────│
 │                     │ {id, currentSP, comments[]}                │
 │                     │──────────────────────────────────────────▶│
 │                     │                     │                     │ parse last
 │                     │                     │                     │ audit comment;
 │                     │                     │                     │ render dropdowns
 │                     │                     │                     │ notifyLoadSucceeded
 │ see modal           │                     │                     │
 │◀──────────────────────────────────────────────────────────────── │
 │ pick C/U/E          │                     │                     │
 │ click Apply         │                     │                     │
 │────────────────────────────────────────────────────────────────▶│
 │                     │                     │                     │ calc.computeSP()
 │                     │                     │                     │
 │                     │                     │                     │ ── WRITE FIELD ──
 │                     │                     │                     │ formSvc
 │                     │                     │                     │   .setFieldValue(
 │                     │                     │                     │     'Microsoft.VSTS
 │                     │                     │                     │      .Scheduling
 │                     │                     │                     │      .StoryPoints',
 │                     │                     │                     │     5)
 │                     │                     │                     │ formSvc.save()
 │                     │                     │                     │
 │                     │                     │                     │ ── ADD COMMENT ──
 │                     │                     │                     │ POST /wit/
 │                     │                     │                     │  workItems/{id}/
 │                     │                     │                     │  comments
 │                     │                     │                     │  ?api-version=
 │                     │                     │                     │  7.0-preview.3
 │                     │                     │                     │
 │                     │                     │                     │ close dialog
 │ see new SP value    │                     │                     │
 │◀────────────────────│                     │                     │
```

### Two ways to write the field — pick `IWorkItemFormService`, not REST

| Aspect | `IWorkItemFormService.setFieldValue` + `.save()` | REST `PATCH /wit/workitems/{id}` |
|---|---|---|
| Where it goes | Updates the **in-memory form** the user sees, then triggers form save | Direct server PATCH; bypasses form |
| User confirmation | Honors form's dirty state, validation, rules | None — server applies as-is |
| Validation rules (process customization) | Runs them; rejects if invalid (`isValid()` reflects state) | Runs server-side rules; can reject with HTTP 400 |
| Optimistic concurrency | Form holds revision; `.save()` 409s if stale, prompts user | Must include `op: test, path: /rev` patch op explicitly |
| Side effects on dirty data | If user already typed in another field, it gets saved too — surprising | Doesn't touch other fields |
| Atomicity with comment | Field save + comment add are two separate calls; **never atomic** | Same — but comment is its own endpoint |

**Decision: use `IWorkItemFormService.setFieldValue` + `.save()` for v1.** Reasons: the user just clicked Apply in our modal — they expect form-level save semantics; rules and validators run; if the form was dirty in other fields the user is on notice (we display "About to save the form" warning). The REST PATCH route is appropriate only when the modal might be invoked from a non-form context — which we don't do.

**Caveat:** `setFieldValue` returns `Promise<boolean>` (`false` if validation rejected). Always check the returned bool, then call `save()` only on `true`. If `false`, surface `getInvalidFields()` to the user.

### Comments — REST is the only option

`IWorkItemFormService` has no comment API. Use:

```
POST https://dev.azure.com/{org}/{project}/_apis/wit/workItems/{id}/comments
     ?api-version=7.0-preview.3
Content-Type: application/json

{ "text": "SP=5 (C=Hard, U=Medium, E=Easy)" }
```

- **API version `7.0-preview.3`** is still the latest as of May 2026 — this endpoint never graduated out of preview. Document this as an accepted preview-API dependency. Source: [Comments - Add REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/add).
- Auth uses `await SDK.getAccessToken()`; pass as `Authorization: Bearer ...`.
- `vso.work_write` scope is sufficient.
- The library `azure-devops-extension-api/WorkItemTracking/WorkItemTrackingClient` exposes `addComment(commentCreate, project, workItemId)` — prefer this over hand-rolled fetch; it handles auth + base URL.

### Atomicity — field save and comment add are NOT atomic. Mitigation:

Three failure cases:
1. Field save fails → bail out, show error, **do not** post comment. Easy.
2. Field save succeeds, comment fails → field is mutated but audit trail missing. **The audit comment is the only pre-fill source for the next open** — losing it means the next user can't see/restore the inputs.
3. Both succeed → happy path.

**Recommendation: comment first, then field. Reverse from the obvious order.**

Rationale:
- A comment without a field write is recoverable: user re-opens modal, parser sees the comment, dropdowns are pre-filled, user clicks Apply again, field gets written. No data loss; minor annoyance.
- A field write without a comment leaves the SP value in place but with no provenance — the next user has no idea where the number came from, and the modal will show "Current: 5 / New: ?" without pre-fill. Worse.
- Comment add is a single REST POST and is more likely to fail (network, throttling, preview API hiccups) than the in-form field write that's already round-tripped.

Implementation: try-catch the comment POST first; if it succeeds, run `setFieldValue` + `save()`; if the field save fails, **delete the just-added comment** (REST `DELETE .../comments/{commentId}`) for cleanliness — but this is best-effort, not blocking.

If the team rejects the reversed order on UX grounds (it's slightly slower because comment POST is server round-trip vs. in-memory field set), the alternative is: write field, then comment, and on comment failure surface a banner ("Calculation applied but audit trail save failed; click here to retry"). Both are valid; pick one explicitly and document.

---

## Data flow: settings load-and-save (v2)

```
USER                       HOST              SETTINGS HUB IFRAME
 │                          │                     │
 │ click "Story Point        │                     │
 │  Calculator" in           │                     │
 │  Project Settings         │                     │
 │─────────────────────────▶│                     │
 │                          │ load                 │
 │                          │ project-settings.html│
 │                          │─────────────────────▶│
 │                          │                     │ SDK.init / ready
 │                          │                     │ getAccessToken()
 │                          │                     │
 │                          │                     │ getService(
 │                          │                     │   ExtensionDataService)
 │                          │                     │ .getExtensionDataManager(
 │                          │                     │   extensionId, token)
 │                          │                     │
 │                          │                     │ dataMgr.getValue(
 │                          │                     │   'sp-config',
 │                          │                     │   { scopeType: 'Default',
 │                          │                     │     scopeValue: '<projectId>',
 │                          │                     │     defaultValue: null })
 │                          │                     │
 │                          │                     │ render form (or empty
 │                          │                     │   "inherits from org"
 │                          │                     │   if null)
 │                          │                     │
 │ see settings UI          │                     │
 │◀─────────────────────────────────────────────── │
 │ edit weights/labels      │                     │
 │ click Save               │                     │
 │─────────────────────────────────────────────── ▶│
 │                          │                     │ validate (weights sum to 1)
 │                          │                     │ dataMgr.setValue(
 │                          │                     │   'sp-config',
 │                          │                     │   newConfig,
 │                          │                     │   { scopeType: 'Default',
 │                          │                     │     scopeValue: '<projectId>'})
 │                          │                     │
 │                          │                     │ show success banner
 │                          │                     │ via GlobalMessagesService
 │ see "Saved" toast        │                     │
 │◀───────────────────────── │                     │
```

### Scope mapping (the part the brief got wrong)

The Extension Data Service has **two scope types**: `Default` (project-collection-shared) and `User` (per-user).

> Source: [Data and Setting Storage](https://learn.microsoft.com/en-us/azure/devops/extend/develop/data-storage): "Settings and document collections can be scoped to either the **Project Collection** ... or the **User**."

Project-level isolation is **not** a built-in scope. To get an "org default + project override" pattern, encode the scope into the **document key**, not the SDK scope parameter:

| Setting | Stored as | Lookup at calculation time |
|---|---|---|
| Org-level config | `dataMgr.setValue("sp-config-org", config, { scopeType: "Default" })` | always read from this key |
| Project N config | `dataMgr.setValue("sp-config-proj-<projectId>", config, { scopeType: "Default" })` | read this key first; if 404, fall back to `sp-config-org`; if still 404, use built-in fixed v1 defaults |

The `scopeValue` parameter exists in the underlying API but isn't a project-scope shorthand — it's a way to namespace within a scope type. Using a key prefix is more explicit and easier to reason about.

**At runtime in the modal:** the modal must resolve effective config in this order — project config → org config → built-in defaults. This is a side effect of the v2 architecture; the v1 modal should hardcode the calculator config (no Extension Data Service read), because v1 has no settings UI and adding the storage round-trip slows the dialog open. v2 introduces the read.

### Cache invalidation

Extension Data Service is a thin wrapper over a backend document store. There's **no client-side cache and no broadcast** — if a user changes settings in one tab, another open work item form in another tab won't see the new config until it re-fetches.

For v2, accept this: the modal reads config on every open (~100ms latency, acceptable for a dialog-open UX). Settings hubs always re-fetch on mount. Don't try to invalidate across tabs.

---

## Iframe sandbox limits — what the modal can/can't do

| Need | Direct? | If not, how |
|---|---|---|
| Render React UI | Yes | normal |
| Local component state | Yes | normal |
| Read work item ID, fields | **No** — sandboxed iframe has no access to host DOM | `IWorkItemFormService.getId()`, `.getFieldValue()` (async via SDK) |
| Write work item field | **No** | `IWorkItemFormService.setFieldValue()` + `.save()` |
| Make REST call to ADO | Yes — but only with token | `await SDK.getAccessToken()` → `Authorization: Bearer` |
| Make arbitrary cross-origin fetch | Yes if CSP allows; not blocked by SDK. But: marketplace review may flag external network calls | n/a — we don't do this |
| Resize self in host | **No** | `SDK.resize(width, height)` — host adjusts iframe attrs |
| Open another modal/dialog | **No** | `HostPageLayoutService.openCustomDialog(contributionId)` |
| Navigate the host (URL change) | **No** | `HostNavigationService.navigate(url)` |
| Display global toast/banner | **No** | `GlobalMessagesService.addToast(...)` or `addBanner(...)` |
| Read user identity | Indirect | `SDK.getUser()` (sync after `SDK.ready()`) |
| Read theme colors | Indirect | `applyTheme:true` in init options pushes CSS variables; or `applyTheme(themeData)` |
| Persist data | **No localStorage cross-iframe coordination** | Extension Data Service |

The hidden toolbar-action iframe is a tiny exception — it has no UI, just the SDK + a registered `execute` callback. The host invokes `execute` with the action context. The action context for `ms.vss-work-web.work-item-toolbar-menu` includes `id` (work item id) and `workItemTypeName`.

---

## Patterns to follow

### Pattern 1: get the work item ID synchronously when possible

When the toolbar-action handler runs, the host already passes the work item id in the `actionContext` parameter. Use that for the `openCustomDialog` payload — don't await `IWorkItemFormService.getId()` again in the modal:

```typescript
// toolbar.tsx
SDK.register(SDK.getContributionId(), {
  execute: async (actionContext: { id: number, workItemTypeName: string }) => {
    const layoutSvc = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    await layoutSvc.openCustomDialog(
      `${SDK.getExtensionContext().id}.calc-sp-modal`,
      {
        title: "Calculate Story Points",
        configuration: { workItemId: actionContext.id },
        onClose: () => { /* refresh form? optional */ }
      }
    );
  }
});
```

The modal then reads `SDK.getConfiguration().workItemId` synchronously (after `SDK.ready()`), no async hop. **Save 100–300 ms on dialog open** vs. re-querying.

### Pattern 2: ADO bridge as the only impure layer

Keep `setFieldValue` / `addComment` / `getValue` calls in **one bridge module** that the modal calls. Calc engine and audit-comment parser stay pure (testable without mocking ADO).

```
modal.tsx ── (calls) ──▶ adoBridge.applyResult(workItemId, sp, comment)
                              │
                              ├─▶ workItemFormService.setFieldValue(...)
                              ├─▶ workItemFormService.save()
                              └─▶ workItemTrackingClient.addComment(...)
```

For unit tests, swap the bridge module. For the manual QA standard, the bridge has zero logic worth testing — only orchestration.

### Pattern 3: settings hub reuses one component

Org and project settings hubs render the same React component with a single prop:

```typescript
// settings-shell.tsx
<SettingsForm
  scopeKey={isProjectHub ? `sp-config-proj-${projectId}` : "sp-config-org"}
  inheritsFrom={isProjectHub ? "sp-config-org" : null}
/>
```

One UI, two entry-point HTMLs (`org-settings.html` and `project-settings.html`) that pass different props. **Cuts settings-hub work in v2 nearly in half.**

---

## Anti-patterns to avoid

### Anti-pattern 1: putting React rendering inside the toolbar-action iframe

**What:** Mounting your modal UI in `toolbar.html`'s React tree.
**Why bad:** That iframe is hidden, has no defined size, and is destroyed when the work item form closes. The user sees nothing. You'll think the click handler is broken.
**Instead:** The toolbar iframe has zero UI. It only registers `execute` and calls `openCustomDialog`. The dialog iframe (separate `external-content` contribution) is where React renders.

### Anti-pattern 2: using REST PATCH for the field write inside the work item form

**What:** From the modal, calling `PATCH /wit/workitems/{id}` to set Story Points while the user has the form open.
**Why bad:** The user's open form holds a stale revision; their form-level save will 409 or silently overwrite. Worse: the user may have unsaved changes in other fields and our PATCH writes from underneath them.
**Instead:** `IWorkItemFormService.setFieldValue` + `.save()`. The form's own save flow handles revision and unsaved-changes prompts.

### Anti-pattern 3: hand-rolled fetch instead of `azure-devops-extension-api` clients

**What:** Using `fetch()` directly to hit the comments endpoint.
**Why bad:** Auth header management, base URL resolution, API version pinning, retry on token refresh — all done for you by the typed clients. Hand-rolled drifts as the host upgrades.
**Instead:** `getClient(WorkItemTrackingRestClient)` from `azure-devops-extension-api/WorkItemTracking`.

### Anti-pattern 4: calling `SDK.init()` from a top-level `<script>` and starting React in parallel

**What:** Loading the SDK script in `<head>`, calling `SDK.init()`, then mounting React without awaiting `SDK.ready()`.
**Why bad:** The first React render tries to call `SDK.getService(...)` and the promise hangs. UI appears empty with no error.
**Instead:** `await SDK.ready()` BEFORE `ReactDOM.createRoot(...).render(...)`.

### Anti-pattern 5: storing settings in localStorage as a "cache"

**What:** Reading Extension Data Service once, caching in localStorage to avoid round-trips.
**Why bad:** localStorage is per-iframe-origin and per-browser; another tab won't see updates; user clears storage and config "vanishes". The Extension Data Service round-trip is ~100ms; not worth caching.
**Instead:** Read on every modal open. Show a tiny spinner if needed.

### Anti-pattern 6: using `ms.vss-admin-web.collection-admin-hub` as a hub group target

**What:** Targeting that ID for an org-settings hub.
**Why bad:** It's not a hub group ID — it's a menu target, and your hub will not appear at all.
**Instead:** `ms.vss-web.collection-admin-hub-group` (verified May 2026 docs).

---

## Scalability considerations

| Concern | At 1 tenant (GPIH internal) | At 100 tenants | At 10K tenants |
|---|---|---|---|
| Bundle size | Whatever; dev builds fine | <500KB gzipped per iframe; lazy-load `azure-devops-ui` icons | Same — bundle is per-install, not per-tenant |
| Extension Data Service quota | Negligible | Per-tenant; ~2MB per scope, plenty for our schema | Same — it's per-tenant storage, not pooled |
| Comments API rate limits | Negligible | Negligible; one POST per Apply | ADO global throttling kicks in only at thousands/min/tenant |
| Process customization variance | One process | Most use Agile/Scrum/Basic | Some orgs rename `Microsoft.VSTS.Scheduling.StoryPoints` (tracked in PROJECT.md as risk) |
| `azure-devops-ui` version drift | Not a concern | Pin a specific version; test against modern New Boards Hub | Same |

There's no infrastructure to scale — the marketplace ships static assets, each tenant's data is in their own ADO. Scaling concerns reduce to *bundle size* and *rate-limit awareness*.

---

## Suggested build order

1. **Calc engine** — pure functions; full unit tests against `sp_calculator.xlsx` numbers. No ADO. (Fastest to validate against PROJECT.md acceptance criteria.)
2. **Audit-comment parser/serializer** — pure; unit-tested. Round-trip property test (`serialize(parse(s)) === s`).
3. **Manifest skeleton** — `vss-extension.json` with toolbar + dialog contributions only (no hubs yet); minimal `toolbar.html` that just calls `console.log` on execute. **Goal: get the button to appear in a dev org and log a click.** This is the single highest-risk integration point — fail fast on it.
4. **Modal shell** — `modal.html` registered as `external-content`; opens via `openCustomDialog`; renders "Hello" inside the host's dialog chrome. **Goal: confirm dialog flow round-trips. Confirm theming via `applyTheme`.**
5. **Modal UI** — wire the calc engine into the React UI; dropdowns, intermediate values, Apply button (no-op).
6. **ADO bridge — read path** — `IWorkItemFormService.getId`, `getFieldValue` for current SP, REST `getComments` for last audit comment; pre-fill dropdowns.
7. **ADO bridge — write path** — `setFieldValue` + `save`, REST `addComment`. Implement the comment-first ordering.
8. **Edge cases & polish** — overwrite warning, error states, `setError` for invalid form, loading spinner, `notifyLoadSucceeded` placement.
9. **Marketplace publishing** — publisher account, icons, screenshots, public flag. **Treat as separate phase.**
10. **(v2) Settings hubs** — one shared component, two HTML entry points; Extension Data Service read/write with key-prefix scoping; modal integration with override-pattern resolver. **Each step depends on every prior step. Phases 1–3 are the gating risk; if step 3 doesn't work the whole thing is blocked.**

Each step from 4 onward should add **one** new ADO surface contact at a time, so you can isolate the source of any silent SDK failure to the most recent change.

---

## Sources

- [Extend the work item form (Microsoft Learn, 2026-04)](https://learn.microsoft.com/en-us/azure/devops/extend/develop/add-workitem-extension) — contribution types, form events, JavaScript samples. **HIGH**
- [Extensibility Points reference (Microsoft Learn, 2026-04)](https://learn.microsoft.com/en-us/azure/devops/extend/reference/targets/overview) — verified hub group IDs, work-item-toolbar-menu target. **HIGH**
- [Extension Manifest Reference (Microsoft Learn, 2026-04)](https://learn.microsoft.com/en-us/azure/devops/extend/develop/manifest) — manifest schema, scopes table (`vso.work_write` confirmed). **HIGH**
- [Data and Setting Storage (Microsoft Learn, 2026-04)](https://learn.microsoft.com/en-us/azure/devops/extend/develop/data-storage) — `Default`/`User` scope types, etag concurrency, REST endpoint paths. **HIGH**
- [azure-devops-extension-sdk package reference (JS API ref, 2026-01)](https://learn.microsoft.com/en-us/javascript/api/azure-devops-extension-sdk/) — `init`, `ready`, `register`, `notifyLoadSucceeded`, `resize`. **HIGH**
- [IWorkItemFormService interface reference](https://learn.microsoft.com/en-us/javascript/api/azure-devops-extension-api/iworkitemformservice) — all methods are async/Promise; `setFieldValue` returns `Promise<boolean>`. **HIGH**
- [Comments - Add REST API (REST 7.0)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/add) — `7.0-preview.3` is the current version; comments endpoint never graduated. **HIGH**
- [Work Items - Update REST API (REST 7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update) — JSON Patch format, `op:test, path:/rev` for optimistic concurrency. **HIGH**
- [CommonServiceIds enum reference](https://learn.microsoft.com/en-us/javascript/api/azure-devops-extension-api/commonserviceids) — `HostPageLayoutService` for dialogs/panels. **HIGH**
- [IExtensionInitOptions reference](https://learn.microsoft.com/en-us/javascript/api/azure-devops-extension-sdk/iextensioninitoptions) — `loaded:true` default, `applyTheme:true` default. **HIGH**
- [Add a custom control (Microsoft Learn, 2026-04)](https://learn.microsoft.com/en-us/azure/devops/extend/develop/custom-control) — JavaScript registration sample (`SDK.init` → `SDK.ready` → `SDK.register`). **HIGH**
