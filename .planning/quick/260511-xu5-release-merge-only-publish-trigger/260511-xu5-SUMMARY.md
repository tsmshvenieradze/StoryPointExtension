---
quick_id: 260511-xu5
slug: release-merge-only-publish-trigger
date: 2026-05-11
status: complete
---

# Quick Task 260511-xu5 — Summary

## What changed

`.github/workflows/publish.yml`:

1. **Trigger** — `on.push` (branches `[release]`) → `on.pull_request` (`types: [closed]`,
   `branches: [release]`). `paths-ignore` preserved; `workflow_dispatch` kept.
2. **Job `if:` guard** — now also requires
   `github.event_name == 'workflow_dispatch' || github.event.pull_request.merged == true`,
   so a PR that's *closed without merging* into `release` does **not** publish, and direct
   pushes to `release` no longer trigger anything.
3. **Checkout** — added `ref: release` to `actions/checkout@v5` (a `pull_request: closed`
   event otherwise checks out the PR merge ref, not the `release` tip; `release` is also the
   correct target for manual `workflow_dispatch`).

## Why it's safe (no publish loop)

- The post-publish version-bump commit is a **direct push** to `release` — direct pushes no
  longer trigger this workflow.
- The auto-opened `release → master` back-merge PR targets `master`, not `release` — out of
  scope of the `branches: [release]` filter.
- `[skip ci]` on the bump commit is now redundant but harmless.

## Verification

- Visual review of the `on:`, job `if:`, and checkout blocks (lines 3–52 of `publish.yml`).
- No local YAML linter available (no `pyyaml`/`yaml` node module on this machine) — syntax is
  standard GitHub Actions YAML; will be validated by GitHub on first push.
- Existing CI (`ci.yml`) already runs on `pull_request` → `release`, so PRs into `release`
  are gated before merge.

## Follow-ups / notes

- Not pushed. Repo convention is PR-per-change; push or open a PR as preferred.
