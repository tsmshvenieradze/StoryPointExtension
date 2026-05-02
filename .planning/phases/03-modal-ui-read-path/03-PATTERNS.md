# Phase 3: Modal UI & Read Path - Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 18 (15 new, 3 modified)
**Analogs found:** 17 / 18 (1 first-of-kind — `ModernCommentsClient` subclass)

---

## File Classification

| New/Modified File | Status | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `src/entries/modal.tsx` | MODIFY (gut) | entry (React mount + SDK lifecycle) | request-response (read SDK config + read path) | self (Phase 2 version) | exact (preserve bootstrap, swap body) |
| `src/field/FieldResolver.ts` | NEW | module (pure resolver + module-level cache) | transform (in: form service ref → out: ResolvedField) | `src/calc/levels.ts` + `src/audit/parseLatest.ts` | role-match (frozen consts, pure function) |
| `src/field/types.ts` | NEW | type | n/a | `src/audit/types.ts` | exact (structural type sibling to types.ts in calc/audit) |
| `src/field/index.ts` | NEW | barrel | n/a | `src/calc/index.ts`, `src/audit/index.ts` | exact (barrel re-export pattern) |
| `src/ado/types.ts` | MODIFY (extend) | type | n/a | self (Phase 2 version) | exact (additive extension) |
| `src/ado/bridge.ts` | NEW | bridge (SDK + REST wrapper) | request-response (await SDK service / REST call → coerced result) | `src/entries/toolbar.tsx` (SDK service-id pattern) + Phase 1 audit shape | role-match (SDK boundary) |
| `src/ado/bridge.ts` :: `ModernCommentsClient` | NEW | bridge subclass | request-response (HTTP GET) | **first-of-kind** in this repo — see RESEARCH.md Pattern 2 | no analog |
| `src/ado/index.ts` | NEW | barrel | n/a | `src/calc/index.ts`, `src/audit/index.ts` | exact (barrel re-export) |
| `src/ui/CalcModal.tsx` | NEW | component (top-level orchestrator) | event-driven (state hooks + read-path effect) | `src/entries/modal.tsx` `Hello` component (Phase 2) | role-match (Surface > Page > Header layout) |
| `src/ui/Dropdown3.tsx` | NEW | component (controlled wrapper) | event-driven (onChange → parent state) | RESEARCH.md Pattern 3 + Phase 2 modal `Hello` | role-match |
| `src/ui/CalcPanel.tsx` | NEW | component (read-only display) | transform (props in → render) | `src/entries/modal.tsx` `Hello` body block | role-match (pure render) |
| `src/ui/PreFillBanner.tsx` | NEW | component (banner) | transform | RESEARCH.md Code Examples §"Pre-fill Banner" | role-match (MessageCard wrapper) |
| `src/ui/ReadErrorBanner.tsx` | NEW | component (banner) | transform | sibling to `PreFillBanner.tsx` | role-match |
| `src/ui/NoFieldMessage.tsx` | NEW | component (full-replacement state) | transform | `src/entries/modal.tsx` `ConfigError` component | exact (full-screen MessageCard substitute layout) |
| `src/ui/FieldResolverFailBanner.tsx` | NEW | component (banner) | transform | sibling to `ReadErrorBanner.tsx` | role-match |
| `src/apply/stubApply.ts` | NEW | module (stub handler, Phase 4 swaps) | transform (input → console.log) | `src/audit/serialize.ts` (pure transform) | role-match |
| `tests/field/FieldResolver.test.ts` | NEW | test | n/a | `tests/audit/parseLatest.test.ts` (fake-data fixtures) + `tests/calc/calcEngine.test.ts` (barrel-export test) | exact |
| `.planning/REQUIREMENTS.md` | MODIFY (FIELD-04 wording per D-17) | doc | n/a | self | exact |

---

## Pattern Assignments

### `src/entries/modal.tsx` (entry, request-response — MODIFY)

**Analog:** itself (Phase 2 version)

**Preserve verbatim** (lines 14–35, 79–120):

```tsx
// src/entries/modal.tsx — Phase 2 implementation, lines 14-35
import * as React from "react";
import { createRoot } from "react-dom/client";
import * as SDK from "azure-devops-extension-sdk";
import { Surface, SurfaceBackground } from "azure-devops-ui/Surface";
import { Page as PageRaw } from "azure-devops-ui/Page";
import { Header, TitleSize } from "azure-devops-ui/Header";

// Stale-types narrowing — Page IPageProps is missing `children` declaration.
const Page = PageRaw as unknown as React.FC<
  React.ComponentProps<typeof PageRaw> & { children?: React.ReactNode }
>;

import "azure-devops-ui/Core/override.css";
import type { CalcSpModalConfig } from "../ado/types";

const LOG_PREFIX = "[sp-calc/modal]";
```

**Bootstrap shell (lines 79–120)** — keep intact, only swap the render body:

```tsx
async function bootstrap() {
  await SDK.init({ loaded: false });
  console.log(`${LOG_PREFIX} init() resolved`);
  await SDK.ready();
  console.log(`${LOG_PREFIX} ready() resolved`);

  const config = SDK.getConfiguration() as CalcSpModalConfig | undefined;
  console.log(`${LOG_PREFIX} SDK ready`, { config });

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("#root element missing from modal.html — see RESEARCH §Pitfall 12");
  }

  const root = createRoot(rootEl);

  if (typeof config?.workItemId !== "number") {
    console.error(`${LOG_PREFIX} workItemId missing from configuration`, config);
    root.render(<ConfigError received={config} />);
  } else {
    // PHASE 3 SWAP: replace <Hello/> with <CalcModal/>
    root.render(<CalcModal workItemId={config.workItemId} />);
  }

  await SDK.notifyLoadSucceeded();
  console.log(`${LOG_PREFIX} notifyLoadSucceeded called`);
}

bootstrap().catch((err) => {
  console.error(`${LOG_PREFIX} bootstrap failed`, err);
  SDK.notifyLoadFailed(err instanceof Error ? err : String(err));
});
```

**ConfigError stays as-is (lines 45–57)** — the pattern handles toolbar→modal handoff plumbing bugs and is reused unchanged.

**What changes:**
- Delete `interface HelloProps` and the `Hello` component (lines 41–77).
- Add `import { CalcModal } from "../ui/CalcModal";`
- Render `<CalcModal workItemId={config.workItemId} />` instead of `<Hello workItemId={config.workItemId} />`.

**Critical preservation rules** (do not break Phase 2 lifecycle discipline):
- `SDK.init({ loaded: false })` BEFORE any DOM render.
- `await SDK.ready()` BEFORE `getConfiguration()`.
- `notifyLoadSucceeded()` AT END (else permanent host spinner — Phase 2 Pitfall 3).
- Catch-all bottom calls `notifyLoadFailed`.

---

### `src/field/FieldResolver.ts` (module, transform — NEW)

**Analog:** `src/calc/levels.ts` + `src/audit/parseLatest.ts` (frozen consts + pure function over an injected dependency)

**Imports pattern** (mirror `src/audit/parseLatest.ts` line 1–3 — type-only imports, no SDK runtime):

```ts
// src/field/FieldResolver.ts
// Source: D-18, D-21; verified IWorkItemFormService.getFields shape against
// node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts
import type { IWorkItemFormService } from "azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices";
```

**Frozen-const pattern** (mirror `src/calc/levels.ts` lines 2–8):

```ts
const STORY_POINTS = "Microsoft.VSTS.Scheduling.StoryPoints" as const;
const SIZE = "Microsoft.VSTS.Scheduling.Size" as const;

export type ResolvedField = typeof STORY_POINTS | typeof SIZE | null;
```

**Module-level cache** (no analog — first cache in repo; lifetime-of-iframe per D-18):

```ts
const CACHE: Map<string, ResolvedField> = new Map();
```

**Pure-function-with-fallback pattern** (mirror `src/audit/parseLatest.ts` filter→sort→try-each shape — lines 5–18):

```ts
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
    // D-20: default to StoryPoints when getFields() throws
    console.warn("[sp-calc/field] getFields() failed; defaulting to StoryPoints", err);
    resolved = STORY_POINTS;
  }

  CACHE.set(key, resolved);
  return resolved;
}

// Test-only — NOT re-exported from index.ts
export function _resetCacheForTests(): void {
  CACHE.clear();
}
```

**Logging prefix pattern** (mirror Phase 2's `[sp-calc/modal]` and `[sp-calc/toolbar]` from `src/entries/modal.tsx:39` and `src/entries/toolbar.tsx:13`): `[sp-calc/field]`.

**Defensive `isDeleted !== true` filter** (mirror `src/audit/parseLatest.ts:7`):

```ts
// src/audit/parseLatest.ts:7 — exact same shape we want
const live = comments.filter((c) => c.isDeleted !== true);
```

---

### `src/field/types.ts` (type — NEW)

**Analog:** `src/audit/types.ts`

**Pattern** (mirror `src/audit/types.ts:1-23` — header comment + pure structural types, no runtime imports):

```ts
// src/field/types.ts — Source: D-21; structural types, SDK-free
// Re-exports the resolved-field union from FieldResolver.ts so callers can
// import the type without pulling the runtime cache module.
export type { ResolvedField } from './FieldResolver';
```

If a `IFieldResolver` interface is introduced (planner discretion), follow the structural type pattern from `src/audit/types.ts:18-23` (`AdoComment` minimal-fields shape).

---

### `src/field/index.ts` (barrel — NEW)

**Analog:** `src/calc/index.ts` (line-for-line template)

**Pattern** (copy from `src/calc/index.ts:1-7`):

```ts
// src/calc/index.ts — Source: D-15, D-17 public API
export { LEVELS, LEVEL_TO_SCORE, SCORE_TO_LEVEL, levelToScore, scoreToLevel } from './levels';
export type { Level, Score } from './levels';
export { roundFib, FIB_THRESHOLDS } from './fibonacci';
export type { FibonacciSp } from './fibonacci';
export { calculate, weightedSum, rawSp } from './engine';
export type { CalcInput, CalcResult } from './engine';
```

**Apply to `src/field/index.ts`:**

```ts
// src/field/index.ts — Source: D-21 public API
export { resolve } from './FieldResolver';
export type { ResolvedField, ResolveArgs } from './FieldResolver';
```

Do NOT re-export `_resetCacheForTests` — test-only helper consumed by direct import in `tests/field/FieldResolver.test.ts`.

---

### `src/ado/types.ts` (type — MODIFY/extend)

**Analog:** itself

**Preserve existing** (`src/ado/types.ts:1-15`):

```ts
// src/ado/types.ts
// Source: D-11 in CONTEXT.md.
// Phase 3 expands this with FieldResolver types and CalcSpModalResult.

export type CalcSpModalConfig = {
  workItemId: number;
};
```

**Extend with read-path types** (per D-22 / RESEARCH §Component Responsibilities):

```ts
import type { ResolvedField } from "../field";
import type { AuditPayload, AdoComment } from "../audit/types";

/** Snapshot of work item context fetched at modal open (D-03 context line). */
export type WorkItemContext = {
  workItemId: number;
  workItemTypeName: string;       // from getFieldValue("System.WorkItemType")
  title: string;                  // from getFieldValue("System.Title")
  currentSp: number | null;       // null when unset / coercion fails (D-26)
};

/** Aggregated read-path result handed to <CalcModal>. */
export type CalcSpReadResult = {
  resolvedField: ResolvedField;
  context: WorkItemContext;
  comments: AdoComment[];
  prefill: AuditPayload | null;
  errors: {
    fieldsRejected: boolean;       // D-20 — getFields() failed
    commentsRejected: boolean;     // D-25 — getComments failed
  };
};
```

Type names (`WorkItemContext`, `CalcSpReadResult`) are planner discretion; structural shape above is what the bridge + UI consume.

---

### `src/ado/bridge.ts` (bridge, request-response — NEW)

**Analog:** `src/entries/toolbar.tsx` (SDK service-id pattern) + RESEARCH.md Pattern 2 (subclass)

**SDK service-id pattern** (mirror `src/entries/toolbar.tsx:18-20` — string literal + pinned source comment):

```ts
// src/entries/toolbar.tsx, lines 18-20 — exact pattern to copy
// CommonServiceIds is declared as a `const enum` upstream; with our
// `isolatedModules: true` tsconfig we cannot access const-enum members at
// runtime. Use the string literal directly — value verified in
// node_modules/azure-devops-extension-api/Common/CommonServices.d.ts and
// in RESEARCH §interfaces (CommonServiceIds.HostPageLayoutService).
const HOST_PAGE_LAYOUT_SERVICE_ID = "ms.vss-features.host-page-layout-service";
```

**Apply for WorkItemFormService:**

```ts
// node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts
// declare enum WorkItemTrackingServiceIds { WorkItemFormService = "ms.vss-work-web.work-item-form" }
const WORK_ITEM_FORM_SERVICE_ID = "ms.vss-work-web.work-item-form";
```

**Defensive coercion pattern** (RESEARCH §Pitfall 3 — mirror the structure):

```ts
// src/ado/bridge.ts
// Source: D-22, D-26; RESEARCH §Pitfall 3 + Code Examples
import * as SDK from "azure-devops-extension-sdk";
import type { IWorkItemFormService } from "azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices";
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import { getClient } from "azure-devops-extension-api";
import type { AdoComment } from "../audit/types";

const WORK_ITEM_FORM_SERVICE_ID = "ms.vss-work-web.work-item-form";
const LOG_PREFIX = "[sp-calc/bridge]";

export async function getFormService(): Promise<IWorkItemFormService> {
  return SDK.getService<IWorkItemFormService>(WORK_ITEM_FORM_SERVICE_ID);
}

export async function getCurrentSpValue(
  formService: IWorkItemFormService,
  refName: string,
): Promise<number | null> {
  try {
    const raw = await formService.getFieldValue(refName);
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;  // D-26
  } catch (err) {
    console.warn(`${LOG_PREFIX} getFieldValue(${refName}) failed`, err);
    return null;
  }
}

export async function getWorkItemTitle(formService: IWorkItemFormService): Promise<string> {
  try {
    const raw = await formService.getFieldValue("System.Title");
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

export async function getWorkItemTypeName(formService: IWorkItemFormService): Promise<string> {
  const raw = await formService.getFieldValue("System.WorkItemType");
  return typeof raw === "string" ? raw : "";
}
```

**`ModernCommentsClient` subclass** (FIRST-OF-KIND — no repo analog; copy verbatim from RESEARCH §Pattern 2):

```ts
// src/ado/bridge.ts (continued)
// Source: D-22/D-23 Override 2; RESEARCH §Pattern 2.
// The typed WorkItemTrackingRestClient.getComments() points at LEGACY
// 5.0-preview.2 returning WorkItemComment (no id/isDeleted/createdDate).
// We must hit modern 7.1-preview.4 to get the AdoComment shape parseLatest needs.
interface ModernCommentDto {
  id: number;
  text: string;
  createdDate: string;   // ISO 8601 — string over the wire, NOT Date (Pitfall 5)
  isDeleted: boolean;
  workItemId: number;
  version: number;
}

interface ModernCommentList {
  comments: ModernCommentDto[];
  count: number;
  totalCount: number;
  nextPage?: string;
  continuationToken?: string;
}

class ModernCommentsClient extends WorkItemTrackingRestClient {
  async getCommentsModern(workItemId: number, project: string): Promise<AdoComment[]> {
    const result = await this.beginRequest<ModernCommentList>({
      apiVersion: "7.1-preview.4",
      routeTemplate: "{project}/_apis/wit/workItems/{workItemId}/comments",
      routeValues: { project, workItemId },
    });
    return result.comments
      .filter((c) => typeof c.createdDate === "string")  // Pitfall 5 sanity check
      .map((c) => ({
        id: c.id,
        text: c.text,
        createdDate: c.createdDate,
        isDeleted: c.isDeleted,
      }));
  }
}

export async function fetchCommentsForRead(
  workItemId: number,
  projectId: string,
): Promise<AdoComment[]> {
  const client = getClient(ModernCommentsClient);
  return client.getCommentsModern(workItemId, projectId);
}
```

**Project-id resolution** (RESEARCH §"Resolving Project ID"):

```ts
export function getProjectId(): string {
  return SDK.getWebContext().project.id;
}
```

**Error-handling pattern** (mirror `src/entries/toolbar.tsx:99-103`):

```ts
// All bridge functions either:
//   (a) coerce + return null on failure (getCurrentSpValue, getWorkItemTitle)  ← D-26 path
//   (b) let the rejection propagate to the orchestrator (fetchCommentsForRead) ← D-25 path
// The orchestrator (CalcModal) catches and decides which banner to render.
```

---

### `src/ado/index.ts` (barrel — NEW)

**Analog:** `src/calc/index.ts` (lines 1–7) and `src/audit/index.ts` (lines 1–6)

**Pattern** (copy `src/audit/index.ts:1-6` shape):

```ts
// src/audit/index.ts — Source: D-18, D-19 public API
export { serialize } from './serialize';
export { parse } from './parse';
export { parseLatest } from './parseLatest';
export type { AuditPayload, AdoComment } from './types';
```

**Apply to `src/ado/index.ts`:**

```ts
// src/ado/index.ts — Source: D-22 public API for bridge layer
export {
  getFormService,
  getCurrentSpValue,
  getWorkItemTitle,
  getWorkItemTypeName,
  fetchCommentsForRead,
  getProjectId,
} from './bridge';
export type {
  CalcSpModalConfig,
  WorkItemContext,
  CalcSpReadResult,
} from './types';
```

`ModernCommentsClient` is NOT exported — it is implementation detail consumed only by `fetchCommentsForRead`.

---

### `src/ui/CalcModal.tsx` (component, event-driven — NEW)

**Analog:** `src/entries/modal.tsx` `Hello` component (Phase 2, lines 59–77) for the chrome wrapper; RESEARCH.md Pattern 4 for state.

**Surface > Page > Header chrome pattern** (copy from `src/entries/modal.tsx:60-75`):

```tsx
return (
  <Surface background={SurfaceBackground.neutral}>
    <Page className="flex-grow">
      <Header
        title="Story Point Calculator"
        titleSize={TitleSize.Large}
      />
      <div className="page-content page-content-top">
        {/* body */}
      </div>
    </Page>
  </Surface>
);
```

**Phase 3 application:** UI-SPEC §Layout (D-01) overrides title to `Calculate Story Points` (UI-SPEC line 41 — host title carries it; body Header may use shorter title or be omitted) and `TitleSize.Medium` per UI-SPEC component inventory.

**Trio state + `useMemo` pattern** (RESEARCH.md Pattern 4 — verbatim):

```tsx
import * as React from "react";
import { calculate, type Level } from "../calc";
// ...
const [c, setC] = React.useState<Level | undefined>();
const [u, setU] = React.useState<Level | undefined>();
const [e, setE] = React.useState<Level | undefined>();

const result = React.useMemo(() => {
  if (c === undefined || u === undefined || e === undefined) return null;
  return calculate({ c, u, e });
}, [c, u, e]);
```

**Read-path effect** (no exact analog — synthesize from RESEARCH §Loading & State Sequence):

```tsx
const [readResult, setReadResult] = React.useState<CalcSpReadResult | null>(null);
const [isLoading, setIsLoading] = React.useState(true);

React.useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const formService = await getFormService();
      const projectId = getProjectId();
      const workItemTypeName = await getWorkItemTypeName(formService);
      const resolvedField = await resolve({ formService, projectId, workItemTypeName });

      // Parallel reads now that the fieldRefName is known
      const [title, currentSp, comments] = await Promise.all([
        getWorkItemTitle(formService),
        resolvedField ? getCurrentSpValue(formService, resolvedField) : Promise.resolve(null),
        fetchCommentsForRead(workItemId, projectId).catch((err) => {
          console.warn("[sp-calc/modal] getComments failed", err);
          return null; // sentinel for D-25
        }),
      ]);

      if (cancelled) return;

      const prefill = comments ? parseLatest(comments) : null;
      setReadResult({
        resolvedField,
        context: { workItemId, workItemTypeName, title, currentSp },
        comments: comments ?? [],
        prefill,
        errors: { fieldsRejected: false, commentsRejected: comments === null },
      });
    } catch (err) {
      console.error("[sp-calc/modal] read path failed", err);
      // ... fallback per D-20/D-25
    } finally {
      if (!cancelled) setIsLoading(false);
    }
  })();
  return () => { cancelled = true; };
}, [workItemId]);
```

**Logging prefix:** `[sp-calc/modal]` (mirror `src/entries/modal.tsx:39`).

**Conditional render guards** (mirror `ConfigError` shape from `src/entries/modal.tsx:45-57`):

```tsx
// Three render branches:
if (readResult?.resolvedField === null) return <NoFieldMessage typeName={readResult.context.workItemTypeName} />;
// ... otherwise main calculator UI
```

---

### `src/ui/Dropdown3.tsx` (component, event-driven — NEW)

**Analog:** RESEARCH.md Pattern 3 (verbatim, lines 405–471 of 03-RESEARCH.md). UI-SPEC §"Three Dropdowns (FormItem-wrapped)" enforces FormItem usage.

**Imports — barrel only** (UI-SPEC §"Imports — barrel paths only" + RESEARCH §Pitfall 6):

```tsx
import * as React from "react";
import { Dropdown } from "azure-devops-ui/Dropdown";
import { FormItem } from "azure-devops-ui/FormItem";
import { ListSelection } from "azure-devops-ui/List";
import type { IListBoxItem } from "azure-devops-ui/ListBox";
import { LEVELS, type Level } from "../calc";
```

**Frozen-items pattern** (mirror `src/calc/levels.ts:2-8` — `Object.freeze` + as const):

```tsx
const ITEMS: IListBoxItem<{ level: Level }>[] = LEVELS.map((level) => ({
  id: level,
  text: level,
  data: { level },
}));
```

**ListSelection sync pattern** (RESEARCH Pattern 3, lines 438–447):

```tsx
const selection = React.useMemo(() => new ListSelection(), []);

React.useEffect(() => {
  selection.clear();
  if (value !== undefined) {
    const idx = LEVELS.indexOf(value);
    if (idx >= 0) selection.select(idx);
  }
}, [value, selection]);
```

**FormItem wrap** (UI-SPEC §"Three Dropdowns" line 269):

```tsx
<FormItem label={label}>
  <Dropdown<{ level: Level }>
    items={ITEMS}
    placeholder="Select level…"
    onSelect={(_event, item) => {
      if (item?.data?.level) onChange(item.data.level);
    }}
    selection={selection}
    disabled={disabled}
    ariaLabel={ariaLabel}
  />
</FormItem>
```

---

### `src/ui/CalcPanel.tsx` (component, transform — NEW)

**Analog:** `src/entries/modal.tsx:67-72` (page-content body block + inline-style `fontSize`/`opacity` pattern)

**Inline-style pattern** (mirror `src/entries/modal.tsx:69`):

```tsx
// src/entries/modal.tsx:69 — exact pattern to imitate
<p style={{ fontSize: "12px", opacity: 0.7, marginTop: "16px" }}>
  Press <kbd>Esc</kbd> or click outside the dialog to close.
</p>
```

**Phase 3 application** (UI-SPEC §Calculation Details panel + UI-SPEC §Typography):

```tsx
// src/ui/CalcPanel.tsx
// Source: D-04, D-05; UI-SPEC Calculation Details panel
import * as React from "react";
import type { CalcResult } from "../calc";

const TYPO = {
  heroLabel: { fontSize: "12px", fontWeight: 400, letterSpacing: "0.05em", textTransform: "uppercase" as const, opacity: 0.7 },
  hero: { fontSize: "28px", fontWeight: 600, lineHeight: 1.2 },
  subRow: { fontSize: "13px", fontWeight: 400, lineHeight: 1.4 },
  formula: { fontSize: "12px", fontWeight: 400, lineHeight: 1.5, opacity: 0.7 },
};

const PANEL_STYLE: React.CSSProperties = {
  border: "1px solid var(--callout-border-color)",
  borderRadius: 4,
  padding: "24px 16px",
  marginTop: 24,
};

interface CalcPanelProps {
  result: CalcResult | null;  // null → em-dash placeholders (D-05)
}

export const CalcPanel: React.FC<CalcPanelProps> = ({ result }) => {
  const w = result ? result.w.toFixed(2) : "—";
  const r = result ? result.rawSp.toFixed(2) : "—";
  const sp = result ? String(result.sp) : "—";

  return (
    <section style={PANEL_STYLE} aria-live="polite">
      <div style={TYPO.heroLabel}>Final Story Points</div>
      <div style={TYPO.hero}>{sp}</div>
      <div style={{ ...TYPO.subRow, marginTop: 8, display: "flex", gap: 16 }}>
        <span>W = {w}</span>
        <span>Raw SP = {r}</span>
      </div>
      <p style={{ ...TYPO.formula, marginTop: 16 }}>W = 0.4·C + 0.4·U + 0.2·E</p>
      <p style={TYPO.formula}>SP = round_fib(0.5 × 26^((W−1)/4))</p>
    </section>
  );
};
```

**Em-dash codepoint** (UI-SPEC Verification Rubric Dimension 1 — U+2014 literal, NOT ASCII `-`).

---

### `src/ui/PreFillBanner.tsx` (component, transform — NEW)

**Analog:** RESEARCH §"Pre-fill Banner with Date Format" (lines 712–733)

**Imports — barrel** (UI-SPEC):

```tsx
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
```

**Date-format helper** (RESEARCH line 716–719 — verbatim):

```tsx
function formatBannerDate(iso: string): string {
  const fmt = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" });
  return fmt.format(new Date(iso));
}
```

**Banner render with mismatch addendum** (UI-SPEC §"Pre-fill banner (Info MessageCard)" lines 222–231):

```tsx
interface Props {
  dateIso: string;
  mismatchSp: number | null;   // null when sentinel.sp === currentSp
  onDismiss: () => void;
}

export const PreFillBanner: React.FC<Props> = ({ dateIso, mismatchSp, onDismiss }) => (
  <MessageCard severity={MessageCardSeverity.Info} onDismiss={onDismiss}>
    {`Pre-filled from your last calculation on ${formatBannerDate(dateIso)}.`}
    {mismatchSp !== null
      ? ` Field currently shows ${mismatchSp} — may have been edited directly.`
      : null}
  </MessageCard>
);
```

**Em-dash in addendum** is U+2014 (literal — NOT ASCII).

---

### `src/ui/ReadErrorBanner.tsx` (component, transform — NEW)

**Analog:** sibling to `PreFillBanner.tsx`; UI-SPEC §"Read-error banner" lines 240–243

```tsx
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";

export const ReadErrorBanner: React.FC = () => (
  <MessageCard severity={MessageCardSeverity.Warning}>
    Could not load prior calculations — starting fresh.
  </MessageCard>
);
```

No `onDismiss` — UI-SPEC line 246 forbids dismissal.

---

### `src/ui/FieldResolverFailBanner.tsx` (component, transform — NEW)

**Analog:** sibling to `ReadErrorBanner.tsx`; UI-SPEC §"FieldResolver-fail banner" lines 250–254

```tsx
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";

export const FieldResolverFailBanner: React.FC = () => (
  <MessageCard severity={MessageCardSeverity.Warning}>
    Could not detect field type — assuming Microsoft.VSTS.Scheduling.StoryPoints.
  </MessageCard>
);
```

---

### `src/ui/NoFieldMessage.tsx` (component, transform — NEW)

**Analog:** `src/entries/modal.tsx:45-57` `ConfigError` component (full-replacement layout)

**Pattern from `ConfigError`** (lines 45–57):

```tsx
const ConfigError: React.FC<{ received: unknown }> = ({ received }) => (
  <Surface background={SurfaceBackground.neutral}>
    <Page className="flex-grow">
      <Header title="Story Point Calculator — Configuration Error" titleSize={TitleSize.Large} />
      <div className="page-content page-content-top">
        <p>The dialog opened without a valid <code>workItemId</code> configuration. ...</p>
        <p style={{ fontSize: "12px", opacity: 0.7, marginTop: "16px" }}>
          Received configuration: <code>{JSON.stringify(received) ?? "undefined"}</code>
        </p>
      </div>
    </Page>
  </Surface>
);
```

**Phase 3 application** (UI-SPEC §"No-field state" lines 258–264 — replace whole calculator UI with centered MessageCard + Close button):

```tsx
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { Button } from "azure-devops-ui/Button";

interface Props { typeName: string; }

export const NoFieldMessage: React.FC<Props> = ({ typeName }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 280,
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

**Why `ConfigError` is the analog:** both render an error/empty terminal state inside the Phase 2 Surface > Page > Header chrome, with no calc body. `NoFieldMessage` differs by replacing the body of `<CalcModal>` rather than being rendered standalone — the chrome wraps both via `CalcModal`'s top-level Surface/Page.

---

### `src/apply/stubApply.ts` (module, transform — NEW)

**Analog:** `src/audit/serialize.ts` (small pure module + comment header pointing at decisions; lines 1–11)

**Pattern from `src/audit/serialize.ts`:**

```ts
// src/audit/serialize.ts — Source: D-01, D-02; verified determinism in Node 24.15
import type { AuditPayload } from './types';

const SENTINEL_KEYS: ReadonlyArray<keyof AuditPayload> = ['sp', 'c', 'u', 'e', 'schemaVersion'];

export function serialize(payload: AuditPayload): string {
  const json = JSON.stringify(payload, [...SENTINEL_KEYS] as string[]);
  const human = `Story Points: ${payload.sp} (Complexity=${payload.c}, Uncertainty=${payload.u}, Effort=${payload.e})`;
  return `<!-- sp-calc:v1 ${json} -->\n${human}`;
}
```

**Phase 3 application** (D-27 stub — Phase 4 replaces with real handler):

```ts
// src/apply/stubApply.ts — Source: D-27 (stub-Apply boundary in Phase 3).
// Phase 4 will replace the body with setFieldValue + addComment, preserving
// the same input shape so the swap is a one-file diff.
import { calculate, type Level } from "../calc";
import { serialize, type AuditPayload } from "../audit";
import type { ResolvedField } from "../field";

const LOG_PREFIX = "[sp-calc/apply]";

export interface ApplyInput {
  c: Level;
  u: Level;
  e: Level;
  fieldRefName: Exclude<ResolvedField, null>;
}

export function stubApply(input: ApplyInput): void {
  const result = calculate({ c: input.c, u: input.u, e: input.e });
  const payload: AuditPayload = {
    sp: result.sp,
    c: input.c,
    u: input.u,
    e: input.e,
    schemaVersion: 1,
  };
  const comment = serialize(payload);
  console.log(
    `${LOG_PREFIX} would write SP=${result.sp}, fieldRefName=${input.fieldRefName}, comment=${comment}`,
  );
  // No setFieldValue / addComment / dialog close in Phase 3.
}
```

**Logging prefix `[sp-calc/apply]`** matches CONTEXT.md specifics §6.

---

### `tests/field/FieldResolver.test.ts` (test — NEW)

**Analog:** `tests/audit/parseLatest.test.ts` (fake-data factory + behavior table) + `tests/calc/calcEngine.test.ts:37-50` (barrel-export assertion)

**Imports + factory pattern** (mirror `tests/audit/parseLatest.test.ts:1-10`):

```ts
// tests/audit/parseLatest.test.ts — pattern to copy
import { describe, it, expect } from 'vitest';
import { parseLatest } from '../../src/audit/parseLatest';
import type { AdoComment, AuditPayload } from '../../src/audit/types';

const make = (id: number, dateIso: string, text: string, isDeleted = false): AdoComment =>
  ({ id, createdDate: dateIso, text, isDeleted });
```

**Apply for FieldResolver** (D-30 enumerates 5 cases):

```ts
// tests/field/FieldResolver.test.ts — Source: D-30
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolve, _resetCacheForTests } from '../../src/field/FieldResolver';
import * as fieldBarrel from '../../src/field/index';

const STORY_POINTS = "Microsoft.VSTS.Scheduling.StoryPoints";
const SIZE = "Microsoft.VSTS.Scheduling.Size";

// Hand-rolled fake — no SDK mock per CONTEXT §"No mocks for SDK in unit tests"
const makeFakeFormService = (refNames: string[], shouldThrow = false) => ({
  getFields: vi.fn().mockImplementation(() =>
    shouldThrow
      ? Promise.reject(new Error("getFields failed"))
      : Promise.resolve(refNames.map((rn) => ({ referenceName: rn, isDeleted: false })))
  ),
});

beforeEach(() => {
  _resetCacheForTests();
});

describe('FieldResolver (FIELD-01, FIELD-02, FIELD-03, D-20)', () => {
  it('returns StoryPoints when StoryPoints is present', async () => {
    const formService = makeFakeFormService([STORY_POINTS, "System.Title"]);
    const result = await resolve({ formService, projectId: "p1", workItemTypeName: "User Story" });
    expect(result).toBe(STORY_POINTS);
  });

  it('falls back to Size when StoryPoints absent (CMMI)', async () => {
    const formService = makeFakeFormService([SIZE, "System.Title"]);
    const result = await resolve({ formService, projectId: "p1", workItemTypeName: "Requirement" });
    expect(result).toBe(SIZE);
  });

  it('returns null when both absent', async () => {
    const formService = makeFakeFormService(["System.Title"]);
    const result = await resolve({ formService, projectId: "p1", workItemTypeName: "Test Plan" });
    expect(result).toBeNull();
  });

  it('caches by (projectId, workItemTypeName); second call does not re-probe', async () => {
    const formService = makeFakeFormService([STORY_POINTS]);
    await resolve({ formService, projectId: "p1", workItemTypeName: "User Story" });
    await resolve({ formService, projectId: "p1", workItemTypeName: "User Story" });
    expect(formService.getFields).toHaveBeenCalledTimes(1);
  });

  it('different cache key triggers re-probe', async () => {
    const formService = makeFakeFormService([STORY_POINTS]);
    await resolve({ formService, projectId: "p1", workItemTypeName: "User Story" });
    await resolve({ formService, projectId: "p2", workItemTypeName: "User Story" });
    expect(formService.getFields).toHaveBeenCalledTimes(2);
  });

  it('defaults to StoryPoints when getFields() throws (D-20)', async () => {
    const formService = makeFakeFormService([], true);
    const result = await resolve({ formService, projectId: "p1", workItemTypeName: "User Story" });
    expect(result).toBe(STORY_POINTS);
  });
});

// Barrel export contract — mirror tests/calc/calcEngine.test.ts:37-50
describe('public API barrel (D-21)', () => {
  it('src/field/index.ts re-exports the documented surface', () => {
    expect(typeof fieldBarrel.resolve).toBe('function');
  });
});
```

**`isDeleted` filter test** (mirror `tests/audit/parseLatest.test.ts:49-55`):

```ts
it('excludes isDeleted: true fields from resolution (Pitfall 4)', async () => {
  const formService = {
    getFields: vi.fn().mockResolvedValue([
      { referenceName: STORY_POINTS, isDeleted: true },   // soft-deleted custom variant
      { referenceName: SIZE, isDeleted: false },
    ]),
  };
  const result = await resolve({ formService, projectId: "p1", workItemTypeName: "X" });
  expect(result).toBe(SIZE);
});
```

**Conventions to copy from existing tests:**
- File path: `tests/<module>/<file>.test.ts` mirrors `src/<module>/<file>.ts` (per `tests/audit/parseLatest.test.ts`).
- Header comment cites decisions: `// Source: D-30` (mirror `tests/audit/parseLatest.test.ts:1`).
- `import { describe, it, expect } from 'vitest'` (NOT `@jest/globals` — vitest is the runner per Phase 0).
- Use `vi.fn()` for spy/mock (vitest API). No `jest.fn()`.
- Fake-data factory at top of file (mirror `make` helper in `parseLatest.test.ts:6`).
- Arrange-Act-Assert each `it` block — terse 2–4 lines (mirror `parseLatest.test.ts:17-22`).

---

### `.planning/REQUIREMENTS.md` (doc — MODIFY)

**Analog:** itself

**Action** (per D-17, RESEARCH Override 3):

Replace FIELD-04 wording from:
> "When neither field is present on the work item type, the toolbar button is rendered disabled with a tooltip explaining which field types are supported."

To:
> "When neither field is present on the work item type, the modal opens and shows a clear message explaining which work item types are supported, with a Close button. The toolbar button remains enabled."

Planner MUST schedule this edit as a task in the Phase 3 plan; otherwise verifier fails Phase 3 against literal pre-discussion FIELD-04 text.

---

## Shared Patterns

### Pattern S1: SDK service-id string-literal workaround

**Source:** `src/entries/toolbar.tsx:18-25` (Phase 2)

**Apply to:** `src/ado/bridge.ts` (any `SDK.getService<T>(...)` call)

```ts
// node_modules/<package>/<file>.d.ts — declare enum <X> { Y = "..." }
const FOO_SERVICE_ID = "ms.vss-..."; // string literal — const enum unusable under isolatedModules
const svc = await SDK.getService<IFooService>(FOO_SERVICE_ID);
```

**Why:** `isolatedModules: true` in `tsconfig.json` (Phase 0) forbids const-enum runtime access. Use string literals; cite verified .d.ts source path in a comment.

---

### Pattern S2: `[sp-calc/<area>]` console-log prefix

**Source:** `src/entries/modal.tsx:39` (`[sp-calc/modal]`), `src/entries/toolbar.tsx:13` (`[sp-calc/toolbar]`)

**Apply to:** every Phase 3 module that logs at runtime.

| Module | Prefix |
|--------|--------|
| `src/ui/CalcModal.tsx` | `[sp-calc/modal]` (continuation) |
| `src/field/FieldResolver.ts` | `[sp-calc/field]` |
| `src/ado/bridge.ts` | `[sp-calc/bridge]` |
| `src/apply/stubApply.ts` | `[sp-calc/apply]` |

```ts
const LOG_PREFIX = "[sp-calc/<area>]";
console.log(`${LOG_PREFIX} <message>`, optionalContext);
console.warn(`${LOG_PREFIX} <message>`, err);
console.error(`${LOG_PREFIX} <message>`, err);
```

---

### Pattern S3: Bootstrap shell + bottom catch-all

**Source:** `src/entries/modal.tsx:79-120` and `src/entries/toolbar.tsx:91-103`

**Apply to:** `src/entries/modal.tsx` (preserve verbatim) — no other Phase 3 file owns a bootstrap.

```ts
async function bootstrap() {
  await SDK.init({ loaded: false });
  await SDK.ready();
  // ... read config / register / render ...
  await SDK.notifyLoadSucceeded();
}

bootstrap().catch((err) => {
  console.error(`${LOG_PREFIX} bootstrap failed`, err);
  SDK.notifyLoadFailed(err instanceof Error ? err : String(err));
});
```

**Critical:** `notifyLoadSucceeded` MUST be reached on the happy path; `notifyLoadFailed` MUST be reached on any thrown error. Otherwise the host shows a permanent spinner over the dialog (Phase 2 Pitfall 3).

---

### Pattern S4: `Object.freeze` + `as const` for canonical literals

**Source:** `src/calc/levels.ts:2-8` and `src/calc/fibonacci.ts:6-13`

**Apply to:** `src/field/FieldResolver.ts` (frozen field-name constants) and any Phase 3 lookup table.

```ts
// src/calc/levels.ts:2-8
export const LEVELS = Object.freeze([
  'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard',
] as const);
export type Level = (typeof LEVELS)[number];
```

For FieldResolver, simpler `as const` literals suffice (only two values):

```ts
const STORY_POINTS = "Microsoft.VSTS.Scheduling.StoryPoints" as const;
const SIZE = "Microsoft.VSTS.Scheduling.Size" as const;
export type ResolvedField = typeof STORY_POINTS | typeof SIZE | null;
```

---

### Pattern S5: Barrel re-export per module

**Source:** `src/calc/index.ts:1-7`, `src/audit/index.ts:1-6`

**Apply to:** `src/field/index.ts`, `src/ado/index.ts` (and indirectly enforced by `tests/field/FieldResolver.test.ts` barrel-API assertion).

```ts
// Header comment + value re-exports + type re-exports (separated by `export type {`).
export { fnA, fnB } from './module';
export type { TypeA, TypeB } from './module';
```

---

### Pattern S6: Defensive coercion at the SDK boundary

**Source:** RESEARCH §Pitfall 3 (`getFieldValue` returns `Promise<Object>`)

**Apply to:** every `IWorkItemFormService.getFieldValue(...)` call inside `src/ado/bridge.ts`.

```ts
// number coercion
const raw = await formService.getFieldValue(refName);
const num = Number(raw);
return Number.isFinite(num) ? num : null;

// string coercion
const raw = await formService.getFieldValue("System.Title");
return typeof raw === "string" ? raw : "";
```

**Never** trust the typed `Promise<Object>` return shape; the runtime can be `undefined`, `number`, or `string` depending on field type.

---

### Pattern S7: barrel-only `azure-devops-ui` imports (Pitfall 6)

**Source:** UI-SPEC §"Imports — barrel paths only" (lines 45–56) + `src/entries/modal.tsx:17-19`

**Apply to:** all `src/ui/*.tsx` files.

```tsx
// GOOD — barrel import; per-component CSS rides along
import { Dropdown } from "azure-devops-ui/Dropdown";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";

// BAD — deep import bypasses CSS, theme breaks
import { Dropdown } from "azure-devops-ui/Components/Dropdown/Dropdown";
```

Keep `import "azure-devops-ui/Core/override.css";` at the top of `src/entries/modal.tsx` (Phase 2, line 35) — base layout/typography import; do NOT replicate inside `src/ui/*.tsx` (one-per-iframe is enough).

---

### Pattern S8: `isDeleted !== true` defensive filter

**Source:** `src/audit/parseLatest.ts:7`

**Apply to:** `src/field/FieldResolver.ts` (filter deleted `WorkItemField` entries) and any future iteration over comments.

```ts
const live = items.filter((x) => x.isDeleted !== true);
```

**Why `!== true` and not `!x.isDeleted`:** the field may be `undefined` (not `false`); `!== true` matches "explicitly deleted only" semantics from `src/audit/parseLatest.ts`.

---

### Pattern S9: Stale-types `as unknown as React.FC<...>` narrowing

**Source:** `src/entries/modal.tsx:28-30`

**Apply to:** any `azure-devops-ui` component whose `.d.ts` is missing `children` (planner verifies during implementation; default to copy-paste from Phase 2 modal).

```tsx
const Page = PageRaw as unknown as React.FC<
  React.ComponentProps<typeof PageRaw> & { children?: React.ReactNode }
>;
```

`CalcModal` reuses this exact wrapper — preserve the comment block from `src/entries/modal.tsx:21-27` explaining why.

---

### Pattern S10: Vitest test layout

**Source:** `tests/calc/calcEngine.test.ts` (header + describe blocks + barrel export check) and `tests/audit/parseLatest.test.ts` (factory helper + behavior table)

**Apply to:** `tests/field/FieldResolver.test.ts`.

```ts
// tests/<module>/<file>.test.ts — Source: <decision IDs>
import { describe, it, expect } from 'vitest';
import { <fn> } from '../../src/<module>/<file>';
import * as <module>Barrel from '../../src/<module>/index';

const make<X> = (...): <Type> => ({ ... });   // factory at top

describe('<module>: <requirement>', () => {
  it('<terse behavior>', () => { ... });
  it.each([...])('<param-table label>', ({ ... }) => { ... });
});

describe('public API barrel', () => {
  it('src/<module>/index.ts re-exports the documented surface', () => {
    expect(typeof <module>Barrel.<fn>).toBe('function');
  });
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason | Mitigation |
|------|------|-----------|--------|------------|
| `src/ado/bridge.ts :: ModernCommentsClient` (subclass + `beginRequest` override) | bridge subclass | request-response (HTTP GET) | First REST-client subclass in repo; Phase 1/2 never touched REST | Use RESEARCH §Pattern 2 (verbatim, lines 336–393) and RESEARCH §"Reading Modern Comments" (lines 671–697) — both contain copy-ready snippets |

---

## Metadata

**Analog search scope:**
- `src/calc/**` (Phase 1 — frozen pure modules; pattern source for canonical literals + barrel + pure functions)
- `src/audit/**` (Phase 1 — frozen pure modules; pattern source for structural types + filter→sort→try-each pure function shape + `isDeleted` filter)
- `src/entries/**` (Phase 2 — SDK lifecycle + Surface/Page chrome + ConfigError full-replacement layout + service-id workaround + bootstrap catch-all)
- `src/ado/**` (Phase 2 stub — extension target)
- `tests/calc/**` and `tests/audit/**` (vitest layout + factory helpers + barrel-export assertion)

**Files scanned:** 12 source files, 4 test files, 3 phase-3 planning artifacts (CONTEXT, RESEARCH, UI-SPEC).

**Pattern extraction date:** 2026-05-02
