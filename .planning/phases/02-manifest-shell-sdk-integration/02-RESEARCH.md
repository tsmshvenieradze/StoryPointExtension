# Phase 2: Manifest Shell & SDK Integration - Research

**Researched:** 2026-05-02
**Domain:** Azure DevOps extension SDK v4 lifecycle integration; `ms.vss-web.action` toolbar contribution; `HostPageLayoutService.openCustomDialog`; `azure-devops-ui` Page/Surface theme inheritance; `tfx-cli@0.23.1` dev-publish loop with `--share-with` and `--rev-version`
**Confidence:** HIGH (SDK type signatures verified from installed `node_modules`; tfx-cli command flags verified from compiled source; Microsoft Learn 2026-04 contribution IDs cross-referenced; canonical Microsoft sample `work-item-toolbar-menu` fetched as ground truth)

## Summary

Phase 2 is the integration acid test: a real `.vsix` published to `cezari.visualstudio.com` whose toolbar action opens a host-managed themed dialog with a "Hello from Work Item #N" payload. The entire risk concentrates on five micro-decisions where SDK silent-failure patterns dominate: (1) SDK lifecycle ordering (`init → ready → register → notifyLoadSucceeded`), (2) contribution-ID exact match between manifest `id`/`registeredObjectId` and `SDK.register(id, ...)` call, (3) contribution-ID format passed to `openCustomDialog` (must be FULL `<publisher>.<extension>.<contrib>` form), (4) theme propagation via `applyTheme: true` (default) plus `azure-devops-ui` `Surface`+`Page` chrome, and (5) `tfx-cli` dev-publish loop semantics — `--rev-version` MUTATES `vss-extension.json` on disk, `--share-with` accepts space-separated org names, `--token`/`-t` is the only PAT input (NO `TFX_TOKEN` env var support), and **`.tfxignore` is NOT a tfx-cli feature** — packaging is driven exclusively by the manifest's `files` array.

The verified Microsoft sample at `microsoft/azure-devops-extension-sample/src/Samples/work-item-toolbar-menu` is the line-by-line ground truth for the toolbar shim. Its companion `panel-content` sample is the line-by-line ground truth for the modal. Both use ES module imports of `azure-devops-extension-sdk`, the bare contribution ID in `SDK.register("...", () => ({execute, ...}))`, and `SDK.getExtensionContext().id + ".panel-content"` to compute the full ID for `openCustomDialog`. The modal sample wraps content in `azure-devops-ui` `Page` and calls `SDK.notifyLoadSucceeded()` after async work resolves — the canonical `loaded:false` lifecycle. Theme inheritance is automatic (the SDK's `applyTheme:true` default writes ADO theme CSS variables onto the iframe's `<html>` element; `azure-devops-ui` components are theme-token-aware out of the box).

Two facts in the existing project artifacts diverge from the Microsoft Learn 2026-04 source. First, CONTEXT.md D-15 mandates a `.tfxignore` file — but tfx-cli has no such feature; the manifest's `files: [{ "path": "dist", "addressable": true }, ...]` array IS the ignore mechanism (anything not listed is excluded). Phase 2 should DELETE the `.tfxignore` requirement and rely on `files` plus `.gitignore` (which keeps `*.vsix` and `node_modules/` out of git, but is irrelevant to packaging). Second, CONTEXT.md D-15 mentions "vs the obvious" comment-vs-field write order — that's downstream and not Phase 2. Third, Microsoft's "Add a menu action" docs page (2026-04-03) at `learn.microsoft.com/.../add-workitem-extension` shows a target of `ms.vss-work-web.work-item-context-menu` — but the Extensibility Points overview page lists `ms.vss-work-web.work-item-toolbar-menu` for "Work item for context menu" (with a screenshot of the form toolbar), AND the canonical sample uses `ms.vss-work-web.work-item-toolbar-menu`. Conclusion: the existing manifest's `ms.vss-work-web.work-item-toolbar-menu` target is correct and verified; do not change it.

**Primary recommendation:** Replace `src/entries/toolbar.tsx` and `src/entries/modal.tsx` with the verbatim two-sample pattern below (toolbar is plain TS, no React; modal is React mounted with `azure-devops-ui` `Surface` wrapping `Page`). Keep the existing `vss-extension.json` exactly as-is — it already passes the verified contribution-ID gates from Phase 0 — and only ADD the inline 16×16 SVG file to `images/` plus a manifest tweak referencing it (the existing manifest references `images/icon.png` as both the marketplace icon AND the toolbar icon, which works for Phase 2's smoke test but Phase 5 will split). Add `dev:publish` and `dev:share` npm scripts that chain `build` → `tfx extension publish --rev-version --share-with cezari -t $TFX_PAT`. Document the dev loop in README. Phase 2 ships in 8–10 small tasks with one external auth gate (PAT entry on first publish).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dev Iteration Loop**
- **D-01:** `tfx extension publish --share-with cezari` is the dev iteration command. Each cycle: edit code → `npm run build` → `npm run package` → `tfx extension publish --share-with cezari`. Refresh the work item form in the browser to pick up the new version. ~30 seconds per iteration.
- **D-02:** Marketplace PAT is already provisioned. The PAT is stored locally (will be added to Phase 2's `.env.local` if convenient) and supplied to `tfx extension publish` via either the `--token` flag or the `TFX_TOKEN` environment variable. Do NOT commit the token; `.env.local` (and any `*.env` patterns) must be gitignored.
- **D-03:** Auto-bump dev version per publish. Use `tfx extension publish --rev-version` to auto-increment the `vss-extension.json` patch version on each dev publish, OR maintain a separate `vss-extension.dev.json` overlay and bump manually. Planner decides exact mechanism.

**"Hello" Modal Payload**
- **D-04:** Modal renders minimal text + workItemId. Content: "Story Point Calculator — Hello from Work Item #{N}" inside an `azure-devops-ui` `Page` (or `Surface`).
- **D-05:** No on-screen lifecycle log. Use `console.log('[sp-calc] modal SDK ready', SDK.getConfiguration())` for developer-side debugging.
- **D-06:** Modal exposes a single Close button. No Apply button in Phase 2 — Phase 4 owns Apply.

**Toolbar Contribution Details**
- **D-07:** Toolbar label: `Calculate Story Points`.
- **D-08:** Toolbar icon: inline 16×16 calculator SVG. `images/toolbar-icon.svg` with `fill="currentColor"`. Reference via `properties.iconUrl: "images/toolbar-icon.svg"` in `vss-extension.json`. Add the path to the `files` block.
- **D-09:** Action registration: callback's `execute(actionContext)` extracts work item ID from `actionContext.workItemId` (or equivalent) and calls `HostPageLayoutService.openCustomDialog('calc-sp-modal', { configuration: { workItemId } })`.

**Configuration Passing**
- **D-10:** Modal receives `{ workItemId: number }` only.
- **D-11:** Type: `export type CalcSpModalConfig = { workItemId: number }`. Lives in `src/ado/types.ts` (new file). Both `toolbar.tsx` and `modal.tsx` import.

**SDK Lifecycle Discipline**
- **D-12:** Both iframes follow canonical lifecycle: `SDK.init({ loaded: false })` → `await SDK.ready()` → register / read configuration → `SDK.notifyLoadSucceeded()`. Comment block in each entry pointing at PITFALLS.md Pitfall 6.
- **D-13:** No theme detection code. `azure-devops-ui` Surface/Page applies theme automatically.

**`.vsix` Packaging Conventions**
- **D-14:** Dev `vss-extension.json` keeps `public: false`.
- **D-15:** `tfx ignore` rules — exclude `node_modules/`, `tests/`, `.planning/`, `src/`, `*.md`, `*.config.*`, `package*.json`, `.git/`, `.gitignore`, `LICENSE`. Build the `.tfxignore` file in Phase 2 to enforce this. **NOTE: tfx-cli does NOT honor `.tfxignore` — see Common Pitfalls Pitfall 5 below for the correct mechanism (manifest `files` array).**
- **D-16:** Bundle size target: <100 KB gzipped. Don't add a CI gate yet; check manually.

**Environment & Secrets Hygiene**
- **D-17:** Add `.env*` patterns to `.gitignore`.
- **D-18:** Document a `tfx publish` recipe in `README.md` (~10 lines).

**Verification Approach**
- **D-19:** All 4 ROADMAP success criteria verified manually in dev org; `02-VERIFICATION.md` test plan documents steps for the verifier agent.
- **D-20:** No automated test for Phase 2.

**Phase 2 Scope Boundaries**
- **D-21:** No FieldResolver in Phase 2.
- **D-22:** No ADO REST calls in Phase 2.
- **D-23:** No write operations in Phase 2.
- **D-24:** No imports of `src/calc/` or `src/audit/`.

### Claude's Discretion

- Exact SVG content for the toolbar icon (D-08).
- Exact `--rev-version` mechanic (D-03).
- Whether the modal Close button is provided by the host dialog chrome, by `azure-devops-ui` `PanelFooterButtons`, or by a custom Button.
- How `[sp-calc]` log prefix is structured.
- Whether to use a `Page` or `Surface` for the Hello layout.

### Deferred Ideas (OUT OF SCOPE)

- Branded marketplace icon (Phase 5).
- Bundle-size CI gate (Phase 5).
- Modal close keyboard handling / Esc to close (Phase 3 owns full UI-07).
- Telemetry.
- Hot-reload via `tfx extension serve`.
- Sourcemap publishing (Phase 5).
- Per-environment manifests.
- PAT secret rotation policy.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | A "Calculate Story Points" entry appears in the work item toolbar menu via the `ms.vss-web.action` contribution targeting `ms.vss-work-web.work-item-toolbar-menu` | Existing `vss-extension.json` already declares this contribution correctly (Phase 0); the Microsoft canonical sample `work-item-toolbar-menu.ts` confirms the registration pattern; SDK lifecycle code in §Code Examples below |
| UI-02 | Clicking the toolbar entry opens a modal via `HostPageLayoutService.openCustomDialog` referencing the `ms.vss-web.external-content` modal contribution | Verified `IHostPageLayoutService.openCustomDialog` signature (returns `void`, takes `contentContributionId: string` and `IDialogOptions<TResult>`); canonical sample shows `SDK.getExtensionContext().id + ".panel-content"` ID composition; D-09 names `'calc-sp-modal'` |
| UI-06 | Modal renders correctly in both light and dark ADO themes (theme inherited from host) | `SDK.init({ applyTheme: true })` is the SDK default (verified type signature); `azure-devops-ui` `Surface`+`Page` consume the SDK-applied CSS variables; the canonical `panel-content` sample wraps content in `<Page>` and inherits theme automatically |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Manifest contribution declaration | Static file (`vss-extension.json`) | Build tooling (tfx-cli reads it at package time) | Manifest IS the wire contract between extension and ADO host; never executed |
| Toolbar action registration | Toolbar iframe (`src/entries/toolbar.tsx`) | Host SDK (postMessage bridge) | Hidden iframe runs only to register `execute` callback and call `openCustomDialog` |
| Dialog opening | Toolbar iframe → `HostPageLayoutService` | Host (creates dialog iframe) | `openCustomDialog` is a host-tier service; the dialog iframe is created by the host, not the toolbar |
| Modal rendering | Modal iframe (`src/entries/modal.tsx`) → React + azure-devops-ui | — | Each contribution gets its own sandboxed iframe; React mounts in `<div id="root">` |
| Theme inheritance | Host (passes theme variables) → SDK (`applyTheme:true`) → `azure-devops-ui` (consumes CSS vars) | — | Three-step propagation; no detection or branching code in extension |
| Configuration passing | Toolbar iframe → host (via openCustomDialog options) → modal iframe (via `SDK.getConfiguration()`) | — | Configuration is opaque JSON; functions cannot cross postMessage boundary |
| Dev publish loop | Local CLI (`tfx extension publish`) → Marketplace API | Local file system (`vss-extension.json` mutated by `--rev-version`) | tfx-cli packages from manifest's `files` array, not from a `.tfxignore`; PAT supplied via `--token`/`-t` flag |
| Bundle production | webpack 5 (existing two-entry config) | Local file system (writes to `dist/`) | No changes needed to webpack config for Phase 2; entries are already wired |

## Standard Stack

### Core (already pinned in Phase 0; re-verified live 2026-05-02)

| Package | Pinned version | Purpose | Why Standard | Confidence |
|---------|---------------:|---------|--------------|------------|
| `azure-devops-extension-sdk` | `4.2.0` | `SDK.init()`, `SDK.ready()`, `SDK.register()`, `SDK.getService()`, `SDK.getConfiguration()`, `SDK.getExtensionContext()`, `SDK.notifyLoadSucceeded()` | The exact API surface Phase 2 exercises; type signatures verified from `node_modules/azure-devops-extension-sdk/SDK.d.ts` | HIGH `[VERIFIED: npm view 4.2.0; node_modules SDK.d.ts inspected]` |
| `azure-devops-extension-api` | `4.270.0` | `CommonServiceIds.HostPageLayoutService`, `IHostPageLayoutService`, `IDialogOptions<TResult>` | Provides typed access to the dialog service Phase 2 calls | HIGH `[VERIFIED: npm view 4.270.0; node_modules CommonServices.d.ts inspected]` |
| `azure-devops-ui` | `2.272.0` | `Page` (from `azure-devops-ui/Page`), `Surface` (from `azure-devops-ui/Surface`), optionally `Button` from `azure-devops-ui/Button` | Theme-aware chrome that inherits ADO light/dark variables; matches Microsoft canonical sample | HIGH `[VERIFIED: npm view 2.272.0; node_modules Page.d.ts and Surface.d.ts inspected]` |
| `tfx-cli` | `0.23.1` | `tfx extension publish --share-with --rev-version --token` | Microsoft's only Marketplace publishing tool; Phase 2 invokes it for dev-publish loop | HIGH `[VERIFIED: npm view 0.23.1; node_modules tfx-cli/_build/exec/extension/{default,publish}.js inspected]` |

### Supporting (already installed; no new deps for Phase 2)

| Package | Pinned version | Purpose | When to Use | Confidence |
|---------|---------------:|---------|-------------|------------|
| `react` | `18.3.1` | Modal render | Modal iframe only | HIGH `[VERIFIED: package.json]` |
| `react-dom` | `18.3.1` | Modal mount | Modal iframe only | HIGH `[VERIFIED: package.json]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `azure-devops-ui` `Surface` + `Page` | Plain `<div>` with manual theme CSS | Loses automatic theme inheritance; UI-06 would require explicit token detection — more code, worse fidelity |
| `tfx extension publish --share-with cezari` | `tfx extension publish` then `tfx extension share --share-with cezari` separately | Two commands instead of one; same outcome; D-01 picks the combined form |
| `tfx extension publish --rev-version` | Manual edit of `vss-extension.json` version per publish | Manual edits invite mistakes; auto-rev mutates the file but the planner can revert in dev or commit dev versions deliberately |
| Inline 16×16 SVG file | PNG icon (matching the marketplace 128×128) | SVG renders crisply at every zoom level; uses `currentColor` for theme inheritance; smaller bytes |
| `--token <PAT>` on command line | `TFX_TOKEN` env var | **`TFX_TOKEN` does NOT exist** — `tfx-cli` only accepts `--token`/`-t` flag (verified in `tfcommand.js` line 250) or interactive prompt; environment var support is for `TFX_TRACE` only. Recommendation: source `.env.local` then pass `$TFX_PAT` (or whatever local var name) into the `--token` flag |

**No new packages needed for Phase 2** — the existing pinned set covers everything.

## Architecture Patterns

### System Architecture Diagram

```
                  USER (browser)
                       │
                       │ opens work item form
                       ▼
            ┌─────────────────────────────┐
            │ Azure DevOps host page      │
            │  (dev.azure.com/cezari)     │
            └──────────────┬──────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       │                                       │
       │  Work item form iframe (host-managed) │
       │                                       │
       │  ┌─────────────────────────────────┐  │
       │  │ Toolbar (host-rendered, ADO UI) │  │
       │  │  ▸ ... overflow                 │  │
       │  │     ▸ Calculate Story Points  ◀─┼──┼── (1) entry rendered from
       │  │       (text from manifest)      │  │     vss-extension.json properties.text;
       │  └────────────┬────────────────────┘  │     icon from properties.iconUrl
       │               │ click                 │
       │               ▼                       │
       │  ┌─────────────────────────────────┐  │
       │  │ Hidden toolbar iframe           │  │     (2) host loads dist/toolbar.html
       │  │  uri: dist/toolbar.html         │◀─┼─────    immediately on form load,
       │  │  size: 0×0 (no UI)              │  │         not on click. The iframe
       │  │                                 │  │         registers an action handler
       │  │  SDK.init({ loaded:false })     │  │         and calls notifyLoadSucceeded()
       │  │  await SDK.ready()              │  │         once registration is complete.
       │  │  SDK.register(                  │  │
       │  │   "calc-sp-action",             │  │     (3) on user click, host invokes
       │  │   () => ({                      │  │         the registered execute(ctx)
       │  │    execute: async (ctx) => {    │◀─┼─────    with actionContext (work item
       │  │      const layoutSvc = await    │  │         id, type, title, etc.)
       │  │        SDK.getService(...)      │  │
       │  │      layoutSvc.openCustomDialog(│  │
       │  │        extId + ".calc-sp-modal",│──┼────▶ (4) host mounts dialog with
       │  │        { title, configuration:  │  │         dist/modal.html as iframe src
       │  │          { workItemId } })      │  │
       │  │    }                            │  │
       │  │   })                            │  │
       │  │  )                              │  │
       │  │  SDK.notifyLoadSucceeded()      │  │
       │  └─────────────────────────────────┘  │
       │                                       │
       │  ┌─────────────────────────────────┐  │
       │  │ Modal dialog iframe              │  │     (5) modal reads workItemId from
       │  │  uri: dist/modal.html            │  │         configuration, renders chrome
       │  │  size: host-managed (default)    │  │         with azure-devops-ui Page
       │  │                                  │  │
       │  │  SDK.init({ loaded:false })      │  │
       │  │  await SDK.ready()               │  │     (6) Theme CSS variables flow:
       │  │  const cfg = SDK.getConfiguration│  │         host theme → SDK
       │  │    <CalcSpModalConfig>()         │  │         (applyTheme:true default) →
       │  │  ReactDOM.render(                │◀─┼─────    iframe <html> root variables →
       │  │    <Surface><Page>...</Page>     │  │         azure-devops-ui Surface+Page
       │  │     </Surface>, '#root')         │  │         → light/dark colors flip
       │  │  SDK.notifyLoadSucceeded()       │  │         automatically
       │  └─────────────────────────────────┘  │
       └───────────────────────────────────────┘
                       ▲
                       │ user clicks X / outside / Close
                       │ host destroys dialog iframe
                       │
                  USER (sees "Hello from Work Item #N",
                        toggles theme, watches colors flip,
                        closes dialog cleanly)
```

### Recommended Project Structure (Phase 2 deltas only)

```
src/
├── ado/
│   ├── .gitkeep                 # remove in Phase 2
│   └── types.ts                 # NEW (Phase 2): CalcSpModalConfig type
├── entries/
│   ├── toolbar.tsx              # REPLACE Phase 0 stub
│   └── modal.tsx                # REPLACE Phase 0 stub
└── template.html                # already has <div id="root">; no changes

images/
├── icon.png                     # 128×128 marketplace icon (Phase 0)
└── toolbar-icon.svg             # NEW (Phase 2): 16×16 inline SVG, fill=currentColor

.env.local                       # NEW (Phase 2, gitignored): TFX_PAT=<PAT>
.gitignore                       # MODIFY: add .env, .env.local, .env.*.local
README.md                        # MODIFY: add "Dev Publish" recipe section
package.json                     # MODIFY: add dev:publish, dev:share, dev:rev-publish scripts
vss-extension.json               # MODIFY: add toolbar-icon.svg to files; add iconUrl to action properties
```

### Pattern 1: Toolbar entry (verbatim from Microsoft `work-item-toolbar-menu` sample, modernized)

**What:** Plain TS module — NO React, NO `azure-devops-ui`. Registers a factory that returns an `execute(actionContext)` callback. The factory shape is the canonical pattern from Microsoft's verified sample.

**Why factory not object:** `SDK.register(id, () => ({...}))` runs the factory each time the host invokes the registration; this gives a fresh closure per invocation. The Microsoft sample uses this form. An object literal `SDK.register(id, {...})` also works (the SDK type signature accepts both via `T extends Object`), but the factory is the documented sample pattern.

**When to use:** Every `ms.vss-web.action` toolbar contribution.

```typescript
// src/entries/toolbar.tsx — Phase 2 implementation
// SDK lifecycle ordering matters — see PITFALLS.md Pitfall 6 (SDK silent failure patterns).
// Source: https://github.com/microsoft/azure-devops-extension-sample/blob/master/src/Samples/work-item-toolbar-menu/work-item-toolbar-menu.ts

import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IHostPageLayoutService } from "azure-devops-extension-api";
import type { CalcSpModalConfig } from "../ado/types";

const LOG_PREFIX = "[sp-calc/toolbar]";

// The registered object id MUST match the manifest's
// contributions[].properties.registeredObjectId (or contributions[].id when
// registeredObjectId is omitted). Mismatch = silent failure: host fires no callback.
const REGISTERED_ID = "calc-sp-action";

// Composing the modal contribution id at runtime via SDK.getExtensionContext()
// keeps the publisher and extension id in one place (the manifest), so renames
// can't silently break the dialog open.
const MODAL_CONTRIB_SHORT_ID = "calc-sp-modal";

SDK.register(REGISTERED_ID, () => {
  return {
    // Host calls execute(actionContext) when the user clicks the toolbar entry.
    // actionContext shape for ms.vss-work-web.work-item-toolbar-menu is
    // documented as `any` in Microsoft samples — observed fields include
    // workItemId, id (alias for workItemId on some surfaces), and
    // workItemTypeName. We treat the parameter as a permissive shape and
    // extract a numeric work item id from either field.
    execute: async (actionContext: { workItemId?: number; id?: number; [k: string]: any }) => {
      const workItemId =
        typeof actionContext?.workItemId === "number"
          ? actionContext.workItemId
          : typeof actionContext?.id === "number"
            ? actionContext.id
            : undefined;

      console.log(`${LOG_PREFIX} execute fired`, { actionContext, resolvedWorkItemId: workItemId });

      if (workItemId === undefined) {
        console.error(`${LOG_PREFIX} no work item id in actionContext`, actionContext);
        return;
      }

      const layoutSvc = await SDK.getService<IHostPageLayoutService>(
        CommonServiceIds.HostPageLayoutService
      );

      const config: CalcSpModalConfig = { workItemId };
      const fullModalId = `${SDK.getExtensionContext().id}.${MODAL_CONTRIB_SHORT_ID}`;

      console.log(`${LOG_PREFIX} opening dialog`, { fullModalId, config });

      // openCustomDialog returns void (verified type signature).
      // The dialog has a host-managed close button (X) plus lightDismiss:true default.
      // onClose fires when the host closes the dialog (X, lightDismiss outside-click,
      // or programmatic close from inside the modal — see Pattern 3).
      layoutSvc.openCustomDialog<undefined>(fullModalId, {
        title: "Calculate Story Points",
        configuration: config,
        lightDismiss: true,
        onClose: () => {
          console.log(`${LOG_PREFIX} dialog closed`);
        }
      });
    }
  };
});

// Initialize AFTER register so the registration is in place when the host
// completes the handshake. The SDK's IExtensionInitOptions defaults are
// applyTheme:true and loaded:true — toolbar iframe has no UI, so loaded:true
// (the default) is correct here. The Microsoft sample calls SDK.init() with
// no options for the same reason.
SDK.init();
console.log(`${LOG_PREFIX} init() called`);
```

**Key observations from the sample (verified by line-by-line read of the Microsoft canonical):**
1. `SDK.register("...", () => {...})` is called BEFORE `SDK.init()` — the SDK queues registrations until init completes.
2. The registration ID is the bare contribution id (`"calc-sp-action"`), NOT the full publisher.extension.id.
3. The dialog ID passed to `openCustomDialog` IS the full publisher.extension.id, computed at runtime via `SDK.getExtensionContext().id + ".calc-sp-modal"`.
4. `actionContext` is typed as `any` in the sample — SDK does not provide a typed `WorkItemActionContext` interface. We add a permissive runtime guard that handles `workItemId`, `id`, or both.
5. The toolbar iframe does NOT call `SDK.notifyLoadSucceeded()` — its default `loaded:true` lets the host hide the spinner immediately. (D-12 says both iframes use `loaded:false` for discipline; for the toolbar this is fine — just adds an explicit `notifyLoadSucceeded()` after `register`. Microsoft's sample omits it.)

### Pattern 2: Modal entry (verbatim from Microsoft `panel-content` sample, modernized)

**What:** React app mounting via `ReactDOM.createRoot` (React 18 idiomatic; Microsoft sample still uses `ReactDOM.render` legacy because it predates 18 — the modernized version uses `createRoot`). Wraps content in `Surface` + `Page` from `azure-devops-ui` for automatic theme inheritance. Reads configuration via `SDK.getConfiguration<CalcSpModalConfig>()`.

**When to use:** Every `ms.vss-web.external-content` modal contribution.

```typescript
// src/entries/modal.tsx — Phase 2 implementation
// Source: https://github.com/microsoft/azure-devops-extension-sample/blob/master/src/Samples/panel-content/panel-content.tsx
// Modernized: React 18 createRoot; loaded:false discipline per D-12.

import * as React from "react";
import { createRoot } from "react-dom/client";
import * as SDK from "azure-devops-extension-sdk";
import { Surface, SurfaceBackground } from "azure-devops-ui/Surface";
import { Page } from "azure-devops-ui/Page";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";

// azure-devops-ui ships SCSS modules; one global override sheet ensures
// Surface/Page inherit ADO theme tokens correctly. The Microsoft sample
// imports it once in the shared Common.tsx; we inline it here.
import "azure-devops-ui/Core/override.css";

import type { CalcSpModalConfig } from "../ado/types";

const LOG_PREFIX = "[sp-calc/modal]";

interface HelloProps {
  workItemId: number;
}

const Hello: React.FC<HelloProps> = ({ workItemId }) => {
  return (
    <Surface background={SurfaceBackground.neutral}>
      <Page className="flex-grow">
        <Header
          title="Story Point Calculator"
          titleSize={TitleSize.Large}
        />
        <div className="page-content page-content-top">
          <p>Hello from Work Item #{workItemId}</p>
        </div>
        <div className="page-content page-content-bottom">
          <ButtonGroup>
            <Button
              text="Close"
              primary={true}
              onClick={() => {
                console.log(`${LOG_PREFIX} Close clicked`);
                // Phase 2: rely on host-managed dialog close (X button + lightDismiss).
                // For an in-modal Close button to actually dismiss the dialog,
                // see Pattern 3 below — Phase 2 simply reloads/no-ops because
                // the host's X is the canonical close path.
                // For Phase 2 the simplest path is host close; this Button
                // exists to satisfy D-06 visually.
              }}
            />
          </ButtonGroup>
        </div>
      </Page>
    </Surface>
  );
};

async function bootstrap() {
  // Lifecycle: init → ready → read config → render → notifyLoadSucceeded.
  // applyTheme:true is the SDK default — the host's theme variables are pushed
  // onto our iframe's <html> element automatically. azure-devops-ui Surface+Page
  // consume those variables via CSS, no detection code needed (D-13).
  // loaded:false matches D-12 — we'll explicitly notifyLoadSucceeded after render.
  await SDK.init({ loaded: false });
  await SDK.ready();

  const config = SDK.getConfiguration() as CalcSpModalConfig;
  console.log(`${LOG_PREFIX} SDK ready`, { config });

  // Defensive: if configuration is missing (shouldn't happen in normal flow,
  // but openCustomDialog without options would yield undefined), default to 0
  // and log loudly so debugging doesn't waste time.
  const workItemId = typeof config?.workItemId === "number" ? config.workItemId : 0;
  if (workItemId === 0) {
    console.error(`${LOG_PREFIX} workItemId missing from configuration`, config);
  }

  const root = createRoot(document.getElementById("root")!);
  root.render(<Hello workItemId={workItemId} />);

  // Tell the host to remove its loading spinner. Without this call the
  // host shows a permanent spinner over the dialog content. (PITFALLS Pitfall 6.)
  await SDK.notifyLoadSucceeded();
  console.log(`${LOG_PREFIX} notifyLoadSucceeded called`);
}

bootstrap().catch((err) => {
  console.error(`${LOG_PREFIX} bootstrap failed`, err);
  // notifyLoadFailed surfaces a host-level error UI instead of a stuck spinner.
  SDK.notifyLoadFailed(err instanceof Error ? err : String(err));
});
```

**Key observations:**
1. `SDK.init({ loaded: false })` is awaited — the function returns `Promise<void>` (verified type signature).
2. `SDK.ready()` is also awaited — the SDK doc says it returns `Promise<void>` and resolves once the handshake completes.
3. `SDK.getConfiguration()` is **synchronous** after `ready()` resolves — it returns `{[key: string]: any}` per the verified type. We assert to `CalcSpModalConfig` at the call site.
4. The Microsoft sample uses `SDK.resize(400, 600)` to ask the host to resize the iframe. The dialog has a default size, but Phase 2's "Hello" content fits comfortably; we OMIT `resize()` to keep code minimal.
5. `notifyLoadSucceeded()` is called AFTER React renders. Calling it before render leaves the user staring at empty content; calling it never leaves a permanent spinner.
6. `notifyLoadFailed(err)` is the documented bail-out (verified type signature in `SDK.d.ts`).

### Pattern 3: ADO types module

**What:** A single tiny TypeScript file declaring the `CalcSpModalConfig` shape (D-11). Both `toolbar.tsx` (writer) and `modal.tsx` (reader) import from it to keep the contract symmetric.

```typescript
// src/ado/types.ts — Phase 2; Phase 3 will expand this file with FieldResolver types.
// Source: D-11 in CONTEXT.md.

/**
 * Configuration payload passed from the toolbar action to the modal dialog
 * via HostPageLayoutService.openCustomDialog's options.configuration.
 *
 * The host serializes this object via postMessage; only JSON-safe values
 * survive the round trip — no functions, no Map/Set, no circular refs.
 */
export type CalcSpModalConfig = {
  workItemId: number;
};
```

### Pattern 4: Inline 16×16 SVG toolbar icon (D-08)

**What:** A standalone SVG file referenced from the manifest's contribution `properties.iconUrl`. Single color, uses `fill="currentColor"` so ADO theme tokens drive the foreground color. The Microsoft sample uses PNGs with explicit `light`/`dark` variants; an SVG with `currentColor` collapses both into one file.

**When to use:** Any toolbar/menu contribution where a monochrome icon suffices and you want theme-perfect rendering at any zoom level.

```svg
<!-- images/toolbar-icon.svg — Phase 2 placeholder calculator glyph.
     Phase 5 (PKG-05) replaces with the final branded icon if needed.
     viewBox="0 0 16 16" matches the toolbar size. Single-color paths,
     fill="currentColor" inherits the ADO toolbar foreground color. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <!-- Calculator outline -->
  <path fill-rule="evenodd" d="M3 1.5A1.5 1.5 0 0 1 4.5 0h7A1.5 1.5 0 0 1 13 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 14.5v-13Zm1.5-.5a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-13a.5.5 0 0 0-.5-.5h-7Z"/>
  <!-- Display strip -->
  <path d="M5 3h6v2H5V3Z"/>
  <!-- Buttons (4 dots in a 2x2 grid) -->
  <circle cx="6" cy="8" r="0.75"/>
  <circle cx="10" cy="8" r="0.75"/>
  <circle cx="6" cy="11" r="0.75"/>
  <circle cx="10" cy="11" r="0.75"/>
</svg>
```

### Pattern 5: Manifest delta (one minimal edit to existing `vss-extension.json`)

**What:** Add `images/toolbar-icon.svg` to the contribution `properties` and ensure it appears in the `files` array (it already does since `images` is `addressable: true` and recursive). Keep the marketplace icon (`images/icon.png`) as-is.

**Decision point on property name (Pattern 5a):** CONTEXT.md D-08 mentions `properties.iconUrl`. Microsoft's documented properties for `ms.vss-web.action` use `icon` (singular), not `iconUrl`. The verified property table from `learn.microsoft.com/.../add-workitem-extension` (2026-04-03) lists `icon` as "URL to an icon that appears on the menu item. Relative URLs are resolved using `baseUri`." The canonical sample uses `icon: { light: "...", dark: "..." }` for theme variants OR `icon: "static/asterisk.png"` for a single image. Use **`icon`** (not `iconUrl`) — this is the verified property name. The existing manifest already has `"icon": "images/icon.png"` — Phase 2 changes it to `"icon": "images/toolbar-icon.svg"`.

```jsonc
// vss-extension.json — Phase 2 delta (only the action contribution and files block change)
{
  // ...unchanged: manifestVersion, id, version, name, publisher, public,
  // targets, categories, tags, description, icons, scopes...
  "files": [
    { "path": "dist", "addressable": true },
    { "path": "images", "addressable": true }
    // images/ is recursive; toolbar-icon.svg is automatically included.
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
        "icon": "images/toolbar-icon.svg",     // ← changed from images/icon.png
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

### Pattern 6: Dev-publish npm scripts

**What:** Three composed scripts in `package.json` covering the dev iteration loop, with explicit ordering of build → package → publish-with-share.

```jsonc
// package.json scripts delta (additions only)
{
  "scripts": {
    // ...existing scripts unchanged...

    // One-shot: bump patch, build prod, package and publish to cezari org,
    // share with the org so it appears installable. PAT supplied via
    // either ENV_VAR or interactive prompt. The --rev-version flag MUTATES
    // vss-extension.json on disk (verified in tfx-cli/_build/exec/extension/default.js
    // line 74: "Rev the patch-version of the extension and save the result").
    "dev:publish": "npm run build && tfx extension publish --manifest-globs vss-extension.json --share-with cezari --rev-version",

    // Same as dev:publish but without share — useful when re-publishing
    // to an already-shared extension after a code change.
    "dev:publish:nosharing": "npm run build && tfx extension publish --manifest-globs vss-extension.json --rev-version",

    // Standalone share command — adds an org to the extension's share list
    // without re-publishing. Idempotent.
    "dev:share": "tfx extension share --share-with cezari --publisher TsezariMshvenieradzeExtensions --extension-id story-point-calculator"
  }
}
```

**PAT supply:** the planner has TWO viable paths; pick one explicitly:

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| Pass `--token $TFX_PAT` and source `.env.local` first | Token never on disk in plain text outside `.env.local` (gitignored); explicit | Requires `dotenv-cli` or shell-specific source command | **Use this** — wrap in a Node script `scripts/dev-publish.cjs` that does `require('dotenv').config({path:'.env.local'})` then spawns `tfx` with the token |
| `tfx login --auth-type pat` interactively, cache locally in `~/.tfx/...` | No token in repo at all | Caches PAT in user profile; harder to rotate; doesn't work in CI | Phase 5 may use this for CI service connections; Phase 2 is local-dev only |

**Recommendation for Phase 2 planner:** ship a `scripts/dev-publish.cjs` (Node script) that loads `.env.local` and shells out to `tfx`. This avoids cross-platform shell differences (PowerShell vs bash sourcing semantics).

Sample wrapper:
```javascript
// scripts/dev-publish.cjs — Phase 2 dev-publish helper.
// Loads .env.local then invokes tfx-cli with the PAT from $TFX_PAT.
// PAT is never printed (tfx-cli's --token flag is a SilentStringArgument).

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const envFile = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const pat = process.env.TFX_PAT;
if (!pat) {
  console.error("TFX_PAT missing — set it in .env.local (TFX_PAT=<your PAT>)");
  process.exit(1);
}

const args = [
  "extension", "publish",
  "--manifest-globs", "vss-extension.json",
  "--share-with", "cezari",
  "--rev-version",
  "--token", pat,
  ...process.argv.slice(2)
];

const r = spawnSync("npx", ["tfx", ...args], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
```

### Anti-Patterns to Avoid

- **Calling `SDK.getService(...)` before `SDK.ready()` resolves.** The promise hangs forever — no error, no rejection. Always `await SDK.ready()` first. (PITFALLS Pitfall 6, Pitfall 20.)
- **Registering with the wrong instance ID.** Must match `registeredObjectId` in the manifest (or the contribution `id` if `registeredObjectId` is omitted). Mismatch = silent failure: clicks do nothing, no console error. (PITFALLS Pitfall 21.)
- **Calling `openCustomDialog` with the bare contribution short-id.** Must be the FULL `<publisher>.<extension>.<contribution-short-id>` form. Compute via `SDK.getExtensionContext().id + ".calc-sp-modal"`.
- **Using `.tfxignore`.** It is NOT a tfx-cli feature (verified by source-code grep — see Common Pitfalls Pitfall 5). Use the manifest's `files` array instead.
- **Skipping `SDK.notifyLoadSucceeded()` when `loaded:false` was passed.** Host shows a permanent spinner over the dialog. (PITFALLS Pitfall 6.)
- **Calling `SDK.init()` twice in the same iframe.** Undefined behavior; has caused stuck handshakes. Call exactly once at module top level.
- **Putting React/`azure-devops-ui` imports in `toolbar.tsx`.** The toolbar iframe has no UI; importing React inflates the bundle (~130 KB) for nothing.
- **Setting `properties.iconUrl` instead of `properties.icon`.** `iconUrl` is not a documented property name for `ms.vss-web.action`. CONTEXT.md D-08 used the wrong key; the verified key is `icon`.
- **Using `TFX_TOKEN` env var.** Does not exist (only `TFX_TRACE` does). Pass `--token $VAR` explicitly.
- **Importing `azure-devops-ui` from the barrel (`from "azure-devops-ui"`).** Always import per-component (`from "azure-devops-ui/Surface"`) for tree-shaking. (PITFALLS Pitfall 7.)
- **Reading `actionContext` properties without a runtime guard.** The shape is undocumented and varies by host context; always defensively destructure with fallbacks.
- **Forgetting `import "azure-devops-ui/Core/override.css"` in the modal.** Without it, theme tokens render but layout/typography classes are missing — chrome looks broken.
- **Hand-rolling a Close mechanism.** Trust the host's X button and `lightDismiss: true`. An in-modal Close button is decorative for Phase 2 (D-06 accepts host-managed close per CONTEXT.md "via the host's built-in X").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme detection | `if (window.matchMedia('(prefers-color-scheme: dark)'))...` | `SDK.init({ applyTheme: true })` (default) + `azure-devops-ui` Surface/Page | The SDK pushes ADO's exact theme variables; matchMedia won't track ADO's user-profile-driven theme override |
| Dialog rendering | Custom modal with backdrop, focus trap, Esc handling | `IHostPageLayoutService.openCustomDialog` | Host owns focus trap, Esc, X button, light-dismiss, and resizing — pages of correctness work for free |
| Iframe-to-iframe communication | postMessage+wireup between toolbar.tsx and modal.tsx | `openCustomDialog` `configuration` option + `SDK.getConfiguration()` | Host serializes JSON across the iframe boundary; functions cannot cross — don't try |
| Action context typing | Hand-typed `WorkItemActionContext` interface based on guessed fields | Permissive `{ workItemId?: number; id?: number; [k: string]: any }` with runtime guard | Microsoft does not publish a typed `WorkItemActionContext`; the canonical sample uses `any` — defensive runtime checks are the only safe path |
| `.vsix` packaging | Custom zip with manifest hash | `tfx extension create` (via `package` script) or `tfx extension publish` (which does create internally) | The `.vsix` schema includes manifest hash and content-type cross-references that only the Microsoft tool generates correctly |
| Marketplace upload | curl POST to gallery API | `tfx extension publish` | Handles auth, validation, version-conflict detection, share-list updates — months of edge cases |
| File exclusion from `.vsix` | `.tfxignore` (does not exist) or shell scripts deleting before package | Manifest `files` array — list ONLY what should be in the package | tfx-cli reads `files` exclusively; everything not listed is excluded by construction |
| Version-bumping logic per publish | Custom `npm version patch && git commit` chain | `tfx extension publish --rev-version` | The flag mutates the manifest in place AND knows about non-semver dev-only suffixes |
| In-modal Close that programmatically dismisses dialog | Custom registered methods + invocation from inside the modal | Host's X button + `lightDismiss:true` | The host already owns close; an in-modal Button is at most decorative for Phase 2 (D-06 explicitly accepts host-managed close) |

**Key insight:** Phase 2 is the smallest possible amount of code that exercises the largest possible number of integration surfaces. Every problem in this table has a "do nothing — the host or SDK handles it" answer; the temptation to write code is the failure mode.

## Common Pitfalls

### Pitfall 1: Toolbar registration ID mismatch with manifest

**What goes wrong:** `vss-extension.json` declares `properties.registeredObjectId: "calc-sp-action"` but `toolbar.tsx` calls `SDK.register("calc-sp-handler", ...)`. The toolbar entry appears in the menu, but clicking does nothing — no console error, no network failure, no host log.

**Why it happens:** The two strings live in different files; copy-paste drift; renames that update one but not the other.

**How to avoid:**
- Define the constant once: `const REGISTERED_ID = "calc-sp-action"` at the top of `toolbar.tsx` and reference both manifest's `properties.registeredObjectId` and `SDK.register(REGISTERED_ID, ...)` to it.
- Document the constraint in a comment: "Must match vss-extension.json contributions[id=calc-sp-action].properties.registeredObjectId."
- During verification, grep both files for the exact ID and confirm they match.

**Warning signs:** Toolbar entry visible, click triggers nothing, no console activity. Browser DevTools Network tab shows the toolbar.html iframe loaded but no postMessage activity on click.

### Pitfall 2: openCustomDialog short-id vs full-id confusion

**What goes wrong:** Toolbar's `execute` calls `layoutSvc.openCustomDialog("calc-sp-modal", {...})` with the bare short-id. Host fails to resolve the contribution ID — silently does nothing, OR throws a less-than-helpful error. The dialog never appears.

**Why it happens:** The first argument's name (`contentContributionId`) is misleading — sample code uses the full ID, not the short ID.

**How to avoid:** Always compose the full ID at runtime:
```typescript
const fullModalId = `${SDK.getExtensionContext().id}.calc-sp-modal`;
layoutSvc.openCustomDialog(fullModalId, {...});
```
This automatically picks up the publisher and extension id from the running extension's context, so renames in `vss-extension.json` propagate.

**Warning signs:** Click fires (console log proves it), `openCustomDialog` returns void without throwing, but no dialog appears in the host. Sometimes a tiny host-banner error like "Cannot find contribution X" — easy to miss in a busy console.

### Pitfall 3: Missing `notifyLoadSucceeded()` leaves spinner stuck

**What goes wrong:** Modal is wired with `SDK.init({ loaded: false })` per D-12. Modal renders correctly, user sees content, but a permanent loading spinner overlays the dialog. Modal is interactive but visually broken.

**Why it happens:** `loaded:false` tells the host "I'll tell you when I'm ready"; without `notifyLoadSucceeded()`, the host waits forever.

**How to avoid:** ALWAYS call `SDK.notifyLoadSucceeded()` after the React render is complete. Pair it with `SDK.notifyLoadFailed(err)` in the `.catch` for symmetry. Both are documented (verified in `SDK.d.ts`).

**Warning signs:** Modal content is visible but a spinner overlay never goes away. Network tab shows postMessage from extension to host completed init/ready but no "ready" message back.

### Pitfall 4: Theme variables not applied because override.css not imported

**What goes wrong:** Modal renders with `<Surface>` and `<Page>`, but text is gray-on-gray, layout is wrong, ADO's chrome doesn't appear at all. Toggling theme has no effect.

**Why it happens:** `azure-devops-ui` ships base styles in a separate CSS file that must be imported once per iframe. Without it, components get theme variables (because `applyTheme:true` is default) but lack their own layout/typography rules.

**How to avoid:** Add `import "azure-devops-ui/Core/override.css";` at the top of `modal.tsx` (verified in Microsoft sample's `Common.tsx`). The file injects via webpack's `css-loader` + `style-loader` chain (already configured in `webpack.config.cjs`).

**Warning signs:** Modal appears unstyled or partially-styled; `<Header>` doesn't show its bar; no theme color flips on light/dark toggle.

### Pitfall 5: `.tfxignore` is NOT a tfx-cli feature — `files` array IS the mechanism

**What goes wrong:** Plan creates a `.tfxignore` file expecting `tfx extension publish` to honor it. Packager ignores the file. The `.vsix` includes everything `tfx-cli` decides to include based on the manifest's `files` array (or worse — if `files` is malformed, broader content gets included).

**Why it happens:** CONTEXT.md D-15 mentions `.tfxignore` from a (likely non-tfx-cli) tooling assumption. tfx-cli's source code (`node_modules/tfx-cli/_build/exec/extension/_lib/merger.js`) operates exclusively from the manifest's `files` array; there is no reference to `.tfxignore` anywhere in the source tree (verified by grep — zero hits).

**How to avoid:**
- Do NOT create `.tfxignore`.
- Ensure `vss-extension.json` `files` lists ONLY the directories that should ship in the `.vsix`. Currently:
  ```json
  "files": [
    { "path": "dist", "addressable": true },
    { "path": "images", "addressable": true }
  ]
  ```
  This gives a `.vsix` containing `vss-extension.json` (always included), `dist/` (toolbar.html, toolbar.js, modal.html, modal.js), and `images/` (icon.png, toolbar-icon.svg). NOTHING else — no `node_modules`, no `src/`, no `tests/`, no `.planning/`, no markdown files.
- For optional inclusion of `LICENSE` and `README.md` (Marketplace listing wants them), add explicit `files` entries:
  ```json
  { "path": "LICENSE", "addressable": false },
  { "path": "README.md", "addressable": false }
  ```
  (`addressable: false` means included in `.vsix` but not served as content from the iframe URL space.)

**Warning signs:** `.vsix` is unexpectedly large (>5 MB suggests `node_modules/` snuck in); `tfx extension show` reveals files that shouldn't be present; planner needed to delete files post-package to fix.

### Pitfall 6: `--rev-version` mutates `vss-extension.json` in the working tree

**What goes wrong:** Developer runs `npm run dev:publish`, then `git status` shows `vss-extension.json` is modified. They commit it — now the repo's manifest version diverges from the planned semver schedule. OR worse: the change isn't committed and the next clone has the old version.

**Why it happens:** `tfx extension publish --rev-version` is documented (verified in tfx-cli source) as "Rev the patch-version of the extension and save the result." The "save the result" part is critical — it writes back to the manifest on disk.

**How to avoid (planner picks one):**
1. **Auto-revert pattern:** wrap `tfx extension publish --rev-version` in `scripts/dev-publish.cjs` that captures the version before, runs publish, then restores the manifest. Pro: no git pollution. Con: the published version exists on Marketplace but isn't recorded in source — fine for dev, awkward for traceability.
2. **Auto-commit pattern:** chain `tfx extension publish --rev-version && git add vss-extension.json && git commit -m "chore(dev): rev version"`. Pro: every publish is traceable. Con: noisy git history during development.
3. **Per-publish manual increment:** developer manually edits the manifest version, runs `tfx extension publish` (no `--rev-version`), commits when convenient. Pro: deliberate. Con: requires discipline to avoid republishing the same version.

**Recommendation for Phase 2 planner:** Strategy 1 (auto-revert in `scripts/dev-publish.cjs`) — it keeps the dev loop fast and avoids polluting Phase 2's git history with version bumps. Phase 5 will introduce a real CI versioning strategy.

**Warning signs:** Repeated `git status` showing `vss-extension.json` modified after every publish; multiple "rev version" commits in git log; or worse, no version increments visible in history but Marketplace shows many published versions.

### Pitfall 7: SDK init lifecycle race in `toolbar.tsx`

**What goes wrong:** Toolbar registers AFTER `SDK.init()` has resolved, in some scenarios where the bundle loads asynchronously. Host has already finished its handshake by the time `register` runs; the registration is too late, host treats the toolbar as having no handler — clicks do nothing.

**Why it happens:** Microsoft's canonical sample calls `SDK.register(...)` before `SDK.init()` — registration is queued, init starts the handshake, the queue flushes before the handshake completes. If you swap the order, race conditions appear in some host versions.

**How to avoid:** Place `SDK.register("calc-sp-action", () => ({...}))` in the module's TOP-LEVEL synchronous code, BEFORE `SDK.init()`. (Verified pattern in Microsoft sample.)

**Warning signs:** Toolbar entry visible, clicks fire nothing, retry on different test orgs sometimes works (race-condition signature).

### Pitfall 8: actionContext shape varies by host context

**What goes wrong:** Code reads `actionContext.workItemId` and crashes (or silently no-ops) on a host where the shape is `actionContext.id` instead, or where the toolbar context is `[{id: 5}]` (an array — happens when the action targets multi-select contexts).

**Why it happens:** Microsoft does not publish a typed interface for `actionContext`. Sample code uses `any`. The shape varies between toolbar-menu, context-menu, and selection-list contexts.

**How to avoid:** Defensive runtime guard at the top of `execute`:
```typescript
execute: async (actionContext: any) => {
  // Handle both single-item (workItemId/id) and multi-select (array) cases
  const ctx = Array.isArray(actionContext) ? actionContext[0] : actionContext;
  const workItemId =
    (typeof ctx?.workItemId === "number" && ctx.workItemId) ||
    (typeof ctx?.id === "number" && ctx.id) ||
    undefined;
  if (workItemId === undefined) {
    console.error("[sp-calc] no work item id in actionContext", actionContext);
    return;
  }
  // ...proceed
}
```

**Warning signs:** Click fires, `openCustomDialog` not called, console shows the runtime guard fired with an unexpected shape. (Phase 2's `[sp-calc]` log prefix makes this trivially searchable.)

### Pitfall 9: Form re-render does NOT re-load toolbar iframe (state-leak risk)

**What goes wrong:** User opens work item #100, navigates via Next arrow to #101. Toolbar iframe is NOT reloaded — same SDK context, same registration. If the toolbar code stored work item ID in module-scope state at registration time, clicking the button on #101 opens a modal for #100. Or duplicate registrations accumulate across navigations.

**Why it happens:** ADO reuses the work item form iframe across navigations; only the data changes, not the iframe. Module-top-level code runs once per iframe lifetime — exactly what we want — but only IF the code is purely declarative (registers a callback that reads context fresh each time).

**How to avoid (already correct in Pattern 1):**
- The `execute` callback receives `actionContext` fresh from the host on every click — never cache the work item ID in module scope.
- `SDK.register` is idempotent in the sense that calling it once at module load and never again is correct; do NOT call register inside `execute` (would re-register on every click, accumulating handlers).

**Warning signs:** First work item works, navigation to second item fires modal for first item; OR multiple modals open on click.

### Pitfall 10: Dev `.vsix` size unexpectedly inflates above the 100 KB target

**What goes wrong:** D-16 says <100 KB gzipped. Build emits `dist/toolbar.js` and `dist/modal.js`; the modal pulls in React, react-dom, azure-devops-ui (Surface, Page, Header, Button, ButtonGroup, override.css). Bundle is 200+ KB gzipped. Phase 2 stretch goal blown.

**Why it happens:** `azure-devops-ui` is large; React-DOM is ~130 KB minified; sass-compiled override.css adds ~50 KB.

**How to avoid:**
- Per-component imports: `from "azure-devops-ui/Surface"` not `from "azure-devops-ui"` (already in Pattern 2).
- Build with `mode: "production"` (already in `webpack.config.cjs` `--mode production`).
- Source maps are off in production (`devtool: false` for production mode in webpack.config.cjs — verified).
- Toolbar bundle is independent of modal bundle (two-entry pattern); toolbar pulls only the SDK + API (~10 KB). Modal pulls React + ADO UI (~200 KB).
- Realistic Phase 2 target: toolbar ~10 KB gzipped, modal ~150–200 KB gzipped. The 100 KB target in D-16 may be generous — likely modal alone exceeds it. Phase 5 owns the hard 250 KB cap; Phase 2 just measures.

**Warning signs:** `dist/modal.js` >300 KB raw (≈100 KB gzipped is reasonable); webpack-bundle-analyzer (Phase 5 task) reveals untreed-shaken bulk imports.

**Mitigation:** `gzip dist/modal.js` after build; report the gzipped size in the verification doc. If the modal alone exceeds 100 KB gzipped, document it as a known-acceptable Phase 2 result — D-16 is a target, not a hard gate.

### Pitfall 11: PAT leaks into git via `.env.local` not gitignored

**What goes wrong:** Developer creates `.env.local` containing `TFX_PAT=ado-pat-xxxxxxxx`. `.gitignore` doesn't include `.env*` patterns (Phase 0 didn't add them — verified). Developer runs `git add .` and commits the PAT. Public publish exposes the PAT.

**Why it happens:** The current `.gitignore` (verified) covers `node_modules`, `dist`, `coverage`, `.tfx-cache`, `*.vsix`, `*.log`, etc. — but NOT any `.env*` patterns.

**How to avoid:**
- Phase 2 plan must add `.env`, `.env.local`, `.env.*.local`, `.env.production`, `.env.development` to `.gitignore` BEFORE creating `.env.local`. (D-17.)
- `scripts/dev-publish.cjs` should refuse to start if `.env.local` is detected as tracked by git: `git ls-files .env.local` — if non-empty, abort with a loud error.

**Warning signs:** `git status` shows `.env.local` as untracked-but-detected (good); `git ls-files` includes `.env.local` (BAD — back out IMMEDIATELY, rotate PAT).

### Pitfall 12: HTML template missing `<div id="root">` (already correct, but worth verifying)

**What goes wrong:** Modal's `createRoot(document.getElementById('root')!)` returns null; `!` assertion crashes. React never mounts. Modal iframe loads but content is blank.

**Why it happens:** Phase 0's `src/template.html` already has `<div id="root"></div>` (verified — see file content read above), but it's worth a verification step in Phase 2 because the toolbar iframe technically doesn't need a root div (no React) — and a future cleanup might "simplify" the template.

**How to avoid:**
- Don't simplify the template — both iframes share it.
- The toolbar can ignore `#root` (it doesn't render React); harmless.
- Verification: `grep -q 'id="root"' src/template.html` as a smoke check.

**Warning signs:** Modal iframe loads, `[sp-calc/modal]` lifecycle logs appear, but no DOM content under root; React DevTools shows no tree.

### Pitfall 13: Action vs. action-provider — `getMenuItems` not needed in Phase 2

**What goes wrong:** Planner sees Microsoft's "Compatibility notes" section and adds a `getMenuItems` callback to the registration, expecting it to enable dynamic show/hide. The registration shape diverges from the canonical sample, registration breaks subtly.

**Why it happens:** `ms.vss-web.action-provider` is a different contribution type used when menu items are dynamically loaded (e.g., one URI registering multiple action items). `ms.vss-web.action` (our type) is static — no `getMenuItems`. The Microsoft docs at `add-workitem-extension` (2026-04-03) explicitly distinguish: "Use `ms.vss-web.action-provider` when dynamically loading menu items by using `getMenuItems` on the menu handler. Use `ms.vss-web.action` when your menu items are static and defined in the manifest."

**How to avoid:**
- Stick to `ms.vss-web.action` (already in our manifest).
- Registered object exposes ONLY `execute(actionContext)` — no `getMenuItems`.
- For Phase 3 dynamic disabling (FIELD-04: button disabled when no SP field), the right tool is `IWorkItemNotificationListener` watching `onLoaded`/`onRefreshed` — NOT `getMenuItems`. (Out of scope for Phase 2.)

**Warning signs:** Toolbar entry doesn't appear; or appears but invocation calls `getMenuItems` (host expects an array of items back) instead of `execute`; console shows "No items returned from getMenuItems" or similar.

## Code Examples

All examples are verbatim-ready for the planner. Each was derived from a verified source.

### Example 1: `src/ado/types.ts`

```typescript
// src/ado/types.ts
// Source: D-11 in CONTEXT.md.
// Phase 3 expands this with FieldResolver types and CalcSpModalResult.

/**
 * Configuration payload passed from the toolbar action to the modal dialog
 * via HostPageLayoutService.openCustomDialog's options.configuration.
 */
export type CalcSpModalConfig = {
  workItemId: number;
};
```

### Example 2: `src/entries/toolbar.tsx`

(See Pattern 1 above — full code provided.)

### Example 3: `src/entries/modal.tsx`

(See Pattern 2 above — full code provided.)

### Example 4: `images/toolbar-icon.svg`

(See Pattern 4 above — full SVG provided.)

### Example 5: `vss-extension.json` delta

(See Pattern 5 above — only the `contributions[0].properties.icon` value changes from `images/icon.png` to `images/toolbar-icon.svg`; `files` block unchanged.)

### Example 6: `package.json` script additions

(See Pattern 6 above.)

### Example 7: `scripts/dev-publish.cjs`

(See Pattern 6 above.)

### Example 8: `.gitignore` additions

```
# Local secrets — DO NOT COMMIT
.env
.env.local
.env.*.local
.env.production
.env.development
```

### Example 9: `README.md` Dev Publish recipe section

```markdown
## Dev Publish (Phase 2)

To iterate on the extension against the dev ADO org `cezari`:

1. Once: create `.env.local` at repo root with `TFX_PAT=<your Marketplace PAT>`. Do NOT commit.
2. Each cycle: edit code → `npm run dev:publish`. The script runs `npm run build`, packages the `.vsix`, bumps the patch version, and shares it with the `cezari` org.
3. Refresh the work item form in https://dev.azure.com/cezari to pick up the new version.

The PAT must have the **Marketplace → Publish** scope. Generate at
https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions.

Manual steps if the script fails:
- `npm run build` — produce `dist/toolbar.{html,js}` and `dist/modal.{html,js}`
- `npx tfx extension publish --manifest-globs vss-extension.json --share-with cezari --rev-version --token <PAT>`
- `npx tfx extension share --share-with cezari --publisher TsezariMshvenieradzeExtensions --extension-id story-point-calculator` (if the share didn't take)

Reverting the auto-rev'd version: `git checkout vss-extension.json` after publish.
```

### Example 10: Bundle size pre-check command

```bash
# Run after npm run build; reports gzipped sizes for both entries.
npm run build && \
  echo "toolbar.js: $(gzip -c dist/toolbar.js | wc -c) bytes gzipped" && \
  echo "modal.js:   $(gzip -c dist/modal.js | wc -c) bytes gzipped"
```

(On Windows PowerShell, equivalent: `Compress-Archive -Path dist/modal.js -DestinationPath dist/modal.gz; (Get-Item dist/modal.gz).Length`.)

## Runtime State Inventory

Phase 2 introduces NO stored data, NO live service config, NO OS-registered state, ONE secret (PAT in `.env.local`), and ONE build artifact concern.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 2 reads no work item fields, posts no comments, writes no Extension Data Service documents | None |
| Live service config | The Marketplace publisher `TsezariMshvenieradzeExtensions` has a per-extension share-list maintained by tfx; `tfx extension publish --share-with cezari` adds `cezari` to that list. Subsequent re-publishes preserve the share list — verified in tfx source `publish.js` (sharing is conditional on `--share-with` being present, idempotent at the API level) | First publish adds `cezari` to share list; subsequent publishes can omit `--share-with` once the list is set. Planner's `dev:publish` script keeps `--share-with cezari` for safety (idempotent) |
| OS-registered state | None — no Task Scheduler entries, no PATH modifications, no global npm installs (tfx-cli is dev-dependency-only) | None |
| Secrets / env vars | `TFX_PAT` (in `.env.local`, gitignored). Code references it ONLY in `scripts/dev-publish.cjs`. No production code reads PATs (the published extension uses `vso.work_write` scope at install time, not the PAT) | Verify `.gitignore` patterns BEFORE creating `.env.local`. PAT is for publishing only — never bundled into `.vsix` |
| Build artifacts / installed packages | `dist/toolbar.js`, `dist/toolbar.html`, `dist/modal.js`, `dist/modal.html` are produced by `npm run build`. The `.vsix` (`*.vsix` in repo root after `tfx extension create` or `tfx extension publish`) is gitignored. Phase 2 introduces NO new global packages | After Phase 2 work, run `npm run clean && npm run build` to verify a fresh build produces the expected four files. Verify `.vsix` is gitignored (it is — verified in `.gitignore`) |

**Nothing else found in any other category.**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All build/test/publish scripts | ✓ (verified Phase 0) | v24.15.0 | None — required |
| npm | Package install, scripts | ✓ | 11.12.1 | None — required |
| Git | Source control + revert auto-rev | ✓ | — | None — required |
| `tfx-cli` (local) | Dev publish loop | ✓ (installed via package.json devDependency) | 0.23.1 (pinned) | None |
| Internet access to `marketplace.visualstudio.com` | `tfx extension publish` (uploads `.vsix` to Marketplace gallery) | Assumed ✓ | — | None — Phase 2 cannot complete offline |
| Internet access to `dev.azure.com/cezari` | Manual verification of installed extension | Assumed ✓ | — | None |
| `cezari` ADO org access for the user (Tsezari) | Browser-side install + verification | Assumed ✓ (CONTEXT.md D-13 confirms org exists) | — | None |
| Marketplace PAT with `vsix-manage` scope | `tfx extension publish` auth | Assumed ✓ (CONTEXT.md D-02 confirms provisioned) | — | If missing: 5-min generation at https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions |
| Browser (Chrome/Edge/Firefox) for theme toggle test | Manual verification of UI-06 | ✓ (developer machine has them) | — | None |

**Missing dependencies with no fallback:**
- None — Phase 2 is fully executable on the current dev machine assuming PAT and dev org access are confirmed.

**Missing dependencies with fallback:**
- None.

## Project Constraints (from CLAUDE.md)

| Directive | Phase 2 Implication |
|-----------|---------------------|
| **Tech stack: React 18 + TypeScript + `azure-devops-ui`** | Modal entry uses React 18 `createRoot` and azure-devops-ui Surface+Page; toolbar entry uses TS only (no React) to keep the bundle small |
| **Distribution: Visual Studio Marketplace public** | Dev publishes are private (`public:false`) shared with `cezari`; manifest stays at `public:false` through Phase 4 |
| **Storage: ADO Extension Data Service only** | Phase 2 has no storage code |
| **Permissions: `vso.work_write` only** | Manifest scope already locked at `["vso.work_write"]` (Phase 0); Phase 2 does NOT change scope |
| **Bundle size: keep `.vsix` lean** | Phase 2 measures (D-16 <100 KB target); Phase 5 enforces (PKG-03 ≤250 KB hard cap) |
| **Calculation precision: floating-point math** | N/A — Phase 2 has no calc code (D-24) |
| **Testing: Manual QA does UI testing per company standard; only formula logic is unit-tested** | Phase 2 has no automated test (D-20); manual verification per `02-VERIFICATION.md` |
| **GSD workflow enforcement** | This RESEARCH.md is consumed by `/gsd-plan-phase`; direct edits prohibited outside the GSD flow |
| **Org standard divergence: React (not Angular 19)** | Already justified; modal uses React |
| **Webpack two-entry pattern (D-06 Phase 0)** | Existing `webpack.config.cjs` already produces both entries; no changes needed for Phase 2 |
| **Pinned versions enforced via `.npmrc save-exact=true`** | Phase 2 adds NO new packages; the four pinned criticals (sdk@4.2.0, api@4.270.0, ui@2.272.0, tfx@0.23.1) remain unchanged |
| **`skipLibCheck: true` mandatory** | Already set in `tsconfig.json`; `azure-devops-ui` may emit a few `// @ts-ignore` requirements for sub-paths if encountered (unlikely for Surface/Page/Header/Button which are well-typed) |

**Org-level GPIH guidance** (from `~/.claude/CLAUDE.md`): ADO MCP defaults to `dev.azure.com/GPIHolding/Neptune`. Phase 2 publishes to `cezari` org, NOT GPIHolding — when running `ado` MCP commands against the dev org, explicitly pass `organization=cezari`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `VSS.init({ usePlatformScripts: true })` AMD-style SDK | `import * as SDK from "azure-devops-extension-sdk"; SDK.init()` ESM | SDK v4 published ~2020 | Phase 2 uses ESM exclusively; legacy AMD samples in old Microsoft docs are NOT a reference |
| `VSS.getService(...)` | `SDK.getService<T>(...)` with `CommonServiceIds.HostPageLayoutService` | API package v4 | Type-safe service resolution; auto-complete in IDE |
| `VSS.register(id, () => ({...}))` from RequireJS | `SDK.register(id, () => ({...}))` ES module | SDK v4 | Functional shape unchanged — knowledge from VSS samples transfers |
| `script src="https://cdnjs.cloudflare.com/ajax/libs/require.js"` in HTML | webpack-bundled `<script src="toolbar.js">` injected by `html-webpack-plugin` | Phase 0 | No external CDN dependency at runtime; bundle is self-contained |
| `ReactDOM.render(<App />, root)` (React 16/17) | `ReactDOM.createRoot(root).render(<App />)` (React 18) | React 18 GA 2022 | Phase 2 uses createRoot; Microsoft sample still uses legacy `render` (sample is older) — modernizing is correct |
| `panel.html` <-> `panel.tsx` <-> manual webpack entry | `html-webpack-plugin` per entry with shared `template.html` | Phase 0 | Entry HTML files are auto-generated; one template serves both iframes |
| Hand-rolled icon (PNG light/dark variants) | Single SVG with `fill="currentColor"` | This research | Smaller bytes, theme-perfect rendering, no light/dark switch logic |

**Deprecated/outdated:**
- `vss-web-extension-sdk` (legacy AMD SDK) — NOT used in Phase 2.
- `ms.vss-work-web.work-item-form-toolbar-button` contribution type — does NOT exist (PROJECT.md previously referenced this in error; corrected in Phase 0).
- `getMenuItems` callback for `ms.vss-web.action` — wrong contribution type; would require `ms.vss-web.action-provider`.
- `TFX_TOKEN` environment variable — does NOT exist in tfx-cli; `--token` flag is the only programmatic input.
- `.tfxignore` file — does NOT exist as a tfx-cli feature (verified by source-code grep); manifest `files` array is the only mechanism.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Marketplace PAT is provisioned and has Marketplace→Publish scope | User Constraints (D-02); Pattern 6 | Phase 2 cannot publish; must regenerate PAT (~5 min). LOW risk — CONTEXT.md confirms provisioning |
| A2 | The `cezari` ADO org allows install of extensions from `TsezariMshvenieradzeExtensions` publisher | Phase Requirements; Verification gates | If org-level policy blocks installs, manual approval needed (likely none, since user owns the org). LOW risk |
| A3 | `actionContext` for `ms.vss-work-web.work-item-toolbar-menu` includes a `workItemId` (or `id`) numeric field | Pattern 1; Pitfall 8 | If the actual field is named differently (e.g., `workItem`), the runtime guard catches it and logs; planner can fix per the verification log without rewrite. LOW risk |
| A4 | `azure-devops-ui` `Surface` + `Page` chrome inherits theme automatically without `applyTheme: true` extra wiring | Pattern 2; Pitfall 4; UI-06 verification | If theme propagation needs explicit code, Phase 2's UI-06 success criterion fails the manual test; planner adds `import 'azure-devops-ui/Core/override.css'` (already in Pattern 2) and possibly invokes `SDK.applyTheme()` programmatically. **Risk: MEDIUM** — Microsoft sample's `panel-content.tsx` does NOT explicitly call `applyTheme`; relies on `SDK.init()` defaults plus override.css. The pattern is community-validated but Phase 2 is the project's first time exercising it — UI-06 manual test is the truth |
| A5 | `tfx extension publish --rev-version` mutates `vss-extension.json` in place | Pitfall 6 | Verified in `tfx-cli` source (`default.js` line 74 description: "Rev the patch-version of the extension and save the result"). HIGH confidence; A5 is `[VERIFIED: source code grep]` |
| A6 | tfx-cli does NOT honor a `.tfxignore` file | Pitfall 5 | Verified by full grep of `node_modules/tfx-cli/_build/`: zero hits for `tfxignore` pattern. HIGH confidence; A6 is `[VERIFIED: source code grep]` |
| A7 | tfx-cli does NOT support `TFX_TOKEN` env var | Pattern 6 | Verified by grep of `node_modules/tfx-cli/_build/lib/tfcommand.js`: only `TFX_TRACE` is referenced as an env-var input; `--token`/`-t` are the only PAT inputs. HIGH confidence; A7 is `[VERIFIED: source code grep]` |
| A8 | The existing `vss-extension.json` (Phase 0) is valid against the current schema and only needs the `icon` value swapped | Pattern 5 | Phase 0 SUMMARY confirms `npm run package` (which invokes `tfx extension create`) was implicitly testable but D-15 says no CI gate; the schema-validity gate fires first time `tfx extension publish` runs in Phase 2. If the manifest fails schema validation, the planner must read the tfx error and patch — possible but unlikely (Phase 0 used the verified IDs). LOW risk |
| A9 | The toolbar iframe's `loaded:true` default in Microsoft's sample is acceptable, OR D-12's `loaded:false` discipline can be applied without breaking the toolbar | Pattern 1 | The toolbar iframe has no UI; either `loaded:true` (host hides spinner immediately) or `loaded:false + notifyLoadSucceeded()` (explicit) work. Choose one and document. **Recommendation:** for Phase 2, follow D-12 strictly — `loaded:false` + explicit `notifyLoadSucceeded()` after `register` — for symmetry with the modal. This is a stylistic choice, not a correctness one |
| A10 | The modal's `Close` button can be a no-op decorative element in Phase 2, with the host's X button serving as the canonical close | Pattern 2; D-06 discretion item | If users find the in-modal Close button non-functional confusing, Phase 3 can wire it to programmatic dismissal via a registered method that the host invokes. Phase 2 ships the simpler form; if the verifier flags it, Phase 3 adopts the more complex pattern. LOW risk for Phase 2 |
| A11 | Microsoft Learn 2026-04-03 "Add a menu action" page using `ms.vss-work-web.work-item-context-menu` is a doc inconsistency, not a deprecation of `ms.vss-work-web.work-item-toolbar-menu` | Architectural Responsibility Map | Both target IDs may coexist (one for context-click menu, one for toolbar). The Microsoft canonical sample uses `ms.vss-work-web.work-item-toolbar-menu` and the Extensibility Points overview lists it for "Work item for context menu" (with screenshot of the form toolbar). Existing manifest uses the toolbar-menu target — this is correct. If the toolbar entry doesn't appear during Phase 2 verification, planner can add a SECOND contribution targeting `ms.vss-work-web.work-item-context-menu` as a fallback. LOW risk |

**Confirmation needed before Phase 2 execution:** A1 (PAT provisioned — CONTEXT.md says yes); A2 (cezari org install policy — assumed open). All other items have HIGH-confidence verification or are LOW-risk stylistic choices.

## Open Questions

1. **Should the toolbar iframe use `loaded:false + notifyLoadSucceeded()` OR `loaded:true` (default)?**
   - What we know: D-12 says both iframes follow `loaded:false`. Microsoft canonical sample's toolbar uses `SDK.init()` default (`loaded:true`).
   - What's unclear: D-12's intent — discipline / consistency, or a hard requirement.
   - Recommendation: Follow D-12 (`loaded:false`) for symmetry. Add `await SDK.notifyLoadSucceeded()` immediately after the `SDK.register(...)` call. Costs ~2 lines of code; harmless.

2. **Does the in-modal "Close" button (D-06) need to programmatically dismiss the dialog, or is it acceptable as a decorative element relying on the host X?**
   - What we know: D-06 says "single Close button"; CONTEXT.md notes "via the host's built-in X" as a possibility.
   - What's unclear: User intent — visible button purely for UX guidance, or functional programmatic close.
   - Recommendation: Phase 2 ships decorative + host-X. If verifier flags as "Close button does nothing," Phase 3 adopts the registered-method pattern (modal calls `SDK.unregister` or registers a `dismiss` method the host invokes). Phase 2's success criteria don't require programmatic close.

3. **What is the actual `actionContext` shape for `ms.vss-work-web.work-item-toolbar-menu`?**
   - What we know: Microsoft sample types it as `any`; community knowledge suggests `{ workItemId, id, workItemType, ... }`.
   - What's unclear: Exact verified shape on current ADO Services.
   - Recommendation: Use the permissive guard in Pattern 1; log the full `actionContext` to console on first invocation; capture the actual shape during Phase 2 dev publish. Document in `02-VERIFICATION.md`.

4. **Should `--rev-version` autoincrement be reverted after each dev publish?**
   - What we know: `--rev-version` writes back to `vss-extension.json`. Three viable patterns (auto-revert, auto-commit, manual).
   - What's unclear: Team convention preference.
   - Recommendation: **Auto-revert in `scripts/dev-publish.cjs`** (Pitfall 6 Strategy 1). Phase 2 dev iterations won't pollute git history; Phase 5 introduces a real CI versioning strategy.

## Sources

### Primary (HIGH confidence — verified during this research session)

- **Local `node_modules` inspection (verified 2026-05-02):**
  - `node_modules/azure-devops-extension-sdk/SDK.d.ts` — full type signatures for `init`, `ready`, `register`, `getService`, `getConfiguration`, `getExtensionContext`, `notifyLoadSucceeded`, `notifyLoadFailed`, `applyTheme`, `IExtensionInitOptions`, `IExtensionContext`.
  - `node_modules/azure-devops-extension-api/Common/CommonServices.d.ts` — `CommonServiceIds` enum (HostPageLayoutService = "ms.vss-features.host-page-layout-service"); `IHostPageLayoutService` with `openCustomDialog`, `openMessageDialog`, `openPanel`; `IDialogOptions<TResult>` with `title`, `onClose`, `configuration`, `lightDismiss`.
  - `node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts` — `IWorkItemFormService` (Phase 3 reference; not used in Phase 2).
  - `node_modules/azure-devops-ui/Page.d.ts`, `Surface.d.ts`, `Components/Surface/Surface.Props.d.ts` — Page and Surface re-exports and props (`SurfaceBackground`, `Spacing`, `IPageProps`).
  - `node_modules/tfx-cli/_build/exec/extension/default.js` (lines 74–76, 38–40) — confirmed `--rev-version`, `--share-with`, `--token` (via tfcommand inheritance) flags.
  - `node_modules/tfx-cli/_build/exec/extension/_lib/merger.js` (lines 162–192) — confirmed `files` array is the only packaging mechanism; `.tfxignore` not referenced anywhere in `tfx-cli/_build/`.
  - `node_modules/tfx-cli/_build/lib/tfcommand.js` (lines 247, 250) — confirmed `--token`/`-t` is `SilentStringArgument`; only `TFX_TRACE` (not `TFX_TOKEN`) is read from env.

- **npm registry (verified live 2026-05-02):**
  - `azure-devops-extension-sdk@4.2.0` — current latest; matches Phase 0 pin.
  - `azure-devops-extension-api@4.270.0` — current latest; matches Phase 0 pin.
  - `azure-devops-ui@2.272.0` — current latest; matches Phase 0 pin.
  - `tfx-cli@0.23.1` — current latest; matches Phase 0 pin.
  - No drift since Phase 0 (2026-05-01) — pins remain valid.

- **Microsoft canonical sample (verified live 2026-05-02 via `raw.githubusercontent.com`):**
  - `microsoft/azure-devops-extension-sample/master/src/Samples/work-item-toolbar-menu/work-item-toolbar-menu.{ts,json,html}` — verified registration shape, target ID, openCustomDialog ID composition.
  - `microsoft/azure-devops-extension-sample/master/src/Samples/panel-content/panel-content.{tsx,json,html}` — verified modal lifecycle, Page/Surface usage, configuration read, notifyLoadSucceeded placement.
  - `microsoft/azure-devops-extension-sample/master/src/Samples/work-hub-group/work-hub-group.tsx` — Page chrome theme inheritance pattern.
  - `microsoft/azure-devops-extension-sample/master/src/Samples/command/command.{ts,json}` — `SDK.register` factory pattern + `IHostPageLayoutService` invocation pattern.
  - `microsoft/azure-devops-extension-sample/master/src/Common.tsx` — `import "azure-devops-ui/Core/override.css"` requirement.

- **Microsoft Learn (verified live 2026-05-02):**
  - `learn.microsoft.com/en-us/azure/devops/extend/develop/add-action` (2026-04-03) — `ms.vss-web.action` properties table (`text`, `title`, `icon`, `groupId`, `uri`, `registeredObjectId`); legacy AMD sample (deprecated pattern flagged).
  - `learn.microsoft.com/en-us/azure/devops/extend/develop/add-workitem-extension` (2026-04-03) — work item form contributions; toolbar action sample (uses `ms.vss-work-web.work-item-context-menu` target — see A11 inconsistency).
  - `learn.microsoft.com/en-us/azure/devops/extend/reference/targets/overview` (2026-04-03) — verified `ms.vss-work-web.work-item-toolbar-menu` listed for "Work item for context menu" with form-toolbar screenshot.
  - `learn.microsoft.com/en-us/javascript/api/azure-devops-extension-api/ihostpagelayoutservice` — confirmed `openCustomDialog` signature.

### Secondary (MEDIUM confidence — patterns derived from training and cross-referenced with primaries)

- Permissive `actionContext: any` typing — consistent with Microsoft samples; not formally documented.
- `--rev-version` auto-revert pattern — community-validated (multiple StackOverflow threads describe the manifest mutation behavior); planner's `scripts/dev-publish.cjs` is custom code matching the documented behavior.
- `panel-content` HTML root mount + React `createRoot` modernization — extrapolation from React 18 docs + sample's older `ReactDOM.render` usage.

### Tertiary (LOW confidence — flagged for verification at execution time)

- `actionContext.workItemId` field name — runtime guard handles `id` and `workItemId`; first dev-publish in Phase 2 will reveal the actual key. (A3.)
- `ms.vss-work-web.work-item-context-menu` vs `ms.vss-work-web.work-item-toolbar-menu` — both may be aliased or represent different surfaces; existing manifest's `work-item-toolbar-menu` is verified by the canonical sample. (A11.)
- Bundle size after build (modal alone may exceed D-16's 100 KB target; D-16 is a soft target). (Pitfall 10.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package and version was verified in the local `node_modules` (which Phase 0 installed cleanly), and re-verified via `npm view`. No drift.
- Architecture (SDK lifecycle, contribution wiring, theme propagation): HIGH — type signatures from `SDK.d.ts` and `CommonServices.d.ts` plus the Microsoft canonical sample give line-by-line verification.
- Pitfalls: HIGH for SDK silent-failure patterns and tfx-cli flag semantics (verified by source-code grep); MEDIUM for `azure-devops-ui` theme inheritance edge cases (UI-06 manual test is the truth).
- Microsoft Learn doc consistency: MEDIUM — the `add-action` page uses `work-item-context-menu` but the canonical sample uses `work-item-toolbar-menu`. Existing manifest matches the sample; risk is LOW because we can add a fallback target if needed.
- PAT and dev org access: MEDIUM — taken on trust from CONTEXT.md D-02/D-13.

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (30 days; SDK and API package versions are stable; `azure-devops-extension-api` minor-bumps roughly monthly per the 103-version history, so re-verify `npm view` if Phase 2 execution slips beyond this date)
