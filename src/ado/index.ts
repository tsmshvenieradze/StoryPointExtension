// src/ado/index.ts — Source: D-22 (CONTEXT.md) public API for the bridge layer.
// Phase 3 callers import from `../ado` only — never reach into `bridge.ts`,
// `comments.ts`, or `types.ts` directly. ModernCommentsClient is intentionally
// NOT re-exported (file-private implementation detail per RESEARCH §Pattern 2).
export {
  getFormService,
  getCurrentSpValue,
  getWorkItemTitle,
  getWorkItemTypeName,
  getProjectId,
} from "./bridge";
export { fetchCommentsForRead } from "./comments";
export type {
  CalcSpModalConfig,
  ResolvedField,
  WorkItemContext,
  CalcSpReadResult,
} from "./types";
