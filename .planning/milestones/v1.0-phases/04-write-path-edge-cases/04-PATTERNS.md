# Phase 04: Write Path & Edge Cases — Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 10 (4 modifications + 6 creations)
**Analogs found:** 10 / 10

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/ado/adoFetch.ts` (NEW) | utility (SDK boundary) | request-response (HTTP) | `src/ado/comments.ts` | exact (extract direct-fetch core) |
| `src/ado/postComment.ts` (NEW) | utility (SDK boundary) | request-response (HTTP) | `src/ado/comments.ts` | exact (sibling — POST counterpart of GET) |
| `src/ado/comments.ts` (MOD — refactor) | utility (SDK boundary) | request-response (HTTP) | self (Phase 03-04 pattern) | exact (pattern is being extracted FROM this file) |
| `src/ado/bridge.ts` (MOD — extend) | utility (SDK boundary) | request-response (postMessage) | self (existing wrappers) | exact (parallel `getIsReadOnly` to `getCurrentSpValue`) |
| `src/apply/stubApply.ts` (MOD — replace body, optionally rename to `apply.ts`) | service (orchestrator) | transform → request-response × 2 | self (input-shape stable) + `src/ui/CalcModal.tsx` read-path effect (sequencing analog) | role-match |
| `src/apply/errorMessages.ts` (NEW) | utility (pure module) | transform | `src/audit/serialize.ts` + `src/audit/parse.ts` (pure module + vitest pattern) | role-match |
| `src/ui/ConfirmOverwritePanel.tsx` (NEW) | component (in-modal panel) | event-driven (React) | `src/ui/NoFieldMessage.tsx` (body-replacement) + `src/ui/CalcModal.tsx` ButtonGroup row | role-match |
| `src/ui/ReadOnlyMessage.tsx` (NEW) | component (in-modal panel) | event-driven (React) | `src/ui/NoFieldMessage.tsx` | exact (parallel shape per CONTEXT D-06) |
| `src/ui/SavingOverlay.tsx` (NEW) | component (overlay) | event-driven (React) | `src/ui/CalcModal.tsx` `isLoading` Spinner block | role-match |
| `src/ui/CalcModal.tsx` (MOD — extend orchestrator) | component (orchestrator) | event-driven (React state machine) | self (Phase 3 read-path effect + banner stack) | exact |

Vitest analogs:
- Pure-module + table-driven: `tests/audit/serialize.test.ts`, `tests/audit/parse.test.ts`. New `tests/apply/errorMessages.test.ts` and `tests/ado/postComment.test.ts` follow the same `describe / it.each` shape.

---

## Codebase Conventions (apply to ALL Phase 4 files)

These conventions are evident across the existing source files; planner MUST surface them in every plan.

| Convention | Where it lives | Phase 4 application |
|---|---|---|
| **Header comment block** with `// src/<path>.ts — Source: <Decision IDs>; <UI-SPEC §section>.` (and "Why this file exists" for non-trivial files) | every file in `src/` | Every NEW file in Phase 4 must include the same header citing CONTEXT D-IDs and UI-SPEC sections. |
| **`[sp-calc/<area>]` console-log prefix** as a `const LOG_PREFIX` near top of module | `src/ado/bridge.ts:20` (`[sp-calc/bridge]`), `src/ado/comments.ts:43` (`[sp-calc/comments]`), `src/apply/stubApply.ts:13` (`[sp-calc/apply]`), `src/ui/CalcModal.tsx:51` (`[sp-calc/modal]`), `src/entries/toolbar.tsx:13` (`[sp-calc/toolbar]`) | New prefixes: `[sp-calc/adoFetch]`, `[sp-calc/postComment]`, `[sp-calc/apply]` (already exists, keep), `[sp-calc/errorMessages]` (only if needed — pure module usually silent). |
| **String-literal service IDs / enum values** (`isolatedModules: true` workaround) — declare `const X = "literal"` with a comment pointing to the upstream `.d.ts` line that owns the enum | `src/ado/bridge.ts:15-19` (`WORK_ITEM_FORM_SERVICE_ID = "ms.vss-work-web.work-item-form"`), `src/entries/toolbar.tsx:15-20` (`HOST_PAGE_LAYOUT_SERVICE_ID`), CONTEXT specifics line 250 (`format: 1 /* CommentFormat.Html */`) | `postComment.ts` uses literal `1` with `/* CommentFormat.Html */` comment + `.d.ts` reference. Any new service ID follows the same shape. |
| **Defensive coercion at the SDK boundary** — `try { ... } catch { return safeSentinel }` pattern; never throw from a bridge wrapper | `src/ado/bridge.ts:36-48` (`getCurrentSpValue` → null on reject), `:54-64` (`getWorkItemTitle` → "" on reject), `:71-81` (`getWorkItemTypeName` → "" on reject) | `bridge.ts::getIsReadOnly` follows the same shape: returns `{ isReadOnly: boolean, probeFailed: boolean }` (per CONTEXT D-05) — NEVER throws. Per RESEARCH Finding 1 / Pitfall 1, the form-service method does not exist; the wrapper must implement the spike-validated alternative and gracefully fall back. |
| **Direct fetch only — never `getClient(WorkItemTrackingRestClient)`** (Override 4) | `src/ado/comments.ts:13-24` (Override 4 acknowledgement), `:55-80` (the implementation) | `adoFetch.ts` codifies it; `postComment.ts` consumes it; do NOT import `WorkItemTrackingRestClient` anywhere in `src/ado/` or `src/apply/`. |
| **Per-promise read-path logging** for parallel reads (so verifier can pinpoint hung legs) | `src/ui/CalcModal.tsx:140-160` (`titleP.then((v) => { console.log(...); return v; })` per leg) | The CalcModal extension that adds `getIsReadOnly` to the parallel reads MUST follow the same per-leg `.then(log)` pattern. |
| **Pure modules stay SDK-free** (zero imports from `azure-devops-extension-sdk` / `-api`) | `src/calc/`, `src/audit/`, `src/field/types.ts` | `src/apply/errorMessages.ts` MUST be SDK-free (vitest can import directly without mocks). `src/apply/apply.ts` is the SDK-aware boundary. |
| **Public API barrel** in `src/<area>/index.ts` re-exporting the documented surface; downstream callers import from `../ado` / `../audit` / `../apply` only — never reach into internal files | `src/ado/index.ts:1-19`, `src/audit/index.ts:1-5` | New: extend `src/ado/index.ts` to re-export `postComment`. Do NOT re-export `adoFetch` (file-private implementation detail; mirrors how `ModernCommentsClient` was kept private per existing comment in `src/ado/index.ts:3-4`). For `src/apply/`, planner adds an `index.ts` barrel exporting `applyToWorkItem`, `friendlyMessageForStatus`, `mapSdkErrorToStatus`, type `ApplyError`, type `ApplyInput`, type `AppliableFieldRef`. |
| **`ApplyInput` shape stable** (`{ c, u, e, fieldRefName }`) per CONTEXT D-12 / Phase 3 D-27 | `src/apply/stubApply.ts:25-30` | When body is replaced, the `export interface ApplyInput { c, u, e, fieldRefName }` declaration is preserved verbatim so `CalcModal.tsx:256-262` import-site is unchanged. |
| **MessageCard barrel imports only** (no deep `azure-devops-ui/Components/...` imports) | `src/ui/PreFillBanner.tsx:5`, `src/ui/NoFieldMessage.tsx:6`, `src/ui/ReadErrorBanner.tsx:4`, `src/ui/FieldResolverFailBanner.tsx:4` | All new banner / panel / overlay components import from the barrel paths listed in UI-SPEC §"Imports — barrel paths only". |

---

## Pattern Assignments

### `src/ado/adoFetch.ts` (NEW — utility, request-response/HTTP)

**Analog:** `src/ado/comments.ts` (Phase 03-04 Override 4 pattern). The new file is the extraction of `comments.ts` lines 50–101 into a reusable shape.

**Header / Override-4 acknowledgement** — copy the rationale verbatim, retargeted at the helper. Source pattern from `src/ado/comments.ts:1-24`:

```typescript
// src/ado/comments.ts (lines 1-24)
// Source: D-22, D-23 (CONTEXT.md); RESEARCH.md §Pattern 2 + Override 2.
//
// Why this file exists: WorkItemTrackingRestClient.getComments() in
// azure-devops-extension-api@4.270.0 is locked at the LEGACY preview
// route returning WorkItemComment[] with revisedDate/text/renderedText
// shape — NO id, NO isDeleted, NO createdDate. parseLatest (Phase 1)
// requires id/isDeleted/createdDate to filter and sort.
// [...]
// 03-04 cezari finding (Override 4): getClient(ModernCommentsClient).beginRequest
// hangs indefinitely from a custom-dialog iframe — the SDK's REST client
// resolves its rootPath via SDK.getService("ms.vss-features.location-service")
// → locationService.getResourceAreaLocation(WIT). Both calls return promises
// that never resolve in the dialog iframe context [...]
// Resolution: bypass getClient/beginRequest entirely. Acquire the auth token
// via SDK.getAccessToken() (which DOES work in dialog iframes), construct the
// modern 7.1-preview.4 URL ourselves from SDK.getHost().name, and fetch().
import * as SDK from "azure-devops-extension-sdk";
```

**Imports + LOG_PREFIX** — follow `src/ado/comments.ts:25-43`:

```typescript
import * as SDK from "azure-devops-extension-sdk";
// ... no other imports needed for adoFetch (caller supplies path/body/version)

const LOG_PREFIX = "[sp-calc/adoFetch]";
```

**Core direct-fetch pattern** — extract from `src/ado/comments.ts:54-91` and parameterize. The body is taken almost verbatim:

```typescript
// src/ado/comments.ts (lines 54-91)
console.log(`${COMMENTS_LOG} fetch start`);

const host = SDK.getHost();
console.log(`${COMMENTS_LOG} host`, { name: host.name, isHosted: host.isHosted });

console.log(`${COMMENTS_LOG} requesting access token`);
const token = await SDK.getAccessToken();
console.log(`${COMMENTS_LOG} access token acquired (len=${token?.length ?? 0})`);

// ADO Services orgs are reachable at https://dev.azure.com/{name}; the
// legacy {name}.visualstudio.com URL still resolves. For Azure DevOps Server
// (isHosted=false) this would need to come from the location service —
// out of scope for v1.
const baseUrl = host.isHosted
  ? `https://dev.azure.com/${host.name}`
  : `https://${host.name}.visualstudio.com`;
const url =
  `${baseUrl}/${encodeURIComponent(projectId)}/_apis/wit/workItems/${workItemId}/comments?api-version=7.1-preview.4`;
console.log(`${COMMENTS_LOG} fetch URL`, url);

const response = await fetch(url, {
  method: "GET",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  },
});
console.log(`${COMMENTS_LOG} fetch response`, { status: response.status, ok: response.ok });

if (!response.ok) {
  const body = await response.text().catch(() => "");
  throw new Error(
    `getCommentsModern failed: ${response.status} ${response.statusText} ${body.slice(0, 200)}`,
  );
}
```

**Error format with attached `.status`** — RESEARCH.md §Pattern 1 (lines 297–311) shows the exact shape Phase 4 needs. Note the `.status` is attached to the `Error` so the orchestrator can read `(err as Error & { status?: number }).status` per RESEARCH.md Pattern 3 (line 398):

```typescript
// RESEARCH §Pattern 1 (lines 297-310) — error shape adoFetch must produce
const text = await response.text().catch(() => "");
const err = new Error(
  `${method} ${path} failed: ${response.status} ${response.statusText} ${text.slice(0, 200)}`,
);
// Attach status for the orchestrator's typed-error translation (D-11):
(err as Error & { status?: number }).status = response.status;
throw err;
```

**Signature** (locked by CONTEXT D-14 line 78–86):

```typescript
export async function adoFetch<T>(
  method: "GET" | "POST",
  path: string,             // "/{projectId}/_apis/wit/workItems/{id}/comments"
  apiVersion: string,       // "7.0-preview.3" | "7.1-preview.4"
  body?: unknown,
  opts?: { signal?: AbortSignal }
): Promise<T>;
```

**Body-encoding rule:** when `method === "POST"`, set `Content-Type: application/json` and `body: JSON.stringify(body)`; when `method === "GET"`, omit Content-Type and body. Mirrors RESEARCH.md §"Direct-fetch URL construction (Override 4 codified)" lines 602–615.

---

### `src/ado/postComment.ts` (NEW — utility, request-response/HTTP)

**Analog:** `src/ado/comments.ts` (sibling — read counterpart). The file is a thin wrapper around `adoFetch` per RESEARCH §Pattern 2 (lines 314–346).

**Imports — follow `src/ado/comments.ts:25-26` shape (audit barrel, no SDK)**:

```typescript
// Source: CONTEXT D-01, D-13, D-14; APPLY-06.
// CommentFormat enum is a const enum upstream — with isolatedModules: true,
// use literal 1 with documenting comment (Phase 2 D-12 / Phase 3 isolatedModules workaround).
import { adoFetch } from "./adoFetch";
import { serialize, type AuditPayload } from "../audit";

const LOG_PREFIX = "[sp-calc/postComment]";
```

**Core POST pattern** — verbatim from RESEARCH §Pattern 2 (lines 333–345):

```typescript
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

**Spike note (D-02 / Pitfall 2 / A1):** RESEARCH flags that `format: 1` may be silently ignored by ADO's sanitizer. The plan must include the D-02 spike (post via `format: 1`, observe rendered Discussion + GET round-trip on cezari) BEFORE locking this file. If the spike fails, fall back to the invisible-div carrier per CONTEXT D-02 line 38 — change shape inside `serialize.ts` (`<div data-sp-calc="v1" hidden>{...}</div>`) and add a parser regex; do NOT change the `postComment.ts` body field convention.

---

### `src/ado/comments.ts` (MOD — refactor to consume `adoFetch`)

**Analog:** self (current Phase 03-04 implementation). Behavior is unchanged; the body is reduced to a 5–10 line wrapper.

**Before (current file, lines 50-101):** ~50 lines of direct-fetch boilerplate.

**After (target shape):**

```typescript
// src/ado/comments.ts (post-refactor)
// Source: D-22, D-23 (CONTEXT.md); refactored Phase 4 D-14 to consume adoFetch.
import { adoFetch } from "./adoFetch";
import type { AdoComment } from "../audit/types";

interface ModernCommentDto {
  id: number;
  text: string;
  createdDate: string;
  isDeleted: boolean;
  workItemId: number;
  version: number;
}

interface ModernCommentList {
  comments: ModernCommentDto[];
  count: number;
  totalCount: number;
}

const LOG_PREFIX = "[sp-calc/comments]";

export async function fetchCommentsForRead(
  workItemId: number,
  projectId: string,
): Promise<AdoComment[]> {
  console.log(`${LOG_PREFIX} fetch start`);
  const path = `/${encodeURIComponent(projectId)}/_apis/wit/workItems/${workItemId}/comments`;
  const payload = await adoFetch<ModernCommentList>("GET", path, "7.1-preview.4");
  console.log(`${LOG_PREFIX} parsed comments`, { count: payload?.comments?.length ?? 0 });
  return (payload.comments || [])
    .filter((c) => typeof c.createdDate === "string")  // Pitfall 5 sanity check
    .map((c) => ({
      id: c.id,
      text: c.text,
      createdDate: c.createdDate,
      isDeleted: c.isDeleted,
    }));
}
```

The Pitfall-5 `typeof c.createdDate === "string"` filter (current `comments.ts:94`) MUST be preserved — it guards against the legacy preview-route returning Date objects. Override 2 / Override 4 header comments can be condensed since `adoFetch` now owns that concern; keep a one-line pointer.

---

### `src/ado/bridge.ts` (MOD — add `getIsReadOnly` wrapper)

**Analog:** existing wrappers in the same file, especially `getCurrentSpValue` (lines 36–48).

**Pattern excerpt — `getCurrentSpValue` defensive shape** (`src/ado/bridge.ts:36-48`):

```typescript
export async function getCurrentSpValue(
  formService: IWorkItemFormService,
  refName: string,
): Promise<number | null> {
  try {
    const raw = await formService.getFieldValue(refName);
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  } catch (err) {
    console.warn(`${LOG_PREFIX} getFieldValue(${refName}) failed`, err);
    return null;
  }
}
```

**Phase 4 application — `getIsReadOnly`:** Per RESEARCH Finding 1 / Pitfall 1 / A3 (lines 504–515 + 718), `IWorkItemFormService.isReadOnly()` does NOT exist. The plan MUST run a spike first; the resulting wrapper returns a 2-tuple (`{ isReadOnly, probeFailed }`) so D-07's "probe-fail → default writable + Warning banner" path is type-driven, not exception-driven. Suggested shape (mirrors the `getCurrentSpValue` defensive pattern):

```typescript
// Source: CONTEXT D-05, D-07; RESEARCH Finding 1 / Pitfall 1.
// IWorkItemFormService.isReadOnly() does NOT exist on the form service
// (verified in WorkItemTrackingServices.d.ts:55-320). The empirical spike
// (Phase 4 plan task 1) determines the actual detection mechanism — current
// candidates (RESEARCH §Pitfall 1 line 509-512):
//   1. formService.getFieldValue("System.AuthorizedAs") + license heuristic
//   2. setFieldValue(currentValue, currentValue) no-op probe → returns false
//      for read-only fields (verify side-effect-free)
//   3. SDK.getUser() license tier (Stakeholder ⇒ read-only on Boards items)
// Lazy fallback: if NO eager probe is reliable, this function returns
// { isReadOnly: false, probeFailed: true } and the orchestrator surfaces
// the D-07 warning banner; the actual write's 403 maps to the D-06 copy
// via friendlyMessageForStatus.
export async function getIsReadOnly(
  formService: IWorkItemFormService,
): Promise<{ isReadOnly: boolean; probeFailed: boolean }> {
  try {
    // <SPIKE-VALIDATED PROBE GOES HERE>
    // const result = await <probe>;
    // if (typeof result !== "boolean") {
    //   console.warn(`${LOG_PREFIX} isReadOnly probe returned non-boolean`, result);
    //   return { isReadOnly: false, probeFailed: true };
    // }
    // return { isReadOnly: result, probeFailed: false };
    return { isReadOnly: false, probeFailed: true };  // lazy fallback default
  } catch (err) {
    console.warn(`${LOG_PREFIX} getIsReadOnly probe failed`, err);
    return { isReadOnly: false, probeFailed: true };  // D-07: default writable on failure
  }
}
```

**Type extension to `src/ado/types.ts`:** add a `permission` field to `CalcSpReadResult`:

```typescript
// Source: CONTEXT D-05, D-07.
permission: {
  isReadOnly: boolean;
  probeFailed: boolean;
};
```

**Barrel update:** add `getIsReadOnly` to `src/ado/index.ts` re-exports (line 5–11 region).

---

### `src/apply/stubApply.ts` (MOD — replace body; optionally rename to `apply.ts`)

**Analog (existing):** `src/apply/stubApply.ts` itself for the input-shape contract; `src/ui/CalcModal.tsx:83-214` for the async sequencing pattern.

**Preserve verbatim from `src/apply/stubApply.ts:21-30`** (the export contract — do NOT change):

```typescript
// src/apply/stubApply.ts (lines 21-30) — STABLE EXPORT
export type AppliableFieldRef =
  | "Microsoft.VSTS.Scheduling.StoryPoints"
  | "Microsoft.VSTS.Scheduling.Size";

export interface ApplyInput {
  c: Level;
  u: Level;
  e: Level;
  fieldRefName: AppliableFieldRef;
}
```

**Replace body** with the two-leg orchestrator from RESEARCH §Pattern 3 (lines 349–425). Critical: per RESEARCH Pitfall 6 (lines 556–575), `setFieldValue` returns `Promise<boolean>` — must check the boolean before calling `.save()`:

```typescript
// RESEARCH §Pitfall 6 (lines 561-573)
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

**Typed-error shape** — pre-cited in RESEARCH §Pattern 3 (lines 370–376):

```typescript
export type ApplyError = {
  leg: "comment" | "field";
  status: number | null;       // HTTP status (comment leg) or null when SDK-class-driven
  sdkErrorClass?: string;      // form-service rejection class name (field leg)
  message: string;             // friendly message for D-11 banner
};
```

**Rename decision** (CONTEXT discretion lines 126–127): planner SHOULD rename to `src/apply/apply.ts` and update the single import site at `src/ui/CalcModal.tsx:35`. Cleaner, no functional risk.

**Atomicity ordering test (APPLY-07):** the orchestrator MUST `await postComment(...)` BEFORE invoking `setFieldValue`. Vitest test in `tests/apply/apply.test.ts` (planner creates) asserts mock-call order. Reference RESEARCH Validation Architecture line 788.

---

### `src/apply/errorMessages.ts` (NEW — utility, pure module)

**Analog:** `src/audit/serialize.ts` (pure module shape) + `src/audit/parse.ts` (tabular branch logic with regex/case fallback).

**Pure-module shape** — `src/audit/serialize.ts:1-11` is the model:

```typescript
// src/audit/serialize.ts — Source: D-01, D-02; verified determinism in Node 24.15
import type { AuditPayload } from './types';

const SENTINEL_KEYS: ReadonlyArray<keyof AuditPayload> = ['sp', 'c', 'u', 'e', 'schemaVersion'];

export function serialize(payload: AuditPayload): string {
  const json = JSON.stringify(payload, [...SENTINEL_KEYS] as string[]);
  const human = `Story Points: ${payload.sp} (Complexity=${payload.c}, Uncertainty=${payload.u}, Effort=${payload.e})`;
  return `<!-- sp-calc:v1 ${json} -->\n${human}`;
}
```

**Friendly-message mapper** — verbatim from RESEARCH §Pattern 4 (lines 432–446):

```typescript
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
```

**SDK-error → status mapper** — verbatim from RESEARCH §Pattern 4 (lines 458–472):

```typescript
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

**SDK-free constraint:** zero imports from `azure-devops-extension-sdk` / `azure-devops-extension-api`. This guarantees vitest can import the module directly without mocking the SDK.

---

### `src/ui/ConfirmOverwritePanel.tsx` (NEW — component, event-driven React)

**Analog:** `src/ui/NoFieldMessage.tsx` (body-replacement shape — flex column, centered, replaces calculator) + `src/ui/CalcModal.tsx:343-364` (ButtonGroup row).

**Header + imports — `src/ui/NoFieldMessage.tsx:1-7` is the template**:

```typescript
// src/ui/NoFieldMessage.tsx (lines 1-7)
// src/ui/NoFieldMessage.tsx — Source: D-19, Override 3; UI-SPEC §No-field state.
// Replaces the entire calculator UI when FieldResolver returns null for both
// StoryPoints and Size. Close button cannot programmatically dismiss the host
// dialog (Override 1 / no closeCustomDialog API), so a permanent hint sits below.
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { Button } from "azure-devops-ui/Button";
```

**ButtonGroup pattern — `src/ui/CalcModal.tsx:343-364`:**

```typescript
// src/ui/CalcModal.tsx (lines 343-364)
<div
  style={{
    marginTop: 24,
    display: "flex",
    justifyContent: "flex-end",
  }}
>
  <ButtonGroup>
    <Button
      text="Cancel"
      onClick={handleCancel}
      ariaLabel="Cancel and close dialog"
    />
    <Button
      text="Apply"
      primary={true}
      onClick={handleApply}
      disabled={!isAllSelected || isLoading}
      ariaLabel="Apply Story Points to work item"
    />
  </ButtonGroup>
</div>
```

**ConfirmOverwritePanel applies this with:**
- Outer container: flex column matching `NoFieldMessage`'s body-replacement shape (UI-SPEC line 113–146).
- Two-column grid for "Current SP / New SP" rows: `display: grid; grid-template-columns: max-content 1fr; column-gap: 16px; row-gap: 8px;` (UI-SPEC line 142).
- ButtonGroup with `Back` (default) + `Confirm Apply` (`primary={true}`) — order/style per UI-SPEC line 144–146.
- Props: `{ currentSp: number; newSp: number; onBack: () => void; onConfirm: () => void; }` (state held by orchestrator per UI-SPEC line 105 mounting rule).

---

### `src/ui/ReadOnlyMessage.tsx` (NEW — component, event-driven React)

**Analog:** `src/ui/NoFieldMessage.tsx` — exact parallel shape per CONTEXT D-06 line 55.

**Pattern excerpt — entire `src/ui/NoFieldMessage.tsx`** (lines 1-36):

```typescript
// src/ui/NoFieldMessage.tsx — Source: D-19, Override 3; UI-SPEC §No-field state.
// Replaces the entire calculator UI when FieldResolver returns null for both
// StoryPoints and Size. Close button cannot programmatically dismiss the host
// dialog (Override 1 / no closeCustomDialog API), so a permanent hint sits below.
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { Button } from "azure-devops-ui/Button";

interface Props {
  typeName: string;
}

export const NoFieldMessage: React.FC<Props> = ({ typeName }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 280,
      gap: 16,
    }}
  >
    <MessageCard severity={MessageCardSeverity.Info}>
      {`This work item type (${typeName}) doesn't have a Story Points field. ` +
        `The Story Point Calculator works on work item types that include ` +
        `Microsoft.VSTS.Scheduling.StoryPoints (Agile/Scrum/Basic processes) or ` +
        `Microsoft.VSTS.Scheduling.Size (CMMI process).`}
    </MessageCard>
    <Button text="Close" ariaLabel="Close dialog" />
    <p style={{ fontSize: "11px", opacity: 0.5, marginTop: 8 }}>
      Press Esc or click outside the dialog to close.
    </p>
  </div>
);
```

**Phase 4 application:**
- Same flex-column container with `minHeight: 280`.
- Same `MessageCard severity={MessageCardSeverity.Info}` (CONTEXT D-06 line 55).
- Copy verbatim from CONTEXT specifics line 241: *"You don't have permission to change this work item. The Story Point Calculator is read-only here."*
- Per UI-SPEC line 167: NO Close button (read-only branch has no action). Keep only the 11px-opacity-0.5 hint paragraph: *"Press Esc or click outside to close."*
- Props: empty (no parameters needed — copy is fixed).

---

### `src/ui/SavingOverlay.tsx` (NEW — component, event-driven React)

**Analog:** `src/ui/CalcModal.tsx:287-294` (existing Spinner usage during loading).

**Spinner pattern excerpt — `src/ui/CalcModal.tsx:287-294`**:

```typescript
// src/ui/CalcModal.tsx (lines 287-294)
{isLoading && (
  <div style={{ marginBottom: 16 }}>
    <Spinner
      size={SpinnerSize.medium}
      ariaLabel="Loading prior calculation"
    />
  </div>
)}
```

**Phase 4 application** — UI-SPEC §"Saving overlay (D-15)" lines 170–199 dictates structure:
- Outer absolutely-positioned div: `position: absolute; inset: 0; background: var(--surface-background-color); opacity: 0.6;` (UI-SPEC line 196).
- ARIA: `role="status"`, `aria-live="polite"` on overlay; `aria-busy="true"` on the underlying body region (UI-SPEC line 198).
- Spinner: `<Spinner size={SpinnerSize.medium} ariaLabel="Saving" />` centered (UI-SPEC line 199).
- "Saving…" label below spinner: `13px / weight 400 / opacity 0.8` + literal U+2026 ellipsis (UI-SPEC line 200).
- Per RESEARCH Pitfall 7 (lines 577–586): `pointer-events: none` alone is insufficient — also set `aria-hidden="true"` on the body container during `mode === "saving"` and pass `disabled={mode === "saving"}` to the underlying Dropdown3 components.

---

### `src/ui/CalcModal.tsx` (MOD — extend orchestrator)

**Analog:** itself (Phase 3 read-path effect + banner stack).

**Banner-stack ordering pattern — `src/ui/CalcModal.tsx:296-311`:**

```typescript
// src/ui/CalcModal.tsx (lines 296-311)
{/* Banner stack: resolver-fail → read-error → pre-fill (UI-SPEC §FieldResolver-fail). */}
{readResult?.errors.fieldsRejected && <FieldResolverFailBanner />}
{readResult?.errors.commentsRejected && <ReadErrorBanner />}
{readResult?.prefill && !bannerDismissed && (
  <PreFillBanner
    dateIso={
      readResult.comments
        .filter((cm) => cm.isDeleted !== true)
        .map((cm) => cm.createdDate)
        .sort()
        .reverse()[0] ?? new Date().toISOString()
    }
    mismatchSp={mismatchSp}
    onDismiss={() => setBannerDismissed(true)}
  />
)}
```

**Phase 4 banner-stack extension** (CONTEXT D-07, code_context line 209):
```
resolver-fail → read-error → permission-warn (D-07) → pre-fill
```
…plus error banners (CommentFailBanner, FieldFailBanner) replace the stack content during `mode === "commentFail"` or `"fieldFail"`.

**Read-path effect parallel reads — `src/ui/CalcModal.tsx:140-160`:**

```typescript
// src/ui/CalcModal.tsx (lines 140-160) — extend by adding a 4th promise for getIsReadOnly
console.log(`${LOG_PREFIX} read path: starting parallel reads`);
const titleP = getWorkItemTitle(formService).then((v) => {
  console.log(`${LOG_PREFIX} read path: title done`, v);
  return v;
});
const spP = getCurrentSpValue(formService, resolvedField).then((v) => {
  console.log(`${LOG_PREFIX} read path: currentSp done`, v);
  return v;
});
const commentsP = fetchCommentsForRead(workItemId, projectId)
  .then((v) => {
    console.log(`${LOG_PREFIX} read path: comments done`, v.length);
    return v;
  })
  .catch((err) => {
    console.warn(`${LOG_PREFIX} getCommentsModern failed`, err);
    commentsRejected = true;
    return [] as Awaited<ReturnType<typeof fetchCommentsForRead>>;
  });
const [title, currentSp, comments] = await Promise.all([titleP, spP, commentsP]);
```

**Phase 4 application:** add a 4th leg `permissionP = getIsReadOnly(formService).then((v) => { console.log(`${LOG_PREFIX} read path: isReadOnly done`, v); return v; });` and destructure into `Promise.all`. Update `setReadResult({ ..., permission })`.

**No-field branch render — `src/ui/CalcModal.tsx:217-228` is the model for all body-replacing branches** (Phase 4 adds a `readonly` branch with the same shape):

```typescript
// src/ui/CalcModal.tsx (lines 217-228)
// No-field branch — REPLACES the entire calculator UI (D-19).
if (readResult && readResult.resolvedField === null) {
  return (
    <Surface background={SurfaceBackground.neutral}>
      <Page className="flex-grow">
        <Header title="Calculate Story Points" titleSize={TitleSize.Medium} />
        <div className="page-content page-content-top">
          <NoFieldMessage typeName={readResult.context.workItemTypeName || "(unknown)"} />
        </div>
      </Page>
    </Surface>
  );
}
```

**Phase 4 readonly branch** parallels this exactly, swapping `<NoFieldMessage>` for `<ReadOnlyMessage />`. Per UI-SPEC line 89: the readonly check happens AFTER the no-field check so a missing field still wins (no point showing read-only when there's nothing to write to).

**State machine** — UI-SPEC lines 70–81 defines the `ModalMode` union. The current `useState<isLoading>(true)` becomes `useState<ModalMode>("loading")`; transitions per UI-SPEC line 83–102 transition table.

**Apply payload immutability — RESEARCH Pitfall 7 line 585:** capture `c, u, e, fieldRefName` at the moment of Apply / Confirm Apply click (not on each Retry render); pass into `applyToWorkItem`. The state held in `c, u, e` is what re-runs on Retry — but RESEARCH explicitly warns this can drift if the user tabs into a dropdown during the saving overlay. Planner: the immutability guard already lives in CalcModal because dropdowns get `disabled={mode === "saving"}`; document it explicitly in the apply handler.

---

## Shared Patterns

### Auth + URL construction
**Source:** `src/ado/comments.ts:54-72` (Phase 03-04 verified pattern)
**Apply to:** `src/ado/adoFetch.ts` only (single source of truth post-refactor); `comments.ts` and `postComment.ts` consume the helper.

```typescript
const host = SDK.getHost();
const token = await SDK.getAccessToken();
const baseUrl = host.isHosted
  ? `https://dev.azure.com/${host.name}`
  : `https://${host.name}.visualstudio.com`;
const url =
  `${baseUrl}/${encodeURIComponent(projectId)}/_apis/wit/workItems/${workItemId}/comments?api-version=${apiVersion}`;
```

### Error handling
**Source:** RESEARCH §Pattern 1 (lines 297–310); `src/ado/comments.ts:83-88`
**Apply to:** every `adoFetch` rejection consumer.

```typescript
if (!response.ok) {
  const body = await response.text().catch(() => "");
  throw new Error(`${method} ${path} failed: ${status} ${statusText} ${body.slice(0,200)}`);
  // attach .status onto the Error per RESEARCH Pattern 1
}
```

The orchestrator (`apply.ts`) reads `(err as Error & { status?: number }).status` to drive `friendlyMessageForStatus(status)`.

### Defensive bridge wrappers (try/catch → safe sentinel, never throw)
**Source:** `src/ado/bridge.ts:36-48, 54-64, 71-81`
**Apply to:** `getIsReadOnly` (new wrapper) — same pattern, returns `{ isReadOnly: false, probeFailed: true }` on rejection.

### Console-prefix logging
**Source:** `src/ado/bridge.ts:20`, `src/ado/comments.ts:43`, `src/apply/stubApply.ts:13`, `src/ui/CalcModal.tsx:51`, `src/entries/toolbar.tsx:13`
**Apply to:** every new file. Format: `const LOG_PREFIX = "[sp-calc/<area>]"` near top of module.

### Per-leg promise logging in parallel reads
**Source:** `src/ui/CalcModal.tsx:140-160`
**Apply to:** the extended Promise.all that adds the `getIsReadOnly` leg in `CalcModal.tsx`.

### Pure-module + vitest table-driven tests
**Source:** `tests/audit/serialize.test.ts:1-61`, `tests/audit/parse.test.ts:1-60`

```typescript
import { describe, it, expect } from 'vitest';
// ... imports under test

describe('<thing>: <D-ID>', () => {
  it.each([
    [/* row */],
    [/* row */],
  ])('case %s → %s', (input, expected) => {
    expect(fn(input)).toEqual(expected);
  });
});
```

**Apply to:**
- `tests/apply/errorMessages.test.ts` — 11 rows for `friendlyMessageForStatus` (RESEARCH lines 640–656 has the verbatim test). Plus 4 rows for `mapSdkErrorToStatus` per RESEARCH line 453–456.
- `tests/ado/postComment.test.ts` — assert URL composition (encodeURIComponent on projectId, api-version=7.0-preview.3, path shape) and body shape (`{ text: <serialize output>, format: 1 }`). Mock `adoFetch` (`vi.mock`) and assert call args. Also covers `tests/ado/adoFetch.test.ts` for URL construction (host name, isHosted branch, api-version query param) per CONTEXT D-18 line 110–114.
- `tests/apply/apply.test.ts` — atomicity ordering (mock comment POST resolves BEFORE setFieldValue is called); D-09 retry path (`skipCommentLeg: true` runs only the field leg).

### MessageCard barrel imports
**Source:** `src/ui/PreFillBanner.tsx:5`, `src/ui/NoFieldMessage.tsx:6`
```typescript
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
```
**Apply to:** all new banner/panel/overlay components (UI-SPEC line 56–60).

### Body-replacement render branch
**Source:** `src/ui/CalcModal.tsx:217-228` (the no-field branch)
**Apply to:** the new `readonly` branch in the same file. Same Surface/Page/Header chrome, swap the body component.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| (none) | — | — | Every Phase 4 file has a strong existing analog. The "no-analog" risks are concentrated in spike-validated behaviors (D-02 sentinel preservation, D-05 isReadOnly mechanism) rather than file-shape patterns. |

---

## Metadata

**Analog search scope:** `src/**/*.{ts,tsx}` (27 files), `tests/**/*.test.ts` (5 files), `.planning/phases/04-write-path-edge-cases/04-RESEARCH.md`, `.planning/phases/04-write-path-edge-cases/04-UI-SPEC.md`, `.planning/phases/04-write-path-edge-cases/04-CONTEXT.md`.

**Files scanned (read in full or targeted slices):**
- `src/ado/comments.ts`, `src/ado/bridge.ts`, `src/ado/index.ts`, `src/ado/types.ts`
- `src/apply/stubApply.ts`
- `src/ui/CalcModal.tsx`, `src/ui/NoFieldMessage.tsx`, `src/ui/PreFillBanner.tsx`, `src/ui/ReadErrorBanner.tsx`, `src/ui/FieldResolverFailBanner.tsx`
- `src/audit/serialize.ts`, `src/audit/parse.ts`, `src/audit/index.ts`, `src/audit/types.ts`
- `src/entries/toolbar.tsx`
- `tests/audit/serialize.test.ts`, `tests/audit/parse.test.ts`
- Phase 4 RESEARCH.md (lines 27, 41, 59, 67, 74, 111, 122, 297–500, 504–597, 600–760), UI-SPEC.md (lines 1–200), CONTEXT.md (full).

**Project skills check:** No `.claude/skills/SKILL.md` found in the repo (Glob `.claude/skills/**/SKILL.md` returned empty). No project skill rules to layer in.

**Pattern extraction date:** 2026-05-02.
