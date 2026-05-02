---
phase: 05-polish-marketplace-publish
plan: 03
status: in-progress
checkpoint: human-action (Task 5 — screenshot capture)
self_check: passed (Tasks 1-3 + Task 4 decision)
---

# Plan 05-03 — Marketplace Listing Assets

## Outcome (Tasks 1–4 complete; Task 5 awaiting user)

Manifest listing-fields delta, GFM `marketplace/overview.md`, and the README v1 expansion are committed. Icon refinement deferred to Plan 05-05 prerequisite (Option II — user replaces with hand-designed 128×128 PNG before public publish). Tasks 5–7 await user action.

## Tasks

| Task | Status | Commit | Files |
|------|--------|--------|-------|
| 1. Manifest listing-fields delta | ✓ | `f21c68e` | `vss-extension.json` |
| 2. `marketplace/overview.md` (GFM detail page) | ✓ | `007e0c7` | `marketplace/overview.md` |
| 3. README.md v1 (engineer audience) | ✓ | `a63b4fc` | `README.md` |
| 4. Icon refinement decision | ✓ (Option II) | (this commit) | `images/icon.png` (unchanged) |
| 5. Screenshot capture | ⏸ checkpoint | — | `images/screenshots/screenshot-calculator-{light,dark}.png` (deferred) |
| 6. Private re-publish to cezari | ⏸ blocked on 5 | — | (no source changes — version walk only) |
| 7. Marketplace render verification | ⏸ blocked on 5+6 | — | — |

## Plan-Check Compliance (H-1, M-1, M-2)

| Issue | Required Fix | Verification |
|-------|--------------|--------------|
| **H-1** (BLOCK) | Replace tautological `! grep -F "content.license"` with Node JSON.parse structural check | Task 1 acceptance: `node -e "const m=JSON.parse(...); if (m.content && m.content.license) process.exit(1)"` exits 0 — confirmed manually before commit. |
| **M-1** | Plan 05-03 frontmatter `depends_on: ["05-02"]` | Confirmed in 05-03-PLAN.md frontmatter; Plan 05-02 commit `ef6f0c5` already in master before 05-03 started. |
| **M-2** | `git remote get-url origin` precondition gate | Verified manually: `https://github.com/tsmshvenieradze/StoryPointExtension.git` matches the four URLs baked into manifest links + repository fields. |

## Spike Verdict Compliance

- **A1 STRIPPED-FALLBACK** — `marketplace/overview.md` and `README.md` both note that "audit comment is human-readable only" / "no machine-parseable round-trip". No promises of round-trip.
- **A3 LAZY-FALLBACK-ONLY** — Both surfaces document the read-only error path: "read-only state surfaces as a write error, not as an upfront block."
- **A4 NO-PROGRAMMATIC-CLOSE** — Both surfaces document the Esc-doesn't-dismiss limitation with click-outside / X workaround.
- **D-11 (formula split)** — `overview.md` user-facing axes only (no math). `README.md` engineer audience includes the full W formula + Fibonacci-rounding table. Audience separation honored.

## Task 4 Decision: Option II (defer icon refinement to Plan 05-05 prerequisite)

**Current state:** `images/icon.png` is 143 bytes — a transparent placeholder from `scripts/generate-placeholder-icon.cjs`. The toolbar-icon.png (112 bytes) is similarly minimal.

**Considered options:**

- **Option I — Programmatic regeneration:** Extend `generate-placeholder-icon.cjs` to draw a simple calculator-themed 128×128 PNG (solid background + geometric shapes via the existing hand-rolled PNG writer). Time cost: ~30 min. Visual quality: low — algorithmic shapes look amateur next to other Marketplace listings.
- **Option II — Defer to Plan 05-05 prerequisite (chosen):** Ship the placeholder for the next Wave 2 cezari smoke runs (icon doesn't materially affect calculator behavior). Plan 05-05 Task 1 explicitly checks that `images/icon.png` is NOT a 143-byte placeholder before flipping `public: true` — the user replaces the file with a hand-designed PNG (or a designer-produced asset) before the public publish runs. Time cost: 0 (deferred). Visual quality: high (real designer asset). Reversible: trivially — it's just a PNG file.

**Rationale:** A blank/algorithmic icon on a public Marketplace listing is a bad first impression. The user is likely to want a hand-designed asset for the public launch anyway. Deferring keeps Phase 5 moving without compromising the public-launch quality.

**Plan 05-05 acceptance criterion (added by this decision):** Before flipping `public: true`, verify that `images/icon.png` is at least 1 KB AND visually inspectable (open in a viewer; should NOT be a transparent / single-color placeholder). If the placeholder is still in place when Plan 05-05 runs, the executor must escalate to the user for a real icon before proceeding with the public publish.

## Files Created / Modified (so far)

### Created
- `marketplace/overview.md` — 71 lines. GFM-formatted Marketplace listing description.

### Modified
- `vss-extension.json` — manifest listing-fields delta (content.details.path, links, repository, screenshots[], expanded tags, marketplace/ in files[]). Version stays 0.2.5; public stays false.
- `README.md` — 35 → 136 lines. Engineer-audience documentation with formula details.

### Unchanged (intentional)
- `images/icon.png` — placeholder retained per Task 4 Option II decision; user replaces before Plan 05-05 public publish.
- `images/toolbar-icon.png` — same.

## Verification Gates Passed

- `npm run typecheck` — clean
- `npm run build` — webpack production succeeds; bundle 146.8 KB / 250 KB (103.2 KB headroom)
- `npm run check:size` — passes
- Manifest JSON valid (`node -e "JSON.parse(...)"`)
- H-1 structural check (`m.content.license` not set) — passes
- M-2 git remote check — passes
- Test suite 398/398 — passes (no test changes)

## Process Deviation — Sandbox Block

Plan 05-03 executor agent hit the same sandbox / Bash permission denial as Plan 05-02 (and Phase 4 worktree agents). After writing `vss-extension.json` (Task 1 file), the agent could not run any verification commands or `git commit`. The orchestrator (running with normal git permissions) verified, committed, and continued Tasks 2–4 inline.

This deviation does NOT affect the plan's behavior contract — file contents and acceptance criteria are identical to what an unblocked agent would produce. It only changes who ran `git add`/`git commit`.

## Awaiting User Action — Task 5 Checkpoint

See the next orchestrator message for the screenshot capture instructions. After the user provides both screenshots, a continuation pass will run Task 6 (private cezari re-publish to validate the listing assets render correctly) and Task 7 (user verification of the Marketplace render).

## Self-Check: PASSED (Tasks 1-3 + Task 4 decision)

- All four completed tasks have empirically verified outputs.
- Each task is committed atomically.
- Spike A1/A3/A4/Probe-4 verdicts honored across both overview.md and README.md.
- Plan-Check H-1/M-1/M-2 fixes baked in.
- D-9 (terse + technical), D-10 (limitations listed publicly), D-11 (formula split: math in README only) all honored.
- Version stays 0.2.5; public stays false (Plan 05-05 owns those flips).
