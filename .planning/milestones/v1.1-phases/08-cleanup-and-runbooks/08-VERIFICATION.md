---
phase: 08-cleanup-and-runbooks
verified: 2026-05-11T17:00:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification: []
---

# Phase 8: Cleanup & Runbooks — Verification Report

**Phase Goal:** Legacy manual-publish path is retired, operational runbooks for the auto-publish surface exist, and PROJECT.md reflects v1.1 as Validated — milestone closeable. (Expanded scope: release-branch publish model + GitHub App for verified commit-back + master ruleset re-tightened + re-verification publish run + SC #5 broken-PAT controlled exercise executed.)
**Verified:** 2026-05-11T17:00:00Z
**Status:** PASS
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP SC + CONTEXT must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | `scripts/publish-cezari.cjs` is gone from its original path; `scripts/.archive/publish-cezari.cjs` exists with ARCHIVED header | VERIFIED | File absent at original path (confirmed `scripts/publish-cezari.cjs` not found). Archive exists: `head -5 scripts/.archive/publish-cezari.cjs` shows `#!/usr/bin/env node` then the ARCHIVED block. `git log --follow` shows history: `05bda81` (archive move) + pre-move commits `e563dfe`, `51556fe`. |
| SC-2 | `package.json` has neither `publish:cezari` nor `publish:public`; the `package` script (`tfx extension create ...`) is intact | VERIFIED | `node -e "..."` confirms keys absent; `package` key present with correct value; local version `1.0.10`; JSON parses clean. |
| SC-3 | `git grep -F 'publish:cezari'` returns 0 hits outside `scripts/.archive/` and `.planning/` | VERIFIED | `git grep -lF 'publish:cezari' -- ':!scripts/.archive/' ':!.planning/'` → 0 files. README.md contains `publish-cezari` (filename-form) as documentation pointers only — the colon-form npm-script name (`publish:cezari`) appears nowhere outside the archive. Knowing deviation recorded in 08-04-SUMMARY key-decisions. |
| SC-4a | OPERATIONS.md exists, has all 6 sections, documents Marketplace-PAT-rotation (DOC-01) | VERIFIED | File at `.planning/OPERATIONS.md`, `grep -c '^## '` = 6. Section 1 contains `aex.dev.azure.com`, `All accessible organizations`, `1 year`, `Marketplace -> Publish`, `TFX_PAT -> Update secret`, revoke old token. |
| SC-4b | OPERATIONS.md documents emergency-publish runbook with exact `tfx` invocation (DOC-02) | VERIFIED | Section 2 contains exact string `npx tfx extension publish --vsix dist/*.vsix --auth-type pat --token "$TFX_PAT" --no-prompt --no-wait-validation` and `npx tfx extension create --manifest-globs vss-extension.json --output-path dist/`. |
| SC-4c | OPERATIONS.md sections 3-6 present (release-branch model + ruleset config + App steps + probe correction + recovery runbook + SC #5 exercise) | VERIFIED | Section 3: `story-point-release-bot`, `APP_PRIVATE_KEY`, GitHub App creation steps, master ruleset config, `release` ruleset guidance. Section 4: `rules/branches/master` endpoint, `GH013` reference, `gh api` snippet, link to Phase 6 probe artifact and `07-VERIFICATION.md`. Section 5: exact heading `## 5. Recovery: publish OK, commit-back failed` (D-2 mandated text), hand-bump procedure, `07-VERIFICATION.md` link. Section 6: `## 6. SC #5 / Option B reversibility`, revoke-workflow_dispatch-restore-rerun procedure, `08-SC5-EXERCISE.md` reference. |
| SC-5 | PROJECT.md "Validated" section names v1.1 as shipped with corrected release-branch model wording; "Active" placeholder removed; stale "every PR merge to master ships" wording gone | VERIFIED | `grep 'master stays fully protected'` matches in the Validated bullet + Goal line. Stale wording `Every PR merge to master ships a new patch version of the extension to Marketplace automatically, with no manual steps` absent. Active section reads `*(none — v1.1 Auto-Publish CI/CD is shipped and validated above…)*`. Validated bullet cites v1.0.8, v1.0.9, v1.0.10. OPERATIONS.md linked. Footer updated to 2026-05-11. |
| SC-6 | `publish.yml` is the release-branch model: `push:[release]` trigger, App-token-first, actor-guard extended, git-identity fix in Tag step, back-merge PR step | VERIFIED | `on.push.branches: [release]`; `workflow_dispatch` present; `paths-ignore` unchanged; `concurrency.group: publish-release`; step 1 is `actions/create-github-app-token@v2` with `app-id: ${{ secrets.APP_ID }}`; `actions/checkout@v5` has `token: ${{ steps.app-token.outputs.token }}`; actor-guard: `github.actor != 'github-actions[bot]' && github.actor != 'story-point-release-bot[bot]'`; `[skip ci]` in commit message; Tag step has `git config user.name/email` fix (commit `b64cdcd`); back-merge PR step uses `gh pr create --base master --head release` with `GH_TOKEN: ${{ steps.app-token.outputs.token }}`; no `push:[master]` trigger; no design-rationale comment blocks. |
| SC-7 | `ci.yml` covers `pull_request` on `[master, release]` with no `push:` trigger | VERIFIED | `on.pull_request.branches: [master, release]`; no `push:` trigger present. |
| SC-8 | Live GitHub state: master ruleset fully re-tightened with App on bypass; `release` branch exists with no ruleset; secrets `APP_ID`, `APP_PRIVATE_KEY`, `TFX_PAT` present; tags v1.0.8/v1.0.9/v1.0.10 on origin; three publish runs (re-verification success, broken-PAT failure, recovery success); master+release version = 1.0.10 | VERIFIED | `gh api .../rulesets/15938563`: rules = `deletion, non_fast_forward, required_linear_history, required_status_checks (Build & verify), pull_request, required_signatures`; bypass actors = RepositoryRole 5 (admin) + Integration 3677680 (story-point-release-bot App). `gh api .../rules/branches/release` = `[]` (no ruleset). `gh secret list` shows APP_ID (2026-05-11), APP_PRIVATE_KEY (2026-05-11), TFX_PAT (2026-05-11). `git ls-remote --tags origin` shows v1.0.8 (eba84b3), v1.0.9 (c3f8d3a), v1.0.10 (4bfce4d). Run history: 25680642989 (success/push), 25682108788 (failure/workflow_dispatch), 25682284821 (success/workflow_dispatch). master version 1.0.10 (via `gh api .../contents/package.json`); release version 1.0.10. |
| SC-9 | `08-SC5-EXERCISE.md` ≥ 40 lines, documents re-verification run + SC #5 safe-failure + clean-recovery | VERIFIED | 102 lines. Contains Marketplace URL, versions 1.0.9 and 1.0.10, `workflow_dispatch`, `SC #5` references. Documents safe-failure (run 25682108788: Marketplace+release unchanged, no orphan commit/tag/PR) and clean recovery (run 25682284821: v1.0.10 shipped). SC #5 disposition: "SC #5 is now FULLY verified in the wild — both halves." |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/.archive/publish-cezari.cjs` | Legacy script, frozen reference, ARCHIVED header, git history preserved | VERIFIED | ARCHIVED block lines 2-5; `git log --follow` shows moves + pre-move Phase 5 commits. `OPERATIONS.md` pointer present in header. |
| `package.json` | `publish:cezari` / `publish:public` removed; `package` script intact; valid JSON | VERIFIED | Both keys absent; `package` key = `tfx extension create...`; version 1.0.10; parses clean. |
| `.planning/OPERATIONS.md` | 6 sections, comprehensive ops doc | VERIFIED | 6 `##` sections in order; all required content verified (see SC-4a/b/c above). |
| `.planning/PROJECT.md` | v1.1 in Validated; corrected model wording; Active cleared | VERIFIED | Full Validated bullet with corrected wording, OPERATIONS.md link, shipped versions. |
| `.planning/REQUIREMENTS.md` | Tally 38; CLEAN/DOC marked complete | VERIFIED | `[x]` on CLEAN-01..03 + DOC-01..03; total line reads 38. Only one `32` (in the historical "corrected from earlier 32" note). |
| `.github/workflows/publish.yml` | Release-branch model; App-token-first; git-identity fix; back-merge PR | VERIFIED | All plan acceptance criteria satisfied (verified above). |
| `.github/workflows/ci.yml` | `pull_request` targets `[master, release]`; no `push:` | VERIFIED | Exactly as required. |
| `.planning/phases/08-cleanup-and-runbooks/08-SC5-EXERCISE.md` | ≥ 40 lines; run URLs; safe-failure + recovery evidence | VERIFIED | 102 lines; three run URLs; per-step evidence tables; SC #5 disposition statement. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `publish.yml` | `secrets.APP_ID` / `secrets.APP_PRIVATE_KEY` | `create-github-app-token@v2` `with: app-id/private-key` | VERIFIED | Both secrets confirmed present (gh secret list). Step 1 of the workflow. |
| `publish.yml` (checkout, tag, back-merge PR) | `steps.app-token.outputs.token` | `token:` / `GH_TOKEN:` threading | VERIFIED | Checkout has `token: ${{ steps.app-token.outputs.token }}`; Tag step has `env: GH_TOKEN: ${{ steps.app-token.outputs.token }}`; back-merge PR step has `env: GH_TOKEN: ${{ steps.app-token.outputs.token }}`. |
| `scripts/.archive/publish-cezari.cjs` ARCHIVED header | `.planning/OPERATIONS.md` | Comment pointer | VERIFIED | Header contains `OPERATIONS.md (section 2)`. |
| `OPERATIONS.md section 5` | `.planning/phases/07-bump-publish-tag/07-VERIFICATION.md` | Markdown link | VERIFIED | `grep -q '07-VERIFICATION' .planning/OPERATIONS.md` passes; relative markdown link present in section 5. |
| `publish.yml` App token | `release` branch ruleset bypass | Integration actor 3677680 in ruleset bypass list | VERIFIED | `gh api .../rulesets/15938563` shows Integration 3677680 with `bypass_mode: always` on the master ruleset. `release` has no ruleset (App pushes directly without restriction). |

---

### Data-Flow Trace (Level 4)

Not applicable — Phase 8 delivers documentation, workflow configuration, and cleanup artifacts. No React components or data-rendering paths were introduced.

---

### Behavioral Spot-Checks

| Behavior | Command / Evidence | Result | Status |
|----------|-------------------|--------|--------|
| Release-branch push fires publish.yml and ships a patch | Run 25680642989 — push-triggered by PR #11 merge → v1.0.9 published | Green, all steps passed | PASS |
| Broken PAT causes publish step to fail safely (Option B) | Run 25682108788 — `workflow_dispatch`, revoked PAT → `Publish to Marketplace` exits 255; commit/tag/PR steps all skipped | Failure at publish; no side-effects on release or Marketplace | PASS |
| Restored PAT re-run ships cleanly | Run 25682284821 — `workflow_dispatch`, fresh PAT → v1.0.10 published; bump commit + tag + back-merge PR all present | All green | PASS |
| `publish.yml` does NOT fire on push to master | No publish run recorded for commits ba8cdeb, 488dae8, 05bda81, 5e7f860 etc. — only paths-ignored files or no `release`-branch push | Confirmed absent from run list | PASS |
| `package.json` valid JSON, no stale scripts | `node -e "require('./package.json')"` exits 0; keys enumerated | Verified | PASS |
| `git grep` clean (CLEAN-03) | `git grep -lF 'publish:cezari' -- ':!scripts/.archive/' ':!.planning/'` → 0 files | 0 hits | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CLEAN-01 | 08-04 | Archive `publish-cezari.cjs` to `scripts/.archive/` with ARCHIVED header | SATISFIED | File present at archive path; original gone; header verified; `git log --follow` shows rename history from Phase 5 commits. |
| CLEAN-02 | 08-04 | Remove `publish:cezari` + `publish:public` from `package.json` | SATISFIED | Both keys absent; `package.json` valid JSON; `package` script intact. |
| CLEAN-03 | 08-04 | `git grep -F 'publish:cezari'` returns 0 hits outside `scripts/.archive/` and `.planning/` | SATISFIED | 0 hits confirmed by command. README has filename-form `publish-cezari` doc references only (non-scriptable) — recorded as knowing deviation in 08-04-SUMMARY. |
| DOC-01 | 08-02 | OPERATIONS.md PAT rotation procedure (1-year cadence, aex.dev.azure.com, All accessible orgs) | SATISFIED | Section 1 verified. |
| DOC-02 | 08-01 | OPERATIONS.md emergency-publish runbook with exact `tfx` invocation captured before archive | SATISFIED | Section 2 verified; invocation present; captured in Plan 08-01 before Plan 08-04 archived the script. |
| DOC-03 | 08-05 | PROJECT.md "Validated" section updated; v1.1 promoted from Active; corrected model wording | SATISFIED | Validated bullet present; Active cleared; stale wording absent; REQUIREMENTS.md tally 38. |

**Coverage:** 6/6 Phase 8 requirements satisfied. All marked `[x]` in REQUIREMENTS.md traceability table.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `.github/workflows/publish.yml` Tag step | In-workflow `# Annotated tags need a committer identity...` comment | INFO | A brief inline comment explaining a non-obvious fix (empty-ident-name bug). This is not a design-rationale block (D-3 scope); it is a code-comment explaining why `git config` is called. Acceptable — it would be confusing without it. Not a blocker. |
| Node.js 20 deprecation warnings on all 4 Actions | `create-github-app-token@v2`, `setup-node@v4`, `upload-artifact@v4`, `git-auto-commit-action@v6` still run on Node 20; runner forces Node 24 from 2026-06-02 | WARNING | Already tracked in 08-SC5-EXERCISE.md follow-ups and CONTEXT deferred list. Not a Phase 8 blocker; flagged for v1.2+ quick task. Deadline: 2026-06-02. |

No blockers found.

---

### Human Verification Required

*(none — all observable truths verified programmatically against the live GitHub state and the local working tree)*

---

### Deviations and Their Disposition

| # | Deviation | Disposition |
|---|-----------|-------------|
| D-1 | `stefanzweifel/git-auto-commit-action@v6` has no `token` input — the App credential is threaded via the `actions/checkout@v5` `token:` input (persisted credential) rather than via a `token:` input on the commit-back step | ACCEPTABLE. Net behavior identical: commit-back push uses the App identity. Documented in 08-01-SUMMARY "Deviations" section. |
| D-2 | App installation initially lacked `Pull requests: Read and write`; first attempt of run 25680642989 failed at `Mint release-bot token` | ACCEPTABLE. Nothing past token-minting had run; fully safe. User added the permission and re-ran. OPERATIONS.md §3 already lists the permission as required — this exercise confirmed why. |
| D-3 | Tag release step ran `git tag -a` with no committer identity on the v1.0.9 run → `fatal: empty ident name`; TAG-04 `continue-on-error: true` kept the workflow green | ACCEPTABLE and FIXED. `git config user.name/email` added to the Tag step (commit `b64cdcd`), reached master via PR #12. v1.0.9 tag created manually at c3f8d3a. Verified working on the v1.0.10 recovery run. Fix is live in both `master` and `release`. |
| D-4 | Back-merge PR #13 had a `version` conflict; resolved by merging master into release keeping 1.0.10 (`[skip ci]` on the conflict-resolution commit), causing PR #13's `ci.yml` check to be skipped, requiring squash-merge via owner's ruleset bypass | ACCEPTABLE. Documented in 08-SC5-EXERCISE.md follow-up #3: "a `[skip ci]` on the conflict-resolution commit also skips the back-merge PR's required `ci.yml` check." This is a one-time friction item from the version gap between master (1.0.9) and release (1.0.10) after the SC #5 exercise. OPERATIONS.md §3/§5 should note this gotcha (flagged as follow-up; not a blocking gap for milestone close). |
| D-5 | `strict_required_status_checks_policy` (Require branches to be up to date before merging) is `true` in the master ruleset | ACCEPTABLE. 08-SC5-EXERCISE.md follow-up #4 recommends leaving it OFF to reduce promotion/back-merge friction; it was set by the user and is operator's discretion. Not a phase-8 requirement. |
| D-6 | README.md contains two `publish-cezari` (filename-form) documentation references pointing at the archive; these are not npm-script invocations | ACCEPTABLE. Plan 08-04 key-decisions explicitly records this as a knowing deviation. CLEAN-03's `git grep -F 'publish:cezari'` (colon-form) check passes. The filename-form pointers are useful institutional memory. |
| D-7 | The probe step in `publish.yml` retains a brief in-code comment (`# Annotated tags need a committer identity...`) explaining the git-identity fix — not a design-rationale block | ACCEPTABLE. Short, inline, non-rationale. The D-3 convention targets design-rationale blocks in YAML; a one-line explanation of why `git config` is called mid-step is not in scope. |

---

### Gaps Summary

No gaps. All Phase 8 ROADMAP success criteria are verified against the codebase, planning artifacts, and live GitHub state.

Phase 8 delivered everything in its expanded scope:
- All 6 requirements (CLEAN-01..03, DOC-01..03) satisfied.
- The release-branch publish model is live and verified end-to-end (v1.0.9 shipped via push-triggered run).
- The `story-point-release-bot` GitHub App is installed, wired, and on the master ruleset bypass list.
- Master is fully re-tightened (PR + status checks + signed commits); `release` is light (no ruleset).
- ROADMAP Phase 7 SC #5 is fully verified in the wild (both halves — post-publish commit-back failure in Phase 7; publish-step failure with safe recovery in Phase 8).
- OPERATIONS.md is the comprehensive 6-section ops doc.
- PROJECT.md v1.1 "Validated" entry reflects the actual shipped model.
- Node 20 action deprecation (deadline 2026-06-02) is tracked but deferred to v1.2+.

**Overall Phase Verdict: PASS — milestone closeable.**

---

_Verified: 2026-05-11T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
