# Technology Stack

**Project:** Story Point Calculator (Azure DevOps Extension)
**Researched:** 2026-05-01
**Researcher:** gsd-project-researcher (stack dimension)
**Overall confidence:** MEDIUM (see "Verification Gap" below)

---

## Verification Gap (Read First)

The research environment for this run had **WebFetch, WebSearch, Context7 (MCP), and general Bash all denied by sandbox policy**. That means none of the version numbers below were re-verified against the live npm registry or Microsoft docs during this research pass — they come from Claude's training data (cutoff January 2026) and the well-known release cadence of these packages.

**Implication for the roadmap:** Treat the versions in the tables below as *floors* (i.e., "at least this version, probably current"), not as locked pins. Phase 1 (Bootstrap) MUST include a one-shot `npm view <pkg> version` check for each package below before writing them into `package.json`. The choice of *package* and the rationale for each is HIGH confidence; the *exact version string* is MEDIUM confidence.

Confidence labels on every table reflect this split:
- **Choice:** how sure I am we should use this package at all
- **Version:** how sure I am the pinned number is current as of May 2026

---

## Recommended Stack

### Core ADO Extension SDK

| Package | Version (floor) | Purpose | Choice / Version confidence |
|---------|-----------------|---------|------|
| `azure-devops-extension-sdk` | `^4.0.2` | Host-iframe handshake, `SDK.init()`, `SDK.ready()`, `SDK.getService()`, `SDK.getConfiguration()`, `SDK.notifyLoadSucceeded()` | HIGH / MEDIUM |
| `azure-devops-extension-api` | `^4.255.0` (or `^4.x` latest) | Typed clients for Work Item Tracking, Core, Identities, Extension Data | HIGH / MEDIUM |

**Why these two and not the legacy `vss-web-extension-sdk`:** The `vss-web-extension-sdk` package (v5.x, AMD/RequireJS-based) is the *old* SDK targeting the v1 contribution model. It still works, but Microsoft's current samples (`microsoft/azure-devops-extension-sample`) all use the new pair (`azure-devops-extension-sdk` + `azure-devops-extension-api`), which is ES module-native, TypeScript-first, and webpack/vite-friendly. Greenfield projects should use the new SDK. (HIGH confidence — verifiable from the public sample repo's `package.json`.)

**SDK v4 init pattern (important quirk):**

```ts
import * as SDK from "azure-devops-extension-sdk";

SDK.init({
  loaded: false,            // we'll call notifyLoadSucceeded() manually after data load
  applyTheme: true,         // inherit ADO light/dark theme tokens
});

await SDK.ready();
// ... fetch config + work item context ...
SDK.notifyLoadSucceeded();
```

The v2 pattern (`VSS.init({ usePlatformScripts: true, ... })` from the legacy SDK) is **not** what v4 expects and will silently fail to register the contribution. This is the single most common porting mistake — call this out in PITFALLS.md.

**Client services to use (from `azure-devops-extension-api`):**

| Need | Service / Client | Method |
|------|------------------|--------|
| Get current work item ID + field values | `IWorkItemFormService` (via `SDK.getService("ms.vss-work-web.work-item-form")`) | `getId()`, `getFieldValues([...])`, `getWorkItemType()` |
| Read/write Story Points field on the open form | Same `IWorkItemFormService` | `setFieldValue("Microsoft.VSTS.Scheduling.StoryPoints", value)` — preferred over REST when the form is open (writes to in-memory state, persists on user Save) |
| Force-persist without user Save | `WorkItemTrackingRestClient.updateWorkItem(...)` from `azure-devops-extension-api/WorkItemTracking` | `updateWorkItem(patchDoc, id, project)` with JSON-Patch `{ op: "replace", path: "/fields/Microsoft.VSTS.Scheduling.StoryPoints", value }` |
| Post comment | `WorkItemTrackingRestClient.addComment(request, project, workItemId)` (uses the v2 comments REST endpoint, not the legacy `System.History` field) | — |
| Read user permissions / identity | `SDK.getUser()` for the current user; `CoreRestClient` for project info | — |
| Read/write per-org and per-project config | `IExtensionDataService` (via `SDK.getService("ms.vss-features.extension-data-service")`), then `getExtensionDataManager(extId, accessToken)` and use `getValue/setValue` with `scopeType: "Default"` (org) or `scopeType: "Project"` (project) | — |

**Comment API caveat:** The v2 comments endpoint is in *preview* on some org configurations and is the modern path; the legacy approach (`System.History` patch on the work item) is deprecated for new code but still works as a fallback. (MEDIUM confidence — verify the preview status is no longer "preview" before publish.)

**DO NOT use:** `vss-web-extension-sdk` (legacy AMD SDK), `TFS.WorkItemTracking.Services` namespace (legacy global), or `VSS.getService` calls. These are v1-contribution-model artifacts.

---

### UI Library

| Package | Version (floor) | Purpose | Choice / Version confidence |
|---------|-----------------|---------|------|
| `azure-devops-ui` | `^2.259.0` (or `^2.x` latest) | Native ADO components — `Dialog`, `Dropdown`, `Button`, `MessageCard`, `FormItem`, `Toggle`, `Spinner` | HIGH / MEDIUM |
| `react` | `^18.3.1` | Required by `azure-devops-ui` | HIGH / HIGH |
| `react-dom` | `^18.3.1` | Required by `azure-devops-ui` | HIGH / HIGH |

**Why `azure-devops-ui` over Fluent UI v9 or custom:**

| Option | Native ADO look | Bundle size | Maintenance status | Verdict |
|--------|-----------------|-------------|--------------------|---------|
| `azure-devops-ui` | Yes — pixel-identical to ADO chrome, inherits theme via `applyTheme: true` | ~150–250 KB minified+gzipped depending on tree-shaking | Low-velocity but Microsoft still publishes patches (~quarterly); used by Microsoft's own sample repo | **Use this** |
| Fluent UI v9 (`@fluentui/react-components`) | Close but not identical (Fluent v9 is the Microsoft 365 design language; ADO has its own derivative) | Heavier (~400 KB+ for full set) | Actively maintained | Don't — visual mismatch with surrounding form chrome |
| Fluent UI v8 (`@fluentui/react`) | Closer than v9 (older shared lineage with ADO UI) | Heavy (~500 KB) | Maintenance mode | Don't — being phased out |
| Custom CSS / headless | Total control | Smallest possible | You own it | Don't — a 30-second utility doesn't justify a custom design system, and you'd lose theme inheritance |

**`azure-devops-ui` known weaknesses (HIGH confidence):**
- **Not actively developed** — release cadence has slowed since ~2022. Issues on the GitHub repo go unanswered for months. Treat it as "stable but frozen" — fine for a small extension, painful for a large product.
- **Sass + CSS modules** at build time. Your bundler MUST handle `.scss` imports from `node_modules/azure-devops-ui/...`. With webpack this means `sass-loader` + `css-loader` + `style-loader`; with vite it's built-in.
- **No types for some sub-paths** — occasional `// @ts-ignore` needed when importing leaf components.
- **React 18 only** — does NOT support React 19 as of this research. If npm shows a 2.260+ that adds React 19 peer support, use it; otherwise pin React 18.

**Why not Angular** (per `<downstream_consumer>` instruction): GPIH's org standard is Angular 19, but `azure-devops-ui` is React-only and there is no maintained Angular component library that mirrors ADO chrome. Building an Angular extension would mean either (a) using Fluent UI's experimental Angular bindings (visually wrong, immature) or (b) writing a custom design system to match ADO (massive yak-shave for a 30-second utility). React + `azure-devops-ui` is the *only* sensible choice for a single-purpose ADO extension. This is a one-off divergence from the org standard, justified by surface alignment with the host product.

---

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

**Why webpack over vite or esbuild:**

| Bundler | Pros for ADO extension | Cons | Verdict |
|---------|------------------------|------|---------|
| **webpack 5** | Microsoft's official sample (`microsoft/azure-devops-extension-sample`) uses webpack; multi-entry HTML support is mature; `azure-devops-ui` SCSS pipeline is webpack-tested | Slower dev rebuilds; verbose config | **Use this** for v1 — least friction, exact match to Microsoft sample |
| vite | Faster dev, modern defaults | Multi-HTML-entry pattern works but isn't as documented for extensions; `azure-devops-ui` SCSS imports occasionally need vendor pre-bundle hints; smaller community of "vite + ADO extension" examples | Defer to v2 if perf becomes an issue |
| esbuild (raw) | Fastest | No HTML plugin story; no SCSS out of the box; you'd reinvent what webpack gives you | Don't |

**Output format:** Each contribution entry compiles to a single self-contained HTML + JS bundle. The work-item modal and the (v2) settings hubs are separate entries because ADO loads each contribution in its own iframe. Target `web` with `output.publicPath: ""` (relative paths — the iframe is served from a Microsoft CDN with a unique per-extension path).

**Polyfills:** None required. Azure DevOps targets evergreen Chromium, Firefox, Safari (per the project Constraints). Set `target: "es2020"` in webpack and TypeScript; skip core-js. (HIGH confidence.)

---

### Language / Type System

| Package | Version (floor) | Purpose | Choice / Version confidence |
|---------|-----------------|---------|------|
| `typescript` | `^5.6.3` | Language | HIGH / MEDIUM |
| `@types/react` | `^18.3.12` | React 18 types | HIGH / MEDIUM |
| `@types/react-dom` | `^18.3.1` | React 18 DOM types | HIGH / MEDIUM |

**`tsconfig.json` shape that the SDK expects:**

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",   // "Node" also works; Bundler is cleaner for webpack 5
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",              // React 18 automatic runtime
    "strict": true,                  // required by GPIH .NET house style; harmless here
    "esModuleInterop": true,
    "skipLibCheck": true,            // azure-devops-ui has occasional stale types
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "sourceMap": true,
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

**`skipLibCheck: true` is not optional** — `azure-devops-ui` ships occasionally-broken `.d.ts` files and will fail strict library-check. (HIGH confidence — well-known issue.)

---

### Testing

| Package | Version (floor) | Purpose | Choice / Version confidence |
|---------|-----------------|---------|------|
| `vitest` | `^2.1.0` | Unit tests for pure calc logic | HIGH / MEDIUM |
| `@vitest/coverage-v8` | `^2.1.0` | Coverage | HIGH / MEDIUM |

**Why vitest over jest:**
- The thing under test is a *pure function* (level → score → weighted sum → Fibonacci round). No DOM, no SDK, no React. Either runner works.
- Vitest is faster, has zero-config TypeScript, and uses the same ESM module graph as the production build (no `transform-jest` jiggery-pokery for ESM). Jest is fine but adds `ts-jest` or `babel-jest` configuration that you don't need.
- The project has explicitly scoped UI/E2E tests as out-of-scope (manual QA per company standard), so you don't need jest's ecosystem of React Testing Library plugins.

**DO NOT install** `@testing-library/react`, `jsdom`, or `playwright` in v1 — they're not needed for pure-logic tests and will inflate `node_modules` and CI time. Add only when (a) a UI bug is reported and reproduces only in browser, or (b) the company standard for manual QA changes.

**Type-checking in CI:** Run `tsc --noEmit` as a separate CI step from `vitest run`. Don't rely on the bundler's transpile to catch type errors (`ts-loader` with `transpileOnly: true` skips them; `transpileOnly: false` is slow).

---

### Packaging & Publishing

| Tool | Version (floor) | Purpose | Choice / Version confidence |
|------|-----------------|---------|------|
| `tfx-cli` | `^0.21.0` (or latest `^0.x`) | Pack `.vsix`, publish to Marketplace | HIGH / MEDIUM |

Install `tfx-cli` as a dev dependency (`npm i -D tfx-cli`), not globally — pinning the version in `package.json` keeps local and CI builds reproducible.

**`vss-extension.json` manifest schema for our contribution:**

```jsonc
{
  "manifestVersion": 1,
  "id": "story-point-calculator",
  "version": "1.0.0",
  "name": "Story Point Calculator",
  "publisher": "<publisher-id>",     // Marketplace publisher; resolved Phase 1
  "public": true,
  "targets": [
    { "id": "Microsoft.VisualStudio.Services" }   // Azure DevOps Services (cloud); add "Microsoft.TeamFoundation.Server" only if Server support is in scope
  ],
  "categories": ["Azure Boards"],
  "tags": ["story points", "estimation", "scrum", "agile"],
  "description": "Structured Story Point estimation using Complexity, Uncertainty, Effort.",
  "icons": {
    "default": "images/icon.png"     // 128x128 PNG
  },
  "scopes": [
    "vso.work_write"                 // read+write work items; covers field write + comment
  ],
  "files": [
    { "path": "dist", "addressable": true },
    { "path": "images", "addressable": true },
    { "path": "README.md", "addressable": true }
  ],
  "content": {
    "details": { "path": "README.md" }
  },
  "contributions": [
    {
      "id": "calculate-sp-toolbar-button",
      "type": "ms.vss-work-web.work-item-form-toolbar-button",
      "description": "Toolbar button on the work item form that opens the SP calculator.",
      "targets": ["ms.vss-work-web.work-item-form"],
      "properties": {
        "name": "Calculate Story Points",
        "uri": "dist/calculator.html",
        "icon": "images/icon-toolbar.png",
        "registeredObjectId": "calculate-sp-action"
      }
    }
    // v2 adds:
    // - ms.vss-web.hub targeting ms.vss-admin-web.collection-admin-hub (Org Settings)
    // - ms.vss-web.hub targeting ms.vss-admin-web.project-admin-hub (Project Settings)
  ]
}
```

**Scope choice — `vso.work_write` is sufficient and minimum-required:** Covers reading the work item, writing fields, posting comments. Do NOT request `vso.work_full` (we don't need bypass-rules write) or `vso.profile` (we get the user via `SDK.getUser()` which doesn't need extra scope). Smaller scope set = fewer Marketplace install warnings = better install conversion. (HIGH confidence.)

**Extension Data scope is implicit** — `IExtensionDataService` does not require an additional manifest scope; it's granted automatically when the extension is installed.

---

### Publisher Registration & First Publish (One-Time, ~30 min)

1. Sign in at `https://marketplace.visualstudio.com/manage` with the GPIH Microsoft Entra ID that owns the publishing identity.
2. Create a publisher: choose a publisher ID (lowercase, hyphenated; e.g., `gpih`), display name, contact email. Publisher ID is **immutable** and appears in every install URL. Verification is automatic for personal MS accounts; org accounts may need a `mailto:` round-trip (typically <24h).
3. Generate a Personal Access Token (PAT) with **Marketplace → Manage** scope (and only that scope). Note: this PAT is for *publishing*, distinct from the `vso.work_write` scope the extension itself requests at runtime.
4. Local-publish smoke test: `npx tfx extension publish --manifest-globs vss-extension.json --token <PAT> --share-with <test-org>` — publishes to the publisher account but only shares with one org so it's not visible to the public.
5. After the first published version, you can mark it `public: true` in the manifest and re-publish; that surfaces it on the Marketplace search.

(MEDIUM confidence on UI labels — the Marketplace management UI changes annually; the underlying flow has been stable for years.)

---

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

These tasks live in the **Azure DevOps Extension Tasks** extension (publisher: `ms-devlabs`) — install it once on the build org. (HIGH confidence — has been the canonical pipeline since 2018.)

**Trigger pattern matching the project's "publish on tag" requirement:**

```yaml
trigger:
  tags:
    include: ['v*.*.*']     # publish only when a semver tag is pushed
  branches:
    include: ['master']     # CI builds on every master push but skip publish step

variables:
  isTaggedRelease: $[startsWith(variables['Build.SourceBranch'], 'refs/tags/v')]

stages:
  - stage: BuildAndTest
    jobs:
      - job: Validate
        steps:
          - task: NodeTool@0
            inputs: { versionSpec: '20.x' }
          - script: npm ci
          - script: npm run typecheck
          - script: npm test -- --run
          - script: npm run build

  - stage: Publish
    condition: and(succeeded(), eq(variables.isTaggedRelease, 'true'))
    jobs:
      - job: PublishToMarketplace
        steps:
          - task: NodeTool@0
            inputs: { versionSpec: '20.x' }
          - script: npm ci
          - script: npm run build
          - task: TfxInstaller@5
            inputs: { version: 'v0.x' }
          - task: PackageAzureDevOpsExtension@5
            inputs:
              rootFolder: '$(Build.SourcesDirectory)'
              outputPath: '$(Build.ArtifactStagingDirectory)/extension.vsix'
              extensionVersion: $(Build.SourceBranchName)   # tag = version
              updateTasksVersion: false
          - task: PublishAzureDevOpsExtension@5
            inputs:
              connectedServiceName: 'marketplace-publish'   # service connection holding the PAT
              fileType: 'vsix'
              vsixFile: '$(Build.ArtifactStagingDirectory)/extension.vsix'
              extensionVisibility: 'public'
              extensionPricing: 'free'
```

(HIGH confidence on shape; MEDIUM on task version `@5` — verify in the Marketplace listing for `ms-devlabs.vsts-developer-tools-build-tasks` that v5 is current. v4 also works.)

---

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

---

## Installation (Phase 1 Bootstrap)

```bash
# Core runtime + SDK
npm install \
  react@^18.3.1 \
  react-dom@^18.3.1 \
  azure-devops-extension-sdk@^4 \
  azure-devops-extension-api@^4 \
  azure-devops-ui@^2

# Build / dev tooling
npm install -D \
  typescript@^5.6 \
  @types/react@^18.3 \
  @types/react-dom@^18.3 \
  webpack@^5 \
  webpack-cli@^5 \
  ts-loader@^9 \
  sass-loader@^16 sass@^1.79 \
  css-loader@^7 \
  style-loader@^4 \
  html-webpack-plugin@^5 \
  copy-webpack-plugin@^12

# Test
npm install -D vitest@^2 @vitest/coverage-v8@^2

# Packaging
npm install -D tfx-cli@^0.21
```

**Phase 1 verification step (mandatory):** Before committing this `package.json`, run

```bash
npm view azure-devops-extension-sdk version
npm view azure-devops-extension-api version
npm view azure-devops-ui version
npm view tfx-cli version
```

and adjust the floors above if any are behind. This compensates for the verification gap noted at the top.

---

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

**Verification budget for Phase 1:** ~15 minutes of `npm view` calls + 5 minutes confirming the Marketplace task version closes the MEDIUM-confidence gaps. Do this before locking versions.
