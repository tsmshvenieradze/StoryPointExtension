---
phase: 01-calc-engine-audit-parser
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/calc/levels.ts
  - src/calc/fibonacci.ts
  - src/calc/engine.ts
  - src/calc/index.ts
  - src/audit/types.ts
  - src/audit/serialize.ts
  - src/audit/parse.ts
  - src/audit/parseLatest.ts
  - src/audit/index.ts
  - tests/calc/calcEngine.test.ts
  - tests/calc/fixtures/all-cases.ts
  - tests/audit/serialize.test.ts
  - tests/audit/parse.test.ts
  - tests/audit/parseLatest.test.ts
  - vitest.config.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-05-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The Phase 1 deliverables (`src/calc/`, `src/audit/`) are pure-TypeScript modules that port the xlsx calculator and add a sentinel comment codec. The implementation is largely correct: xlsx parity is preserved via the `<=` threshold table; serialization is deterministic via a key-order-enforcing replacer array; the parser robustly returns `null` on malformed input; `parseLatest` correctly filters soft-deleted comments and falls through to older valid sentinels. There are no SDK/React imports in `src/`, satisfying the Phase-1 isolation rule.

The two warnings concern (a) a deviation from CONTEXT D-05 where `LEVELS` lacks `Object.freeze` (compile-time `as const` only — runtime mutability remains) and (b) `calculate()` returning the caller's `input` object by reference, exposing `CalcResult.input` to mutation. Info items cover minor type-tightening, dead defensive code, and a documented (but non-obvious) defense-in-depth concern around HTML-comment escapes.

No critical (security / data-loss / crash) issues were identified. Coverage configuration is correct, test scope is exhaustive (125-case round-trips, threshold boundaries, NBSP, HTML-wrap, schemaVersion 0/2, all-deleted, multi-comment newest-wins).

## Warnings

### WR-01: `LEVELS` declared `as const` without `Object.freeze` — runtime immutability not enforced

**File:** `src/calc/levels.ts:2-8`
**Issue:** Phase context point 7 explicitly requires both `Object.freeze` (runtime) AND `as const` (compile-time) per CONTEXT D-05 + RESEARCH Q3. The current implementation only uses `as const`. At runtime, downstream code that intentionally widens the type (e.g. `(LEVELS as Level[]).push('Trivial')` or via JS interop) can mutate the array, polluting every consumer that holds a reference to the same module-level constant. `LEVEL_TO_SCORE` and `SCORE_TO_LEVEL` correctly use `Object.freeze`; the inconsistency is the bug.

**Fix:**
```ts
export const LEVELS = Object.freeze([
  'Very Easy',
  'Easy',
  'Medium',
  'Hard',
  'Very Hard',
] as const);
```
Note: `Object.freeze(x as const)` preserves the readonly-tuple type. Verify `for (const lvl of LEVELS)` in `parse.ts` and the test fixtures still type-check after the change.

---

### WR-02: `calculate()` returns caller's `input` by reference — mutation aliasing

**File:** `src/calc/engine.ts:23-35`
**Issue:** `CalcResult.input` is the same object reference passed by the caller. A consumer that mutates `input` after the call will silently mutate `result.input`, which is surprising for an otherwise pure function and breaks the "snapshot of inputs" expectation that an audit / serialize step downstream may rely on. Risk increases in Phase 3/4 where React state, memoization, and ADO field watchers will be in the same call graph.

**Fix:**
```ts
export function calculate(input: CalcInput): CalcResult {
  const c = levelToScore(input.c);
  const u = levelToScore(input.u);
  const e = levelToScore(input.e);
  const w = weightedSum(c, u, e);
  const r = rawSp(w);
  return {
    w,
    rawSp: r,
    sp: roundFib(r),
    input: { c: input.c, u: input.u, e: input.e },  // defensive copy
  };
}
```
Alternative: type as `Readonly<CalcInput>` AND copy. (Type-only `Readonly` does not prevent runtime mutation through aliasing.)

---

## Info

### IN-01: `normalizeNbsp` is dead defense — JS regex `\s` already matches U+00A0

**File:** `src/audit/parse.ts:14-16, 30`
**Issue:** The JavaScript regex character class `\s` matches U+00A0 (non-breaking space) per ECMAScript Annex B and confirmed in V8/Node 24. The `SENTINEL_RX` uses `\s+` between the marker and the JSON, so a literal NBSP would already match without normalization. The `normalizeNbsp` helper is therefore reachable in practice only if (a) NBSP appears INSIDE the JSON capture (where it is also valid JSON whitespace) or (b) someone refactors the regex to use a stricter literal space. The current code path tested by parse.test.ts:33 ("NBSP between marker and JSON") would also pass without `normalizeNbsp`. Not a bug — just a misleading comment ("RESEARCH Pitfall 2") suggesting normalization is required when it is in fact belt-and-suspenders.
**Fix:** Update the JSDoc to clarify that NBSP normalization is defense-in-depth (not strictly required), or remove `normalizeNbsp` and rely on `\s` matching U+00A0 natively. If kept, add a focused test where NBSP appears WITHIN the JSON capture (where `\s+` does not gate matching) to ensure the helper actually runs.

---

### IN-02: `parse.ts:32` — `!match[1]` redundant defensive check

**File:** `src/audit/parse.ts:32`
**Issue:** The capture group `(\{[^{}]*\})` is non-optional and always matches at least `{}` (two characters). On any successful regex match, `match[1]` is a non-empty string. The `!match[1]` clause is unreachable defensive code (TypeScript narrows it via `noUncheckedIndexedAccess` from `string | undefined`, which is the only reason it appears).
**Fix:** Replace with a non-null assertion or destructuring:
```ts
const match = normalized.match(SENTINEL_RX);
if (!match) return null;
const [, json] = match;  // json: string (the capture is mandatory)
```
This removes the dead branch while still satisfying `noUncheckedIndexedAccess`.

---

### IN-03: `parseLatest` uses `localeCompare` on ISO 8601 strings — relies on locale-independence

**File:** `src/audit/parseLatest.ts:10`
**Issue:** ISO 8601 strings are sortable lexicographically with any ASCII-aware comparator, but `String.prototype.localeCompare` without an explicit locale uses the runtime's default locale, which in extreme cases (Turkish locale, dotted-i, etc.) can affect comparison of non-ASCII characters. ISO 8601 timestamps from ADO contain only ASCII (`-`, `:`, `T`, `Z`, digits), so this is safe in practice — but a stricter, locale-independent comparator removes the implicit assumption.
**Fix:**
```ts
const sorted = [...live].sort((a, b) =>
  a.createdDate < b.createdDate ? 1 : a.createdDate > b.createdDate ? -1 : 0
);
```
Or pin the locale: `a.createdDate.localeCompare(b.createdDate, 'en-US')`. Cosmetic — current code is not buggy.

---

### IN-04: `serialize` produces JSON with no escaping of HTML-comment-terminator (`-->`) — out-of-band defense missing

**File:** `src/audit/serialize.ts:8-10`
**Issue:** The current `Level` type is constrained to 5 fixed strings, and `FibonacciSp` is a numeric union, so no value passing the type system can produce a substring of `-->` or `--` inside the JSON. However, `serialize` accepts `AuditPayload` and TypeScript casts (`as AuditPayload`) can launder arbitrary strings through the type. If a future change broadens `Level` (e.g., user-customizable labels per project — already raised in some Phase 0 discussion), an embedded `-->` would terminate the HTML comment and corrupt `parseLatest`'s view of the comment body. This is not a current vulnerability — flagging because the codec is the long-term integrity boundary.
**Fix:** When `Level` is widened, add a guard in `serialize` that rejects (or escapes) `--` substrings in any string value, e.g.:
```ts
function assertNoCommentTerminator(s: string, field: string): void {
  if (s.includes('--')) throw new Error(`${field} cannot contain '--' (would break HTML comment)`);
}
```
Out-of-scope for Phase 1; track in Phase-4 readiness checklist.

---

_Reviewed: 2026-05-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
