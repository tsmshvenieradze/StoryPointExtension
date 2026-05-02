// src/ado/bridge.ts
// Source: D-22, D-26 (CONTEXT.md); RESEARCH.md §Pitfall 3 (getFieldValue
// returns Promise<Object> at runtime — never trust the typed signature).
//
// Single SDK boundary for the modal. Every IWorkItemFormService.getFieldValue
// call coerces the runtime value defensively:
//   - number coercion via Number() + Number.isFinite
//   - string coercion via typeof guard
// Failures resolve to safe sentinels (null / "") instead of throwing.
// The orchestrator (CalcModal) catches and renders the appropriate banner.
import * as SDK from "azure-devops-extension-sdk";
import type { IWorkItemFormService } from "azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices";

// CommonServiceIds is declared as a `const enum` upstream; with our
// `isolatedModules: true` tsconfig we cannot access const-enum members at
// runtime. Use the string literal directly — value verified in
// node_modules/azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices.d.ts
// (declare enum WorkItemTrackingServiceIds { WorkItemFormService = "ms.vss-work-web.work-item-form" }).
const WORK_ITEM_FORM_SERVICE_ID = "ms.vss-work-web.work-item-form";
const LOG_PREFIX = "[sp-calc/bridge]";

/** Acquires the form service handle. Resolves after SDK.ready(). */
export async function getFormService(): Promise<IWorkItemFormService> {
  return SDK.getService<IWorkItemFormService>(WORK_ITEM_FORM_SERVICE_ID);
}

/**
 * Reads the resolved SP field's current value. Returns null when the
 * field is unset or when the SDK rejects (D-26).
 *
 * Coercion path: raw → Number(raw) → finite check. ADO returns numeric
 * fields as either number or numeric string at runtime depending on
 * process; Number() handles both. Empty/null/undefined coerce to NaN
 * which Number.isFinite rejects.
 */
export async function getCurrentSpValue(
  formService: IWorkItemFormService,
  refName: string,
): Promise<number | null> {
  try {
    const raw = await formService.getFieldValue(refName);
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  } catch (err) {
    console.warn(`${LOG_PREFIX} getFieldValue(${refName}) failed`, err);
    return null;
  }
}

/**
 * Reads System.Title for the context line (D-03). Returns "" on any
 * failure or non-string runtime value — context line still renders.
 */
export async function getWorkItemTitle(
  formService: IWorkItemFormService,
): Promise<string> {
  try {
    const raw = await formService.getFieldValue("System.Title");
    return typeof raw === "string" ? raw : "";
  } catch (err) {
    console.warn(`${LOG_PREFIX} getFieldValue(System.Title) failed`, err);
    return "";
  }
}

/**
 * Reads System.WorkItemType — required by FieldResolver's cache key
 * (FIELD-03). Empty string fallback drives the cache to a "unknown"
 * partition that re-probes on next call (acceptable degradation).
 */
export async function getWorkItemTypeName(
  formService: IWorkItemFormService,
): Promise<string> {
  try {
    const raw = await formService.getFieldValue("System.WorkItemType");
    return typeof raw === "string" ? raw : "";
  } catch (err) {
    console.warn(`${LOG_PREFIX} getFieldValue(System.WorkItemType) failed`, err);
    return "";
  }
}

/**
 * Project id for FieldResolver cache key + comments REST call.
 * Synchronous — SDK.getWebContext() is populated by the time SDK.ready()
 * resolves.
 */
export function getProjectId(): string {
  return SDK.getWebContext().project.id;
}

/**
 * Probe whether the current work item is read-only (Stakeholder license,
 * area-path lock, closed state, rule-locked). Source: D-05, D-07
 * (Phase 4 CONTEXT.md); Plan 04-01 spike A3 verdict.
 *
 * Spike A3 verdict: LAZY-FALLBACK-ONLY — none of the four probe
 * candidates yielded a usable upfront read-only signal:
 *   (a) `formService.isReadOnly()` — method does not exist on the form
 *       service (returns undefined when optional-chained).
 *   (b) `getFieldValue('System.AuthorizedAs')` — returns identity but
 *       not a permission signal.
 *   (c) self-`setFieldValue` of current value — returns true and
 *       `isDirty=false` in the writable case; behavior on a truly
 *       read-only fixture is unverified, and `formService.reset()` had
 *       unexpected behavior.
 *   (d) `SDK.getUser()` — exposes only descriptor/id/name/displayName/
 *       imageUrl; NO `subjectKind` or `licenseRights` field — cannot
 *       gate by license tier.
 *
 * Action: D-07 lazy-fallback path — never assert read-only upfront.
 * Always return `{ isReadOnly: false, probeFailed: true }`. The apply
 * orchestrator (Plan 04-05) catches errors from setFieldValue/save and
 * surfaces them via FieldFailBanner / friendlyMessageForStatus.
 *
 * NEVER throws — defensive coercion pattern from getCurrentSpValue.
 * The unused `formService` parameter is retained so the signature is
 * stable for a future spike that might find a working probe.
 */
export async function getIsReadOnly(
  _formService: IWorkItemFormService,
): Promise<{ isReadOnly: boolean; probeFailed: boolean }> {
  // Per Spike A3 verdict (LAZY-FALLBACK-ONLY) — see header. The
  // try/catch wraps a no-op for now so a future spike-validated probe
  // can be inserted without changing call sites or rewriting error
  // handling.
  try {
    return { isReadOnly: false, probeFailed: true };
  } catch (err) {
    console.warn(`${LOG_PREFIX} getIsReadOnly probe failed`, err);
    return { isReadOnly: false, probeFailed: true }; // D-07 default: writable on probe failure
  }
}
