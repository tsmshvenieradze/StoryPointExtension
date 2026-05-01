// tests/audit/serialize.test.ts — Source: D-20, D-21, D-24; AUDIT-02, AUDIT-07
import { describe, it, expect } from 'vitest';
import { LEVELS } from '../../src/calc/levels';
import { calculate } from '../../src/calc/engine';
import { serialize } from '../../src/audit/serialize';
import { parse } from '../../src/audit/parse';
import type { AuditPayload } from '../../src/audit/types';
import * as auditBarrel from '../../src/audit/index';

describe('public API barrel (D-18, D-19)', () => {
  it('src/audit/index.ts re-exports the documented surface', () => {
    expect(typeof auditBarrel.serialize).toBe('function');
    expect(typeof auditBarrel.parse).toBe('function');
    expect(typeof auditBarrel.parseLatest).toBe('function');
  });
});

describe('serialize: deterministic stable key order (AUDIT-02)', () => {
  it('produces canonical sentinel format', () => {
    const payload: AuditPayload = { sp: 5, c: 'Hard', u: 'Medium', e: 'Easy', schemaVersion: 1 };
    const out = serialize(payload);
    expect(out).toBe(
      '<!-- sp-calc:v1 {"sp":5,"c":"Hard","u":"Medium","e":"Easy","schemaVersion":1} -->\n' +
      'Story Points: 5 (Complexity=Hard, Uncertainty=Medium, Effort=Easy)'
    );
  });

  it('produces identical output regardless of input field declaration order', () => {
    const a: AuditPayload = { sp: 5, c: 'Hard', u: 'Medium', e: 'Easy', schemaVersion: 1 };
    // Same fields, different declaration order:
    const b: AuditPayload = { schemaVersion: 1, e: 'Easy', u: 'Medium', c: 'Hard', sp: 5 } as AuditPayload;
    expect(serialize(a)).toBe(serialize(b));
  });
});

describe('round-trip: parse(serialize(input)) === input for all 125 cases (AUDIT-07, D-21)', () => {
  // Derive 125 payloads programmatically: for every (c, u, e), use calculate() to get expected sp.
  // This is acceptable per RESEARCH §Open Question 1 — the round-trip property tests the codec,
  // not whether sp is the "correct" value (Plan 01-01 already proved sp matches the xlsx).
  const cases: ReadonlyArray<AuditPayload> = LEVELS.flatMap((c) =>
    LEVELS.flatMap((u) =>
      LEVELS.map((e): AuditPayload => {
        const { sp } = calculate({ c, u, e });
        return { sp, c, u, e, schemaVersion: 1 };
      })
    )
  );

  it('cases array contains 125 unique payloads', () => {
    expect(cases).toHaveLength(125);
    const seen = new Set<string>();
    for (const p of cases) seen.add(`${p.c}|${p.u}|${p.e}|${p.sp}`);
    expect(seen.size).toBe(125);
  });

  it.each(cases)('round-trip {c:$c, u:$u, e:$e, sp:$sp}', (payload) => {
    const wire = serialize(payload);
    const parsed = parse(wire);
    expect(parsed).toEqual(payload);
  });
});
