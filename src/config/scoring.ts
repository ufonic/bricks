// All scoring constants. Tune here, never inline.
export const SCORING = {
  /** Points per cell of a placed piece. */
  perCell: 1,
  /** Line bonus = lineBase × lines × lines (1 → 10, 2 → 40, 3 → 90, 4 → 160). */
  lineBase: 10,
  /** Extra points when a clear leaves the board empty (locks ignored). */
  boardClearBonus: 300,
} as const;

/** Star thresholds. A level ends as soon as its goal is met, so stars reward reaching it in few moves. */
export const STARS = {
  /** Moves used, as a multiple of the level's par (the bot's moves to the goal), for 3 / 2 stars. */
  parThree: 1,
  parTwo: 1.5,
  /** On move-limited levels: fraction of the limit left unused that earns 2 / 3 stars. */
  movesLeftTwo: 0.1,
  movesLeftThree: 0.25,
} as const;

/** How many snapshots the undo stack keeps. */
export const UNDO_STACK_CAP = 20;
