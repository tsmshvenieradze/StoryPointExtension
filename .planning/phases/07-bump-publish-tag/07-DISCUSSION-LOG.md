# Phase 7: Bump, Publish, Tag — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in [07-CONTEXT.md](07-CONTEXT.md) — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 7-Bump, Publish, Tag
**Areas discussed:** Bump drift policy, First-run choreography, Step-summary verbosity, Plan decomposition

---

## Bump drift policy

### Q1: When bump-version.mjs reads pkg.json + vss-extension.json and finds them at different versions, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Fail loudly | Read both, assert versions match, exit non-zero with diagnostic. Strictest. Exposes manual edits / merge mistakes the moment they would ship. | |
| Higher wins | Read both, use max(pkg, manifest), bump from there, write both to same value. Auto-reconciles silently. | ✓ |
| package.json canonical | Always read 'current' from package.json; force vss-extension.json to follow. | |

**User's choice:** Higher wins.
**Notes:** User chose lower friction over fail-fast. CONTEXT D-1.

### Q2: When 'higher wins' kicks in (drift was reconciled), what trace should it leave?

| Option | Description | Selected |
|--------|-------------|----------|
| Warn to stderr + step summary | `::warning::` line + `## Drift reconciled` block in $GITHUB_STEP_SUMMARY. Silent in normal case; loud-but-not-fatal when drift happens. | ✓ |
| Plain stdout log only | echo to stdout. Visible in raw step logs but no annotation. | |
| Fully silent | Just write the new version; no log line, no annotation. | |

**User's choice:** Warn to stderr + step summary.
**Notes:** Audit trail preserved without escalating to a fail. CONTEXT D-2.

### Q3: BUMP-05 vitest test scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Happy-path + drift cases | Two tests: same-version happy path; drift case (1.0.7/1.0.6 → both end at 1.0.8). | ✓ |
| Just happy-path | One test, literal req. | |
| Happy + drift + edge cases | Three+ tests including patch rollover and atomicity. Probably overkill. | |

**User's choice:** Happy-path + drift cases.
**Notes:** Drift case exercises the only real branch with semantics beyond a one-liner. CONTEXT D-3.

### Q4: How does bump-version.mjs hand the new version to publish.yml?

| Option | Description | Selected |
|--------|-------------|----------|
| Script writes to $GITHUB_OUTPUT | Reads env, appends `next-version=v1.0.8`. Single source of truth. | ✓ |
| Workflow re-reads package.json | Separate workflow step computes from file. Two places computing the same thing. | |
| Both | Belt-and-suspenders. Redundant. | |

**User's choice:** Script writes to $GITHUB_OUTPUT.
**Notes:** Contractual handoff; harder to break than re-read-the-file-later. CONTEXT D-4.

---

## First-run choreography

### Q1: How does v1.0.8 actually ship the first time?

| Option | Description | Selected |
|--------|-------------|----------|
| Organic | Phase 7 PR merge IS the first publish. Simplest. Highest blast radius if anything is wrong. | ✓ |
| Manual-first via workflow_dispatch | Land with a guard, fire manually on a controlled day, follow-up PR removes guard. | |
| Two-step PR | PR1 lands implementation with dry-run still live; PR2 (one-line) deletes the dry-run. | |

**User's choice:** Organic.
**Notes:** Trust Option B reversibility for recovery. CONTEXT D-5.

### Q2: Pre-merge de-risking — anything to do BEFORE merging the Phase 7 PR?

| Option | Description | Selected |
|--------|-------------|----------|
| PAT smoke + tfx --help re-verify only | Local `npx tfx extension publish --help` + local `node scripts/publish-cezari.cjs` against the same TFX_PAT. | ✓ |
| Add an explicit dry-run rehearsal step | Side-by-side workflow_dispatch rehearsal that wraps publish in `if: false`. | |
| Just merge it | Trust Option B. PAT was created out-of-band and verified by Phase 6 SC #6. | |

**User's choice:** PAT smoke + tfx --help re-verify only.
**Notes:** Closes STATE.md TODO; covers both known unknowns without delaying the PR. CONTEXT D-6.

### Q3: Post-merge verification — what counts as 'first publish landed safely'?

| Option | Description | Selected |
|--------|-------------|----------|
| Marketplace + bump commit + tag triple-check | Three independent checks captured in 07-VERIFICATION.md. Per-SC evidence. | ✓ |
| Watch the Actions run go green, trust it | Lighter-touch; treats green as proof. | |
| Add a post-publish CI step to assert all three | Self-verifying CI; partly re-implements recovery ceremony as a guard. | |

**User's choice:** Marketplace + bump commit + tag triple-check.
**Notes:** Mirrors Phase 6's `branch-protection-probe-result.md` durability shape. CONTEXT D-7.

---

## Step-summary verbosity

### Q1: How verbose should the new Phase 7 steps be in $GITHUB_STEP_SUMMARY?

| Option | Description | Selected |
|--------|-------------|----------|
| Rich — every load-bearing step writes a line | Bump, publish, commit-back, tag each emit a one-line summary block. | ✓ |
| Terse — summary only on failure or final state | Single line at the end. Less noise. | |
| None — strip step summaries entirely | Workflow stays purely functional. | |

**User's choice:** Rich — every load-bearing step writes a line.
**Notes:** First-run-organic means humans are watching; summary panel is the verification surface for ROADMAP SCs #1/#2/#4. CONTEXT D-8.

### Q2: What happens to the Phase 6 branch-protection probe step in publish.yml?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is — informational canary | Probe stays unchanged; no control-flow upgrade. | ✓ |
| Remove it — redundant once we know NOT PROTECTED | Saves ~40 lines of YAML. Loses the canary. | |
| Upgrade to a guard — fail if probe returns `protected` | Risky; probe is best-effort tri-state and can return `unknown` for token-scope reasons. | |

**User's choice:** Keep as-is — informational canary.
**Notes:** Zero cost; future-proofs against later branch-protection-on events. CONTEXT D-9.

### Q3: Tag step is `continue-on-error: true` per TAG-04 — what does its $GITHUB_STEP_SUMMARY say?

| Option | Description | Selected |
|--------|-------------|----------|
| Three explicit states | Created / Skipped / Failed — each with its own clear line including recovery hint on failed. | ✓ |
| Single line, status-marker only | `✅ Tagged v1.0.8` or `⚠️ Tag failed`; raw logs carry the recovery hint. | |
| No tag entry in summary | Treat as side-channel. | |

**User's choice:** Three explicit states.
**Notes:** Tag is the only step where 'failure does not fail the workflow', so the summary needs to disambiguate. CONTEXT D-10.

---

## Plan decomposition

### Q1: How should Phase 7 split into plans?

| Option | Description | Selected |
|--------|-------------|----------|
| 2 plans — tool + workflow (atomic), then verification SUMMARY | 07-01 ships everything; 07-02 captures the post-merge verification. | ✓ |
| 3 plans — split bump from workflow | 07-01 bump, 07-02 workflow swap, 07-03 verification. Three PRs to ship what one can. | |
| 1 plan — everything together | Single plan/PR covering implementation + verification. | |
| Leave to plan-phase | Don't lock the count. | |

**User's choice:** 2 plans — tool + workflow (atomic), then verification SUMMARY.
**Notes:** Compressed Phase-6 shape because first-run-organic eliminates the negative-case companion merge. CONTEXT D-11.

### Q2: Plan 07-02 (verification) — what does its single artifact look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror Phase 6's verification dance shape | Per-SC evidence + raw API response + cross-references — `07-VERIFICATION.md`. | ✓ |
| Lighter — just a summary paragraph + run URL | Single paragraph; less ceremony; loses per-SC evidence. | |
| Auto-generate via a script | `scripts/verify-publish.mjs` programmatically writes 07-VERIFICATION.md. Over-engineered for a one-time event. | |

**User's choice:** Mirror Phase 6's verification dance shape.
**Notes:** Reuse the user-established pattern from Phase 6. CONTEXT D-7 (verification format).

---

## Claude's Discretion

The following were captured in CONTEXT.md as planner-level decisions, not surfaced to the user:

- Filename for `bump-version.test.mjs` (location must align with existing `vitest.config.ts`).
- Whether the drift-warn block uses `## Drift reconciled` as a top-level header or nests under `## Bump`.
- Step `name:` strings throughout publish.yml (consistency with existing Phase 6 names).
- Per-step `timeout-minutes:` vs job-level inheritance.
- `tfx extension create` output path / glob.
- `vsix-1.0.8` artifact naming (matches ROADMAP SC #6 — no `v` prefix on artifact, but YES on tag per TAG-03).
- `git-auto-commit-action@v6` config block details (use bot identity; do NOT use the action's built-in tagging).
- Job-level `permissions: contents: write` upgrade location.
- Whether to include `.vsix` size figure in publish step summary.
- Whether to inline-document `[skip ci]` mechanism in workflow YAML — answered: do NOT (Phase 6 D-3 governs).

## Deferred Ideas

Explicitly noted for later phases or future milestones, captured in [07-CONTEXT.md `<deferred>`](07-CONTEXT.md):

**Phase 8 (already in roadmap):**
- OPERATIONS.md (PAT rotation, partial-failure recovery, runbooks).
- Archive `publish-cezari.cjs` + remove `publish:cezari` / `publish:public` scripts.
- PROJECT.md "Validated" promotion.

**v1.2+ (out of scope for this milestone):**
- PAT-smoke cron.
- Marketplace pre-flight reconciliation step (explicit anti-feature in REQUIREMENTS.md).
- Branch-protection-aware push escalation.
- Conventional-commits semver + CHANGELOG.
- Bundle-size trend reporting.
- Multi-environment staged promote.

**Considered during discussion but not adopted:**
- Force-fail-the-publish recovery rehearsal (SC #5 governs; can be validated post-hoc).
- `scripts/verify-publish.mjs` auto-generation (one-time event; over-engineered).
- Bumping `actions/setup-node` to @v5 as part of Phase 7 (deferred per STATE.md to v1.2+ or quick-task).
