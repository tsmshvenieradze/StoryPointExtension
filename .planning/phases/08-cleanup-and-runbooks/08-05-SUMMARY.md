---
phase: 08-cleanup-and-runbooks
plan: 05
subsystem: infra
tags: [documentation, project-md, milestone-status, doc-03]

requires:
  - phase: 08-cleanup-and-runbooks
    provides: "08-SC5-EXERCISE.md — the in-the-wild evidence (v1.0.9 re-verification + v1.0.10 SC #5 recovery) that makes the 'Validated' claim truthful (Plan 08-03); OPERATIONS.md (Plan 08-01/08-02); the legacy cleanup (Plan 08-04)"
provides:
  - "PROJECT.md 'Validated' section names v1.1 Auto-Publish CI/CD as shipped, with a one-line summary of the publish.yml loop + the corrected shipped model ('every promotion PR master->release ships a patch; master stays fully protected, story-point-release-bot App on the ruleset bypass list') + the OPERATIONS.md reference + the shipped versions v1.0.8 / v1.0.9 / v1.0.10 — DOC-03"
  - "PROJECT.md 'Active' section no longer has the v1.1 enumeration placeholder; the 'Current Milestone' Goal/Delivered/Key-context wording is corrected to the release-branch model (the 'every PR merge to master ships' wording is gone); footer updated to 2026-05-11"
  - "REQUIREMENTS.md tally confirmed already-correct at 38 (no change needed; the only '32' is inside the historical 'corrected from earlier 32' note) — Cross-Phase Note #6 resolved"
affects: []

tech-stack:
  added: []
  patterns:
    - "PROJECT.md is the single source of milestone status — the Validated entry shape mirrors the v1.0 bullets (`✓ **Title** — one-paragraph summary — Phase N`); secrets named only (TFX_PAT / APP_ID / APP_PRIVATE_KEY), no credential values"

key-files:
  created: []
  modified:
    - ".planning/PROJECT.md (Validated: +v1.1 entry; Active: placeholder removed; Current Milestone: Goal/Delivered/Key-context corrected to the release-branch model; footer updated)"
  unchanged:
    - ".planning/REQUIREMENTS.md (already reads 'Total v1.1 requirements: 38'; the only '32' is in the 'corrected from earlier 32' note — no fix needed, per the plan's 'make NO change and record it' branch)"

key-decisions:
  - "Validated entry uses phase ref 'Phases 6-8' and cites the actual shipped versions from 08-SC5-EXERCISE.md: v1.0.8 (first auto-publish, Phase 7), v1.0.9 (release-branch re-verification, Phase 8), v1.0.10 (SC #5 broken-PAT recovery, Phase 8). It links ../.github/workflows/publish.yml and .planning/OPERATIONS.md and the 08-SC5-EXERCISE.md evidence file."
  - "The 'Current Milestone: v1.1' block was corrected in place (Goal line rewritten; 'Target features' -> 'Delivered features' with the release-branch wording; Key-context versions updated) rather than fully rewritten — /gsd-complete-milestone will archive that block when the milestone closes. A 'Status: SHIPPED & VALIDATED' line was added at the top of the block pointing to the Validated entry."
  - "REQUIREMENTS.md left untouched — the plan anticipated this ('if there is genuinely nothing left to fix ... make NO change to this file and record that in the SUMMARY'). The 38 total was already corrected on 2026-05-05 by gsd-roadmapper; no live '32' remains."

patterns-established: []

requirements-completed: [DOC-03]

deviations:
  - "REQUIREMENTS.md not modified (no-op by design — see key-decisions); plan Task 2's automated check (38 present; <=1 instance of bare 32) passes as-is."
  - "This SUMMARY authored by the execute-phase orchestrator inline (Wave 4 on the phase-08-wrap branch); STATE.md / ROADMAP.md updates for plan 08-05 are made by the orchestrator at phase close."

self_check: PASSED
---

# Plan 08-05 Summary — Promote v1.1 to "Validated" in PROJECT.md (DOC-03)

## Outcome

`.planning/PROJECT.md`'s **Requirements → Validated** section now carries a v1.1 Auto-Publish CI/CD entry that documents the *actual shipped architecture* — the `publish.yml` release-branch loop, the corrected "every promotion ships / master stays fully protected" model, the legacy-cleanup note, the `OPERATIONS.md` reference, and the shipped versions v1.0.8 → v1.0.9 → v1.0.10 — mirroring the shape of the existing v1.0 bullets. The **Active** placeholder for v1.1 is removed, the **Current Milestone** block's Goal/Delivered/Key-context wording is corrected away from the original "every PR merge to master ships" framing, and the footer is updated to 2026-05-11. `REQUIREMENTS.md` was confirmed already-consistent at 38 (no change needed).

## Tasks

1. **Promote v1.1 to Validated (DOC-03).** Added the `✓ **v1.1 Auto-Publish CI/CD (... — 38 requirements)**` bullet after the Phase 5 / Quick-task bullets: it names `publish.yml`, the `release`-branch push trigger, the `story-point-release-bot` GitHub App + `actions/create-github-app-token@v2`, the pre-flight gates, `bump-version.mjs` (Option B in-memory bump), `tfx extension create` + `upload-artifact`, `tfx extension publish` + the `TFX_PAT` secret, the `[skip ci]` commit-back to `release`, the annotated tag, the `release → master` back-merge PR, the loop-guard triple defense, the corrected model statement ("**every promotion (PR `master → release`) ships a new patch version automatically; `master` stays fully protected ... story-point-release-bot App on the ruleset bypass list ... no automatic publish on a plain `master` merge**"), the legacy `publish:cezari`/`publish:public` removal + `scripts/.archive/` note, and `.planning/OPERATIONS.md`; it cites v1.0.8 / v1.0.9 / v1.0.10 per `08-SC5-EXERCISE.md`. The `### Active` v1.1 placeholder block was replaced with a "(none — … shipped and validated above; v1.2+ themes are in 'Next Milestone Goals')" note. The `## Current Milestone: v1.1` block got a `Status: SHIPPED & VALIDATED` line, a rewritten `Goal` line (release-branch model), `Target features` → `Delivered features` (release-branch wording), and updated Key-context versions. Footer → `Last updated: 2026-05-11` with the v1.1-promotion note.

2. **REQUIREMENTS.md tally (Cross-Phase Note #6).** Scanned `.planning/REQUIREMENTS.md` — it already reads `**Total v1.1 requirements: 38** (8 CI + 7 GATE + 5 BUMP + 5 PUBLISH + 4 TAG + 3 FAIL + 3 CLEAN + 3 DOC)` with the "corrected from earlier '32' tally on 2026-05-05" note; the traceability table and coverage line are 38/38. The only `32` in the file is inside that historical note. **No change made** (the plan's "nothing left to fix → make NO change and record it" branch).

## Verification

- ✅ `grep -q 'v1.1'` ✓, `grep -qi 'release'` ✓, `grep -qi 'master stays fully protected'` ✓, `grep -q 'OPERATIONS.md'` ✓ in PROJECT.md; `! grep -q 'Every PR merge to master ships a new patch version of the extension to Marketplace automatically, with no manual steps'` ✓ → **PROJECT_OK**.
- ✅ `grep -q '38'` ✓ and exactly one bare `32` (the historical note) in REQUIREMENTS.md → **REQ_TALLY_OK**.
- ✅ PROJECT.md still well-formed markdown (headings intact, no broken tables); the Validated bullet matches the v1.0 bullets' shape.

## Success criteria

- ✅ DOC-03 — PROJECT.md "Validated" names v1.1 as shipped with the loop summary AND the corrected "every promotion PR `master → release` ships; `master` stays fully protected" model.
- ✅ Cross-Phase Note #6 — the stale REQUIREMENTS.md "32" tally is reconciled (confirmed already-clean at 38).
