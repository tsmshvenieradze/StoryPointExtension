// src/ui/ReadOnlyMessage.tsx — Source: D-06 (CONTEXT.md);
//   APPLY-09 (REQUIREMENTS.md as rewritten by Plan 04-02);
//   UI-SPEC §"Read-only branch".
//
// Parallel shape to NoFieldMessage.tsx — replaces the entire calculator
// UI when CalcModal mode === "readonly". Per D-06: no Close button (the
// host's Esc / X / outside-click are the close affordances; mirror Phase 3
// NoFieldMessage's hint pattern for discoverability).
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";

export const ReadOnlyMessage: React.FC = () => (
  <div
    role="region"
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 280,
    }}
  >
    <MessageCard severity={MessageCardSeverity.Info}>
      You don&apos;t have permission to change this work item. The Story Point Calculator is read-only here.
    </MessageCard>
    <p style={{ marginTop: 8, fontSize: 11, opacity: 0.5 }}>
      Press Esc or click outside to close.
    </p>
  </div>
);
