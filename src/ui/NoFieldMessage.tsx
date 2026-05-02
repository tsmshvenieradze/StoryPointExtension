// src/ui/NoFieldMessage.tsx — Source: D-19, Override 3; UI-SPEC §No-field state.
// Replaces the entire calculator UI when FieldResolver returns null for both
// StoryPoints and Size. Close button cannot programmatically dismiss the host
// dialog (Override 1 / no closeCustomDialog API), so a permanent hint sits below.
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { Button } from "azure-devops-ui/Button";

interface Props {
  typeName: string;
}

export const NoFieldMessage: React.FC<Props> = ({ typeName }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 280,
      gap: 16,
    }}
  >
    <MessageCard severity={MessageCardSeverity.Info}>
      {`This work item type (${typeName}) doesn't have a Story Points field. ` +
        `The Story Point Calculator works on work item types that include ` +
        `Microsoft.VSTS.Scheduling.StoryPoints (Agile/Scrum/Basic processes) or ` +
        `Microsoft.VSTS.Scheduling.Size (CMMI process).`}
    </MessageCard>
    <Button text="Close" ariaLabel="Close dialog" />
    <p style={{ fontSize: "11px", opacity: 0.5, marginTop: 8 }}>
      Press Esc or click outside the dialog to close.
    </p>
  </div>
);
