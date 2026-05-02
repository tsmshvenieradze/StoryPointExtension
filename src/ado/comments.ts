// src/ado/comments.ts
// Source: D-22, D-23 (CONTEXT.md); RESEARCH.md §Pattern 2 + Override 2.
//
// Why this file exists: WorkItemTrackingRestClient.getComments() in
// azure-devops-extension-api@4.270.0 is locked at the LEGACY
// 5.0-preview.2 route returning WorkItemComment[] with revisedDate/text
// /renderedText shape — NO id, NO isDeleted, NO createdDate. parseLatest
// (Phase 1) requires id/isDeleted/createdDate to filter and sort.
//
// Resolution: subclass WorkItemTrackingRestClient and call the modern
// 7.1-preview.4 endpoint via the inherited protected `beginRequest`. The
// subclass is NOT exported — only the free function fetchCommentsForRead
// is part of the bridge surface.
//
// Override 2 acknowledgement: the typed getComments() must NEVER be called
// from anywhere in this codebase. See RESEARCH.md Anti-pattern 3.
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import { getClient } from "azure-devops-extension-api";
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
  nextPage?: string;
  continuationToken?: string;
}

/**
 * Calls GET /{project}/_apis/wit/workItems/{workItemId}/comments?api-version=7.1-preview.4
 * via the inherited protected beginRequest, returning the modern Comment
 * shape suitable for AdoComment / parseLatest.
 */
class ModernCommentsClient extends WorkItemTrackingRestClient {
  async getCommentsModern(workItemId: number, project: string): Promise<AdoComment[]> {
    const result = await this.beginRequest<ModernCommentList>({
      apiVersion: "7.1-preview.4",
      routeTemplate: "{project}/_apis/wit/workItems/{workItemId}/comments",
      routeValues: { project, workItemId },
    });
    return result.comments
      .filter((c) => typeof c.createdDate === "string")  // Pitfall 5 sanity check
      .map((c) => ({
        id: c.id,
        text: c.text,
        createdDate: c.createdDate,
        isDeleted: c.isDeleted,
      }));
  }
}

/**
 * Public bridge entry point. <CalcModal>'s read-path effect awaits this.
 * Errors propagate (the orchestrator catches them and renders a
 * read-error Warning banner per D-25).
 */
export async function fetchCommentsForRead(
  workItemId: number,
  projectId: string,
): Promise<AdoComment[]> {
  const client = getClient(ModernCommentsClient);
  return client.getCommentsModern(workItemId, projectId);
}
