# Requirements: Story Point Calculator (Azure DevOps Extension)

**Defined:** 2026-05-01
**Core Value:** A team member can produce a justified, reproducible Story Points value for any work item in under 30 seconds, without leaving the work item form.

## v1 Requirements

Requirements for initial public Marketplace release. Each maps to roadmap phases.

### Calc — Calculation Engine

- [x] **CALC-01**: Pure function maps a 5-level dropdown selection (Very Easy / Easy / Medium / Hard / Very Hard) to its 1–5 numeric score
- [x] **CALC-02**: Pure function computes the weighted sum `W = 0.4·C + 0.4·U + 0.2·E` from three numeric scores
- [x] **CALC-03**: Pure function computes Raw SP using `0.5 × 26^((W−1)/4)`
- [x] **CALC-04**: Pure function rounds Raw SP to the nearest Fibonacci value in `{0.5, 1, 2, 3, 5, 8, 13}` using the same threshold table as `sp_calculator.xlsx` (≤0.75→0.5, ≤1.5→1, ≤2.5→2, ≤4→3, ≤6.5→5, ≤10.5→8, else→13)
- [x] **CALC-05**: Calc engine module has zero ADO SDK dependencies and is unit-tested with at least one assertion per Fibonacci bucket plus boundary cases at every threshold

### Audit — Comment Format & Pre-fill

- [x] **AUDIT-01**: Audit comment format is `<!-- sp-calc:v1 {"sp":N,"c":"...","u":"...","e":"...","schemaVersion":1} -->\nStory Points: N (Complexity=..., Uncertainty=..., Effort=...)`
- [x] **AUDIT-02**: Serializer produces deterministic output for a given calculation input (stable key order, no extra whitespace inside the sentinel block)
- [x] **AUDIT-03**: Parser extracts the JSON payload from a sentinel HTML comment in raw HTML, NBSP-substituted text, and ADO-renderer-wrapped output
- [x] **AUDIT-04**: Parser ignores comments without the sentinel, comments marked `isDeleted: true`, and malformed JSON; never throws on user input
- [x] **AUDIT-05**: When multiple sentinel comments exist on a work item, parser returns the most recent one (by comment `createdDate`)
- [x] **AUDIT-06**: Parser is unit-tested for: HTML-wrapped, mid-comment user edit to the human-readable line, NBSP substitution, deleted comment, multiple comments, malformed JSON
- [x] **AUDIT-07**: Round-trip property: `parse(serialize(input)) === input` holds for all valid inputs

### Field — Cross-Process Field Resolver

- [ ] **FIELD-01**: FieldResolver probes the current work item type's field list via `IWorkItemFormService.getFields()` (or equivalent SDK call) at modal open
- [ ] **FIELD-02**: FieldResolver returns `Microsoft.VSTS.Scheduling.StoryPoints` when present (Agile, Scrum, Basic processes); falls back to `Microsoft.VSTS.Scheduling.Size` (CMMI) when StoryPoints is absent
- [ ] **FIELD-03**: FieldResolver caches the resolved reference name per `(projectId, workItemTypeName)` for the lifetime of the iframe
- [ ] **FIELD-04**: When neither field is present on the work item type, the modal opens and shows a clear message explaining which work item types are supported, with a Close button. The toolbar button remains enabled.

### UI — Toolbar Button + Modal

- [x] **UI-01**: A "Calculate Story Points" entry appears in the work item toolbar menu via the `ms.vss-web.action` contribution targeting `ms.vss-work-web.work-item-toolbar-menu`
- [x] **UI-02**: Clicking the toolbar entry opens a modal via `HostPageLayoutService.openCustomDialog` referencing the `ms.vss-web.external-content` modal contribution
- [ ] **UI-03**: Modal renders three labeled dropdowns (Complexity, Uncertainty, Effort), each with the five level options, using `azure-devops-ui` Dropdown components
- [ ] **UI-04**: Modal displays a live read-only "Calculation Details" panel showing: weighted sum W (2 decimals), Raw SP (2 decimals), Final Story Points (integer or 0.5), and the formula `W = 0.4·C + 0.4·U + 0.2·E; SP = round_fib(0.5 × 26^((W−1)/4))`
- [ ] **UI-05**: Modal has Apply and Cancel buttons; Apply is disabled until all three dropdowns have a selection
- [x] **UI-06**: Modal renders correctly in both light and dark ADO themes (theme inherited from host)
- [ ] **UI-07**: Modal is fully keyboard-navigable: Tab moves between dropdowns, Enter confirms a dropdown selection, Esc cancels, Tab to Apply + Enter applies
- [ ] **UI-08**: Modal applies to work items of type User Story, Bug, Task, Feature, and Epic (and any other type that has the resolved SP field per FIELD-02)

### Apply — Read & Write Flow

- [ ] **APPLY-01**: On modal open, the read path fetches the current value of the resolved SP field via `IWorkItemFormService.getFieldValue()`
- [ ] **APPLY-02**: On modal open, the read path fetches all comments on the work item via `WorkItemTrackingRestClient.getComments()` and runs the AUDIT parser to find the most recent sentinel comment
- [ ] **APPLY-03**: When a prior sentinel comment is found, the modal pre-fills the three dropdowns from its payload
- [x] **APPLY-04**: When the current SP field already has a value, Apply shows an in-modal confirmation panel with "Current: X / New: Y" before performing the write *(Verified Phase 4 cezari 2026-05-02)*
- [x] **APPLY-05**: Apply writes the new SP value via `IWorkItemFormService.setFieldValue()` followed by `.save()` on the work item form service *(Verified Phase 4 cezari 2026-05-02)*
- [x] **APPLY-06**: Apply posts the audit comment via `WorkItemTrackingRestClient.addComment()` (API version `7.0-preview.3`) *(Verified Phase 4 cezari 2026-05-02)*
- [x] **APPLY-07**: Write atomicity ordering (comment-first vs field-first) is decided in Phase 1 planning, documented in the plan, and consistently applied across the codebase *(Verified Phase 4 cezari 2026-05-02 — comment-first → field-write per Phase 0 D-01, language-level proof via vitest mock.invocationCallOrder + production-confirmed via cezari console transcripts)*
- [x] **APPLY-08**: When the field write fails, the user sees a clear error toast and no comment is posted (or posted comment is marked accordingly per APPLY-07 decision); when the comment fails, the user sees a clear error toast and the field write is left in place *(Verified Phase 4 cezari 2026-05-02 + 398/398 unit tests)*
- [x] **APPLY-09**: When the user lacks write permission on the work item (isReadOnly=true), the modal opens and replaces the calculator UI with a clear message explaining the work item is read-only. The toolbar button remains enabled. The current Story Points value is still shown via the context line for inspection. *(Verified Phase 4 cezari 2026-05-02 — read-only-replacement UX surfaces reactively per spike A3 LAZY-FALLBACK-ONLY)*

### Pkg — Marketplace Package & Publish

- [x] **PKG-01**: `vss-extension.json` manifest is valid against current schema, contains exactly the `vso.work_write` scope, declares the toolbar action and modal external-content contributions, and includes a 128×128 icon
- [ ] **PKG-02**: Build pipeline produces a `.vsix` via `tfx-cli` with the bundled `dist/toolbar.html` (toolbar shim) and `dist/modal.html` (lazy-loaded modal) bundles
- [ ] **PKG-03**: Total bundle size is ≤ 250 KB gzipped across all entries; CI fails the build above this threshold
- [ ] **PKG-04**: Extension is installable on a fresh Azure DevOps trial organization, and a Contributor (non-admin) user can complete the full open-modal → Apply flow without permission errors
- [ ] **PKG-05**: Marketplace listing has a description, screenshots showing the modal in light and dark themes, the formula explanation, and a privacy/data-handling statement (no telemetry; data stays in the user's ADO org)
- [ ] **PKG-06**: Marketplace publisher account is registered, verified, and confirmed before the first public publish
- [ ] **PKG-07**: Extension is published as a public listing on Visual Studio Marketplace and verified to install successfully on at least two different ADO organizations (one Agile, one CMMI process)

## v2 Requirements

Deferred to future release. Tracked but not in current v1 roadmap.

### Settings — Customization

- **SETT-01**: Org Settings hub page contributed via `ms.vss-web.hub` targeting `ms.vss-web.collection-admin-hub-group` allows admins to edit organization-level defaults
- **SETT-02**: Project Settings hub page contributed via `ms.vss-web.hub` targeting `ms.vss-web.project-admin-hub-group` allows project admins to edit project-level overrides
- **SETT-03**: Settings stored in ADO Extension Data Service via `IExtensionDataService` with `Default` scope and key prefix pattern `sp-config-org` (org) and `sp-config-proj-<projectId>` (project)
- **SETT-04**: Configurable: dimension weights (must sum to 1.0), dimension count and labels (1–6 dimensions), level labels per dimension, Fibonacci threshold table (or alternate target scale)
- **SETT-05**: Effective config resolution: project override → org default → built-in v1 defaults
- **SETT-06**: Settings documents include `schemaVersion`; the modal reads schemaVersion-aware to support backward-compatible migrations
- **SETT-07**: Concurrent settings edits use optimistic concurrency via Extension Data Service `__etag`; on conflict the UI re-fetches and prompts the user

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Backend service / .NET API | Extension Data Service handles all v2 storage; no infra needed; static `.vsix` only |
| Localization beyond English (Georgian, Russian) | User-chosen English-only; ADO Georgian rendering quality is poor |
| Process-customized SP field rename support | Some orgs rename `StoryPoints` via process customization; FieldResolver covers standard fields only — revisit post-launch if reported |
| Bulk calculation across multiple work items | Single-item modal only; bulk estimation is a different UX |
| Estimation history / timeline UI | Audit info lives in comments; no dedicated history panel in v1 or v2 |
| Approval workflow (PO/Scrum Master sign-off) | User confirmation only; explicit decision per PROJECT.md Key Decisions |
| Auto-calculate on field change | Always user-triggered via toolbar action |
| Multi-user real-time Planning Poker mode | Different product category; this is a single-user structured calculator |
| Component / E2E tests in v1 | Manual QA covers UI per company standard; only calc and parser logic are automated |
| Telemetry / analytics on user behavior | Privacy-positive listing (no telemetry); revisit only if Marketplace listing requires usage stats |
| Backward compatibility with the legacy `vss-web-extension-sdk` | Greenfield project; modern v4 SDK only |
| Angular-based UI | `azure-devops-ui` is React-only; native ADO chrome requires React |
| Telemetry on calc errors | Calc engine is pure and unit-tested; runtime calc errors should be impossible by construction |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CALC-01 | Phase 1 | Complete |
| CALC-02 | Phase 1 | Complete |
| CALC-03 | Phase 1 | Complete |
| CALC-04 | Phase 1 | Complete |
| CALC-05 | Phase 1 | Complete |
| AUDIT-01 | Phase 1 | Complete |
| AUDIT-02 | Phase 1 | Complete |
| AUDIT-03 | Phase 1 | Complete |
| AUDIT-04 | Phase 1 | Complete |
| AUDIT-05 | Phase 1 | Complete |
| AUDIT-06 | Phase 1 | Complete |
| AUDIT-07 | Phase 1 | Complete |
| FIELD-01 | Phase 3 | Pending |
| FIELD-02 | Phase 3 | Pending |
| FIELD-03 | Phase 3 | Pending |
| FIELD-04 | Phase 3 | Pending |
| UI-01 | Phase 2 | Complete |
| UI-02 | Phase 2 | Complete |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 2 | Complete |
| UI-07 | Phase 3 | Pending |
| UI-08 | Phase 3 | Pending |
| APPLY-01 | Phase 3 | Pending |
| APPLY-02 | Phase 3 | Pending |
| APPLY-03 | Phase 3 | Pending |
| APPLY-04 | Phase 4 | Complete |
| APPLY-05 | Phase 4 | Complete |
| APPLY-06 | Phase 4 | Complete |
| APPLY-07 | Phase 4 | Complete |
| APPLY-08 | Phase 4 | Complete |
| APPLY-09 | Phase 4 | Complete |
| PKG-01 | Phase 0 | Complete |
| PKG-02 | Phase 5 | Pending |
| PKG-03 | Phase 5 | Pending |
| PKG-04 | Phase 5 | Pending |
| PKG-05 | Phase 5 | Pending |
| PKG-06 | Phase 5 | Pending |
| PKG-07 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

**Per-phase distribution:**
- Phase 0 (Bootstrap): 1 requirement (PKG-01)
- Phase 1 (Calc Engine & Audit Parser): 12 requirements (CALC-01..05, AUDIT-01..07)
- Phase 2 (Manifest Shell & SDK Integration): 3 requirements (UI-01, UI-02, UI-06)
- Phase 3 (Modal UI & Read Path): 12 requirements (UI-03, UI-04, UI-05, UI-07, UI-08, FIELD-01..04, APPLY-01, APPLY-02, APPLY-03)
- Phase 4 (Write Path & Edge Cases): 6 requirements (APPLY-04..09)
- Phase 5 (Polish & Marketplace Publish): 6 requirements (PKG-02..07)

---
*Requirements defined: 2026-05-01*
*Last updated: 2026-05-01 — traceability filled by roadmapper; 40/40 v1 requirements mapped to 6 phases*
