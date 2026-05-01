---
phase: 01-calc-engine-audit-parser
verified: 2026-05-02T01:15:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 1: Calc Engine & Audit Parser — Verification Report

**Phase Goal:** Lock the wire formats — calculation behavior matching the Excel source of truth, and the sentinel comment format that survives ADO's renderer — before any ADO surface is touched
**Verified:** 2026-05-02T01:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pure `calcEngine` module turns three level selections into Fibonacci-rounded Final Story Points using `W = 0.4·C + 0.4·U + 0.2·E` and `SP = 0.5 × 26^((W−1)/4)`, with tests asserting every bucket and threshold boundary | VERIFIED | `src/calc/{levels,fibonacci,engine,index}.ts` contain exact formulas verbatim; 169 calc tests pass including 21 threshold-boundary tests and bucket-count assertion for all 7 buckets; `npx vitest run` 322/322 |
| 2 | Pure `auditComment` module serializes to exact sentinel format `<!-- sp-calc:v1 {...} -->` with deterministic key order | VERIFIED | `src/audit/serialize.ts` uses `JSON.stringify(payload, [...SENTINEL_KEYS])` with keys array `['sp','c','u','e','schemaVersion']`; no `space` arg; 2 determinism tests pass including out-of-order input field test |
| 3 | Parser extracts payload from raw HTML, ADO-renderer-wrapped, NBSP-substituted; ignores `isDeleted` and malformed; returns most recent by `createdDate`; never throws | VERIFIED | `src/audit/{parse,parseLatest}.ts` handle all cases; 17 parse edge cases + 7 parseLatest scenarios pass; `parse()` has try/catch with no throw path; `parseLatest` filters isDeleted before sorting |
| 4 | Round-trip property: `parse(serialize(input)) === input` for all valid inputs | VERIFIED | `tests/audit/serialize.test.ts` has 125-case it.each round-trip suite (LEVELS × LEVELS × LEVELS); all 129 assertions in the describe block pass |
| 5 | Both modules have zero imports from `azure-devops-extension-sdk` or `azure-devops-extension-api`; test suite runs without browser or ADO mock | VERIFIED | Grep of `src/calc/**` and `src/audit/**` for `react` and `azure-devops` import statements returns zero hits; `vitest.config.ts` uses `environment: 'node'`; `npx vitest run` exits 0 with no browser or ADO setup |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/calc/levels.ts` | LEVELS, Level, Score, LEVEL_TO_SCORE, SCORE_TO_LEVEL, levelToScore, scoreToLevel | VERIFIED | 36 lines; `Object.freeze` applied to LEVELS array AND to both lookup records (WR-01 fix confirmed in commit `0fef450`); 7 `export` declarations |
| `src/calc/fibonacci.ts` | FibonacciSp, FIB_THRESHOLDS, roundFib | VERIFIED | 20 lines; all 6 threshold tuples present; F22 IF-chain in comment header; no rounding before comparison |
| `src/calc/engine.ts` | CalcInput, CalcResult, weightedSum, rawSp, calculate | VERIFIED | 35 lines; formulas `0.4 * c + 0.4 * u + 0.2 * e` and `0.5 * Math.pow(26, (w - 1) / 4)` literal; input snapshotted via `{ c: input.c, u: input.u, e: input.e }` (WR-02 fix confirmed in same commit) |
| `src/calc/index.ts` | Public API barrel — 15 symbols | VERIFIED | 7 lines; re-exports LEVELS, LEVEL_TO_SCORE, SCORE_TO_LEVEL, levelToScore, scoreToLevel, roundFib, FIB_THRESHOLDS, calculate, weightedSum, rawSp + types Level, Score, FibonacciSp, CalcInput, CalcResult |
| `tests/calc/calcEngine.test.ts` | Table-driven tests covering CALC-01..05 | VERIFIED | 169 tests; 6 describe blocks (added scoreToLevel + barrel via Plan 02 deviation); 21 threshold-boundary cases in roundFib describe |
| `tests/calc/fixtures/all-cases.ts` | 125-case fixture with correct bucket distribution | VERIFIED | 125 entries confirmed by grep; bucket counts exactly `{0.5:5, 1:23, 2:28, 3:34, 5:21, 8:12, 13:2}` confirmed by per-bucket grep |
| `src/audit/types.ts` | AuditPayload, AdoComment structural types | VERIFIED | 23 lines; AuditPayload has `sp, c, u, e, schemaVersion: 1`; AdoComment has `id, text, createdDate, isDeleted?`; no SDK import |
| `src/audit/serialize.ts` | serialize(payload) producing canonical sentinel | VERIFIED | 11 lines; SENTINEL_KEYS replacer array; no `space` arg to JSON.stringify; human-readable line template correct |
| `src/audit/parse.ts` | parse(commentBody) with all D-23 robustness | VERIFIED | 60 lines; sentinel regex `/<!--\s*sp-calc:v1\s+(\{[^{}]*\})\s*-->/`; normalizeNbsp; schemaVersion strict `=== 1`; FIB_VALUES.has check; toCanonicalLevel with typeof guard; 8 return-null paths; try/catch around JSON.parse |
| `src/audit/parseLatest.ts` | parseLatest(comments) filter+sort+fall-through | VERIFIED | 18 lines; filters `isDeleted !== true`; `[...live].sort(...)` copy-before-sort; fall-through on malformed |
| `src/audit/index.ts` | Public API barrel | VERIFIED | 5 lines; re-exports serialize, parse, parseLatest, AuditPayload, AdoComment |
| `tests/audit/serialize.test.ts` | 125-case round-trip + determinism | VERIFIED | 61 lines; 2 determinism tests + 1 cases-array shape test + 125 round-trip it.each rows + 1 barrel test = 129 assertions |
| `tests/audit/parse.test.ts` | 17 edge cases per D-23 | VERIFIED | 105 lines; 17 it.each rows covering HTML-wrapped, NBSP, extra whitespace, mid-comment edit, lowercase, malformed JSON, missing sentinel, human-only line, wrong marker, schemaVersion 0 and 2, unknown sp, unknown label, non-string label, empty |
| `tests/audit/parseLatest.test.ts` | 7 multi-comment scenarios | VERIFIED | 66 lines; covers empty, no-sentinel, single, multiple-newest-wins, fall-through-malformed, isDeleted-filter, no-mutation |
| `vitest.config.ts` | 100% coverage thresholds for src/calc/** and src/audit/** | VERIFIED | Per-glob thresholds `'src/calc/**'` and `'src/audit/**'` at 100/100/100/100; confirmed by `npx vitest run --coverage` output |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/calc/engine.ts` | `src/calc/levels.ts` and `src/calc/fibonacci.ts` | `import { levelToScore }` and `import { roundFib }` | WIRED | Lines 2-3 of engine.ts; wiring confirmed live by test execution |
| `src/calc/index.ts` | All three implementation files | barrel re-exports | WIRED | Lines 2-7 of index.ts; barrel coverage test asserts all 10 value exports present |
| `src/audit/parse.ts` | `src/calc/levels.ts` and `src/calc/fibonacci.ts` | `import { LEVELS }` and `import type { Level, FibonacciSp }` | WIRED | Lines 3-5 of parse.ts; LEVELS used in toCanonicalLevel; FibonacciSp used in FIB_VALUES set |
| `src/audit/serialize.ts` | `src/audit/types.ts` | `import type { AuditPayload }` | WIRED | Line 2 of serialize.ts |
| `src/audit/parseLatest.ts` | `src/audit/parse.ts` and `src/audit/types.ts` | `import { parse }` and `import type { AdoComment, AuditPayload }` | WIRED | Lines 2-3 of parseLatest.ts; parse called in loop |
| `tests/audit/serialize.test.ts` | `src/audit/serialize`, `src/audit/parse`, `src/calc/engine` | imports for round-trip | WIRED | Lines 4-8; calculate used to derive expected sp for 125 cases |
| `vitest.config.ts` thresholds | `src/calc/**` and `src/audit/**` | per-glob coverage object | WIRED | Thresholds object present; `npx vitest run --coverage` exits 0 and reports 100% for both globs |

### Data-Flow Trace (Level 4)

Not applicable. Phase 1 contains only pure-function modules with no dynamic data rendering, no state, no React components, and no API calls. Data flows are type-checked by TypeScript and validated by the test suite.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes — 322 tests | `npx vitest run` | 322 passed (4 test files) | PASS |
| Coverage gate passes — 100% on calc and audit | `npx vitest run --coverage` | 100% lines/branches/functions/statements on all src/calc and src/audit files (types.ts reports 0/0/0/0 as type-only module; per-glob aggregation passes) | PASS |
| TypeScript type check | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Zero ADO/React imports in src/calc | grep for `azure-devops` and `react` imports | No matches | PASS |
| Zero ADO/React imports in src/audit | grep for `azure-devops` and `react` imports | No matches | PASS |
| smoke.test.ts deleted (D-27) | file existence check | ABSENT | PASS |
| Bucket distribution matches RESEARCH | per-bucket grep in fixture | 0.5:5, 1:23, 2:28, 3:34, 5:21, 8:12, 13:2 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CALC-01 | 01-01 | Pure function maps 5-level selection to 1–5 score | SATISFIED | `levelToScore` in levels.ts; 5 table tests + LEVELS shape test |
| CALC-02 | 01-01 | Pure function computes `W = 0.4·C + 0.4·U + 0.2·E` | SATISFIED | `weightedSum` in engine.ts with literal formula; 5 table tests |
| CALC-03 | 01-01 | Pure function computes Raw SP using `0.5 × 26^((W−1)/4)` | SATISFIED | `rawSp` in engine.ts with literal formula; 4 table tests |
| CALC-04 | 01-01 | Fibonacci rounding matches xlsx threshold table | SATISFIED | `roundFib` in fibonacci.ts; 21 threshold-boundary tests including both sides of every threshold |
| CALC-05 | 01-01 | Zero ADO SDK deps; tested for every bucket and all threshold boundaries | SATISFIED | Hard-grep gate passes; 125-case calculate suite; bucket-count assertion |
| AUDIT-01 | 01-02 | Exact sentinel comment format | SATISFIED | `serialize` produces `<!-- sp-calc:v1 {...} -->\nStory Points: N (...)` confirmed by determinism test byte-for-byte |
| AUDIT-02 | 01-02 | Deterministic output — stable key order, no extra whitespace | SATISFIED | SENTINEL_KEYS replacer array; no `space` arg; identical-output-regardless-of-field-order test |
| AUDIT-03 | 01-02 | Parser handles raw HTML, ADO-wrapped, NBSP-substituted | SATISFIED | parse.test.ts cases: plain, HTML-wrapped `<p>`, HTML-wrapped `<div>`, NBSP, extra whitespace |
| AUDIT-04 | 01-02 | Parser ignores non-sentinel, isDeleted, malformed; never throws | SATISFIED | 9 null-returning test cases in parse.test.ts; isDeleted tested in parseLatest.test.ts; try/catch in parse.ts |
| AUDIT-05 | 01-02 | Most recent sentinel by createdDate when multiple exist | SATISFIED | parseLatest sorts by createdDate desc; "newest of multiple" and "fall-through" tests |
| AUDIT-06 | 01-02 | Tests for all D-23 edge cases | SATISFIED | 17 edge cases in parse.test.ts + 7 parseLatest scenarios |
| AUDIT-07 | 01-02 | Round-trip `parse(serialize(input)) === input` for all valid inputs | SATISFIED | 125-case exhaustive round-trip in serialize.test.ts |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/audit/parse.ts` | 32 | `!match[1]` redundant after regex guarantees non-empty capture — noted in code review as IN-02 | Info | Non-blocking; dead defensive code remains after unreachable branch removal; IN-02 is a cosmetic cleanup |
| `src/audit/parseLatest.ts` | 10 | `localeCompare` without explicit locale for ISO 8601 sort — noted in code review as IN-03 | Info | Non-blocking; ISO 8601 timestamps contain ASCII-only characters; no practical risk |

No blocker or warning anti-patterns. The two code review warnings (WR-01: missing `Object.freeze` on LEVELS, WR-02: input aliasing in `calculate()`) were both fixed in commit `0fef450` before verification — confirmed by reading the current source and the commit diff.

### Human Verification Required

None. Phase 1 is pure TypeScript logic with no UI, no ADO integration, and no visual components. All behaviors are mechanically verifiable via the test suite and type checker.

### Decision Coverage Spot-Check (D-01..D-27)

| Decision | Status | Evidence |
|----------|--------|---------|
| D-05 (Object.freeze + as const on LEVELS) | VERIFIED | `Object.freeze([...] as const)` in levels.ts line 2; confirmed by commit `0fef450` diff |
| D-06 (schemaVersion > 1 silently skipped) | VERIFIED | `if (obj['schemaVersion'] !== 1) return null` in parse.ts line 47; parse.test.ts 'schemaVersion=2 returns null' |
| D-08 (schemaVersion 0 also skipped) | VERIFIED | Same strict `=== 1` check; parse.test.ts 'schemaVersion=0 returns null' |
| D-09 (sentinel anchored to sp-calc:v1) | VERIFIED | SENTINEL_RX = `/<!--\s*sp-calc:v1\s+(\{[^{}]*\})\s*-->/`; 'wrong marker (sp-calc:v2) returns null' test |
| D-10 (HTML-wrapped tolerance) | VERIFIED | Regex matches inside surrounding markup; 'HTML-wrapped in `<p>`' and 'HTML-wrapped in `<div>`' tests |
| D-11 (NBSP normalization) | VERIFIED | `normalizeNbsp` replaces ` ` with ASCII space before regex; 'NBSP between marker and JSON' test |
| D-12 (malformed JSON -> null, never throw) | VERIFIED | try/catch around JSON.parse returns null on exception; 'malformed JSON inside sentinel returns null' test |
| D-15..D-19 (public API exports) | VERIFIED | calc barrel exports 10 value symbols + 5 types; audit barrel exports 3 functions + 2 types; both barrel tests pass |
| D-20 (table-driven vitest, no fast-check) | VERIFIED | All four test files use `it.each` object-form tables; no fast-check in package.json |
| D-21 (125-case round-trip) | VERIFIED | serialize.test.ts lines 40-60; 125 it.each rows + shape test |
| D-25 (no React imports) | VERIFIED | Grep returns zero import hits |
| D-26 (no SDK imports) | VERIFIED | Grep returns zero import hits |
| D-27 (smoke.test.ts deleted) | VERIFIED | File ABSENT; deleted in commit `c403782` (same commit as first real test) |

### Executor Deviations (Noted, Non-Blocking)

Four deviations from the plans occurred during Plan 02 Task 9 — all were required to make the 100% coverage gate achievable and are correctly classified:

1. Removed unreachable `typeof raw !== 'object'` guard in parse.ts — closed coverage gap without `/* c8 ignore */`
2. Extended `tests/calc/calcEngine.test.ts` with `scoreToLevel` describe block + barrel test (Plan 01-01 coverage gap exposed by new threshold gate)
3. Added 17th parser edge case (non-string label value — covers `toCanonicalLevel`'s typeof branch)
4. Added barrel import/coverage tests in serialize.test.ts and calcEngine.test.ts (re-export-only modules need explicit import to register with v8)

None of these change observable behavior or contradict the phase goal.

### Gaps Summary

No gaps. All 5 roadmap success criteria are fully verified by automated tests, the type checker, and direct code inspection. The phase goal — locking wire formats before any ADO surface is touched — is achieved.

---

_Verified: 2026-05-02T01:15:00Z_
_Verifier: Claude (gsd-verifier)_
