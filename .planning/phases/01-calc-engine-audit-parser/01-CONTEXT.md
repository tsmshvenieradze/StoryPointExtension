# Phase 1: Calc Engine & Audit Parser - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Lock the wire formats — calculation behavior matching `sp_calculator.xlsx` exactly, and the sentinel comment format that survives ADO's renderer — before any ADO surface is touched. Two pure modules, fully unit-tested.

In scope:
- `src/calc/` — pure functions implementing the Excel formula pipeline (level→score, weighted sum W, Raw SP, Fibonacci rounding) with zero ADO SDK dependencies
- `src/audit/` — pure serializer/parser for the sentinel HTML-comment audit-log payload with zero ADO SDK dependencies
- Type definitions exported from each module (used by Phase 3 modal UI and Phase 4 ADO bridge)
- Vitest unit tests covering every Fibonacci bucket, every threshold boundary against the xlsx, every parser edge case (HTML wrapping, NBSP, deleted, malformed, multi-comment)
- Round-trip property test: `parse(serialize(input)) === input`

Out of scope (later phases own these):
- React UI / dropdowns / modal layout (Phase 3)
- FieldResolver and ADO bridge (Phases 3–4)
- Toolbar contribution / SDK init / iframe coordination (Phase 2)
- Marketplace publish concerns (Phase 5)
- Webpack bundling integration (already scaffolded in Phase 0; Phase 1 adds source files only — bundle is built but not deployed)

</domain>

<decisions>
## Implementation Decisions

### Sentinel JSON Payload
- **D-01:** **Labels (strings) for c/u/e fields, not scores.** Wire format: `<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->` plus the human-readable line. Symmetric with the human-readable summary; locale-independent at the JSON level (English canonical labels); parser maps label→score on read. Reduces ambiguity for downstream agents that may eyeball the payload during debugging.
- **D-02:** **Sentinel JSON shape is exactly:** `{"sp": number, "c": string, "u": string, "e": string, "schemaVersion": 1}`. Field order is fixed: `sp, c, u, e, schemaVersion`. Serializer uses stable key order. No extra whitespace inside the sentinel block. No trailing comma.

### Canonical Label Vocabulary (v1, locked)
- **D-03:** **Title Case with spaces** for all five levels: `Very Easy`, `Easy`, `Medium`, `Hard`, `Very Hard`. Map to scores `1, 2, 3, 4, 5` respectively. These are the *only* valid label values for v1.
- **D-04:** **Parser is case-insensitive on read** (accepts `hard`, `HARD`, `Hard`) but **always serializes Title Case**. This protects against user-edited human-readable lines drifting into the JSON; the JSON is the source of truth so it's stricter, but reading is forgiving since v1 has no UI for editing the JSON.
- **D-05:** **Map and reverse-map are exposed in the public API** as constants: `LEVELS` (ordered array of 5 labels), `LEVEL_TO_SCORE` (record), `SCORE_TO_LEVEL` (record). Phase 3 modal UI imports `LEVELS` for dropdown options.

### Parser Forward-Compatibility Policy
- **D-06:** **`schemaVersion > 1` is skipped silently.** Parser treats unknown-future-version sentinels as if they were absent. Modal opens empty. Forward-incompatible by design for v1.
- **D-07:** **Rationale:** v2 introduces configurable dimensions, weights, and labels. A v2-written sentinel may have variable shape (different keys, different cardinality) that v1's parser cannot meaningfully interpret. Best-effort extraction risks showing stale data with the wrong dimensions assigned to wrong meanings. Silent skip is honest; users can rewrite the SP via the v1 modal.
- **D-08:** **`schemaVersion < 1` is also skipped** (defense against legacy/test data with explicit `0`). Parser only accepts `schemaVersion === 1` for v1.

### Parser Strictness on Sentinel Match
- **D-09:** **Sentinel pattern is anchored:** `<!-- sp-calc:v1 ` followed by JSON object followed by ` -->`. The `sp-calc:v1` marker is the trigger; without exact match, the comment is not a sentinel.
- **D-10:** **HTML-wrapped tolerance:** when ADO's renderer wraps the comment body (e.g., `<p><!-- sp-calc:v1 {...} --></p>`), the parser strips outer HTML before searching. Implementation: regex matches the sentinel inside any surrounding text/markup.
- **D-11:** **NBSP and whitespace tolerance:** parser normalizes Unicode ` ` (NBSP) to regular space before matching, and tolerates extra whitespace inside the sentinel JSON (the JSON parser handles this naturally; the sentinel anchor pattern uses `\s+` between marker and JSON if needed).
- **D-12:** **Malformed JSON inside sentinel:** treat as not-a-sentinel. Return `null` from parser; never throw. The sentinel marker survived but the payload didn't, so we cannot trust any of it.
- **D-13:** **`isDeleted: true` comments:** filtered out before parsing.
- **D-14:** **Multiple sentinels on one work item:** parser sorts by `createdDate` (most recent first) and returns the newest valid one. If the newest is malformed (D-12) but an older one is valid, parser falls through to the older one.

### Calc Engine Public API
- **D-15:** **Exported functions** (`src/calc/index.ts`):
  - `calculate(input: CalcInput): CalcResult` — top-level pipeline (the function the modal will call)
  - `levelToScore(label: Level): Score` — exposed for direct testing and Phase 3 dropdown wiring
  - `weightedSum(c: Score, u: Score, e: Score): number` — exposed for displaying W in the modal
  - `rawSp(w: number): number` — exposed for displaying Raw SP in the modal
  - `roundFib(rawSp: number): FibonacciSp` — exposed for testing thresholds individually
  - Type exports: `Level`, `Score`, `FibonacciSp`, `CalcInput`, `CalcResult`
- **D-16:** **`CalcInput`** = `{ c: Level; u: Level; e: Level }`. **`CalcResult`** = `{ w: number; rawSp: number; sp: FibonacciSp; input: CalcInput }`. Modal shows `result.w` to 2 decimals, `result.rawSp` to 2 decimals, and `result.sp` as the final integer/0.5.
- **D-17:** **`Level`** is a TypeScript string literal union: `'Very Easy' | 'Easy' | 'Medium' | 'Hard' | 'Very Hard'`. **`Score`** is `1 | 2 | 3 | 4 | 5`. **`FibonacciSp`** is `0.5 | 1 | 2 | 3 | 5 | 8 | 13`. Type exhaustiveness eliminates whole classes of bugs at compile time.

### Audit Module Public API
- **D-18:** **Exported functions** (`src/audit/index.ts`):
  - `serialize(payload: AuditPayload): string` — produces the full sentinel comment block (HTML comment + newline + human-readable line)
  - `parse(commentBody: string): AuditPayload | null` — extracts payload from a single comment body, returns `null` if not a valid sentinel
  - `parseLatest(comments: AdoComment[]): AuditPayload | null` — filters non-deleted comments, parses each, returns the most recent valid one (D-14)
  - Type exports: `AuditPayload`, `AdoComment`
- **D-19:** **`AuditPayload`** = `{ sp: FibonacciSp; c: Level; u: Level; e: Level; schemaVersion: 1 }`. **`AdoComment`** = `{ id: number; text: string; createdDate: string; isDeleted?: boolean }` — minimal shape that matches the ADO REST `WorkItemComment` type without importing `azure-devops-extension-api` (zero-deps requirement). Phase 4 will pass a slice of the real ADO type.

### Test Approach
- **D-20:** **Table-driven vitest** using `it.each(table)`. Hand-curated tables map directly to `sp_calculator.xlsx` rows so a manual QA can read tests like a spec. No `fast-check` / property-based testing in v1 — adds learning curve and dep weight without proportional value for a 5-level × 5-level × 5-level finite input space.
- **D-21:** **Round-trip property covered by an explicit table test:** for every (c, u, e) combination, assert `parse(serialize({c,u,e,sp,schemaVersion:1})) === {c,u,e,sp,schemaVersion:1}` (REQUIREMENTS AUDIT-07). 125 cases — exhaustive.
- **D-22:** **Threshold boundary coverage:** explicit tests for each Fibonacci threshold edge — 0.75, 1.5, 2.5, 4.0, 6.5, 10.5 — testing both ≤ and > sides. Plus one test per documented xlsx row (sample of representative inputs).
- **D-23:** **Parser edge-case table:** HTML-wrapped (`<p>...</p>`), NBSP-substituted, comment with `isDeleted: true`, malformed JSON inside sentinel, comment without sentinel, multiple sentinels (newest wins), `schemaVersion: 0`, `schemaVersion: 2`, completely empty comment, comment that only has the human-readable line (no sentinel) — all return null or correctly extract.
- **D-24:** **Test file layout:** `tests/calc/calcEngine.test.ts`, `tests/audit/serialize.test.ts`, `tests/audit/parse.test.ts`, `tests/audit/parseLatest.test.ts`. Mirrors `src/` structure for readability.

### Phase 1 Scope Boundaries (clarifications)
- **D-25:** **No React imports anywhere in `src/calc/` or `src/audit/`.** Zero browser-only APIs (no `window`, `document`, `crypto`). Pure TypeScript that runs in Node and the browser.
- **D-26:** **No `azure-devops-extension-sdk` or `azure-devops-extension-api` imports.** The `AdoComment` type in `src/audit/` is a structural type defined locally — Phase 4 maps the real ADO type to this shape.
- **D-27:** **The placeholder `tests/smoke.test.ts` from Phase 0 is removed in Phase 1** once real tests exist. Remove in the same commit that adds `tests/calc/calcEngine.test.ts`.

### Claude's Discretion
- File naming inside `src/calc/` and `src/audit/` (single `index.ts` vs split files) — planner decides; lean toward split for readability (`engine.ts`, `levels.ts`, `fibonacci.ts` in `src/calc/`; `serialize.ts`, `parse.ts`, `types.ts` in `src/audit/`) since the modules each have several distinct responsibilities.
- Internal helper naming/extraction — planner decides.
- Whether to use `Object.freeze` on the `LEVELS` constant — planner decides; harmless either way.
- Whether the parser uses a single regex or multiple passes — planner decides; either works given the test coverage in D-23.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value, requirements, locked decisions including sentinel format and atomicity ordering.
- `.planning/REQUIREMENTS.md` §Calc, §Audit — CALC-01..CALC-05 (5 reqs) and AUDIT-01..AUDIT-07 (7 reqs) — the 12 requirements covered by this phase.
- `.planning/ROADMAP.md` §Phase 1 — Goal and 5 success criteria that gate phase completion.

### Calculation source of truth
- `sp_calculator.xlsx` (repo root) — Reference. The calc engine MUST exactly match this for every (c, u, e) combination. Specifically the Fibonacci threshold table at row F22:G22.

### Research artifacts (project-level + Phase 0)
- `.planning/research/SUMMARY.md` §Critical Pitfalls #2 — Sentinel comment format rationale and required parser test cases (HTML-wrapped, NBSP, deleted, multi-comment, malformed JSON).
- `.planning/research/PITFALLS.md` Pitfall 2 — Audit comment fragility analysis. The required round-trip test (D-21) and the parser edge-case suite (D-23) implement the mitigations from this pitfall.

### Phase 0 artifacts (locked decisions carry forward)
- `.planning/phases/00-bootstrap-prerequisites/00-CONTEXT.md` D-05/D-06/D-07 — repo layout (flat src/ with subfolders, single package.json, single tsconfig.json with strict + skipLibCheck + noUncheckedIndexedAccess + exactOptionalPropertyTypes from Phase 0 RESEARCH).
- `.planning/phases/00-bootstrap-prerequisites/00-RESEARCH.md` Code Examples §tsconfig — strict flags Phase 1's pure-TS modules MUST honor.
- `.planning/phases/00-bootstrap-prerequisites/00-01-SUMMARY.md` — what was scaffolded; Phase 1's tests rely on the existing `vitest.config.ts` and the placeholder `tests/smoke.test.ts` is replaced (D-27).

### External
- Microsoft Learn: Comments REST API `7.0-preview.3` — only relevant to Phase 4; included here for completeness because the `AdoComment` structural type in `src/audit/` mirrors this shape.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/entries/{toolbar,modal}.tsx`** — Placeholder stubs from Phase 0. Will be filled in Phase 2 (toolbar) and Phase 3 (modal). Phase 1 doesn't touch them.
- **`tests/smoke.test.ts`** — One-line placeholder asserting `1 + 1 === 2`. Removed in Phase 1 once real tests exist (D-27).
- **`vitest.config.ts`** — Already configured with v8 coverage, excludes `*.tsx`, points at `tests/`. Phase 1 reuses without modification.
- **`tsconfig.json`** — Strict-plus settings already locked (Phase 0): `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `skipLibCheck`. Phase 1's modules MUST compile under these.

### Established Patterns
- **Single package layout** (Phase 0 D-07) — no workspaces / project references. All code under `src/`, all tests under `tests/`.
- **`.gitkeep`** files in `src/{calc,audit,field,ado,ui}/` — replaced by real files when each phase populates the directory.

### Integration Points
- **Phase 1 → Phase 3:** Modal UI imports `calculate`, `LEVELS`, `Level`, `CalcResult` from `src/calc/`; imports `parse`, `serialize`, `AuditPayload` from `src/audit/`.
- **Phase 1 → Phase 4:** ADO bridge maps the real ADO `Comment` type (from `azure-devops-extension-api`) into the structural `AdoComment` shape exported from `src/audit/types.ts` before passing to `parseLatest`.
- **No upstream integration in Phase 1** — both modules are pure functions with TypeScript-only inputs. They depend only on the standard library.

</code_context>

<specifics>
## Specific Ideas

- **The xlsx Fibonacci threshold table (F22):** `IF(G19<=0.75, 0.5, IF(G19<=1.5, 1, IF(G19<=2.5, 2, IF(G19<=4, 3, IF(G19<=6.5, 5, IF(G19<=10.5, 8, 13))))))`. Encode as a sorted array of `[threshold, value]` tuples or a switch expression — either way the planner must list all six thresholds explicitly so manual QA can diff against the xlsx.
- **NBSP normalization:** specific Unicode codepoint to handle is ` ` (non-breaking space) — sometimes inserted by ADO's rich-text comment editor. Replace globally with regular space before regex matching.
- **The exact human-readable line format** (REQUIREMENTS.md AUDIT-01): `Story Points: N (Complexity=Hard, Uncertainty=Medium, Effort=Easy)`. Note the dimensions are written in full words (`Complexity`, not `C`) on the human line — only the JSON uses the short keys.

</specifics>

<deferred>
## Deferred Ideas

- **Property-based testing via fast-check** — rejected for v1 (D-20). Reconsider in v2 if the configurable-dimension surface grows beyond what tables can comfortably cover.
- **Locale-aware level labels** — out of scope. v1 is English-only (PROJECT.md). v2 customization may add custom labels but those become part of the configurable schema, not the v1 canonical labels.
- **Multi-step calc explanation UI** — Phase 3 owns the visual rendering of W, Raw SP, formula. Phase 1 only exposes the values via the typed `CalcResult` shape.
- **Migration tooling for v2 schema** — out of scope. v1 parser drops `schemaVersion > 1` silently (D-06); a future v2 migration phase decides whether to migrate v1 sentinels in place or just leave them.
- **Performance benchmarking** — calc engine is O(1) and audit parser is O(n) over comments; no benchmarks needed. Reconsider if Phase 4 reveals issues with comment-heavy work items.
- **Removing `tests/smoke.test.ts` immediately** — D-27 says replace it in the same commit that adds the first real calc test. If the planner sequences tests as the very last task, this commit may also delete the smoke file.

</deferred>

---

*Phase: 1-Calc Engine & Audit Parser*
*Context gathered: 2026-05-01*
