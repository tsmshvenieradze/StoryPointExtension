# Phase 4: Write Path & Edge Cases - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 04-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 04-write-path-edge-cases
**Areas discussed:** Visible-sentinel UX, Overwrite confirmation UX, Permission detection, Error & success UX, Verification scope, Shared adoFetch util, Cancel-during-write semantics, Post-success pre-fill behavior

---

## Visible-sentinel UX

| Option | Description | Selected |
|--------|-------------|----------|
| Post as HTML (commentFormat=1) | POST with format=html so ADO preserves real <!-- --> HTML comments. Renderer hides them; parser already handles raw form. Cost: one POST flag + a 30-min empirical confirmation that ADO's sanitizer preserves comments. Risk: if sanitizer strips them, fall back to option C. | ✓ |
| Accept the visible sentinel | Post as today. Sentinel renders as literal '<!-- sp-calc:v1 {...} -->' text under the human line. Zero code change, but every audit comment looks technical/messy. The parser remains unchanged. | |
| Different invisible carrier | Move the JSON into a hidden HTML element — e.g., '<div data-sp-calc="v1" hidden>{...JSON...}</div>' or a zero-width payload. Requires both serializer and parser updates plus a migration story for prior <!-- --> sentinels in existing comments. | |
| Hybrid: HTML format, fall back to invisible div | Try HTML-format POST first; if the empirical test in Phase 4 shows ADO strips comments, switch to the invisible-div carrier. Plan and verify both, ship the winner. Higher up-front complexity. | |

**User's choice:** Post as HTML (commentFormat=1)
**Notes:** Plan must include a 30-min empirical confirmation step on cezari before locking. If sanitizer strips comments, fall back to invisible-div carrier (documented but not pre-implemented).

---

## Overwrite confirmation UX (APPLY-04)

### Q1: Confirm panel shape

| Option | Description | Selected |
|--------|-------------|----------|
| Replace calculator with confirm panel | First Apply click hides dropdowns + calc panel and shows a centered panel: 'Current Story Points: X / New Story Points: Y' + Confirm Apply / Back buttons. Back returns to the calculator with selections preserved. Focused decision moment; matches APPLY-04 'in-modal confirmation panel' literal. | ✓ |
| Inline warning + same Apply button | Calculator stays visible; an in-modal MessageCard (severity=Warning) appears above the ButtonGroup: 'This will overwrite Current: X with New: Y'. Apply button text changes to 'Apply (overwrite)'. Requires only one click to confirm — less friction but also less of a 'second confirmation'. | |
| Two-stage Apply button | First Apply click changes Apply label to 'Confirm overwrite (Current X → New Y)' and disables for 500ms. Second click writes. No layout change, no extra panel. Compact but easy to misclick. | |

**User's choice:** Replace calculator with confirm panel
**Notes:** Dropdowns and calc panel are unmounted while confirm is shown (not just hidden) to keep body height stable for the saving overlay.

### Q2: Trigger threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Whenever current SP exists, regardless of new value | Matches APPLY-04 literal: 'When the resolved SP field already has a value'. Always shows Current/New, even if Current == New (lets the user see they're not changing anything before re-Apply re-posts a comment). Predictable behavior. | ✓ |
| Only when Current ≠ New | Skip confirm when the calculation produced the same SP as currently on the field. Saves a click on no-op re-applies but breaks the 'always see what's about to happen' principle and makes the confirm flow conditionally appear. | |
| Only when Current ≠ New AND Current was set by a different sentinel (or no sentinel) | Skip confirm when re-applying an exact match of the current sentinel-recorded calc. Most intelligent behavior, but requires comparing prior sentinel payload to current trio — extra logic for marginal UX benefit. | |

**User's choice:** Whenever current SP exists, regardless of new value
**Notes:** Direct Apply (no confirm) when currentSp is null. Re-applying same value still requires confirm — accepted UX cost.

---

## Permission detection (APPLY-09)

### Q1: Detection mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| IWorkItemFormService.isReadOnly() probe + form events | Call formService.isReadOnly() during the read-path effect. Already a postMessage call (works in dialog iframe per 03-04). Covers Stakeholder license, area-path restrictions, closed-state, locked-by-rule. Surface result in the same readResult state the calculator already consumes. Low risk — same surface that returned getFields/getFieldValue successfully. | ✓ |
| Try-and-react on the actual write | Don't pre-probe. Let the user click Apply; on 403 / forbidden response from comment POST or setFieldValue, show a permission error toast + disable Apply. Simplest code, but the user has already filled dropdowns and confirmed overwrite before discovering they can't save — worse UX, and it potentially leaves a comment posted on the item even though no field write was permitted. | |
| Pre-flight Permissions REST call | Call WorkItemTracking permissions API before showing the calculator. Most explicit, but adds a separate REST round-trip via direct fetch, requires a third api-version pin, and likely returns the same answer as isReadOnly. Cost > benefit unless isReadOnly proves unreliable. | |
| Combined: isReadOnly probe + try-and-react guard | Probe upfront for proactive Apply-disable + tooltip; ALSO catch 403 from the actual writes as a defense-in-depth toast. Most robust at cost of double the failure-path code. Reasonable if you've been bitten by stale isReadOnly returns before. | |

**User's choice:** IWorkItemFormService.isReadOnly() probe + form events

### Q2: Read-only UX

| Option | Description | Selected |
|--------|-------------|----------|
| Calculator opens fully, Apply disabled with tooltip | Matches APPLY-09 literal: 'modal still opens read-only for inspection'. User can still see context, current SP, banners, and tweak dropdowns to play with the calculator. Apply button rendered disabled with tooltip 'You don't have permission to change this work item.' Inspection mode is the value. | |
| Replace calculator with read-only message | Hide dropdowns + calc panel; show only the context line + 'You don't have permission to change this work item.' message. Simpler to render but loses the inspection value the requirement explicitly preserves. | ✓ |
| Show banner + keep Apply enabled (write fails downstream) | Show a Warning banner 'Read-only — you may not have permission to save'. Apply stays enabled; the actual write surfaces a precise error if it fails. Hedges against stale probes but contradicts APPLY-09 'rendered disabled with tooltip'. | |

**User's choice:** Replace calculator with read-only message
**Notes:** Refines APPLY-09 wording — REQUIREMENTS.md APPLY-09 must be updated by planner (mirrors Phase 3 D-17's FIELD-04 rewrite).

### Q3: Probe-fail default

| Option | Description | Selected |
|--------|-------------|----------|
| Default to writable, surface a Warning banner | Same philosophy as Phase 3 D-20 (FieldResolver-fail → default to StoryPoints + warning toast). Don't block the user on probe instability; if the actual write fails, APPLY-08 error UX takes over with a precise message. Banner: 'Could not verify permissions — Apply may fail if this work item is read-only.' | ✓ |
| Default to read-only (fail-closed) | If we can't confirm write permission, assume the user can't write. Safer against accidental writes but blocks legitimate users on transient probe failures. Inverts Phase 3's philosophy. | |
| Block the modal with an error | Show 'Could not load permission state — close and retry'. Most conservative; worst UX. Probably overkill. | |

**User's choice:** Default to writable, surface a Warning banner

---

## Error & success UX (APPLY-08 + post-success)

### Q1: Comment POST failure UX

| Option | Description | Selected |
|--------|-------------|----------|
| In-modal error banner with retry button | azure-devops-ui MessageCard severity=Error appears at the top of the (still-open) confirm-overwrite or calculator panel: 'Could not save audit comment (HTTP {status}). Retry?' + Retry button that re-posts. Selections preserved. No field write attempted (matches Phase 0 D-04). Status code shown for triage. | ✓ |
| Toast notification + modal stays open | Native ADO toast pops with the error message; modal body unchanged. Toast disappears on click. User retries by clicking Apply again. Cleaner modal but the toast can vanish before the user reads it; harder to triage. | |
| Toast + auto-close modal | Toast announces failure, modal closes. User has to reopen the modal and re-fill dropdowns. Worst UX given selections were valid; not aligned with D-04 'modal stays open with selections preserved'. | |

**User's choice:** In-modal error banner with retry button

### Q2: Comment-success / field-fail UX

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent in-modal error + Retry button, comment kept | Banner severity=Error stays visible: 'Audit comment recorded. The Story Points field could not be updated (HTTP {status}). Retry?' Retry re-runs the field write only (comment is already there). Aligned with Phase 0 D-04. Worst-case after several retries, user closes the modal and the audit trail still shows the intent — the parser pre-fills on next open and the user retries. | ✓ |
| Same as above + offer to also re-post comment on retry | User picks: 'Retry field only' or 'Retry both (post a new comment too)'. More flexible but more cognitive load. Phase 0 D-03 says re-posting comments is fine — this option just exposes the choice. | |
| Just a toast — user reopens to retry | Toast announces 'Calculation recorded but field write failed'. Modal closes. User reopens, sees the pre-fill from the just-written sentinel, clicks Apply again. Acceptable given the comment-first invariant but loses the immediate-retry path. | |

**User's choice:** Persistent in-modal error + Retry button, comment kept

### Q3: Success UX

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-close modal + form reflects new SP | Comment-first → field write → .save() completes → brief inline 'Saved ✓' indicator (200ms) → dialog closes via host close affordance. The form's SP field updates via the SDK boundary (setFieldValue + .save() triggers the form's own re-render). Matches Roadmap success criterion 5. Snappy; minimum disruption to the user's flow. | ✓ |
| Stay open showing success state + manual close | Modal switches to a success view: 'Saved Story Points = 5. Open again to recalculate.' with a Close button. User dismisses explicitly. Lets user verify but adds a click; potentially confusing if user expects the modal to close like the cezari verifier expectation. | |
| Auto-close + native ADO toast 'Story Points saved' | Modal closes immediately; an ADO toast confirms. Slightly noisier but provides an external success signal. Toast may not be technically possible from inside the dialog iframe — needs verification. | |

**User's choice:** Auto-close modal + form reflects new SP
**Notes:** Programmatic close mechanism (per Phase 3 Override 1, body Cancel can't programmatically close) needs cezari verification — likely SDK.notifyDialogResult or instructing user via the inline indicator.

### Q4: Status code map

| Option | Description | Selected |
|--------|-------------|----------|
| Specific copy for 401/403/404/409/412/429/5xx + generic fallback | Each code maps to a one-sentence user-facing phrase. e.g., 401→'Sign in expired.', 403→'You don't have permission to change this item.', 412→'Work item changed since the modal opened — reload and try again.' (RuleValidationException), 429→'Azure DevOps is throttling requests — wait a moment and retry.', 5xx→'Azure DevOps server error.', else→'Could not save (HTTP {status}).' Plus the raw status code in parens for triage. | ✓ |
| Generic 'Could not save (HTTP {status})' for all codes | One template, fewer translation strings to maintain, raw status drives the user to error docs. Cheaper but less helpful; 412 RuleValidationException in particular is a common ADO write-conflict that benefits from explicit retry guidance. | |
| You decide | Defer to planner / researcher to fill in the status map after researching ADO's documented response codes for setFieldValue/.save() and addComment. | |

**User's choice:** Specific copy for 401/403/404/409/412/429/5xx + generic fallback

---

## Phase 4 verification scope

| Option | Description | Selected |
|--------|-------------|----------|
| cezari Scrum + permission scenarios + light unit tests | Mirror Phase 3-04 approach: dev-publish to cezari, manual checklist covering: write succeeds on a fresh PBI, overwrite confirm panel renders + Confirm/Back works, comment-first → field write order observable in network tab, simulated comment failure (e.g., temporarily mangle URL) shows correct error UX, simulated 412 (modify field after modal open) shows correct error UX, isReadOnly read-only branch tested by changing user license to Stakeholder. Defer CMMI to Phase 5 per D-31. Light vitest tests for the post-comment fetch helper + status-code mapping function. | ✓ |
| Same as above + add CMMI trial org now | Spin a fresh CMMI trial org during Phase 4 instead of Phase 5; verify Microsoft.VSTS.Scheduling.Size write path. Pulls forward Phase 5 D-14. Adds ~1–2 hours of setup (trial signup, install, manual checklist) but de-risks Phase 5 publish. | |
| Minimal: cezari happy-path only | Verify just the happy path on cezari (write succeeds, comment appears, pre-fill on reopen). Defer error scenarios + permission scenarios to bug-back fixes after Phase 5 publish. Faster but loses Phase 4's chance to catch live-org regressions like 03-04 did. | |

**User's choice:** cezari Scrum + permission scenarios + light unit tests

---

## Shared adoFetch util

| Option | Description | Selected |
|--------|-------------|----------|
| Extract shared helper in src/ado/adoFetch.ts | New file: 'export async function adoFetch<T>(method, path, body?, opts?): Promise<T>' that handles URL construction (host.name + isHosted branch), token acquisition, JSON encode/decode, error throwing on !ok. comments.ts and the new postComment.ts both consume it. Single source of truth for the direct-fetch pattern; future-proof for any v2 REST call. | ✓ |
| Internal helper in src/ado/comments.ts — keep scoped | Refactor comments.ts so its private 'fetchModern' helper takes (method, path, body) and is exported for postComment.ts to use. Avoids creating a new file; tightly couples the two REST calls but they'll evolve together anyway. | |
| Inline duplicate in src/ado/postComment.ts | Copy the URL/token construction inline into postComment.ts. Zero refactor, but two copies of the pattern to maintain. Acceptable for a 2-file v1; rejected for clarity. | |

**User's choice:** Extract shared helper in src/ado/adoFetch.ts

---

## Cancel-during-write semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Block close affordances + show 'Saving...' overlay | While in-flight: ButtonGroup Apply button shows spinner/'Saving...' label and is disabled; a translucent overlay covers the body so dropdown re-edits are blocked; we attempt to set host's lightDismiss=false during the in-flight window via openCustomDialog options if available (or document as a Phase 4 verification check). On Esc / X click, an 'In progress — wait for save to complete' tooltip appears. Predictable; aligned with the 200ms success-then-close path. | ✓ |
| Allow close + abort in-flight requests via AbortController | Pass an AbortController to fetch; on Cancel/X/Esc, abort. If the comment POST aborts mid-flight, no field write follows. If the field write aborts mid-flight after a successful comment, the comment is still in the audit log — user reopens, parser pre-fills, retries. More cancel-friendly but complicates the 'comment kept on partial failure' invariant. | |
| Allow close + let request finish (orphan) | User closes the modal; the in-flight fetch promise still resolves in the background but its result is discarded. Same write completes, but no UI surface remains to react to the result. Risk: user thinks they cancelled but the write completes. Rejected for confusing semantics. | |

**User's choice:** Block close affordances + show 'Saving...' overlay
**Notes:** No AbortController plumbing. If lightDismiss runtime toggle proves impossible, document as known Phase 4 limitation and rely on the sub-second saving window + audit-comment recovery path.

---

## Post-success pre-fill behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Same Phase 3 D-12 behavior — pre-fill + standard banner | The just-posted sentinel becomes the most-recent. Pre-fill populates the trio; banner reads 'Pre-filled from your last calculation on May 2, 2026.' Field SP and sentinel SP match (D-14 mismatch addendum suppressed). Simplest — zero new UX, zero new logic. The audit comment serves its dual purpose exactly as designed. | ✓ |
| Suppress banner when sentinel matches current SP (no-op pre-fill) | If sentinel.sp equals current SP, skip the banner entirely (still pre-fill the dropdowns silently). Reduces banner noise on every reopen of items the user has just calculated. Adds one extra equality check; banner appears only when there's a real story to tell (mismatch or first-time). | |
| Add 'Just saved' visual cue when reopen happens within N minutes | Track a session-local timestamp; if the modal reopens within 5 minutes of a successful Apply, banner reads 'Saved {N seconds} ago. Re-calculate or close.' Cute but per-iframe-lifetime state is fragile (each modal is a fresh iframe per dialog open) — would need a small extension-data ping. | |

**User's choice:** Same Phase 3 D-12 behavior — pre-fill + standard banner

---

## Claude's Discretion

Items the user said "Claude decides" (or where the discussion captured a recommended option without specifying every implementation detail):

- Exact MessageCard wording for D-08 / D-09 banners (within the friendliness/precision template)
- Whether `stubApply.ts` is renamed to `apply.ts` or its contents simply replaced
- File organization inside `src/ado/` (`postComment.ts` standalone vs. extending an existing bridge file)
- Saving overlay style — translucent backdrop vs. spinner-only inline replacement
- Whether the success "Saved ✓" indicator is a banner, an inline label, or a brief replacement of the ButtonGroup
- Exact mechanism to programmatically close the host dialog (D-10) — `SDK.notifyDialogResult` vs. an instruction line to press Esc; planner verifies on cezari
- Whether to surface SDK error message verbatim in the D-11 generic fallback for triage
- AbortController plumbing decision — currently not wired (D-15); revisit only if lightDismiss runtime toggle proves impossible

## Deferred Ideas

Captured during discussion as belonging in other phases:

- CMMI live verification — Phase 5
- Custom SP field rename support — PROJECT.md Out of Scope; revisit in v2 if user demand
- Bundle-size CI gate — Phase 5 PKG-03
- `dev-publish.cjs` Windows retry fix — Phase 5 cleanup
- "Just saved" reopen banner with session-local timestamp — rejected for D-16 fragility
- Telemetry / analytics on apply errors — Out of Scope
- Multi-step retry strategy (exponential backoff on 429) — manual retry suffices
- Marketplace listing assets, public publish — Phase 5
- Per-component theme matrix + per-key keyboard transcripts — Phase 5 polish
- Auto-detect "story-point-like" custom fields by data-type heuristic — Phase 5 stretch
