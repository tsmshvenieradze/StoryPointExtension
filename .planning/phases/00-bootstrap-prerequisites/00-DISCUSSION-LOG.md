# Phase 0: Bootstrap & Prerequisites - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 0-Bootstrap & Prerequisites
**Areas discussed:** Atomicity ordering, Repo layout, Extension identity, Dev ADO org + publisher

---

## Atomicity Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Comment-first, then field | Audit trail is sacred — every successful field write has a comment; every comment that exists matches the user's intent. Recommended by ARCHITECTURE.md. | ✓ |
| Field-first, then comment | SP value is the primary outcome. Audit trail is supplementary. Orphan comments are misleading. Recommended by PITFALLS.md. | |
| Field-first + retry comment with toast on fail | Hybrid: field-first, but if comment fails, show user a non-blocking toast with "Retry comment" button. | |

**User's choice:** Comment-first, then field-write.
**Notes:** Treats the audit comment as the canonical source of truth for "this calc was performed by intent X." Acceptable that a successful comment + failed field write leaves the comment "ahead" of the field — the parser pre-fills, the user retries, no harm.

### Follow-up: Retry comment de-dup

| Option | Description | Selected |
|--------|-------------|----------|
| Post a new comment every time | Simple, predictable. Audit log shows two attempts with timestamps. Parser uses most recent sentinel. | ✓ |
| Skip comment if identical to most recent | Cleaner audit log; adds a comparison step. | |
| Edit the existing comment via REST PATCH | Cleanest log but adds API surface and edge cases. | |

**User's choice:** Post a new comment every time.
**Notes:** Multiple retry comments are an audit feature, not a bug. No de-dup logic needed.

---

## Repo Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Flat src/ with subfolders | One package.json. src/calc/, src/audit/, src/field/, src/ado/, src/ui/, src/entries/{toolbar,modal}.tsx. Single tsconfig with strict mode. | ✓ |
| npm workspaces (mini-monorepo) | packages/calc-engine, packages/audit-comment, packages/extension. Pure libs as independent npm packages. More setup overhead. | |
| TypeScript project references | Multiple tsconfig.json files with project references. Faster incremental builds; more config complexity. | |

**User's choice:** Flat src/ with subfolders.
**Notes:** Simplest layout for a single-purpose extension; can be extracted to workspaces later if libs become reusable.

---

## Extension Identity

| Question | User's choice |
|----------|---------------|
| Marketplace publisher | `TsezariMshvenieradzeExtensions` (provided as URL: https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions) |
| Extension ID | `story-point-calculator` |
| License | MIT |
| Display name | Story Point Calculator |

**Notes:** Personal publisher rather than GPIH-branded. The publisher slug `TsezariMshvenieradzeExtensions` is registered case-as-given. Final Marketplace URL: `marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeExtensions.story-point-calculator`.

Originally proposed `Tsezari` / `gpih` / `gpiholding` as publisher options; user provided the actual existing publisher URL, so those alternatives became moot.

---

## Dev ADO Org + Publisher

| Question | User's choice |
|----------|---------------|
| Tsezari publisher account state | Already exists (URL provided) |
| Dev ADO org for Phase 2 testing | `cezari.visualstudio.com/Cezari` (URL provided) |

**Notes:** Both items already exist — eliminates the 24h verification window from the project plan and removes the need to spin up a fresh trial org for Phase 2. CMMI smoke test in Phase 5 still requires a new trial org configured with the CMMI process.

---

## Claude's Discretion

- Exact file naming under `src/calc/`, `src/audit/` (e.g., `index.ts` vs named files) — planner decides per Phase 1 plan.
- Exact webpack config split (single config with multiple entries vs two configs) — planner decides; either works given two HTML entries are required.
- `tsconfig.json` strictness flags beyond `strict: true` — planner decides; lean toward strictest reasonable defaults given calc engine is heavily numeric.
- `.gitignore` contents — standard Node/TypeScript template + `dist/` + `*.vsix` + `.tfx-cache/`.

## Deferred Ideas

- CI/CD pipeline (Azure Pipelines / GitHub Actions) — Phase 5 owns this.
- Bundle-size gate — Phase 5 (PKG-03).
- Telemetry / analytics — out of scope for v1 entirely.
- Localization manifest fields — English-only listing for v1.
- Extracting `calc-engine` and `audit-comment` as standalone npm packages — possible in v2+ if reuse emerges.
- Custom-process SP field rename support — out of scope per PROJECT.md.
