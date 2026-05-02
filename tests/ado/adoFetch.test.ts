// tests/ado/adoFetch.test.ts — Source: D-14, D-18 (CONTEXT.md); APPLY-06.
// Vitest unit tests for the URL construction + error shape contract.
// The fetch + SDK surface is fully mocked; no network calls.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the SDK module BEFORE importing adoFetch.
vi.mock("azure-devops-extension-sdk", () => ({
  getHost: vi.fn(),
  getAccessToken: vi.fn(),
}));
import * as SDK from "azure-devops-extension-sdk";
import { adoFetch } from "../../src/ado/adoFetch";

describe("adoFetch URL construction (D-14)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(SDK.getAccessToken).mockResolvedValue("test-token-abc");
    fetchSpy = vi.spyOn(globalThis, "fetch") as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isHosted=true → https://dev.azure.com/{name}", async () => {
    vi.mocked(SDK.getHost).mockReturnValue({ name: "myorg", isHosted: true } as any);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: 1 }),
    } as any);
    await adoFetch("GET", "/proj1/_apis/wit/x", "7.1-preview.4");
    const callUrl = fetchSpy.mock.calls[0]?.[0];
    expect(callUrl).toBe(
      "https://dev.azure.com/myorg/proj1/_apis/wit/x?api-version=7.1-preview.4",
    );
  });

  it("isHosted=false → https://{name}.visualstudio.com", async () => {
    vi.mocked(SDK.getHost).mockReturnValue({ name: "myorg", isHosted: false } as any);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: 1 }),
    } as any);
    await adoFetch("GET", "/proj1/_apis/wit/x", "7.1-preview.4");
    const callUrl = fetchSpy.mock.calls[0]?.[0];
    expect(callUrl).toBe(
      "https://myorg.visualstudio.com/proj1/_apis/wit/x?api-version=7.1-preview.4",
    );
  });

  it("path is sent verbatim — caller URL-encodes (no double-encoding by adoFetch)", async () => {
    vi.mocked(SDK.getHost).mockReturnValue({ name: "myorg", isHosted: true } as any);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any);
    // Caller has pre-encoded the projectId → path contains %20 already.
    await adoFetch(
      "POST",
      "/my%20proj/_apis/wit/workItems/7/comments",
      "7.0-preview.3",
      { text: "hi" },
    );
    const callUrl = fetchSpy.mock.calls[0]?.[0];
    expect(callUrl).toBe(
      "https://dev.azure.com/myorg/my%20proj/_apis/wit/workItems/7/comments?api-version=7.0-preview.3",
    );
  });

  it("POST sends Content-Type: application/json and JSON-encoded body", async () => {
    vi.mocked(SDK.getHost).mockReturnValue({ name: "myorg", isHosted: true } as any);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any);
    await adoFetch(
      "POST",
      "/p/_apis/x",
      "7.0-preview.3",
      { text: "hi", n: 5 },
    );
    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect((opts.headers as any)["Content-Type"]).toBe("application/json");
    expect(opts.body).toBe(JSON.stringify({ text: "hi", n: 5 }));
  });

  it("GET omits Content-Type and body", async () => {
    vi.mocked(SDK.getHost).mockReturnValue({ name: "myorg", isHosted: true } as any);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any);
    await adoFetch("GET", "/p/_apis/x", "7.1-preview.4");
    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(opts.method).toBe("GET");
    expect((opts.headers as any)["Content-Type"]).toBeUndefined();
    expect(opts.body).toBeUndefined();
  });

  it("Authorization Bearer header present on every call", async () => {
    vi.mocked(SDK.getHost).mockReturnValue({ name: "myorg", isHosted: true } as any);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any);
    await adoFetch("GET", "/p/_apis/x", "7.1-preview.4");
    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect((opts.headers as any).Authorization).toBe("Bearer test-token-abc");
    expect((opts.headers as any).Accept).toBe("application/json");
  });
});

describe("adoFetch error shape (D-14)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(SDK.getHost).mockReturnValue({ name: "myorg", isHosted: true } as any);
    vi.mocked(SDK.getAccessToken).mockResolvedValue("tok");
    fetchSpy = vi.spyOn(globalThis, "fetch") as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("non-ok response throws Error with .status attached", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 412,
      statusText: "Precondition Failed",
      text: async () => "rule violation",
    } as any);
    let caught: unknown;
    try {
      await adoFetch("POST", "/proj/_apis/x", "7.0-preview.3", { foo: 1 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain(
      "POST /proj/_apis/x failed: 412 Precondition Failed",
    );
    expect((caught as Error).message).toContain("rule violation");
    expect((caught as Error & { status?: number }).status).toBe(412);
  });

  it("non-ok response with empty body still throws with .status", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    } as any);
    let caught: unknown;
    try {
      await adoFetch("GET", "/p", "7.1-preview.4");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain(
      "GET /p failed: 500 Internal Server Error",
    );
    expect((caught as Error & { status?: number }).status).toBe(500);
  });

  it("non-ok where text() rejects still throws with .status (slice fallback to empty)", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => {
        throw new Error("body read failed");
      },
    } as any);
    let caught: unknown;
    try {
      await adoFetch("GET", "/p", "7.1-preview.4");
    } catch (err) {
      caught = err;
    }
    expect((caught as Error & { status?: number }).status).toBe(503);
  });

  it("ok response returns parsed JSON cast to T", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ count: 5, items: ["a"] }),
    } as any);
    const result = await adoFetch<{ count: number; items: string[] }>(
      "GET",
      "/x",
      "7.1-preview.4",
    );
    expect(result.count).toBe(5);
    expect(result.items).toEqual(["a"]);
  });
});
