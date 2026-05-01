// src/calc/index.ts — Source: D-15, D-17 public API
export { LEVELS, LEVEL_TO_SCORE, SCORE_TO_LEVEL, levelToScore, scoreToLevel } from './levels';
export type { Level, Score } from './levels';
export { roundFib, FIB_THRESHOLDS } from './fibonacci';
export type { FibonacciSp } from './fibonacci';
export { calculate, weightedSum, rawSp } from './engine';
export type { CalcInput, CalcResult } from './engine';
