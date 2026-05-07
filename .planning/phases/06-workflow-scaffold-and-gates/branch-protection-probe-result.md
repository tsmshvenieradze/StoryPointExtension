# Master branch-protection probe result

**Probed:** 2026-05-07
**Repo:** tsmshvenieradze/StoryPointExtension
**Endpoint (intended):** `GET /repos/tsmshvenieradze/StoryPointExtension/branches/master/protection`
**Sources:**
1. **Workflow probe** (best-effort, GITHUB_TOKEN-scoped) — `Probe master branch protection` step in `Publish #1` (commit `db633d5`, branch `master`).
2. **Developer probe** (authoritative, admin-scoped) — local `gh api repos/tsmshvenieradze/StoryPointExtension/branches/master/protection` invocation by the repo admin (gh v2.92.0, web-auth flow), cross-verified against direct admin inspection of `Settings → Branches` via the GitHub UI. Both surfaces agreed.

## Result

**State:** NOT PROTECTED

`master` has no branch protection rule and no branch ruleset that targets it. Anyone with push access can push directly; status checks are not required; pull requests are not required for merging.

## Probe divergence

Per CONTEXT.md decision **D-5b**, when the workflow probe and the developer probe disagree, the developer probe wins (admin-scoped is authoritative). Here both probes ran and disagreed in the expected way:

| Probe | Output | Interpretation |
|-------|--------|----------------|
| Workflow probe (publish.yml step `Probe master branch protection`) | `unknown` | `gh api` exited non-zero with a body that did not match `Branch not protected`. Almost certainly a 401/403 from `GITHUB_TOKEN` lacking admin scope (no `administration:` key exists in workflow `permissions:` blocks — verified via IDE diagnostic on PR #2 / commit 8e1d65f). |
| Developer probe (Settings → Branches admin UI) | `not_protected` | No branch protection rule and no ruleset targets `master`. Definitive. |

**Resolution:** developer probe wins. Recorded `State: NOT PROTECTED` above, used the developer probe's outcome for the `Implication for Phase 7` paragraph below.

This divergence is the design-intended outcome of the tri-state workflow probe (CONTEXT D-5 revised) — the workflow probe honestly reports `unknown` instead of misclassifying a 401/403 as `not_protected`, which would have been a false negative that let P7 use `GITHUB_TOKEN` against a protected branch.

## Implication for Phase 7 (commit-back token)

`master` is unprotected, so Phase 7's `git-auto-commit-action@v6` step can use the default `GITHUB_TOKEN` with `permissions: contents: write` at the publish job level. No GitHub App and no `RELEASE_PAT` secret needed. This matches the v1.1 milestone working assumption captured in `.planning/STATE.md` "v1.1 decisions" and `.planning/research/SUMMARY.md` (auth-model section).

If branch protection is enabled on `master` at any point AFTER Phase 7 ships, the `git-auto-commit-action` step will start failing on the bot push. Recovery path:
1. Re-probe (re-run this artifact's developer-probe procedure on the `Settings → Branches` page).
2. Update P7's `publish.yml` to provision either (a) a GitHub App with `Contents: write` permission added to the protection rule's bypass list, or (b) a `RELEASE_PAT` repo secret tied to a user account that bypasses protection.
3. See `.planning/research/SUMMARY.md` "Branch-protection-aware push" Future Requirement for the full migration playbook (it's an explicit v1.2+ candidate, not in scope today).

## Raw API response

Captured 2026-05-07 from the developer machine via `gh api repos/tsmshvenieradze/StoryPointExtension/branches/master/protection` (admin-scoped, gh v2.92.0). HTTP status 404, gh exit code 1 (gh exits non-zero on 4xx by design), stdout body verbatim:

```json
{"message":"Branch not protected","documentation_url":"https://docs.github.com/rest/branches/branch-protection#get-branch-protection","status":"404"}
```

stderr (gh's friendly error wrapping of the 404):

```
gh: Branch not protected (HTTP 404)
```

This 404 with body containing `Branch not protected` is the canonical signal that no protection rule and no ruleset target `master`. Cross-verified against `Settings → Branches` UI, which showed no rules and no rulesets for `master`. The two admin-scoped surfaces agreed.

The workflow probe's raw stderr was captured in the `Publish to Marketplace (dry-run in P6)` job's "Probe master branch protection" step log of `Publish #1` (commit `db633d5`); the run also surfaced an annotation `"Branch-protection probe inconclusive (gh api exit 1, body did not match 'Branch not protected'):"` confirming the `unknown` classification fired. The `body did not match` part is consistent with `GITHUB_TOKEN` returning a different (likely 401/403) body than the admin-scoped probe's 404, since `GITHUB_TOKEN` cannot be granted admin scope via workflow `permissions:` blocks.

## Cross-references

- Workflow probe run: `Publish #1`, commit `db633d5`, branch `master`, duration 47s, green status. Job: "Publish to Marketplace (dry-run in P6)".
- CONTEXT.md decisions: **D-5** (tri-state probe semantics), **D-5a** (P7 reads this artifact, not CONTEXT or step summary alone), **D-5b** (developer probe wins on disagreement) — all in `.planning/phases/06-workflow-scaffold-and-gates/06-CONTEXT.md`.
- Originating fix commit: `8e1d65f` — `fix(06-02): branch-protection probe distinguishes 404 from auth errors` (the 8e1d65f fix is what made the workflow probe correctly emit `unknown` instead of misclassifying as `not_protected`).
