# Phase 3: Modal UI & Read Path - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 3-Modal UI & Read Path
**Areas discussed:** Modal layout & calc panel, Pre-fill UX from prior sentinel, FieldResolver disable strategy, Apply boundary + read errors

---

## Modal layout & calc panel

### Q1: How should the modal arrange the three dropdowns and the live Calculation Details panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked vertical | Dropdowns top, Calc Details panel below them, footer with Apply/Cancel. Single column. Reads top-to-bottom. Simplest for ADO's typically ~600px-wide custom dialog. Plays well with keyboard tab order. | ✓ |
| Two-column | Dropdowns on left, calc details on right. Live calc visually updates as you pick. Wider footprint — fits if dialog is given a wider sizing. | |
| Inline scores + summary | Each dropdown shows its 1–5 numeric score inline; calc summary in a small strip at the bottom. Most compact. Less explanatory — the formula has to live somewhere else. | |

**User's choice:** Stacked vertical
**Notes:** Recommended option chosen as-is.

### Q2: How prominent should the Final SP be in the Calculation Details panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Big number, hero treatment | Final SP rendered as a large, bold number. W and Raw SP smaller as supporting numbers. Matches the user's 30-second value: the answer is unmissable. | ✓ |
| Equal-weight rows | All three numbers (W, Raw SP, Final SP) shown in a single aligned row or table. Same font size. More 'scientific'/audit-friendly. | |
| Hero number, formula collapsed | Big Final SP. W and Raw SP shown but the formula text hidden behind an expandable 'Show formula' toggle. | |

**User's choice:** Big number, hero treatment
**Notes:** Recommended option chosen.

### Q3: Where should the current SP value (from APPLY-01 read) appear in the modal?

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle context line at top | Small line below the modal header: 'Work item #1234 · Current Story Points: 5' (or 'Current Story Points: — (not set)'). Sets context without dominating. | ✓ |
| Inside calc panel as comparison row | Calc Details panel shows 'Current: 5  →  New: 3' as a row. | |
| Pill / badge near the title | Compact pill 'Current SP: 5' next to or under the dialog title. | |

**User's choice:** Subtle context line at top
**Notes:** Recommended option chosen.

### Q4: What should the Calc Details panel show before the user has selected anything?

| Option | Description | Selected |
|--------|-------------|----------|
| Em-dash placeholders, formula visible | Final SP = '—', W = '—', Raw SP = '—'. Formula text visible. Panel always rendered, never moves — no layout shift when user picks the third dropdown. | ✓ |
| Partial calc as user picks | Compute incrementally: after 1 dropdown picked, show partial W contribution; after 2, show partial; after 3, full result. | |
| Hidden until all three selected | Calc panel doesn't render at all until all three dropdowns are filled. | |

**User's choice:** Em-dash placeholders, formula visible
**Notes:** Recommended option chosen.

### Q5: Cancel button — should it confirm before discarding changes when the user has made selections?

| Option | Description | Selected |
|--------|-------------|----------|
| Always close immediately | Cancel just closes the dialog. No confirm prompt. Modal is short-lived (30-second flow), nothing destructive happens on Cancel. | ✓ |
| Confirm if user picked any dropdown | If at least one dropdown is selected, show a 'Discard your selections?' confirm. | |
| Confirm only after pre-fill is modified | If pre-fill loaded values from a prior sentinel and user changed any of them, then confirm. | |

**User's choice:** Always close immediately
**Notes:** Recommended option chosen.

### Q6: Modal width sizing — use ADO's default custom dialog width, or specify a target width?

| Option | Description | Selected |
|--------|-------------|----------|
| ADO default | Don't pass `width`/`height` to openCustomDialog. Use whatever the host defaults provide. | |
| Pin specific width (e.g., 560px) | Pass an explicit width for predictable layout. | |
| You decide | Planner picks based on Phase 2's actual modal sizing observed on cezari. | |

**User's choice:** Free-text — "The current modal size is small, the main thing is that it doesn't scroll."
**Notes:** User wants to keep Phase 2's small modal footprint but ensure Phase 3's content fits without a scrollbar. Planner verifies on cezari and adjusts height/width if needed. Captured as D-06.

### Q7: Dropdown empty-state — what placeholder shows before the user has picked a level?

| Option | Description | Selected |
|--------|-------------|----------|
| 'Select level…' | Standard pattern, makes it clear the dropdown is empty/required. | ✓ |
| Default to Medium (3) | Pre-select Medium for all three dropdowns. Risks anchoring users to 5 SP without thinking. | |
| First option (Very Easy) | Pre-select Very Easy. Same anchoring concern. | |

**User's choice:** 'Select level…'
**Notes:** Recommended option chosen.

### Q8: Apply button placement — dialog footer (host-managed) or inside the modal body?

| Option | Description | Selected |
|--------|-------------|----------|
| Host dialog footer | Use openCustomDialog's footer button API. Native ADO look. Primary action styling automatic. | ✓ |
| Inside modal body | Render Apply/Cancel as 'azure-devops-ui' Buttons inside the body. More state control but visual mismatch. | |
| You decide | Planner picks based on which API the host dialog actually exposes for footer buttons in v4 SDK. | |

**User's choice:** Host dialog footer
**Notes:** Recommended option chosen.

### Q9: Should the modal show the work item title (in addition to ID)?

| Option | Description | Selected |
|--------|-------------|----------|
| ID + title | 'Work item #1234 · "Add user search to dashboard" · Current Story Points: 5'. Helps verify the right item. | ✓ |
| ID only | Just '#1234 · Current Story Points: 5'. One fewer SDK call on modal open. | |
| Type + ID + title | Adds work item type label — useful with FieldResolver caching by type. | |

**User's choice:** ID + title
**Notes:** Recommended option chosen.

### Q10: Level option labels — keep the calc engine's exact labels, or display variants?

| Option | Description | Selected |
|--------|-------------|----------|
| Exact engine labels | Use 'Very Easy / Easy / Medium / Hard / Very Hard' verbatim from `LEVELS`. Single source of truth. | ✓ |
| Add 1–5 numeric prefix | Display as '1 — Very Easy', etc. Helps users see the underlying score. | |
| Per-dimension labels | Each dimension gets domain-tuned labels. Diverges from xlsx + audit format. | |

**User's choice:** Exact engine labels
**Notes:** Recommended option chosen.

### Q11: Dropdown ordering — Very Easy first, or Very Hard first?

| Option | Description | Selected |
|--------|-------------|----------|
| Very Easy first | Top-to-bottom: Very Easy → Very Hard. Matches xlsx, sentinel, LEVELS array. | ✓ |
| Very Hard first | Pessimistic-first to combat anchoring on easy estimates. | |
| You decide | Planner picks; default to xlsx order. | |

**User's choice:** Very Easy first
**Notes:** Recommended option chosen.

### Q12: Modal title — keep 'Calculate Story Points' or contextualize?

| Option | Description | Selected |
|--------|-------------|----------|
| 'Calculate Story Points' | Same string as the toolbar button label (Phase 2 D-07). Consistency. | ✓ |
| 'Story Point Calculator' (Marketplace name) | Slightly more 'product' framing inside the modal. | |
| Drop title, lead with context line | No header title; saves vertical space. | |

**User's choice:** 'Calculate Story Points'
**Notes:** Recommended option chosen.

---

## Pre-fill UX from prior sentinel

### Q1: When parseLatest finds a prior sentinel comment, how should the dropdowns behave on modal open?

| Option | Description | Selected |
|--------|-------------|----------|
| Silently populate + show provenance banner | Dropdowns appear pre-filled; MessageCard at top says 'Pre-filled from your last calculation — [date].' Banner is dismissable. Apply enabled. | ✓ |
| Silent populate, no banner | Dropdowns pre-fill; no banner. Cleanest visual. Risk: user assumes values were defaults. | |
| Show prior values without auto-filling dropdowns | Calc panel shows 'Last calculation: SP=3' as read-only; user must re-pick. | |

**User's choice:** Silently populate + show provenance banner
**Notes:** Recommended option chosen.

### Q2: What about the case where pre-filled SP doesn't match the current SP field?

| Option | Description | Selected |
|--------|-------------|----------|
| Banner notes the mismatch | Same banner adds: 'Field currently shows 5 — someone may have edited it directly.' Informational. | ✓ |
| Warning-style banner | Same content but rendered as MessageCard severity=Warning. Visually louder. | |
| Two banners: provenance + mismatch | One always-on, one only-when-mismatch. More information; takes vertical space. | |
| Inline in calc panel | No banner; the 'Current: 5' line gets a subtle marker '5 (last calc said 3)'. | |

**User's choice:** Banner notes the mismatch
**Notes:** Recommended option chosen.

### Q3: What date/time format should the provenance banner show?

| Option | Description | Selected |
|--------|-------------|----------|
| Relative ('2 days ago') | Friendly, no locale concerns. | |
| Absolute date ('on May 1, 2026') | Locale-aware via Intl.DateTimeFormat. Auditable. Worse for 'a few minutes ago' cases. | ✓ |
| Both ('2 days ago — May 1, 2026') | Most informative; takes more horizontal space. | |

**User's choice:** Absolute date
**Notes:** User explicitly chose absolute over the recommended relative — auditable framing wins for an estimation tool that leaves a permanent record.

### Q4: What if parseLatest finds a sentinel but its level strings don't match LEVELS (corruption / future schema)?

| Option | Description | Selected |
|--------|-------------|----------|
| Treat as no pre-fill, log to console | Modal opens empty. console.warn for debugging. AUDIT module already filters schemaVersion≠1; this is the second-line guard. | ✓ |
| Show pre-fill banner with warning | Banner says 'Last calculation could not be loaded — starting fresh.' | |
| You decide | Planner picks. | |

**User's choice:** Treat as no pre-fill, log to console
**Notes:** Recommended option chosen.

---

## FieldResolver disable strategy

### Q1: When/where does the FieldResolver probe happen?

| Option | Description | Selected |
|--------|-------------|----------|
| On modal open (lazy) | Toolbar button always enabled. On click, modal opens; FieldResolver runs first; if neither field exists, modal shows a centered MessageCard. | ✓ |
| Pre-check on form load (eager) | Toolbar entry registers an IWorkItemNotificationListener.onLoaded; toolbar entry grayed-out per work item type. | |
| Hybrid: probe on click, cache result, disable on subsequent loads | First click probes; cache hit → disable on next load. | |

**User's choice:** On modal open (lazy)
**Notes:** Recommended chosen. This shifts FIELD-04's literal "disabled toolbar button" to "modal-open with clear message" — see next Q.

### Q2: Re-interpret FIELD-04 from 'toolbar button disabled with tooltip' to 'modal opens with clear message'?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, re-interpret FIELD-04 | Update REQUIREMENTS.md FIELD-04 wording. Capture in CONTEXT.md as a deliberate scope refinement. | ✓ |
| Keep FIELD-04 literal — reverse my previous answer | Revert to eager pre-check on form load. | |
| Both — toolbar fade + modal fallback | Belt-and-suspenders. More code paths. | |

**User's choice:** Yes, re-interpret FIELD-04
**Notes:** Recommended chosen. Planner MUST add a task to update REQUIREMENTS.md FIELD-04 wording before Phase 3 closes — otherwise verification will fail against the literal pre-discussion text.

### Q3: What does the 'no SP field' modal look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain message + close (with field reference names) | MessageCard severity=Info: '...This work item type ({typeName}) doesn't have a Story Points field...' One Close button. | ✓ |
| Friendly message, no field reference names | Hides Microsoft.VSTS.* internals. | |
| Show probed field list for debugging | 'We looked for: ... Neither was present.' | |

**User's choice:** Plain message + close
**Notes:** Recommended chosen. Includes the Microsoft.VSTS.* reference names — honest/technical, given the audience is engineering teams.

### Q4: FIELD-03 cache lifetime and storage?

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory, iframe lifetime | Module-level Map keyed by (projectId|typeName). Per-dialog-open cache. | ✓ |
| In-memory, toolbar iframe lifetime | Survives multiple modal opens. Conflicts with lazy-probe choice. | |
| Persisted via ADO Extension Data Service | Cache survives across browser sessions. Reject for v1. | |

**User's choice:** In-memory, iframe lifetime
**Notes:** Recommended chosen.

### Q5: What if FieldResolver itself fails (network glitch, getFields throws)?

| Option | Description | Selected |
|--------|-------------|----------|
| Default to 'StoryPoints', show warning toast | Assume the most common case. Continue rendering modal. Toast visible to user. | ✓ |
| Fail closed — show 'no field' modal | Treat probe failure same as 'neither field exists'. | |
| Retry probe once, then default | Single retry with 500ms backoff. | |

**User's choice:** Default to 'StoryPoints', show warning toast
**Notes:** Recommended chosen.

---

## Apply boundary + read errors

### Q1: What does the Apply button do in Phase 3?

| Option | Description | Selected |
|--------|-------------|----------|
| Wired-but-stubbed click handler | Real handler computes calc result, console.logs the would-be write, closes dialog. Phase 4 swaps the log block for the real write. | ✓ |
| Disabled with 'Coming in Phase 4' label | Apply rendered but always disabled. Cleanest scope but doesn't test the click handler. | |
| Visible but throws 'Not implemented' | Apply enabled when 3 selected, click throws. Worse UX. | |
| No Apply button at all in Phase 3 | Drop Apply. Risks UI-05 wording becoming Phase 4 work. | |

**User's choice:** Wired-but-stubbed click handler
**Notes:** Recommended chosen.

### Q2: On modal open, FieldResolver + getFieldValue + getComments all run async. What's shown during that ~100–500ms read latency?

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton dropdowns + spinner header | Layout renders immediately; dropdowns show small Spinner/skeleton until reads complete. | ✓ |
| Full-modal Spinner overlay | Centered Spinner until everything loads. | |
| Render form immediately, populate when reads return | No spinner; banner pops in when getComments returns. May feel jumpy. | |

**User's choice:** Skeleton dropdowns + spinner header
**Notes:** Recommended chosen.

### Q3: If getComments fails (network error, REST 500), how should the modal behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Open with no pre-fill + warning banner | MessageCard severity=Warning: 'Could not load prior calculations — starting fresh.' | ✓ |
| Open with no pre-fill, no banner | Silent fallback. | |
| Block modal with error | Modal shows error MessageCard with Retry + Close. | |

**User's choice:** Open with no pre-fill + warning banner
**Notes:** Recommended chosen.

### Q4: If getFieldValue (current SP) fails, how should the modal behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Open with 'Current Story Points: —' | Treat unreadable as empty. Don't block. | ✓ |
| Open with warning banner | Add a MessageCard 'Could not read current SP value.' | |
| Block modal with retry | Spinner never resolves into the form. | |

**User's choice:** Open with 'Current Story Points: —'
**Notes:** Recommended chosen.

### Q5: Does Phase 3 verify against an actual ADO dev org (cezari) like Phase 2 did?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual verification on cezari + light unit tests for FieldResolver | Same dev-publish loop as Phase 2. Plus vitest unit tests for FieldResolver lookup priority. | ✓ |
| Unit tests only (no manual) | Mock SDK + REST clients; rely on Phase 2's proven shell. | |
| Manual only (no FieldResolver unit tests) | Skip unit tests. Risk: lookup priority bug breaks CMMI. | |

**User's choice:** Manual verification on cezari + light unit tests for FieldResolver
**Notes:** Recommended chosen.

---

## Claude's Discretion

The user delegated several detail-level choices to the planner (captured in CONTEXT.md `### Claude's Discretion`):

- Exact module split inside `src/ado/` (single bridge file vs split per concern).
- Whether Phase 2's `azure-devops-ui` `Page` wrapper is reused or replaced with a flatter container in Phase 3.
- Spinner vs skeleton specifics for D-24.
- Toast / MessageBar component picked for D-20.
- Exact MessageCard wording for the no-field UI (D-19) and the read-error banners (D-25).
- Whether stub-Apply (D-27) lives in `modal.tsx` or in a separate `applyHandler.ts` ready for Phase 4.
- Keyboard nav implementation (whether `azure-devops-ui` Dropdown handles Enter natively or a custom keydown handler is needed).
- Modal width and height units (px vs ADO size enum) when sizing for the no-scrollbar requirement (D-06).

## Deferred Ideas

- Toolbar button disabled at form load (eager probe) — revisit in v1.x patch if user feedback shows lazy-probe is confusing.
- Custom field-rename support — out of scope per PROJECT.md; defer to possible v2 after user demand.
- Configurable level labels per dimension — v2 SETT-04.
- Hot-reload dev experience — same as Phase 2 deferred.
- Bundle-size CI gate — Phase 5 PKG-03.
- Branded marketplace icon / screenshots — Phase 5.
- Permission pre-check disabling Apply (APPLY-09) — Phase 4.
- Overwrite confirmation panel "Current X / New Y" (APPLY-04) — Phase 4.
- Real write-path failure UX (status-code-specific toasts, RuleValidationException) (APPLY-08) — Phase 4.
