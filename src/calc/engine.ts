// src/calc/engine.ts — Source: xlsx G18 (W formula) + G19 (Raw SP formula); D-15, D-16
import { levelToScore, type Level, type Score } from './levels';
import { roundFib, type FibonacciSp } from './fibonacci';

export type CalcInput = { c: Level; u: Level; e: Level };
export type CalcResult = {
  w: number;
  rawSp: number;
  sp: FibonacciSp;
  input: CalcInput;
};

/** xlsx G18: 0.4*C + 0.4*U + 0.2*E */
export function weightedSum(c: Score, u: Score, e: Score): number {
  return 0.4 * c + 0.4 * u + 0.2 * e;
}

/** xlsx G19: 0.5 * 26^((W-1)/4) */
export function rawSp(w: number): number {
  return 0.5 * Math.pow(26, (w - 1) / 4);
}

export function calculate(input: CalcInput): CalcResult {
  const c = levelToScore(input.c);
  const u = levelToScore(input.u);
  const e = levelToScore(input.e);
  const w = weightedSum(c, u, e);
  const r = rawSp(w);
  return {
    w,
    rawSp: r,
    sp: roundFib(r),
    input,
  };
}
