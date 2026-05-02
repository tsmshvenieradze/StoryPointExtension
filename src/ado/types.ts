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

/**
 * Result of FieldResolver probe (Phase 3, Plan 2 — D-21).
 * Canonical home for the resolved Story Points field reference name shared
 * across the bridge layer and the FieldResolver module. Plan 1 (Wave 1)
 * extends this types file with additional read-path types; this single
 * type alias is added by Plan 2 because Plan 2's compile depends on it.
 * The literal value matches Plan 1's intended definition exactly so any
 * orchestrator-level merge collapses to a no-op.
 */
export type ResolvedField =
  | "Microsoft.VSTS.Scheduling.StoryPoints"
  | "Microsoft.VSTS.Scheduling.Size"
  | null;
