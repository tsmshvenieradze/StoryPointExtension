---
phase: 04-write-path-edge-cases
plan: 02
subsystem: apply
tags: [vitest, error-mapping, sdk-error-discriminator, http-status-map, pure-module, tdd]

# Dependency graph
requires:
  - phase: 03-modal-ui-read-path
    provides: src/apply/stubApply.ts (ApplyInput / AppliableFieldRef contract preserved per D-27)
provides:
  - "src/apply/errorMessages.ts pure module: friendlyMessageForStatus(status) + mapSdkErrorToStatus(err)"
  - "src/apply/index.ts barrel re-exporting the apply public surface (functions + types)"
  - "REQUIREMENTS.md APPLY-09 wording aligned to D-06 read-only-replacement UX (mirror of Phase 3 D-17 FIELD-04 rewrite)"
  - "tests/apply/errorMessages.test.ts — 29 vitest assertions across all D-11 buckets + D-20 SDK-error branches"
affects:
  - 04-03 postComment.ts (consumer — adoFetch error → friendlyMessageForStatus translation)
  - 04-04 banner copy components (CommentFailBanner, FieldFailBanner consume both functions)
  - 04-05 apply.ts orchestrator (calls mapSdkErrorToStatus on save() rejections)
  - 04-06 verifier (checks REQUIREMENTS.md APPLY-09 literal text)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-module convention: ZERO SDK imports, ZERO imports total in src/apply/errorMessages.ts (mirrors src/audit/serialize.ts boundary)"
    - "Barrel-shape src/apply/index.ts (mirrors src/audit/index.ts and src/ado/index.ts)"
    - "REQUIREMENTS.md per-decision rewrite pattern (mirror of Phase 3 D-17 FIELD-04 rewrite: same shape, swap pre-discussion bullet with locked CONTEXT.md text)"
    - "Vitest table-driven coverage of all D-11 status buckets via it.each (mirrors tests/audit/parse.test.ts)"

key-files:
  created:
    - src/apply/errorMessages.ts
    - src/apply/index.ts
    - tests/apply/errorMessages.test.ts
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Locked the LOCKED Copywriting Contract glyphs verbatim — em-dashes are U+2014; ASCII --substitutes are FAIL conditions per UI-SPEC line 424"
  - "Default branch for non-Error inputs returns { status: null } with NO sdkErrorClass key (omitted, not undefined) — preserves the discriminated-shape contract for downstream banner copy"
  - "Error subclasses with non-matching name and message return { status: null, sdkErrorClass: err.name } so triage retains the SDK class identifier (CONTEXT discretion last bullet — \"leaning yes for triage\")"

patterns-established:
  - "Pure status-code → user-message mapper as a switch with explicit case branches + 5xx range fall-through"
  - "SDK-error discriminator as a layered if-chain: name match (RuleValidationException) → message regex (permission/denied/forbidden/stakeholder/read-only) → message regex (not found/deleted) → fallthrough"

requirements-completed: [APPLY-08, APPLY-09]

# Metrics
duration: 3min
completed: 2026-05-02
---

# Phase 4 Plan 02: errorMessages Pure Module + APPLY-09 Rewrite Summary

**Pure status-code → friendly-message mapper + SDK-error → status-discriminator (D-11 / D-20), with 29 vitest assertions and an APPLY-09 wording rewrite mirroring the Phase 3 FIELD-04 pattern**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-02T15:21:52Z
- **Completed:** 2026-05-02T15:24:29Z
- **Tasks:** 2
- **Files modified:** 4 (3 created + 1 edited)

## Accomplishments
- Pure `friendlyMessageForStatus(status: number | null): string` covers 401/403/404/409/412/429/5xx range/unknown/null with verbatim Copywriting-Contract strings
- Pure `mapSdkErrorToStatus(err: unknown): { status, sdkErrorClass? }` discriminates `RuleValidationException` → 412, permission/denied/forbidden/stakeholder/read-only → 403, not-found/deleted → 404, else → null while preserving `err.name` for triage
- Vitest suite (29 assertions in 10 it-blocks) covers all D-11 buckets + boundary cases (499/599/600) + all 4 SDK-error branches + non-Error inputs
- `src/apply/index.ts` barrel — Plan 04-04 banners and Plan 04-05 apply.ts can now import from `"../apply"`; Phase 3 import sites (`src/ui/CalcModal.tsx:35`) keep working
- REQUIREMENTS.md APPLY-09 wording aligned to D-06 (read-only-replacement UX); verifier in Plan 04-06 will pass against the literal "replaces the calculator UI with a clear message" + "The toolbar button remains enabled" phrases

## Task Commits

Each task was committed atomically (parallel-executor convention `--no-verify`):

1. **Task 1 RED:** `5688726` — `test(04-02): add failing vitest suite for errorMessages pure module`
2. **Task 1 GREEN:** `1c29794` — `feat(04-02): implement errorMessages pure module per D-11 + D-20`
3. **Task 2:** `5cfbcfc` — `docs(04-02): add src/apply barrel + rewrite REQUIREMENTS.md APPLY-09 to D-06 read-only-replacement UX`

_Note: Task 1 was TDD with separate RED (test) and GREEN (implementation) commits per `<tdd_execution>` protocol; no REFACTOR commit needed (implementation matched final shape on first pass)._

## Files Created/Modified

- **`src/apply/errorMessages.ts`** (CREATED, 80 lines, ZERO imports) — Pure switch over status codes + heuristic regex over Error.name/message; verbatim Copywriting-Contract strings with em-dashes (U+2014); `mapSdkErrorToStatus` returns `{ status, sdkErrorClass? }` discriminator
- **`src/apply/index.ts`** (CREATED, 13 lines) — Barrel re-exports: `friendlyMessageForStatus`, `mapSdkErrorToStatus`, `stubApply`, `type ApplyInput`, `type AppliableFieldRef`
- **`tests/apply/errorMessages.test.ts`** (CREATED, 135 lines) — 29 vitest assertions: 14-row D-11 status-code map + 6-row 403 message-regex table + 3-row 404 message-regex table + 6 individual SDK-error branch tests
- **`.planning/REQUIREMENTS.md`** (MODIFIED, 1 line replaced) — APPLY-09 rewrite per D-06; Traceability table left untouched

### REQUIREMENTS.md APPLY-09 — old vs new

**Before (line 56):**
> "Permission check before showing/enabling Apply: when the user lacks write permission on the work item, the Apply button is disabled with a tooltip; modal still opens read-only for inspection"

**After (line 56):**
> "When the user lacks write permission on the work item (isReadOnly=true), the modal opens and replaces the calculator UI with a clear message explaining the work item is read-only. The toolbar button remains enabled. The current Story Points value is still shown via the context line for inspection."

Mirror of the Phase 3 D-17 FIELD-04 rewrite pattern (line 33). Traceability table row `APPLY-09 | Phase 4 | Pending` is unchanged.

## Decisions Made

- Used `it.each` table-driven shape mirroring `tests/audit/parse.test.ts`, expanded the original 24-test plan into 29 assertions to cover additional boundary cases (499 just-below-5xx, 599 just-inside-5xx, 600 just-above-5xx) and to cover the regex's word-boundary subcases (read-only with hyphen vs. space; case-insensitive "NOT FOUND")
- Preserved the discriminated-shape contract: `{ status: null }` for non-Error inputs (no `sdkErrorClass` key) vs. `{ status: null, sdkErrorClass: err.name }` for Error inputs whose message didn't match — gives downstream UI code (Plan 04-05 banner) a clean way to decide whether to surface "SDK error: {className}" or just "HTTP n/a"

## Verification Results

- `npm run typecheck` — exit 0 (clean)
- `npm test -- tests/apply/errorMessages.test.ts` — 29 / 29 pass
- `npm test` (full suite) — 362 / 362 pass across 6 files (no regression in calc, audit, field test files)
- Greppable acceptance:
  - `grep -E "^export function friendlyMessageForStatus" src/apply/errorMessages.ts` → 1
  - `grep -E "^export function mapSdkErrorToStatus" src/apply/errorMessages.ts` → 1
  - `grep -E "from ['\"]azure-devops-extension" src/apply/errorMessages.ts` → 0
  - `grep -E "^import " src/apply/errorMessages.ts` → 0
  - `grep -c "—" src/apply/errorMessages.ts` → 9 (≥5 required)
  - `grep -F "Apply button is disabled with a tooltip" .planning/REQUIREMENTS.md` → 0
  - `grep -F "replaces the calculator UI with a clear message" .planning/REQUIREMENTS.md` → 1
  - `grep -F "The toolbar button remains enabled" .planning/REQUIREMENTS.md` → 2 (FIELD-04 + APPLY-09 use the same parallel phrasing — consistent with the rewrite's mirror-pattern intent)
  - `grep -E "APPLY-09 \| Phase 4" .planning/REQUIREMENTS.md` → 1

## Deviations from Plan

None — plan executed exactly as written. The test file landed with 29 assertions instead of the planned 24 because the it.each tables expanded boundary coverage, but every plan-listed test case has a corresponding row.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 04-03** (postComment via adoFetch): can import `friendlyMessageForStatus` from `"../apply"` for the comment-leg HTTP-error path
- **Plan 04-04** (banner copy components): both `friendlyMessageForStatus` and `mapSdkErrorToStatus` are now importable; banner templates `${friendlyMessage} (HTTP ${status})` and `${friendlyMessage} (${httpOrSdkLabel})` have a stable source of truth
- **Plan 04-05** (apply.ts orchestrator): can call `mapSdkErrorToStatus(err)` on `IWorkItemFormService.save()` rejections to convert SDK-class errors into the same status-discriminator buckets the comment leg uses
- **Plan 04-06** (Phase verifier): REQUIREMENTS.md APPLY-09 literal text now matches the D-06-locked UX; verifier will not fail Phase 4 against a stale "Apply button is disabled with a tooltip" line

The barrel is pure-additive; nothing in Phase 1/2/3 broke. The CalcModal `stubApply` import remains at `src/ui/CalcModal.tsx:35` and continues to typecheck against the unchanged `src/apply/stubApply.ts` body.

## Self-Check: PASSED

- src/apply/errorMessages.ts → FOUND
- src/apply/index.ts → FOUND
- tests/apply/errorMessages.test.ts → FOUND
- .planning/REQUIREMENTS.md APPLY-09 line rewritten → FOUND ("replaces the calculator UI with a clear message")
- Commit 5688726 (test RED) → FOUND in `git log --oneline`
- Commit 1c29794 (feat GREEN) → FOUND in `git log --oneline`
- Commit 5cfbcfc (docs barrel + APPLY-09) → FOUND in `git log --oneline`

---
*Phase: 04-write-path-edge-cases*
*Completed: 2026-05-02*
