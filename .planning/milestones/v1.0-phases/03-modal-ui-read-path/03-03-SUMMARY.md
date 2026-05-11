---
phase: 03-modal-ui-read-path
plan: 03
subsystem: modal-ui
tags: [react-18, azure-devops-ui, modal, dropdown, message-card, button-group, read-path, stub-apply, override-1, override-2, override-3]

# Dependency graph
requires:
  - phase: 01-calc-engine-audit-parser
    provides: calculate, LEVELS, Level, CalcResult (live calc panel); parseLatest, serialize, AuditPayload (pre-fill probe + stub-Apply payload)
  - phase: 02-manifest-shell-sdk-integration
    provides: SDK lifecycle pattern in src/entries/modal.tsx (init→ready→render→notifyLoadSucceeded); Surface+Page+Header chrome; Page IPageProps narrowing helper; ConfigError fallback; CalcSpModalConfig type
  - phase: 03-modal-ui-read-path/03-01
    provides: getFormService, getCurrentSpValue, getWorkItemTitle, getWorkItemTypeName, getProjectId, fetchCommentsForRead from src/ado; ResolvedField, WorkItemContext, CalcSpReadResult types
  - phase: 03-modal-ui-read-path/03-02
    provides: resolve from src/field; cache + D-20 fallback to StoryPoints
provides:
  - Full calculator modal UI (Surface > Page > Header > context line > banner stack > 3 dropdowns > calc panel > body ButtonGroup > Esc hint)
  - Wired-but-stubbed Apply (D-27): calculate + serialize + console.log
  - Read path orchestration: FieldResolver probe + getFields signal + parallel reads + parseLatest pre-fill + mismatch detection
  - No-field branch: NoFieldMessage replaces calculator UI when both StoryPoints and Size absent
  - Apply disabled until trio complete (UI-05); pre-fill enables Apply automatically
affects: [04-write-path]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies
  patterns:
    - "FormItem stale-types narrowing (mirrors Phase 2 Page narrowing) — adds children to FormItem props"
    - "ListSelection sync via useEffect — controlled-style API over imperative IListSelection"
    - "Spread-conditional optional props to satisfy exactOptionalPropertyTypes (`...(v !== undefined ? { v } : {})`)"
    - "Cancellation guard pattern in async useEffect — let cancelled = false; cleanup flips it"
    - "Pre-call getFields probe inside CalcModal to surface D-20 banner signal (FieldResolver swallows internally)"
    - "Banner stack rendering order: resolver-fail → read-error → pre-fill (UI-SPEC §FieldResolver-fail)"

key-files:
  created:
    - src/ui/PreFillBanner.tsx
    - src/ui/ReadErrorBanner.tsx
    - src/ui/FieldResolverFailBanner.tsx
    - src/ui/NoFieldMessage.tsx
    - src/ui/Dropdown3.tsx
    - src/ui/CalcPanel.tsx
    - src/ui/CalcModal.tsx
    - src/apply/stubApply.ts
  modified:
    - src/entries/modal.tsx

key-decisions:
  - "Apply + Cancel rendered in body ButtonGroup (Override 1 — IDialogOptions has no footer-button API)"
  - "Cancel handler logs but does not close — host X / Esc / lightDismiss is the actual close affordance"
  - "Pre-call formService.getFields() once in CalcModal to surface fieldsRejected flag for FieldResolverFailBanner; FieldResolver's cache makes the second call O(1)"
  - "Pre-fill banner date sourced from most recent non-deleted comment's createdDate (lexicographic ISO sort)"
  - "Mismatch detection only fires when both currentSp and sentinel.sp are non-null AND differ"
  - "isValidLevel sentinel guard at consumer (D-15) — second-line defense beyond AUDIT-04 parser"
  - "Spinner placement below context line during loading (deviation from UI-SPEC: Header has no slot for inline spinner)"

patterns-established:
  - "FormItem narrowing helper at top of Dropdown3.tsx — same shape as Phase 2 Page narrowing"
  - "Spread-conditional optional props for exactOptionalPropertyTypes compliance"
  - "Banner conditional render: stacked top-to-bottom (resolver-fail → read-error → pre-fill); pre-fill is dismissable, others persist"

requirements-completed: [UI-03, UI-04, UI-05, UI-07, UI-08, APPLY-01, APPLY-02, APPLY-03]

# Metrics
duration: ~25min
completed: 2026-05-02
---

# Phase 3 Plan 03: Modal UI & Stub Apply Summary

**Built the full calculator modal UI (3 typed dropdowns, live calc panel with hero treatment, body ButtonGroup with Override 1 acknowledged) wired to Wave 1's bridge layer + FieldResolver, plus a stub Apply that logs the would-write payload without mutating the work item — satisfying UI-03/04/05/07/08 and APPLY-01/02/03.**

## Performance

- **Duration:** ~25 min (Wave 2, single executor)
- **Started:** 2026-05-02T15:23Z
- **Completed:** 2026-05-02T15:31Z
- **Tasks:** 3 / 3
- **Files:** 9 (8 created, 1 modified)
- **Test count:** 333 passed (no new tests; manual QA per company standard for UI)
- **Bundle delta:** Phase 2 modal.js ~110 KB minified → Phase 3 modal.js 685.3 KB minified, **154.4 KB gzipped** (well under the Phase 5 hard cap of 250 KB gzipped)

## Accomplishments

- **Six presentational components** under `src/ui/` — all locked UI-SPEC copy strings rendered verbatim with correct Unicode codepoints (em-dash U+2014, middle-dot U+00B7, times U+00D7, minus U+2212, ellipsis U+2026); no hex color literals; no deep `azure-devops-ui/Components/...` imports.
- **`stubApply` module** at `src/apply/stubApply.ts` — pure function that calls `calculate()` + `serialize()` and logs `[sp-calc/apply] would write SP={N}, fieldRefName={refName}, comment={sentinel}`. Phase 4 swap target: replace the body with the real comment-first → field-write path; the input shape (`ApplyInput { c, u, e, fieldRefName }`) stays stable so the swap is a one-file diff.
- **`CalcModal` orchestrator** at `src/ui/CalcModal.tsx` — top-level component owning the read-path effect, trio state, banner stack, no-field branch, Apply guard. Renders `<Surface><Page><Header><div>{context line + spinner + banner stack + 3 dropdowns + CalcPanel + ButtonGroup + Esc hint}</div></Page></Surface>`. Cancellation-guarded async effect prevents post-unmount setState warnings.
- **`src/entries/modal.tsx` rewrite** — replaced `<Hello workItemId={...} />` with `<CalcModal workItemId={config.workItemId} />`; deleted `interface HelloProps` and the `Hello` component. Phase 2 lifecycle (`init({loaded:false}) → ready → getConfiguration → render → notifyLoadSucceeded`) preserved verbatim. `ConfigError` fallback preserved.
- **Read path wiring** (D-24 sequence): get form service → get project id (sync) → get work item type name → pre-call `getFields()` for fieldsRejected flag → `resolveField()` (cache hit on second call) → if null, render NoFieldMessage; otherwise parallel `Promise.all` of `getWorkItemTitle`, `getCurrentSpValue`, `fetchCommentsForRead` (with `.catch` to set commentsRejected) → `parseLatest()` + isValidLevel guard → seed `setReadResult` and pre-fill the trio.
- **Override acknowledgements:**
  - **Override 1:** Apply + Cancel render in body `<ButtonGroup>`, right-aligned, primary on the right. Permanent hint `Press Esc or click outside to close.` below the button row at 11px / opacity 0.5.
  - **Override 2:** UI consumes `AdoComment[]` from `fetchCommentsForRead` directly — never sees `ModernCommentsClient` or the legacy typed `getComments`.
  - **Override 3:** When `resolveField()` returns null, the entire calculator UI is replaced by `<NoFieldMessage typeName={...} />` — toolbar button stays enabled (lazy probe per D-16); no toolbar disabled state.

## Task Commits

Each task committed atomically with `--no-verify` (parallel worktree mode):

1. **Task 1: presentational UI components (6 files)** — `0ed95c3` (feat)
2. **Task 2: stubApply + CalcModal orchestrator (2 files)** — `a4c9537` (feat)
3. **Task 3: modal entry rewrite mounting CalcModal** — `7fd82aa` (feat)

## Public API surface

- `src/ui/CalcModal.tsx` exports `CalcModal: React.FC<{ workItemId: number }>`. Phase 4 will not change this prop contract.
- `src/apply/stubApply.ts` exports `stubApply(input: ApplyInput): void` and the `ApplyInput` / `AppliableFieldRef` types. Phase 4 will replace the body but keep the signature.
- The five other UI components (`PreFillBanner`, `ReadErrorBanner`, `FieldResolverFailBanner`, `NoFieldMessage`, `Dropdown3`, `CalcPanel`) are not re-exported from a barrel — they are internal to `src/ui/` and consumed only by `CalcModal`.

## Files Created/Modified

| File | Status | Purpose |
|------|--------|---------|
| `src/ui/PreFillBanner.tsx` | created | Info MessageCard with provenance + optional mismatch addendum |
| `src/ui/ReadErrorBanner.tsx` | created | Warning MessageCard for getCommentsModern failure (D-25); not dismissable |
| `src/ui/FieldResolverFailBanner.tsx` | created | Warning MessageCard for getFields failure (D-20) |
| `src/ui/NoFieldMessage.tsx` | created | Info MessageCard + Close button + permanent Esc hint when both fields absent |
| `src/ui/Dropdown3.tsx` | created | Typed Level dropdown wrapper using FormItem + azure-devops-ui Dropdown |
| `src/ui/CalcPanel.tsx` | created | Read-only Calculation Details panel with hero (28px semibold) + sub-row (W, Raw SP) + always-visible formulas |
| `src/ui/CalcModal.tsx` | created | Top-level orchestrator: read-path effect, trio state, no-field branch, banner stack, ButtonGroup |
| `src/apply/stubApply.ts` | created | D-27 stub: calculate + serialize + console.log; no setFieldValue, no addComment, no dialog close |
| `src/entries/modal.tsx` | modified | Replaced `<Hello>` with `<CalcModal workItemId={config.workItemId} />`; deleted `HelloProps` interface and `Hello` component; SDK lifecycle preserved verbatim |

## Decisions Made

- **Pre-call `formService.getFields()` inside `CalcModal` (not just inside `FieldResolver`):** FieldResolver swallows getFields rejections internally (D-20) and never exposes the failure flag. To render the `<FieldResolverFailBanner />` per UI-SPEC, CalcModal pre-calls `getFields()` once in a try/catch; FieldResolver's cache means the second call costs O(1) regardless. Plan 2's SUMMARY noted this as a follow-up; this plan implemented it without a FieldResolver API change.
- **Pre-fill date sourced from comment list, not sentinel:** `AuditPayload` doesn't carry a date. We sort the non-deleted comments lexicographically by `createdDate` (ISO 8601 sorts identically to chronological order), pick the latest, and pass it to `<PreFillBanner dateIso={...} />`. Fallback: `new Date().toISOString()` if the list is empty (defensive — should never trigger because pre-fill only renders when `parseLatest` found a sentinel in the same comment list).
- **`FormItem` narrowing helper at top of `Dropdown3.tsx`:** `azure-devops-ui` 2.272's `IFormItemProps` does not declare `children`, but `FormItem` is a `React.Component` that renders them. Same stale-types pattern Phase 2 used for `Page`. Type-only narrowing — no runtime change.
- **Spread-conditional `disabled` prop:** `Dropdown` from `azure-devops-ui` declares `disabled: boolean` (not `boolean | undefined`); under our `exactOptionalPropertyTypes: true` tsconfig, passing `disabled={undefined}` would error. Pattern: `...(disabled !== undefined ? { disabled } : {})`. This will recur for any `azure-devops-ui` prop that isn't `?:`-typed.
- **isValidLevel sentinel guard at consumer (D-15):** Even though Plan 1's `parseLatest` is "never throws" (AUDIT-04), it can return a payload whose `c/u/e` are unknown strings (e.g., a future schemaVersion=1 payload from a hand-edited comment). CalcModal validates each Level before pre-filling and `console.warn`s on the malformed case. The malformed payload counts as "no pre-fill" — modal opens empty.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] FormItem stale-types narrowing**

- **Found during:** Task 1 typecheck on `Dropdown3.tsx`
- **Issue:** `<FormItem label={label}><Dropdown ... /></FormItem>` produced TS2322 — `IFormItemProps` does not declare `children`, even though `FormItem` is a `React.Component<IFormItemProps>` that renders them. Same stale-types problem Phase 2 hit on `Page`.
- **Fix:** Added a type-only narrowing helper at the top of `Dropdown3.tsx`: `const FormItem = FormItemRaw as unknown as React.FC<React.ComponentProps<typeof FormItemRaw> & { children?: React.ReactNode }>;` — mirrors Phase 2's `Page` helper in `src/entries/modal.tsx:28-30`. No runtime change.
- **Files modified:** `src/ui/Dropdown3.tsx`
- **Verification:** `npm run typecheck` exits 0; manual review confirms no behavioral coupling.
- **Committed in:** `0ed95c3` (Task 1)

**2. [Rule 3 - Blocking] Spread-conditional `disabled` prop on `Dropdown`**

- **Found during:** Task 1 typecheck on `Dropdown3.tsx`
- **Issue:** `<Dropdown ... disabled={disabled} ... />` with `disabled?: boolean` parent prop produced TS2375 under `exactOptionalPropertyTypes: true` — the target prop is declared `disabled: boolean` (no `undefined`), so passing `boolean | undefined` is rejected.
- **Fix:** Build a `dropdownProps` object that only includes `disabled` when defined: `...(disabled !== undefined ? { disabled } : {})`. Spreads cleanly into `<Dropdown {...dropdownProps} />`.
- **Files modified:** `src/ui/Dropdown3.tsx`
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `0ed95c3` (Task 1)

**3. [Rule 1 - Verification consistency] Removed grep-tripping comment phrases**

- **Found during:** Task 2 acceptance verification
- **Issue:** The verbatim file body the plan instructed me to write in `src/apply/stubApply.ts` contained explanatory comments mentioning `setFieldValue` and `addComment` as words. The plan's `<acceptance_criteria>` block requires `grep -c 'setFieldValue' src/apply/stubApply.ts == 0` and `grep -c 'addComment' src/apply/stubApply.ts == 0`. The verbatim body and the literal grep contradicted each other. Same pattern as Plan 1's documented "literal-grep vs verbatim body" issue.
- **Fix:** Rewrote the comment phrases in `stubApply.ts` to describe the Phase 4 swap without using the literal words: "Phase 4 will replace the body with the real write path" and "Phase 3 stub: no field write, no comment POST, no REST calls, no dialog close." Added an explicit literal log-line comment for the `[sp-calc/apply] would write SP=` grep target. Code behavior unchanged.
- **Files modified:** `src/apply/stubApply.ts`
- **Verification:** `grep -c setFieldValue src/apply/stubApply.ts` → 0; `grep -c addComment src/apply/stubApply.ts` → 0; `grep -c '\[sp-calc/apply\] would write SP=' src/apply/stubApply.ts` → 1; typecheck still passes.
- **Committed in:** `a4c9537` (Task 2)

**4. [Rule 1 - Verification consistency] Removed stale "Hello from Work Item" comment**

- **Found during:** Task 3 acceptance verification
- **Issue:** Phase 2's `modal.tsx` file body contained a comment referencing the placeholder text `"Hello from Work Item #0"` to document why the `ConfigError` branch existed. The plan's verification grep `grep -c "Hello from Work Item" src/entries/modal.tsx == 0` would fail because the comment was left in place by the plan-given file body.
- **Fix:** Rewrote the explanatory comment to describe the same intent without naming the now-deleted Hello placeholder: "Fail loud, not silent: rendering a placeholder for missing config masks plumbing bugs in the toolbar→modal handoff."
- **Files modified:** `src/entries/modal.tsx`
- **Verification:** `grep -c "Hello from Work Item" src/entries/modal.tsx` → 0.
- **Committed in:** `7fd82aa` (Task 3)

### Documentation Note: literal-grep counts vs verbatim file-body content

Several acceptance criteria specify literal `grep -c` counts that conflict with the plan-prescribed verbatim file body (header comments, lifecycle docstrings, etc.). Examples:

| Criterion (literal) | Actual count | Reason |
|---------------------|--------------|--------|
| `grep -c "await SDK.ready()" src/entries/modal.tsx == 1` | 2 | Header comment line 5 mentions `await SDK.ready()` in the lifecycle prose; the actual call is on line 64. The plan's `<critical_preservation_rules>` section says "preserve the lifecycle comments verbatim." Both copies are required by the plan; the criterion is a drafting artifact. |
| `grep -c "SDK.notifyLoadSucceeded()" src/entries/modal.tsx == 1` | 2 | Header comment line 6 mentions `SDK.notifyLoadSucceeded()` in the lifecycle prose; the actual call is on line 93. Same root cause. |
| `grep -c "parseLatest" src/ui/CalcModal.tsx == 1` | 3 | Counts the import statement, an inline comment ("parseLatest never throws"), and the call site. The intent — one call site — is satisfied at line 143. |

**Mitigation:** None changed. The verbatim file bodies are the canonical instruction; the strict literal grep counts are drafting artifacts (Plan 1's SUMMARY documented the same class of mismatch). The functional intent — single SDK call site for each lifecycle method, single `parseLatest` invocation — is verified and met.

## Issues Encountered

- **Worktree checkout was on commit `7a0f95e1`, not the required Wave-1 base `49c7a9da`.** `<worktree_branch_check>` protocol invoked: `git reset --hard 49c7a9da9a02018168b46b2dd808a34fedcac1f8` aligned the worktree to the correct base. No data loss (fresh worktree).
- **Worktree had no `node_modules`.** Ran `npm ci` (~5s, 544 packages). No code-level impact.
- **Line-ending warnings** (`LF will be replaced by CRLF`) — Windows worktree convention; no impact on file contents.
- **Bundle size** — modal.js minified is 685.3 KB; gzipped is 154.4 KB. Phase 5's hard cap is 250 KB gzipped, so we're 38% under. Most of the bytes are `azure-devops-ui` chrome (Surface, Page, Header, Dropdown, MessageCard, Spinner, Button, ButtonGroup, FormItem) plus Fluent icon fonts that webpack inlines. No optimization needed in Phase 3.

## User Setup Required

None — no external service configuration. Manual cezari verification (Plan 04) covers the live UX checklist.

## Next Phase Readiness

- **Plan 04 (manual cezari verification)** can run against this build immediately:
  - `npm run build` produces a working `dist/modal.js` + `dist/toolbar.js` + manifest.
  - `npm run dev:publish` (Phase 2's wrapper) can publish a fresh build to `cezari` and the user can run the 12-step manual checklist (D-29) against User Story / Bug / Task / Feature / Epic.
- **Phase 4 (write path)** has a clean swap point: replace `stubApply()`'s body with the real comment-first → field-write path. The `ApplyInput` shape and `CalcModal` invocation site stay unchanged — Phase 4 is a one-file diff to `src/apply/stubApply.ts` (or rename to `apply.ts` and update the import in `CalcModal.tsx`). The `fieldRefName` is already pre-resolved by `FieldResolver` and propagated through `readResult.resolvedField`. The `comment` payload is already serialized by `serialize()`; Phase 4 just needs to call `addComment(...)` with that string and `setFieldValue(refName, sp) + .save()` afterward.
- **Threat surface scan:** No new network endpoints, auth paths, file-system access, or schema changes introduced. The only data flow added is `CalcModal` → `getFields()` (pre-call probe), `resolveField()` (cached probe), `getCurrentSpValue()` / `getWorkItemTitle()` / `fetchCommentsForRead()` (parallel reads). All endpoints were already declared in Wave 1's threat model.

## Self-Check: PASSED

Verified each created/modified file exists at the documented path:
- FOUND: `src/ui/PreFillBanner.tsx`
- FOUND: `src/ui/ReadErrorBanner.tsx`
- FOUND: `src/ui/FieldResolverFailBanner.tsx`
- FOUND: `src/ui/NoFieldMessage.tsx`
- FOUND: `src/ui/Dropdown3.tsx`
- FOUND: `src/ui/CalcPanel.tsx`
- FOUND: `src/ui/CalcModal.tsx`
- FOUND: `src/apply/stubApply.ts`
- FOUND: `src/entries/modal.tsx` (modified)

Verified each commit exists in `git log --oneline`:
- FOUND: `0ed95c3` (Task 1: presentational UI components)
- FOUND: `a4c9537` (Task 2: stubApply + CalcModal orchestrator)
- FOUND: `7fd82aa` (Task 3: modal entry rewrite)

Verified plan-level success criteria:
- `npm run typecheck` exits 0 — PASS
- `npm run build` exits 0; `dist/modal.js` (685.3 KB minified, 154.4 KB gzipped) and `dist/toolbar.js` produced — PASS
- `npm test` exits 0; 333 tests passing — PASS
- `setFieldValue` / `.save()` / `addComment` appear NOWHERE in `src/ui/`, `src/apply/`, `src/entries/` — PASS (verified via `grep -rE`)
- All 23 UI-SPEC locked copy strings present with correct Unicode codepoints — PASS (verified per-file)
- Apply button is the only `primary={true}` element in `src/ui/` — PASS (1 match in `CalcModal.tsx`)
- Zero deep `azure-devops-ui/Components/...` imports in `src/ui/` — PASS
- Phase 2 SDK lifecycle preserved verbatim in `src/entries/modal.tsx` (init→ready→getConfig→render→notifyLoadSucceeded; bottom catch calls notifyLoadFailed; ConfigError preserved; override.css imported) — PASS
- `<CalcModal workItemId={config.workItemId} />` mounts in modal entry; `<Hello>` deleted — PASS

---
*Phase: 03-modal-ui-read-path*
*Plan: 03*
*Completed: 2026-05-02*
