# Story Point Calculator (Azure DevOps Extension)

## What This Is

An Azure DevOps work item extension that lets users estimate Story Points using a structured 3-dimension calculator (Complexity, Uncertainty, Effort) instead of free-form guessing. It ports an existing Excel-based calculator (`sp_calculator.xlsx`) into a modal accessible from the work item form, writes the result directly to the Story Points field, and leaves an audit comment so anyone can later see how the number was derived. Built for engineering teams using Azure Boards; published to the Visual Studio Marketplace.

## Core Value

**A team member can produce a justified, reproducible Story Points value for any work item in under 30 seconds, without leaving the work item form.**

If everything else fails, this must work: open work item → click button → answer 3 questions → SP appears in the field with a comment explaining why.

## Requirements

### Validated

- ✓ **Build foundation** — pinned npm versions (SDK 4.2.0, API 4.270.0, UI 2.272.0, tfx-cli 0.23.1), `tsconfig.json` strict, `webpack.config.cjs` two-entry, `vitest.config.ts`, MIT `LICENSE`, `.npmrc` save-exact, fresh-clone `npm ci && typecheck && test` exits 0 — Phase 0
- ✓ **Manifest skeleton (PKG-01)** — `vss-extension.json` with publisher `TsezariMshvenieradzeExtensions`, id `story-point-calculator`, version `0.1.0`, scope locked at `["vso.work_write"]`, toolbar action contribution targeting `ms.vss-work-web.work-item-toolbar-menu`, modal `ms.vss-web.external-content` contribution, 128×128 placeholder icon — Phase 0
- ✓ **Calc engine (CALC-01..05)** — pure-TS module at `src/calc/` ports `sp_calculator.xlsx` exactly: `weightedSum (W = 0.4·C + 0.4·U + 0.2·E)`, `rawSp (0.5 × 26^((W−1)/4))`, `roundFib` Fibonacci threshold table (≤0.75→0.5, ≤1.5→1, ≤2.5→2, ≤4→3, ≤6.5→5, ≤10.5→8, else→13), `calculate` pipeline. Frozen `LEVELS` constant; type-exhaustive `Level`/`Score`/`FibonacciSp` unions; 169 vitest tests covering all 7 Fibonacci buckets + threshold boundaries + 125-case parity table — Phase 1
- ✓ **Audit comment module (AUDIT-01..07)** — pure-TS module at `src/audit/` produces and parses the canonical sentinel format `<!-- sp-calc:v1 {"sp":N,"c":"...","u":"...","e":"...","schemaVersion":1} -->`. Stable JSON via replacer-array; bounded sentinel regex; HTML/NBSP normalization; case-insensitive label matching; `schemaVersion !== 1` rejection; never-throws parser; `parseLatest` filters deleted/sorts by createdDate/falls through on malformed; 153 vitest tests including 125-case round-trip and 17-case parser edge table — Phase 1
- ✓ **100% coverage gate** — `vitest.config.ts` enforces 100% line/branch/function/statement coverage on `src/calc/**` and `src/audit/**`; CI fails below this threshold — Phase 1
- ✓ **Manifest shell + SDK integration (UI-01, UI-02, UI-06)** — toolbar action `calc-sp-action` registered as `ms.vss-web.action` targeting `ms.vss-work-web.work-item-toolbar-menu`; click opens host-managed dialog via `IHostPageLayoutService.openCustomDialog` with `{ workItemId }` configuration; modal renders `azure-devops-ui` Surface+Page that inherits host theme automatically; SDK lifecycle (register → init({loaded:false}) → ready → notifyLoadSucceeded) correct in both iframes; dev-publish wrapper with retry-on-version-conflict and PAT-via-`.env.local`; PNG icon (Marketplace rejects SVG); webpack object-form entry so HtmlWebpackPlugin injects script tags; verified live on `cezari.visualstudio.com/Cezari` against all 4 ROADMAP success criteria — Phase 2

### Active

**v1 — Core calculator (fixed formula):**

- [ ] Toolbar button "Calculate Story Points" appears on work item form for User Story, Bug, Task, Feature/Epic
- [ ] Modal with 3 dropdowns: Complexity, Uncertainty, Effort — each with 5 levels (Very Easy → Very Hard)
- [ ] Modal displays intermediate values: weighted sum W, Raw SP, Final Fibonacci SP, and the formula itself
- [ ] Apply writes Story Points field on the work item via `IWorkItemFormService.setFieldValue()` + `.save()`
- [ ] Apply adds a sentinel-format audit comment via `WorkItemTrackingRestClient.addComment()`
- [ ] Audit comment format: `<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->` plus a human-readable line; parser unit-tested for edited/HTML-wrapped/NBSP/multi-comment cases
- [ ] **FieldResolver** detects the SP field reference name per work item type (Agile: `Microsoft.VSTS.Scheduling.StoryPoints`, CMMI: `Microsoft.VSTS.Scheduling.Size`); button disabled with tooltip when no SP-equivalent field exists
- [ ] Pre-flight permission check: button disabled when user lacks write permission on the work item
- [ ] If SP already exists, modal warns and shows "Current: X / New: Y" before overwrite
- [ ] If a prior sentinel SP audit comment exists, modal pre-fills the dropdowns from it
- [ ] Calculation logic matches `sp_calculator.xlsx` exactly (W = 0.4·C + 0.4·U + 0.2·E; SP = 0.5 × 26^((W−1)/4); rounded to Fibonacci 0.5/1/2/3/5/8/13)
- [ ] Unit tests cover calc pipeline (level→score, weighted sum, raw SP, Fibonacci rounding) AND audit-comment serializer/parser
- [ ] Bundle size ≤ 250 KB gzipped (toolbar shim + lazy-loaded modal)
- [ ] Browser parity: Chrome, Edge, Firefox, Safari
- [ ] Published as a public extension on Visual Studio Marketplace (English-only UI)

**v2 — Customization:**

- [ ] Settings hub at Org Settings AND Project Settings (override pattern)
- [ ] Configurable weights (must sum to 1.0)
- [ ] Configurable dimensions (add/remove beyond C/U/E — e.g., Risk, Dependencies)
- [ ] Configurable level labels (override "Very Easy" → "Trivial", etc.)
- [ ] Configurable Fibonacci thresholds (or alternate target scales)
- [ ] Project-level settings override organization-level defaults
- [ ] Settings persisted in ADO Extension Data Service

### Out of Scope

- **Backend service / .NET API** — Extension Data Service handles all storage; no infra needed
- **Localization beyond English (Georgian, Russian)** — User explicitly chose English-only; Georgian rendering in ADO has known quality issues
- **Process-customized SP field rename** — v1 supports the two standard Microsoft fields (`Microsoft.VSTS.Scheduling.StoryPoints` for Agile/Scrum, `Microsoft.VSTS.Scheduling.Size` for CMMI) via FieldResolver. Orgs that have *renamed* these fields via process customization are not supported in v1; revisit if reported by users post-launch
- **Bulk calculation across multiple items** — Single-item modal only; bulk estimation is a different UX
- **Estimation history/timeline UI** — Audit info lives in comments; no dedicated history panel
- **Approval workflow** — User confirmation only; no PO/Scrum Master approval gate
- **Auto-calculate on field change** — Always user-triggered via toolbar button
- **Component / E2E tests in v1** — Manual testers cover UI per org standard; only calc logic is automated
- **Microsoft Marketplace listing assets (icons, screenshots, marketing copy)** — Treated as a publish-time task, not a feature

## Context

**Existing artifact:** `sp_calculator.xlsx` defines the formula and is the source of truth for v1 calculation logic. Excel structure: 3 dropdowns (Complexity, Uncertainty, Effort), each with 5 weighted levels, computing a weighted sum that maps to a Fibonacci scale.

**Domain:** Azure DevOps web extensions are React-based SPAs loaded into Azure Boards inside sandboxed iframes via the modern `azure-devops-extension-sdk` v4 + `azure-devops-extension-api` v4. Work item toolbar contributions register as `ms.vss-web.action` targeting `ms.vss-work-web.work-item-toolbar-menu`; the dialog is registered as `ms.vss-web.external-content` and opened via `HostPageLayoutService.openCustomDialog`. (Initial PROJECT.md draft used outdated contribution IDs; corrected against Microsoft Learn 2026-04 — see `.planning/research/SUMMARY.md`.) v2 settings hubs use `ms.vss-web.hub` targeting `ms.vss-web.collection-admin-hub-group` (Org Settings) and `ms.vss-web.project-admin-hub-group` (Project Settings).

**Multi-tenancy:** Because this ships to Marketplace publicly, no GPIH-specific assumptions can leak into code (no hardcoded org names, project names, custom fields, or color schemes). Settings live in Extension Data Service per org/project.

**User profile:** Initial users are GPIHolding (Neptune project) Scrum teams already familiar with the Excel calculator. After publish, target audience expands to any Agile/Scrum team using Azure Boards.

**Pre-fill mechanism:** The audit comment serves dual purpose — human-readable audit trail AND machine-parseable state. v1 will write a structured token format (`SP=5 (C=Hard, U=Medium, E=Easy)`) that the modal parses on next open.

## Constraints

- **Tech stack — Frontend**: React 18 + TypeScript + `azure-devops-ui` (official Microsoft component library) — required for visual consistency with ADO and SDK integration
- **Tech stack — Org standard divergence**: GPIH org standard is Angular 19, but ADO native components are React-only. React is required here. This is a single-purpose extension, not a candidate for sharing the org's Angular component library.
- **Distribution**: Visual Studio Marketplace public listing — no infrastructure to host
- **Storage**: ADO Extension Data Service only (no external DB, no backend API) — keeps install-and-go UX
- **Browser compatibility**: Whatever Azure DevOps supports (modern Chromium, Firefox, Safari)
- **Permissions**: Extension scopes limited to `vso.work_write` (read/write work items) and extension data scopes; no broader org-level permissions requested
- **Bundle size**: Keep extension `.vsix` lean — load time directly impacts work item form responsiveness
- **Calculation precision**: Use floating-point math; final SP is integer (Fibonacci); intermediate values displayed to 2 decimals
- **Testing**: Manual QA does UI testing per company standard; only formula logic is unit-tested

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + TypeScript with `azure-devops-ui` | ADO Extension SDK is React-first; native UI components only available for React; consistency with ADO chrome | — Pending |
| Public Marketplace distribution | Reach beyond GPIH; future internal use is one tenant of many | — Pending |
| English-only UI | User-chosen; Georgian rendering quality is poor in ADO; reduces i18n complexity for v1 | — Pending |
| Apply button (not auto-write) | User reviews intermediate values + warning before mutation; explicit consent on overwrite | — Pending |
| `IWorkItemFormService.setFieldValue()` + `.save()` (not REST PATCH) | The work item form is open and dirty — REST PATCH while form is open causes revision conflicts and silent overwrites | — Pending |
| Sentinel HTML-comment + JSON payload + `schemaVersion` for audit format | Naive `SP=5 (...)` is too fragile (HTML wrapping, NBSP, user edits); sentinel survives ADO renderer and is round-trip parseable; `schemaVersion` enables v2 dimension expansion without breaking v1 parsing | — Pending |
| Audit comment as both audit log AND pre-fill source | Avoids extra storage layer; single source of truth for calculation history | — Pending |
| FieldResolver in v1 (not v2) for SP field reference name | CMMI processes use `Microsoft.VSTS.Scheduling.Size`, not `StoryPoints` — without this, v1 breaks on first CMMI customer; ~2hr implementation | — Pending |
| Manifest scope locked at `vso.work_write` only | Adding scopes post-publish forces re-consent across every install; lock minimum scope before first public publish | — Pending |
| v1 ships fixed formula, v2 adds customization | De-risks v1 launch; validates core flow before paying customization complexity | — Pending |
| ADO Extension Data Service for v2 settings | Zero infra; built-in multi-tenancy; aligns with marketplace install-and-go expectation | — Pending |
| Org Settings + Project Settings hubs (v2) — project isolation via key prefix | EDS only has `Default` and `User` scopes; project-level scoping must be implemented as `sp-config-proj-<projectId>` key prefix | — Pending |
| Unit tests for calc logic only | Manual QA covers UI per company standard; calc logic is pure function and worth automating | — Pending |
| Parse audit comment for pre-fill (not separate storage) | Closes the loop with the audit trail; no schema migration risk | — Pending |
| Toolbar button (not inline form group) | Modal is the right UX for question-answer flow; toolbar is the standard ADO pattern for actions | — Pending |
| **Apply ordering: comment-first → field-write** | Audit comment is the canonical source of truth for calc intent. Successful comment + failed field write is recoverable (parser pre-fills, user retries). Successful field write + failed comment loses provenance and breaks pre-fill. Decided in Phase 0 CONTEXT.md (D-01). | — Pending |
| Always post a new comment per Apply (no de-dup, no edit) | Multiple retry comments are an audit feature, not a bug; parser takes the most recent sentinel. Avoids a comparison/edit code path. Decided in Phase 0 CONTEXT.md (D-03). | — Pending |
| Marketplace publisher: `TsezariMshvenieradzeExtensions` (personal, already verified) | Personal publisher rather than GPIH-branded; no internal review chain to gate publishes. Decided in Phase 0 (D-08). | — Pending |
| Extension ID: `story-point-calculator`; Display: "Story Point Calculator"; License: MIT | One-way decisions locked before any publish. Decided in Phase 0 (D-09–D-11). | — Pending |
| Flat `src/` with subfolders (single package, single tsconfig) | Simplest layout for a single-purpose extension; reject npm workspaces/project references for v1. Decided in Phase 0 (D-05–D-07). | — Pending |

**Open questions / risks:**

- **Process-customized SP field rename** — Some orgs rename the SP field via process customization. v1 supports the two standard fields (StoryPoints/Size); custom-renamed fields are out of scope. Revisit if reported by users post-launch.
- **npm version verification** — Phase 0 must run `npm view` for `azure-devops-extension-sdk`, `azure-devops-extension-api`, `azure-devops-ui`, `tfx-cli` before pinning `package.json` (research versions are training-data floors).
- **Sentinel comment round-trip** — Verify `<!-- ... -->` survives ADO comment renderer in both markdown-mode and HTML-mode comments before locking the format (30-min validation in Phase 1).

**Resolved during Phase 0 discussion:**

- ~~Marketplace publisher account~~ — Resolved: `TsezariMshvenieradzeExtensions` already exists at https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions
- ~~Write atomicity ordering~~ — Resolved: comment-first → field-write (see Key Decisions row above; full rationale in `.planning/phases/00-bootstrap-prerequisites/00-CONTEXT.md` D-01–D-04)
- ~~Dev ADO org for Phase 2 testing~~ — Resolved: `cezari.visualstudio.com/Cezari` already exists

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-02 after Phase 2 completion (toolbar/modal/SDK integration verified live on cezari dev org)*
