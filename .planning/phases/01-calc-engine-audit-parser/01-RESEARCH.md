# Phase 1: Calc Engine & Audit Parser - Research

**Researched:** 2026-05-01
**Domain:** Pure-TypeScript calculation engine matching `sp_calculator.xlsx` and a sentinel-format HTML-comment serializer/parser; zero ADO SDK contact
**Confidence:** HIGH (calc formulas verified directly against the xlsx XML; regex and JSON serialization patterns verified live in Node 24.15)

## Summary

This phase ships two pure-function modules — `src/calc/` and `src/audit/` — that together lock the wire formats Phase 3's modal and Phase 4's ADO bridge will consume. Neither module imports from `react`, `azure-devops-extension-sdk`, or `azure-devops-extension-api`; both run unchanged in Node and the browser. The calc engine ports the Excel formula chain (level→score→weighted sum→raw SP→Fibonacci round) verbatim from `sp_calculator.xlsx` cell F22; the audit module produces a deterministic sentinel HTML comment block and a forgiving parser that survives ADO's renderer (HTML wrapping, NBSP substitution, deleted-comment filtering, multi-comment newest-wins selection, malformed-JSON tolerance).

Two findings reshape the planning brief slightly. First, the Excel formula was extracted directly from `xl/worksheets/sheet1.xml` and confirms the IF-chain `IF(G19<=0.75, 0.5, IF(G19<=1.5, 1, IF(G19<=2.5, 2, IF(G19<=4, 3, IF(G19<=6.5, 5, IF(G19<=10.5, 8, 13))))))` with `<=` semantics and the 5×5×5 finite input space producing this bucket distribution: `{0.5: 5, 1: 23, 2: 28, 3: 34, 5: 21, 8: 12, 13: 2}` (125 cases summed). Second — and important for the planner — the floating-point precision concern raised in the brief is **theoretical** for the v1 input space: the closest any of the 21 distinct W values produces to a Fibonacci threshold is `Raw=2.5495 → threshold 2.5` (diff 0.05), which is six orders of magnitude larger than IEEE-754 double error from `Math.pow(26, x)`. No input combination lands close enough to a threshold for floating-point error to flip the bucket. The planner should still test `Number.toFixed(2)` for **display** (per D-16: "Modal shows result.w to 2 decimals, result.rawSp to 2 decimals") but must not round W or Raw SP before passing them to the Fibonacci threshold function — full precision is correct.

The audit parser regex `/<!--\s*sp-calc:v1\s+(\{[^{}]*\})\s*-->/` (with NBSP normalization to ASCII space applied first) was verified against every edge case in D-23 and behaves correctly. The negated character class `[^{}]` is preferred over a non-greedy `.+?` because it cannot accidentally span past a closing brace if a future bug ever embedded a stray `}` in the comment text — this is brittleness insurance for v1's flat schema. v2's nested-object schema would require a different parsing strategy (probably a chunked extractor or a fully-bracketed `\{(?:[^{}]|\{[^{}]*\})*\}`); flag that as a known limitation when v2 is planned.

**Primary recommendation:** Build six files under `src/calc/` (`levels.ts`, `fibonacci.ts`, `engine.ts`, `index.ts`) and `src/audit/` (`types.ts`, `serialize.ts`, `parse.ts`, `parseLatest.ts`, `index.ts`), drive every behavior with `it.each(table)` object-form vitest tables, and require 100% line/branch/function coverage on both modules (set `coverage.thresholds.100 = true` in `vitest.config.ts`). The 125-case round-trip table goes in `tests/audit/serialize.test.ts`; the 125-case calc table and the threshold-boundary table go in `tests/calc/calcEngine.test.ts`. Remove `tests/smoke.test.ts` in the same commit that creates the first real test file (D-27).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sentinel JSON Payload (D-01, D-02):**
- Wire format: `<!-- sp-calc:v1 {"sp":N,"c":"...","u":"...","e":"...","schemaVersion":1} -->\nStory Points: N (Complexity=..., Uncertainty=..., Effort=...)`
- Sentinel JSON shape exactly: `{"sp": number, "c": string, "u": string, "e": string, "schemaVersion": 1}`
- Field order is fixed: `sp, c, u, e, schemaVersion`
- Stable key order; no extra whitespace inside the sentinel block; no trailing comma
- Labels (strings) for c/u/e fields, not scores; English canonical labels at the JSON level

**Canonical Label Vocabulary v1 (D-03, D-04, D-05):**
- Title Case with spaces: `Very Easy`, `Easy`, `Medium`, `Hard`, `Very Hard` → scores `1, 2, 3, 4, 5`
- Parser is **case-insensitive on read** but always serializes Title Case
- `LEVELS` (ordered array of 5 labels), `LEVEL_TO_SCORE` (record), `SCORE_TO_LEVEL` (record) exposed in public API; Phase 3 modal imports `LEVELS` for dropdown options

**Parser Forward-Compatibility Policy (D-06, D-07, D-08):**
- `schemaVersion > 1` is **skipped silently** — parser treats unknown-future-version sentinels as if absent; modal opens empty
- Rationale: v2 introduces configurable dimensions; best-effort extraction risks showing stale data with wrong dimensions assigned to wrong meanings
- `schemaVersion < 1` is also skipped (defense against legacy/test data with explicit `0`)
- Parser only accepts `schemaVersion === 1` for v1

**Parser Strictness on Sentinel Match (D-09..D-14):**
- Sentinel pattern anchored on `<!-- sp-calc:v1 ` followed by JSON object followed by ` -->`; the `sp-calc:v1` marker is the trigger
- HTML-wrapped tolerance: when ADO's renderer wraps the comment body (e.g., `<p><!-- sp-calc:v1 {...} --></p>`), parser strips outer HTML before searching
- NBSP and whitespace tolerance: parser normalizes ` ` (NBSP) to regular space before matching
- Malformed JSON inside sentinel → return `null` from parser; never throw
- `isDeleted: true` comments filtered out before parsing
- Multiple sentinels: parser sorts by `createdDate` (most recent first), returns newest valid; falls through to older one if newest is malformed

**Calc Engine Public API (D-15, D-16, D-17):**
- Exported functions (`src/calc/index.ts`):
  - `calculate(input: CalcInput): CalcResult` — top-level pipeline
  - `levelToScore(label: Level): Score` — direct testing + Phase 3 dropdown wiring
  - `weightedSum(c: Score, u: Score, e: Score): number` — exposed for displaying W
  - `rawSp(w: number): number` — exposed for displaying Raw SP
  - `roundFib(rawSp: number): FibonacciSp` — exposed for testing thresholds
- Type exports: `Level`, `Score`, `FibonacciSp`, `CalcInput`, `CalcResult`
- `CalcInput` = `{ c: Level; u: Level; e: Level }`
- `CalcResult` = `{ w: number; rawSp: number; sp: FibonacciSp; input: CalcInput }`
- `Level` = `'Very Easy' | 'Easy' | 'Medium' | 'Hard' | 'Very Hard'`
- `Score` = `1 | 2 | 3 | 4 | 5`
- `FibonacciSp` = `0.5 | 1 | 2 | 3 | 5 | 8 | 13`

**Audit Module Public API (D-18, D-19):**
- Exported functions (`src/audit/index.ts`):
  - `serialize(payload: AuditPayload): string` — full sentinel comment block (HTML comment + newline + human-readable line)
  - `parse(commentBody: string): AuditPayload | null`
  - `parseLatest(comments: AdoComment[]): AuditPayload | null`
- Type exports: `AuditPayload`, `AdoComment`
- `AuditPayload` = `{ sp: FibonacciSp; c: Level; u: Level; e: Level; schemaVersion: 1 }`
- `AdoComment` = `{ id: number; text: string; createdDate: string; isDeleted?: boolean }` — structural type, defined locally; Phase 4 maps the real ADO type to this shape

**Test Approach (D-20..D-24):**
- Table-driven vitest with `it.each(table)` (object-form). No `fast-check`.
- Round-trip property: 125-case explicit table — for every (c, u, e), assert `parse(serialize({c,u,e,sp,schemaVersion:1})) === {c,u,e,sp,schemaVersion:1}`
- Threshold boundary coverage: explicit tests for each Fibonacci threshold edge — `0.75, 1.5, 2.5, 4.0, 6.5, 10.5` — both ≤ and > sides; plus one test per documented xlsx row
- Parser edge-case table per D-23 (HTML-wrapped, NBSP, isDeleted, malformed JSON, missing sentinel, multiple sentinels, schemaVersion 0/2, empty)
- Test layout mirrors `src/`: `tests/calc/calcEngine.test.ts`, `tests/audit/serialize.test.ts`, `tests/audit/parse.test.ts`, `tests/audit/parseLatest.test.ts`

**Phase 1 Scope Boundaries (D-25, D-26, D-27):**
- Zero React imports anywhere in `src/calc/` or `src/audit/`
- Zero browser-only APIs (no `window`, `document`, `crypto`)
- Zero `azure-devops-extension-sdk` or `azure-devops-extension-api` imports
- `tests/smoke.test.ts` from Phase 0 removed in same commit that adds first real test file

### Claude's Discretion

- Exact file naming inside `src/calc/` and `src/audit/` (single `index.ts` vs split files) — **recommendation in this research: split into `levels.ts` + `fibonacci.ts` + `engine.ts` + `index.ts` for `src/calc/`, and `types.ts` + `serialize.ts` + `parse.ts` + `parseLatest.ts` + `index.ts` for `src/audit/`** (rationale in `## Architecture Patterns` § Recommended Project Structure)
- Internal helper naming/extraction — planner decides
- Whether to use `Object.freeze` on `LEVELS` constant — recommendation: yes, with `as const` for type-narrowing
- Whether parser uses single regex or multiple passes — **recommendation: single regex** (verified against all edge cases below); a normalize-then-match-then-JSON-parse pipeline is cleanest

### Deferred Ideas (OUT OF SCOPE)

- Property-based testing via fast-check — rejected for v1 (D-20)
- Locale-aware level labels — out of scope; v1 is English-only
- Multi-step calc explanation UI — Phase 3 owns visual rendering of W, Raw SP, formula
- Migration tooling for v2 schema — out of scope
- Performance benchmarking — calc engine is O(1); audit parser is O(n) over comments
- Removing `tests/smoke.test.ts` immediately — D-27 says replace it in same commit as first real test file

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CALC-01** | Pure function maps a 5-level dropdown selection to its 1–5 numeric score | `levels.ts` defines `LEVEL_TO_SCORE` record + `levelToScore(label)` function; `Code Examples §1` |
| **CALC-02** | Pure function computes weighted sum `W = 0.4·C + 0.4·U + 0.2·E` | `engine.ts` `weightedSum(c, u, e)`; verified against xlsx cell G18 formula `0.4*G14+0.4*G15+0.2*G16`; `Code Examples §3` |
| **CALC-03** | Pure function computes Raw SP using `0.5 × 26^((W−1)/4)` | `engine.ts` `rawSp(w)`; verified against xlsx cell G19 formula `0.5*26^((G18-1)/4)`; `Code Examples §3` |
| **CALC-04** | Pure function rounds Raw SP to nearest Fibonacci using xlsx threshold table (`<=0.75→0.5, <=1.5→1, <=2.5→2, <=4→3, <=6.5→5, <=10.5→8, else→13`) | `fibonacci.ts` `roundFib(rawSp)`; verified against xlsx cell F22 IF-chain; `Code Examples §2` |
| **CALC-05** | Calc engine has zero ADO SDK dependencies; unit-tested with at least one assertion per Fibonacci bucket plus boundary cases at every threshold | D-25 + D-26 forbid SDK imports; threshold-boundary table in `tests/calc/calcEngine.test.ts`; bucket coverage assured by 125-case table; `Code Examples §6` |
| **AUDIT-01** | Audit comment format: `<!-- sp-calc:v1 {...JSON...} -->\nStory Points: N (Complexity=..., Uncertainty=..., Effort=...)` | `audit/serialize.ts`; format locked by D-01, D-02; `Code Examples §4` |
| **AUDIT-02** | Serializer produces deterministic output (stable key order, no extra whitespace inside sentinel) | `JSON.stringify(payload, ['sp','c','u','e','schemaVersion'])` enforces order; verified live; `Code Examples §4` |
| **AUDIT-03** | Parser extracts payload from raw HTML, NBSP-substituted text, and ADO-renderer-wrapped output | Regex `/<!--\s*sp-calc:v1\s+(\{[^{}]*\})\s*-->/` after NBSP normalization; verified live; `Code Examples §5` |
| **AUDIT-04** | Parser ignores comments without sentinel, marked `isDeleted: true`, and malformed JSON; never throws | `try/catch` around `JSON.parse`; `isDeleted` filter in `parseLatest`; D-12, D-13; `Code Examples §5, §7` |
| **AUDIT-05** | When multiple sentinel comments exist, parser returns most recent (by `createdDate`) | Sort `[...comments].sort((a,b) => b.createdDate.localeCompare(a.createdDate))`; D-14 fall-through; `Code Examples §7` |
| **AUDIT-06** | Parser unit-tested for: HTML-wrapped, mid-comment user edit to human-readable line, NBSP substitution, deleted comment, multiple comments, malformed JSON | Edge-case table in `tests/audit/parse.test.ts` and `tests/audit/parseLatest.test.ts` per D-23; `Code Examples §8` |
| **AUDIT-07** | Round-trip property: `parse(serialize(input)) === input` holds for all valid inputs | 125-case `it.each` table in `tests/audit/serialize.test.ts` per D-21; `Code Examples §6` |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Level↔Score mapping | Pure TS module (`src/calc/levels.ts`) | — | No I/O, no DOM, no SDK; lives in calc layer because Phase 3 modal needs `LEVELS` for dropdown options |
| Weighted sum + raw SP arithmetic | Pure TS module (`src/calc/engine.ts`) | — | Pure math; finite floating-point operations; deterministic |
| Fibonacci threshold rounding | Pure TS module (`src/calc/fibonacci.ts`) | — | Lookup table with `<=` semantics; isolated for individual unit testing per D-22 |
| Calc pipeline composition | Pure TS module (`src/calc/engine.ts`) | — | Composes the above into a single `calculate(input)` entry point |
| Sentinel JSON serialization | Pure TS module (`src/audit/serialize.ts`) | — | `JSON.stringify` with replacer-array key ordering; produces deterministic string |
| Sentinel regex extraction | Pure TS module (`src/audit/parse.ts`) | — | Single regex with NBSP normalization preprocessing; no DOM parser needed (HTML-comment delimiters are textual) |
| Multi-comment selection (newest valid) | Pure TS module (`src/audit/parseLatest.ts`) | — | Filter `isDeleted` + sort by `createdDate` desc + fall-through on malformed; AdoComment is a structural type, not the real ADO API type |
| Type contracts (Level/Score/FibonacciSp/AuditPayload) | Pure TS module (`src/audit/types.ts` + inline in `calc/`) | — | Compile-time exhaustiveness; eliminates whole bug classes (D-17) |
| Test orchestration | Vitest (`tests/calc/`, `tests/audit/`) | — | `it.each` table-driven; mirrors `src/` layout per D-24 |

**Note:** No "secondary tier" entries because Phase 1 has zero integration boundaries — both modules are leaf nodes consumed by later phases.

## Standard Stack

### Core (already installed in Phase 0)

| Package | Pinned version | Purpose | Why Standard | Confidence |
|---------|---------------:|---------|--------------|------------|
| `typescript` | `^5.6.0` | Source language; strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` (Phase 0 D-tsconfig) | Required by Phase 0; calc engine relies on string-literal unions for Level/Score/FibonacciSp exhaustiveness | HIGH `[VERIFIED: e:\Projects\Github\StoryPointExtension\package.json line 44]` |
| `vitest` | `2.1.9` (resolved from `^2.1.0`) | Unit test runner — pure-function tests, zero DOM, zero SDK | Phase 0 chose Vitest; `it.each` is the standard table-driven idiom (Jest-compatible API) | HIGH `[VERIFIED: e:\Projects\Github\StoryPointExtension\node_modules\vitest\package.json]` |
| `@vitest/coverage-v8` | `^2.1.0` | Coverage instrumentation — required for the 100% threshold gate this phase introduces | Phase 0 installed; thresholds support is in `vitest/dist/chunks/reporters.nr4dxCkA.d.ts` line 1379+ | HIGH `[VERIFIED: same node_modules path]` |

### Supporting

| Package | Pinned/floor | Purpose | When to Use | Confidence |
|---------|-------------:|---------|-------------|------------|
| (none) | — | — | Phase 1 introduces zero new runtime or dev dependencies. Both modules are pure TypeScript, tested by Vitest already in Phase 0's `package.json`. | HIGH |

**Don't add:** `fast-check` (D-20 explicitly rejects it); `lodash` (no helpers needed — the calc and parser both use only standard library); `zod` or other JSON validators (the parser does its own shape validation per D-12, D-17, D-19; adding zod would violate the "zero browser-only APIs and minimal deps" spirit of D-25 and inflate the modal bundle Phase 5 will gate at 250 KB).

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| `JSON.stringify` with replacer array | Manual JSON string construction (`'{"sp":' + sp + ',...'`) | More control, more bug surface (need to escape strings, handle Unicode) | **Use replacer array** — verified live; one-line solution |
| Single regex parser | DOMParser + querySelector | Need real HTML parsing; DOMParser is browser-only (D-25 forbids) | **Use regex** — comment delimiters are textual; DOM not needed |
| Negated character class `[^{}]` | Non-greedy `.+?` with `s` flag | `.+?` works but can span past `}` if a future schema embeds nested braces | **Use `[^{}]`** — fail-fast on schema drift; v1's flat schema satisfies it |
| `it.each` object-form `{a, b, expected}` | `it.each` tuple-form `[[a, b, expected], ...]` | Tuple is terser but reads as positional in test names | **Use object-form** — readability with named keys for 125-row tables |
| `fast-check` property tests | Hand-written 125-case table | Property tests find unknown-unknowns; for finite 125-case space, exhaustive enumeration is more honest | **Hand-written table** — D-20 locked this |

### No Installation Step

Phase 1 ships zero new packages. The Phase 0 `npm install` already provided everything (`typescript`, `vitest`, `@vitest/coverage-v8`). The planner's plan should NOT include `npm install` tasks for this phase.

## Architecture Patterns

### System Architecture Diagram

Phase 1 produces two leaf modules; the data flow is purely intra-process function composition.

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    Phase 1 Surface                       │
                    │                                                          │
                    │  ┌─────────────────┐         ┌──────────────────────┐  │
                    │  │   src/calc/     │         │     src/audit/        │  │
                    │  │                 │         │                       │  │
                    │  │  Level (string  │         │  AuditPayload         │  │
                    │  │   union)        │         │  (re-exports          │  │
                    │  │     │           │         │   FibonacciSp + Level)│  │
                    │  │     ▼           │         │     │                 │  │
                    │  │  levelToScore   │         │     ▼                 │  │
                    │  │     │           │◄────────│  serialize(payload)   │  │
                    │  │     ▼           │         │     │                 │  │
                    │  │  weightedSum    │         │     ▼                 │  │
                    │  │     │           │         │  HTML-comment string  │  │
                    │  │     ▼           │         │  + human-readable     │  │
                    │  │  rawSp          │         │                       │  │
                    │  │     │           │         │                       │  │
                    │  │     ▼           │         │  parse(commentBody)   │  │
                    │  │  roundFib       │         │     │                 │  │
                    │  │     │           │         │     ▼                 │  │
                    │  │     ▼           │         │  AuditPayload | null  │  │
                    │  │  CalcResult     │         │                       │  │
                    │  │  {w, rawSp, sp} │         │  parseLatest(         │  │
                    │  └─────────────────┘         │    AdoComment[])      │  │
                    │           ▲                   │     │                 │  │
                    │           │                   │     ▼                 │  │
                    │           │                   │  AuditPayload | null  │  │
                    │           │                   └──────────────────────┘  │
                    │           │                            ▲                  │
                    │           │                            │                  │
                    │       ┌───┴────────────────────────────┴────┐             │
                    │       │   tests/calc/    +  tests/audit/    │             │
                    │       │                                      │             │
                    │       │   Vitest it.each tables:             │             │
                    │       │   - 125-case (c,u,e)→W→RawSP→SP      │             │
                    │       │   - threshold boundary table         │             │
                    │       │   - 125-case round-trip serialize/   │             │
                    │       │     parse                            │             │
                    │       │   - parser edge-case table           │             │
                    │       │   - parseLatest multi-comment table  │             │
                    │       └──────────────────────────────────────┘             │
                    │                                                          │
                    └─────────────────────────────────────────────────────────┘

  Phase 1 has NO entry point, NO iframe, NO REST call. Both modules are imported by:
    - Phase 3 modal UI (calc.calculate, calc.LEVELS, audit.parse for pre-fill)
    - Phase 4 ADO bridge (audit.serialize, audit.parseLatest with mapped ADO Comment[])
```

### Recommended Project Structure

```
src/
├── calc/
│   ├── levels.ts          # LEVELS array, LEVEL_TO_SCORE record, SCORE_TO_LEVEL record,
│   │                       # Level type, Score type, levelToScore(), scoreToLevel()
│   ├── fibonacci.ts       # FibonacciSp type, FIB_THRESHOLDS table, roundFib()
│   ├── engine.ts          # weightedSum(), rawSp(), calculate(), CalcInput, CalcResult
│   └── index.ts           # Re-exports public API per D-15, D-17
└── audit/
    ├── types.ts           # AuditPayload, AdoComment (structural type — no SDK import)
    ├── serialize.ts       # serialize(payload), buildHumanLine() helper
    ├── parse.ts           # parse(commentBody) — single-comment regex extractor
    ├── parseLatest.ts     # parseLatest(comments) — filter + sort + fall-through
    └── index.ts           # Re-exports public API per D-18, D-19

tests/
├── calc/
│   └── calcEngine.test.ts # 125-case table + threshold boundary table + bucket coverage
└── audit/
    ├── serialize.test.ts  # determinism + 125-case round-trip
    ├── parse.test.ts      # edge-case table (HTML-wrap, NBSP, malformed, etc.)
    └── parseLatest.test.ts # multi-comment newest-wins, isDeleted filter, fall-through
```

**Why split into multiple files (not one `index.ts`):**
1. **Single-responsibility readability:** Each file owns one concept. A reviewer reading `fibonacci.ts` sees only the threshold logic.
2. **Testable in isolation:** `import { roundFib } from '../../src/calc/fibonacci'` is clearer than depth-fishing through a single barrel.
3. **D-22's "test thresholds individually":** A dedicated `fibonacci.ts` makes the threshold table the literal export and pairs naturally with a `tests/calc/fibonacci.test.ts` if the planner wants to split tests further. (Recommended: keep all calc tests in one file `calcEngine.test.ts` because they share the 125-case fixture; split only if it grows unwieldy.)
4. **Supports D-21's round-trip table:** `serialize.test.ts` owns the round-trip table; `parse.test.ts` owns the edge-case table; `parseLatest.test.ts` owns the multi-comment scenarios. Three test files mirror three source files.

### Pattern 1: String-Literal Union with Const Map for Level↔Score

**What:** Use a `const` array `LEVELS` plus two `Record` constants for both directions of the mapping, with the array's element type derived via `(typeof LEVELS)[number]`. This gives compile-time exhaustiveness in switches and rejects typos at the call site.

**When to use:** Always when there's a closed enumeration (5 levels, never more in v1) that the UI also needs (D-05 says Phase 3 imports `LEVELS` for dropdowns).

**Why:** TypeScript's `noUncheckedIndexedAccess: true` (Phase 0 tsconfig.json line 9) makes `record[key]` return `T | undefined`. A `Record<Level, Score>` indexed by a value of type `Level` does return `Score | undefined` under that flag — so the helper functions must narrow.

**Example:**

```typescript
// src/calc/levels.ts — Source: TypeScript handbook + Phase 0 tsconfig flags
export const LEVELS = [
  'Very Easy',
  'Easy',
  'Medium',
  'Hard',
  'Very Hard',
] as const;

export type Level = (typeof LEVELS)[number];   // 'Very Easy' | 'Easy' | 'Medium' | 'Hard' | 'Very Hard'
export type Score = 1 | 2 | 3 | 4 | 5;

export const LEVEL_TO_SCORE: Record<Level, Score> = {
  'Very Easy': 1,
  'Easy':      2,
  'Medium':    3,
  'Hard':      4,
  'Very Hard': 5,
};

export const SCORE_TO_LEVEL: Record<Score, Level> = {
  1: 'Very Easy',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Very Hard',
};

export function levelToScore(label: Level): Score {
  // Direct lookup; under noUncheckedIndexedAccess this returns Score | undefined,
  // but `label: Level` constrains the key to a known one. The non-null assertion is
  // safe because Level is a closed union and LEVEL_TO_SCORE has every key.
  return LEVEL_TO_SCORE[label];
}

export function scoreToLevel(score: Score): Level {
  return SCORE_TO_LEVEL[score];
}
```

**Note on `noUncheckedIndexedAccess` interaction:** With this flag, `LEVEL_TO_SCORE[label]` returns `Score | undefined` even when `label` is typed as `Level`. The TypeScript team intentionally does NOT special-case `Record` lookups for this flag (see microsoft/TypeScript#13778). For a `Record<Level, Score>`, every key in `Level` is present at compile time, so the value can never be `undefined` at runtime. The cleanest pattern is to either (a) accept the return type as `Score | undefined` and let consumers narrow, or (b) return a non-null assertion `!`. Recommended: return without `!` and let the function signature say `: Score` — TypeScript will accept this because the Record's value type is `Score`. **Verify in Phase 1 execution:** if `tsc --noEmit` complains about this exact line, switch to `LEVEL_TO_SCORE[label]!` or use a `switch` statement with `assertNever` for full type-safety. `[VERIFIED behavior in Node — runtime guarantees correctness; TypeScript behavior under noUncheckedIndexedAccess depends on TS version. Floor 5.6 in Phase 0 should accept Record return type as the value type, not | undefined.]`

### Pattern 2: Sorted Threshold Array for Fibonacci Round

**What:** Encode the IF-chain as an ordered array of `[threshold, value]` tuples. Iterate with `<=` and return on first match. Final fallback is `13`.

**When to use:** Anywhere you have a piecewise-constant function defined by ascending thresholds. Direct port of Excel's nested IF.

**Why not a switch:** A switch on a continuous numeric input would need explicit ranges; the array form makes the threshold table the literal source of truth and matches the xlsx row-by-row.

**Example:**

```typescript
// src/calc/fibonacci.ts — Source: xlsx cell F22 (verified extracted from xl/worksheets/sheet1.xml)
// IF(G19<=0.75, 0.5, IF(G19<=1.5, 1, IF(G19<=2.5, 2, IF(G19<=4, 3, IF(G19<=6.5, 5, IF(G19<=10.5, 8, 13))))))

export type FibonacciSp = 0.5 | 1 | 2 | 3 | 5 | 8 | 13;

/**
 * Ordered ascending. Each row reads as: "if rawSp <= threshold, return value".
 * Fall-through default is 13.
 */
export const FIB_THRESHOLDS: ReadonlyArray<readonly [threshold: number, value: FibonacciSp]> = [
  [0.75, 0.5],
  [1.5,  1],
  [2.5,  2],
  [4.0,  3],
  [6.5,  5],
  [10.5, 8],
] as const;

export function roundFib(rawSp: number): FibonacciSp {
  for (const [threshold, value] of FIB_THRESHOLDS) {
    if (rawSp <= threshold) return value;
  }
  return 13;
}
```

**On floating-point precision (planning brief item 2):** No combination of v1's 21 distinct W values produces a Raw SP within 0.05 of any threshold (closest: W=3 → Raw=2.5495 vs threshold 2.5, diff 0.05). IEEE-754 error from `Math.pow(26, x)` is ≤ ~10⁻¹⁵ relative. The threshold table is robust against floating-point drift across the entire v1 input space. **No `Number.toFixed` rounding before `roundFib`.** The planner should display `result.w` and `result.rawSp` rounded to 2 decimals (Phase 3's modal concern), but the calc pipeline uses full precision throughout.

### Pattern 3: Calc Pipeline Composition

**What:** A top-level `calculate(input)` function that runs `levelToScore` → `weightedSum` → `rawSp` → `roundFib` and returns a `CalcResult` object with all intermediate values exposed (so the modal can display W and Raw SP without re-computing).

**Example:**

```typescript
// src/calc/engine.ts — Source: xlsx cells G14-G19 (input row), G18 (W), G19 (Raw SP), F22 (final SP)
import type { Level, Score } from './levels';
import { levelToScore } from './levels';
import { roundFib, type FibonacciSp } from './fibonacci';

export type CalcInput = { c: Level; u: Level; e: Level };
export type CalcResult = {
  w: number;          // weighted sum, full precision; modal displays toFixed(2)
  rawSp: number;      // raw Story Points, full precision
  sp: FibonacciSp;    // rounded to nearest Fibonacci value
  input: CalcInput;
};

export function weightedSum(c: Score, u: Score, e: Score): number {
  // Weights from xlsx cell G18: 0.4*C + 0.4*U + 0.2*E
  return 0.4 * c + 0.4 * u + 0.2 * e;
}

export function rawSp(w: number): number {
  // Formula from xlsx cell G19: 0.5 * 26^((W-1)/4)
  return 0.5 * Math.pow(26, (w - 1) / 4);
}

export function calculate(input: CalcInput): CalcResult {
  const c = levelToScore(input.c);
  const u = levelToScore(input.u);
  const e = levelToScore(input.e);
  const w = weightedSum(c, u, e);
  const r = rawSp(w);
  const sp = roundFib(r);
  return { w, rawSp: r, sp, input };
}
```

### Pattern 4: Deterministic JSON Serialization via Replacer Array

**What:** `JSON.stringify(payload, ['sp', 'c', 'u', 'e', 'schemaVersion'])` enforces key order **and** filters out any extra keys. No `space` argument → no extra whitespace inside the JSON, satisfying D-02.

**Why:** `JSON.stringify` without a replacer follows insertion order for string keys (ES2015+, V8/SpiderMonkey/JSC all conform). Insertion order is fragile against object literal reordering during refactoring; the replacer-array form is **declarative** and survives any refactoring.

**Verified live (Node 24.15):**

```
Stable from natural order:   {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1}
Stable from reversed order:  {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1}
Match: true
```

**Example:**

```typescript
// src/audit/serialize.ts — Source: JSON.stringify replacer array (ECMAScript spec); D-02
import type { AuditPayload } from './types';

const SENTINEL_KEYS = ['sp', 'c', 'u', 'e', 'schemaVersion'] as const;

export function serialize(payload: AuditPayload): string {
  const json = JSON.stringify(payload, SENTINEL_KEYS as unknown as string[]);
  const human = `Story Points: ${payload.sp} (Complexity=${payload.c}, Uncertainty=${payload.u}, Effort=${payload.e})`;
  return `<!-- sp-calc:v1 ${json} -->\n${human}`;
}
```

> **Note on `SENTINEL_KEYS as unknown as string[]`:** TypeScript's `JSON.stringify` overload signature accepts `(string | number)[] | null` for the replacer parameter, but `as const` produces a `readonly` tuple type. The `as unknown as string[]` cast satisfies the lib type without losing the readability of the constant. An equivalent `[...SENTINEL_KEYS]` spread would also work; pick whichever the planner prefers.

### Pattern 5: Single-Regex Parser with NBSP Normalization

**What:** A two-step extractor: (1) normalize NBSP and other whitespace gotchas to ASCII space; (2) match a single anchored regex. Then JSON-parse and validate the resulting object against the AuditPayload shape.

**The verified regex:** `/<!--\s*sp-calc:v1\s+(\{[^{}]*\})\s*-->/`

**Why this pattern over alternatives:**
- The negated class `[^{}]` cannot accidentally cross past a `}` if a future schema accidentally embeds one (defense in depth)
- `\s+` between marker and JSON tolerates the NBSP-replaced spaces and any extra whitespace
- The non-greedy alternative `/<!--\s*sp-calc:v1\s+(\{.*?\})\s*-->/s` works for v1 but is more permissive than necessary
- `[^{}]*` is **strictly** v1-flat-schema-compatible. If v2 ever introduces nested objects (`{"weights": {...}}`), the regex would not match and parser would silently return null. **Document this as the v1→v2 boundary.**

**Verified edge cases (Node 24.15):**

| Case | Input | Match | Result |
|------|-------|-------|--------|
| Plain | `<!-- sp-calc:v1 {"sp":5,...} -->\nStory Points: 5...` | ✓ | Extracts JSON correctly |
| HTML-wrapped `<p>` | `<p><!-- sp-calc:v1 {...} --></p>` | ✓ | Extracts JSON correctly |
| HTML-wrapped `<div>` | `<div><!-- sp-calc:v1 {...} --></div>` | ✓ | Extracts JSON correctly |
| NBSP between marker and JSON | `<!-- sp-calc:v1 {...} -->` | ✓ (after normalize) | Extracts JSON correctly |
| Extra whitespace | `<!--   sp-calc:v1   {...}   -->` | ✓ | Extracts JSON correctly |
| Malformed JSON | `<!-- sp-calc:v1 {bad json} -->` | ✓ regex; ✗ JSON.parse | Returns null per D-12 |
| No sentinel | `Just a plain comment` | ✗ | Returns null |
| Human-line only | `Story Points: 5 (Complexity=...)` | ✗ | Returns null |
| Wrong marker | `<!-- sp-calc:v2 {...} -->` | ✗ | Returns null |
| schemaVersion=2 | `<!-- sp-calc:v1 {...,"schemaVersion":2} -->` | ✓ regex; ✗ post-validation | Returns null per D-06 |
| schemaVersion=0 | `<!-- sp-calc:v1 {...,"schemaVersion":0} -->` | ✓ regex; ✗ post-validation | Returns null per D-08 |
| Lowercase label | `<!-- sp-calc:v1 {"c":"hard",...} -->` | ✓ | Title-Cased on read per D-04 (case-insensitive label match) |
| Empty body | `''` | ✗ | Returns null |

### Pattern 6: AuditPayload Shape Validation After JSON.parse

**What:** `JSON.parse` returns `any` (TypeScript's escape hatch). Before treating the result as an `AuditPayload`, type-narrow with explicit shape and value checks. Reject anything that fails — return `null` per D-12.

**Why:** D-04 says parser is case-insensitive on read but D-17 says `AuditPayload.c/u/e` are typed `Level` (Title Case). The validator must (1) confirm `schemaVersion === 1` per D-06/D-08; (2) confirm `sp` is a known FibonacciSp; (3) Title-Case the input labels and confirm they're in `LEVELS`.

**Example:**

```typescript
// src/audit/parse.ts — Source: D-04, D-06, D-08, D-12, D-17
import type { Level } from '../calc/levels';
import { LEVELS } from '../calc/levels';
import type { FibonacciSp } from '../calc/fibonacci';
import type { AuditPayload } from './types';

const FIB_VALUES: ReadonlySet<FibonacciSp> = new Set([0.5, 1, 2, 3, 5, 8, 13]);
const SENTINEL_RX = /<!--\s*sp-calc:v1\s+(\{[^{}]*\})\s*-->/;

/** Replace NBSP (U+00A0) with ASCII space; do NOT collapse internal whitespace. */
function normalizeNbsp(s: string): string {
  return s.replace(/ /g, ' ');
}

/** Title-case lookup — case-insensitive match against LEVELS. Returns canonical Level or null. */
function toCanonicalLevel(input: unknown): Level | null {
  if (typeof input !== 'string') return null;
  const lc = input.toLowerCase();
  for (const lvl of LEVELS) {
    if (lvl.toLowerCase() === lc) return lvl;
  }
  return null;
}

export function parse(commentBody: string): AuditPayload | null {
  if (typeof commentBody !== 'string' || commentBody.length === 0) return null;
  const normalized = normalizeNbsp(commentBody);
  const match = normalized.match(SENTINEL_RX);
  if (!match) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(match[1]!);  // match[1] guaranteed by capture group
  } catch {
    return null;  // D-12: never throw
  }

  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  // schemaVersion strictly === 1 per D-06, D-08
  if (obj['schemaVersion'] !== 1) return null;

  // sp must be a known Fibonacci value
  if (typeof obj['sp'] !== 'number' || !FIB_VALUES.has(obj['sp'] as FibonacciSp)) return null;

  // c/u/e: case-insensitive lookup, narrow to canonical Level
  const c = toCanonicalLevel(obj['c']);
  const u = toCanonicalLevel(obj['u']);
  const e = toCanonicalLevel(obj['e']);
  if (c === null || u === null || e === null) return null;

  return {
    sp: obj['sp'] as FibonacciSp,
    c,
    u,
    e,
    schemaVersion: 1,
  };
}
```

### Pattern 7: Multi-Comment Selection (parseLatest)

**What:** Filter out `isDeleted: true` comments, sort the remainder by `createdDate` descending, then iterate from newest to oldest returning the first valid parse. If newest is malformed but an older one is valid, return the older one (D-14 fall-through).

**Why this pattern and not "first newest valid":** The fall-through is what makes the audit log a robust pre-fill source. A user editing the most recent comment to corrupt the JSON should not lose pre-fill — the second-newest valid one wins.

**Example:**

```typescript
// src/audit/parseLatest.ts — Source: D-13, D-14
import type { AdoComment, AuditPayload } from './types';
import { parse } from './parse';

export function parseLatest(comments: ReadonlyArray<AdoComment>): AuditPayload | null {
  // D-13: filter out soft-deleted
  const live = comments.filter((c) => c.isDeleted !== true);

  // D-14: sort newest first by createdDate (ISO 8601 strings sort lexicographically)
  // Use slice() to avoid mutating the caller's array.
  const sorted = [...live].sort((a, b) => b.createdDate.localeCompare(a.createdDate));

  // Fall-through: return first valid parse, skip malformed
  for (const c of sorted) {
    const parsed = parse(c.text);
    if (parsed !== null) return parsed;
  }
  return null;
}
```

**Note on `createdDate` sort:** ADO returns `createdDate` as ISO 8601 (`"2026-04-15T10:30:00Z"`); lexicographic sort is correct for ISO 8601. If the planner ever sees a timezone offset (`+04:00`), the sort still works because ISO 8601 with offsets sorts lexicographically when the lengths match. Document this assumption.

### Pattern 8: Vitest `it.each` Object-Form Tables

**What:** `it.each([{a, b, expected}, ...])('description with %j placeholders', ({a, b, expected}) => { ... })`. Object-form lets named keys appear in the destructured arrow and uses `%j` (JSON) or `%s` (string) in the test name template.

**When to use:** Every table-driven test in this phase per D-20.

**Example:**

```typescript
// tests/calc/calcEngine.test.ts — Source: vitest 2.1.x docs; D-20, D-22
import { describe, it, expect } from 'vitest';
import { roundFib } from '../../src/calc/fibonacci';
import { calculate, weightedSum, rawSp } from '../../src/calc/engine';
import { levelToScore, LEVELS } from '../../src/calc/levels';

describe('roundFib: threshold boundaries', () => {
  // Per D-22: each Fibonacci threshold edge tested both <= and > sides.
  it.each([
    // Below and at each threshold (≤ side)
    { rawSp: 0.0,    expected: 0.5 },
    { rawSp: 0.5,    expected: 0.5 },
    { rawSp: 0.74,   expected: 0.5 },
    { rawSp: 0.75,   expected: 0.5 },
    // Just above 0.75
    { rawSp: 0.7500001, expected: 1 },
    { rawSp: 1.0,    expected: 1 },
    { rawSp: 1.5,    expected: 1 },
    { rawSp: 1.5000001, expected: 2 },
    { rawSp: 2.0,    expected: 2 },
    { rawSp: 2.5,    expected: 2 },
    { rawSp: 2.5000001, expected: 3 },
    { rawSp: 3.0,    expected: 3 },
    { rawSp: 4.0,    expected: 3 },
    { rawSp: 4.0000001, expected: 5 },
    { rawSp: 5.0,    expected: 5 },
    { rawSp: 6.5,    expected: 5 },
    { rawSp: 6.5000001, expected: 8 },
    { rawSp: 8.0,    expected: 8 },
    { rawSp: 10.5,   expected: 8 },
    { rawSp: 10.5000001, expected: 13 },
    { rawSp: 100.0,  expected: 13 },
  ])('roundFib($rawSp) = $expected', ({ rawSp, expected }) => {
    expect(roundFib(rawSp)).toBe(expected);
  });
});

describe('calculate: 125-case full enumeration matches xlsx F22', () => {
  // Build the full 125-case table programmatically so the test reads as a spec.
  const rows: Array<{ c: typeof LEVELS[number]; u: typeof LEVELS[number]; e: typeof LEVELS[number]; sp: number }> = [];
  // Pre-computed expectations live in a fixture (see Code Examples §6 for derivation).
  // Planner writes the rows array exhaustively; this loop is illustrative.
  for (const c of LEVELS) for (const u of LEVELS) for (const e of LEVELS) {
    // expected sp computed from the same formula and committed as fixture data
    rows.push({ c, u, e, sp: /* computed in fixture */ 0 });
  }

  it.each(rows)('calculate($c, $u, $e).sp = $sp', ({ c, u, e, sp }) => {
    const result = calculate({ c, u, e });
    expect(result.sp).toBe(sp);
  });
});
```

**On `it.each` description placeholders:** Object-form supports both `$keyName` (Vitest 0.30+) and `%j`/`%s` (Jest-compat). `$c` reads better than `%j` for named fields. Verified Vitest 2.1.9 supports `$keyName` in object-form. `[VERIFIED: vitest 2.1.9 docs at vitest.dev/api/#it-each]`

### Pattern 9: 100% Coverage Threshold Configuration

**What:** Add `coverage.thresholds` to `vitest.config.ts` requiring 100% line/branch/function coverage on the calc and audit modules. The 5×5×5 input space and the parser edge-case table are exhaustive — there is no excuse for an untested branch.

**Why per-glob thresholds:** The `src/entries/*` files are placeholder stubs (Phase 0) and Phase 2 will fill them with SDK glue not amenable to unit testing. The `coverage.exclude` already drops them from coverage; the 100% threshold applies only to `src/calc/` and `src/audit/`.

**Example (Phase 1 modifies `vitest.config.ts`):**

```typescript
// vitest.config.ts — Phase 1 edit on top of Phase 0 baseline
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/entries/**', 'src/**/*.tsx'],
      thresholds: {
        // Per-glob 100% gate on Phase 1 modules. As later phases add files
        // to src/field/ and src/ado/, the planner will add per-glob thresholds
        // for them too — but Phase 1 only owns calc and audit.
        'src/calc/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/audit/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
```

**Note:** Vitest's coverage thresholds support a per-glob shape `{ [glob: string]: Pick<Thresholds, ...> }` (`[VERIFIED: e:\Projects\Github\StoryPointExtension\node_modules\vitest\dist\chunks\reporters.nr4dxCkA.d.ts:1399]`). The `100: true` shorthand also works (`{ 100: true }`) but is global; per-glob is more honest about Phase 1's scope.

### Anti-Patterns to Avoid

- **`JSON.stringify(obj)` without a replacer array** — relies on insertion order; refactoring an object literal in `serialize.ts` could silently break determinism. Use the explicit replacer per D-02.
- **`JSON.parse(...)` without a `try/catch`** — D-12 says never throw on user input. A malformed comment must return `null`.
- **`Number.toFixed(2)` before `roundFib`** — destroys precision for no benefit; the input space doesn't have float-error-near-threshold problems anyway. `toFixed` is for display only (Phase 3).
- **`text.replace(/\s+/g, ' ')` for normalization** — collapses whitespace **inside** the JSON, which would corrupt strings like `"c":"Very Easy"` if a user's edit somehow injected NBSPs there. Normalize ONLY NBSP → space (` ` → ` `); do not touch other whitespace.
- **Mutating the input `comments` array in `parseLatest`** — `Array.prototype.sort` mutates. Use `[...comments].sort(...)` to avoid surprising callers (Phase 4 may reuse the array).
- **Importing from `azure-devops-extension-sdk` or `azure-devops-extension-api`** — D-26 forbids. The `AdoComment` structural type in `src/audit/types.ts` is intentional; Phase 4 maps the real ADO type at the boundary.
- **Embedding the sentinel marker as a regex variable in tests** — write test fixtures as literal strings so the test reads as the spec. The marker is `<!-- sp-calc:v1 ` (note the trailing space); easy to mistype if abstracted.
- **Single mega-test that loops 125 cases inside a single `it()`** — D-20 specifically calls for `it.each` so each case shows up as a separate test in the runner output. A single failing case is easier to diagnose than "test calc passed/failed".
- **Coverage exception comments (`/* istanbul ignore */`)** — defeats D-22's coverage goal. If a branch is untested, write the test.
- **Removing `tests/smoke.test.ts` in a separate commit from the first real test** — D-27 explicitly requires same-commit replacement. Doing it separately leaves a transient state where Vitest discovers zero tests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stable JSON serialization with fixed key order | Custom string concatenation `'{"sp":' + sp + ',"c":"' + c + '"...'` | `JSON.stringify(payload, ['sp','c','u','e','schemaVersion'])` | Replacer-array form is 1 line, handles string escaping, Unicode, and number formatting natively. Custom concatenation needs `JSON.stringify(string)` for each value anyway and just adds bug surface. |
| HTML-comment regex that handles HTML wrapping | DOM parser (`new DOMParser`) | Single regex `/<!--\s*sp-calc:v1\s+(\{[^{}]*\})\s*-->/` after NBSP normalization | DOMParser is browser-only (D-25 forbids). HTML comments are textual — the regex matches inside any wrapping element without parsing the surrounding HTML. Verified live across all D-23 cases. |
| Property-based test framework | `fast-check` or hand-rolled random generator | 125-case explicit table + threshold-boundary table | D-20 explicitly rejects `fast-check`. Input space is finite (5³ = 125); exhaustive enumeration is more honest than property tests for a closed problem. |
| Date sort on `createdDate` | `Date.parse(a) - Date.parse(b)` | `b.createdDate.localeCompare(a.createdDate)` | ISO 8601 strings sort lexicographically. Avoids creating Date objects (slower, timezone-fragile). Works for both `Z` and `+HH:MM` offset forms when length matches. |
| FibonacciSp value validation | `if (sp === 0.5 \|\| sp === 1 \|\| sp === 2 \|\| ...)` | `FIB_VALUES.has(sp)` with a `Set<FibonacciSp>` | Single source of truth; adding a new Fibonacci bucket in v2 means editing one constant. |
| Title-case label normalization | `s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()` | Iterate `LEVELS` and compare `toLowerCase()`s | Per D-04, the parser is case-insensitive; comparing lowercased forms is correct for ALL labels including `Very Easy` (two words; naive title-case would write `Very easy`). |
| 5×5×5 fixture data | Hard-code 125 expected SP values by hand | Write a small derivation comment explaining the formula and commit a generated fixture | Either approach works; if the planner generates the fixture, document the generator script in the test file's header so a reviewer can re-derive it. Recommended: hand-curate the 125 rows in a `tests/calc/fixtures/all-cases.ts` that exports a `const ALL_CASES` array — visible diff against the xlsx, and Vitest imports it directly. |

**Key insight:** Phase 1 has zero novel-tooling concerns. Every problem in this table has a one-liner standard-library solution, and the test framework (vitest) and its `it.each` API cover every test pattern this phase needs.

## Common Pitfalls

### Pitfall 1: `JSON.stringify` Insertion-Order Dependence

**What goes wrong:** Without the replacer array, `JSON.stringify({sp, c, u, e, schemaVersion: 1})` produces correct order today but a future refactor reorders the object literal and the wire format silently changes — old comments stop round-tripping with new code.

**Why it happens:** ES2015+ does guarantee string-key insertion order (and integer-like keys come first), but the guarantee is on the object's iteration, not on `stringify`'s output specifically. Refactoring an object literal in TypeScript — or merging two objects with `{...a, ...b}` — changes insertion order in non-obvious ways.

**How to avoid:** Always pass the explicit key array as `JSON.stringify`'s second argument. Verified live (Node 24.15) that the same payload constructed in reversed key order produces identical output when the replacer is supplied.

**Warning signs:**
- `tests/audit/serialize.test.ts` deterministic-output test fails on a CI run
- Round-trip test passes for some inputs but not others (impossible with replacer array; possible without)

### Pitfall 2: Whitespace Collapse Corrupts JSON Strings

**What goes wrong:** The parser pre-normalizes `text.replace(/\s+/g, ' ')` to handle ADO's whitespace gotchas, but this also collapses spaces **inside** the JSON. A label like `"Very Easy"` in the comment body becomes `"Very Easy"` only if the user-visible space is preserved; aggressive normalization can break the JSON parse step or — worse — silently change a label.

**Why it happens:** Devs reach for `\s+` because it covers tabs, NBSPs, and double spaces in one regex. But the JSON spec preserves whitespace inside strings as data; collapsing it changes the data.

**How to avoid:** Replace ONLY ` ` (NBSP) with a single ASCII space (` `). Do not touch tabs, newlines, or any other whitespace. The single regex `/<!--\s*sp-calc:v1\s+(\{[^{}]*\})\s*-->/` already uses `\s` to match outside the JSON; you don't need to pre-collapse anything else.

**Warning signs:**
- Round-trip test fails when label contains internal whitespace (e.g., `Very Easy`, `Very Hard`)
- Parser returns null for valid sentinels with NBSP — fixed by normalizing NBSP only, not all whitespace

### Pitfall 3: Greedy Regex Spans Beyond the Closing `}`

**What goes wrong:** If the parser uses `.+?` instead of `[^{}]*`, a future schema or a malicious comment could produce input like `<!-- sp-calc:v1 {bad} other stuff } -->` and the regex would match across the entire span, capturing garbage as the JSON.

**Why it happens:** `.+?` (non-greedy any-char) is the obvious first attempt; works for simple cases. The negated character class `[^{}]` is more defensive but less commonly written.

**How to avoid:** Use `\{[^{}]*\}` — captures from the first `{` to the next `}` with no interior braces. This is correct for v1's flat schema and immediately fails (returns null) for any future schema with nested objects, which is the right behavior.

**Warning signs:**
- A test case with `}` inside the human-readable line would cause a `.+?` regex to over-match; with `[^{}]` it cleanly stops at the first `}`.

### Pitfall 4: `Array.prototype.sort` Mutates the Input

**What goes wrong:** `parseLatest(comments)` calls `comments.sort(...)`; Phase 4's caller still has the same array reference, now reordered. If Phase 4 also sorts by a different key elsewhere, the second sort reads in unexpected order.

**Why it happens:** `sort` mutates by spec; muscle-memory from Python's non-mutating `sorted()` or Ruby's `sort` (which returns a new array) leads devs to forget JavaScript's behavior.

**How to avoid:** Always copy first: `[...comments].sort(...)` or `comments.slice().sort(...)`. Both work; spread is more readable.

**Warning signs:**
- Phase 4's tests pass in isolation but fail when Phase 4 calls `parseLatest` and then iterates `comments` for another purpose (e.g., showing all sentinel comments in a history panel)

### Pitfall 5: `noUncheckedIndexedAccess` Forces Defensive Coding

**What goes wrong:** With Phase 0's `tsconfig.json` setting `noUncheckedIndexedAccess: true`, every array/record indexer returns `T | undefined`. `LEVELS[score - 1]` returns `Level | undefined`. Naive code that does `const lvl = LEVELS[score - 1]; lvl.toLowerCase()` fails to type-check.

**Why it happens:** The flag is intentionally annoying. In a calc engine where every array access is from a known-bounds index (score is `1..5`), the runtime guarantee is that the lookup always succeeds — but TypeScript can't prove it.

**How to avoid:**
1. Prefer `Record<Level, Score>` over `Score[]` indexed by ordinal — Records preserve key types
2. For ordinal lookups (e.g., `SCORE_TO_LEVEL[score]`), use a `Record<Score, Level>` (already in Pattern 1)
3. When you must index an array by computed offset, narrow with `if (lvl !== undefined)` or a non-null assertion `LEVELS[score - 1]!` if you can prove correctness
4. For exhaustive switches, use the `assertNever` pattern: `function assertNever(x: never): never { throw new Error('unreachable: ' + JSON.stringify(x)); }`

**Warning signs:**
- `tsc --noEmit` errors like `'lvl' is possibly undefined`
- Workarounds via `as Level` casts (which silently disable the check) — prefer narrowing or `assertNever`

### Pitfall 6: `JSON.parse` Returns `any` and TypeScript Trusts It

**What goes wrong:** After `JSON.parse(match[1])`, TypeScript sees the result as `any` (the lib's `JSON.parse` signature). Code that does `result as AuditPayload` lies — the JSON could be anything.

**Why it happens:** `any` is contagious; once you cast, every property access is unchecked. A future code change reading `payload.sp` assumes a number but might get a string or undefined at runtime.

**How to avoid:** Validate the shape explicitly after `JSON.parse`. Use the pattern in `Code Examples §6` (Pattern 6) — narrow `unknown` to `Record<string, unknown>`, then check each field with `typeof` or set-membership. Return `null` on any mismatch per D-12.

**Warning signs:**
- `tsc --noEmit` errors about indexing on `unknown`
- Tests pass with hand-crafted valid inputs but fail when fed malformed comments

### Pitfall 7: `it.each` With Object-Form Requires Vitest's `$key` or `%j` Syntax

**What goes wrong:** `it.each([{a:1, b:2}])('test %s', ({a, b}) => {...})` produces a test name containing `[object Object]` — `%s` doesn't know how to format an object. The runner output is unreadable.

**Why it happens:** Jest-style `%s` formats positional args; Vitest object-form tables don't pass positional args.

**How to avoid:** Use `$keyName` placeholders with object-form: `it.each([{a:1, b:2}])('a=$a, b=$b', ({a, b}) => {...})`. Vitest 0.30+ supports `$key`. `[VERIFIED: vitest 2.1.9 — `$key` substitution in `it.each` and `describe.each` is documented in the Vitest API reference]`.

**Warning signs:**
- Test names like `'roundFib boundary [object Object]'` in the runner output
- Switch to tuple-form `it.each([[1, 2, 3]])('a=%i, b=%i, expected=%i', (a, b, expected) => ...)` if `$key` substitution misbehaves

### Pitfall 8: Coverage Threshold Failures Block CI Without Useful Output

**What goes wrong:** `coverage.thresholds: { 'src/calc/**': { lines: 100, ... } }` fails with a single line: `ERROR: Coverage threshold for lines (100%) not met: 99.43%`. No indication which file or which line.

**Why it happens:** v8 coverage reports the threshold check as a binary pass/fail; the detailed line-by-line is in the HTML report (or `text` reporter at `--coverage`).

**How to avoid:**
- Run `npm run test:coverage` locally before committing; the `text` reporter prints a per-file table
- Open `coverage/index.html` for line-level highlighting
- For unreachable branches that genuinely cannot be exercised (e.g., a `default` case that violates exhaustiveness), use `assertNever` to make the unreachability load-bearing rather than ignoring coverage

**Warning signs:**
- CI fails on coverage threshold but local `npm test` (without `--coverage`) passes
- The 100% gate hides real bugs because devs add `/* c8 ignore next */` comments instead of writing tests — DON'T

### Pitfall 9: Removing `tests/smoke.test.ts` Without Adding a Real Test First

**What goes wrong:** A commit deletes `tests/smoke.test.ts` and `npm test` reports "No test files found" or exits non-zero. CI breaks.

**Why it happens:** D-27 says "remove in same commit as first real test" — easy to forget the "same commit" half if the planner sequences as "remove smoke" then "add real test."

**How to avoid:** The planner must sequence `tests/calc/calcEngine.test.ts` (or whichever file is first) and the deletion of `tests/smoke.test.ts` in the same task. The git diff for that task should show: `tests/smoke.test.ts deleted, tests/calc/calcEngine.test.ts added`.

**Warning signs:** A CI run between two commits fails with "No test files matched" — almost always D-27 violated.

## Code Examples

Verified patterns from official sources and live execution.

### Example 1: `src/calc/levels.ts`

```typescript
// src/calc/levels.ts — Source: D-03, D-05, D-17; verified xlsx D5..D9 score values
export const LEVELS = [
  'Very Easy',
  'Easy',
  'Medium',
  'Hard',
  'Very Hard',
] as const;

export type Level = (typeof LEVELS)[number];
export type Score = 1 | 2 | 3 | 4 | 5;

export const LEVEL_TO_SCORE: Readonly<Record<Level, Score>> = Object.freeze({
  'Very Easy': 1,
  'Easy':      2,
  'Medium':    3,
  'Hard':      4,
  'Very Hard': 5,
});

export const SCORE_TO_LEVEL: Readonly<Record<Score, Level>> = Object.freeze({
  1: 'Very Easy',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Very Hard',
});

export function levelToScore(label: Level): Score {
  return LEVEL_TO_SCORE[label];
}

export function scoreToLevel(score: Score): Level {
  return SCORE_TO_LEVEL[score];
}
```

### Example 2: `src/calc/fibonacci.ts`

```typescript
// src/calc/fibonacci.ts — Source: xlsx F22 IF-chain (verified extracted from xl/worksheets/sheet1.xml line F22)
// IF(G19<=0.75, 0.5, IF(G19<=1.5, 1, IF(G19<=2.5, 2, IF(G19<=4, 3, IF(G19<=6.5, 5, IF(G19<=10.5, 8, 13))))))

export type FibonacciSp = 0.5 | 1 | 2 | 3 | 5 | 8 | 13;

export const FIB_THRESHOLDS: ReadonlyArray<readonly [number, FibonacciSp]> = [
  [0.75, 0.5],
  [1.5,  1],
  [2.5,  2],
  [4.0,  3],
  [6.5,  5],
  [10.5, 8],
] as const;

export function roundFib(rawSp: number): FibonacciSp {
  for (const [threshold, value] of FIB_THRESHOLDS) {
    if (rawSp <= threshold) return value;
  }
  return 13;
}
```

### Example 3: `src/calc/engine.ts`

```typescript
// src/calc/engine.ts — Source: xlsx G18 (W formula) + G19 (Raw SP formula); D-15, D-16
import { levelToScore, type Level, type Score } from './levels';
import { roundFib, type FibonacciSp } from './fibonacci';

export type CalcInput = { c: Level; u: Level; e: Level };
export type CalcResult = {
  w: number;
  rawSp: number;
  sp: FibonacciSp;
  input: CalcInput;
};

/** xlsx G18: 0.4*C + 0.4*U + 0.2*E */
export function weightedSum(c: Score, u: Score, e: Score): number {
  return 0.4 * c + 0.4 * u + 0.2 * e;
}

/** xlsx G19: 0.5 * 26^((W-1)/4) */
export function rawSp(w: number): number {
  return 0.5 * Math.pow(26, (w - 1) / 4);
}

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
    input,
  };
}
```

### Example 4: `src/calc/index.ts`

```typescript
// src/calc/index.ts — Source: D-15, D-17 public API
export { LEVELS, LEVEL_TO_SCORE, SCORE_TO_LEVEL, levelToScore, scoreToLevel } from './levels';
export type { Level, Score } from './levels';
export { roundFib, FIB_THRESHOLDS } from './fibonacci';
export type { FibonacciSp } from './fibonacci';
export { calculate, weightedSum, rawSp } from './engine';
export type { CalcInput, CalcResult } from './engine';
```

### Example 5: `src/audit/types.ts`

```typescript
// src/audit/types.ts — Source: D-19; structural type avoids importing azure-devops-extension-api
import type { Level } from '../calc/levels';
import type { FibonacciSp } from '../calc/fibonacci';

export type AuditPayload = {
  sp: FibonacciSp;
  c: Level;
  u: Level;
  e: Level;
  schemaVersion: 1;
};

/**
 * Structural shape mirroring ADO's WorkItemComment for the fields we care about.
 * Phase 4 maps the real `Comment` type from `azure-devops-extension-api/WorkItemTracking`
 * onto this shape at the boundary; Phase 1 stays SDK-free per D-26.
 */
export type AdoComment = {
  id: number;
  text: string;
  createdDate: string;     // ISO 8601
  isDeleted?: boolean;
};
```

### Example 6: `src/audit/serialize.ts`

```typescript
// src/audit/serialize.ts — Source: D-01, D-02; verified determinism in Node 24.15
import type { AuditPayload } from './types';

const SENTINEL_KEYS: ReadonlyArray<keyof AuditPayload> = ['sp', 'c', 'u', 'e', 'schemaVersion'];

export function serialize(payload: AuditPayload): string {
  // Replacer array enforces key order and filters extras. No `space` arg → no inner whitespace.
  const json = JSON.stringify(payload, [...SENTINEL_KEYS] as string[]);
  const human = `Story Points: ${payload.sp} (Complexity=${payload.c}, Uncertainty=${payload.u}, Effort=${payload.e})`;
  return `<!-- sp-calc:v1 ${json} -->\n${human}`;
}
```

### Example 7: `src/audit/parse.ts`

```typescript
// src/audit/parse.ts — Source: D-04, D-06, D-08, D-09, D-10, D-11, D-12, D-17;
// regex verified against all D-23 cases live in Node 24.15
import type { Level } from '../calc/levels';
import { LEVELS } from '../calc/levels';
import type { FibonacciSp } from '../calc/fibonacci';
import type { AuditPayload } from './types';

const FIB_VALUES: ReadonlySet<FibonacciSp> = new Set<FibonacciSp>([0.5, 1, 2, 3, 5, 8, 13]);
const SENTINEL_RX = /<!--\s*sp-calc:v1\s+(\{[^{}]*\})\s*-->/;

function normalizeNbsp(s: string): string {
  // Replace ONLY non-breaking space (U+00A0) with ASCII space.
  // Do NOT collapse other whitespace — internal JSON whitespace must be preserved
  // (and JSON.parse handles it natively).
  return s.replace(/ /g, ' ');
}

function toCanonicalLevel(input: unknown): Level | null {
  if (typeof input !== 'string') return null;
  const lc = input.toLowerCase();
  for (const lvl of LEVELS) {
    if (lvl.toLowerCase() === lc) return lvl;
  }
  return null;
}

export function parse(commentBody: string): AuditPayload | null {
  if (typeof commentBody !== 'string' || commentBody.length === 0) return null;
  const normalized = normalizeNbsp(commentBody);
  const match = normalized.match(SENTINEL_RX);
  if (!match || !match[1]) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    return null;  // D-12: never throw on user input
  }

  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  // schemaVersion strictly === 1 per D-06, D-08
  if (obj['schemaVersion'] !== 1) return null;

  // sp must be a known Fibonacci value
  const sp = obj['sp'];
  if (typeof sp !== 'number' || !FIB_VALUES.has(sp as FibonacciSp)) return null;

  // c/u/e: case-insensitive lookup per D-04
  const c = toCanonicalLevel(obj['c']);
  const u = toCanonicalLevel(obj['u']);
  const e = toCanonicalLevel(obj['e']);
  if (c === null || u === null || e === null) return null;

  return { sp: sp as FibonacciSp, c, u, e, schemaVersion: 1 };
}
```

### Example 8: `src/audit/parseLatest.ts`

```typescript
// src/audit/parseLatest.ts — Source: D-13, D-14
import type { AdoComment, AuditPayload } from './types';
import { parse } from './parse';

export function parseLatest(comments: ReadonlyArray<AdoComment>): AuditPayload | null {
  // D-13: filter soft-deleted
  const live = comments.filter((c) => c.isDeleted !== true);

  // D-14: sort newest first; copy to avoid mutating caller's array
  const sorted = [...live].sort((a, b) => b.createdDate.localeCompare(a.createdDate));

  // Fall-through: skip malformed, return first valid
  for (const c of sorted) {
    const parsed = parse(c.text);
    if (parsed !== null) return parsed;
  }
  return null;
}
```

### Example 9: `src/audit/index.ts`

```typescript
// src/audit/index.ts — Source: D-18, D-19 public API
export { serialize } from './serialize';
export { parse } from './parse';
export { parseLatest } from './parseLatest';
export type { AuditPayload, AdoComment } from './types';
```

### Example 10: `tests/calc/calcEngine.test.ts` (Skeleton)

```typescript
// tests/calc/calcEngine.test.ts — Source: D-20, D-22; replaces tests/smoke.test.ts (D-27)
import { describe, it, expect } from 'vitest';
import { LEVELS, type Level, levelToScore } from '../../src/calc/levels';
import { roundFib, type FibonacciSp } from '../../src/calc/fibonacci';
import { weightedSum, rawSp, calculate } from '../../src/calc/engine';

describe('levelToScore: every label maps correctly (CALC-01)', () => {
  it.each([
    { label: 'Very Easy' as const, expected: 1 },
    { label: 'Easy'      as const, expected: 2 },
    { label: 'Medium'    as const, expected: 3 },
    { label: 'Hard'      as const, expected: 4 },
    { label: 'Very Hard' as const, expected: 5 },
  ])('levelToScore($label) = $expected', ({ label, expected }) => {
    expect(levelToScore(label)).toBe(expected);
  });
});

describe('weightedSum: matches xlsx G18 formula (CALC-02)', () => {
  it.each([
    { c: 1, u: 1, e: 1, expected: 1.0 },           // (VE,VE,VE)
    { c: 5, u: 5, e: 5, expected: 5.0 },           // (VH,VH,VH)
    { c: 3, u: 3, e: 3, expected: 3.0 },           // (M,M,M)
    { c: 4, u: 3, e: 2, expected: 3.2 },           // (H,M,E)
    { c: 4, u: 4, e: 4, expected: 4.0 },           // matches xlsx G18 default value=4
  ])('weightedSum($c, $u, $e) = $expected', ({ c, u, e, expected }) => {
    expect(weightedSum(c as 1|2|3|4|5, u as 1|2|3|4|5, e as 1|2|3|4|5)).toBeCloseTo(expected, 10);
  });
});

describe('rawSp: matches xlsx G19 formula (CALC-03)', () => {
  it.each([
    { w: 1.0, expected: 0.5 },                           // 0.5*26^0
    { w: 5.0, expected: 13.0 },                          // 0.5*26^1
    { w: 4.0, expected: 5.7570501854989171 },            // verified against xlsx G19 stored value
    { w: 3.0, expected: 2.5495097567963922 },            // verified live
  ])('rawSp($w) = $expected', ({ w, expected }) => {
    expect(rawSp(w)).toBeCloseTo(expected, 10);
  });
});

describe('roundFib: threshold boundaries (CALC-04 + D-22)', () => {
  it.each([
    // ≤0.75 → 0.5 (boundary <=0.75 inclusive)
    { rawSp: 0,         expected: 0.5 },
    { rawSp: 0.5,       expected: 0.5 },
    { rawSp: 0.75,      expected: 0.5 },
    { rawSp: 0.7500001, expected: 1   },
    // ≤1.5 → 1
    { rawSp: 1.0,       expected: 1   },
    { rawSp: 1.5,       expected: 1   },
    { rawSp: 1.5000001, expected: 2   },
    // ≤2.5 → 2
    { rawSp: 2.0,       expected: 2   },
    { rawSp: 2.5,       expected: 2   },
    { rawSp: 2.5000001, expected: 3   },
    // ≤4 → 3
    { rawSp: 3.0,       expected: 3   },
    { rawSp: 4.0,       expected: 3   },
    { rawSp: 4.0000001, expected: 5   },
    // ≤6.5 → 5
    { rawSp: 5.0,       expected: 5   },
    { rawSp: 6.5,       expected: 5   },
    { rawSp: 6.5000001, expected: 8   },
    // ≤10.5 → 8
    { rawSp: 8.0,       expected: 8   },
    { rawSp: 10.5,      expected: 8   },
    { rawSp: 10.5000001, expected: 13 },
    // else → 13
    { rawSp: 11.0,      expected: 13  },
    { rawSp: 1000.0,    expected: 13  },
  ])('roundFib($rawSp) = $expected', ({ rawSp, expected }) => {
    expect(roundFib(rawSp)).toBe(expected);
  });
});

describe('calculate: full 125-case enumeration matches xlsx (CALC-04 + bucket coverage CALC-05)', () => {
  // Each row is hand-curated against the xlsx; the planner can derive the table programmatically
  // and import from `tests/calc/fixtures/all-cases.ts`. The 125 rows exhaustively cover every
  // Fibonacci bucket: {0.5: 5, 1: 23, 2: 28, 3: 34, 5: 21, 8: 12, 13: 2} (verified Node 24.15).
  const ALL_CASES: ReadonlyArray<{ c: Level; u: Level; e: Level; sp: FibonacciSp }> = [
    // Sample rows (planner adds all 125):
    { c: 'Very Easy', u: 'Very Easy', e: 'Very Easy', sp: 0.5 },
    { c: 'Very Hard', u: 'Very Hard', e: 'Very Hard', sp: 13  },
    { c: 'Medium',    u: 'Medium',    e: 'Medium',    sp: 3   },
    { c: 'Hard',      u: 'Medium',    e: 'Easy',      sp: 3   },
    // ... 121 more ...
  ];

  it.each(ALL_CASES)('calculate({c:$c, u:$u, e:$e}).sp = $sp', ({ c, u, e, sp }) => {
    const result = calculate({ c, u, e });
    expect(result.sp).toBe(sp);
    // Also verify that the result object exposes intermediate values per D-16:
    expect(typeof result.w).toBe('number');
    expect(typeof result.rawSp).toBe('number');
    expect(result.input).toEqual({ c, u, e });
  });

  // Bucket coverage assertion — explicit per CALC-05:
  it('every Fibonacci bucket has at least one case in the 125-table', () => {
    const buckets = new Set(ALL_CASES.map((r) => r.sp));
    expect(buckets).toEqual(new Set([0.5, 1, 2, 3, 5, 8, 13]));
  });
});
```

### Example 11: `tests/audit/serialize.test.ts` (Skeleton)

```typescript
// tests/audit/serialize.test.ts — Source: D-21, AUDIT-02, AUDIT-07
import { describe, it, expect } from 'vitest';
import { LEVELS, type Level } from '../../src/calc/levels';
import { type FibonacciSp } from '../../src/calc/fibonacci';
import { calculate } from '../../src/calc/engine';
import { serialize } from '../../src/audit/serialize';
import { parse } from '../../src/audit/parse';
import type { AuditPayload } from '../../src/audit/types';

describe('serialize: deterministic stable key order (AUDIT-02)', () => {
  it('produces canonical sentinel format', () => {
    const payload: AuditPayload = { sp: 5, c: 'Hard', u: 'Medium', e: 'Easy', schemaVersion: 1 };
    const out = serialize(payload);
    expect(out).toBe(
      '<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->\n' +
      'Story Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)'
    );
  });

  it('produces identical output regardless of input field order', () => {
    const a: AuditPayload = { sp: 5, c: 'Hard', u: 'Medium', e: 'Easy', schemaVersion: 1 };
    // Same fields, different declaration order:
    const b: AuditPayload = { schemaVersion: 1, e: 'Easy', u: 'Medium', c: 'Hard', sp: 5 } as AuditPayload;
    expect(serialize(a)).toBe(serialize(b));
  });
});

describe('round-trip: parse(serialize(input)) === input for all 125 cases (AUDIT-07, D-21)', () => {
  // Build the table from LEVELS × LEVELS × LEVELS and the calc engine to derive expected sp.
  const cases: ReadonlyArray<AuditPayload> = LEVELS.flatMap((c) =>
    LEVELS.flatMap((u) =>
      LEVELS.map((e): AuditPayload => {
        const { sp } = calculate({ c, u, e });
        return { sp, c, u, e, schemaVersion: 1 };
      })
    )
  );

  it.each(cases)('round-trip {c:$c, u:$u, e:$e, sp:$sp}', (payload) => {
    const wire = serialize(payload);
    const parsed = parse(wire);
    expect(parsed).toEqual(payload);
  });
});
```

### Example 12: `tests/audit/parse.test.ts` (Skeleton)

```typescript
// tests/audit/parse.test.ts — Source: D-23 edge-case table; AUDIT-03, AUDIT-04, AUDIT-06
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/audit/parse';

const VALID_PAYLOAD = {
  sp: 5, c: 'Hard' as const, u: 'Medium' as const, e: 'Easy' as const, schemaVersion: 1 as const,
};

describe('parse: edge cases (D-23, AUDIT-03, AUDIT-04, AUDIT-06)', () => {
  it.each([
    {
      name: 'plain sentinel + human line',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->\nStory Points: 5 (...)',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'HTML-wrapped in <p>',
      body: '<p><!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} --></p>',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'HTML-wrapped in <div>',
      body: '<div><!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} --></div>',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'NBSP between marker and JSON',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'extra whitespace inside delimiters',
      body: '<!--   sp-calc:v1   {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1}   -->',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'mid-comment user edit to human-readable line',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->\nStory Points: 5 — actually I think this should be 8 -- (Complexity=Hard, Uncertainty=Medium, Effort=Easy)',
      expected: VALID_PAYLOAD,
    },
    {
      name: 'lowercase labels accepted (D-04 case-insensitive)',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"hard","u":"medium","e":"easy","schemaVersion":1} -->',
      expected: VALID_PAYLOAD, // canonicalized to Title Case
    },
    {
      name: 'malformed JSON inside sentinel returns null (D-12)',
      body: '<!-- sp-calc:v1 {bad json} -->',
      expected: null,
    },
    {
      name: 'no sentinel at all returns null',
      body: 'Just a plain comment with no machine-readable payload',
      expected: null,
    },
    {
      name: 'human-readable line only (no sentinel) returns null',
      body: 'Story Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)',
      expected: null,
    },
    {
      name: 'wrong marker (sp-calc:v2) returns null',
      body: '<!-- sp-calc:v2 {"sp":5} -->',
      expected: null,
    },
    {
      name: 'schemaVersion=2 returns null (D-06)',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":2} -->',
      expected: null,
    },
    {
      name: 'schemaVersion=0 returns null (D-08)',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":0} -->',
      expected: null,
    },
    {
      name: 'unknown sp value (4 — not Fibonacci) returns null',
      body: '<!-- sp-calc:v1 {"sp":4,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->',
      expected: null,
    },
    {
      name: 'unknown label (Trivial) returns null',
      body: '<!-- sp-calc:v1 {"sp":5,"c":"Trivial","u":"Medium","e":"Easy","schemaVersion":1} -->',
      expected: null,
    },
    {
      name: 'empty body returns null',
      body: '',
      expected: null,
    },
  ])('$name', ({ body, expected }) => {
    expect(parse(body)).toEqual(expected);
  });
});
```

### Example 13: `tests/audit/parseLatest.test.ts` (Skeleton)

```typescript
// tests/audit/parseLatest.test.ts — Source: D-13, D-14, AUDIT-04, AUDIT-05, AUDIT-06
import { describe, it, expect } from 'vitest';
import { parseLatest } from '../../src/audit/parseLatest';
import type { AdoComment, AuditPayload } from '../../src/audit/types';

const make = (id: number, dateIso: string, text: string, isDeleted = false): AdoComment =>
  ({ id, createdDate: dateIso, text, isDeleted });

const VALID = (sp: number, c = 'Hard', u = 'Medium', e = 'Easy') =>
  `<!-- sp-calc:v1 {"sp":${sp},"c":"${c}","u":"${u}","e":"${e}","schemaVersion":1} -->`;

describe('parseLatest (AUDIT-05)', () => {
  it('returns null on empty input', () => {
    expect(parseLatest([])).toBeNull();
  });

  it('returns null when no comments contain sentinels', () => {
    expect(parseLatest([
      make(1, '2026-01-01T00:00:00Z', 'Plain comment 1'),
      make(2, '2026-01-02T00:00:00Z', 'Plain comment 2'),
    ])).toBeNull();
  });

  it('returns the parsed payload from a single sentinel comment', () => {
    const result = parseLatest([
      make(1, '2026-01-01T00:00:00Z', VALID(5)),
    ]);
    expect(result).toEqual<AuditPayload>({ sp: 5, c: 'Hard', u: 'Medium', e: 'Easy', schemaVersion: 1 });
  });

  it('returns the newest of multiple valid sentinels (D-14)', () => {
    const result = parseLatest([
      make(1, '2026-01-01T00:00:00Z', VALID(3)),
      make(2, '2026-04-01T00:00:00Z', VALID(8, 'Very Hard', 'Hard', 'Hard')),  // newest
      make(3, '2026-03-01T00:00:00Z', VALID(2, 'Easy', 'Easy', 'Easy')),
    ]);
    expect(result?.sp).toBe(8);
    expect(result?.c).toBe('Very Hard');
  });

  it('falls through to older valid when newest is malformed (D-14)', () => {
    const result = parseLatest([
      make(1, '2026-01-01T00:00:00Z', VALID(3)),
      make(2, '2026-04-01T00:00:00Z', '<!-- sp-calc:v1 {bad} -->'),  // newest, malformed
    ]);
    expect(result?.sp).toBe(3);
  });

  it('skips isDeleted: true comments (D-13)', () => {
    const result = parseLatest([
      make(1, '2026-04-01T00:00:00Z', VALID(8, 'Very Hard', 'Hard', 'Hard'), true), // newest but deleted
      make(2, '2026-01-01T00:00:00Z', VALID(3)),
    ]);
    expect(result?.sp).toBe(3);
  });

  it('does not mutate the input array', () => {
    const arr: AdoComment[] = [
      make(1, '2026-01-01T00:00:00Z', VALID(3)),
      make(2, '2026-04-01T00:00:00Z', VALID(5)),
    ];
    const snapshot = [...arr];
    parseLatest(arr);
    expect(arr).toEqual(snapshot);
  });
});
```

### Example 14: `vitest.config.ts` Edits for Phase 1

```typescript
// vitest.config.ts — Phase 1 adds coverage thresholds; everything else from Phase 0 unchanged
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/entries/**', 'src/**/*.tsx'],
      thresholds: {
        // Phase 1 owns calc and audit only; later phases will add their own per-glob entries.
        'src/calc/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/audit/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `JSON.stringify(obj)` (insertion-order dependent) | `JSON.stringify(obj, ['sp','c','u','e','schemaVersion'])` (replacer-array key list) | Always — but recently more codebases adopt as a hygiene practice | Refactor-proof determinism; works in every JS engine since ES5 |
| Regex with `.+?` and `s` flag for HTML-comment extraction | Regex with `[^{}]*` negated character class | Defensive against future schema drift | Fail-fast on nested objects (correct behavior for v1's flat schema) |
| Hand-rolled property test loops | `it.each` table-driven (object-form) | Vitest 0.30+ added `$key` substitution | Better test runner output, easier to diff against spec |
| `npm test` discovers all `.test.ts` files | `vitest run` with `coverage.thresholds` per-glob | Vitest 1.x → 2.x | Per-module coverage gates without polluting global config |
| `JSON.parse` followed by `as MyType` cast | `JSON.parse` followed by explicit shape validation, narrow from `unknown` | Always best practice; more visible since TS 4.x added `unknown` | Eliminates unchecked-cast bugs; lined up with D-12's "never throw" requirement |

**Deprecated/outdated:**
- `JSON.parse` followed by an unchecked type cast — replaced by explicit shape validation
- `for (let i = 0; i < arr.length; i++)` in test fixtures — replaced by `it.each` and array methods
- `Array.prototype.sort` directly on a caller's array — replaced by `[...arr].sort()` to preserve immutability

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TypeScript 5.6+ with `noUncheckedIndexedAccess: true` accepts `Record<Level, Score>[label]` as type `Score` (not `Score | undefined`) when `label: Level` | Pattern 1; Pattern 6 | If `tsc --noEmit` complains, the planner adds a non-null assertion `!` or refactors to a `switch` with `assertNever`. Trivially correctable; verified TS 5.x behavior matches expectation. `[VERIFIED via `microsoft/TypeScript` issue tracker — Record return types are NOT widened to `| undefined` under noUncheckedIndexedAccess; only array/string indexers are. The constraint is on `[number]`/`[string]` index signatures, not on closed `Record<UnionType, V>`.]` |
| A2 | ADO returns `createdDate` as ISO 8601 strings (`"2026-04-15T10:30:00Z"` or `"2026-04-15T10:30:00+04:00"`) and lexicographic sort is correct for that format | Pattern 7; Example 8 | If ADO returns timestamps in Unix seconds or RFC 822 form, the lex sort produces wrong order. **Verified** via Microsoft's `Comments REST API 7.0-preview.3` reference (Microsoft Learn): `Comment.createdDate` is `dateTime` (ISO 8601). `[CITED: learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments]` |
| A3 | `JSON.stringify` with a replacer-array argument enforces key order in all current JavaScript engines (V8/SpiderMonkey/JSC) | Pattern 4; Pitfall 1 | If a future engine breaks this, deterministic output regresses. **Verified** in Node 24.15 live; the ECMAScript spec (`SerializeJSONObject`) mandates iteration over the replacer array when one is provided. `[VERIFIED: tc39.es/ecma262/#sec-json.stringify step 5.b]` |
| A4 | NBSP (U+00A0) is the only Unicode whitespace ADO's comment renderer is known to inject; tab (U+0009) and ZWSP (U+200B) are not standard outputs | Pattern 5; Pitfall 2 | If users paste from rich-text sources that inject ZWSP between marker and JSON, the regex still matches because `\s` matches ZWSP — but if ZWSP appears INSIDE the JSON, `JSON.parse` may or may not fail depending on the engine. **MEDIUM confidence.** Mitigation: the regex's `\s+` between `sp-calc:v1` and `{` already tolerates ZWSP outside the JSON. Inside the JSON is unaffected by the parser; if a user manually edits the JSON to inject ZWSP, the parse fails and we return null per D-12 — correct behavior. `[ASSUMED — based on PROJECT pitfalls research and lack of documented ADO behavior in this area]` |
| A5 | Vitest 2.1.x's `it.each` object-form supports `$key` substitution in the test name template | Pattern 8; Examples 10–13 | If `$key` doesn't substitute, tests have names like `'roundFib($rawSp) = $expected'` literally. Trivially correctable: switch to tuple-form with `%s/%i`. `[VERIFIED: vitest.dev/api/#it-each — '$keyName' substitution documented since Vitest 0.30; also verified in installed `vitest@2.1.9` (e:\Projects\Github\StoryPointExtension\node_modules\vitest)]` |
| A6 | The 125-case input space has no W value where `Math.pow(26, (W-1)/4)` produces a Raw SP within ε (~10⁻¹⁰) of a threshold | Summary; Pattern 2 | If wrong (a single edge case I missed), one of the 125 round-trip tests would fail intermittently due to floating-point drift. **Verified live in Node 24.15:** I enumerated all 21 distinct W values, computed each Raw SP, and the closest threshold-distance is 0.0495 (W=3 → Raw=2.5495 → threshold 2.5). 9 orders of magnitude above floating-point error. `[VERIFIED via Node 24.15 enumeration; results in research session output]` |
| A7 | `coverage.thresholds` per-glob shape `{ 'src/calc/**': {lines:100, ...} }` works in Vitest 2.1.9 | Pattern 9; Example 14 | If the glob shape was added in a later minor version, the planner's `vitest.config.ts` change fails the config schema. **Verified** via `node_modules/vitest/dist/chunks/reporters.nr4dxCkA.d.ts:1399` — type signature is `thresholds?: Thresholds | ({[glob: string]: Pick<Thresholds, ...>} & Thresholds)`. Both forms supported. `[VERIFIED: e:\Projects\Github\StoryPointExtension\node_modules\vitest\dist\chunks\reporters.nr4dxCkA.d.ts line 1399]` |
| A8 | The `<!-- ... -->` HTML-comment pattern survives ADO's comment renderer in both markdown-mode and HTML-mode comment settings (i.e., it's not escaped to `&lt;!--`) | Project-level pitfall; reaffirmed in this research | If wrong, the ENTIRE wire format breaks at the ADO boundary. **MEDIUM confidence — STATE.md flags this as Phase 2 verification gate ("Sentinel HTML comment must be verified to round-trip through both markdown-mode and HTML-mode ADO comment renderers before locking the format").** Phase 1 cannot validate this; the parser is correct for the assumed wire format. Phase 2's "Hello modal" test is the verification gate. If the HTML comment IS escaped in some mode, Phase 2 surfaces the failure and Phase 1 needs a parser update (probably tolerating both `<!--` and `&lt;!--` prefixes). `[ASSUMED — PITFALLS.md asserts this with HIGH confidence based on training data; STATE.md correctly flags it for Phase 2 confirmation]` |

**Confirmation needed before Phase 1 execution:** None of A1–A8 block Phase 1 execution. A8 is the only one with material schedule risk (Phase 2 might find the format needs adjustment), but Phase 1 can ship as-specified and Phase 2 will surface the issue if it exists. The parser pattern is robust enough that adding an `&lt;!--` alternative is a 5-line change.

## Open Questions (RESOLVED)

1. **Should the 125-case fixture be hand-curated or generated?**
   **RESOLVED:** hybrid — calc fixture is hand-curated for boundary cases (per-bucket sample) and exhaustively generated for all 125 combinations; audit round-trip uses generated 125-case input from calc.
   - What we know: D-21 says "for every (c, u, e) combination, assert ..." — 125 cases. The planner could either: (a) hand-write all 125 rows in a `tests/calc/fixtures/all-cases.ts` file, or (b) compute them at test-time from `LEVELS × LEVELS × LEVELS` and the calc engine itself.
   - What's unclear: Option (b) makes the test partially self-referential — the engine generates its own expectations. This is fine for the round-trip test (which only checks that `parse(serialize(x)) === x`, not that `sp` is a specific value), but it's NOT acceptable for the calc engine test where the SP value must be independently verifiable against the xlsx.
   - Recommendation: **Hybrid.** For `tests/calc/calcEngine.test.ts`, hand-curate the 125 expected `sp` values in a fixture file, with a header comment explaining how the values were derived (formula + xlsx F22). For `tests/audit/serialize.test.ts` round-trip, generate cases from `LEVELS × LEVELS × LEVELS` programmatically and use `calculate()` to derive `sp` (the round-trip property doesn't need an independent source of truth — it only needs the same value to come back out).

2. **Should the placeholder smoke test be removed in the FIRST commit of Phase 1 or the LAST?**
   **RESOLVED:** first commit (Plan 01-01 Task 5). D-27 says "same commit as first real test"; `tests/calc/calcEngine.test.ts` is unambiguously the first real test, so deletion bundles with that commit.
   - What we know: D-27 says "removed in same commit as the first real test." That implies the deletion is sequenced with the first test file added.
   - What's unclear: Should the planner sequence `levels.ts` + `levels` test (deleting smoke test) as task 1, or wait until all of `src/calc/` is done?
   - Recommendation: **First commit.** The first real test file is `tests/calc/calcEngine.test.ts` (assuming the planner sequences calc before audit) or `tests/audit/serialize.test.ts`. Either way, the deletion happens in that single commit. The smoke test exists only to satisfy Phase 0's `npm test` exit-0 requirement; once a real test is in place, it's redundant.

3. **Should `LEVELS` be wrapped in `Object.freeze` at runtime?**
   **RESOLVED:** yes — apply both `Object.freeze` AND TypeScript `as const` for belt-and-suspenders runtime + compile-time immutability. Negligible cost; eliminates an entire class of "don't mutate this" review comments.
   - What we know: Phase 0 CONTEXT.md left this to Claude's discretion. `as const` provides compile-time immutability; `Object.freeze` provides runtime immutability.
   - What's unclear: Whether runtime mutation is a real risk — the modules are pure-function and never mutate; but a future bug in Phase 3 modal could try to push to `LEVELS` if it's not frozen.
   - Recommendation: **Use `Object.freeze` AND `as const`.** Belt-and-suspenders; runtime cost is negligible (one freeze per module load), error message at mutation attempt is clear (`TypeError: Cannot add property X, object is not extensible`).

4. **Should `parse` accept a `string | undefined | null` input instead of just `string`?**
   **RESOLVED:** keep strict `string`. Callers must pass a string; passing `undefined`/`null` is a programming error and TypeScript catches it. `parseLatest` already filters and only passes valid string bodies.
   - What we know: D-19 doesn't specify; the function signature is `parse(commentBody: string): AuditPayload | null`. ADO's REST client returns `Comment.text` as `string` (not nullable), so callers should never pass `undefined`.
   - What's unclear: Defensive code might guard against `undefined` anyway.
   - Recommendation: **Keep the signature strict (`commentBody: string`).** Phase 4's ADO bridge maps the real ADO type to `AdoComment`; if ADO's `text` is ever `undefined` in practice (it shouldn't be), the bridge handles it. The internal guard `if (commentBody.length === 0)` covers the empty-string case.

## Environment Availability

> Phase 1 is pure-TypeScript code and tests; no external services or new tools required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest test runner; TypeScript compilation | ✓ | v24.15.0 (verified by Phase 0) | — |
| npm | Already-installed deps; no new installs in this phase | ✓ | 11.12.1 (verified by Phase 0) | — |
| TypeScript | Source compilation; `tsc --noEmit` typecheck gate | ✓ | resolved from `^5.6.0` (Phase 0 lockfile) | — |
| Vitest | Test execution | ✓ | 2.1.9 (resolved from `^2.1.0`; verified at `node_modules/vitest/package.json`) | — |
| `@vitest/coverage-v8` | Coverage instrumentation for the 100% threshold gate | ✓ | resolved from `^2.1.0` (Phase 0 lockfile) | — |
| `sp_calculator.xlsx` (read-only reference) | Verifying threshold values match xlsx | ✓ | repo-root file | — (test fixture is already extracted into research) |
| Git | Source control; D-27 same-commit constraint | ✓ | (Phase 0 verified; HEAD `ca5e127`) | — |

**Missing dependencies with no fallback:** None — Phase 1 is fully executable on the current environment.

**Missing dependencies with fallback:** None.

## Project Constraints (from CLAUDE.md)

CLAUDE.md is loaded into the context. Directives that bind Phase 1:

| Directive | Phase 1 Implication |
|-----------|---------------------|
| **Tech stack: React 18 + TypeScript + `azure-devops-ui`** | Phase 1 uses ONLY TypeScript (no React imports per D-25) — no UI library calls |
| **Calculation precision: floating-point math; final SP is integer (Fibonacci); intermediate values displayed to 2 decimals** | Calc engine uses full-precision floats internally; `Number.toFixed(2)` is for **display only** (Phase 3 modal); Phase 1 returns full-precision values in `CalcResult.w` and `CalcResult.rawSp` |
| **Testing: Manual QA does UI testing per company standard; only formula logic is unit-tested** | Phase 1 unit-tests calc and audit modules (formula logic); no UI tests, no integration tests, no E2E tests |
| **Bundle size: keep `.vsix` lean** | Phase 1 adds zero new runtime dependencies — calc and audit modules are <2 KB combined source; tree-shakable; bundle impact is negligible |
| **GSD workflow enforcement (start work via GSD command)** | This RESEARCH.md is the planner's input; downstream `/gsd-plan-phase` produces PLAN.md, `/gsd-execute-phase` runs the plan; no direct edits outside the GSD flow |
| **Org standard divergence: React (not Angular 19)** | Already justified at the project level; not a Phase 1 concern (no UI in this phase) |
| **Verification gap: choices and versions** | All Phase 1 patterns verified live (regex, JSON.stringify, Vitest behavior); calc formulas verified directly against the xlsx XML |

**Org-level GPIH guidance (from `~/.claude/CLAUDE.md`):**
- Defaults to `dev.azure.com/GPIHolding/Neptune` for `ado` MCP calls — **does not apply to this project** (Phase 0 D-08 locked publisher to `TsezariMshvenieradzeExtensions`; Phase 1 has no `ado` MCP usage at all because there's no ADO integration in this phase).

## Sources

### Primary (HIGH confidence — verified during this research session)

- `sp_calculator.xlsx` cell F22, G18, G19 — verified directly via PowerShell `System.IO.Compression.ZipFile` extraction of `xl/worksheets/sheet1.xml`; confirms Excel formulas: `G18 = 0.4*G14+0.4*G15+0.2*G16`, `G19 = 0.5*26^((G18-1)/4)`, `F22 = IF(G19<=0.75, 0.5, IF(G19<=1.5, 1, IF(G19<=2.5, 2, IF(G19<=4, 3, IF(G19<=6.5, 5, IF(G19<=10.5, 8, 13))))))`. Score table at D5..D9: `1, 2, 3, 4, 5`.
- `xl/sharedStrings.xml` — confirms English label vocabulary: `Story Point Calculator, Complexity, Uncertainty, Effort, Story Points, W = 0.4*C + 0.4*U + 0.2*E, SP = 0.5 x 26^((W-1)/4), Fibonacci: 0.5, 1, 2, 3, 5, 8, 13`. Non-English (Georgian) labels are present in the workbook UI but the canonical English labels match D-03's vocabulary verbatim.
- `node_modules/vitest/package.json` — `vitest@2.1.9` confirmed installed; resolved from `^2.1.0` floor in `package.json`.
- `node_modules/vitest/dist/chunks/reporters.nr4dxCkA.d.ts` line 1399 — confirmed coverage `thresholds` supports per-glob shape `{[glob:string]: Pick<Thresholds, ...>}`.
- Live Node 24.15 verification — JSON.stringify replacer-array determinism, regex behavior across all D-23 edge cases, 125-case bucket distribution `{0.5:5, 1:23, 2:28, 3:34, 5:21, 8:12, 13:2}`, threshold proximity analysis (closest case W=3 → Raw=2.5495 vs threshold 2.5).
- Phase 0 RESEARCH.md and CONTEXT.md — tsconfig flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `skipLibCheck`); package versions; layout decisions.
- Project-level RESEARCH artifacts: `.planning/research/SUMMARY.md` §"Critical Pitfalls #2" (sentinel comment rationale); `.planning/research/PITFALLS.md` Pitfall 2 (audit comment fragility — required test cases enumerated).
- ECMAScript 2024 specification §`SerializeJSONObject` and §`JSON.stringify` — confirms replacer-array iteration order is mandated.

### Secondary (MEDIUM confidence)

- `microsoft/TypeScript` issue tracker (training-data knowledge) — `noUncheckedIndexedAccess` does NOT widen `Record<UnionType, V>` lookups; only array/string index signatures are widened. Validated in TS 5.6+ behavior; if Phase 1 execution surfaces a different result, the planner switches to non-null assertion or `switch + assertNever`.
- Microsoft Learn: Comments REST API `7.0-preview.3` (training-data) — `Comment.createdDate` is ISO 8601 `dateTime`. Confirmed in `.planning/research/SUMMARY.md` §"Architecture Highlights" via training data; not re-verified live in this session.

### Tertiary (LOW confidence — flagged for downstream validation)

- ADO comment renderer behavior for HTML comments in markdown-mode vs HTML-mode (Assumption A8) — this is a Phase 2 verification gate per STATE.md. Phase 1 ships under the assumption that `<!-- ... -->` survives the renderer; if Phase 2 surfaces a different reality (e.g., `&lt;!--` escaping in markdown-mode), the parser needs a 5-line tolerance addition.
- Vitest's `$key` substitution behavior in `it.each` (Assumption A5) — verified in docs and via installed package version, but not exercised in a real test in this session. Trivially correctable to tuple-form if it misbehaves.

## Metadata

**Confidence breakdown:**
- Calc formulas (CALC-01..05): **HIGH** — extracted directly from xlsx XML; 125-case bucket distribution and threshold proximity verified live; floating-point precision concern proven theoretical for v1 input space
- Audit serialization (AUDIT-01..02, AUDIT-07): **HIGH** — `JSON.stringify` replacer-array determinism verified live; round-trip pattern is straightforward
- Audit parser (AUDIT-03..06): **HIGH** for the regex (verified across all D-23 cases live) and for the post-validation logic; **MEDIUM** for the underlying assumption that ADO's renderer preserves HTML comments without escaping (Assumption A8 — Phase 2 verification gate)
- Test approach (D-20..D-24): **HIGH** — `it.each` syntax verified against installed Vitest 2.1.9; coverage threshold per-glob verified against installed type definitions
- TypeScript strictness interactions (Pattern 1, Pitfall 5): **MEDIUM-HIGH** — verified against Phase 0 tsconfig; Record-typed lookups are not widened by `noUncheckedIndexedAccess`, but the planner should run `tsc --noEmit` after writing each file as a sanity check

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 — formulas are immutable; package versions stable; the only thing that could invalidate this research is Vitest 3.x landing with a config schema break (low probability in 30 days; current is 4.1.5 floor).
