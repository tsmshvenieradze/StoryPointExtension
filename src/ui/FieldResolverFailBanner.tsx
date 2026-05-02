// src/ui/FieldResolverFailBanner.tsx — Source: D-20; UI-SPEC §FieldResolver-fail banner.
// Renders ABOVE pre-fill or read-error banners (stack: resolver-fail → read-error → pre-fill).
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";

export const FieldResolverFailBanner: React.FC = () => (
  <MessageCard severity={MessageCardSeverity.Warning}>
    Could not detect field type — assuming Microsoft.VSTS.Scheduling.StoryPoints.
  </MessageCard>
);
