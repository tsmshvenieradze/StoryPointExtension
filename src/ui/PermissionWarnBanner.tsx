// src/ui/PermissionWarnBanner.tsx — Source: D-07 (CONTEXT.md);
//   APPLY-09 (REQUIREMENTS.md as rewritten by Plan 04-02);
//   UI-SPEC §"Permission-warn banner".
//
// Banner-stack item between read-error (Phase 3 D-25) and pre-fill
// (Phase 3 D-12). Renders only when readResult.permission?.probeFailed
// === true. Dismissable; does NOT block the user — Apply still attempts
// the write; the actual write's error path takes over with precise messages.
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";

interface Props {
  onDismiss: () => void;
}

export const PermissionWarnBanner: React.FC<Props> = ({ onDismiss }) => (
  <MessageCard
    severity={MessageCardSeverity.Warning}
    onDismiss={onDismiss}
  >
    Could not verify your permissions — Apply may fail if this work item is read-only.
  </MessageCard>
);
