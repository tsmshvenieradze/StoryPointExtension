// src/apply/index.ts — Source: D-12 (Phase 3 CONTEXT.md), D-11, D-20 (Phase 4 CONTEXT.md).
// Public API for the apply layer. Plan 04-02 introduces this barrel so
// Plan 04-05's apply.ts (which replaces stubApply.ts's body) and Plan 04-04's
// banner components can import friendlyMessageForStatus / mapSdkErrorToStatus
// from "../apply" without reaching into errorMessages.ts directly.
//
// stubApply / ApplyInput / AppliableFieldRef are re-exported unchanged from
// Phase 3 (D-27 input-shape contract). Plan 04-05 will replace the
// stubApply re-export with applyToWorkItem and add ApplyError to this surface.
export { friendlyMessageForStatus, mapSdkErrorToStatus } from "./errorMessages";
export { stubApply } from "./stubApply";
export type { ApplyInput, AppliableFieldRef } from "./stubApply";
