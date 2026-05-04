// src/ui/CalcModal.tsx — Source: D-01, D-03, D-04, D-05, D-06, D-07, D-08,
//   D-09, D-10, D-12, D-14, D-15, D-19, D-20, D-24, D-25, D-26, D-27, D-28
//   (CONTEXT.md); UI-03..UI-08, APPLY-01..APPLY-09 (REQUIREMENTS.md);
//   UI-SPEC §View-State Machine, §Layout, §Loading & State Sequence,
//   §ButtonGroup, §Accessibility, §Banner stack ordering;
//   RESEARCH §Pitfall 7 (Dropdown3 disabled + aria-hidden during saving;
//   pointer-events alone insufficient).
//
// Override 1 acknowledged: Apply + Cancel render in body ButtonGroup, NOT
//   the host dialog footer (no IDialogOptions footer-button API exists).
//   Cancel cannot programmatically close the host dialog — UX redundancy
//   per UI-05 literal text; the host's X / Esc / lightDismiss is the
//   actual close affordance.
// Override 2 acknowledged: comments come from src/ado/fetchCommentsForRead
//   (modern 7.1-preview.4) — already shaped as AdoComment[].
// Override 3 acknowledged: FieldResolver null → NoFieldMessage replaces
//   the calculator UI (REQUIREMENTS.md FIELD-04 rewritten to match).
//
// Plan 04-01 spike A3 verdict (LAZY-FALLBACK-ONLY): bridge.getIsReadOnly
//   always returns { isReadOnly: false, probeFailed: true }. CalcModal
//   SUPPRESSES PermissionWarnBanner when probeFailed=true && isReadOnly=false
//   (baseline path) — showing it on every modal open would be spurious. The
//   4th parallel-read leg still exists so a future probe-validated
//   isReadOnly:true case lights up the readonly branch (D-06) automatically.
//
// Plan 260504-cl1 reverses Phase 4 D-10 (NO-PROGRAMMATIC-CLOSE): Probe 3
// tested only SDK.notifyDialogResult / notifyDismiss / closeCustomDialog
// (none existed). The untested candidate — IGlobalMessagesService.closeDialog()
// at ms.vss-tfs-web.tfs-global-messages-service — is now wrapped by
// bridge.closeProgrammatically and wired into handleCancel, a 600ms
// post-Saved auto-close useEffect, and modal.tsx's iframe Escape listener.
// try/catch + diagnostic log = no regression if it doesn't work.
//
// Plan 04-01 Probe 4 (D-15): lightDismiss does NOT abort in-flight writes
//   (the iframe survives outside-click; deferred fetches continue). Plan 04-06
//   cezari verification (Scenario 1, 2026-05-02) showed `lightDismiss: false`
//   ALSO blocks Esc, leaving the user with no escape hatch — toolbar.tsx now
//   uses host default (true). In-modal interaction during `saving` is still
//   blocked by the 3-pronged Pitfall 7 mitigation below; if the user clicks
//   outside mid-saving the write still completes (only the saved-state ✓ is
//   missed — acceptable per Probe 4 evidence).
//
// RESEARCH Pitfall 7 mitigation (immutability guard during saving):
//   1. Dropdown3 receives `disabled={mode === "saving"}` (keyboard guard)
//   2. Body container has `aria-hidden="true"` during saving (a11y guard)
//   3. SavingOverlay covers body region with pointer-events: auto (mouse guard)
//   4. runApplySequence reads c/u/e at function entry — captured payload
import * as React from "react";
import { Surface, SurfaceBackground } from "azure-devops-ui/Surface";
import { Page as PageRaw } from "azure-devops-ui/Page";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";

import { calculate, LEVELS, type Level } from "../calc";
import { parseLatest } from "../audit";
import {
  getFormService,
  getCurrentSpValue,
  getWorkItemTitle,
  getWorkItemTypeName,
  getProjectId,
  fetchCommentsForRead,
  getIsReadOnly,
  closeProgrammatically,
  type CalcSpReadResult,
} from "../ado";
import { resolve as resolveField } from "../field";
import { applyToWorkItem, type ApplyError, type ApplyInput } from "../apply";

import { Dropdown3 } from "./Dropdown3";
import { CalcPanel } from "./CalcPanel";
import { PreFillBanner } from "./PreFillBanner";
import { ReadErrorBanner } from "./ReadErrorBanner";
import { FieldResolverFailBanner } from "./FieldResolverFailBanner";
import { NoFieldMessage } from "./NoFieldMessage";
import { ConfirmOverwritePanel } from "./ConfirmOverwritePanel";
import { ReadOnlyMessage } from "./ReadOnlyMessage";
import { PermissionWarnBanner } from "./PermissionWarnBanner";
import { CommentFailBanner } from "./CommentFailBanner";
import { FieldFailBanner } from "./FieldFailBanner";
import { SavingOverlay } from "./SavingOverlay";
import { SavedIndicator } from "./SavedIndicator";

// Stale-types narrowing — same fix Phase 2 used in src/entries/modal.tsx:28-30.
// azure-devops-ui's Page IPageProps does not declare `children` even though
// the runtime React.Component renders them. Type-only narrowing.
const Page = PageRaw as unknown as React.FC<
  React.ComponentProps<typeof PageRaw> & { children?: React.ReactNode }
>;

const LOG_PREFIX = "[sp-calc/modal]";

/**
 * Single source of truth for what's rendered. Per UI-SPEC §View-State
 * Machine. Direct mutations of mode are confined to handlers + the
 * read-path effect; no external code path can transition modes.
 */
type ModalMode =
  | "loading"      // Phase 3 D-24 — read path in flight
  | "calculator"   // Phase 3 default
  | "confirm"      // D-03 — overwrite confirmation panel
  | "saving"       // D-15 — in-flight write (Pitfall 7 mitigations on)
  | "saved"        // D-10 — 200ms ✓ then persistent saved view (A4 verdict)
  | "readonly"     // D-06 — replaces calculator with read-only message
  | "noField"      // Phase 3 D-19 — neither SP field present
  | "commentFail"  // D-08 — comment leg rejected; Retry available
  | "fieldFail";   // D-09 — field leg rejected; Retry runs only field write

/** Defensive: validate sentinel payload's c/u/e are valid Level strings (D-15). */
function isValidLevel(s: unknown): s is Level {
  return typeof s === "string" && (LEVELS as readonly string[]).includes(s);
}

interface Props {
  workItemId: number;
}

export const CalcModal: React.FC<Props> = ({ workItemId }) => {
  // Trio state — Level | undefined. UI-SPEC: no defaultValue (D-07).
  const [c, setC] = React.useState<Level | undefined>();
  const [u, setU] = React.useState<Level | undefined>();
  const [e, setE] = React.useState<Level | undefined>();

  // Read-path + state-machine state.
  const [mode, setMode] = React.useState<ModalMode>("loading");
  const [readResult, setReadResult] = React.useState<CalcSpReadResult | null>(null);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const [permissionWarnDismissed, setPermissionWarnDismissed] = React.useState(false);
  const [applyError, setApplyError] = React.useState<ApplyError | null>(null);

  // Cached form service handle — populated after read path; reused on
  // Apply / Retry. Stored in a ref so re-renders don't churn the SDK
  // service handle (the SDK is single-instance per iframe).
  const formServiceRef = React.useRef<unknown>(null);

  // Live calc result — recomputes only when the trio changes.
  const result = React.useMemo(() => {
    if (c === undefined || u === undefined || e === undefined) return null;
    return calculate({ c, u, e });
  }, [c, u, e]);

  const isAllSelected = c !== undefined && u !== undefined && e !== undefined;

  // Read path effect — D-24 sequence. Cancellation guard prevents state
  // updates after unmount (RESEARCH §Loading & State Sequence).
  React.useEffect(() => {
    let cancelled = false;
    console.log(`${LOG_PREFIX} read path: effect started`);
    (async () => {
      let fieldsRejected = false;
      let commentsRejected = false;

      try {
        console.log(`${LOG_PREFIX} read path: requesting work-item-form service`);
        const formService = await getFormService();
        console.log(`${LOG_PREFIX} read path: form service acquired`);

        const projectId = getProjectId();
        console.log(`${LOG_PREFIX} read path: projectId=${projectId}`);

        const workItemTypeName = await getWorkItemTypeName(formService);
        console.log(`${LOG_PREFIX} read path: workItemTypeName=${workItemTypeName}`);

        // FieldResolver — never rejects (D-20 default to StoryPoints
        // is internal). To surface the failure flag for the
        // FieldResolverFailBanner, pre-call formService.getFields()
        // once with a try/catch; FieldResolver's own cache makes the
        // second call O(1).
        try {
          await formService.getFields();
          console.log(`${LOG_PREFIX} read path: getFields probe ok`);
        } catch (err) {
          console.warn(`${LOG_PREFIX} getFields probe failed`, err);
          fieldsRejected = true;
        }

        const resolvedField = await resolveField({
          formService,
          projectId,
          workItemTypeName,
        });
        console.log(`${LOG_PREFIX} read path: resolved field`, resolvedField);

        // If neither field is present, render the no-field UI; skip the
        // rest of the read path (we can't show a current SP for a
        // nonexistent field). Per UI-SPEC line 88: noField branch first.
        if (resolvedField === null) {
          if (!cancelled) {
            setReadResult({
              resolvedField: null,
              context: { workItemId, workItemTypeName, title: "", currentSp: null },
              comments: [],
              prefill: null,
              errors: { fieldsRejected, commentsRejected: false },
              permission: { isReadOnly: false, probeFailed: false },
            });
            formServiceRef.current = formService;
            setMode("noField");
          }
          return;
        }

        // Parallel reads for the remaining values. Per-promise logging
        // pinpoints which leg hangs when verification stalls (03-04 finding).
        // Plan 04-05 adds the 4th leg: getIsReadOnly (D-05/D-07; spike A3).
        console.log(`${LOG_PREFIX} read path: starting parallel reads`);
        const titleP = getWorkItemTitle(formService).then((v) => {
          console.log(`${LOG_PREFIX} read path: title done`, v);
          return v;
        });
        const spP = getCurrentSpValue(formService, resolvedField).then((v) => {
          console.log(`${LOG_PREFIX} read path: currentSp done`, v);
          return v;
        });
        const commentsP = fetchCommentsForRead(workItemId, projectId)
          .then((v) => {
            console.log(`${LOG_PREFIX} read path: comments done`, v.length);
            return v;
          })
          .catch((err) => {
            console.warn(`${LOG_PREFIX} getCommentsModern failed`, err);
            commentsRejected = true;
            return [] as Awaited<ReturnType<typeof fetchCommentsForRead>>;
          });
        const permissionP = getIsReadOnly(formService).then((v) => {
          console.log(`${LOG_PREFIX} read path: isReadOnly done`, v);
          return v;
        });
        const [title, currentSp, comments, permission] = await Promise.all([titleP, spP, commentsP, permissionP]);
        console.log(`${LOG_PREFIX} read path: parallel reads done`, {
          title,
          currentSp,
          commentCount: comments.length,
          permission,
        });

        if (cancelled) return;

        // Pre-fill probe (APPLY-03). parseLatest never throws (AUDIT-04).
        // Diagnostic dump (03-04 cezari): show raw comment payload + parseLatest
        // result so we can see whether ADO stripped the HTML sentinel comment.
        console.log(`${LOG_PREFIX} read path: comment dump`,
          comments.map((cm) => ({
            id: cm.id,
            isDeleted: cm.isDeleted,
            createdDate: cm.createdDate,
            textPreview: typeof cm.text === "string" ? cm.text.slice(0, 240) : cm.text,
          })),
        );
        const prefill = parseLatest(comments);
        console.log(`${LOG_PREFIX} read path: parseLatest result`, prefill);
        const validPrefill =
          prefill !== null &&
          isValidLevel(prefill.c) &&
          isValidLevel(prefill.u) &&
          isValidLevel(prefill.e)
            ? prefill
            : null;

        if (!validPrefill && prefill !== null) {
          console.warn(`${LOG_PREFIX} prefill payload had invalid levels`, prefill);
        }

        setReadResult({
          resolvedField,
          context: { workItemId, workItemTypeName, title, currentSp },
          comments,
          prefill: validPrefill,
          errors: { fieldsRejected, commentsRejected },
          permission,
        });

        // Pre-fill the trio (D-12).
        if (validPrefill) {
          setC(validPrefill.c);
          setU(validPrefill.u);
          setE(validPrefill.e);
        }

        // Cache the form service for the Apply handler.
        formServiceRef.current = formService;

        // Mode transition per UI-SPEC §View-State Machine lines 88-90:
        //   noField check first (handled above), then readOnly probe,
        //   then default to calculator.
        if (permission.isReadOnly) {
          console.log(`${LOG_PREFIX} permission.isReadOnly true → readonly mode`);
          setMode("readonly");
        } else {
          setMode("calculator");
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} read path failed`, err);
        // Read path catastrophically failed; show empty calculator.
        // The user can still calculate manually. No banner — readResult
        // stays null which suppresses the banner stack entirely.
        if (!cancelled) {
          setMode("calculator");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workItemId]);

  // Post-Saved auto-close (Plan 260504-cl1). 600ms = SavedIndicator's 200ms ✓
  // flash + 400ms breathing room so the user perceives "saved" before the modal
  // disappears. If closeProgrammatically returns false, the modal stays open in
  // saved mode (current v1.0.3 behavior — no regression).
  React.useEffect(() => {
    if (mode !== "saved") return;
    const timeoutId = window.setTimeout(() => {
      void closeProgrammatically();
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [mode]);

  // Cross-component handshake for the iframe Esc listener in modal.tsx —
  // routes the saving-state discriminator without prop-drilling. The
  // listener checks document.body.dataset.spcSaving === "true" before
  // calling closeProgrammatically (Pitfall 7 immutability guard).
  React.useEffect(() => {
    if (mode === "saving") {
      document.body.dataset.spcSaving = "true";
    } else {
      delete document.body.dataset.spcSaving;
    }
    return () => {
      delete document.body.dataset.spcSaving;
    };
  }, [mode]);

  // ---------------------------------------------------------------------
  // Mode-replacement branches — these REPLACE the entire body wholesale
  // (no banner stack, no calculator, no ButtonGroup). Per UI-SPEC mounting
  // rules lines 104-106: noField + readonly hide everything except the
  // Header + (in readonly) the context line.
  // ---------------------------------------------------------------------

  // No-field branch — REPLACES the entire calculator UI (D-19).
  if (mode === "noField") {
    return (
      <Surface background={SurfaceBackground.normal}>
        <Page className="flex-grow">
          <Header title="Calculate Story Points" titleSize={TitleSize.Medium} />
          <div className="page-content page-content-top">
            <NoFieldMessage typeName={readResult?.context.workItemTypeName || "(unknown)"} />
          </div>
        </Page>
      </Surface>
    );
  }

  // Context line text (D-03). Computed once for reuse across all
  // remaining mode branches.
  const ctx = readResult?.context;
  const titleStr = ctx?.title ?? "";
  const currentSpStr =
    ctx && ctx.currentSp !== null && ctx.currentSp !== undefined
      ? String(ctx.currentSp)
      : "—";
  // U+00B7 middle-dot for separators.
  const contextLine = ctx
    ? `Work item #${ctx.workItemId} · "${titleStr}" · Current Story Points: ${currentSpStr}`
    : `Work item #${workItemId}`;

  // Read-only branch — REPLACES the calculator UI (D-06). Per UI-SPEC
  // line 89: short-circuits AFTER the noField branch.
  if (mode === "readonly") {
    return (
      <Surface background={SurfaceBackground.normal}>
        <Page className="flex-grow">
          <Header title="Calculate Story Points" titleSize={TitleSize.Medium} />
          <div className="page-content page-content-top">
            <div style={{ fontSize: "13px", opacity: 0.7, marginBottom: 8 }}>
              {contextLine}
            </div>
            <ReadOnlyMessage />
          </div>
        </Page>
      </Surface>
    );
  }

  // Pre-fill banner mismatch detection (D-14).
  const sentinelSp = readResult?.prefill?.sp;
  const currentSp = ctx?.currentSp;
  const mismatchSp =
    readResult?.prefill !== null &&
    readResult?.prefill !== undefined &&
    currentSp !== null &&
    currentSp !== undefined &&
    sentinelSp !== currentSp
      ? currentSp
      : null;

  // ---------------------------------------------------------------------
  // Apply / Confirm / Cancel / Retry handlers
  // ---------------------------------------------------------------------

  // Single source of truth for the saving sequence. Called from Apply
  // (no-prior-SP), Confirm Apply, and both Retry paths. Honors
  // options.skipCommentLeg for D-09 (FieldFailBanner Retry runs only
  // the field write; comment intentionally kept).
  //
  // RESEARCH Pitfall 7 immutability guard: reads c/u/e at function entry
  // — the captured payload is fixed for the duration of this call. Even
  // if a tab leak somehow lets the user change a dropdown during saving,
  // the in-flight call carries the original trio.
  const runApplySequence = async (options: { skipCommentLeg: boolean }) => {
    if (!isAllSelected || !readResult || readResult.resolvedField === null) return;
    const fs = formServiceRef.current;
    if (!fs) {
      console.warn(`${LOG_PREFIX} apply skipped: form service not yet cached`);
      return;
    }
    const input: ApplyInput = {
      c: c!,
      u: u!,
      e: e!,
      fieldRefName: readResult.resolvedField,
    };
    const projectId = getProjectId();
    console.log(`${LOG_PREFIX} apply sequence start mode=${mode} skipCommentLeg=${options.skipCommentLeg}`);
    setMode("saving");
    setApplyError(null);
    try {
      // Cast at the SDK boundary — the form service is typed at the
      // bridge layer (getFormService returns IWorkItemFormService); we
      // store as `unknown` in the ref to avoid leaking SDK types into
      // every render's type graph.
      await applyToWorkItem(input, workItemId, projectId, fs as never, options);
      console.log(`${LOG_PREFIX} apply sequence ok`);
      setMode("saved");
    } catch (err) {
      const ae = err as ApplyError;
      console.warn(`${LOG_PREFIX} apply sequence failed`, ae);
      setApplyError(ae);
      if (ae.leg === "comment") {
        setMode("commentFail");
      } else {
        setMode("fieldFail");
      }
    }
  };

  const handleApplyClick = () => {
    if (!isAllSelected || !readResult || readResult.resolvedField === null) return;
    // D-04 trigger threshold: confirm panel iff currentSp != null.
    const cur = readResult.context.currentSp;
    if (cur != null && Number.isFinite(cur)) {
      console.log(`${LOG_PREFIX} apply click → confirm mode (currentSp=${cur})`);
      setMode("confirm");
      return;
    }
    // No prior SP — go directly to saving.
    void runApplySequence({ skipCommentLeg: false });
  };

  const handleConfirmApply = () => {
    void runApplySequence({ skipCommentLeg: false });
  };

  const handleBackFromConfirm = () => {
    setMode("calculator");
  };

  const handleCommentRetry = () => {
    // D-08: re-run comment POST with the SAME captured payload. The
    // dropdowns were disabled during saving (Pitfall 7 mitigation) so
    // c/u/e have not been mutated since the original click.
    void runApplySequence({ skipCommentLeg: false });
  };

  const handleFieldRetry = () => {
    // D-09: re-run ONLY the field write; comment kept (already in audit log).
    void runApplySequence({ skipCommentLeg: true });
  };

  const handleCancel = async () => {
    // Plan 260504-cl1: spike-as-ship — try IGlobalMessagesService.closeDialog()
    // (untested by Plan 04-01 Probe 3). If it returns false (threw or method
    // missing), fall back to D-10 carry-forward log so the user understands
    // why the modal stayed open. Outside-click / X still work.
    console.log(`${LOG_PREFIX} cancel clicked → closeProgrammatically`);
    const closed = await closeProgrammatically();
    if (!closed) {
      console.log(`${LOG_PREFIX} programmatic close returned false — host close affordance required`);
    }
  };

  // ---------------------------------------------------------------------
  // Body rendering for non-replacement modes (loading | calculator |
  // confirm | saving | saved | commentFail | fieldFail). All share the
  // same Surface/Page/Header/context-line/banner-stack chrome.
  // ---------------------------------------------------------------------

  // FieldFailBanner httpOrSdkLabel computation (per UI-SPEC line 408).
  // Examples: "HTTP 412", "HTTP 403", "SDK error: RuleValidationException", "HTTP n/a"
  let httpOrSdkLabel = "";
  if (applyError?.leg === "field") {
    if (applyError.status !== null) {
      httpOrSdkLabel = `HTTP ${applyError.status}`;
    } else if (applyError.sdkErrorClass !== undefined) {
      httpOrSdkLabel = `SDK error: ${applyError.sdkErrorClass}`;
    } else {
      httpOrSdkLabel = "HTTP n/a";
    }
  }

  // Saving / saved disable-state predicates (used widely below).
  const isSaving = mode === "saving";
  const isSaved = mode === "saved";
  const isFailMode = mode === "commentFail" || mode === "fieldFail";

  // Body container during saving needs `position: relative` so the
  // SavingOverlay's `inset: 0` resolves; aria-hidden=true announces
  // "no interactive content" to screen readers (RESEARCH Pitfall 7).
  const bodyContainerStyle: React.CSSProperties = {
    minHeight: 380,
    position: isSaving ? "relative" : undefined,
  };

  // The pre-fill banner is HIDDEN in confirm mode per UI-SPEC line 124
  // (reduces noise during the confirm-overwrite step).
  const showPrefillBanner =
    !!readResult?.prefill && !bannerDismissed && mode !== "confirm";

  // Permission-warn banner — Plan 04-01 spike A3: SUPPRESS when probe
  // failed but isReadOnly is false (the baseline path; showing it
  // every modal open is spurious noise). Only show when probe says
  // "I tried and failed" AND we have no positive signal — which today
  // is functionally never true (getIsReadOnly always returns the
  // sentinel pair) but the slot stays so a future probe-validated
  // failure mode lights it up automatically.
  const showPermissionWarnBanner =
    !!readResult?.permission?.probeFailed &&
    readResult?.permission?.isReadOnly === false &&
    !permissionWarnDismissed &&
    // Spike A3 verdict: the bridge ALWAYS returns probeFailed=true in
    // the current implementation. To avoid spurious noise on every
    // modal open, suppress this banner unless a future probe iteration
    // sets it differently. The slot is reserved structurally so the
    // banner-stack ordering (UI-SPEC line 268) is honored.
    false;

  return (
    <Surface background={SurfaceBackground.normal}>
      <Page className="flex-grow">
        <Header
          title="Calculate Story Points"
          titleSize={TitleSize.Medium}
        />
        <div
          className="page-content page-content-top"
          style={bodyContainerStyle}
          aria-hidden={isSaving ? "true" : undefined}
          aria-busy={isSaving ? "true" : undefined}
        >
          <div style={{ fontSize: "13px", opacity: 0.7, marginBottom: 8 }}>
            {mode === "loading" ? "Loading…" : contextLine}
          </div>

          {mode === "loading" && (
            <div style={{ marginBottom: 16 }}>
              <Spinner
                size={SpinnerSize.medium}
                ariaLabel="Loading prior calculation"
              />
            </div>
          )}

          {/* Banner stack — UI-SPEC §"Updated banner stack ordering" line 268.
              ORDER: 1 resolver-fail → 2 read-error → 3 permission-warn → 4 pre-fill.
              The four banner-stack markers below are the load-bearing structural
              assertion that the verifier (Plan 04-06 / Plan 04-05 acceptance) greps
              against. Do NOT renumber, omit, or reorder. */}

          {/* BANNER-STACK-1-RESOLVER */}
          {readResult?.errors.fieldsRejected && <FieldResolverFailBanner />}

          {/* BANNER-STACK-2-READ-ERROR */}
          {readResult?.errors.commentsRejected && <ReadErrorBanner />}

          {/* BANNER-STACK-3-PERMISSION */}
          {showPermissionWarnBanner && (
            <PermissionWarnBanner
              onDismiss={() => setPermissionWarnDismissed(true)}
            />
          )}

          {/* BANNER-STACK-4-PREFILL */}
          {showPrefillBanner && readResult?.prefill && (
            <PreFillBanner
              dateIso={
                readResult.comments
                  .filter((cm) => cm.isDeleted !== true)
                  .map((cm) => cm.createdDate)
                  .sort()
                  .reverse()[0] ?? new Date().toISOString()
              }
              mismatchSp={mismatchSp}
              onDismiss={() => setBannerDismissed(true)}
            />
          )}

          {/* Error banners — pinned ABOVE the body region (UI-SPEC line 232).
              Replace the bottom Apply/Cancel ButtonGroup with [Cancel] only;
              Retry lives inside the banner. */}
          {mode === "commentFail" && applyError && (
            <CommentFailBanner
              friendlyMessage={applyError.message}
              status={applyError.status}
              onRetry={handleCommentRetry}
            />
          )}
          {mode === "fieldFail" && applyError && (
            <FieldFailBanner
              friendlyMessage={applyError.message}
              httpOrSdkLabel={httpOrSdkLabel}
              onRetry={handleFieldRetry}
            />
          )}

          {/* Confirm-overwrite panel REPLACES the calculator body in confirm mode.
              Dropdowns + CalcPanel are unmounted (UI-SPEC line 105). */}
          {mode === "confirm" && readResult?.context.currentSp != null && result && (
            <ConfirmOverwritePanel
              currentSp={readResult.context.currentSp}
              newSp={result.sp}
              onBack={handleBackFromConfirm}
              onConfirm={handleConfirmApply}
              isSaving={false}
            />
          )}

          {/* Calculator body — rendered for: loading, calculator, saving,
              saved, commentFail, fieldFail. Hidden in confirm mode (the
              ConfirmOverwritePanel above replaces it). */}
          {mode !== "confirm" && (
            <>
              <div style={{ marginTop: 16 }}>
                <Dropdown3
                  label="Complexity"
                  ariaLabel="Complexity level"
                  value={c}
                  onChange={setC}
                  disabled={mode === "loading" || mode === "saving" || isSaved}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <Dropdown3
                  label="Uncertainty"
                  ariaLabel="Uncertainty level"
                  value={u}
                  onChange={setU}
                  disabled={mode === "loading" || mode === "saving" || isSaved}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <Dropdown3
                  label="Effort"
                  ariaLabel="Effort level"
                  value={e}
                  onChange={setE}
                  disabled={mode === "loading" || mode === "saving" || isSaved}
                />
              </div>

              <CalcPanel result={result} />
            </>
          )}

          {/* Bottom action row — content depends on mode. */}
          {isSaved ? (
            <SavedIndicator />
          ) : (
            <div
              style={{
                marginTop: 24,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              {mode === "confirm" ? (
                // ConfirmOverwritePanel owns its own ButtonGroup (Back / Confirm Apply).
                // No bottom ButtonGroup in confirm mode.
                null
              ) : isFailMode ? (
                // commentFail / fieldFail: ButtonGroup swapped to [Cancel] only.
                // Retry lives inside the error banner.
                <ButtonGroup>
                  <Button
                    text="Cancel"
                    onClick={handleCancel}
                    ariaLabel="Cancel and close dialog"
                  />
                </ButtonGroup>
              ) : (
                // Default: [Cancel] [Apply]. During saving, both are disabled
                // and Apply swaps label to "Saving…" with inline spinner.
                <ButtonGroup>
                  <Button
                    text="Cancel"
                    onClick={handleCancel}
                    disabled={isSaving}
                    ariaLabel="Cancel and close dialog"
                  />
                  <Button
                    text={isSaving ? "Saving…" : "Apply"}
                    primary={true}
                    onClick={handleApplyClick}
                    disabled={!isAllSelected || mode === "loading" || isSaving}
                    ariaLabel="Apply Story Points to work item"
                  />
                </ButtonGroup>
              )}
            </div>
          )}

          {!isSaved && !isFailMode && mode !== "saving" && (
            <p
              style={{
                fontSize: "11px",
                opacity: 0.5,
                marginTop: 8,
                textAlign: "right",
              }}
            >
              Press Esc or click outside to close.
            </p>
          )}

          {/* Saving overlay — RESEARCH Pitfall 7 mitigation (mouse guard).
              Sits inside the body container so its `inset: 0` resolves to
              the body region (Header + context-line stay unobstructed). */}
          {isSaving && <SavingOverlay />}
        </div>
      </Page>
    </Surface>
  );
};
