# Phase 7: Bump, Publish, Tag — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

**Goal:** A real merge to master automatically packages a new patch `.vsix`, publishes it to the Visual Studio Marketplace, commits the version bump back to master with `[skip ci]`, and pushes an annotated tag — the first run ships v1.0.8.

**Requirements:** BUMP-01..05, PUBLISH-01..05, TAG-01..04 (14 reqs).

**Success Criteria (from ROADMAP):**

1. After a merge to master, the Marketplace listing for `TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator` advances to v1.0.8 (verifiable in the public listing's Versions table within the workflow runtime).
2. Master gains exactly one new commit authored by `github-actions[bot]` with subject `chore(release): v1.0.8 [skip ci]` that updates BOTH `package.json` and `vss-extension.json` to `1.0.8` (atomic two-file diff).
3. The bump commit does NOT re-trigger `publish.yml` — the Actions tab shows the run terminating, no second iteration appears (triple-defense: `GITHUB_TOKEN` anti-loop + `[skip ci]` + actor-guard `if: github.actor != 'github-actions[bot]'`).
4. An annotated tag `v1.0.8` exists on origin pointing at the bump commit; if the tag step fails, the workflow stays green (Marketplace + commit are load-bearing; tag is best-effort/idempotent).
5. Forcing the publish step to fail (e.g. revoked PAT) leaves master at v1.0.7, no bump commit, no tag, and Marketplace at v1.0.7 — re-running via `workflow_dispatch` recovers cleanly (Option B reversibility verified).
6. The published `.vsix` is downloadable as a workflow artifact `vsix-1.0.8` for 90 days (`if-no-files-found: error` guard active), enabling post-mortem inspection without re-packaging.

**State at phase start (post-Phase-6 close):**
- v1.0.7 live on Marketplace; `package.json` + `vss-extension.json` both at `1.0.7`; publisher `TsezariMshvenieradzeTfsAiReviewTask`.
- `.github/workflows/publish.yml` already scaffolded by Phase 6 (single sequential job, gates 1–7 + asset audit + TFX_PAT presence check + branch-protection probe + dry-run echo). The dry-run echo step at [publish.yml:110-123](../../../.github/workflows/publish.yml#L110-L123) is what Phase 7 deletes; everything before it stays.
- Master is **NOT PROTECTED** (06-03 developer-probe artifact, admin-scoped, 2026-05-07 — see [branch-protection-probe-result.md](../06-workflow-scaffold-and-gates/branch-protection-probe-result.md)). Commit-back can use default `GITHUB_TOKEN` with `permissions: contents: write` at the publish job level. No App, no `RELEASE_PAT`.
- TFX_PAT repo secret already created and proven to resolve at runtime (Phase 6 SC #6, `Verify TFX_PAT secret resolves` step in publish.yml).
- `tfx-cli@0.23.1` already a devDependency in [package.json](../../../package.json) — no install change. STATE.md TODO: re-verify `tfx extension publish --help` flag spelling at execution time (research is HIGH on shape, MEDIUM on exact spelling).
- Bundle: 147.9 KB / 250 KB gzipped. 398/398 vitest passing. Phase 6 verified live on master via PR #3 (db633d5, positive case) and PR #4 (eb82031, paths-ignore negative case).
</domain>

<decisions>
## Implementation Decisions

### bump-version.mjs design (BUMP category)

- **D-1: Drift policy = higher wins.** When the script reads `package.json` and `vss-extension.json` and finds them at different versions (e.g., one at 1.0.7 and the other at 1.0.6 from a manual edit), it uses `max(pkg, manifest)` as the "current" version, increments the patch, and writes the same new value to both files. No fail-loud assertion. Auto-reconciles silently in normal cases (both at same version) but surfaces the divergence when it happens (see D-2).
  - Rejected: fail-loudly-on-mismatch (strictest; the user explicitly chose lower friction).
  - Rejected: package.json-as-canonical (gives package.json a single-source-of-truth role it doesn't have today; Marketplace ultimately reads only `vss-extension.json`).

- **D-2: Drift surfacing = `::warning::` to stderr + step-summary note.** When D-1's max-merge actually kicks in (the two input versions disagreed), the script prints `::warning::Drift reconciled: pkg=X, manifest=Y → bumped to Z` to stderr (surfaces as a yellow annotation in the Actions UI) AND appends a `## Drift reconciled` block to `$GITHUB_STEP_SUMMARY` (uses `process.env.GITHUB_STEP_SUMMARY` like the existing dry-run echo step does). Silent in the normal case (both files at same version). The annotation does NOT fail the workflow — it's audit-only.

- **D-3: Vitest test scope for BUMP-05 = happy-path test + drift case test.** Two tests in `scripts/bump-version.test.mjs` (or wherever the planner places it consistent with existing vitest config):
  - **Happy path:** both files at 1.0.7 → both end at 1.0.8; `next-version=v1.0.8` written to the configured GH_OUTPUT path; no drift annotation emitted.
  - **Drift case:** pkg.json at 1.0.7, manifest at 1.0.6 → both end at 1.0.8 (max + 1); drift annotation present in the captured stderr; drift block present in the captured `$GITHUB_STEP_SUMMARY` file.
  - Out of scope for this phase: rollover boundary (1.2.99 → 1.2.100), atomicity-on-write-failure (mock fs), malformed-JSON inputs. The two tests above cover the only two real branches in the script.

- **D-4: Output channel = script writes `next-version=v1.0.8` to `$GITHUB_OUTPUT`.** The script reads the path from `process.env.GITHUB_OUTPUT` and appends `next-version=v1.0.8`. Downstream steps reference it as `${{ steps.bump.outputs.next-version }}`. The vitest tests pass a temp file path via the env var to assert the line is written. The workflow does NOT separately re-read the new version from `package.json` — single source of truth, set at write time.
  - Rejected: re-read-from-package.json (two places computing "the new version" → small risk of disagreement).
  - Rejected: belt-and-suspenders both (redundant for a 30-line script).

### First-run choreography (PUBLISH + TAG)

- **D-5: First run is ORGANIC — the Phase 7 PR merge IS the first publish.** The implementation PR replaces publish.yml's dry-run echo with the bump → tfx create → upload-artifact → tfx publish → commit-back → tag tail. The moment that PR merges to master, `publish.yml` fires on the merge commit and v1.0.8 ships for real, in the same run that lands the implementation. No `workflow_dispatch` gate, no two-step PR. Trust Option B reversibility (D-9) for recovery if anything is wrong.
  - Rejected: manual-first-via-workflow_dispatch (more controlled but requires landing a guard-then-removing-it pattern; user chose efficiency over ceremony).
  - Rejected: two-step PR (most controlled but ships 2 PRs to do what 1 PR can do).

- **D-6: Pre-merge de-risking = local PAT smoke + tfx --help re-verify.** Two cheap checks the human runs locally before merging the Phase 7 PR:
  1. Run `npx tfx extension publish --help` once locally. Reconcile its flag list against the workflow's `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation` invocation. Fix the YAML if any flag is misspelled or replaced. (Closes the STATE.md TODO and research's MEDIUM-confidence flag-spelling note.)
  2. Run `node scripts/publish-cezari.cjs` locally (the existing manual-publish path uses the SAME TFX_PAT env var). If it succeeds locally, the PAT works and Marketplace permissions are intact. If it bumps Marketplace to v1.0.8 in the process, that's actually a successful first publish and the Phase 7 merge becomes a no-op until the next PR — that's a recovery situation, not a planned one, and is acceptable. If the user wants to avoid that side effect, they can dry-run only the auth handshake portion of `publish-cezari.cjs` (cancel before the publish call) — Claude's discretion call at execution time.
  - No CI dry-run rehearsal step. Phase 6 already proved the gate stack and trigger config; Phase 7's publish chain is small enough that local PAT smoke + local --help gives the same signal cheaper.

- **D-7: Post-merge verification = Marketplace + bump commit + tag triple-check, captured in `07-VERIFICATION.md`.** After the Phase 7 PR's merge run goes green, the human verifies:
  1. Marketplace public listing's Versions table shows v1.0.8 (UI cross-check at the listing URL + raw API response captured).
  2. `git log master --grep 'chore(release)' -n 1` returns the bot's bump commit at v1.0.8 with `[skip ci]` in the subject.
  3. `git ls-remote --tags origin v1.0.8` returns a SHA pointing at the bump commit.
  All three pass = Phase 7 verifiable against ROADMAP SCs #1, #2, #4. The artifact mirrors Phase 6's `branch-protection-probe-result.md` durability posture: human-captured durable evidence, not auto-generated.
  - Rejected: light "summary paragraph + run URL" (loses the per-SC evidence trail).
  - Rejected: scripts/verify-publish.mjs (adds tooling for a one-time event; over-engineered).

### publish.yml step-summary verbosity (observability)

- **D-8: Rich step-summary writes for every load-bearing step in publish.yml.** The first-run-organic posture means humans WILL be watching the run summary panel. Each step writes a single human-readable line to `$GITHUB_STEP_SUMMARY`:
  - **bump-version.mjs (via D-4):** `## Bump` block — `Bumped to v1.0.8 (from 1.0.7)`. If drift was reconciled (D-2), append the drift block.
  - **tfx extension create:** Brief — `## Package` — `Created vsix-1.0.8.vsix (XX KB)`. (Size is nice-to-have; planner's call.)
  - **upload-artifact:** Default action's own step output is sufficient — no extra summary write needed.
  - **tfx extension publish:** `## Publish` block — `Published v1.0.8 to Marketplace` plus the listing URL `https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator`.
  - **git-auto-commit-action:** `## Commit-back` block — `Committed bump as <SHA> ([skip ci])`. The action exposes the commit SHA as an output; reference it.
  - **Tag step:** Three explicit states, see D-10.
  - One run = one readable summary panel that maps 1:1 to ROADMAP SCs #1, #2, #4.
  - Rejected: terse single-line summary at the end (loses per-step evidence; raw logs become the only signal).
  - Rejected: strip step summaries entirely (too aggressive for a v1.1 first-publish phase).

- **D-9: Branch-protection probe step stays as-is in publish.yml.** Phase 6's [`Probe master branch protection`](../../../.github/workflows/publish.yml#L69-L108) step (tri-state output, informational, writes to step summary) carries over unchanged into Phase 7's `publish.yml`. No control-flow upgrade — probe output does NOT gate commit-back. Acts as a future-protection canary: if someone enables branch protection later, the probe surfaces the state change in run summaries before commit-back actually starts failing.
  - Rejected: remove the probe (we know NOT PROTECTED today; redundant signal — but loses the canary).
  - Rejected: upgrade to a guard that fails when probe returns `protected` (probe is best-effort tri-state per Phase 6 D-5; can return `unknown` for token-scope reasons even when master is unprotected → blocks needlessly).

- **D-10: Tag step `$GITHUB_STEP_SUMMARY` line has three explicit states.** Tag is `continue-on-error: true` per TAG-04, so the step's exit status alone doesn't tell the human what happened. Each branch writes a different line:
  - **(a) Created:** `🏷️ Tagged v1.0.8 (annotated, pushed to origin)`.
  - **(b) Skipped (idempotent):** `Tag v1.0.8 already exists — idempotent skip per TAG-04`.
  - **(c) Failed (workflow stays green):** `⚠️ Tag step failed (workflow stays green per TAG-04 best-effort). Recovery: git tag -a v1.0.8 -m "Release v1.0.8" && git push origin v1.0.8.` — recovery hint inline so the human watching can act without grepping OPERATIONS.md.

### Plan decomposition

- **D-11: Phase 7 = 2 plans.** Mirror Phase 6's three-plan shape but compressed because first-run-organic (D-5) means there's no separate verification merge to land:
  - **07-01:** atomic — `scripts/bump-version.mjs` + 2 vitest tests (per D-3) + the `publish.yml` swap (delete dry-run echo, wire bump → tfx create → upload-artifact → tfx publish → commit-back → tag, plus the step-summary writes per D-8/D-10). All 14 reqs (BUMP-01..05, PUBLISH-01..05, TAG-01..04) ship in this single PR. The merge IS the first real publish.
  - **07-02:** verification-only — pure observation + artifact. Tasks are: pre-merge run the two D-6 local checks; watch the merge run go green; capture the D-7 triple-check evidence in `07-VERIFICATION.md`; confirm the 6 ROADMAP SCs each PASS with evidence. No code changes in 07-02.
  - Rejected: 3 plans splitting bump from workflow (07-01 bump-only would land an unused script, 07-02's merge becomes the first publish instead of 07-03 — three PRs to ship what one can).
  - Rejected: 1 plan everything-together (loses the natural "implementation vs verification" boundary the user established in Phase 6).
  - Rejected: leave-to-plan-phase (the user decided this; downstream agents should not re-litigate).

### Loop-guard, concurrency, action versions, runner (carried forward — not re-decided)

- **D-12 (carried forward from research/SUMMARY.md + Phase 6 publish.yml):** Triple loop-guard already wired — actor-guard `if: github.actor != 'github-actions[bot]'` at the publish job level ([publish.yml:25](../../../.github/workflows/publish.yml#L25)); commit message MUST contain `[skip ci]` per TAG-01; default `GITHUB_TOKEN` doesn't re-trigger workflows by GitHub design. Concurrency `group: publish-master, cancel-in-progress: false` (queue, never cancel mid-publish). Runner `ubuntu-latest`. Action pins: `actions/checkout@v5`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `stefanzweifel/git-auto-commit-action@v6`. All locked by Phase 6 D-4 + research/STACK.md + already in publish.yml; do not re-pin in Phase 7.

- **D-13 (carried forward from research/PITFALLS.md #3):** Concurrent-merges-race-the-bump is mitigated by the concurrency group (queues run B until A's commit-back lands; B then re-checks-out at v1.0.8 and ships v1.0.9). No new code in Phase 7. The "3+ rapid merges fold into one publish" GitHub limitation is documented in research and inherited by Phase 8's OPERATIONS.md, NOT in publish.yml comments (D-3 from Phase 6: rationale belongs in OPERATIONS.md).

### Claude's Discretion

These implementation details are for the planner/researcher to decide based on best fit — not blocked by user input:

- Exact filename for the bump script's vitest test (`scripts/bump-version.test.mjs` vs `tests/bump-version.test.mjs` etc.) — match wherever existing vitest config picks it up. Confirm via `vitest.config.ts`.
- Whether the bump script's drift-warn block in `$GITHUB_STEP_SUMMARY` uses `## Drift reconciled` as a top-level header or nests under the `## Bump` block. Either is fine.
- Exact step `name:` strings (e.g., "Bump version" vs "Compute next version" vs "node scripts/bump-version.mjs") — pick something that reads well in the Actions UI alongside the existing P6 step names.
- Whether to set a `timeout-minutes:` on individual steps (publish + commit-back + tag) or rely on the job-level `timeout-minutes: 10` already in publish.yml.
- Whether `tfx extension create` writes to `dist/` (current research recommendation, glob `dist/*.vsix`) or to a more deterministic path computed from manifest. Stick with `dist/*.vsix` glob unless `tfx-cli` 0.23.1's --help reveals a better-named flag.
- Whether `actions/upload-artifact@v4` uses `name: vsix-${{ steps.bump.outputs.next-version }}` (i.e., `vsix-v1.0.8`) or strips the `v` prefix to match ROADMAP SC #6's `vsix-1.0.8` example. Match SC #6 (`vsix-1.0.8`, no `v` prefix in the artifact name) — tag has `v` prefix per TAG-03; artifact does not per SC #6.
- The `git-auto-commit-action@v6` config block — the action exposes inputs for `commit_message`, `commit_user_name`, `commit_user_email`, `tagging_message`, `branch`, etc. Use `commit_user_name: github-actions[bot]` + `commit_user_email: 41898282+github-actions[bot]@users.noreply.github.com` (the standard bot identity per research/PITFALLS.md #11). Do NOT use the action's built-in tagging — TAG-03/04 are best-effort with idempotency, which a separate `git tag` step handles more cleanly.
- The publish.yml job-level `permissions:` upgrade — current top-level is `permissions: contents: read`. Phase 7's publish job needs `contents: write` to push the bump commit and tag. Add at the job level (not top level) to keep the principle-of-least-privilege baseline that gates run with read-only.
- The `.vsix` size figure in the publish/package step-summary line (D-8) — nice-to-have. Compute via `stat` or `du -k` on the produced `.vsix`. Skip if it complicates the YAML.
- Whether to inline-document the `[skip ci]` mechanism in the workflow YAML — DON'T. Per Phase 6 D-3, rationale belongs in OPERATIONS.md (Phase 8 DOC-02). Step `name:` fields must be self-explanatory; no comment blocks.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project + milestone scope
- [.planning/ROADMAP.md](../../ROADMAP.md) — Phase 7 row, 6 success criteria, Cross-Phase Notes #2 (tfx flag re-verify), #3 (inherited publisher), #5 (Phase 8 ordering).
- [.planning/REQUIREMENTS.md](../../REQUIREMENTS.md) — BUMP-01..05, PUBLISH-01..05, TAG-01..04 verbatim. Out-of-Scope section names what NOT to add (Marketplace pre-flight reconciliation, conventional-commits, GitHub Releases, etc.).
- [.planning/STATE.md](../../STATE.md) — Pending todo: `tfx extension publish --help` re-verify (executed via D-6).

### v1.1 research (locked decisions inherited by Phase 7)
- [.planning/research/SUMMARY.md](../../research/SUMMARY.md) — Architecture flow + Option B rationale + Pitfall mitigations matrix.
- [.planning/research/STACK.md](../../research/STACK.md) — Pinned action versions + tfx-cli@0.23.1 + PAT scope.
- [.planning/research/ARCHITECTURE.md](../../research/ARCHITECTURE.md) — Single-job sequential structure; `dist/` output convention.
- [.planning/research/PITFALLS.md](../../research/PITFALLS.md) — Pitfall 2 (drift), Pitfall 3 (concurrent merges), Pitfall 5 (tfx flag traps), Pitfall 11 (failed publish AFTER bump → Option B), Pitfall 14 (tag atomicity).
- [.planning/research/FEATURES.md](../../research/FEATURES.md) — Table-stakes vs deferred vs anti-features.

### Phase 6 carry-overs (P6 outputs P7 consumes)
- [.planning/phases/06-workflow-scaffold-and-gates/06-CONTEXT.md](../06-workflow-scaffold-and-gates/06-CONTEXT.md) — D-3 (rationale in OPERATIONS.md), D-4 (action pins), D-5/D-5a/D-5b (probe semantics), D-9 (FAIL bake-in).
- [.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md](../06-workflow-scaffold-and-gates/branch-protection-probe-result.md) — **AUTHORITATIVE source of truth for the commit-back token decision.** State: NOT PROTECTED → use default `GITHUB_TOKEN` + `permissions: contents: write` at job level. Per CONTEXT D-5a: P7 reads this artifact, NOT 06-CONTEXT or step summary alone.

### Live code being modified or referenced
- [.github/workflows/publish.yml](../../../.github/workflows/publish.yml) — current Phase 6 dry-run shape; Phase 7 deletes the dry-run echo step ([line 110-123](../../../.github/workflows/publish.yml#L110-L123)) and wires the publish/commit/tag tail. Header + gates + asset audit + TFX_PAT check + branch-protection probe stay as-is.
- [package.json](../../../package.json) — `version: "1.0.7"` (bumped to 1.0.8 by D-1's script); `tfx-cli` already in devDependencies at `0.23.1`.
- [vss-extension.json](../../../vss-extension.json) — `version: "1.0.7"` (bumped in lockstep); `files[]` source of truth for asset audit.
- [scripts/publish-cezari.cjs](../../../scripts/publish-cezari.cjs) — read-only reference for the canonical `tfx extension publish` invocation flag set; also the local PAT smoke target per D-6.
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — UNCHANGED in Phase 7 (PR-only after Phase 6's edit).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`.github/workflows/publish.yml`** (Phase 6 scaffold) — keep header, on:, concurrency:, top-level permissions:, jobs.publish header, the gates (typecheck/test/build/check:size), the asset audit step, the `Verify TFX_PAT secret resolves` step, and the `Probe master branch protection` step. Delete only the `Dry-run — compute next version (DOES NOT publish)` step at lines 110-123. The job's `name:` should drop the `(dry-run in P6)` suffix.
- **`scripts/publish-cezari.cjs`** — Phase 7 does NOT modify it (CLEAN-01 archives it in Phase 8 AFTER the first green auto-publish). Used in D-6 as a local PAT smoke target since it reads the same `TFX_PAT` env var.
- **`scripts/check-bundle-size.cjs`** — already wired into publish.yml's gate sequence; no Phase 7 change.
- **vitest config + 100% coverage threshold** — already enforces `src/calc/**` and `src/audit/**`. The new `bump-version.test.mjs` is a `scripts/**` test, NOT subject to the 100%-coverage threshold (per existing vitest config). Confirm at planning time.

### New Files to Create (Phase 7)

- `scripts/bump-version.mjs` — ESM, ~30–50 lines per D-1/D-2/D-4. Reads pkg.json + vss-extension.json, picks max-version, writes both at max+1, writes `next-version=v<X.Y.Z>` to `$GITHUB_OUTPUT`, emits drift `::warning::` + step-summary block when applicable.
- `scripts/bump-version.test.mjs` (or wherever vitest picks it up) — 2 tests per D-3.
- `.planning/phases/07-bump-publish-tag/07-VERIFICATION.md` — written by 07-02 per D-7.

### Files Modified (Phase 7)

- `.github/workflows/publish.yml` — delete dry-run echo step (lines 110-123); add new steps per the architecture flow; add `permissions: contents: write` at the job level; add `name:` adjustments (drop `(dry-run in P6)` from job name); ensure `${{ steps.bump.outputs.next-version }}` is consumed by upload-artifact, publish, commit-back, and tag steps.
- `package.json` — version bumped 1.0.7 → 1.0.8 by `bump-version.mjs` AT RUN TIME on the first organic merge (NOT a Phase 7 PR diff). The Phase 7 PR itself does NOT change `version`.
- `vss-extension.json` — same as above; bumped at run time, not in the PR diff.

### Files NOT Touched in Phase 7

- `scripts/publish-cezari.cjs` and the `publish:cezari` / `publish:public` npm scripts — archival is Phase 8 (CLEAN-01..03), AFTER the first green auto-publish.
- `.github/workflows/ci.yml` — unchanged.
- `src/**`, `tests/**`, `webpack.config.cjs`, `tsconfig.json`, `vitest.config.ts` — all unchanged.
- `.planning/OPERATIONS.md` — written in Phase 8 (DOC-01, DOC-02). Phase 7's plans must NOT seed runbook content here.

### Established Patterns (carried forward)

- **Two-workflow split** — `ci.yml` is PR-only (post-Phase-6); `publish.yml` is master-only + workflow_dispatch.
- **Single sequential job** — no parallel jobs, no matrix; one `publish` job with steps in order.
- **Option B state-flow** — bump in-memory only (no commit yet) → tfx create → upload-artifact → tfx publish → commit-back → tag. Failure of publish leaves master untouched.
- **Step-summary first-class** — Phase 6 already establishes `$GITHUB_STEP_SUMMARY` writes for probe + dry-run. Phase 7 extends this pattern (D-8) to every load-bearing step.
- **Best-effort tag step** — `continue-on-error: true` only on the tag step (not on any other step in publish.yml); idempotent (skip if exists locally or on origin).

### Integration Points

- **publish.yml ↔ bump-version.mjs:** via `$GITHUB_OUTPUT` (`next-version`) + `$GITHUB_STEP_SUMMARY` (drift block). No additional env vars to plumb.
- **publish.yml ↔ TFX_PAT:** secret already wired by Phase 6; Phase 7's publish step reads `${{ secrets.TFX_PAT }}` directly.
- **publish.yml ↔ master branch:** commit-back via `git-auto-commit-action@v6` using default `GITHUB_TOKEN` (NOT PROTECTED per probe artifact). Job-level `permissions: contents: write` upgrade is the only permissions change.
- **publish.yml ↔ Marketplace listing:** by way of `tfx extension publish` against `https://marketplace.visualstudio.com/...`, authenticated by `TFX_PAT`. No webhook/callback; success is observed by HTTP exit + post-merge UI cross-check (D-7).
</code_context>

<specifics>
## Specific Ideas

- **First-run-organic (D-5) is the user's deliberate choice.** They prefer to land a clean atomic PR and trust Option B reversibility for recovery, over staging a controlled `workflow_dispatch` rehearsal. Plans must NOT introduce a guard or feature flag that gates the publish behind a manual trigger.
- **Triple-check verification artifact (D-7) mirrors Phase 6's `branch-protection-probe-result.md` shape.** Per-SC evidence rows + raw API response + cross-references. Lightweight summaries are explicitly rejected — the evidence-per-SC format is what the user pattern is.
- **Rich step-summary writes (D-8) are not optional ornament.** First-run-organic + step-summary-as-verification-surface is a coherent pair: humans WILL be watching the run; the summary panel is the at-a-glance proof of ROADMAP SCs #1, #2, #4. Plans must NOT compress these into a single final-step summary.
- **No CI dry-run rehearsal step (D-6).** Phase 6 already proved gates + triggers + secret resolution in live runs. Phase 7's pre-merge de-risking is local-only (PAT smoke + tfx --help re-verify). Plans must NOT add a side-by-side rehearsal workflow or feature-flagged in-publish.yml dry-run.
- **`[skip ci]` token belongs in the bot's commit message, not in a manual skip step** (research/SUMMARY.md "Reconciliation on `[skip ci]`"). The `git-auto-commit-action@v6` `commit_message` input must contain `[skip ci]`; do not add a separate "skip if commit message contains [skip ci]" guard.
</specifics>

<deferred>
## Deferred Ideas

### Phase 8 (already roadmap-locked, not new):
- `OPERATIONS.md` capturing PAT rotation procedure, partial-failure recovery (publish OK + commit-back fails), branch-protection migration paths, manual emergency-publish runbook (DOC-01, DOC-02).
- Archive `scripts/publish-cezari.cjs` to `scripts/.archive/` + remove `publish:cezari` and `publish:public` npm scripts (CLEAN-01..03).
- PROJECT.md "Validated" promotion of v1.1 (DOC-03).

### Future milestones (v1.2+, NOT this milestone):
- PAT-smoke cron (weekly authentication-only check).
- Marketplace-version reconciliation pre-flight step (Pitfall 2 detector — explicitly OUT OF SCOPE per REQUIREMENTS.md).
- Branch-protection-aware push escalation (App or RELEASE_PAT) — gated on master gaining protection rules.
- Conventional-commits-driven semver + CHANGELOG auto-generation.
- Bundle-size trend reporting on PRs.
- Multi-environment staged promote (private → public).

### Considered during discussion but not adopted:
- Force-fail-the-publish recovery rehearsal (would validate ROADMAP SC #5 ahead of time). Not adopted — Option B's reversibility is research-locked + ROADMAP SC #5 requires it to be verifiable, not necessarily verified ahead of first run. If the first run is clean, SC #5 can be validated post-hoc by re-running the workflow with a deliberately broken PAT in a controlled exercise.
- `scripts/verify-publish.mjs` auto-generation for the verification artifact. Not adopted (one-time event; over-engineered).
- Bumping `actions/setup-node` to @v5 as part of Phase 7 (Node 20 deprecation warning surfaced in Publish #1 per STATE.md). Deferred to v1.2+ or a non-blocking quick-task — not in scope here.
</deferred>

---

*Phase: 7-Bump, Publish, Tag*
*Context gathered: 2026-05-08 — `/gsd-discuss-phase 7`. 13 decisions captured (D-1 through D-13). 14 requirements scoped (BUMP 5 + PUBLISH 5 + TAG 4). 2 plans planned (07-01 atomic implementation + 07-02 verification observation). Next: `/gsd-plan-phase 7`.*
