# Feature Landscape

**Domain:** Azure DevOps work item extension — story point / estimation tooling, published to Visual Studio Marketplace
**Researched:** 2026-05-01
**Researcher confidence (overall):** MEDIUM — see "Research Limitations" section below.

---

## Research Limitations (read first)

Live web access (WebSearch, WebFetch, gsd-sdk websearch, Brave, Exa, Firecrawl) was **denied in this session**. Concrete numbers (install counts, star ratings, exact review quotes) and the names of specific publishers below are drawn from prior knowledge of the Visual Studio Marketplace estimation ecosystem (training data through Jan 2026) and are **explicitly flagged** with confidence levels:

| Symbol | Meaning |
|--------|---------|
| `[VERIFY]` | Specific number, name, or quote requiring marketplace re-confirmation before publish |
| `[HIGH]` | Pattern observed across enough independent extensions/reviews that it is reliable as a design input even without re-verification |
| `[MEDIUM]` | Common pattern, single-source dependency or partial recall |
| `[LOW]` | Inferred from adjacent ecosystems (Jira plugins, GitHub estimator apps), not directly from ADO marketplace |

**Recommended follow-up before v1 publish:** spend 30 minutes on `marketplace.visualstudio.com/search?term=story%20points&target=AzureDevOps&sortBy=Installs` to confirm the top-N list and current install counts in the comparison table.

---

## Marketplace Survey — Existing Estimation Extensions

The Azure DevOps Marketplace estimation space splits into **three families**:

1. **Multi-user real-time Planning Poker rooms** (the dominant family by install count)
2. **Single-user / per-item estimators** (smaller, exactly the niche this project targets)
3. **Bulk / backlog grid estimators** (operate on Backlogs view, not the work item form)

### Top extensions (training-data snapshot — `[VERIFY]` all numbers)

| # | Extension | Publisher | Family | Approx. installs `[VERIFY]` | Star rating `[VERIFY]` | Core offering |
|---|-----------|-----------|--------|----------------------------|------------------------|---------------|
| 1 | **Estimate** | Microsoft DevLabs | Multi-user Planning Poker | 100k+ | ~3.5–4 | Real-time poker session against a backlog query, reveals votes simultaneously, writes Story Points back to selected items. The de-facto reference implementation for ADO estimation. |
| 2 | **Scrum Poker for Azure DevOps** | Christian Krauss | Multi-user Planning Poker | 50k+ | ~4 | Same shape as Estimate but actively maintained; supports custom card decks (Fibonacci, T-shirt, powers of 2). |
| 3 | **Planning Poker** | various small publishers (3rd-party) | Multi-user | 10k–30k each | mixed 3–4 | Several near-duplicates with minor UX variations (room codes, observer mode, JIRA-style decks). |
| 4 | **Story Point Estimator** / **Magic Estimation** style | smaller publishers | Single-user / async | <10k each | mixed | Asynchronous estimation: assign cards to items in a list view, no real-time room. Closer in shape to this project but still card-pick UX, not formula. |
| 5 | **Bulk estimate / Backlog estimator** | smaller publishers | Bulk | <5k | mixed | Inline-edit Story Points across the backlog grid; no form integration. |
| 6 | **T-shirt size / custom field plugins** | smaller publishers | Field helper | <5k | mixed | Add a T-shirt size field and a mapping to Story Points; no calculation UI. |

**Key gap observed `[HIGH]`:** No widely-installed extension uses a **dimension-weighted formula** (Complexity × Uncertainty × Effort → Fibonacci). The space is dominated by card-pick UX (single value chosen from a deck). This is a real differentiation lane for the proposed extension.

The **closest adjacent thing** is the Atlassian/Jira ecosystem app **"Storypoints Estimation"** by Appfire / similar, and the generic web tool **Planitpoker / Scrum Poker Online** — both show that *structured-formula* estimation exists as a category but is under-represented as an in-tool ADO extension `[MEDIUM]`.

---

## Table Stakes

Features users expect from any ADO estimation extension. Missing → 1-star reviews and uninstall.

| Feature | Why expected | Complexity | Source / confidence | Notes |
|---------|--------------|------------|---------------------|-------|
| Opens from inside the work item form (not external URL) | Users explicitly chose ADO precisely to avoid context-switching `[HIGH]` | Low | Pattern across all top-installed extensions | Toolbar button or form group both acceptable |
| Writes the result to `Microsoft.VSTS.Scheduling.StoryPoints` | The whole point of the extension is updating the field | Low | All extensions do this | Use REST API via `IWorkItemFormService.setFieldValue` |
| Fibonacci or recognised agile scale (1, 2, 3, 5, 8, 13…) | Teams reject linear or arbitrary scales — Fibonacci is the lingua franca `[HIGH]` | Low | Standard across Estimate, Scrum Poker, etc. | T-shirt sizes acceptable as alt; raw integers not |
| Works on User Story, Bug, Task, Feature, Epic | Teams estimate more than just User Story | Low | Several reviews complain when extension is User-Story-only `[MEDIUM]` | Trivial via contribution `targets` array |
| Loads in <2 seconds inside the form | ADO form already feels heavy; users blame the *extension* for slowness `[HIGH]` | Medium | Repeated theme in negative reviews of bigger extensions | Bundle size budget matters |
| Confirm-before-overwrite when SP already set | Accidentally clobbering an existing estimate is the #1 trust-breaker `[HIGH]` | Low | Already in v1 PROJECT.md | Show "Current: X / New: Y" diff |
| Works in Boards, Backlogs, Sprints, Queries (any place a work item form opens) | Users open work items from many entry points | Low | Default behaviour of work item form contributions | Mostly free; just don't gate on URL |
| Safe failure if SP field is missing on the process template | Some process customisations rename/remove the field | Low | Common pain point across field-touching extensions `[MEDIUM]` | Detect, show friendly error, do not silently fail |
| Permission-aware (read-only users see disabled state) | Bad UX to let viewer click then 403 | Low | ADO has hasPermission API; users notice when missing `[MEDIUM]` | `vso.work_write` scope on extension manifest |
| Doesn't break the Save / Discard state of the work item | Several extensions trigger dirty-state, blocking save | Medium | Common complaint theme `[HIGH]` | Use `setFieldValue(..., true)` to mark as dirty intentionally only |

**If any of the above is missing, the extension will get sub-3-star reviews regardless of how good the calculator is.**

---

## Differentiators

Features that would set this extension apart in the marketplace listing and in reviews.

| Feature | Value proposition | Complexity | Source / confidence |
|---------|-------------------|------------|---------------------|
| **Structured 3-dimension calculator (C/U/E)** instead of card-pick | Reduces "just picked 5 because it felt right" estimation drift; turns gut-feel into a defensible number | Already core to v1 | This is the project's primary differentiator vs. ALL existing extensions `[HIGH]` |
| **Audit comment with structured token** (`SP=5 (C=Hard, U=Medium, E=Easy)`) | Anyone reading the work item later can see *why* — Planning Poker leaves no trail at all | Low | Unique among surveyed extensions `[HIGH]` |
| **Pre-fill from prior audit comment** | Re-estimation is one click instead of starting over | Low | Not seen in marketplace extensions `[HIGH]` |
| **Display intermediate values** (W, raw SP, final Fibonacci, formula) | Builds trust in the number; teaches new estimators the model | Low | Almost no extension shows the math `[HIGH]` |
| Works **without a session/room** (single-user, async) | Most teams in 2025+ are partly remote and async; live poker rooms are dying | Medium | Several reviews on Planning Poker tools complain about timezone friction `[MEDIUM]` |
| **Configurable weights & dimensions** (v2) | Lets teams tune model to their domain; turns a tool into a platform | Medium | No surveyed extension does this — they ship one fixed deck `[HIGH]` |
| **Org Settings + Project Settings hubs** with override pattern (v2) | Mirrors how ADO itself works; familiar to admins | Medium | Already in v1 PROJECT.md decisions |
| Zero backend / install-and-go | Several competing extensions require external SaaS account or login | Low (already chosen) | Reviews of cloud-backed competitors complain about extra logins `[MEDIUM]` |
| **Keyboard-only flow** (Tab through dropdowns, Enter to apply) | Power users estimate dozens of items per planning session | Low | Estimate / Scrum Poker have weak keyboard support `[MEDIUM]` |
| Dark-theme parity (use `azure-devops-ui` tokens, not custom colors) | A handful of extensions look obviously off in dark mode | Low | Pattern in 2-star reviews `[MEDIUM]` |
| **Dry-run / preview mode** (calculate but don't apply) | Lets you compare two estimates before committing | Low | Not seen elsewhere `[MEDIUM]` |
| Localised strings extracted (even if v1 ships en-US only) | Future-proof; some publishers rejected for hardcoding strings | Low | Marketplace listing best practice `[MEDIUM]` |

---

## Anti-Features — Things to Deliberately NOT Build

Reverse-engineered from observed negative-review themes on similar extensions.

| Anti-feature | Why avoid (review theme) | What to do instead |
|--------------|--------------------------|--------------------|
| **External login / OAuth handshake** to use the extension | "Why do I need a separate account just to estimate?" recurring 1-star theme on cloud-backed poker tools `[MEDIUM]` | Stay 100% inside ADO Extension Data Service (already decided) |
| **Auto-write SP on field change** | Silent mutation surprises users; loses trust instantly `[HIGH]` | Always explicit Apply button (already decided) |
| **Email / Teams notifications** when an estimate changes | Users say "I just wanted to estimate, not subscribe to noise" `[MEDIUM]` | No notifications. Audit comment is enough. |
| **Telemetry / analytics phone-home** without disclosure | Triggers security review rejection at enterprises | Either no telemetry, or opt-in with clear UI |
| **Custom Story Points field support in v1** | Adds config surface to a flow that should be 30 seconds | Hardcode standard field; revisit if requested (already decided) |
| **Bulk-estimate-multiple-items modal** | Different UX category; bloats the toolbar button flow | Single-item modal only (already decided) |
| **Live multiplayer poker rooms** | Fully addressed by Estimate / Scrum Poker; building it is a re-implementation, not a differentiator | Stay async / single-user |
| **AI-generated estimate** ("we read the title, here's a 5") | Users distrust this; reviews of recent AI-add-ons complain about wild guesses `[LOW]` — and it would undermine the *justifiability* this extension is selling | Out of scope; calculator IS the AI alternative |
| **In-modal chat / comments thread** | Bloats UI; the work item already has comments | Use the work item's existing comments |
| **Custom UI chrome that breaks ADO theme switching** | Common 2-star complaint: "looks like a different product" | Use `azure-devops-ui` exclusively |
| **Required cloud sync for settings** | Rejected by air-gapped Azure DevOps Server installs | Extension Data Service handles both ADO Services and on-prem |
| **Excel/CSV export of estimation history** | Scope creep; data already lives in work item comments | Out of scope; users can query work items |
| **Per-user personal decks or estimation profiles** | Inflates settings UX; estimation is a team activity | Org + Project scope only (already decided) |
| **Modal that blocks closing the work item form** | Several extensions trap users; common 1-star complaint `[MEDIUM]` | Modal must be dismissable with Esc and X |
| **Prompts / surveys / "rate this extension" pop-ups** in the modal | Universally hated | Never |

---

## UX Pattern Analysis (modal vs panel vs inline form group)

Three contribution shapes are available: `work-item-form-toolbar-button` (button → modal), `work-item-form-page` (full tab on the work item), `work-item-form-group` (inline collapsible section).

| Pattern | Pros | Cons | Best for |
|---------|------|------|----------|
| **Toolbar button → modal** *(chosen for this project)* | Question-answer flow with focused attention; doesn't waste form real estate; obvious entry point; can be triggered keyboard-only; lifecycle is short and stateless | Extra click vs always-visible | One-off actions that produce a single value `[HIGH]` |
| Inline form group (always-visible panel) | Zero friction; encourages estimation | Steals scroll real estate; users see it on items where SP is irrelevant; harder to do confirm-before-overwrite UX | Always-present small widgets (e.g., a single status indicator) |
| Full page tab | Lots of room for complex flows | High click cost; users forget the tab exists; not appropriate for a 30-second action | Multi-step workflows (release management) |

**Why modal converts best for "open, answer, apply" `[HIGH]`:**
- Forces focus on the three questions
- Natural place to display intermediate calculation
- Natural place to display the overwrite warning
- Closes after Apply → user is back to the work item without clutter
- Aligns with how `Estimate` and `Scrum Poker` do their core flow

**Decision lock:** keep toolbar-button + modal as already specified in PROJECT.md.

---

## Where Users Get Confused / Drop Off

Drawn from negative review themes across the surveyed family `[MEDIUM]`:

1. **"Where is the button?"** — toolbar buttons can be hidden behind the `…` overflow on smaller screens.
   *Mitigation:* clear icon + tooltip; document the location in the marketplace listing screenshots.
2. **"I clicked Apply but nothing happened"** — extension fails silently when permissions are missing or field is locked.
   *Mitigation:* explicit error toast; never fail silently.
3. **"It overwrote my estimate"** — most common trust-breaker.
   *Mitigation:* the diff confirm-overwrite already in v1 requirements.
4. **"How do I change it back?"** — users don't know the field has a history.
   *Mitigation:* show "Current: X" in the warning; consider a small "Revert" affordance later.
5. **"What do Complexity / Uncertainty / Effort even mean?"** — domain ambiguity in the dropdown labels.
   *Mitigation:* tooltip per dimension with 1-line definition + 1 example. Probably worth adding to v1.
6. **"Why did it pick 5 and not 8?"** — Fibonacci rounding feels arbitrary.
   *Mitigation:* show the raw SP next to the Fibonacci result; the formula display already in v1 covers this.
7. **"It doesn't work on my work item type"** — when extension only targets some types.
   *Mitigation:* target all standard types from day one (already in v1).
8. **"It loaded a blank modal"** — race conditions between SDK init and form data load.
   *Mitigation:* await `SDK.ready()` and form service init before rendering; show skeleton meanwhile.

---

## Recalculation / History Pattern in Well-Rated Extensions

Across the surveyed extensions `[MEDIUM]`:

- **Best-rated** extensions treat re-estimation as **first-class**: opening the modal again pre-loads the prior selection so the user adjusts rather than re-enters.
  → This project does this via the audit-comment parser. **Strong alignment with what users like.**
- **Worst-rated** extensions treat each estimation as fresh, losing context.
- Almost none keep a dedicated "history" panel — they rely on the work item's native comments/history. *This is the right call*: building a history UI is overkill and duplicates ADO's own revision history.
- **Audit-comment format** is the de-facto pattern when extensions do leave a trail; format varies, no standard exists. The structured-token format chosen here (`SP=5 (C=Hard, U=Medium, E=Easy)`) is more disciplined than what's out there `[HIGH]`.

**Conclusion:** the v1 design (audit comment as both audit log AND pre-fill state) matches the pattern in well-rated extensions and is more rigorous than competitors. No changes recommended.

---

## Dimension-Based / Weighted-Formula Extensions (Direct Competitor Search)

Direct competitors in the *structured-weighted-calculation* space are scarce on the ADO marketplace `[HIGH]`:

- **No top-installed ADO extension** uses a Complexity / Uncertainty / Effort weighted-sum-to-Fibonacci formula. The pattern exists in:
  - **Excel-based team templates** (which is exactly what this project replaces — see `sp_calculator.xlsx`)
  - **Methodology blog posts and books** (e.g., COCOMO-style estimation, "WSJF" in SAFe — both weighted formulas though for different outputs)
  - **A handful of Jira marketplace plugins** (Appfire / Adaptavist ecosystems) — closer in shape but not in the ADO marketplace
- This means **the formula UX itself is the moat.** Choosing how to *present* it well is a meaningful differentiator.

**Formula presentation patterns observed in adjacent tools `[MEDIUM]`:**

| Pattern | Description | Recommendation for this extension |
|---------|-------------|-----------------------------------|
| Show the math equation | `W = 0.4·C + 0.4·U + 0.2·E`; `SP = 0.5 × 26^((W−1)/4)` | YES — already in v1 requirements |
| Show intermediate scalar values live | Update W and Raw SP as user changes dropdowns | YES — high-trust UX |
| Show the rounding step explicitly | "Raw 6.2 → nearest Fibonacci: 5" | YES — addresses confusion #6 above |
| Show the formula source / version | "v1 fixed formula" subtext | Light touch; helps when v2 customisable lands |
| Hide the math behind a toggle | "Show formula" disclosure | NO — trust-by-default; the formula is the value prop |

---

## Feature Dependencies

```
Toolbar button contribution
   └─> Modal (azure-devops-ui Dialog)
          ├─> Three dropdowns (Dropdown component)
          │      └─> Live calculation engine (pure function — unit tested)
          │             └─> Intermediate display (W, Raw SP, Fibonacci SP, formula)
          ├─> Read prior SP from work item form service
          │      └─> Read prior audit comment
          │             └─> Parse structured token → pre-fill dropdowns
          ├─> Confirm-overwrite warning (if SP already set)
          └─> Apply button
                 ├─> setFieldValue(StoryPoints, value)
                 └─> POST work item comment with audit token

v2:
Settings hub (Org / Project)
   └─> Extension Data Service (read/write JSON config)
          └─> Calculation engine reads config → same flow as v1
```

**Critical path for v1 MVP:** Toolbar button → Modal → Calculator → Apply → field write + comment write. Everything else (pre-fill, overwrite warning, intermediate display) is "must-have for table-stakes parity" but downstream of the critical path.

---

## MVP Recommendation (informs roadmap phase ordering)

**Build in this order:**

1. **Calculator engine** (pure TS function, unit-tested) — the formula is the value; nail it first, no SDK required.
2. **Toolbar contribution + minimal modal** with three dropdowns and an Apply button — first end-to-end "open, answer, apply" round trip against a real work item.
3. **Intermediate value display** (W, Raw SP, formula) — the trust-builder.
4. **Audit comment write** — the differentiator.
5. **Pre-fill from prior comment** — closes the loop.
6. **Confirm-before-overwrite** — table stakes; trivially small once the rest is in.
7. **Cross-type targeting + permission-aware disabled state + theme parity** — polish before publish.
8. **Marketplace assets + publish.**

**Defer to v2:** all customisation (weights, dimensions, levels, thresholds, settings hubs). The v1 fixed-formula version is a complete product — v2 is a separate motion.

**Defer indefinitely (all in PROJECT.md "Out of Scope"):** bulk estimation, history UI, approval workflow, custom field support, localisation, AI suggestions.

---

## Sources / Confidence Map

| Claim | Source | Confidence |
|-------|--------|------------|
| Extension family taxonomy (poker rooms / single-user / bulk) | Direct recall of marketplace search results | HIGH |
| Specific install counts and star ratings in survey table | Training-data recall | LOW — `[VERIFY]` before publish |
| Specific publisher / extension names | Training-data recall | MEDIUM — common names are reliable, exact spellings should be re-confirmed |
| Table stakes patterns | Cross-extension pattern recognition | HIGH |
| Differentiators | Comparison of v1 design against observed gaps | HIGH for "no weighted-formula extension exists"; MEDIUM for individual UX patterns |
| Anti-features (review themes) | Recurring themes across negative reviews | MEDIUM — themes are reliable, exact quotes are not |
| UX pattern (modal wins for action flows) | Convention across ADO Microsoft-published extensions | HIGH |
| Drop-off / confusion points | Inferred from negative review themes | MEDIUM |
| Recalc / history pattern | Inferred | MEDIUM |
| Absence of weighted-formula competitors on ADO marketplace | Marketplace search recall | HIGH |

**Recommended verification work before v1 publish:**

1. Re-run a marketplace search for `story points`, `estimation`, `planning poker` sorted by Installs and confirm the top-N table.
2. Read the **2-star and 1-star** reviews on the top 3 extensions and tighten the anti-features list with verbatim quotes.
3. Confirm no weighted-formula competitor has launched between training cutoff and publish date.
4. Test install of the top 2 competitors on a sandbox ADO org to confirm: keyboard support, dark-theme parity, dirty-state handling, and overwrite behaviour — these inform whether the differentiators above remain differentiators.
