# Phase 0 — Pinned npm Versions

**Verified:** 2026-05-01 via `npm view <pkg> version`
**Decision rule (per PLAN Task 1):** all four packages within accepted ranges → use research baseline verbatim, do not auto-bump.

## Resolved Versions

- `azure-devops-extension-sdk`: **4.2.0** (research baseline; current latest = 4.2.0; in-range `4.x`)
- `azure-devops-extension-api`: **4.270.0** (research baseline; current latest = 4.270.0; in-range `4.2xx.x`)
- `azure-devops-ui`: **2.272.0** (research baseline; current latest = 2.272.0; in-range `2.x ≥ 2.272.0`)
- `tfx-cli`: **0.23.1** (research baseline; current latest = 0.23.1; in-range `0.2x.x`)

## Rationale

No drift from RESEARCH.md baselines. All four packages exactly match the floor versions verified during research synthesis. No changelogs needed; no major boundaries crossed; no bumps applied.

These exact strings (without `^` or `~`) are pinned in `package.json` per PITFALLS.md Pitfall 14.
