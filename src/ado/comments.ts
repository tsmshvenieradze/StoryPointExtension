// src/ado/comments.ts
// Source: D-22, D-23 (CONTEXT.md); RESEARCH.md §Pattern 2 + Override 2.
//
// Why this file exists: WorkItemTrackingRestClient.getComments() in
// azure-devops-extension-api@4.270.0 is locked at the LEGACY preview
// route returning WorkItemComment[] with revisedDate/text/renderedText
// shape — NO id, NO isDeleted, NO createdDate. parseLatest (Phase 1)
// requires id/isDeleted/createdDate to filter and sort.
//
// Override 2 acknowledgement: the typed getComments() must NEVER be called
// from anywhere in this codebase. See RESEARCH.md Anti-pattern 3.
//
// 03-04 cezari finding (Override 4): getClient(ModernCommentsClient).beginRequest
// hangs indefinitely from a custom-dialog iframe — the SDK's REST client
// resolves its rootPath via SDK.getService("ms.vss-features.location-service")
// → locationService.getResourceAreaLocation(WIT). Both calls return promises
// that never resolve in the dialog iframe context (verified empirically:
// "[sp-calc/comments] beginRequest start" logs but no network request issues
// and beginRequest never resolves). Form-service postMessage works fine, but
// the location service does not.
//
// Resolution: bypass getClient/beginRequest entirely. Acquire the auth token
// via SDK.getAccessToken() (which DOES work in dialog iframes), construct the
// modern 7.1-preview.4 URL ourselves from SDK.getHost().name, and fetch().
import * as SDK from "azure-devops-extension-sdk";
import type { AdoComment } from "../audit/types";

interface ModernCommentDto {
  id: number;
  text: string;
  createdDate: string;   // ISO 8601 over the wire — string, NOT Date (RESEARCH §Pitfall 5)
  isDeleted: boolean;
  workItemId: number;
  version: number;
}

interface ModernCommentList {
  comments: ModernCommentDto[];
  count: number;
  totalCount: number;
}

const COMMENTS_LOG = "[sp-calc/comments]";

/**
 * Public bridge entry point. <CalcModal>'s read-path effect awaits this.
 * Errors propagate (the orchestrator catches them and renders a
 * read-error Warning banner per D-25).
 */
export async function fetchCommentsForRead(
  workItemId: number,
  projectId: string,
): Promise<AdoComment[]> {
  console.log(`${COMMENTS_LOG} fetch start`);

  const host = SDK.getHost();
  console.log(`${COMMENTS_LOG} host`, { name: host.name, isHosted: host.isHosted });

  console.log(`${COMMENTS_LOG} requesting access token`);
  const token = await SDK.getAccessToken();
  console.log(`${COMMENTS_LOG} access token acquired (len=${token?.length ?? 0})`);

  // ADO Services orgs are reachable at https://dev.azure.com/{name}; the
  // legacy {name}.visualstudio.com URL still resolves. For Azure DevOps Server
  // (isHosted=false) this would need to come from the location service —
  // out of scope for v1.
  const baseUrl = host.isHosted
    ? `https://dev.azure.com/${host.name}`
    : `https://${host.name}.visualstudio.com`;
  const url =
    `${baseUrl}/${encodeURIComponent(projectId)}/_apis/wit/workItems/${workItemId}/comments?api-version=7.1-preview.4`;
  console.log(`${COMMENTS_LOG} fetch URL`, url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  console.log(`${COMMENTS_LOG} fetch response`, { status: response.status, ok: response.ok });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `getCommentsModern failed: ${response.status} ${response.statusText} ${body.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as ModernCommentList;
  console.log(`${COMMENTS_LOG} parsed comments`, { count: payload?.comments?.length ?? 0 });

  return (payload.comments || [])
    .filter((c) => typeof c.createdDate === "string") // Pitfall 5 sanity check
    .map((c) => ({
      id: c.id,
      text: c.text,
      createdDate: c.createdDate,
      isDeleted: c.isDeleted,
    }));
}
