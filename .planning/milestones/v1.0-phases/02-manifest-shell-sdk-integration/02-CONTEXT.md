# Phase 2: Manifest Shell & SDK Integration - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove the iframe + contribution + dialog + theme integration end-to-end on a real ADO dev org with a "Hello" payload, so the highest-risk step fails fast before any React UI investment.

In scope:
- Implement the toolbar action handler in `src/entries/toolbar.tsx` — registers `calc-sp-action` with `IContributionRegistry`, opens the modal via `HostPageLayoutService.openCustomDialog`, passes `{ workItemId }` as configuration
- Implement the modal entry in `src/entries/modal.tsx` — initializes SDK, reads `SDK.getConfiguration().workItemId`, renders a minimal "Hello from Work Item #N" surface using `azure-devops-ui` `Page` chrome that inherits the host's theme
- Build the `.vsix` via the existing webpack/tfx-cli setup
- Publish dev `.vsix` to `cezari.visualstudio.com/Cezari` via `tfx extension publish --share-with cezari`
- Verify all 4 ROADMAP success criteria on the live dev org

Out of scope (later phases own these):
- Calc engine and audit module (Phase 1 — already shipped; Phase 2 doesn't import them)
- Real modal UI (dropdowns, intermediate values, Apply button) (Phase 3)
- FieldResolver (Phase 3)
- ADO bridge for read/write (Phases 3–4)
- Marketplace public listing (Phase 5)
- Branded marketplace icon (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Dev Iteration Loop
- **D-01:** **`tfx extension publish --share-with cezari`** is the dev iteration command. Each cycle: edit code → `npm run build` → `npm run package` → `tfx extension publish --share-with cezari`. Refresh the work item form in the browser to pick up the new version. ~30 seconds per iteration.
- **D-02:** **Marketplace PAT is already provisioned.** User confirmed. The PAT is supplied to `tfx extension publish` via the `--token <PAT>` flag. **Note (research correction):** `tfx-cli` does NOT read a `TFX_TOKEN` env var — only `TFX_TRACE` is read from env, per source inspection of `tfcommand.js`. The dev-loop wrapper script (D-03) reads the PAT from `.env.local` and passes it as `--token`. Do NOT commit `.env.local`; `.env*` patterns are gitignored per D-17.
- **D-03:** **Auto-bump dev version per publish via a wrapper script.** `tfx-cli` rejects re-uploads of the same version. Use `tfx extension publish --rev-version` which **mutates `vss-extension.json` on disk** (verified via tfx-cli source). Recommended pattern: a `scripts/dev-publish.cjs` wrapper that (a) snapshots `vss-extension.json`, (b) sources `.env.local` for `TFX_PAT`, (c) runs `tfx extension publish --share-with cezari --token "$TFX_PAT" --rev-version`, (d) restores the manifest from snapshot so the bumped version doesn't pollute git. Public-publish version-bump rules live in Phase 5.

### "Hello" Modal Payload
- **D-04:** **Modal renders minimal text + workItemId.** Content: "Story Point Calculator — Hello from Work Item #{N}" inside an `azure-devops-ui` `Page` (or `Surface`) component. The Page chrome inherits the host theme automatically — toggling ADO from light to dark in the dev org should flip the modal's background and text colors with no extra code.
- **D-05:** **No on-screen lifecycle log** in the Hello modal. Use `console.log('[sp-calc] modal SDK ready', SDK.getConfiguration())` for developer-side debugging instead. Keeps the visual surface clean and matches what Phase 3 will look like.
- **D-06:** **The modal exposes a single Close button** (in the dialog footer or via the host's built-in X). No Apply button in Phase 2 — the real Apply lives in Phase 4. Close just calls the SDK dialog-close handler returned by `openCustomDialog`'s callback.

### Toolbar Contribution Details
- **D-07:** **Toolbar label:** `Calculate Story Points` (matches Marketplace display name from Phase 0 D-10). Set via `properties.text` or the equivalent `text` field in the contribution definition, depending on the SDK's exact contract.
- **D-08:** **Toolbar icon:** **inline 16×16 calculator SVG.** Add `images/toolbar-icon.svg` (monochrome glyph, single color, no gradients, fill `currentColor` so theme tokens drive it). **Reference via `properties.icon: "images/toolbar-icon.svg"`** in `vss-extension.json`. **Note (research correction):** The `ms.vss-web.action` schema uses `properties.icon`, NOT `properties.iconUrl` — verified against `learn.microsoft.com/.../add-workitem-extension` (2026-04-03) and existing manifest contributions. Add the path to the `files` block. Phase 5 may replace with a branded version.
- **D-09:** **Action registration:** The toolbar entry registers a callback object with the SDK contribution registry; the callback's `execute(actionContext)` method extracts the work item ID from `actionContext.workItemId` (or the equivalent SDK shape) and calls `HostPageLayoutService.openCustomDialog('calc-sp-modal', { configuration: { workItemId } })`.

### Configuration Passing
- **D-10:** **Modal receives `{ workItemId: number }` only.** The modal in Phase 3 will fetch project ID, work item type name, current SP field value, and comments via SDK services itself. Keeping the configuration minimal avoids coupling between Phase 2's toolbar code and Phase 3's modal data needs.
- **D-11:** **Type:** `export type CalcSpModalConfig = { workItemId: number }`. Live in `src/ado/types.ts` (new file in `src/ado/` — Phase 2 creates this; Phase 3 expands it). Both `toolbar.tsx` and `modal.tsx` import from there to keep the contract symmetric.

### SDK Lifecycle Discipline
- **D-12:** **Both iframes follow the canonical lifecycle:** `SDK.init({ loaded: false })` → `await SDK.ready()` → register contribution callback (toolbar only) / read configuration (modal only) → `SDK.notifyLoadSucceeded()`. Done as the FIRST action in each entry file. Any deviation produces silent failure (the host fires no callback). Document this with a comment block in each entry file pointing at PITFALLS.md Pitfall 6.
- **D-13:** **No theme detection code in the modal.** `azure-devops-ui` components apply theme via the `applyTheme` global on `Surface`/`Page` automatically when the SDK passes the host theme. Phase 2 verifies this works; if it doesn't, that's a research gap to surface in the planner.

### `.vsix` Packaging Conventions
- **D-14:** **Dev `vss-extension.json` keeps `public: false`.** Already locked in Phase 0 manifest skeleton. Phase 2 confirms this and does not introduce a public flip.
- **D-15:** **Bundle scope is controlled by the manifest `files` array, NOT by a `.tfxignore` file.** **Note (research correction):** `tfx-cli` does NOT support a `.tfxignore` mechanism (verified by source-code inspection of `node_modules/tfx-cli/_build/`). The only way to scope what enters the `.vsix` is the `files` array in `vss-extension.json`. Phase 2 ensures `files` lists only: `dist/toolbar.html`, `dist/modal.html`, the JS/CSS chunks emitted by webpack, `images/icon.png`, `images/toolbar-icon.svg`. Source files, tests, `node_modules`, `.planning/`, `package*.json`, configs are NOT listed → they are NOT included. Do NOT create a `.tfxignore` file.
- **D-16:** **Bundle size target for Phase 2:** stay under 100 KB gzipped (toolbar shim + Hello modal). The Phase 5 hard cap is 250 KB; Phase 2 has no React UI yet, so it should be well under. Don't add a CI gate yet (Phase 5 owns that), but check manually.

### Environment & Secrets Hygiene (closes WR-02 from Phase 0 review)
- **D-17:** **Add `.env*` patterns to `.gitignore`** if not already present (Phase 0 code-review WR-02). Phase 2 introduces the first place where a secret (the PAT) might land in the repo, so this is the right time to harden the gitignore. Ensure `.env`, `.env.local`, `.env.*.local` are all ignored.
- **D-18:** **Document a `tfx publish` recipe in `README.md`** (placeholder section). Brief, marketplace-quality README is Phase 5; the dev recipe doc is Phase 2 so the build is reproducible. ~10 lines: the `tfx login` flow, the `--share-with` invocation, the version-bump trick.

### Verification Approach
- **D-19:** **All 4 ROADMAP success criteria are verified manually in the dev org**, then a `02-VERIFICATION.md` test plan documents the steps for the verifier agent to confirm. Manual gates:
  1. Install dev `.vsix` on `cezari.visualstudio.com/Cezari` → toolbar entry "Calculate Story Points" appears in the work item toolbar overflow menu (or the inline toolbar, depending on layout)
  2. Click the toolbar entry → host opens a custom dialog
  3. Dialog shows "Story Point Calculator — Hello from Work Item #N" with N matching the current item ID
  4. Toggle ADO theme (Profile → Theme) light↔dark → modal background and text colors flip with the host
  5. Hard refresh, soft refresh, Next/Previous arrows on the form → toolbar entry appears once and only once
- **D-20:** **No automated test for Phase 2.** It's an integration test against a remote, theme-toggleable, work-item-form host that vitest cannot reach. Verifier accepts the manual checklist + screenshots as evidence (or commands run + their output).

### Phase 2 Scope Boundaries
- **D-21:** **No FieldResolver in Phase 2.** Phase 2's modal does not read any work item field; it only echoes the workItemId from the configuration. FieldResolver lands in Phase 3 alongside the real modal UI.
- **D-22:** **No ADO REST calls in Phase 2.** Only the SDK contribution registry + HostPageLayoutService. REST clients are wired in Phases 3–4.
- **D-23:** **No write operations in Phase 2.** No `setFieldValue`, no `addComment`, no `save()`. Read-only modal that closes cleanly.
- **D-24:** **No imports of `src/calc/` or `src/audit/`** in either entry file in Phase 2. Phase 1's pure modules are imported by the modal in Phase 3 (calc) and Phase 4 (audit). Phase 2 keeps both entries SDK-only to isolate integration risk.

### Claude's Discretion
- Exact SVG content for the toolbar icon (D-08) — planner picks a reasonable monochrome calculator glyph; Phase 5 can replace.
- The exact `--rev-version` mechanic (D-03) — planner picks between auto-rev with revert, separate dev manifest, or per-developer version-bump scripts.
- Whether the modal Close button is provided by the host dialog chrome, by `azure-devops-ui` `PanelFooterButtons`, or by a custom Button — planner picks; all three render the same outcome.
- How `[sp-calc]` log prefix is structured — planner picks.
- Whether to use a `Page` or `Surface` for the Hello layout — planner picks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Locked decisions including manifest scope, contribution IDs, atomicity (Phase 4 concern).
- `.planning/REQUIREMENTS.md` §UI — UI-01, UI-02, UI-06 (Phase 2 covers these).
- `.planning/ROADMAP.md` §Phase 2 — Goal and 4 success criteria.

### Research
- `.planning/research/SUMMARY.md` §Architecture Highlights — Manifest contribution shape, three-iframe model, `HostPageLayoutService.openCustomDialog` flow.
- `.planning/research/ARCHITECTURE.md` — Iframe sandbox details, SDK lifecycle, contribution wiring. **Read carefully** — the entire integration risk this phase exposes is concentrated in this document.
- `.planning/research/PITFALLS.md` Pitfall 6 — SDK silent failure patterns. Phase 2 must defend against every pattern listed (wrong contribution IDs, missing `await SDK.ready()`, wrong registration ID, missing `notifyLoadSucceeded()`, double `SDK.init()`).
- `.planning/research/STACK.md` — `tfx-cli` v0.23.1 commands and conventions; `azure-devops-extension-sdk@4.2.0` API shape.

### Phase 0 artifacts (carry forward)
- `.planning/phases/00-bootstrap-prerequisites/00-CONTEXT.md` — Stack, layout, manifest skeleton, dev ADO org D-13.
- `.planning/phases/00-bootstrap-prerequisites/00-RESEARCH.md` — Webpack two-entry pattern, `vss-extension.json` skeleton with corrected contribution IDs.
- `.planning/phases/00-bootstrap-prerequisites/00-01-PLAN.md` + `00-01-SUMMARY.md` — what was scaffolded; Phase 2 fills in the placeholder entries.

### Phase 1 artifacts (do not import yet)
- `.planning/phases/01-calc-engine-audit-parser/01-01-SUMMARY.md` and `01-02-SUMMARY.md` — what was built. Phase 2 does NOT consume these (D-24).

### External
- Microsoft Learn: `IContributionRegistry` and `HostPageLayoutService` API references — Phase 2's two new SDK touch points.
- Microsoft Learn: Extension manifest reference — confirms contribution targets and `iconUrl` field.
- Microsoft Learn: `tfx extension publish` reference — confirms the `--share-with` and `--rev-version` flags.
- `microsoft/azure-devops-extension-sample` GitHub repo — webpack multi-entry setup and a working toolbar action contribution example.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/entries/toolbar.tsx`** — Phase 0 placeholder stub (5 lines, `console.log` only). Phase 2 replaces with the real toolbar handler.
- **`src/entries/modal.tsx`** — Phase 0 placeholder stub. Phase 2 replaces with the Hello modal.
- **`vss-extension.json`** — Already declares both contributions correctly (Phase 0). Phase 2 may add `properties.iconUrl` to the action contribution and add `images/toolbar-icon.svg` to the `files` array.
- **`webpack.config.cjs`** — Two-entry pattern (toolbar + modal) already produces `dist/toolbar.html` and `dist/modal.html`. No changes needed unless adding source-map config.
- **`package.json`** — Has scripts `build`, `package`, `test`, `typecheck`. May add `dev:publish` (chains build + package + tfx publish) and `dev:share` (revoke + re-share).

### Established Patterns
- All Phase 1 modules avoided ADO SDK imports; Phase 2 is the *first* place SDK and azure-devops-ui get imported. No prior pattern — these entries set the precedent for Phase 3/4.
- `azure-devops-ui` components use Sass (already wired in webpack). The Hello modal will be the first place a real `Page` or `Surface` renders.
- The repo has no React render call yet. Phase 2 introduces `ReactDOM.createRoot(document.getElementById('root')!).render(...)` in `modal.tsx`.

### Integration Points
- `src/ado/` directory currently has only `.gitkeep`. Phase 2 creates `src/ado/types.ts` (D-11). Phase 3 expands with the FieldResolver and bridge wrappers.
- HTML entries (`dist/toolbar.html`, `dist/modal.html`) — produced by html-webpack-plugin from `src/template.html`. Phase 2 may need to add a root `<div id="root">` to the template if it doesn't already exist.

</code_context>

<specifics>
## Specific Ideas

- **The modal "Hello" string format:** `Story Point Calculator — Hello from Work Item #${workItemId}`. Single em-dash (U+2014), not two hyphens.
- **The console log prefix:** `[sp-calc]` — short, searchable, doesn't conflict with ADO's own logs.
- **Toolbar SVG hint:** an inline `<svg viewBox="0 0 16 16">` with a calculator outline (rectangle + four button dots) using `fill="currentColor"`. ADO will color it via theme tokens; tested fill behavior is to inherit the toolbar foreground.
- **Dev ADO org URL form:** prefer `dev.azure.com/cezari` over the legacy `cezari.visualstudio.com` in scripts and docs. Both resolve to the same collection.
- **No `.tfxignore` file** — D-15 corrected. Bundle scope is controlled by the manifest `files` array.

</specifics>

<deferred>
## Deferred Ideas

- **Branded marketplace icon** (Phase 5 concern, PKG-05).
- **Bundle-size CI gate** (Phase 5 concern, PKG-03). Phase 2 stays manual.
- **Modal close keyboard handling** (Esc to close) — Phase 3 owns full keyboard nav (UI-07); Phase 2's Close button is enough for the smoke test.
- **Telemetry** — out of scope per PROJECT.md.
- **Hot-reload dev experience via `tfx extension serve`** — only available for some SDK versions; rejected for Phase 2 to keep the dev loop deterministic. Reconsider if iteration friction becomes a real problem.
- **Sourcemap publishing** — webpack config already produces sourcemaps in dev mode; whether to ship them in the public `.vsix` is a Phase 5 PKG-03 concern (they bloat bundle).
- **Per-environment manifests** (dev/staging/prod) — single manifest with version bumps for now. If we ever need a stage between dev and Marketplace, add then.
- **PAT secret rotation policy** — out of scope for Phase 2; user manages the PAT manually.

</deferred>

---

*Phase: 2-Manifest Shell & SDK Integration*
*Context gathered: 2026-05-01*
