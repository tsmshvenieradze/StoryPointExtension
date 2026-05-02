// src/apply/errorMessages.ts — Source: D-11, D-20 (CONTEXT.md); APPLY-08 (REQUIREMENTS.md);
// UI-SPEC §Copywriting Contract (LOCKED user-visible copy strings).
//
// Pure module — ZERO imports from azure-devops-extension-sdk OR
// azure-devops-extension-api. The status-code map and SDK-error
// discriminator both run in the unit-test gate without mocks.
//
// The mapSdkErrorToStatus heuristic is best-effort against the SDK's
// undocumented Error subclass shape; Plan 04-06 (D-17 scenarios 4 + 5)
// refines the regex with empirical cezari evidence.

/**
 * Map an HTTP status code (or null for the SDK-error fallback path) to the
 * user-visible message string per CONTEXT D-11 + UI-SPEC §Copywriting
 * Contract. The user-visible banner template combines this string with the
 * raw status: `${friendlyMessage} (HTTP ${status})` per D-08 / D-09.
 *
 * Glyphs are LOCKED — em-dashes are U+2014, not ASCII `--`. ASCII substitutes
 * are FAIL conditions per UI-SPEC line 424.
 */
export function friendlyMessageForStatus(status: number | null): string {
  switch (status) {
    case 401:
      return "Sign in expired. Reload the page and try again.";
    case 403:
      return "You don't have permission to change this item.";
    case 404:
      return "Work item not found — it may have been deleted.";
    case 409:
      return "Conflict — please reload the work item and try again.";
    case 412:
      return "Work item changed since the modal opened — reload and try again.";
    case 429:
      return "Azure DevOps is throttling requests — wait a moment and retry.";
    default:
      if (status !== null && status >= 500 && status < 600) {
        return "Azure DevOps server error — try again shortly.";
      }
      return "Could not save.";
  }
}

/**
 * Translate a save() / setFieldValue() rejection into the same status
 * discriminators used by the comment leg (HTTP-driven). Best-effort
 * heuristic: the SDK rejects with Error subclasses whose .name and
 * .message vary by ADO host build. Plan 04-06 D-17 scenarios 4 + 5
 * refine the regex with empirical evidence.
 *
 * Test cases (vitest):
 *   - Error with name === "RuleValidationException" → 412
 *   - Error with message containing "permission" / "denied" / "forbidden" /
 *     "stakeholder" / "read[\s-]?only" → 403
 *   - Error with message containing "not found" / "deleted" → 404
 *   - Anything else (Error or otherwise) → null (generic fallback "Could not save.")
 *
 * For an Error instance, sdkErrorClass is always set to err.name (used by
 * D-09 banner copy: "SDK error: {className}" — see UI-SPEC line 408).
 * For non-Error inputs (string, undefined, null) the function returns just
 * `{ status: null }` with NO sdkErrorClass key (omitted, not undefined).
 */
export function mapSdkErrorToStatus(
  err: unknown,
): { status: number | null; sdkErrorClass?: string } {
  if (err instanceof Error) {
    const name = err.name;
    const msg = err.message ?? "";
    if (name === "RuleValidationException") {
      return { status: 412, sdkErrorClass: name };
    }
    if (/permission|denied|forbidden|stakeholder|read[\s-]?only/i.test(msg)) {
      return { status: 403, sdkErrorClass: name };
    }
    if (/not found|deleted/i.test(msg)) {
      return { status: 404, sdkErrorClass: name };
    }
    return { status: null, sdkErrorClass: name };
  }
  return { status: null };
}
