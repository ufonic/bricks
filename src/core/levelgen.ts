import {
  CURVE,
  FILL,
  GENERATOR_VERSION,
  LEVELGEN,
  OBJECTIVE_WEIGHTS,
  UNLOCKS,
} from '../config/difficulty';
import { OBSTACLE_COLOR } from '../config/theme';
import { countStartCells, emptyBoard, hasFullLine } from './board';
import { runBot, type BotTraceStep } from './bot';
import { newGame } from './game';
import { createRng, hashString, weightedPick, type Rng } from './rng';
import { tidy } from './scoring';
import { BOARD_SIZE, type Board, type Cell, type LevelInfo, type Mechanic, type Objective, type ObjectiveType } from './types';

const N = BOARD_SIZE;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const range = (r: readonly [number, number] | readonly number[], d: number) => lerp(r[0], r[1], d);

export interface GeneratedLevel {
  seed: number;
  board: Board;
  info: LevelInfo;
  /** Seed for the piece-deal sequence. */
  dealSeed: number;
}

export function isBoss(n: number): boolean {
  return n % CURVE.bossEvery === 0;
}

export function isBreather(n: number): boolean {
  return n % CURVE.breatherEvery === 0 && !isBoss(n);
}

/** Difficulty in [0, 1]: smooth ramp, small sawtooth per 10, breathers and bosses. */
export function difficultyFor(n: number): number {
  const base = 1 - Math.exp(-(n - 1) / CURVE.rampLevels);
  let d = base * (1 - CURVE.sawtooth) + CURVE.sawtooth * (((n - 1) % CURVE.breatherEvery) / (CURVE.breatherEvery - 1));
  if (isBreather(n)) d -= CURVE.breatherDrop;
  if (isBoss(n)) d += CURVE.bossBoost;
  return clamp01(d);
}

export function levelSeed(n: number): number {
  return hashString(`level:${n}:v${GENERATOR_VERSION}`);
}

export function dailySeed(date: string): number {
  return hashString(`daily:${date.replaceAll('-', '')}:v${GENERATOR_VERSION}`);
}

// ---------------------------------------------------------------------------
// Objectives and mechanics

interface Plan {
  types: ObjectiveType[];
  moveLimit: boolean;
  stone: boolean;
  lock: boolean;
}

function unlockedTypes(n: number | null): ObjectiveType[] {
  const at = n ?? Infinity;
  const types: ObjectiveType[] = ['score'];
  if (at >= UNLOCKS.lines) types.push('lines');
  if (at >= UNLOCKS.clearBlocks) types.push('clearBlocks');
  if (at >= UNLOCKS.gems) types.push('gems');
  return types;
}

function planLevel(rng: Rng, n: number | null, d: number): Plan {
  const pool = unlockedTypes(n);
  const pickType = (exclude: ObjectiveType[]) =>
    weightedPick(rng, pool, (t) => (exclude.includes(t) ? 0 : OBJECTIVE_WEIGHTS[t])) ?? 'score';

  let first: ObjectiveType;
  if (n === UNLOCKS.lines) first = 'lines';
  else if (n === UNLOCKS.clearBlocks) first = 'clearBlocks';
  else if (n === UNLOCKS.gems) first = 'gems';
  else if (n !== null && n < UNLOCKS.lines) first = 'score';
  else first = pickType([]);
  const types = [first];
  if (n !== null && isBoss(n) && pool.length > 1) types.push(pickType(types));

  const after = (u: number) => n === null || n > u;
  const breather = n !== null && isBreather(n);
  return {
    types,
    moveLimit: n === UNLOCKS.moves || (after(UNLOCKS.moves) && !breather && rng.next() < LEVELGEN.moveLimitChance * (0.5 + d)),
    stone: n === UNLOCKS.stone || (after(UNLOCKS.stone) && rng.next() < LEVELGEN.stoneChance),
    lock: n === UNLOCKS.lock || (after(UNLOCKS.lock) && rng.next() < LEVELGEN.lockChance),
  };
}

// ---------------------------------------------------------------------------
// Starting board patterns. Each returns a set of cell indices (r * 8 + c).

type Pattern = (rng: Rng, count: number) => Set<number>;

const idx = (r: number, c: number) => r * N + c;

const scattered: Pattern = (rng, count) => {
  const s = new Set<number>();
  while (s.size < count) s.add(rng.int(N * N));
  return s;
};

const symmetric: Pattern = (rng, count) => {
  const mode = rng.pick(['h', 'v', 'both'] as const);
  const s = new Set<number>();
  let guard = 0;
  while (s.size < count && guard++ < 500) {
    const r = rng.int(N);
    const c = rng.int(N);
    const pts = [[r, c]];
    if (mode !== 'v') pts.push([r, N - 1 - c]);
    if (mode !== 'h') pts.push([N - 1 - r, c]);
    if (mode === 'both') pts.push([N - 1 - r, N - 1 - c]);
    if (s.size + pts.length > count + 1) continue;
    for (const [pr, pc] of pts) s.add(idx(pr, pc));
  }
  return s;
};

const clustered: Pattern = (rng, count) => {
  const s = new Set<number>();
  const seeds = rng.range(2, 4);
  for (let i = 0; i < seeds; i++) s.add(rng.int(N * N));
  let guard = 0;
  while (s.size < count && guard++ < 2000) {
    const from = [...s][rng.int(s.size)];
    const r = Math.floor(from / N) + rng.range(-1, 1);
    const c = (from % N) + rng.range(-1, 1);
    if (r >= 0 && r < N && c >= 0 && c < N) s.add(idx(r, c));
  }
  return s;
};

const frame: Pattern = (rng, count) => {
  const inset = rng.int(2);
  const ring: number[] = [];
  for (let r = inset; r < N - inset; r++) {
    for (let c = inset; c < N - inset; c++) {
      if (r === inset || r === N - 1 - inset || c === inset || c === N - 1 - inset) ring.push(idx(r, c));
    }
  }
  const s = new Set<number>();
  for (const i of rng.shuffle(ring)) {
    if (s.size >= count) break;
    if (rng.next() < 0.75) s.add(i);
  }
  return s;
};

const checker: Pattern = (rng, count) => {
  const h = rng.range(3, N);
  const w = rng.range(3, N);
  const r0 = rng.int(N - h + 1);
  const c0 = rng.int(N - w + 1);
  const parity = rng.int(2);
  const cells: number[] = [];
  for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) if ((r + c) % 2 === parity) cells.push(idx(r, c));
  return new Set(rng.shuffle(cells).slice(0, count));
};

// Small original glyphs. '#' = block.
const GLYPHS = [
  ['.#..#.', '######', '######', '.####.', '..##..'], // heart
  ['..##..', '..##..', '######', '..##..', '..##..'], // plus
  ['#....#', '.#..#.', '..##..', '.#..#.', '#....#'], // X
  ['..#..', '.###.', '#####', '.###.', '..#..'], // diamond
  ['####', '#...', '###.', '#...', '####'], // E
  ['#..#', '#..#', '####', '#..#', '#..#'], // H
  ['.##.', '#..#', '#..#', '#..#', '.##.'], // O
  ['#...#', '#...#', '#.#.#', '##.##', '#...#'], // W
  ['.###.', '#...#', '..##.', '.....', '..#..'], // ?
  ['#.#.#', '.###.', '#####', '.###.', '#.#.#'], // star
];

const glyph: Pattern = (rng, count) => {
  const g = rng.pick(GLYPHS);
  const h = g.length;
  const w = g[0].length;
  const r0 = rng.int(N - h + 1);
  const c0 = rng.int(N - w + 1);
  const s = new Set<number>();
  g.forEach((line, r) => [...line].forEach((ch, c) => ch === '#' && s.add(idx(r0 + r, c0 + c))));
  // Top up with symmetric scatter if the glyph is small for this fill.
  if (s.size < count) for (const i of scattered(rng, count - s.size)) s.add(i);
  return s;
};

const PATTERNS: Pattern[] = [symmetric, symmetric, scattered, clustered, frame, checker, glyph];

interface BoardPlan {
  fill: number;
  gems: number;
  stone: boolean;
  lock: boolean;
  d: number;
}

function generateBoard(rng: Rng, p: BoardPlan): Board {
  const count = Math.max(0, Math.round(N * N * p.fill));
  const board = emptyBoard();
  const cells = count > 0 ? [...rng.pick(PATTERNS)(rng, count)] : [];
  const block: Cell = { kind: 'block', color: OBSTACLE_COLOR, start: true };
  for (const i of cells) board[Math.floor(i / N)][i % N] = block;

  const order = rng.shuffle(cells.slice());
  let k = 0;
  for (let g = 0; g < p.gems && k < order.length; g++, k++) {
    const i = order[k];
    board[Math.floor(i / N)][i % N] = { kind: 'gem', color: OBSTACLE_COLOR };
  }
  if (p.stone) {
    const stones = Math.max(1, Math.round(cells.length * range(LEVELGEN.stoneFraction, p.d)));
    for (let s = 0; s < stones && k < order.length; s++, k++) {
      const i = order[k];
      board[Math.floor(i / N)][i % N] = { kind: 'stone', hp: 2 };
    }
  }
  if (p.lock) {
    const locks = Math.round(range(LEVELGEN.maxLocks, p.d));
    for (let l = 0; l < locks; l++) {
      for (let tries = 0; tries < 20; tries++) {
        const r = rng.int(N);
        const c = rng.int(N);
        if (board[r][c].kind === 'empty') {
          board[r][c] = { kind: 'lock' };
          break;
        }
      }
    }
  }
  return board;
}

// ---------------------------------------------------------------------------
// Generation

interface Attempt {
  board: Board;
  dealSeed: number;
  trace: BotTraceStep[];
  ok: boolean;
  quality: number;
  objectives: Objective[];
  moveLimit: number | null;
  starRef: number;
}

const valueAt = (step: BotTraceStep | undefined, t: ObjectiveType) =>
  !step ? 0 : t === 'score' ? step.score : t === 'lines' ? step.lines : t === 'gems' ? step.gems : step.blocksCleared;

function evaluateAttempt(
  board: Board,
  dealSeed: number,
  trace: BotTraceStep[],
  plan: Plan,
  d: number,
  gemCount: number,
  botMoves: number,
): Attempt {
  const last = trace[trace.length - 1];
  const startCells = countStartCells(board);
  const tight = plan.moveLimit ? range(LEVELGEN.movesTightness, d) : range(LEVELGEN.tightness, d);
  // The bot must survive a fair share of its moves, or the board is just a trap.
  const survival = trace.length / botMoves;
  let ok = survival >= LEVELGEN.minSurvival;
  let quality = Math.min(1, survival);

  const objectives: Objective[] = plan.types.map((type) => {
    const got = valueAt(last, type);
    switch (type) {
      case 'score':
        return { type, target: tidy(Math.max(10, got * tight)) };
      case 'lines': {
        const target = Math.max(LEVELGEN.minLinesTarget, Math.round(got * tight));
        if (got < LEVELGEN.minLinesTarget) ok = false;
        return { type, target };
      }
      case 'gems':
      case 'clearBlocks': {
        const target = type === 'gems' ? gemCount : startCells;
        const ratio = target > 0 ? got / target : 0;
        quality = Math.min(quality, ratio);
        if (target === 0 || ratio < LEVELGEN.botMinRatio) ok = false;
        return { type, target };
      }
    }
  });

  // First move at which the bot met every objective.
  const metIndex = trace.findIndex((step) => objectives.every((o) => valueAt(step, o.type) >= o.target));
  let moveLimit: number | null = null;
  if (plan.moveLimit) {
    if (metIndex < 0) ok = false;
    else moveLimit = Math.ceil((metIndex + 1) * range(LEVELGEN.moveSlack, d)) + LEVELGEN.moveSpare;
  }

  const scoreObj = objectives.find((o) => o.type === 'score');
  const refStep = metIndex >= 0 ? trace[metIndex] : last;
  const starRef = scoreObj ? scoreObj.target : tidy(Math.max(10, (refStep?.score ?? 10)));

  return { board, dealSeed, trace, ok, quality, objectives, moveLimit, starRef };
}

function build(seed: number, d: number, n: number | null): GeneratedLevel {
  const rng = createRng(seed);
  const plan = planLevel(rng, n, d);
  const needsBlocks = plan.types.some((t) => t === 'clearBlocks' || t === 'gems') || plan.stone;
  let fill = Math.max(range([FILL.min, FILL.max], d), needsBlocks ? 0.14 : 0);
  const gemCount = plan.types.includes('gems') ? Math.round(range(LEVELGEN.gems, d)) : 0;
  const botMoves = Math.round(range(LEVELGEN.botMoves, d));

  let best: Attempt | null = null;
  for (let tries = 0; tries < LEVELGEN.maxTries; tries++) {
    if (tries > 0 && tries % LEVELGEN.lowerFillEvery === 0) fill *= LEVELGEN.lowerFillFactor;
    const board = generateBoard(rng, { fill, gems: gemCount, stone: plan.stone, lock: plan.lock, d });
    if (hasFullLine(board)) continue;
    const dealSeed = rng.uint();
    const start = newGame({
      mode: 'level',
      seed: dealSeed,
      board,
      level: { objectives: [], moveLimit: null, starRef: 0, difficulty: d, boss: false, breather: false, mechanics: [] },
    });
    const trace = runBot(start, botMoves);
    const attempt = evaluateAttempt(board, dealSeed, trace, plan, d, gemCount, botMoves);
    if (attempt.ok) {
      best = attempt;
      break;
    }
    if (!best || attempt.quality > best.quality) best = attempt;
  }
  if (!best) {
    // Every board had a full line (practically impossible): fall back to an empty board.
    const board = emptyBoard();
    const dealSeed = rng.uint();
    const start = newGame({ mode: 'level', seed: dealSeed, board, level: { objectives: [], moveLimit: null, starRef: 0, difficulty: d, boss: false, breather: false, mechanics: [] } });
    best = evaluateAttempt(board, dealSeed, runBot(start, botMoves), { ...plan, types: ['score'], moveLimit: false }, d, 0, botMoves);
  }

  // Fallback if nothing passed: keep the best board, make its fixed goals reachable.
  let { objectives, moveLimit } = best!;
  if (!best!.ok) {
    const last = best!.trace[best!.trace.length - 1];
    const scoreGoal: Objective = { type: 'score', target: tidy(Math.max(5, (last?.score ?? 5) * 0.8)) };
    objectives = objectives.map((o): Objective => {
      const got = valueAt(last, o.type);
      if (o.type === 'score') return scoreGoal;
      if (got <= 0 || (o.type === 'clearBlocks' && got < o.target)) return scoreGoal;
      return { ...o, target: Math.min(o.target, got) };
    });
    objectives = objectives.filter((o, i) => objectives.findIndex((x) => x.type === o.type) === i);
    moveLimit = null;
  }

  const mechanics: Mechanic[] = [];
  for (const o of objectives) if (o.type !== 'score' && !mechanics.includes(o.type)) mechanics.push(o.type);
  if (moveLimit !== null) mechanics.push('moves');
  const cells = best!.board.flat();
  if (cells.some((c) => c.kind === 'stone')) mechanics.push('stone');
  if (cells.some((c) => c.kind === 'lock')) mechanics.push('lock');

  return {
    seed,
    board: best!.board,
    dealSeed: best!.dealSeed,
    info: {
      objectives,
      moveLimit,
      starRef: objectives.find((o) => o.type === 'score')?.target ?? best!.starRef,
      difficulty: d,
      boss: n !== null && isBoss(n),
      breather: n !== null && isBreather(n),
      mechanics,
    },
  };
}

const cache = new Map<string, GeneratedLevel>();

/** Forget generated levels (tests use this to prove regeneration is identical). */
export function clearLevelCache(): void {
  cache.clear();
}

/** Level n, identical every time for the same GENERATOR_VERSION. */
export function generateLevel(n: number): GeneratedLevel {
  const key = `L${n}`;
  let lvl = cache.get(key);
  if (!lvl) {
    lvl = build(levelSeed(n), difficultyFor(n), n);
    cache.set(key, lvl);
  }
  return lvl;
}

/** The daily puzzle for a date in YYYY-MM-DD form. */
export function generateDaily(date: string): GeneratedLevel {
  const key = `D${date}`;
  let lvl = cache.get(key);
  if (!lvl) {
    lvl = build(dailySeed(date), CURVE.daily, null);
    cache.set(key, lvl);
  }
  return lvl;
}
