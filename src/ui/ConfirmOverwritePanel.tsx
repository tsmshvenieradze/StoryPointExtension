// src/ui/ConfirmOverwritePanel.tsx — Source: D-03 (CONTEXT.md);
//   APPLY-04 (REQUIREMENTS.md); UI-SPEC §"Confirm overwrite panel".
//
// Replaces the calculator body (between context line and ButtonGroup)
// when CalcModal mode === "confirm". Dropdowns and calc panel are
// UNMOUNTED (per D-03 — keeps body height stable for D-15 overlay
// logic). Selection state lives in the orchestrator, not here.
import * as React from "react";
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";

interface Props {
  currentSp: number;       // guaranteed non-null per D-04 trigger threshold
  newSp: number;           // result of calculate({ c, u, e })
  onBack: () => void;      // returns to calculator mode, selections preserved
  onConfirm: () => void;   // triggers saving sequence
  isSaving: boolean;       // true during in-flight write — disables both buttons + swaps Confirm Apply label
}

export const ConfirmOverwritePanel: React.FC<Props> = ({
  currentSp, newSp, onBack, onConfirm, isSaving,
}) => (
  <section
    style={{ paddingTop: 32, display: "flex", flexDirection: "column", alignItems: "center" }}
    aria-labelledby="confirm-heading"
  >
    <h2
      id="confirm-heading"
      style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2, margin: 0, marginBottom: 16 }}
    >
      Confirm overwrite
    </h2>
    <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 16, rowGap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.7 }}>Current Story Points:</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{currentSp}</span>
      <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.7 }}>New Story Points:</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{newSp}</span>
    </div>
    <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", width: "100%" }}>
      <ButtonGroup>
        <Button
          text="Back"
          onClick={onBack}
          disabled={isSaving}
          ariaLabel="Back to calculator"
        />
        <Button
          text={isSaving ? "Saving…" : "Confirm Apply"}
          primary={true}
          onClick={onConfirm}
          disabled={isSaving}
          ariaLabel="Confirm Apply Story Points to work item"
        />
      </ButtonGroup>
    </div>
  </section>
);
