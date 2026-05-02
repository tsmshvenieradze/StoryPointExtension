# Story Point Calculator

Structured Story Point estimation for Azure Boards using **Complexity**, **Uncertainty**, and **Effort** axes. Replaces free-form guessing with a reproducible 30-second calculation written directly to the work item's Story Points field, with an audit comment explaining how the number was derived.

Works on Scrum, Agile, Basic, and CMMI processes. Reads and writes through the Azure DevOps work item form using only the `vso.work_write` scope — no telemetry, no external storage, no other permissions.

## What it does

Open any work item in Azure Boards. Click **Calculate Story Points** in the work item toolbar. Pick a level for each of the three axes:

- **Complexity** — How hard is the work? (Very Easy → Very Hard)
- **Uncertainty** — How much do we know about it? (Very Easy → Very Hard)
- **Effort** — How much work to do it? (Very Easy → Very Hard)

The calculator shows the resulting Story Points value (rounded to a Fibonacci bucket: 0.5, 1, 2, 3, 5, 8, 13). Click **Apply** — the Story Points field updates, and an audit comment is posted to the work item's Discussion thread summarizing the calculation:

> Story Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)

## How to use it

1. Install the extension on your Azure DevOps organization.
2. Open any work item that has a Story Points (Scrum/Agile/Basic) or Size (CMMI) field — Product Backlog Item, User Story, Bug, Task, Feature, Epic, Requirement.
3. Click **Calculate Story Points** in the work item toolbar.
4. Pick a level for each of the three axes.
5. Click **Apply**.

If the work item already has a Story Points value, the calculator opens with that estimate pre-loaded so you can refine it. A confirmation panel asks you to approve overwriting before any write happens.

## Privacy

**No telemetry.** All data stays in your Azure DevOps organization. The extension reads the current Story Points field value and the work item's Discussion thread, and writes:

- The new Story Points value (via the work item form's `setFieldValue` API).
- One audit comment to the Discussion thread (via the standard `addComment` REST endpoint).

That's it. No data leaves your ADO organization. No external services contacted.

## Supported processes

| Process | Story Points field |
|---------|--------------------|
| Scrum   | `Microsoft.VSTS.Scheduling.StoryPoints` |
| Agile   | `Microsoft.VSTS.Scheduling.StoryPoints` |
| Basic   | `Microsoft.VSTS.Scheduling.StoryPoints` |
| CMMI    | `Microsoft.VSTS.Scheduling.Size` |

## Known limitations (v1)

- **Esc does not dismiss the modal.** Use **click outside** the modal or the title-bar **X** button to close. (Iframe focus traps the Esc key inside the modal; the Azure DevOps SDK doesn't expose a programmatic close hook from the dialog iframe.)
- **Read-only state surfaces as a write error**, not as an upfront block. If you don't have permission to change the work item, the calculator opens normally; clicking Apply produces a clear error banner explaining the permission failure. (No reliable upfront permission probe exists from the dialog iframe in current Azure DevOps SDK.)
- **Custom Story Point field names are not yet supported.** The calculator uses the stock `Microsoft.VSTS.Scheduling.StoryPoints` field on Scrum/Agile/Basic and `Microsoft.VSTS.Scheduling.Size` on CMMI. Custom field name override (for organizations that have replaced the inherited field) is on the v2 roadmap.

## Permissions

The extension requests one Azure DevOps scope:

- **`vso.work_write`** — read and write work items (required to read the current Story Points value, the Discussion thread for the previous estimate, and to write the new value + audit comment).

No other scopes. No org-level permissions.

## Repository and support

- **Source code:** [github.com/tsmshvenieradze/StoryPointExtension](https://github.com/tsmshvenieradze/StoryPointExtension)
- **Issues / feature requests:** [GitHub Issues](https://github.com/tsmshvenieradze/StoryPointExtension/issues)
- **License:** MIT — see the [LICENSE file](https://github.com/tsmshvenieradze/StoryPointExtension/blob/master/LICENSE) on GitHub.

## Compatibility

- Azure DevOps Services (cloud) — supported.
- Azure DevOps Server (on-prem) — should work for Server 2019+ but not yet verified on a real on-prem instance.
- Browsers: any modern Chromium, Firefox, Safari (whatever Azure DevOps supports).
