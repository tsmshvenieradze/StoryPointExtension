// src/ui/CommentFailBanner.tsx — Source: D-08 (CONTEXT.md);
//   APPLY-08 (REQUIREMENTS.md); UI-SPEC §"Error banners (D-08)".
//
// Pinned to top of body region when CalcModal mode === "commentFail".
// Replaces the bottom ButtonGroup contents from [Cancel][Apply] to just
// [Cancel] — the orchestrator (Plan 04-05) handles the swap; this component
// only renders the banner with embedded Retry. NOT dismissable — user
// must Retry or Cancel.
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { Button } from "azure-devops-ui/Button";

interface Props {
  friendlyMessage: string;     // from friendlyMessageForStatus(status)
  status: number | null;       // HTTP status for the parenthetical "(HTTP 404)"
  onRetry: () => void;
}

export const CommentFailBanner: React.FC<Props> = ({ friendlyMessage, status, onRetry }) => (
  <MessageCard severity={MessageCardSeverity.Error}>
    <div>
      Could not save audit comment. {friendlyMessage} (HTTP {status ?? "n/a"})
    </div>
    <div style={{ marginTop: 8 }}>
      <Button
        text="Retry"
        primary={true}
        onClick={onRetry}
        ariaLabel="Retry saving audit comment"
      />
    </div>
  </MessageCard>
);
