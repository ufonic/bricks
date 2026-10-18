import { ENDLESS } from '../config/difficulty';
import { UNDO_STACK_CAP } from '../config/scoring';
import { OBSTACLE_COLOR, PIECE_COLORS } from '../config/theme';
import { canPlace, clearLines, countStartCells, emptyBoard, findFullLines, fitsAnywhere, isBoardClear, place } from './board';
import { dealTray } from './dealer';
import { allObjectivesMet } from './objectives';
import { tierWeightsFor } from './pieces';
import { createRng } from './rng';
import { boardClearPoints, clearPoints, placementPoints } from './scoring';
import type { Board, ColorId, GameEvent, GameMode, GameState, LevelInfo, Snapshot, TierWeights } from './types';

export interface NewGameParams {
  mode: GameMode;
  /** Seed for the deal sequence. */
  seed: number;
  board?: Board;
  level?: LevelInfo | null;
  levelNumber?: number;
  dailyDate?: string;
  friendly?: boolean;
}

export interface MoveOptions {
  friendly?: boolean;
  /** Skip the undo snapshot (used by the bot). */
  noUndo?: boolean;
}

export interface MoveResult {
  state: GameState;
  events: GameEvent[];
}

/** Levels keep the obstacle color for starting blocks only. */
function dealColors(mode: GameMode): ColorId[] {
  return mode === 'endless' ? PIECE_COLORS.slice() : PIECE_COLORS.filter((c) => c !== OBSTACLE_COLOR);
}

export function endlessTierWeights(score: number): TierWeights {
  const d = Math.min(ENDLESS.max, ENDLESS.start + Math.floor(score / ENDLESS.every) * ENDLESS.step);
  return tierWeightsFor(d);
}

export function newGame(p: NewGameParams): GameState {
  const board = p.board ?? emptyBoard();
  const level = p.level ?? null;
  const tierWeights = level ? tierWeightsFor(level.difficulty) : endlessTierWeights(0);
  const rng = createRng(p.seed);
  const tray = dealTray(board, rng, { tierWeights, colors: dealColors(p.mode), friendly: p.friendly });
  const state: GameState = {
    mode: p.mode,
    levelNumber: p.levelNumber,
    dailyDate: p.dailyDate,
    level,
    board,
    tray,
    score: 0,
    combo: 0,
    movesUsed: 0,
    rngState: rng.state,
    progress: { lines: 0, gems: 0, blocksCleared: 0 },
    goalMet: false,
    tierWeights,
    status: 'playing',
    undoStack: [],
    undosUsed: 0,
    startCells: countStartCells(board),
  };
  if (!state.tray.some((pc) => pc && fitsAnywhere(board, pc.cells))) state.status = endStatus(state);
  return state;
}

function snapshot(s: GameState): Snapshot {
  return {
    board: s.board,
    tray: s.tray,
    score: s.score,
    combo: s.combo,
    movesUsed: s.movesUsed,
    rngState: s.rngState,
    progress: s.progress,
    goalMet: s.goalMet,
    tierWeights: s.tierWeights,
  };
}

/** Status when play stops: levels are won if the goal was already met. */
function endStatus(s: GameState): GameState['status'] {
  if (s.mode === 'endless') return 'over';
  return s.goalMet ? 'won' : 'lost';
}

export function isGameOver(state: GameState): boolean {
  return !state.tray.some((p) => p !== null && fitsAnywhere(state.board, p.cells));
}

export function applyMove(state: GameState, pieceIndex: number, row: number, col: number, opts: MoveOptions = {}): MoveResult {
  const piece = state.tray[pieceIndex];
  if (state.status !== 'playing' || !piece || !canPlace(state.board, piece.cells, row, col)) {
    return { state, events: [{ type: 'invalid' }] };
  }
  const events: GameEvent[] = [];
  const s: GameState = { ...state, progress: { ...state.progress } };
  if (!opts.noUndo) s.undoStack = [...state.undoStack, snapshot(state)].slice(-UNDO_STACK_CAP);

  // Place.
  const placedPoints = placementPoints(piece.cells.length);
  s.board = place(state.board, piece.cells, row, col, piece.color);
  s.score += placedPoints;
  events.push({ type: 'placed', pieceIndex, row, col, cells: piece.cells, color: piece.color, points: placedPoints });

  // Clear every full row and column at once.
  const { rows, cols } = findFullLines(s.board);
  const lines = rows.length + cols.length;
  if (lines > 0) {
    const res = clearLines(s.board, rows, cols);
    s.board = res.board;
    s.combo = state.combo + 1;
    const points = clearPoints(lines, s.combo);
    s.score += points;
    s.progress.lines += lines;
    s.progress.gems += res.gems;
    s.progress.blocksCleared += res.blocksCleared;
    events.push({ type: 'linesCleared', rows, cols, cells: res.cells, lines, combo: s.combo, points });
    if (res.gems > 0) events.push({ type: 'gemsCollected', count: res.gems });
    if (isBoardClear(s.board)) {
      const bonus = boardClearPoints();
      s.score += bonus;
      events.push({ type: 'boardClear', points: bonus });
    }
  } else {
    s.combo = 0;
  }
  s.movesUsed += 1;

  // Endless difficulty creeps up with score.
  if (s.mode === 'endless') s.tierWeights = endlessTierWeights(s.score);

  // Tray: deal a fresh 3 only once all are placed.
  s.tray = state.tray.map((p, i) => (i === pieceIndex ? null : p));
  if (s.tray.every((p) => p === null)) {
    const rng = createRng(s.rngState);
    s.tray = dealTray(s.board, rng, { tierWeights: s.tierWeights, colors: dealColors(s.mode), friendly: opts.friendly });
    s.rngState = rng.state;
    events.push({ type: 'dealt' });
  }

  // Objectives. A level with no objectives (the generator's bot run) never ends on a goal.
  if (s.level && s.level.objectives.length > 0 && !s.goalMet && allObjectivesMet(s.level, s.progress, s.score)) {
    s.goalMet = true;
    events.push({ type: 'objectiveMet' });
  }

  // End conditions: meeting the goal wins immediately.
  if (s.goalMet) {
    s.status = 'won';
  } else if (s.level?.moveLimit != null && s.movesUsed >= s.level.moveLimit) {
    s.status = endStatus(s);
  } else if (isGameOver(s)) {
    s.status = endStatus(s);
  }
  if (s.status !== 'playing') events.push({ type: 'gameOver', status: s.status });
  return { state: s, events };
}

export function canUndo(state: GameState, undoLimit: number): boolean {
  if (state.undoStack.length === 0 || state.status === 'won') return false;
  return undoLimit < 0 || state.undosUsed < undoLimit;
}

/** Restores the previous board, tray, score, combo and RNG. Also revives a lost game. */
export function undo(state: GameState): GameState {
  const prev = state.undoStack[state.undoStack.length - 1];
  if (!prev) return state;
  return {
    ...state,
    ...prev,
    undoStack: state.undoStack.slice(0, -1),
    undosUsed: state.undosUsed + 1,
    status: 'playing',
  };
}
