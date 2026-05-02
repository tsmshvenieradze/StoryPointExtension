// tests/apply/apply.test.ts — Source: D-12, D-15, D-20 (CONTEXT.md);
//   APPLY-05, APPLY-06, APPLY-07, APPLY-08; Phase 0 D-01 atomicity.
//   Project standard: pure-logic tests; UI states are manual cezari (D-17).
//
// Atomicity contract: postComment(...) MUST resolve BEFORE
// formService.setFieldValue(...) is called (Phase 0 D-01). Vitest
// invocationCallOrder is the language-level proof.
//
// Plan 04-01 spike A1 verdict: postComment owns the human-readable text;
// apply.ts just calls it. Plan 04-03 SUMMARY: postComment.ts already
// builds the text from the AuditPayload, so apply.ts just forwards
// (workItemId, projectId, payload).
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDK-aware modules BEFORE importing apply. The errorMessages
// helper is pure and is NOT mocked — its behavior is part of the
// apply orchestrator's contract (Test 4 / 5 assert exact friendly copy).
vi.mock("../../src/ado", () => ({
  postComment: vi.fn(),
}));
import { postComment } from "../../src/ado";
import {
  applyToWorkItem,
  type ApplyError,
  type ApplyInput,
} from "../../src/apply";

// IWorkItemFormService mock — only the methods apply.ts touches.
function makeFormServiceMock() {
  return {
    setFieldValue: vi.fn(),
    save: vi.fn(),
    getInvalidFields: vi.fn().mockResolvedValue([]),
  };
}

const VALID_INPUT: ApplyInput = {
  c: "Hard",
  u: "Medium",
  e: "Easy",
  fieldRefName: "Microsoft.VSTS.Scheduling.StoryPoints",
};

// Locked by UI-SPEC §Copywriting Contract (verbatim, em-dashes are U+2014).
const MSG_403 = "You don't have permission to change this item.";
const MSG_412 =
  "Work item changed since the modal opened — reload and try again.";

describe("applyToWorkItem atomicity (Phase 0 D-01, APPLY-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("postComment resolves BEFORE setFieldValue is called (mock-call-order)", async () => {
    vi.mocked(postComment).mockResolvedValue({
      id: 99,
      workItemId: 42,
      text: "Story Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)",
      createdDate: "2026-05-02T00:00:00Z",
      isDeleted: false,
    } as never);
    const fs = makeFormServiceMock();
    fs.setFieldValue.mockResolvedValue(true);
    fs.save.mockResolvedValue(undefined);

    await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never);

    const postOrder = vi.mocked(postComment).mock.invocationCallOrder[0];
    const setOrder = fs.setFieldValue.mock.invocationCallOrder[0];
    expect(postOrder).toBeDefined();
    expect(setOrder).toBeDefined();
    expect(postOrder!).toBeLessThan(setOrder!);
  });

  it("success path: both legs resolve happily → applyToWorkItem resolves void", async () => {
    vi.mocked(postComment).mockResolvedValue({
      id: 99,
      workItemId: 42,
      text: "Story Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)",
      createdDate: "2026-05-02T00:00:00Z",
      isDeleted: false,
    } as never);
    const fs = makeFormServiceMock();
    fs.setFieldValue.mockResolvedValue(true);
    fs.save.mockResolvedValue(undefined);

    await expect(
      applyToWorkItem(VALID_INPUT, 42, "proj", fs as never),
    ).resolves.toBeUndefined();

    expect(postComment).toHaveBeenCalledTimes(1);
    expect(fs.setFieldValue).toHaveBeenCalledTimes(1);
    expect(fs.save).toHaveBeenCalledTimes(1);
  });

  it("forwards (workItemId, projectId, payload) to postComment with derived sp", async () => {
    vi.mocked(postComment).mockResolvedValue({
      id: 1,
      workItemId: 42,
      text: "...",
      createdDate: "2026-05-02T00:00:00Z",
      isDeleted: false,
    } as never);
    const fs = makeFormServiceMock();
    fs.setFieldValue.mockResolvedValue(true);
    fs.save.mockResolvedValue(undefined);

    await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never);

    const callArgs = vi.mocked(postComment).mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs![0]).toBe(42);
    expect(callArgs![1]).toBe("proj");
    expect(callArgs![2]).toMatchObject({
      c: "Hard",
      u: "Medium",
      e: "Easy",
      schemaVersion: 1,
    });
    // sp is derived via calculate({c,u,e}) — must be a finite Fibonacci int.
    expect(typeof (callArgs![2] as { sp: unknown }).sp).toBe("number");
  });

  it("forwards setFieldValue with the calculated sp (numeric)", async () => {
    vi.mocked(postComment).mockResolvedValue({
      id: 1,
      workItemId: 42,
      text: "...",
      createdDate: "2026-05-02T00:00:00Z",
      isDeleted: false,
    } as never);
    const fs = makeFormServiceMock();
    fs.setFieldValue.mockResolvedValue(true);
    fs.save.mockResolvedValue(undefined);

    await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never);

    const args = fs.setFieldValue.mock.calls[0];
    expect(args).toBeDefined();
    expect(args![0]).toBe("Microsoft.VSTS.Scheduling.StoryPoints");
    expect(typeof args![1]).toBe("number");
    expect(Number.isFinite(args![1] as number)).toBe(true);
  });
});

describe("applyToWorkItem failure paths (D-08, D-09, D-11, D-20)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("comment leg fails (HTTP 412) → reject with leg='comment', status=412, friendly 412 copy", async () => {
    const err = Object.assign(new Error("POST /comments failed: 412"), {
      status: 412,
    });
    vi.mocked(postComment).mockRejectedValue(err);
    const fs = makeFormServiceMock();

    let caught: unknown;
    try {
      await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never);
      throw new Error("should have rejected");
    } catch (e) {
      caught = e;
    }

    expect(caught).toMatchObject({
      leg: "comment",
      status: 412,
      message: MSG_412,
    });
    // Field write MUST NOT be attempted when comment leg fails.
    expect(fs.setFieldValue).not.toHaveBeenCalled();
    expect(fs.save).not.toHaveBeenCalled();
  });

  it("comment leg fails with no .status (network error) → reject with status=null, generic copy", async () => {
    vi.mocked(postComment).mockRejectedValue(new Error("network down"));
    const fs = makeFormServiceMock();

    let caught: unknown;
    try {
      await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never);
      throw new Error("should have rejected");
    } catch (e) {
      caught = e;
    }

    expect(caught).toMatchObject({
      leg: "comment",
      status: null,
      message: "Could not save.",
    });
    expect(fs.setFieldValue).not.toHaveBeenCalled();
  });

  it("field leg: setFieldValue returns false (Pitfall 6 → 412 bucket) → reject with leg='field', status=412; .save() NOT called", async () => {
    vi.mocked(postComment).mockResolvedValue({
      id: 1,
      workItemId: 42,
      text: "...",
      createdDate: "2026-05-02T00:00:00Z",
      isDeleted: false,
    } as never);
    const fs = makeFormServiceMock();
    fs.setFieldValue.mockResolvedValue(false);

    let caught: unknown;
    try {
      await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never);
      throw new Error("should have rejected");
    } catch (e) {
      caught = e;
    }

    expect(caught).toMatchObject({
      leg: "field",
      status: 412,
    });
    // Friendly message starts with the locked 412 copy (may have invalid-fields
    // suffix appended if getInvalidFields returned non-empty).
    expect((caught as ApplyError).message).toContain(MSG_412);
    expect(fs.save).not.toHaveBeenCalled();
  });

  it("field leg: .save() rejects with permission-denied Error → reject with leg='field', status=403, sdkErrorClass='Error'", async () => {
    vi.mocked(postComment).mockResolvedValue({
      id: 1,
      workItemId: 42,
      text: "...",
      createdDate: "2026-05-02T00:00:00Z",
      isDeleted: false,
    } as never);
    const fs = makeFormServiceMock();
    fs.setFieldValue.mockResolvedValue(true);
    fs.save.mockRejectedValue(new Error("Permission denied"));

    let caught: unknown;
    try {
      await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never);
      throw new Error("should have rejected");
    } catch (e) {
      caught = e;
    }

    expect(caught).toMatchObject({
      leg: "field",
      status: 403,
      sdkErrorClass: "Error",
      message: MSG_403,
    });
  });

  it("field leg: .save() rejects with RuleValidationException-named Error → 412 + sdkErrorClass='RuleValidationException'", async () => {
    vi.mocked(postComment).mockResolvedValue({
      id: 1,
      workItemId: 42,
      text: "...",
      createdDate: "2026-05-02T00:00:00Z",
      isDeleted: false,
    } as never);
    const fs = makeFormServiceMock();
    fs.setFieldValue.mockResolvedValue(true);
    class RuleValidationException extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = "RuleValidationException";
      }
    }
    fs.save.mockRejectedValue(new RuleValidationException("rule failed"));

    let caught: unknown;
    try {
      await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never);
      throw new Error("should have rejected");
    } catch (e) {
      caught = e;
    }

    expect(caught).toMatchObject({
      leg: "field",
      status: 412,
      sdkErrorClass: "RuleValidationException",
      message: MSG_412,
    });
  });

  it("typed error shape: rejected value matches ApplyError discriminated union", async () => {
    const err = Object.assign(new Error("POST failed: 404"), { status: 404 });
    vi.mocked(postComment).mockRejectedValue(err);
    const fs = makeFormServiceMock();

    let caught: unknown;
    try {
      await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never);
    } catch (e) {
      caught = e;
    }

    // ApplyError shape: { leg, status, sdkErrorClass?, message }
    const ae = caught as ApplyError;
    expect(ae).toBeDefined();
    expect(ae.leg).toBe("comment");
    expect(ae.status).toBe(404);
    expect(typeof ae.message).toBe("string");
    expect(ae.message.length).toBeGreaterThan(0);
  });
});

describe("applyToWorkItem D-09 retry path (skipCommentLeg=true)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skipCommentLeg=true bypasses postComment; only field leg runs", async () => {
    const fs = makeFormServiceMock();
    fs.setFieldValue.mockResolvedValue(true);
    fs.save.mockResolvedValue(undefined);

    await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never, {
      skipCommentLeg: true,
    });

    expect(postComment).not.toHaveBeenCalled();
    expect(fs.setFieldValue).toHaveBeenCalledTimes(1);
    expect(fs.save).toHaveBeenCalledTimes(1);
  });

  it("skipCommentLeg=true: field leg failure rejects with leg='field' (not 'comment')", async () => {
    const fs = makeFormServiceMock();
    fs.setFieldValue.mockResolvedValue(true);
    fs.save.mockRejectedValue(new Error("Permission denied"));

    let caught: unknown;
    try {
      await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never, {
        skipCommentLeg: true,
      });
    } catch (e) {
      caught = e;
    }

    expect(postComment).not.toHaveBeenCalled();
    expect(caught).toMatchObject({
      leg: "field",
      status: 403,
      message: MSG_403,
    });
  });

  it("skipCommentLeg=false (default) runs both legs", async () => {
    vi.mocked(postComment).mockResolvedValue({
      id: 1,
      workItemId: 42,
      text: "...",
      createdDate: "2026-05-02T00:00:00Z",
      isDeleted: false,
    } as never);
    const fs = makeFormServiceMock();
    fs.setFieldValue.mockResolvedValue(true);
    fs.save.mockResolvedValue(undefined);

    await applyToWorkItem(VALID_INPUT, 42, "proj", fs as never, {
      skipCommentLeg: false,
    });

    expect(postComment).toHaveBeenCalledTimes(1);
    expect(fs.setFieldValue).toHaveBeenCalledTimes(1);
  });
});
