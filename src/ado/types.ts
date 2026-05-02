// src/ado/types.ts
// Source: D-11 in Phase 0 CONTEXT.md (CalcSpModalConfig); D-17, D-22 in Phase 3 CONTEXT.md (read-path types).
// Phase 3 expands this with FieldResolver result types and the aggregated
// read-path payload that <CalcModal> consumes.

import type { AuditPayload, AdoComment } from "../audit/types";

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
 * The reference name FieldResolver picks for this work item type.
 * - "Microsoft.VSTS.Scheduling.StoryPoints" — Agile, Scrum, Basic processes
 * - "Microsoft.VSTS.Scheduling.Size" — CMMI process (per FIELD-02)
 * - null — neither field present; modal renders the no-field message UI (D-19)
 */
export type ResolvedField =
  | "Microsoft.VSTS.Scheduling.StoryPoints"
  | "Microsoft.VSTS.Scheduling.Size"
  | null;

/**
 * Snapshot of work item context fetched at modal open (D-03 context line).
 * `currentSp` is null when the field is unset OR when getFieldValue rejects (D-26).
 */
export type WorkItemContext = {
  workItemId: number;
  workItemTypeName: string;       // from getFieldValue("System.WorkItemType")
  title: string;                  // from getFieldValue("System.Title"); "" on read failure
  currentSp: number | null;       // null when unset / coercion fails (D-26)
};

/**
 * Aggregated read-path result handed to <CalcModal>. Replaces three
 * scattered useStates with a single typed payload.
 *
 * `errors.fieldsRejected` — D-20 path: getFields() threw; resolver
 *   defaulted to StoryPoints; UI renders FieldResolver-fail Warning banner.
 * `errors.commentsRejected` — D-25 path: getCommentsModern() rejected;
 *   UI renders read-error Warning banner.
 */
export type CalcSpReadResult = {
  resolvedField: ResolvedField;
  context: WorkItemContext;
  comments: AdoComment[];        // empty array when commentsRejected
  prefill: AuditPayload | null;  // null when no sentinel found OR malformed (D-15)
  errors: {
    fieldsRejected: boolean;
    commentsRejected: boolean;
  };
};
