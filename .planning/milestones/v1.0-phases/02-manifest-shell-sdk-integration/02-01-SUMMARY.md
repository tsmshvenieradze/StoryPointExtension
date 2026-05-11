---
status: complete
phase: 02-manifest-shell-sdk-integration
plan: 02-01
requirements_addressed: [UI-01, UI-02, UI-06]
started: 2026-05-01
completed: 2026-05-02
key_files:
  created:
    - src/ado/types.ts
    - images/toolbar-icon.png
    - scripts/dev-publish.cjs
    - scripts/generate-toolbar-icon.cjs
  modified:
    - .gitignore
    - vss-extension.json
    - src/entries/toolbar.tsx
    - src/entries/modal.tsx
    - package.json
    - README.md
    - webpack.config.cjs
  deleted:
    - src/ado/.gitkeep
    - images/toolbar-icon.svg
---

# Plan 02-01 Summary — Manifest Shell & SDK Integration

## What Was Built

Wired the Phase 0 manifest skeleton and entry stubs into a working `.vsix` whose toolbar action opens a themed "Hello" dialog on the live `cezari.visualstudio.com/Cezari` ADO dev org. The integration acid test: every contribution-id, SDK lifecycle call, theme propagation step, and tfx-cli flag now aligns end-to-end.

### Source Files

- **`src/ado/types.ts`** — `CalcSpModalConfig` type (single field: `workItemId: number`). Shared between toolbar.tsx and modal.tsx so the configuration payload is symmetric.
- **`src/entries/toolbar.tsx`** — Toolbar action handler. Registers `calc-sp-action` at module top level (before `SDK.init`) so the registration is queued for the host handshake. On `execute(actionContext)`, extracts the work item id with a permissive guard (`actionContext.workItemId ?? actionContext.id` plus array-form defense for multi-select surfaces), then calls `IHostPageLayoutService.openCustomDialog(<full-modal-id>, { configuration: { workItemId }, lightDismiss: true, onClose })`. SDK lifecycle: `register → init({loaded:false}) → ready → notifyLoadSucceeded`. Console-logs at every boundary with `[sp-calc/toolbar]` prefix.
- **`src/entries/modal.tsx`** — Modal iframe. React 18 `createRoot` mounts `<Hello>` into `#root`. Layout is `azure-devops-ui` `Surface` + `Page` + `Header` + page-content body that echoes `Hello from Work Item #{workItemId}`. Imports `azure-devops-ui/Core/override.css` for the chrome stylesheet (host theme variables flow in automatically). SDK lifecycle: `init → ready → render → notifyLoadSucceeded`. No in-modal Close button — the host owns dismissal via X / Esc / lightDismiss; a small hint line tells the user how to close.

### Manifest

- `vss-extension.json` adds `properties.icon: "images/toolbar-icon.png"` to the `calc-sp-action` contribution. Manifest scope still exactly `["vso.work_write"]` (Pitfall 3). Both contributions reference the corrected IDs (`ms.vss-web.action` + `ms.vss-web.external-content`).

### Build / Bundle / Publish Tooling

- **`webpack.config.cjs`** — fixed string-form entry to object-form (`entry: { [entryName]: '...' }`) so HtmlWebpackPlugin's `chunks: [entryName]` filter correctly matches the named chunk. Without this, the emitted HTML had no `<script>` tag — the iframe loaded an empty body and no JS ran (silent failure).
- **`scripts/dev-publish.cjs`** — wrapper around `tfx extension publish`:
  1. Refuses to run if `.env.local` is git-tracked
  2. Reads `TFX_PAT` from `.env.local`
  3. Snapshots `vss-extension.json` (so the on-disk version mutation doesn't pollute git)
  4. Runs `tfx extension publish --share-with cezari --no-wait-validation --token <PAT> --extension-version <next>` inside a retry loop (max 8 attempts) — on Marketplace version-conflict, parses the "Current version: X.Y.Z" error, bumps patch, retries
  5. Restores `vss-extension.json` from snapshot regardless of tfx exit code
  6. Returns the tfx exit code
- **`scripts/generate-toolbar-icon.cjs`** — emits `images/toolbar-icon.png` (16×16 RGBA, 112 bytes) by raw PNG byte construction (CRC32 + IHDR/IDAT/IEND chunk pattern, same as Phase 0's icon generator). Marketplace rejected the original SVG; PNG is required.
- **`package.json`** — adds `dev:publish` npm script invoking the wrapper.
- **`README.md`** — adds a "Dev Publish" section documenting the PAT setup, `.env.local` format, and `npm run dev:publish` flow.
- **`.gitignore`** — adds `.env*` patterns (closes Phase 0 review WR-02 plus protects PAT against accidental commit).

## What Was Verified

All four ROADMAP §Phase 2 success criteria + the Hello payload PASSED on `cezari.visualstudio.com/Cezari` after fixes were applied:

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | UI-01 — Toolbar entry "Calculate Story Points" appears in work item form toolbar | PASS | Visible on User Story #2; calculator icon rendered |
| 2 | UI-02 — Click opens host-managed dialog via `openCustomDialog` with `{ workItemId }` configuration | PASS | Console logged `[sp-calc/toolbar] opening dialog { fullModalId: 'TsezariMshvenieradzeExtensions.story-point-calculator.calc-sp-modal', config: {...} }` and the dialog appeared |
| 3 | Hello payload | PASS | Dialog shows "Story Point Calculator" header + "Hello from Work Item #2" — the configuration round-trip works correctly |
| 4 | UI-06 — Theme inheritance | PASS | Toggling ADO theme flips dialog colors with the host (no detection code needed; `azure-devops-ui` Surface+Page consume host CSS variables) |
| 5 | Form re-render stability | PASS | Hard refresh, soft refresh, Next/Previous all show toolbar entry exactly once — no duplicates, no missing |

**Lifecycle log evidence (filtered console):**
```
[sp-calc/toolbar] init() resolved
[sp-calc/toolbar] ready() resolved
[sp-calc/toolbar] notifyLoadSucceeded called
[sp-calc/toolbar] execute fired { actionContext: {…}, resolvedWorkItemId: 2 }
[sp-calc/toolbar] opening dialog { fullModalId: 'TsezariMshvenieradzeExtensions.story-point-calculator.calc-sp-modal', config: {…} }
[sp-calc/modal] init() resolved
[sp-calc/modal] ready() resolved
[sp-calc/modal] SDK ready { config: {…} }
[sp-calc/modal] notifyLoadSucceeded called
```

## Real-world Corrections Applied During Execution

Five separate issues surfaced during the live integration that the research couldn't catch without an actual publish. All fixed and committed before phase completion:

1. **Marketplace rejected SVG icon files** (despite Microsoft Learn 2026-04 docs claiming SVG support). Converted to PNG via raw byte construction; deleted the SVG; updated `vss-extension.json` `properties.icon` to point at `.png`. Commit `881efc6`.

2. **`tfx --rev-version` deadlocks on repeat publishes**. The original wrapper bumped from a fixed snapshot (`0.1.0` → `0.1.1`), so when Marketplace had already registered `0.1.1` from a failed-validation publish, every retry collided. Replaced `--rev-version` with explicit `--extension-version` inside an attempt-loop that parses the "Version number must increase / Current version: X.Y.Z" error, extracts Marketplace's current version, bumps patch, and retries (max 8). Commit `ced9eaf`.

3. **`tfx publish` polling timeout was treated as a publish failure**. tfx polls Marketplace for validation status after upload; on transient gateway hiccups the poll times out even though the upload succeeded. Added `--no-wait-validation` so the wrapper returns immediately after upload and we verify status separately if needed. Commit `4004095`.

4. **HtmlWebpackPlugin emitted `<script>`-less HTML** because `entry` was a string (chunk name defaulted to `main`) but the `chunks: [entryName]` filter looked for `toolbar`/`modal`. No match → no injection → empty iframe body → silent failure (F12 console showed nothing on click). Switched to object-form entry. Commit `c3f1e5a`.

5. **Decorative in-modal Close button was misleading**. ADO SDK v4 doesn't expose programmatic close to the modal iframe — host owns dismissal (X / Esc / lightDismiss). Removed the button; added a hint line ("Press Esc or click outside to close"). Phase 3's real Apply/Cancel pattern goes through the host's result-getter mechanism. Commit `c194d14`.

## Deviations from Plan (executor-recorded)

Executed during the initial worktree run; documented for the verifier. All preserve plan intent:

1. **`CommonServiceIds.HostPageLayoutService`** is upstream-declared as a `const enum`, unusable at runtime under our `tsconfig.json` `isolatedModules: true`. Replaced with the literal string `"ms.vss-features.host-page-layout-service"` (value verified in `node_modules/azure-devops-extension-api/Common/CommonServices.d.ts`). Functional behavior unchanged.

2. **`azure-devops-ui` `Page` type omits `children`** even though the runtime `React.Component<IPageProps>` renders them. Wrapped via `const Page = PageRaw as unknown as React.FC<...&{children?:React.ReactNode}>` — type-only narrowing. Microsoft's own samples wrap `<Page>...</Page>` so the runtime is correct; only the upstream types are stale.

## What This Enables for Downstream Phases

- **Phase 3 (Modal UI & Read Path)** can now build on a verified iframe shell. The toolbar passes `{ workItemId }` correctly; the modal reads it and renders. Phase 3 swaps the Hello body for three `azure-devops-ui` Dropdowns + the live calculation panel + Apply/Cancel buttons, and adds the FieldResolver + read-path SDK calls (`IWorkItemFormService.getFieldValue`, `WorkItemTrackingRestClient.getComments` + AUDIT parser).
- **Phase 4 (Write Path)** uses the Apply button from Phase 3 to call `setFieldValue + .save() + addComment` in the comment-first → field-write order locked in PROJECT.md Key Decisions.
- The dev-publish loop is hardened: future iterations across Phases 3–5 will not get blocked by Marketplace version-conflict or polling timeouts.

## Bundle Size (informational)

- `dist/toolbar.js` — ~3.3 KB gzipped (toolbar shim is intentionally tiny)
- `dist/modal.js` — ~110 KB gzipped (React 18 + azure-devops-ui Surface/Page/Header)

D-16's Phase 2 soft target was <100 KB; modal is 10 KB over because azure-devops-ui's Page component pulls a non-trivial chunk of its layout/font infrastructure. Phase 5's hard cap is 250 KB so we have plenty of room. Phase 5 will revisit (tree-shaking, lazy-loading) if needed.

## Status

Phase 2 ROADMAP success criteria 1–4 verified PASS. Manifest skeleton, contribution wiring, SDK lifecycle, theme inheritance, and re-render stability all confirmed working on the live cezari dev org. Ready for code review and phase verifier.
