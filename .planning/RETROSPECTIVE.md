# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — Auto-Publish CI/CD

**Shipped:** 2026-05-11
**Phases:** 3 (6, 7, 8) | **Plans:** 10 | **Sessions:** ~5 (2026-05-05 → 2026-05-11)

### What Was Built
- `.github/workflows/publish.yml` — release-branch-triggered CI/CD: mint `story-point-release-bot` GitHub App token → 5 pre-flight gates (npm ci → typecheck → vitest run → webpack prod build → bundle ≤ 250 KB gzipped) + manifest asset audit + `TFX_PAT`/rulesets-aware-branch-protection probes → atomic in-memory version bump → `tfx extension create` (+ 90-day `vsix-X.Y.Z` artifact) → `tfx extension publish` → App commits `chore(release): vX.Y.Z [skip ci]` back to `release` → annotated tag → `release → master` back-merge PR.
- `scripts/bump-version.mjs` — ESM, atomic two-file patch bump of `package.json` + `vss-extension.json`, in-memory (Option B), max-wins drift handling. 2 vitest cases (in the 400/400 suite).
- `ci.yml` converted to PR-only on `[master, release]` (push trigger removed).
- `.planning/OPERATIONS.md` — 6-section ops runbook: Marketplace PAT rotation · manual emergency-publish runbook · release-branch model + ruleset config + GitHub App creation · rulesets-aware branch-protection probe correction · partial-failure recovery · SC #5 / Option B reversibility exercise.
- Legacy cleanup: `publish-cezari.cjs` → `scripts/.archive/` with ARCHIVED header; `publish:cezari` / `publish:public` npm scripts removed.
- Shipped in the wild: first auto-publish **v1.0.8** → release-branch re-verification **v1.0.9** → SC #5 broken-PAT recovery **v1.0.10**.

### What Worked
- **Integration-first sequencing held up again.** Phase 6 scaffolded the whole pipeline with a no-mutation dry-run echo and live-verified the two-workflow split (positive + negative merge cases via real PRs) before any Marketplace state was touched — the same risk-front-loading discipline that worked for v1.0.
- **Option B state-flow paid off exactly as designed.** When Phase 7's commit-back failed (`GH013`) and again in Phase 8's deliberate broken-PAT exercise, `master`/`release` were left untouched with no orphan commit/tag/PR — recovery was a clean re-run.
- **The milestone audit caught nothing new but confirmed coverage cheaply.** A single `/gsd-audit-milestone` pass (38/38 reqs, 3/3 phases, clean integration, E2E proven 3× in the wild) was enough to declare the milestone closeable without a retroactive verifier run on Phase 6.
- **`/gsd-complete-milestone` itself absorbed two known bookkeeping-drift items** (REQUIREMENTS.md traceability not checked off; ROADMAP.md stale goal line / progress table) — they were noted in the audit as "complete-milestone will fix" and it did.

### What Was Inefficient
- **A Phase-6 verification gap surfaced as a Phase-7 production failure.** 06-03's branch-protection probe checked only the legacy `/branches/{b}/protection` API, not rulesets — so the `master` ruleset wasn't discovered until the bot's commit-back was rejected mid-publish. v1.0.8 then had to ship via `workflow_dispatch` + a manual recovery PR + a manual tag + a ruleset relaxation. Cost: the entire Phase-7 recovery dance and a Phase-8 architecture re-design.
- **Phase 6 never produced a `06-VERIFICATION.md`.** It was live-verified via the trigger dance but skipped the standard artifact, leaving a process-record gap (functionally covered downstream, but it made the milestone audit do extra cross-referencing).
- **Phase 8 ballooned.** It started as "archive legacy script + write runbooks" (6 reqs) and grew to include a full workflow re-architecture (release-branch model + GitHub App + ruleset re-tighten + re-verification run + SC #5 exercise) — 5 plans in 4 waves. The scope expansion was the right call, but it means "Phase 8" in the roadmap badly under-describes what shipped.
- **`07-VERIFICATION.md` text was left stale** — it records SC #5 as "partially verified + variant deferred" even though Phase 8 closed it fully in the wild. Forward-references were added elsewhere but the original artifact wasn't back-updated.

### Patterns Established
- **Branch-protection probes must query rulesets, not just legacy protection** — `GET /repos/.../rules/branches/{branch}` AND `GET /repos/.../branches/{branch}/protection`. Burned once; now codified in OPERATIONS.md §4 and the `publish.yml` probe.
- **Verified commit-back from CI = a GitHub App on the ruleset bypass list**, not `github-actions[bot]` (which cannot be added to a ruleset bypass list and produces unsigned commits).
- **`OPERATIONS.md` as the single durable ops doc** for any project with a release pipeline — rotation cadences, emergency runbooks, architecture rationale, and recovery procedures in one file rather than scattered across phase summaries.
- **Capture the canonical manual invocation BEFORE archiving the script that contains it** — DOC-02 was deliberately ordered ahead of CLEAN-01.

### Key Lessons
1. **A "verification" that only checks one of two equivalent APIs is a latent production bug.** When ADO/GitHub has both a legacy and a modern surface for the same concept (branch protection vs. rulesets), probe both — the modern one is often the one actually in force.
2. **Put the flaky dependency first in any multi-step mutation.** Option B (publish → then commit/tag) made every failure mode self-healing; the inverse ordering would have left orphan tags and bump commits on every Marketplace hiccup.
3. **When a phase's scope triples mid-flight, split it or rename it.** "Phase 8: Cleanup & Runbooks" now means "Phase 8: workflow re-architecture + App + ruleset migration + re-verification + SC #5 + cleanup + runbooks" — the label lies. Either insert a decimal phase or rewrite the roadmap entry as the scope grows.
4. **Skipping a VERIFICATION.md to "verify live instead" trades a 10-minute artifact for hours of audit cross-referencing later.** Write the artifact even when the live evidence already exists.
5. **Back-update the original artifact when a later phase supersedes its conclusion** — forward-references in newer docs don't stop the stale doc from being read first.

### Cost Observations
- Model mix: predominantly opus (`model_profile: quality` in config) for planning/execution; some sonnet for sub-agents.
- Sessions: ~5 over 7 calendar days, with a multi-day gap between Phase 6 (2026-05-07) and Phases 7–8 (2026-05-11, same day).
- Notable: the Phase-7 production failure + Phase-8 re-architecture roughly doubled the milestone's effort vs. the original 3-phase / ~7-plan estimate (landed at 10 plans). A correct rulesets probe in Phase 6 would have avoided most of it.

---

## Milestone: v1.0 — MVP (Story Point Calculator)

**Shipped:** 2026-05-04
**Phases:** 6 (0–5) | **Plans:** 19 | **Sessions:** ~ (2026-05-01 → 2026-05-04)

> Retrospective written retroactively at v1.1 close — summary only.

### What Was Built
Public Visual Studio Marketplace ADO work item extension: 3-dimension Story Point calculator modal (Complexity / Uncertainty / Effort → weighted sum → Fibonacci), writes the SP field via `IWorkItemFormService` + posts an audit comment, FieldResolver for Agile/Scrum (`StoryPoints`) vs CMMI (`Size`), confirm-overwrite + reactive read-only UX, two-entry webpack build under a 250 KB gzipped gate, pure-TS calc + audit modules at 100% coverage. Shipped v1.0.0 (2026-05-02) → patch sequence to v1.0.7 (programmatic close via the `addDialog` swap, Quick task `260504-cl1`).

### Key Lessons (carried into v1.1)
1. **Integration-first sequencing works** — Phase 2 proved the iframe + contribution + dialog + theme handshake on a live org before any React UI investment; the highest-risk step failed fast (it didn't fail, but it could have, cheaply).
2. **Spike falsifiable assumptions before locking formats** — Phase 4's spike A1 falsified the sentinel-comment-survives-ADO-storage assumption (D-02 STRIPPED-FALLBACK), and A3 falsified four read-only-probe candidates (D-07 LAZY-FALLBACK-ONLY). Better to learn it in a spike than in production.
3. **A "locked" decision can still be wrong** — Phase 4 D-10 (NO-PROGRAMMATIC-CLOSE) was correct for the `openCustomDialog` code path but wrong as a universal claim; Quick task `260504-cl1` found `closeDialog()` works when paired with `addDialog()`. Scope "no X exists" claims to the code path actually tested.
4. **Lock one-way doors before the first public publish** — extension scope (`vso.work_write` only), extension ID, publisher, license. Adding a scope post-publish forces re-consent across every install.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Sessions | Key Change |
|-----------|--------|-------|----------|------------|
| v1.0 MVP | 6 (0–5) | 19 | ~ | Integration-first phase ordering; spike-driven falsification of risky assumptions |
| v1.1 Auto-Publish CI/CD | 3 (6–8) | 10 | ~5 | First milestone with a mid-flight architecture pivot (release-branch model in Phase 8); milestone-audit-then-close instead of per-phase verifier re-runs |

### Cumulative Quality

| Milestone | Tests | Coverage | Bundle (gzipped) |
|-----------|-------|----------|------------------|
| v1.0 | 398/398 | 100% on `src/calc/**` + `src/audit/**` | 147.9 KB / 250 KB |
| v1.1 | 400/400 (+2 bump-script cases) | 100% maintained | 148.4 KB / 250 KB |

### Top Lessons (Verified Across Milestones)

1. **Front-load the highest-risk integration and verify it live before building on top of it** — held in v1.0 (Phase 2 SDK handshake) and v1.1 (Phase 6 dry-run + trigger dance). The one place it slipped (the Phase-6 rulesets probe gap) is exactly where v1.1 lost the most time.
2. **Falsify, don't assume — and scope the conclusion to what was actually tested** — v1.0's D-02/D-07/D-10 and v1.1's branch-protection probe all reinforce: "X doesn't work / doesn't exist" claims that aren't scoped to the tested path become production bugs.
3. **Write the standard artifact even when live evidence already exists** — skipped VERIFICATION.md (Phase 6) and stale VERIFICATION.md text (Phase 7) both cost audit time at milestone close.
