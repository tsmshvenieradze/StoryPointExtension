// src/ado/postComment.ts — Source: D-01, D-13, D-14 (CONTEXT.md); APPLY-06.
//   Plan 04-01 spike A1 verdict: STRIPPED-FALLBACK — ADO storage strips
//   the `<!-- sp-calc:v1 ... -->` HTML-comment sentinel regardless of
//   api-version (7.0-preview.3 / 7.1-preview.4) or commentFormat (1 /
//   omitted). Falsifies D-01.
//   Plan 04-01 D-02 fallback decision (recorded in 04-VERIFICATION.md):
//   audit comment becomes human-readable-only — no sentinel, no
//   round-trippable JSON, plain "Story Points: N (Complexity=X,
//   Uncertainty=Y, Effort=Z)" only. ADO defaults to html format and
//   renders the plain text correctly.
//   Plan 04-01 spike A5 verdict: NO-FUNCTIONAL-DIFFERENCE between
//   7.0-preview.3 and 7.1-preview.4 — uses 7.0-preview.3 to share
//   a single api-version constant with comments.ts read path.
//
// Sibling of src/ado/comments.ts (read counterpart). Both consume
// src/ado/adoFetch.ts — Override 4 codified.
import { adoFetch } from "./adoFetch";
import type { AuditPayload } from "../audit";

const LOG_PREFIX = "[sp-calc/postComment]";

export interface CommentResponse {
  id: number; // Microsoft Learn names this `commentId` in 7.0/7.1; SDK type names it `id`
  commentId?: number;
  workItemId: number;
  text: string;
  createdDate: string;
  isDeleted: boolean;
  format?: string | number; // 0 = Markdown, 1 = Html (server may echo)
}

/**
 * Builds the human-readable audit-comment text. Per Plan 04-01 spike A1
 * verdict (STRIPPED-FALLBACK), no `<!-- ... -->` sentinel can survive ADO
 * storage; the comment is plain text only. Reopen-pre-fill (D-16, future)
 * would regex-parse this format directly.
 */
function humanText(payload: AuditPayload): string {
  return `Story Points: ${payload.sp} (Complexity=${payload.c}, Uncertainty=${payload.u}, Effort=${payload.e})`;
}

/**
 * Posts the audit comment to the work item's Discussion thread. Returns
 * the server's CommentResponse on success; throws an Error with `.status`
 * attached on non-ok responses (per adoFetch contract — apply.ts maps the
 * status into the D-11 friendly-message buckets).
 */
export async function postComment(
  workItemId: number,
  projectId: string,
  payload: AuditPayload,
): Promise<CommentResponse> {
  const text = humanText(payload);
  // Body is `{ text }` only — no `format` field. Per Plan 04-01 spike A1,
  // format:1 had ZERO effect on sentinel preservation; ADO defaults to
  // html and renders the plain-text body verbatim.
  const body = { text };
  const path = `/${encodeURIComponent(projectId)}/_apis/wit/workItems/${workItemId}/comments`;
  console.log(`${LOG_PREFIX} POST workItemId=${workItemId} payloadSp=${payload.sp}`);
  return adoFetch<CommentResponse>("POST", path, "7.0-preview.3", body);
}
