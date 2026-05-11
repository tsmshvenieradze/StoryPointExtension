# Story Point Calculator

[![CI](https://github.com/tsmshvenieradze/StoryPointExtension/actions/workflows/ci.yml/badge.svg)](https://github.com/tsmshvenieradze/StoryPointExtension/actions/workflows/ci.yml)

Azure DevOps work item extension for structured Story Point estimation. Replaces free-form guessing with a reproducible 30-second calculation across three axes — **Complexity**, **Uncertainty**, **Effort** — and writes the result to the work item's Story Points field with an audit comment.

Works on Scrum, Agile, Basic, and CMMI processes. Single scope: `vso.work_write`. No telemetry; data stays in your Azure DevOps organization.

## Install
 
Public listing on the Visual Studio Marketplace:

> **[marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator](https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator)**

Click **Get it free**, choose your Azure DevOps organization, install. The toolbar entry "Calculate Story Points" appears on every work item that has a Story Points (or Size) field.

## Use

1. Open any work item in Azure Boards (Product Backlog Item, User Story, Bug, Task, Feature, Epic, Requirement).
2. Click **Calculate Story Points** in the work item toolbar.
3. Pick a level for each axis: **Complexity**, **Uncertainty**, **Effort** (Very Easy → Very Hard).
4. Click **Apply**. The Story Points field updates and an audit comment is posted to the Discussion thread.

If the work item already has a Story Points value, the modal opens with the previous estimate pre-loaded so you can refine it. A confirmation panel asks before overwriting.

## The formula

The calculator is a faithful port of an internal Excel-based estimator. The three axes each map to a numeric score:

| Level     | Score |
|-----------|-------|
| Very Easy | 1     |
| Easy      | 2     |
| Medium    | 3     |
| Hard      | 4     |
| Very Hard | 5     |

A weighted sum **W** is computed:

> **W = 0.4 · C + 0.4 · U + 0.2 · E**

where C, U, E are the scores for Complexity, Uncertainty, Effort.

Then a continuous Story Points value is computed:

> **Raw SP = 0.5 × 26<sup>(W − 1) / 4</sup>**

Finally, Raw SP is rounded to the nearest Fibonacci bucket using these thresholds:

| Raw SP ≤ | Final SP |
|----------|----------|
| 0.75     | 0.5      |
| 1.5      | 1        |
| 2.5      | 2        |
| 4.0      | 3        |
| 6.5      | 5        |
| 10.5     | 8        |
| > 10.5   | 13       |

Fully unit-tested across all 125 trio combinations + boundary tests against the original Excel source of truth. See [`src/calc/`](src/calc/) and [`tests/calc/`](tests/calc/).

## Supported processes

| Process | Story Points field reference name |
|---------|-----------------------------------|
| Scrum   | `Microsoft.VSTS.Scheduling.StoryPoints` |
| Agile   | `Microsoft.VSTS.Scheduling.StoryPoints` |
| Basic   | `Microsoft.VSTS.Scheduling.StoryPoints` |
| CMMI    | `Microsoft.VSTS.Scheduling.Size`        |

If your organization has replaced the inherited field with a custom Story Points field (different reference name), the calculator currently shows a "no Story Points field found" message. Custom field name override is on the v2 roadmap.

## Privacy

No telemetry. The extension reads the current Story Points field value and the work item's Discussion thread, then writes the new value (via `setFieldValue`) and one audit comment (via the standard Azure DevOps `addComment` REST endpoint). Nothing leaves your organization.

## Known limitations (v1)

- **Esc does not dismiss the modal.** Use click-outside or the title-bar X to close. (Iframe focus traps Esc; the Azure DevOps SDK has no programmatic close hook from the dialog iframe.)
- **Read-only state surfaces as a write error**, not as an upfront block. If the user lacks write permission, the modal opens normally; clicking Apply produces a clear error banner. (No reliable upfront permission probe is available from the dialog iframe.)
- **Custom Story Point field names not supported in v1.** The calculator uses the stock `Microsoft.VSTS.Scheduling.StoryPoints` (Scrum/Agile/Basic) and `Microsoft.VSTS.Scheduling.Size` (CMMI) refs only.
- **Audit comment is human-readable only.** No machine-parseable round-trip — Azure DevOps storage strips HTML-comment carriers (verified empirically). Reopen-pre-fill of the calculator uses the field's current value, not the previous comment.

## Development

```bash
npm ci
npm run typecheck
npm test          # 398 vitest tests
npm run build     # webpack production
npm run check:size # 250 KB gzipped budget gate
```

## Publishing

Publishing to the Marketplace is automated (v1.1, GitHub Actions). Feature PRs merge to `master` (fully protected); a maintainer then opens a **`master → release` promotion PR** — merging it pushes to the long-lived `release` branch, which fires [`.github/workflows/publish.yml`](.github/workflows/publish.yml): pre-flight gates (typecheck / `vitest run` / webpack production build / 250 KB gzipped budget) → `scripts/bump-version.mjs` (atomic patch bump) → `tfx extension create` + upload-artifact → `tfx extension publish` (using the `TFX_PAT` repo secret) → the `story-point-release-bot` GitHub App commits `chore(release): vX.Y.Z [skip ci]` back to `release` → annotated tag → a `release → master` back-merge PR the maintainer merges via the Web UI. Every promotion ships a new patch automatically; `master` stays fully protected.

Operations runbook — Marketplace PAT rotation, the manual emergency-publish path, the release-branch model, ruleset configuration, partial-failure recovery, and the Option B reversibility exercise — is in [`.planning/OPERATIONS.md`](.planning/OPERATIONS.md). The legacy `scripts/publish-cezari.cjs` helper is retained for reference only at [`scripts/.archive/publish-cezari.cjs`](scripts/.archive/publish-cezari.cjs) (no longer wired to any npm script).

## Project structure

```
src/
  apply/        # apply orchestrator + error message mapper
  ado/          # ADO bridge (form service wrappers + adoFetch + comments + postComment)
  audit/        # audit comment serialize/parse
  calc/         # pure calc engine (fibonacci, levels, weighted sum)
  entries/      # webpack entry points (toolbar.tsx, modal.tsx)
  ui/           # React UI components

tests/
  apply/  ado/  audit/  calc/   # vitest unit tests (398 total)

scripts/
  bump-version.mjs        # atomic patch bump of package.json + vss-extension.json (used by publish.yml)
  check-bundle-size.cjs   # post-build 250 KB gzipped gate
  .archive/
    publish-cezari.cjs    # ARCHIVED — legacy manual tfx publish wrapper; superseded by publish.yml

.planning/                # GSD workflow artifacts (phases, requirements, decisions, OPERATIONS.md)

.github/workflows/
  ci.yml                  # PR gate: typecheck + test + build + size gate (on PRs to master & release)
  publish.yml             # release-branch auto-publish to the Marketplace

vss-extension.json        # Azure DevOps extension manifest
webpack.config.cjs        # bundler config (toolbar + modal HTML entries)
```

## License

[MIT](LICENSE)
