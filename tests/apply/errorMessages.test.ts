// tests/apply/errorMessages.test.ts — Source: D-11, D-18, D-20 (CONTEXT.md);
// APPLY-08 (REQUIREMENTS.md). Project standard: "manual QA does UI testing
// per company standard; only formula logic is unit-tested" — CLAUDE.md.
// The status-code map and SDK-error discriminator are pure functions and
// qualify as "formula logic" for the unit-test gate.
import { describe, it, expect } from "vitest";
import {
  friendlyMessageForStatus,
  mapSdkErrorToStatus,
} from "../../src/apply/errorMessages";

// Verbatim copy strings from UI-SPEC §Copywriting Contract (LOCKED user-visible
// copy). Em-dashes are U+2014 (NOT ASCII `--`); curly apostrophes (U+2019) are
// NOT used in the locked text — UI-SPEC line 401 shows ASCII `don't`.
const MSG_401 = "Sign in expired. Reload the page and try again.";
const MSG_403 = "You don't have permission to change this item.";
const MSG_404 = "Work item not found — it may have been deleted.";
const MSG_409 = "Conflict — please reload the work item and try again.";
const MSG_412 = "Work item changed since the modal opened — reload and try again.";
const MSG_429 = "Azure DevOps is throttling requests — wait a moment and retry.";
const MSG_5XX = "Azure DevOps server error — try again shortly.";
const MSG_FALLBACK = "Could not save.";

describe("friendlyMessageForStatus: D-11 status-code map", () => {
  it.each<[number | null, string]>([
    // Exact-status hits (Tests 1–7)
    [401, MSG_401],
    [403, MSG_403],
    [404, MSG_404],
    [409, MSG_409],
    [412, MSG_412],
    [429, MSG_429],
    // 5xx class boundary tests (Tests 8–10)
    [500, MSG_5XX],
    [502, MSG_5XX],
    [503, MSG_5XX],
    [599, MSG_5XX], // Test 10 boundary — last code in 5xx range
    // Generic fallbacks (Tests 11–14)
    [418, MSG_FALLBACK], // unknown 4xx
    [null, MSG_FALLBACK], // SDK-error fallback path
    [499, MSG_FALLBACK], // boundary — NOT in 5xx range
    [600, MSG_FALLBACK], // boundary — NOT in 5xx range, ≥600
  ])("status %s → %s", (status, expected) => {
    expect(friendlyMessageForStatus(status)).toBe(expected);
  });
});

describe("mapSdkErrorToStatus: D-20 SDK-error discriminator", () => {
  // Test 15: name === "RuleValidationException" → 412 bucket
  it("RuleValidationException subclass → status 412 + sdkErrorClass", () => {
    class RuleValidationException extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = "RuleValidationException";
      }
    }
    const err = new RuleValidationException("rule failed");
    expect(mapSdkErrorToStatus(err)).toEqual({
      status: 412,
      sdkErrorClass: "RuleValidationException",
    });
  });

  // Tests 16–18: regex matches /permission|denied|forbidden|stakeholder|read[\s-]?only/i → 403
  it.each<[string, string]>([
    ["You do not have permission to update this item.", "permission keyword"],
    ["Stakeholder license cannot edit this work item.", "stakeholder keyword"],
    ["This field is read-only.", "read-only with hyphen"],
    ["This field is read only.", "read only with space"],
    ["Access denied for this user.", "denied keyword"],
    ["Forbidden operation on the work item.", "forbidden keyword"],
  ])(
    "Error message %j (%s) → status 403 + sdkErrorClass='Error'",
    (msg) => {
      expect(mapSdkErrorToStatus(new Error(msg))).toEqual({
        status: 403,
        sdkErrorClass: "Error",
      });
    },
  );

  // Tests 19–20: regex matches /not found|deleted/i → 404
  it.each<[string, string]>([
    ["Work item 12345 not found", "not found"],
    ["Item has been deleted", "deleted"],
    ["Work Item NOT FOUND", "case-insensitive not found"],
  ])(
    "Error message %j (%s) → status 404 + sdkErrorClass='Error'",
    (msg) => {
      expect(mapSdkErrorToStatus(new Error(msg))).toEqual({
        status: 404,
        sdkErrorClass: "Error",
      });
    },
  );

  // Test 21: generic Error → null + sdkErrorClass = err.name
  it("Error with non-matching message → status null + sdkErrorClass='Error'", () => {
    expect(mapSdkErrorToStatus(new Error("Random failure"))).toEqual({
      status: null,
      sdkErrorClass: "Error",
    });
  });

  // Test 22: non-Error string input → { status: null } (no sdkErrorClass)
  it("string input (not an Error) → status null with no sdkErrorClass key", () => {
    expect(mapSdkErrorToStatus("a string, not an Error")).toEqual({
      status: null,
    });
  });

  // Test 23: undefined input → { status: null }
  it("undefined input → status null with no sdkErrorClass key", () => {
    expect(mapSdkErrorToStatus(undefined)).toEqual({ status: null });
  });

  // Test 24: null input → { status: null }
  it("null input → status null with no sdkErrorClass key", () => {
    expect(mapSdkErrorToStatus(null)).toEqual({ status: null });
  });

  // Subclass with custom name preserves err.name in sdkErrorClass for triage
  it("preserves err.name for subclass with non-matching name and message", () => {
    class WorkItemUpdateException extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = "WorkItemUpdateException";
      }
    }
    expect(mapSdkErrorToStatus(new WorkItemUpdateException("opaque"))).toEqual({
      status: null,
      sdkErrorClass: "WorkItemUpdateException",
    });
  });
});
