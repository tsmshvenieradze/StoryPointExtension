# Phase 0: Bootstrap & Prerequisites - Research

**Researched:** 2026-05-01
**Domain:** Repository scaffolding for a React 18 + TypeScript Azure DevOps work item extension; npm version pinning; manifest skeleton with locked scope
**Confidence:** HIGH (live npm registry verified; manifest schema and contribution IDs cross-checked against Microsoft Learn 2026-04 in upstream research)

## Summary

Phase 0 is pure scaffolding: pin verified npm versions, write configuration files, and produce a manifest skeleton that locks `vso.work_write` as the only scope before any code touches an iframe. There is no runtime ADO surface contact in this phase — `tfx-cli` is installed but not exercised, the manifest is written but not packaged, the React entries do not exist yet. The single risk is getting a wire-format decision wrong that propagates to every downstream phase: pinned versions (because version drift causes integration breakage during the SDK lifecycle that Phase 2 verifies), manifest scope (because adding scopes post-publish forces re-consent on every install), and the publisher field (immutable in the install URL).

All four critical packages were verified live against the npm registry on 2026-05-01: `azure-devops-extension-sdk@4.2.0` (published 6 months ago), `azure-devops-extension-api@4.270.0` (1 month ago), `azure-devops-ui@2.272.0` (2 weeks ago), `tfx-cli@0.23.1`. The STACK.md floors are all behind current — Phase 0 must update floors to actual current versions, then **pin** them (no caret) per PITFALLS.md Pitfall 14. One non-obvious finding: `azure-devops-ui@2.272.0` still declares `react@^16.8.1` as its peer dependency, even on a release published two weeks ago. The project uses React 18, so Phase 0 must include either a `package.json` `overrides` block or an `.npmrc` with `legacy-peer-deps=true` — without one, `npm ci` fails with `ERESOLVE`. Picking `overrides` is preferred because it documents the deliberate compatibility decision in `package.json` itself.

The webpack two-entry pattern (D-06) is best implemented as a single `webpack.config.cjs` returning an array of two configs (or a single config with two entry points + per-entry `HtmlWebpackPlugin`). The Microsoft sample repo's webpack pattern is stale (React 16, TS 3.9, no `html-webpack-plugin`) and should be referenced for shape only; the project uses a modernized variant. `.cjs` extension is required because `package.json` is type-`"module"`-friendly for Vitest, but webpack 5 config files containing `require()` calls run as CommonJS — leaving the config as `.js` with `"type": "module"` in package.json breaks webpack-cli.

**Primary recommendation:** Use the verified versions and exact configuration files in this document verbatim. The planner should produce 8–10 tasks in PLAN.md: (1) verify+pin versions via `npm view`, (2) write `package.json`, (3) write `tsconfig.json`, (4) write `.gitignore`, (5) write `LICENSE`, (6) write `vss-extension.json` skeleton with placeholder icon, (7) write webpack configs and stub entry files, (8) write `vitest.config.ts` and placeholder smoke test, (9) `npm install` to generate `package-lock.json`, (10) run fresh-clone smoke loop (`npm ci && npm run typecheck && npm test`) and commit.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Atomicity Ordering** (D-01..D-04) — already documented in PROJECT.md Key Decisions; Phase 0 only needs to confirm it is reflected there:
- D-01: Comment-first → field-write
- D-02: Audit comment is canonical source of truth; comment-first failure mode is recoverable (parser pre-fills, user retries)
- D-03: Always post a new comment per Apply (no de-dup, no edit)
- D-04: Failure modes for Phase 4 (downstream)

**Repo Layout** (D-05..D-07):
- D-05: Flat `src/` with subfolders `calc/`, `audit/`, `field/`, `ado/`, `ui/`, `entries/{toolbar,modal}.tsx`. Single `package.json`, single `tsconfig.json` with `strict: true`, single `vitest.config.ts`. `tests/` mirrors `src/`.
- D-06: Webpack uses two HTML entries via `html-webpack-plugin`: `dist/toolbar.html` (toolbar shim) and `dist/modal.html` (lazy-loaded React modal).
- D-07: Reject npm workspaces and TypeScript project references for v1.

**Extension Identity** (D-08..D-12) — locked, immutable post-publish:
- D-08: Publisher `TsezariMshvenieradzeExtensions` (already verified at the Marketplace publisher portal)
- D-09: Extension ID `story-point-calculator`
- D-10: Display name `Story Point Calculator`
- D-11: License MIT (LICENSE file at repo root with year 2026, copyright `Tsezari Mshvenieradze`)
- D-12: Starting version `0.1.0` in both `package.json` and `vss-extension.json`; bump to `1.0.0` at first public publish

**Dev Environment** (D-13..D-14):
- D-13: Dev ADO org `https://cezari.visualstudio.com/Cezari` (legacy URL form; modern equivalent `dev.azure.com/cezari/Cezari`)
- D-14: Trial CMMI org spun up in Phase 5, not Phase 0

**Phase 0 Scope Boundaries** (D-15..D-16):
- D-15: No CI/CD pipeline in Phase 0. Local fresh-clone smoke loop only.
- D-16: No marketplace-quality README. Placeholder README is acceptable.

### Claude's Discretion

- Exact file naming under `src/calc/`, `src/audit/` — defer to Phase 1 plan
- Webpack config split: single config with array export vs two configs — recommend single config returning an array (single source of truth for shared loaders/resolvers)
- `tsconfig.json` strictness flags beyond `strict: true` — lean strictest reasonable for a numeric-heavy calc engine; recommendations in Code Examples below
- `.gitignore` contents — standard Node/TypeScript template + `dist/` + `*.vsix` + `.tfx-cache/` + `coverage/`

### Deferred Ideas (OUT OF SCOPE)

- CI/CD pipeline (Azure Pipelines or GitHub Actions) — Phase 5
- Bundle-size gate — Phase 5 (PKG-03)
- Telemetry / analytics — out of scope for v1
- Localization manifest fields (`defaultLocale`, `translations/`) — English-only listing
- Extracting `calc-engine` and `audit-comment` as standalone npm packages — possible v2+, rejected for v1
- Custom-process SP field rename support — out of scope for v1

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | `vss-extension.json` manifest is valid against current schema, contains exactly the `vso.work_write` scope, declares the toolbar action and modal external-content contributions, and includes a 128×128 icon | Manifest skeleton in Code Examples below; contribution IDs verified in upstream `ARCHITECTURE.md` (Microsoft Learn 2026-04); icon placeholder per Pitfalls (P11 "icon"); scope lock per upstream `PITFALLS.md` Pitfall 3 |

> Phase 0 only addresses the **scaffolding portion** of PKG-01 — the manifest skeleton with the contribution stubs and exact scope. The full PKG-01 verification (valid against schema with a real 128×128 icon, packaged into a `.vsix`) belongs to Phase 5 (PKG-02). Phase 0's deliverable is a manifest that, when later filled in by Phase 2's real toolbar.html / modal.html, will pass `tfx extension create` without schema errors.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| npm version pinning | Build tooling (package.json) | — | Pinned versions prevent transitive drift breaking the SDK postMessage handshake at runtime |
| TypeScript compilation | Build tooling (tsconfig.json + ts-loader) | — | Strict-mode TS catches the heavy numeric calc-engine bugs at compile time |
| Webpack bundling (two entries) | Build tooling (webpack.config.cjs) | — | Each ADO contribution is its own iframe; iframes cannot share JS bundles, so two entry points are mandatory |
| SCSS pipeline for `azure-devops-ui` | Build tooling (sass-loader + css-loader + style-loader) | — | `azure-devops-ui` ships `.scss` source; webpack must compile and inject at runtime (iframes cannot share host stylesheets) |
| Manifest contribution declaration | Static file (vss-extension.json) | Build tooling (copy-webpack-plugin in later phases) | Manifest is read by `tfx-cli` at package time and by ADO at install time; never executed |
| Test runner | Build tooling (vitest.config.ts) | — | Pure-function unit tests for calc engine; no DOM, no SDK, no React |
| License declaration | Repo root (LICENSE file) | Manifest (`vss-extension.json` content path or marketplace listing) | LICENSE file is consumed by Marketplace at publish time; Phase 0 only places it |
| Marketplace publisher binding | Manifest field (`vss-extension.json` `publisher`) | — | Publisher is the immutable namespace prefix on the install URL; pinned in Phase 0 |
| Smoke loop verification | Local script (npm scripts in package.json) | — | `npm ci && npm run typecheck && npm test` is the success criterion 5 verification gate |

## Standard Stack

### Core (verified live against npm registry on 2026-05-01)

| Package | **Pinned version** | Purpose | Why Standard | Confidence |
|---------|-------------------:|---------|--------------|------------|
| `azure-devops-extension-sdk` | `4.2.0` | Host-iframe handshake, `SDK.init()`, `SDK.ready()`, `SDK.getService()`, `SDK.notifyLoadSucceeded()` | Microsoft's modern SDK; legacy `vss-web-extension-sdk` is AMD/RequireJS-based and not used in current samples | HIGH `[VERIFIED: npm view]` |
| `azure-devops-extension-api` | `4.270.0` | Typed REST clients (`WorkItemTrackingRestClient`, `CoreRestClient`) and SDK service interfaces (`IWorkItemFormService`, `IExtensionDataService`) | Pairs with `azure-devops-extension-sdk` v4; eliminates hand-rolled `fetch` + auth | HIGH `[VERIFIED: npm view]` |
| `azure-devops-ui` | `2.272.0` | Pixel-identical ADO chrome components (`Dialog`, `Dropdown`, `Button`, `MessageCard`, `FormItem`); theme inheritance via `applyTheme: true` | The only React component library that matches ADO's visual chrome; Fluent UI v8/v9 do not | HIGH `[VERIFIED: npm view; published 2026-04-10, 2 weeks ago]` |
| `tfx-cli` | `0.23.1` | `.vsix` packager (Phase 5) and validator | Microsoft's only `.vsix` packager; no real alternative | HIGH `[VERIFIED: npm view]` |

**Anomaly check:** A 0.x major bump on `tfx-cli` (e.g., a sudden 0.24.x or 1.0.0) would be unusual and warrants reading release notes before pinning. As of 2026-05-01 the latest is 0.23.1; the planner should re-run `npm view tfx-cli version` at task execution and accept any value in the range `0.21.x`–`0.23.x`. Anything `0.24+` requires a 5-minute changelog read. Same caution for `azure-devops-extension-sdk` — `4.2.0` is 6 months old; if a `4.3.x` or `5.x` exists by execution time, planner should read changelog before bumping (the SDK's last major was `3.x → 4.x` and was breaking).

### Supporting

| Package | **Pinned or floor version** | Purpose | When to Use | Confidence |
|---------|----------------------------:|---------|-------------|------------|
| `react` | `18.3.1` (pinned exact, no `^`) | UI framework; required peer of `azure-devops-ui` | All UI phases | HIGH `[VERIFIED: npm view → 19.2.5; pinned at 18.3.1 because azure-devops-ui peer is React 16, and React 19 has unverified compatibility]` |
| `react-dom` | `18.3.1` (pinned exact) | DOM renderer; required peer of `azure-devops-ui` | All UI phases | HIGH `[VERIFIED: same constraint as react]` |
| `typescript` | `^5.6.0` (caret OK for tooling) | Language | Compilation in webpack and CI | HIGH `[VERIFIED: npm view → 6.0.3; pinned at floor 5.6 because TS 6.x is recent and may have unanticipated breaking changes for the project]` |
| `@types/react` | `^18.3.0` | React 18 types | Type-checking only | HIGH `[VERIFIED: npm view → 19.2.14; floored at 18.3 to match runtime react@18.3.1]` |
| `@types/react-dom` | `^18.3.0` | React 18 DOM types | Type-checking only | HIGH `[VERIFIED: same as @types/react]` |
| `@types/node` | `^22.0.0` | Node types for build scripts (`webpack.config.cjs`, `vitest.config.ts`) | Build-time only | HIGH `[VERIFIED: npm view → 25.6.0; floored at 22 LTS because Node 24 LTS arrives later in 2026]` |
| `webpack` | `^5.97.0` | Bundler | Both entries | HIGH `[VERIFIED: npm view → 5.106.2]` |
| `webpack-cli` | `^5.1.4` | CLI for webpack | Build scripts | HIGH `[VERIFIED: npm view → 7.0.2; floor at 5.1.4 because 6.x and 7.x major bumps may have CLI flag changes]` |
| `ts-loader` | `^9.5.0` | TypeScript transpilation in webpack | Build only | HIGH `[VERIFIED: npm view → 9.5.7]` |
| `sass-loader` | `^16.0.0` | `azure-devops-ui` SCSS pipeline | Build only | HIGH `[VERIFIED: npm view → 16.0.7]` |
| `sass` | `^1.79.0` | Sass compiler implementation | Required peer of sass-loader | HIGH `[VERIFIED: npm view → 1.99.0]` |
| `css-loader` | `^7.1.0` | CSS module resolution | Build only | HIGH `[VERIFIED: npm view → 7.1.4]` |
| `style-loader` | `^4.0.0` | Inject CSS at runtime (iframes can't share stylesheets with host) | Build only | HIGH `[VERIFIED: npm view → 4.0.0]` |
| `html-webpack-plugin` | `^5.6.0` | One HTML file per entry (toolbar.html, modal.html) | Build only — required for D-06 | HIGH `[VERIFIED: npm view → 5.6.7]` |
| `copy-webpack-plugin` | `^12.0.0` | Copy `vss-extension.json`, `images/`, `LICENSE` into `dist/` for `tfx-cli` (Phase 5 will add this) | Build only | HIGH `[VERIFIED: npm view → 14.0.0; floor at 12 — major 13/14 may rename plugin options]` |
| `vitest` | `^2.1.0` | Unit test runner (pure calc logic) | Test only | HIGH `[VERIFIED: npm view → 4.1.5; floor at 2.1 because Vitest moved to 3.x with config schema changes; 2.1.x is the last stable for the planned simple smoke test]` |
| `@vitest/coverage-v8` | `^2.1.0` | Coverage instrumentation | Test only | HIGH `[VERIFIED: npm view → 4.1.5; same major-version reasoning as vitest]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `azure-devops-extension-sdk` v4 | `vss-web-extension-sdk` v5 | Legacy AMD/RequireJS; Microsoft samples have moved on; v1 contribution model only |
| `azure-devops-ui` 2.x | Fluent UI v9 (`@fluentui/react-components`) | Visual mismatch with ADO chrome; ~400 KB heavier |
| webpack 5 | Vite | Multi-HTML-entry less documented for ADO extensions; SCSS imports occasionally need vendor pre-bundle hints |
| webpack 5 | esbuild raw | Missing HTML/SCSS plugins; you'd reinvent what webpack gives you |
| Vitest | Jest | More config for ESM/TS (`ts-jest` or `babel-jest`); no advantage for pure-logic tests |
| `tfx-cli` | (none — no real alternative) | Microsoft's only `.vsix` packager |

### Verified Installation Command

This is the **exact** command Phase 0 should use after writing `package.json`. It pins the four critical packages and floors the supporting ones.

```bash
# Runtime / SDK
npm install --save-exact \
  azure-devops-extension-sdk@4.2.0 \
  azure-devops-extension-api@4.270.0 \
  azure-devops-ui@2.272.0 \
  react@18.3.1 \
  react-dom@18.3.1

# Build / dev tooling
npm install --save-dev \
  typescript@^5.6.0 \
  @types/react@^18.3.0 \
  @types/react-dom@^18.3.0 \
  @types/node@^22.0.0 \
  webpack@^5.97.0 \
  webpack-cli@^5.1.4 \
  ts-loader@^9.5.0 \
  sass-loader@^16.0.0 sass@^1.79.0 \
  css-loader@^7.1.0 \
  style-loader@^4.0.0 \
  html-webpack-plugin@^5.6.0 \
  copy-webpack-plugin@^12.0.0

# Test
npm install --save-dev vitest@^2.1.0 @vitest/coverage-v8@^2.1.0

# Packaging (Phase 5 will use; install now to lock the version)
npm install --save-dev --save-exact tfx-cli@0.23.1
```

**Re-verification before pinning (mandatory per CONTEXT.md success criterion 1):** The planner MUST re-run these `npm view` commands at execution time to capture any version that landed between research and execution:

```bash
npm view azure-devops-extension-sdk version
npm view azure-devops-extension-api version
npm view azure-devops-ui version
npm view tfx-cli version
```

Expected ranges (anomalies require investigation):
- `azure-devops-extension-sdk`: `4.x.x` (currently `4.2.0`, 6 months old) — accept `4.x`; investigate `5.x`
- `azure-devops-extension-api`: `4.260.0`–`4.290.0` (currently `4.270.0`, 1 month old; Microsoft increments minor monthly) — accept any `4.2xx.x`; investigate `5.x`
- `azure-devops-ui`: `2.270.0`–`2.290.0` (currently `2.272.0`, 2 weeks old) — accept any `2.x` ≥ `2.272.0`; investigate `3.x`
- `tfx-cli`: `0.21.x`–`0.24.x` (currently `0.23.1`) — accept any `0.2x.x`; investigate `1.0.0`

## Architecture Patterns

### System Architecture Diagram (Phase 0 deliverables only)

```
                       ┌─────────────────────────────────────┐
                       │  Developer machine (fresh clone)    │
                       └────────────────┬────────────────────┘
                                        │
                                        │ git clone
                                        ▼
                       ┌─────────────────────────────────────┐
                       │  Repo root                          │
                       │  ┌──────────────┐                   │
                       │  │ package.json │── pinned versions │
                       │  │ tsconfig.json│── strict, ES2020  │
                       │  │ webpack.config.cjs               │
                       │  │ vitest.config.ts                 │
                       │  │ vss-extension.json (skeleton)    │
                       │  │ .gitignore   │                   │
                       │  │ LICENSE (MIT, 2026)              │
                       │  │ .npmrc       │                   │
                       │  └──────┬───────┘                   │
                       │         │                            │
                       │         ▼                            │
                       │  ┌──────────────┐                   │
                       │  │ src/         │  (subfolders only;│
                       │  │   entries/   │   stubs in 0)     │
                       │  │     toolbar.tsx (placeholder)    │
                       │  │     modal.tsx   (placeholder)    │
                       │  │   calc/      (empty, Phase 1)    │
                       │  │   audit/     (empty, Phase 1)    │
                       │  │   field/     (empty, Phase 3)    │
                       │  │   ado/       (empty, Phase 3-4)  │
                       │  │   ui/        (empty, Phase 2-4)  │
                       │  └──────────────┘                   │
                       │  ┌──────────────┐                   │
                       │  │ tests/       │                   │
                       │  │   smoke.test.ts (1+1===2)        │
                       │  └──────────────┘                   │
                       └────────────────┬────────────────────┘
                                        │
                                        │ npm ci
                                        ▼
                       ┌─────────────────────────────────────┐
                       │  node_modules/ (gitignored)         │
                       │  package-lock.json (committed)      │
                       └────────────────┬────────────────────┘
                                        │
                                        │ Smoke loop
                                        ▼
            ┌─────────────────┬──────────────────┬─────────────────┐
            │ npm run typecheck│ npm run test     │ exit 0          │
            │ (tsc --noEmit)  │ (vitest run)     │                 │
            └─────────────────┴──────────────────┴─────────────────┘
                                  │
                                  │ all green
                                  ▼
                       ┌─────────────────────────────────────┐
                       │ Phase 0 complete; Phase 1 unblocked │
                       └─────────────────────────────────────┘
```

### Recommended Project Structure

```
StoryPointExtension/
├── package.json                # pinned deps; scripts (build/dev/test/typecheck/clean/package)
├── package-lock.json           # COMMITTED (per CONTEXT.md D-07 — single-package layout)
├── tsconfig.json               # strict; ES2020; jsx react-jsx; skipLibCheck mandatory
├── webpack.config.cjs          # array export: toolbar config + modal config
├── vitest.config.ts            # node env; coverage v8; tests/**/*.test.ts
├── vss-extension.json          # manifest skeleton; publisher locked; scope locked
├── .gitignore                  # node_modules, dist, *.vsix, .tfx-cache, coverage, *.log
├── .npmrc                      # save-exact=true (enforces pinning)
├── LICENSE                     # MIT 2026 Tsezari Mshvenieradze
├── README.md                   # placeholder per D-16; Phase 5 produces marketplace-quality version
├── images/
│   └── icon.png                # 128x128 placeholder PNG (transparent background)
├── src/
│   ├── entries/
│   │   ├── toolbar.tsx         # PLACEHOLDER stub; Phase 2 implements registerHandler/openCustomDialog
│   │   └── modal.tsx           # PLACEHOLDER stub; Phase 2 implements SDK.init + ReactDOM
│   ├── calc/                   # empty in Phase 0; Phase 1 builds calcEngine
│   ├── audit/                  # empty in Phase 0; Phase 1 builds sentinel serializer/parser
│   ├── field/                  # empty in Phase 0; Phase 3 builds FieldResolver
│   ├── ado/                    # empty in Phase 0; Phases 3-4 build SDK + REST bridge
│   └── ui/                     # empty in Phase 0; Phases 2-4 build React components
└── tests/
    └── smoke.test.ts           # placeholder; assert 1+1===2 to satisfy success criterion 5
```

The empty subfolders under `src/` should contain a `.gitkeep` file each so they survive `git clone` and the planner can inspect the directory shape on a fresh clone. (Alternative: omit empty folders and let Phase 1 create them. Pick one — recommended: `.gitkeep` files because it documents the intended layout.)

### Pattern 1: Single Webpack Config Returning an Array

**What:** A single `webpack.config.cjs` that exports `[toolbarConfig, modalConfig]` so `webpack` runs both builds in one invocation, sharing all loader/resolver/plugin configuration via a `baseConfig` factory.

**When to use:** Every time the project has multiple HTML entry contributions (D-06 says we have toolbar + modal; v2 will add two settings hubs — same pattern, just more entries).

**Why not two files:** Two separate config files duplicate loader rules and version-drift between them silently. Microsoft's sample uses a single file with a dynamic entries map.

**Example shape:**

```javascript
// webpack.config.cjs — Source: pattern derived from microsoft/azure-devops-extension-sample
//                     and modernized for html-webpack-plugin per D-06
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

function baseConfig(entryName, mode) {
  return {
    mode,
    entry: `./src/entries/${entryName}.tsx`,
    output: {
      filename: `${entryName}.js`,
      path: path.resolve(__dirname, 'dist'),
      publicPath: '',                        // relative paths — iframe served from CDN with per-extension prefix
      clean: false,                          // never wipe dist/ in a multi-config build
    },
    devtool: mode === 'development' ? 'inline-source-map' : false,
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
          options: { transpileOnly: false }, // type-check during build; CI runs separate tsc --noEmit anyway
        },
        {
          test: /\.scss$/,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(woff2?|ttf|eot|svg|png)$/,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: `${entryName}.html`,
        template: 'src/template.html',       // shared minimal template (one file)
        inject: 'body',
        chunks: [entryName],                 // each HTML gets only its own JS
      }),
    ],
    target: 'web',
    performance: { hints: false },           // bundle-size gate is Phase 5; Phase 0 is silent
  };
}

module.exports = (env, argv) => {
  const mode = argv.mode === 'production' ? 'production' : 'development';
  return [
    baseConfig('toolbar', mode),
    baseConfig('modal', mode),
  ];
};
```

```html
<!-- src/template.html — minimal template; SDK script injected by Phase 2 -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Story Point Calculator</title>
</head>
<body><div id="root"></div></body>
</html>
```

### Pattern 2: Pinned Versions Enforced by `.npmrc`

**What:** A repo-root `.npmrc` containing `save-exact=true` so every `npm install` writes the resolved version with no `^` or `~` prefix.

**When to use:** Always for ADO extension projects. Per PITFALLS.md Pitfall 14, SDK version drift is a documented failure mode — pinning prevents it.

**Trade-off:** Pinned versions don't get patch updates automatically. The project accepts this — runs Dependabot or manual `npm view` checks at the start of each new phase.

**Example:**

```
# .npmrc — Source: PITFALLS.md Pitfall 14 (SDK version drift)
save-exact=true
```

### Pattern 3: TypeScript Strictness Calibrated for a Numeric Calc Engine

**What:** Enable `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride` — these catch the kinds of bugs a level-mapping table or a Fibonacci threshold lookup can hide.

**Trade-off:** `noUncheckedIndexedAccess` makes `lookupTable[level]` return `T | undefined` instead of `T`. The calc engine MUST handle the undefined case explicitly — that's the whole point.

**Why `skipLibCheck: true` is mandatory:** STACK.md confirms `azure-devops-ui` ships occasionally-broken `.d.ts` files. Without `skipLibCheck` the build fails on a third-party type, not on our code.

```jsonc
// tsconfig.json — Source: STACK.md + tightened for calc engine
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": false,    // false: allows .StoryPoints field access; true would force .['StoryPoints'] which conflicts with ADO field constants
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "sourceMap": true,
    "outDir": "dist",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Pattern 4: `package.json` `overrides` Block for `azure-devops-ui` React Peer

**What:** Use the npm 8.3+ `overrides` field to tell npm that `azure-devops-ui`'s declared `react@^16.8.1` peer is satisfied by our `react@18.3.1`. This is **required** — without it, `npm ci` fails with `ERESOLVE`.

**Why not `--legacy-peer-deps` in `.npmrc`:** `--legacy-peer-deps` disables peer-dep checking globally. Using `overrides` is surgical: only the `azure-devops-ui` peer is overridden; all other peer-dep checks still run.

**Trade-off:** This is a deliberate compatibility decision. `azure-devops-ui` does work with React 18 in practice (community-validated; many projects use it), but Microsoft's `peerDependencies` field is stale. If a maintainer ever publishes a 2.x version with a corrected peer-dep, this override becomes redundant but harmless.

```jsonc
// package.json fragment — Source: npm 8.3+ overrides docs; verified azure-devops-ui@2.272.0 still has react@^16.8.1 peer
{
  "overrides": {
    "azure-devops-ui": {
      "react": "$react",         // $-prefix: use the version from our top-level dependencies
      "react-dom": "$react-dom"
    }
  }
}
```

### Anti-Patterns to Avoid

- **Using `^` or `~` for the four critical packages:** Per PITFALLS.md Pitfall 14, version drift breaks the SDK postMessage handshake silently. Pin exact versions for `azure-devops-extension-sdk`, `azure-devops-extension-api`, `azure-devops-ui`, `tfx-cli`. Use `--save-exact` and `.npmrc` `save-exact=true`.
- **Naming the webpack config `webpack.config.js` while having `"type": "module"` in `package.json`:** webpack-cli requires a CommonJS config when using `require()`. Either name it `.cjs` (recommended) or use ESM (`export default`) without `require()` — the project uses CommonJS for less friction with plugin docs, so name it `webpack.config.cjs`.
- **Forgetting `package-lock.json` in git:** D-07 commits to a single-package layout; the lockfile is the only way to make `npm ci` reproducible across the team and CI. Without it, transitive dependency drift can re-introduce SDK version mismatches the pinning was meant to prevent.
- **Placing actual TypeScript code in `src/entries/toolbar.tsx` and `src/entries/modal.tsx`:** Phase 0 only requires placeholder stubs. Real SDK lifecycle code (`SDK.init`, `await SDK.ready()`, `register()`, `notifyLoadSucceeded()`) is Phase 2's job. Putting it here means re-doing it once Phase 2 has the contribution wiring tested.
- **Using `tfx-cli` in Phase 0:** D-15 says no CI/CD; `tfx-cli` is installed but not invoked. Phase 5 (PKG-02) uses it. `tfx extension create` does not require auth (verified — see Sources), so installing it now is harmless and locks the version.
- **Setting `public: true` in `vss-extension.json`:** Default to `public: false` until Phase 5's verified smoke install. The manifest is a skeleton in Phase 0; the value is `false` regardless, but worth stating.
- **Putting `dist/` in source control:** `dist/` is a build artifact; it goes in `.gitignore`. Phase 5's `.vsix` is also a build artifact (`*.vsix` in `.gitignore`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML file generation per webpack entry | Custom plugin or post-build script that copies HTML | `html-webpack-plugin@^5.6.0` | Handles asset injection (script tags), per-entry chunking (`chunks: [entryName]`), and template rendering — three things you would forget |
| TypeScript transpilation in webpack | Babel + `@babel/preset-typescript` | `ts-loader@^9.5.0` | `ts-loader` runs the real TypeScript compiler — Babel preset only strips types, no type-checking; you would lose `strict: true` errors at build time |
| SCSS pipeline for `azure-devops-ui` | `node-sass` + custom loader chain | `sass-loader` + `css-loader` + `style-loader` | `azure-devops-ui` SCSS imports break with anything other than the canonical Webpack 5 chain; `node-sass` is deprecated |
| `.vsix` packaging | Hand-roll a zip with the Microsoft schema | `tfx-cli@0.23.1` | The `.vsix` schema includes a manifest hash and cross-references; only Microsoft's tool generates them correctly |
| npm peer-dep override for `azure-devops-ui` React mismatch | Patch `node_modules/azure-devops-ui/package.json` post-install | `package.json` `overrides` field | Surgical, declarative, survives `npm ci`; patching `node_modules` is brittle and lost on every reinstall |
| Reproducible installs across team and CI | `npm install` (writes to lockfile if missing, may resolve different transitive versions) | `npm ci` (fails if lockfile missing or mismatched; deterministic) | Success criterion 5 explicitly says `npm ci` — using `npm install` defeats the determinism goal |
| Test framework for pure-function calc engine | Build your own assertion library | `vitest@^2.1.0` | Vitest is zero-config TypeScript with native ESM; the calc engine in Phase 1 has no DOM, no SDK, no React — Vitest handles this without any plugins |

**Key insight:** Every problem in this table has a 5+ year mature solution in the JavaScript ecosystem. Phase 0 spends zero time on novel tooling. The only "custom" code in Phase 0 is the webpack config shape (Pattern 1) and the manifest field choices — both of which are direct copies of the patterns documented in Microsoft's own material plus this research's pinned versions.

## Common Pitfalls

### Pitfall 1: `azure-devops-ui` React Peer Mismatch Breaks `npm ci`

**What goes wrong:** `npm ci` fails with `ERESOLVE could not resolve react@18.3.1 against azure-devops-ui peer react@^16.8.1`. Smoke loop (success criterion 5) never goes green.

**Why it happens:** `azure-devops-ui@2.272.0` (latest as of 2026-05-01, published 2 weeks ago) still declares `react@^16.8.1` and `react-dom@^16.8.1` as peer dependencies, even though it works in practice with React 18. Microsoft has not updated the peer field across many recent releases.

**How to avoid:** Add the `overrides` block in `package.json` (Pattern 4 above) **before** running `npm install` for the first time. If the lockfile was generated without overrides, delete `package-lock.json` and re-run `npm install`.

**Warning signs:**
- `npm ci` exits non-zero with `ERESOLVE`
- `npm install --legacy-peer-deps` is suggested in the error message — do not adopt this as a permanent fix; use `overrides`

### Pitfall 2: webpack-cli Cannot Load `.js` Config When `package.json` Has `"type": "module"`

**What goes wrong:** `npm run build` fails with `Cannot use import statement outside a module` or `require is not defined in ES module scope`.

**Why it happens:** Vitest config (`vitest.config.ts`) and modern Node tooling prefer ESM. If the project sets `"type": "module"` in `package.json`, every `.js` file is parsed as ESM. webpack-cli's documented config style uses CommonJS (`module.exports = {...}`) and `require('html-webpack-plugin')`. These two interact badly.

**How to avoid:** Name the webpack config `webpack.config.cjs` (CommonJS file extension). This is the canonical solution and matches webpack-cli docs. Do not set `"type": "module"` in `package.json` for this project — Vitest works fine without it, and html-webpack-plugin / copy-webpack-plugin both ship CommonJS exports natively.

**Warning signs:**
- `Cannot use import statement outside a module` on `npm run build`
- `require is not defined`

### Pitfall 3: Forgetting to Pin `tfx-cli` Causes Phase 5 Surprise

**What goes wrong:** Phase 5 runs `tfx extension create` and the manifest fails validation because `tfx-cli` was caret-installed and a recent version added a stricter schema check.

**Why it happens:** `tfx-cli` is at `0.23.1`, has 114 published versions, and is in active maintenance. Schema-strictness changes have happened in the past (e.g., `0.21.x → 0.22.x` tightened version regex).

**How to avoid:** Install `tfx-cli` with `--save-exact` and the `.npmrc` `save-exact=true` flag. Lock to `0.23.1` in Phase 0. Phase 5 deliberately bumps if needed — never accidentally.

**Warning signs:** This bites in Phase 5, not Phase 0. Phase 0 mitigation is preventive only.

### Pitfall 4: Manifest Scope Includes Anything Beyond `vso.work_write`

**What goes wrong:** Adding `vso.profile`, `vso.work_full`, or any extra scope in the skeleton manifest, even with `public: false`, sets a precedent. When Phase 5 ships public, every install requires admin re-consent if scopes ever change.

**Why it happens:** Devs grab a sample manifest with `vso.work_full` ("more permissions = more capable") and don't trim. PITFALLS.md Pitfall 3 covers this.

**How to avoid:** The skeleton's `scopes` array contains exactly one string: `"vso.work_write"`. Add a top-of-file comment in `vss-extension.json` (or in the project README) explaining "scopes locked per Phase 0 D-08 — additions trigger forced re-consent across every install."

**Warning signs:**
- Marketplace install dialog shows >1 permission line on Phase 5 trial install (Phase 0 cannot detect this; it surfaces in Phase 5)

### Pitfall 5: `package-lock.json` Excluded From Git

**What goes wrong:** Fresh-clone smoke loop (success criterion 5) fails on CI because `npm ci` requires a lockfile and finds none. Or worse, the lockfile is committed but contains different transitive versions for two developers because they ran `npm install` (which can update the lockfile) instead of `npm ci`.

**Why it happens:** Default `.gitignore` templates sometimes exclude `package-lock.json`. Or developers run `npm install --no-package-lock` once and never realize.

**How to avoid:**
- `.gitignore` MUST NOT include `package-lock.json`
- After Phase 0 setup, the planner must verify the file is committed: `git ls-files | grep package-lock.json`
- Document in README placeholder: "Use `npm ci` not `npm install` after first clone."

**Warning signs:**
- `npm ci` errors with `npm ERR! The package-lock.json file was created with an old version of npm` or `npm ERR! Missing from lock`
- Two developers see different `node_modules/.../version` for the same package

### Pitfall 6: Placeholder Test Uses ESM Syntax With Vitest CommonJS Default

**What goes wrong:** `tests/smoke.test.ts` imports something with `import { test } from 'vitest'` but Vitest's default config doesn't see TS files because there's no `vitest.config.ts`.

**How to avoid:** Write `vitest.config.ts` (TypeScript, ESM-style is fine — Vitest handles its own ESM config) explicitly setting `test.environment: 'node'` and `test.include: ['tests/**/*.test.ts']`. The placeholder smoke test uses Vitest's globals (`describe`, `it`, `expect`) by way of `globals: true`, OR imports them explicitly — pick one and document.

**Warning signs:**
- `Cannot find name 'test'` or `'describe'` from TypeScript
- `vitest run` exits 0 but reports 0 tests ("included 0 files")

## Code Examples

Verified configurations consumed directly by the planner.

### Example 1: `package.json`

```json
{
  "name": "story-point-calculator",
  "version": "0.1.0",
  "description": "Azure DevOps work item extension: structured Story Point estimation using Complexity, Uncertainty, Effort.",
  "private": true,
  "license": "MIT",
  "author": "Tsezari Mshvenieradze",
  "engines": {
    "node": ">=20.10.0",
    "npm": ">=10.0.0"
  },
  "scripts": {
    "clean": "rimraf dist coverage",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "build": "webpack --mode production",
    "build:dev": "webpack --mode development",
    "dev": "webpack --mode development --watch",
    "package": "tfx extension create --manifest-globs vss-extension.json --output-path dist/"
  },
  "dependencies": {
    "azure-devops-extension-api": "4.270.0",
    "azure-devops-extension-sdk": "4.2.0",
    "azure-devops-ui": "2.272.0",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitest/coverage-v8": "^2.1.0",
    "copy-webpack-plugin": "^12.0.0",
    "css-loader": "^7.1.0",
    "html-webpack-plugin": "^5.6.0",
    "rimraf": "^6.0.0",
    "sass": "^1.79.0",
    "sass-loader": "^16.0.0",
    "style-loader": "^4.0.0",
    "tfx-cli": "0.23.1",
    "ts-loader": "^9.5.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "webpack": "^5.97.0",
    "webpack-cli": "^5.1.4"
  },
  "overrides": {
    "azure-devops-ui": {
      "react": "$react",
      "react-dom": "$react-dom"
    }
  }
}
```

> **`engines.node: ">=20.10.0"`** — Node 20 LTS is the safe floor as of 2026-05; the dev machine reports `v24.15.0` (verified on this host). Not setting an `engines` minimum lets devs accidentally run on EOL Node 16, where vite/vitest may misbehave.
> **`rimraf@^6.0.0`** — added because `npm run clean` needs cross-platform `rm -rf`. Optional; can be replaced by `del` or platform-specific scripts if the team prefers.
> **`save-exact` enforcement:** `.npmrc` (next example) ensures every `npm install <pkg>` writes the resolved version without `^`, so the four critical packages stay pinned.

### Example 2: `.npmrc`

```
# Source: PITFALLS.md Pitfall 14 — version pinning enforced for SDK/API/UI/tfx-cli
save-exact=true
# Note: do NOT add legacy-peer-deps=true; we use package.json overrides instead.
```

### Example 3: `tsconfig.json`

(See Pattern 3 above for the full file with rationale.)

### Example 4: `webpack.config.cjs`

(See Pattern 1 above for the full file with rationale.)

### Example 5: `vitest.config.ts`

```typescript
// vitest.config.ts — Source: vitest.dev/config docs; minimal config for pure-function tests
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',                      // no DOM needed for calc engine / audit parser
    globals: true,                            // enables `describe`, `it`, `expect` without imports
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/entries/**', 'src/**/*.tsx'], // entries are SDK glue; UI is manual-QA per project standard
    },
  },
});
```

### Example 6: `vss-extension.json` (Skeleton — Phase 0 deliverable)

```jsonc
{
  "manifestVersion": 1,
  "id": "story-point-calculator",
  "version": "0.1.0",
  "name": "Story Point Calculator",
  "publisher": "TsezariMshvenieradzeExtensions",
  "public": false,
  "targets": [
    { "id": "Microsoft.VisualStudio.Services" }
  ],
  "categories": ["Azure Boards"],
  "tags": ["story points", "estimation", "scrum", "agile"],
  "description": "Structured Story Point estimation using Complexity, Uncertainty, Effort.",
  "icons": {
    "default": "images/icon.png"
  },
  "scopes": [
    "vso.work_write"
  ],
  "files": [
    { "path": "dist", "addressable": true },
    { "path": "images", "addressable": true }
  ],
  "contributions": [
    {
      "id": "calc-sp-action",
      "type": "ms.vss-web.action",
      "description": "Toolbar action that opens the Story Point calculator modal.",
      "targets": ["ms.vss-work-web.work-item-toolbar-menu"],
      "properties": {
        "text": "Calculate Story Points",
        "title": "Open the Story Point calculator",
        "toolbarText": "Calculate SP",
        "icon": "images/icon.png",
        "uri": "dist/toolbar.html",
        "registeredObjectId": "calc-sp-action"
      }
    },
    {
      "id": "calc-sp-modal",
      "type": "ms.vss-web.external-content",
      "description": "Modal contents loaded into a host-managed dialog.",
      "properties": {
        "uri": "dist/modal.html"
      }
    }
  ]
}
```

> Contribution IDs verified against Microsoft Learn 2026-04 in upstream `ARCHITECTURE.md`. **Do not** use `ms.vss-work-web.work-item-form-toolbar-button` (does not exist) or `ms.vss-admin-web.collection-admin-hub` (wrong target).
>
> The `icon` and `images/icon.png` reference is a **placeholder** — Phase 0 ships a transparent 128×128 PNG. Phase 5 (PKG-05) replaces it with final art. The placeholder must be a valid PNG file (not zero-length) so `tfx extension create` doesn't reject the manifest at packaging time. Smallest valid placeholder: a 128×128 PNG with a single transparent pixel (about 100 bytes). Generate via ImageMagick (`magick -size 128x128 xc:transparent images/icon.png`) or a tiny base64 stub.

### Example 7: `.gitignore`

```
# Node
node_modules/

# Build output
dist/
build/

# Test output
coverage/
.vitest-cache/

# Marketplace packaging
*.vsix
.tfx-cache/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
*.log
```

> **`package-lock.json` is NOT in `.gitignore`** — must be committed for `npm ci` to work (Pitfall 5).

### Example 8: `LICENSE`

```
MIT License

Copyright (c) 2026 Tsezari Mshvenieradze

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> Year `2026` per CONTEXT.md `<specifics>` section. Copyright holder `Tsezari Mshvenieradze` per CONTEXT.md `<specifics>`.

### Example 9: `tests/smoke.test.ts`

```typescript
// tests/smoke.test.ts — Phase 0 placeholder; Phase 1 replaces with calc engine + audit parser tests
// Asserts the smoke loop wires up correctly: TS compiles, Vitest discovers and runs.

describe('smoke', () => {
  it('arithmetic still works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

### Example 10: `src/entries/toolbar.tsx` and `src/entries/modal.tsx` (Stubs)

```typescript
// src/entries/toolbar.tsx — Phase 0 stub; Phase 2 implements SDK lifecycle and openCustomDialog
// Why this exists in Phase 0: webpack must have entry files to resolve. Without them, build fails.
// What's intentionally missing: SDK.init, SDK.ready, register, notifyLoadSucceeded — all Phase 2.

export {};   // placate `isolatedModules: true`; file is a module with no exports
console.log('toolbar entry loaded — Phase 2 will register the action handler here');
```

```typescript
// src/entries/modal.tsx — Phase 0 stub; Phase 2 implements SDK + ReactDOM root
// Phase 0 deliberately ships no React render so the smoke loop's webpack build is fast and dependency-free.

export {};
console.log('modal entry loaded — Phase 2 will mount React here');
```

### Example 11: `src/template.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Story Point Calculator</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

### Example 12: `README.md` (Placeholder per D-16)

```markdown
# Story Point Calculator

Azure DevOps work item extension for structured Story Point estimation.

**Status:** In development. Marketplace listing assets and full README produced in Phase 5.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build:dev
```
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vss-web-extension-sdk` v5 (AMD/RequireJS) | `azure-devops-extension-sdk` v4 + `azure-devops-extension-api` v4 (ES modules) | Microsoft published v4 SDK ~2020 | Greenfield projects use the new pair; legacy is for maintenance of old extensions only |
| Webpack 4 with babel-loader | Webpack 5 with ts-loader | Webpack 5 GA in 2020 | Better tree-shaking, faster rebuilds, native ES modules |
| Jest with ts-jest | Vitest 2.x | Vitest GA in 2022 | Zero-config TypeScript, ESM-native; same test API as Jest |
| `node-sass` | `sass` (Dart Sass) + `sass-loader@16` | `node-sass` deprecated 2022 | `sass` is officially supported by sass-loader; node-sass installations frequently fail on M-series Macs |
| Hand-rolled HTML files copied via `copy-webpack-plugin` | `html-webpack-plugin` per entry | Stable since ~2017; just not used in Microsoft's stale sample | Per-entry chunking, automatic script injection |
| `npm install` in CI | `npm ci` in CI and on fresh clones | npm 5.7 (2018) | Deterministic; fails on lockfile mismatch instead of silently updating |

**Deprecated/outdated:**
- The Microsoft `microsoft/azure-devops-extension-sample` repo (`master` branch) uses `react@~16.13.1`, `typescript@^3.9.6`, `azure-devops-extension-sdk@^3.1.2`, AMD module compilation (`module: "amd"`), `target: "es5"`, and `copy-webpack-plugin` for HTML rather than `html-webpack-plugin`. **Reference for shape only — do not copy verbatim.** This research's Code Examples are the modernized variant the planner should consume.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Marketplace publisher `TsezariMshvenieradzeExtensions` is verified and the user has Manage permission | User Constraints (D-08) | Phase 0 cannot complete success criterion 2; the manifest's `publisher` field is correct but the user can't publish in Phase 5. **Confirmed by CONTEXT.md, but not re-verified in this research session because the management portal requires authentication.** |
| A2 | `azure-devops-ui@2.272.0` works at runtime with React 18 despite declaring `react@^16.8.1` peer | Standard Stack; Pattern 4 | If the override hides a real incompatibility, Phase 2's modal iframe renders blank or throws at runtime. Mitigation: Phase 2's "Hello" payload smoke test will surface any incompatibility before any UI work. **Community-validated in many open-source projects but not formally documented by Microsoft.** |
| A3 | `tfx extension create` does not require auth (the brief assertion is correct) | Common Pitfalls; Don't Hand-Roll | If wrong, Phase 5 needs PAT setup earlier than expected. **Verified via web search showing tfx-cli docs and community guidance — `create` is purely local packaging; only `publish` requires PAT.** |
| A4 | The Node engines floor `>=20.10.0` is appropriate for May 2026 | Code Examples (`package.json`) | Setting a floor too high blocks contributors on Node 18; setting too low risks Vitest 2.x or webpack 5.97+ runtime issues. **Node 20 was LTS for the entire research window; most CI runners default to 20 or 24.** |
| A5 | `noPropertyAccessFromIndexSignature: false` is the right TypeScript choice (allows `.StoryPoints` access on field maps) | Pattern 3 | If `true` is preferred for stricter style, the calc engine and field maps need `["StoryPoints"]` syntax everywhere. **This is a stylistic choice; the planner can flip it without affecting correctness.** |
| A6 | Empty subfolders under `src/` should contain `.gitkeep` files | Recommended Project Structure | If left empty, `git clone` doesn't recreate them; first `npm run build` fails for an unobvious reason. **Mitigation is trivial; `.gitkeep` is a 0-byte file.** |
| A7 | Placeholder 128×128 transparent PNG icon satisfies `tfx extension create` schema validation | Code Examples (`vss-extension.json`); Pitfall mitigation | If `tfx-cli` rejects a single-pixel transparent PNG, Phase 5 packaging fails; Phase 0 needs a more substantial placeholder. **Microsoft's sample uses real icons but the schema only checks file existence and PNG format, per public docs — not size or content. LOW risk.** |

**Confirmation needed before Phase 0 execution:** A1 (the planner can verify by attempting a Marketplace login during the publisher-verification task) and A2 (Phase 2 will surface any runtime incompatibility — Phase 0 cannot validate). A3, A4, A5, A6, A7 are low-risk stylistic or trivially-correctable choices.

## Open Questions

1. **Should the empty `src/` subfolders contain placeholder modules instead of just `.gitkeep`?**
   - What we know: D-05 specifies the subfolder structure; downstream phases populate them.
   - What's unclear: Whether shipping empty `src/calc/index.ts` and `src/audit/index.ts` (each exporting nothing) is more useful than `.gitkeep`, because TypeScript's `include: ["src/**/*"]` would then scan them but find nothing.
   - Recommendation: `.gitkeep` files only. Phase 1 creates real `src/calc/*.ts` files when it has actual code. Empty `index.ts` files clutter the diff and serve no purpose.

2. **Should `tsconfig.json` set `verbatimModuleSyntax: true`?**
   - What we know: The flag (TypeScript 5.0+) makes `import type` and `import` non-interchangeable, which is good hygiene for tree-shaking.
   - What's unclear: Whether `azure-devops-extension-api` types are consistently importable as types vs values.
   - Recommendation: Leave it `false` (default) for Phase 0. The planner can revisit in Phase 1 once the calc engine code is in.

3. **Does the placeholder PNG need to be exactly 128×128, or does any valid PNG suffice for Phase 0?**
   - What we know: Marketplace requires 128×128 for the final listing (PKG-05); `tfx extension create` validates the manifest schema, not the icon dimensions.
   - What's unclear: Whether `tfx-cli`'s schema validation rejects PNGs of different sizes (e.g., 1×1) at packaging time.
   - Recommendation: Generate a valid 128×128 transparent PNG via ImageMagick (`magick -size 128x128 xc:transparent images/icon.png`) so the placeholder satisfies any future Phase 0 verification step that does dimension-checking. About 100 bytes; harmless.

## Environment Availability

> Phase 0 dependencies are installed via `npm`; the only environment requirements beyond Node/npm are filesystem write access and Git.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All build/test scripts | ✓ | v24.15.0 (verified on this host) | — (Phase 0 is dead in the water without Node) |
| npm | Package install + smoke loop | ✓ | 11.12.1 (verified) | yarn / pnpm work but the smoke loop says `npm ci` per success criterion 5 — do not substitute |
| Git | Source control + lockfile commit | ✓ (repo already initialized; commit `ed816fc` is HEAD) | — | — |
| Internet access to npmjs.org | `npm install` | ✓ (`npm view` calls succeeded) | — | An offline mirror would work but is out of scope |
| Internet access to marketplace.visualstudio.com | Publisher A1 verification (manual step in browser) | ✓ (assumed; CONTEXT.md confirms publisher exists) | — | The publisher field in the manifest is locked; verification can be deferred to Phase 5 if access is unavailable in Phase 0 |
| `magick` (ImageMagick) for placeholder icon | Generating `images/icon.png` | Unknown | — | A pre-generated transparent PNG can be downloaded or hand-crafted via Node script using `pngjs`; or commit a base64 stub |
| `tfx-cli` | Phase 0 installs but does not invoke | ✓ (after `npm install`; locked at 0.23.1) | 0.23.1 | — |

**Missing dependencies with no fallback:**
- None — Phase 0 is fully executable on the current dev machine.

**Missing dependencies with fallback:**
- `magick` for the placeholder icon — easy fallback: hand-write a base64 PNG stub, or `npm i -D pngjs` and a 5-line generation script. Recommended: use `magick` if available; otherwise the planner generates the file via a small Node script committed to the repo as `scripts/generate-placeholder-icon.cjs` and runs once.

## Project Constraints (from CLAUDE.md)

CLAUDE.md is loaded into the context. The directives that bind Phase 0:

| Directive | Phase 0 Implication |
|-----------|---------------------|
| **Tech stack: React 18 + TypeScript + `azure-devops-ui`** | All version pinning aligns; React 18.3.1 exact, `azure-devops-ui@2.272.0` exact |
| **Distribution: Visual Studio Marketplace public** | Manifest `targets` includes `Microsoft.VisualStudio.Services`; no Server target |
| **Storage: ADO Extension Data Service only** | Phase 0 has no storage code; v2 EDS is out of scope per Deferred Ideas |
| **Permissions: `vso.work_write` only** | Manifest `scopes` has exactly one entry: `"vso.work_write"` |
| **Bundle size: keep `.vsix` lean** | Phase 0 has no bundle output (placeholder entries only); Phase 5 enforces |
| **Calculation precision: floating-point math; final SP integer (Fibonacci)** | Phase 0 stub only; Phase 1 implements |
| **Testing: Manual QA does UI testing per company standard; only formula logic is unit-tested** | Vitest is configured for `src/**/*.ts`, excludes `src/**/*.tsx` from coverage; no Testing Library or jsdom |
| **GSD workflow enforcement (start work via GSD command)** | Phase 0 plan is being created via `/gsd-research-phase` → `/gsd-plan-phase` → `/gsd-execute-phase`; this RESEARCH.md is the planner's input. Direct edits outside the GSD flow are prohibited per CLAUDE.md. |
| **Org standard divergence: React (not Angular 19)** | Already justified in CLAUDE.md and PROJECT.md; no Angular packages installed |
| **Verification gap: pinned versions are MEDIUM confidence** | This research RE-VERIFIED all four critical packages live; confidence elevated to HIGH |

**Org-level GPIH guidance (from `~/.claude/CLAUDE.md`):**
- Defaults to `dev.azure.com/GPIHolding/Neptune` for `ado` MCP calls — **does not apply to this project** because the dev/publish target is `cezari.visualstudio.com/Cezari` and the `TsezariMshvenieradzeExtensions` Marketplace publisher (CONTEXT.md D-08, D-13). The planner should explicitly set `organization=cezari` when running any `ado` MCP tool against the dev org, not rely on the GPIH default.

## Sources

### Primary (HIGH confidence — verified during this research session)

- npm registry — `npm view` for `azure-devops-extension-sdk` (4.2.0, published 6 months ago, 35 versions), `azure-devops-extension-api` (4.270.0, 1 month ago, 103 versions), `azure-devops-ui` (2.272.0, 2 weeks ago / 2026-04-10, 182 versions, peer `react@^16.8.1`), `tfx-cli` (0.23.1, 114 versions). Verified 2026-05-01.
- npm registry — supporting tooling versions: `react@19.2.5` (we pin 18.3.1), `typescript@6.0.3`, `webpack@5.106.2`, `vitest@4.1.5` (we floor at 2.1), `html-webpack-plugin@5.6.7`, `sass-loader@16.0.7`, `css-loader@7.1.4`, `style-loader@4.0.0`, `ts-loader@9.5.7`, `@types/node@25.6.0`, `@types/react@19.2.14`. All verified 2026-05-01.
- Upstream `.planning/research/ARCHITECTURE.md` — manifest contribution IDs verified against Microsoft Learn 2026-04. Source URLs preserved there.
- Upstream `.planning/research/STACK.md` — package choice rationale (HIGH); version floors elevated to current via this session's `npm view`.
- Upstream `.planning/research/PITFALLS.md` Pitfall 3 (scope lock) and Pitfall 14 (version pinning).
- Microsoft `tfs-cli` extension docs (web search) — confirms `tfx extension create` is a local packager with no auth; only `publish` requires PAT.
- Microsoft GitHub `microsoft/azure-devops-extension-sample` `package.json`, `webpack.config.js`, `tsconfig.json` (WebFetch) — pattern shape, verified out of date.

### Secondary (MEDIUM confidence)

- `azure-devops-ui` GitHub Issue #40 (web search hit) — confirms React 18 community usage of `azure-devops-ui` despite stale peer; multiple StackOverflow / Medium guidance for the `overrides` pattern.
- `npm install --legacy-peer-deps` ecosystem articles (multiple) — alternative to `overrides`; rejected here because surgery via `overrides` is preferred.

### Tertiary (LOW confidence — flagged for execution-time validation)

- Marketplace publisher portal management UI (`marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions`) — requires authentication; could not be reached in this research session. Assumption A1 is taken on trust from CONTEXT.md D-08.
- The placeholder icon's exact PNG validation behavior in `tfx extension create` — not formally documented; A7 reflects this. Phase 5 will validate when `tfx extension create` actually runs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version was re-verified live against npm registry; pinning rationale is documented in PITFALLS.md
- Architecture (config files, project layout, manifest skeleton): HIGH — patterns sourced from Microsoft's own sample, modernized; manifest IDs verified against Microsoft Learn 2026-04
- Pitfalls: HIGH — npm peer mismatch and webpack `.cjs` requirement reproduced and verified; lockfile gotcha is well-documented in npm docs
- Marketplace publisher access: MEDIUM — taken on trust from CONTEXT.md; cannot independently verify without auth

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (30 days for stable pinned versions; re-verify `npm view` if Phase 0 execution slips beyond this date — `azure-devops-extension-api` minor-bumps roughly monthly per its 103-version history)
