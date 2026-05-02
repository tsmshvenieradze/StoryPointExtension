// src/ui/SavingOverlay.tsx — Source: D-15 (CONTEXT.md); UI-SPEC §"Saving overlay".
//
// Absolutely-positioned dim overlay rendered by CalcModal when mode === "saving".
// The parent body container needs `position: relative` so `inset: 0` resolves correctly.
// Per RESEARCH Pitfall 7: pointer-events alone is insufficient; the orchestrator
// (Plan 04-05) ALSO sets `aria-hidden="true"` on the body container during saving
// and passes `disabled={mode === "saving"}` to Dropdown3 components.
//
// ARIA: role="status" + aria-live="polite" announces "Saving" to screen readers
// without interrupting; aria-busy="true" signals work in flight.
import * as React from "react";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";

export const SavingOverlay: React.FC = () => (
  <div
    role="status"
    aria-live="polite"
    aria-busy="true"
    style={{
      position: "absolute",
      inset: 0,
      background: "var(--surface-background-color)",
      opacity: 0.6,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "auto",
      zIndex: 10,
    }}
  >
    <Spinner size={SpinnerSize.medium} ariaLabel="Saving" />
    <p style={{ marginTop: 8, fontSize: 13, fontWeight: 400, opacity: 0.8 }}>
      Saving…
    </p>
  </div>
);
