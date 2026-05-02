// src/apply/index.ts — Source: D-12 (Phase 3 + Phase 4 CONTEXT.md), D-11, D-20.
// Public API for the apply layer. Plan 04-05: the Phase 3 stub is replaced
// with the real apply.ts orchestrator; barrel updated. CalcModal imports
// applyToWorkItem + ApplyError from "../apply". errorMessages helpers are
// re-exported here so banner components (CommentFailBanner / FieldFailBanner)
// and the orchestrator can import from "../apply" without reaching into
// errorMessages.ts directly.
export { applyToWorkItem } from "./apply";
export type { ApplyInput, AppliableFieldRef, ApplyError } from "./apply";
export { friendlyMessageForStatus, mapSdkErrorToStatus } from "./errorMessages";
