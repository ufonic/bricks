// Every tunable number for level generation and the difficulty curve.

/** Bump to regenerate every level. Saved progress (highest level, stars) is kept. */
export const GENERATOR_VERSION = 1;

export const CURVE = {
  /** Level count over which base difficulty rises toward 1 (exponential approach). */
  rampLevels: 120,
  /** Small rise within each block of 10 levels (sawtooth). */
  sawtooth: 0.06,
  breatherEvery: 10,
  breatherDrop: 0.22,
  bossEvery: 25,
  bossBoost: 0.12,
  /** Difficulty used for every daily puzzle. */
  daily: 0.45,
} as const;

export const FILL = {
  /** Starting-block fill ratio at d = 0 and d = 1. */
  min: 0.1,
  max: 0.45,
} as const;

/** Tier weight multipliers interpolated by difficulty (d = 0 → first, d = 1 → second). */
export const TIER_MULTIPLIERS = {
  easy: [1, 1],
  medium: [0.6, 1.3],
  hard: [0.2, 1.4],
} as const;

export const ENDLESS = {
  /** Starting difficulty for piece weights. */
  start: 0.15,
  /** Every `every` points, difficulty rises by `step`, up to `max`. */
  every: 1000,
  step: 0.07,
  max: 1,
} as const;

export const DEALER = {
  /** Draw retries to find a tray where at least one piece fits. */
  fairnessRetries: 20,
  /** Weight multiplier for pieces that can complete a line, with Friendly deals on. */
  friendlyBoost: 3,
} as const;

/** Level at which each objective or mechanic first appears (and is forced). */
export const UNLOCKS = {
  lines: 3,
  clearBlocks: 5,
  gems: 15,
  moves: 25,
  stone: 40,
  lock: 60,
} as const;

export const LEVELGEN = {
  maxTries: 50,
  /** Lower the fill ratio by this factor after every `lowerFillEvery` failed tries. */
  lowerFillEvery: 10,
  lowerFillFactor: 0.85,
  /** The bot must reach this fraction of a fixed goal (blocks, gems). */
  botMinRatio: 0.7,
  /** The bot must play at least this fraction of its simulated moves before getting stuck. */
  minSurvival: 0.5,
  /** Placements the bot simulates: interpolated by d. */
  botMoves: [22, 45],
  /** Score / line targets as a fraction of the bot's result: easy → hard. */
  tightness: [0.8, 1.1],
  /** On move-limited levels targets must stay reachable inside the limit. */
  movesTightness: [0.6, 0.9],
  /** Move limit = bot moves to goal × slack (easy → hard), plus a few spare moves. */
  moveSlack: [1.6, 1.15],
  moveSpare: 2,
  /** Chance a level after the unlock uses a move limit (scaled by d). */
  moveLimitChance: 0.35,
  /** Chance a level after the unlock mixes in stones / locks. */
  stoneChance: 0.4,
  lockChance: 0.35,
  /** Fraction of starting blocks that become stone when stones are used. */
  stoneFraction: [0.2, 0.45],
  maxLocks: [1, 4],
  /** Gems hidden in starting blocks. */
  gems: [3, 8],
  minLinesTarget: 4,
} as const;

/** Relative weights for picking a level's objective once unlocked. */
export const OBJECTIVE_WEIGHTS = {
  score: 3,
  lines: 2,
  clearBlocks: 3,
  gems: 2,
} as const;
