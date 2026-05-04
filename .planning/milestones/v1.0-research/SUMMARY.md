# Project Research Summary

**Project:** Story Point Calculator (Azure DevOps Extension)
**Domain:** Azure DevOps work item web extension — public Visual Studio Marketplace
**Researched:** 2026-05-01
**Confidence:** MEDIUM-HIGH (architecture HIGH; stack/features/pitfalls MEDIUM due to no live web access during research)

---

## Executive Summary

This is a single-purpose Azure DevOps work item extension: a toolbar button that opens a modal calculator, accepts three dimension inputs (Complexity, Uncertainty, Effort), computes a Fibonacci story point value via a weighted formula, writes it to the work item's Story Points field, and posts a structured audit comment. The extension ships as a static `.vsix` bundle to the Visual Studio Marketplace — no backend, no infra. The entire runtime consists of sandboxed iframes coordinated through Microsoft's ADO Extension SDK postMessage bridge.

The recommended approach is to build the pure calculation engine first (zero ADO dependencies, fully unit-tested against the existing `sp_calculator.xlsx`), then establish the iframe shell and toolbar contribution early in Phase 1 because the manifest/SDK integration is the single highest-risk step — it must fail fast, not late. All user-facing React UI and ADO bridge work follows once the iframe lifecycle is confirmed. The comment format must be specified and locked in Phase 1 as a wire format, not deferred to polish; choosing the wrong shape now creates a data-migration problem across every install. Research identifies five hard blockers that must not slip past Phase 1: FieldResolver abstraction (CMMI support), sentinel comment format, manifest scope lock, SDK lifecycle correctness, and pre-flight permission checks.

The primary risk is invisible integration failure: the ADO Extension SDK silently does nothing when misconfigured (wrong contribution IDs, missing `await SDK.ready()`, wrong `register()` ID, missing `notifyLoadSucceeded()`). A secondary risk is marketplace-first-publish failure from unverified publisher account, incorrect contribution IDs in the manifest, or scope additions post-publish triggering forced re-consent. Both risks are mitigated by failing fast on integration (step 3 of 10 in the recommended build order) and treating publisher account setup as Phase 0 / Phase 1 work, not a publish-time task.

---

## Stack

The ADO extension stack is React-specific and non-negotiable for this type of project. `azure-devops-ui` is React-only with no Angular equivalent that matches ADO chrome — this is the justified divergence from GPIH's Angular 19 org standard. The new SDK pair (`azure-devops-extension-sdk` v4 + `azure-devops-extension-api` v4) is the current Microsoft-recommended path; the legacy `vss-web-extension-sdk` (v5, AMD/RequireJS) must not be used for greenfield projects.

**Core technologies:**
- `azure-devops-extension-sdk` v4 — host-iframe handshake, service access — only modern SDK with ES module support
- `azure-devops-extension-api` v4 — typed REST clients (WorkItemTracking, ExtensionData) — eliminates hand-rolled fetch/auth
- `azure-devops-ui` v2 + React 18 — pixel-identical ADO chrome, theme inheritance — only option for native look
- webpack 5 — bundler — exact match to Microsoft's official sample repo; multi-HTML-entry support is mature
- vitest v2 — unit test runner — zero-config TypeScript, ESM-native, correct for pure-function tests
- `tfx-cli` v0.21+ — `.vsix` packager — Microsoft's only packaging tool

**Version caveat (mandatory Phase 1 gate):** All version numbers are training-data-derived floors. Before writing `package.json`, run `npm view <pkg> version` for `azure-devops-extension-sdk`, `azure-devops-extension-api`, `azure-devops-ui`, and `tfx-cli`.

---

## Differentiators

The ADO estimation marketplace is dominated by multi-user Planning Poker rooms. No widely-installed extension uses a dimension-weighted formula (Complexity × Uncertainty × Effort → Fibonacci). This formula UX is the genuine moat.

**Must-have (table stakes):** opens from inside work item form, writes `Microsoft.VSTS.Scheduling.StoryPoints`, Fibonacci output scale, works on User Story/Bug/Task/Feature/Epic, loads in under 2 seconds, confirm-before-overwrite showing "Current: X / New: Y", graceful handling when SP field missing (disable + tooltip), permission-aware disabled state.

**Differentiators this extension can own:** intermediate value display (W, Raw SP, formula), sentinel audit comment with round-trip parsing, pre-fill from prior comment, single-user async flow (no room required), keyboard-only Tab/Enter navigation, dark-theme parity.

**Defer to v2:** configurable weights, dimensions, level labels, Fibonacci thresholds, Org/Project Settings hubs.

---

## Critical Pitfalls

1. **Hardcoded Story Points field reference name (Pitfalls 1, 17)** — CMMI uses `Microsoft.VSTS.Scheduling.Size`. Without `FieldResolver`, v1 breaks on first CMMI customer. Mandatory v1, not v2. Probe type definition at runtime, cache per (project, type), disable button with tooltip if no field found.

2. **Fragile audit comment format (Pitfall 2)** — The naive `SP=5 (C=Hard, U=Medium, E=Easy)` format in PROJECT.md is too fragile. ADO HTML-wraps comment text, users edit comments, NBSP substitution breaks parsing. Wire format: `<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->` plus human-readable line. This is a Phase 1 spec decision — wrong shape now = data migration across every install later.

3. **SDK silent failure patterns (Pitfalls 6, 20, 21)** — Wrong contribution IDs, services called before `await SDK.ready()`, wrong registration instance ID, missing `notifyLoadSucceeded()`, double `SDK.init()` all fail silently. Mitigation: single bootstrap function per iframe, fail-fast integration test as step 3 of build order (before any React UI work).

4. **Manifest contribution IDs incorrect in PROJECT.md** — Six errors in the current PROJECT.md Context section use IDs that do not exist in Microsoft's documentation. Using them means the extension will not load. All corrections are listed in the PROJECT.md Corrections section below.

5. **Manifest scope lock before first publish (Pitfall 3)** — Adding or changing scopes post-publish forces re-consent across every install; extensions are auto-disabled until reauthorized. Lock `["vso.work_write"]` as the only scope before first public publish.

---

## Architecture Highlights

The extension is four sandboxed iframes with no shared memory — coordination is exclusively through the SDK postMessage bridge. Each iframe runs `SDK.init()` independently with its own webpack bundle entry.

**Manifest contributions (verified IDs):**

```json
{
  "contributions": [
    {
      "id": "calc-sp-action",
      "type": "ms.vss-web.action",
      "targets": ["ms.vss-work-web.work-item-toolbar-menu"],
      "properties": { "uri": "dist/toolbar.html", "registeredObjectId": "calc-sp-action" }
    },
    {
      "id": "calc-sp-modal",
      "type": "ms.vss-web.external-content",
      "properties": { "uri": "dist/modal.html" }
    }
  ]
}
```

**Atomicity:** `IWorkItemFormService.setFieldValue()` + `.save()` for field write (not REST PATCH — REST PATCH bypasses form validation and causes revision conflicts while the form is open). Comments via `WorkItemTrackingRestClient.addComment()`. Field write and comment are two separate calls and cannot be atomic.

**Extension Data Service scopes:** Only `Default` (collection-wide) and `User` (per-user) exist. Project-level isolation requires key-prefixing (`sp-config-proj-<projectId>`), not a built-in scope.

**Modal flow:** 3 coordinated iframes — hidden toolbar-action iframe calls `HostPageLayoutService.openCustomDialog('calc-sp-modal', { configuration: { workItemId } })` — modal reads `SDK.getConfiguration().workItemId` synchronously after `SDK.ready()`.

---

## PROJECT.md Corrections Required

| PROJECT.md says | Correct value |
|---|---|
| Contribution type `ms.vss-work-web.work-item-form-toolbar-button` | `ms.vss-web.action` targeting `ms.vss-work-web.work-item-toolbar-menu` |
| Settings hub target `ms.vss-admin-web.collection-admin-hub` | `ms.vss-web.collection-admin-hub-group` |
| Settings hub target `ms.vss-admin-web.project-admin-hub` | `ms.vss-web.project-admin-hub-group` |
| Extension Data Service has project-level scope | No built-in project scope. Project isolation = key prefix `sp-config-proj-<projectId>` |
| Modal loaded by opening its `uri` directly | Modal must be an `ms.vss-web.external-content` contribution; `openCustomDialog` takes contribution ID |
| Apply uses REST PATCH to write the field | Use `IWorkItemFormService.setFieldValue()` + `.save()` — REST PATCH while form is open causes conflicts |

Also: Comments REST API is `7.0-preview.3` and has never graduated out of preview — document as accepted preview dependency.

---

## Scope Expansions for v1

### 1. FieldResolver (mandatory v1, not v2)
PROJECT.md defers custom field support to out of scope. Research shows CMMI process uses `Microsoft.VSTS.Scheduling.Size`, not `StoryPoints` — this is a standard Microsoft process, not a customization. Without `FieldResolver`, v1 breaks on first CMMI customer. Implementation: probe type definition, check prioritized list (`StoryPoints` → `Size`), cache per (project, type), disable button with tooltip if absent. Approximately 2 hours of implementation.

### 2. Sentinel comment format (mandatory v1)
PROJECT.md specifies `SP=5 (C=Hard, U=Medium, E=Easy)`. Research shows this is too fragile for production. Required format:
```
<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->
Story Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)
```
HTML comment block survives ADO renderer (hidden from display, preserved in API response). Users can edit the human-readable line without breaking machine-parseable payload. `schemaVersion` enables v2 dimension additions without breaking v1 comment parsing. Parser must be unit-tested against: HTML-wrapped, mid-comment edits, deleted comments, NBSP, multiple comments (take newest valid), `isDeleted: true` filtering.

---

## Open Conflicts — Decisions to Make in Phase 1

### Write Atomicity Ordering: comment-first vs field-first

Two well-reasoned positions directly contradict each other:

**ARCHITECTURE.md recommends: comment first, then field write.**
Rationale: A comment without a field write is recoverable — user re-opens modal, parser finds comment, pre-fills dropdowns, user clicks Apply again. A field write without a comment leaves SP set but with no provenance and no pre-fill source. Comment POST (REST) is more likely to fail than the in-memory field set.

**PITFALLS.md (Pitfall 12) recommends: field write first, comment second.**
Rationale: SP value is the primary outcome; comment is supplementary. "No audit comment" is recoverable — user can re-run. An orphan comment claiming SP=5 when the field write failed "lies" and erodes trust.

The planner phase must decide based on what failure mode is more recoverable for THIS extension's audit comment scheme. Key question: how critical is the audit comment as the pre-fill source? If every lost comment means lost pre-fill context for the next user, comment-first is stronger. If comment failures are rare and the SP value matters more than the trail, field-first wins. This must be decided and documented before the ADO bridge is written.

---

## Verification Gates

| Gate | Phase | Action |
|---|---|---|
| npm version verification | Phase 0 (before writing package.json) | `npm view` for `azure-devops-extension-sdk`, `azure-devops-extension-api`, `azure-devops-ui`, `tfx-cli` |
| Marketplace publisher account | Phase 0 (not publish time) | Verify GPIH publisher exists at `marketplace.visualstudio.com/manage`; 24h verification window if missing |
| Manifest integration test | Phase 1 step 3 (before any React UI work) | Minimal manifest deployed to dev org; button appears; `execute()` fires on click |
| Sentinel comment round-trip test | Phase 1 (before writing ADO bridge) | `serialize(parse(serialize(input))) === serialize(input)` passes with all edge case inputs |
| Scope lock confirmation | Before first public publish | Manifest has exactly `["vso.work_write"]`; confirmed against Marketplace install prompt on trial org |
| Private install smoke test | Before setting `public: true` | Install on fresh trial org as non-admin Contributor; toolbar appears, modal opens, Apply writes field and comment |

---

## Recommended Phase Ordering

### Phase 0 — Prerequisites (1-2 days)
Publisher verification (24h wait time), `npm view` version checks, write atomicity decision, PROJECT.md corrections.

### Phase 1 — Calc Engine + Parser (1-2 days)
Pure `calcEngine.ts` unit-tested against `sp_calculator.xlsx`. Pure `auditComment.ts` serializer/parser with sentinel format and full edge-case unit test suite. `FieldResolver` stub. Locks wire format before any ADO surface is touched.

### Phase 2 — Manifest Shell + SDK Integration (1-2 days)
Corrected manifest deployed to dev org. Toolbar button appears. Click fires `execute()`. `openCustomDialog` opens a Hello World modal with confirmed theme inheritance. This is the highest-risk integration point — fail fast here before any React UI work.

### Phase 3 — Modal UI + Read Path (2-3 days)
React UI wired to calc engine: 3 dropdowns, intermediate value display (W, Raw SP, formula), overwrite warning. ADO bridge read path: `IWorkItemFormService.getFieldValue()`, comment fetch, pre-fill from prior sentinel comment.

### Phase 4 — Write Path + Edge Cases (2-3 days)
`setFieldValue()` + `.save()`. Comment POST. Pre-flight permission check. `FieldResolver` CMMI support. Friendly error messages for all 4xx/412/RuleValidationException. Confirm-overwrite with diff. Disabled state when field absent. Stakeholder and read-only item handling.

### Phase 5 — Polish + Performance + Marketplace Assets (2-3 days)
Two-bundle architecture (toolbar shim + lazy modal). Tree-shaken `azure-devops-ui` imports. CI bundle size gate (250 KB gzipped). Dark theme verification. Keyboard-only flow. 128x128 icon. Marketplace listing assets. Private install smoke test before `public: true`.

### Phase 6 — v2 Settings (future, separate motion)
Org Settings hub, Project Settings hub, key-prefix scoping pattern, ETag concurrency, schema-versioned config documents.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (manifest shell):** Cross-check corrected contribution IDs against current `learn.microsoft.com/azure/devops/extend/reference/targets/overview` at implementation time — Marketplace target IDs have changed before.
- **Phase 4 (write path):** Comments API `7.0-preview.3` — verify not deprecated at implementation time. Verify `IWorkItemFormService.setFieldValue()` return value behavior on current SDK version.
- **Phase 6 (v2 settings):** EDS scoping and `__etag` semantics — re-verify against current docs before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (calc engine):** Pure TypeScript with vitest; no ADO surface; well-documented patterns.
- **Phase 5 (bundle/publishing):** webpack multi-entry, tfx-cli, Marketplace publish flow are stable.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Package choices HIGH; version numbers MEDIUM — require `npm view` in Phase 0 |
| Features | MEDIUM-HIGH | Table stakes and differentiators HIGH; specific Marketplace install counts LOW |
| Architecture | HIGH | Contribution IDs, SDK lifecycle, service names verified against Microsoft Learn docs (2026-04) |
| Pitfalls | MEDIUM-HIGH | SDK/manifest pitfalls HIGH; Marketplace edge cases and tenant field variation MEDIUM |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Version numbers are training-data floors — Phase 0 `npm view` mandatory
- Publisher account status unknown — confirm before Phase 1 begins
- CMMI process FieldResolver behavior should be validated against a real CMMI org before GA
- Comments API `7.0-preview.3` — verify not deprecated at implementation time
- Sentinel comment behavior in markdown-mode ADO orgs — test both markdown-on and markdown-off before publish
- Write atomicity ordering — unresolved conflict; must be decided in Phase 0

---

## Sources

**Primary (HIGH):** Microsoft Learn — Extend the work item form, Extensibility Points reference, Extension Manifest reference, Data and Setting Storage, SDK JS API reference, IWorkItemFormService reference, Comments REST API, CommonServiceIds reference (all verified 2026-04). `microsoft/azure-devops-extension-sample` GitHub repo.

**Secondary (MEDIUM):** Visual Studio Marketplace extension survey (training data); npm registry version floors (training data, not re-verified); Marketplace publisher portal docs.

**Tertiary (LOW):** Specific install counts and star ratings for competing extensions — require re-verification at `marketplace.visualstudio.com` before publish.

---
*Research completed: 2026-05-01*
*Ready for roadmap: yes*
