# Research Summary — v1.1 Auto-Publish CI/CD

**Project:** Story Point Calculator (Azure DevOps Extension)
**Milestone:** v1.1 — every PR merge to master ships a Marketplace patch automatically
**Researched:** 2026-05-04 / 05
**Overall confidence:** HIGH (live npm + GitHub Releases verification on stack; HIGH on flow primitives; MEDIUM on a few `tfx-cli` flag-by-flag specifics)
**Inputs synthesized:** STACK.md (fbc728a), FEATURES.md (e82bba6), ARCHITECTURE.md (e146309), PITFALLS.md

---

## TL;DR

- **Add** `.github/workflows/publish.yml` triggered on `push: [master]` + `workflow_dispatch`; **modify** existing `ci.yml` to drop `push: [master]` (PR-only). Two workflows; deliberate split so a PR run physically cannot publish.
- **Single sequential job** in publish.yml: checkout → setup-node → npm ci → typecheck → test → build → check:size → bump (in-memory) → tfx create → publish → commit-back → tag.
- **Option B state-flow:** bump files in-memory, publish FIRST, commit + tag LAST. Failure of publish leaves master untouched (self-healing); failure of commit-back leaves Marketplace ahead of repo (rare; recoverable with manual `git tag` + `git push`).
- **No new npm deps.** All tooling (`tfx-cli@0.23.1`, webpack, vitest) already in devDependencies. New script: `scripts/bump-version.mjs` (~30 lines, ESM, atomic write of both `package.json` + `vss-extension.json`).
- **Auth:** Marketplace PAT (scope `Marketplace (publish)`, "All accessible orgs", 1-year max) stored as repo secret `TFX_PAT`; commit-back uses default `GITHUB_TOKEN` with `permissions: contents: write` (loop-guard by design + `[skip ci]` belt-and-suspenders).

---

## Stack Additions

No new runtime deps. The publish workflow uses only Actions and devDeps that already ship in v1.0.

| Component | Pin | Source | Purpose |
|-----------|-----|--------|---------|
| `ubuntu-latest` runner | (Ubuntu 24.04 floor as of May 2026) | GitHub-hosted | Match existing `ci.yml`; sidesteps Windows `spawnSync({shell})` quirks already burned in `publish-cezari.cjs` |
| `actions/checkout` | `@v5` | GitHub | `fetch-depth: 0` (tag visibility); `persist-credentials: true` (default; required for push-back) |
| `actions/setup-node` | `@v4` (NOT v5/v6) | GitHub | Node 20 LTS + `cache: 'npm'`; matches `ci.yml` exactly to keep cache key identical (warm hits across both workflows). v6 has a breaking cache-default change — defer to a future quality milestone. |
| `actions/upload-artifact` | `@v4` | GitHub | Upload `.vsix` between create and publish, retention 90d, for post-mortem inspection |
| `stefanzweifel/git-auto-commit-action` | `@v6` | Marketplace | Commit-back the bumped manifest as `github-actions[bot]` (verified-signature commit). v7 exists but bumps to Node 24 + tightens checkout dep — pin v6. |
| `tfx-cli` | `0.23.1` (already devDep, do not bump) | npm | `tfx extension create` + `tfx extension publish`; invoked via `npx tfx`, NOT global install |
| Marketplace PAT | scope `Marketplace (publish)` only, all-orgs, 1-year | aex.dev.azure.com | Stored as repo secret `TFX_PAT` (single canonical name; matches local `publish-cezari.cjs` env var) |

**Reject list:** `windows-latest` (2× cost + Windows quirks); `actions/checkout@v6`, `actions/setup-node@v6` (no v6-only feature needed; cache breaking change in setup-node v6); `release-please`/`semantic-release`/`changesets`/`phips28/gh-action-bump-version` (all assume conventional-commits or release-PR policy this milestone hasn't scoped — patch-on-every-merge is a 4-line `run:` block); `tfx --rev-version` (only mutates `vss-extension.json`, not `package.json`); `--override "{...}"` JSON (shell-quoting fragility); Microsoft Entra OIDC (documented for Azure Pipelines, NOT GH Actions; defer to v1.2+); `actions/cache` standalone (already provided by `setup-node`).

---

## Feature Decomposition

| Table stakes (MUST ship in v1.1) | Differentiators (defer to v1.2+) | Anti-features (NEVER for this extension) |
|----------------------------------|----------------------------------|------------------------------------------|
| `push: [master]` trigger + `workflow_dispatch` | Conventional-commit-driven semver (feat/fix/breaking) | GitHub Releases auto-creation (Marketplace listing IS the user-facing release surface) |
| `paths-ignore: ['**.md', '.planning/**', '.claude/**', 'docs/**']` (skips docs-only commits) | CHANGELOG.md auto-generation | Auto-merge of Dependabot PRs into publish flow |
| Concurrency `group: publish-master, cancel-in-progress: false` | Slack/Teams/email beyond GH default failure email | Codecov/coverage upload (already 100% via vitest threshold) |
| Single-job sequential gates: typecheck → test → build → check:size (reuses v1.0 npm scripts verbatim) | Multi-environment private→public staged promote | ESLint/Prettier addition (separate concern from auto-publish) |
| `scripts/bump-version.mjs` (ESM, ~30 lines) bumps BOTH `package.json` + `vss-extension.json` atomically | Bundle size trend reporting on PRs | E2E/Playwright against live ADO org |
| `[skip ci]` token in bump-commit message + `if: github.actor != 'github-actions[bot]'` job-level guard | Auto-retry on transient Marketplace 5xx | Rollback automation (Marketplace doesn't support un-publish) |
| `tfx extension create` → upload artifact → `tfx extension publish --auth-type pat --token ... --no-prompt --no-wait-validation` (two-step pattern) | PAT-smoke cron workflow (weekly) | Pinning runner OS to SHA |
| Annotated git tag `vX.Y.Z` pushed AFTER successful publish (best-effort, idempotent) | Marketplace-version reconciliation step | Auto-major/minor bump on `BREAKING CHANGE:` footer |
| Cleanup: remove `publish:cezari` + `publish:public` npm scripts AFTER first green auto-publish | Pre-flight Marketplace-version drift check | Marketplace screenshot regen (carry-over PKG-05; orthogonal milestone) |
| Operations runbook: PAT rotation, manual emergency publish, what-to-do-when-X-fails | Branch-protection-aware push (App-token / PAT bypass) | Pre-fill APPLY-03 production fix (separate v1.0 carry-over milestone) |

**Reconciliation on `paths-ignore`:** FEATURES says yes; ARCHITECTURE doesn't mention. Keep the ignore filter — `paths-ignore` only suppresses runs when ALL changed files match, so a code+docs PR still ships.

**Reconciliation on `[skip ci]`:** FEATURES correctly identifies native support (Feb 2021 changelog). ARCHITECTURE's manual `git log | grep` guard is over-engineered for the `GITHUB_TOKEN` path which already doesn't re-trigger. **Decision: rely on native parsing + actor guard; do NOT implement a manual skip step.**

---

## Architecture Flow

```
PR merged to master (push event)
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ publish.yml — single job "publish-and-release"                             │
│ concurrency: { group: publish-master, cancel-in-progress: false }          │
│   step  1  actions/checkout@v5    (fetch-depth: 0, persist-credentials)    │
│   step  2  actions/setup-node@v4  (node 20, cache: npm)                    │
│   step  3  npm ci                                                          │
│   step  4  npm run typecheck      ─┐                                       │
│   step  5  npm test -- --run       │  pre-flight gates                     │
│   step  6  npm run build           │  (any failure aborts BEFORE bump)     │
│   step  7  npm run check:size     ─┘                                       │
│   step  8  node scripts/bump-version.mjs   ← in-memory only, NO commit     │
│   step  9  npx tfx extension create --output-path dist/                    │
│   step 10  actions/upload-artifact@v4  (vsix-vX.Y.Z, retention 90d)        │
│   step 11  npx tfx extension publish --vsix dist/*.vsix \                  │
│              --auth-type pat --token "$TFX_PAT" \                          │
│              --no-prompt --no-wait-validation                              │
│            ◄═══ POINT OF NO RETURN. Above this line: master untouched.     │
│   step 12  git-auto-commit-action@v6 ("chore(release): vX.Y.Z [skip ci]")  │
│   step 13  git tag -a vX.Y.Z + git push origin vX.Y.Z (best-effort)        │
└───────────────────────────────────────────────────────────────────────────┘
```

**Option B rationale:** `tfx --rev-version` is rejected because it only edits `vss-extension.json`, not `package.json`. Our `bump-version.mjs` writes both files to the runner workspace but does NOT commit. If publish fails (network, PAT, 5xx, manifest validation), the runner is destroyed, the workspace dies, and master is still at the prior version — the next push retries cleanly with no orphan bump commit. The asymmetry making B better than A: GitHub push reliability is ~3 nines higher than Marketplace publish reliability, so the unreliable side runs first. The one residual hazard — publish OK, commit-back fails — leaves Marketplace one ahead of repo, recoverable with one manual command (documented in OPERATIONS.md).

---

## Pitfalls + Mitigations (top 10, reconciled)

| # | Pitfall | Mitigation | Phase |
|---|---------|------------|-------|
| 1 | **CI re-trigger loop** from auto-bump commit | Triple-defense: `GITHUB_TOKEN` for commit-back (anti-loop guard built in) + `[skip ci]` token in commit message + `if: github.actor != 'github-actions[bot]'` job guard | P1 |
| 2 | **Concurrent merges race the bump** (two PRs merge in <5 min, both compute v1.0.8) | `concurrency: { group: publish-master, cancel-in-progress: false }`. Run B queues until A's commit-back lands; B then re-checks-out at v1.0.8 and ships v1.0.9. Document the "3+ rapid merges fold into one publish" GitHub limitation. | P1 |
| 3 | **Publish OK but commit-back fails** (Option A would leave Marketplace ahead of master) | Adopt Option B ordering. Recovery for residual hazard: `git push origin master && git tag vX.Y.Z && git push origin vX.Y.Z`. | P2 |
| 4 | **Marketplace PAT silently expires** | 1-year max lifespan + calendar reminder 7 days before expiry + emergency manual-publish runbook + (optional v1.2) weekly cron PAT-smoke workflow. | P2 / P3 |
| 5 | **`tfx-cli` flag traps** — missing `--no-prompt` hangs CI 10 min; `--share-with` takes org names not booleans; `--token` rejects `Bearer ` prefix | Lock to a single reviewed shell line: `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation`. CODEOWNERS-pin the workflow file. | P2 |
| 6 | **Listing-asset regression** on re-publish (icon, overview, screenshots not auto-preserved if `files[]` drifts) | Pre-publish asset-audit step: `jq` walks `vss-extension.json` for asset paths and asserts each exists on disk. v1.0 baseline (icon + overview, 0 screenshots) must be preserved, NOT fixed in v1.1. | P1 |
| 7 | **Bundle-bloat gate bypassed** by misconfigured DAG or stray `continue-on-error: true` | Reuse v1.0's `npm run check:size` as a hard step. Lint workflow YAML for any `continue-on-error: true` in gate steps; fail PR review on it. | P1 |
| 8 | **Test flakiness** tempts retry-band-aid → erodes signal | Hard rule: `vitest run` (no retries). Quarantine-with-7-day-deadline procedure documented in OPERATIONS.md. NO `retry: N` ever. | P1 |
| 9 | **Over-broad `permissions:`** — default repo setting may be `write-all` | Top-level `permissions: contents: read`; expand at job-level to `contents: write` only on the publish job. No `actions:`/`pull-requests:`/`packages:`/`id-token:` scopes. | P1 |
| 10 | **Tag push fails after publish** (network blip / tag exists from prior failed run) | Idempotent tag step: skip if tag exists locally or on origin; `continue-on-error: true` on the tag step ONLY (Marketplace + commit are load-bearing; tag is human-audit nice-to-have). | P2 |

Pitfall 11 (failed publish post-bump) and 12 (branch protection) are subsumed: #11 is solved by Option B (#3 above); #12 is documented as a future contingency in a top-of-file YAML comment, no code in v1.1. Pitfall 13 (legacy script removal) is handled by P3 cleanup AFTER first green publish + runbook capture. Pitfall 7 (`GITHUB_TOKEN` no-trigger) is documentation-only.

---

## Reconciled Phase Split — RECOMMEND 3 PHASES

The four agents disagreed: STACK proposed 1–2, FEATURES 3, ARCHITECTURE 3, PITFALLS 5. **Recommendation: 3 phases.** PITFALLS' 5-phase split fragments tightly-coupled concerns (workflow scaffold, publish call, tag push) that share state and must be tested end-to-end together. STACK's 1-phase ships everything in one PR but loses the "verify gates work without touching Marketplace" safety net. The 3-phase split aligns FEATURES + ARCHITECTURE and gives a clean ladder of ascending blast radius.

### Phase 1 (continued numbering: Phase 6): Workflow scaffold + pre-flight gates + dry-run
- Modify `.github/workflows/ci.yml`: remove `push: [master]` from triggers (PR-only).
- Create `.github/workflows/publish.yml` with steps 1–7 only (gates) + a stub final step echoing `would publish vX.Y.Z`.
- Configure `concurrency`, `permissions: contents: read` at top, `paths-ignore`, actor-guard, `workflow_dispatch`.
- Verify on a feature-branch PR (ci.yml runs) and a merge-to-master (publish.yml runs gates and stops without publishing).
- **Prerequisite (NOT a phase task; one-time human action):** create `TFX_PAT` repo secret. Surface as a phase prerequisite, not a phase-2 surprise.
- **Exit criteria:** end-to-end plumbing works; secret resolves; no Marketplace state changed; bundle gate enforced; pitfalls 1, 2, 6, 7, 8, 9 verified by inspection.

### Phase 2 (Phase 7): Bump + publish + tag (Marketplace state mutation)
- Add `scripts/bump-version.mjs` (atomic write of `package.json` + `vss-extension.json`, ESM).
- Add steps 8–13 to publish.yml.
- Job-level `permissions: contents: write`.
- First real merge ships v1.0.8 to Marketplace.
- **Exit criteria:** Marketplace at v1.0.8, master has bump commit + tag, no loop, listing renders correctly per "Looks Done But Isn't" checklist.

### Phase 3 (Phase 8): Cleanup + runbooks
- Capture working `tfx` invocation in `.planning/runbooks/manual-publish.md` BEFORE deletion.
- Remove `publish:cezari` and `publish:public` from `package.json`. Optionally archive `scripts/publish-cezari.cjs` to `scripts/.archive/`.
- Write OPERATIONS.md: PAT rotation procedure, manual rollback note, branch-protection migration paths, what-to-do for each red workflow.
- `git grep -F 'publish:cezari'` returns 0 hits in non-archive paths.
- Update PROJECT.md "Validated" with v1.1 milestone summary.
- **Exit criteria:** legacy path gone; runbooks tested; milestone closeable.

---

## Critical Decision Points (opinionated)

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| **Bump source of truth** | `vss-extension.json` (mirrored to `package.json`) | Manifest is what Marketplace reads. Git tags are nice-to-have audit. Marketplace API as truth source adds a 5xx-read failure mode for no benefit. |
| **Bump tooling** | `scripts/bump-version.mjs` (ESM) — NOT `bump-patch.cjs` | ESM aligns with Node 20+ defaults and `engines.node: >=20.10.0`. Atomic write of both files. |
| **Commit-back token** | Default `GITHUB_TOKEN` + `permissions: contents: write` | No branch protection on master today; loop-guard built in; tag pushes don't need to trigger downstream workflows in v1.1. PAT/App tokens are v1.2+ contingency. |
| **Publish ordering** | Option B: bump in-memory → publish → commit-back → tag | Marketplace less reliable than git push; failure window of B is ~5–10× smaller than A. |
| **Concurrency policy** | `group: publish-master, cancel-in-progress: false` (fixed group, no `${{ github.ref }}` dimension) | Only master triggers publish; ref dimension adds nothing. Cancelling in-flight publishes is unsafe (mid-Marketplace mutation). |
| **`[skip ci]` guard** | Native parsing — DO NOT implement manual `git log` grep step | GitHub Actions parses `[skip ci]` natively since Feb 2021; manual step is redundant. Actor-guard is the one belt-and-suspenders. |
| **Listing-asset preservation** | Pre-publish `jq`-based asset-audit step in P1 | Cheap insurance against `files[]` drift. Locks current baseline (icon + overview, 0 screenshots — v1.0 PKG-05 carry-over baseline). |
| **PAT rotation cadence** | 1-year lifespan + calendar reminder + runbook entry | Microsoft caps at 1 year; weekly cron PAT-smoke is v1.2+, NOT v1.1 scope. Manual emergency-publish runbook is the safety net. |
| **Cleanup timing** | P3, AFTER first green auto-publish AND runbook capture | "Don't delete-and-pray." Soft option: rename to `publish:cezari:legacy` for one cycle if extra caution desired. |

---

## Watch Out For

1. **Branch name typo `milelstone1.1`** — current branch has typo. Not a blocker but should be raised with the user before merging to master.
2. **Marketplace version drift from a manual `publish:cezari` run during the v1.1 dev window** — first auto-publish then 500s with "Version number must increase". Mitigation: announce manual-publish freeze; enforce by P3 deletion.
3. **`master` becoming branch-protected mid-milestone** — would break commit-back silently. Verify state explicitly in P1 (one `gh api` call); document contingency in YAML comment.
4. **Two-slot concurrency limitation** — if 3+ PRs merge in <5 min, queued slots get cancelled by latest. All CODE ships in latest run; intermediate VERSIONS get folded. Document as expected, NOT a bug.
5. **`actions/checkout@v5` requires runner v2.327.1+** — GH-hosted is well past, but flag if any self-hosted runner is added later.

---

## Open Questions for the User (resolve before plan-phase)

1. **Branch name fix.** Current `milelstone1.1` (typo). Rename to `milestone1.1` before opening the milestone PR? **Default: yes, while branch is local-only.**
2. **`master` branch protection — current state?** No protection rules visible in commit history; one `gh api repos/:owner/:repo/branches/master/protection` call in P1 would confirm.
3. **Repo secret name.** `TFX_PAT` (matches existing `scripts/publish-cezari.cjs` env var, recommended) or `MARKETPLACE_PAT` (FEATURES-suggested)? **Default: `TFX_PAT`** for zero-WTF parity with local script.
4. **Precise gate names in workflow YAML.** Recommend: `Typecheck`, `Unit tests`, `Build`, `Bundle size gate`, `Bump version`, `Package vsix`, `Publish to Marketplace`, `Commit version bump`, `Tag release`. Confirm or specify alternatives (matters for status-check pinning if branch protection is added later).
5. **First-publish smoke strategy.** Skip private `--share-with cezari` smoke and let P2's first run be the smoke (recommended; Option B makes failure recoverable), or do one private smoke first? **Default: skip; first publish IS the smoke.**
6. **`scripts/publish-cezari.cjs` disposition in P3.** Delete outright or move to `scripts/.archive/`? **Default: archive; keeps grep-discoverable as institutional memory.**
7. **OPERATIONS.md vs PROJECT.md section.** Standalone file (recommended) or new section under PROJECT.md? **Default: standalone `.planning/OPERATIONS.md`.**

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm registry + GH Releases API verified live on research date |
| Features | HIGH | Flow primitives well-documented; `[skip ci]` + concurrency + `paths-ignore` confirmed via official changelog/docs |
| Architecture | HIGH on structural decisions, MEDIUM on specific `tfx-cli` flag names (verify at execution by `npx tfx extension publish --help`) |
| Pitfalls | HIGH on flow primitives, MEDIUM on `tfx-cli` flag-by-flag and listing-asset re-publish behavior |

**Overall confidence:** HIGH for proceeding to roadmap. MEDIUM areas verifiable in <5 minutes during P2 execution.

---

## Sources

**Primary (HIGH):**
- npm registry (live `npm view` for tfx-cli, action versions) — research date 2026-05-04/05
- GitHub Releases API (live) — `actions/checkout`, `actions/setup-node`, `git-auto-commit-action`
- Microsoft Learn — Publish from CLI: https://learn.microsoft.com/en-us/azure/devops/extend/publish/command-line
- microsoft/tfs-cli — extensions.md
- GitHub Docs — GITHUB_TOKEN security (anti-loop guarantee)
- GitHub Changelog — `[skip ci]` (2021-02-08, native parsing)
- GitHub Docs — Concurrency (group + cancel-in-progress)

**Secondary (MEDIUM):**
- Azure DevOps Blog — PAT publishing issue resolved (Jul 2025)
- Azure DevOps Blog — Global PAT retirement (2026-12-01 deadline)
- microsoft/tfs-cli #455 (PAT caching), #262 (`--rev-version` semantics)
