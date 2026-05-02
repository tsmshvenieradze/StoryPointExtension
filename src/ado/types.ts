// src/ado/types.ts
// Source: D-11 in CONTEXT.md.
// Phase 3 expands this with FieldResolver types and CalcSpModalResult.

/**
 * Configuration payload passed from the toolbar action to the modal dialog
 * via HostPageLayoutService.openCustomDialog's options.configuration.
 *
 * The host serializes this object via postMessage; only JSON-safe values
 * survive the round trip — no functions, no Map/Set, no circular refs.
 */
export type CalcSpModalConfig = {
  workItemId: number;
};
