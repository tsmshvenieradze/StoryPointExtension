# Phase 2: Manifest Shell & SDK Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 2-Manifest Shell & SDK Integration
**Areas discussed:** Dev iteration loop, PAT status, Hello payload, Toolbar label, Modal config, Toolbar icon

---

## Dev Iteration Loop

| Option | Description | Selected |
|--------|-------------|----------|
| `tfx publish --share-with cezari` | Build .vsix → publish with PAT, shared to dev org. ~30s/iter. | ✓ |
| Manual upload via Marketplace dashboard | No PAT needed; ~1 min/iter. | |
| Skip dev installs in Phase 2 | Defer integration risk to Phase 3. | |

**User's choice:** `tfx publish --share-with cezari`.
**Notes:** Standard flow. Per-iteration version bump handled via `--rev-version` flag (D-03).

---

## Marketplace PAT Status

| Option | Description | Selected |
|--------|-------------|----------|
| Already have one | Existing PAT with Marketplace (manage) scope. | ✓ |
| Need to create | Create at dev.azure.com/_usersSettings/tokens; ~2 min. | |
| Not sure | Check before Phase 2 execution. | |

**User's choice:** Already have one.
**Notes:** PAT supplied via `--token` flag or `TFX_TOKEN` env var. `.env*` patterns added to `.gitignore` per D-17.

---

## "Hello" Modal Payload

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal text + workItemId | "Story Point Calculator — Hello from Work Item #N". Page surface; theme inheritance via azure-devops-ui chrome. | ✓ |
| Theme inheritance proof (chips) | Above + theme-token color chips for visual confirmation. | |
| Lifecycle log dump | Above + on-screen SDK lifecycle log. | |

**User's choice:** Minimal text + workItemId.
**Notes:** Lifecycle logging happens via `console.log('[sp-calc] ...')` for developer-side debugging only (D-05).

---

## Toolbar Menu Label

| Option | Description | Selected |
|--------|-------------|----------|
| Calculate Story Points | Matches Marketplace display name; reads naturally. | ✓ |
| Calculate SP | Shorter; less obvious to first-time users. | |
| Story Point Calculator | Verb-less; less imperative. | |

**User's choice:** Calculate Story Points.

---

## Modal Configuration Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Just `{ workItemId }` | Modal fetches project/type/field/comments via SDK in Phase 3. | ✓ |
| `{ workItemId, projectId, workItemTypeName }` | Saves Phase 3 SDK round-trips; tighter coupling. | |
| Above + serialized snapshot of SP/comments | Removes Phase 3 read path; risk of stale snapshot. | |

**User's choice:** Just `{ workItemId }`.
**Notes:** Type defined as `CalcSpModalConfig` in `src/ado/types.ts` (D-11) — Phase 3 expands.

---

## Toolbar Action Icon

| Option | Description | Selected |
|--------|-------------|----------|
| Default puzzle-piece (no iconUrl) | ADO renders a generic icon; Phase 5 brands it. | |
| Reuse 128×128 placeholder PNG | Will pixelate at toolbar size; functional but ugly. | |
| Inline 16×16 calculator SVG | Brand consistency from day 1; small asset task. | ✓ |

**User's choice:** Inline 16×16 calculator SVG.
**Notes:** `images/toolbar-icon.svg`, monochrome, `fill="currentColor"` so theme tokens drive color. Phase 5 may replace with final branded version.

---

## Claude's Discretion

- Exact SVG content for the calculator icon (D-08).
- Exact `--rev-version` mechanic (D-03) — auto-rev with revert vs separate dev manifest.
- Whether modal Close button is host-provided, `azure-devops-ui` `PanelFooterButtons`, or custom `Button` (D-06).
- Console log prefix structure beyond the `[sp-calc]` convention (D-05).
- Whether Hello layout uses `Page` vs `Surface` (D-04).

## Deferred Ideas

- Branded marketplace icon — Phase 5.
- Bundle-size CI gate — Phase 5.
- Modal keyboard navigation (Esc to close) — Phase 3 owns full keyboard nav.
- Telemetry — out of scope.
- Hot-reload via `tfx extension serve` — rejected; deterministic dev loop preferred.
- Sourcemap publishing in public .vsix — Phase 5 concern.
- Per-environment manifests — single manifest for now.
- PAT secret rotation policy — manual user concern.
