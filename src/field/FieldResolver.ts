// src/field/FieldResolver.ts
// Source: D-16, D-18, D-20, D-21 (CONTEXT.md); FIELD-01..03 + the
// refined FIELD-04 (REQUIREMENTS.md after D-17 rewrite).
//
// Verified IWorkItemFormService.getFields shape against
//   node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts
// and WorkItemField shape against
//   node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTracking.d.ts
// (both shipped with azure-devops-extension-api@4.270.0).
//
// SDK boundary discipline: this module imports IWorkItemFormService as a
// TYPE only, never as a runtime value. Callers (src/ui/CalcModal.tsx via
// src/ado/bridge.ts) inject the live form service. Tests inject a
// hand-rolled fake — no SDK mock needed.
import type { IWorkItemFormService } from "azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices";
import type { ResolvedField } from "../ado/types";

const STORY_POINTS = "Microsoft.VSTS.Scheduling.StoryPoints" as const;
const SIZE = "Microsoft.VSTS.Scheduling.Size" as const;
const LOG_PREFIX = "[sp-calc/field]";

/**
 * Module-level cache (D-18). Key: `${projectId}|${workItemTypeName}`.
 * Lifetime: JS module evaluation = iframe lifetime. The host destroys
 * + recreates the modal iframe per openCustomDialog call (verified
 * Phase 2), so this cache effectively spans one dialog open.
 */
const CACHE: Map<string, ResolvedField> = new Map();

export interface ResolveArgs {
  formService: Pick<IWorkItemFormService, "getFields">;
  projectId: string;
  workItemTypeName: string;
}

/**
 * Probes the work item type's field list and returns the resolved SP
 * field reference name. Priority order: Microsoft.VSTS.Scheduling.StoryPoints,
 * then Microsoft.VSTS.Scheduling.Size, otherwise null.
 *
 * Failure mode (D-20): when getFields() rejects, returns StoryPoints
 * as the most-common default. The eventual write in Phase 4 surfaces
 * a clearer "field not defined" error if this guess turns out wrong.
 */
export async function resolve(args: ResolveArgs): Promise<ResolvedField> {
  const key = `${args.projectId}|${args.workItemTypeName}`;
  if (CACHE.has(key)) {
    return CACHE.get(key)!;
  }

  let resolved: ResolvedField;
  try {
    const fields = await args.formService.getFields();
    // Defensive: filter soft-deleted variants — explicit-deletion semantics
    // (a missing/undefined property is treated as live), mirroring
    // src/audit/parseLatest.ts:7. Fields where isDeleted is undefined or
    // false are kept; only the explicitly-deleted entries are dropped.
    const liveRefNames = new Set(
      fields.filter((f) => f.isDeleted !== true).map((f) => f.referenceName),
    );
    if (liveRefNames.has(STORY_POINTS)) {
      resolved = STORY_POINTS;
    } else if (liveRefNames.has(SIZE)) {
      resolved = SIZE;
    } else {
      resolved = null;
    }
  } catch (err) {
    // D-20: default to StoryPoints when getFields() throws/rejects.
    console.warn(`${LOG_PREFIX} getFields() failed; defaulting to StoryPoints`, err);
    resolved = STORY_POINTS;
  }

  CACHE.set(key, resolved);
  return resolved;
}

/**
 * Test-only helper. NOT re-exported from src/field/index.ts. Tests
 * import this directly from `../../src/field/FieldResolver` to reset
 * the module-level cache between cases.
 */
export function _resetCacheForTests(): void {
  CACHE.clear();
}
