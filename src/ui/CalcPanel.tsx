// src/ui/CalcPanel.tsx — Source: D-04, D-05; UI-SPEC §Calculation Details panel.
// Pure render. result: null → em-dash placeholders; result: CalcResult →
// formatted W (2 decimals), Raw SP (2 decimals), Final SP (integer or 0.5).
// Formula text always visible (D-04). Hero treatment on Final SP via 28px
// semibold (UI-SPEC Typography table).
import * as React from "react";
import type { CalcResult } from "../calc";

const TYPO = {
  heroLabel: {
    fontSize: "12px",
    fontWeight: 400,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    opacity: 0.7,
  },
  hero: {
    fontSize: "28px",
    fontWeight: 600,
    lineHeight: 1.2,
  },
  subRow: {
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.4,
  },
  formula: {
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.5,
    opacity: 0.7,
  },
};

const PANEL_STYLE: React.CSSProperties = {
  border: "1px solid var(--callout-border-color)",
  borderRadius: 4,
  padding: "24px 16px",
  marginTop: 24,
};

interface Props {
  result: CalcResult | null;   // null → em-dash placeholders (D-05)
}

export const CalcPanel: React.FC<Props> = ({ result }) => {
  const w = result ? result.w.toFixed(2) : "—";
  const rawSpStr = result ? result.rawSp.toFixed(2) : "—";
  const sp = result ? String(result.sp) : "—";

  return (
    <output role="status" aria-live="polite" style={{ display: "block" }}>
      <section style={PANEL_STYLE}>
        <div style={TYPO.heroLabel}>Final Story Points</div>
        <div style={{ ...TYPO.hero, marginTop: 4 }}>{sp}</div>
        <div
          style={{
            ...TYPO.subRow,
            marginTop: 8,
            display: "flex",
            gap: 16,
          }}
        >
          <span>W = {w}</span>
          <span>Raw SP = {rawSpStr}</span>
        </div>
        <p style={{ ...TYPO.formula, marginTop: 16, marginBottom: 0 }}>
          W = 0.4·C + 0.4·U + 0.2·E
        </p>
        <p style={{ ...TYPO.formula, marginTop: 4, marginBottom: 0 }}>
          SP = round_fib(0.5 × 26^((W−1)/4))
        </p>
      </section>
    </output>
  );
};
