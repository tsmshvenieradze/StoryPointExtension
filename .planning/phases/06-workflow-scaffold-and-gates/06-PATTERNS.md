# Phase 6: Workflow Scaffold & Pre-flight Gates — Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 2 (1 created, 1 modified)
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/publish.yml` (NEW) | CI workflow, single sequential job | event-driven (push/dispatch → gate steps → dry-run echo) | `.github/workflows/ci.yml` | exact (same role: GH-Actions YAML, gate sequence; differs only in trigger + final step) |
| `.github/workflows/ci.yml` (MODIFIED) | CI workflow, PR gates | event-driven (PR → gates) | itself (1-line surgical edit to `on:` block) | self |

No code analogs needed beyond `ci.yml`. `scripts/check-bundle-size.cjs` and `scripts/publish-cezari.cjs` are read-only references for invocation flag-set capture (P8) and are NOT copied into P6.

## Pattern Assignments

### `.github/workflows/publish.yml` (NEW)

**Analog:** `.github/workflows/ci.yml` — same shape (single job, sequential `npm`-script gate steps on `ubuntu-latest`), diverges on triggers, concurrency group, permissions, and the final dry-run echo step.

**Imports / file-header pattern** (ci.yml lines 1-12):

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

# Cancel earlier runs of the same ref when a new commit lands
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

**Copy verbatim into publish.yml — diff vs ci.yml:**

- `name:` → `Publish` (or `Publish to Marketplace`).
- `on:` → `push: branches: [master]` + `workflow_dispatch:` + `paths-ignore: ['**.md', '.planning/**', '.claude/**', 'docs/**']` (CI-01, CI-03, FAIL-03).
- `concurrency:` → `group: publish-master` (fixed, no `${{ github.ref }}` dimension), `cancel-in-progress: false` (CI-04). Net-new vs ci.yml's "cancel previous on same ref".
- Net-new top-level block: `permissions: contents: read` (CI-05).

**Gate-step pattern (lines 19-42 of ci.yml — copy step-for-step):**

```yaml
jobs:
  build:
    name: Build & verify
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v4

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
```

**Copy verbatim into publish.yml — diff vs ci.yml:**

- Job name: `publish-and-release` (per ARCHITECTURE.md §2) instead of `build`.
- Job-level guard NEW: `if: github.actor != 'github-actions[bot]'` (CI-06; SUMMARY recommends job-level over workflow-level).
- `actions/checkout@v4` → `actions/checkout@v5` with `fetch-depth: 0` and (default) `persist-credentials: true` — needed for P7 commit-back; kept on the v5 pin per CI-08 even though P6 doesn't push (D-4 in CONTEXT: "ci.yml stays at v4, publish.yml leads on v5").
- `actions/setup-node@v4` — pin matches ci.yml exactly so the npm cache key is shared (warm hit). NOT v5/v6 (per CI-08 + STACK reject list).
- `timeout-minutes: 10` — match ci.yml (D-4 / Claude's discretion: planner may bump to 15 for headroom; default to 10 for parity).
- Steps 3-7 (npm ci → typecheck → tests → build → check:size): copy step-for-step **including the existing `name:` strings** ("Install dependencies", "Typecheck", "Unit tests", "Build (production)", "Bundle size gate (≤ 250 KB gzipped)"). This satisfies GATE-01 through GATE-05 verbatim and locks status-check names for any future branch-protection rules.
- NO `continue-on-error: true` on any gate step (GATE-06; explicit rule from D-9). Default fail-fast is what we want (FAIL-01).

**Net-new step — pre-publish asset audit (GATE-07, D-8 inline `jq`):**

No existing analog in the repo for `jq`-on-manifest. Use canonical inline pattern (≤10 lines per D-8; fall back to `scripts/audit-assets.mjs` only if it grows past that). Reads `vss-extension.json` `files[].path` (3 entries today: `dist`, `images`, `overview.md` per the manifest at vss-extension.json lines 20-24); each must exist on disk.

```yaml
- name: Asset audit (vss-extension.json files[] paths exist)
  run: |
    set -euo pipefail
    missing=0
    for p in $(jq -r '.files[].path' vss-extension.json); do
      if [ ! -e "$p" ]; then
        echo "::error::Missing asset path declared in vss-extension.json: $p"
        missing=1
      fi
    done
    [ "$missing" -eq 0 ] || exit 1
```

Notes for planner:
- Runs AFTER `npm run build` so `dist/` exists (the manifest's first `files[]` entry is `dist`).
- Position: planner's call — either right after `Bundle size gate` (matches CONTEXT D-8 "minimum viable") or right before the dry-run echo. Either is fine; ordering inside gates does not affect correctness.
- `jq` is pre-installed on `ubuntu-latest` GitHub-hosted runners — no `apt-get` step needed.
- `set -euo pipefail` matches no-existing-pattern (workflow has only 1-line `run:` blocks today) but is the canonical safety baseline for any multi-line shell step.

**Net-new step — dry-run echo (D-7, no analog):**

```yaml
- name: Dry-run — would-publish version
  id: dryrun
  run: |
    CURRENT=$(node -p "require('./package.json').version")
    IFS='.' read -r MAJ MIN PAT <<< "$CURRENT"
    NEXT="$MAJ.$MIN.$((PAT + 1))"
    echo "would publish v$NEXT"
    echo "next-version=v$NEXT" >> "$GITHUB_OUTPUT"
    echo "would publish v$NEXT" >> "$GITHUB_STEP_SUMMARY"
```

Notes for planner:
- Pure echo — NO `tfx`, NO file write, NO `actions/upload-artifact`. Per D-7.
- Step output (`steps.dryrun.outputs.next-version`) and `$GITHUB_STEP_SUMMARY` write are Claude-discretion per D-7 / CONTEXT line 131-138 — recommended to include both for traceability and to give P7 a ready-made handle to swap in for the real publish step.
- Reading `package.json` via `node -p` over `jq` keeps the pattern uniform with how `bump-version.mjs` (P7) will read it; minor consistency win.
- Position: ABSOLUTE LAST step of the job (success criterion #4 — must not run if any earlier gate fails; default sequential `needs:`-free + fail-fast handles this).

### `.github/workflows/ci.yml` (MODIFIED)

**Analog:** itself. Surgical 3-line removal — NO other change.

**Diff (CI-02 + success criterion #2):**

```yaml
on:
-  push:
-    branches: [master]
   pull_request:
     branches: [master]
```

Result: ci.yml runs on PRs to master only. The `concurrency: ci-${{ github.ref }}, cancel-in-progress: true` block stays — PR cancel-on-force-push is correct behavior for the PR surface.

NO other touches in P6: `name:`, `concurrency:`, `jobs:`, runner, all step `name:` strings, action pins (`@v4`), `timeout-minutes: 10` — all unchanged. Pin-drift between ci.yml (`@v4`) and publish.yml (checkout `@v5`) is intentional per D-4.

## Shared Patterns

### Step `name:` convention (apply to all publish.yml steps)

**Source:** `.github/workflows/ci.yml` lines 20-42.

Sentence-case noun phrase, with parenthesized context for non-obvious gates:
- `Checkout`, `Setup Node.js`, `Install dependencies`, `Typecheck`, `Unit tests`
- `Build (production)` — parenthetical clarifies webpack mode
- `Bundle size gate (≤ 250 KB gzipped)` — parenthetical states the threshold inline

Apply same convention to net-new steps:
- `Asset audit (vss-extension.json files[] paths exist)`
- `Dry-run — would-publish version`

Reuse the **exact existing strings** for the 5 ci.yml-shared gate steps so a future branch-protection rule can pin status-check names without ambiguity (matters per CONTEXT line 130 + Q4 in SUMMARY).

### Concurrency block convention

**Source:** `.github/workflows/ci.yml` lines 10-12 (existing).

Top-level `concurrency:` block sits between `on:` and `jobs:`, with a leading single-line YAML comment. Mirror that placement in publish.yml; the comment text changes to reflect the different policy:

```yaml
# Serialize publishes; never cancel mid-flight (Marketplace mutation in P7).
concurrency:
  group: publish-master
  cancel-in-progress: false
```

### Action-version pinning convention

**Source:** `.github/workflows/ci.yml` lines 21, 24 (`@v4` major-only pins).

Use major-only pins (`@v4`, `@v5`) — NOT SHA pins, NOT minor pins. Matches existing project convention. CI-08 specifies the exact pins for publish.yml: `actions/checkout@v5`, `actions/setup-node@v4`. (`actions/upload-artifact@v4` and `stefanzweifel/git-auto-commit-action@v6` are P7-only.)

### Job-level `runs-on` and `timeout-minutes` convention

**Source:** `.github/workflows/ci.yml` lines 17-18.

`runs-on: ubuntu-latest` (CI-07; never windows-latest per STACK reject list) and `timeout-minutes: 10` (default; planner may pick 15 for publish.yml headroom per Claude's discretion).

## No Analog Found

| File / Pattern | Reason | Mitigation |
|----------------|--------|------------|
| Inline `jq` asset audit (GATE-07) | No existing `jq` usage in workflows or scripts | Canonical pattern provided above; pre-installed on `ubuntu-latest` |
| Dry-run `node -p` version-echo (D-7) | No prior dry-run / step-output pattern in the repo | Canonical pattern provided above; mirrors how P7's `bump-version.mjs` will read `package.json` |
| `permissions: contents: read` block | ci.yml has no `permissions:` block (read-only by default) | New block per CI-05; planner adds at the workflow top level |
| `paths-ignore:` filter | No existing `paths-ignore` usage in ci.yml | New per CI-03; literal value list is locked by D-6 |

## Conventions Worth Preserving

1. **Sentence-case step names with parenthesized context for thresholds/modes** — copy exactly from ci.yml so status-check names stay stable for future branch protection (matters per Q4 in SUMMARY).
2. **`@v4` major-only action pins** as the project floor; publish.yml leads on `actions/checkout@v5` only because P7 commit-back needs the v5 default `persist-credentials` semantics (D-4).
3. **Concurrency block placed between `on:` and `jobs:`, single comment line above** — matches the one existing example.
4. **`timeout-minutes: 10`** — existing ci.yml floor; planner may pick 10 or 15 for publish.yml.
5. **NO `continue-on-error:` anywhere in P6** — every gate step must be load-bearing per FAIL-01 + GATE-06; the only-allowed `continue-on-error: true` (TAG-04 on tag step) is P7-only.
6. **Cache key parity between workflows** — both pin `actions/setup-node@v4` with `node-version: 20` and `cache: 'npm'` so cache hits are warm across PR runs and master publishes (CI-08 explicitly forbids setup-node v6).

## Metadata

**Analog search scope:** `.github/workflows/`, `scripts/`, repo root manifests (`vss-extension.json`, `package.json`).
**Files scanned:** 6 (ci.yml, check-bundle-size.cjs, publish-cezari.cjs, package.json, vss-extension.json, plus repo-wide `jq` grep).
**Pattern extraction date:** 2026-05-05.
