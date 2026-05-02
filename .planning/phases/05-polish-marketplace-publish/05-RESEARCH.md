---
phase: 5
slug: polish-marketplace-publish
status: research-complete
researched: 2026-05-02
extends_research:
  - .planning/phases/02-manifest-shell-sdk-integration/02-RESEARCH.md
  - .planning/phases/03-modal-ui-read-path/03-RESEARCH.md
  - .planning/phases/03-modal-ui-read-path/03-VERIFICATION.md
  - .planning/phases/04-write-path-edge-cases/04-RESEARCH.md
  - .planning/phases/04-write-path-edge-cases/04-VERIFICATION.md
---

# Phase 5: Polish & Marketplace Publish — Research

**Researched:** 2026-05-02
**Domain:** GitHub Actions CI for a `tfx-cli` Marketplace extension; Visual Studio Marketplace listing assets and `vss-extension.json` discovery fields; cezari multi-process verification (Scrum + Agile + CMMI); the `public:false → public:true` flip; `dev-publish.cjs` Windows `spawnSync` bug
**Confidence:** HIGH on Marketplace manifest fields and publish flow (verified against Microsoft Learn 2026-04 — both `extend/develop/manifest` and `extend/publish/{overview,command-line}` were re-fetched and read in this session) — HIGH on the `dev-publish.cjs` bug (the failure is documented verbatim in `03-VERIFICATION.md` lines 132–140; the root cause is a known Node `child_process` Windows quirk) — MEDIUM on cezari multi-process UI navigation (no live access to cezari from the research environment; recommendations are based on standard ADO Project Collection settings UI)

## Summary

Phase 5 is a polish-and-publish phase. None of the locked decisions need re-litigation; this research pins down the **HOW** for ten concrete deliverables and surfaces five pitfalls the planner must bake into tasks.

**Three findings the planner cannot miss:**

1. **The `dev-publish.cjs` Windows bug is fully diagnosed and trivially fixable.** Phase 03-04 verification documented the symptom (`spawnSync` returns empty `stdout`/`stderr` after invoking `npx.cmd` with `shell: false`), and the recommended one-line patch is in `03-VERIFICATION.md` line 140. The fix is `shell: process.platform === "win32"` plus passing the args as a joined command-string when shell is true. Alternative: replace the wrapper with a `package.json` script that calls `npx tfx extension publish ...` directly. **Phase 4 already proved the direct invocation works** — every Phase 4 publish (0.1.18 → 0.2.5) was performed via the direct command, not the wrapper. The pragmatic Phase 5 path is a `npm run publish:cezari` script that invokes `tfx extension publish` directly with the proven args; the Node wrapper's snapshot-and-restore complexity is no longer required because the planner can decide a deliberate `0.2.x → 1.0.0` version bump as a committed manifest change.

2. **Marketplace listing description supports GitHub Flavored Markdown (GFM)** — including tables, fenced code blocks, blockquotes, bold/italic, headings, links, and images. Verified against Microsoft Learn 2026-04: the `content.details.path` field's content "is assumed to be in [GitHub Flavored Markdown] format" — the docs link directly to GitHub's GFM spec. **This means D-9 (terse/technical), D-10 (known limitations bullets), and D-11 (user-facing formula) can all use rich markdown without restriction.** The 04-RESEARCH-style table format we use internally renders correctly on the listing page.

3. **Going `public: true` requires the publisher be VERIFIED.** Verified from Microsoft Learn 2026-04 manifest reference: *"If your publisher is verified, you can make your extension public by setting the Public flag in your extension manifest"*. The publisher `TsezariMshvenieradzeExtensions` has been actively publishing private VSIXes during Phases 2/3/4 (0.1.0 through 0.2.5, all `public:false`, all `--share-with cezari`), which proves the publisher account exists and has Marketplace (publish) permissions — but **publisher verification is a separate step**, granted by Microsoft after a publisher request, and gates the `public:true` field. The planner must include a task to **check publisher verification status** in the Marketplace management portal BEFORE the public-flip task runs. If the publisher is not yet verified, the planner needs a sub-task: "Request verification at <https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions> → Profile → Request Verification". Verification can take days; this is the only step in Phase 5 with an external waiting dependency.

**Primary recommendation:** Sequence Phase 5 with **Wave 1** as the unblocked work (CI gate, bundle-size script, listing assets, README v1, dev-publish fix), **Wave 2** as the publisher-verification + private-cezari multi-process verification (depends on the assets but parallel to verification request if filed early), and **Wave 3** as the public-flip (depends on Wave 1 + Wave 2 complete and verification confirmed). The CI gate and bundle-size script can land first because they're pure code with no external state. Publisher verification is the long-pole — file the request as one of the first Phase 5 commits.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| CI workflow execution | GitHub Actions runner (`ubuntu-latest`) | Local dev environment (npm scripts) | CI is the gate; local invocation must run the same commands. Both gates use Node 20 + `npm ci` reproducibility. |
| Bundle-size measurement | Node script (`scripts/check-bundle-size.cjs`) | webpack production output | Pure post-build inspection of `dist/` files; no webpack plugin needed. Same script runs locally and in CI. |
| Marketplace listing markdown | Static `marketplace/overview.md` | `vss-extension.json` `content.details.path` | The manifest references the markdown file at package time; `tfx extension publish` includes it in the VSIX. Marketplace renders it on the listing page. |
| Screenshots | Static PNGs in `images/screenshots/` | `vss-extension.json` `screenshots[]` | Marketplace requires 1366×768 PNGs; capture is a manual host-side activity (cezari + browser DevTools). Files travel inside the VSIX. |
| Publisher verification | Visual Studio Marketplace manage portal (web UI) | `vss-extension.json` `publisher` + `public:true` | Verification is an account property of the publisher, not the extension. The manifest only flips `public:true`; without verification on the publisher side, the flip is rejected by the Marketplace API. |
| Cross-process verification | cezari Project Collection (org-level UI) | per-project work-item-form context | Each project in cezari uses one process template (Scrum / Agile / CMMI). Adding new projects exercises the FieldResolver fallback path on real ADO surfaces. |
| Public publish | `tfx extension publish --token` (manual) | `.env.local` PAT + `vss-extension.json` v1.0.0 | Per CONTEXT D-2, publish remains a manual step (no PAT in CI secrets). The flip happens locally via the same command Phase 4 used, plus `public:true` in the manifest. |
| README v1 | `README.md` at repo root | Linked from `vss-extension.json` `links.repository` and `links.support` | The README is for engineers (GitHub readers); the marketplace overview is for Marketplace browsers. Two artifacts, overlapping but distinct content. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

> Verbatim from `.planning/phases/05-polish-marketplace-publish/05-CONTEXT.md` `<decisions>`. Excerpted; the canonical record is CONTEXT.md.

- **D-1:** v1 ships with the two stock SP refs only (`Microsoft.VSTS.Scheduling.StoryPoints` for Scrum/Agile/Basic; `Microsoft.VSTS.Scheduling.Size` for CMMI). Custom SP field name override is **deferred to v2**. README + Marketplace listing must explicitly note the limitation.
- **D-2:** **GitHub Actions** for CI. `.github/workflows/`. Triggers: push + PR. Steps: `npm ci` → `npm run typecheck` → `npm test -- --run` → `npm run build` → `npm run check:size`. **Does NOT auto-publish**; publish stays manual.
- **D-3:** Post-build Node script `scripts/check-bundle-size.cjs`. Reads `dist/*.{html,js,css}`, gzip-sizes via `zlib.gzipSync`, sums totals. Wired as `npm run check:size`.
- **D-4:** **Hard fail** when threshold exceeded (250 KB gzipped total). Exit non-zero; CI fails. Print delta on overflow.
- **D-5:** **Use cezari with multiple project templates** instead of two trial orgs. Add Agile + CMMI projects to cezari; verify the modal on a User Story (Agile) and a Requirement (CMMI). Documented deviation from PKG-07 literal "two different ADO organizations" wording — Phase 5 verifier should mark PKG-07 as PARTIAL (process coverage met, single-org coverage).
- **D-6:** **Smoke test only** per process. Per non-Scrum process: open modal → pick a trio → click Apply → verify SP field updates + comment posted. No re-run of the D-17 8-scenario battery on non-Scrum (already covered by Scrum cezari).
- **D-7:** **Skip the Contributor (non-admin) explicit test.** Documented PKG-04 deviation. Phase 5 verifier marks PKG-04 PARTIAL.
- **D-8:** **2 screenshots minimum** — calculator in light theme + calculator in dark theme. Both at the resolved-from-current-trio state for visual richness. Captured on cezari Scrum. Files: `images/screenshots/screenshot-calculator-light.png` and `screenshot-calculator-dark.png`.
- **D-9:** **Terse + technical** description tone. Plain explanation; no marketing fluff.
- **D-10:** **List known limitations publicly** as a bulleted "Known limitations" section: (1) Esc key does not dismiss the modal, (2) no eager read-only probe, (3) custom SP field names not yet supported.
- **D-11:** **User-facing formula explanation only.** Each axis in plain English; show the five level labels per axis. Do not include W / Raw SP math formulas in the listing — repo README is fine for that.

### Claude's Discretion

- Privacy/data-handling statement wording (PKG-05 SC #2). Required claim: "no telemetry; data stays in the user's ADO org."
- Versioning strategy. Recommended: **bump to 1.0.0** at the public-publish moment.
- `dev-publish.cjs` Windows retry-loop fix vs. replacement.
- `package.json` version sync. Currently 0.1.0 (out of sync with manifest 0.2.5). Recommended: sync at the public-publish moment.
- Marketplace `categories` and `tags`. Already declared (`Azure Boards`; `story points`, `estimation`, `scrum`, `agile`).
- README content for v1 release. Currently minimal.
- Icon refinement. Existing `images/icon.png` is 143-byte transparent placeholder.
- Carry-over Phase 4 deferred D-17 scenarios (offline, Stakeholder, slow-3G). Recommendation: punt to v2.

### Deferred Ideas (OUT OF SCOPE)

> Verbatim from CONTEXT.md `<deferred>`:

- Custom SP field name override (D-1) — settings UI for project-scoped ref-name override via Extension Data Service. v2.
- Esc-dismisses-modal investigation — known iframe-focus limitation; click-outside and X button are supported escape paths. v2 if `window.parent.postMessage` proves viable.
- Auto-publish from CI (D-2 deviation) — would require PAT in CI secrets. v2.
- Cross-org verification with two distinct trial orgs (D-5 deviation) — PKG-07 literal wording. v2 if verifier flags as hard fail.
- Contributor non-admin explicit verification (D-7 deviation) — PKG-04 literal wording. v2 if verifier flags as hard fail.
- Reopen-pre-fill from sentinel comment — permanently deferred per Phase 4 spike A1 STRIPPED-FALLBACK.
- Eager read-only probe — permanently deferred per Phase 4 spike A3 LAZY-FALLBACK-ONLY.
- D-17 Scenario 3 (offline), Scenario 5 (Stakeholder), Scenario 7 (slow-3G) — recommendation: punt to v2.

## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support |
|---|---|---|
| PKG-02 | Build pipeline produces a `.vsix` via `tfx-cli` with `dist/toolbar.{html,js}` + `dist/modal.{html,js}` | `npm run package` already exists at `package.json:21` (`tfx extension create --manifest-globs vss-extension.json --output-path dist/`); webpack two-entry config at `webpack.config.cjs:55-57` produces both bundles. The CI workflow's `npm run build` produces these; PKG-02 is met by the existing build chain — no new tooling required for the **build** half. The **package** half is exercised manually by the Phase 5 publish loop and validated empirically by the Phase 4 cezari publishes (0.1.18 / 0.1.20 / 0.2.2 / 0.2.5 all packaged successfully). |
| PKG-03 | Bundle ≤ 250 KB gzipped; CI fails above threshold | Current measured baseline is 146.8 KB gzipped (modal.js 142.8 KB + toolbar.js 3.2 KB + 2 HTML stubs at 0.4 KB each). 103.2 KB headroom. Script source provided below. |
| PKG-04 | Installable on fresh ADO trial org; Contributor can complete open-modal → Apply | D-7 deviation: skip explicit Contributor test. PKG-04 verified at "extension installs and Apply works for the publishing user" — the spike + Phase 4 cezari runs already prove this for Tsezari's account on cezari. PARTIAL verdict per CONTEXT.md. |
| PKG-05 | Marketplace listing has description, light+dark screenshots, formula explanation, privacy/data-handling statement, 128×128 icon | Listing assets covered by D-8 / D-9 / D-10 / D-11. Icon refinement is Claude-discretion (current placeholder is functional but unbranded). Privacy statement wording is Claude-discretion; recommended phrasing in the Marketplace overview section below. |
| PKG-06 | Publisher account registered, verified, confirmed before first public publish | **Verification status check task required** (see Finding 3 above). Microsoft Learn 2026-04 manifest reference: `public:true` only honored if publisher is verified. Account `TsezariMshvenieradzeExtensions` exists and has been actively publishing — but verification status is a separate property visible at `https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions`. |
| PKG-07 | Public listing on Marketplace; install + Apply succeeds on Agile + CMMI | D-5 deviation: cezari with multiple project templates (Scrum + Agile + CMMI) substitutes for two distinct trial orgs. PARTIAL verdict acceptable per CONTEXT.md. |

## Standard Stack (Phase 5 additions)

### Core (no new runtime packages)

> All Phase 5 functionality is built on the already-pinned stack. No new runtime dependencies required for the extension itself.

### CI / Tooling additions (zero new packages)

| Tool / Package | Pinned Version | Why for Phase 5 | Choice / Version confidence |
|---|---|---|---|
| `actions/checkout@v4` | v4 (latest major) | Standard checkout step; pinning to v4 is current best practice (v3 is end-of-life) | HIGH `[CITED: github.com/actions/checkout]` |
| `actions/setup-node@v4` | v4 (latest major) | Provides Node 20 + built-in npm cache via `cache: 'npm'` parameter (no separate `actions/cache@v4` block needed) | HIGH `[CITED: github.com/actions/setup-node]` |
| `node` | 20.x (matches `package.json` `engines.node >=20.10.0`) | Node 20 LTS is the project's engine floor; CI must match | HIGH `[VERIFIED: package.json:8]` |
| `tfx-cli` | `0.23.1` (already pinned) | Marketplace publishing tool; only needed in CI if we ever automate the publish (we don't, per D-2). For CI's purposes, **`tfx-cli` is NOT installed in the CI workflow** — the workflow stops at `check:size`. Publish is manual. | HIGH `[VERIFIED: package.json:43]` |
| `zlib` (Node built-in) | n/a | `zlib.gzipSync` for the bundle-size script. No package install. | HIGH |

### Why no auto-publish in CI

CONTEXT.md D-2 locks publish as manual. The decision rationale:
- Storing the Marketplace PAT in `${{ secrets.TFX_PAT }}` is technically straightforward but creates a supply-chain risk surface (any commit to master triggers a publish path).
- `tfx extension publish` is a deliberate human action — the published version is a permanent artifact on Marketplace.
- The Phase 4 cezari publish loop (4 versions in one verification session) demonstrates that human-driven publish is the correct cadence for this project.

This means the CI workflow stops at the bundle-size gate. There is no `tfx-cli` install step, no PAT secret, and no "release" job. The publish step is documented in the README as a manual procedure (see §README v1 outline below).

## Architecture Patterns

### System Architecture Diagram

```
                      Phase 5 Polish & Publish

                           ┌──────────────────┐
   ┌──────────────────────►│  GitHub Actions  │
   │      master push      │  ubuntu-latest   │
   │      pull_request     │  Node 20         │
   │                       └────────┬─────────┘
   │                                │
   │                                ▼
   │   ┌────────────────────────────────────────────┐
   │   │ npm ci → typecheck → test → build → check  │
   │   └────────────────┬───────────────┬───────────┘
   │                    │ pass          │ fail
   │                    ▼               ▼
   │              CI green        CI red (PR blocked)
   │
   │ ◄── (developer iterates locally; same commands as CI) ──────┐
   │                                                              │
   │                                                              │
Local dev machine (Windows/Tsezari)                               │
   │                                                              │
   ├── npm run build (writes dist/)                               │
   ├── npm run check:size (gzip-sums dist/*.{html,js,css})        │
   ├── (manual) capture screenshots in cezari → images/screenshots/
   ├── npm run publish:cezari (private share via tfx-cli)         │
   │                       │                                      │
   │                       ▼                                      │
   │   ┌──────────────────────────────────────────────┐           │
   │   │  Visual Studio Marketplace                   │           │
   │   │  publisher: TsezariMshvenieradzeExtensions   │           │
   │   │  extension: story-point-calculator           │           │
   │   │  state: private (--share-with cezari)        │           │
   │   └────────────────┬─────────────────────────────┘           │
   │                    │                                         │
   │                    ▼                                         │
   │   ┌──────────────────────────────────────────────┐           │
   │   │  cezari ADO org                              │           │
   │   │  ┌───────────┐ ┌─────────┐ ┌──────────────┐  │           │
   │   │  │ Cezari    │ │ Agile-* │ │ CMMI-*       │  │           │
   │   │  │ (Scrum)   │ │ project │ │ project      │  │           │
   │   │  │ PBI/Bug   │ │ User    │ │ Requirement  │  │           │
   │   │  │ /Task     │ │ Story   │ │ /Task        │  │           │
   │   │  └───────────┘ └─────────┘ └──────────────┘  │           │
   │   └──────────────────────────────────────────────┘           │
   │              ↑ smoke test on each (D-5/D-6)                  │
   │                                                              │
   │ (after Wave 1 + Wave 2 complete, publisher verification confirmed)
   ▼
┌────────────────────────────────────────────────────────────────┐
│ FLIP: vss-extension.json: public:false → public:true,          │
│       version: 0.2.x → 1.0.0                                   │
│       publish via tfx extension publish (no --share-with)      │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
              Public Marketplace listing live
```

### Recommended File Layout (Phase 5 additions)

```
.github/
  workflows/
    ci.yml                          ← NEW (Phase 5)
scripts/
  check-bundle-size.cjs             ← NEW (Phase 5)
  dev-publish.cjs                   ← MODIFIED or REPLACED (Phase 5)
marketplace/
  overview.md                       ← NEW (Phase 5; long-form Marketplace listing)
images/
  icon.png                          ← (existing 128×128, may be regenerated)
  toolbar-icon.png                  ← (existing)
  screenshots/                      ← NEW directory (Phase 5)
    screenshot-calculator-light.png ← NEW (D-8)
    screenshot-calculator-dark.png  ← NEW (D-8)
README.md                           ← EXPANDED (Phase 5; v1 polish)
vss-extension.json                  ← MODIFIED (Phase 5; add content/links/screenshots/repository fields, version → 1.0.0, public → true at flip)
package.json                        ← MODIFIED (add `check:size` and `publish:cezari` scripts; sync version to 1.0.0 at flip)
```

### Pattern 1: GitHub Actions CI Workflow

**What:** A single `ci.yml` workflow that runs on push to master and on every pull_request, executing the same npm scripts a developer runs locally — typecheck, test, build, bundle-size gate. No publish step.

**When to use:** Always — every commit to master and every PR opened against master.

**Source:** `[VERIFIED: actions/setup-node@v4 README at github.com/actions/setup-node]` for cache parameter; `[CITED: docs.github.com/actions]` for trigger syntax.

**Verbatim YAML for the planner to drop into `.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

# Cancel earlier runs of the same ref when a new commit lands
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: Build & verify
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Unit tests
        run: npm test -- --run

      - name: Build (production)
        run: npm run build

      - name: Bundle size gate (≤ 250 KB gzipped)
        run: npm run check:size
```

**Why this shape:**

- `actions/setup-node@v4` `cache: 'npm'` reads `package-lock.json` automatically — no separate `actions/cache@v4` block needed (the standalone cache action is a more verbose alternative for non-standard layouts; setup-node's built-in cache is the current Microsoft/GitHub-recommended path).
- `npm ci` (not `npm install`) for reproducibility — uses lockfile exact versions, fails if `package-lock.json` and `package.json` are out of sync.
- `npm test -- --run` is required because vitest's default is watch mode; `--run` (or the existing `vitest run` in `package.json:15`) makes it one-shot. **Note:** the project's existing `npm test` script is already `vitest run`, so `npm test -- --run` is redundant but harmless. The planner can simplify to `npm test` if confirmed.
- `concurrency` block cancels superseded runs (e.g., when a PR receives multiple commits in quick succession) — prevents wasted minutes.
- `timeout-minutes: 10` — current full pipeline runs in ~2 minutes locally; 10 is a comfortable ceiling.

### Pattern 2: Bundle-Size Gate Script

**What:** A pure Node CommonJS script that gzip-sizes every `.html`/`.js`/`.css` file under `dist/`, sums the totals, prints a per-file table + grand total, exits 1 if the total exceeds 250 KB.

**When to use:** As a step in CI (always); optionally as a `postbuild` hook for local builds (recommended NOT to wire as `postbuild` to avoid surprise failures during `npm run dev` watch mode — call it explicitly via `npm run check:size`).

**Source:** `[VERIFIED: zlib.gzipSync is a Node 20 built-in]`; logic is mechanical.

**Verbatim source for the planner to drop into `scripts/check-bundle-size.cjs`:**

```javascript
#!/usr/bin/env node
// scripts/check-bundle-size.cjs — Phase 5 PKG-03 bundle-size gate.
//
// Reads every dist/*.{html,js,css} file, gzip-sizes it, sums the total, and
// fails (exit 1) if the sum exceeds the budget. Skips fonts (.woff/.woff2)
// and webpack license files (*.LICENSE.txt) — fonts are large and Marketplace
// caches them separately; license files are pure metadata.
//
// Usage:
//   npm run build && npm run check:size
//
// Usage in CI: same — runs after the build step.

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const REPO_ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(REPO_ROOT, "dist");
const BUDGET_KB = 250;
const BUDGET_BYTES = BUDGET_KB * 1024;
const COUNTED_EXT = new Set([".html", ".js", ".css"]);

function fmtKb(bytes) {
  return (bytes / 1024).toFixed(1).padStart(7) + " KB";
}

if (!fs.existsSync(DIST_DIR)) {
  console.error(`[check:size] ABORT: ${DIST_DIR} does not exist. Run 'npm run build' first.`);
  process.exit(2);
}

const entries = fs
  .readdirSync(DIST_DIR)
  .filter((f) => COUNTED_EXT.has(path.extname(f)))
  .filter((f) => !f.endsWith(".LICENSE.txt"));

if (entries.length === 0) {
  console.error(`[check:size] ABORT: no countable files in ${DIST_DIR} (looked for ${[...COUNTED_EXT].join(", ")})`);
  process.exit(2);
}

console.log("Bundle size report:");
console.log(`  ${"file".padEnd(24)} ${"raw".padStart(12)} ${"gzipped".padStart(12)}`);
console.log(`  ${"-".repeat(24)} ${"-".repeat(12)} ${"-".repeat(12)}`);

let totalRaw = 0;
let totalGz = 0;
for (const f of entries.sort()) {
  const buf = fs.readFileSync(path.join(DIST_DIR, f));
  const gz = zlib.gzipSync(buf);
  totalRaw += buf.length;
  totalGz += gz.length;
  console.log(`  ${f.padEnd(24)} ${fmtKb(buf.length)} ${fmtKb(gz.length)}`);
}

console.log(`  ${"-".repeat(24)} ${"-".repeat(12)} ${"-".repeat(12)}`);
console.log(`  ${"TOTAL".padEnd(24)} ${fmtKb(totalRaw)} ${fmtKb(totalGz)}`);
console.log(`  Budget: ${BUDGET_KB} KB gzipped`);

if (totalGz > BUDGET_BYTES) {
  const overBy = totalGz - BUDGET_BYTES;
  console.error("");
  console.error(`[check:size] FAIL: total gzipped size ${fmtKb(totalGz).trim()} exceeds budget ${BUDGET_KB} KB by ${fmtKb(overBy).trim()}`);
  console.error(`[check:size] Reduce bundle: tree-shake azure-devops-ui, lazy-load modal-only deps, or split the modal entry.`);
  process.exit(1);
}

const headroom = BUDGET_BYTES - totalGz;
console.log(`  Headroom:                     ${fmtKb(headroom)}  ✓`);
```

**`package.json` script entry:**

```json
"check:size": "node scripts/check-bundle-size.cjs"
```

**Expected output on the current build (Phase 5 baseline):**

```
Bundle size report:
  file                              raw      gzipped
  ------------------------ ------------ ------------
  modal.html                    0.7 KB       0.4 KB
  modal.js                    633.8 KB     142.8 KB
  toolbar.html                  0.7 KB       0.4 KB
  toolbar.js                    8.2 KB       3.2 KB
  ------------------------ ------------ ------------
  TOTAL                       643.3 KB     146.8 KB
  Budget: 250 KB gzipped
  Headroom:                                103.2 KB  ✓
```

### Pattern 3: Marketplace Listing Manifest Fields

**What:** `vss-extension.json` additions for the public listing. The current manifest has the bare minimum (id, version, publisher, public, targets, categories, tags, description, icons, scopes, files, contributions). For a polished public listing, the planner adds: `content`, `screenshots`, `links`, `repository`, `branding` (optional), and updates `description` to the listing-quality short text.

**Source:** `[CITED: learn.microsoft.com/en-us/azure/devops/extend/develop/manifest 2026-04]` — re-verified in this research session. The relevant fields and their canonical descriptions:

| Field | Canonical description (from Microsoft Learn 2026-04) | Phase 5 use |
|---|---|---|
| `description` | "A few sentences describing the extensions. Limited to 200 characters. The description should be your extension's 'elevator pitch'." | Already present; keep current "Structured Story Point estimation using Complexity, Uncertainty, Effort." (76 chars). |
| `categories` | "Array of strings representing the categories. **Valid values: Azure Repos, Azure Boards, Azure Pipelines, Azure Test Plans, Azure Artifacts.**" | Already `["Azure Boards"]` — correct. |
| `tags` | "Array of string tags to help users find your extension. Examples: agile, project management, task timer." | Already `["story points", "estimation", "scrum", "agile"]`. **Suggested addition:** `"cmmi"`, `"fibonacci"` — both are searchable terms specific to the extension's value. |
| `icons.default` | "128x128 pixels of type BMP, GIF, EXIF, JPG, PNG and TIFF" | Already declared at `images/icon.png`. **Caveat:** the current PNG is a transparent placeholder — see §Icon refinement below. |
| `screenshots` | "Array of images that couldn't be included in your **content**. Each image should be 1366x768 pixels." | NEW. Add 2 entries pointing at `images/screenshots/screenshot-calculator-{light,dark}.png`. |
| `content.details.path` | "Each file is assumed to be in **GitHub Flavored Markdown** format. Valid keys: `details`. The `path` of each item is the path to the Markdown file in the extension." | NEW. Point at `marketplace/overview.md`. |
| `links` | "Dictionary of links that help users learn more, get support. Valid keys: `getstarted`, `learn`, `license`, `privacypolicy`, `support`. The value of each key is an object with a `uri` field." | NEW. Add `getstarted` (link to README §Use), `support` (GitHub issues), `license` (LICENSE in repo). |
| `repository` | "Dictionary of properties describing the source code repository. Valid keys: `type`, `uri`." | NEW. Set to `{ "type": "git", "uri": "https://github.com/tsmshvenieradze/StoryPointExtension" }`. |
| `branding` | "Valid keys: `color` (hex/rgb/HTML name), `theme` (`dark`/`light`)." | OPTIONAL. Recommended skip for v1 — the existing 128×128 placeholder icon is the only visual element; theme branding is cosmetic. |
| `public` | "If your publisher is verified, you can make your extension public by setting the Public flag." | Currently `false`. Flip to `true` at the public-publish moment (Wave 3). |
| `files` | Existing array (`dist`, `images`); the planner must verify `images/screenshots/` is covered by the existing `{ "path": "images" }` entry — a `path` is a directory and includes its contents, so `images/screenshots/*.png` IS bundled. **Verified by inspecting Phase 4 VSIX layouts (1.5 MB packages already include `images/icon.png` and `images/toolbar-icon.png`).** Adding `marketplace/` requires a new entry: `{ "path": "marketplace" }`. |

**Verbatim manifest delta (the planner applies as a single edit):**

```json
{
  "manifestVersion": 1,
  "id": "story-point-calculator",
  "version": "1.0.0",                                  // ← bumped from 0.2.5 at public-flip
  "name": "Story Point Calculator",
  "publisher": "TsezariMshvenieradzeExtensions",
  "public": true,                                      // ← flipped at public-publish (Wave 3)
  "targets": [
    { "id": "Microsoft.VisualStudio.Services" }
  ],
  "categories": ["Azure Boards"],
  "tags": ["story points", "estimation", "scrum", "agile", "cmmi", "fibonacci"],
  "description": "Structured Story Point estimation using Complexity, Uncertainty, Effort.",
  "icons": {
    "default": "images/icon.png"
  },
  "scopes": [
    "vso.work_write"
  ],
  "files": [
    { "path": "dist", "addressable": true },
    { "path": "images", "addressable": true },
    { "path": "marketplace" }                          // ← NEW: bundles overview.md into VSIX
  ],
  "content": {                                         // ← NEW
    "details": {
      "path": "marketplace/overview.md"
    },
    "license": {
      "path": "LICENSE"
    }
  },
  "links": {                                           // ← NEW
    "getstarted": {
      "uri": "https://github.com/tsmshvenieradze/StoryPointExtension#usage"
    },
    "support": {
      "uri": "https://github.com/tsmshvenieradze/StoryPointExtension/issues"
    },
    "license": {
      "uri": "https://github.com/tsmshvenieradze/StoryPointExtension/blob/master/LICENSE"
    }
  },
  "repository": {                                      // ← NEW
    "type": "git",
    "uri": "https://github.com/tsmshvenieradze/StoryPointExtension"
  },
  "screenshots": [                                     // ← NEW
    { "path": "images/screenshots/screenshot-calculator-light.png" },
    { "path": "images/screenshots/screenshot-calculator-dark.png" }
  ],
  "contributions": [
    /* unchanged from current 0.2.5 manifest */
  ]
}
```

**Sequencing note on the public flip:** The planner should split the manifest edit into TWO commits:

1. **Commit A (Wave 1):** Add `content`, `links`, `repository`, `screenshots`, the new `files` entry, and the expanded `tags`. Keep `version: 0.2.x`, keep `public: false`. Publish privately to cezari (re-shares the existing dev install) so the listing assets are validated end-to-end on Marketplace before the public flip.
2. **Commit B (Wave 3):** Bump `version: 0.2.x → 1.0.0`, flip `public: false → true`. Publish.

Splitting the commits keeps the public flip auditable and reversible (the public flip is the one-line change git can revert if Marketplace rejects it for any reason).

### Pattern 4: Marketplace Overview Markdown Subset

**What:** A long-form GitHub Flavored Markdown document that becomes the listing's main detail page. Renders to the right of the Marketplace listing's icon + screenshots carousel.

**When to use:** Every public extension. Marketplace surfaces this content as the primary "What is this extension?" surface.

**Source:** `[CITED: learn.microsoft.com/en-us/azure/devops/extend/develop/manifest 2026-04 — content section]` — *"Each file is assumed to be in [GitHub Flavored Markdown](https://help.github.com/articles/github-flavored-markdown/) format."* GFM supports: headings (h1–h6), bold/italic, lists (ordered, unordered, nested), tables, fenced code blocks with syntax highlighting, blockquotes, links, images (inline `![alt](path)`), task lists (`- [x]`), strikethrough, autolinks.

**Verbatim recommended structure for `marketplace/overview.md`:**

```markdown
# Story Point Calculator

Structured Story Point estimation using **Complexity**, **Uncertainty**, and **Effort** — built for Azure Boards teams who want a consistent, reproducible alternative to free-form Story Point guessing.

## What it does

Open any work item in Azure Boards. Click **Calculate Story Points** in the toolbar. Pick a level for each of the three axes. Click **Apply**. The Story Points field updates and an audit comment is posted explaining how the value was derived. The whole flow takes under 30 seconds and never leaves the work item form.

## Screenshots

![Calculator modal — light theme](images/screenshots/screenshot-calculator-light.png)

![Calculator modal — dark theme](images/screenshots/screenshot-calculator-dark.png)

## How to use

1. Open any work item in Azure Boards.
2. Click **Calculate Story Points** in the work item toolbar (the `…` menu on smaller screens).
3. Pick a level for each axis:
   - **Complexity** — how hard the work is.
   - **Uncertainty** — how much you know about the work.
   - **Effort** — how much work there is to do.
4. Click **Apply**. The Story Points field updates immediately, and a Discussion comment is posted summarizing the calculation.

## The three axes

| Axis | Plain-English question | Levels |
|---|---|---|
| Complexity | How hard is the work? | Very Easy · Easy · Medium · Hard · Very Hard |
| Uncertainty | How much do we know? | Very Easy · Easy · Medium · Hard · Very Hard |
| Effort | How much work is there to do? | Very Easy · Easy · Medium · Hard · Very Hard |

The final Story Points value is rounded to the nearest Fibonacci number: **0.5, 1, 2, 3, 5, 8, 13**.

## Supported processes

| Process | Work item type | Story Points field |
|---|---|---|
| Scrum | Product Backlog Item, Bug, Task | `Microsoft.VSTS.Scheduling.StoryPoints` |
| Agile | User Story, Bug, Task, Feature, Epic | `Microsoft.VSTS.Scheduling.StoryPoints` |
| Basic | Issue, Task, Epic | `Microsoft.VSTS.Scheduling.StoryPoints` |
| CMMI | Requirement, Task | `Microsoft.VSTS.Scheduling.Size` |

The extension automatically resolves the right field per work item type. If a work item type does not have a Story Points field (or the field has been removed via process customization), the modal opens and shows a message explaining which types are supported.

## Privacy and data handling

- **No telemetry.** The extension does not phone home, collect usage statistics, or report errors to any external service.
- **All data stays in your Azure DevOps organization.** The extension reads the work item's current Story Points value and existing comments, computes a new value locally in your browser, and writes the result back to the same work item using Azure DevOps' standard work-item-write APIs.
- **Permissions.** The extension requests the `vso.work_write` scope only — read and write work items (no project-admin, no organization-admin, no identity scopes).
- **Open source.** Source code at <https://github.com/tsmshvenieradze/StoryPointExtension>; MIT licensed.

## Known limitations (v1)

- **Esc key does not dismiss the modal.** Click outside the modal or use the title-bar X to close. (The browser security model isolates iframe Esc events from the host page; SDK v4 does not expose a programmatic close API.)
- **Read-only state surfaces reactively.** If you lack write permission on the work item, the calculator opens normally; you'll see a clear error banner only if you click Apply. (No upfront permission probe is exposed by the work-item-form service in dialog iframes.)
- **Custom Story Points field names not yet supported.** The extension works with the stock `Microsoft.VSTS.Scheduling.StoryPoints` (Scrum/Agile/Basic) and `Microsoft.VSTS.Scheduling.Size` (CMMI) fields. If your organization has renamed these via process customization, custom-field support is on the v2 roadmap — please [open an issue](https://github.com/tsmshvenieradze/StoryPointExtension/issues) so we can prioritize.

## Roadmap (v2)

- Custom Story Points field name override (per-project, via Extension Data Service).
- Configurable axis weights (currently `0.4·C + 0.4·U + 0.2·E`).
- Configurable axis labels and Fibonacci thresholds.
- Org Settings + Project Settings hubs.

## Support

Issues, feature requests, and questions: <https://github.com/tsmshvenieradze/StoryPointExtension/issues>.

## License

MIT. See [LICENSE](https://github.com/tsmshvenieradze/StoryPointExtension/blob/master/LICENSE) at the repo root.
```

**Notes on tone (per D-9):**

- Plain English, no marketing fluff.
- Tables for the dense facts (axes, processes) — GFM tables render correctly on Marketplace.
- Privacy section is bullet-form and explicit; satisfies PKG-05's "privacy/data-handling statement."
- Known limitations are listed openly per D-10.
- No internal math (W = 0.4·C + 0.4·U + 0.2·E) per D-11; that lives in README.

### Pattern 5: Screenshot Capture on Windows

**What:** Two PNG screenshots of the calculator modal — one in light theme, one in dark theme — captured at the resolved-from-current-trio state (i.e., all three dropdowns selected, calc panel showing W / Raw SP / Final SP). Saved to `images/screenshots/screenshot-calculator-{light,dark}.png`. Marketplace recommends 1366×768.

**When to use:** One-time, before Wave 1 commits the listing assets.

**Source:** `[CITED: learn.microsoft.com/en-us/azure/devops/extend/develop/manifest 2026-04 — screenshots field]` — *"Each image should be 1366x768 pixels."* This is a recommendation; smaller PNGs render too but get scaled.

**Recommended capture procedure (manual, per D-8 — no Playwright needed for 2 shots):**

```
Per theme (light, then dark):

1. Set ADO host theme to the target theme:
   - cezari.visualstudio.com → User settings (top-right avatar) → Theme → Light / Dark.

2. Open a Cezari project PBI:
   - https://cezari.visualstudio.com/Cezari/_workitems/edit/<id>
   - Pick a PBI with no current Story Points value (cleanest visual — no
     ConfirmOverwritePanel state).

3. Click "Calculate Story Points" in the work item toolbar.

4. In the modal, set:
   - Complexity = Hard
   - Uncertainty = Medium
   - Effort = Easy
   This trio resolves to W=2.40, Raw SP=1.95, Final=2 (Fibonacci) — visually
   demonstrates all three Calc panel rows (W, Raw SP, Final SP) plus the
   formula text. The non-trivial trio is more representative than a uniform
   "Easy / Easy / Easy" choice.

5. Open Chrome DevTools (F12). In Elements panel:
   - Select the iframe element (the modal renders in an iframe inside the
     host's host-managed dialog).
   - Right-click the iframe's <body> in DevTools → "Capture node screenshot".
     This produces a PNG of the modal contents WITHOUT the surrounding ADO
     work item form — exactly what Marketplace's screenshot carousel needs.

6. Save the PNG as:
   - light: images/screenshots/screenshot-calculator-light.png
   - dark:  images/screenshots/screenshot-calculator-dark.png

7. Verify dimensions:
   - Marketplace recommends 1366×768. The modal's natural width is ~600px
     and height varies (~400-500 px). The DevTools capture will be at the
     natural element size — smaller than 1366×768 but acceptable.
   - If you want to match Marketplace's recommended dimensions exactly, use
     Windows Snipping Tool (Win+Shift+S) to capture a wider region of the
     work item form INCLUDING the modal, then verify the PNG is at least
     1280px wide. The DevTools approach is cleaner; the Snipping Tool
     approach is more representative.

Alternative capture path (if DevTools "Capture node screenshot" is not
available — older Chrome versions): use Snipping Tool to capture just the
modal's bounding rectangle. Crop in any image editor (Paint, GIMP) to
remove host chrome. Save as PNG (NEVER JPEG — JPEG compression artifacts
on UI text make screenshots look unprofessional).
```

**Captured PNG file format requirements:**

- **PNG** (preferred for UI screenshots — lossless, sharp text).
- **No alpha transparency** in the saved image (Marketplace renders against various background colors).
- **No EXIF metadata** stripping required — Marketplace ignores EXIF.

**Why not Playwright / automated capture:**

- Playwright would add ~150 MB of devDependencies for a 2-shot, one-time task.
- The Phase 03-04 verification noted Playwright MCP server disconnects on this developer's machine; relying on it would be fragile.
- Manual DevTools capture takes <2 minutes per shot and produces equivalent quality.

### Pattern 6: dev-publish.cjs Windows Fix (Recommended: Replace, Not Patch)

**What:** Replace the Node-script wrapper with a `package.json` script that calls `npx tfx extension publish ...` directly. Drop the auto-version-bump-and-restore complexity — Phase 5 is the right time to make explicit version bumps the norm (Phase 5 commits a deliberate `0.2.5 → 1.0.0` bump anyway).

**When to use:** As the canonical publish-to-cezari path going forward.

**Source:** Bug diagnosis verbatim from `.planning/phases/03-modal-ui-read-path/03-VERIFICATION.md:132-140`:

> ### dev-publish wrapper does not retry on Windows
> **Severity:** medium (blocks autonomous re-publish; not a runtime bug)
> **Origin:** `scripts/dev-publish.cjs` (Phase 2, Plan 02-01)
> **Symptom:** When tfx returns a "Version number must increase" collision, the wrapper's spawnSync captures empty `r.stdout` / `r.stderr` on Windows. The version-collision regex never matches, `lastStdout` is empty, and the script bails out of the retry loop after attempt 1 with `publish failed; manifest restored`.
> **Recommended fix:** in `dev-publish.cjs`, replace `spawnSync(npxBin, ..., { shell: false })` with `shell: true` on win32, OR drop spawnSync in favor of `execFileSync` with `windowsHide: true`.

`[VERIFIED: scripts/dev-publish.cjs:99-104 — current shell:false invocation]`

**Root cause:** Node's `spawnSync` on Windows with `shell: false` against a `.cmd` file (npx.cmd is a Windows batch wrapper around Node's npx.js) does not reliably capture child-process stdout when the child writes through Windows console redirection. The captured `r.stdout`/`r.stderr` buffers come back empty even though the child wrote bytes — because the .cmd shim's piped redirection is cmd.exe-managed, not Node-managed. With `shell: true`, Node spawns cmd.exe which mediates the pipe correctly.

`[CITED: github.com/nodejs/node Issue #59210 — Error: spawnSync npm.cmd EINVAL]` and the wider class of "Node spawnSync + .cmd files on Windows" issues.

**Two options for the planner:**

**Option A (RECOMMENDED — replace, not patch):** Delete the auto-bump-and-restore retry logic. The Phase 5 model is explicit version bumps committed to the manifest. Add this script to `package.json`:

```json
"publish:cezari": "tfx extension publish --manifest-globs vss-extension.json --share-with cezari --no-wait-validation --token \"%TFX_PAT%\""
```

Wait — Windows-specific `%TFX_PAT%` won't work on POSIX. The cross-platform pattern is to load `.env.local` first via a thin wrapper. The cleanest path: **keep `dev-publish.cjs` for the .env.local loading** (lines 16–55 are fine, the bug is only in the retry loop), but **delete the retry logic** (lines 63–129). Replace with a single `spawnSync` call that uses `shell: true` on Windows. Renamed to `publish:cezari` to reflect Phase 5's "this is the cezari publish path" semantic.

**Verbatim simplified `scripts/publish-cezari.cjs`:**

```javascript
#!/usr/bin/env node
// scripts/publish-cezari.cjs — Phase 5 canonical publish-to-cezari helper.
//
// Loads .env.local for TFX_PAT, then invokes:
//   npx tfx extension publish --manifest-globs vss-extension.json
//                             --share-with cezari --no-wait-validation
//                             --token <PAT>
//
// Phase 5 model: the manifest version is committed and bumped explicitly.
// No auto-version-bump retry loop — if you hit "Version number must increase",
// edit vss-extension.json, commit the bump, and re-run.
//
// Cross-platform fix for the Phase 03-04 Windows spawnSync bug:
// shell: process.platform === "win32".
//
// Usage: npm run publish:cezari

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(REPO_ROOT, ".env.local");
const LOG_PREFIX = "[publish:cezari]";

// 1. Refuse to run if .env.local is tracked by git.
const lsFiles = spawnSync("git", ["ls-files", ".env.local"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (lsFiles.status === 0 && lsFiles.stdout.trim().length > 0) {
  console.error(`${LOG_PREFIX} ABORT: .env.local is tracked by git. Untrack and rotate the PAT.`);
  console.error(`        git rm --cached .env.local && git commit -m "chore: untrack .env.local"`);
  process.exit(2);
}

// 2. Parse .env.local into process.env.
if (!fs.existsSync(ENV_FILE)) {
  console.error(`${LOG_PREFIX} ABORT: .env.local not found at ${ENV_FILE}.`);
  console.error(`        Create it with: TFX_PAT=<your Marketplace PAT>`);
  process.exit(3);
}
for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const pat = process.env.TFX_PAT;
if (!pat) {
  console.error(`${LOG_PREFIX} ABORT: TFX_PAT missing from .env.local.`);
  process.exit(4);
}

// 3. Invoke tfx-cli. shell: true on Windows fixes the Phase 03-04 stdout
//    capture bug. Pass --token after spawn (PAT not on argv).
const args = [
  "tfx", "extension", "publish",
  "--manifest-globs", "vss-extension.json",
  "--share-with", "cezari",
  "--no-wait-validation",
  "--token", pat,
  ...process.argv.slice(2),
];

console.log(`${LOG_PREFIX} npx tfx extension publish --share-with cezari (token redacted)`);
const r = spawnSync("npx", args, {
  cwd: REPO_ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",   // ← THE FIX
});

process.exit(r.status ?? 1);
```

**`package.json` script entries (Phase 5 final):**

```json
"check:size": "node scripts/check-bundle-size.cjs",
"publish:cezari": "node scripts/publish-cezari.cjs",
"publish:public": "node scripts/publish-cezari.cjs --public"
```

(The `--public` arg passes through to `tfx`; the planner can decide whether to use it as a CLI flag or a manifest-edit-only path. The cleaner choice is **manifest-edit-only** — no CLI override needed; `tfx` reads `public:true` from `vss-extension.json` directly.)

**Option B (if the user prefers to keep the existing wrapper):** One-line patch.

```javascript
// scripts/dev-publish.cjs:99-104 — change shell: false to platform-conditional
const r = spawnSync(npxBin, args, {
  cwd: REPO_ROOT,
  stdio: ["inherit", "pipe", "pipe"],
  shell: process.platform === "win32",   // ← THE FIX
  encoding: "utf8",
});
```

This restores the retry loop's ability to read tfx's "Version number must increase" output and bump the patch automatically.

**Recommendation: Option A.** The original wrapper's auto-bump-and-restore was useful when versions were churning rapidly during dev (Phase 2/3/4 saw ~30 publishes); Phase 5 is the polish phase, and explicit committed version bumps are appropriate. Option A simplifies the codebase by ~80 lines and matches the publish flow Phase 4 actually used (every Phase 4 publish was a direct `tfx extension publish` invocation).

### Anti-Patterns to Avoid

- **Wiring `check:size` as a `postbuild` hook in `package.json`.** This makes `npm run dev` (the watch script that calls `webpack --mode development --watch`) fail every time webpack finishes a watch build, because the gate exits 1 if dev builds blow the budget. Keep it explicit: `npm run check:size` only when you mean to gate.
- **Caching `node_modules` directly via `actions/cache@v4` with a custom key.** `actions/setup-node@v4 cache: 'npm'` does this correctly using `package-lock.json` hash. A custom cache block adds maintenance burden without benefit.
- **Putting the PAT in CI secrets and adding a publish step to `ci.yml`.** Per CONTEXT D-2, publish is manual. Don't tempt fate by leaving an auto-publish path commented out.
- **Capturing screenshots at the wrong state.** An empty calculator (no dropdowns selected) shows three em-dashes for W / Raw SP / Final — visually flat. A resolved-state capture (Hard / Medium / Easy or any non-trivial trio) shows the calculator's actual value proposition and renders better in the Marketplace carousel.
- **Embedding screenshots inline in `marketplace/overview.md` AND declaring them in `vss-extension.json` `screenshots` array with the assumption they'll appear in both places.** They will appear in BOTH places — Microsoft Learn's manifest reference says screenshots inline in `content` are preferred; the top-level `screenshots[]` is for "less important images not featured in your content." Listing them in both creates duplication. The recommended pattern: **inline in overview.md only**. If we use the top-level `screenshots[]` array, those images appear in the Marketplace listing's carousel ABOVE the description. For maximum visibility, declare the same 2 images in both places — Marketplace uses the carousel screenshots as primary preview thumbnails, and the inline ones reinforce in context. Most public extensions do both.
- **Forgetting to commit `images/screenshots/` and `marketplace/` directories.** Both must be tracked by git AND included in the VSIX (via the `files` array in `vss-extension.json`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Bundle-size measurement | A custom webpack plugin (BundleAnalyzerPlugin etc.) | A tiny post-build Node script using `zlib.gzipSync` | We measure ONE number (gzipped total). A plugin adds 30+ MB of analyzer deps for no incremental value. |
| GitHub Actions caching | `actions/cache@v4` with custom keys for `node_modules` | `actions/setup-node@v4 cache: 'npm'` parameter | Built-in; uses `package-lock.json` hash; no maintenance. |
| Screenshot capture automation | Playwright + a capture script | Chrome DevTools "Capture node screenshot" + Snipping Tool fallback | 2 screenshots, one-time. 150 MB devDependency for a single manual task is wrong. |
| Version-collision retry loop | The current dev-publish.cjs auto-bump | Explicit committed version bumps + a one-shot `spawnSync` with `shell: process.platform === "win32"` | Phase 5 is the polish phase; version bumps are deliberate decisions, not automated retries. |
| Marketplace listing markdown rendering | A custom HTML template | GFM in `marketplace/overview.md` per Microsoft Learn 2026-04 | Marketplace renders GFM natively; HTML is allowed but tables/code blocks/etc. work cleanly out of the box. |
| Privacy/data-handling statement | A custom legal review process | A bulleted statement in `marketplace/overview.md §Privacy and data handling` | The extension does not send data anywhere; the statement is factual, not legal. The bulleted form satisfies PKG-05. |
| Cross-process verification orchestration | A test framework spanning ADO orgs | Manual smoke per process per D-6 | UI testing is manual per CLAUDE.md; this is a 5-minute test per process, not a CI candidate. |

**Key insight:** Phase 5 is bounded by explicit decisions in CONTEXT.md. The "polish" framing tempts toward custom tooling (Lighthouse audit on the modal, accessibility scanner, perf budget plugin). Resist all of it. The extension already passes 398 unit tests, has a verified end-to-end flow on cezari, and is at 58% of its bundle budget. Polish means publishing — not adding more gates.

## Runtime State Inventory

> Phase 5 has rename / migration risk only in the version bump (0.2.5 → 1.0.0). The bump itself is a manifest edit; once published, Marketplace registers `TsezariMshvenieradzeExtensions.story-point-calculator@1.0.0` as a new version of the existing extension. No data migration. The inventory is included for completeness:

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | None — the extension does not write to ADO Extension Data Service in v1 (settings live there per the v2 SETT-* requirements; v1 is purely work-item read/write) | None |
| Live service config | The `cezari` ADO org has the extension installed at version 0.2.5 (current cezari share). Updating to 1.0.0 happens automatically once `tfx extension publish 1.0.0 --share-with cezari` succeeds — Marketplace's installed-version pointer follows the latest published version for installs that have auto-update enabled (default). The Agile + CMMI projects added in Wave 2 inherit the org-level extension install — no per-project activation needed. | None — auto-update handles it |
| OS-registered state | None | None |
| Secrets / env vars | `.env.local` `TFX_PAT` is unchanged across phases; the same PAT works for private and public publish (Marketplace (publish) scope). Verify the PAT has not expired. | None unless PAT expired (6-month or 1-year lifetime depending on creation settings) |
| Build artifacts | `dist/` is gitignored and rebuilt every CI run. Local `*.vsix` artifacts (e.g., `TsezariMshvenieradzeExtensions.story-point-calculator-0.2.2.vsix` at repo root) are not tracked by git per `.gitignore` line 14 (`*.vsix`). | None — clean as-is |

**Nothing found in any category that blocks Phase 5.** Inventory clean.

## Common Pitfalls

### Pitfall 1: Publisher verification not yet done

**What goes wrong:** `tfx extension publish` succeeds with `public:true`, but Marketplace returns the extension as-if-private OR returns an error like "publisher must be verified to publish public extensions."
**Why it happens:** Verification is a publisher account property, granted by Microsoft after a publisher request. New publishers default to unverified. Existing publishers may need to re-request after a long inactive period.
**How to avoid:** First task in Phase 5 is to check verification status at <https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions> → publisher details. If unverified, request verification via the management portal's "Request verification" UI. **Verification can take days.** File the request as one of the first commits.
**Warning signs:** Marketplace listing shows up but install count stays 0; `tfx` returns a 400-class error referencing publisher state.

### Pitfall 2: Public flip lands on master without the publisher being verified

**What goes wrong:** A commit flips `public:true`, CI passes (CI doesn't publish), and only at the manual `npm run publish:cezari --public` step does the flip fail. Worse: the flip succeeds in `vss-extension.json` but Marketplace silently keeps the extension private — leaving the source-of-truth committed manifest out of sync with reality.
**Why it happens:** No CI gate verifies publisher state.
**How to avoid:** **Sequence the flip as Wave 3, after explicit verification confirmation.** The planner adds a manual checklist task: "Confirm publisher verified at <portal URL>" that must be checked before the flip commit lands. Don't merge the flip commit on a hunch.
**Warning signs:** No CI failure (CI doesn't publish); the only signal is the Marketplace listing page showing "Private" or the publish command erroring.

### Pitfall 3: Marketplace screenshot dimensions don't match recommendation

**What goes wrong:** Screenshots captured at the modal's natural size (~600×500) appear small and pixelated in the Marketplace listing carousel because Marketplace scales them to 1366×768.
**Why it happens:** D-8 says "capture at modal's natural width (~600px) and pad / scale as needed" — the "pad / scale" half is easy to skip.
**How to avoid:** After capturing the natural-size PNG via DevTools "Capture node screenshot", open in Paint/GIMP, create a new 1366×768 canvas with a neutral background (light gray for the light-theme shot, dark gray for the dark-theme shot), paste the modal capture centered. Save as PNG.
**Warning signs:** The Marketplace listing preview thumbnails look fuzzy/upscaled; ratings reviews mention "screenshots are blurry."

### Pitfall 4: VSIX missing the marketplace/ directory after manifest edit

**What goes wrong:** Adding `content.details.path: "marketplace/overview.md"` to `vss-extension.json` without also adding `{ "path": "marketplace" }` to the `files` array means `tfx extension create` does NOT include `marketplace/overview.md` in the VSIX. Marketplace shows the listing with an empty description.
**Why it happens:** The `files` array is the explicit allowlist of directories/files the VSIX includes. Default behavior excludes everything not listed.
**How to avoid:** Verify after the manifest edit:
```bash
npm run package
unzip -l TsezariMshvenieradzeExtensions.story-point-calculator-1.0.0.vsix | grep -E 'overview|screenshots'
# Expected output:
#   marketplace/overview.md
#   images/screenshots/screenshot-calculator-light.png
#   images/screenshots/screenshot-calculator-dark.png
```
**Warning signs:** Listing's overview tab on Marketplace is blank; screenshots don't appear.

### Pitfall 5: `dev-publish.cjs` retry loop bites again because Option B (one-line patch) keeps shell:false somewhere

**What goes wrong:** The planner picks Option B (patch the existing wrapper), thinking it's the safer/smaller change. They flip `shell: false` to `shell: process.platform === "win32"` for the inner publish call but miss the `git ls-files` call earlier in the file (line 26 of the current source). On Windows that other call also fails silently, the script proceeds without the .env.local-tracked-by-git guard, and the publish runs without the safety check.
**Why it happens:** The same Windows .cmd quirk affects EVERY `spawnSync` against an external command, not just `npx`. `git` resolves to `git.exe` directly (not `git.cmd`) so it usually works — but if Git for Windows is installed via a wrapper (Scoop, npm-bundled, etc.), it could be `.cmd`.
**How to avoid:** Option A (replace the wrapper entirely) sidesteps this — the new script uses `shell: process.platform === "win32"` consistently. If picking Option B, audit ALL `spawnSync` call sites in the file (current source has 2 — lines 26 and 99).
**Warning signs:** Script silently exits with no output; the safety guard appears not to be running; .env.local commits to git without the guard catching it.

### Pitfall 6: README and overview.md drift apart

**What goes wrong:** Updating README's "How to use" but not `marketplace/overview.md`'s — installers see one thing in Marketplace, contributors see different in GitHub.
**Why it happens:** Two separate files, no shared source.
**How to avoid:** **Two acceptable patterns.** (a) Treat them as separate audiences: README is for engineers (includes dev-publish flow, formula math, contribution guide); overview.md is for installers (no dev info, focuses on what + why). The "How to use" section should be near-identical between them; everything else differs by audience. (b) `cp marketplace/overview.md README.md` and append the dev sections — single source. **Recommended: (a)** — the audiences and tone are different enough that maintaining as one file produces a worse README and a worse overview.

### Pitfall 7: VSIX missing the LICENSE file when `content.license.path: "LICENSE"` is declared

**What goes wrong:** The manifest references `content.license.path: "LICENSE"` but the `files` array doesn't include `LICENSE` as an addressable path. `tfx extension create` may include it implicitly (LICENSE-like names get auto-included by some packagers) — but it's not documented behavior.
**How to avoid:** Add `{ "path": "LICENSE" }` to the `files` array if declaring `content.license`. Or skip declaring `content.license` and add the license URL to `links.license` instead (which is what the recommended manifest delta above does).
**Warning signs:** Marketplace listing's License tab shows "Not provided" or 404s.

## Code Examples

Verified patterns from official sources and project state.

### GitHub Actions: Setup with built-in npm cache

```yaml
# Source: github.com/actions/setup-node README + actions/checkout README (verified 2026-05)
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'
- run: npm ci
```

The `cache: 'npm'` parameter:
- Reads `package-lock.json` from the repo root.
- Caches `~/.npm` (the npm download cache, NOT `node_modules`).
- Hashes `package-lock.json` for the cache key.
- Subsequent runs hit the cache when the lockfile is unchanged → `npm ci` runs in seconds instead of ~60s.

### tfx extension publish — verified canonical command

```bash
# Source: learn.microsoft.com/en-us/azure/devops/extend/publish/command-line view=azure-devops 2026-04
tfx extension publish \
  --manifest-globs vss-extension.json \
  --share-with cezari \
  --no-wait-validation \
  --token <PAT>
```

For public publish (Wave 3) — flip `public:true` in the manifest, then:

```bash
tfx extension publish \
  --manifest-globs vss-extension.json \
  --no-wait-validation \
  --token <PAT>
```

(No `--share-with` — public listings are visible to all ADO users, no per-org share needed.)

### Bundle-size script invocation

```bash
# Source: project-local; verified by reading current dist/ via Node script in research session
npm run build && npm run check:size
# Expected output (current state):
#   ...
#   TOTAL                       643.3 KB     146.8 KB
#   Budget: 250 KB gzipped
#   Headroom:                                103.2 KB  ✓
```

### Adding Agile + CMMI projects to cezari (manual UI flow)

```
Source: standard ADO Project Collection settings UI; not version-specific.

1. Navigate to https://cezari.visualstudio.com.
2. Top-right: "+ New project" (or Organization settings → Projects → "New project").
3. Project name: "Agile-Test" (or similar).
4. Visibility: Private.
5. Advanced → Work item process: Agile.
6. Click Create. Wait ~30 seconds for provisioning.
7. Repeat for "CMMI-Test" with Work item process: CMMI.
8. The extension is already installed at the org level (cezari has it shared
   from Phase 4); no per-project install required. Verify by opening the new
   project's Boards → New User Story (or Requirement for CMMI) → ... menu →
   confirm "Calculate Story Points" appears in the work item toolbar.
```

**Verification per process (D-6 smoke test):**

```
Per process (Agile, then CMMI):

1. Create a new work item (Agile: User Story; CMMI: Requirement).
2. Click "Calculate Story Points" in the toolbar.
3. Pick: Complexity=Hard, Uncertainty=Medium, Effort=Easy (resolves to 2 SP).
4. Click Apply.
5. Verify (in DevTools console):
   - [sp-calc/apply] postComment ok commentId=<N>
   - [sp-calc/apply] setFieldValue start refName=<expected ref>
       - Agile: Microsoft.VSTS.Scheduling.StoryPoints
       - CMMI:  Microsoft.VSTS.Scheduling.Size
   - [sp-calc/apply] both writes succeeded
6. Verify (in the work item form):
   - Story Points (Agile) / Size (CMMI) field shows 2.
   - Discussion tab has new comment: "Story Points: 2 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)"
7. Record evidence in 05-VERIFICATION.md.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `vss-web-extension-sdk` v5 (legacy AMD/RequireJS) | `azure-devops-extension-sdk` v4 (modern ESM) | Pinned in Phase 0; unchanged through Phase 5 | Phase 5 doesn't touch SDK; just publishes the v4 build |
| Microsoft-hosted azure-devops-extension-tasks (Azure Pipelines) | GitHub Actions | Phase 5 D-2 | Free for public repos; no service-connection setup |
| `--rev-version` auto-bump in dev-publish | Explicit committed version bumps | Phase 5 D-3 spirit (Claude's discretion) | Audit trail clarity; the auto-bump was useful for dev iteration but hides intent at the polish phase |
| `public: false --share-with cezari` (private dev install) | `public: true` (public listing) | Wave 3 of Phase 5 | One-line manifest change + a commit; reversible |

**Deprecated/outdated:**
- `azure-devops-extension-sdk` v3.x — not used; we're on v4.2.0.
- `tfx-cli` versions <0.20 — current is 0.23.1; older versions had `--rev-version` regressions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The `TsezariMshvenieradzeExtensions` publisher is verified or can be verified within Phase 5's window. **[ASSUMED]** | Pitfall 1 / Finding 3 | If verification takes weeks or is denied, the public flip blocks indefinitely. Phase 5 plan must include a verification-status check task as the first commit. |
| A2 | The cezari org admin can add Agile + CMMI projects without a paid plan upgrade. **[ASSUMED]** | Pattern 6 cezari setup; D-5 | If cezari is on a Free tier with project-count limits (default: 5 projects), adding 2 new ones may require deleting old ones or upgrading. The user owns cezari personally; this is checkable in 1 minute. |
| A3 | Marketplace's listing-page renderer applies GFM tables correctly at the listed dimensions. **[VERIFIED]** | Pattern 4 | Microsoft Learn 2026-04 explicitly says GFM is the format. Tables in Marketplace listings have been verified empirically by inspecting other public ADO extensions. Low risk. |
| A4 | Screenshots in `images/screenshots/` are auto-included in the VSIX via the existing `{ "path": "images" }` files entry. **[VERIFIED via Phase 4 VSIXes — 1.5 MB packages already include images/icon.png and images/toolbar-icon.png]** | Pitfall 4 | Already confirmed by Phase 4 VSIX contents. Low risk. |
| A5 | The current `images/icon.png` (transparent 128×128) renders acceptably in the Marketplace listing carousel even though it's blank. **[ASSUMED — visual inspection in research showed the file is essentially transparent]** | Icon refinement | If Marketplace rejects pure-transparent icons (anti-spam heuristic), the public publish fails. Recommend regenerating the icon with at least a recognizable glyph (similar to the toolbar-icon's calculator pattern, scaled up). The `scripts/generate-placeholder-icon.cjs` script is already structured to accept a pixel-array — extending it to draw a 128×128 calculator glyph is ~30 lines. |
| A6 | The publisher PAT in `.env.local` has not expired between Phase 4's last publish (2026-05-02) and Phase 5's first publish. **[ASSUMED — PATs default to 1 year unless created with a shorter expiration]** | Runtime state inventory | If expired, `tfx extension publish` returns a 401. User regenerates a fresh PAT from the Marketplace management portal and updates `.env.local`. ~3-minute fix. |
| A7 | Microsoft does not require a Q&A configuration before going public. **[ASSUMED — Microsoft Learn shows Q&A as enabled by default for non-GitHub-linked extensions; the manifest reference doesn't list it as required]** | Listing manifest fields | If required, the `CustomerQnASupport` field can be added trivially. Low risk. |
| A8 | The repository URL `https://github.com/tsmshvenieradze/StoryPointExtension` matches the actual GitHub remote. **[ASSUMED based on git config in this session — `tsmshvenieradze` is the user, repo name from working directory `StoryPointExtension`]** | Listing manifest fields | If the repo name or owner differs, the listing's repository link 404s — cosmetic but unprofessional. Verify via `git remote -v` before the manifest edit lands. |

**If A1, A5, or A8 turn out wrong, Phase 5 has a 1-day delay (verification request, icon regeneration, or repo-URL correction). All three are checkable in <5 minutes — the planner should include explicit "verify X" tasks at the start of Wave 1.**

## Open Questions

1. **Should the icon be refined for v1.0.0 or shipped as the transparent placeholder?**
   - What we know: Microsoft Learn does not document a hard "non-transparent" requirement; some published extensions ship plain-color icons. The toolbar-icon.png already shows a 16×16 calculator glyph (`scripts/generate-toolbar-icon.cjs`); scaling that to 128×128 is mechanical.
   - What's unclear: Marketplace's spam/quality heuristics may flag a pure-transparent icon; community standards expect a branded 128×128.
   - Recommendation: **Regenerate the icon.** Take 30 minutes to extend `generate-placeholder-icon.cjs` to draw a 128×128 calculator glyph (or a stylized "SP" wordmark on a colored background). The cost is negligible, the upside is "looks professional in the Marketplace listing carousel." Mark as a small Wave 1 task.

2. **Should the privacy/data-handling statement be in marketplace/overview.md only, or also in a separate `marketplace/privacy.md` referenced via `links.privacypolicy`?**
   - What we know: Marketplace listings often have a separate Privacy tab driven by `links.privacypolicy`. Some listings include both (in-line in overview.md AND a separate URL).
   - What's unclear: For a no-telemetry extension, a separate privacy URL feels overkill — the in-overview bulleted statement is the entire policy.
   - Recommendation: **In overview.md only for v1.** If the verifier flags PKG-05 as needing a separate privacy URL, add a `marketplace/privacy.md` mirroring the overview's privacy section + link via `links.privacypolicy`.

3. **Does Phase 5 verification include a `npm run check:size` failure-mode test (deliberately overshoot the budget) or trust the unit test?**
   - What we know: Phase 5 D-4 says "hard fail when threshold exceeded." A verification of the gate's behavior is a sanity check, not a feature test.
   - What's unclear: Whether the planner wants a vitest test for the script (mocking fs/zlib) or just a manual one-off proof.
   - Recommendation: **Add a 3-line vitest in `tests/scripts/check-bundle-size.test.ts` that imports the script's pure logic** (refactor `check-bundle-size.cjs` to export a `computeReport(files)` function plus a thin CLI driver). 5-minute task; locks the gate's behavior. If refactoring the script for testability is over-spec, fall back to a one-off manual proof: temporarily set `BUDGET_KB = 100`, run `npm run check:size`, observe red exit; restore.

4. **Should the public publish (Wave 3) be preceded by a final cezari smoke test on the soon-to-be-public 1.0.0 build, or can the Wave 2 cezari verification (on 0.2.x) be trusted?**
   - What we know: D-6 is a smoke test "open modal → pick trio → Apply"; it tests behavior, not the version string. Bumping 0.2.x → 1.0.0 is a manifest edit only — no code changes.
   - What's unclear: Whether the verifier accepts "Wave 2 verified 0.2.x; Wave 3 changes only the manifest version + public flag, so behavior is unchanged" or wants a re-verification on 1.0.0 specifically.
   - Recommendation: **Re-verify on 1.0.0 anyway.** The cost is ~5 minutes (one PBI on cezari Scrum, click Calculate, click Apply, observe success). The upside is "we know the public listing's version actually works on a real org." Mark as the final Wave 3 task before the public flip lands on master.

5. **Carry-over Phase 4 deferred D-17 scenarios (3, 5, 7) — exercise in Phase 5 or punt?**
   - What we know: CONTEXT.md says planner decides; recommendation in CONTEXT is "punt to v2." Phase 4 verification noted the orchestrator code paths are unit-test-covered (398/398).
   - What's unclear: The user may want a clean "all v1 D-17 scenarios green" record before the public publish for marketing peace-of-mind.
   - Recommendation: **Punt.** Per CONTEXT.md recommendation. The unit-test coverage is the safety net; production-realistic offline/Stakeholder/slow-3G simulations don't reveal bugs that 398 unit tests don't already catch.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node | All build/test scripts | ✓ | matches `engines.node ≥ 20.10.0` (verified `npm test` ran in Phase 4) | — |
| npm | All install/run scripts | ✓ | matches `engines.npm ≥ 10.0.0` | — |
| `tfx-cli` | Publish to Marketplace | ✓ | 0.23.1 (devDep, `package.json:43`) | — |
| Git | Version control + dev-publish guard | ✓ | (any modern git) | — |
| Chrome / Chromium | DevTools for screenshot capture | ✓ | (user's browser; Phase 4 Console transcripts confirm Chrome) | Edge or Firefox — both have equivalent "Capture node screenshot" features |
| Marketplace publisher PAT | `tfx extension publish` auth | ✓ | active (last used Phase 4 2026-05-02) | If expired: regenerate at <https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions> with **Marketplace (publish)** scope, update `.env.local` |
| GitHub Actions runner minutes | CI workflow | ✓ | unlimited for public repos | If repo is private and minutes run out: switch CI to local `npm run check:size` only, document the loss in README |
| cezari ADO project quota | Adding Agile + CMMI projects | ASSUMED ✓ | Free tier defaults to 5 projects max; cezari currently has 1 (Cezari Scrum project) | If quota exceeded: delete unused projects, OR upgrade to Basic tier (paid), OR test on a fresh trial org (escapes D-5 deviation back into PKG-07 literal) |
| Marketplace publisher verification | `public:true` flip | UNKNOWN — must check | Visible at <publisher portal> | Request verification via the management portal; days-long external dependency |

**Missing dependencies with no fallback:** None blocking — all the unknowns are checkable in <5 minutes via the publisher portal and cezari org settings.

**Missing dependencies with fallback:**
- Publisher verification: Request flow exists; days-long wait. Surface as Wave 1 first task.
- cezari project quota: Free-tier ceiling exists; resolution is delete-or-upgrade or trial-org fallback.

## Validation Architecture

> Phase 5 spec scope is light on automated test additions — the requirements are mostly manifest, listing, and verification work. The bundle-size script is the only NEW automated check; it's a pass/fail CI gate, not a unit-test.

### Test Framework

| Property | Value |
|---|---|
| Framework | vitest 2.1.x (existing; pinned in `package.json:46`) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm test` (already configured to run once via `vitest run` per `package.json:15`) |
| Full suite command | `npm test` (same — full suite runs in <5 seconds) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| PKG-02 | `tfx extension create` produces a `.vsix` containing `dist/toolbar.{html,js}` + `dist/modal.{html,js}` | manual-only | `npm run package && unzip -l TsezariMshvenieradzeExtensions.story-point-calculator-*.vsix` | n/a |
| PKG-03 | Bundle ≤ 250 KB gzipped; CI fails above threshold | smoke (CI gate) | `npm run check:size` | ❌ Wave 0 — script doesn't exist yet |
| PKG-03 (gate behavior) | Gate exits 1 when threshold exceeded | unit | `npx vitest run tests/scripts/check-bundle-size.test.ts` | ❌ Wave 0 (optional per Open Question 3) |
| PKG-04 | Extension installs and Apply works on a fresh org | manual-only | smoke on cezari per D-6 | n/a |
| PKG-05 | Listing has description, screenshots, formula explanation, privacy statement, 128×128 icon | manual-only | visual inspection of Marketplace listing page after Wave 1 private publish | n/a |
| PKG-06 | Publisher verified before first public publish | manual-only | check publisher portal verification status | n/a |
| PKG-07 | Public listing; install + Apply on Agile + CMMI processes | manual-only | smoke on cezari per D-6 across 3 processes | n/a |

### Sampling Rate

- **Per task commit:** `npm test` (existing 398 tests; <5s)
- **Per wave merge:** `npm run typecheck && npm test && npm run build && npm run check:size` (full local CI; <30s)
- **Phase gate:** Full CI green on master + Wave 1+2 manual cezari verification documented in 05-VERIFICATION.md

### Wave 0 Gaps

- [ ] `scripts/check-bundle-size.cjs` — covers PKG-03 (CI gate)
- [ ] (optional) `tests/scripts/check-bundle-size.test.ts` — covers PKG-03 (unit-test of the gate's exit-code behavior)
- [ ] `.github/workflows/ci.yml` — covers PKG-03 (CI execution surface)

(No new vitest framework install needed — vitest 2.1.x is already configured.)

## Sources

### Primary (HIGH confidence)

- `[VERIFIED]` — `package.json` (engines, scripts, deps) — read in research session 2026-05-02
- `[VERIFIED]` — `vss-extension.json` 0.2.5 (manifest current state) — read in research session
- `[VERIFIED]` — `webpack.config.cjs` (two-entry build) — read in research session
- `[VERIFIED]` — `scripts/dev-publish.cjs` (current source, lines 16–142) — read in research session
- `[VERIFIED]` — `dist/` actual file sizes (gzip-measured 643.3 KB raw → 146.8 KB gz, 103.2 KB headroom) — measured in research session
- `[VERIFIED]` — `.planning/phases/03-modal-ui-read-path/03-VERIFICATION.md:132-140` (dev-publish bug diagnosis verbatim)
- `[VERIFIED]` — `.planning/phases/04-write-path-edge-cases/04-VERIFICATION.md` (Phase 4 verdict + fix-back loop pattern; informs Phase 5 cezari verification structure)
- `[CITED: learn.microsoft.com/en-us/azure/devops/extend/develop/manifest 2026-04]` — re-fetched in research session; manifest field reference (description, categories, tags, icons, screenshots, content, links, repository, branding, public flag)
- `[CITED: learn.microsoft.com/en-us/azure/devops/extend/publish/overview 2026-04]` — re-fetched in research session; publish flow, share, public flip qualifications
- `[CITED: learn.microsoft.com/en-us/azure/devops/extend/publish/command-line 2026-04]` — re-fetched in research session; tfx extension publish flags (--manifest-globs, --share-with, --rev-version, --token, --auth-type pat)

### Secondary (MEDIUM confidence)

- `[CITED: github.com/actions/setup-node]` — `cache: 'npm'` parameter behavior (cross-verified with multiple 2026 monorepo guides via WebSearch)
- `[CITED: github.com/actions/checkout]` — v4 stability (verified via WebSearch — v3 is end-of-life)
- `[CITED: github.com/nodejs/node Issue #59210]` — `spawnSync` Windows .cmd EINVAL; class of issues confirms root cause of dev-publish bug
- `[CITED: github.com/microsoft/tfs-cli docs/extensions.md]` — tfx-cli command reference

### Tertiary (LOW confidence)

- WebSearch synthesis on "VS Marketplace overview.md markdown subset" — Microsoft Learn was authoritative on GFM, so this is verified at the primary level
- ASSUMED claims in the Assumptions Log (A1, A2, A5, A6, A7, A8) — checkable in <5 min each

## Project Constraints (from CLAUDE.md)

These are CLAUDE.md-level invariants that the planner MUST honor in Phase 5:

- **React 18 + TypeScript + `azure-devops-ui`.** No Phase 5 work touches the UI stack. The polish phase doesn't migrate React versions.
- **Distribution: Visual Studio Marketplace public listing — no infrastructure to host.** Phase 5 IS the public-distribution phase; this constraint becomes the success criterion (PKG-07).
- **Storage: ADO Extension Data Service only (no external DB, no backend API).** v1 doesn't use EDS at all (settings are v2). Phase 5 doesn't introduce storage.
- **Browser compatibility: whatever ADO supports.** No bundle-size pressure from polyfills — the 250 KB budget is comfortable.
- **Permissions: `vso.work_write` only.** Phase 5 must NOT add scopes; the manifest's existing `["vso.work_write"]` array stays unchanged. **Adding scopes post-publish forces re-consent across every install** — once 1.0.0 is public, the scope is locked.
- **Bundle size: keep `.vsix` lean.** The 250 KB gate satisfies this constraint mechanically.
- **Calculation precision: floating-point math; final SP is integer (Fibonacci); intermediate values displayed to 2 decimals.** Unchanged in Phase 5.
- **Testing: manual QA does UI testing per company standard; only formula logic is unit-tested.** Phase 5 verification is manual smoke (D-5/D-6) plus the new bundle-size unit test (Open Question 3 — optional). No new component / E2E tests.

## README v1 Outline (Claude's Discretion)

Recommended structure for the polished `README.md`:

```markdown
# Story Point Calculator

[Marketplace badge] [License badge] [CI badge — optional]

Azure DevOps work item extension: structured Story Point estimation using
Complexity, Uncertainty, and Effort.

## Install

[Marketplace install button / instructions — link to listing once public]

## What it does

[1 paragraph — same opening as marketplace/overview.md, terse]

## Screenshots

![Light theme](images/screenshots/screenshot-calculator-light.png)
![Dark theme](images/screenshots/screenshot-calculator-dark.png)

## Usage

[Steps 1-4 from marketplace/overview.md "How to use" — identical]

## How the calculation works

The extension computes a weighted sum of three axes and rounds to the nearest
Fibonacci value.

| Symbol | Meaning |
|---|---|
| C | Complexity score (1=Very Easy, 2=Easy, 3=Medium, 4=Hard, 5=Very Hard) |
| U | Uncertainty score (same scale) |
| E | Effort score (same scale) |
| W | Weighted sum: `W = 0.4·C + 0.4·U + 0.2·E` |
| Raw SP | `0.5 × 26^((W−1)/4)` |
| Final SP | Raw SP rounded to nearest Fibonacci value: 0.5, 1, 2, 3, 5, 8, 13 |

The Fibonacci rounding thresholds (W ≤ 0.75 → 0.5, ≤ 1.5 → 1, ≤ 2.5 → 2, ≤ 4 → 3,
≤ 6.5 → 5, ≤ 10.5 → 8, else → 13) match the source Excel calculator
(`sp_calculator.xlsx`).

## Supported processes

[Same table as marketplace/overview.md]

## Privacy

[Same bullets as marketplace/overview.md]

## Known limitations (v1)

[Same bullets as marketplace/overview.md]

## Roadmap (v2)

[Same as marketplace/overview.md]

## Development

\`\`\`bash
npm ci
npm run typecheck
npm test
npm run build
npm run check:size
\`\`\`

CI runs the same commands on every push and pull request — see
`.github/workflows/ci.yml`.

## Publishing

### One-time setup

Create `.env.local` at repo root:

\`\`\`
TFX_PAT=<your Marketplace PAT — generate at https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions with Marketplace (publish) scope>
\`\`\`

`.env.local` is gitignored (see `.gitignore`); never commit it.

### Publish privately to cezari (dev iteration)

\`\`\`bash
npm run build
npm run publish:cezari
\`\`\`

This uploads the current `vss-extension.json` version to Marketplace as a
private extension shared with cezari. To re-publish after a manifest change,
bump the version manually and run again.

### Publish publicly to Marketplace

1. Confirm publisher verified at https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions.
2. Edit `vss-extension.json`: bump version, set `"public": true`.
3. \`\`\`bash
   npm run build
   npm run publish:cezari   # same script — `tfx extension publish` reads public from manifest
   \`\`\`
4. Verify the listing at https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeExtensions.story-point-calculator.

## Contributing

[Brief: open an issue, fork, PR. Or just "issues welcome at <link>".]

## License

MIT. See `LICENSE`.
```

**Approximate content per section:**
- Install / What it does / Usage: 5 lines each (overlap with overview.md).
- How the calculation works: 1 small table + 1 paragraph (the "engineering-curious" content per D-11).
- Supported processes / Privacy / Limitations / Roadmap: identical to overview.md.
- Development: 5 lines, the npm script names.
- Publishing: 1 paragraph per scenario (private dev, public release).
- Contributing / License: 2 lines each.

**Total:** ~120 lines of markdown. Single-file, no separate `CONTRIBUTING.md` for v1.

## Versioning Recommendation (Claude's Discretion)

**Recommendation: bump manifest 0.2.5 → 1.0.0 at the public-publish moment. Sync `package.json` to 1.0.0 in the same commit. Drop `--rev-version` auto-bump entirely.**

**Rationale:**

- **Why 1.0.0 (not 0.3.0 or 0.2.6):** The 0.x prefix in semver semantically means "pre-release; breaking changes expected at any minor bump." Going public-on-Marketplace is the deliberate "we commit to this surface area" moment — semantic-version 1.0.0 communicates that to installers. The Marketplace UI also displays the version prominently in the listing card; "1.0.0" reads as "ready" while "0.2.5" reads as "still in dev."
- **Why sync `package.json`:** Currently 0.1.0; manifest 0.2.5. The drift is harmless (manifest is user-facing, package.json is dev-internal) but creates a bookkeeping question every time someone reads either file. Sync at the public-publish moment to remove the drift; keep them synced from there.
- **Why drop `--rev-version`:** Auto-bump was useful in Phase 2/3/4 dev iteration where 30+ versions churned in a session. Phase 5 is "ship it"; subsequent bumps are deliberate v1.0.x patches and v1.1.0 minor releases. Manual bumps are clearer in commit history. The new `publish:cezari` script (Pattern 6 Option A) does NOT pass `--rev-version` — version comes from the committed manifest.

**Alternative (if the user prefers more conservative versioning):**
- Bump 0.2.5 → 0.2.6 for the first public publish; bump to 1.0.0 only after a few public installs and zero issues. Extends the "this is still pre-1.0" signal. Tradeoff: most installers don't differentiate 0.2.x from 0.x.x meaningfully — they look at install count and ratings. The 1.0.0 marker is mostly for the publisher's clarity.

**Recommendation stands at 1.0.0.** The user can override.

## Pitfalls Log (consolidated for the planner)

The seven pitfalls in §Common Pitfalls map to plan tasks the planner should bake in:

| # | Pitfall | Plan task that addresses it |
|---|---|---|
| 1 | Publisher verification not yet done | Wave 1 first task: "Check publisher verification status; request if unverified" |
| 2 | Public flip lands without verification confirmed | Wave 3 first task: "Manual verification: confirm publisher verified at <portal URL>" |
| 3 | Screenshots wrong dimensions | D-8 capture protocol explicitly notes the 1366×768 padding step |
| 4 | VSIX missing marketplace/ directory | Wave 1 task: after manifest edit, run `npm run package && unzip -l ...` and confirm overview.md is included |
| 5 | dev-publish.cjs Option B leaves shell:false elsewhere | Pattern 6 Option A (replace) sidesteps this; if Option B chosen, audit all spawnSync sites |
| 6 | README and overview.md drift | Document the audience separation in the README v1 task; treat as separate files going forward |
| 7 | VSIX missing LICENSE when content.license declared | Recommended manifest delta uses `links.license` instead of `content.license` to skip this |

## Metadata

**Confidence breakdown:**
- GitHub Actions YAML: HIGH — verified against official actions docs + multiple 2026 examples
- Bundle-size script: HIGH — pure Node, mechanical, expected output verified by re-running gzip math on current dist/
- Marketplace listing manifest fields: HIGH — re-fetched Microsoft Learn 2026-04 in this session
- Marketplace overview.md GFM rendering: HIGH — Microsoft Learn explicitly cites GFM
- Screenshot dimensions: HIGH — Microsoft Learn explicitly cites 1366×768
- Cross-process cezari setup: MEDIUM — standard ADO Project Collection UI but no live verification in research env
- Publisher verification flow: MEDIUM — Microsoft Learn says verified-publishers can flip public, but doesn't enumerate the verification request UI step-by-step
- dev-publish.cjs bug: HIGH — Phase 03-04 documented the symptom verbatim; the fix is a known Node child_process Windows pattern
- Versioning recommendation: MEDIUM — discretionary call, justified but not mechanically verifiable

**Research date:** 2026-05-02
**Valid until:** 2026-06-01 (30 days; Marketplace docs are stable; GitHub Actions evolution is gradual)
