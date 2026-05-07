# Phase 6: Workflow Scaffold & Pre-flight Gates — Context

**Gathered:** 2026-05-05
**Updated:** 2026-05-07 — Wave 1 retrospective refinements to D-5 (tri-state probe semantics, durable artifact location, probe-disagreement rule). Wave 1 (06-01 + 06-02) shipped; Wave 2 (06-03) pending live PR merges.
**Status:** Wave 1 complete; Wave 2 pending live verification

<domain>
## Phase Boundary

**Goal:** End-to-end CI plumbing for auto-publish is in place — gates and triggers verified — but no Marketplace state changes yet.

**Requirements:** CI-01 through CI-08, GATE-01 through GATE-07, FAIL-01 through FAIL-03 (18 reqs).

**Success Criteria (from ROADMAP):**

1. Pushing a feature branch and opening a PR triggers `ci.yml` (gates run); the same PR push does NOT trigger `publish.yml`.
2. Merging a PR to master triggers `publish.yml` (gates re-run on master tip) and does NOT trigger `ci.yml` (the `push: [master]` line is gone).
3. A docs-only commit (touching only `**.md`, `.planning/**`, `.claude/**`, or `docs/**`) merged to master is filtered by `paths-ignore` and does NOT start `publish.yml`.
4. Forcing any one gate to fail (typecheck / vitest / build / `check:size`) leaves the workflow red at the failed step, and the dry-run final step does NOT execute (gate ordering verified).
5. The successful end-of-workflow dry-run step echoes the would-be next version (e.g. `would publish v1.0.8`) without invoking `tfx`, leaving Marketplace untouched at v1.0.7.
6. The `TFX_PAT` repo secret resolves in the workflow (`echo "${{ secrets.TFX_PAT != '' }}"` returns `true`); a `gh api repos/:owner/:repo/branches/master/protection` call confirms current branch-protection state and the result is recorded for Phase 7.

**State at phase start (post-v1.0 close):**
- v1.0.7 live on Marketplace; manifest version 1.0.7; publisher `TsezariMshvenieradzeTfsAiReviewTask`.
- Existing CI: `.github/workflows/ci.yml` runs `npm ci → typecheck → test → build → check:size` on `push:[master]` AND `pull_request:[master]`. Uses `actions/checkout@v4` and `actions/setup-node@v4` (Node 20 + npm cache). Concurrency `ci-${{ github.ref }}`, cancel-in-progress: true.
- Manual publish path lives in `scripts/publish-cezari.cjs` (loads `TFX_PAT` from `.env.local`, calls `tfx extension publish --token ...`). Wired into package.json as `publish:cezari` and `publish:public` (legacy npm scripts; removal scheduled for Phase 8 AFTER first green auto-publish).
- `scripts/check-bundle-size.cjs` exists (gzip total of `dist/*.{html,js,css}`, 250 KB ceiling). Wired as `npm run check:size`.
- 398/398 vitest passing; bundle 147.9 KB / 250 KB gzipped.
- Branch: `milestone1.1` (renamed from typo `milelstone1.1` during /gsd-new-milestone).
- master branch protection: UNKNOWN — no protection visible from commit history but explicit `gh api` check pending in this phase's plan.
</domain>

<canonical_refs>
## Canonical Refs (downstream agents MUST read these)

- [.planning/ROADMAP.md](../../ROADMAP.md) — Phase 6 row, success criteria
- [.planning/REQUIREMENTS.md](../../REQUIREMENTS.md) — CI-01..08, GATE-01..07, FAIL-01..03 verbatim
- [.planning/research/SUMMARY.md](../../research/SUMMARY.md) — reconciled stack + flow + pitfalls
- [.planning/research/STACK.md](../../research/STACK.md) — pinned action versions + Marketplace PAT scope
- [.planning/research/ARCHITECTURE.md](../../research/ARCHITECTURE.md) — single-job sequential structure, Option B state-flow
- [.planning/research/PITFALLS.md](../../research/PITFALLS.md) — 14 pitfalls (loop guards, concurrency, listing-asset preservation, permissions, etc.)
- [.planning/research/FEATURES.md](../../research/FEATURES.md) — table-stakes vs deferred vs anti-features
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — existing CI; CI-02 modifies its `on:` block
- [scripts/check-bundle-size.cjs](../../../scripts/check-bundle-size.cjs) — reused verbatim for GATE-05
- [scripts/publish-cezari.cjs](../../../scripts/publish-cezari.cjs) — local manual publish (TFX_PAT contract); intentionally NOT modified in P6
- [vss-extension.json](../../../vss-extension.json) — `files[]` source of truth for GATE-07 asset audit
- [package.json](../../../package.json) — npm scripts referenced by gates: `typecheck`, `test`, `build`, `check:size`
</canonical_refs>

<code_context>
## Existing Assets to Reuse

- **`.github/workflows/ci.yml`** — modify the `on:` block to remove `push:` (PR-only); leave existing concurrency, runner, and step structure as-is.
- **`scripts/check-bundle-size.cjs`** — reused verbatim for GATE-05; no changes.
- **npm scripts** in package.json: `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `build` (`webpack --mode production`), `check:size` (`node scripts/check-bundle-size.cjs`). All present, all wired into existing CI; publish.yml just calls them.
- **`scripts/publish-cezari.cjs`** — read-only reference for the canonical `tfx extension publish` invocation flag set (preserved for OPERATIONS.md capture in P8 BEFORE archival; also informs the dry-run echo wording).

## New Files to Create (in this phase)

- `.github/workflows/publish.yml` — the new workflow file (single job, sequential steps 1–7 + dry-run echo final step).

## Files Modified (in this phase)

- `.github/workflows/ci.yml` — drop `push: [master]` from `on:` block; nothing else changes.
- `vss-extension.json` and `package.json` — UNCHANGED in P6 (bump-version script and the auto-mutation it drives are P7 work).

## Files NOT Touched in P6

- `scripts/publish-cezari.cjs` and the `publish:cezari` / `publish:public` npm scripts — archival is P8 cleanup, AFTER P7's first green auto-publish.
- `scripts/bump-version.mjs` — created in P7.
- `.planning/OPERATIONS.md` — written in P8.
- `src/**`, `tests/**`, `webpack.config.cjs`, `tsconfig.json`, `vitest.config.ts` — all unchanged.
</code_context>

<decisions>
## Implementation Decisions

### Pre-flight verification strategy (success criteria 1–6)

- **D-1: Verification approach = force-merge a no-op PR to master + watch `publish.yml` stop at the dry-run echo step.** End-to-end live test on the real master branch. The dry-run final step echoes `would publish v1.0.8` instead of calling tfx; nothing reaches Marketplace. Catches secret-resolution bugs and trigger-config typos that pure YAML inspection would miss. ~5 min real wall-clock per round.
  - Rejected: trust YAML inspection + actionlint only (cheaper but risks finding plumbing bugs only at P7's first real publish).
  - Rejected: `nektos/act` local runner (doesn't exercise GitHub-side context — secrets, GITHUB_TOKEN, runner image — and adds a dependency).

- **D-1a: No-op test = trivial whitespace edit on `README.md`.** `README.md` matches the `**.md` paths-ignore pattern, so this exercises the **negative case** (filter works → publish.yml is skipped). Useful for confirming `paths-ignore` is wired correctly.
  - **Companion positive-case test (planner must include both):** a separate trivial code-side edit (e.g., a comment in a non-critical `.ts` file or a single space in `webpack.config.cjs`) merged to master to confirm the **positive case** — publish.yml fires, gates run, dry-run echoes the next version. Without this companion test, P6 only proves the skip path works; the run path is untested until P7's first real publish (defeating P6's safety-net purpose).

### TFX_PAT secret (CI / GATE / PUBLISH overlap)

- **D-2: `TFX_PAT` is already a GitHub repo secret** (created by user out-of-band; matches the local `.env.local` env var name used by `scripts/publish-cezari.cjs`). No phase-task action required to create it.
  - Phase 6 verification still includes `${{ secrets.TFX_PAT != '' }}` resolves to `true` in a step output (success criterion #6) — confirms the secret is reachable from publish.yml at runtime.
  - The local `.env.local` workflow remains unchanged: `publish-cezari.cjs` continues to read `TFX_PAT` from `.env.local`. The GitHub Secret and the local file are two separate stores of the same logical value (rotation procedure for both lives in OPERATIONS.md, P8).

### Workflow file documentation depth

- **D-3: Workflow rationale lives in OPERATIONS.md (P8); `publish.yml` stays lean.** Step `name:` fields name what each step does; no inline block comments explaining Option B / loop guards / branch-protection contingency. OPERATIONS.md (P8) carries all rationale as the canonical runbook.
  - Rejected: top-of-file YAML comment block (~20 lines) — adds duplication maintenance and OPERATIONS.md is the better single-source for design rationale.
  - Rejected: both inline AND OPERATIONS.md (over-engineered for a 3-phase milestone).

### Action version pinning

- **D-4: `publish.yml` uses recommended pins; leave `ci.yml` at @v4.**
  - publish.yml: `actions/checkout@v5`, `actions/setup-node@v4` (Node 20 + cache npm), `actions/upload-artifact@v4`, `stefanzweifel/git-auto-commit-action@v6`.
  - ci.yml: untouched — keeps `actions/checkout@v4` and `actions/setup-node@v4`. v5 of checkout offers better `fetch-depth` + `persist-credentials` defaults that publish.yml needs for the eventual P7 commit-back; ci.yml has no commit-back so the upgrade buys nothing.
  - Pin-drift between the two workflows is acceptable for one quality-of-life milestone; future milestone can sync if it becomes annoying.

### Branch-protection probe

- **D-5 (revised 2026-05-07): The branch-protection probe is two-layered — a best-effort workflow probe in publish.yml (for in-flight visibility) and an authoritative developer-side probe in 06-03 Task 3 (the source of truth P7 consumes).**
  - **Workflow probe (publish.yml step `Probe master branch protection`):** runs `gh api repos/${{ github.repository }}/branches/master/protection` with `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. Outputs a tri-state: `protected` (HTTP 200), `not_protected` (404 with body matching `Branch not protected`), `unknown` (any other non-zero exit — typically 401/403 from token-scope limits). The probe cannot be made definitive at workflow level: the protection endpoint requires repo-admin scope, and `GITHUB_TOKEN` cannot be granted that scope via the workflow `permissions:` block — there is no `administration:` key (verified via IDE diagnostic on PR #2; commit 8e1d65f). The earlier binary `protected` vs `not_protected` shape was a misclassification — it collapsed auth errors into "not protected" and would have let P7 use `GITHUB_TOKEN` against a protected branch.
  - **Developer probe (06-03 Task 3):** local `gh api` invocation by an admin user, producing `.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md` as a durable phase artifact. This is the artifact P7's planner reads.
  - Determines whether P7's commit-back can use default `GITHUB_TOKEN` (NOT PROTECTED — current assumption) or must escalate to a GitHub App / `RELEASE_PAT` with bypass (PROTECTED).

- **D-5a: P7 reads `branch-protection-probe-result.md` — NOT CONTEXT.md or the workflow step summary alone — as the authoritative source for the commit-back token decision.** The workflow step's `$GITHUB_STEP_SUMMARY` is in-flight visibility for the human watching Actions; the durable artifact is the single source of truth for cross-phase consumption. Reconciles ROADMAP SC #6's older "recorded in CONTEXT" wording: the actual durable record lives in the phase-directory artifact, not embedded in CONTEXT.md.
  - **Unknown handling:** if the workflow probe outputs `unknown`, P7 ignores it entirely and reads only the developer artifact. The artifact's `**State:**` field is always definitive (PROTECTED or NOT PROTECTED) by Task 3 construction — Task 3 runs `gh api` with admin scope, which cannot return `unknown` for scope reasons.

- **D-5b: If the workflow probe and the developer probe disagree, the developer probe wins. Task 3 records BOTH values, flags the divergence in the artifact, and uses the developer State for the `Implication for Phase 7` paragraph. Task 3 does NOT fail on disagreement.**
  - Rationale: the developer probe is admin-scoped and runs against the same endpoint with definitive auth; the workflow probe is best-effort and the only outcomes it can disagree on are `unknown` (token-scope) vs `not_protected`/`protected` (admin-scope). The dev probe's signal is strictly more informative.
  - Artifact shape: when divergence occurs, add a `## Probe divergence` section above `## Raw API response` listing both values with a one-line explanation. Example: "Workflow probe: `unknown` (HTTP 401 — `GITHUB_TOKEN` lacks admin scope, expected). Developer probe: `not_protected` (HTTP 404). Resolution: developer probe wins per CONTEXT D-5b."

### Filter content (CI-03)

- **D-6: `paths-ignore` filter for publish.yml = `**.md`, `.planning/**`, `.claude/**`, `docs/**`.** As recommended by SUMMARY. Note: `paths-ignore` only suppresses runs when ALL changed files match — a code+docs commit still ships. This is intentional behavior, not a hole. Documented in OPERATIONS.md (P8).

### Dry-run final step shape

- **D-7: Dry-run final step echoes a single line `would publish v<NEXT_VERSION>`** (where `<NEXT_VERSION>` is the patch+1 of `package.json` `.version`). NO `tfx` invocation. NO file write. NO upload-artifact. Plan-phase decides whether to also set a step output (`echo "next-version=v$NEXT" >> $GITHUB_OUTPUT`) for downstream-step composability — that's a Claude-discretion call.

### Asset audit (GATE-07)

- **D-8: Implementation = inline `jq` in YAML** as the first preference. If the script grows past ~10 lines or needs anything beyond existence checks, fall back to `scripts/audit-assets.mjs` (planner's call). The check itself is minimum viable: each entry in `vss-extension.json` `files[].path` must exist on disk; failure prints the missing path and exits non-zero.
  - Out of scope for P6: file-size checks, extension-format checks, localized-variant warnings (those are GATE-07 scope-creep risks called out in CONTEXT for the planner).

### Failure surface (FAIL category)

- **D-9: FAIL-01/02/03 baked into publish.yml YAML at scaffold time.** No retry directives, no `continue-on-error: true` on any gate step (only allowed on the P7 tag step per TAG-04 — irrelevant in P6). `workflow_dispatch:` present in the `on:` block. No notification step (no Slack/Teams/Discord/email-beyond-default).

### Claude's Discretion

These implementation details are for the planner/researcher to decide based on best fit — not blocked by user input:

- Exact `name:` strings for each YAML step (e.g., "Typecheck" vs "TypeScript check" vs "tsc"). Match the existing ci.yml step names where possible for consistency; new steps (asset audit, dry-run echo) get descriptive names.
- Whether the dry-run echo step also emits a GitHub Actions output (`steps.echo.outputs.next-version`) for traceability in the Actions UI summary.
- `timeout-minutes:` value on the publish job (existing ci.yml uses 10; planner can pick 10 or 15 — extra headroom for upload-artifact + future publish step in P7).
- Whether the asset-audit step is extracted to `scripts/audit-assets.mjs` or stays inline `jq`/shell. Inline is preferred if ≤10 lines; script if more.
- Order of pre-flight gates: typecheck → tests → build → check:size → asset-audit, OR build first → asset-audit → tests. Either is fine (build is fast and tests assume build artifacts only via vitest, not webpack output). Match existing ci.yml ordering by default.
- Whether to add `permissions: contents: read` at the top level of publish.yml (no-op in P6 since no write happens; documents the least-privilege baseline for P7 to upgrade at job level).
- Whether to add the actor-guard `if: github.actor != 'github-actions[bot]'` at the workflow level or job level. Job level is the SUMMARY recommendation; planner can choose either.
- Whether to use `gh CLI` or raw `curl` for the branch-protection probe task. Either works; `gh` is already on GitHub-hosted runners.
- Step-summary writes (`$GITHUB_STEP_SUMMARY`) for the dry-run echo — nice-to-have for human readability in the Actions UI; not required.
</decisions>

<deferred>
## Noted for Later (out of P6 scope)

- **OPERATIONS.md** — written in P8 (DOC-01, DOC-02). Captures PAT rotation procedure, manual emergency-publish runbook, branch-protection migration paths, design rationale referenced from publish.yml.
- **scripts/bump-version.mjs** — P7 (BUMP-01..05). Atomic two-file write of `package.json` + `vss-extension.json`.
- **Real `tfx extension publish`** — P7 (PUBLISH-01..05). The dry-run echo in P6 becomes a real publish call in P7.
- **Commit-back via `git-auto-commit-action@v6`** — P7 (TAG-01..02). publish.yml gains `permissions: contents: write` at the job level.
- **Annotated git tag push** — P7 (TAG-03..04). Best-effort + idempotent.
- **`scripts/publish-cezari.cjs` archive + npm script removal** — P8 (CLEAN-01..03). AFTER first green publish.
- **PROJECT.md "Validated" promotion** — P8 (DOC-03).

## Future Milestones (deferred from v1.1, will not be addressed in P6/P7/P8)

- PAT-smoke cron, branch-protection-aware push escalation, Marketplace-version reconciliation pre-flight, conventional-commits-driven semver, CHANGELOG generation, bundle-size trend reporting on PRs, multi-environment staged promote — all v1.2+ candidates per REQUIREMENTS.md "Future Requirements" section.
</deferred>

---

*Created: 2026-05-05 — `/gsd-discuss-phase 6`. 9 decisions captured (D-1 through D-9 plus 1a). 18 requirements scoped (CI 8 + GATE 7 + FAIL 3). Next: `/gsd-plan-phase 6`.*

*Updated: 2026-05-07 — `/gsd-discuss-phase 6` (post-Wave-1 refinement). Revised D-5 (binary → best-effort tri-state); added D-5a (P7 reads `branch-protection-probe-result.md` as source of truth, not CONTEXT.md or step summary alone); added D-5b (workflow vs developer probe disagreement → developer wins). Anchored to PR #2 / commit 8e1d65f (`administration: read` is not a valid scope in workflow `permissions:` blocks).*
