// src/ado/index.ts — Source: D-22 (Phase 3 CONTEXT.md);
//   D-14, D-05, D-07 (Phase 4 CONTEXT.md). Public API for the bridge layer.
//
// Phase 3 callers import from `../ado` only — never reach into `bridge.ts`,
// `comments.ts`, `postComment.ts`, or `types.ts` directly. ModernCommentsClient
// is intentionally NOT re-exported (file-private implementation detail per
// RESEARCH §Pattern 2). adoFetch is also NOT re-exported — file-private per
// CONTEXT D-14 (callers go through comments.ts / postComment.ts wrappers).
//
// Plan 04-03 additions: postComment (write counterpart to fetchCommentsForRead)
// and getIsReadOnly (D-05/D-07 lazy-fallback probe).
export {
  getFormService,
  getCurrentSpValue,
  getWorkItemTitle,
  getWorkItemTypeName,
  getProjectId,
  getIsReadOnly,
} from "./bridge";
export { fetchCommentsForRead } from "./comments";
export { postComment } from "./postComment";
export type { CommentResponse } from "./postComment";
export type {
  CalcSpModalConfig,
  ResolvedField,
  WorkItemContext,
  CalcSpReadResult,
} from "./types";
