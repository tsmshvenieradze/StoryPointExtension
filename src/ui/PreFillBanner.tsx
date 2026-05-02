// src/ui/PreFillBanner.tsx — Source: D-12, D-13, D-14; UI-SPEC §Pre-fill banner.
// Renders ONLY when parseLatest() returned a valid AuditPayload AND payload
// c/u/e are valid Level strings (validated upstream by CalcModal per D-15).
import * as React from "react";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";

function formatBannerDate(iso: string): string {
  // D-13: absolute date, locale-aware. Host browser locale; en-US shape:
  // "May 1, 2026". ru-RU shape: "1 мая 2026 г."
  const fmt = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return fmt.format(new Date(iso));
}

interface Props {
  dateIso: string;
  mismatchSp: number | null;   // null when sentinel.sp === currentSp (no addendum)
  onDismiss: () => void;
}

export const PreFillBanner: React.FC<Props> = ({ dateIso, mismatchSp, onDismiss }) => (
  <MessageCard severity={MessageCardSeverity.Info} onDismiss={onDismiss}>
    {`Pre-filled from your last calculation on ${formatBannerDate(dateIso)}.`}
    {mismatchSp !== null
      ? ` Field currently shows ${mismatchSp} — may have been edited directly.`
      : null}
  </MessageCard>
);
