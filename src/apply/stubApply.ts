// src/apply/stubApply.ts — Source: D-27 (CONTEXT.md); UI-SPEC stub-Apply log format.
// Phase 4 will replace the body with the real write path in the
// comment-first → field-write order locked in Phase 0 PROJECT.md D-01.
// The input shape stays stable so Phase 4's swap is a one-file diff.
//
// Phase 3 stub: no field write, no comment POST, no REST calls, no dialog close.
// Just calculate + serialize + console.log the would-write line.
//
// Literal log line for verifier grep: [sp-calc/apply] would write SP=
import { calculate, type Level } from "../calc";
import { serialize, type AuditPayload } from "../audit";

const LOG_PREFIX = "[sp-calc/apply]";

/**
 * The bridge layer's ResolvedField type is "StoryPoints" | "Size" | null.
 * stubApply only ever runs when a field is resolved (the Apply button is
 * disabled in the no-field branch by virtue of the no-field replacement
 * UI). So we accept just the two non-null literals.
 */
export type AppliableFieldRef =
  | "Microsoft.VSTS.Scheduling.StoryPoints"
  | "Microsoft.VSTS.Scheduling.Size";

export interface ApplyInput {
  c: Level;
  u: Level;
  e: Level;
  fieldRefName: AppliableFieldRef;
}

export function stubApply(input: ApplyInput): void {
  const result = calculate({ c: input.c, u: input.u, e: input.e });
  const payload: AuditPayload = {
    sp: result.sp,
    c: input.c,
    u: input.u,
    e: input.e,
    schemaVersion: 1,
  };
  const comment = serialize(payload);
  console.log(
    `${LOG_PREFIX} would write SP=${result.sp}, fieldRefName=${input.fieldRefName}, comment=${comment}`,
  );
  // Phase 3 stub boundary: no real mutation; user closes via host X / Esc.
}
