import { STARS } from '../config/scoring';
import type { LevelInfo, Objective, Progress } from './types';

export function objectiveValue(obj: Objective, progress: Progress, score: number): number {
  switch (obj.type) {
    case 'score':
      return score;
    case 'lines':
      return progress.lines;
    case 'gems':
      return progress.gems;
    case 'clearBlocks':
      return progress.blocksCleared;
  }
}

export function isObjectiveMet(obj: Objective, progress: Progress, score: number): boolean {
  return objectiveValue(obj, progress, score) >= obj.target;
}

export function allObjectivesMet(level: LevelInfo, progress: Progress, score: number): boolean {
  return level.objectives.every((o) => isObjectiveMet(o, progress, score));
}

/** 0 when the goal was not met; otherwise 1–3. */
export function computeStars(level: LevelInfo, goalMet: boolean, score: number, movesUsed: number): 0 | 1 | 2 | 3 {
  if (!goalMet) return 0;
  let stars = 1;
  if (score >= level.starRef * STARS.three) stars = 3;
  else if (score >= level.starRef * STARS.two) stars = 2;
  if (level.moveLimit !== null) {
    const left = (level.moveLimit - movesUsed) / level.moveLimit;
    if (left >= STARS.movesLeftThree) stars = 3;
    else if (left >= STARS.movesLeftTwo) stars = Math.max(stars, 2);
  }
  return stars as 1 | 2 | 3;
}

export function objectiveLabel(obj: Objective): string {
  switch (obj.type) {
    case 'score':
      return `Score ${obj.target.toLocaleString()}`;
    case 'lines':
      return `Clear ${obj.target} lines`;
    case 'gems':
      return `Collect ${obj.target} gems`;
    case 'clearBlocks':
      return 'Clear all blocks';
  }
}
