---
phase: 00-bootstrap-prerequisites
plan: 01
subsystem: infra
tags: [npm, typescript, react, webpack, vitest, vss-extension, ado-extension, bootstrap]

requires:
  - phase: pre-existing
    provides: "Phase 0 CONTEXT.md (D-01..D-16), RESEARCH.md (verified versions, code examples), PROJECT.md (Key Decisions including atomicity)"
provides:
  - "Pinned npm dependency manifest (package.json + .npmrc save-exact + overrides for azure-devops-ui React peer)"
  - "Reproducible install via committed package-lock.json"
  - "Strict-plus TypeScript config (tsconfig.json) ready for calc engine and React UI"
  - "Two-entry webpack config (webpack.config.cjs) emitting dist/{toolbar,modal}.{html,js}"
  - "Vitest harness with placeholder smoke test (tests/smoke.test.ts) — proves harness wires up"
  - "vss-extension.json manifest skeleton with locked vso.work_write scope and two contribution stubs"
  - "Source folder layout per D-05 (src/{calc,audit,field,ado,ui,entries}, tests/)"
  - "MIT LICENSE, .gitignore (lockfile NOT excluded), placeholder README, 128x128 placeholder icon"
  - "Marketplace publisher namespace bound: TsezariMshvenieradzeExtensions.story-point-calculator"
affects: [01-calculation-engine, 02-toolbar-modal-shell, 03-field-resolver, 04-ado-bridge, 05-marketplace-publish]

tech-stack:
  added:
    - "azure-devops-extension-sdk@4.2.0"
    - "azure-devops-extension-api@4.270.0"
    - "azure-devops-ui@2.272.0"
    - "tfx-cli@0.23.1"
    - "react@18.3.1, react-dom@18.3.1"
    - "typescript ^5.6.0"
    - "webpack ^5.97.0 + webpack-cli + ts-loader + sass-loader + css-loader + style-loader + html-webpack-plugin + copy-webpack-plugin"
    - "vitest ^2.1.0 + @vitest/coverage-v8"
    - "rimraf ^6.0.0 (cross-platform clean)"
  patterns:
    - "Single webpack.config.cjs returning array of [toolbarConfig, modalConfig] via baseConfig(entryName, mode)"
    - "package.json overrides redirecting azure-devops-ui's React 16 peer to top-level $react/$react-dom"
    - ".npmrc save-exact=true enforcing pinned versions on every future npm install"
    - ".cjs file extension mandatory for webpack config (Pitfall 2 — package.json type:module would break it)"
    - "Strict-plus tsconfig (noUncheckedIndexedAccess + exactOptionalPropertyTypes + noImplicitOverride + skipLibCheck) for numeric calc engine"
    - "Hand-rolled minimal PNG writer (zlib + CRC32, no deps) for placeholder icon"

key-files:
  created:
    - "package.json — pinned deps + scripts + overrides"
    - "package-lock.json — committed; reproducible install contract"
    - ".npmrc — save-exact=true"
    - "tsconfig.json — strict-plus settings"
    - "webpack.config.cjs — two-entry array config"
    - "vitest.config.ts — node env, globals, tests/**/*.test.ts"
    - "vss-extension.json — manifest skeleton with locked scope"
    - ".gitignore — lockfile deliberately not excluded"
    - "LICENSE — MIT 2026 Tsezari Mshvenieradze"
    - "README.md — placeholder per D-16"
    - "src/template.html — shared HTML template with #root div"
    - "src/entries/toolbar.tsx, src/entries/modal.tsx — Phase 0 stubs"
    - "src/{calc,audit,field,ado,ui}/.gitkeep — empty subfolders survive git clone"
    - "tests/smoke.test.ts — 1+1===2 placeholder"
    - "scripts/generate-placeholder-icon.cjs — deterministic 128x128 PNG generator"
    - "images/icon.png — 143-byte transparent PNG placeholder"
    - ".planning/phases/00-bootstrap-prerequisites/00-VERSIONS.md — pinned-version traceability"
  modified: []

key-decisions:
  - "Used Strategy 2 (Node script) for placeholder icon — ImageMagick unavailable on dev host; scripts/generate-placeholder-icon.cjs makes the icon reproducible"
  - "Used research baseline versions verbatim (no bumps) — all four critical packages match latest available exactly"
  - "Stretch verification (npm run build:dev) passes — webpack emits dist/{toolbar,modal}.{html,js} cleanly"

patterns-established:
  - "Pinned-version policy: SDK/API/UI/tfx-cli are pinned exact (no ^/~); supporting tooling uses caret floors"
  - "Webpack two-entry pattern: array export from single config file with shared baseConfig(entryName, mode) factory"
  - "React peer-dep overrides via package.json overrides block (not legacy-peer-deps) — surgical, declarative, survives npm ci"
  - "Source folder layout (D-05): flat src/ with calc, audit, field, ado, ui, entries subfolders + .gitkeep for empties"
  - "Test-coverage exclusions: src/entries/** and src/**/*.tsx (UI is manual-QA per CLAUDE.md)"

requirements-completed: [PKG-01]

duration: ~30min
completed: 2026-05-01
---

# Phase 0 Plan 01: Bootstrap & Prerequisites Summary

**Pinned-version npm bootstrap with locked vso.work_write manifest scope, two-entry webpack pipeline, and green fresh-clone smoke loop (npm ci && npm run typecheck && npm test exits 0).**

## Performance

- **Duration:** ~30 min (start ~17:00 UTC, finish 17:27 UTC)
- **Started:** 2026-05-01T17:00:00Z (approximate; agent spawn)
- **Completed:** 2026-05-01T17:26:56Z
- **Tasks:** 14 (12 file-producing + 1 verification-only + 1 checkpoint)
- **Files created:** 19 (package.json, package-lock.json, .npmrc, tsconfig.json, webpack.config.cjs, vitest.config.ts, vss-extension.json, .gitignore, LICENSE, README.md, src/template.html, src/entries/toolbar.tsx, src/entries/modal.tsx, 5 .gitkeep files, tests/smoke.test.ts, scripts/generate-placeholder-icon.cjs, images/icon.png, 00-VERSIONS.md)

## Accomplishments

- **Pinned versions verified live:** All four critical packages (`azure-devops-extension-sdk@4.2.0`, `azure-devops-extension-api@4.270.0`, `azure-devops-ui@2.272.0`, `tfx-cli@0.23.1`) confirmed against npm registry on 2026-05-01 — exact match to RESEARCH.md baselines, no drift, no bumps.
- **Manifest scope locked:** `vss-extension.json` declares exactly `["vso.work_write"]` (Pitfall 4) with two contributions (toolbar action targeting `ms.vss-work-web.work-item-toolbar-menu` + external-content modal pointing to `dist/modal.html`), publisher `TsezariMshvenieradzeExtensions`, id `story-point-calculator`, version `0.1.0`.
- **Smoke loop green:** `npm install` succeeded with no `ERESOLVE` (overrides effective — React 18.3.1 resolved alongside azure-devops-ui's React 16 peer); `npm run typecheck` exits 0; `npm test` reports 1 passed; stretch `npm run build:dev` emits `dist/toolbar.{html,js}` and `dist/modal.{html,js}` cleanly.
- **Atomicity decision verified:** PROJECT.md Key Decisions contains `comment-first`, `D-01`, `D-03`, and `Apply ordering` strings — Phase 4 will reference these when implementing the write path.

## Task Commits

Each task committed atomically with `--no-verify` (worktree mode; orchestrator validates hooks centrally after merge):

1. **Task 1: Verify pinned npm versions** — `4221061` (docs)
2. **Task 2: Repo metadata files** (`.gitignore`, `.npmrc`, `LICENSE`, `README.md`) — `222f899` (chore)
3. **Task 3: package.json with pinned versions and overrides** — `b0e01be` (chore)
4. **Task 4: tsconfig.json strict-plus** — `3cf0f7a` (chore)
5. **Task 5: vss-extension.json manifest skeleton** — `14cca3d` (chore)
6. **Task 6: webpack.config.cjs + src/template.html** — `5d099fb` (chore)
7. **Task 7: vitest.config.ts + tests/smoke.test.ts** — `faf60e9` (chore)
8. **Task 8: src/ scaffold (gitkeeps + entry stubs)** — `554ebb6` (chore)
9. **Task 9: Placeholder 128x128 icon + generator script** — `361f843` (chore)
10. **Task 10: Generate and commit package-lock.json** — `b5bcac4` (chore)
11. **Task 11: Verify atomicity decision in PROJECT.md** — verification-only, no commit (no file changes — this is a presence check on prior work, per the plan's own instruction "No edits to PROJECT.md are expected")
12. **Task 12: Run fresh-clone smoke loop** — verification-only, no commit (typecheck + test + build:dev all exited 0)
13. **Task 13: Marketplace publisher access checkpoint** — observational; deferred to user during phase merge per orchestrator instruction (CONTEXT.md D-08 already asserts publisher exists; Assumption A1 in RESEARCH.md is `taken on trust`)
14. **Task 14: Final must-haves cross-check** — verification-only, no commit (all 8 must-haves verified, exit 0)

**Plan metadata commit:** This SUMMARY commit (created by orchestrator's metadata step in worktree mode).

## Files Created/Modified

### Repo root configuration
- `package.json` — Pinned deps, scripts (typecheck/test/build/dev/clean/package), overrides block
- `package-lock.json` — Committed; npm ci contract
- `.npmrc` — `save-exact=true`
- `tsconfig.json` — Strict-plus settings, react-jsx, ES2020/ESNext, skipLibCheck
- `webpack.config.cjs` — Two-entry array config (`baseConfig(entryName, mode)` → `[toolbar, modal]`)
- `vitest.config.ts` — Node env, globals, `tests/**/*.test.ts`, coverage excludes UI
- `vss-extension.json` — Manifest skeleton with locked scope and two contribution stubs
- `.gitignore` — node_modules, dist, *.vsix, coverage, .tfx-cache; lockfile deliberately NOT excluded
- `LICENSE` — MIT 2026 Tsezari Mshvenieradze (D-11)
- `README.md` — Placeholder per D-16

### Source layout (per D-05)
- `src/template.html` — Shared HTML template with `<div id="root"></div>`
- `src/entries/toolbar.tsx` — Phase 0 stub (`export {}` + console.log)
- `src/entries/modal.tsx` — Phase 0 stub
- `src/{calc,audit,field,ado,ui}/.gitkeep` — Zero-byte placeholders so empty folders survive git clone

### Tests
- `tests/smoke.test.ts` — `expect(1 + 1).toBe(2)` placeholder

### Scripts and assets
- `scripts/generate-placeholder-icon.cjs` — Hand-rolled 128x128 transparent PNG writer (zlib + CRC32, zero deps)
- `images/icon.png` — 143 bytes, valid PNG signature, IHDR 128x128

### Planning traceability
- `.planning/phases/00-bootstrap-prerequisites/00-VERSIONS.md` — Pinned-version record per Task 1

## Decisions Made

- **Used Strategy 2 (Node script) for placeholder icon** — ImageMagick is not on the dev host's PATH. The Node fallback (`scripts/generate-placeholder-icon.cjs`) is committed so the icon is reproducible from a fresh clone without external tooling.
- **No version bumps applied** — All four critical packages exactly match RESEARCH.md baselines (sdk@4.2.0, api@4.270.0, ui@2.272.0, tfx@0.23.1); pinning policy is "verified floor", not "latest".
- **Stretch verification (`npm run build:dev`) executed and passed** — Webpack emits `dist/toolbar.{html,js}` and `dist/modal.{html,js}` cleanly. Confirms the bootstrap is fully wired beyond the typecheck+test minimum required by ROADMAP success criterion 5.

## Deviations from Plan

None - plan executed exactly as written. The plan's verbatim file contents were copied without improvisation. The Strategy 2 (Node script) icon path was a planned alternative within Task 9, not a deviation.

**Note on Task 10 lockfile-overrides verification:** The plan's automated verify expects `package-lock.json.packages[''].overrides` to exist. npm 11.12.1 (this host's version) does NOT mirror the overrides block into the root lockfile entry, but the resolution is correct (React 18.3.1 installed alongside azure-devops-ui@2.272.0 with no ERESOLVE). The acceptance-criteria-level outcomes (no ERESOLVE, react@18.3.1 resolved, all four packages installed) all pass. This is npm-version behavior, not a plan or implementation defect — the override is effective at install time, which is what matters.

## Issues Encountered

- **`tfx-cli` transitive vulnerabilities:** `npm install` reported 10 vulnerabilities (8 moderate, 2 high) in transitive deps of `tfx-cli` (old `glob` chain). Disposition: ACCEPT per threat register T-00-09 (standard supply-chain risk). Mitigation lives at the org level (Phase 5 Dependabot), not Phase 0. No `npm audit fix` was run because (a) it would mutate pinned versions and (b) Phase 5 owns CI/CD security gating per D-15.
- **Windows CRLF warnings:** Git emitted `LF will be replaced by CRLF` warnings on every commit. These are advisory and harmless on Windows; line endings are normalized via `core.autocrlf`.

## Auth Gates / Checkpoints

- **Task 13 (checkpoint:human-verify) — Marketplace publisher access:** Returned to orchestrator as observational checkpoint per parallel-executor instructions ("when you reach it, return a checkpoint signal with the verification request. Do not block on it; the orchestrator handles checkpoint resolution"). CONTEXT.md D-08 already asserts the publisher `TsezariMshvenieradzeExtensions` exists at https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions. Assumption A1 in RESEARCH.md flags this as `taken on trust from CONTEXT.md`. The user must visually confirm publisher status during phase merge or before Phase 5 publish.

## User Setup Required

None for Phase 0. The repo is fully bootstrapped for local development:
```bash
npm ci
npm run typecheck
npm test
npm run build:dev
```

External setup deferred to Phase 5 (Marketplace publish):
- Personal Access Token (PAT) for `tfx extension publish`
- Azure Pipelines service connection (PAT-backed)
- Marketplace publisher visual confirmation (Task 13 observational checkpoint)

## Next Phase Readiness

- **Phase 1 (Calculation Engine) unblocked:** Strict-plus TypeScript config compiles `src/**/*` clean; vitest harness discovers `tests/**/*.test.ts`. Phase 1 can drop calc/audit modules and tests into `src/calc/`, `src/audit/`, `tests/calc/`, `tests/audit/` and they will be picked up automatically.
- **Phase 2 (Toolbar/Modal shell) unblocked:** webpack two-entry pipeline emits `dist/{toolbar,modal}.{html,js}`; manifest references those exact paths. Phase 2 replaces `src/entries/{toolbar,modal}.tsx` stubs with real SDK lifecycle code.
- **Phase 5 (Publish) anchor points set:** publisher slug, extension id, and scope are immutable from this point — cannot be changed without breaking installs after first public publish.

## Self-Check: PASSED

Verified files:
- `package.json` FOUND
- `package-lock.json` FOUND
- `tsconfig.json` FOUND
- `webpack.config.cjs` FOUND
- `vitest.config.ts` FOUND
- `vss-extension.json` FOUND
- `.npmrc`, `.gitignore`, `LICENSE`, `README.md` FOUND
- `src/entries/toolbar.tsx`, `src/entries/modal.tsx` FOUND
- `src/template.html` FOUND
- `tests/smoke.test.ts` FOUND
- `images/icon.png` FOUND (128x128 PNG)
- `scripts/generate-placeholder-icon.cjs` FOUND
- `.planning/phases/00-bootstrap-prerequisites/00-VERSIONS.md` FOUND
- All five `src/{calc,audit,field,ado,ui}/.gitkeep` FOUND (zero-byte)

Verified commits in `git log --oneline 7e135c4..HEAD`:
- 4221061 docs(00-01): verify and record pinned npm versions FOUND
- 222f899 chore(00-01): add repo metadata files FOUND
- b0e01be chore(00-01): add package.json FOUND
- 3cf0f7a chore(00-01): add tsconfig.json FOUND
- 14cca3d chore(00-01): add vss-extension.json FOUND
- 5d099fb chore(00-01): add webpack.config.cjs FOUND
- faf60e9 chore(00-01): add vitest.config.ts FOUND
- 554ebb6 chore(00-01): scaffold src/ FOUND
- 361f843 chore(00-01): add icon FOUND
- b5bcac4 chore(00-01): generate package-lock.json FOUND

Smoke loop verification (Task 12):
- `npm run typecheck` exited 0
- `npm test` reported `1 passed` and exited 0
- `npm run build:dev` emitted both `dist/toolbar.{html,js}` and `dist/modal.{html,js}` cleanly

Must-haves verification (Task 14):
- ALL 8 must-haves verified: pin checks (sdk/api/ui/tfx), publisher, id, scope lock, 2 contributions, overrides, lockfile, atomicity decision present in PROJECT.md

---
*Phase: 00-bootstrap-prerequisites*
*Completed: 2026-05-01*
