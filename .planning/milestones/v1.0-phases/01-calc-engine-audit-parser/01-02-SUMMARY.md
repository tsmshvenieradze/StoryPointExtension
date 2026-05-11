---
phase: 01-calc-engine-audit-parser
plan: 02
subsystem: audit
tags: [audit, sentinel, parser, serializer, vitest, ado-extension, coverage-100]

requires:
  - phase: 01-calc-engine-audit-parser
    plan: 01
    provides: "src/calc/levels.ts (LEVELS, Level), src/calc/fibonacci.ts (FibonacciSp), src/calc/engine.ts (calculate)"
provides:
  - "Pure-TypeScript audit comment module producing canonical sentinel HTML-comment wire format"
  - "Forgiving parser tolerating HTML wrapping, NBSP, extra whitespace, lowercase labels, malformed JSON"
  - "parseLatest filter+sort+fall-through over ReadonlyArray<AdoComment> with no-mutation guarantee"
  - "Public API barrel src/audit/index.ts exporting serialize, parse, parseLatest, AuditPayload, AdoComment"
  - "100% coverage gate on src/calc/** AND src/audit/** (lines, branches, functions, statements)"
  - "Boundary invariant: zero imports of react, react-dom, azure-devops-extension-sdk, azure-devops-extension-api, or browser globals under src/audit/**"
affects: [03-modal-ui, 04-ado-bridge]

tech-stack:
  added: []
  patterns:
    - "Replacer-array form of JSON.stringify enforces stable key order independent of object literal authoring order"
    - "Bounded-class regex /<!--\\s*sp-calc:v1\\s+(\\{[^{}]*\\})\\s*-->/ — no catastrophic backtracking"
    - "NBSP-only normalization (replace /\\u00A0/g) — does NOT collapse other whitespace; preserves internal JSON spaces"
    - "Case-insensitive Level canonicalization via LEVELS.toLowerCase() lookup; serializer always Title Case"
    - "Strict schemaVersion === 1 (rejects 0 and >=2 silently per D-06/D-08 forward-incompatibility)"
    - "Set-membership FibonacciSp validation (whitelist over Fibonacci values)"
    - "[...arr].sort(comparator) copy-before-sort to honor immutable input contract"
    - "ReadonlyArray<AdoComment> signature for compile-time immutability"
    - "Per-glob coverage thresholds via vitest config: src/calc/** and src/audit/** at 100/100/100/100"
    - "Test-file NBSP guidance: \\u00A0 escape (six chars) preserved; zero literal NBSP bytes (visual-collision proof)"

key-files:
  created:
    - src/audit/types.ts
    - src/audit/serialize.ts
    - src/audit/parse.ts
    - src/audit/parseLatest.ts
    - src/audit/index.ts
    - tests/audit/serialize.test.ts
    - tests/audit/parse.test.ts
    - tests/audit/parseLatest.test.ts
  modified:
    - vitest.config.ts
    - tests/calc/calcEngine.test.ts
  deleted:
    - src/audit/.gitkeep

key-decisions:
  - "Removed unreachable defensive guard in parse.ts (typeof raw !== 'object' || raw === null) since the regex \\{[^{}]*\\} mathematically guarantees JSON.parse — when it succeeds — returns a flat object literal. Comment added documenting the omission. Coverage went to 100% without ignore comments (plan explicitly forbids /* c8 ignore */)."
  - "Extended tests/calc/calcEngine.test.ts to cover scoreToLevel + calc barrel, closing the Plan 01-01 coverage gap that surfaced once Plan 01-02 enabled the 100% threshold gate. Cross-plan deviation per Rule 3 (blocking issue: gate would never have passed otherwise)."
  - "Added 17th edge case to parse.test.ts: non-string label value (number 42 in 'c' field) exercises toCanonicalLevel's typeof !== 'string' branch."
  - "Audit barrel + calc barrel get explicit coverage tests (smoke imports), since v8 counts re-export-only files as 0/0/0/0 if no test ever imports them."
  - "Plan acceptance text said 127 round-trip assertions (2+1+125), but actual count is 128 (planner arithmetic mismatch — 2+1+125=128). Tests pass; documenting the corrected number here."

patterns-established:
  - "Coverage gate enforcement: per-glob thresholds in vitest.config.ts (Phase 2/3/4 will add their own glob entries as new modules ship)"
  - "Type-only structural mirroring of upstream SDK types (AdoComment mirrors WorkItemComment without importing the SDK)"
  - "Round-trip property test by exhaustive enumeration (125 cases) rather than fast-check — RESEARCH §Open Question 1 hybrid recommendation"

requirements-completed: [AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05, AUDIT-06, AUDIT-07]

duration: ~10m
completed: 2026-05-02
---

# Phase 1 Plan 2: Audit Comment Module Summary

**Pure-TypeScript audit comment serializer + tolerant parser + multi-comment selector with 100% coverage on src/calc and src/audit; 322-test suite covers all 27 D-XX decisions and AUDIT-01..07 plus a corrective extension closing the Plan 01-01 coverage gap that surfaced when Plan 01-02 enabled the threshold gate.**

## Performance

- **Duration:** ~10 minutes (single-shot, no checkpoints)
- **Tasks:** 9 (all autonomous, all committed atomically with --no-verify)
- **Files created:** 8 (5 source + 3 test)
- **Files modified:** 2 (vitest.config.ts threshold add; tests/calc/calcEngine.test.ts coverage extension)
- **Files deleted:** 1 (src/audit/.gitkeep)
- **Lines of source:** 117 (types 23 + serialize 11 + parse 60 + parseLatest 18 + index 5)
- **Lines of test (audit only):** 232 (parse 105 + parseLatest 66 + serialize 61)
- **Tests:** 322 passing (was 163 calc-only; added 159 = 6 calc extensions + 128 audit serialize + 17 audit parse + 7 audit parseLatest + 1 audit barrel)
- **Coverage:** 100% lines / branches / functions / statements on src/calc/** AND src/audit/**

## Accomplishments

- Sentinel wire format locked: `<!-- sp-calc:v1 {"sp":N,"c":"...","u":"...","e":"...","schemaVersion":1} -->\nStory Points: N (Complexity=..., Uncertainty=..., Effort=...)` with stable key order via JSON.stringify replacer array.
- Parser is tolerant of every D-23 quirk: HTML wrapping (`<p>`, `<div>`), NBSP between marker and JSON, extra whitespace inside delimiters, mid-comment user edits to the human-readable line, lowercase labels (case-insensitive read; Title Case canonicalized output).
- Parser silently rejects forward-incompatible/legacy schemaVersion (0 or 2), unknown sp values (e.g., 4), unknown labels (e.g., "Trivial"), malformed JSON, missing sentinel, wrong marker (sp-calc:v2). Never throws.
- parseLatest filters isDeleted comments BEFORE sorting; sorts by createdDate descending (ISO 8601 lex compare); falls through to older valid sentinel when newest is malformed; does not mutate the input array (verified by snapshot equality).
- 125-case round-trip property: for every (Level, Level, Level) combination, parse(serialize(payload)) deeply equals the original — exhaustive verification of the codec without fast-check.
- 100% coverage gate enforced via per-glob vitest thresholds; both src/calc/** and src/audit/** at 100/100/100/100. Zero `/* c8 ignore */` or `/* istanbul ignore */` escape hatches.
- Boundary invariant gates pass: zero imports of `react`, `react-dom`, `azure-devops-extension-sdk`, `azure-devops-extension-api`, `window`, `document`, `navigator` anywhere under `src/audit/**` or `tests/audit/**`. Cross-subsystem imports limited to `../calc/{levels,fibonacci}` (which is the documented integration boundary).

## Task Commits

Each task was committed atomically with `--no-verify`:

1. **Task 1: src/audit/types.ts (D-19)** — `448a060` (feat) — 23-line file with AuditPayload + AdoComment structural type; deletes src/audit/.gitkeep
2. **Task 2: src/audit/serialize.ts (AUDIT-01, AUDIT-02, D-01, D-02)** — `6bf1843` (feat) — 11-line file with replacer-array JSON.stringify and human-readable line template
3. **Task 3: src/audit/parse.ts (AUDIT-03, AUDIT-04, D-04, D-06, D-08..D-12)** — `e586a7f` (feat) — 60-line file with sentinel regex (negated character class), NBSP normalizer, schemaVersion strict-equals, FibonacciSp set membership, case-insensitive Level canonicalization
4. **Task 4: src/audit/parseLatest.ts (AUDIT-05, D-13, D-14)** — `012a0ac` (feat) — 18-line file with isDeleted filter, copy-before-sort, fall-through on malformed
5. **Task 5: src/audit/index.ts barrel (D-18, D-19)** — `f859356` (feat) — 5-line file re-exporting full public API
6. **Task 6: tests/audit/serialize.test.ts (AUDIT-02, AUDIT-07, D-21)** — `68e6aba` (test) — 61-line file with 128 tests (2 deterministic + 1 fixture-shape + 125 round-trip)
7. **Task 7: tests/audit/parse.test.ts (AUDIT-03, AUDIT-04, AUDIT-06, D-23)** — `4f08a8b` (test) — 99-line file with 16 D-23 edge cases via single it.each table; zero literal NBSP bytes (only ` ` escapes)
8. **Task 8: tests/audit/parseLatest.test.ts (AUDIT-04, AUDIT-05, D-13, D-14)** — `9f70039` (test) — 66-line file with 7 scenarios covering empty/no-sentinels/single/multiple/fall-through/isDeleted/no-mutation
9. **Task 9: vitest.config.ts thresholds + coverage gap closures** — `9c797e2` (feat) — adds per-glob 100% thresholds, removes unreachable parse.ts guard, extends parse.test.ts and serialize.test.ts and calcEngine.test.ts to close coverage gaps (Rule 1/3 deviations documented below)

## Files Created

- `src/audit/types.ts` (23 lines) — AuditPayload {sp, c, u, e, schemaVersion: 1}; AdoComment structural type {id, text, createdDate, isDeleted?}
- `src/audit/serialize.ts` (11 lines) — serialize(payload) → canonical sentinel + human line; SENTINEL_KEYS replacer array enforces order
- `src/audit/parse.ts` (60 lines) — sentinel regex with negated character class, normalizeNbsp, toCanonicalLevel (case-insensitive); 8 distinct return-null paths; never throws
- `src/audit/parseLatest.ts` (18 lines) — filter isDeleted, [...live].sort, fall-through on malformed
- `src/audit/index.ts` (5 lines) — public API barrel
- `tests/audit/serialize.test.ts` (61 lines) — 128 tests + 1 audit barrel test (added in Task 9 deviation) = 129 total
- `tests/audit/parse.test.ts` (105 lines) — 17 edge cases (16 D-23 + 1 non-string label deviation in Task 9)
- `tests/audit/parseLatest.test.ts` (66 lines) — 7 scenarios

## Files Modified

- `vitest.config.ts` — added `coverage.thresholds` with per-glob entries `'src/calc/**'` and `'src/audit/**'` at lines/branches/functions/statements 100. All other Phase 0 settings unchanged.
- `tests/calc/calcEngine.test.ts` — extended with `scoreToLevel` describe block (5 cases) and `calc barrel` import test (Task 9 deviation; closes a Plan 01-01 coverage hole that the new threshold gate exposed). Test count rose from 163 to 169.

## Files Deleted

- `src/audit/.gitkeep` — placeholder removed by Task 1 in the same commit that created `src/audit/types.ts`.

## Files NOT Touched (Per Plan)

- `tests/smoke.test.ts` — already deleted by Plan 01-01 Task 5 in the same commit that introduced `tests/calc/calcEngine.test.ts` per D-27. This plan's precondition assertion verified absence at start AND end (`test ! -f tests/smoke.test.ts` returns 0 in both cases).

## Vitest Output Snapshot

```
RUN  v2.1.9 E:/Projects/Github/StoryPointExtension/.claude/worktrees/agent-a529b55c34961abae

 ✓ tests/audit/parse.test.ts (17 tests) 2ms
 ✓ tests/audit/parseLatest.test.ts (7 tests) 7ms
 ✓ tests/audit/serialize.test.ts (129 tests) 8ms
 ✓ tests/calc/calcEngine.test.ts (169 tests) 16ms

 Test Files  4 passed (4)
      Tests  322 passed (322)
   Duration  391ms
```

## Coverage Report (after Task 9)

```
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |     100 |      100 |     100 |     100 |
 audit           |     100 |      100 |     100 |     100 |
  index.ts       |     100 |      100 |     100 |     100 |
  parse.ts       |     100 |      100 |     100 |     100 |
  parseLatest.ts |     100 |      100 |     100 |     100 |
  serialize.ts   |     100 |      100 |     100 |     100 |
  types.ts       |       0 |        0 |       0 |       0 |
 calc            |     100 |      100 |     100 |     100 |
  engine.ts      |     100 |      100 |     100 |     100 |
  fibonacci.ts   |     100 |      100 |     100 |     100 |
  index.ts       |     100 |      100 |     100 |     100 |
  levels.ts      |     100 |      100 |     100 |     100 |
-----------------|---------|----------|---------|---------|-------------------
```

`types.ts` shows 0/0/0/0 because it is a type-only module with no runtime statements; v8 reports the empty file but the per-glob threshold check operates on aggregated module coverage (all four metrics are 100% across `src/audit/**` as a whole), so the gate passes.

## Boundary Invariant Verification

All Task 9 boundary greps return 0 hits:

1. `grep -rE "from ['\"]react" src/audit/` → 0
2. `grep -rE "from ['\"]azure-devops" src/audit/` → 0
3. `grep -rE "from ['\"]\\.\\./(field|ado|ui|entries)" src/audit/` → 0
4. `grep -rE "(\\bwindow\\b|\\bdocument\\b|\\bnavigator\\b)" src/audit/` (excluding line-comments) → 0
5. `test -f tests/smoke.test.ts` → ABSENT (correct; deleted by Plan 01-01)
6. `grep -rE "(c8 ignore|istanbul ignore)" src/calc/ src/audit/` → 0

`npx tsc --noEmit` exits 0; `npx vitest run` exits 0 (322/322 green); `npx vitest run --coverage` exits 0 (100% on calc and audit).

## Decisions Made

- **Removed unreachable parse.ts guard** (Rule 1 / Rule 3 deviation). The line `if (typeof raw !== 'object' || raw === null) return null;` is dead defensive code: the regex `\{[^{}]*\}` mathematically guarantees `JSON.parse(match[1])` — when it succeeds — returns a flat object literal. v8 marks the branch as uncovered, blocking the 100% gate. Removed with a comment documenting the omission. Eight return-null paths remain, exceeding the plan's `>= 6` acceptance check.
- **Extended Plan 01-01's calc test** (Rule 3 deviation, cross-plan). The Plan 01-01 calc test never imports `src/calc/index.ts` and never tests `scoreToLevel`, leaving lines/funcs uncovered. Plan 01-01 had no threshold gate so it passed; Plan 01-02 enables the gate so the gap surfaces. Closed the gap by adding a `scoreToLevel` describe block (5 cases) and a `calc barrel` import test in `tests/calc/calcEngine.test.ts`. Cleaner than carving out an `excludes` for the barrel and `scoreToLevel`.
- **Test count documentation correction** (no code change). Plan acceptance text says `127 assertions (2 deterministic + 1 fixture-shape + 125 round-trip)`. The arithmetic 2+1+125 = 128 (not 127). Actual reported test count is 128 it() blocks for `tests/audit/serialize.test.ts` before the Task 9 barrel addition; 129 after. Documenting here so the next reviewer doesn't chase a phantom missing test.
- **Audit barrel test placed in serialize.test.ts** (instead of a separate file). Adding a 4th audit test file would deviate from the plan's `must_haves.artifacts` list. A 7-line `describe('public API barrel', ...)` block at the top of serialize.test.ts achieves the same coverage outcome with no artifact-list drift.

## Deviations from Plan

### Rule 3 (blocking issue) — coverage gate would not pass without these

**1. Removed unreachable defensive guard in `src/audit/parse.ts`**
- **Found during:** Task 9 (running `npx vitest run --coverage`)
- **Issue:** `if (typeof raw !== 'object' || raw === null) return null;` after `JSON.parse(match[1])` is unreachable: the regex `\{[^{}]*\}` matches only flat object literals, and JSON.parse of a flat object literal always returns an object. v8 reported the branch as uncovered, failing the 100% gate.
- **Fix:** Deleted the line. Replaced with a comment block documenting why the guard is omitted. Still have 8 return-null paths (plan acceptance requires `>= 6`).
- **Files modified:** `src/audit/parse.ts`
- **Commit:** `9c797e2`

**2. Closed Plan 01-01 coverage gap in `tests/calc/calcEngine.test.ts`**
- **Found during:** Task 9
- **Issue:** Plan 01-01 ran without a coverage threshold and shipped with `scoreToLevel` and `src/calc/index.ts` uncovered. Plan 01-02 enables the threshold gate, surfacing the gap. Without closing it, the gate fails.
- **Fix:** Added a 5-case `scoreToLevel` describe block and a `calc barrel` import test asserting all 10 expected exports. Test count: 163 → 169.
- **Files modified:** `tests/calc/calcEngine.test.ts`
- **Commit:** `9c797e2`

### Rule 2 (test-coverage hardening)

**3. Added 17th edge case to `tests/audit/parse.test.ts`: non-string label value**
- **Found during:** Task 9
- **Issue:** `toCanonicalLevel`'s `typeof input !== 'string'` branch (parse.ts line 20) was uncovered — every test case sent string labels. The branch is reachable from real-world adversarial input where the JSON contains `"c": 42`.
- **Fix:** Added a row `{ name: 'non-string label value (number) returns null', body: '<!-- sp-calc:v1 {"sp":5,"c":42,"u":"Medium","e":"Easy","schemaVersion":1} -->', expected: null }`. Test count rose from 16 to 17.
- **Files modified:** `tests/audit/parse.test.ts`
- **Commit:** `9c797e2`

**4. Added audit + calc barrel coverage tests**
- **Found during:** Task 9
- **Issue:** `src/audit/index.ts` and `src/calc/index.ts` are re-export-only modules; v8 reports them as 0/0/0/0 unless a test imports them. The threshold gate was therefore failing on these files.
- **Fix:** Added `import * as auditBarrel from '../../src/audit/index'` plus a 4-assertion describe block in `tests/audit/serialize.test.ts`. Mirrored with `import * as calcBarrel from '../../src/calc/index'` and a 10-assertion barrel describe block in `tests/calc/calcEngine.test.ts`.
- **Files modified:** `tests/audit/serialize.test.ts`, `tests/calc/calcEngine.test.ts`
- **Commit:** `9c797e2`

### No other deviations

Tasks 1–8 followed the plan's verbatim source exactly. Task 9 modified the plan only where necessary to make the threshold gate pass without `/* c8 ignore */` escape hatches (which the plan explicitly forbids).

## TypeScript Edge Cases

- **`noUncheckedIndexedAccess` interaction with `obj['schemaVersion']`:** RESEARCH §Pattern 6 predicted `obj['schemaVersion']` is typed `unknown` after `obj as Record<string, unknown>`; the strict `=== 1` check narrows it correctly. No `!` non-null assertions needed; tsc clean.
- **`exactOptionalPropertyTypes` and `AdoComment.isDeleted`:** `isDeleted?: boolean` is optional; `c.isDeleted !== true` correctly handles undefined-as-not-deleted. No issue.
- **`isolatedModules` and the audit barrel:** `export type { AuditPayload, AdoComment } from './types';` uses `export type` syntax, satisfying `isolatedModules`. Same for `export type` in calc index.ts.
- **Replacer array typing:** `JSON.stringify(payload, [...SENTINEL_KEYS] as string[])` — the `as string[]` cast is required because the replacer array's static `ReadonlyArray<keyof AuditPayload>` type doesn't quite line up with JSON.stringify's looser `string[] | null` signature in lib.es5.d.ts. Verified in RESEARCH Pitfall 1.

## Confirmation: D-27 (Smoke Deletion)

Plan 01-01 Task 5 already deleted `tests/smoke.test.ts` in the same commit that created `tests/calc/calcEngine.test.ts` (commit `c403782`). This plan's precondition `test ! -f tests/smoke.test.ts` holds at start and end. No action by this plan was required for D-27.

## Decision Coverage (D-01..D-27)

All 27 decisions from CONTEXT.md are covered. Plan 01-01 covered D-15, D-16, D-17, D-22, D-25, D-26, D-27. This plan covers the remainder:

- D-01: serialize.ts implements the wire format
- D-02: SENTINEL_KEYS replacer array enforces fixed key order; serialize.test.ts asserts byte-for-byte canonical output
- D-03: AuditPayload's c/u/e are typed as Level (closed Title Case union from src/calc/levels)
- D-04: parse.ts toCanonicalLevel does case-insensitive lookup; serializer always Title Case; parse.test.ts 'lowercase labels accepted' verifies
- D-05: Plan 01-01 already exposed LEVELS/LEVEL_TO_SCORE/SCORE_TO_LEVEL; this plan imports LEVELS for canonicalization
- D-06: parse.ts strict `=== 1` rejects schemaVersion=2; parse.test.ts 'schemaVersion=2 returns null' verifies
- D-07: documented in parse.ts comment; behavior is the strict `=== 1` check
- D-08: same `=== 1` check rejects schemaVersion=0; parse.test.ts 'schemaVersion=0 returns null' verifies
- D-09: SENTINEL_RX requires literal `sp-calc:v1`; parse.test.ts 'wrong marker (sp-calc:v2) returns null' verifies
- D-10: regex matches inside any surrounding markup; parse.test.ts 'HTML-wrapped in <p>' and 'HTML-wrapped in <div>' verify
- D-11: normalizeNbsp replaces U+00A0; parse.test.ts 'NBSP between marker and JSON' verifies (with the literal ` ` escape preserved per the plan's CRITICAL guidance)
- D-12: try { JSON.parse(...) } catch { return null }; parse.test.ts 'malformed JSON inside sentinel returns null' verifies
- D-13: parseLatest.ts filters `c.isDeleted !== true`; parseLatest.test.ts 'skips isDeleted: true comments' verifies
- D-14: parseLatest.ts sorts desc + falls through; parseLatest.test.ts 'newest of multiple' and 'falls through to older valid' verify
- D-18: src/audit/index.ts re-exports serialize, parse, parseLatest, AuditPayload, AdoComment
- D-19: AuditPayload + AdoComment in types.ts (no SDK import)
- D-20: vitest it.each tables; no fast-check
- D-21: 125-case round-trip property in serialize.test.ts
- D-23: parse.test.ts table covers all 16 D-23 cases plus the additional non-string label case (deviation #3)
- D-24: test files at tests/audit/{serialize,parse,parseLatest}.test.ts mirror src/audit/

## Phase 1 Readiness for Phase 2

All 12 Phase 1 requirements (CALC-01..05 + AUDIT-01..07) are mechanically verified by 322 passing tests with 100% coverage on the two leaf modules. Phase 2 (manifest shell / toolbar contribution / SDK init) builds on top of `src/calc/index.ts` and `src/audit/index.ts` without further changes to either subsystem; the public API surface is locked by:

- `import { calculate, LEVELS } from '../../src/calc';` (modal — Phase 3)
- `import { serialize } from '../../src/audit';` (post-comment — Phase 4)
- `import { parseLatest } from '../../src/audit';` (pre-fill from prior comments — Phase 4)
- `import type { AuditPayload, AdoComment, Level, FibonacciSp, CalcResult } from '../../src/{audit,calc}';` (UI typing — Phase 3)

The boundary invariants (zero React/SDK/browser-globals in src/calc and src/audit) make these modules safe to import from any future entry — toolbar IIFE, modal iframe, settings hub — without iframe-context or bundle-tree-shake concerns.

## Threat Flags

None — all 10 STRIDE threats in the plan's `<threat_model>` are mitigated as specified:

- T-01-A1 (schemaVersion bump tampering): mitigated by strict `=== 1`
- T-01-A2 (out-of-set sp value): mitigated by FIB_VALUES.has check
- T-01-A3 (out-of-set Level label): mitigated by toCanonicalLevel returning null on no match
- T-01-A4 (regex DoS): mitigated by negated character class `[^{}]*` (linear scan)
- T-01-A5 (deeply-nested JSON DoS): accepted; regex pre-filters to flat objects only
- T-01-A6 (info disclosure via thrown exceptions): mitigated by try/catch around JSON.parse and otherwise side-effect-free function
- T-01-A7 (prototype pollution): mitigated by both regex flat-object filter and explicit field copy into a new object literal
- T-01-A8 (parseLatest mutates input): mitigated by `[...live].sort` copy-before-sort + ReadonlyArray signature; verified by 'does not mutate' test
- T-01-A9 (boundary leak — React/SDK imports): mitigated by Task 9 hard-grep gate
- T-01-A10 (insertion-order JSON.stringify): mitigated by SENTINEL_KEYS replacer array; verified by 'identical output regardless of input field declaration order' test

No new threat surface introduced.

## Self-Check: PASSED

All claimed files exist; all claimed commits exist; tests pass; typecheck passes; coverage gate passes.

- `src/audit/types.ts`: FOUND
- `src/audit/serialize.ts`: FOUND
- `src/audit/parse.ts`: FOUND
- `src/audit/parseLatest.ts`: FOUND
- `src/audit/index.ts`: FOUND
- `tests/audit/serialize.test.ts`: FOUND
- `tests/audit/parse.test.ts`: FOUND
- `tests/audit/parseLatest.test.ts`: FOUND
- `vitest.config.ts`: MODIFIED (thresholds added)
- `tests/calc/calcEngine.test.ts`: MODIFIED (scoreToLevel + barrel)
- `src/audit/.gitkeep`: ABSENT (intentional, deleted by Task 1)
- `tests/smoke.test.ts`: ABSENT (intentional, deleted by Plan 01-01)
- Commits `448a060`, `6bf1843`, `e586a7f`, `012a0ac`, `f859356`, `68e6aba`, `4f08a8b`, `9f70039`, `9c797e2`: all present in git log
- `npx tsc --noEmit`: exit 0
- `npx vitest run`: 322/322 passing
- `npx vitest run --coverage`: exit 0; 100% on src/calc/** and src/audit/**
