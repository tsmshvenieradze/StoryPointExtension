// tests/ado/postComment.test.ts — Source: D-01, D-13, D-14 (CONTEXT.md);
//   APPLY-06; Plan 04-01 spike A1 verdict (STRIPPED-FALLBACK) + A5 verdict
//   (NO-FUNCTIONAL-DIFFERENCE → use 7.0-preview.3).
//
// Vitest unit tests for the postComment payload shape contract. The
// adoFetch transport is fully mocked; no network calls.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/ado/adoFetch", () => ({ adoFetch: vi.fn() }));
import { adoFetch } from "../../src/ado/adoFetch";
import { postComment } from "../../src/ado/postComment";
import type { AuditPayload } from "../../src/audit";

// Locked by Plan 04-01 spike A1 + A5 — see 04-VERIFICATION.md.
const EXPECTED_API_VERSION = "7.0-preview.3";

describe("postComment payload shape (D-01, D-13; spike A1 STRIPPED-FALLBACK)", () => {
  const PAYLOAD: AuditPayload = { sp: 5, c: "Hard", u: "Medium", e: "Easy", schemaVersion: 1 };
  const EXPECTED_TEXT =
    "Story Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)";

  beforeEach(() => {
    vi.mocked(adoFetch).mockReset();
    vi.mocked(adoFetch).mockResolvedValue({
      id: 99,
      workItemId: 42,
      text: EXPECTED_TEXT,
      createdDate: "2026-05-02T00:00:00Z",
      isDeleted: false,
    } as never);
  });

  it("calls adoFetch with method=POST + api-version 7.0-preview.3", async () => {
    await postComment(42, "proj-id-123", PAYLOAD);
    expect(adoFetch).toHaveBeenCalledWith(
      "POST",
      expect.any(String),
      EXPECTED_API_VERSION,
      expect.any(Object),
    );
  });

  it("body.text === plain human-readable Story Points line (no sentinel)", async () => {
    await postComment(42, "proj-id-123", PAYLOAD);
    const callArgs = vi.mocked(adoFetch).mock.calls[0];
    const body = callArgs[3] as { text: string };
    expect(body.text).toBe(EXPECTED_TEXT);
    // Per spike A1: NO `<!--` sentinel — ADO storage strips it.
    expect(body.text).not.toContain("<!--");
    expect(body.text).not.toContain("sp-calc:v1");
  });

  it("body has NO `format` field (per spike A1 — format:1 has zero effect on storage)", async () => {
    await postComment(42, "proj-id-123", PAYLOAD);
    const callArgs = vi.mocked(adoFetch).mock.calls[0];
    const body = callArgs[3] as Record<string, unknown>;
    expect(body).not.toHaveProperty("format");
    expect(Object.keys(body)).toEqual(["text"]);
  });

  it("path is /<encodeURIComponent(projectId)>/_apis/wit/workItems/<wid>/comments", async () => {
    await postComment(7, "my proj", PAYLOAD);
    const callArgs = vi.mocked(adoFetch).mock.calls[0];
    expect(callArgs[1]).toBe("/my%20proj/_apis/wit/workItems/7/comments");
  });

  it("returns adoFetch result unchanged", async () => {
    const result = await postComment(42, "proj", PAYLOAD);
    expect(result.id).toBe(99);
    expect(result.workItemId).toBe(42);
  });

  it("propagates errors with .status intact", async () => {
    const err = Object.assign(
      new Error("POST /comments failed: 412 Precondition Failed rule violation"),
      { status: 412 },
    );
    vi.mocked(adoFetch).mockRejectedValue(err);
    await expect(postComment(42, "proj", PAYLOAD)).rejects.toMatchObject({
      status: 412,
    });
  });

  it.each([
    { payload: { sp: 1, c: "Very Easy", u: "Very Easy", e: "Very Easy", schemaVersion: 1 } as AuditPayload, expected: "Story Points: 1 (Complexity=Very Easy, Uncertainty=Very Easy, Effort=Very Easy)" },
    { payload: { sp: 13, c: "Very Hard", u: "Very Hard", e: "Very Hard", schemaVersion: 1 } as AuditPayload, expected: "Story Points: 13 (Complexity=Very Hard, Uncertainty=Very Hard, Effort=Very Hard)" },
    { payload: { sp: 8, c: "Medium", u: "Hard", e: "Easy", schemaVersion: 1 } as AuditPayload, expected: "Story Points: 8 (Complexity=Medium, Uncertainty=Hard, Effort=Easy)" },
  ])("text format reflects payload: $expected", async ({ payload, expected }) => {
    vi.mocked(adoFetch).mockResolvedValue({
      id: 1,
      workItemId: 1,
      text: expected,
      createdDate: "2026-05-02T00:00:00Z",
      isDeleted: false,
    } as never);
    await postComment(1, "p", payload);
    const callArgs = vi.mocked(adoFetch).mock.calls[0];
    expect((callArgs[3] as { text: string }).text).toBe(expected);
  });
});
