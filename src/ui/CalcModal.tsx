// src/ui/CalcModal.tsx — Source: D-01, D-03, D-04, D-05, D-12, D-14, D-15,
//   D-19, D-20, D-24, D-25, D-26, D-27, D-28 (CONTEXT.md);
//   UI-03, UI-04, UI-05, UI-07, UI-08, APPLY-01, APPLY-02, APPLY-03 (REQUIREMENTS.md);
//   UI-SPEC §Layout, §Loading & State Sequence, §ButtonGroup, §Accessibility.
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
  type CalcSpReadResult,
} from "../ado";
import { resolve as resolveField } from "../field";
import { stubApply } from "../apply/stubApply";

import { Dropdown3 } from "./Dropdown3";
import { CalcPanel } from "./CalcPanel";
import { PreFillBanner } from "./PreFillBanner";
import { ReadErrorBanner } from "./ReadErrorBanner";
import { FieldResolverFailBanner } from "./FieldResolverFailBanner";
import { NoFieldMessage } from "./NoFieldMessage";

// Stale-types narrowing — same fix Phase 2 used in src/entries/modal.tsx:28-30.
// azure-devops-ui's Page IPageProps does not declare `children` even though
// the runtime React.Component renders them. Type-only narrowing.
const Page = PageRaw as unknown as React.FC<
  React.ComponentProps<typeof PageRaw> & { children?: React.ReactNode }
>;

const LOG_PREFIX = "[sp-calc/modal]";

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

  // Read-path state.
  const [isLoading, setIsLoading] = React.useState(true);
  const [readResult, setReadResult] = React.useState<CalcSpReadResult | null>(null);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);

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
    (async () => {
      let fieldsRejected = false;
      let commentsRejected = false;

      try {
        const formService = await getFormService();
        const projectId = getProjectId();
        const workItemTypeName = await getWorkItemTypeName(formService);

        // FieldResolver — never rejects (D-20 default to StoryPoints
        // is internal). To surface the failure flag for the
        // FieldResolverFailBanner, pre-call formService.getFields()
        // once with a try/catch; FieldResolver's own cache makes the
        // second call O(1).
        try {
          await formService.getFields();
        } catch (err) {
          console.warn(`${LOG_PREFIX} getFields probe failed`, err);
          fieldsRejected = true;
        }

        const resolvedField = await resolveField({
          formService,
          projectId,
          workItemTypeName,
        });

        // If neither field is present, render the no-field UI; skip the
        // rest of the read path (we can't show a current SP for a
        // nonexistent field).
        if (resolvedField === null) {
          if (!cancelled) {
            setReadResult({
              resolvedField: null,
              context: { workItemId, workItemTypeName, title: "", currentSp: null },
              comments: [],
              prefill: null,
              errors: { fieldsRejected, commentsRejected: false },
            });
            setIsLoading(false);
          }
          return;
        }

        // Parallel reads for the remaining values.
        const [title, currentSp, comments] = await Promise.all([
          getWorkItemTitle(formService),
          getCurrentSpValue(formService, resolvedField),
          fetchCommentsForRead(workItemId, projectId).catch((err) => {
            console.warn(`${LOG_PREFIX} getCommentsModern failed`, err);
            commentsRejected = true;
            return [] as Awaited<ReturnType<typeof fetchCommentsForRead>>;
          }),
        ]);

        if (cancelled) return;

        // Pre-fill probe (APPLY-03). parseLatest never throws (AUDIT-04).
        const prefill = parseLatest(comments);
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
        });

        // Pre-fill the trio (D-12).
        if (validPrefill) {
          setC(validPrefill.c);
          setU(validPrefill.u);
          setE(validPrefill.e);
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} read path failed`, err);
        // Leave readResult as null + isLoading false — UI shows empty
        // calculator with no banner; the user can still calculate.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workItemId]);

  // No-field branch — REPLACES the entire calculator UI (D-19).
  if (readResult && readResult.resolvedField === null) {
    return (
      <Surface background={SurfaceBackground.neutral}>
        <Page className="flex-grow">
          <Header title="Calculate Story Points" titleSize={TitleSize.Medium} />
          <div className="page-content page-content-top">
            <NoFieldMessage typeName={readResult.context.workItemTypeName || "(unknown)"} />
          </div>
        </Page>
      </Surface>
    );
  }

  // Context line text (D-03).
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

  const handleApply = () => {
    if (!isAllSelected || !readResult || readResult.resolvedField === null) return;
    stubApply({
      c: c!,
      u: u!,
      e: e!,
      fieldRefName: readResult.resolvedField,
    });
  };

  const handleCancel = () => {
    // Cannot programmatically close (Override 1 / Anti-pattern 2). Logged
    // for verifier visibility; user uses host X / Esc / outside-click.
    console.log(`${LOG_PREFIX} cancel clicked — host close affordance required`);
  };

  return (
    <Surface background={SurfaceBackground.neutral}>
      <Page className="flex-grow">
        <Header
          title="Calculate Story Points"
          titleSize={TitleSize.Medium}
        />
        <div
          className="page-content page-content-top"
          style={{ minHeight: 380 }}
        >
          <div
            style={{ fontSize: "13px", opacity: 0.7, marginBottom: 8 }}
          >
            {isLoading ? "Loading…" : contextLine}
          </div>

          {isLoading && (
            <div style={{ marginBottom: 16 }}>
              <Spinner
                size={SpinnerSize.medium}
                ariaLabel="Loading prior calculation"
              />
            </div>
          )}

          {/* Banner stack: resolver-fail → read-error → pre-fill (UI-SPEC §FieldResolver-fail). */}
          {readResult?.errors.fieldsRejected && <FieldResolverFailBanner />}
          {readResult?.errors.commentsRejected && <ReadErrorBanner />}
          {readResult?.prefill && !bannerDismissed && (
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

          <div style={{ marginTop: 16 }}>
            <Dropdown3
              label="Complexity"
              ariaLabel="Complexity level"
              value={c}
              onChange={setC}
              disabled={isLoading}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <Dropdown3
              label="Uncertainty"
              ariaLabel="Uncertainty level"
              value={u}
              onChange={setU}
              disabled={isLoading}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <Dropdown3
              label="Effort"
              ariaLabel="Effort level"
              value={e}
              onChange={setE}
              disabled={isLoading}
            />
          </div>

          <CalcPanel result={result} />

          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <ButtonGroup>
              <Button
                text="Cancel"
                onClick={handleCancel}
                ariaLabel="Cancel and close dialog"
              />
              <Button
                text="Apply"
                primary={true}
                onClick={handleApply}
                disabled={!isAllSelected || isLoading}
                ariaLabel="Apply Story Points to work item"
              />
            </ButtonGroup>
          </div>
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
        </div>
      </Page>
    </Surface>
  );
};
