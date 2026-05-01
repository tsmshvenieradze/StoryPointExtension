# Roadmap: Story Point Calculator (Azure DevOps Extension)

**Created:** 2026-05-01
**Granularity:** coarse (3-5 phases, 1-3 plans each)
**Coverage:** 40/40 v1 requirements mapped

## Overview

The journey ships a public Marketplace Azure DevOps work item extension that lets a team member produce a justified, reproducible Story Points value in under 30 seconds. The build proceeds integration-first: Phase 0 unblocks the build (npm versions, Marketplace publisher, atomicity decision, manifest skeleton with locked scope); Phase 1 builds the pure calc engine and sentinel audit parser with zero ADO surface contact; Phase 2 deploys a minimal manifest shell that proves the highest-risk integration step (toolbar contribution + dialog open + theme inheritance) before any React UI work; Phase 3 layers the full modal UI and read path on top of the proven shell; Phase 4 wires the write path with the atomicity ordering chosen in Phase 0 plus permission and edge-case handling; Phase 5 hardens the bundle, produces Marketplace listing assets, and publishes to Visual Studio Marketplace verified on at least one Agile and one CMMI organization.

## Phases

**Phase Numbering:**
- Integer phases (0, 1, 2, 3, 4, 5): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 0: Bootstrap & Prerequisites** - Unblock the build: pin versions, verify Marketplace publisher, lock manifest scope, decide write atomicity ordering (completed 2026-05-01)
- [ ] **Phase 1: Calc Engine & Audit Parser** - Pure functions matching the Excel calculator and the sentinel-format comment serializer/parser, both fully unit-tested with zero ADO dependencies
- [ ] **Phase 2: Manifest Shell & SDK Integration** - Toolbar button appears in a dev org, click opens a themed "Hello" dialog — the highest-risk integration point fails fast here
- [ ] **Phase 3: Modal UI & Read Path** - Full React calculator modal with FieldResolver, intermediate values, current SP read, and pre-fill from prior sentinel comment
- [ ] **Phase 4: Write Path & Edge Cases** - Apply writes the field and posts the audit comment using the chosen atomicity order, with permission checks, overwrite confirmation, and friendly error handling
- [ ] **Phase 5: Polish & Marketplace Publish** - Bundle size gate, listing assets, private smoke install, then public publish on Visual Studio Marketplace verified on Agile and CMMI orgs

## Phase Details

### Phase 0: Bootstrap & Prerequisites
**Goal**: Remove every external blocker before code is written so Phase 1 can start clean
**Depends on**: Nothing (first phase)
**Requirements**: PKG-01
**Success Criteria** (what must be TRUE):
  1. `npm view` has been run for `azure-devops-extension-sdk`, `azure-devops-extension-api`, `azure-devops-ui`, `tfx-cli`, and the resolved versions are pinned in a committed `package.json`
  2. The GPIH Marketplace publisher account exists, is verified, and the publisher ID is recorded in `vss-extension.json` (24h verification round-trip absorbed in this phase, not at publish time)
  3. The repo is scaffolded with `tsconfig.json`, `vitest.config.ts`, `webpack.config.*`, and a `vss-extension.json` skeleton declaring exactly the `vso.work_write` scope plus the `ms.vss-web.action` toolbar contribution and `ms.vss-web.external-content` modal contribution stubs (no implementation yet)
  4. The write atomicity ordering decision (comment-first vs field-first) is documented in PROJECT.md Key Decisions with the rationale, and is referenced from Phase 4's plan when it is created
  5. Running `npm ci && npm run typecheck && npm test` on a fresh clone exits 0 even though the only test is a placeholder
**Plans**: 1 plan

Plans:
- [x] 00-01-PLAN.md — Bootstrap: pin versions, write configs (tsconfig/webpack/vitest/manifest), scaffold src/, run smoke loop, verify publisher access

### Phase 1: Calc Engine & Audit Parser
**Goal**: Lock the wire formats — calculation behavior matching the Excel source of truth, and the sentinel comment format that survives ADO's renderer — before any ADO surface is touched
**Depends on**: Phase 0
**Requirements**: CALC-01, CALC-02, CALC-03, CALC-04, CALC-05, AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05, AUDIT-06, AUDIT-07
**Success Criteria** (what must be TRUE):
  1. A pure `calcEngine` module turns three level selections into a Final Story Points value (Fibonacci-rounded) using `W = 0.4·C + 0.4·U + 0.2·E` and `SP = 0.5 × 26^((W−1)/4)`, with unit tests asserting every Fibonacci bucket and every threshold boundary against `sp_calculator.xlsx`
  2. A pure `auditComment` module serializes a calculation result to the exact sentinel format `<!-- sp-calc:v1 {"sp":N,"c":"...","u":"...","e":"...","schemaVersion":1} -->` plus the human-readable summary line, with deterministic key order
  3. The parser extracts the JSON payload from raw HTML comments, ADO-renderer-wrapped output, and NBSP-substituted text, ignores `isDeleted` and malformed entries, returns the most recent of multiple sentinels by `createdDate`, and never throws on user input
  4. A round-trip property test demonstrates `parse(serialize(input)) === input` for all valid inputs
  5. Both modules have zero imports from `azure-devops-extension-sdk` or `azure-devops-extension-api` and the test suite runs without a browser or ADO mock
**Plans**: 2 plans

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Calc engine: levels, fibonacci, engine, index + 125-case + threshold-boundary table-driven tests

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 01-02-PLAN.md — Audit module: types, serialize, parse, parseLatest, index + edge-case + round-trip suites; 100% coverage thresholds; smoke test retired

### Phase 2: Manifest Shell & SDK Integration
**Goal**: Prove the iframe + contribution + dialog + theme integration end-to-end on a real ADO dev org with a "Hello" payload, so the highest-risk step fails fast before any React UI investment
**Depends on**: Phase 1
**Requirements**: UI-01, UI-02, UI-06
**Success Criteria** (what must be TRUE):
  1. After installing the dev `.vsix` on a trial ADO organization, opening any work item shows a "Calculate Story Points" entry in the work-item toolbar menu (contribution `ms.vss-web.action` targeting `ms.vss-work-web.work-item-toolbar-menu`)
  2. Clicking the toolbar entry opens a host-managed custom dialog whose iframe is the registered `ms.vss-web.external-content` modal contribution, opened via `HostPageLayoutService.openCustomDialog` with the work item ID passed via `configuration`
  3. The opened dialog renders a "Hello" payload that visibly inherits the host's light and dark themes (toggle ADO theme — the dialog colors flip with the host), confirming `applyTheme:true` and the SDK init lifecycle (`SDK.init` → `await SDK.ready()` → `register` → `notifyLoadSucceeded`) wired correctly in both iframes
  4. Reloading the work item form (hard and soft refresh, plus Next/Previous arrows) does not produce duplicate or missing toolbar entries
**Plans**: TBD
**UI hint**: yes

### Phase 3: Modal UI & Read Path
**Goal**: Replace the "Hello" payload with the full calculator UI wired to Phase 1's pure modules, FieldResolver, and the SDK read path so the user can see current SP and a pre-filled selection on every open
**Depends on**: Phase 2
**Requirements**: UI-03, UI-04, UI-05, UI-07, UI-08, FIELD-01, FIELD-02, FIELD-03, FIELD-04, APPLY-01, APPLY-02, APPLY-03
**Success Criteria** (what must be TRUE):
  1. The modal renders three labeled `azure-devops-ui` Dropdown components (Complexity, Uncertainty, Effort) each with the five level options, a live "Calculation Details" panel showing W (2 decimals), Raw SP (2 decimals), Final SP, and the formula text, and Apply (disabled until all three dropdowns are selected) plus Cancel buttons
  2. The modal is fully keyboard-navigable: Tab moves between dropdowns, Enter confirms a dropdown selection, Esc cancels, Tab to Apply + Enter applies — verified on User Story, Bug, Task, Feature, and Epic
  3. On modal open, FieldResolver probes the work item type's fields and returns `Microsoft.VSTS.Scheduling.StoryPoints` (Agile/Scrum/Basic) or falls back to `Microsoft.VSTS.Scheduling.Size` (CMMI), caching the result per `(projectId, workItemTypeName)`; when neither is present the toolbar button is rendered disabled with an explanatory tooltip and the modal does not open
  4. On modal open, the current value of the resolved SP field is displayed via `IWorkItemFormService.getFieldValue()`, and `WorkItemTrackingRestClient.getComments()` is called and run through the AUDIT parser to find the most recent sentinel
  5. When a prior sentinel comment is found, the three dropdowns are pre-filled from its payload before the user interacts; when none is found the dropdowns start empty
**Plans**: TBD
**UI hint**: yes

### Phase 4: Write Path & Edge Cases
**Goal**: Make Apply actually mutate the work item with the atomicity ordering chosen in Phase 0, gated by permission and overwrite checks, with friendly errors on every documented failure mode
**Depends on**: Phase 3
**Requirements**: APPLY-04, APPLY-05, APPLY-06, APPLY-07, APPLY-08, APPLY-09
**Success Criteria** (what must be TRUE):
  1. When the resolved SP field already has a value, clicking Apply shows an in-modal confirmation panel displaying "Current: X / New: Y" and requires a second confirmation before the write proceeds
  2. On confirmed Apply, the new SP value is written via `IWorkItemFormService.setFieldValue()` followed by `.save()`, and the audit comment is posted via `WorkItemTrackingRestClient.addComment()` (api-version `7.0-preview.3`), in the order documented in Phase 0's atomicity decision
  3. When the user lacks write permission on the work item (Stakeholder license, area-path restriction, closed item), the Apply button is rendered disabled with a tooltip and the modal still opens read-only for inspection — no field write or comment is attempted
  4. When the field write fails (4xx, 412, RuleValidationException), the user sees a status-code-specific error toast, and the comment side of the operation is handled per the Phase 0 atomicity decision (not posted, or posted-and-rolled-back); when the comment write fails after a successful field write, the user sees a clear error toast and the field write is left in place
  5. After a successful Apply, the work item form reflects the new SP value without a full page reload, and reopening the modal pre-fills from the just-written sentinel comment
**Plans**: TBD
**UI hint**: yes

### Phase 5: Polish & Marketplace Publish
**Goal**: Ship a public Marketplace listing that installs cleanly on a fresh ADO trial org and a Contributor (non-admin) user can complete the full flow on both Agile and CMMI processes
**Depends on**: Phase 4
**Requirements**: PKG-02, PKG-03, PKG-04, PKG-05, PKG-06, PKG-07
**Success Criteria** (what must be TRUE):
  1. The build pipeline produces a `.vsix` via `tfx-cli` with two webpack entries — `dist/toolbar.html` (toolbar shim) and `dist/modal.html` (lazy-loaded modal) — and CI fails the build when total bundle size exceeds 250 KB gzipped
  2. The Marketplace listing has a description, a privacy/data-handling statement (no telemetry; data stays in the user's ADO org), the formula explanation, a 128×128 icon, and screenshots showing the modal in both light and dark themes
  3. A private install on a fresh ADO trial organization (shared via `tfx extension share`, not yet `public:true`) lets a Contributor (non-admin) user complete the full open-modal → Apply flow without permission errors
  4. The extension is published `public:true` on Visual Studio Marketplace under the verified GPIH publisher with exactly the `vso.work_write` scope (no scope changes from Phase 0), and an end-to-end install + Apply succeeds on at least two different ADO organizations — one running the Agile process, one running CMMI
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Bootstrap & Prerequisites | 1/1 | Complete    | 2026-05-01 |
| 1. Calc Engine & Audit Parser | 1/2 | In Progress|  |
| 2. Manifest Shell & SDK Integration | 0/TBD | Not started | - |
| 3. Modal UI & Read Path | 0/TBD | Not started | - |
| 4. Write Path & Edge Cases | 0/TBD | Not started | - |
| 5. Polish & Marketplace Publish | 0/TBD | Not started | - |
