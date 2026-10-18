import { BOARD_SIZE, type Board, type Coord, type GameState } from './types';
import { applyMove } from './game';

// Greedy solver used by the level generator to check that a level is beatable
// and to set its targets. Each move: clear the most lines, tie-break by fewest holes,
// then by how snugly the piece fits.

const N = BOARD_SIZE;
// Cell codes for the fast simulation grid.
const EMPTY = 0;
const CLEARABLE = 1;
const STONE2 = 2;
const LOCK = 3;
const START = 4; // clearable starting obstacle (bonus for removing it)

function encode(board: Board): Uint8Array {
  const g = new Uint8Array(N * N);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cell = board[r][c];
      g[r * N + c] =
        cell.kind === 'empty' ? EMPTY
        : cell.kind === 'lock' ? LOCK
        : cell.kind === 'stone' ? (cell.hp === 2 ? STONE2 : START)
        : cell.kind === 'gem' || (cell.kind === 'block' && cell.start) ? START
        : CLEARABLE;
    }
  }
  return g;
}

export interface BotMove {
  pieceIndex: number;
  row: number;
  col: number;
  value: number;
}

function evaluate(grid: Uint8Array, cells: readonly Coord[], row: number, col: number): number {
  const g = grid.slice();
  for (const [dr, dc] of cells) g[(row + dr) * N + col + dc] = CLEARABLE;

  const fullRows: number[] = [];
  const fullCols: number[] = [];
  for (let r = 0; r < N; r++) {
    let full = true;
    for (let c = 0; c < N && full; c++) full = g[r * N + c] !== EMPTY;
    if (full) fullRows.push(r);
  }
  for (let c = 0; c < N; c++) {
    let full = true;
    for (let r = 0; r < N && full; r++) full = g[r * N + c] !== EMPTY;
    if (full) fullCols.push(c);
  }
  const lines = fullRows.length + fullCols.length;
  let startCleared = 0;
  if (lines > 0) {
    const hit = new Uint8Array(N * N);
    for (const r of fullRows) for (let c = 0; c < N; c++) hit[r * N + c] = 1;
    for (const c of fullCols) for (let r = 0; r < N; r++) hit[r * N + c] = 1;
    for (let i = 0; i < N * N; i++) {
      if (!hit[i]) continue;
      if (g[i] === STONE2) g[i] = START;
      else if (g[i] !== LOCK) {
        if (g[i] === START) startCleared++;
        g[i] = EMPTY;
      }
    }
  }

  // Holes: empty cells boxed in on all four sides.
  let holes = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (g[r * N + c] !== EMPTY) continue;
      const up = r === 0 || g[(r - 1) * N + c] !== EMPTY;
      const down = r === N - 1 || g[(r + 1) * N + c] !== EMPTY;
      const left = c === 0 || g[r * N + c - 1] !== EMPTY;
      const right = c === N - 1 || g[r * N + c + 1] !== EMPTY;
      if (up && down && left && right) holes++;
    }
  }

  // Contact: piece edges touching walls or filled cells (before clearing).
  let contact = 0;
  for (const [dr, dc] of cells) {
    const r = row + dr;
    const c = col + dc;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) contact++;
      else if (grid[nr * N + nc] !== EMPTY) contact++;
    }
  }

  return lines * 100 + startCleared * 6 - holes * 12 + contact;
}

export function bestMove(state: GameState): BotMove | null {
  const grid = encode(state.board);
  let best: BotMove | null = null;
  state.tray.forEach((piece, pieceIndex) => {
    if (!piece) return;
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        let ok = true;
        for (const [dr, dc] of piece.cells) {
          const r = row + dr;
          const c = col + dc;
          if (r >= N || c >= N || grid[r * N + c] !== EMPTY) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const value = evaluate(grid, piece.cells, row, col);
        if (!best || value > best.value) best = { pieceIndex, row, col, value };
      }
    }
  });
  return best;
}

export interface BotTraceStep {
  moves: number;
  score: number;
  lines: number;
  gems: number;
  blocksCleared: number;
}

/** Plays until no piece fits or `maxMoves` placements, recording progress after each move. */
export function runBot(start: GameState, maxMoves: number): BotTraceStep[] {
  const trace: BotTraceStep[] = [];
  let state = start;
  while (state.status === 'playing' && trace.length < maxMoves) {
    const move = bestMove(state);
    if (!move) break;
    state = applyMove(state, move.pieceIndex, move.row, move.col, { noUndo: true }).state;
    trace.push({
      moves: state.movesUsed,
      score: state.score,
      lines: state.progress.lines,
      gems: state.progress.gems,
      blocksCleared: state.progress.blocksCleared,
    });
  }
  return trace;
}
