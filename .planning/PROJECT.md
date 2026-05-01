# Story Point Calculator (Azure DevOps Extension)

## What This Is

An Azure DevOps work item extension that lets users estimate Story Points using a structured 3-dimension calculator (Complexity, Uncertainty, Effort) instead of free-form guessing. It ports an existing Excel-based calculator (`sp_calculator.xlsx`) into a modal accessible from the work item form, writes the result directly to the Story Points field, and leaves an audit comment so anyone can later see how the number was derived. Built for engineering teams using Azure Boards; published to the Visual Studio Marketplace.

## Core Value

**A team member can produce a justified, reproducible Story Points value for any work item in under 30 seconds, without leaving the work item form.**

If everything else fails, this must work: open work item → click button → answer 3 questions → SP appears in the field with a comment explaining why.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**v1 — Core calculator (fixed formula):**

- [ ] Toolbar button "Calculate Story Points" appears on work item form for User Story, Bug, Task, Feature/Epic
- [ ] Modal with 3 dropdowns: Complexity, Uncertainty, Effort — each with 5 levels (Very Easy → Very Hard)
- [ ] Modal displays intermediate values: weighted sum W, Raw SP, Final Fibonacci SP, and the formula itself
- [ ] Apply writes Story Points field on the work item via ADO REST API
- [ ] Apply adds an audit comment in the form `SP=5 (C=Hard, U=Medium, E=Easy)`
- [ ] If SP already exists, modal warns and shows "Current: X / New: Y" before overwrite
- [ ] If a prior SP audit comment exists, modal pre-fills the dropdowns from it
- [ ] Calculation logic matches `sp_calculator.xlsx` exactly (W = 0.4·C + 0.4·U + 0.2·E; SP = 0.5 × 26^((W−1)/4); rounded to Fibonacci 0.5/1/2/3/5/8/13)
- [ ] Unit tests cover the calculation pipeline (level→score, weighted sum, raw SP, Fibonacci rounding)
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
- **Custom Story Points field** — Always writes the standard `Microsoft.VSTS.Scheduling.StoryPoints` field; no support for org-specific custom fields in v1/v2
- **Bulk calculation across multiple items** — Single-item modal only; bulk estimation is a different UX
- **Estimation history/timeline UI** — Audit info lives in comments; no dedicated history panel
- **Approval workflow** — User confirmation only; no PO/Scrum Master approval gate
- **Auto-calculate on field change** — Always user-triggered via toolbar button
- **Component / E2E tests in v1** — Manual testers cover UI per org standard; only calc logic is automated
- **Microsoft Marketplace listing assets (icons, screenshots, marketing copy)** — Treated as a publish-time task, not a feature

## Context

**Existing artifact:** `sp_calculator.xlsx` defines the formula and is the source of truth for v1 calculation logic. Excel structure: 3 dropdowns (Complexity, Uncertainty, Effort), each with 5 weighted levels, computing a weighted sum that maps to a Fibonacci scale.

**Domain:** Azure DevOps web extensions are SPA-style React apps loaded into Azure Boards via the VSS Web Extension SDK. They authenticate using the host's session and access work item data through the official `azure-devops-extension-api` client. Work item form contributions can be `ms.vss-work-web.work-item-form-toolbar-button` (button) or `ms.vss-work-web.work-item-form-group` (inline panel). Settings hubs use `ms.vss-web.hub` contributions targeting `ms.vss-admin-web.collection-admin-hub` (Org Settings) or `ms.vss-admin-web.project-admin-hub` (Project Settings).

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
| Audit comment as both audit log AND pre-fill source | Avoids extra storage layer; single source of truth for calculation history | — Pending |
| v1 ships fixed formula, v2 adds customization | De-risks v1 launch; validates core flow before paying customization complexity | — Pending |
| ADO Extension Data Service for v2 settings | Zero infra; built-in multi-tenancy; aligns with marketplace install-and-go expectation | — Pending |
| Org Settings + Project Settings hubs (v2) | Mirrors how ADO settings work for other features; project override is standard ADO pattern | — Pending |
| Unit tests for calc logic only | Manual QA covers UI per company standard; calc logic is pure function and worth automating | — Pending |
| Parse audit comment for pre-fill (not separate storage) | Closes the loop with the audit trail; no schema migration risk | — Pending |
| Toolbar button (not inline form group) | Modal is the right UX for question-answer flow; toolbar is the standard ADO pattern for actions | — Pending |

**Open questions / risks:**

- **Marketplace publisher account** — User unsure if GPIH already has a Marketplace publisher. Must be resolved before publish phase. (Free, ~1 day verification if missing.)
- **Custom Story Points field handling** — Some orgs rename `Microsoft.VSTS.Scheduling.StoryPoints` or use a different field via process customization. v1 assumes standard field; revisit if reported by users post-launch.

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
*Last updated: 2026-05-01 after initialization*
