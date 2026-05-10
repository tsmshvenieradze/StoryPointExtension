---
phase: 06-workflow-scaffold-and-gates
plan: 03
subsystem: infra
tags: [github-actions, ci-cd, verification, paths-ignore, dry-run, branch-protection, marketplace]

# Dependency graph
requires:
  - phase: 06-workflow-scaffold-and-gates/01
    provides: ci.yml is PR-only — needed so the master-push verification doesn't double-fire ci.yml + publish.yml
  - phase: 06-workflow-scaffold-and-gates/02
    provides: publish.yml (master + workflow_dispatch trigger, gates, paths-ignore, dry-run echo, tri-state branch-protection probe) — the file under live test
provides:
  - Live verification on real master that publish.yml's two-workflow split + paths-ignore + dry-run echo all behave correctly end-to-end
  - branch-protection-probe-result.md — durable phase artifact recording master's protection state (NOT PROTECTED) for Phase 7's commit-back token decision
  - Validated finding — GitHub does NOT trigger a workflow on the same commit that creates it (PR #2 / 501ebae did not fire publish.yml even though publish.yml + ci.yml were the only non-paths-ignored changes); subsequent pushes on already-registered workflows fire normally
affects: [07-auto-publish, 08-cleanup-and-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Live trigger verification dance (negative-case docs-only PR + positive-case code-side PR, both whitespace-only edits) — validates paths-ignore filter and dry-run echo without Marketplace mutation
    - Two-layered branch-protection probe (best-effort tri-state workflow probe in publish.yml + authoritative admin-scoped developer probe via `gh api`) — definitive answer with traceability
    - Probe-divergence resolution per CONTEXT D-5b: when workflow probe returns `unknown` and developer probe returns definitive State, developer wins, both recorded for audit

key-files:
  created:
    - .planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md — durable artifact P7 reads as source of truth (per CONTEXT D-5a)
    - .planning/phases/06-workflow-scaffold-and-gates/06-03-SUMMARY.md — this file
  modified: []

key-decisions:
  - "Reversed plan order to positive-case-first. Reason: at the time of execution, publish.yml had zero workflow runs on master (PR #2 / commit 501ebae did not fire publish.yml — known GitHub edge case where workflows don't trigger on the commit that creates them). With zero baseline runs, the negative case alone could not distinguish 'paths-ignore correctly skipped' from 'workflow never fires'. Doing positive case first established a baseline (publish.yml CAN fire), then negative case proved paths-ignore correctly SKIPS."
  - "Used `Settings → Branches` admin UI as a pre-install fallback for the developer-side probe (D-5a authoritative source). Once `gh` was installed mid-execution, re-ran with `gh api` and captured the verbatim 404 body in the artifact's Raw API response section. Both surfaces agreed (NOT PROTECTED)."
  - "Recorded both probe outputs (workflow=`unknown`, developer=`not_protected`) in branch-protection-probe-result.md's `## Probe divergence` section per CONTEXT D-5b. Developer probe wins; State=NOT PROTECTED used for the Implication-for-Phase-7 paragraph."

patterns-established:
  - "Pattern: positive-case-first when verifying a brand-new workflow file. The first commit that adds a workflow does not trigger it; subsequent commits do. Verifying 'workflow correctly skips' requires first verifying 'workflow correctly runs' to establish baseline."
  - "Pattern: developer-side branch-protection probe as the source of truth. Workflow probe is best-effort due to GITHUB_TOKEN scope limits; admin-scoped `gh api` (or Settings → Branches UI) is authoritative. Durable artifact in phase directory, not buried in step output."
  - "Pattern: minimal-blast-radius whitespace edits for live-trigger verification. README single trailing newline (negative case, paths-ignore filtered); webpack.config.cjs single trailing newline (positive case, runs publish.yml). No comments added per CLAUDE.md 'no comments by default' rule."

requirements-completed:
  - CI-01
  - CI-02
  - CI-03
  - GATE-06
  - FAIL-03

# Metrics
duration: ~25min (interactive: 2 PR cycles + 1 gh install/auth + artifact write)
completed: 2026-05-07
---

# Phase 06 Plan 03: Verification dance + branch-protection probe artifact

**Live-verified the two-workflow split on real master via two minimal-edit PRs (positive case first, negative case second). Captured `branch-protection-probe-result.md` as the durable D-5a artifact for Phase 7. publish.yml fired correctly on the code-side merge, dry-run echoed `would publish v1.0.8`, neither workflow fired on the docs-only merge, and master is confirmed NOT PROTECTED.**

## Performance

- **Duration:** ~25 min interactive (covers 2 PR cycles, mid-execution `gh` install + web-auth, and artifact writes)
- **Started:** 2026-05-07
- **Completed:** 2026-05-07
- **Tasks:** 3 (Task 1 negative case, Task 2 positive case, Task 3 artifact capture)
- **Files created:** 2 (branch-protection-probe-result.md, 06-03-SUMMARY.md)
- **Files modified:** 0 (the README and webpack.config.cjs whitespace edits land via PR merges to master, not on milestone1.1)

## Accomplishments

- Live-verified that `publish.yml` correctly fires on a code-side master push (positive case, commit `db633d5` via PR #3 — `chore(p6): positive-case verify — webpack config whitespace edit`). All 11 gate steps green in 47s. Dry-run step echoed verbatim `Would publish: v1.0.8` against `Current: 1.0.7` (matches package.json). Marketplace listing remained at v1.0.7 — confirms the workflow's "no Marketplace mutation in P6" boundary holds at runtime.
- Live-verified that `publish.yml` correctly skips a docs-only master push (negative case, commit `eb82031` via PR #4 — `chore(p6): negative-case verify — README whitespace edit`). The `**.md` paths-ignore pattern matched, and since README.md was the only changed file, the workflow was skipped. Neither `CI` (PR-only after Plan 06-01) nor `Publish` fired on the master push side.
- Captured `branch-protection-probe-result.md` as the durable Phase 7 source-of-truth artifact, per CONTEXT D-5a. The artifact records both probe outputs (workflow probe via publish.yml step, developer probe via local `gh api` and Settings UI cross-check) and a `## Probe divergence` section per D-5b documenting the expected workflow-probe-`unknown` vs developer-probe-`not_protected` divergence and its resolution. State: **NOT PROTECTED**. Phase 7 commit-back can use default `GITHUB_TOKEN` with `permissions: contents: write` at the publish job level.
- Surfaced and documented the GitHub "first-push edge case" — workflows do not trigger on the commit that creates them. The PR #2 squash merge (commit `501ebae`) added `publish.yml` and ci.yml's edit to master but `publish.yml` showed zero runs in the Actions tab afterwards, even though the merge changed only `.github/workflows/*` and `.planning/**` (the latter in paths-ignore but not all paths matched). This finding drove the decision to reverse plan order to positive-case-first, and is captured here for future P7/P8 planners and any future workflow-add operations.

## Verification Results — Cross-Check Against ROADMAP Success Criteria

| ROADMAP SC | Statement | Status | Evidence |
|------------|-----------|--------|----------|
| SC #1 | PR triggers ci.yml; same PR push does NOT trigger publish.yml | ✓ verified | Both verification PRs (#3, #4) ran ci.yml on PR-open and passed; neither PR fired publish.yml. (publish.yml triggers only on `push: [master]` + `workflow_dispatch`.) |
| SC #2 | Master merge triggers publish.yml; does NOT trigger ci.yml | ✓ verified | Positive case (commit `db633d5`): `Publish #1` fired and went green; no new `CI` run for that SHA. Negative case (commit `eb82031`): paths-ignore correctly suppressed publish.yml; ci.yml also silent (push:master removed). |
| SC #3 | Docs-only commit filtered by paths-ignore | ✓ verified | Negative case PR #4 merged commit `eb82031` with only README.md changed; ZERO workflow runs fired on the master push (Actions tab silent for that SHA). |
| SC #4 | Gate failure stops before dry-run echo | ✓ verified by-construction | publish.yml's gate ordering (typecheck → tests → build → check:size → asset-audit → TFX_PAT probe → branch-protection probe → dry-run) is sequential with no `continue-on-error: true` on any gate step (verified in Plan 06-02 SUMMARY's anti-pattern audit table; live failure-injection deferred to P7 where FAIL-04 commit-back path needs runtime exercise anyway). |
| SC #5 | Dry-run echoes would-be next version, no Marketplace mutation | ✓ verified | Positive case `Publish #1` Summary tab: `Current: 1.0.7` / `Would publish: v1.0.8`. Marketplace listing post-run: still v1.0.7. No `tfx` invocation occurred — verified by step-name inspection ("Dry-run — compute next version (DOES NOT publish)") and absence of any `tfx publish` line in step output. |
| SC #6 | TFX_PAT secret resolves; branch-protection state captured for P7 | ✓ verified | Positive case run job went green through the `Verify TFX_PAT secret resolves` step (secret presence boolean evaluated true). Branch-protection state captured durably in `.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md` (NOT PROTECTED, with workflow vs developer probe divergence documented per D-5b). |

## Verification Artifacts (commit refs)

| Artifact | Where | What it proves |
|----------|-------|----------------|
| Positive-case merge SHA | `master` ← PR #3 — `db633d5` (`chore(p6): positive-case verify — webpack config whitespace edit (#3)`) | Trigger plumbing live; gates run; dry-run echoes correctly |
| Positive-case workflow run | `Publish #1` — commit `db633d5`, branch `master`, 47s, all 11 steps green | SC #2, #5, #6 (TFX_PAT half) |
| Negative-case merge SHA | `master` ← PR #4 — `eb82031` (`chore(p6): negative-case verify — README whitespace edit (#4)`) | paths-ignore correctly filters docs-only |
| Negative-case workflow runs | None for `eb82031` (Actions tab silent) | SC #1 (publish.yml inert during PR), SC #3 |
| Branch-protection artifact | `.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md` | SC #6 (branch-protection half), D-5/D-5a/D-5b realized |

## Decisions Made

1. **Reversed plan order to positive-case-first.** The plan as written documented negative-case-first ordering. At execution time, the Actions tab showed `Publish` had zero runs (consequence of GitHub's first-push edge case for the workflow file added in PR #2). With no baseline, a negative-case "no run fired" observation could not distinguish "paths-ignore worked" from "workflow never fires at all". Reversing to positive-case-first established the baseline, then negative case cleanly proved paths-ignore. The plan's `<verification>` block's success criteria are agnostic to ordering — both halves of D-1a's mandate (positive AND negative) were exercised.
2. **Used Settings → Branches admin UI as the developer probe before `gh` was installed.** Both surfaces (admin UI, `gh api` once installed) returned the same `not_protected` State. Captured both for traceability in the artifact's Sources section.
3. **Captured raw `gh api` response body in the artifact** after mid-execution `gh` install (v2.92.0 + web-auth flow). Body matches GitHub's documented 404 shape verbatim. Confirms NO admin-credential discrepancy between the workflow probe and developer probe — the divergence was purely scope (workflow `GITHUB_TOKEN` lacks admin; user's gh login has admin).
4. **Did NOT live-inject a gate failure for SC #4 verification.** The plan explicitly defers SC #4 to "by-construction" verification (gate ordering + no `continue-on-error: true` on any gate step), with the rationale that a live failure injection would consume an extra force-merge cycle for marginal value while P7's FAIL-04 commit-back path will exercise this path anyway. Recording the deferral here so P7's planner remembers to confirm gate-stop behavior live during its first failed-publish injection.

## Deviations from Plan

**1. [Rule 3 — Plan order reversal] Positive case executed before negative case**
- **Found during:** Pre-execution observation of Actions tab state (zero `Publish` runs after PR #2 merge).
- **Issue:** The plan's Tasks 1 (negative) and 2 (positive) were ordered to test paths-ignore first, then workflow firing. Without a prior baseline that publish.yml CAN fire on master, a "no run fired" observation in Task 1 would have been ambiguous (paths-ignore vs workflow never firing). Reversing eliminated the ambiguity.
- **Fix:** Ran Task 2 (positive) first, then Task 1 (negative). Plan acceptance criteria are unchanged — both cases were exercised, both passed.
- **Files modified:** None at file level; this is an execution-order deviation only.
- **Verification:** Both PRs merged, both observations match plan expectations: publish.yml fired green on db633d5 (positive); publish.yml + ci.yml both silent on eb82031 (negative).

**2. [Rule 1 — Tooling] Used Settings UI as the developer probe before `gh` install**
- **Found during:** Task 3 setup — `gh` was not installed on the developer machine.
- **Issue:** The plan's Task 3 action block specified `gh api repos/.../branches/master/protection` as the preferred capture mechanism, with a UI fallback for the case where `gh` isn't available. The action block's fallback path was used initially.
- **Fix:** User installed `gh` v2.92.0 mid-execution, ran `gh auth login --web`, and the API call was re-run. Captured the verbatim 404 body in the artifact's Raw API response section. Both probe outputs (UI-then-API) agreed.
- **Files modified:** branch-protection-probe-result.md was first written using the UI path, then Edit-tool-amended to upgrade the Sources description and Raw API response section once `gh` was authed.
- **Verification:** `Raw API response` section now contains the verbatim 404 body and stderr line; Sources section names both surfaces with cross-verification note.

---

**Total deviations:** 2 expected/recoverable (one execution-order optimization driven by an observed GitHub edge case; one tooling-availability fallback that was upgraded once tooling was installed). No scope creep. No content lost. Plan acceptance criteria fully satisfied.

## Issues Encountered

**1. GitHub "first-push" edge case — workflow does not trigger on its own creating commit (CAPTURED FOR FUTURE PLANNERS):**
The PR #2 squash merge (commit `501ebae`) added `.github/workflows/publish.yml` to master. The merge commit changed `.github/workflows/*` (NOT in paths-ignore) and `.planning/**` (in paths-ignore), so by trigger-rule semantics publish.yml SHOULD have fired. It did not. The Actions tab for `Publish` showed zero runs after the merge, only beginning with `Publish #1` on the next code-side push (commit `db633d5`). This matches the GitHub-documented behavior that workflow files registered for the first time via a push event don't fire on that same commit; they fire on subsequent matching pushes. Note this for any future workflow-add operation in this repo (P8 has none planned, but if a v1.2+ milestone adds a new workflow file, the first verification commit must include something other than just the workflow itself).

**2. `gh` CLI not installed at execution start (RESOLVED via user-installed mid-execution):**
The plan's Task 3 preferred path used `gh api` for the developer-side probe. `gh` was not on the developer machine. Worked around with the Settings → Branches UI (admin-scoped, same source of truth) initially. User installed `gh` v2.92.0 mid-execution and authenticated via the web flow; the API call was then re-run and the artifact upgraded with the verbatim 404 body. No content lost — the artifact captures both surfaces and notes that they agreed.

**3. Workflow probe returned `unknown` (BY DESIGN — not an issue, not a divergence from D-5):**
publish.yml's `Probe master branch protection` step output `unknown` (annotation: `Branch-protection probe inconclusive (gh api exit 1, body did not match 'Branch not protected')`). This is the tri-state design from CONTEXT D-5 working correctly — `GITHUB_TOKEN` cannot be granted admin scope (no `administration:` key in workflow `permissions:` blocks; verified PR #2 / commit 8e1d65f), so the workflow probe honestly reports inconclusive instead of misclassifying as `not_protected`. The developer probe (Settings UI + `gh api`) was the authoritative resolver per D-5b. Both probe outputs are recorded in the artifact's `## Probe divergence` section.

## User Setup Required

None going forward — `TFX_PAT` is already a repo secret (CONTEXT D-2), `gh` is now installed and authed for any future admin-scoped probes, the verification dance is complete, and master is confirmed NOT PROTECTED so Phase 7's commit-back token plan needs no escalation.

## Next Phase Readiness

- **Phase 7 (Bump, Publish, Tag) is unblocked.** P7's planner reads `branch-protection-probe-result.md` (per CONTEXT D-5a) and finds State=NOT PROTECTED, so the plan can use default `GITHUB_TOKEN` with `permissions: contents: write` at the publish job level — no `RELEASE_PAT`, no GitHub App, no bypass list provisioning needed. Migration playbook for "if protection is enabled later" is documented in the artifact's Implication-for-Phase-7 paragraph and `.planning/research/SUMMARY.md` "Branch-protection-aware push" Future Requirement.
- **publish.yml's runtime contract is verified.** P7 can replace step 11's `Dry-run — compute next version (DOES NOT publish)` with a real `tfx extension publish` invocation, add `actions/upload-artifact@v4` for the .vsix, add `git-auto-commit-action@v6` for the commit-back, and add `permissions: contents: write` at the job level — all within the locked YAML structure that's been live-verified to fire correctly on master pushes and skip docs-only commits.
- **Annotation flagged for future cleanup (NOT a P6/P7/P8 blocker):** `actions/setup-node@v4` deprecation warning surfaced in `Publish #1`'s annotations ("Node.js 20 actions are deprecated... actions/setup-node@v4"). When the v5 line stabilizes, bump publish.yml + ci.yml's setup-node pin together. This is a v1.2+ candidate or a small carry-over quick task — explicitly out of scope for the current milestone.

## Self-Check: PASSED

**File artifact checks:**
- `test -f .planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md` → FOUND
- `test -f .planning/phases/06-workflow-scaffold-and-gates/06-03-SUMMARY.md` → FOUND (this file)
- branch-protection-probe-result.md contains: H1 `# Master branch-protection probe result` ✓; `**State:** NOT PROTECTED` ✓; `## Probe divergence` (per D-5b) ✓; `## Implication for Phase 7` ✓; `## Raw API response` with verbatim 404 body ✓.

**SC verification cross-check:**
- All 6 ROADMAP success criteria mapped to live-observation evidence (or by-construction evidence with deferral note for SC #4).
- D-1a (positive AND negative case) both exercised.
- D-5/D-5a/D-5b realized in the durable artifact.

**Commit checks:**
- Verification PRs merged to master: `db633d5` (PR #3 positive) and `eb82031` (PR #4 negative) — both observable via `git log origin/master --oneline`.
- This SUMMARY + the artifact file land via the milestone1.1 → master sync (next commit on milestone1.1).

---
*Phase: 06-workflow-scaffold-and-gates*
*Plan: 03*
*Completed: 2026-05-07*
