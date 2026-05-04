# Pitfalls Research

**Domain:** Azure DevOps work item web extension (public Marketplace distribution)
**Researched:** 2026-05-01
**Confidence:** MEDIUM-HIGH overall (HIGH for documented SDK/manifest behavior; MEDIUM for marketplace edge cases and field-customization variability — these vary across tenants and the team should validate against ≥2 trial installs before GA)

> **Sourcing note:** External web search and Context7 were unavailable in this research session. Findings draw from training-data knowledge of the Azure DevOps Extension SDK, `azure-devops-extension-api`, the Visual Studio Marketplace publisher flow, and the Work Item Tracking REST API (current through early 2026). Anything marked LOW confidence should be re-verified against `learn.microsoft.com/azure/devops/extend` and the `microsoft/azure-devops-extension-sample` GitHub repo before locking the design.

---

## Critical Pitfalls

### Pitfall 1: Hardcoding the Story Points reference name without a fallback

**What goes wrong:**
Code does `workItem.fields["Microsoft.VSTS.Scheduling.StoryPoints"]` and either silently writes `null`, throws on the patch, or appears to succeed but the field doesn't exist on that work item type in the customer's process. The toolbar button works in dev (Agile/Scrum process, Inheritance model, no customization) and breaks the moment a customer:

- Uses the **CMMI** process (which exposes `Microsoft.VSTS.Scheduling.Size` for User Stories, not Story Points — Bugs/Tasks have neither).
- Has **disabled** the Story Points field on User Story via process customization.
- Has **renamed** the friendly name (`Story Points` → `Points`, `SP`, Georgian/Russian translations) — friendly name changes don't break the reference name, but if your code reads the friendly name to find the field, it does.
- Has **added a custom field** (`Custom.StoryPoints`, `Custom.Estimate`) and removed the standard one.
- Has the field present but **read-only** for the user's role/state (e.g., closed work items, or restricted by a rule).

**Why it happens:**
Devs test against one org with one process and assume the reference name `Microsoft.VSTS.Scheduling.StoryPoints` is universal. It isn't — process customization, especially via the Inherited process model, lets admins remove/replace any non-system field. CMMI uses a different field by design. Marketplace is full of "5-star in dev, 1-star reviews from customers whose process differs" extensions.

**How to avoid:**
1. **Probe at runtime, don't assume.** Before showing the toolbar button (or at modal open), call the Work Item Tracking client to fetch the work item type definition for the current type and look for a field whose `referenceName` matches a **prioritized list**:
   - `Microsoft.VSTS.Scheduling.StoryPoints` (Agile/Scrum)
   - `Microsoft.VSTS.Scheduling.Size` (CMMI)
   - (v2) any custom override the org configured in settings
2. **Cache the result per (project, work item type)** — types don't change mid-session.
3. **Degrade gracefully when no field is found:** disable the button with a tooltip ("This work item type doesn't have a Story Points field"), don't hide silently (users will think the extension is broken).
4. **Detect read-only state** by inspecting `IWorkItemFormService.isReadOnly()` and the field's `allowedValues`/`isRequired`/`readOnly` flags before opening the modal — show a banner instead of erroring on save.
5. **Document the field-name assumption clearly in the Marketplace listing** so admins with custom fields know v1 is standard-field-only.

**Warning signs:**
- A QA pass on a CMMI project shows the button does nothing.
- An external user reports "button writes nothing" — almost always a renamed/missing field.
- The first 412 / `RuleValidationException` from the REST API mentioning `field is not defined`.

**Phase to address:** **Phase 1 (core write path)** — must ship in v1. Do not rely on v2 customization to fix this; out-of-the-box v1 must handle CMMI and "field disabled" without a crash.

---

### Pitfall 2: Encoding state in the audit comment without a robust parser

**What goes wrong:**
v1 writes `SP=5 (C=Hard, U=Medium, E=Easy)` as a comment, then the modal parses the **most recent** comment to pre-fill on next open. Real-world edits break this:

- A user **edits** the comment (ADO supports comment editing) and types a sentence in the middle: `SP=5 (C=Hard, U=Medium, E=Easy) — actually this should be 8`. Naive regex still parses 5.
- A user **deletes** the comment but the field still reads 5 → modal shows nothing pre-filled but the value is "real."
- A second user later runs the calculator and writes a **newer** comment with different values. Whose comment wins? You need "last calculator comment by anyone," not "last comment."
- The HTML comment renderer in modern ADO **wraps the text in `<div>` / `<p>`** and may HTML-encode characters — `=` survives, but if the team ever uses `<` or `&` in dimension labels (v2), the round-trip breaks.
- Pasting from rich text (Word, Outlook) into a comment can introduce **non-breaking spaces (` `)** instead of normal spaces inside `(C=Hard, U=Medium, E=Easy)`. Naive `split(", ")` fails.
- ADO mobile / ADO Server / `az boards` CLI render comments slightly differently (whitespace, line endings).
- **Markdown comments** (newer ADO setting) wrap text in `<p>` with HTML entities; a future ADO change to default markdown could re-encode our delimiter characters.
- Comments may be **soft-deleted**; the API can return them with `isDeleted: true` — you must filter.

**Why it happens:**
Treating an unstructured human-readable string as a parser-stable format. Audit comments are user-mutable; using them as primary state storage conflates audit log with state.

**How to avoid:**
1. **Use a sentinel + structured payload** that survives HTML wrapping and casual edits. Pattern: a hidden HTML comment block plus a human-readable summary:
   ```
   <!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy"} -->
   Story Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)
   ```
   The `<!-- ... -->` survives the HTML renderer (it's stripped from rendered view but stays in the underlying text returned by the API), so users see only the friendly line and can edit it freely without breaking pre-fill.
2. **Version the schema** (`sp-calc:v1`, `sp-calc:v2`) so future changes to dimension structure don't silently mis-parse old comments.
3. **Iterate comments newest-first**, take the **first** comment whose payload parses successfully, ignore deleted/edited-out ones.
4. **Reconcile against the field value:** if the parsed SP doesn't match the current Story Points field, surface that in the modal ("Last calculation said 5, but field currently has 8 — start fresh or edit?").
5. **Don't rely on comment search ordering** — fetch via the Work Item Comments API with `order=desc` explicitly; never rely on `workItem.comments` ordering from the form service (it's not guaranteed across SDK versions).
6. **Tolerate whitespace and unicode normalization** — use a forgiving regex (`\s+`, `\p{Zs}`) and `String.normalize('NFKC')`.
7. **Plan for v2 dimension expansion:** the JSON payload approach makes adding `r` (Risk), `d` (Dependencies) trivial; the parens-format does not.

**Warning signs:**
- A user reports "modal opens blank but I calculated yesterday."
- A user edits the comment and the next pre-fill is wrong.
- v2 adds a dimension and v1 comments stop pre-filling at all.

**Phase to address:** **Phase 1** — comment format is a wire format. Choosing the wrong shape now creates a data-migration problem later. Must include a parser unit test suite covering: HTML-wrapped, edited mid-comment, deleted, NBSP, multiple comments, and missing payload.

---

### Pitfall 3: Over-asking permission scopes triggers admin approval

**What goes wrong:**
The manifest declares broad scopes (`vso.work_full`, `vso.project_manage`, `vso.profile`, `vso.identity`) "just in case." For PAT-restricted orgs and orgs with a strict marketplace install policy, this means:

- Install requires an **Org admin** (not Project admin) to approve, slowing adoption to days/weeks.
- Customers see a long permission prompt and bounce off the install page.
- An extension that only writes one field appears to be requesting "manage your projects" — instant trust loss.
- Some scopes (e.g., `vso.identity`, `vso.tokens`) **flag the listing for additional Marketplace review** and add days to publishing.

**Why it happens:**
SDK samples sometimes request more than they need. Devs grab a working sample and don't audit the manifest. Or they preemptively add scopes for v2 features that aren't built yet.

**How to avoid:**
1. **Request only `vso.work_write`.** This includes read + write of work items, queries, attachments, comments. It is the **minimum** for this extension's job. Do not add `vso.work_full` (admin-level).
2. **Do not request `vso.profile` or `vso.identity`** — the SDK's `getUser()` works without it for basic display name/avatar; the broader identity scope is rarely needed and is a red flag for admins.
3. **Do not request `vso.extension_manage`** — settings-hub work in v2 uses Extension Data Service, which is implicit and does not require an extra scope.
4. **Add scopes incrementally with version bumps.** A scope addition triggers an explicit re-consent prompt for every existing install; minimize churn by getting v1 right.
5. **Test the install flow on a fresh trial org** as a non-admin user before publish to verify the consent prompt is short.
6. **Document in the listing** exactly what each requested scope does in plain English ("read and write work item fields and comments") — reduces install-page bounce.

**Scopes to request (recommended):**
- `vso.work_write` — read/write work items, comments
- (no others for v1 — Extension Data Service does not need a scope)

**Warning signs:**
- The Marketplace install dialog shows >3 permission lines.
- A trial user reports "my admin needs to approve this."
- Publish review takes >2 business days.

**Phase to address:** **Phase 0 / Phase 1** — manifest scope is a foundational decision. Adding scopes later forces every existing install to re-consent or auto-disables the extension until they do. Lock down before first publish.

---

### Pitfall 4: Field write race conditions and lost updates (the `rev` trap)

**What goes wrong:**
The user opens the work item form, the form's in-memory model has Story Points = 3. Meanwhile, a teammate updates the same item to 8 in another tab. Our extension PATCHes the work item with `Microsoft.VSTS.Scheduling.StoryPoints = 5`. Several failure modes:

- If we use the **REST API directly with the work item's stale `rev`** and pass `If-Match`/`rev` test ops, we get **HTTP 412** and the patch fails — but our user sees a success toast because we didn't await/inspect the response.
- If we use the REST API **without `rev`**, we silently overwrite the teammate's 8 with our 5 (lost update).
- If we use the **`IWorkItemFormService.setFieldValue()`** path (form is open and dirty), our value goes into the form's pending changes — but the user must still hit Save, and if they discard, our write is lost. Even worse: if there are other dirty changes on the form, the user may not notice we added one.
- A **work item rule** (process customization) may reject the value (e.g., "Story Points must be empty when State=New") — REST returns `RuleValidationException`, the form path silently drops it.
- A required field that is empty on the form (e.g., Iteration Path, Area Path) **blocks any save** — our PATCH succeeds via REST, but if the user then tries to save the form, they get an unrelated validation error and may roll back our value by mistake.

**Why it happens:**
Two write paths exist (form service vs. REST), each with different semantics, and the SDK docs don't loudly call out the trade-off. Devs pick one and ignore concurrency.

**How to avoid:**
1. **Decide on one write path and document the rationale.** Recommended for this extension:
   - **If the form is open and the user has unsaved changes:** use `IWorkItemFormService.setFieldValue()` and notify the user "Story Points set to 5 — remember to save the work item." This avoids the REST-vs-form-state divergence.
   - **If the form is clean (no unsaved changes):** REST PATCH with `setFieldValue` followed by an explicit `save()` via the form service so the user sees the change reflected immediately.
   - **Always** call `getFieldValue()` after `setFieldValue()` to verify the write took effect (rules may have rejected it).
2. **For the audit comment:** comments are append-only and don't participate in form state — POST via the Comments REST endpoint **after** the field write succeeds, never before.
3. **Catch and surface `RuleValidationException`** with a friendly message: "Your team's process prevents setting Story Points right now (state=New). Save changes after moving to a different state."
4. **Don't optimistically toast "Saved" on REST 200** — REST 200 means accepted, not that downstream rules passed. Read the response body and check `fields[StoryPoints]` matches what you sent.
5. **Refresh form state** after a REST write: `await formService.refresh()` (or equivalent SDK method) so the form UI shows the new value without a full page reload.
6. **Atomicity:** field write + comment are two HTTP calls and **cannot** be made atomic in ADO. Order them so the field write is first; if the comment fails, the SP value is still correct (preferred failure mode). Log the comment failure and offer "retry comment" — do not rewrite the field.

**Warning signs:**
- QA reports "I clicked Apply, the modal closed, but the field is unchanged."
- Sentry/console shows 412 errors with no user-visible message.
- A customer reports a teammate's update was overwritten.

**Phase to address:** **Phase 1** — write path design is core. Build the "form-open vs form-clean" decision into the apply handler from day one; retrofitting concurrency safety is painful.

---

### Pitfall 5: Extension Data Service scoping confusion (User vs Project vs Default)

**What goes wrong (v2 specifically):**
Settings hub at Org Settings should write to Default scope (org-wide); Project Settings should write to Project scope. Common bugs:

- Dev writes to `User` scope by accident — settings save fine for the dev, but every other user sees defaults. "Works on my machine."
- Dev writes to `Default` from the Project settings hub — Project settings appear to "leak" across projects.
- Two Project admins in different projects edit settings simultaneously — last write wins silently; the EDS API has **no optimistic concurrency** by default. Use the document `__etag` field if you need it.
- Settings document is **per-extension**, not per-version. Bumping extension version doesn't reset stored settings — schema migrations must be explicit.
- Reading a missing document throws or returns `null` depending on the API call (`getDocument` throws 404, `getDocuments` returns empty array). Devs don't handle both.
- **Project scope** uses the project ID (GUID), not the project name. If the project is renamed, settings still point at the GUID (correct), but if dev code ever stored the name, the rename breaks settings.
- Settings documents are **eventually consistent** — a write followed immediately by a read in another tab may return stale data for a few seconds.

**Why it happens:**
EDS is poorly named ("Default" scope = collection-wide) and the docs blur the distinction between scope and collection. SDK examples often hardcode "User" scope because it's simpler in samples.

**How to avoid:**
1. **Explicit scope constants** in code: `SettingsScope.Org` ("Default" + collection), `SettingsScope.Project` ("Default" + project ID), never inline strings.
2. **Read order: Project → Org → built-in defaults.** Always merge in that order so project overrides work as documented.
3. **Use `setDocument` with `__etag`** for optimistic concurrency in the Settings UI; on conflict, refetch and prompt the user "another admin updated settings — reload?"
4. **Schema versioning:** include a `schemaVersion: 1` field in every settings document; on read, run a migration if version mismatched.
5. **Handle 404 explicitly** — wrap `getDocument` in a helper that returns `null` on 404 and rethrows other errors.
6. **Separate documents per logical concern** (e.g., `weights`, `dimensions`, `labels`) so concurrent edits to different concerns don't collide on `__etag`.
7. **Settings UI should always re-fetch on mount** — never trust in-memory cache across hub navigations.
8. **For tests:** EDS cannot be unit-tested without a fake. Build a `ISettingsRepository` interface, use real EDS in production, in-memory in tests.

**Warning signs:**
- "My settings disappeared" reports — usually User scope when Org was intended.
- Project A's settings show up in Project B — Default scope on a Project hub.
- Two admins editing concurrently lose each other's changes.

**Phase to address:** **v2 Phase (Settings)** — pure v2 concern. Do not pre-build EDS plumbing in v1; it adds complexity for no v1 value. But document the scope contract before coding the v2 hub.

---

### Pitfall 6: Toolbar button doesn't appear / appears twice / loses state

**What goes wrong:**
Classic work item form contribution lifecycle bugs:

- **Button missing** on the form: usually because the manifest's `targets` array doesn't include all relevant work item type categories. New ADO orgs sometimes get a contribution targeting `ms.vss-work-web.work-item-form-toolbar-button` but the form is rendered by the new "Combined Work Items Hub" which uses a slightly different contribution target in some preview rings.
- **Button appears twice** after an extension upgrade: the host caches old contribution definitions; users must refresh hard (Ctrl+F5) once. If your manifest changed contribution `id`s between versions, both old and new register until cache clears.
- **Button does nothing on first click**, then works on subsequent: the iframe's bundle is lazy-loaded on first interaction; if your code does heavy work (loading react, fetching work item data) on click rather than on `SDK.init()`, first click feels broken.
- **State leaks between work items:** the work item form is **reused** across navigations — it's not a fresh iframe per item. `SDK.init({ loaded: true })` fires once; subsequent navigations call the registered `IWorkItemNotificationListener.onLoaded` / `onRefreshed` / `onUnloaded`. Devs who init React state in `SDK.init` and never reset it show stale data for the previous item.
- **`onLoaded` fires twice** in some scenarios (preview / refresh) — make it idempotent.
- **`onRefreshed`** fires after a save; if you re-open your modal automatically based on field state, you can loop.
- **Hub-hosted vs form-hosted contributions** have different SDK init flags — `SDK.init({ loaded: false })` then `SDK.notifyLoadSucceeded()` after data load is the canonical pattern. Skipping `notifyLoadSucceeded()` leaves a permanent loading spinner.
- **Disposed handlers:** registering listeners without unregistering on `onUnloaded` leaks memory and causes "ghost" handlers to fire on later items.

**Why it happens:**
The iframe lifecycle is not a normal SPA lifecycle. The form persists; only the data behind it changes. Most React patterns assume mount-per-item, which is wrong here.

**How to avoid:**
1. **Treat the iframe as long-lived.** Mount React once on `SDK.init()`. Use a tiny state container (Zustand or React context) keyed on work item ID; reset it in `onLoaded(workItemId)`.
2. **Register a single `IWorkItemNotificationListener`** with the form service via `register()` and **unregister** in cleanup.
3. **Always call `SDK.notifyLoadSucceeded()`** even if you have no async init.
4. **Make `onLoaded` idempotent** — guard against double-fire.
5. **Manifest `targets`:** include both `ms.vss-work-web.work-item-form-toolbar-button` (legacy + current) — at time of writing this is the right target for the modern form too.
6. **Don't change contribution `id`s between versions** — append, deprecate, but don't rename.
7. **Verify on hard refresh, soft refresh, and form-navigation (Next/Previous arrows)** during QA — those are the three lifecycle paths that catch stale-state bugs.
8. **Lazy-init heavy work** behind the button click is OK if you show a spinner immediately; but pre-fetch the work item field data on `onLoaded` so the modal opens fast.

**Warning signs:**
- Button missing on Bug type but visible on User Story (target mismatch).
- Modal opens with previous item's data briefly visible (state leak).
- Console warnings about duplicate listener registration.
- Permanent loading spinner on the form (missing `notifyLoadSucceeded`).

**Phase to address:** **Phase 1** — get the lifecycle right at the foundation. A bug here surfaces only after navigation patterns QA covers, which is late.

---

### Pitfall 7: Performance — bloated bundle slows the work item form

**What goes wrong:**
A "Calculate Story Points" extension ships a 2 MB `main.js` because it bundles all of `azure-devops-ui`, `react`, `react-dom`, and a CSS framework. Symptoms:

- Work item form takes an extra 800 ms to become interactive on a cold load — users blame ADO.
- Mobile / low-bandwidth users see the form but the toolbar button takes 5+ seconds to appear.
- Marketplace listing reviews mention "slows down work items."
- Some orgs **block large extension bundles** via egress policy.

**Why it happens:**
Default Webpack/Vite configs include all of `azure-devops-ui` even when the extension uses three components. React + ReactDOM are 130 KB+ minified. CSS-in-JS or Tailwind ship full stylesheets. Source maps shipped to production. No code-splitting between the toolbar shim and the modal.

**How to avoid:**
1. **Two-bundle architecture:**
   - **Toolbar bundle (tiny, < 50 KB gzipped):** registers the button, listens for click, dynamically imports the modal bundle on first click.
   - **Modal bundle (heavier):** loaded on demand, contains React UI, calculator logic, REST clients.
2. **Tree-shake `azure-devops-ui`** — import individual components, not the barrel: `import { Button } from "azure-devops-ui/Button"` not `from "azure-devops-ui"`.
3. **Externalize React** if possible — the host ADO page already loads React; check if you can declare it as a peer/external. (Verify against current SDK guidance — historically not safe; **MEDIUM confidence**, validate.)
4. **No source maps in production `.vsix`** (or "hidden" maps via `SourceMap` URL stripping).
5. **Drop Moment/Lodash full builds** — use date-fns / native or per-function imports.
6. **Bundle budget:** set a CI gate at 250 KB gzipped per bundle; fail builds that exceed.
7. **Measure actual load time** on a real org with browser DevTools → Performance → "Time to interactive on form" before and after each release.
8. **Lazy-load the calculator math** only if it grows; the v1 formula is tiny so this is cheap.
9. **Avoid CSS frameworks** — `azure-devops-ui` styling is sufficient and matches host chrome. Adding Tailwind/Bootstrap is bytes for nothing.

**Warning signs:**
- `.vsix` file > 1 MB.
- Lighthouse / Performance tab shows long task on form load attributable to your iframe.
- Marketplace reviews mention slowness.

**Phase to address:** **Phase 1 (initial bundling setup) and continuously enforced.** A performance budget in CI from day one prevents drift.

---

### Pitfall 8: Marketplace publish gotchas (manifest, version, certificates, sharing)

**What goes wrong:**
First publish attempts often fail review or break customer installs:

- **Version not bumped** between publishes — `tfx extension publish` fails with "version already exists." Public extensions cannot republish a version.
- **Public flag set to `true`** during dev → extension visible to the world before it's tested. Stage with `public: false` and share with a trial org.
- **Icon missing or wrong size** — Marketplace requires a 128×128 PNG; some preview rings also want 256×256. Bad transparency or off-color icons get rejected.
- **Manifest `categories`** missing or invalid — listing won't surface in search.
- **`galleryFlags`** controls Public/Preview/Paid. Setting Paid without billing setup fails review.
- **Publisher ID mismatch** — the `publisher` in `vss-extension.json` must exactly match a Marketplace publisher you control. Casing matters.
- **Certificate / signing:** ADO extensions don't require signing, but the publisher account requires email verification + (for Microsoft Partners only) MPN ID. Verification can take 1–3 business days.
- **`scopes` change between versions** triggers re-consent for every install. If consent is not granted, the extension is **disabled**, not uninstalled — users see "broken" extension until they reauthorize.
- **Targeting rules** in manifest (`targets: [{ id: "Microsoft.VisualStudio.Services.Cloud" }]`) — if you forget to include `Microsoft.VisualStudio.Services` (on-prem ADO Server / Server 2019+) you exclude that audience; if you don't want them, fine, but be explicit.
- **Marketplace listing assets** (screenshots, README, marketing copy) are part of the extension package, not separate uploads — the README in `overview.md` becomes the listing description. Bad content = bad listing.
- **GitHub repo link** in manifest must be a real public repo; broken links fail review.

**Why it happens:**
The publish workflow is documented but spread across multiple pages; few teams publish their first extension perfectly.

**How to avoid:**
1. **Two manifests: dev and prod** (or one manifest + `tfx --override` flags). Dev = `publisher: "yourcompany-dev"`, `public: false`, `id: "story-point-calc-dev"`. Prod = real publisher, `public: true`, real id.
2. **Auto-bump version in CI** — never bump manually. Use `tfx extension create --rev-version` or compute from git tag.
3. **Stage to a trial Azure DevOps org** (free tier, fresh) and install the dev build for end-to-end test before promoting.
4. **Lock manifest scopes early** (see Pitfall 3) so version bumps don't trigger re-consent.
5. **Pre-flight checklist before first publish:**
   - Publisher account verified
   - 128×128 logo present, on-brand
   - At least 3 screenshots
   - `overview.md` is the user-facing description (not raw README dev notes)
   - `categories` includes "Azure Boards"
   - License file present
   - Public GitHub repo linked
   - `public: false` for first publish; share to trial org; smoke test; then `public: true`
6. **Use `tfx extension share`** to share a private extension with a specific org for testing — never publish public until smoke-tested on at least 2 orgs.
7. **Plan for 1–3 business days** for first publisher verification; don't make publish day a hard deadline.

**Warning signs:**
- Publish CLI errors mentioning "version exists" or "publisher not found."
- Marketplace listing missing screenshots / icon.
- Trial install prompts for unexpected permissions.

**Phase to address:** **Final publish phase (v1 completion).** Pre-flight checklist must be a hard gate before "publish public."

---

### Pitfall 9: Iframe sandbox / cross-origin / storage edge cases

**What goes wrong:**
Extensions run in an iframe served from a Microsoft-controlled CDN domain (e.g., `*.gallerycdn.vsassets.io`), not from the ADO domain. Consequences:

- **`localStorage` / `sessionStorage`** are scoped to the CDN domain — all of your stored data is shared across **every extension you publish** that uses storage there. Multi-tenancy leak risk; a different extension by the same publisher could read your data.
- **Third-party cookies blocked by Safari (ITP) and Firefox** — anything that depends on cookies sent to a different origin will fail. The SDK's auth doesn't use cookies (uses postMessage to host) so it works, but if you call any external API expecting cookie auth, it fails on Safari/Firefox.
- **Focus trap inside modals:** `azure-devops-ui` Dialog handles this, but a custom modal can lose focus to the parent frame, making keyboard navigation broken.
- **`window.parent`/`window.top` access blocked** by sandbox attributes — never assume you can reach the host page DOM. All host communication goes through the SDK postMessage channel.
- **`document.cookie` is sandboxed-empty** in some configurations — don't rely on it.
- **Popup windows / new tabs** spawned from inside the iframe may not work on all browsers (Safari blocks unless user-initiated and sometimes even then).
- **`fetch` to the ADO REST API works** because the SDK provides an authenticated client; raw `fetch` to `dev.azure.com/{org}/_apis/...` from the iframe will fail CORS unless you use the SDK's request facility.
- **iOS Safari iframe height bugs** — some old SDK versions had auto-resize issues on iOS; newer SDKs use `SDK.resize()`.
- **Browser back button** does not navigate within iframes the way devs expect; the host controls navigation.

**Why it happens:**
The cross-origin iframe model is a security feature, and devs from regular SPA backgrounds assume a flat document.

**How to avoid:**
1. **Never use `localStorage` for cross-tenant or sensitive data.** Use Extension Data Service for anything user/project specific. Use `localStorage` only for ephemeral UI state (e.g., "modal was open last").
2. **Always make HTTP calls via the SDK-provided REST clients** (`getClient(WorkItemTrackingRestClient)`) — they handle auth, CORS, and correlation headers automatically.
3. **Use `azure-devops-ui` Dialog** for modals (correct focus trap, ARIA, host-aware sizing). If you must roll your own, implement focus trap with a library like `focus-trap`.
4. **Test on Safari and Firefox** before publish, not just Chromium.
5. **Don't call `window.parent.*`.** Use SDK methods.
6. **Call `SDK.resize()`** if your modal grows after open (rarely needed if using Dialog).
7. **No popups** — open links via `host.openNewWindow()` SDK method or anchor `target="_blank"`.
8. **No service workers** in extensions — sandboxed iframes can't register them.

**Warning signs:**
- Extension works in Chrome dev but breaks in Safari for one customer.
- Console errors about blocked cookies.
- Modal opens but tab key escapes to parent frame.
- "CORS preflight" errors when calling REST.

**Phase to address:** **Phase 1 (modal & SDK integration).** Browser matrix QA must include Safari (macOS) and Firefox.

---

### Pitfall 10: Permission errors — read-only users and graceful degradation

**What goes wrong:**
A Stakeholder-licensed user (read-only on most fields) opens a work item; the toolbar button is visible. They run the calculator, hit Apply, and the REST call returns 403. The modal shows a generic error or, worse, silently closes after writing a comment they cannot delete.

Specific scenarios:

- **Stakeholder access level:** can view and add comments but cannot edit fields on most work items.
- **Read-only field by rule:** field is editable for Project Admin role but not for Contributor on certain states.
- **Closed work items:** many processes lock fields once State=Closed.
- **Area-Path-based permissions:** user can read the work item but doesn't have "Edit work items in this node" on the area path.
- **The comment posts but the field write fails** → unrecoverable inconsistent state (comment claims SP=5, field still null).

**Why it happens:**
Permission checks at the UI layer aren't free — devs skip them and rely on the REST 403. By then, side effects (comment) may have happened.

**How to avoid:**
1. **Pre-flight permission check** when the modal opens:
   - `formService.isReadOnly()` — entire form locked? Show banner, disable Apply.
   - Field-level check via the work item type's field rules + current state.
   - For Stakeholders, the SDK exposes user license via `getUser()` — show a dedicated message.
2. **Order of operations always:** field write first, comment second. If field write fails, abort comment.
3. **Friendly error messages** mapped from common HTTP statuses:
   - 401 → "Your session expired — please reload the page."
   - 403 → "You don't have permission to edit Story Points on this work item."
   - 404 → "This work item or field no longer exists."
   - 412 → "Someone else updated this work item — reload and try again."
   - `RuleValidationException` → show the rule message verbatim with prefix "Your team's process: ..."
4. **Show the toolbar button in disabled state** with a tooltip explaining why, rather than hiding it (avoids "where did the button go" confusion when admin restores permissions).
5. **Never write the comment-as-state without confirming the field write succeeded** — otherwise you've created an audit comment that lies.

**Warning signs:**
- Bug reports of "I clicked Apply, got an error, but a comment was added anyway."
- Stakeholders complain the button does nothing.
- Closed work items show the button but it doesn't work.

**Phase to address:** **Phase 1 (apply flow + UX feedback).** Pre-flight check before write is the cheap fix; mandatory.

---

## Moderate Pitfalls

### Pitfall 11: Localization / Marketplace manifest fields for English-only extensions

**What goes wrong:**
Project decision is English-only UI. But the Marketplace manifest still has localizable fields (`name`, `description`, `categories`). If you ship without `defaultLocale` set explicitly, some browsers in non-English locales render the listing's display name as the manifest key rather than the friendly name.

**How to avoid:**
1. Set `"defaultLocale": "en-US"` in `vss-extension.json`.
2. Provide all listing strings in English; do not create a `translations/` folder until you ship a non-English locale.
3. **Do not** use SDK i18n keys in code (`SDK.getString('label')`) — just use string literals so future translation is a clean lift, not a rewrite.
4. **Marketplace categories and tags** must be valid English ones — check the list in the Marketplace publisher portal.

**Confidence:** MEDIUM — `defaultLocale` requirement is documented; behavior on missing field varies by locale and may be safe in practice. Validate before publish.

**Phase to address:** **Phase 1 (manifest authoring) and publish phase.**

---

### Pitfall 12: Field write atomicity (no transactions across work item + comment)

**What goes wrong:**
Field write succeeds, comment POST fails (network blip, throttle, transient 500). Now the work item has SP=5 with no audit trail. Or vice versa: comment posts, field write fails (rule violation). Now there's a comment lying about SP.

**How to avoid:**
1. **Order matters:** field write first, comment second. Failure mode is "no audit comment for this calc" — recoverable, the user can re-run.
2. **On comment failure, do not retry automatically** in the apply path; show "Story Points saved, but audit comment failed to post — retry?" so the user decides.
3. **Make comment failures non-blocking** — the SP value is the primary outcome; the comment is gravy.
4. **Idempotency:** re-running the calculator with the same inputs should produce the same comment payload — never timestamp-based unique IDs that would cause duplicate-detection issues.
5. **Surface a recovery affordance:** if the modal detects an SP value that doesn't match any sp-calc comment on the item, show "No calculation history found — start fresh."

**Phase to address:** **Phase 1 (apply flow).**

---

### Pitfall 13: Rate limits and throttling on the WIT REST API

**What goes wrong:**
ADO enforces per-user TSTU (Throughput Service Threshold Units) limits. A single calculator use is well under any limit, but careless coding can hit throttling:

- Re-fetching the work item every keystroke in the modal.
- Polling for updates instead of using the form refresh callback.
- Looping field reads instead of caching the type definition.
- (v2) bulk operations across many work items (out of scope for v1).

The HTTP response includes `X-RateLimit-*` and `Retry-After` headers; if you ignore them, you'll see 429s.

**How to avoid:**
1. **Cache work item type definitions** for the session.
2. **Fetch work item data once on modal open**, not on each render.
3. **Honor `Retry-After`** if the SDK client surfaces it (some don't — wrap calls in a thin retry helper).
4. **No polling.**

**Phase to address:** **Phase 1.** Easy to get right at the start.

---

### Pitfall 14: SDK version drift and API breaking changes

**What goes wrong:**
`azure-devops-extension-sdk` and `azure-devops-extension-api` ship breaking changes occasionally (e.g., the `VSS.*` global → ES module migration was a breaking shift). An extension built against an old SDK may continue to work but lose access to newer host features; an extension built against a too-new SDK may not load on ADO Server (on-prem) installs that lag behind the cloud.

**How to avoid:**
1. **Pin SDK and API versions** in `package.json` (no `^` for the SDK). Bump deliberately, test, then publish.
2. **Target only ADO Services (cloud)** in `targets` if you don't want to support on-prem; document this.
3. **Read SDK release notes** before bumping.

**Phase to address:** **Phase 0 (project init) — choose SDK version and pin.**

---

### Pitfall 15: `isDirty` and unsaved changes confusion

**What goes wrong:**
Our extension writes a value via `setFieldValue`; the form is now dirty. The user navigates away or closes the tab without hitting Save. Our value is lost. Or: the form was already dirty (user typed in description), our write adds another dirty field, the user discards their description change and discards our SP write too.

**How to avoid:**
1. **Check `isDirty()` on modal open.** If the form is already dirty, warn: "The form has unsaved changes — applying Story Points will combine with your other edits."
2. **Document the contract** in the modal: "Click Apply to set Story Points. The work item form will need to be saved separately."
3. **If the extension's UX promises atomic save** (i.e., "Apply = saved"), then call `formService.save()` after `setFieldValue()` — but be prepared for save to fail on unrelated required fields and present a coherent error.
4. **Decide v1 default and document.** Recommended: setFieldValue + auto-save when possible, with fallback to "saved to form, please save the work item" if save fails for unrelated reasons.

**Phase to address:** **Phase 1 (apply UX decision).**

---

### Pitfall 16: Pre-fill ambiguity when field value diverges from comment

**What goes wrong:**
Yesterday: user calculated SP=5 (audit comment: `SP=5 (C=Hard, U=Medium, E=Easy)`). Today: someone manually typed 8 in the SP field without using the calculator. Tomorrow: a third user opens the modal — should the dropdowns pre-fill from the (stale) comment, or from the current field value (no comment exists)?

**How to avoid:**
Define a clear precedence in the spec:
1. If a parseable sp-calc comment exists AND its computed SP matches the current field value → pre-fill from comment.
2. If a parseable comment exists but field value differs → show banner "Field value (8) differs from last calculation (5). Pre-fill from last calc?" with [Yes] [Start Fresh].
3. If no comment exists → all dropdowns blank, modal shows "Current field value: 8" for context.

This is a UX decision but it's also a correctness decision that affects parser design.

**Phase to address:** **Phase 1 (pre-fill UX spec).**

---

### Pitfall 17: Bug/Task/Feature/Epic field availability differs

**What goes wrong:**
The manifest declares the toolbar button on multiple work item types. But fields differ:
- **Bug** in Scrum process: has `Microsoft.VSTS.Scheduling.Effort` (not StoryPoints).
- **Task** in any process: typically has `Microsoft.VSTS.Scheduling.RemainingWork`/`OriginalEstimate`, not Story Points.
- **Epic / Feature**: may or may not have Story Points depending on process.

Devs assume "all parent work items have Story Points" — wrong.

**How to avoid:**
1. **Per-type field probe** (see Pitfall 1) — if the configured estimation field doesn't exist, disable the button with a tooltip.
2. **Decide the supported types matrix explicitly** in the manifest:
   - Agile: User Story (StoryPoints), Bug (StoryPoints), Feature/Epic (??)
   - Scrum: Product Backlog Item (Effort), Bug (Effort), Feature/Epic (??)
   - CMMI: Requirement (Size), Bug (Size?), ...
3. Document supported types in the listing.

**Phase to address:** **Phase 1.**

---

## Minor Pitfalls

### Pitfall 18: Browser zoom and high-DPI rendering

`azure-devops-ui` handles this; rolling your own CSS likely doesn't. Stick to the component library.

### Pitfall 19: Time zone in audit comment timestamps

Comments are timestamped server-side in UTC; ADO renders in user's TZ. Don't include your own timestamp in the comment payload — let ADO handle it.

### Pitfall 20: SDK `init()` race

Calling REST clients before `await SDK.ready()` returns undefined data. Always await ready before any API call.

### Pitfall 21: Wrong contribution `id` between manifest and code

The contribution `id` in `vss-extension.json` must match the `SDK.register(id, ...)` call exactly (case-sensitive, full-qualified). Typo → button never wires up.

### Pitfall 22: `azure-devops-ui` theme mismatch

Components ship light theme by default; ADO supports dark theme. Use the theme provider from the SDK so colors flip correctly. Otherwise extension looks blindingly bright in dark mode.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `Microsoft.VSTS.Scheduling.StoryPoints` everywhere | 1 hour saved | Cannot support CMMI; cannot support custom fields; refactor cost when v2 wants overrides | Never — abstract behind a `FieldResolver` from day one |
| Parse comment with naive regex | 2 hours saved | Edits/HTML wrapping/NBSP break parser, silent data loss | Never — use the sentinel pattern from day one |
| Skip browser matrix testing (Chrome only) | A day of QA saved | Safari/Firefox bugs land as 1-star reviews | Never for public marketplace |
| Skip Stakeholder-license testing | Half a day | "It does nothing for me" reports from large customers | Never — Stakeholders are common |
| Inline scopes in manifest without audit | None | Re-consent prompts on every version bump | Never — lock scopes before first publish |
| Use `localStorage` for settings | A few hours saved vs EDS | Cross-extension data leak; lost data on different browsers | Only for ephemeral UI state ("last open tab") |
| One giant bundle | 1 day saved on build config | Slow form load, marketplace reviews about perf | Acceptable for internal-only proof of concept; never for v1 GA |
| Skip schema versioning in EDS settings | None | Schema migration becomes a coordinated rollout problem | Never — `schemaVersion` is one field |
| Skip pre-flight permission check | A few hours | Stakeholders see broken button; comments-without-fields | Never — this is a 30-minute fix |
| Hide button when no SP field | Cleaner-looking listing | Users think extension is broken; support load | Never — disable + tooltip is correct |
| Comment-as-state without a parser test suite | Half a day | Silent pre-fill failures, hard-to-repro bugs | Never — parser tests are mandatory |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Work Item REST API | Raw `fetch` to `dev.azure.com` (CORS fails) | Use `getClient(WorkItemTrackingRestClient)` from the SDK — auth, CORS, correlation headers handled |
| Form Service | Using REST PATCH while form is open and dirty (state diverges) | If form is dirty, use `setFieldValue` and inform user to save; if clean, REST + `formService.refresh()` |
| Comments | Rendering markdown in code by parsing comment HTML | Comments may be HTML or markdown depending on org setting; round-trip via API is what you store, not what's rendered. Test both modes |
| Extension Data Service | Hardcoding "User" scope in samples | Explicit `Default` (org) or project ID for project scope; never User unless feature is per-user |
| Marketplace Publisher | Wrong publisher casing in manifest | Match publisher ID exactly (case-sensitive); verify in Publisher Management UI before publish |
| ADO REST client | Ignoring `RuleValidationException` body | Surface rule message verbatim — these are admin-authored process rules; users need to see them |
| SDK `init` | Calling clients before `SDK.ready()` resolves | `await SDK.ready()` before first API call; chain in a single bootstrap function |
| iframe storage | `localStorage` for sensitive data | EDS for settings; `localStorage` for non-sensitive ephemeral UI state only |
| Theme | Hardcoded colors in CSS | Use CSS variables from `azure-devops-ui` theme; respect host dark/light setting |
| Work item type | Assume User Story always has StoryPoints | Probe type at runtime; disable button if not present |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Single 2 MB bundle | Form load slowdown | Two-bundle architecture (toolbar shim + lazy modal); tree-shake `azure-devops-ui` | Immediately on slow networks; always on mobile |
| Re-fetching work item on every render | Network tab shows N requests for one modal open | Fetch once on modal open; pass into React state | Becomes obvious only with React profiler |
| No retry/backoff on 429 | Random failures during heavy ADO usage | Wrap REST calls in retry-on-429 with `Retry-After` honored | Large orgs with parallel users hit it |
| Source maps in production .vsix | Bundle size inflated 3-5× | Strip in build config; deploy hidden source maps if needed for Sentry | Always |
| React 18 strict mode double-init | onLoaded fires twice in dev, real bugs in prod | Make all SDK init idempotent; guard with refs | Manifests in dev, masked in prod build |
| Loading every `azure-devops-ui` component | Bundle bloat | Per-module imports: `import { Button } from "azure-devops-ui/Button"` | Always |
| Heavy work in click handler vs init | First-click feels broken | Pre-fetch on `onLoaded`; show spinner immediately on click | First impression — bad reviews |
| Polling for form changes | TSTU throttling, console spam | Use `IWorkItemNotificationListener` callbacks (push, not pull) | Large orgs |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging work item field values to console in production | PII / business-sensitive data in browser logs / Sentry | Strip console logs in production build; if telemetry is needed, scrub field values |
| Storing user-identifying info in `localStorage` | Cross-extension leak (same CDN origin) | EDS user-scope or no storage |
| Trusting input from settings UI without validation (v2) | Malformed weights crash calculator for everyone in org | Validate on save (sum to 1.0, dimensions are non-empty, labels are strings) |
| Including secrets in extension bundle (none expected for this extension, but a future API key would qualify) | Public download = public secret | Never bundle secrets; use ADO service connections or per-user PAT entry |
| Trusting comment payload during pre-fill parse without bounds-checking | Malicious comment with huge payload could crash modal | Cap payload size, validate types, use a JSON schema check |
| Injecting unescaped strings into the comment HTML (label fields in v2) | XSS in audit comment when admin uses `<script>` as a label | Encode all user-supplied strings; ADO's renderer also sanitizes, but don't rely on it alone |
| `eval` or `new Function` of comment payload | Code injection | Use `JSON.parse`, never `eval` |
| Open redirect via SDK `host.openNewWindow` with user-controlled URL | Phishing surface | Whitelist allowed URL prefixes if you ever add this |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Hidden toolbar button when field is missing | "Where did the button go? It worked yesterday." | Disable + tooltip explaining why |
| Generic error toast on any failure | User can't act on the error | Map status codes to actionable messages (Pitfall 10 list) |
| Modal closes on outside click during an in-flight write | User clicks outside, form state is unclear | Block outside-click during write; use Dialog component which handles this |
| No keyboard support for dropdowns | Power users frustrated | Use `azure-devops-ui` Dropdown which is keyboard-accessible by default |
| Apply button enabled when no choices made | User clicks, gets validation error | Disable Apply until all 3 dropdowns have selections |
| No "Cancel" button or unclear escape | Trapped users | Cancel button + ESC key + outside click (if not writing) |
| Pre-fill that contradicts current field value silently | User trust erosion | Banner showing both values, explicit "Use last calculation" choice |
| No loading state on REST calls | Users think nothing happened, click again | Spinner on Apply; disable Apply while in-flight |
| Modal that doesn't fit on small screens | Mobile/tablet ADO users blocked | Test on 1280×720 minimum; allow scroll within Dialog |
| Telemetry without disclosure | Trust / compliance issues | If you add telemetry, document it in the listing description |
| Theme-blind colors | Modal looks broken in dark mode | Use ADO theme tokens; test both themes |
| Locale-aware number formatting | "5,5" vs "5.5" inconsistency | Always use period for decimals in displayed math; render Story Points as integer |

---

## "Looks Done But Isn't" Checklist

- [ ] **Toolbar button:** Often missing the disabled-state with tooltip — verify behavior on a work item type with no Story Points field
- [ ] **Toolbar button:** Often only tested on User Story — verify on Bug, Task, Feature, Epic explicitly
- [ ] **Modal pre-fill:** Often only tested with the same user / same browser — verify pre-fill works after a comment was edited, after a different user calculated, after the field was manually changed
- [ ] **Apply flow:** Often only tested on a clean form — verify with form already dirty (description edited)
- [ ] **Apply flow:** Often only tested in Chrome — verify Safari and Firefox
- [ ] **Apply flow:** Often only tested as Project Admin — verify as Stakeholder, Contributor, and on a closed work item
- [ ] **Comment format:** Often only tested for write — verify the parser round-trips after the comment is edited, after HTML rendering, with a markdown-mode comment
- [ ] **Permissions UX:** Often only tested with full permissions — verify all 4xx/412 responses produce friendly messages
- [ ] **Manifest scopes:** Often grabbed from a sample — verify only `vso.work_write` is requested
- [ ] **Manifest version:** Often manual-bumped — verify CI auto-bumps and publish does not fail on duplicate version
- [ ] **Bundle:** Often unmeasured — verify gzipped size is under budget (≤250 KB recommended) and source maps stripped from production
- [ ] **Browser matrix:** Often Chrome-only — verify in Safari, Firefox, Edge
- [ ] **Themes:** Often light-only — verify dark theme rendering
- [ ] **First publish:** Often public on first try — verify private install on a trial org first; smoke test; then promote
- [ ] **Custom field resilience:** Often assumed standard — verify on a process where Story Points was renamed/removed
- [ ] **CMMI process:** Often forgotten — verify or explicitly disable button on CMMI work item types
- [ ] **Stakeholder license:** Often forgotten — verify error message is friendly and no comment is written when field write fails
- [ ] **Read-only state:** Often forgotten — verify on Closed/Done work items
- [ ] **Required field on form prevents save:** Often forgotten — verify the message users see when form has unrelated validation errors
- [ ] **Concurrent edits:** Often untested — verify two users editing the same item don't lose each other's changes
- [ ] **(v2) Settings concurrency:** Often untested — verify two admins editing settings don't lose each other's changes
- [ ] **(v2) Schema migration:** Often missing — verify v1 settings document upgrades cleanly to v2 schema

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Custom Story Points field reported by customer | LOW | (v1) document workaround in listing FAQ; (v2) ship configurable field reference name |
| Audit comment parser break (post-publish) | MEDIUM | Bump comment schema version; release patch that handles both v1 and v2 payloads; keep v1 parser indefinitely |
| Manifest scope over-request | HIGH | Cannot remove a scope without re-consent; releasing a "scope-trimmed" version triggers re-consent for all installs anyway. Best to fix before first public publish |
| Bundle bloat regression | LOW | Add CI bundle size gate; revert offending dep |
| Lost-update race in REST writes | MEDIUM | Switch to form-service write path; document; release patch |
| EDS settings collision (v2) | MEDIUM | Add `__etag` checks; on conflict prompt user to reload; release patch |
| Marketplace listing rejected | LOW (if first publish) | Address review feedback (icon, description, scopes); resubmit |
| Duplicate toolbar buttons after upgrade | LOW | User hard refresh; transient; no code fix needed unless contribution `id` was renamed (then revert rename) |
| Permission errors with side-effect comment | MEDIUM | Reorder writes (field first, comment second); release patch; manually clean orphan comments not feasible |
| Browser-specific bug post-publish | MEDIUM | Patch release; meanwhile add browser-detection banner ("known issue on Safari, see workaround") |
| EDS schema migration breakage | HIGH | Always keep migration code in production; never delete `migrateV1ToV2`; if migration is broken, restore from a customer's manual settings export (no automatic backup exists) |

---

## Pitfall-to-Phase Mapping

> Phase numbers are placeholders matched to a typical v1→v2 roadmap. The roadmap creator should map these to the actual phase names produced from PROJECT.md.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Hardcoded SP field | Phase 1 (Field abstraction layer) | Unit test FieldResolver returns correct field per (process, type); manual test on CMMI process |
| 2. Audit comment parser fragility | Phase 1 (Comment format spec + parser) | Unit test suite covering edits, HTML wrap, NBSP, deletion, multiple comments |
| 3. Over-broad scopes | Phase 0 (Project init) — locked before first publish | Marketplace consent prompt shows only one permission line |
| 4. Field write race / lost update | Phase 1 (Apply flow design) | Two-user concurrent QA test; verify form-service vs REST decision |
| 5. EDS scope confusion | v2 Settings phase | Org vs Project test on two trial orgs; concurrent-edit test |
| 6. Toolbar lifecycle bugs | Phase 1 (SDK integration) | Navigation pattern QA: hard refresh, soft refresh, Next/Previous arrows |
| 7. Bundle bloat | Phase 1 (Build config) + ongoing CI gate | CI bundle-size check ≤250 KB gz; load-time measurement |
| 8. Marketplace publish gotchas | Final Publish phase | Pre-flight checklist; private install + smoke test before public |
| 9. Iframe sandbox edge cases | Phase 1 (Modal & SDK) | Browser matrix QA in Safari + Firefox |
| 10. Permission errors UX | Phase 1 (Apply flow) | Test as Stakeholder, on Closed item, on read-only field |
| 11. Localization manifest fields | Phase 1 (Manifest authoring) | `defaultLocale` set; listing renders correctly in non-English browser locale |
| 12. Field/comment atomicity | Phase 1 (Apply flow) | Failure-injection test: simulate comment POST failure; verify field value persists, user sees retry |
| 13. Rate limits | Phase 1 (REST client wrapper) | No polling; cache type defs; honor `Retry-After` |
| 14. SDK version drift | Phase 0 (Init) | SDK pinned in package.json; no `^` |
| 15. `isDirty` confusion | Phase 1 (Apply flow) | UX test on already-dirty form |
| 16. Pre-fill ambiguity | Phase 1 (Pre-fill UX spec) | Test field-vs-comment divergence cases |
| 17. Per-type field availability | Phase 1 (FieldResolver) | Test all targeted work item types in Agile + Scrum + CMMI |
| 18-22. Minor (zoom, TZ, init, id, theme) | Phase 1 | Component library covers most; theme test in dark mode |

---

## Sources

- Microsoft Learn: Azure DevOps extension overview, manifest reference, scopes — `learn.microsoft.com/azure/devops/extend/develop/manifest`, `.../scopes` (training-data knowledge; verify against current pages before publish)
- `microsoft/azure-devops-extension-sdk` GitHub README and TypeScript types
- `microsoft/azure-devops-extension-api` GitHub typings (RestClient definitions for WorkItemTracking)
- `microsoft/azure-devops-extension-sample` repository — canonical patterns for contribution registration, EDS, and form services
- Visual Studio Marketplace publisher portal documentation (`marketplace.visualstudio.com/manage`)
- Work Item Tracking REST API reference — Update Work Item, Add Comment, fields validation, optimistic concurrency via `rev` test op
- Process customization documentation — Inheritance vs Hosted XML; CMMI vs Agile vs Scrum field reference names
- Personal experience and community knowledge of common ADO extension bugs (LOW-MEDIUM confidence; team should validate against trial-org installs before GA)

**Re-verification recommended before GA publish:**
- Latest scope names and admin-approval triggers (Marketplace policies evolve)
- Modern work item form contribution target IDs (legacy vs new combined hub)
- `azure-devops-ui` current import paths (the package has had reorgs)
- ADO Server (on-prem) targeting requirements if on-prem audience is in scope
- Comment markdown-vs-HTML behavior (org setting was added relatively recently)

---
*Pitfalls research for: Azure DevOps work item extension (public Marketplace, Story Points calculator)*
*Researched: 2026-05-01*
