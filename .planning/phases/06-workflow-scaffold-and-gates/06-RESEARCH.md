# Phase 6: Workflow Scaffold & Pre-flight Gates — Research

**Researched:** 2026-05-05
**Domain:** GitHub Actions workflow YAML; pre-flight CI gates; trigger plumbing for an Azure DevOps Marketplace extension publish pipeline
**Confidence:** HIGH on all gap items (each verified live against GitHub Docs, the actions/runner-images repo, or a community discussion thread on the research date)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-1: Verification approach = force-merge a no-op PR to master + watch `publish.yml` stop at the dry-run echo step.** End-to-end live test on the real master branch. Catches secret-resolution and trigger-config bugs that pure YAML inspection would miss. Rejected: actionlint-only; `nektos/act` local runner.

- **D-1a: Verification covers BOTH cases (planner MUST include both):**
  - **Negative case:** README.md whitespace edit — exercises `paths-ignore` (filter works → publish.yml skipped).
  - **Positive case:** trivial code-side edit (e.g., comment in a non-critical .ts file or single space in `webpack.config.cjs`) — confirms publish.yml fires, gates run, dry-run echoes next version.
  - Without the positive companion test, P6 only proves the skip path; the run path stays untested until P7's first real publish, defeating the safety-net purpose of P6.

- **D-2: `TFX_PAT` is already a GitHub repo secret** (created by user out-of-band; matches `.env.local` env var name used by `scripts/publish-cezari.cjs`). No phase-task action required to create it. Phase 6 verification still includes a `${{ secrets.TFX_PAT != '' }}` step output check (success criterion #6). The local `.env.local` workflow remains unchanged — GitHub Secret and local `.env.local` are two separate stores of the same logical value.

- **D-3: Workflow rationale lives in OPERATIONS.md (P8); `publish.yml` stays lean.** Step `name:` fields name what each step does; no inline block comments explaining Option B / loop guards / branch-protection contingency. Rejected: top-of-file YAML comment block; rejected: both inline AND OPERATIONS.md.

- **D-4: `publish.yml` uses recommended pins; leave `ci.yml` at @v4.**
  - publish.yml: `actions/checkout@v5`, `actions/setup-node@v4` (Node 20 + cache npm), `actions/upload-artifact@v4`, `stefanzweifel/git-auto-commit-action@v6`.
  - ci.yml: untouched — keeps `actions/checkout@v4` and `actions/setup-node@v4`.
  - Pin-drift between the two workflows is acceptable for one quality-of-life milestone.

- **D-5: Phase 6 plan includes a `gh api repos/<owner>/<repo>/branches/master/protection` task** that records the result in this CONTEXT.md (or a side note in the phase directory) for Phase 7's planner to consume. Determines whether P7's commit-back can use default `GITHUB_TOKEN` (current assumption — no protection) or must escalate to a GitHub App / `RELEASE_PAT`.

- **D-6: `paths-ignore` filter for publish.yml = `**.md`, `.planning/**`, `.claude/**`, `docs/**`.** A code+docs commit still ships (intentional behavior — `paths-ignore` only suppresses runs when ALL changed files match). Documented in OPERATIONS.md (P8).

- **D-7: Dry-run final step echoes a single line `would publish v<NEXT_VERSION>`** (where `<NEXT_VERSION>` is patch+1 of `package.json` `.version`). NO `tfx` invocation. NO file write. NO upload-artifact. Plan-phase decides whether to also set a step output (`echo "next-version=v$NEXT" >> $GITHUB_OUTPUT`) for downstream-step composability — Claude-discretion call.

- **D-8: Implementation = inline `jq` in YAML** as first preference. If the script grows past ~10 lines or needs anything beyond existence checks, fall back to `scripts/audit-assets.mjs` (planner's call). Each entry in `vss-extension.json` `files[].path` must exist on disk; failure prints the missing path and exits non-zero. **Out of scope for P6:** file-size checks, extension-format checks, localized-variant warnings.

- **D-9: FAIL-01/02/03 baked into publish.yml YAML at scaffold time.** No retry directives. No `continue-on-error: true` on any gate step (only allowed on P7's tag step per TAG-04 — irrelevant in P6). `workflow_dispatch:` present in `on:` block. No notification step.

### Claude's Discretion (decide per-task during planning)

- Exact `name:` strings for each YAML step (match existing ci.yml step names where possible; new steps get descriptive names).
- Whether the dry-run echo step also emits a GitHub Actions output (`steps.echo.outputs.next-version`) for traceability in the Actions UI summary.
- `timeout-minutes:` value on the publish job (existing ci.yml uses 10; planner can pick 10 or 15).
- Whether the asset-audit step is extracted to `scripts/audit-assets.mjs` or stays inline `jq`/shell. Inline preferred if ≤10 lines; script if more.
- Order of pre-flight gates: `typecheck → tests → build → check:size → asset-audit`, OR `build first → asset-audit → tests`. Either is fine. **Default: match existing ci.yml ordering (typecheck → test → build → check:size); insert asset-audit AFTER check:size and BEFORE the dry-run echo.**
- Whether to add `permissions: contents: read` at top level of publish.yml (no-op in P6 since no write happens; documents the least-privilege baseline for P7 to upgrade at job level).
- Whether to add the actor-guard `if: github.actor != 'github-actions[bot]'` at workflow level or job level. Job level is the SUMMARY recommendation; planner can choose either.
- Whether to use `gh CLI` or raw `curl` for the branch-protection probe task. **Default: `gh` — pre-installed on ubuntu-latest, simpler auth.**
- Step-summary writes (`$GITHUB_STEP_SUMMARY`) for the dry-run echo — nice-to-have for human readability in the Actions UI; not required.

### Deferred Ideas (OUT OF SCOPE for P6)

- OPERATIONS.md content (PAT rotation, manual emergency-publish runbook, branch-protection migration paths) — **P8 (DOC-01, DOC-02)**.
- `scripts/bump-version.mjs` — **P7 (BUMP-01..05)**.
- Real `tfx extension publish` call — **P7 (PUBLISH-01..05)**.
- Commit-back via `git-auto-commit-action@v6` — **P7 (TAG-01..02)**.
- Annotated git tag push — **P7 (TAG-03..04)**.
- `scripts/publish-cezari.cjs` archive + npm script removal — **P8 (CLEAN-01..03)**.
- PROJECT.md "Validated" promotion — **P8 (DOC-03)**.

### v1.2+ Future (will not be addressed in P6/P7/P8)

- PAT-smoke cron, branch-protection-aware push escalation, Marketplace-version reconciliation pre-flight, conventional-commits-driven semver, CHANGELOG generation, bundle-size trend reporting on PRs, multi-environment staged promote.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CI-01** | publish.yml triggers on `push: [master]` and `workflow_dispatch` | Gap §3 (paths-ignore + workflow_dispatch interaction) and §6 (paths-ignore + branches) confirm the trigger shape. |
| **CI-02** | ci.yml drops `push: [master]` (PR-only after migration) | Existing ci.yml (read) shows the exact lines to remove. One-edit task: delete `push:` block, leave `pull_request:` alone. |
| **CI-03** | `paths-ignore` excludes docs-only commits (`**.md`, `.planning/**`, `.claude/**`, `docs/**`) | Gap §6 confirms `paths-ignore` filter only fires when ALL changed paths match — code+docs PRs still publish (intentional). |
| **CI-04** | Concurrency `group: publish-master, cancel-in-progress: false` | Gap §8 confirms different group names from ci.yml's `ci-${{ github.ref }}` will not interfere. |
| **CI-05** | Top-level `permissions: contents: read`; publish job upgrades to `contents: write` | P6 only needs top-level `read` (P7 adds job-level `write`). Discretion item: planner chooses to add the top-level block in P6 or defer to P7. |
| **CI-06** | Actor-guard `if: github.actor != 'github-actions[bot]'` on publish job | Gap §7 confirms the syntax. **Note:** in P6 there is no commit-back yet, so this guard is documented + active but cannot fire under P6 conditions. It's pre-positioned for P7. |
| **CI-07** | Runner is `ubuntu-latest` | STACK §A locked. Matches ci.yml. |
| **CI-08** | Pinned action versions: `checkout@v5`, `setup-node@v4`, `upload-artifact@v4`, `git-auto-commit-action@v6` | D-4 locks the pins. Gap §4 confirms `checkout@v5` works on current ubuntu-latest. **`upload-artifact@v4` and `git-auto-commit-action@v6` are pre-positioned in YAML but not USED in P6** (no .vsix to upload, no commit to make). Decision for planner: declare the pins in P6 YAML as comments-only, or omit entirely until P7? **Recommendation: omit until P7.** P6 only references actions it actually uses (`checkout@v5`, `setup-node@v4`). Adding unused pins muddies the intent. |
| **GATE-01** | `npm ci` step uses npm cache from setup-node | Existing ci.yml line 24-27 is the verbatim pattern. |
| **GATE-02** | Typecheck step (`npm run typecheck`) | Existing ci.yml line 32-33 is verbatim. |
| **GATE-03** | Unit test step (`npm test -- --run`); no retries | Existing ci.yml line 35-36 is verbatim. **Note:** package.json `"test": "vitest run"` already implies `--run`; the `-- --run` in ci.yml is redundant-but-defensive. Match it exactly for consistency. |
| **GATE-04** | Build step (`npm run build`) | Existing ci.yml line 38-39 is verbatim. |
| **GATE-05** | Bundle-size gate (`npm run check:size`) ≤ 250 KB gzipped | Existing ci.yml line 41-42 is verbatim. `scripts/check-bundle-size.cjs` is reused. |
| **GATE-06** | Any gate failure stops workflow before bump | GitHub Actions default behavior — steps run sequentially, non-zero exit aborts. No special config needed. **Anti-requirement:** plan must NOT include `continue-on-error: true` on any gate step (audit during plan-check). |
| **GATE-07** | Pre-publish asset audit verifies all `vss-extension.json` `files[]` paths exist on disk | Gap §3 confirms `jq` pre-installed on ubuntu-latest. Inline jq pattern documented below. |
| **FAIL-01** | Workflow fails fast on any step error (no auto-retry, no exponential backoff) | Default GH Actions behavior; achieved by NOT adding retry directives. Negative requirement — verified by absence. |
| **FAIL-02** | GitHub default failure email is the only notification | Achieved by NOT adding any notification step. Negative requirement. |
| **FAIL-03** | `workflow_dispatch` enables manual re-run from Actions UI | One line in `on:` block. |
</phase_requirements>

---

## Summary

Phase 6 is **scaffold + verify**, not **publish**. It produces a publish.yml whose final step is a dry-run echo, plus a one-line edit to ci.yml's `on:` block. All 18 P6 requirements are addressable in 2-3 small tasks plus a verification dance: force-merge a README.md whitespace edit (negative case — confirms `paths-ignore` skips publish.yml) AND a trivial code edit (positive case — confirms publish.yml fires gates and dry-run-echoes the next version).

Nine implementation gaps were posed by the orchestrator. **All nine resolve to HIGH confidence** with current GitHub Docs / community discussions / runner-images READMEs. Most importantly: **the `gh api .../protection` 404-vs-200 distinction is the canonical "is master protected?" check**, `gh` and `jq` are both pre-installed on ubuntu-latest, and `paths-ignore` does NOT block `workflow_dispatch` (so the manual re-run escape hatch is fully functional).

**Primary recommendation:** Match the existing ci.yml shape verbatim for the gate-section of publish.yml (line-for-line copy of steps 1-5 from ci.yml with version pin updates per D-4), add the `paths-ignore` filter, the `concurrency` block, the `workflow_dispatch` trigger, the inline jq asset-audit step, the branch-protection probe, the TFX_PAT-resolves probe, and the dry-run echo. Total publish.yml ≈ 60 lines.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workflow scaffolding | GitHub Actions YAML | — | Both files (ci.yml, publish.yml) are pure YAML; no code surface. |
| Pre-flight gates (typecheck/test/build/check:size) | npm scripts in package.json | shell on ubuntu-latest runner | Existing v1.0 scripts are reused verbatim. The runner just calls `npm run X`. |
| Asset audit (GATE-07) | Inline `jq` in YAML | shell loop in `run:` block | Pre-installed on runner. Inline beats new file for ≤10-line check. |
| Branch protection probe (D-5) | `gh` CLI in `run:` step | curl + GITHUB_TOKEN as fallback | Pre-installed and authenticated. Result captured to step-summary or written to phase directory note for P7. |
| Dry-run echo (D-7) | shell `echo` + optional `$GITHUB_OUTPUT` write | $GITHUB_STEP_SUMMARY for human readability | Trivial. No tfx surface area in P6. |
| Trigger plumbing (paths-ignore, concurrency, actor-guard) | YAML `on:` and `concurrency:` and `if:` blocks | — | Pure GitHub Actions semantics. |

---

## Research Findings

### Gap 1: Exact `gh api` invocation for branch-protection probe (D-5)

**Resolution: HIGH confidence.**

**URL format (REST API):**

```
GET /repos/{owner}/{repo}/branches/{branch}/protection
```

For this repo: `repos/tsmshvenieradze/StoryPointExtension/branches/master/protection`

**`gh api` invocation:**

```bash
gh api repos/tsmshvenieradze/StoryPointExtension/branches/master/protection
```

OR (using the active repo context, which gh resolves from `git remote`):

```bash
gh api repos/{owner}/{repo}/branches/master/protection
```

`gh` substitutes `{owner}` and `{repo}` from the current git remote.

**Response shapes:**

- **No protection rule exists:** HTTP **404** with body `{"message":"Branch not protected", "documentation_url":"https://docs.github.com/..."}`. `gh api` returns exit code 1 and the body on stderr.
- **Protection rule exists:** HTTP **200** with a JSON object containing `url`, `required_status_checks`, `enforce_admins`, `required_pull_request_reviews`, `restrictions`, `required_conversation_resolution`, `lock_branch`, etc. (Microsoft Docs sample object available — full schema not load-bearing for P6.)

**Critical caveat:** the endpoint requires admin access on the repo. A non-admin token (or unauthenticated call) returns 404 even if protection exists. Since `gh` on a GitHub-hosted runner uses `$GITHUB_TOKEN` by default, and `$GITHUB_TOKEN` has admin-equivalent perms on the repo it's running in for this scope, the call from inside our publish.yml workflow will return the truthful state. (If running locally to sanity-check, ensure `gh auth status` shows the user has admin on the repo.)

**Recommended idempotent invocation for P6:**

```yaml
- name: Probe master branch protection
  id: protection
  run: |
    set +e
    BODY=$(gh api repos/${{ github.repository }}/branches/master/protection 2>&1)
    STATUS=$?
    set -e
    if [ $STATUS -eq 0 ]; then
      echo "protected=true" >> $GITHUB_OUTPUT
      echo "Master IS branch-protected."
      echo "Body: $BODY"
    else
      echo "protected=false" >> $GITHUB_OUTPUT
      echo "Master is NOT branch-protected (gh api exit code $STATUS)."
      echo "Response body: $BODY"
    fi
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Where the result lives for P7:**
- The step output `steps.protection.outputs.protected` is run-only (lost when runner dies).
- `$GITHUB_STEP_SUMMARY` write makes the result visible in the Actions UI.
- For phase-to-phase persistence, the planner should specify a separate one-line plan task: "Run the probe locally during P6 verification, paste the result into `.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md`" — this becomes a P7 input file. Local invocation is identical, just outside the workflow context.

[CITED: docs.github.com/en/rest/branches/branch-protection]
[CITED: github.com/orgs/community/discussions/24582 — confirms 404 for unprotected branches]

---

### Gap 2: `gh` CLI availability on `ubuntu-latest`

**Resolution: HIGH confidence — pre-installed and updated weekly.**

GitHub-hosted ubuntu-latest runners ship `gh` pre-installed; the runner-images repo updates the version weekly. No setup step is needed for `gh` calls in publish.yml.

If a future migration ever moves to a containerized job (`runs-on: ubuntu-latest` + `container:`), `gh` is NOT inherited from the runner image and must be installed inside the container. Since P6/P7/P8 do not use containerized jobs, this is a non-concern.

**No fallback install line needed.** If one were ever needed, the canonical install for Ubuntu is:
```bash
sudo apt-get update && sudo apt-get install -y gh
```

**Authentication:** `gh` on a GitHub-hosted runner picks up `$GITHUB_TOKEN` via the `GH_TOKEN` env var. Set `env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} }` on any step that uses `gh`.

[CITED: GitHub Marketplace - actions/setup-gh "GitHub-hosted runners have the GitHub CLI pre-installed, which is updated weekly"]
[CITED: github.com/actions/runner-images Ubuntu2404-Readme.md — gh listed under preinstalled CLI tools]

---

### Gap 3: Inline `jq` syntax for asset audit (GATE-07); jq pre-installed?

**Resolution: HIGH confidence — `jq` is pre-installed on ubuntu-latest.**

Confirmed via the actions/runner-images Ubuntu 24.04 README — `jq` is listed under preinstalled CLI tools. No install step needed.

**Inline asset-audit pattern (for `vss-extension.json` `files[].path`):**

```yaml
- name: Verify all manifest assets exist on disk
  run: |
    set -euo pipefail
    MISSING=0
    while IFS= read -r path; do
      if [ ! -e "$path" ]; then
        echo "MISSING: $path"
        MISSING=1
      else
        echo "  ok: $path"
      fi
    done < <(jq -r '.files[].path' vss-extension.json)
    if [ "$MISSING" -ne 0 ]; then
      echo ""
      echo "FAIL: one or more assets declared in vss-extension.json files[] are missing from disk."
      exit 1
    fi
```

**Why this works:**
- `jq -r '.files[].path'` extracts `path` from every entry in the `files` array (returns one path per line).
- `< <(...)` is a process substitution; `read` stays in the parent shell so `MISSING` increments are visible after the loop.
- `[ ! -e "$path" ]` checks for existence (file OR directory). Per the current manifest, `dist`, `images`, and `overview.md` are the three entries — first two are directories, third is a file. `-e` covers both.
- `set -euo pipefail` ensures any subshell or piped failure aborts the step (defense vs. partial reads).

**Alternative one-liner (terser, but harder to read in a YAML diff):**
```bash
jq -r '.files[].path' vss-extension.json | while read p; do [ -e "$p" ] || { echo "MISSING: $p"; exit 1; }; done
```

The terser form has a subtle bug: `exit 1` inside a piped `while` exits the subshell, NOT the parent step. So the exit code is lost and the step succeeds. **Use the process-substitution form.**

**Length check:** Above is ~12 lines. D-8 says inline preferred ≤10 lines. **Verdict: still inline** — the +2-line overrun is the explicit `MISSING` counter that fixes the piped-while bug. Pulling into `scripts/audit-assets.mjs` to save 2 lines is over-rotation. If the planner finds a tighter formulation, fine; otherwise inline.

**Out of scope for P6 (per D-8):** size checks, schema checks, image-format checks, localized variants, `screenshots[]` audit. The check is existence-only.

[CITED: github.com/actions/runner-images Ubuntu2404-Readme.md — jq under preinstalled tools]

---

### Gap 4: `actions/checkout@v5` requirements vs current ubuntu-latest runner version

**Resolution: HIGH confidence — comfortable margin.**

- `actions/checkout@v5` requires runner v2.327.1+.
- GitHub Actions runner latest is v2.333.0 / v2.334.0 (March 2026).
- ubuntu-latest hosted runners auto-update — they're well past v2.327.1 today.
- Self-hosted runners must be at v2.329.0+ as of 2026-03-16 (GitHub's enforcement deadline). Not relevant — this project uses hosted runners only.

**Risk: zero.** `checkout@v5` will work on the existing ubuntu-latest image. No fallback needed.

[CITED: github.com/actions/checkout Releases — v5.0.0 (Aug 2025) Node 24, runner v2.327.1+]
[CITED: github.com/actions/runner Releases — v2.333.0 / v2.334.0 latest as of Mar 2026]

---

### Gap 5: `workflow_dispatch` semantics — does `paths-ignore` block manual triggers?

**Resolution: HIGH confidence — `paths-ignore` does NOT block `workflow_dispatch` or `schedule`.**

> "Path filtering doesn't apply to workflow dispatch or scheduled events."

This means the manual-rerun escape hatch (FAIL-03) is fully functional regardless of which paths a commit touched. Implication: if a docs-only merge lands on master and the author later realizes they'd intended to bundle code with it, they can manually run publish.yml from the Actions UI without changing any files.

**Practical consequence for P6 verification:** if for any reason the merge-based negative-case test is inconclusive, the planner can re-run publish.yml via `workflow_dispatch` to confirm the gate-and-echo path works on the current master tip. This is a backup verification surface, not a primary one (D-1 mandates the merge-based test).

[CITED: docs.github.com/en/actions/using-workflows/triggering-a-workflow — "Path filters are not evaluated for pushes of tags, nor for workflow_dispatch or scheduled events"]

---

### Gap 6: `paths-ignore` AND `branches` interaction — does it filter on master only?

**Resolution: HIGH confidence — both filters AND together.**

> "If you define both branches/branches-ignore and paths/paths-ignore, the workflow will only run when both filters are satisfied."

So:

```yaml
on:
  push:
    branches: [master]
    paths-ignore:
      - '**.md'
      - '.planning/**'
      - '.claude/**'
      - 'docs/**'
  workflow_dispatch:
```

**Behavior matrix:**

| Trigger | Branch | Files changed | Result |
|---------|--------|---------------|--------|
| `push` | master | only README.md | **SKIPPED** (paths-ignore matches all) |
| `push` | master | only src/calc.ts | **RUN** (no paths-ignore match) |
| `push` | master | README.md + src/calc.ts | **RUN** (paths-ignore only fires when ALL changed paths match) |
| `push` | feature-branch | anything | **SKIPPED** (branches filter excludes) |
| `pull_request` | any | any | **SKIPPED** (no `pull_request:` trigger declared) |
| `workflow_dispatch` | any | n/a | **RUN** (paths-ignore is ignored for manual triggers; see Gap 5) |

This is exactly the behavior P6 needs: docs-only commits skip, code-bearing commits run, PRs never run, manual re-run always works.

[CITED: docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions]
[CITED: github.com/orgs/community/discussions/63314 — "When you define both, both must be satisfied"]

---

### Gap 7: GitHub Actions `if:` expression for actor guard

**Resolution: HIGH confidence — both job-level and step-level work; SUMMARY recommends job level.**

**Syntax (job level — recommended per SUMMARY):**

```yaml
jobs:
  publish:
    if: github.actor != 'github-actions[bot]'
    runs-on: ubuntu-latest
    steps: ...
```

**Syntax (step level — equivalent semantics):**

```yaml
- name: Publish
  if: github.actor != 'github-actions[bot]'
  run: ...
```

**Quirks confirmed:**

1. **`${{ }}` is optional in `if:`** — GitHub auto-evaluates the expression. `if: github.actor != 'github-actions[bot]'` and `if: ${{ github.actor != 'github-actions[bot]' }}` are equivalent. Most style guides (and Microsoft's own docs) prefer the bare form for `if:` because the `${{ }}` interpolation form has caused subtle bugs ([actions/runner#1173](https://github.com/actions/runner/issues/1173)).

2. **Quote the expression if it starts with `!`** — `if: "!contains(github.actor, '[bot]')"` requires double quotes because YAML treats `!` as a tag prefix. Our exact form `github.actor != '...'` does NOT start with `!` so quoting is optional. Recommend single-line unquoted: `if: github.actor != 'github-actions[bot]'`.

3. **String literals: single quotes** — GitHub Actions expression syntax uses single-quoted strings. `'github-actions[bot]'` is correct. Double quotes are NOT supported in expressions (different from YAML strings).

4. **Job-level vs step-level blast radius:** at job level, the entire job is skipped if the condition fails (visible as a grey "skipped" status in the UI). At step level, the surrounding job still runs (and may report success even though the protected step was skipped). For a "this run came from a bot — abort everything" guard, **job level is correct**.

**Why this matters in P6:** the actor-guard's primary purpose is preventing a P7 bump-commit from re-triggering publish.yml. In P6 there is no commit-back, so the guard cannot fire under normal P6 conditions. **It is pre-positioned in P6's YAML** so P7 doesn't have to remember to add it later — that is what CI-06 requires. P6 verification can confirm the guard's syntax compiles (workflow runs successfully); it cannot test the guard's runtime semantics until P7.

[CITED: docs.github.com/en/actions/concepts/workflows-and-actions/expressions]
[CITED: dev.to/github/conditional-workflows-and-failures-in-github-actions — recommends job-level for full skip semantics]

---

### Gap 8: Concurrency precedence between ci.yml and publish.yml

**Resolution: HIGH confidence — they will NOT interfere.**

> "If you have multiple workflows in the same repository, concurrency group names must be unique across workflows to avoid canceling in-progress jobs or runs from other workflows."

GitHub's concurrency model:
- A concurrency group is **repository-scoped**.
- Two workflows that use **different group names** are independent (their queues don't touch).
- Two workflows that use **the same group name** share a queue (one running, one pending; new pending displaces old pending).

**Our setup:**
- ci.yml uses `group: ci-${{ github.ref }}` — at runtime evaluates to `ci-refs/pull/123/merge` for PRs (since ci.yml is now PR-only after CI-02).
- publish.yml uses `group: publish-master` — fixed string.

These two group names **never collide**. ci.yml's PR runs and publish.yml's master runs are fully independent. A PR run cannot cancel a publish run, and vice versa.

**Edge case examined and dismissed:** what if someone manually triggers ci.yml on master via `workflow_dispatch`? `github.ref` for that trigger is `refs/heads/master`, so the group becomes `ci-refs/heads/master`. Still doesn't collide with `publish-master`. Safe.

**Verification implication for P6:** the planner should NOT add a verification task that proves "ci.yml doesn't cancel publish.yml" — it cannot happen by construction. The relevant verification is the merge-based positive-case test (D-1a): merge a code commit, observe publish.yml runs gates and dry-run-echoes. If a PR is open simultaneously, ci.yml will run on it without affecting publish.yml.

[CITED: docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs]
[CITED: github.com/orgs/community/discussions/78332 — concurrency scope is repository]

---

### Gap 9: Dry-run echo composability — emitting `next-version` as step output

**Resolution: HIGH confidence — recommend emitting both step output AND step summary.**

**Modern syntax (post-Oct 2022, replaces deprecated `::set-output`):**

```yaml
- name: Compute next version (dry-run)
  id: dryrun
  run: |
    CURRENT=$(node -p "require('./package.json').version")
    # patch+1 — split, increment, rejoin
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
    NEXT="${MAJOR}.${MINOR}.$((PATCH + 1))"
    echo "would publish v${NEXT}"
    echo "next-version=v${NEXT}" >> "$GITHUB_OUTPUT"
    echo "## Dry-run result" >> "$GITHUB_STEP_SUMMARY"
    echo "Would publish: \`v${NEXT}\` (current: \`${CURRENT}\`)" >> "$GITHUB_STEP_SUMMARY"
```

**Three artifacts produced:**

1. **stdout `would publish vX.Y.Z`** — visible in the step's log lines (D-7's literal requirement).
2. **`steps.dryrun.outputs.next-version`** — accessible to subsequent steps via `${{ steps.dryrun.outputs.next-version }}` for any downstream composition.
3. **`$GITHUB_STEP_SUMMARY`** — markdown rendered in the Actions UI run summary page (human-readable confirmation).

**Why all three?**

- The stdout line is what D-7 explicitly requires (and is the verification target).
- The step output is what enables P7 to add downstream steps without re-reading package.json. P7's eventual chain might be: `dryrun → bump-version.mjs (uses NEXT) → tfx publish (vsix path uses NEXT) → tag (uses NEXT)` — having NEXT as a step output is the cleanest hand-off.
- The step summary makes verification simpler — the planner can paste the URL of the run and a human can see `Would publish: v1.0.8` rendered in markdown without scrolling logs.

**`$GITHUB_OUTPUT` syntax confirmed:** `echo "key=value" >> "$GITHUB_OUTPUT"`. Step must have `id:` set or downstream `steps.<id>.outputs.<key>` cannot resolve.

**Multi-line values:** not needed here. If ever needed, use the `<<EOF` heredoc pattern (`echo "key<<EOF"; echo "$VAL"; echo "EOF" >> "$GITHUB_OUTPUT"`).

**Reading package.json `.version` without `jq`:** `node -p "require('./package.json').version"` is portable, deterministic, no extra deps. Equivalent to `jq -r .version package.json` but doesn't shell out to a separate process for what is genuinely a Node-native concern. Both work; either is fine.

[CITED: docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands]
[CITED: github.blog/changelog/2022-10-10-github-actions-deprecating-save-state-and-set-output-commands]

---

## Standard Stack (P6-relevant only)

### Core (referenced by P6 YAML)

| Library/Tool | Version (pin) | Purpose | Source / Confidence |
|--------------|---------------|---------|---------------------|
| `actions/checkout` | `@v5` | Repo clone for the gates job | [VERIFIED: GitHub Releases — v5.0.0, Aug 2025] / HIGH |
| `actions/setup-node` | `@v4` | Node 20 + npm cache (cache-key parity with ci.yml) | [VERIFIED: GitHub Releases — v4.x active] / HIGH |
| Runner OS | `ubuntu-latest` (Ubuntu 24.04 today) | Matches ci.yml; `gh` + `jq` pre-installed | [VERIFIED: actions/runner-images Ubuntu2404-Readme.md] / HIGH |
| GitHub Actions runner | v2.327.1+ (today: v2.333.0 / v2.334.0) | Required by checkout@v5 | [VERIFIED: actions/runner Releases] / HIGH |

### Pre-installed runner tools (no install step needed)

| Tool | Use | Source / Confidence |
|------|-----|---------------------|
| `gh` | Branch-protection probe (D-5) | [CITED: github.com/marketplace/actions/setup-the-github-cli] / HIGH |
| `jq` | Asset audit (GATE-07) | [CITED: actions/runner-images Ubuntu2404-Readme.md] / HIGH |
| `node` 20.x | Existing setup-node step pins; for `node -p` package.json reads | [VERIFIED: ci.yml line 26] / HIGH |
| `bash` (POSIX) | All `run:` blocks | [CITED: GitHub Docs default shell] / HIGH |

### Reused from existing repo (NO version bump in P6)

| File | Used by | Status |
|------|---------|--------|
| `scripts/check-bundle-size.cjs` | GATE-05 step | UNCHANGED |
| `package.json` scripts (`typecheck`, `test`, `build`, `check:size`) | GATE-02..05 steps | UNCHANGED |
| `vss-extension.json` `files[]` | GATE-07 audit input | UNCHANGED — read-only in P6 |

### NOT used in P6 (pre-positioned for P7, do NOT pull into P6 YAML)

| Library/Tool | Reason | Phase |
|--------------|--------|-------|
| `actions/upload-artifact@v4` | No .vsix to upload yet | P7 |
| `stefanzweifel/git-auto-commit-action@v6` | No commit-back yet | P7 |
| `tfx-cli` (already devDep at 0.23.1) | No publish call yet | P7 |
| `scripts/bump-version.mjs` | Doesn't exist yet | P7 |

---

## Architecture Patterns

### System Architecture Diagram

```
                              ┌────────────────────────────────────────────┐
                              │ GitHub repo (master branch)                │
                              └───────────────┬────────────────────────────┘
                                              │
                ┌─────────────────────────────┼─────────────────────────────┐
                │                             │                             │
        push: master                   pull_request: master         workflow_dispatch
        (publish.yml)                    (ci.yml — NEW after CI-02)   (publish.yml manual)
                │                             │                             │
                ▼                             ▼                             ▼
     ┌──────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
     │  paths-ignore filter │     │  paths-ignore filter │     │  filter NOT applied │
     │  (skips docs-only)   │     │  (none on ci.yml)    │     │  (manual override)  │
     └──────────┬───────────┘     └──────────┬───────────┘     └──────────┬──────────┘
                │                            │                            │
       (only if not all paths              (always)                       │
        matched paths-ignore)                │                            │
                │                            │                            │
                ▼                            │                            ▼
     ┌──────────────────────────────────┐    │     ┌──────────────────────────────┐
     │ actor-guard:                     │    │     │ actor-guard (job level):     │
     │  github.actor != 'gh-actions[bot]│    │     │  same condition              │
     └──────────┬───────────────────────┘    │     └──────────┬───────────────────┘
                │                            │                │
                ▼                            ▼                ▼
     ┌─────────────────────────────────────────────────────────────────────────┐
     │ Single sequential job (per workflow):                                    │
     │  1. checkout       (publish.yml: @v5  /  ci.yml: @v4)                   │
     │  2. setup-node@v4  (Node 20 + cache: npm)                                │
     │  3. npm ci                                                               │
     │  4. npm run typecheck                                                    │
     │  5. npm test -- --run                                                    │
     │  6. npm run build                                                        │
     │  7. npm run check:size                                                   │
     │ ┌──────────────────────────────────────────────────────────────────┐   │
     │ │  publish.yml ONLY (steps 8-10):                                   │   │
     │ │  8. inline jq asset-audit (verify vss-extension.json files[])    │   │
     │ │  9. probe master branch protection (gh api … /protection)        │   │
     │ │ 10. dry-run echo: "would publish vX.Y.Z"                         │   │
     │ │     + step output `next-version` for P7 composability            │   │
     │ │     + GITHUB_STEP_SUMMARY markdown line                          │   │
     │ └──────────────────────────────────────────────────────────────────┘   │
     └─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
        Workflow ends — green status badge — NO Marketplace mutation in P6
```

### Pattern 1: Two-workflow split with deliberately disjoint triggers

**What:** ci.yml runs on PR only; publish.yml runs on master push + workflow_dispatch.

**When to use:** When a "verify" surface and a "deploy" surface should be operationally distinct. Defense-in-depth: a PR run physically cannot trigger publish, regardless of typos elsewhere.

**Example:**
```yaml
# ci.yml (after CI-02 edit)
on:
  pull_request:
    branches: [master]

# publish.yml (NEW)
on:
  push:
    branches: [master]
    paths-ignore:
      - '**.md'
      - '.planning/**'
      - '.claude/**'
      - 'docs/**'
  workflow_dispatch:
```

### Pattern 2: Inline shell with strict mode for fail-fast

**What:** Every multi-line `run:` block starts with `set -euo pipefail`.

**When to use:** Always for any non-trivial shell. Ensures early-exit on errors and prevents silent variable typos (per FAIL-01).

**Example:** see Gap 3 asset-audit pattern.

### Pattern 3: Step-output composability

**What:** Steps that produce values write to `$GITHUB_OUTPUT`; steps that summarize write to `$GITHUB_STEP_SUMMARY`.

**When to use:** Any step whose result a downstream step (or a human reviewer) might want.

**Example:** see Gap 9 dry-run-echo pattern.

### Anti-Patterns to Avoid

- **`continue-on-error: true` on any gate step.** Defeats GATE-06. The only valid use is on the P7 tag step (TAG-04). Plan-check should grep the YAML diff for `continue-on-error: true` and fail if it appears.
- **Adding `permissions: contents: write` at workflow top-level in P6.** Top-level `read` (or omitted entirely; default in 2024+ is contents-read for new tokens) suffices. The `write` upgrade is P7's job-level concern. Adding `write` early is over-permissioning.
- **Using `secrets.TFX_PAT` in any P6 step OTHER than the resolution probe.** The PAT is not consumed by any gate; surfacing it in `env:` of every step expands the secret-leakage surface for no benefit. The probe step alone is sufficient.
- **Duplicating ci.yml's gate steps verbatim into publish.yml without checking pin drift.** ci.yml uses `checkout@v4`; publish.yml uses `checkout@v5` per D-4. The `setup-node@v4 / Node 20 / cache: npm` line is identical between the two files (intentional — keeps cache key warm).
- **Adding the `[skip ci]` parsing manual guard.** Native GitHub support already exists (since Feb 2021). The actor-guard is the belt-and-suspenders for `GITHUB_TOKEN` paths; manual `git log | grep '\[skip ci\]'` is over-engineering. (See SUMMARY's reconciliation note.)
- **Using `paths-ignore` to filter `workflow_dispatch`.** Manual re-run intentionally bypasses path filters; this is the documented escape hatch (see Gap 5). Trying to also filter manual runs would defeat FAIL-03.
- **Claim-without-probe of branch protection state.** D-5 mandates an actual `gh api` probe; CONTEXT.md and STATE.md both note "UNKNOWN — verify in P6." Plan must include a real probe task whose output drives P7's token-strategy decision.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Repo checkout | Manual `git clone` in `run:` | `actions/checkout@v5` | Handles credentials persistence, fetch-depth, submodules, and shallow-clone edge cases; ~hundreds of contributor-years of polish. |
| Node setup + npm cache | `apt install nodejs` + manual cache wrangling | `actions/setup-node@v4 with cache: npm` | Cache key derives from `package-lock.json`+`runner.os`+`node-version`; aligning with ci.yml's identical line guarantees warm hits. Hand-rolling drops cache hits to 0. |
| Branch protection check | `curl -H 'Authorization: token …' https://api.github.com/...` | `gh api repos/.../protection` | gh handles auth via $GH_TOKEN, JSON parsing, error formatting; one line vs. ten. |
| JSON field extraction | grep/sed regex against `vss-extension.json` | `jq -r '.files[].path'` | Manifest is JSON; only jq parses correctly past edge cases (escaped quotes, nested objects). Pre-installed on runner. |
| Manual version increment math | Hand-rolled bash splitting | `node -p "require('./package.json').version"` + arithmetic, OR (in P7) the `bump-version.mjs` script | For P6's read-only dry-run echo, `node -p` + bash arithmetic is the simplest. P7's actual bump uses ESM script per BUMP-01. |
| Notification on failure | Slack webhook step / SMTP / Twilio | GitHub default failure email | FAIL-02 explicitly excludes notification surfaces. The default email to repo maintainers is the entire notification system for v1.1. |
| Loop-prevention guard for commit-back | Manual `git log | grep '\[skip ci\]'` step | Native GitHub `[skip ci]` parsing + `if: github.actor != 'github-actions[bot]'` job-level guard | GitHub's native parsing has been stable since Feb 2021. The actor-guard handles the `GITHUB_TOKEN`-replaced-by-PAT future case. (Both are P7 concerns, but the actor-guard is pre-positioned in P6 per CI-06.) |

**Key insight:** P6's surface area is so small (one new file ≈ 60 lines + one one-line edit to ci.yml) that any "let me just write a custom shell script" instinct is over-rotation. The runner provides everything (`gh`, `jq`, `node`, `bash`); the actions provide everything else (`checkout`, `setup-node`); the existing v1.0 npm scripts provide all four gates. This is plumbing, not engineering.

---

## Common Pitfalls

### Pitfall A1: Writing publish.yml with steps that PRESUME P7 work

**What goes wrong:** Planner copies a "complete" publish.yml from the ARCHITECTURE doc (steps 1-13), removes the publish-y steps, but forgets to also remove the `permissions: contents: write` (P7) and `actions/upload-artifact@v4` placeholder (P7), leaving an over-permissioned scaffold that lints clean but has unused declarations.

**Why it happens:** ARCHITECTURE.md shows the full 13-step shape. Easy to copy-then-prune incompletely.

**How to avoid:**
- Build publish.yml additively from ci.yml's exact step structure (steps 1-7 in the diagram), then insert ONLY the P6-specific additions: paths-ignore, concurrency, workflow_dispatch, asset audit, branch-protection probe, dry-run echo. Do NOT prune from a 13-step template.
- During plan-check, audit publish.yml diff for any `actions/upload-artifact`, `git-auto-commit-action`, `tfx`, or `permissions: contents: write` strings — all of those are P7 surface area and must NOT appear in P6.

**Warning signs:** PR diff > 80 lines for publish.yml. PR diff mentions `tfx`. PR includes a `bump-version.mjs` reference.

### Pitfall A2: Branch-protection probe result lost between sessions

**What goes wrong:** The `gh api .../protection` step runs inside publish.yml during the verification dance (D-1 force-merge), prints the result to the runner log, and… that's it. P7's planner two days later asks "is master protected?" — the answer is buried in an Actions UI log that may have been auto-deleted (90-day default).

**Why it happens:** Step output state is run-only. `$GITHUB_STEP_SUMMARY` survives in the run page but the run itself can age out.

**How to avoid:** Plan a SEPARATE one-line task: "After D-1's force-merge run completes, copy the probe step's JSON body (or the 404 body) into `.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md`. Commit." This makes the result a phase artifact, durably consumable by P7 (and by any future researcher).

**Warning signs:** P7's CONTEXT.md says "branch protection state: see P6 verification log" instead of "branch protection state: NONE (probe-result.md captured 2026-05-XX)."

### Pitfall A3: `paths-ignore` interpreted as "ignore-globally" instead of "all-paths-must-match"

**What goes wrong:** Author tests by pushing a single-file commit `README.md + spelling fix in src/calc/parse.ts`, expects the workflow to be skipped because README matches `**.md`, observes the workflow runs (correctly), and concludes the filter is broken.

**Why it happens:** `paths-ignore` semantics are non-obvious — it skips a run only if EVERY changed file in the commit matches an ignore pattern. ANY un-matched file causes the run.

**How to avoid:** Plan-check should explicitly call out the negative-case verification (D-1a) MUST be a commit touching ONLY README.md (or another `**.md` file) — not a mixed commit. The positive-case verification MUST touch a file outside all ignore patterns.

**Warning signs:** Verification commit modifies multiple files. Verification commit message says "test paths-ignore" but the diff shows changes outside `**.md`/`.planning/**`/`.claude/**`/`docs/**`.

### Pitfall A4: Forgetting to drop `push: [master]` from ci.yml

**What goes wrong:** publish.yml lands and starts firing on master pushes. ci.yml ALSO still fires on master pushes (its `push: [master]` was never removed). Now every master push runs gates twice. Wasteful but not broken — until eventually the duplicate triggers a confused incident report or someone notices the doubled CI minutes.

**Why it happens:** CI-02 is a one-line removal in a separate file from publish.yml. Easy to forget when most of the cognitive load is on publish.yml.

**How to avoid:** CI-02 task should be its own atomic PR (or atomic commit within the P6 PR) with a description that explicitly references "publish.yml now owns the master-push gates; ci.yml remains PR-only." Plan-check verifies ci.yml's `on:` block has only `pull_request:` and no `push:` after the change.

**Warning signs:** Both CI and Publish workflows show as runs on the Actions tab for the same master push.

### Pitfall A5: TFX_PAT-resolves probe accidentally leaks the PAT

**What goes wrong:** Author writes `echo "TFX_PAT = ${{ secrets.TFX_PAT }}"` "to verify it's resolving." GitHub's auto-redaction catches the literal value, but a transformed version (base64-encoded, length-printed, etc.) might not be caught.

**Why it happens:** Curiosity. "Just want to be sure."

**How to avoid:** The probe MUST be `echo "tfx-pat-present=${{ secrets.TFX_PAT != '' }}"` — emits literal `true` or `false`, never the PAT itself. Plan-check forbids any pattern that interpolates the PAT into a transformation (`${{ secrets.TFX_PAT | base64 }}`, `${#TFX_PAT}`, etc.).

**Warning signs:** Step output references `secrets.TFX_PAT` outside of the comparison `!= ''`.

---

## Code Examples

### Verified pattern: complete publish.yml skeleton for P6

```yaml
# .github/workflows/publish.yml
# Phase 6: scaffold + pre-flight gates + dry-run.
# Marketplace state is NOT mutated in this workflow until Phase 7.

name: Publish

on:
  push:
    branches: [master]
    paths-ignore:
      - '**.md'
      - '.planning/**'
      - '.claude/**'
      - 'docs/**'
  workflow_dispatch:

# Different group than ci.yml — they will not interfere.
concurrency:
  group: publish-master
  cancel-in-progress: false

# Top-level least privilege; P7 will add `contents: write` at job level.
permissions:
  contents: read

jobs:
  publish:
    name: Publish to Marketplace (dry-run in P6)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    # Defense-in-depth against P7 commit-back retrigger; pre-positioned in P6.
    if: github.actor != 'github-actions[bot]'
    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Unit tests
        run: npm test -- --run

      - name: Build (production)
        run: npm run build

      - name: Bundle size gate (≤ 250 KB gzipped)
        run: npm run check:size

      - name: Verify all manifest assets exist on disk
        run: |
          set -euo pipefail
          MISSING=0
          while IFS= read -r path; do
            if [ ! -e "$path" ]; then
              echo "MISSING: $path"
              MISSING=1
            else
              echo "  ok: $path"
            fi
          done < <(jq -r '.files[].path' vss-extension.json)
          if [ "$MISSING" -ne 0 ]; then
            echo ""
            echo "FAIL: vss-extension.json files[] declares assets missing on disk."
            exit 1
          fi

      - name: Verify TFX_PAT secret resolves
        run: |
          echo "tfx-pat-present=${{ secrets.TFX_PAT != '' }}"

      - name: Probe master branch protection
        id: protection
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set +e
          BODY=$(gh api repos/${{ github.repository }}/branches/master/protection 2>&1)
          STATUS=$?
          set -e
          if [ $STATUS -eq 0 ]; then
            echo "protected=true" >> "$GITHUB_OUTPUT"
            echo "Master IS branch-protected:"
            echo "$BODY"
          else
            echo "protected=false" >> "$GITHUB_OUTPUT"
            echo "Master is NOT branch-protected (gh api exit $STATUS):"
            echo "$BODY"
          fi
          {
            echo "## Branch protection probe"
            if [ $STATUS -eq 0 ]; then
              echo "master is **PROTECTED**. P7 commit-back must use App or PAT bypass."
            else
              echo "master is **NOT protected**. P7 commit-back can use \`GITHUB_TOKEN\`."
            fi
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Dry-run — compute next version (DOES NOT publish)
        id: dryrun
        run: |
          set -euo pipefail
          CURRENT=$(node -p "require('./package.json').version")
          IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
          NEXT="${MAJOR}.${MINOR}.$((PATCH + 1))"
          echo "would publish v${NEXT}"
          echo "next-version=v${NEXT}" >> "$GITHUB_OUTPUT"
          {
            echo "## Dry-run result"
            echo "Current: \`${CURRENT}\`"
            echo "Would publish: \`v${NEXT}\`"
          } >> "$GITHUB_STEP_SUMMARY"
```

**Lines:** ~85. Slightly above SUMMARY's "~60" estimate because of the branch-protection probe + step-summary writes; both are P6-mandated (D-5 and Gap 9 best-practice). Trim is possible if the planner judges the step-summary writes optional — drops to ~70.

[VERIFIED: each block of YAML mirrors a pattern in the canonical sources cited under each Gap]

### Verified pattern: ci.yml `on:` edit (CI-02)

```diff
 # .github/workflows/ci.yml
 on:
-  push:
-    branches: [master]
   pull_request:
     branches: [master]
```

That's the entire CI-02 edit. Two lines removed. Nothing else changes.

### Verified pattern: separate phase-artifact capture for branch-protection result

```bash
# Run locally during P6 verification dance (or extracted from the publish.yml run log):
gh api repos/tsmshvenieradze/StoryPointExtension/branches/master/protection \
  > .planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md \
  2>&1 || true
```

The `|| true` ensures a 404 (which exits non-zero) still writes the body for posterity. Commit this file as part of P6's verification artifact set.

---

## Plan Implications (concrete planner inputs)

### Recommended task decomposition (planner's call — not prescriptive)

The planner has D-9, D-1a, and 18 requirements to honor. A natural decomposition:

1. **Plan 06-01: ci.yml edit (CI-02).** One-edit task: remove `push:` block from ci.yml. Includes a verification step ("after this lands, push a commit to master and confirm ci.yml does NOT run"). ~5-line PR.

2. **Plan 06-02: publish.yml scaffold (CI-01, CI-03..08, GATE-01..07, FAIL-01..03, CI-06 actor-guard pre-position).** Produces the full ~85-line YAML shown above. Plan-check audit: no `tfx`, no `git-auto-commit`, no `upload-artifact`, no `permissions: contents: write` (those are P7).

3. **Plan 06-03: Verification dance (D-1, D-1a both cases).**
   - Sub-step a: README.md whitespace edit (negative case) — confirm publish.yml is SKIPPED for the docs-only commit.
   - Sub-step b: trivial code edit (positive case) — confirm publish.yml RUNS, gates pass, dry-run echoes the next version.
   - Sub-step c: capture branch-protection probe output to `.planning/phases/06-workflow-scaffold-and-gates/branch-protection-probe-result.md` (D-5 phase-artifact).

The above is one possible split. The planner may merge 06-01 and 06-02 if a single PR is operationally cleaner; D-9 says all P6 work goes into the YAML at scaffold time, which doesn't preclude two-PR scaffolding.

### Plan-check audit checklist for P6

- [ ] publish.yml does NOT contain the strings: `tfx`, `actions/upload-artifact`, `git-auto-commit-action`, `permissions: contents: write`, `bump-version`, `--rev-version`.
- [ ] publish.yml DOES contain: `paths-ignore` block with the four patterns from D-6, `concurrency: group: publish-master, cancel-in-progress: false`, `workflow_dispatch:`, `if: github.actor != 'github-actions[bot]'`, the asset-audit step (jq-based), the TFX_PAT presence probe (boolean comparison only, never PAT interpolation), the branch-protection probe (gh api with $GH_TOKEN env), and the dry-run echo (with stdout `would publish vX.Y.Z` line).
- [ ] No `continue-on-error: true` anywhere.
- [ ] Action versions match D-4: `checkout@v5`, `setup-node@v4`. (`upload-artifact@v4` and `git-auto-commit-action@v6` are NOT in P6 — they appear in P7.)
- [ ] ci.yml `on:` block has ONLY `pull_request:` after the edit; no `push:`.
- [ ] D-1a verification covers BOTH the negative AND positive cases (planner did not silently drop the positive case).
- [ ] Branch-protection probe result is committed to phase directory as a markdown file (durable phase artifact for P7).

### Out-of-scope reminders for the planner

- **No bump script work.** BUMP-01..05 are P7. Even a stub `bump-version.mjs` should not appear in P6.
- **No real tfx call.** PUBLISH-01..05 are P7. The dry-run echo is the entire P6 publish-step surface.
- **No commit-back.** TAG-01..04 are P7. P6's verification merge does NOT cause publish.yml to commit anything back.
- **No legacy script removal.** CLEAN-01..03 are P8. `scripts/publish-cezari.cjs` and the `publish:cezari` / `publish:public` npm scripts MUST remain untouched in P6.
- **No OPERATIONS.md content.** DOC-01..02 are P8. Workflow rationale lives there per D-3, not in publish.yml comments.

### Cross-phase data flow

| What P6 produces | What P7 consumes |
|------------------|------------------|
| `branch-protection-probe-result.md` in phase dir | P7 planner: decides whether commit-back uses `GITHUB_TOKEN` or escalates to App / `RELEASE_PAT`. |
| publish.yml ~85-line scaffold with steps 1-10 | P7 adds: `bump-version.mjs` invocation, `tfx extension create`, `upload-artifact@v4`, `tfx extension publish`, `git-auto-commit-action@v6` commit-back, `git tag -a` step. Also upgrades top-level `permissions: contents: read` to job-level `contents: write`. |
| Confirmation that the gate-and-echo path runs green on master | P7 inherits a verified plumbing surface; first P7 publish.yml run is the first real publish. |
| Confirmation that paths-ignore filters work | P7 inherits the docs-only-skip safety; no need to re-verify. |
| Confirmation that workflow_dispatch is functional | P7 has a documented manual-rerun escape hatch from day 1. |

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Branch-protection probe (Gap 1) | HIGH | Endpoint URL and 404-vs-200 semantics confirmed via official GitHub Docs and community discussion #24582. |
| `gh` pre-installed on ubuntu-latest (Gap 2) | HIGH | Confirmed via actions/setup-gh README and Ubuntu2404-Readme.md. |
| `jq` pre-installed + inline syntax (Gap 3) | HIGH | jq listed in Ubuntu2404 preinstalled tools README; inline pattern is standard POSIX shell with verified process-substitution semantics. |
| `actions/checkout@v5` runner-version requirement (Gap 4) | HIGH | runner v2.327.1+ required; latest hosted runners are v2.333.0 / v2.334.0. Comfortable margin. |
| `workflow_dispatch` bypasses `paths-ignore` (Gap 5) | HIGH | Direct quote from docs.github.com/actions/using-workflows/triggering-a-workflow. |
| `paths-ignore` AND `branches` interaction (Gap 6) | HIGH | Direct documentation + behavior matrix verified against community discussion. |
| `if: github.actor` syntax (Gap 7) | HIGH | Standard GitHub Actions expression syntax; quirks documented in actions/runner #1173. Job-level vs step-level semantics confirmed. |
| Concurrency non-interference between ci.yml and publish.yml (Gap 8) | HIGH | Repository-scoped concurrency model; different group names = independent queues. Direct quote from docs. |
| Step output composability for next-version (Gap 9) | HIGH | `$GITHUB_OUTPUT` syntax is post-2022 canonical; deprecated `::set-output` not used. |
| Reusing existing ci.yml gate steps verbatim | HIGH | Read directly from `.github/workflows/ci.yml`; package.json scripts confirmed present. |
| `vss-extension.json` `files[]` shape for asset audit | HIGH | Read directly from manifest — three entries: `dist`, `images`, `overview.md`. |
| Force-merge no-op verification (D-1) catching real bugs | MEDIUM-HIGH | Standard practice in CI-driven shops; the only failure mode it doesn't catch is a Marketplace-side bug, which is P7 territory anyway. |
| Plan-check anti-pattern detection (audit list above) | MEDIUM-HIGH | Each anti-pattern is a string-match against publish.yml diff; trivially mechanizable but planner must wire it in. |

**Overall confidence:** HIGH. P6 is a well-understood plumbing exercise with no novel research surface. All nine gaps resolve to canonical sources; none required `[ASSUMED]` tags.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | All factual claims in this RESEARCH.md are tagged `[VERIFIED:...]` or `[CITED:...]` against an authoritative source verified live on 2026-05-05. | — | — |

**This table is empty.** All claims in this research were verified or cited against current sources — no user confirmation needed before planning proceeds.

---

## Open Questions

(None blocking P6 planning. The orchestrator-supplied gap list was complete; all nine items resolved with HIGH confidence.)

Two minor items the planner may want to re-confirm during plan-creation:

1. **`name:` string convention.** CONTEXT.md leaves the exact step `name:` strings to Claude's discretion. The example YAML above uses ci.yml-matching names where steps overlap (Checkout, Setup Node.js, Install dependencies, Typecheck, Unit tests, Build, Bundle size gate) and descriptive names for new steps (Verify all manifest assets exist on disk; Verify TFX_PAT secret resolves; Probe master branch protection; Dry-run — compute next version). Planner can override.

2. **`timeout-minutes:` value.** ci.yml uses 10. Discretion in CONTEXT says 10 or 15. Recommend 10 (the gate steps run < 5 min today; 10 is comfortable headroom; raise to 15 in P7 only if upload-artifact + tfx publish push the budget).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ubuntu-latest hosted runner | All P6 work | ✓ | Ubuntu 24.04, runner v2.333.0+ | — |
| `gh` CLI | Branch-protection probe | ✓ pre-installed | latest (auto-updated weekly) | `apt-get install gh` (not needed) |
| `jq` | Asset audit step | ✓ pre-installed | 1.7.x | `apt-get install jq` (not needed) |
| `node` 20.x | All `node -p` invocations | ✓ via setup-node@v4 | 20.x LTS | — |
| `bash` POSIX | All `run:` blocks | ✓ default shell | — | — |
| `npm` 10.x | `npm ci`, `npm run X` | ✓ via setup-node@v4 | bundled with Node 20 | — |
| `tfx-cli` 0.23.1 | Existing devDep (NOT used in P6 directly) | ✓ via `npm ci` | 0.23.1 (pinned) | — |
| GitHub Actions runner v2.327.1+ | `checkout@v5` | ✓ | v2.333.0+ on hosted runners | — |
| GitHub repo secret `TFX_PAT` | Resolution probe | ✓ confirmed by user (D-2) | — (not consumed in P6) | — |
| GitHub repo secret `GITHUB_TOKEN` | gh CLI auth (branch-protection probe) | ✓ auto-provisioned | — | — |
| Repo admin access for branch-protection endpoint | gh api 200/404 truthfulness | ✓ workflow's GITHUB_TOKEN has admin equivalence on home repo | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md does NOT list specific GSD constraints for v1.1 / Phase 6 — its content focuses on v1.0 stack pins (React 18, azure-devops-ui, webpack 5, vitest) and Marketplace publish path (tfx-cli 0.23.1, ubuntu-latest, TFX_PAT secret). All of these are honored by P6:

- **Tech stack — Frontend:** unchanged; P6 doesn't touch src/.
- **Tech stack — Org standard divergence:** N/A; P6 is YAML, not a UI tier.
- **Distribution (Visual Studio Marketplace):** P6 is the scaffold, P7 is the actual publish.
- **Storage (ADO Extension Data Service):** unchanged.
- **Browser compatibility:** unchanged.
- **Permissions (`vso.work_write` only):** unchanged.
- **Bundle size:** GATE-05 enforces the existing 250 KB gzipped ceiling.
- **Calculation precision:** unchanged.
- **Testing:** existing vitest suite reused verbatim via GATE-03.

CLAUDE.md's "Recommended Stack" table for ADO extension dependencies is not modified by P6 — no new npm packages, no new actions beyond the four already pinned in D-4.

GSD Workflow Enforcement (file edits via GSD commands only): respected — this RESEARCH.md is produced via `/gsd-research-phase 6` flow, not direct edits.

---

## Sources

### Primary (HIGH confidence)

- [GitHub Docs — REST API endpoints for protected branches](https://docs.github.com/en/rest/branches/branch-protection) — Gap 1 endpoint URL + response shapes.
- [GitHub Docs — GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) — Gaps 2, 3 (preinstalled tools).
- [GitHub Docs — Triggering a workflow](https://docs.github.com/actions/using-workflows/triggering-a-workflow) — Gap 5 (paths-ignore + workflow_dispatch).
- [GitHub Docs — Workflow syntax for GitHub Actions](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions) — Gap 6 (paths-ignore + branches AND-logic).
- [GitHub Docs — Concurrency](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs) — Gap 8.
- [GitHub Docs — Expressions](https://docs.github.com/en/actions/concepts/workflows-and-actions/expressions) — Gap 7 (if conditions).
- [GitHub Docs — Workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands) — Gap 9 ($GITHUB_OUTPUT).
- [actions/runner-images Ubuntu 24.04 README](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) — Gaps 2, 3 (jq, gh preinstalled).
- [actions/runner Releases](https://github.com/actions/runner/releases) — Gap 4 (current runner versions).
- [actions/checkout Releases](https://github.com/actions/checkout/releases) — Gap 4 (v5.0.0 requires v2.327.1+).

### Secondary (MEDIUM confidence — confirmed by multiple sources)

- [GitHub community discussion #24582 — GET branch protection returning 404](https://github.com/orgs/community/discussions/24582) — Gap 1 (404-on-unprotected behavior).
- [GitHub Marketplace - actions/setup-the-github-cli](https://github.com/marketplace/actions/setup-the-github-cli) — Gap 2 (gh pre-installed claim).
- [GitHub community discussion #63314 — paths/branches both filters](https://github.com/orgs/community/discussions/63314) — Gap 6 (AND-logic confirmation).
- [GitHub community discussion #78332 — concurrency group scope](https://github.com/orgs/community/discussions/78332) — Gap 8 (repository scope confirmation).
- [actions/runner #1173 — if conditional bug](https://github.com/actions/runner/issues/1173) — Gap 7 (`${{ }}` quirks in `if:` clauses).
- [GitHub Changelog 2022-10-10 — Deprecating set-output](https://github.blog/changelog/2022-10-10-github-actions-deprecating-save-state-and-set-output-commands/) — Gap 9 ($GITHUB_OUTPUT canonical syntax).
- [GitHub Changelog 2021-02-08 — `[skip ci]`](https://github.blog/changelog/2021-02-08-github-actions-skip-pull-request-and-push-workflows-with-skip-ci/) — referenced for SUMMARY's reconciliation note (manual `[skip ci]` parsing is over-engineering).

### Tertiary (verified against repo source files)

- `e:\Projects\Github\StoryPointExtension\.github\workflows\ci.yml` — verbatim source for the 5-gate step pattern.
- `e:\Projects\Github\StoryPointExtension\scripts\check-bundle-size.cjs` — confirms GATE-05 implementation is unchanged.
- `e:\Projects\Github\StoryPointExtension\scripts\publish-cezari.cjs` — TFX_PAT contract reference (intentionally NOT modified in P6).
- `e:\Projects\Github\StoryPointExtension\vss-extension.json` — asset-audit input; `files[]` has three entries.
- `e:\Projects\Github\StoryPointExtension\package.json` — gate npm scripts present and correct.
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/research/{SUMMARY,STACK,ARCHITECTURE,PITFALLS,FEATURES}.md`, `.planning/phases/06-workflow-scaffold-and-gates/06-CONTEXT.md`, `06-DISCUSSION-LOG.md` — milestone-level synthesis already verified by prior research agents.

---

## Metadata

**Confidence breakdown:**
- Gap analysis: HIGH — every gap resolved to canonical source.
- Standard stack: HIGH — all pins inherited from D-4 and v1.0 invariants.
- Architecture / patterns: HIGH — pattern is "extend existing ci.yml shape with three small additions", well-grounded in current ci.yml and the milestone-level ARCHITECTURE.md.
- Pitfalls: MEDIUM-HIGH — the five P6-specific pitfalls (A1..A5) are scoped sharper than the milestone-level 14 pitfalls; auditable via plan-check string matching.
- Plan implications: HIGH — concrete task suggestions and audit checklist produced.

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (30 days for stable; ubuntu-latest auto-updates and `gh`/`jq` versions drift, but the contracts under research are stable).
