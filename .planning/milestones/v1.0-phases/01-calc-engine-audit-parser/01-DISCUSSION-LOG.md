# Phase 1: Calc Engine & Audit Parser - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 1-Calc Engine & Audit Parser
**Areas discussed:** JSON payload shape, Label canonicalization, Schema forward-compat, Test approach

---

## Sentinel JSON Payload Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Labels: `"Hard"`, `"Medium"` etc. | Wire format `{"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1}`. Human-readable, locale-independent at JSON level. Parser maps label→score on read. | ✓ |
| Scores: 1–5 numeric | Wire format `{"sp":5,"c":4,"u":3,"e":2,"schemaVersion":1}`. Compact. Future-customized labels in v2 would need new mapping. | |
| Both: labels + scores nested | Self-documenting, redundant, verbose. | |

**User's choice:** Labels.
**Notes:** Symmetric with the human-readable line; eyeball-debuggable.

---

## Label Canonicalization

| Option | Description | Selected |
|--------|-------------|----------|
| Title Case with spaces | `Very Easy / Easy / Medium / Hard / Very Hard`. Reads naturally; matches azure-devops-ui. | ✓ |
| Hyphenated lower-case | `very-easy / easy / medium / hard / very-hard`. URL-safe; awkward in human-readable line. | |
| Single word lower | `trivial / simple / medium / complex / extreme`. Distinctive but diverges from xlsx semantics. | |

**User's choice:** Title Case with spaces.
**Notes:** Parser is case-insensitive on read but always serializes Title Case (locked in CONTEXT.md D-04).

---

## Schema Forward-Compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| Skip silently, treat as missing | v1 modal opens empty when `schemaVersion > 1`. Forward-incompat by design. | ✓ |
| Best-effort extract sp/c/u/e | Read known fields, ignore unknown. Risks showing stale data if v2 reshapes payload. | |
| Skip + visible warning | Toast: "Newer audit comment we don't understand". Higher UX cost. | |

**User's choice:** Skip silently.
**Notes:** v1 cannot meaningfully interpret v2 payloads (variable dimensions). Honest skip > speculative parse.

---

## Test Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Table-driven vitest | `it.each(table)(...)` with hand-curated boundary tables. Maps directly to xlsx rows; readable for manual QA. | ✓ |
| Property-based via fast-check | Random inputs + invariants. Catches edge cases tables miss. Adds dep + learning curve. | |
| Both — table + property | Strongest coverage; ~20% more test code. | |

**User's choice:** Table-driven vitest.
**Notes:** 5×5×5 = 125 input combinations is finite; tables are exhaustive without property-based machinery.

---

## Claude's Discretion

- File naming inside `src/calc/` and `src/audit/` (single `index.ts` vs split files) — planner decides; lean toward split for readability.
- Internal helper extraction (e.g., `normalizeText`, `extractSentinelPayload`) — planner decides.
- Whether parser uses one regex or multi-pass — planner decides; either works given test coverage.

## Deferred Ideas

- Property-based testing (fast-check) — reconsider in v2 if dimension surface grows.
- Locale-aware level labels — v2 customization concern.
- Visual rendering of W / Raw SP / formula — Phase 3 owns the UI.
- v2 schema migration tooling — separate motion when v2 actually ships.
- Performance benchmarking — not needed at this scale.
