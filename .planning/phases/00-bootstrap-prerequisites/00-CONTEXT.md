# Phase 0: Bootstrap & Prerequisites - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove every external blocker before code is written so Phase 1 can start clean.

In scope:
- Pin npm versions for the four critical packages (`azure-devops-extension-sdk`, `azure-devops-extension-api`, `azure-devops-ui`, `tfx-cli`) via `npm view` lookups
- Verify Tsezari Marketplace publisher account access (already exists)
- Confirm dev ADO org access (`cezari.visualstudio.com/Cezari` — already exists)
- Scaffold the repo: `package.json`, `tsconfig.json`, `vitest.config.ts`, `webpack.config.{toolbar,modal}.cjs`, `vss-extension.json` skeleton, `.gitignore`, `LICENSE` (MIT)
- Lock the manifest scope to exactly `vso.work_write` and declare the toolbar action and modal external-content contribution stubs (no implementation)
- Document the write atomicity ordering decision (comment-first → field-write) in PROJECT.md Key Decisions
- A fresh-clone smoke loop: `npm ci && npm run typecheck && npm test` exits 0 with a placeholder test

Out of scope (later phases own these):
- Calc engine and audit-comment parser (Phase 1)
- Toolbar/modal HTML implementation beyond a placeholder entry file (Phase 2)
- React UI, FieldResolver, ADO bridge (Phases 3–4)
- CI bundle-size gate, Marketplace listing assets, public publish (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Atomicity Ordering (lives in PROJECT.md Key Decisions per success criterion 4)
- **D-01:** **Comment-first → field-write.** On Apply, first POST the audit comment via `WorkItemTrackingRestClient.addComment()`. Only after the comment succeeds, perform `IWorkItemFormService.setFieldValue()` + `.save()`.
- **D-02:** **Rationale:** The audit comment is the canonical source of truth for "this calculation was performed by intent X." A successful comment + failed field write is recoverable: the user reopens the modal, the parser pre-fills from the comment, the user retries. A successful field write + failed comment leaves the SP value with no provenance and breaks the pre-fill loop. Comment failures are also more visible (REST POST → toast) than silent field-state inconsistencies.
- **D-03:** **Retry behavior on partial failure:** Always post a new comment on every Apply (no de-dup, no edit). The parser already takes the most recent sentinel; multiple retry comments are an audit feature, not a bug. This avoids a comparison/edit code path.
- **D-04:** **Failure modes (downstream Phase 4 implements):**
  - Comment POST fails → toast with REST error code; field is NOT written; modal stays open with selections preserved so user can retry.
  - Comment POST succeeds, field write fails → toast indicates "calculation recorded but field write failed; please retry"; modal stays open. Next Apply re-posts the comment (acceptable per D-03) and re-attempts the field write.

### Repo Layout
- **D-05:** **Flat `src/` with subfolders.** Single `package.json`, single `tsconfig.json` with `strict: true`, single `vitest.config.ts`. Layout:
  ```
  src/
    calc/         # pure calc engine (Phase 1)
    audit/        # pure sentinel-format serializer/parser (Phase 1)
    field/        # FieldResolver (Phase 3)
    ado/          # ADO bridge (Phases 3-4) — wraps SDK + REST clients
    ui/           # React components (Phases 2-4)
    entries/
      toolbar.tsx # webpack entry — registers toolbar action contribution
      modal.tsx   # webpack entry — renders modal in dialog iframe
  tests/          # mirrors src/ for test colocation
  ```
- **D-06:** Webpack uses two entry HTML files via `html-webpack-plugin`: `dist/toolbar.html` and `dist/modal.html`. The toolbar entry is the lightweight shim (registers the action handler and calls `openCustomDialog`); the modal entry is the heavier React app and lazy-loads `azure-devops-ui` components.
- **D-07:** Reject npm workspaces / TypeScript project references for v1. Single-package layout is the lowest-friction path; can be extracted later if libs become reusable.

### Extension Identity (one-way decisions — locked before any publish)
- **D-08:** **Marketplace publisher:** `TsezariMshvenieradzeExtensions` (already verified at https://marketplace.visualstudio.com/manage/publishers/tsezarimshvenieradzeextensions). Personal publisher, not GPIH-branded. No internal review chain to gate publishes.
- **D-09:** **Extension ID:** `story-point-calculator`. Public Marketplace URL on publish: `https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeExtensions.story-point-calculator`.
- **D-10:** **Display name:** `Story Point Calculator` (Marketplace tile title).
- **D-11:** **License:** **MIT.** Add `LICENSE` file at repo root in Phase 0 with current year and the publisher's name. Permissive, broadly understood, marketplace-standard for community extensions.
- **D-12:** **Versioning:** Start at `0.1.0` in `package.json` and `vss-extension.json`. Stay in `0.x` until first public publish, which bumps to `1.0.0`.

### Dev Environment
- **D-13:** **Dev ADO org for Phase 2 manifest testing:** `https://cezari.visualstudio.com/Cezari` (already exists). The dev `.vsix` is published privately to this org via `tfx extension publish --share-with cezari` for iteration.
- **D-14:** **Phase 5 final smoke test orgs:** Same dev org (`cezari`) for default Agile process, plus a freshly-spun trial ADO org configured with the CMMI process to verify FieldResolver's `Microsoft.VSTS.Scheduling.Size` fallback. The trial org for CMMI is created in Phase 5, not Phase 0.

### Phase 0 Scope Boundaries (clarifications surfaced during discussion)
- **D-15:** No CI/CD pipeline in Phase 0. The bundle-size gate, GitHub Actions / Azure Pipelines wiring, and the publish stage all live in Phase 5. Phase 0 only requires that the local commands `npm ci && npm run typecheck && npm test` exit 0 from a fresh clone.
- **D-16:** No README beyond a placeholder in Phase 0. The marketplace-quality README with screenshots, formula explanation, and privacy statement is a Phase 5 deliverable (PKG-05).

### Claude's Discretion
- Exact file naming under `src/calc/`, `src/audit/` (e.g., `index.ts` vs named files) — planner decides per Phase 1 plan.
- Exact webpack config split (single config with multiple entries vs two configs) — planner decides; either works given D-06.
- `tsconfig.json` strictness flags beyond `strict: true` (e.g., `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) — planner decides; lean toward the strictest reasonable defaults given the calc engine is heavily numeric.
- `.gitignore` contents — standard Node/TypeScript template + `dist/` + `*.vsix` + `.tfx-cache/`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value, requirements (v1 + v2), constraints, key decisions. Note: contribution IDs and atomicity decision were updated post-research; commit `97256e9`.
- `.planning/REQUIREMENTS.md` §Pkg — PKG-01 (this phase's only requirement). Manifest must have exactly `vso.work_write` scope, declare both contributions, include 128×128 icon.
- `.planning/ROADMAP.md` §Phase 0 — Goal and 5 success criteria that gate phase completion.

### Research (Microsoft Learn-grounded)
- `.planning/research/SUMMARY.md` §Stack — Pinned-floor versions for `azure-devops-extension-sdk@^4`, `azure-devops-extension-api@^4`, `azure-devops-ui@^2`, `tfx-cli@^0.21`. **Phase 0 must run `npm view` to confirm/upgrade these floors before pinning.**
- `.planning/research/SUMMARY.md` §Architecture Highlights — Manifest contribution shape (`ms.vss-web.action` + `ms.vss-web.external-content`); `vss-extension.json` snippet to copy.
- `.planning/research/SUMMARY.md` §"PROJECT.md Corrections Required" — Six corrections that the manifest skeleton must reflect.
- `.planning/research/SUMMARY.md` §"Open Conflicts" — The atomicity decision context (now resolved by D-01–D-04 above).
- `.planning/research/STACK.md` — Manifest schema for the toolbar action contribution; CI/CD task pack (`ms-devlabs`) reference for Phase 5 (not Phase 0).
- `.planning/research/PITFALLS.md` Pitfall 3 — Why scope must be locked at `vso.work_write` before first publish. Pitfall 14 — Why versions must be pinned (no `^`).
- `.planning/research/ARCHITECTURE.md` — Iframe sandbox model; SDK init lifecycle; `HostPageLayoutService.openCustomDialog` usage.

### External (verified Microsoft Learn 2026-04 per architecture research)
- Microsoft Learn: Extension manifest reference — `vss-extension.json` schema.
- Microsoft Learn: Extensibility points reference — contribution targets.
- Microsoft Learn: Data and setting storage — Extension Data Service scopes (relevant to v2, not Phase 0).
- `microsoft/azure-devops-extension-sample` GitHub repo — webpack multi-entry pattern; `tfx-cli` invocation.

### Calculation source of truth
- `sp_calculator.xlsx` (repo root) — Phase 1's reference; not directly used in Phase 0, but the manifest skeleton's display copy ("Story Points calculator") references the formula.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No prior `src/`, no prior `node_modules/`, no prior config files.

### Established Patterns
- None in repo. Patterns to follow come from `microsoft/azure-devops-extension-sample` (webpack multi-entry, manifest schema) and the research synthesis (SDK init lifecycle, contribution shape).

### Integration Points
- Phase 0 has no runtime integration with ADO yet — the manifest skeleton is a wire-up artifact only. The first real ADO surface contact is Phase 2.
- Phase 0's `package.json` and `tsconfig.json` are consumed by every subsequent phase. Settings like `strict: true`, `target`, `module`, `moduleResolution` flow into Phase 1's pure modules and Phase 2's webpack entries.

</code_context>

<specifics>
## Specific Ideas

- Publisher slug is the registered string `TsezariMshvenieradzeExtensions` (case-sensitive in the manifest's `publisher` field, per Marketplace canonicalization).
- Dev ADO org URL uses the legacy `*.visualstudio.com` form (`cezari.visualstudio.com/Cezari`) rather than `dev.azure.com/cezari/Cezari`. Both resolve to the same collection. Use whichever form the SDK and `tfx-cli` accept without translation; prefer `dev.azure.com/cezari` in scripts since that's the modern URL.
- License year for `LICENSE` is `2026` (current year) and copyright holder is the publisher's display name (chosen at publish time; for now `Tsezari Mshvenieradze`).

</specifics>

<deferred>
## Deferred Ideas

- **CI/CD pipeline (Azure Pipelines or GitHub Actions)** — Phase 5 owns this. Phase 0 ships the local fresh-clone smoke loop only.
- **Bundle-size gate** — Phase 5 (PKG-03). Phase 0 doesn't measure bundle size.
- **Telemetry / analytics** — Out of scope for v1 entirely (REQUIREMENTS.md Out of Scope).
- **Localization manifest fields** — English-only listing. If post-launch we add a second locale, that's a new milestone, not Phase 0 scaffolding.
- **Extracting `calc-engine` and `audit-comment` as standalone npm packages** — Possible in v2+ if reuse emerges; rejected for v1 in D-07.
- **Custom-process SP field rename support** — Out of scope per PROJECT.md Out of Scope; FieldResolver covers Agile/Scrum/Basic + CMMI only.

</deferred>

---

*Phase: 0-Bootstrap & Prerequisites*
*Context gathered: 2026-05-01*
