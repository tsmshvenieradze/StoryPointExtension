// src/calc/fibonacci.ts — Source: xlsx F22 IF-chain (verified extracted from xl/worksheets/sheet1.xml line F22)
// IF(G19<=0.75, 0.5, IF(G19<=1.5, 1, IF(G19<=2.5, 2, IF(G19<=4, 3, IF(G19<=6.5, 5, IF(G19<=10.5, 8, 13))))))

export type FibonacciSp = 0.5 | 1 | 2 | 3 | 5 | 8 | 13;

export const FIB_THRESHOLDS: ReadonlyArray<readonly [number, FibonacciSp]> = [
  [0.75, 0.5],
  [1.5,  1],
  [2.5,  2],
  [4.0,  3],
  [6.5,  5],
  [10.5, 8],
] as const;

export function roundFib(rawSp: number): FibonacciSp {
  for (const [threshold, value] of FIB_THRESHOLDS) {
    if (rawSp <= threshold) return value;
  }
  return 13;
}
