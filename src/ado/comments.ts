// src/ado/comments.ts — Source: D-22, D-23 (Phase 3 CONTEXT.md);
//   D-14 (Phase 4 CONTEXT.md — refactored to consume adoFetch).
//
// Read counterpart of src/ado/postComment.ts. Both consume the shared
// direct-fetch helper at src/ado/adoFetch.ts (Phase 03-04 Override 4
// codified — bypasses the SDK REST client which hangs in dialog iframes).
// The refactor preserves the existing 7.1-preview.4 api-version and the
// Pitfall-5 createdDate string filter unchanged.
import { adoFetch } from "./adoFetch";
import type { AdoComment } from "../audit/types";

interface ModernCommentDto {
  id: number;
  text: string;
  createdDate: string; // ISO 8601 over the wire — string, NOT Date (RESEARCH §Pitfall 5)
  isDeleted: boolean;
  workItemId: number;
  version: number;
}

interface ModernCommentList {
  comments: ModernCommentDto[];
  count: number;
  totalCount: number;
}

const LOG_PREFIX = "[sp-calc/comments]";

/**
 * Public bridge entry point. <CalcModal>'s read-path effect awaits this.
 * Errors propagate (the orchestrator catches them and renders a
 * read-error Warning banner per D-25).
 */
export async function fetchCommentsForRead(
  workItemId: number,
  projectId: string,
): Promise<AdoComment[]> {
  console.log(`${LOG_PREFIX} fetch start workItemId=${workItemId}`);
  const path = `/${encodeURIComponent(projectId)}/_apis/wit/workItems/${workItemId}/comments`;
  const payload = await adoFetch<ModernCommentList>("GET", path, "7.1-preview.4");
  console.log(`${LOG_PREFIX} parsed comments`, { count: payload?.comments?.length ?? 0 });

  return (payload.comments || [])
    .filter((c) => typeof c.createdDate === "string") // Pitfall 5 sanity check
    .map((c) => ({
      id: c.id,
      text: c.text,
      createdDate: c.createdDate,
      isDeleted: c.isDeleted,
    }));
}
