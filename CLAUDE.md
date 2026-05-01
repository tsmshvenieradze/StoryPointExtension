<!-- GSD:project-start source:PROJECT.md -->
## Project

**Story Point Calculator (Azure DevOps Extension)**

An Azure DevOps work item extension that lets users estimate Story Points using a structured 3-dimension calculator (Complexity, Uncertainty, Effort) instead of free-form guessing. It ports an existing Excel-based calculator (`sp_calculator.xlsx`) into a modal accessible from the work item form, writes the result directly to the Story Points field, and leaves an audit comment so anyone can later see how the number was derived. Built for engineering teams using Azure Boards; published to the Visual Studio Marketplace.

**Core Value:** **A team member can produce a justified, reproducible Story Points value for any work item in under 30 seconds, without leaving the work item form.**

If everything else fails, this must work: open work item → click button → answer 3 questions → SP appears in the field with a comment explaining why.

### Constraints

- **Tech stack — Frontend**: React 18 + TypeScript + `azure-devops-ui` (official Microsoft component library) — required for visual consistency with ADO and SDK integration
- **Tech stack — Org standard divergence**: GPIH org standard is Angular 19, but ADO native components are React-only. React is required here. This is a single-purpose extension, not a candidate for sharing the org's Angular component library.
- **Distribution**: Visual Studio Marketplace public listing — no infrastructure to host
- **Storage**: ADO Extension Data Service only (no external DB, no backend API) — keeps install-and-go UX
- **Browser compatibility**: Whatever Azure DevOps supports (modern Chromium, Firefox, Safari)
- **Permissions**: Extension scopes limited to `vso.work_write` (read/write work items) and extension data scopes; no broader org-level permissions requested
- **Bundle size**: Keep extension `.vsix` lean — load time directly impacts work item form responsiveness
- **Calculation precision**: Use floating-point math; final SP is integer (Fibonacci); intermediate values displayed to 2 decimals
- **Testing**: Manual QA does UI testing per company standard; only formula logic is unit-tested
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Verification Gap (Read First)
- **Choice:** how sure I am we should use this package at all
- **Version:** how sure I am the pinned number is current as of May 2026
## Recommended Stack
### Core ADO Extension SDK
| Package | Version (floor) | Purpose | Choice / Version confidence |
|---------|-----------------|---------|------|
| `azure-devops-extension-sdk` | `^4.0.2` | Host-iframe handshake, `SDK.init()`, `SDK.ready()`, `SDK.getService()`, `SDK.getConfiguration()`, `SDK.notifyLoadSucceeded()` | HIGH / MEDIUM |
| `azure-devops-extension-api` | `^4.255.0` (or `^4.x` latest) | Typed clients for Work Item Tracking, Core, Identities, Extension Data | HIGH / MEDIUM |
| Need | Service / Client | Method |
|------|------------------|--------|
| Get current work item ID + field values | `IWorkItemFormService` (via `SDK.getService("ms.vss-work-web.work-item-form")`) | `getId()`, `getFieldValues([...])`, `getWorkItemType()` |
| Read/write Story Points field on the open form | Same `IWorkItemFormService` | `setFieldValue("Microsoft.VSTS.Scheduling.StoryPoints", value)` — preferred over REST when the form is open (writes to in-memory state, persists on user Save) |
| Force-persist without user Save | `WorkItemTrackingRestClient.updateWorkItem(...)` from `azure-devops-extension-api/WorkItemTracking` | `updateWorkItem(patchDoc, id, project)` with JSON-Patch `{ op: "replace", path: "/fields/Microsoft.VSTS.Scheduling.StoryPoints", value }` |
| Post comment | `WorkItemTrackingRestClient.addComment(request, project, workItemId)` (uses the v2 comments REST endpoint, not the legacy `System.History` field) | — |
| Read user permissions / identity | `SDK.getUser()` for the current user; `CoreRestClient` for project info | — |
| Read/write per-org and per-project config | `IExtensionDataService` (via `SDK.getService("ms.vss-features.extension-data-service")`), then `getExtensionDataManager(extId, accessToken)` and use `getValue/setValue` with `scopeType: "Default"` (org) or `scopeType: "Project"` (project) | — |
### UI Library
| Package | Version (floor) | Purpose | Choice / Version confidence |
|---------|-----------------|---------|------|
| `azure-devops-ui` | `^2.259.0` (or `^2.x` latest) | Native ADO components — `Dialog`, `Dropdown`, `Button`, `MessageCard`, `FormItem`, `Toggle`, `Spinner` | HIGH / MEDIUM |
| `react` | `^18.3.1` | Required by `azure-devops-ui` | HIGH / HIGH |
| `react-dom` | `^18.3.1` | Required by `azure-devops-ui` | HIGH / HIGH |
| Option | Native ADO look | Bundle size | Maintenance status | Verdict |
|--------|-----------------|-------------|--------------------|---------|
| `azure-devops-ui` | Yes — pixel-identical to ADO chrome, inherits theme via `applyTheme: true` | ~150–250 KB minified+gzipped depending on tree-shaking | Low-velocity but Microsoft still publishes patches (~quarterly); used by Microsoft's own sample repo | **Use this** |
| Fluent UI v9 (`@fluentui/react-components`) | Close but not identical (Fluent v9 is the Microsoft 365 design language; ADO has its own derivative) | Heavier (~400 KB+ for full set) | Actively maintained | Don't — visual mismatch with surrounding form chrome |
| Fluent UI v8 (`@fluentui/react`) | Closer than v9 (older shared lineage with ADO UI) | Heavy (~500 KB) | Maintenance mode | Don't — being phased out |
| Custom CSS / headless | Total control | Smallest possible | You own it | Don't — a 30-second utility doesn't justify a custom design system, and you'd lose theme inheritance |
- **Not actively developed** — release cadence has slowed since ~2022. Issues on the GitHub repo go unanswered for months. Treat it as "stable but frozen" — fine for a small extension, painful for a large product.
- **Sass + CSS modules** at build time. Your bundler MUST handle `.scss` imports from `node_modules/azure-devops-ui/...`. With webpack this means `sass-loader` + `css-loader` + `style-loader`; with vite it's built-in.
- **No types for some sub-paths** — occasional `// @ts-ignore` needed when importing leaf components.
- **React 18 only** — does NOT support React 19 as of this research. If npm shows a 2.260+ that adds React 19 peer support, use it; otherwise pin React 18.
### Build Tooling
| Tool | Version (floor) | Purpose | Choice / Version confidence |
|------|-----------------|---------|------|
| `webpack` | `^5.97.0` | Bundler — produces one IIFE per HTML entry (modal, settings hub) | HIGH / MEDIUM |
| `webpack-cli` | `^5.1.4` | CLI | HIGH / HIGH |
| `ts-loader` | `^9.5.1` | TypeScript transpilation | HIGH / MEDIUM |
| `sass-loader` | `^16.0.0` | Required by `azure-devops-ui` SCSS | HIGH / MEDIUM |
| `css-loader` | `^7.1.2` | CSS module resolution | HIGH / HIGH |
| `style-loader` | `^4.0.0` | Inject CSS at runtime (extension iframes can't share a stylesheet with the host) | HIGH / HIGH |
| `html-webpack-plugin` | `^5.6.3` | One HTML file per contribution entry (calculator modal, org settings, project settings) | HIGH / HIGH |
| `copy-webpack-plugin` | `^12.0.2` | Copy `vss-extension.json`, `images/`, `README.md` into `dist/` for `tfx-cli` to package | HIGH / HIGH |
| Bundler | Pros for ADO extension | Cons | Verdict |
|---------|------------------------|------|---------|
| **webpack 5** | Microsoft's official sample (`microsoft/azure-devops-extension-sample`) uses webpack; multi-entry HTML support is mature; `azure-devops-ui` SCSS pipeline is webpack-tested | Slower dev rebuilds; verbose config | **Use this** for v1 — least friction, exact match to Microsoft sample |
| vite | Faster dev, modern defaults | Multi-HTML-entry pattern works but isn't as documented for extensions; `azure-devops-ui` SCSS imports occasionally need vendor pre-bundle hints; smaller community of "vite + ADO extension" examples | Defer to v2 if perf becomes an issue |
| esbuild (raw) | Fastest | No HTML plugin story; no SCSS out of the box; you'd reinvent what webpack gives you | Don't |
### Language / Type System
| Package | Version (floor) | Purpose | Choice / Version confidence |
|---------|-----------------|---------|------|
| `typescript` | `^5.6.3` | Language | HIGH / MEDIUM |
| `@types/react` | `^18.3.12` | React 18 types | HIGH / MEDIUM |
| `@types/react-dom` | `^18.3.1` | React 18 DOM types | HIGH / MEDIUM |
### Testing
| Package | Version (floor) | Purpose | Choice / Version confidence |
|---------|-----------------|---------|------|
| `vitest` | `^2.1.0` | Unit tests for pure calc logic | HIGH / MEDIUM |
| `@vitest/coverage-v8` | `^2.1.0` | Coverage | HIGH / MEDIUM |
- The thing under test is a *pure function* (level → score → weighted sum → Fibonacci round). No DOM, no SDK, no React. Either runner works.
- Vitest is faster, has zero-config TypeScript, and uses the same ESM module graph as the production build (no `transform-jest` jiggery-pokery for ESM). Jest is fine but adds `ts-jest` or `babel-jest` configuration that you don't need.
- The project has explicitly scoped UI/E2E tests as out-of-scope (manual QA per company standard), so you don't need jest's ecosystem of React Testing Library plugins.
### Packaging & Publishing
| Tool | Version (floor) | Purpose | Choice / Version confidence |
|------|-----------------|---------|------|
| `tfx-cli` | `^0.21.0` (or latest `^0.x`) | Pack `.vsix`, publish to Marketplace | HIGH / MEDIUM |
### Publisher Registration & First Publish (One-Time, ~30 min)
### CI/CD (Azure Pipelines)
| Task / Tool | Purpose | Confidence |
|-------------|---------|------------|
| `npm ci` | Reproducible install | HIGH |
| `npm run typecheck` (`tsc --noEmit`) | Type gate | HIGH |
| `npm test` (`vitest run`) | Unit gate | HIGH |
| `npm run build` (`webpack --mode production`) | Bundle | HIGH |
| `TfxInstaller@5` Azure Pipelines task | Install `tfx-cli` on the agent | HIGH |
| `PackageAzureDevOpsExtension@5` task | Pack `.vsix` from `vss-extension.json` (auto-bumps patch version if configured) | HIGH |
| `PublishAzureDevOpsExtension@5` task | Push `.vsix` to Marketplace using a service connection (PAT-backed) | HIGH |
## Alternatives Considered (Summary)
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Extension SDK | `azure-devops-extension-sdk` v4 | `vss-web-extension-sdk` v5 | Legacy AMD/RequireJS; Microsoft samples have moved on |
| UI library | `azure-devops-ui` 2.x | Fluent UI v9 | Visual mismatch with ADO chrome |
| UI library | `azure-devops-ui` 2.x | Fluent UI v8 | Maintenance mode; same visual issue |
| UI framework | React 18 | Angular 19 (org standard) | `azure-devops-ui` is React-only; no Angular path to native ADO look |
| Bundler | webpack 5 | vite | Less established for multi-HTML-entry ADO extensions |
| Bundler | webpack 5 | esbuild raw | Missing HTML/SCSS plugins |
| Test runner | vitest | jest | More config for ESM/TS; no advantage for pure-logic tests |
| Packaging | `tfx-cli` | (none — no real alternative) | Microsoft's only `.vsix` packager |
## Installation (Phase 1 Bootstrap)
# Core runtime + SDK
# Build / dev tooling
# Test
# Packaging
## Sources & Confidence Notes
| Claim | Source class | Confidence |
|-------|--------------|------------|
| Use `azure-devops-extension-sdk` v4 over `vss-web-extension-sdk` v5 | Microsoft's `microsoft/azure-devops-extension-sample` repo (training data) | HIGH |
| `azure-devops-ui` is React-only and not actively developed | GitHub repo issue activity (training data) | HIGH |
| Webpack 5 is the de facto bundler for ADO extensions | Microsoft sample repo (training data) | HIGH |
| `vso.work_write` covers field write + comment posting | ADO REST API scopes documentation (training data) | HIGH |
| Exact npm version numbers in tables | npm registry — **NOT re-verified** in this run | MEDIUM (treat as floors) |
| Marketplace publisher flow steps | Marketplace docs (training data, UI may have changed) | MEDIUM |
| `PublishAzureDevOpsExtension@5` task version | `ms-devlabs` extension catalog | MEDIUM (could be @4 or @5) |
| ADO supports only evergreen browsers (no polyfills) | ADO system requirements page (training data) | HIGH |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
