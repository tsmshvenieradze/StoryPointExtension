// src/ui/FieldFailBanner.tsx — Source: D-09 (CONTEXT.md);
//   APPLY-08 (REQUIREMENTS.md); UI-SPEC §"Error banners (D-09)".
//
// Pinned to top of body region when CalcModal mode === "fieldFail".
// Comment is in the audit log (intentionally kept per D-09); Retry runs
// ONLY the field write. Same ButtonGroup swap as CommentFailBanner.
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { Button } from "azure-devops-ui/Button";

interface Props {
  friendlyMessage: string;       // from friendlyMessageForStatus(status)
  httpOrSdkLabel: string;        // either "HTTP 412" / "SDK error: RuleValidationException" / "HTTP n/a"
  onRetry: () => void;
}

export const FieldFailBanner: React.FC<Props> = ({ friendlyMessage, httpOrSdkLabel, onRetry }) => (
  <MessageCard severity={MessageCardSeverity.Error}>
    <div>
      Audit comment recorded. The Story Points field could not be updated. {friendlyMessage} ({httpOrSdkLabel})
    </div>
    <div style={{ marginTop: 8 }}>
      <Button
        text="Retry"
        primary={true}
        onClick={onRetry}
        ariaLabel="Retry saving Story Points field"
      />
    </div>
  </MessageCard>
);
