# Phase 5: Polish & Marketplace Publish — Context

**Gathered:** 2026-05-02
**Status:** Closed — v1.0 shipped 2026-05-04; all open questions below resolved during execution (retro-closed at v1.1 milestone close 2026-05-11)

<domain>
## Phase Boundary

**Goal:** Ship a public Marketplace listing that installs cleanly on a fresh ADO trial org and a Contributor (non-admin) user can complete the full open-modal → Apply flow, verified across Scrum, Agile, and CMMI processes.

**Requirements:** PKG-02, PKG-03, PKG-04, PKG-05, PKG-06, PKG-07.

**Success Criteria (from ROADMAP):**

1. The build pipeline produces a `.vsix` via `tfx-cli` with two webpack entries — `dist/toolbar.html` (toolbar shim) and `dist/modal.html` (lazy-loaded modal) — and CI fails the build when total bundle size exceeds 250 KB gzipped.
2. The Marketplace listing has a description, a privacy/data-handling statement (no telemetry; data stays in the user's ADO org), the formula explanation, a 128×128 icon, and screenshots showing the modal in both light and dark themes.
3. A private install on a fresh ADO trial organization (shared via `tfx extension share`, not yet `public:true`) lets a Contributor (non-admin) user complete the full open-modal → Apply flow without permission errors.
4. The extension is published `public:true` on Visual Studio Marketplace under the verified GPIH/TsezariMshvenieradzeExtensions publisher with exactly the `vso.work_write` scope (no scope changes from Phase 0), and an end-to-end install + Apply succeeds on at least two different ADO organizations — one running the Agile process, one running CMMI.

**State at phase start (post-Phase 4):**
- Implementation surface complete; 398/398 vitest tests pass; webpack production build succeeds.
- Manifest version: `0.2.5` (after 4 cezari verification fix-back iterations during Phase 4).
- VSIX 0.2.5 already shared with cezari (Scrum process). Apply path verified end-to-end.
- No CI/CD configured (no `.github/workflows/`, no `azure-pipelines.yml`).
- Existing scripts: `scripts/dev-publish.cjs` (broken on Windows per Phase 4 STATE), `scripts/generate-placeholder-icon.cjs`, `scripts/generate-toolbar-icon.cjs`. Existing assets: `images/icon.png`, `images/toolbar-icon.png`.
</domain>

<decisions>
## Implementation Decisions

### Custom SP field reference name (carry-over from Phase 4 STATE)
- **D-1:** v1 ships with the two stock refs only (`Microsoft.VSTS.Scheduling.StoryPoints` for Scrum/Agile/Basic; `Microsoft.VSTS.Scheduling.Size` for CMMI). Custom SP field name override is **deferred to v2**.
  - **Documentation surface:** README + Marketplace listing description must explicitly note "supports the stock SP fields on Scrum/Agile/Basic/CMMI processes; custom SP field names are on the v2 roadmap."
  - **Backlog item:** Add to v2 backlog — "settings UI for custom SP field ref-name (project-scoped via Extension Data Service)."
  - **Existing UX:** `NoFieldMessage.tsx` (Phase 3 D-19) already handles the missing-field case gracefully — the toolbar button stays enabled, the modal opens with a clear message naming the supported processes + a Close button.

### CI/CD pipeline (PKG-02, PKG-03)
- **D-2:** **GitHub Actions** for CI. Workflow YAML in `.github/workflows/`. Triggers: push + PR. Steps: `npm ci` → `npm run typecheck` → `npm test -- --run` → `npm run build` → bundle size check.
  - Rationale: free for public repos, simplest config, no service-connection setup required.
  - Does **not** auto-publish to Marketplace from CI — publish remains a deliberate manual step (run `tfx extension publish` locally with the PAT in `.env.local`). This keeps the publish gate in human hands and avoids storing the Marketplace PAT in CI secrets.

### 250KB bundle size gate (PKG-03)
- **D-3:** Post-build Node script. After `webpack --mode production`, a small Node script reads each `dist/*.{html,js,css}` file, computes gzipped size via `zlib.gzipSync(fs.readFileSync(...))`, sums totals, prints a per-file + total report.
  - File: `scripts/check-bundle-size.cjs` (new). Wired into `package.json` as `npm run check:size` and called after `build` in the CI workflow + (optionally) as a `postbuild` script locally.
  - Threshold: **250 KB** total gzipped across all entries (`dist/toolbar.{html,js}` + `dist/modal.{html,js}`).
- **D-4:** **Hard fail** when threshold exceeded. Script exits non-zero; CI workflow fails. Per PKG-03 verbatim. Print delta (e.g., "275 KB / 250 KB → exceeds budget by 25 KB") so debugging is fast.

### Cross-process verification (PKG-04, PKG-07)
- **D-5:** **Use cezari with multiple project templates** instead of acquiring two distinct trial orgs.
  - Add an Agile project + CMMI project to cezari (alongside the existing Scrum project used in Phase 4).
  - Verify the modal works on a `User Story` (Agile) and a `Requirement` (CMMI) work item.
  - **Documented deviation from PKG-07's literal "two different ADO organizations" wording.** Phase 5 verifier should mark PKG-07 as **PARTIAL — process coverage met, single-org coverage**. Plan 5 should call this out and offer to escalate to "create a fresh trial org for CMMI" if the verifier flags it as a hard PKG-07 fail.
- **D-6:** **Smoke test only** per process. Per non-Scrum process: open modal → pick a trio → click Apply → verify SP field updates + comment posted in Discussion. Plus the no-op same-value path tested in Phase 4 already validates the c536926 fix-back. Skip the full D-17 8-scenario re-run (already covered by Scrum cezari).
- **D-7:** **Skip the Contributor (non-admin) explicit test.** Trust that the manifest's `vso.work_write` scope is sufficient; if a Contributor has work-item-write permission on the work item type, the SDK + REST calls work as a regular user. **Documented deviation from PKG-04's literal Contributor verification.** Phase 5 verifier should mark PKG-04 as **PARTIAL — install + Apply verified at the calling user's level; Contributor flow unverified**. Risk acceptance: scope is the same regardless of role; if PAT auth works, vso.work_write delegated work-item permissions are the only gate.

### Marketplace listing assets (PKG-05)
- **D-8:** **2 screenshots minimum.** Calculator in light theme + calculator in dark theme. Both show the empty calculator with the three Dropdown3 components (Complexity, Uncertainty, Effort) and the live CalcPanel showing W / Raw SP / Final SP / formula text.
  - Capture on cezari (Scrum project) at the resolved-from-current-trio state for visual richness.
  - Resolution: Marketplace requires ~1280px wide; capture at modal's natural width (~600px) and pad / scale as needed.
  - File location: `images/screenshots/` (new directory). Filenames: `screenshot-calculator-light.png`, `screenshot-calculator-dark.png`.
- **D-9:** **Terse + technical** description tone. Plain explanation of what the calculator does, the three axes (one line each), install + use instructions. No marketing fluff. Matches the project's empirical / engineering posture.
- **D-10:** **Yes — list known limitations publicly** in the Marketplace description as a short bulleted "Known limitations" section:
  1. Esc key does not dismiss the modal — use click-outside or the title-bar X.
  2. No eager read-only probe — read-only state surfaces reactively as a Field-write error.
  3. Custom SP field names not yet supported — works with stock SP fields (Scrum/Agile/Basic) and Size (CMMI). Custom fields are on the v2 roadmap.
  - Builds trust + sets expectations; reduces "doesn't work as I expected" reviews.
- **D-11:** **User-facing formula explanation only.** Describe what each axis means in plain English — Complexity = how hard, Uncertainty = how much we know, Effort = how much work. Show the five level labels per axis. Do **not** include the W / Raw SP math formulas in the listing — those live in the repo README for engineering-curious readers.

### Claude's Discretion
The following implementation choices are flexible — researcher and planner may decide based on best fit:

- **Privacy/data-handling statement wording** (PKG-05 SC #2). Required claim: "no telemetry; data stays in the user's ADO org." Claude picks the exact phrasing — plain English bullet form preferred.
- **Versioning strategy.** Manifest is at 0.2.5. First public Marketplace publish version: planner's call. Recommended approach: bump to **1.0.0** at the public-publish moment; pre-public iterations stay 0.2.x.
- **dev-publish.cjs Windows retry-loop fix.** Phase 4 STATE flagged it as broken on Windows. Either fix the script or replace it with a documented PowerShell one-liner. Planner decides.
- **package.json version sync.** Currently 0.1.0 (out of sync with manifest 0.2.5). Sync at the publish version bump or leave as-is (manifest version is the user-visible one; package.json is internal).
- **Marketplace `categories` and `tags`.** Already declared in vss-extension.json (`Azure Boards`; `story points`, `estimation`, `scrum`, `agile`). Researcher/planner may suggest additions if Marketplace has well-trafficked tags we're missing.
- **README content for v1 release.** Currently minimal. Phase 5 should expand it with: install instructions, screenshots, formula details, known limitations, contribution guide. Planner decides depth.
- **Icon refinement.** Existing `images/icon.png` is a placeholder (per `scripts/generate-placeholder-icon.cjs`). Whether to refine it for the public listing or ship as-is is the planner's call.
- **Carry-over Phase 4 deferred D-17 scenarios** (Scenario 3 offline, Scenario 5 Stakeholder, Scenario 7 slow-3G). Planner picks whether to include them in Phase 5 verification or carry to v2 backlog. Recommendation: carry to v2 — orchestrator code paths are already unit-test-covered.
</decisions>

<specifics>
## Specific Ideas

- **GitHub Actions workflow steps:** `actions/checkout@v4` → `actions/setup-node@v4` (node 20) → `npm ci` → `npm run typecheck` → `npm test -- --run` → `npm run build` → `npm run check:size`. Run on `push` to master + on `pull_request`.
- **Bundle gate output:**
  ```
  Bundle size report:
    dist/toolbar.html       2.1 KB → 0.8 KB gzipped
    dist/toolbar.js        45.3 KB → 14.2 KB gzipped
    dist/modal.html         2.0 KB → 0.7 KB gzipped
    dist/modal.js         624.7 KB → 167.8 KB gzipped
  Total: 674.1 KB raw → 183.5 KB gzipped (budget: 250 KB) ✓
  ```
- **Marketplace listing structure (suggested):**
  ```
  # Story Point Calculator

  Structured Story Point estimation using Complexity, Uncertainty, and Effort.

  ## What it does
  ...

  ## How to use
  1. Open any work item in Azure Boards
  2. Click "Calculate Story Points" in the work item toolbar
  3. Pick a level for each of the three axes
  4. Click Apply — the Story Points field updates and an audit comment is posted

  ## The three axes
  - **Complexity** — how hard the work is (Very Easy → Very Hard)
  - **Uncertainty** — how much we know (Very Easy → Very Hard)
  - **Effort** — how much work to do (Very Easy → Very Hard)

  ## Privacy
  No telemetry. All data stays in your Azure DevOps organization. The extension only writes to the Story Points field and posts a Discussion comment summarizing the calculation.

  ## Known limitations (v1)
  - Esc does not dismiss the modal — click outside or use the title-bar X
  - Read-only state surfaces as a write error (no upfront permission check)
  - Custom Story Point field names are not yet supported (v2 roadmap)

  ## Supported processes
  Scrum (Product Backlog Item, Bug, Task), Agile (User Story, Bug, Task, Feature, Epic), CMMI (Requirement), Basic.
  ```

</specifics>

<deferred>
## Deferred Ideas (Scope Creep Parking)

These came up during discussion but are **not** in Phase 5 scope. They feed the v2 backlog or Phase 5 carry-overs:

- **Custom SP field name override** (D-1) — settings UI for project-scoped ref-name override via Extension Data Service. v2 candidate.
- **Esc-dismisses-modal investigation** — known iframe-focus limitation; click-outside and the host's X button are supported escape paths. Workaround documented in D-10. v2 if a `window.parent.postMessage` or host-bound `keydown` forwarding hook proves viable.
- **Auto-publish from CI** (D-2 deviation) — publishing from GitHub Actions to Marketplace would require storing the PAT in CI secrets. Phase 5 keeps publish manual. v2 candidate if release cadence increases.
- **Cross-org verification with two distinct trial orgs** (D-5 deviation) — PKG-07 literal wording. v2 may revisit if the verifier flags it as a hard fail.
- **Contributor non-admin explicit verification** (D-7 deviation) — PKG-04 literal wording. v2 may revisit if the verifier flags it as a hard fail.
- **Reopen-pre-fill from sentinel comment** — permanently deferred per Phase 4 spike A1 STRIPPED-FALLBACK; pre-fill from current SP via Phase 3 read path remains. Will not be revisited unless the requirement re-emerges.
- **Eager read-only probe** — permanently deferred per Phase 4 spike A3 LAZY-FALLBACK-ONLY; reactive D-07 path is the ship state.
- **D-17 Scenario 3 (offline simulation), Scenario 5 (Stakeholder license), Scenario 7 (slow-3G overlay)** — deferred from Phase 4 (verifier marked PARTIAL with unit-test coverage as backstop). Planner decides whether to fold into Phase 5 verification or punt to v2 (recommendation: punt).
</deferred>

<resolved_questions>
## Questions Resolved During Execution

All open questions from this CONTEXT were answered during Phase 5 execution (and re-confirmed by the v1.1 Auto-Publish work). Recorded here for the record:

1. ~~**GitHub Actions runner choice.**~~ RESOLVED — `ubuntu-latest` is sufficient; the webpack output has no Windows-specific paths. Confirmed by every green `ci.yml` run and, later, by `publish.yml` packaging + publishing the `.vsix` on `ubuntu-latest` (runs through v1.0.10).
2. ~~**Bundle size budget feasibility.**~~ RESOLVED — production bundle is ~148 KB gzipped (≈102 KB headroom under the 250 KB gate). No code-splitting needed. `scripts/check-bundle-size.cjs` enforces it in CI.
3. ~~**Marketplace listing markdown support.**~~ RESOLVED — the listing renders headings, bullets, links, and bold/italic; the `overview.md` ships with that subset. Confirmed by the live public listing.
4. ~~**Existing icon quality.**~~ RESOLVED — `images/icon.png` ships as the listing icon; `images/toolbar-icon.png` (16×16 PNG; SVG was rejected by Marketplace, commit 881efc6) is the toolbar icon. Shipped as-is for v1; refinement is a v1.x cosmetic backlog item if ever needed.
5. ~~**package.json version drift policy.**~~ RESOLVED — versions are kept in sync; the first public publish was v1.0.0 and `scripts/bump-version.mjs` (v1.1) now does an atomic two-file bump of `package.json` + `vss-extension.json` on every release.
6. ~~**dev-publish.cjs Windows retry-loop bug.**~~ RESOLVED — superseded; manual `dev-publish.cjs` / `publish-cezari.cjs` are archived to `scripts/.archive/` and the canonical publish path is the `publish.yml` GitHub Action (release-branch model). The manual emergency-publish runbook lives in `.planning/OPERATIONS.md` §2.
</resolved_questions>
