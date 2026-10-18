import { SCORING } from '../config/scoring';

export function placementPoints(cellCount: number): number {
  return cellCount * SCORING.perCell;
}

/**
 * Bonus for the lines cleared by one placement.
 * `combo` is the streak including this placement: 1 for a first clear,
 * 2 when the previous placement also cleared, and so on.
 */
export function clearPoints(lines: number, combo: number): number {
  if (lines <= 0) return 0;
  return SCORING.lineBase * lines * lines * Math.max(1, combo);
}

export function boardClearPoints(): number {
  return SCORING.boardClearBonus;
}

/** Round a target to a tidy number. */
export function tidy(n: number): number {
  const step = n < 100 ? 5 : n < 1000 ? 10 : n < 5000 ? 50 : 100;
  return Math.max(step, Math.round(n / step) * step);
}
