---
phase: 08-cleanup-and-runbooks
plan: 04
subsystem: infra
tags: [legacy-cleanup, archive, npm-scripts, publish-path, documentation]

requires:
  - phase: 08-cleanup-and-runbooks
    provides: "OPERATIONS.md §2 — the canonical manual emergency-publish tfx invocation (Plan 08-01, capture-before-archive); publish.yml release-branch auto-publish model (Plan 08-01); the v1.0.9 re-verification + SC #5 exercise demonstrating the GH Action works in the wild (Plan 08-03)"
provides:
  - "scripts/publish-cezari.cjs retired -> scripts/.archive/publish-cezari.cjs (git mv, history preserved via git log --follow), with an ARCHIVED header pointing to publish.yml + OPERATIONS.md §2 — CLEAN-01"
  - "package.json no longer has publish:cezari / publish:public script entries (the 'package' = 'tfx extension create ...' script is untouched) — CLEAN-02"
  - "git grep -F 'publish:cezari' / 'publish:public' returns 0 hits outside scripts/.archive/ and .planning/; no replacement npm script added — CLEAN-03 / D-5"
  - "README.md publish section refreshed: the stale 'Publishing to cezari / public Marketplace' sections (which referenced the removed scripts) replaced with a 'Publishing' section describing the auto-publish release-branch model + pointers to OPERATIONS.md and the archived helper; project-structure tree updated"
affects: [08-05-project-md-promotion]

tech-stack:
  added: []
  patterns:
    - "Retired-but-preserved code lives under scripts/.archive/ with an ARCHIVED header comment naming its successor — git mv keeps it restorable; never re-wire it to an npm script"

key-files:
  created:
    - "scripts/.archive/publish-cezari.cjs (moved from scripts/publish-cezari.cjs via git mv; +4-line ARCHIVED header after the shebang, rest byte-for-byte unchanged)"
  modified:
    - "package.json (removed publish:cezari + publish:public from the scripts block; fixed the trailing comma so check:size is the last entry; still valid JSON)"
    - "README.md (replaced the two stale 'Publishing to ...' sections with a single 'Publishing' section + updated the scripts/ and .github/workflows/ entries in the project-structure tree)"
  deleted: []

key-decisions:
  - "ARCHIVED header placed immediately after the '#!/usr/bin/env node' shebang (lines 2-5), exactly the wording from the plan's discretion block; the shebang was kept (the alternative of dropping it was offered but keeping it is harmless)."
  - "README.md was updated even though the plan's must_haves only enumerate package.json + the two script paths — leaving stale 'npm run publish:cezari' instructions and a 'publish-cezari.cjs # tfx publish wrapper' tree entry would contradict the retirement. The new 'Publishing' section documents the release-branch auto-publish loop and links OPERATIONS.md + scripts/.archive/publish-cezari.cjs."
  - "The README now contains two 'publish-cezari' (filename-form) references — both are documentation pointers TO the archived file (a markdown link and a structure-tree comment), not invocations. The plan's automated CLEAN-03 check (git grep -lF 'publish:cezari' outside .archive/ and .planning/ -> 0 files) passes; the colon-form npm-script name appears nowhere outside the archive. The filename-form pointers are intentional and useful — recorded here as a knowing deviation from the strict 'publish-cezari hits only in .archive/ and .planning/' reading."
  - "git mv required creating scripts/.archive/ first (a bare 'git mv file dir/file' to a non-existent dir failed on this Windows checkout) — mkdir -p scripts/.archive then git mv; the rename was detected (git status shows 'RM') and history follows (git log --follow shows the Phase 5 origin commits e563dfe / 51556fe)."

patterns-established: []

requirements-completed: [CLEAN-01, CLEAN-02, CLEAN-03]

deviations:
  - "README.md edited beyond the plan's enumerated files (see key-decisions) — necessary so the docs don't reference a removed script; in-scope per Task 2's 'fix any grep hit outside the allowed paths' instruction."
  - "Two intentional 'publish-cezari' (filename-form) doc references remain in README.md, pointing at the archive — see key-decisions."
  - "This SUMMARY authored by the execute-phase orchestrator inline (Wave 4 was run on the phase-08-wrap branch, not via a spawned executor); STATE.md / ROADMAP.md updates for plan 08-04 are made by the orchestrator at phase close."

self_check: PASSED
---

# Plan 08-04 Summary — Retire the legacy manual-publish path (CLEAN-01..03)

## Outcome

`scripts/publish-cezari.cjs` is retired to `scripts/.archive/publish-cezari.cjs` (git history preserved, ARCHIVED header pointing to `publish.yml` + `OPERATIONS.md §2`); `package.json` no longer exposes `publish:cezari` / `publish:public`; `git grep` for those script names is clean outside `scripts/.archive/` and `.planning/`; no replacement npm script was added. The README's stale "Publishing to cezari / to the public Marketplace" sections were replaced with a "Publishing" section describing the release-branch auto-publish model and pointing to `OPERATIONS.md` and the archived helper. One canonical publish path now: the `release`-branch-triggered GitHub Action; the manual fallback is the `OPERATIONS.md` runbook, not a runnable second script.

## Tasks

1. **Archive the script (CLEAN-01).** Confirmed `OPERATIONS.md` contains `## 2. Manual emergency-publish runbook` (the capture-before-archive precondition). `mkdir -p scripts/.archive && git mv scripts/publish-cezari.cjs scripts/.archive/publish-cezari.cjs` — rename detected, history follows (`git log --follow` shows the Phase 5 origin: `e563dfe`, `51556fe`). Inserted the 4-line ARCHIVED header immediately after the `#!/usr/bin/env node` shebang; the rest of the file is byte-for-byte unchanged.

2. **Remove the npm scripts + sweep (CLEAN-02, CLEAN-03).** Deleted `"publish:cezari"` and `"publish:public"` from `package.json`'s `scripts` block (fixed the trailing comma; `node -e "require('./package.json')"` exits 0; `package` and the rest of `scripts` untouched). `git grep -F 'publish:cezari'` / `'publish:public'` → 0 hits outside `scripts/.archive/` and `.planning/`. Updated `README.md`: replaced the two stale publish sections with a `## Publishing` section (the release-branch loop summary + `OPERATIONS.md` + `scripts/.archive/publish-cezari.cjs` links) and refreshed the `scripts/` + `.github/workflows/` entries in the project-structure tree.

## Verification

- ✅ `scripts/publish-cezari.cjs` gone; `scripts/.archive/publish-cezari.cjs` present; `head -5` contains `ARCHIVED` and the file contains `OPERATIONS.md`; `git log --follow` shows the rename + pre-move history.
- ✅ `package.json` valid JSON; `publish:cezari` / `publish:public` absent; `package` + all other scripts present; no new `publish:*` key.
- ✅ `git grep -F 'publish:cezari'` / `'publish:public'` → 0 hits outside `scripts/.archive/` and `.planning/`.
- ✅ Sanity build unaffected: `npm run typecheck` ✓, `vitest run` → **400 passed**, `npm run build` ✓, `npm run check:size` → **148.4 KB / 250 KB** (101.6 KB headroom). (`publish-cezari.cjs` was never part of the build graph.)

## Success criteria

- ✅ CLEAN-01 — `publish-cezari.cjs` archived to `scripts/.archive/` (preserved, grep-discoverable, ARCHIVED header).
- ✅ CLEAN-02 — `publish:cezari` + `publish:public` removed from `package.json`.
- ✅ CLEAN-03 — `git grep -F 'publish:cezari'` returns 0 hits outside `scripts/.archive/` and `.planning/`.
- ✅ D-5 — no re-added npm script; the GH Action is the canonical publish path; `OPERATIONS.md §2` is the documented manual fallback.
