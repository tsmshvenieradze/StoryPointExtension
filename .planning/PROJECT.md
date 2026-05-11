# Story Point Calculator (Azure DevOps Extension)

## Current State

**Status:** ✅ v1.1 SHIPPED 2026-05-11 — public on Visual Studio Marketplace as [TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator](https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator) at **v1.0.10**, now released via a fully automated CI/CD pipeline.

- **v1.0 MVP** (2026-05-04, Phases 0–5) — the calculator itself: 40/40 v1 requirements satisfied (3 PARTIAL with documented v1.0.1+ deferrals; 1 satisfied-with-caveat). Bundle 148.4 KB / 250 KB gzipped. 400/400 unit tests passing. Programmatic close (Cancel / post-Saved auto-close / iframe Esc) live since v1.0.5.
- **v1.1 Auto-Publish CI/CD** (2026-05-11, Phases 6–8) — 38/38 requirements satisfied. Promotion (PR `master → release`) auto-ships a new patch to Marketplace; `master` stays fully protected. First auto-publish v1.0.8 → re-verification v1.0.9 → SC #5 broken-PAT recovery v1.0.10. See **Requirements → Validated** for the full delivered architecture; ops runbook at [.planning/OPERATIONS.md](OPERATIONS.md).

For full milestone history see [.planning/MILESTONES.md](MILESTONES.md). Tech-debt carry-overs: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) and [milestones/v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md).

<details>
<summary>v1.1 milestone context (archived 2026-05-11)</summary>

**Goal:** Every promotion (PR `master → release`) ships a new patch version of the extension to Marketplace automatically; `master` stays fully protected — there is no automatic publish on a plain `master` merge.

**Delivered features:**
- GitHub Actions `publish.yml` triggered on push to the long-lived `release` branch, with pre-flight gates (typecheck → `vitest run` → webpack production build → bundle ≤ 250 KB gzipped) + asset audit + `TFX_PAT`-presence + rulesets-aware branch-protection probe
- `scripts/bump-version.mjs` does an atomic patch bump of `package.json` + `vss-extension.json` in-memory (Option B); the `story-point-release-bot` GitHub App commits `chore(release): vX.Y.Z [skip ci]` back to `release` after a successful publish (`[skip ci]` + actor-guard prevent CI loops)
- Package via `tfx extension create` (+ `vsix-X.Y.Z` artifact, 90-day) and publish via `tfx extension publish` to publisher `TsezariMshvenieradzeTfsAiReviewTask`, using the `TFX_PAT` repo secret (App credentials in `APP_ID` / `APP_PRIVATE_KEY`)
- Annotated git tag `vX.Y.Z` on each successful publish (best-effort, idempotent); a `release → master` back-merge PR a maintainer merges via the Web UI
- Legacy `publish:cezari` / `publish:public` npm scripts removed (`publish-cezari.cjs` archived to `scripts/.archive/`); the GH Action is the canonical publish path; `.planning/OPERATIONS.md` is the operations runbook
- Fail-fast on errors with manual re-run; no auto-retry, no notification surface — verified in the wild by the SC #5 broken-PAT exercise

**Key context:**
- Repo lives on GitHub; extension publishes to Visual Studio Marketplace
- Existing publisher + listing already public; no publisher work needed
- Within-milestone extension versions: v1.0.8 (first auto-publish) → v1.0.9 (re-verification) → v1.0.10 (SC #5 recovery); "v1.1" is a planning marker, not the shipped extension version

</details>

## Next Milestone Goals (post-v1.1)

Candidate themes pulled from v1.0 audit + listing limitations (deferred until v1.1 ships):

- **Pre-fill APPLY-03 production fix** — either widen `src/audit/parse.ts` to accept the human-readable line postComment writes, or strip the orphaned `serialize` re-export and document as v1 known-limitation.
- **Phase 5 carry-overs** — light + dark screenshots in vss-extension.json, Contributor non-admin smoke, cross-process Agile + CMMI smoke (Plan 05-04 deferred).
- **Cross-phase integration debt** — `closeProgrammatically` defense-in-depth + shared `SAVING_DATASET_KEY` constant; strip dead `PermissionWarnBanner` if no probe lands.
- **v2 customization (placeholder)** — Settings hub, configurable weights/dimensions/levels (per archived REQUIREMENTS.md v2 section).

---

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
- ✓ **Manifest shell + SDK integration (UI-01, UI-02, UI-06)** — toolbar action `calc-sp-action` registered as `ms.vss-web.action` targeting `ms.vss-work-web.work-item-toolbar-menu`; click opens host-managed dialog via `IGlobalMessagesService.addDialog` (swapped from openCustomDialog in v1.0.5) with `{ workItemId }` contributionConfiguration; modal renders `azure-devops-ui` Surface+Page that inherits host theme automatically; SDK lifecycle (register → init({loaded:false}) → ready → notifyLoadSucceeded) correct in both iframes — Phase 2 + Quick task 260504-cl1
- ✓ **Modal UI + read path (UI-03..UI-08, FIELD-01..04, APPLY-01..03)** — three labeled dropdowns + live calc panel + FieldResolver (StoryPoints / Size with cache + D-20 fallback); read path fetches current SP + comments + permission probe in parallel; NoFieldMessage replaces UI when neither SP field is present; iframe Esc keydown listener routes to closeProgrammatically (added v1.0.5+) — Phase 3 + Quick task 260504-cl1. *(APPLY-03 caveat: pre-fill flow is structurally dead in production for v1-authored comments due to D-02 STRIPPED-FALLBACK wire-format mismatch; tracked for v1.1+.)*
- ✓ **Write path + edge cases (APPLY-04..09)** — confirm-overwrite panel ("Current X / New Y"); two-leg apply orchestrator with comment-first → field-write atomicity per Phase 0 D-01; isDirty no-op skip; CommentFailBanner / FieldFailBanner with retry handlers; SavingOverlay + Pitfall 7 immutability guard; reactive read-only UX via FieldFailBanner per spike A3 LAZY-FALLBACK-ONLY — Phase 4
- ✓ **Marketplace ship (PKG-01..07)** — `.vsix` via `tfx-cli` with multi-entry webpack build; CI bundle gate at 250 KB gzipped (current 147.9 KB; 102.1 KB headroom); marketplace listing with overview.md (description, privacy, formula, limitations); v1.0.0 shipped public 2026-05-02 under publisher swap to `TsezariMshvenieradzeTfsAiReviewTask` (original `TsezariMshvenieradzeExtensions` was stuck-private); patch sequence v1.0.1..v1.0.7 — Phase 5 + Quick task 260504-cl1. *(PARTIAL: PKG-04 Contributor non-admin smoke skipped, PKG-05 screenshots deferred, PKG-07 cross-process Agile + CMMI smoke deferred — all carry-over to v1.0.1+.)*
- ✓ **Programmatic close (Cancel / post-Saved auto-close / Esc)** — closeProgrammatically helper at SDK boundary calling IGlobalMessagesService.closeDialog(); paired with addDialog opening primitive (matched-pair contract); 600ms post-Saved timer; iframe-local Esc keydown listener with saving-state guard via document.body.dataset.spcSaving — Quick task 260504-cl1 (v1.0.5..v1.0.7)
- ✓ **v1.1 Auto-Publish CI/CD (CI / GATE / BUMP / PUBLISH / TAG / FAIL / CLEAN / DOC — 38 requirements)** — GitHub Actions [`publish.yml`](../.github/workflows/publish.yml) triggered by a push to the long-lived `release` branch (minus a `paths-ignore` list): mints a `story-point-release-bot` GitHub App installation token (`actions/create-github-app-token@v2`) as step 1 → pre-flight gates (`tsc --noEmit` → `vitest run` → `webpack --mode production` → bundle ≤ 250 KB gzipped) + asset audit + `TFX_PAT`-presence + rulesets-aware branch-protection probe → `scripts/bump-version.mjs` (atomic two-file patch bump of `package.json` + `vss-extension.json`, in-memory — Option B: bump, publish FIRST, commit LAST) → `tfx extension create` + `actions/upload-artifact` (`vsix-X.Y.Z`, 90-day) → `tfx extension publish` to publisher `TsezariMshvenieradzeTfsAiReviewTask` using the `TFX_PAT` repo secret → the App commits `chore(release): vX.Y.Z [skip ci]` back to `release` → annotated git tag `vX.Y.Z` (best-effort, idempotent — TAG-04) → a `release → master` back-merge PR a maintainer merges via the GitHub Web UI (the verified-signature merge/squash commit satisfies `master`'s "require signed commits" rule). `ci.yml`'s `pull_request` gate covers `[master, release]`. Loop-guard triple defense: token anti-loop + `[skip ci]` token + actor-guard excluding `github-actions[bot]` / `story-point-release-bot[bot]`. **Shipped model: every promotion (PR `master → release`) ships a new patch version automatically; `master` stays fully protected (require-PR + `Build & verify` status check + signed commits + linear history, with the `story-point-release-bot` App on the ruleset bypass list) — there is no automatic publish on a plain `master` merge.** Legacy `publish:cezari` / `publish:public` npm scripts removed; `publish-cezari.cjs` archived to `scripts/.archive/`; comprehensive operations runbook (Marketplace PAT rotation · manual emergency-publish · release-branch model + ruleset config + GitHub App creation · rulesets-aware probe correction · partial-failure recovery · Option B reversibility exercise) at [`.planning/OPERATIONS.md`](OPERATIONS.md). First auto-publish **v1.0.8** (2026-05-11, Phase 7); release-branch model re-verified shipping **v1.0.9**; SC #5 broken-PAT reversibility verified in the wild — the publish step failed safely (Marketplace + `release` untouched, no orphan commit/tag/PR) and a restored-PAT re-run shipped **v1.0.10** cleanly (Phase 8 — evidence in `.planning/phases/08-cleanup-and-runbooks/08-SC5-EXERCISE.md`). — Phases 6-8

### Active

*(none — v1.1 Auto-Publish CI/CD is shipped and validated above; v1.2+ themes are in "Next Milestone Goals (post-v1.1)" below.)*

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
| React + TypeScript with `azure-devops-ui` | ADO Extension SDK is React-first; native UI components only available for React; consistency with ADO chrome | ✓ Good — proven in Phase 2; theme inheritance via `applyTheme: true` works without detection code |
| Public Marketplace distribution | Reach beyond GPIH; future internal use is one tenant of many | ✓ Good — shipped 2026-05-02 |
| English-only UI | User-chosen; Georgian rendering quality is poor in ADO; reduces i18n complexity for v1 | ✓ Good |
| Apply button (not auto-write) | User reviews intermediate values + warning before mutation; explicit consent on overwrite | ✓ Good |
| `IWorkItemFormService.setFieldValue()` + `.save()` (not REST PATCH) | The work item form is open and dirty — REST PATCH while form is open causes revision conflicts and silent overwrites | ✓ Good — apply.ts two-leg orchestrator works; isDirty no-op skip handles same-value case |
| Sentinel HTML-comment + JSON payload + `schemaVersion` for audit format | Naive `SP=5 (...)` is too fragile (HTML wrapping, NBSP, user edits); sentinel survives ADO renderer and is round-trip parseable; `schemaVersion` enables v2 dimension expansion without breaking v1 parsing | ⚠️ Revisit — Plan 04-01 spike A1 falsified: ADO storage strips `<!-- -->` regardless of api-version. Production write path now plain-text-only (D-02 STRIPPED-FALLBACK). Sentinel parser retained as test-only; pre-fill from sentinel structurally dead in production. v1.1+ either widens parse.ts or strips orphaned `serialize` |
| Audit comment as both audit log AND pre-fill source | Avoids extra storage layer; single source of truth for calculation history | ⚠️ Revisit — pre-fill from sentinel comment dead in production per row above; audit trail (human-readable comment) is live |
| FieldResolver in v1 (not v2) for SP field reference name | CMMI processes use `Microsoft.VSTS.Scheduling.Size`, not `StoryPoints` — without this, v1 breaks on first CMMI customer; ~2hr implementation | ✓ Good — FIELD-01..04 satisfied with cache + D-20 default; cross-process Agile + CMMI production smoke deferred to v1.0.1+ |
| Manifest scope locked at `vso.work_write` only | Adding scopes post-publish forces re-consent across every install; lock minimum scope before first public publish | ✓ Good |
| v1 ships fixed formula, v2 adds customization | De-risks v1 launch; validates core flow before paying customization complexity | ✓ Good — v1 shipped 4-day calendar; v2 scope undefined |
| ADO Extension Data Service for v2 settings | Zero infra; built-in multi-tenancy; aligns with marketplace install-and-go expectation | — Pending (v2 not yet scoped) |
| Org Settings + Project Settings hubs (v2) — project isolation via key prefix | EDS only has `Default` and `User` scopes; project-level scoping must be implemented as `sp-config-proj-<projectId>` key prefix | — Pending (v2 not yet scoped) |
| Unit tests for calc logic only | Manual QA covers UI per company standard; calc logic is pure function and worth automating | ✓ Good — 398/398 passing; 100% coverage gates on calc + audit |
| Toolbar button (not inline form group) | Modal is the right UX for question-answer flow; toolbar is the standard ADO pattern for actions | ✓ Good |
| **Apply ordering: comment-first → field-write** | Audit comment is the canonical source of truth for calc intent. Successful comment + failed field write is recoverable (parser pre-fills, user retries). Successful field write + failed comment loses provenance and breaks pre-fill. Decided in Phase 0 CONTEXT.md (D-01). | ⚠️ Revisit — atomicity ordering itself works (vitest mock.invocationCallOrder + cezari console transcripts confirm); but recoverability premise is undermined by the D-02 sentinel-comment falsification (parser pre-fill no longer fires for v1-authored comments). Re-evaluate v1.1+ alongside the parse.ts widening decision. |
| Always post a new comment per Apply (no de-dup, no edit) | Multiple retry comments are an audit feature, not a bug; parser takes the most recent sentinel. Avoids a comparison/edit code path. Decided in Phase 0 CONTEXT.md (D-03). | ✓ Good — Phase 4 fix-back loop confirmed |
| Marketplace publisher: `TsezariMshvenieradzeTfsAiReviewTask` (Phase 5 swap) | Original `TsezariMshvenieradzeExtensions` got stuck-private at first publish; swapped to a different already-verified publisher to unblock. Decided in Phase 5 ship-day. | ✓ Good — public publish succeeded; old publisher cleanup is low-priority housekeeping |
| Extension ID: `story-point-calculator`; Display: "Story Point Calculator"; License: MIT | One-way decisions locked before any publish. Decided in Phase 0 (D-09–D-11). | ✓ Good |
| Flat `src/` with subfolders (single package, single tsconfig) | Simplest layout for a single-purpose extension; reject npm workspaces/project references for v1. Decided in Phase 0 (D-05–D-07). | ✓ Good |
| **Phase 4 D-10: NO-PROGRAMMATIC-CLOSE** (locked then reversed) | Plan 04-01 Probe 3 tested only `SDK.notifyDialogResult / notifyDismiss / closeCustomDialog` (all undefined); concluded no programmatic close exists. | ⚠️ Revisit — Quick task 260504-cl1 (v1.0.4..v1.0.7) found that `IGlobalMessagesService.closeDialog()` works ONLY when paired with `IGlobalMessagesService.addDialog()` opening primitive. v1.0.5 swapped open-side to addDialog; programmatic close on Cancel + post-Saved auto-close + iframe Esc all live. Phase 4 D-10 was correct for the openCustomDialog code path, wrong as a universal claim. |
| **Phase 4 D-02: STRIPPED-FALLBACK** (audit comment plain-text only) | Plan 04-01 spike A1 falsified D-01 sentinel preservation: ADO storage strips `<!-- -->` regardless of `format:1` flag, api-version, or carrier shape. | ✓ Good for v1 ship; ⚠️ Revisit — neuters APPLY-03 in production; tracked for v1.1+ |
| **Phase 4 D-07: LAZY-FALLBACK-ONLY** (no eager isReadOnly probe) | Plan 04-01 spike A3 falsified four probe candidates: `formService.isReadOnly()` undefined; `getFieldValue('System.AuthorizedAs')` returns identity not permission; self-`setFieldValue` causes dirty side-effects; `SDK.getUser()` lacks license-tier discriminators. | ✓ Good — reactive UX via FieldFailBanner is the production baseline; PermissionWarnBanner slot retained for a future probe-validated path |
| **`addDialog` over `openCustomDialog`** (Quick task 260504-cl1, v1.0.5) | The matched-pair primitive contract: `closeDialog()` only manages the dialog stack populated by `addDialog`. To enable programmatic close, the open-side primitive had to swap too. | ✓ Good — all three close surfaces live in v1.0.5+; visual chrome differs (24px gutter moved inside iframe via `body { padding: 0 24px !important }` in v1.0.7) |
| **v1.1: Two-workflow split** — `ci.yml` PR-only; new `publish.yml` for releases | Defense-in-depth — a PR run physically cannot reach the publish step; gates re-run on the release tip | ✓ Good — Phases 6–8; `ci.yml` ↔ `publish.yml` triggers disjoint, verified in the wild |
| **v1.1: Release-branch promotion model + GitHub App verified commit-back** (Phase 8 — evolved from "publish on push to master") | A `master` ruleset (require-PR + require-signed-commits + status checks) rejected the default-token bot push (`GH013` in Phase 7). Promoting `master → release` via PR and auto-shipping the `release` push keeps `master` fully protected; the `story-point-release-bot` GitHub App (on the ruleset bypass list) commits the bump back to `release` with an auto-signed/verified commit | ✓ Good — supersedes CI-01/TAG-02 as written; verified shipping v1.0.9 + v1.0.10; documented in OPERATIONS.md + the v1.1 Validated entry |
| **v1.1: Option B state-flow** — bump in-memory → publish FIRST → commit + tag LAST | Marketplace is less reliable than a git push; put the unreliable side first so a publish failure leaves `release`/`master` untouched (self-healing) | ✓ Good — SC #5 broken-PAT exercise: publish failed safely (no orphan commit/tag/PR), restored-PAT re-run recovered cleanly |
| **v1.1: `scripts/bump-version.mjs` for version bumps** (reject `tfx --rev-version`, `release-please`/`semantic-release`/`changesets`) | Need an atomic two-file bump of `package.json` + `vss-extension.json`; `--rev-version` is manifest-only; the release-bot frameworks assume conventional-commits, which v1.1 deliberately does not adopt (patch-only policy) | ✓ Good — 2 vitest cases; max-wins drift handling; in 400/400 suite |
| **v1.1: `ubuntu-latest` runner** | Matches existing `ci.yml`; sidesteps Windows `tfx-cli spawnSync({shell})` quirks burned in `publish-cezari.cjs` | ✓ Good — every publish run green on `ubuntu-latest` |

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
*Last updated: 2026-05-11 after v1.1 milestone close (`/gsd-complete-milestone v1.1`) — v1.1 Auto-Publish CI/CD archived to `milestones/v1.1-ROADMAP.md` + `milestones/v1.1-REQUIREMENTS.md`; 38/38 requirements satisfied; Current State + Key Decisions updated; v1.1 milestone-context summary collapsed; phase artifacts moved to `milestones/v1.1-phases/` (v1.0 phases retroactively moved to `milestones/v1.0-phases/`). Prior: v1.0 milestone closed 2026-05-04 (public Marketplace ship; 19 plans across 6 phases; 40/40 v1 requirements satisfied with 3 PARTIAL deferrals + 1 satisfied-with-caveat).*
