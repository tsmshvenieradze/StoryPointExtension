// src/calc/levels.ts — Source: D-03, D-05, D-17; verified xlsx D5..D9 score values
export const LEVELS = Object.freeze([
  'Very Easy',
  'Easy',
  'Medium',
  'Hard',
  'Very Hard',
] as const);

export type Level = (typeof LEVELS)[number];
export type Score = 1 | 2 | 3 | 4 | 5;

export const LEVEL_TO_SCORE: Readonly<Record<Level, Score>> = Object.freeze({
  'Very Easy': 1,
  'Easy':      2,
  'Medium':    3,
  'Hard':      4,
  'Very Hard': 5,
});

export const SCORE_TO_LEVEL: Readonly<Record<Score, Level>> = Object.freeze({
  1: 'Very Easy',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Very Hard',
});

export function levelToScore(label: Level): Score {
  return LEVEL_TO_SCORE[label];
}

export function scoreToLevel(score: Score): Level {
  return SCORE_TO_LEVEL[score];
}
