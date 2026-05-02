// src/ui/SavedIndicator.tsx — Source: D-10 (CONTEXT.md);
//   UI-SPEC §"Success indicator"; Plan 04-01 spike A4 verdict.
//
// Spike A4 verdict: NO-PROGRAMMATIC-CLOSE (per .planning/phases/04-write-path-edge-cases/
// 04-VERIFICATION.md §"Spike Results" §A4). There is NO SDK-driven path to dismiss
// the host dialog from this iframe — `notifyDialogResult`, `notifyDismiss`, and
// `closeCustomDialog` are all undefined on the SDK module at runtime; user-confirmed
// visual on cezari showed the modal did NOT close after any of those calls.
//
// Therefore D-10 is REDEFINED: SavedIndicator stays mounted persistently after
// the 200ms ✓ flash. The component fades the success state in, holds for 200ms,
// then swaps in a permanent "Press Esc to close." hint and remains in place
// until the user dismisses via the host's X button / Esc / outside-click
// (allowed in saved mode per D-15). NO programmatic close call is attempted.
//
// The optional `onAfterTimer` callback exists so Plan 04-05 can attach
// orchestrator-level behavior (e.g., logging, metrics) — it MUST NOT be used
// to invoke any SDK close API; that path is empirically dead.
//
// Future maintainer note: if a future SDK release exposes a working dialog-close
// surface, REVERIFY by re-running Plan 04-01 spike Probe 3 before re-introducing
// auto-close. Do not assume documentation alone — empirical evidence required.
import * as React from "react";

interface Props {
  onAfterTimer?: () => void;   // Plan 04-05 orchestrator callback; MUST NOT be a programmatic close (A4 dead path)
}

export const SavedIndicator: React.FC<Props> = ({ onAfterTimer }) => {
  const [showHint, setShowHint] = React.useState(false);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setShowHint(true);
      if (onAfterTimer) {
        onAfterTimer();
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [onAfterTimer]);

  return (
    <div
      style={{
        marginTop: 24,
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        role="status"
        aria-live="polite"
        style={{
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.2,
          color: "var(--status-success-foreground)",
        }}
      >
        Saved ✓
      </span>
      {showHint && (
        <span style={{ fontSize: 11, opacity: 0.5 }}>
          Press Esc to close.
        </span>
      )}
    </div>
  );
};
