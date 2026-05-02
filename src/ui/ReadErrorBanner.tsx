// src/ui/ReadErrorBanner.tsx — Source: D-25; UI-SPEC §Read-error banner.
// Not dismissable (UI-SPEC line 246) — persists for the dialog lifetime.
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";

export const ReadErrorBanner: React.FC = () => (
  <MessageCard severity={MessageCardSeverity.Warning}>
    Could not load prior calculations — starting fresh.
  </MessageCard>
);
