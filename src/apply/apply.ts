// src/apply/apply.ts — Source: D-12, D-15, D-20 (Phase 4 CONTEXT.md);
//   D-01, D-04 (Phase 0 CONTEXT.md atomicity); APPLY-05, APPLY-06,
//   APPLY-07, APPLY-08 (REQUIREMENTS.md); RESEARCH §Pattern 3,
//   §Pitfall 6.
//
// Two-leg orchestrator. Comment-first → field-write per Phase 0 D-01.
// Throws typed ApplyError on failure for the orchestrator (CalcModal)
// to translate into D-08 / D-09 banner state.
//
// Replaces stubApply.ts per CONTEXT D-12. The ApplyInput shape
// (`{ c, u, e, fieldRefName }`) is preserved verbatim from
// stubApply.ts so CalcModal's call site is a one-line swap.
//
// Pitfall 6 (RESEARCH §Pitfall 6): IWorkItemFormService.setFieldValue
// returns Promise<boolean>. A `false` return means SDK validation
// rejected the write (rule violation, locked field, etc.) — this is
// mapped to the 412 bucket and `.save()` is NOT called. Without this
// check the orchestrator would call .save() on an already-rejected
// in-memory state.
//
// Plan 04-01 spike A1 verdict (STRIPPED-FALLBACK): postComment.ts owns
// the human-readable text; apply.ts just forwards (workItemId,
// projectId, payload). No sentinel construction here.
//
// Plan 04-01 spike A4 verdict (NO-PROGRAMMATIC-CLOSE): no SDK close
// call after success. The CalcModal saved-state branch handles the
// 200ms ✓ flash + persistent saved view.
import type { IWorkItemFormService } from "azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices";
import { calculate, type Level } from "../calc";
import type { AuditPayload } from "../audit";
import { postComment } from "../ado";
import { friendlyMessageForStatus, mapSdkErrorToStatus } from "./errorMessages";

const LOG_PREFIX = "[sp-calc/apply]";

/**
 * The bridge layer's ResolvedField type is "StoryPoints" | "Size" | null.
 * applyToWorkItem only ever runs when a field is resolved (the Apply
 * button is disabled in the no-field branch by virtue of the no-field
 * replacement UI). So we accept just the two non-null literals.
 *
 * Preserved verbatim from stubApply.ts per CONTEXT D-12.
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

/**
 * Typed-error shape thrown by applyToWorkItem on either leg's failure.
 * The orchestrator (CalcModal) discriminates on `leg` to render
 * CommentFailBanner (D-08) or FieldFailBanner (D-09).
 *
 * `status` is the HTTP status code for the comment leg (set by adoFetch
 * via .status on the Error) or the SDK-error → status discriminator
 * (per D-20 / mapSdkErrorToStatus) for the field leg. `null` = generic
 * fallback ("Could not save.").
 *
 * `sdkErrorClass` is set only on field-leg SDK rejections (Error
 * subclass — preserves the runtime class name for triage in the
 * D-09 httpOrSdkLabel; see UI-SPEC line 408).
 *
 * `message` is the user-visible string from friendlyMessageForStatus
 * (with optional invalid-fields suffix on the Pitfall 6 false-return
 * branch).
 */
export type ApplyError = {
  leg: "comment" | "field";
  status: number | null;
  sdkErrorClass?: string;
  message: string;
};

/**
 * Two-leg apply orchestrator. Phase 0 D-01 atomicity contract:
 *   1. POST audit comment to Discussion (`postComment`).
 *   2. ONLY IF comment succeeded: write Story Points field
 *      (`setFieldValue` + `.save()`).
 *
 * Honors `options.skipCommentLeg` for the D-09 Retry path (FieldFailBanner
 * Retry button) — the comment is already in the audit log, so we re-run
 * ONLY the field write to avoid duplicate audit entries.
 *
 * Resolves `void` on success. Rejects with `ApplyError` on either leg
 * failure (CalcModal catches and dispatches to commentFail / fieldFail
 * mode).
 */
export async function applyToWorkItem(
  input: ApplyInput,
  workItemId: number,
  projectId: string,
  formService: IWorkItemFormService,
  options?: { skipCommentLeg?: boolean },
): Promise<void> {
  const calcResult = calculate({ c: input.c, u: input.u, e: input.e });
  const payload: AuditPayload = {
    sp: calcResult.sp,
    c: input.c,
    u: input.u,
    e: input.e,
    schemaVersion: 1,
  };

  // LEG 1 — Comment POST. Skipped on D-09 Retry per options.skipCommentLeg.
  if (!options?.skipCommentLeg) {
    console.log(
      `${LOG_PREFIX} postComment start fieldRefName=${input.fieldRefName} payloadSp=${payload.sp}`,
    );
    try {
      const resp = await postComment(workItemId, projectId, payload);
      console.log(`${LOG_PREFIX} postComment ok commentId=${resp.id ?? resp.commentId}`);
    } catch (err) {
      const status =
        (err as Error & { status?: number })?.status ?? null;
      const message = friendlyMessageForStatus(status);
      console.log(
        `${LOG_PREFIX} postComment failed status=${status} message=${message}`,
      );
      const applyError: ApplyError = {
        leg: "comment",
        status,
        message,
      };
      throw applyError;
    }
  }

  // LEG 2 — Field write + save. Always runs (whether on first apply or
  // D-09 Retry). Pitfall 6: setFieldValue returns Promise<boolean>;
  // false means SDK rule rejection — map to 412 and skip .save().
  console.log(
    `${LOG_PREFIX} setFieldValue start refName=${input.fieldRefName} value=${calcResult.sp}`,
  );
  try {
    const ok = await formService.setFieldValue(input.fieldRefName, calcResult.sp);
    if (!ok) {
      // Pitfall 6: false return = SDK validation rejected. Treat as 412.
      // Best-effort triage: list invalid fields if SDK exposes them.
      const invalid = await formService.getInvalidFields().catch(() => []);
      const baseMsg = friendlyMessageForStatus(412);
      const invalidNames = invalid
        .map((f: { referenceName?: string }) => f.referenceName ?? "")
        .filter((n: string) => n.length > 0);
      const message =
        invalidNames.length > 0
          ? `${baseMsg} (${invalidNames.join(", ")})`
          : baseMsg;
      console.log(
        `${LOG_PREFIX} setFieldValue rejected by validation; invalid=${invalidNames.join(",")}`,
      );
      const applyError: ApplyError = {
        leg: "field",
        status: 412,
        message,
      };
      throw applyError;
    }
    await formService.save();
    console.log(`${LOG_PREFIX} both writes succeeded`);
  } catch (err) {
    // If the error is already a typed ApplyError (from the !ok branch
    // above), re-throw without re-wrapping.
    if (err && typeof err === "object" && "leg" in (err as object)) {
      throw err;
    }
    // Otherwise, it's an SDK rejection from setFieldValue or .save().
    const { status, sdkErrorClass } = mapSdkErrorToStatus(err);
    const message = friendlyMessageForStatus(status);
    // Diagnostic dump (Plan 04-06 fix-back): when status === null + sdkClass
    // === undefined, the SDK rejected with something we can't classify. Log
    // the raw err so cezari runs surface what ADO is actually throwing —
    // future regex updates to mapSdkErrorToStatus can target the empirical
    // shape rather than guess.
    console.log(
      `${LOG_PREFIX} setFieldValue/save failed sdkClass=${sdkErrorClass} status=${status} message=${message}`,
      { rawError: err, errType: typeof err, errIsError: err instanceof Error, errName: (err as { name?: string })?.name, errMessage: (err as { message?: string })?.message },
    );
    const applyError: ApplyError = {
      leg: "field",
      status,
      message,
      ...(sdkErrorClass !== undefined ? { sdkErrorClass } : {}),
    };
    throw applyError;
  }
}
