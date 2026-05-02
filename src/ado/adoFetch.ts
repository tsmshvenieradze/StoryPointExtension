// src/ado/adoFetch.ts — Source: D-14 (CONTEXT.md); RESEARCH §Pattern 1; APPLY-06.
//
// Single source of truth for the direct-fetch pattern. Phase 03-04 Override 4
// finding: the SDK's REST client (getClient(...)) hangs indefinitely from a
// custom-dialog iframe — locationService.getResourceAreaLocation never resolves.
// Form-service postMessage and SDK.getAccessToken DO work, so we bypass
// getClient/beginRequest entirely.
//
// Used by:
//   - src/ado/comments.ts (read path; api-version=7.1-preview.4)
//   - src/ado/postComment.ts (write path; api-version=7.0-preview.3 per CONTEXT D-13
//     and Plan 04-01 spike A5 verdict NO-FUNCTIONAL-DIFFERENCE)
//
// Errors carry the HTTP .status attached to the Error so the apply.ts orchestrator
// can map (err as Error & { status?: number }).status into the D-11 friendly-message
// buckets.
//
// Threat T-04-03-01 (info disclosure of access token): the token is passed only via
// the Authorization HTTP header; console logs include token length only, NEVER the
// raw token.
import * as SDK from "azure-devops-extension-sdk";

const LOG_PREFIX = "[sp-calc/adoFetch]";

export async function adoFetch<T>(
  method: "GET" | "POST",
  path: string, // "/{projectId}/_apis/wit/workItems/{id}/comments" — caller URL-encodes the projectId
  apiVersion: string, // e.g. "7.0-preview.3" or "7.1-preview.4"
  body?: unknown,
  opts?: { signal?: AbortSignal },
): Promise<T> {
  const host = SDK.getHost();
  const token = await SDK.getAccessToken();
  // Token length-only log — NEVER log the raw token (T-04-03-01).
  console.log(`${LOG_PREFIX} ${method} preparing`, {
    hostName: host.name,
    isHosted: host.isHosted,
    tokenLen: token?.length ?? 0,
  });

  const baseUrl = host.isHosted
    ? `https://dev.azure.com/${host.name}`
    : `https://${host.name}.visualstudio.com`;
  const url = `${baseUrl}${path}?api-version=${encodeURIComponent(apiVersion)}`;
  console.log(`${LOG_PREFIX} ${method} ${url}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  const init: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  if (opts?.signal) {
    init.signal = opts.signal;
  }

  const response = await fetch(url, init);
  console.log(`${LOG_PREFIX} ${method} response`, {
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const err = new Error(
      `${method} ${path} failed: ${response.status} ${response.statusText} ${text.slice(0, 200)}`,
    );
    // Attach status for the orchestrator's typed-error translation (D-11).
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }

  return (await response.json()) as T;
}
