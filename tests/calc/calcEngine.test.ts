// tests/calc/calcEngine.test.ts — Source: D-20, D-22, D-24; replaces tests/smoke.test.ts (D-27 — deleted in this same commit)
import { describe, it, expect } from 'vitest';
import { LEVELS, levelToScore } from '../../src/calc/levels';
import { roundFib } from '../../src/calc/fibonacci';
import { weightedSum, rawSp, calculate } from '../../src/calc/engine';
import { ALL_CASES } from './fixtures/all-cases';

describe('levelToScore: every label maps correctly (CALC-01)', () => {
  it.each([
    { label: 'Very Easy' as const, expected: 1 },
    { label: 'Easy'      as const, expected: 2 },
    { label: 'Medium'    as const, expected: 3 },
    { label: 'Hard'      as const, expected: 4 },
    { label: 'Very Hard' as const, expected: 5 },
  ])('levelToScore($label) = $expected', ({ label, expected }) => {
    expect(levelToScore(label)).toBe(expected);
  });

  it('LEVELS contains exactly the five canonical labels in dropdown order', () => {
    expect(LEVELS).toEqual(['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard']);
  });
});

describe('weightedSum: matches xlsx G18 formula (CALC-02)', () => {
  it.each([
    { c: 1, u: 1, e: 1, expected: 1.0 },
    { c: 5, u: 5, e: 5, expected: 5.0 },
    { c: 3, u: 3, e: 3, expected: 3.0 },
    { c: 4, u: 3, e: 2, expected: 3.2 },
    { c: 4, u: 4, e: 4, expected: 4.0 },
  ])('weightedSum($c, $u, $e) = $expected', ({ c, u, e, expected }) => {
    expect(weightedSum(c as 1|2|3|4|5, u as 1|2|3|4|5, e as 1|2|3|4|5)).toBeCloseTo(expected, 10);
  });
});

describe('rawSp: matches xlsx G19 formula (CALC-03)', () => {
  it.each([
    { w: 1.0, expected: 0.5 },
    { w: 5.0, expected: 13.0 },
    { w: 4.0, expected: 5.7570501854989171 },
    { w: 3.0, expected: 2.5495097567963922 },
  ])('rawSp($w) = $expected', ({ w, expected }) => {
    expect(rawSp(w)).toBeCloseTo(expected, 10);
  });
});

describe('roundFib: threshold boundaries (CALC-04 + D-22)', () => {
  it.each([
    { rawSp: 0,         expected: 0.5 },
    { rawSp: 0.5,       expected: 0.5 },
    { rawSp: 0.75,      expected: 0.5 },
    { rawSp: 0.7500001, expected: 1   },
    { rawSp: 1.0,       expected: 1   },
    { rawSp: 1.5,       expected: 1   },
    { rawSp: 1.5000001, expected: 2   },
    { rawSp: 2.0,       expected: 2   },
    { rawSp: 2.5,       expected: 2   },
    { rawSp: 2.5000001, expected: 3   },
    { rawSp: 3.0,       expected: 3   },
    { rawSp: 4.0,       expected: 3   },
    { rawSp: 4.0000001, expected: 5   },
    { rawSp: 5.0,       expected: 5   },
    { rawSp: 6.5,       expected: 5   },
    { rawSp: 6.5000001, expected: 8   },
    { rawSp: 8.0,       expected: 8   },
    { rawSp: 10.5,      expected: 8   },
    { rawSp: 10.5000001, expected: 13 },
    { rawSp: 11.0,      expected: 13  },
    { rawSp: 1000.0,    expected: 13  },
  ])('roundFib($rawSp) = $expected', ({ rawSp, expected }) => {
    expect(roundFib(rawSp)).toBe(expected);
  });
});

describe('calculate: 125-case xlsx parity (CALC-04 + CALC-05)', () => {
  it.each(ALL_CASES)(
    'calculate({c:$c, u:$u, e:$e}).sp = $sp',
    ({ c, u, e, sp }) => {
      const result = calculate({ c, u, e });
      expect(result.sp).toBe(sp);
      expect(typeof result.w).toBe('number');
      expect(typeof result.rawSp).toBe('number');
      expect(result.input).toEqual({ c, u, e });
    },
  );

  it('exhausts the level cross-product (5x5x5 = 125 cases)', () => {
    expect(ALL_CASES).toHaveLength(125);
    // Defensive: ensure the fixture iterates LEVELS x LEVELS x LEVELS without dupes.
    const seen = new Set<string>();
    for (const r of ALL_CASES) seen.add(`${r.c}|${r.u}|${r.e}`);
    expect(seen.size).toBe(125);
  });

  it('every Fibonacci bucket has the expected case count (CALC-05 bucket coverage)', () => {
    const counts: Record<string, number> = {};
    for (const r of ALL_CASES) counts[String(r.sp)] = (counts[String(r.sp)] ?? 0) + 1;
    expect(counts).toEqual({
      '0.5': 5,
      '1': 23,
      '2': 28,
      '3': 34,
      '5': 21,
      '8': 12,
      '13': 2,
    });
  });
});
