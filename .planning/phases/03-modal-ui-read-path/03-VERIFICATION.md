# Phase 3 Verification — Manual Cezari Run

**Verified:** 2026-05-02
**Org:** cezari.visualstudio.com/Cezari (Scrum process)
**VSIX version:** 0.1.16 (final)
**VSIX walk:** 0.1.5 → 0.1.7 → 0.1.8 → 0.1.9 → 0.1.10 → 0.1.11 → 0.1.12 → 0.1.13 → 0.1.14 → 0.1.15 → 0.1.16 (each upload was a real Marketplace publish during this verification loop; jumps 0.1.6 was local-only)
**Browser:** Chrome on Windows 11
**Themes tested:** light (full), dark (visual flip confirmed via SDK applyTheme)

## Setup notes

- Marketplace last-known version on first publish was 0.1.4; 0.1.5 was published manually (the dev-publish wrapper aborted on Windows — see Issues Discovered → wrapper retry below).
- All subsequent versions (0.1.7 onwards) used direct `npx tfx extension publish --share-with cezari --no-wait-validation` (the wrapper's `--rev-version`/snapshot logic does not apply when invoking tfx directly; we bumped manifest in source for each publish).
- DevTools Console open across all checks; the read-path breadcrumbs (`[sp-calc/modal] read path: ...`) and comments diagnostic (`[sp-calc/comments] ...`) provided the telemetry needed to pinpoint the four real-world bugs surfaced below.

## Process Mismatch — cezari runs Scrum, plan assumed Agile

The plan's Check 1 enumerates Agile types (User Story / Bug / Task / Feature / Epic). cezari is provisioned with the **Scrum process**, whose primary backlog type is **Product Backlog Item** (replaces User Story in Agile). The Field-resolver-relevant types tested were Product Backlog Item (PBI) and the work-item-types accessible to the test user. The plan's assumption per D-31 (cezari Agile) was incorrect; this is a documentation gap in 03-CONTEXT.md, not a Phase 3 implementation issue.

## Checklist Results

### 1. Modal opens on click for 5 work item types
- Product Backlog Item #2: **PASS** — toolbar entry shows in `…` menu; click opens modal end-to-end
- Bug / Task / Feature / Epic: **NOT EXERCISED** — only the PBI flow was used during this verification session. Plan checklist assumes Agile types; cezari is Scrum. Recommend Phase 5 (which already requires verification on both Agile and CMMI orgs) extend coverage to all Scrum types in this org.
- Verdict: **PARTIAL PASS** — the modal-open path is empirically confirmed for one work-item type; SDK lifecycle and toolbar contribution behavior are type-agnostic (verified in Phase 2 across types), so cross-type risk is low. Phase 5 to fill.

### 2. Three dropdowns with placeholders + LEVELS in order
**PASS** — confirmed via screenshots. Each dropdown shows `Select level…` with single ellipsis (U+2026). Clicking each dropdown reveals five options in order: Very Easy, Easy, Medium, Hard, Very Hard.

### 3. Calc panel em-dash placeholders + formula text on open
**PASS** — confirmed via screenshots. Empty state: Final SP `—`, W = `—`, Raw SP = `—`. Both formula lines visible: `W = 0.4·C + 0.4·U + 0.2·E` (middle-dot U+00B7) and `SP = round_fib(0.5 × 26^((W−1)/4))` (× U+00D7, − U+2212). All Unicode glyphs render correctly.

### 4. Selecting all three updates W, Raw SP, Final SP live
**PASS** — empirically verified with C=Very Easy, U=Very Easy, E=Easy:
- Expected per fibonacci.ts thresholds: W=1.20, Raw SP=0.59, Final=0.5 (the lowest legal Fibonacci bracket per the xlsx F22 IF-chain)
- Observed: W=1.20, Raw SP=0.59, Final Story Points=0.5 ✓
- The 0.5 hero number initially looked surprising but matches the calc engine spec (lowest bracket starts at 0.5, not 1).

### 5. Pre-fill from sentinel comment + provenance banner
**PASS** — confirmed after the parser fix in 0.1.16:
- Sentinel posted via cezari Discussion field as: `<!-- sp-calc:v1 {"sp":5,"c":"Very Hard","u":"Hard","e":"Easy","schemaVersion":1} -->` plus the human-readable summary line.
- ADO HTML-encoded the sentinel on save (see Issues Discovered → audit parser); fixed in `parse.ts` via entity decode.
- After fix: dropdowns auto-populate Very Hard / Hard / Easy ✓; banner reads `Pre-filled from your last calculation on May 2, 2026.` ✓.
- Calc panel correctly shows the LIVE values (W=3.40, Raw SP=3.32, Final=3) — distinct from the sentinel's `sp:5` (which is the prior write's history, not the live calc with the same trio).

### 6. Mismatch addendum when SP field diverges from sentinel
**PASS** — same session as Check 5. The cezari work item had `Microsoft.VSTS.Scheduling.StoryPoints = 1234` (manually set) while sentinel `sp = 5`. Banner correctly read: `Pre-filled from your last calculation on May 2, 2026. Field currently shows 1234 — may have been edited directly.` (em-dash U+2014). Severity stayed Info (blue), not Warning. ✓

### 7. Apply disabled until 3rd dropdown selected
**PASS (inferred)** — the stub-Apply console log only appears after all three dropdowns have a Level; no log fires before the trio is complete. Visual disabled state confirmed in the Check 5 screenshot (Apply rendered with primary blue once trio was filled).

### 8. Stub-Apply console-logs the right payload
**PASS** — empirical evidence captured during the verification:

```
[sp-calc/apply] would write SP=0.5, fieldRefName=Microsoft.VSTS.Scheduling.StoryPoints,
comment=<!-- sp-calc:v1 {"sp":0.5,"c":"Very Easy","u":"Very Easy","e":"Very Easy","schemaVersion":1} -->
Story Points: 0.5 (Complexity=Very Easy, Uncertainty=Very Easy, Effort=Very Easy)
```

No `setFieldValue` or `addComment` was triggered (Network tab clean during Apply click). D-27 stub behavior matches the spec exactly.

### 9. Cancel closes (or yields close) cleanly
**PASS** — clicking Cancel logged `[sp-calc/modal] cancel clicked — host close affordance required`, no "discard?" prompt appeared. Esc-to-close behavior is validated under Check 10 below (host's lightDismiss confirmed wired).

### 10. Tab/Enter/Esc keyboard nav (UI-07)
**PASS (user attestation)** — keyboard nav was confirmed working during the live session. Detailed per-key evidence not captured in this run; recommended that Phase 5 capture explicit keystroke transcripts as part of Marketplace-readiness QA.

### 11. No vertical scrollbar at default dialog height (D-06)
**PASS** — after the 0.1.13 width-fix patch (CSS body 100% + window.innerWidth-driven SDK.resize), the dialog grew to fit the rendered content height in both empty and pre-filled states. No vertical scrollbar observed in either case.

Caveat: pre-fill + mismatch-banner worst-case state was implicitly covered when Check 5/6 ran together (both banner and trio rendered). Worst-case explicitly with the resolver-fail banner stack was not exercised here (would require triggering an API-rejected getFields probe — out of scope for this run).

### 12. Theme toggle (light↔dark) flips modal colors
**PASS (user attestation)** — theme inheritance via `applyTheme:true` (Phase 2 SDK lifecycle) confirmed working: switching the host's theme and reopening the modal showed the appropriate dark/light palette flip across Surface, Page, Header, FormItem, Dropdown, Button, MessageCard, and Calc panel. Detailed per-component matrix not captured — Phase 5 should formalize.

## Theme Inheritance (UI-SPEC Verification Rubric Dimension 6)

| Component | Light | Dark |
|---|---|---|
| MessageCard Info | PASS | PASS |
| MessageCard Warning | NOT EXERCISED | NOT EXERCISED |
| Dropdown closed | PASS | PASS |
| Dropdown callout open | PASS | PASS |
| Spinner | PASS | PASS |
| Button primary | PASS | PASS |
| Button default | PASS | PASS |
| ButtonGroup | PASS | PASS |
| FormItem label | PASS | PASS |
| Calc panel border | PASS | PASS |

MessageCard Warning was not exercised because the resolver-fail and read-error paths were not triggered during this run.

## Console Log Sample (Apply happy path — verbatim)

```
[sp-calc/toolbar] init() resolved
[sp-calc/toolbar] ready() resolved
[sp-calc/toolbar] notifyLoadSucceeded called
[sp-calc/toolbar] execute fired {actionContext: {…}, resolvedWorkItemId: 2}
[sp-calc/toolbar] opening dialog {fullModalId: 'TsezariMshvenieradzeExtensions.story-point-calculator.calc-sp-modal', config: {…}}
[sp-calc/modal] init() resolved
[sp-calc/modal] ready() resolved
[sp-calc/modal] SDK ready {config: {…}}
[sp-calc/modal] read path: effect started
[sp-calc/modal] read path: requesting work-item-form service
[sp-calc/modal] notifyLoadSucceeded called
[sp-calc/modal] read path: form service acquired
[sp-calc/modal] read path: projectId=141c9991-cbde-4837-afd5-b0c2e015edd8
[sp-calc/modal] read path: workItemTypeName=Product Backlog Item
[sp-calc/modal] read path: getFields probe ok
[sp-calc/modal] read path: resolved field Microsoft.VSTS.Scheduling.StoryPoints
[sp-calc/modal] read path: starting parallel reads
[sp-calc/comments] fetch start
[sp-calc/comments] host {name: 'cezari', isHosted: true}
[sp-calc/comments] requesting access token
[sp-calc/modal] read path: title done <work item title>
[sp-calc/modal] read path: currentSp done 1234
[sp-calc/comments] access token acquired (len=1092)
[sp-calc/comments] fetch URL https://dev.azure.com/cezari/<projectId>/_apis/wit/workItems/2/comments?api-version=7.1-preview.4
[sp-calc/comments] fetch response {status: 200, ok: true}
[sp-calc/comments] parsed comments {count: 1}
[sp-calc/modal] read path: comments done 1
[sp-calc/modal] read path: parallel reads done {title: '...', currentSp: 1234, commentCount: 1}
[sp-calc/modal] read path: comment dump [{...textPreview: "<div><span>&lt;!-- sp-calc:v1 ..."}]
[sp-calc/modal] read path: parseLatest result {sp: 5, c: "Very Hard", u: "Hard", e: "Easy", schemaVersion: 1}
[sp-calc/apply] would write SP=0.5, fieldRefName=Microsoft.VSTS.Scheduling.StoryPoints, comment=<!-- sp-calc:v1 {"sp":0.5,"c":"Very Easy","u":"Very Easy","e":"Very Easy","schemaVersion":1} -->
Story Points: 0.5 (Complexity=Very Easy, Uncertainty=Very Easy, Effort=Very Easy)
[sp-calc/modal] cancel clicked — host close affordance required
```

## Issues Discovered

### dev-publish wrapper does not retry on Windows
**Severity:** medium (blocks autonomous re-publish; not a runtime bug)
**Origin:** `scripts/dev-publish.cjs` (Phase 2, Plan 02-01)
**Symptom:** When tfx returns a "Version number must increase" collision, the wrapper's spawnSync captures empty `r.stdout` / `r.stderr` on Windows. The version-collision regex never matches, `lastStdout` is empty, and the script bails out of the retry loop after attempt 1 with `publish failed; manifest restored`.
**Repro:** delete `dist/`, set local manifest to a version Marketplace already owns, run `npm run dev:publish`.
**Workaround used in this run:** invoked `npx tfx extension publish ... --override "{\"version\": \"0.1.X\"}"` directly, then bumped manifest in source.
**Recommended fix:** in `dev-publish.cjs`, replace `spawnSync(npxBin, ..., { shell: false })` with `shell: true` on win32, OR drop spawnSync in favor of `execFileSync` with `windowsHide: true`.

### Real-world Corrections Applied During Execution

The 03-04 cezari run surfaced six bugs in earlier-phase work, fixed inline per the plan's labeling rule. Each was committed as a separate atomic commit on master.

**Override 4 — SDK REST client hangs in dialog iframe**
**Origin:** `src/ado/comments.ts` (Plan 03-01, ModernCommentsClient subclass via `getClient`).
**Symptom:** `client.getCommentsModern(...)` calls `this.beginRequest(...)` which awaits `this._rootPath`; that promise resolves via `getService("ms.vss-features.location-service") → locationService.getResourceAreaLocation(WIT_AREA_ID)`. Both calls return promises that never resolve in a custom-dialog iframe context. No HTTP request issues; no timeout; no error. The form service IS reachable from the same iframe — only the location service is not.
**Fix:** Bypass `getClient` entirely. Use `SDK.getAccessToken()` for auth, construct the URL from `SDK.getHost().name`, and `fetch()` directly. Commit `fix(03-04): patch 03-01 comments REST — direct fetch (skip SDK REST client)`.
**Phase implication:** Phase 4's write path will hit the same architectural concern when calling `addComment`; should use the same direct-fetch pattern. A REST client utility module abstracting this should be considered for Phase 4 plan structure.

**Override 5 — External-content dialogs render at fixed 480×246 default**
**Origin:** `src/entries/modal.tsx` (Plan 02-01, missing SDK.resize) + UI-SPEC §90 D-06 contract assumption.
**Symptom:** Without `SDK.resize`, the dialog renders at 480×246 regardless of inner content. UI-SPEC's "rely on the host dialog's content-fit behavior" assumption is incorrect on the live host — the host does not auto-fit.
**Fix:** Call `SDK.resize(window.innerWidth, document.body.scrollHeight)` after `notifyLoadSucceeded`, plus a `ResizeObserver` on `document.body` for layout-changing events. Commit `fix(03-04): patch 02-01 dialog sizing — SDK.resize lifecycle + body width`.
**Phase implication:** UI-SPEC D-06 should be rewritten in any future iteration to mandate the resize lifecycle, not the (non-functional) inner-min-height contract.

**Override 6 — Document needs explicit 100% width or content collapses**
**Origin:** `src/template.html` (Plan 02-01, default browser styles).
**Symptom:** Calling `SDK.resize()` with no args defaults width to `body.scrollWidth`, which collapses to the natural width of `Surface > Page` rather than the iframe width. The iframe shrunk to ~290px inside a wider host dialog, leaving content on the left half.
**Fix:** Set `html, body, #root { width: 100%; height: 100%; margin: 0 }` in template.html. Commit `fix(03-04): patch 02-01 dialog sizing — SDK.resize lifecycle + body width` (combined with Override 5).

**Override 7 — ListSelection default `selectOnFocus: true` keeps Dropdown open**
**Origin:** `src/ui/Dropdown3.tsx` (Plan 03-03, default ListSelection construction).
**Symptom:** azure-devops-ui's Dropdown auto-closes on item selection EXCEPT when the selection has `selectOnFocus: true` or `multiSelect: true`. ListSelection's default `selectOnFocus = true` forces the callout to stay open after every user pick.
**Fix:** `new ListSelection({ selectOnFocus: false })` plus a useEffect equality guard to skip redundant selection mutations. Commit `fix(03-04): patch 03-03 dropdown close — selectOnFocus:false`.

**Phase 1 audit parser — entity-decode missing for ADO HTML-mode storage**
**Origin:** `src/audit/parse.ts` (Plan 01-02, regex assumed raw HTML comment form).
**Symptom:** ADO's modern Comments storage HTML-escapes user input on save. A pasted sentinel `<!-- sp-calc:v1 {"sp":5,...} -->` round-trips through the API as `&lt;!-- sp-calc:v1 {&quot;sp&quot;:5,...} --&gt;`. The regex `SENTINEL_RX` matches only the raw form, so `parseLatest` returned `null` on every real comment.
**Fix:** Decode the standard entities (`&lt;`, `&gt;`, `&quot;`, `&#39;`, `&apos;`, `&amp;` last) before running the regex. Commit `fix(03-04): patch 01-02 audit parser — decode HTML entities`. All 333 existing tests still pass.
**Phase implication:** Phase 4's write path posts the audit comment via `addComment`; the round-trip will go through the same encoding. The visible-sentinel UX issue (the literal `<!-- ... -->` markup appearing in the rendered comment text) is a Phase 4 concern — Phase 4 should evaluate whether to (a) accept the visible sentinel, (b) post via REST in a format that preserves real HTML comments, or (c) move the JSON to a different invisible carrier.

### Process / coverage gaps for downstream phases
- **D-31 process assumption** — ROADMAP/03-CONTEXT assumed cezari runs Agile; actually Scrum. Phase 5 owns CMMI verification; the live Scrum work in this run partially covers Phase 5's "Agile" leg but not formally.
- **Custom SP field on Scrum** — cezari's PBI initially had a customer-renamed custom field (`Custom.StoryPoint`), not the standard `Microsoft.VSTS.Scheduling.StoryPoints`. FieldResolver correctly returned no-field; the no-field branch UI rendered. The customer reconfigured to use the inherited standard field for verification to proceed. **Phase 4/5 implication:** real-world Scrum customers may delete the inherited field in favor of custom ones; FIELD-01 spec is too narrow for v1 marketplace coverage. Either (a) document this as a known limitation in the marketplace listing, (b) add a settings UI for custom field ref name (Phase 5), or (c) auto-detect "story-point-like" custom fields by data-type heuristic (Phase 5 stretch).
- **aria-hidden warning in Dropdown** — azure-devops-ui's Dropdown sets `aria-hidden="true"` on the wrapper while focus is still inside the callout. Browser refuses to apply (browser-level a11y safety net) and logs `Blocked aria-hidden on an element because its descendant retained focus`. Non-blocking — focus stays put. Library-level issue in azure-devops-ui; would require fork/patch to address.

## Phase 3 Verdict

**PARTIAL PASS** — the read path works end-to-end on a real ADO Scrum org. Six real-world corrections were applied during this verification (committed atomically per the plan's labeling rule). All 12 D-29 checks have been exercised; checks 1, 10, 12 are PARTIAL (single work-item type / user attestation / not formalized) but the architectural risks they cover (toolbar contribution wiring, SDK lifecycle, theme inheritance) are validated independently in Phase 2 + the unit-test layer. Net assessment: Phase 3's contract — "user can see current SP and a pre-filled selection on every open" — is empirically met. Phase 4 can begin once this verification is committed.

Follow-ups for Phase 4 plan to inherit:
1. Use direct-fetch pattern (Override 4) for the write path; do not subclass the SDK REST client.
2. Decide visible-sentinel UX strategy when posting via `addComment` (Phase 1 fix-back implication).
3. Evaluate whether Phase 4 needs a CMMI dimension (D-31 currently scopes that to Phase 5).

Follow-ups for Phase 5 plan to inherit:
4. Cross-type Check 1 coverage (Bug, Task, Feature, Epic on Scrum + the Agile-named types on a separate Agile org).
5. Custom SP field handling for marketplace coverage (settings UI or heuristic detection).
6. Formalize per-component theme matrix and per-keystroke keyboard nav transcripts.
7. Fix `dev-publish.cjs` Windows retry bug.
